import { google } from "googleapis";
import type { sheets_v4 } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_OPPORTUNITIES_ID || "";
const TAB_NAME = "Opportunities";

let sheetsClient: sheets_v4.Sheets | null = null;

function getSheetsClient(): sheets_v4.Sheets {
  if (sheetsClient) return sheetsClient;

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
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  sheetsClient = google.sheets({ version: "v4", auth });
  return sheetsClient;
}

// ─── WRITE: Push opportunity rows to Sheet after extraction ───

interface OpportunityRow {
  id: string;
  weekIdentifier: string;
  title: string;
  category: string;
  dateDisplayText: string;
  status: string;
}

const HEADERS = ["ID", "Week", "Title", "Category", "Date Info", "Status", "Notes"];

/**
 * Push extracted opportunities to the Google Sheet.
 * Clears existing rows for the same week (idempotent), then writes fresh rows.
 */
export async function pushOpportunitiesToSheet(
  opportunities: OpportunityRow[]
): Promise<void> {
  if (!SHEET_ID) {
    console.log("GOOGLE_SHEET_OPPORTUNITIES_ID not set, skipping Sheet push");
    return;
  }

  const sheets = getSheetsClient();

  // Read existing data to find rows for this week (to clear them)
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${TAB_NAME}!A:B`,
  });

  const weekId = opportunities[0]?.weekIdentifier;
  if (!weekId) return;

  // Find row indices to clear (1-indexed, row 1 = header)
  const rows = existing.data.values || [];
  const rowsToClear: number[] = [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1] === weekId) {
      rowsToClear.push(i + 1); // Sheet rows are 1-indexed
    }
  }

  // Clear existing rows for this week (if any) by blanking them
  if (rowsToClear.length > 0) {
    const requests = rowsToClear.map((rowNum) => ({
      range: `${TAB_NAME}!A${rowNum}:G${rowNum}`,
      values: [["", "", "", "", "", "", ""]],
    }));
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        valueInputOption: "RAW",
        data: requests,
      },
    });
  }

  // Ensure headers exist
  if (rows.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${TAB_NAME}!A1:G1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [HEADERS],
      },
    });
  }

  // Append new rows
  const newRows = opportunities.map((opp) => [
    opp.id,
    opp.weekIdentifier,
    opp.title,
    opp.category,
    opp.dateDisplayText,
    opp.status,
    "", // Notes — human fills this
  ]);

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${TAB_NAME}!A:G`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: newRows,
    },
  });

  console.log(
    `Pushed ${newRows.length} opportunity rows to Sheet for ${weekId}`
  );
}

// ─── READ: Fetch status overrides from Sheet ───

export interface StatusOverride {
  opportunityId: string;
  status: string;
}

/**
 * Read the Sheet and return status values for a given week.
 * Returns all rows for the week (not just overrides), so the caller
 * can apply them to the DB.
 */
export async function fetchStatusOverrides(
  weekIdentifier: string
): Promise<StatusOverride[]> {
  if (!SHEET_ID) {
    console.log(
      "GOOGLE_SHEET_OPPORTUNITIES_ID not set, skipping Sheet read"
    );
    return [];
  }

  const sheets = getSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${TAB_NAME}!A:F`,
  });

  const rows = response.data.values || [];
  if (rows.length <= 1) return []; // Only header or empty

  const overrides: StatusOverride[] = [];
  for (let i = 1; i < rows.length; i++) {
    const [id, week, , , , status] = rows[i];
    if (week === weekIdentifier && id && status) {
      overrides.push({ opportunityId: id, status });
    }
  }

  return overrides;
}

/**
 * Get the count of opportunities for a given week in the Sheet.
 * Used by the reminder cron to report how many items need review.
 */
export async function getOpportunityCountForWeek(
  weekIdentifier: string
): Promise<number> {
  const overrides = await fetchStatusOverrides(weekIdentifier);
  return overrides.length;
}

/**
 * Get the URL for the Google Sheet (for Slack messages).
 */
export function getSheetUrl(): string {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}`;
}
