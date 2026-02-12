const STATUS_COLUMNS = [
  { id: "submitted", label: "Submitted" },
  { id: "backlog", label: "Backlog" },
  { id: "in_progress", label: "In Progress" },
  { id: "waiting_review", label: "Waiting for Review" },
  { id: "completed", label: "Completed" }
];

const PRIORITY_LABELS = ["P0", "P1", "P2", "P3"];
const STORY_POINT_VALUES = [1, 2, 3, 5, 8, 13];

const RELEASE_NOTES_URL =
  "https://docs.google.com/document/d/14iV4lUkYHuHv5VY3MPiIXDdRx_8SOY5Ml1M-gSPqvRY/edit?usp=sharing";

const API_CONFIG = {
  syncUrl: "",
  getUrl: ""
};

const DEMO_USERS = {
  eira: {
    password: "demoengineer",
    role: "editor"
  },
  seteam: {
    password: "gosolutions",
    role: "submitter"
  }
};

const ROLE_PERMISSIONS = {
  guest: {
    label: "Viewer",
    canAddTask: false,
    addTaskSubmittedOnly: false,
    canAddStory: false,
    canEditTask: false,
    canMoveTask: false,
    canSubmit: false
  },
  submitter: {
    label: "SE Team",
    canAddTask: true,
    addTaskSubmittedOnly: true,
    canAddStory: false,
    canEditTask: false,
    canMoveTask: false,
    canSubmit: false
  },
  editor: {
    label: "Editor",
    canAddTask: true,
    addTaskSubmittedOnly: false,
    canAddStory: true,
    canEditTask: true,
    canMoveTask: true,
    canSubmit: true
  }
};

const appState = {
  tasks: [],
  stories: [],
  releases: [],
  filters: {
    search: "",
    status: "all",
    story: "all"
  },
  auth: {
    username: null,
    role: "guest"
  },
  unsavedChanges: false,
  changedTaskIds: new Set(),
  movedTaskIds: new Set(),
  editedTaskIds: new Set(),
  storiesChanged: new Set(),
  collapsedGroups: {},
  taskModalMode: "create",
  pendingMove: null
};

const dom = {};

function cacheDom() {
  dom.searchInput = document.getElementById("searchInput");
  dom.statusFilter = document.getElementById("statusFilter");
  dom.storyFilter = document.getElementById("storyFilter");
  dom.board = document.getElementById("board");
  dom.dirtyIndicator = document.getElementById("dirtyIndicator");
  dom.submitBtn = document.getElementById("submitBtn");
  dom.addTaskBtn = document.getElementById("addTaskBtn");
  dom.addStoryBtn = document.getElementById("addStoryBtn");

  dom.nextVersion = document.getElementById("nextVersion");
  dom.nextVersionDate = document.getElementById("nextVersionDate");
  dom.previousReleaseList = document.getElementById("previousReleaseList");

  dom.loginIconBtn = document.getElementById("loginIconBtn");
  dom.loginIconText = document.getElementById("loginIconText");
  dom.authStatus = document.getElementById("authStatus");

  dom.taskModalBackdrop = document.getElementById("taskModalBackdrop");
  dom.taskModalTitle = document.getElementById("taskModalTitle");
  dom.taskForm = document.getElementById("taskForm");
  dom.taskIdInput = document.getElementById("taskIdInput");
  dom.taskTitleInput = document.getElementById("taskTitleInput");
  dom.taskDescriptionInput = document.getElementById("taskDescriptionInput");
  dom.taskStatusInput = document.getElementById("taskStatusInput");
  dom.taskStoryInput = document.getElementById("taskStoryInput");
  dom.taskPointsInput = document.getElementById("taskPointsInput");
  dom.taskPriorityLabelInput = document.getElementById("taskPriorityLabelInput");
  dom.taskVersionInput = document.getElementById("taskVersionInput");
  dom.taskExemptInput = document.getElementById("taskExemptInput");
  dom.taskFormError = document.getElementById("taskFormError");
  dom.cancelTaskBtn = document.getElementById("cancelTaskBtn");

  dom.storyModalBackdrop = document.getElementById("storyModalBackdrop");
  dom.storyForm = document.getElementById("storyForm");
  dom.storyTitleInput = document.getElementById("storyTitleInput");
  dom.storyCategoryInput = document.getElementById("storyCategoryInput");
  dom.storyOwnerInput = document.getElementById("storyOwnerInput");
  dom.storyFormError = document.getElementById("storyFormError");
  dom.cancelStoryBtn = document.getElementById("cancelStoryBtn");

  dom.moveGuardModalBackdrop = document.getElementById("moveGuardModalBackdrop");
  dom.moveGuardText = document.getElementById("moveGuardText");
  dom.moveGuardStorySelect = document.getElementById("moveGuardStorySelect");
  dom.moveGuardSkipCheckbox = document.getElementById("moveGuardSkipCheckbox");
  dom.moveGuardError = document.getElementById("moveGuardError");
  dom.cancelMoveGuardBtn = document.getElementById("cancelMoveGuardBtn");
  dom.confirmMoveGuardBtn = document.getElementById("confirmMoveGuardBtn");

  dom.payloadModalBackdrop = document.getElementById("payloadModalBackdrop");
  dom.payloadPreview = document.getElementById("payloadPreview");
  dom.closePayloadBtn = document.getElementById("closePayloadBtn");

  dom.loginModalBackdrop = document.getElementById("loginModalBackdrop");
  dom.loginForm = document.getElementById("loginForm");
  dom.loginUsernameInput = document.getElementById("loginUsernameInput");
  dom.loginPasswordInput = document.getElementById("loginPasswordInput");
  dom.loginError = document.getElementById("loginError");
  dom.logoutBtn = document.getElementById("logoutBtn");
  dom.cancelLoginBtn = document.getElementById("cancelLoginBtn");

  dom.toast = document.getElementById("toast");
}

