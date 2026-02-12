const SHEET_NAMES = {
  TASKS: "Tasks",
  STORIES: "Stories",
  RELEASES: "Releases"
};
const DEFAULT_VERSION = "2.4.0";
const IDEMPOTENCY_TTL_SECONDS = 600;
const ROADMAP_SPREADSHEET_ID = "1SuKtz34cMQLCUIJtDyQs6ivkvsfpbYkrGeqq8poEsp8";
const FEEDBACK_SOURCE = {
  SPREADSHEET_ID: "1uuCv5GQyY93nwVUKH6_C2TbJXkL_3pwTjqmt7s5HL3Q",
  SHEET_ID: 2033660287,
  HEADER_ROW: 1,
  FIRST_DATA_ROW: 2,
  TIMESTAMP_COL: 1,
  VERSION_COL: 2,
  FEEDBACK_COL: 3,
  EMAIL_COL: 4
};
const SCRIPT_PROPERTIES = {
  LAST_FEEDBACK_ROW: "feedback_last_imported_row"
};

const HEADERS = {
  Tasks: [
    "task_id",
    "title",
    "description",
    "status",
    "story_id",
    "story_exempt",
    "story_points",
    "priority_label",
    "version",
    "order_index",
    "updated_at",
    "updated_by",
    "quarter"
  ],
  Stories: [
    "story_id",
    "story_title",
    "category",
    "owner",
    "active",
    "created_at",
    "updated_at"
  ],
  Releases: [
    "version",
    "release_date",
    "is_active",
    "is_upcoming",
    "notes",
    "release_notes_url"
  ]
};

