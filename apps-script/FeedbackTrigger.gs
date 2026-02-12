const ROADMAP_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbwS3hZEYoo34kBz7F-E_vcVRfBWZS4tkqsjO2-rI-LzWVaRm1-X6CVOok7gurdPB6eq/exec";

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
