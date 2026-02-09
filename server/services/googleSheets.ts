/**
 * Google Sheets Integration Service
 *
 * Logs chatbot activity to a Google Sheet named "Lourdes Prayer Chatbot":
 * - "all leads" tab: every user who finalizes a prayer (before payment)
 * - "lourdes grotto" tab: every user who completes initial prayer purchase,
 *   with Candle column updated when they buy the $19 candle upsell
 */

import { google, type sheets_v4 } from "googleapis";
import path from "path";

// ============================================================================
// CONFIGURATION
// ============================================================================

function getSpreadsheetId(): string | undefined {
  return process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
}

function getCredentialsPath(): string | undefined {
  return process.env.GOOGLE_SHEETS_CREDENTIALS_PATH;
}

function getCredentialsJson(): string | undefined {
  return process.env.GOOGLE_SHEETS_CREDENTIALS_JSON;
}

export function isGoogleSheetsEnabled(): boolean {
  return !!getSpreadsheetId() && !!(getCredentialsPath() || getCredentialsJson());
}

// Lazy-initialized Google Sheets API client
let sheetsClient: sheets_v4.Sheets | null = null;

async function getSheetsClient(): Promise<sheets_v4.Sheets> {
  if (sheetsClient) {
    return sheetsClient;
  }

  const credentialsJson = getCredentialsJson();
  const credentialsPath = getCredentialsPath();

  let auth: InstanceType<typeof google.auth.GoogleAuth>;

  if (credentialsJson) {
    // Railway / cloud: credentials passed as JSON string in env var
    const credentials = JSON.parse(credentialsJson);
    auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
  } else if (credentialsPath) {
    // Local dev: credentials file on disk
    const absolutePath = path.isAbsolute(credentialsPath)
      ? credentialsPath
      : path.resolve(process.cwd(), credentialsPath);
    auth = new google.auth.GoogleAuth({
      keyFile: absolutePath,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
  } else {
    throw new Error("Google Sheets credentials not configured");
  }

  sheetsClient = google.sheets({ version: "v4", auth });
  return sheetsClient;
}

// ============================================================================
// ALL LEADS
// ============================================================================

/**
 * Append a row to the "all leads" tab.
 * Columns: Date, Name, Email, Prayer
 */
export async function appendToAllLeads(data: {
  name: string;
  email: string;
  prayer: string;
}): Promise<void> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "all leads!A:D",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[new Date().toISOString(), data.name, data.email, data.prayer]],
    },
  });

  console.log(`Google Sheets: appended to "all leads" for ${data.email}`);
}

// ============================================================================
// LOURDES GROTTO
// ============================================================================

/**
 * Append a row to the "lourdes grotto" tab.
 * Columns: Date, Order Id, Full Name, Email, Prayer, Main Product, Candle
 */
export async function appendToLourdesGrotto(data: {
  orderId: string;
  name: string;
  email: string;
  prayer: string;
}): Promise<void> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "lourdes grotto!A:G",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          new Date().toISOString(),
          data.orderId,
          data.name,
          data.email,
          data.prayer,
          "Prayer petition to the Lourdes Grotto",
          "No",
        ],
      ],
    },
  });

  console.log(`Google Sheets: appended to "lourdes grotto" for ${data.email}`);
}

// ============================================================================
// CANDLE STATUS UPDATE
// ============================================================================

/**
 * Find a row by email in "lourdes grotto" and set the Candle column to "Yes".
 * Searches column D (Email) for a match, updates column G (Candle).
 */
export async function updateCandleStatus(email: string): Promise<void> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  // Read all emails from column D
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "lourdes grotto!D:D",
  });

  const rows = result.data.values;
  if (!rows) {
    console.log(`Google Sheets: no data in "lourdes grotto" to search for ${email}`);
    return;
  }

  // Find the row index (1-based in Sheets) where email matches
  let rowIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] && rows[i][0].toLowerCase() === email.toLowerCase()) {
      rowIndex = i + 1; // Sheets is 1-based
    }
  }

  if (rowIndex === -1) {
    console.log(`Google Sheets: email ${email} not found in "lourdes grotto"`);
    return;
  }

  // Update column G (Candle) for the matched row
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `lourdes grotto!G${rowIndex}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [["Yes"]],
    },
  });

  console.log(`Google Sheets: updated candle status to "Yes" for ${email} (row ${rowIndex})`);
}
