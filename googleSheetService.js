const { google } = require('googleapis');

const credentials = process.env.GOOGLE_SERVICE_CREDENTIALS
  ? JSON.parse(process.env.GOOGLE_SERVICE_CREDENTIALS)
  : require('./credentials/google-service-account.json');

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

async function appendRowToSheet(values) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SHEET_ID,
    range: 'Gastos!A1',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [values],
    },
  });
}

module.exports = { appendRowToSheet };