function getRoadmapSpreadsheet_() {
  return ROADMAP_SPREADSHEET_ID
    ? SpreadsheetApp.openById(ROADMAP_SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || "roadmap";

    if (action === "health") {
      return jsonResponse_({ ok: true, service: "roadmap-backend" });
    }

    if (action !== "roadmap") {
      return jsonResponse_({ ok: false, error: "Unsupported action: " + action });
    }

    const ss = getRoadmapSpreadsheet_();
    const taskRecords = readRecords_(ss, SHEET_NAMES.TASKS, HEADERS.Tasks);
    const storyRecords = readRecords_(ss, SHEET_NAMES.STORIES, HEADERS.Stories);
    const releaseRecords = readRecords_(ss, SHEET_NAMES.RELEASES, HEADERS.Releases);

    const tasks = taskRecords.map((row) => ({
      id: row.task_id,
      title: row.title,
      description: row.description,
      status: row.status,
      storyId: row.story_id || null,
      storyExempt: toBool_(row.story_exempt),
      storyPoints: row.story_points === "" ? null : Number(row.story_points),
      priorityLabel: row.priority_label,
      version: normalizeVersion_(row.version),
      quarter: row.quarter || "Q1 2026",
      order: row.order_index === "" ? 0 : Number(row.order_index),
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    }));

    const stories = storyRecords.map((row) => ({
      storyId: row.story_id,
      title: row.story_title,
      category: row.category,
      owner: row.owner,
      active: toBool_(row.active),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    const releases = releaseRecords.map((row) => ({
      version: row.version,
      releaseDate: row.release_date,
      isActive: toBool_(row.is_active),
      isUpcoming: toBool_(row.is_upcoming),
      notes: row.notes,
      releaseNotesUrl: row.release_notes_url
    }));

    const release = releases.find((item) => item.isUpcoming) || releases[0] || null;

    return jsonResponse_({
      ok: true,
      release: release,
      releases: releases,
      stories: stories,
      tasks: tasks
    });
  } catch (error) {
    return jsonResponse_({ ok: false, error: String(error) });
  }
}

function doPost(e) {
  let lock = null;
  try {
    const payload = parsePayload_(e);
    const action = payload.action || "sync";

    if (action === "sync_feedback") {
      const feedbackResult = syncFeedbackSubmissions_();
      return jsonResponse_({
        ok: true,
        message: "Feedback sync complete",
        imported: feedbackResult.imported,
        scannedRows: feedbackResult.scannedRows,
        lastImportedRow: feedbackResult.lastImportedRow
      });
    }

    if (action !== "sync") {
      return jsonResponse_({ ok: false, error: "Unsupported action: " + action });
    }

    const idempotencyKey = String(payload.idempotencyKey || "").trim();
    const cache = idempotencyKey ? CacheService.getScriptCache() : null;
    const cacheKey = cache ? getIdempotencyCacheKey_(idempotencyKey) : "";
    if (cache && cacheKey) {
      const cached = cache.get(cacheKey);
      if (cached) {
        return jsonResponse_(JSON.parse(cached));
      }
    }

    lock = LockService.getScriptLock();
    lock.waitLock(10000);
    if (cache && cacheKey) {
      const cachedWithLock = cache.get(cacheKey);
      if (cachedWithLock) {
        return jsonResponse_(JSON.parse(cachedWithLock));
      }
    }

    const ss = getRoadmapSpreadsheet_();
    ensureSheetWithHeaders_(ss, SHEET_NAMES.TASKS, HEADERS.Tasks);
    ensureSheetWithHeaders_(ss, SHEET_NAMES.STORIES, HEADERS.Stories);
    ensureSheetWithHeaders_(ss, SHEET_NAMES.RELEASES, HEADERS.Releases);

    const writtenTasks = writeTasksSnapshot_(ss, payload.tasks || []);

    if (payload.release && payload.release.version) {
      upsertRelease_(ss, payload.release);
    }

    const responseBody = {
      ok: true,
      message: "Sync complete",
      taskCount: writtenTasks,
      storiesChanged: (payload.storiesChanged || []).length,
      movedCards: (payload.movedCards || []).length,
      submittedAt: payload.submittedAt || new Date().toISOString(),
      idempotencyKey: idempotencyKey || null
    };
    if (cache && cacheKey) {
      cache.put(cacheKey, JSON.stringify(responseBody), IDEMPOTENCY_TTL_SECONDS);
    }
    return jsonResponse_(responseBody);
  } catch (error) {
    return jsonResponse_({ ok: false, error: String(error) });
  } finally {
    if (lock) {
      try {
        lock.releaseLock();
      } catch (releaseError) {
        // no-op
      }
    }
  }
}

function parsePayload_(e) {
  if (!e) {
    throw new Error("Missing request event.");
  }

  // Preferred path for form-encoded requests: payload=<json>
  if (e.parameter && e.parameter.payload) {
    const parsed = JSON.parse(e.parameter.payload);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid payload field.");
    }
    return parsed;
  }

  if (!e.postData || !e.postData.contents) {
    throw new Error("Missing request body.");
  }

  const raw = String(e.postData.contents || "");

  // Backward compatibility: accept direct JSON body
  try {
    const parsedJson = JSON.parse(raw);
    if (parsedJson && typeof parsedJson === "object") {
      return parsedJson;
    }
  } catch (jsonError) {
    // Continue to form parsing fallback below.
  }

  // Fallback: parse application/x-www-form-urlencoded manually
  const form = parseFormEncoded_(raw);
  if (form.payload) {
    const parsedPayload = JSON.parse(form.payload);
    if (parsedPayload && typeof parsedPayload === "object") {
      return parsedPayload;
    }
  }

  throw new Error("Invalid payload. Expected JSON body or form payload field.");
}

function parseFormEncoded_(raw) {
  const result = {};
  raw.split("&").forEach((pair) => {
    if (!pair) return;
    const parts = pair.split("=");
    const key = decodeURIComponent(String(parts[0] || "").replace(/\+/g, " "));
    const value = decodeURIComponent(String(parts.slice(1).join("=") || "").replace(/\+/g, " "));
    result[key] = value;
  });
  return result;
}

function syncFeedbackToRoadmap() {
  const result = syncFeedbackSubmissions_();
  Logger.log(JSON.stringify(result));
  return result;
}

function resetFeedbackSyncCursor() {
  PropertiesService.getScriptProperties().deleteProperty(SCRIPT_PROPERTIES.LAST_FEEDBACK_ROW);
  return { ok: true, message: "Feedback sync cursor reset." };
}

function syncFeedbackSubmissions_() {
  const roadmapSs = getRoadmapSpreadsheet_();
  const feedbackSheet = getFeedbackSheet_();
  const props = PropertiesService.getScriptProperties();
  const lastImportedRow = Number(
    props.getProperty(SCRIPT_PROPERTIES.LAST_FEEDBACK_ROW) || String(FEEDBACK_SOURCE.HEADER_ROW)
  );
  const firstDataRow = FEEDBACK_SOURCE.FIRST_DATA_ROW;
  const sourceLastRow = feedbackSheet.getLastRow();
  const startRow = Math.max(firstDataRow, lastImportedRow + 1);

  if (sourceLastRow < startRow) {
    return {
      imported: 0,
      scannedRows: 0,
      lastImportedRow: lastImportedRow
    };
  }

  const maxCol = Math.max(
    FEEDBACK_SOURCE.TIMESTAMP_COL,
    FEEDBACK_SOURCE.VERSION_COL,
    FEEDBACK_SOURCE.FEEDBACK_COL,
    FEEDBACK_SOURCE.EMAIL_COL
  );
  const rowCount = sourceLastRow - startRow + 1;
  const rows = feedbackSheet.getRange(startRow, 1, rowCount, maxCol).getValues();

  const existingTasks = readRecords_(roadmapSs, SHEET_NAMES.TASKS, HEADERS.Tasks);
  let nextSubmittedOrder = existingTasks.reduce((maxValue, task) => {
    if (String(task.status) !== "submitted") return maxValue;
    return Math.max(maxValue, Number(task.order_index) || 0);
  }, 0);

  const taskRows = [];
  rows.forEach((row, index) => {
    const rowNumber = startRow + index;
    const timestampRaw = row[FEEDBACK_SOURCE.TIMESTAMP_COL - 1];
    const versionRaw = row[FEEDBACK_SOURCE.VERSION_COL - 1];
    const feedbackRaw = row[FEEDBACK_SOURCE.FEEDBACK_COL - 1];
    const emailRaw = row[FEEDBACK_SOURCE.EMAIL_COL - 1];

    const feedbackText = cleanCell_(feedbackRaw);
    const submitterEmail = cleanCell_(emailRaw);
    if (!feedbackText && !submitterEmail) {
      return;
    }

    nextSubmittedOrder += 1;
    taskRows.push([
      createFeedbackTaskId_(rowNumber),
      "Feedback Form Submission",
      buildFeedbackDescription_(feedbackText, submitterEmail),
      "submitted",
      "",
      "",
      "",
      "",
      normalizeVersion_(versionRaw),
      nextSubmittedOrder,
      normalizeIsoDate_(timestampRaw),
      "feedback-form",
      ""
    ]);
  });

  appendTaskRows_(roadmapSs, taskRows);
  props.setProperty(SCRIPT_PROPERTIES.LAST_FEEDBACK_ROW, String(sourceLastRow));

  return {
    imported: taskRows.length,
    scannedRows: rowCount,
    lastImportedRow: sourceLastRow
  };
}

function getFeedbackSheet_() {
  const feedbackSs = SpreadsheetApp.openById(FEEDBACK_SOURCE.SPREADSHEET_ID);
  const byId = feedbackSs
    .getSheets()
    .find((sheet) => sheet.getSheetId() === FEEDBACK_SOURCE.SHEET_ID);
  if (byId) return byId;
  return feedbackSs.getSheets()[0];
}

function appendTaskRows_(ss, taskRows) {
  if (!taskRows.length) return;
  ensureSheetWithHeaders_(ss, SHEET_NAMES.TASKS, HEADERS.Tasks);
  const sheet = ss.getSheetByName(SHEET_NAMES.TASKS);
  const startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, taskRows.length, HEADERS.Tasks.length).setValues(taskRows);
}

function createFeedbackTaskId_(rowNumber) {
  return "FB-" + String(rowNumber) + "-" + Utilities.getUuid().slice(0, 8);
}

function buildFeedbackDescription_(feedbackText, submitterEmail) {
  const sections = [];
  if (feedbackText) sections.push(feedbackText);
  if (submitterEmail) sections.push("Submitter email: " + submitterEmail);
  return sections.join("\n\n");
}

function normalizeIsoDate_(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.valueOf())) return new Date().toISOString();
  return date.toISOString();
}

