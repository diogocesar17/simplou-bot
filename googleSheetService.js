const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_CREDENTIALS),
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
