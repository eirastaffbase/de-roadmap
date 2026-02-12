const SHEET_NAMES = {
  TASKS: "Tasks",
  STORIES: "Stories",
  RELEASES: "Releases"
};
const DEFAULT_VERSION = "2.4.0";
const IDEMPOTENCY_TTL_SECONDS = 600;
const ROADMAP_SPREADSHEET_ID = "1SuKtz34cMQLCUIJtDyQs6ivkvsfpbYkrGeqq8poEsp8";

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

    if (action !== "sync" && action !== "sync_feedback") {
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

    let responseBody;
    if (action === "sync_feedback") {
      const feedbackResult = appendFeedbackTaskFromPayload_(ss, payload);
      responseBody = {
        ok: true,
        message: "Feedback sync complete",
        imported: feedbackResult.imported,
        taskId: feedbackResult.taskId,
        submittedAt: new Date().toISOString(),
        idempotencyKey: idempotencyKey || null
      };
    } else {
      ensureSheetWithHeaders_(ss, SHEET_NAMES.TASKS, HEADERS.Tasks);
      ensureSheetWithHeaders_(ss, SHEET_NAMES.STORIES, HEADERS.Stories);
      ensureSheetWithHeaders_(ss, SHEET_NAMES.RELEASES, HEADERS.Releases);

      const writtenTasks = upsertTasks_(ss, payload.tasks || []);
      const writtenStories = upsertStories_(ss, payload.stories || []);

      if (payload.release && payload.release.version) {
        upsertRelease_(ss, payload.release);
      }

      responseBody = {
        ok: true,
        message: "Sync complete",
        taskCount: writtenTasks,
        storyCount: writtenStories,
        storiesChanged: (payload.storiesChanged || []).length,
        movedCards: (payload.movedCards || []).length,
        submittedAt: payload.submittedAt || new Date().toISOString(),
        idempotencyKey: idempotencyKey || null
      };
    }

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

function appendFeedbackTaskFromPayload_(ss, payload) {
  ensureSheetWithHeaders_(ss, SHEET_NAMES.TASKS, HEADERS.Tasks);

  const feedbackText = cleanCell_(payload.feedback || payload.feedbackText);
  const submitterEmail = cleanCell_(payload.email || payload.submitterEmail);
  if (!feedbackText && !submitterEmail) {
    throw new Error("Feedback payload must include feedback text or submitter email.");
  }

  const version = normalizeVersion_(payload.version || payload.replifyVersion);
  const timestamp = normalizeIsoDate_(payload.timestamp || payload.submittedAt);
  const taskId = createFeedbackTaskId_(payload.feedbackId || payload.submissionId);
  const nextSubmittedOrder = getNextSubmittedOrder_(ss) + 1;

  const row = [[
    taskId,
    "Feedback Form Submission",
    buildFeedbackDescription_(feedbackText, submitterEmail),
    "submitted",
    "",
    "",
    "",
    "",
    version,
    nextSubmittedOrder,
    timestamp,
    "feedback-form",
    ""
  ]];

  appendTaskRows_(ss, row);
  return { imported: 1, taskId: taskId };
}

function getNextSubmittedOrder_(ss) {
  const existingTasks = readRecords_(ss, SHEET_NAMES.TASKS, HEADERS.Tasks);
  return existingTasks.reduce((maxValue, task) => {
    if (String(task.status) !== "submitted") return maxValue;
    return Math.max(maxValue, Number(task.order_index) || 0);
  }, 0);
}

function appendTaskRows_(ss, taskRows) {
  if (!taskRows.length) return;
  ensureSheetWithHeaders_(ss, SHEET_NAMES.TASKS, HEADERS.Tasks);
  const sheet = ss.getSheetByName(SHEET_NAMES.TASKS);
  const startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, taskRows.length, HEADERS.Tasks.length).setValues(taskRows);
}

function createFeedbackTaskId_(sourceId) {
  const prefix = "FB";
  const sanitized = String(sourceId || "")
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  if (sanitized) {
    return prefix + "-" + sanitized + "-" + Utilities.getUuid().slice(0, 6);
  }
  return prefix + "-" + Utilities.getUuid().slice(0, 12);
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

function upsertTasks_(ss, tasks) {
  const sheet = ss.getSheetByName(SHEET_NAMES.TASKS);
  const headers = HEADERS.Tasks;

  if (!tasks.length) {
    return 0;
  }

  const existingRecords = readRecords_(ss, SHEET_NAMES.TASKS, headers);
  const rowIndexById = {};
  existingRecords.forEach((row, index) => {
    const id = String(row.task_id || "").trim();
    if (!id) return;
    rowIndexById[id] = index + 2;
  });

  let updated = 0;
  const toAppend = [];

  tasks.forEach((task) => {
    const taskId = String(task.task_id || "").trim();
    if (!taskId) return;
    const rowValues = [
      taskId,
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
    ];

    const existingRowIndex = rowIndexById[taskId];
    if (existingRowIndex) {
      sheet.getRange(existingRowIndex, 1, 1, headers.length).setValues([rowValues]);
      updated += 1;
    } else {
      toAppend.push(rowValues);
    }
  });

  if (toAppend.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, toAppend.length, headers.length).setValues(toAppend);
  }

  return updated + toAppend.length;
}

function upsertStories_(ss, stories) {
  const sheet = ss.getSheetByName(SHEET_NAMES.STORIES);
  const headers = HEADERS.Stories;
  if (!stories.length) return 0;

  const existingRecords = readRecords_(ss, SHEET_NAMES.STORIES, headers);
  const rowIndexById = {};
  const existingById = {};
  existingRecords.forEach((row, index) => {
    const storyId = String(row.story_id || "").trim();
    if (!storyId) return;
    rowIndexById[storyId] = index + 2;
    existingById[storyId] = row;
  });

  let updated = 0;
  const toAppend = [];
  const now = new Date().toISOString();

  stories.forEach((story) => {
    const storyId = String(story.story_id || story.storyId || "").trim();
    if (!storyId) return;

    const existing = existingById[storyId] || {};
    const rowValues = [
      storyId,
      story.story_title || story.title || existing.story_title || "",
      story.category || existing.category || "",
      story.owner || existing.owner || "",
      normalizeBool_(story.active !== undefined ? story.active : existing.active),
      story.created_at || story.createdAt || existing.created_at || now,
      story.updated_at || story.updatedAt || now
    ];

    const existingRowIndex = rowIndexById[storyId];
    if (existingRowIndex) {
      sheet.getRange(existingRowIndex, 1, 1, headers.length).setValues([rowValues]);
      updated += 1;
    } else {
      toAppend.push(rowValues);
    }
  });

  if (toAppend.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, toAppend.length, headers.length).setValues(toAppend);
  }

  return updated + toAppend.length;
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