function cleanCell_(value) {
  return String(value || "").trim();
}

function ensureSheetWithHeaders_(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  const existingHeaders = sheet
    .getRange(1, 1, 1, headers.length)
    .getValues()[0]
    .map((value) => String(value || ""));

  const mismatch = headers.some((header, index) => existingHeaders[index] !== header);
  if (mismatch) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}

function readRecords_(ss, sheetName, headers) {
  ensureSheetWithHeaders_(ss, sheetName, headers);
  const sheet = ss.getSheetByName(sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const rows = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return rows.map((row) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = row[index];
    });
    return record;
  });
}

function writeTasksSnapshot_(ss, tasks) {
  const sheet = ss.getSheetByName(SHEET_NAMES.TASKS);
  const headers = HEADERS.Tasks;

  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  if (!tasks.length) {
    return 0;
  }

  const rows = tasks.map((task) => [
    task.task_id || "",
    task.title || "",
    task.description || "",
    task.status || "submitted",
    task.story_id || "",
    normalizeBool_(task.story_exempt),
    task.story_points === null || task.story_points === undefined ? "" : Number(task.story_points),
    task.priority_label || "P2",
    normalizeVersion_(task.version),
    task.order_index === undefined || task.order_index === null ? "" : Number(task.order_index),
    task.updated_at || "",
    task.updated_by || "",
    task.quarter || "Q1 2026"
  ]);

  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  return rows.length;
}

