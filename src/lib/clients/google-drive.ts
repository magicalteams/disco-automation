import { google } from "googleapis";
import type { drive_v3 } from "googleapis";

export interface DossierFileInfo {
  fileId: string;
  name: string;
}

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

/**
 * List all .docx files in a Google Drive folder.
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
      q: `'${folderId}' in parents and mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' and trashed = false`,
      fields: "nextPageToken, files(id, name)",
      pageSize: 100,
      ...(pageToken ? { pageToken } : {}),
    });

    const items = response.data.files;
    if (items) {
      for (const file of items) {
        if (file.id && file.name) {
          files.push({ fileId: file.id, name: file.name });
        }
      }
    }

    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return files.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Download a file from Google Drive as a Buffer.
 */
export async function downloadFile(fileId: string): Promise<Buffer> {
  const drive = getDriveClient();

  const response = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" }
  );

  const data = response.data;
  if (!data) {
    throw new Error(`Empty response when downloading file ${fileId}`);
  }

  return Buffer.from(data as ArrayBuffer);
}
