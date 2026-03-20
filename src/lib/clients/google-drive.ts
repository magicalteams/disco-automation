import { google } from "googleapis";
import type { drive_v3 } from "googleapis";

let driveClient: drive_v3.Drive | null = null;

function getDriveClient(): drive_v3.Drive {
  if (driveClient) return driveClient;

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;

  if (!email) {
    throw new Error(
      "Missing GOOGLE_SERVICE_ACCOUNT_EMAIL environment variable"
    );
  }
  if (!key) {
    throw new Error("Missing GOOGLE_PRIVATE_KEY environment variable");
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      private_key: key.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });

  driveClient = google.drive({ version: "v3", auth });
  return driveClient;
}

const MIME_DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MIME_GOOGLE_DOC = "application/vnd.google-apps.document";

export interface DossierFileInfo {
  fileId: string;
  name: string;
  mimeType: string;
}

/**
 * List all .docx files and Google Docs in a Google Drive folder.
 * Handles pagination for folders with many files.
 * Returns files sorted by name for deterministic ordering.
 */
export async function listDossierFiles(
  folderId: string
): Promise<DossierFileInfo[]> {
  const drive = getDriveClient();
  const files: DossierFileInfo[] = [];
  let pageToken: string | undefined;

  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and (mimeType = '${MIME_DOCX}' or mimeType = '${MIME_GOOGLE_DOC}') and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType)",
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      ...(pageToken ? { pageToken } : {}),
    });

    const items = response.data.files;
    if (items) {
      for (const file of items) {
        if (file.id && file.name && file.mimeType) {
          files.push({ fileId: file.id, name: file.name, mimeType: file.mimeType });
        }
      }
    }

    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return files.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Download a file from Google Drive as a Buffer.
 * For native Google Docs, exports as .docx. For uploaded .docx files, downloads directly.
 */
export async function downloadFile(
  fileId: string,
  mimeType?: string
): Promise<Buffer> {
  const drive = getDriveClient();

  if (mimeType === MIME_GOOGLE_DOC) {
    const response = await drive.files.export(
      { fileId, mimeType: MIME_DOCX },
      { responseType: "arraybuffer" }
    );

    const data = response.data;
    if (!data) {
      throw new Error(`Empty response when exporting file ${fileId}`);
    }

    return Buffer.from(data as ArrayBuffer);
  }

  const response = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" }
  );

  const data = response.data;
  if (!data) {
    throw new Error(`Empty response when downloading file ${fileId}`);
  }

  return Buffer.from(data as ArrayBuffer);
}