function upsertRelease_(ss, release) {
  const headers = HEADERS.Releases;
  const sheet = ss.getSheetByName(SHEET_NAMES.RELEASES);

  const records = readRecords_(ss, SHEET_NAMES.RELEASES, headers);
  const next = {
    version: String(release.version || ""),
    release_date: release.releaseDate || "",
    is_active: normalizeBool_(release.isActive),
    is_upcoming: normalizeBool_(release.isUpcoming),
    notes: release.notes || "",
    release_notes_url: release.releaseNotesUrl || ""
  };

  let found = false;
  const updatedRows = records.map((row) => {
    if (String(row.version) === next.version) {
      found = true;
      return next;
    }
    return row;
  });

  if (!found) {
    updatedRows.push(next);
  }

  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  if (updatedRows.length) {
    const rows = updatedRows.map((row) => [
      row.version,
      row.release_date,
      normalizeBool_(row.is_active),
      normalizeBool_(row.is_upcoming),
      row.notes,
      row.release_notes_url
    ]);
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

function toBool_(value) {
  if (typeof value === "boolean") return value;
  const text = String(value || "").toLowerCase();
  return text === "true" || text === "1" || text === "yes";
}

function normalizeBool_(value) {
  return toBool_(value) ? "TRUE" : "FALSE";
}

function normalizeVersion_(value) {
  const text = String(value || "").trim();
  return text || DEFAULT_VERSION;
}

function getIdempotencyCacheKey_(idempotencyKey) {
  return "roadmap_sync_" + sha256Hex_(idempotencyKey);
}

function sha256Hex_(input) {
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(input || ""));
  return raw
    .map((byte) => {
      const normalized = byte < 0 ? byte + 256 : byte;
      return ("0" + normalized.toString(16)).slice(-2);
    })
    .join("");
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
