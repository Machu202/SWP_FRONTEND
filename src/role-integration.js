(() => {
  const Api = window.MangaApi;
  if (!Api) return;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const page = location.pathname.split("/").pop();

  const state = {
    series: [],
    chapters: [],
    pages: [],
    feedbacks: [],
    schedules: [],
    deadlines: [],
    tasks: [],
    users: [],
    params: [],
    voteSummary: null,
  };

  const esc = (value = "") => String(value ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
  const fmtDate = (value) => value ? new Date(value).toLocaleString() : "—";
  const lower = (value = "") => String(value || "").toLowerCase();
  const statusClass = (status = "") => {
    const s = lower(status);
    if (s.includes("revision_requested") || s.includes("needs_revision") || s.includes("sent_back")) return "review";
    if (s.includes("approved") || s.includes("active") || s.includes("resolved") || s.includes("ongoing")) return "approved";
    if (s.includes("review") || s.includes("pending") || s.includes("doing") || s.includes("progress")) return "progress";
    if (s.includes("reject") || s.includes("lock") || s.includes("late") || s.includes("high")) return "review";
    return "";
  };
  const badge = (text) => `<span class="status-tag ${statusClass(text)}">${esc(text || "—")}</span>`;
  const toast = (message, type = "info") => window.showToast ? window.showToast(message, type) : alert(message);

  function withApiTimeout(promise, label = "backend request", ms = 8000) {
    return Promise.race([
      Promise.resolve(promise),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), ms))
    ]);
  }

  function cachedUserProfile() {
    try {
      return JSON.parse(localStorage.getItem("profileCache") || "{}");
    } catch (_) {
      return {};
    }
  }

  function currentProfileFromLocalStorage() {
    const cached = cachedUserProfile();

    return {
      id: localStorage.getItem("userId") || localStorage.getItem("id") || "",
      username: localStorage.getItem("username") || localStorage.getItem("userName") || "",
      email: localStorage.getItem("email") || localStorage.getItem("userEmail") || "",
      fullName: localStorage.getItem("fullName") || localStorage.getItem("name") || "",
      role: localStorage.getItem("role") || localStorage.getItem("userRole") || "",
      ...cached
    };
  }

  function profileDisplayName(profile = currentProfileFromLocalStorage()) {
    return profile.fullName ||
      profile.name ||
      profile.displayName ||
      profile.username ||
      profile.userName ||
      profile.email ||
      "User";
  }

  function profileAvatarUrl(profile = currentProfileFromLocalStorage()) {
    return profile.profileImageUrl ||
      profile.avatarUrl ||
      profile.photoUrl ||
      profile.picture ||
      profile.imageUrl ||
      "";
  }

  function avatarInitials(name = "User", fallback = "U") {
    const source = String(name || fallback || "U").trim();
    const parts = source.split(/\s+/).filter(Boolean);

    if (!parts.length) return String(fallback || "U").slice(0, 2).toUpperCase();
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  function avatarMarkup(profile = currentProfileFromLocalStorage()) {
    const name = profileDisplayName(profile);
    const image = profileAvatarUrl(profile);

    if (image) {
      return `<img class="unified-avatar-img" src="${esc(image)}" alt="${esc(name)} avatar">`;
    }

    return `<span class="unified-avatar-initials">${esc(avatarInitials(name))}</span>`;
  }

  function applyUnifiedAvatar(profile = currentProfileFromLocalStorage()) {
    const html = avatarMarkup(profile);

    [
      ".editor-avatar",
      ".topbar-avatar",
      ".admin-brand-avatar",
      ".admin-top-avatar",
      ".board-brand-avatar",
      ".board-top-avatar",
      ".ws-logo"
    ].forEach(selector => {
      $$(selector).forEach(element => {
        // Login cover images should not be touched.
        if (element.classList.contains("manga-image")) return;

        element.classList.add("unified-avatar");
        element.innerHTML = html;
        element.setAttribute("aria-label", `${profileDisplayName(profile)} avatar`);
      });
    });
  }

  async function syncShellAvatarWithProfile() {
    const localProfile = currentProfileFromLocalStorage();
    applyUnifiedAvatar(localProfile);

    try {
      const backendProfile = Api.profile
        ? await Api.profile()
        : (Api.currentUser ? await Api.currentUser() : null);

      if (backendProfile && typeof backendProfile === "object") {
        const profile = {
          ...localProfile,
          ...(backendProfile.data || backendProfile.user || backendProfile.profile || backendProfile)
        };

        localStorage.setItem("profileCache", JSON.stringify(profile));

        if (profile.fullName || profile.name) localStorage.setItem("fullName", profile.fullName || profile.name);
        if (profile.email) localStorage.setItem("email", profile.email);
        if (profile.username) localStorage.setItem("username", profile.username);
        if (profile.role || profile.roleName) localStorage.setItem("role", profile.role || profile.roleName);

        applyUnifiedAvatar(profile);
      }
    } catch (error) {
      // The shell still uses login/localStorage data when profile endpoint is unavailable.
      console.warn("Using cached avatar/profile for shell:", error.message);
    }
  }

  function getTantouSeriesReturnStore() {
    try {
      return JSON.parse(localStorage.getItem("tantouReturnedSeries") || "{}");
    } catch (_) {
      return {};
    }
  }

  function saveTantouSeriesReturn(seriesId, data = {}) {
    if (!seriesId) return null;
    const store = getTantouSeriesReturnStore();
    store[String(seriesId)] = {
      ...(store[String(seriesId)] || {}),
      status: "REVISION_REQUESTED",
      returnedToMangaka: true,
      returnedAt: new Date().toISOString(),
      ...data
    };
    localStorage.setItem("tantouReturnedSeries", JSON.stringify(store));
    return store[String(seriesId)];
  }

  function getTantouSeriesReturn(seriesId) {
    if (!seriesId) return null;
    return getTantouSeriesReturnStore()[String(seriesId)] || null;
  }

  function applyTantouReturnOverride(series = {}) {
    const seriesId = seriesIdOf(series);
    const returned = getTantouSeriesReturn(seriesId);
    if (!returned) return series;

    return {
      ...series,
      status: returned.status || "REVISION_REQUESTED",
      tantouReturnNote: returned.note || returned.reason || "Sent back to Mangaka for further review.",
      returnedToMangaka: true,
      returnedAt: returned.returnedAt
    };
  }

  async function sendSeriesBackToMangaka(series = {}, note = "") {
    const seriesId = seriesIdOf(series) || Api.getActiveSeriesId();
    if (!seriesId) throw new Error("No selected series.");

    const reason = note.trim() || "Sent back by Tantou Editor for Mangaka revision/review.";
    const statusCandidates = ["REJECTED", "DRAFT", "REVISION_REQUESTED", "NEEDS_REVISION"];
    let backendUpdated = false;
    let backendMessage = "";

    for (const status of statusCandidates) {
      try {
        await Api.updateSeriesStatus(seriesId, status);
        backendUpdated = true;
        backendMessage = `Backend status updated to ${status}.`;
        break;
      } catch (error) {
        backendMessage = error?.message || String(error);
      }
    }

    saveTantouSeriesReturn(seriesId, {
      note: reason,
      backendUpdated,
      backendMessage,
      previousStatus: series.status || series.seriesStatus || "—",
      seriesTitle: series.title || series.name || ""
    });

    return { backendUpdated, backendMessage };
  }

  const tantouPages = new Set([
    "tantou-dashboard.html",
    "tantou-review.html",
    "tantou-feedback.html",
    "tantou-revision.html",
    "tantou-report.html"
  ]);

  function isTantouPage() {
    return tantouPages.has(page);
  }

  function normalizeStatusText(value = "") {
    return String(value || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  }

  function isMangakaApprovedStatus(value = "") {
    const status = normalizeStatusText(value);
    return status === "APPROVED" ||
      status === "MANGAKA_APPROVED" ||
      status === "APPROVED_BY_MANGAKA" ||
      status === "READY_FOR_TANTOU" ||
      status === "READY_FOR_EDITOR" ||
      status === "READY_FOR_EDITORIAL" ||
      status === "READY_FOR_REVIEW" ||
      status === "TANTOU_REVIEW";
  }

  function isTantouReviewableSeries(series = {}) {
    if (!series) return false;

    const returned = getTantouSeriesReturn(seriesIdOf(series));
    if (returned?.returnedToMangaka) return false;

    const currentStatus = normalizeStatusText(series.status || series.seriesStatus || series.reviewStatus || "");
    if (["REVISION_REQUESTED", "NEEDS_REVISION", "SENT_BACK_TO_MANGAKA", "RETURNED_TO_MANGAKA"].includes(currentStatus)) {
      return false;
    }

    if (series.isApproved === true ||
        series.approved === true ||
        series.mangakaApproved === true ||
        series.readyForTantou === true) {
      return true;
    }

    return [
      series.status,
      series.seriesStatus,
      series.reviewStatus,
      series.publishStatus,
      series.approvalStatus,
      series.mangakaApprovalStatus
    ].some(isMangakaApprovedStatus);
  }

  function seriesIdOf(series = {}) {
    return series.id ?? series.seriesId ?? series.mangaSeriesId;
  }

  function mergeSeriesById(...lists) {
    const merged = new Map();

    lists.flat().filter(Boolean).forEach(series => {
      const key = String(seriesIdOf(series) ?? series.title ?? series.name ?? "").trim().toLowerCase();
      if (!key) return;
      merged.set(key, {
        ...(merged.get(key) || {}),
        ...series
      });
    });

    return Array.from(merged.values());
  }

  async function loadTantouApprovedSeries() {
    const lists = [];

    // Prefer the backend-approved queue if supported.
    if (Api.allSeries) {
      for (const status of ["APPROVED", "MANGAKA_APPROVED", "READY_FOR_TANTOU"]) {
        try {
          const result = Api.unwrapPage ? Api.unwrapPage(await Api.allSeries({ status })) : await Api.allSeries({ status });
          if (Array.isArray(result) && result.length) lists.push(result);
        } catch (error) {
          console.warn(`Could not load /manga-series?status=${status}`, error.message);
        }
      }

      // Also load the full list as fallback and filter client-side.
      try {
        const result = Api.unwrapPage ? Api.unwrapPage(await Api.allSeries()) : await Api.allSeries();
        if (Array.isArray(result) && result.length) lists.push(result);
      } catch (error) {
        console.warn("Could not load /manga-series for Tantou approved filter", error.message);
      }
    }

    const merged = mergeSeriesById(...lists)
      .map(applyTantouReturnOverride)
      .filter(isTantouReviewableSeries);

    // Ensure Tantou cannot stay on a stale DRAFT/non-approved series selected by another screen.
    if (merged.length && !merged.some(series => String(seriesIdOf(series)) === String(Api.getActiveSeriesId()))) {
      Api.setActiveSeriesId(seriesIdOf(merged[0]));
      localStorage.removeItem("activeChapterId");
      localStorage.removeItem("activePageId");
    }

    return merged;
  }

  function taskBelongsToApprovedTantouSeries(task = {}) {
    const approvedIds = new Set(state.series.map(series => String(seriesIdOf(series))).filter(Boolean));
    const approvedTitles = new Set(state.series.map(series => String(series.title || series.name || "").trim().toLowerCase()).filter(Boolean));

    const taskSeriesId =
      task.seriesId ??
      task.mangaSeriesId ??
      task.series?.id ??
      task.mangaSeries?.id ??
      task.chapter?.seriesId ??
      task.chapter?.mangaSeriesId ??
      task.page?.chapter?.seriesId ??
      task.page?.chapter?.mangaSeriesId ??
      task.page?.chapter?.mangaSeries?.id ??
      task.hitbox?.page?.chapter?.seriesId ??
      task.hitbox?.page?.chapter?.mangaSeriesId ??
      task.hitbox?.page?.chapter?.mangaSeries?.id;

    if (taskSeriesId !== undefined && taskSeriesId !== null && taskSeriesId !== "") {
      return approvedIds.has(String(taskSeriesId));
    }

    const taskSeriesTitle = String(
      task.seriesTitle ||
      task.mangaSeriesTitle ||
      task.series?.title ||
      task.mangaSeries?.title ||
      task.chapter?.seriesTitle ||
      task.page?.chapter?.mangaSeries?.title ||
      task.hitbox?.page?.chapter?.mangaSeries?.title ||
      ""
    ).trim().toLowerCase();

    if (taskSeriesTitle) return approvedTitles.has(taskSeriesTitle);

    // Backend task DTOs sometimes do not expose the series relation.
    // Do not hide all Tantou Kanban tasks in that case; only exclude clearly non-reviewable work.
    const status = normalizeTaskStatus(task.status || task.taskStatus || task.state || task.reviewStatus);
    return !["DRAFT", "CANCELLED", "REJECTED", "ARCHIVED"].includes(status);
  }

  function clampPercent(value, min = 0, max = 100) {
    const n = Number.parseFloat(value);
    if (Number.isNaN(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  function pctValue(source = {}, keys = [], fallback = 12) {
    for (const key of keys) {
      if (source[key] !== undefined && source[key] !== null && source[key] !== "") {
        return clampPercent(source[key], 0, 100);
      }
    }
    return fallback;
  }


  function shell(title, subtitle, actionHtml = "") {
    const content = $(".content-padding");
    if (!content) return null;
    content.innerHTML = `
      <div class="page-header">
        <div><h1>${title}</h1><p>${subtitle}</p></div>
        <div class="integration-actions">${actionHtml}</div>
      </div>
      <div id="integration-root"><div class="card-box api-loading">Loading backend data...</div></div>`;
    return $("#integration-root");
  }

  function errorBox(root, err, hint = "Check backend, JWT role permission, and Vite port 5173.") {
    if (!root) return;
    root.innerHTML = `<div class="card-box api-error"><h2>Backend connection failed</h2><p>${esc(err.message || err)}</p><small>${esc(hint)}</small></div>`;
  }

  function seriesPicker(selectedId = Api.getActiveSeriesId()) {
    if (!state.series.length) return "";
    return `<select id="series-picker" class="form-control compact-control">${state.series.map(s => {
      const id = seriesIdOf(s);
      return `<option value="${id}" ${String(id) === String(selectedId) ? "selected" : ""}>#${esc(id)} — ${esc(s.title || s.name || "Untitled")} (${esc(s.status || s.seriesStatus || "APPROVED")})</option>`;
    }).join("")}</select>`;
  }

  function chapterPicker(selectedId = Api.getActiveChapterId()) {
    if (!state.chapters.length) return "";
    return `<select id="chapter-picker" class="form-control compact-control">${state.chapters.map(ch => `<option value="${ch.id}" ${String(ch.id) === String(selectedId) ? "selected" : ""}>Ch.${esc(ch.chapterNumber)} — ${esc(ch.title || "Untitled")}</option>`).join("")}</select>`;
  }

  function pagePicker(selectedId = Api.getActivePageId()) {
    if (!state.pages.length) return "";
    return `<select id="page-picker" class="form-control compact-control">${state.pages.map(p => `<option value="${p.id}" ${String(p.id) === String(selectedId) ? "selected" : ""}>Page ${esc(p.pageNumber || p.id)}</option>`).join("")}</select>`;
  }

  async function loadSeries() {
    if (isTantouPage()) {
      state.series = await loadTantouApprovedSeries();
      if (state.series.length && !Api.getActiveSeriesId()) Api.setActiveSeriesId(seriesIdOf(state.series[0]));
      return state.series;
    }

    try {
      state.series = Api.unwrapPage ? Api.unwrapPage(await Api.allSeries()) : await Api.allSeries();
    } catch (err) {
      // Mangaka-only fallback if backend role does not allow global listing.
      state.series = Api.unwrapPage ? Api.unwrapPage(await Api.mySeries()) : await Api.mySeries();
    }
    if (state.series.length && !Api.getActiveSeriesId()) Api.setActiveSeriesId(seriesIdOf(state.series[0]));
    return state.series;
  }

  async function hydrateSeriesContext() {
    await loadSeries();
    let seriesId = Api.getActiveSeriesId();
    if (!state.series.some(s => String(seriesIdOf(s)) === String(seriesId)) && state.series[0]) {
      seriesId = seriesIdOf(state.series[0]);
      Api.setActiveSeriesId(seriesId);
    }
    if (seriesId) {
      state.chapters = await Api.chapters(seriesId).catch(() => []);
      if (state.chapters.length && !Api.getActiveChapterId()) Api.setActiveChapterId(state.chapters[0].id);
      let chapterId = Api.getActiveChapterId() || state.chapters[0]?.id || "";
      if (chapterId) {
        state.pages = await Api.pages(chapterId).catch(() => []);
        if (state.pages.length && !Api.getActivePageId()) Api.setActivePageId(state.pages[0].id);
      }
    }
  }

  function bindCommonPickers(reload) {
    $("#series-picker")?.addEventListener("change", async (e) => {
      Api.setActiveSeriesId(e.target.value);
      localStorage.removeItem("activeChapterId");
      localStorage.removeItem("activePageId");
      await reload();
    });
    $("#chapter-picker")?.addEventListener("change", async (e) => {
      Api.setActiveChapterId(e.target.value);
      localStorage.removeItem("activePageId");
      await reload();
    });
    $("#page-picker")?.addEventListener("change", async (e) => {
      Api.setActivePageId(e.target.value);
      await reload();
    });
  }


  function taskIdOf(task) {
    return task?.id ?? task?.taskId;
  }

  function taskTitleOf(task) {
    return task?.title || task?.description || `Task #${taskIdOf(task) || "—"}`;
  }

  function normalizeTaskStatus(status) {
    return Api.normalizeTaskStatus ? Api.normalizeTaskStatus(status) : String(status || "TODO").toUpperCase();
  }


  function renderTantouKanbanPreview(tasks = []) {
    const statuses = ["TODO", "DOING", "REVIEWING", "APPROVED"];

    return `
      <div class="card-box tantou-dashboard-action-card">
        <div>
          <h2>Kanban Tasks</h2>
          <p class="muted-note">Task workflow preview from Mangaka-approved series.</p>
        </div>
        <a class="btn-publish" href="tantou-dashboard.html#kanban"><i class="fa-solid fa-table-columns"></i> Open Kanban Tasks</a>
      </div>

      <div class="tantou-kanban-preview">
        ${statuses.map(status => {
          const items = tasks.filter(task => normalizeTaskStatus(task.status) === status);
          const label = status === "TODO" ? "Todo" : status === "DOING" ? "Doing" : status === "REVIEWING" ? "Reviewing" : "Approved";
          return `
            <div class="tantou-kanban-preview-column">
              <div class="tantou-kanban-preview-title">${label} <span>${items.length}</span></div>
              <div class="tantou-kanban-preview-list">
                ${items.slice(0, 4).map(task => `
                  <div class="tantou-kanban-preview-card">
                    <strong>${esc(taskTitleOf(task))}</strong>
                    <small>${esc(task.assigneeName || task.assistantName || "Unassigned")} · ${esc(normalizeTaskStatus(task.status))}</small>
                  </div>
                `).join("") || `<div class="empty-column">No ${esc(label.toLowerCase())} tasks</div>`}
              </div>
            </div>`;
        }).join("")}
      </div>`;
  }

  function renderTantouKanban(root, tasks = []) {
    const statuses = ["TODO", "DOING", "REVIEWING", "APPROVED"];

    root.innerHTML = `
      <div class="tantou-dashboard-tabs">
        <a href="tantou-dashboard.html" class="btn-outline"><i class="fa-solid fa-border-all"></i> Dashboard Overview</a>
        <button class="btn-publish" id="refresh-tantou-kanban"><i class="fa-solid fa-rotate"></i> Refresh Kanban</button>
      </div>
      <div class="backend-kanban tantou-dashboard-kanban">
        ${statuses.map(status => {
          const items = tasks.filter(task => normalizeTaskStatus(task.status) === status);
          return `
            <div class="kanban-column" data-status="${status}">
              <h3>${status === "TODO" ? "Todo" : status === "DOING" ? "Doing" : status === "REVIEWING" ? "Reviewing" : "Approved"} <span id="tantou-count-${status}">${items.length}</span></h3>
              <div class="kanban-drop" id="tantou-col-${status}">
                ${items.map(task => {
                  const id = taskIdOf(task);
                  const title = taskTitleOf(task);
                  const submitted = task.submittedImageUrl || task.submissionUrl || "";
                  return `<div class="kanban-card backend-task-card" draggable="true" data-id="${esc(id)}">
                    <strong>${esc(title)}</strong>
                    <p>${esc(task.description || "")}</p>
                    <small>${esc(task.assigneeName || task.assistantName || "Unassigned")} · ${esc(normalizeTaskStatus(task.status))}</small>
                    ${submitted ? `<a class="btn-outline mini-btn tantou-open-submission" href="${esc(submitted)}" target="_blank" rel="noopener"><i class="fa-solid fa-image"></i> Open submission</a>` : ""}
                  </div>`;
                }).join("") || `<div class="empty-column">Drop tasks here</div>`}
              </div>
            </div>`;
        }).join("")}
      </div>`;

    $("#refresh-tantou-kanban")?.addEventListener("click", () => {
      location.hash = "kanban";
      tantouDashboard();
    });

    $$(".backend-task-card").forEach(card => {
      card.addEventListener("dragstart", event => {
        event.dataTransfer.setData("text/plain", card.dataset.id);
      });
    });

    $$(".kanban-column").forEach(column => {
      const drop = column.querySelector(".kanban-drop");
      const status = column.dataset.status;

      drop.addEventListener("dragover", event => {
        event.preventDefault();
        drop.classList.add("drag-over");
      });

      drop.addEventListener("dragleave", () => drop.classList.remove("drag-over"));

      drop.addEventListener("drop", async event => {
        event.preventDefault();
        drop.classList.remove("drag-over");

        const taskId = event.dataTransfer.getData("text/plain");
        if (!taskId) return;

        try {
          await Api.updateTaskStatus(taskId, status);
          toast("Task status updated.", "success");
          location.hash = "kanban";
          await tantouDashboard();
        } catch (err) {
          toast(err.message, "error");
        }
      });
    });
  }


  function scheduleRisk(deadline = {}) {
    const explicit = deadline.warningLevel || deadline.risk || deadline.status;
    if (explicit) return explicit;

    const raw = deadline.deadlineDate || deadline.deadlineDateStr || deadline.date;
    if (!raw) return "Normal";

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(raw);
    if (Number.isNaN(target.getTime())) return "Normal";
    target.setHours(0, 0, 0, 0);

    const days = Math.round((target - today) / 86400000);
    if (days < 0) return "Overdue";
    if (days <= 2) return "High";
    if (days <= 7) return "Medium";
    return "Normal";
  }

  function renderReadOnlyScheduleTables(schedules = [], deadlines = [], activeSeries = null) {
    const seriesTitle = activeSeries?.title || activeSeries?.name || "Selected series";

    return `
      <div class="role-readonly-schedule-shell">
        <div class="board-filter-note readonly-schedule-note">
          <i class="fa-solid fa-lock"></i>
          View-only schedule. Mangaka owns publishing schedule editing; this role can only view calendar and deadlines.
        </div>

        <div class="readonly-schedule-tabs">
          <button type="button" class="readonly-schedule-tab active" data-readonly-tab="calendar"><i class="fa-solid fa-calendar-days"></i> Publishing Calendar</button>
          <button type="button" class="readonly-schedule-tab" data-readonly-tab="deadlines"><i class="fa-solid fa-triangle-exclamation"></i> Deadline Monitor</button>
        </div>

        <div id="readonly-calendar-panel" class="readonly-schedule-panel active">
          <div class="card-box">
            <div class="section-title-row">
              <h2>Publishing Calendar</h2>
              <span class="schedule-count">${schedules.length} schedules</span>
            </div>
            <p class="muted-note">Read-only publishing schedule for ${esc(seriesTitle)}.</p>
            <table class="data-table dashboard-schedule-table">
              <thead><tr><th>Publish Date</th><th>Frequency</th><th>Series</th><th>Permission</th></tr></thead>
              <tbody>
                ${schedules.map(sc => `
                  <tr>
                    <td>${fmtDate(sc.publishDate || sc.date || sc.scheduledDate)}</td>
                    <td>${esc(sc.frequency || sc.repeatType || "—")}</td>
                    <td>${esc(seriesTitle)}</td>
                    <td><span class="schedule-badge neutral">View only</span></td>
                  </tr>
                `).join("") || `<tr><td colspan="4">No schedule for selected series.</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>

        <div id="readonly-deadlines-panel" class="readonly-schedule-panel">
          <div class="card-box">
            <div class="section-title-row">
              <h2>Deadline Monitor</h2>
              <span class="schedule-count">${deadlines.length} deadlines</span>
            </div>
            <p class="muted-note">Read-only deadline warnings for ${esc(seriesTitle)}.</p>
            <table class="data-table dashboard-schedule-table">
              <thead><tr><th>Task/Event</th><th>Deadline</th><th>Risk</th><th>Permission</th></tr></thead>
              <tbody>
                ${deadlines.map(d => `
                  <tr>
                    <td>${esc(d.eventName || d.title || "Untitled deadline")}</td>
                    <td>${fmtDate(d.deadlineDate || d.deadlineDateStr || d.date)}</td>
                    <td>${badge(scheduleRisk(d))}</td>
                    <td><span class="schedule-badge neutral">View only</span></td>
                  </tr>
                `).join("") || `<tr><td colspan="4">No deadlines for selected series.</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;
  }

  function bindReadOnlyScheduleTabs() {
    $$(".readonly-schedule-tab").forEach(button => {
      button.addEventListener("click", () => {
        const tab = button.dataset.readonlyTab;
        $$(".readonly-schedule-tab").forEach(item => item.classList.toggle("active", item === button));
        $$(".readonly-schedule-panel").forEach(panel => panel.classList.toggle("active", panel.id === `readonly-${tab}-panel`));
      });
    });
  }

  function markScheduleNavActive() {
    const current = location.pathname.split("/").pop() + location.hash;
    $$(".nav-item").forEach(link => {
      const href = link.getAttribute("href") || "";
      const isSchedule = href.includes("#schedule") && current.includes("#schedule");
      if (isSchedule) link.classList.add("active");
      else if (current.includes("#schedule") && !href.includes("#schedule")) link.classList.remove("active");
    });
  }


  async function loadScheduleVisibleSeries(options = {}) {
    const lists = [];

    if (Api.allSeries) {
      try {
        const result = Api.unwrapPage
          ? Api.unwrapPage(await withApiTimeout(Api.allSeries(), "/manga-series"))
          : await withApiTimeout(Api.allSeries(), "/manga-series");
        if (Array.isArray(result) && result.length) lists.push(result);
      } catch (error) {
        console.warn("Could not load all series for read-only schedule:", error.message);
      }
    }

    if (!lists.length && Api.mySeries) {
      try {
        const result = Api.unwrapPage
          ? Api.unwrapPage(await withApiTimeout(Api.mySeries(), "/manga-series/my-series"))
          : await withApiTimeout(Api.mySeries(), "/manga-series/my-series");
        if (Array.isArray(result) && result.length) lists.push(result);
      } catch (error) {
        console.warn("Could not load my-series for read-only schedule:", error.message);
      }
    }

    if (!lists.length && typeof loadTantouApprovedSeries === "function" && isTantouPage()) {
      try {
        const result = await loadTantouApprovedSeries();
        if (Array.isArray(result) && result.length) lists.push(result);
      } catch (error) {
        console.warn("Could not load Tantou approved fallback for read-only schedule:", error.message);
      }
    }

    state.series = mergeSeriesById(...lists);

    const activeId = Api.getActiveSeriesId();
    if (state.series.length && !state.series.some(series => String(seriesIdOf(series)) === String(activeId))) {
      Api.setActiveSeriesId(seriesIdOf(state.series[0]));
      localStorage.removeItem("activeChapterId");
      localStorage.removeItem("activePageId");
    }

    return state.series;
  }

  async function renderRoleReadOnlySchedule(root, options = {}) {
    if (!root) return;

    await loadScheduleVisibleSeries(options);

    let seriesId = Api.getActiveSeriesId();
    if (!state.series.some(s => String(seriesIdOf(s)) === String(seriesId)) && state.series[0]) {
      seriesId = seriesIdOf(state.series[0]);
      Api.setActiveSeriesId(seriesId);
    }

    const activeSeries = state.series.find(s => String(seriesIdOf(s)) === String(seriesId)) || state.series[0] || null;

    if (!activeSeries || !seriesId) {
      root.innerHTML = `
        <div class="board-filter-note readonly-schedule-note">
          <i class="fa-solid fa-lock"></i> Schedule is view-only for this role.
        </div>
        <div class="card-box empty-state-box">No series available to display schedules.</div>`;
      markScheduleNavActive();
      return;
    }

    const [schedules, deadlines] = await Promise.all([
      withApiTimeout(Api.schedules(seriesId), `/schedules/${seriesId}`).catch(() => []),
      withApiTimeout(Api.deadlines(seriesId), `/deadlines/${seriesId}`).catch(() => [])
    ]);

    root.innerHTML = `
      <div class="toolbar-row">
        ${seriesPicker(seriesId)}
        <button id="readonly-schedule-refresh" class="btn-outline"><i class="fa-solid fa-rotate"></i> Refresh</button>
      </div>
      ${renderReadOnlyScheduleTables(schedules || [], deadlines || [], activeSeries)}
    `;

    bindCommonPickers(async () => {
      const reroot = $("#integration-root");
      await renderRoleReadOnlySchedule(reroot, options);
    });
    $("#readonly-schedule-refresh")?.addEventListener("click", async () => {
      await renderRoleReadOnlySchedule(root, options);
      toast("Schedule refreshed.", "success");
    });
    bindReadOnlyScheduleTabs();
    markScheduleNavActive();
  }


  async function tantouDashboard() {
    const isKanban = location.hash === "#kanban";
    const isSchedule = location.hash === "#schedule";
    const root = shell(
      isSchedule ? "Tantou Schedule" : (isKanban ? "Tantou Kanban Tasks" : "Tantou Dashboard"),
      isSchedule ? "View Mangaka-owned schedules and deadlines. Tantou Editor cannot edit them." : (isKanban ? "Manage review tasks directly inside the Tantou dashboard." : "Only Mangaka-approved series/pages are visible to Tantou Editor."),
      isSchedule
        ? `<a class="btn-outline" href="tantou-dashboard.html"><i class="fa-solid fa-border-all"></i> Dashboard Overview</a>`
        : (isKanban
          ? `<a class="btn-outline" href="tantou-dashboard.html"><i class="fa-solid fa-border-all"></i> Dashboard Overview</a>`
          : `<a class="btn-publish" href="tantou-review.html">Open Chapter Review</a><a class="btn-outline" href="tantou-dashboard.html#kanban" style="margin-left:10px;"><i class="fa-solid fa-table-columns"></i> Kanban Tasks</a><a class="btn-outline" href="tantou-dashboard.html#schedule" style="margin-left:10px;"><i class="fa-solid fa-calendar-days"></i> Schedule</a>`)
    );

    if (isSchedule) {
      await renderRoleReadOnlySchedule(root, { role: "tantou" });
      return;
    }

    try {
      await hydrateSeriesContext();
      if (!state.series.length) {
        root.innerHTML = `<div class="card-box empty-state-box tantou-approved-only-empty">
          <h2>No Mangaka-approved series/pages available.</h2>
          <p>Tantou Editor can only review pages after Mangaka approves them. Draft series and unfinished Assistant work are hidden.</p>
        </div>`;
        return;
      }
      state.tasks = (await Api.tasks().catch(() => [])).filter(taskBelongsToApprovedTantouSeries);

      const dashboardNav = $$(".tantou-nav .nav-item");
      dashboardNav.forEach(link => {
        const href = link.getAttribute("href") || "";
        link.classList.toggle("active", isKanban ? href.includes("#kanban") : href === "tantou-dashboard.html");
      });

      if (isKanban) {
        renderTantouKanban(root, state.tasks);
        return;
      }

      const pageFeedbacks = await Promise.all((state.pages || []).slice(0, 8).map(p => Api.feedbacks(p.id).catch(() => [])));
      const openFeedbacks = pageFeedbacks.flat().filter(f => !f.isResolved);
      const reviewing = state.series.filter(s => /review/i.test(s.status || "")).length;
      const ready = state.series.filter(s => /approved/i.test(s.status || "")).length;
      root.innerHTML = `
        <div class="toolbar-row">${seriesPicker()}${chapterPicker()}${pagePicker()}</div>
        <div class="stats-grid" style="margin-bottom:30px;">
          <div class="stat-card"><div class="stat-value">${state.tasks.length}</div><div class="stat-label">My Review Tasks</div></div>
          <div class="stat-card"><div class="stat-value">${openFeedbacks.length}</div><div class="stat-label">Open Feedback</div></div>
          <div class="stat-card"><div class="stat-value">${reviewing}</div><div class="stat-label">In Review</div></div>
          <div class="stat-card"><div class="stat-value">${ready}</div><div class="stat-label">Ready / Approved</div></div>
        </div>

        ${renderTantouKanbanPreview(state.tasks)}

        <div class="card-box tantou-approved-series-card">
          <div class="section-title-row">
            <h2>Approved Series Queue</h2>
            <span class="schedule-count">${state.series.length} series</span>
          </div>
          ${state.series.map(s => `<div class="list-card"><div class="list-card-content"><h2 class="list-card-title">${esc(s.title)}</h2><p class="list-card-meta">${esc(s.genre || "No genre")} • ${badge(s.status)} • Mangaka: ${esc(s.mangakaName || "—")}</p></div><button class="btn-icon-only set-series" data-id="${s.id}" title="Open chapter review"><i class="fa-solid fa-arrow-right"></i></button></div>`).join("") || `<div class="empty-state-box">No manga series returned by backend.</div>`}
        </div>`;
      $$(".set-series").forEach(btn => btn.addEventListener("click", () => { Api.setActiveSeriesId(btn.dataset.id); location.href = "tantou-review.html"; }));
      bindCommonPickers(tantouDashboard);
    } catch (err) { errorBox(root, err); }
  }

  async function tantouFeedback() {
    const root = shell("Annotation & Feedback", "View pinned feedback visually, resolve notes, or open the pinned review workspace.");
    try {
      await hydrateSeriesContext();
      if (!state.series.length) {
        root.innerHTML = `<div class="card-box empty-state-box tantou-approved-only-empty">
          <h2>No Mangaka-approved pages available for Tantou feedback.</h2>
          <p>Only pages from Mangaka-approved series are visible here.</p>
        </div>`;
        return;
      }
      const pageId = Api.getActivePageId() || state.pages[0]?.id;
      let canvas = null;

      if (pageId) {
        canvas = await Api.canvasInit(pageId).catch(async () => {
          const p = state.pages.find(item => String(item.id) === String(pageId));
          return p ? { pageId: p.id, imageUrl: p.imageUrl, originalWidth: p.width || 1000, originalHeight: p.height || 1400 } : null;
        });
      }

      state.feedbacks = pageId ? await Api.feedbacks(pageId).catch(() => []) : [];

      const openFeedbacks = state.feedbacks.filter(f => !f.isResolved);
      const resolvedFeedbacks = state.feedbacks.filter(f => f.isResolved);

      const pinnedPreview = canvas?.imageUrl ? `
        <div class="annotation-preview-stage">
          <div class="annotation-preview-image-wrap">
            <img src="${esc(canvas.imageUrl)}" alt="Selected manga page">
            ${state.feedbacks.map((f, i) => {
              const x = pctValue(f, ["xCoord", "x", "xPercent"], 10);
              const y = pctValue(f, ["yCoord", "y", "yPercent"], 10);
              const w = pctValue(f, ["width", "w", "widthPercent"], 12);
              const h = pctValue(f, ["height", "h", "heightPercent"], 8);
              const resolved = f.isResolved ? "resolved" : "open";
              return `
                <button type="button"
                  class="annotation-preview-region ${resolved}"
                  data-feedback-id="${esc(f.id)}"
                  style="left:${x}%;top:${y}%;width:${w}%;height:${h}%;"
                  title="${esc(f.content)}">
                  <span>${i + 1}</span>
                </button>`;
            }).join("")}
          </div>
        </div>` : `<div class="empty-state-box">No page image selected. Choose a series, chapter, and page above.</div>`;

      const feedbackCards = state.feedbacks.map((f, i) => {
        const x = pctValue(f, ["xCoord", "x", "xPercent"], 0);
        const y = pctValue(f, ["yCoord", "y", "yPercent"], 0);
        const w = pctValue(f, ["width", "w", "widthPercent"], 0);
        const h = pctValue(f, ["height", "h", "heightPercent"], 0);
        return `
          <div class="annotation-feedback-card" data-feedback-id="${esc(f.id)}">
            <div class="annotation-feedback-index">${i + 1}</div>
            <div class="annotation-feedback-body">
              <div class="annotation-feedback-top">
                <strong>#${esc(f.id || i + 1)} ${f.isResolved ? badge("Resolved") : badge("Open")}</strong>
                <span>X ${x.toFixed(1)}% · Y ${y.toFixed(1)}% · W ${w.toFixed(1)}% · H ${h.toFixed(1)}%</span>
              </div>
              <p>${esc(f.content || "No feedback text.")}</p>
              <div class="annotation-feedback-actions">
                ${f.isResolved ? `<span class="muted-note">Already resolved</span>` : `<button class="btn-outline resolve-feedback" data-id="${f.id}">Resolve</button>`}
              </div>
            </div>
          </div>`;
      }).join("") || `<div class="empty-state-box">No pinned feedback found for this page. Use Chapter Review to add one.</div>`;

      root.innerHTML = `
        <div class="toolbar-row">
          ${seriesPicker()}${chapterPicker()}${pagePicker()}
          <a class="btn-publish" href="tantou-review.html"><i class="fa-solid fa-plus"></i> Add Feedback in Chapter Review</a>
        </div>

        <div class="annotation-summary-row">
          <div class="annotation-summary-card"><strong>${state.feedbacks.length}</strong><span>Total pinned notes</span></div>
          <div class="annotation-summary-card warning"><strong>${openFeedbacks.length}</strong><span>Open</span></div>
          <div class="annotation-summary-card success"><strong>${resolvedFeedbacks.length}</strong><span>Resolved</span></div>
        </div>

        <div class="annotation-feedback-layout">
          <div class="card-box annotation-preview-card">
            <div class="section-title-row">
              <h3>Pinned Review Preview</h3>
              ${badge(pageId ? `Page #${pageId}` : "No page")}
            </div>
            ${pinnedPreview}
            <small class="muted-note">Pinned areas from Tantou feedback are shown on the manga page. Red = open, green = resolved.</small>
          </div>

          <div class="card-box annotation-list-card">
            <div class="section-title-row">
              <h3>Feedback Thread</h3>
              <span class="status-tag progress">${state.feedbacks.length}</span>
            </div>
            <div class="annotation-feedback-list">${feedbackCards}</div>
          </div>
        </div>`;

      bindCommonPickers(tantouFeedback);

      $$(".annotation-preview-region").forEach(region => {
        region.addEventListener("click", () => {
          const card = $(`.annotation-feedback-card[data-feedback-id="${region.dataset.feedbackId}"]`);
          if (!card) return;
          card.scrollIntoView({ behavior: "smooth", block: "center" });
          card.classList.add("highlight");
          setTimeout(() => card.classList.remove("highlight"), 1200);
        });
      });

      $$(".annotation-feedback-card").forEach(card => {
        card.addEventListener("mouseenter", () => {
          const region = $(`.annotation-preview-region[data-feedback-id="${card.dataset.feedbackId}"]`);
          region?.classList.add("focus");
        });
        card.addEventListener("mouseleave", () => {
          const region = $(`.annotation-preview-region[data-feedback-id="${card.dataset.feedbackId}"]`);
          region?.classList.remove("focus");
        });
      });

      $$(".resolve-feedback").forEach(btn => btn.addEventListener("click", async () => {
        try {
          await Api.resolveFeedback(btn.dataset.id);
          toast("Feedback resolved.", "success");
          tantouFeedback();
        } catch (err) { toast(err.message, "error"); }
      }));
    } catch (err) { errorBox(root, err); }
  }

  async function tantouReview() {
    const root = shell("Chapter Review & Hitbox Feedback", "Select a backend page, click the manga preview, and create coordinate-based Tantou feedback.");
    try {
      await hydrateSeriesContext();
      if (!state.series.length) {
        root.innerHTML = `<div class="card-box empty-state-box tantou-approved-only-empty">
          <h2>No Mangaka-approved pages available for chapter review.</h2>
          <p>Tantou Editor can only create feedback after Mangaka approves the series/pages.</p>
        </div>`;
        return;
      }
      const pageId = Api.getActivePageId() || state.pages[0]?.id;
      let canvas = null;
      if (pageId) canvas = await Api.canvasInit(pageId).catch(async () => {
        const p = state.pages.find(item => String(item.id) === String(pageId));
        return p ? { pageId: p.id, imageUrl: p.imageUrl, originalWidth: p.width || 1000, originalHeight: p.height || 1400, hitboxes: [] } : null;
      });
      state.feedbacks = pageId ? await Api.feedbacks(pageId).catch(() => []) : [];

      const firstFeedback = state.feedbacks[0] || {};
      const initialX = pctValue(firstFeedback, ["xCoord", "x", "xPercent"], 12);
      const initialY = pctValue(firstFeedback, ["yCoord", "y", "yPercent"], 12);
      const initialW = pctValue(firstFeedback, ["width", "w", "widthPercent"], 20);
      const initialH = pctValue(firstFeedback, ["height", "h", "heightPercent"], 12);
      const draftLabel = state.feedbacks.length ? state.feedbacks.length + 1 : 1;

      const previewHtml = canvas?.imageUrl ? `
              <div id="tantou-stage" class="tantou-canvas-stage">
                <img src="${esc(canvas.imageUrl)}" alt="Manga page">
                ${state.feedbacks.map((f, i) => {
                  const x = Math.min(100, Math.max(0, pctValue(f, ["xCoord", "x", "xPercent"], 10)));
                  const y = Math.min(100, Math.max(0, pctValue(f, ["yCoord", "y", "yPercent"], 10)));
                  const w = pctValue(f, ["width", "w", "widthPercent"], 20);
                  const h = pctValue(f, ["height", "h", "heightPercent"], 12);
                  return `
                    <div class="tantou-feedback-region saved-feedback-region" style="left:${x}%;top:${y}%;width:${w}%;height:${h}%;" title="${esc(f.content)}"></div>
                    <button type="button" class="annotation-dot saved-annotation-dot" data-x="${x}" data-y="${y}" data-w="${w}" data-h="${h}" data-content="${esc(f.content)}" style="left:${x}%;top:${y}%;" title="${esc(f.content)}">${i + 1}</button>
                  `;
                }).join("")}
                <div id="draft-feedback-region" class="tantou-feedback-region active-feedback-region" style="left:${initialX}%;top:${initialY}%;width:${initialW}%;height:${initialH}%;" title="Current feedback area"></div>
                <button type="button" id="draft-feedback-dot" class="annotation-dot active-annotation-dot" style="left:${initialX}%;top:${initialY}%;" title="Current feedback cursor">${draftLabel}</button>
              </div>` : `<div class="empty-state-box">Upload pages through Mangaka Batch Upload before review.</div>`;

      root.innerHTML = `
        <div class="toolbar-row">${seriesPicker()}${chapterPicker()}${pagePicker()}</div>
        <div class="review-container integration-review-grid">
          <div class="review-col">
            <div class="review-col-header"><span>Backend Page Preview</span>${badge(pageId ? `Page #${pageId}` : "No page")}</div>
            <div id="tantou-preview" class="preview-panel api-canvas-preview">${previewHtml}</div>
            <small class="muted-note">Click the manga image, drag the numbered cursor, or edit X/Y fields to move the feedback marker.</small>
          </div>
          <div class="review-col">
            <div class="review-col-header"><span>Feedback Thread</span><span id="chat-count-badge" class="status-tag progress">${state.feedbacks.length}</span></div>
            <div id="chat-box" class="chat-area compact-chat">
              ${state.feedbacks.map(f => `<div class="chat-msg"><div class="chat-avatar">TE</div><div class="chat-msg-body"><div class="chat-name">Tantou Editor <span class="chat-time">${fmtDate(f.createdAt)}</span></div><div class="chat-bubble">${esc(f.content)}</div></div></div>`).join("") || `<div class="empty-state-box">No feedback yet.</div>`}
            </div>
            <form id="feedback-form" class="feedback-form">
              <div class="form-row"><div class="form-group"><label>X %</label><input class="form-control" id="fb-x" type="number" min="0" max="100" step="0.01" value="${initialX}"></div><div class="form-group"><label>Y %</label><input class="form-control" id="fb-y" type="number" min="0" max="100" step="0.01" value="${initialY}"></div></div>
              <div class="form-row"><div class="form-group"><label>W %</label><input class="form-control" id="fb-w" type="number" min="1" max="100" step="0.01" value="${initialW}"></div><div class="form-group"><label>H %</label><input class="form-control" id="fb-h" type="number" min="1" max="100" step="0.01" value="${initialH}"></div></div>
              <div class="form-group"><label>Feedback</label><textarea class="form-control" id="fb-content" placeholder="Write feedback for Mangaka..." required></textarea></div>
              <button class="btn-publish" type="submit">Send Feedback</button>
              <button id="send-revision" type="button" class="btn-outline">Mark Series Reviewing</button>
            </form>
          </div>
        </div>`;
      bindCommonPickers(tantouReview);

      const stage = $("#tantou-stage");
      const draftDot = $("#draft-feedback-dot");
      const draftRegion = $("#draft-feedback-region");
      const xInput = $("#fb-x");
      const yInput = $("#fb-y");
      const wInput = $("#fb-w");
      const hInput = $("#fb-h");
      const contentInput = $("#fb-content");

      function getBoxValues() {
        const safeNumber = (value, fallback) => {
          const n = Number.parseFloat(value);
          return Number.isFinite(n) ? n : fallback;
        };

        const x = clampPercent(safeNumber(xInput?.value, 0), 0, 100);
        const y = clampPercent(safeNumber(yInput?.value, 0), 0, 100);
        const rawWidth = Math.max(1, safeNumber(wInput?.value, 1));
        const rawHeight = Math.max(1, safeNumber(hInput?.value, 1));
        const width = Math.max(1, Math.min(100 - x, rawWidth));
        const height = Math.max(1, Math.min(100 - y, rawHeight));

        return { x, y, width, height };
      }

      function updateFeedbackArea(updateInputs = false) {
        const box = getBoxValues();

        if (draftDot) {
          draftDot.style.left = `${box.x}%`;
          draftDot.style.top = `${box.y}%`;
        }

        if (draftRegion) {
          draftRegion.style.left = `${box.x}%`;
          draftRegion.style.top = `${box.y}%`;
          draftRegion.style.width = `${box.width}%`;
          draftRegion.style.height = `${box.height}%`;
        }

        if (updateInputs) {
          xInput.value = box.x.toFixed(2);
          yInput.value = box.y.toFixed(2);
          wInput.value = box.width.toFixed(2);
          hInput.value = box.height.toFixed(2);
        }
      }

      function moveDraftDot(x, y, updateInputs = true) {
        const nextX = clampPercent(x, 0, 100);
        const nextY = clampPercent(y, 0, 100);
        if (updateInputs) {
          xInput.value = nextX.toFixed(2);
          yInput.value = nextY.toFixed(2);
        }
        updateFeedbackArea(false);
      }

      function setDraftFromPointer(event) {
        if (!stage) return;
        const rect = stage.getBoundingClientRect();
        const x = (((event.clientX - rect.left) / rect.width) * 100);
        const y = (((event.clientY - rect.top) / rect.height) * 100);
        moveDraftDot(x, y, true);
      }

      stage?.addEventListener("click", (e) => {
        const savedDot = e.target.closest(".saved-annotation-dot");
        if (savedDot) {
          moveDraftDot(savedDot.dataset.x, savedDot.dataset.y, true);
          if (wInput) wInput.value = savedDot.dataset.w || wInput.value;
          if (hInput) hInput.value = savedDot.dataset.h || hInput.value;
          updateFeedbackArea(false);
          if (contentInput && savedDot.dataset.content) contentInput.value = savedDot.dataset.content;
          return;
        }
        setDraftFromPointer(e);
      });

      let draggingMarker = false;
      draftDot?.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        draggingMarker = true;
        draftDot.setPointerCapture?.(e.pointerId);
      });
      draftDot?.addEventListener("pointermove", (e) => {
        if (!draggingMarker) return;
        setDraftFromPointer(e);
      });
      draftDot?.addEventListener("pointerup", () => { draggingMarker = false; });
      draftDot?.addEventListener("lostpointercapture", () => { draggingMarker = false; });

      [xInput, yInput, wInput, hInput].forEach(input => input?.addEventListener("input", () => {
        updateFeedbackArea(false);
      }));

      [xInput, yInput, wInput, hInput].forEach(input => input?.addEventListener("change", () => {
        updateFeedbackArea(true);
      }));

      updateFeedbackArea(true);

      $("#feedback-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!pageId) return toast("No page selected.", "error");
        try {
          const box = getBoxValues();
          await Api.createFeedback(pageId, { x: box.x, y: box.y, width: box.width, height: box.height, content: $("#fb-content").value });
          toast("Feedback saved to backend.", "success");
          tantouReview();
        } catch (err) { toast(err.message, "error"); }
      });
      $("#send-revision")?.addEventListener("click", async () => {
        try { await Api.updateSeriesStatus(Api.getActiveSeriesId(), "REVIEWING"); toast("Series moved to REVIEWING for board.", "success"); }
        catch (err) { toast(err.message, "error"); }
      });
    } catch (err) { errorBox(root, err); }
  }

  async function tantouRevision() {
    const root = shell("Revision Tracking", "Review current backend pages and feedback resolution before sending to board.");
    try {
      await hydrateSeriesContext();
      if (!state.series.length) {
        root.innerHTML = `<div class="card-box empty-state-box tantou-approved-only-empty">
          <h2>No Mangaka-approved pages available for revision tracking.</h2>
          <p>Draft/non-approved series are hidden from Tantou Editor.</p>
        </div>`;
        return;
      }
      const pageCards = await Promise.all(state.pages.map(async p => {
        const fb = await Api.feedbacks(p.id).catch(() => []);
        return `<div class="list-card"><div class="list-card-img">${p.imageUrl ? `<img src="${esc(p.imageUrl)}" alt="Page ${p.pageNumber}">` : `<i class="fa-solid fa-image"></i>`}</div><div class="list-card-content"><h2 class="list-card-title">Page ${esc(p.pageNumber || p.id)}</h2><p class="list-card-meta">${fb.length} feedback item(s), ${fb.filter(x => x.isResolved).length} resolved</p></div><button class="btn-icon-only choose-page" data-id="${p.id}"><i class="fa-solid fa-arrow-right"></i></button></div>`;
      }));
      root.innerHTML = `<div class="toolbar-row">${seriesPicker()}${chapterPicker()}${pagePicker()}</div><div class="card-box">${pageCards.join("") || `<div class="empty-state-box">No pages available for selected chapter.</div>`}<button id="prepare-report" class="btn-publish"><i class="fa-solid fa-file-lines"></i> Prepare for Editorial Report</button></div>`;
      bindCommonPickers(tantouRevision);
      $$(".choose-page").forEach(btn => btn.addEventListener("click", () => { Api.setActivePageId(btn.dataset.id); location.href = "tantou-feedback.html"; }));
      $("#prepare-report")?.addEventListener("click", () => {
        const seriesId = Api.getActiveSeriesId();
        if (seriesId) {
          localStorage.setItem(`tantouPreparedReport:${seriesId}`, "true");
          localStorage.setItem(`tantouPreparedReportAt:${seriesId}`, new Date().toISOString());
        }

        // Do not call APPROVED -> REVIEWING here.
        // Backend rejects that transition. This action only prepares the report page.
        toast("Prepared for Editorial Report.", "success");
        location.href = "tantou-report.html";
      });
    } catch (err) { errorBox(root, err); }
  }

  async function tantouReport() {
    const root = shell("Editorial Report", "Backend-ready report gate: move an approved/reviewed series into board voting flow.");
    try {
      await hydrateSeriesContext();
      if (!state.series.length) {
        root.innerHTML = `<div class="card-box empty-state-box tantou-approved-only-empty">
          <h2>No Mangaka-approved series available for report.</h2>
          <p>Tantou report can only be prepared after Mangaka-approved pages are available.</p>
        </div>`;
        return;
      }
      const s = state.series.find(x => String(seriesIdOf(x)) === String(Api.getActiveSeriesId())) || state.series[0];
      root.innerHTML = `
        <div class="toolbar-row">${seriesPicker()}</div>
        <div class="card-box" style="max-width:900px;">
          <h2>${esc(s?.title || "No series selected")}</h2>
          <p>${esc(s?.summary || "No summary")}</p>
          <table class="data-table"><tbody><tr><th>Genre</th><td>${esc(s?.genre || "—")}</td></tr><tr><th>Status</th><td>${badge(s?.status)}</td></tr><tr><th>Mangaka</th><td>${esc(s?.mangakaName || "—")}</td></tr><tr><th>Tantou</th><td>${esc(s?.tantouName || "—")}</td></tr></tbody></table>
          <div class="board-role-note tantou-note"><i class="fa-solid fa-circle-info"></i> Tantou can only recommend. Cancellation is decided by the Editorial Board.</div>
          <div class="form-group">
            <label>Tantou Recommendation</label>
            <select id="tantou-recommendation" class="form-control">
              <option value="CONTINUE">Recommend Continue</option>
              <option value="REVISION">Recommend Revision</option>
              <option value="CANCEL">Recommend Cancellation</option>
            </select>
          </div>
          <div class="form-group"><label>Recommendation Notes</label><textarea class="form-control" id="report-notes">Ready for board review after Tantou inspection.</textarea></div>
          <div class="report-action-row">
            <button id="send-back-mangaka" class="btn-outline danger-action" type="button"><i class="fa-solid fa-rotate-left"></i> Send Back to Mangaka</button>
            <button id="submit-board" class="btn-publish" type="button"><i class="fa-solid fa-paper-plane"></i> Submit to Editorial Board</button>
          </div>
          <p class="muted-note" id="report-status-note">Send back changes this series to REVISION_REQUESTED in the Tantou workflow.</p>
        </div>`;
      bindCommonPickers(tantouReport);
      $("#send-back-mangaka")?.addEventListener("click", async () => {
        const note = $("#report-notes")?.value || "";
        if (!confirm("Send this series back to Mangaka for further review?")) return;

        const button = $("#send-back-mangaka");
        const oldText = button?.innerHTML;
        if (button) {
          button.disabled = true;
          button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Sending back...`;
        }

        try {
          const result = await sendSeriesBackToMangaka(s, note);
          toast(result.backendUpdated ? "Sent back to Mangaka and backend status updated." : "Sent back to Mangaka in Tantou workflow. Backend status transition was not accepted, so a local revision status was saved.", result.backendUpdated ? "success" : "info");
          await tantouReport();
        } catch (err) {
          toast(err.message || "Could not send back to Mangaka.", "error");
        } finally {
          if (button) {
            button.disabled = false;
            button.innerHTML = oldText;
          }
        }
      });
      $("#submit-board")?.addEventListener("click", async () => {
        const seriesId = Api.getActiveSeriesId();
        const note = $("#report-notes")?.value || "";

        const recommendation = $("#tantou-recommendation")?.value || "CONTINUE";

        saveTantouBoardSubmission(seriesId, {
          note,
          recommendation,
          recommendationLabel: boardDecisionLabel(recommendation),
          seriesTitle: s?.title || s?.name || "",
          status: "TANTOU_APPROVED"
        });

        // Try backend transition only as a best-effort. The Board UI no longer depends on
        // generic APPROVED status; it depends on Tantou approval/submission.
        try {
          await Api.updateSeriesStatus(seriesId, "REVIEWING");
          toast("Submitted to Editorial Board queue.", "success");
        } catch (err) {
          console.warn("Backend did not accept board submission status transition; local Tantou approval was saved.", err.message);
          toast("Marked as Tantou-approved for Board voting.", "success");
        }
      });
    } catch (err) { errorBox(root, err); }
  }


  function getTantouBoardSubmissionStore() {
    try {
      return JSON.parse(localStorage.getItem("tantouBoardSubmittedSeries") || "{}");
    } catch (_) {
      return {};
    }
  }

  function saveTantouBoardSubmission(seriesId, data = {}) {
    if (!seriesId) return null;

    const store = getTantouBoardSubmissionStore();
    store[String(seriesId)] = {
      ...(store[String(seriesId)] || {}),
      status: "TANTOU_APPROVED",
      boardEligible: true,
      tantouApprovedForBoard: true,
      submittedToBoard: true,
      submittedAt: new Date().toISOString(),
      ...data
    };

    localStorage.setItem("tantouBoardSubmittedSeries", JSON.stringify(store));
    return store[String(seriesId)];
  }

  function getTantouBoardSubmission(seriesId) {
    if (!seriesId) return null;
    return getTantouBoardSubmissionStore()[String(seriesId)] || null;
  }

  function applyTantouBoardSubmission(series = {}) {
    const seriesId = seriesIdOf(series);
    const submitted = getTantouBoardSubmission(seriesId);
    if (!submitted) return series;

    return {
      ...series,
      status: submitted.status || series.status || "TANTOU_APPROVED",
      boardEligible: true,
      tantouApprovedForBoard: true,
      submittedToBoard: true,
      tantouSubmittedAt: submitted.submittedAt,
      tantouReportNote: submitted.note || series.tantouReportNote
    };
  }

  function isTantouBoardStatus(value) {
    const status = String(value || "").trim().toUpperCase().replace(/[\s-]+/g, "_");

    return [
      "TANTOU_APPROVED",
      "APPROVED_BY_TANTOU",
      "TANTOU_RECOMMENDED",
      "READY_FOR_BOARD",
      "READY_FOR_EDITORIAL_BOARD",
      "SUBMITTED_TO_BOARD",
      "SUBMITTED_TO_EDITORIAL_BOARD",
      "BOARD_QUEUE",
      "BOARD_REVIEW",
      "BOARD_REVIEWING",
      "EDITORIAL_BOARD",
      "EDITORIAL_BOARD_REVIEW",
      "VOTING",
      "IN_VOTING",
      "REVIEWING"
    ].includes(status);
  }

  function isSeriesApprovedByTantouForBoard(series = {}) {
    const seriesId = seriesIdOf(series);

    // If Tantou explicitly sent it back to Mangaka, it must not be votable.
    const returned = getTantouSeriesReturn(seriesId);
    if (returned?.returnedToMangaka) return false;

    // Tantou's Submit to Editorial Board action marks this local store.
    const submitted = getTantouBoardSubmission(seriesId);
    if (submitted?.submittedToBoard || submitted?.tantouApprovedForBoard || submitted?.boardEligible) return true;

    if (
      series.tantouApprovedForBoard === true ||
      series.approvedByTantou === true ||
      series.tantouApproved === true ||
      series.submittedToBoard === true ||
      series.boardEligible === true ||
      series.readyForBoard === true
    ) {
      return true;
    }

    return [
      series.status,
      series.seriesStatus,
      series.reviewStatus,
      series.publishStatus,
      series.approvalStatus,
      series.tantouStatus,
      series.boardStatus
    ].some(isTantouBoardStatus);
  }


  function getBoardDecisionStore() {
    try {
      return JSON.parse(localStorage.getItem("boardSeriesDecisions") || "{}");
    } catch (_) {
      return {};
    }
  }

  function saveBoardDecision(seriesId, decision, data = {}) {
    if (!seriesId) return null;

    const normalizedDecision = String(decision || "").trim().toUpperCase();
    const store = getBoardDecisionStore();
    store[String(seriesId)] = {
      ...(store[String(seriesId)] || {}),
      decision: normalizedDecision,
      status: boardDecisionStatus(normalizedDecision),
      decidedAt: new Date().toISOString(),
      decidedBy: "Editorial Board",
      ...data
    };

    localStorage.setItem("boardSeriesDecisions", JSON.stringify(store));
    return store[String(seriesId)];
  }

  function getBoardDecision(seriesId) {
    if (!seriesId) return null;
    return getBoardDecisionStore()[String(seriesId)] || null;
  }

  function getBoardDiscussionStore() {
    try {
      return JSON.parse(localStorage.getItem("boardDiscussionBySeries") || "{}");
    } catch (_) {
      return {};
    }
  }

  function saveBoardDiscussionStore(store) {
    localStorage.setItem("boardDiscussionBySeries", JSON.stringify(store || {}));
  }

  function getBoardDiscussion(seriesId) {
    if (!seriesId) return [];
    const store = getBoardDiscussionStore();
    return Array.isArray(store[String(seriesId)]) ? store[String(seriesId)] : [];
  }

  function currentBoardMemberName() {
    return localStorage.getItem("fullName") ||
      localStorage.getItem("name") ||
      localStorage.getItem("username") ||
      localStorage.getItem("email") ||
      "Board Member";
  }

  function currentUserInitials(name = currentBoardMemberName()) {
    return String(name || "BM")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0])
      .join("")
      .toUpperCase() || "BM";
  }

  function addBoardDiscussionMessage(seriesId, message) {
    const text = String(message || "").trim();
    if (!seriesId || !text) return null;

    const store = getBoardDiscussionStore();
    const key = String(seriesId);
    const list = Array.isArray(store[key]) ? store[key] : [];

    const saved = {
      id: `bd-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      seriesId: key,
      senderId: localStorage.getItem("userId") || localStorage.getItem("id") || "",
      senderName: currentBoardMemberName(),
      senderRole: "EDITORIAL_BOARD",
      message: text,
      createdAt: new Date().toISOString()
    };

    store[key] = [...list, saved];
    saveBoardDiscussionStore(store);
    return saved;
  }

  function renderBoardDiscussion(seriesId, { readOnly = false } = {}) {
    const messages = getBoardDiscussion(seriesId);

    return `
      <div class="card-box board-discussion-card ${readOnly ? "readonly" : ""}">
        <div class="board-discussion-header">
          <div>
            <h2>Board Discussion</h2>
            <p>${readOnly ? "Read-only discussion history for Admin audit." : "Discuss the series before submitting the Board decision."}</p>
          </div>
          <span class="status-tag progress">${messages.length}</span>
        </div>
        <div class="board-discussion-list" id="board-discussion-list">
          ${messages.length ? messages.map(msg => `
            <div class="board-discussion-message">
              <div class="board-discussion-avatar">${esc(currentUserInitials(msg.senderName))}</div>
              <div class="board-discussion-body">
                <div class="board-discussion-meta">
                  <strong>${esc(msg.senderName || "Board Member")}</strong>
                  <span>${esc(fmtDate(msg.createdAt))}</span>
                </div>
                <p>${esc(msg.message || "")}</p>
              </div>
            </div>
          `).join("") : `<div class="empty-state-box">No Board discussion yet.</div>`}
        </div>
        ${readOnly ? `
          <div class="board-filter-note"><i class="fa-solid fa-lock"></i> Admin can view this discussion, but cannot participate.</div>
        ` : `
          <form id="board-discussion-form" class="board-discussion-form">
            <textarea id="board-discussion-input" class="form-control" rows="3" placeholder="Add Board-only discussion note before voting..."></textarea>
            <button class="btn-publish" type="submit"><i class="fa-solid fa-paper-plane"></i> Send Discussion Message</button>
          </form>
        `}
      </div>
    `;
  }

  function bindBoardDiscussion(seriesId, refreshFn) {
    const form = $("#board-discussion-form");
    const input = $("#board-discussion-input");
    if (!form || !input) return;

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text) {
        toast("Write a discussion message first.", "error");
        return;
      }

      addBoardDiscussionMessage(seriesId, text);
      toast("Board discussion message saved.", "success");
      if (typeof refreshFn === "function") refreshFn();
    });
  }

  function boardDecisionStatus(decision) {
    switch (String(decision || "").toUpperCase()) {
      case "CONTINUE":
        return "BOARD_DECIDED_CONTINUE";
      case "REVISION":
        return "BOARD_REQUESTED_REVISION";
      case "CANCEL":
        return "BOARD_CANCELLED";
      default:
        return "BOARD_PENDING";
    }
  }

  function boardDecisionLabel(decision) {
    switch (String(decision || "").toUpperCase()) {
      case "CONTINUE":
        return "Continue Serialization";
      case "REVISION":
        return "Request Revision";
      case "CANCEL":
        return "Cancel Series";
      default:
        return "Waiting for Board Decision";
    }
  }

  function applyBoardDecision(series = {}) {
    const seriesId = seriesIdOf(series);
    const decision = getBoardDecision(seriesId);
    if (!decision) return series;

    return {
      ...series,
      boardDecision: decision.decision,
      boardDecisionStatus: decision.status,
      boardDecisionComment: decision.comment,
      boardDecidedAt: decision.decidedAt,
      status: decision.status || series.status
    };
  }

  function getAdminFinalizationStore() {
    try {
      return JSON.parse(localStorage.getItem("adminFinalizedBoardDecisions") || "{}");
    } catch (_) {
      return {};
    }
  }

  function saveAdminFinalization(seriesId, data = {}) {
    if (!seriesId) return null;
    const store = getAdminFinalizationStore();
    store[String(seriesId)] = {
      ...(store[String(seriesId)] || {}),
      finalizedAt: new Date().toISOString(),
      finalizedBy: "Admin",
      ...data
    };
    localStorage.setItem("adminFinalizedBoardDecisions", JSON.stringify(store));
    return store[String(seriesId)];
  }

  function getAdminFinalization(seriesId) {
    if (!seriesId) return null;
    return getAdminFinalizationStore()[String(seriesId)] || null;
  }

  function isBoardDecidedSeries(series = {}) {
    return Boolean(getBoardDecision(seriesIdOf(series)) || series.boardDecision || series.boardDecisionStatus);
  }

  async function loadBoardDecidedSeries() {
    try {
      state.series = Api.unwrapPage ? Api.unwrapPage(await Api.allSeries()) : await Api.allSeries();
    } catch (err) {
      state.series = [];
      console.warn("Could not load series for Admin finalization:", err.message);
    }

    state.series = mergeSeriesById(state.series)
      .map(applyTantouReturnOverride)
      .map(applyTantouBoardSubmission)
      .map(applyBoardDecision)
      .filter(isBoardDecidedSeries);

    const activeId = Api.getActiveSeriesId();
    if (state.series.length && !state.series.some(s => String(seriesIdOf(s)) === String(activeId))) {
      Api.setActiveSeriesId(seriesIdOf(state.series[0]));
    }

    return state.series;
  }


  async function loadBoardEligibleSeries() {
    try {
      state.series = Api.unwrapPage ? Api.unwrapPage(await Api.allSeries()) : await Api.allSeries();
    } catch (err) {
      state.series = [];
      console.warn("Could not load series for Board queue:", err.message);
    }

    state.series = mergeSeriesById(state.series)
      .map(applyTantouReturnOverride)
      .map(applyTantouBoardSubmission)
      .map(applyBoardDecision)
      .filter(isSeriesApprovedByTantouForBoard);

    const activeId = Api.getActiveSeriesId();

    if (state.series.length && !state.series.some(s => String(seriesIdOf(s)) === String(activeId))) {
      Api.setActiveSeriesId(seriesIdOf(state.series[0]));
      localStorage.removeItem("activeChapterId");
      localStorage.removeItem("activePageId");
    }

    return state.series;
  }

  async function hydrateBoardSeriesContext() {
    await loadBoardEligibleSeries();

    let seriesId = Api.getActiveSeriesId();
    if (!state.series.some(s => String(seriesIdOf(s)) === String(seriesId)) && state.series[0]) {
      seriesId = seriesIdOf(state.series[0]);
      Api.setActiveSeriesId(seriesId);
      localStorage.removeItem("activeChapterId");
      localStorage.removeItem("activePageId");
    }

    state.chapters = [];
    state.pages = [];

    if (seriesId) {
      state.chapters = await Api.chapters(seriesId).catch(() => []);
      if (state.chapters.length && !state.chapters.some(ch => String(ch.id) === String(Api.getActiveChapterId()))) {
        Api.setActiveChapterId(state.chapters[0].id);
      }

      const chapterId = Api.getActiveChapterId() || state.chapters[0]?.id || "";
      if (chapterId) {
        state.pages = await Api.pages(chapterId).catch(() => []);
        if (state.pages.length && !state.pages.some(p => String(p.id) === String(Api.getActivePageId()))) {
          Api.setActivePageId(state.pages[0].id);
        }
      }
    }
  }


  async function boardDashboard() {
    const isSchedule = location.hash === "#schedule";
    const root = shell(
      isSchedule ? "Board Schedule" : "Board Dashboard",
      isSchedule ? "View publishing schedules and deadlines. Editorial Board cannot edit them." : "Editorial Board submission queue and vote status from /votes.",
      isSchedule ? `<a class="btn-outline" href="board-dashboard.html"><i class="fa-solid fa-border-all"></i> Dashboard Overview</a>` : `<a class="btn-publish" href="board-submissions.html">Open Submissions</a><a class="btn-outline" href="board-dashboard.html#schedule" style="margin-left:10px;"><i class="fa-solid fa-calendar-days"></i> Schedule</a>`
    );
    if (isSchedule) {
      try { await renderRoleReadOnlySchedule(root, { role: "board" }); } catch (err) { errorBox(root, err); }
      return;
    }
    try {
      const boardEligible = await loadBoardEligibleSeries();
      const summaries = await Promise.all(boardEligible.map(s => Api.voteSummary(seriesIdOf(s)).catch(() => ({ seriesId: seriesIdOf(s), totalVotes: 0, approvedVotes: 0, rejectedVotes: 0 }))));
      root.innerHTML = `
        <div class="board-filter-note"><i class="fa-solid fa-lock"></i> Board can only vote on series submitted/approved by Tantou Editor.</div>
        <div class="stats-grid" style="margin-bottom:30px;"><div class="stat-card"><div class="stat-value">${boardEligible.length}</div><div class="stat-label">Tantou-approved submissions</div></div><div class="stat-card"><div class="stat-value">${summaries.reduce((a,b)=>a+(b.totalVotes||0),0)}</div><div class="stat-label">Votes Cast</div></div><div class="stat-card"><div class="stat-value">${summaries.filter(x => (x.totalVotes||0) === 0).length}</div><div class="stat-label">Needs Vote</div></div><div class="stat-card"><div class="stat-value">${summaries.reduce((a,b)=>a+(b.rejectedVotes||0),0)}</div><div class="stat-label">Reject / Revision Votes</div></div></div>
        <div class="card-box">${boardEligible.map((s, i) => `<div class="list-card"><div class="list-card-content"><h2 class="list-card-title">${esc(s.title)}</h2><p class="list-card-meta">${badge(s.status || "TANTOU_APPROVED")} • Approve ${summaries[i]?.approvedVotes || 0} / Reject ${summaries[i]?.rejectedVotes || 0}</p></div><button class="btn-icon-only set-series" data-id="${seriesIdOf(s)}"><i class="fa-solid fa-arrow-right"></i></button></div>`).join("") || `<div class="empty-state-box">No Tantou-approved series waiting for Board voting.</div>`}</div>`;
      $$(".set-series").forEach(btn => btn.addEventListener("click", () => { Api.setActiveSeriesId(btn.dataset.id); location.href = "board-submissions.html"; }));
    } catch (err) { errorBox(root, err, "The all-series endpoint requires the patched backend included in this package."); }
  }

  async function boardSubmissions() {
    const root = shell("Board Submissions", "Review manga metadata, chapters, and current vote summary before voting.", `<a class="btn-publish" href="board-voting.html">Start Voting</a>`);
    try {
      await hydrateBoardSeriesContext();

      if (!state.series.length) {
        root.innerHTML = `<div class="board-filter-note"><i class="fa-solid fa-lock"></i> Board voting is locked until Tantou Editor submits a series to the Editorial Board.</div><div class="card-box empty-state-box">No Tantou-approved series waiting for Board voting.</div>`;
        return;
      }

      const seriesId = Api.getActiveSeriesId();
      const s = state.series.find(x => String(seriesIdOf(x)) === String(seriesId)) || state.series[0];
      const actualSeriesId = seriesIdOf(s);
      const summary = actualSeriesId ? await Api.voteSummary(actualSeriesId).catch(() => null) : null;
      root.innerHTML = `
        <div class="board-filter-note"><i class="fa-solid fa-lock"></i> Only Tantou-approved/submitted series are available here.</div>
        <div class="toolbar-row">${seriesPicker(actualSeriesId)}${chapterPicker()}</div>
        <div class="grid-layout">
          <div class="card-box"><h2>${esc(s?.title || "No series")}</h2><p>${esc(s?.summary || "No summary")}</p><table class="data-table"><thead><tr><th>Chapter</th><th>Title</th><th>Status</th></tr></thead><tbody>${state.chapters.map(ch => `<tr><td>${esc(ch.chapterNumber)}</td><td>${esc(ch.title)}</td><td>${badge(ch.publishStatus)}</td></tr>`).join("") || `<tr><td colspan="3">No chapters found.</td></tr>`}</tbody></table></div>
          <div class="card-box"><h2>Vote Summary</h2><p>${badge(s?.status || "TANTOU_APPROVED")}</p><p><strong>Total:</strong> ${summary?.totalVotes ?? 0}</p><p><strong>Approve:</strong> ${summary?.approvedVotes ?? 0}</p><p><strong>Reject / Revision:</strong> ${summary?.rejectedVotes ?? 0}</p><a class="btn-publish" href="board-voting.html">Vote on this Series</a></div>
        </div>`;
      bindCommonPickers(boardSubmissions);
    } catch (err) { errorBox(root, err); }
  }

  async function boardVoting() {
    const root = shell("Strategic Continuity Review", "Editorial Board decides whether the series continues, needs revision, or is cancelled.");
    try {
      await loadBoardEligibleSeries();

      if (!state.series.length) {
        root.innerHTML = `<div class="board-filter-note"><i class="fa-solid fa-lock"></i> Voting is locked. No series has been submitted/approved by Tantou Editor yet.</div><div class="card-box empty-state-box">No Tantou-approved series waiting for vote.</div>`;
        return;
      }

      const seriesId = Api.getActiveSeriesId();
      const s = state.series.find(x => String(seriesIdOf(x)) === String(seriesId)) || state.series[0];
      const actualSeriesId = seriesIdOf(s);
      const submitted = getTantouBoardSubmission(actualSeriesId);
      const existingDecision = getBoardDecision(actualSeriesId);
      const summary = s ? await Api.voteSummary(actualSeriesId).catch(() => null) : null;
      const defaultDecision = existingDecision?.decision || submitted?.recommendation || "CONTINUE";

      root.innerHTML = `
        <div class="board-filter-note"><i class="fa-solid fa-lock"></i> Only Editorial Board can decide cancellation. Tantou recommendation: <strong>${esc(boardDecisionLabel(submitted?.recommendation || "CONTINUE"))}</strong></div>
        <div class="toolbar-row">${seriesPicker(actualSeriesId)}</div>
        <div class="strategic-review-grid">
          <div class="card-box">
            <h2>${esc(s?.title || "No series selected")}</h2>
            <p>${esc(s?.summary || "")}</p>
            <table class="data-table"><tbody>
              <tr><th>Status</th><td>${badge(s?.status || "TANTOU_APPROVED")}</td></tr>
              <tr><th>Mangaka</th><td>${esc(s?.mangakaName || "—")}</td></tr>
              <tr><th>Tantou Recommendation</th><td>${badge(boardDecisionLabel(submitted?.recommendation || "CONTINUE"))}</td></tr>
            </tbody></table>
          </div>
          <div class="card-box">
            <h2>Tantou Final Plea</h2>
            <p class="tantou-plea-text">${esc(submitted?.note || s?.tantouReportNote || "No Tantou note submitted.")}</p>
          </div>
          <div class="card-box">
            <h2>Vote Summary</h2>
            <p><strong>Approve:</strong> ${summary?.approvedVotes ?? 0}</p>
            <p><strong>Reject / Revision:</strong> ${summary?.rejectedVotes ?? 0}</p>
            <p><strong>Total:</strong> ${summary?.totalVotes ?? 0}</p>
          </div>
        </div>

        <div class="board-voting-workspace">
          ${renderBoardDiscussion(actualSeriesId, { readOnly: false })}

          <div class="card-box strategic-decision-panel">
          <h2>Strategic Decision</h2>
          <div class="series-grid board-vote-grid board-decision-grid">
            <button class="action-btn ${defaultDecision === "CONTINUE" ? "selected" : ""}" data-board-decision="CONTINUE"><i class="fa-solid fa-check"></i> Continue Serialization</button>
            <button class="action-btn ${defaultDecision === "REVISION" ? "selected" : ""}" data-board-decision="REVISION"><i class="fa-solid fa-rotate-left"></i> Request Revision</button>
            <button class="action-btn danger-decision ${defaultDecision === "CANCEL" ? "selected" : ""}" data-board-decision="CANCEL"><i class="fa-solid fa-ban"></i> Cancel Series</button>
          </div>
          <div class="form-group"><label>Board Decision Comment</label><textarea class="form-control" id="board-comment">${esc(existingDecision?.comment || submitted?.note || "Board decision notes...")}</textarea></div>
          <button id="submit-vote" class="btn-publish">Submit Board Decision</button>
          <p class="muted-note">Cancel Series is a Board decision. Admin will only finalize/archive after the decision is recorded.</p>
          </div>
        </div>`;
      bindCommonPickers(boardVoting);
      bindBoardDiscussion(actualSeriesId, boardVoting);

      $$("[data-board-decision]").forEach(btn => btn.addEventListener("click", () => {
        $$("[data-board-decision]").forEach(x => x.classList.remove("selected"));
        btn.classList.add("selected");
      }));

      $("#submit-vote")?.addEventListener("click", async () => {
        try {
          const current = state.series.find(x => String(seriesIdOf(x)) === String(Api.getActiveSeriesId()));
          if (!current || !isSeriesApprovedByTantouForBoard(current)) {
            toast("This series is not approved by Tantou Editor for Board voting.", "error");
            return;
          }

          const decision = $("[data-board-decision].selected")?.dataset.boardDecision || "CONTINUE";
          const comment = $("#board-comment")?.value || "";
          const approveLike = decision === "CONTINUE";

          // Backend currently supports boolean vote only.
          // Revision and Cancel are saved as local Board decisions and sent as a reject vote when possible.
          try {
            await Api.castVote(Api.getActiveSeriesId(), approveLike);
          } catch (voteError) {
            console.warn("Backend vote failed; Board decision was saved locally.", voteError.message);
          }

          saveBoardDecision(Api.getActiveSeriesId(), decision, {
            comment,
            seriesTitle: current?.title || current?.name || "",
            tantouRecommendation: getTantouBoardSubmission(Api.getActiveSeriesId())?.recommendation || "",
            backendVoteValue: approveLike,
            discussionCount: getBoardDiscussion(Api.getActiveSeriesId()).length
          });

          toast(`Board decision saved: ${boardDecisionLabel(decision)}.`, "success");
          location.href = "board-result.html";
        } catch (err) { toast(err.message, "error"); }
      });
    } catch (err) { errorBox(root, err); }
  }

  async function boardResult() {
    const root = shell("Decision History", "Live voting summary and recorded Editorial Board decision for the selected manga series.");
    try {
      await loadBoardEligibleSeries();

      if (!state.series.length) {
        root.innerHTML = `<div class="board-filter-note"><i class="fa-solid fa-lock"></i> No Tantou-approved series has reached Board decision yet.</div>`;
        return;
      }

      const seriesId = Api.getActiveSeriesId();
      const s = state.series.find(x => String(seriesIdOf(x)) === String(seriesId)) || state.series[0];
      const actualSeriesId = seriesIdOf(s);
      const summary = s ? await Api.voteSummary(actualSeriesId).catch(() => ({ totalVotes: 0, approvedVotes: 0, rejectedVotes: 0 })) : null;
      const decision = getBoardDecision(actualSeriesId);
      const result = decision?.decision ? boardDecisionLabel(decision.decision) : ((summary?.approvedVotes || 0) > (summary?.rejectedVotes || 0) ? "Recommended Approval" : (summary?.totalVotes ? "Revision / Rejection Risk" : "Waiting for Votes"));
      root.innerHTML = `
        <div class="toolbar-row">${seriesPicker(actualSeriesId)}</div>
        <div class="card-box">
          <span class="status-tag progress">${esc(result)}</span>
          <h2 style="margin-top:15px;">${esc(s?.title || "No series")}</h2>
          <p>Status: ${badge(decision?.status || s?.status)}</p>
          ${decision?.decision ? `<div class="board-decision-summary ${decision.decision === "CANCEL" ? "danger-summary" : ""}"><strong>Board Decision:</strong> ${esc(boardDecisionLabel(decision.decision))}<br><span>${esc(decision.comment || "No comment.")}</span></div>` : `<div class="board-filter-note"><i class="fa-solid fa-clock"></i> No final Board decision has been submitted yet.</div>`}
          <table class="data-table"><thead><tr><th>Decision</th><th>Count</th></tr></thead><tbody><tr><td>Approve</td><td>${summary?.approvedVotes || 0}</td></tr><tr><td>Reject / Revision</td><td>${summary?.rejectedVotes || 0}</td></tr><tr><td>Total</td><td>${summary?.totalVotes || 0}</td></tr></tbody></table>
          <div style="margin-top:18px;"><a class="btn-publish" href="admin-final-approval.html">Send to Admin Finalization</a></div>
        </div>
        ${renderBoardDiscussion(actualSeriesId, { readOnly: true })}`;
      bindCommonPickers(boardResult);
    } catch (err) { errorBox(root, err); }
  }

  async function adminDashboard() {
    const isSchedule = location.hash === "#schedule";
    const root = shell(
      isSchedule ? "Admin Schedule" : "Admin Dashboard",
      isSchedule ? "View publishing schedules and deadlines. Admin cannot edit Mangaka-owned schedules here." : "System users, settings, deadlines, schedule, and final approval metrics from Backend 1/2.",
      isSchedule ? `<a class="btn-outline" href="admin-dashboard.html"><i class="fa-solid fa-border-all"></i> Dashboard Overview</a>` : `<a class="btn-outline" href="admin-dashboard.html#schedule"><i class="fa-solid fa-calendar-days"></i> Schedule</a>`
    );
    if (isSchedule) {
      try { await renderRoleReadOnlySchedule(root, { role: "admin" }); } catch (err) { errorBox(root, err); }
      return;
    }
    try {
      const [users, params, series] = await Promise.all([Api.users().catch(() => []), Api.parameters().catch(() => []), Api.allSeries().catch(() => [])]);
      state.users = users; state.params = params; state.series = series;
      const reviewing = series.filter(s => /review/i.test(s.status || "")).length;
      root.innerHTML = `<div class="stats-grid"><div class="stat-card"><div class="stat-value">${users.length}</div><div class="stat-label">Users</div></div><div class="stat-card"><div class="stat-value">${new Set(users.map(u=>u.roleName)).size}</div><div class="stat-label">Roles</div></div><div class="stat-card"><div class="stat-value">${reviewing}</div><div class="stat-label">Final Approvals</div></div><div class="stat-card"><div class="stat-value">${params.length}</div><div class="stat-label">System Parameters</div></div></div><div class="card-box" style="margin-top:30px;"><h2>Reviewing Series</h2>${series.filter(s=>/review/i.test(s.status||"")).map(s=>`<div class="list-card"><div class="list-card-content"><h2 class="list-card-title">${esc(s.title)}</h2><p class="list-card-meta">${badge(s.status)} • ${esc(s.mangakaName || "—")}</p></div><button class="btn-icon-only set-series" data-id="${s.id}"><i class="fa-solid fa-arrow-right"></i></button></div>`).join("") || `<div class="empty-state-box">No reviewing series.</div>`}</div>`;
      $$(".set-series").forEach(btn => btn.addEventListener("click", () => { Api.setActiveSeriesId(btn.dataset.id); location.href = "admin-final-approval.html"; }));
    } catch (err) { errorBox(root, err); }
  }

  async function adminUsers() {
    const root = shell("User Management", "Manage accounts, lock/unlock users, and assign role permissions.");
    try {
      state.users = await Api.users();
      const roles = ["Mangaka", "Assistant", "Tantou Editor", "Editorial Board", "Admin"];
      root.innerHTML = `<div class="card-box"><table class="data-table"><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead><tbody>${state.users.map(u => `<tr><td><strong>${esc(u.username)}</strong><br><small>${esc(u.fullName || "")}</small></td><td>${esc(u.email || "—")}</td><td><select class="form-control role-change" data-id="${u.id}">${roles.map(r => `<option ${r === u.roleName ? "selected" : ""}>${r}</option>`).join("")}</select></td><td>${badge(u.isActive ? "Active" : "Locked")}</td><td><button class="btn-outline lock-user" data-id="${u.id}" data-active="${!u.isActive}">${u.isActive ? "Lock" : "Unlock"}</button></td></tr>`).join("") || `<tr><td colspan="5">No users returned.</td></tr>`}</tbody></table></div>`;
      $$(".role-change").forEach(sel => sel.addEventListener("change", async () => { try { await Api.assignRole(sel.dataset.id, sel.value); toast("Role updated.", "success"); } catch (err) { toast(err.message, "error"); } }));
      $$(".lock-user").forEach(btn => btn.addEventListener("click", async () => { try { await Api.lockUser(btn.dataset.id, btn.dataset.active === "true"); toast("User status updated.", "success"); adminUsers(); } catch (err) { toast(err.message, "error"); } }));
    } catch (err) { errorBox(root, err); }
  }

  async function adminSettings() {
    const root = shell("System Settings", "Configure system parameters through /system-parameters.");
    try {
      state.params = await Api.parameters().catch(() => []);
      root.innerHTML = `<div class="grid-layout"><div class="card-box"><h2>Parameters</h2><table class="data-table"><thead><tr><th>Key</th><th>Value</th><th>Actions</th></tr></thead><tbody>${state.params.map(p => `<tr><td>${esc(p.paramKey)}</td><td><input class="form-control param-value" data-key="${esc(p.paramKey)}" value="${esc(p.paramValue)}"></td><td><button class="btn-outline save-param" data-key="${esc(p.paramKey)}">Save</button> <button class="btn-outline delete-param" data-key="${esc(p.paramKey)}">Delete</button></td></tr>`).join("") || `<tr><td colspan="3">No parameters yet.</td></tr>`}</tbody></table></div><div class="card-box"><h2>Add Parameter</h2><div class="form-group"><label>Key</label><input id="new-param-key" class="form-control" placeholder="MAX_UPLOAD_MB"></div><div class="form-group"><label>Value</label><input id="new-param-value" class="form-control" placeholder="20"></div><button id="create-param" class="btn-publish">Create Parameter</button></div></div>`;
      $$(".save-param").forEach(btn => btn.addEventListener("click", async () => { const val = $(`.param-value[data-key="${CSS.escape(btn.dataset.key)}"]`).value; try { await Api.updateParameter(btn.dataset.key, val); toast("Parameter saved.", "success"); } catch (err) { toast(err.message, "error"); } }));
      $$(".delete-param").forEach(btn => btn.addEventListener("click", async () => { try { await Api.deleteParameter(btn.dataset.key); toast("Parameter deleted.", "success"); adminSettings(); } catch (err) { toast(err.message, "error"); } }));
      $("#create-param")?.addEventListener("click", async () => { try { await Api.createParameter($("#new-param-key").value, $("#new-param-value").value); toast("Parameter created.", "success"); adminSettings(); } catch (err) { toast(err.message, "error"); } });
    } catch (err) { errorBox(root, err); }
  }

  async function adminCalendar() {
    const root = shell("Publishing Calendar", "View publishing schedules by selected series. Editing is Mangaka-only.");
    try {
      await renderRoleReadOnlySchedule(root, { role: "admin" });
    } catch (err) { errorBox(root, err); }
  }

  async function adminDeadlines() {
    const root = shell("Deadline Monitor", "View deadline warnings by selected series. Editing is Mangaka-only.");
    try {
      await renderRoleReadOnlySchedule(root, { role: "admin" });
      setTimeout(() => {
        const deadlineTab = document.querySelector(".readonly-schedule-tab[data-readonly-tab='deadlines']");
        deadlineTab?.click();
      }, 0);
    } catch (err) { errorBox(root, err); }
  }

  async function adminFinalApproval() {
    const root = shell("Final Decision Management", "Admin finalizes the Editorial Board decision. Admin does not decide cancellation.");
    try {
      await loadBoardDecidedSeries();

      if (!state.series.length) {
        root.innerHTML = `<div class="board-filter-note"><i class="fa-solid fa-lock"></i> No Board decision is waiting for Admin finalization.</div><div class="card-box empty-state-box">Board must decide Continue, Revision, or Cancel first.</div>`;
        return;
      }

      const seriesId = Api.getActiveSeriesId();
      const s = state.series.find(x => String(seriesIdOf(x)) === String(seriesId)) || state.series[0];
      const actualSeriesId = seriesIdOf(s);
      const decision = getBoardDecision(actualSeriesId);
      const finalization = getAdminFinalization(actualSeriesId);
      const summary = s ? await Api.voteSummary(actualSeriesId).catch(() => null) : null;
      const isCancel = decision?.decision === "CANCEL";
      const isRevision = decision?.decision === "REVISION";
      const primaryText = isCancel ? "Confirm Cancellation / Archive" : (isRevision ? "Finalize Revision Request" : "Approve Publication");

      root.innerHTML = `
        <div class="toolbar-row">${seriesPicker(actualSeriesId)}</div>
        <div class="admin-finalization-grid">
          <div class="card-box">
            <h2>${esc(s?.title || "No series selected")}</h2>
            <p>${badge(decision?.status || s?.status)} • Mangaka: ${esc(s?.mangakaName || "—")}</p>
            <div class="board-role-note"><i class="fa-solid fa-circle-info"></i> Board decides. Admin only applies the final system action.</div>
            <div class="board-decision-summary ${isCancel ? "danger-summary" : ""}">
              <strong>Board Decision:</strong> ${esc(boardDecisionLabel(decision?.decision))}<br>
              <span>${esc(decision?.comment || "No board comment.")}</span>
            </div>
            <table class="data-table"><thead><tr><th>Vote</th><th>Count</th></tr></thead><tbody><tr><td>Approve</td><td>${summary?.approvedVotes || 0}</td></tr><tr><td>Reject / Revision</td><td>${summary?.rejectedVotes || 0}</td></tr><tr><td>Total</td><td>${summary?.totalVotes || 0}</td></tr></tbody></table>
            ${finalization ? `<div class="board-filter-note"><i class="fa-solid fa-check-circle"></i> Already finalized as ${esc(finalization.finalStatus || finalization.action)} at ${fmtDate(finalization.finalizedAt)}.</div>` : ""}
            <div style="margin-top:20px;">
              <button id="admin-finalize-board-decision" class="btn-publish ${isCancel ? "danger-button" : ""}">${esc(primaryText)}</button>
            </div>
          </div>
          ${renderBoardDiscussion(actualSeriesId, { readOnly: true })}
        </div>`;
      bindCommonPickers(adminFinalApproval);

      $("#admin-finalize-board-decision")?.addEventListener("click", async () => {
        try {
          const currentDecision = getBoardDecision(Api.getActiveSeriesId());
          if (!currentDecision) {
            toast("No Board decision to finalize.", "error");
            return;
          }

          const cancel = currentDecision.decision === "CANCEL";
          const revision = currentDecision.decision === "REVISION";
          const finalStatus = cancel ? "ADMIN_ARCHIVED_CANCELLED" : (revision ? "ADMIN_SENT_REVISION" : "ADMIN_APPROVED_PUBLICATION");

          if (cancel && !confirm("Finalize Board cancellation and archive this series?")) return;

          // Backend only has boolean adminDecision, so map Continue=true and Revision/Cancel=false.
          try {
            await Api.adminDecision(Api.getActiveSeriesId(), currentDecision.decision === "CONTINUE");
          } catch (backendError) {
            console.warn("Backend admin decision failed; local finalization was saved.", backendError.message);
          }

          saveAdminFinalization(Api.getActiveSeriesId(), {
            action: currentDecision.decision,
            finalStatus,
            boardDecision: currentDecision.decision,
            boardComment: currentDecision.comment || ""
          });

          toast(cancel ? "Cancellation finalized and archived." : (revision ? "Revision request finalized." : "Publication approved."), "success");
          await adminFinalApproval();
        } catch (err) { toast(err.message, "error"); }
      });
    } catch (err) { errorBox(root, err); }
  }

  const handlers = {
    "tantou-dashboard.html": tantouDashboard,
    "tantou-feedback.html": tantouFeedback,
    "tantou-review.html": tantouReview,
    "tantou-revision.html": tantouRevision,
    "tantou-report.html": tantouReport,
    "board-dashboard.html": boardDashboard,
    "editorial-board.html": boardDashboard,
    "board-submissions.html": boardSubmissions,
    "board-voting.html": boardVoting,
    "board-result.html": boardResult,
    "admin-dashboard.html": adminDashboard,
    "admin-users.html": adminUsers,
    "admin-settings.html": adminSettings,
    "admin-calendar.html": adminCalendar,
    "admin-deadlines.html": adminDeadlines,
    "admin-final-approval.html": adminFinalApproval,
  };

  document.addEventListener("DOMContentLoaded", () => {
    syncShellAvatarWithProfile();

    const userId = localStorage.getItem("userId");
    Api.connectNotifications?.(userId, (message) => toast(typeof message === "string" ? message : (message.message || "New notification"), "info"));
    handlers[page]?.();

    // Same-page hash links such as tantou-dashboard.html#kanban and #schedule
    // do not reload the document, so rerun the current page handler.
    window.addEventListener("hashchange", () => {
      handlers[page]?.();
      setTimeout(syncShellAvatarWithProfile, 0);
    });

    // Some handlers re-render page content. Keep avatar consistent afterwards.
    setTimeout(syncShellAvatarWithProfile, 0);
  });
})();