function nowIso() {
  return new Date().toISOString();
}

function getPermissions() {
  return ROLE_PERMISSIONS[appState.auth.role] || ROLE_PERMISSIONS.guest;
}

function loadSeedData() {
  const seedTime = "2026-02-12T09:00:00.000Z";
  appState.stories = [
    {
      storyId: "STR-MOBILE-DEMO",
      title: "Demoing mobile needs to be easier",
      category: "Demo Experience",
      owner: "Product",
      active: true,
      createdAt: seedTime,
      updatedAt: seedTime
    },
    {
      storyId: "STR-EMAIL-DEMOS",
      title: "We need to automate our email demos",
      category: "Automation",
      owner: "Solutions",
      active: true,
      createdAt: seedTime,
      updatedAt: seedTime
    },
    {
      storyId: "STR-PROMPT-AUTO",
      title: "We need prompt-based automation for easier setup",
      category: "AI Workflow",
      owner: "Engineering",
      active: true,
      createdAt: seedTime,
      updatedAt: seedTime
    },
    {
      storyId: "STR-METRICS",
      title: "We need more usage info to focus and evangelize",
      category: "Analytics",
      owner: "Product",
      active: true,
      createdAt: seedTime,
      updatedAt: seedTime
    },
    {
      storyId: "STR-OAUTH-LOGIN",
      title: "We need stronger security and safety for extension usage",
      category: "Security",
      owner: "Platform",
      active: true,
      createdAt: seedTime,
      updatedAt: seedTime
    }
  ];

  appState.tasks = [
    {
      id: "T-201",
      title: "Mobile-sized window from Replify for demoing different users",
      description: "Enable quick mobile-size switching for demos.",
      status: "submitted",
      storyId: "STR-MOBILE-DEMO",
      storyExempt: false,
      storyPoints: 5,
      priorityLabel: "P1",
      version: "2.4.0",
      order: 1,
      updatedAt: seedTime,
      updatedBy: "eira"
    },
    {
      id: "T-202",
      title: "Add Darin's email templates",
      description: "Automate email demos with reusable templates.",
      status: "submitted",
      storyId: "STR-EMAIL-DEMOS",
      storyExempt: false,
      storyPoints: 3,
      priorityLabel: "P0",
      version: "2.4.0",
      order: 1,
      updatedAt: seedTime,
      updatedBy: "eira"
    },
    {
      id: "T-203",
      title: "Prompt-based flow for adding pages",
      description: "Support prompt-driven page generation and setup.",
      status: "submitted",
      storyId: "STR-PROMPT-AUTO",
      storyExempt: false,
      storyPoints: 8,
      priorityLabel: "P0",
      version: "2.4.0",
      order: 1,
      updatedAt: seedTime,
      updatedBy: "eira"
    },
    {
      id: "T-204",
      title: "Metrics dashboard for feature adoption",
      description: "Track what users use so we can focus roadmap and evangelism.",
      status: "submitted",
      storyId: "STR-METRICS",
      storyExempt: false,
      storyPoints: 5,
      priorityLabel: "P1",
      version: "2.4.0",
      order: 1,
      updatedAt: seedTime,
      updatedBy: "eira"
    },
    {
      id: "T-205",
      title: "Implement OAuth/login",
      description: "Improve security and usage safety for Chrome extension users.",
      status: "submitted",
      storyId: "STR-OAUTH-LOGIN",
      storyExempt: false,
      storyPoints: 8,
      priorityLabel: "P0",
      version: "2.4.0",
      order: 1,
      updatedAt: seedTime,
      updatedBy: "eira"
    }
  ];

  appState.releases = [
    {
      version: "2.4.0",
      releaseDate: "2026-02-20",
      isActive: false,
      isUpcoming: true,
      notes: "Target release for current roadmap.",
      releaseNotesUrl: RELEASE_NOTES_URL
    },
    {
      version: "2.3.9",
      releaseDate: "2026-02-02",
      isActive: true,
      isUpcoming: false,
      notes: "Current release.",
      releaseNotesUrl: RELEASE_NOTES_URL
    }
  ];
}

function formatDate(isoDate) {
  if (!isoDate) return "Date pending";
  const date = new Date(isoDate);
  if (Number.isNaN(date.valueOf())) return "Date pending";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function getStoryById(storyId) {
  return appState.stories.find((story) => story.storyId === storyId) || null;
}

function getNextVersionRelease() {
  return (
    appState.releases.find((release) => release.isUpcoming) ||
    appState.releases
      .slice()
      .sort((a, b) => new Date(a.releaseDate).valueOf() - new Date(b.releaseDate).valueOf())
      .at(-1) ||
    null
  );
}

function renderReleaseSummary() {
  const nextRelease = getNextVersionRelease();
  if (nextRelease) {
    dom.nextVersion.textContent = "v " + nextRelease.version;
    dom.nextVersionDate.textContent = "Target " + formatDate(nextRelease.releaseDate);
  } else {
    dom.nextVersion.textContent = "No next version";
    dom.nextVersionDate.textContent = "Add a release row";
  }

  dom.previousReleaseList.innerHTML = "";
  const previousReleases = appState.releases
    .filter((release) => !release.isUpcoming)
    .sort((a, b) => new Date(b.releaseDate).valueOf() - new Date(a.releaseDate).valueOf());

  if (previousReleases.length === 0) {
    const item = document.createElement("li");
    item.textContent = "No previous versions";
    dom.previousReleaseList.append(item);
    return;
  }

  previousReleases.forEach((release) => {
    const item = document.createElement("li");
    if (release.releaseNotesUrl) {
      const link = document.createElement("a");
      link.href = release.releaseNotesUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "v " + release.version + " (" + formatDate(release.releaseDate) + ")";
      item.append(link);
    } else {
      item.textContent = "v " + release.version + " (" + formatDate(release.releaseDate) + ")";
    }
    dom.previousReleaseList.append(item);
  });
}

function getCookieValue(name) {
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(name + "="));
  if (!cookie) return null;
  return decodeURIComponent(cookie.split("=").slice(1).join("="));
}

function setCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie =
    name +
    "=" +
    encodeURIComponent(value) +
    "; expires=" +
    expires +
    "; path=/; SameSite=Lax";
}

function clearCookie(name) {
  document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax";
}

function loadAuthFromCookie() {
  const raw = getCookieValue("roadmap_session");
  if (!raw) return;
  try {
    const decoded = JSON.parse(atob(raw));
    if (!decoded || !decoded.role || !ROLE_PERMISSIONS[decoded.role]) return;
    appState.auth = {
      username: decoded.username || null,
      role: decoded.role
    };
  } catch (_) {
    clearCookie("roadmap_session");
  }
}

function saveAuthCookie() {
  const sessionPayload = {
    username: appState.auth.username,
    role: appState.auth.role
  };
  setCookie("roadmap_session", btoa(JSON.stringify(sessionPayload)), 14);
}

function renderAuthUi() {
  const role = appState.auth.role;
  const permission = getPermissions();
  if (role === "guest") {
    dom.loginIconText.textContent = "Login";
    dom.authStatus.textContent = "Viewing as guest";
  } else {
    dom.loginIconText.textContent = "Account";
    dom.authStatus.textContent = appState.auth.username + " · " + permission.label;
  }

  dom.addTaskBtn.disabled = !permission.canAddTask;
  dom.addStoryBtn.disabled = !permission.canAddStory;
  dom.submitBtn.disabled = !permission.canSubmit;

  dom.addTaskBtn.title = permission.canAddTask
    ? permission.addTaskSubmittedOnly
      ? "Add a task to Submitted"
      : "Add task"
    : "Login required";
  dom.addStoryBtn.title = permission.canAddStory ? "Add story" : "Editor role required";
  dom.submitBtn.title = permission.canSubmit ? "Submit changes" : "Editor role required";
}

function updateDirtyIndicator() {
  if (appState.unsavedChanges) {
    dom.dirtyIndicator.textContent = "Unsaved changes";
    dom.dirtyIndicator.classList.remove("clean");
    dom.dirtyIndicator.classList.add("dirty");
  } else {
    dom.dirtyIndicator.textContent = "All changes synced";
    dom.dirtyIndicator.classList.remove("dirty");
    dom.dirtyIndicator.classList.add("clean");
  }
}

let toastTimer = null;
function showToast(message, isError) {
  dom.toast.textContent = message;
  dom.toast.classList.remove("success", "error", "show");
  dom.toast.classList.add(isError ? "error" : "success", "show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    dom.toast.classList.remove("show");
  }, 2600);
}

function populateOptions() {
  dom.statusFilter.innerHTML = "";
  const allStatuses = document.createElement("option");
  allStatuses.value = "all";
  allStatuses.textContent = "All statuses";
  dom.statusFilter.append(allStatuses);
  STATUS_COLUMNS.forEach((column) => {
    const option = document.createElement("option");
    option.value = column.id;
    option.textContent = column.label;
    dom.statusFilter.append(option);
  });
  dom.statusFilter.value = appState.filters.status;

  dom.storyFilter.innerHTML = "";
  const allStories = document.createElement("option");
  allStories.value = "all";
  allStories.textContent = "All stories";
  dom.storyFilter.append(allStories);
  const unassigned = document.createElement("option");
  unassigned.value = "unassigned";
  unassigned.textContent = "Unassigned";
  dom.storyFilter.append(unassigned);

  appState.stories
    .filter((story) => story.active)
    .sort((a, b) => a.title.localeCompare(b.title))
    .forEach((story) => {
      const option = document.createElement("option");
      option.value = story.storyId;
      option.textContent = story.title;
      dom.storyFilter.append(option);
    });
  dom.storyFilter.value = appState.filters.story;

  dom.taskStatusInput.innerHTML = "";
  STATUS_COLUMNS.forEach((column) => {
    const option = document.createElement("option");
    option.value = column.id;
    option.textContent = column.label;
    dom.taskStatusInput.append(option);
  });

  dom.taskStoryInput.innerHTML = "";
  const emptyStory = document.createElement("option");
  emptyStory.value = "";
  emptyStory.textContent = "Unassigned";
  dom.taskStoryInput.append(emptyStory);
  appState.stories
    .filter((story) => story.active)
    .sort((a, b) => a.title.localeCompare(b.title))
    .forEach((story) => {
      const option = document.createElement("option");
      option.value = story.storyId;
      option.textContent = story.title;
      dom.taskStoryInput.append(option);
    });

  dom.moveGuardStorySelect.innerHTML = "";
  const chooseOption = document.createElement("option");
  chooseOption.value = "";
  chooseOption.textContent = "Select a story";
  dom.moveGuardStorySelect.append(chooseOption);
  appState.stories
    .filter((story) => story.active)
    .sort((a, b) => a.title.localeCompare(b.title))
    .forEach((story) => {
      const option = document.createElement("option");
      option.value = story.storyId;
      option.textContent = story.title;
      dom.moveGuardStorySelect.append(option);
    });

  dom.taskPointsInput.innerHTML = "";
  const noPoints = document.createElement("option");
  noPoints.value = "";
  noPoints.textContent = "Not estimated";
  dom.taskPointsInput.append(noPoints);
  STORY_POINT_VALUES.forEach((value) => {
    const option = document.createElement("option");
    option.value = String(value);
    option.textContent = String(value);
    dom.taskPointsInput.append(option);
  });

  dom.taskPriorityLabelInput.innerHTML = "";
  PRIORITY_LABELS.forEach((label) => {
    const option = document.createElement("option");
    option.value = label;
    option.textContent = label;
    dom.taskPriorityLabelInput.append(option);
  });
}

