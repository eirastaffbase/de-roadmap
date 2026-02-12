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

## 6. Push New Feedback Form Submissions Into `Tasks`
Use an installable `On form submit` trigger in the **feedback responses spreadsheet** so only *new* submissions are sent.

1. Open the feedback spreadsheet:
   - `https://docs.google.com/spreadsheets/d/1uuCv5GQyY93nwVUKH6_C2TbJXkL_3pwTjqmt7s5HL3Q/edit?gid=2033660287#gid=2033660287`
2. `Extensions` -> `Apps Script`.
3. Add this script in that project (replace `ROADMAP_WEB_APP_URL`):

```javascript
const ROADMAP_WEB_APP_URL = "PASTE_YOUR_ROADMAP_WEBAPP_URL_HERE";

function onFeedbackSubmit(e) {
  const values = (e && e.namedValues) || {};
  const timestamp = first_(values["Timestamp"]);
  const version = findByPrefix_(values, "What version of Replify are you on?");
  const feedback = findByPrefix_(values, "What feedback/suggestions/bug reports do you have?");
  const email = findByPrefix_(values, "May we contact you for follow-up?");

  const idempotencyKey = [
    "feedback",
    timestamp || "",
    version || "",
    feedback || "",
    email || ""
  ].join("|");

  const payload = {
    action: "sync_feedback",
    timestamp: timestamp,
    version: version,
    feedback: feedback,
    email: email,
    idempotencyKey: idempotencyKey
  };

  const body = "payload=" + encodeURIComponent(JSON.stringify(payload));
  UrlFetchApp.fetch(ROADMAP_WEB_APP_URL, {
    method: "post",
    contentType: "application/x-www-form-urlencoded",
    payload: body,
    muteHttpExceptions: true
  });
}

function first_(arr) {
  return Array.isArray(arr) ? String(arr[0] || "").trim() : "";
}

function findByPrefix_(namedValues, prefix) {
  const key = Object.keys(namedValues).find((k) => String(k || "").indexOf(prefix) === 0);
  if (!key) return "";
  return first_(namedValues[key]);
}
```

4. In that feedback-script project, create trigger:
   - Function: `onFeedbackSubmit`
   - Event source: `From spreadsheet`
   - Event type: `On form submit`
5. Submit a test feedback entry and confirm a new `Tasks` row appears in roadmap with:
   - title: `Feedback Form Submission`
   - status: `submitted`
   - description: feedback + optional email
   - version: submitted version (or `2.4.0` fallback)

## Notes
- This implementation rewrites the full `Tasks` snapshot on each sync.
- `Tasks` now includes a `quarter` column (`Q1 2026` ... `Q4 2026`).
- `Releases` gets upserted when payload includes `release`.
- Feedback webhook mode uses `action=sync_feedback` (single-row append, no polling cursor).
- Demo frontend auth is client-only and not secure for production.
