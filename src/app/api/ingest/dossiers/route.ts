import { NextRequest, NextResponse } from "next/server";
import { extractAndUpsertProfile } from "@/lib/ingest/extract-and-upsert";
import { downloadFile } from "@/lib/clients/google-drive";
import { parseDocxToText } from "@/lib/utils/docx-parser";
import { z } from "zod";

const PasteRequestSchema = z.object({
  mode: z.literal("paste"),
  rawText: z.string().min(100, "Dossier text must be at least 100 characters"),
  name: z.string().min(1, "Name is required"),
  company: z.string().min(1, "Company is required"),
});

const DriveRequestSchema = z.object({
  mode: z.literal("drive"),
  fileId: z.string().min(1, "Drive file ID is required"),
});

const IngestRequestSchema = z.discriminatedUnion("mode", [
  PasteRequestSchema,
  DriveRequestSchema,
]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Backward compatibility: default to paste mode if mode is absent
    if (!body.mode && body.rawText) {
      body.mode = "paste";
    }

    const input = IngestRequestSchema.parse(body);

    if (input.mode === "paste") {
      const result = await extractAndUpsertProfile(input.rawText, {
        sourceType: "manual_paste",
        sourceReference: `pasted_${new Date().toISOString().split("T")[0]}`,
      });

      return NextResponse.json({
        message: `Profile extracted for ${result.profile.name} (${result.profile.company})`,
        profile: result.profile,
        isNew: result.isNew,
      });
    }

    // mode === "drive"
    const buffer = await downloadFile(input.fileId);
    const rawText = await parseDocxToText(buffer);

    const result = await extractAndUpsertProfile(rawText, {
      sourceType: "drive_import",
      sourceReference: input.fileId,
    });

    return NextResponse.json({
      message: `Profile extracted for ${result.profile.name} (${result.profile.company})`,
      profile: result.profile,
      isNew: result.isNew,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Dossier extraction failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Extraction failed" },
      { status: 500 }
    );
  }
}