function getPriorityRank(priorityLabel) {
  return PRIORITY_LABELS.indexOf(priorityLabel);
}

function compareTasks(a, b) {
  const rankDiff = getPriorityRank(a.priorityLabel) - getPriorityRank(b.priorityLabel);
  if (rankDiff !== 0) return rankDiff;
  const orderDiff = (a.order || 0) - (b.order || 0);
  if (orderDiff !== 0) return orderDiff;
  return new Date(a.updatedAt).valueOf() - new Date(b.updatedAt).valueOf();
}

function taskMatchesFilters(task) {
  const searchTerm = appState.filters.search.trim().toLowerCase();
  if (searchTerm) {
    const storyTitle = task.storyId ? getStoryById(task.storyId)?.title || "" : "";
    const text = [task.title, task.description || "", storyTitle].join(" ").toLowerCase();
    if (!text.includes(searchTerm)) return false;
  }

  if (appState.filters.story === "unassigned" && task.storyId) return false;
  if (
    appState.filters.story !== "all" &&
    appState.filters.story !== "unassigned" &&
    task.storyId !== appState.filters.story
  ) {
    return false;
  }

  return true;
}

function getNextStatusId(statusId) {
  const index = STATUS_COLUMNS.findIndex((column) => column.id === statusId);
  if (index < 0) return null;
  return STATUS_COLUMNS[index + 1]?.id || null;
}

function getStatusLabel(statusId) {
  return STATUS_COLUMNS.find((column) => column.id === statusId)?.label || statusId;
}

function markTaskDirty(taskId, kind) {
  appState.unsavedChanges = true;
  if (taskId) {
    appState.changedTaskIds.add(taskId);
    if (kind === "move") appState.movedTaskIds.add(taskId);
    if (kind === "edit") appState.editedTaskIds.add(taskId);
  }
  updateDirtyIndicator();
}

function nextOrderIndex(status, storyId, ignoreTaskId) {
  const matching = appState.tasks.filter((task) => {
    if (ignoreTaskId && task.id === ignoreTaskId) return false;
    return task.status === status && (task.storyId || null) === (storyId || null);
  });
  const maxOrder = matching.reduce((maxValue, task) => Math.max(maxValue, Number(task.order) || 0), 0);
  return maxOrder + 1;
}

function reindexBucket(status, storyId) {
  appState.tasks
    .filter((task) => task.status === status && (task.storyId || null) === (storyId || null))
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .forEach((task, index) => {
      task.order = index + 1;
    });
}

function createTaskCard(task) {
  const card = document.createElement("article");
  card.className = "task-card";
  card.dataset.priority = task.priorityLabel;

  const title = document.createElement("h4");
  title.className = "task-title";
  title.textContent = task.title;

  const description = document.createElement("p");
  description.className = "task-description";
  description.textContent = task.description || "No description provided.";

  const badgeRow = document.createElement("div");
  badgeRow.className = "badge-row";

  const priorityBadge = document.createElement("span");
  priorityBadge.className = "badge priority";
  priorityBadge.textContent = task.priorityLabel;
  badgeRow.append(priorityBadge);

  const pointsBadge = document.createElement("span");
  pointsBadge.className = "badge points";
  pointsBadge.textContent = task.storyPoints ? task.storyPoints + " pts" : "No points";
  badgeRow.append(pointsBadge);

  const versionBadge = document.createElement("span");
  versionBadge.className = "badge version";
  versionBadge.textContent = "v " + task.version;
  badgeRow.append(versionBadge);

  if (task.storyExempt) {
    const exemptBadge = document.createElement("span");
    exemptBadge.className = "badge exempt";
    exemptBadge.textContent = "Story skipped";
    badgeRow.append(exemptBadge);
  }

  const actionRow = document.createElement("div");
  actionRow.className = "card-actions";

  const permissions = getPermissions();
  if (permissions.canEditTask) {
    const editBtn = document.createElement("button");
    editBtn.className = "text-btn";
    editBtn.type = "button";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => openTaskModal("edit", task.id));
    actionRow.append(editBtn);
  }

  if (permissions.canMoveTask) {
    const nextStatus = getNextStatusId(task.status);
    if (nextStatus) {
      const nextBtn = document.createElement("button");
      nextBtn.className = "text-btn next";
      nextBtn.type = "button";
      nextBtn.textContent = "Next →";
      nextBtn.title = "Move to " + getStatusLabel(nextStatus);
      nextBtn.addEventListener("click", () => moveTaskToNextColumn(task.id));
      actionRow.append(nextBtn);
    }
  }

  if (actionRow.children.length > 0) {
    card.append(title, description, badgeRow, actionRow);
  } else {
    card.append(title, description, badgeRow);
  }

  return card;
}

