# Google Apps Script Setup

## 1. Create Sheets tabs
Create a spreadsheet with exactly these tab names:
- `Tasks`
- `Stories`
- `Releases`

You can paste the provided TSV files in `../sheets/` into each tab.

## 2. Add script
1. Open your Sheet.
2. `Extensions` -> `Apps Script`.
3. Replace `Code.gs` with `apps-script/Code.gs` content.
4. Save.

## 3. Deploy web app
1. `Deploy` -> `New deployment`.
2. Type: `Web app`.
3. Execute as: `Me`.
4. Who has access: `Anyone with the link` (or tighter if you prefer).
5. Deploy and copy the Web App URL.

## 4. Wire frontend
In `app.js`, set:
- `API_CONFIG.syncUrl = "<YOUR_WEB_APP_URL>"`

`Submit` will then POST payloads to `doPost`.

## 5. Test endpoints
- GET health:
  - `<WEB_APP_URL>?action=health`
- GET roadmap snapshot:
  - `<WEB_APP_URL>?action=roadmap`

## Notes
- This implementation rewrites the full `Tasks` snapshot on each sync.
- `Tasks` now includes a `quarter` column (`Q1 2026` ... `Q4 2026`).
- `Releases` gets upserted when payload includes `release`.
- Demo frontend auth is client-only and not secure for production.
