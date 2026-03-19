/**
 * Batch import partner dossiers from Google Drive.
 * Downloads all .docx files from the configured folder, extracts structured
 * profiles via Claude Opus, and upserts to the database.
 *
 * Usage: npm run import:dossiers
 *
 * Environment variables:
 *   GOOGLE_DRIVE_DOSSIER_FOLDER_ID — required, the Drive folder ID
 *   IMPORT_DELAY_MS — delay between files in ms (default: 2000)
 *   IMPORT_DRY_RUN — set to "true" to list files without processing
 */
import { PrismaClient } from "@prisma/client";
import {
  listDossierFiles,
  downloadFile,
} from "../src/lib/clients/google-drive";
import { parseDocxToText } from "../src/lib/utils/docx-parser";
import { extractAndUpsertProfile } from "../src/lib/ingest/extract-and-upsert";

const prisma = new PrismaClient();

interface ImportResult {
  fileName: string;
  fileId: string;
  status: "success" | "error";
  name?: string;
  company?: string;
  isNew?: boolean;
  error?: string;
}

async function main() {
  const folderId = process.env.GOOGLE_DRIVE_DOSSIER_FOLDER_ID;
  if (!folderId) {
    throw new Error(
      "GOOGLE_DRIVE_DOSSIER_FOLDER_ID environment variable is required"
    );
  }

  const delayMs = parseInt(process.env.IMPORT_DELAY_MS || "2000", 10);
  const dryRun = process.env.IMPORT_DRY_RUN === "true";

  console.log(`\nAntonym Intelligence — Dossier Import`);
  console.log(`======================================`);
  console.log(`Folder ID: ${folderId}`);
  console.log(`Delay between files: ${delayMs}ms`);
  console.log(`Dry run: ${dryRun}\n`);

  // 1. List files
  const files = await listDossierFiles(folderId);
  console.log(`Found ${files.length} .docx files in Drive folder.\n`);

  if (files.length === 0) {
    console.log(
      "No .docx files found. Verify the folder ID and that the service account has access."
    );
    return;
  }

  if (dryRun) {
    for (const f of files) {
      console.log(`  ${f.name} (${f.fileId})`);
    }
    console.log(`\nDry run complete. No files processed.`);
    return;
  }

  // 2. Process sequentially
  const results: ImportResult[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const progress = `[${i + 1}/${files.length}]`;
    console.log(`${progress} Processing: ${file.name}...`);

    try {
      // Download
      const buffer = await downloadFile(file.fileId);

      // Parse .docx to text
      const rawText = await parseDocxToText(buffer);
      console.log(
        `${progress}   Extracted ${rawText.length.toLocaleString()} chars of text`
      );

      // Extract profile via Claude Opus + upsert to DB
      const result = await extractAndUpsertProfile(rawText, {
        sourceType: "drive_import",
        sourceReference: file.fileId,
      });

      const action = result.isNew ? "CREATED" : "UPDATED";
      console.log(
        `${progress}   ${action}: ${result.profile.name} (${result.profile.company})`
      );

      results.push({
        fileName: file.name,
        fileId: file.fileId,
        status: "success",
        name: result.profile.name,
        company: result.profile.company,
        isNew: result.isNew,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`${progress}   FAILED: ${message}`);
      results.push({
        fileName: file.name,
        fileId: file.fileId,
        status: "error",
        error: message,
      });
    }

    // Delay between files (skip after the last one)
    if (i < files.length - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  // 3. Summary
  const successes = results.filter((r) => r.status === "success");
  const failures = results.filter((r) => r.status === "error");
  const created = successes.filter((r) => r.isNew);
  const updated = successes.filter((r) => !r.isNew);

  console.log(`\n======================================`);
  console.log(`Import Complete`);
  console.log(
    `  Total files:   ${results.length}`
  );
  console.log(
    `  Successful:    ${successes.length} (${created.length} new, ${updated.length} updated)`
  );
  console.log(`  Failed:        ${failures.length}`);

  if (failures.length > 0) {
    console.log(`\nFailed files:`);
    for (const f of failures) {
      console.log(`  - ${f.fileName}: ${f.error}`);
    }
  }

  console.log();
}

main()
  .catch((e) => {
    console.error("Import failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