function buildGroupsForStatus(statusId) {
  const groupMap = new Map();
  const tasks = appState.tasks
    .filter((task) => task.status === statusId)
    .filter(taskMatchesFilters)
    .sort(compareTasks);

  tasks.forEach((task) => {
    const key = task.storyId || "__unassigned";
    if (!groupMap.has(key)) {
      if (!task.storyId) {
        groupMap.set(key, {
          key,
          storyId: null,
          title: "Unassigned",
          category: "Intake",
          tasks: []
        });
      } else {
        const story = getStoryById(task.storyId);
        groupMap.set(key, {
          key,
          storyId: task.storyId,
          title: story?.title || task.storyId,
          category: story?.category || "General",
          tasks: []
        });
      }
    }
    groupMap.get(key).tasks.push(task);
  });

  return Array.from(groupMap.values()).sort((a, b) => {
    if (a.storyId === null) return -1;
    if (b.storyId === null) return 1;
    return a.title.localeCompare(b.title);
  });
}

function renderBoard() {
  dom.board.innerHTML = "";

  const columns =
    appState.filters.status === "all"
      ? STATUS_COLUMNS
      : STATUS_COLUMNS.filter((column) => column.id === appState.filters.status);

  columns.forEach((column) => {
    const columnSection = document.createElement("section");
    columnSection.className = "column";
    columnSection.setAttribute("aria-label", column.label);

    const header = document.createElement("header");
    header.className = "column-header";
    const title = document.createElement("h2");
    title.className = "column-title";
    title.textContent = column.label;
    const count = document.createElement("span");
    count.className = "column-count";
    const visibleCount = appState.tasks.filter((task) => task.status === column.id && taskMatchesFilters(task)).length;
    count.textContent = visibleCount + " visible";
    header.append(title, count);

    const body = document.createElement("div");
    body.className = "column-body";

    const groups = buildGroupsForStatus(column.id);
    if (groups.length === 0) {
      const empty = document.createElement("p");
      empty.className = "column-empty";
      empty.textContent = "No tasks match current filters.";
      body.append(empty);
    } else {
      groups.forEach((group) => {
        const details = document.createElement("details");
        details.className = "story-group";
        const groupKey = column.id + "::" + (group.storyId || "__unassigned");
        const hasPreference = Object.prototype.hasOwnProperty.call(appState.collapsedGroups, groupKey);
        details.open = hasPreference ? !appState.collapsedGroups[groupKey] : true;

        details.addEventListener("toggle", () => {
          appState.collapsedGroups[groupKey] = !details.open;
        });

        const summary = document.createElement("summary");
        const main = document.createElement("span");
        main.className = "summary-main";
        const strong = document.createElement("strong");
        strong.textContent = group.title;
        main.append(strong);
        const meta = document.createElement("span");
        meta.className = "summary-meta";
        const category = document.createElement("span");
        category.className = "category-tag";
        category.textContent = group.category;
        meta.append(category);
        main.append(meta);

        const countBadge = document.createElement("span");
        countBadge.className = "column-count";
        countBadge.textContent = String(group.tasks.length);

        summary.append(main, countBadge);

        const cards = document.createElement("div");
        cards.className = "group-cards";
        group.tasks.forEach((task) => cards.append(createTaskCard(task)));

        details.append(summary, cards);
        body.append(details);
      });
    }

    columnSection.append(header, body);
    dom.board.append(columnSection);
  });
}

function openModal(backdrop) {
  backdrop.classList.remove("hidden");
}

function closeModal(backdrop) {
  backdrop.classList.add("hidden");
}

function closeAllModals() {
  closeModal(dom.taskModalBackdrop);
  closeModal(dom.storyModalBackdrop);
  closeModal(dom.moveGuardModalBackdrop);
  closeModal(dom.payloadModalBackdrop);
  closeModal(dom.loginModalBackdrop);
}

function configureTaskModalForRole() {
  const permissions = getPermissions();
  const createMode = appState.taskModalMode === "create";
  const restrictedCreate = createMode && permissions.addTaskSubmittedOnly;

  dom.taskStatusInput.disabled = restrictedCreate;
  dom.taskStoryInput.disabled = restrictedCreate;
  dom.taskExemptInput.disabled = restrictedCreate;

  if (restrictedCreate) {
    dom.taskStatusInput.value = "submitted";
    dom.taskStoryInput.value = "";
    dom.taskExemptInput.checked = false;
  }
}

function openTaskModal(mode, taskId) {
  const permissions = getPermissions();
  appState.taskModalMode = mode;

  if (mode === "create") {
    if (!permissions.canAddTask) {
      showToast("You do not have permission to add tasks.", true);
      return;
    }
    dom.taskModalTitle.textContent = permissions.addTaskSubmittedOnly
      ? "Add task to Submitted"
      : "Add task";
    dom.taskIdInput.value = "";
    dom.taskTitleInput.value = "";
    dom.taskDescriptionInput.value = "";
    dom.taskStatusInput.value = "submitted";
    dom.taskStoryInput.value = "";
    dom.taskPointsInput.value = "";
    dom.taskPriorityLabelInput.value = "P2";
    dom.taskVersionInput.value = getNextVersionRelease()?.version || "2.4.0";
    dom.taskExemptInput.checked = false;
  } else {
    if (!permissions.canEditTask) {
      showToast("Only editor role can edit tasks.", true);
      return;
    }
    const task = appState.tasks.find((item) => item.id === taskId);
    if (!task) return;
    dom.taskModalTitle.textContent = "Edit task";
    dom.taskIdInput.value = task.id;
    dom.taskTitleInput.value = task.title;
    dom.taskDescriptionInput.value = task.description || "";
    dom.taskStatusInput.value = task.status;
    dom.taskStoryInput.value = task.storyId || "";
    dom.taskPointsInput.value = task.storyPoints ? String(task.storyPoints) : "";
    dom.taskPriorityLabelInput.value = task.priorityLabel;
    dom.taskVersionInput.value = task.version;
    dom.taskExemptInput.checked = !!task.storyExempt;
  }

  dom.taskFormError.textContent = "";
  configureTaskModalForRole();
  openModal(dom.taskModalBackdrop);
  dom.taskTitleInput.focus();
}

