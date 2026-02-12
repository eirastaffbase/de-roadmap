const SHEET_NAMES = {
  TASKS: "Tasks",
  STORIES: "Stories",
  RELEASES: "Releases"
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
    "updated_by"
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

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || "roadmap";

    if (action === "health") {
      return jsonResponse_({ ok: true, service: "roadmap-backend" });
    }

    if (action !== "roadmap") {
      return jsonResponse_({ ok: false, error: "Unsupported action: " + action });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
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
      version: row.version,
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
  try {
    const payload = parsePayload_(e);
    const action = payload.action || "sync";

    if (action !== "sync") {
      return jsonResponse_({ ok: false, error: "Unsupported action: " + action });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureSheetWithHeaders_(ss, SHEET_NAMES.TASKS, HEADERS.Tasks);
    ensureSheetWithHeaders_(ss, SHEET_NAMES.STORIES, HEADERS.Stories);
    ensureSheetWithHeaders_(ss, SHEET_NAMES.RELEASES, HEADERS.Releases);

    const writtenTasks = writeTasksSnapshot_(ss, payload.tasks || []);

    if (payload.release && payload.release.version) {
      upsertRelease_(ss, payload.release);
    }

    return jsonResponse_({
      ok: true,
      message: "Sync complete",
      taskCount: writtenTasks,
      storiesChanged: (payload.storiesChanged || []).length,
      movedCards: (payload.movedCards || []).length,
      submittedAt: payload.submittedAt || new Date().toISOString()
    });
  } catch (error) {
    return jsonResponse_({ ok: false, error: String(error) });
  }
}

function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error("Missing JSON body.");
  }

  const body = JSON.parse(e.postData.contents);
  if (!body || typeof body !== "object") {
    throw new Error("Invalid JSON payload.");
  }
  return body;
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
    task.version || "",
    task.order_index === undefined || task.order_index === null ? "" : Number(task.order_index),
    task.updated_at || "",
    task.updated_by || ""
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

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