function closeTaskModal() {
  dom.taskFormError.textContent = "";
  closeModal(dom.taskModalBackdrop);
}

function openStoryModal() {
  const permissions = getPermissions();
  if (!permissions.canAddStory) {
    showToast("Only editor role can add stories.", true);
    return;
  }
  dom.storyTitleInput.value = "";
  dom.storyCategoryInput.value = "";
  dom.storyOwnerInput.value = "";
  dom.storyFormError.textContent = "";
  openModal(dom.storyModalBackdrop);
  dom.storyTitleInput.focus();
}

function closeStoryModal() {
  dom.storyFormError.textContent = "";
  closeModal(dom.storyModalBackdrop);
}

function openMoveGuardModal(taskId, nextStatus) {
  const task = appState.tasks.find((item) => item.id === taskId);
  if (!task) return;

  appState.pendingMove = {
    taskId,
    nextStatus
  };

  dom.moveGuardText.textContent =
    "Before moving to " +
    getStatusLabel(nextStatus) +
    ", assign a story or explicitly skip story requirement.";
  dom.moveGuardStorySelect.value = "";
  dom.moveGuardSkipCheckbox.checked = false;
  dom.moveGuardError.textContent = "";
  openModal(dom.moveGuardModalBackdrop);
}

function closeMoveGuardModal() {
  appState.pendingMove = null;
  dom.moveGuardError.textContent = "";
  closeModal(dom.moveGuardModalBackdrop);
}

function createStoryId(title) {
  const normalized = title
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);

  const base = "STR-" + (normalized || "NEW-STORY");
  let candidate = base;
  let index = 2;

  while (appState.stories.some((story) => story.storyId === candidate)) {
    candidate = base + "-" + index;
    index += 1;
  }
  return candidate;
}

function nextTaskId() {
  const max = appState.tasks.reduce((maxValue, task) => {
    const match = String(task.id).match(/(\d+)/);
    return match ? Math.max(maxValue, Number(match[1])) : maxValue;
  }, 0);
  return "T-" + String(max + 1).padStart(3, "0");
}

function saveTaskFromModal(event) {
  event.preventDefault();

  const permissions = getPermissions();
  const mode = appState.taskModalMode;
  dom.taskFormError.textContent = "";

  const formValue = {
    title: dom.taskTitleInput.value.trim(),
    description: dom.taskDescriptionInput.value.trim(),
    status: dom.taskStatusInput.value,
    storyId: dom.taskStoryInput.value || null,
    storyPoints: dom.taskPointsInput.value ? Number(dom.taskPointsInput.value) : null,
    priorityLabel: dom.taskPriorityLabelInput.value,
    version: dom.taskVersionInput.value.trim() || getNextVersionRelease()?.version || "2.4.0",
    storyExempt: dom.taskExemptInput.checked
  };

  if (!formValue.title) {
    dom.taskFormError.textContent = "Title is required.";
    return;
  }

  if (!PRIORITY_LABELS.includes(formValue.priorityLabel)) {
    dom.taskFormError.textContent = "Priority must be P0, P1, P2, or P3.";
    return;
  }

  if (formValue.storyPoints !== null && !STORY_POINT_VALUES.includes(formValue.storyPoints)) {
    dom.taskFormError.textContent = "Story points must be 1, 2, 3, 5, 8, or 13.";
    return;
  }

  if (mode === "create") {
    if (!permissions.canAddTask) {
      dom.taskFormError.textContent = "You cannot add tasks.";
      return;
    }

    if (permissions.addTaskSubmittedOnly) {
      formValue.status = "submitted";
      formValue.storyId = null;
      formValue.storyExempt = false;
    }

    if (formValue.status !== "submitted" && !formValue.storyId && !formValue.storyExempt) {
      dom.taskFormError.textContent = "Story is required outside Submitted unless skipped.";
      return;
    }

    const newTask = {
      id: nextTaskId(),
      title: formValue.title,
      description: formValue.description,
      status: formValue.status,
      storyId: formValue.storyId,
      storyExempt: formValue.storyExempt,
      storyPoints: formValue.storyPoints,
      priorityLabel: formValue.priorityLabel,
      version: formValue.version,
      order: nextOrderIndex(formValue.status, formValue.storyId, null),
      updatedAt: nowIso(),
      updatedBy: appState.auth.username || "guest"
    };

    appState.tasks.push(newTask);
    markTaskDirty(newTask.id, "edit");
    closeTaskModal();
    renderBoard();
    showToast("Task created.", false);
    return;
  }

  if (!permissions.canEditTask) {
    dom.taskFormError.textContent = "You cannot edit tasks.";
    return;
  }

  const taskId = dom.taskIdInput.value;
  const task = appState.tasks.find((item) => item.id === taskId);
  if (!task) {
    dom.taskFormError.textContent = "Task not found.";
    return;
  }

  if (formValue.status !== "submitted" && !formValue.storyId && !formValue.storyExempt) {
    dom.taskFormError.textContent = "Story is required outside Submitted unless skipped.";
    return;
  }

  const oldStatus = task.status;
  const oldStoryId = task.storyId || null;

  task.title = formValue.title;
  task.description = formValue.description;
  task.status = formValue.status;
  task.storyId = formValue.storyId;
  task.storyExempt = formValue.storyExempt;
  task.storyPoints = formValue.storyPoints;
  task.priorityLabel = formValue.priorityLabel;
  task.version = formValue.version;
  task.updatedAt = nowIso();
  task.updatedBy = appState.auth.username || "guest";

  if (oldStatus !== task.status || oldStoryId !== (task.storyId || null)) {
    task.order = nextOrderIndex(task.status, task.storyId || null, task.id);
    reindexBucket(oldStatus, oldStoryId);
    markTaskDirty(task.id, "move");
  } else {
    markTaskDirty(task.id, "edit");
  }

  if (oldStoryId !== (task.storyId || null)) {
    if (oldStoryId) appState.storiesChanged.add(oldStoryId);
    if (task.storyId) appState.storiesChanged.add(task.storyId);
  }

  reindexBucket(task.status, task.storyId || null);

  closeTaskModal();
  renderBoard();
  showToast("Task updated.", false);
}

function saveStoryFromModal(event) {
  event.preventDefault();

  const permissions = getPermissions();
  if (!permissions.canAddStory) {
    dom.storyFormError.textContent = "Only editor role can add stories.";
    return;
  }

  const title = dom.storyTitleInput.value.trim();
  const category = dom.storyCategoryInput.value.trim() || "General";
  const owner = dom.storyOwnerInput.value.trim() || appState.auth.username || "Team";
  if (!title) {
    dom.storyFormError.textContent = "Story title is required.";
    return;
  }

  const storyId = createStoryId(title);
  const timestamp = nowIso();

  appState.stories.push({
    storyId,
    title,
    category,
    owner,
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  appState.storiesChanged.add(storyId);
  appState.unsavedChanges = true;
  updateDirtyIndicator();

  populateOptions();
  closeStoryModal();
  renderBoard();
  showToast("Story created.", false);
}

function validateTask(task) {
  const errors = [];
  if (!task.title || !task.title.trim()) {
    errors.push(task.id + ": title is required.");
  }
  if (!STATUS_COLUMNS.some((column) => column.id === task.status)) {
    errors.push(task.id + ": invalid status.");
  }
  if (!PRIORITY_LABELS.includes(task.priorityLabel)) {
    errors.push(task.id + ": invalid priority.");
  }
  if (task.storyPoints !== null && !STORY_POINT_VALUES.includes(Number(task.storyPoints))) {
    errors.push(task.id + ": story points must use Fibonacci values.");
  }
  if (task.status !== "submitted" && !task.storyExempt && !task.storyId) {
    errors.push(task.id + ": story is required outside Submitted unless skipped.");
  }
  if (task.storyId && !getStoryById(task.storyId)) {
    errors.push(task.id + ": story_id does not exist.");
  }
  return errors;
}

function validateBoard() {
  return appState.tasks.flatMap(validateTask);
}

function buildSubmitPayload() {
  const release = getNextVersionRelease();
  return {
    release,
    releaseVersion: release?.version || null,
    submittedAt: nowIso(),
    tasks: [...appState.tasks]
      .sort((a, b) => {
        const statusA = STATUS_COLUMNS.findIndex((column) => column.id === a.status);
        const statusB = STATUS_COLUMNS.findIndex((column) => column.id === b.status);
        if (statusA !== statusB) return statusA - statusB;
        return compareTasks(a, b);
      })
      .map((task) => ({
        task_id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        story_id: task.storyId,
        story_exempt: task.storyExempt,
        story_points: task.storyPoints,
        priority_label: task.priorityLabel,
        version: task.version,
        order_index: task.order,
        updated_at: task.updatedAt,
        updated_by: task.updatedBy || appState.auth.username || "guest"
      })),
    storiesChanged: [...appState.storiesChanged],
    movedCards: [...appState.movedTaskIds],
    changes: [...new Set([...appState.movedTaskIds, ...appState.editedTaskIds])]
  };
}

function openPayloadModal(payload) {
  dom.payloadPreview.textContent = JSON.stringify(payload, null, 2);
  openModal(dom.payloadModalBackdrop);
}

function clearChangeSets() {
  appState.changedTaskIds.clear();
  appState.movedTaskIds.clear();
  appState.editedTaskIds.clear();
  appState.storiesChanged.clear();
}

async function submitPayloadToBackend(payload) {
  if (!API_CONFIG.syncUrl) {
    return {
      synced: false,
      reason: "No syncUrl configured."
    };
  }

  const response = await fetch(API_CONFIG.syncUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error("Sync failed with status " + response.status);
  }

  return {
    synced: true,
    body: await response.text()
  };
}

async function handleSubmit() {
  const permissions = getPermissions();
  if (!permissions.canSubmit) {
    showToast("Only editor role can submit payloads.", true);
    return;
  }

  const errors = validateBoard();
  if (errors.length > 0) {
    openPayloadModal({
      errors,
      hint: "Resolve validation issues and submit again."
    });
    showToast("Validation errors must be fixed first.", true);
    return;
  }

  const payload = buildSubmitPayload();
  openPayloadModal(payload);

  try {
    const result = await submitPayloadToBackend(payload);
    if (result.synced) {
      appState.unsavedChanges = false;
      clearChangeSets();
      updateDirtyIndicator();
      showToast("Submitted to backend.", false);
    } else {
      showToast("Payload preview ready. Configure syncUrl to POST.", false);
    }
  } catch (error) {
    showToast(error.message || "Submit failed.", true);
  }
}

function applyMove(task, nextStatus, options) {
  const oldStatus = task.status;
  const oldStoryId = task.storyId || null;

  const storyId = Object.prototype.hasOwnProperty.call(options, "storyId")
    ? options.storyId
    : task.storyId;
  const storyExempt = Object.prototype.hasOwnProperty.call(options, "storyExempt")
    ? options.storyExempt
    : task.storyExempt;

  if (nextStatus !== "submitted" && !storyId && !storyExempt) {
    showToast("Story is required unless you explicitly skip it.", true);
    return false;
  }

  task.status = nextStatus;
  task.storyId = storyId;
  task.storyExempt = Boolean(storyExempt);
  task.order = nextOrderIndex(nextStatus, storyId || null, task.id);
  task.updatedAt = nowIso();
  task.updatedBy = appState.auth.username || "guest";

  reindexBucket(oldStatus, oldStoryId);
  reindexBucket(task.status, task.storyId || null);

  if (oldStoryId !== (task.storyId || null)) {
    if (oldStoryId) appState.storiesChanged.add(oldStoryId);
    if (task.storyId) appState.storiesChanged.add(task.storyId);
  }

  markTaskDirty(task.id, "move");
  renderBoard();
  return true;
}

function moveTaskToNextColumn(taskId) {
  const permissions = getPermissions();
  if (!permissions.canMoveTask) {
    showToast("Only editor role can move tasks.", true);
    return;
  }

  const task = appState.tasks.find((item) => item.id === taskId);
  if (!task) return;

  const nextStatus = getNextStatusId(task.status);
  if (!nextStatus) {
    showToast("Task is already in the last column.", true);
    return;
  }

  if (nextStatus !== "submitted" && !task.storyId && !task.storyExempt) {
    openMoveGuardModal(task.id, nextStatus);
    return;
  }

  const moved = applyMove(task, nextStatus, {});
  if (moved) {
    showToast("Moved to " + getStatusLabel(nextStatus) + ".", false);
  }
}

function confirmMoveGuard() {
  if (!appState.pendingMove) return;

  const task = appState.tasks.find((item) => item.id === appState.pendingMove.taskId);
  if (!task) {
    closeMoveGuardModal();
    return;
  }

  const chosenStory = dom.moveGuardStorySelect.value || null;
  const skipRequirement = dom.moveGuardSkipCheckbox.checked;

  if (!chosenStory && !skipRequirement) {
    dom.moveGuardError.textContent = "Select a story or check skip requirement.";
    return;
  }

  dom.moveGuardError.textContent = "";
  const targetStatus = appState.pendingMove.nextStatus;

  const moved = applyMove(task, targetStatus, {
    storyId: chosenStory,
    storyExempt: skipRequirement
  });

  if (moved) {
    closeMoveGuardModal();
    showToast("Moved to " + getStatusLabel(targetStatus) + ".", false);
  }
}

function clearAuthError() {
  dom.loginError.textContent = "";
}

function openLoginModal() {
  clearAuthError();
  dom.loginUsernameInput.value = appState.auth.username || "";
  dom.loginPasswordInput.value = "";
  openModal(dom.loginModalBackdrop);
  dom.loginUsernameInput.focus();
}

function closeLoginModal() {
  clearAuthError();
  closeModal(dom.loginModalBackdrop);
}

function handleLogin(event) {
  event.preventDefault();
  clearAuthError();

  const username = dom.loginUsernameInput.value.trim().toLowerCase();
  const password = dom.loginPasswordInput.value;

  const user = DEMO_USERS[username];
  if (!user || user.password !== password) {
    dom.loginError.textContent = "Invalid credentials.";
    return;
  }

  appState.auth = {
    username,
    role: user.role
  };

  saveAuthCookie();
  renderAuthUi();
  closeLoginModal();
  renderBoard();
  showToast("Logged in as " + username + ".", false);
}

function logout() {
  appState.auth = {
    username: null,
    role: "guest"
  };
  clearCookie("roadmap_session");
  renderAuthUi();
  closeLoginModal();
  renderBoard();
  showToast("Logged out.", false);
}

function bindEvents() {
  dom.searchInput.addEventListener("input", (event) => {
    appState.filters.search = event.target.value;
    renderBoard();
  });

  dom.statusFilter.addEventListener("change", (event) => {
    appState.filters.status = event.target.value;
    renderBoard();
  });

  dom.storyFilter.addEventListener("change", (event) => {
    appState.filters.story = event.target.value;
    renderBoard();
  });

  dom.addTaskBtn.addEventListener("click", () => openTaskModal("create", null));
  dom.addStoryBtn.addEventListener("click", openStoryModal);
  dom.submitBtn.addEventListener("click", handleSubmit);

  dom.taskForm.addEventListener("submit", saveTaskFromModal);
  dom.cancelTaskBtn.addEventListener("click", closeTaskModal);

  dom.storyForm.addEventListener("submit", saveStoryFromModal);
  dom.cancelStoryBtn.addEventListener("click", closeStoryModal);

  dom.cancelMoveGuardBtn.addEventListener("click", closeMoveGuardModal);
  dom.confirmMoveGuardBtn.addEventListener("click", confirmMoveGuard);

  dom.closePayloadBtn.addEventListener("click", () => closeModal(dom.payloadModalBackdrop));

  dom.loginIconBtn.addEventListener("click", openLoginModal);
  dom.loginForm.addEventListener("submit", handleLogin);
  dom.cancelLoginBtn.addEventListener("click", closeLoginModal);
  dom.logoutBtn.addEventListener("click", logout);

  [
    dom.taskModalBackdrop,
    dom.storyModalBackdrop,
    dom.moveGuardModalBackdrop,
    dom.payloadModalBackdrop,
    dom.loginModalBackdrop
  ].forEach((backdrop) => {
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) closeModal(backdrop);
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAllModals();
    }
  });
}

function init() {
  cacheDom();
  loadSeedData();
  loadAuthFromCookie();
  renderReleaseSummary();
  populateOptions();
  renderAuthUi();
  updateDirtyIndicator();
  bindEvents();
  renderBoard();
}

init();
EOF