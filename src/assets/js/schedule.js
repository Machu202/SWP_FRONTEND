(() => {
  const Api = window.MangaApi || {};
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value = "") => String(value ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
  const toast = (message, type = "info") => window.showToast ? window.showToast(message, type) : alert(message);

  const state = {
    series: [],
    schedules: [],
    deadlines: [],
    activeTab: "calendar",
    search: ""
  };

  function asArray(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.content)) return payload.content;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.data?.content)) return payload.data.content;
    if (Array.isArray(payload?.items)) return payload.items;
    return [];
  }

  function currentUserId() {
    return String(localStorage.getItem("userId") || localStorage.getItem("id") || "");
  }

  function normalizeRole(role = localStorage.getItem("role") || localStorage.getItem("userRole") || "") {
    return String(role || "").toUpperCase().replace(/^ROLE_/, "").replace(/[\s-]+/g, "_");
  }

  function canEdit() {
    return normalizeRole().includes("MANGAKA");
  }

  function seriesIdOf(series = {}) {
    return series.id ?? series.seriesId ?? series.mangaSeriesId ?? "";
  }

  function seriesTitleOf(series = {}) {
    return series.title || series.name || series.seriesTitle || `Series #${seriesIdOf(series)}`;
  }

  function belongsToCurrentMangaka(series = {}) {
    const uid = currentUserId();
    if (!uid) return true;
    return [
      series.mangakaId,
      series.ownerId,
      series.createdById,
      series.authorId,
      series.userId,
      series.mangaka?.id,
      series.owner?.id,
      series.createdBy?.id
    ].some(value => value !== undefined && value !== null && String(value) === uid);
  }

  async function loadOwnedSeries() {
    let list = [];
    try {
      list = asArray(await Api.mySeries?.());
    } catch (mySeriesError) {
      console.warn("/manga-series/my-series unavailable, falling back to filtered /manga-series.", mySeriesError.message);
      try {
        list = asArray(await Api.allSeries?.());
        list = list.filter(belongsToCurrentMangaka);
      } catch (allSeriesError) {
        console.warn("Could not load series.", allSeriesError.message);
        list = [];
      }
    }

    const map = new Map();
    list.forEach(series => {
      const id = seriesIdOf(series);
      if (id) map.set(String(id), { ...(map.get(String(id)) || {}), ...series });
    });
    state.series = Array.from(map.values());

    const activeId = Api.getActiveSeriesId?.() || localStorage.getItem("activeSeriesId") || "";
    if (state.series.length && !state.series.some(series => String(seriesIdOf(series)) === String(activeId))) {
      Api.setActiveSeriesId?.(seriesIdOf(state.series[0]));
    }

    renderSeriesPicker();
  }

  function activeSeriesId() {
    return Api.getActiveSeriesId?.() || localStorage.getItem("activeSeriesId") || seriesIdOf(state.series[0]) || "";
  }

  function activeSeries() {
    const id = activeSeriesId();
    return state.series.find(series => String(seriesIdOf(series)) === String(id)) || state.series[0] || null;
  }

  function renderSeriesPicker() {
    const select = $("#series-select");
    if (!select) return;

    if (!state.series.length) {
      select.innerHTML = `<option value="">No owned series found</option>`;
      select.disabled = true;
      return;
    }

    select.disabled = false;
    const selected = activeSeriesId();
    select.innerHTML = state.series.map(series => {
      const id = seriesIdOf(series);
      return `<option value="${esc(id)}" ${String(id) === String(selected) ? "selected" : ""}>#${esc(id)} — ${esc(seriesTitleOf(series))}</option>`;
    }).join("");
  }

  function fmtDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).replace("T", " ");
    return date.toLocaleString();
  }

  function daysUntil(value) {
    if (!value) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(value);
    if (Number.isNaN(target.getTime())) return null;
    target.setHours(0, 0, 0, 0);
    return Math.round((target - today) / 86400000);
  }

  function riskForDeadline(deadline) {
    const explicit = deadline.warningLevel || deadline.risk || deadline.status;
    if (explicit) return explicit;
    const days = daysUntil(deadline.deadlineDate || deadline.deadlineDateStr || deadline.date);
    if (days === null) return "Normal";
    if (days < 0) return "Overdue";
    if (days <= 2) return "High";
    if (days <= 7) return "Medium";
    return "Normal";
  }

  function badge(value = "") {
    const text = String(value || "—");
    const normalized = text.toUpperCase();
    let klass = "neutral";
    if (/OVERDUE|HIGH|DANGER|LATE/.test(normalized)) klass = "danger";
    else if (/MEDIUM|WARNING|SOON/.test(normalized)) klass = "warning";
    else if (/LOW|NORMAL|OPEN|WEEKLY|ACTIVE/.test(normalized)) klass = "success";
    return `<span class="schedule-badge ${klass}">${esc(text)}</span>`;
  }

  function showMessage(message, type = "info") {
    const box = $("#schedule-message");
    if (!box) return;
    box.hidden = !message;
    box.textContent = message || "";
    box.dataset.type = type;
  }

  function localScheduleKey(seriesId) {
    return `mangakaScheduleLocal:${seriesId}`;
  }

  function getLocalSchedules(seriesId) {
    try {
      return JSON.parse(localStorage.getItem(localScheduleKey(seriesId)) || "[]");
    } catch (_) {
      return [];
    }
  }

  function saveLocalSchedules(seriesId, list) {
    localStorage.setItem(localScheduleKey(seriesId), JSON.stringify(list || []));
  }

  function addLocalSchedule(seriesId, item) {
    const list = getLocalSchedules(seriesId);
    const saved = { id: `local-schedule-${Date.now()}`, source: "LOCAL_SCHEDULE", seriesId, ...item };
    saveLocalSchedules(seriesId, [saved, ...list]);
    return saved;
  }

  function deleteLocalSchedule(seriesId, id) {
    saveLocalSchedules(seriesId, getLocalSchedules(seriesId).filter(item => String(item.id) !== String(id)));
  }

  function localDeadlineKey(seriesId) {
    return `mangakaDeadlineLocal:${seriesId}`;
  }

  function getLocalDeadlines(seriesId) {
    try {
      return JSON.parse(localStorage.getItem(localDeadlineKey(seriesId)) || "[]");
    } catch (_) {
      return [];
    }
  }

  function saveLocalDeadlines(seriesId, list) {
    localStorage.setItem(localDeadlineKey(seriesId), JSON.stringify(list || []));
  }

  function addLocalDeadline(seriesId, item) {
    const list = getLocalDeadlines(seriesId);
    const saved = { id: `local-deadline-${Date.now()}`, source: "LOCAL_DEADLINE", seriesId, ...item };
    saveLocalDeadlines(seriesId, [saved, ...list]);
    return saved;
  }

  function deleteLocalDeadline(seriesId, id) {
    saveLocalDeadlines(seriesId, getLocalDeadlines(seriesId).filter(item => String(item.id) !== String(id)));
  }

  async function loadSchedules() {
    const seriesId = activeSeriesId();
    if (!seriesId) {
      state.schedules = [];
      return;
    }

    let backend = [];
    try {
      backend = asArray(await Api.schedules?.(seriesId));
    } catch (error) {
      console.warn("Backend schedules unavailable; using local schedules only.", error.message);
    }

    const local = getLocalSchedules(seriesId);
    const map = new Map();
    [...backend, ...local].forEach(item => {
      const id = item.id ?? item.scheduleId ?? `${item.publishDate}-${item.frequency}`;
      map.set(String(id), { ...(map.get(String(id)) || {}), ...item, id });
    });
    state.schedules = Array.from(map.values()).sort((a, b) => String(a.publishDate || a.date || "").localeCompare(String(b.publishDate || b.date || "")));
  }

  async function loadDeadlines() {
    const seriesId = activeSeriesId();
    if (!seriesId) {
      state.deadlines = [];
      return;
    }

    let backend = [];
    try {
      backend = asArray(await Api.deadlines?.(seriesId));
    } catch (error) {
      console.warn("Backend deadlines unavailable; using local deadlines only.", error.message);
    }

    const local = getLocalDeadlines(seriesId);
    const map = new Map();
    [...backend, ...local].forEach(item => {
      const id = item.id ?? item.eventId ?? `${item.eventName || item.title}-${item.deadlineDate || item.deadlineDateStr}`;
      map.set(String(id), { ...(map.get(String(id)) || {}), ...item, id });
    });
    state.deadlines = Array.from(map.values()).sort((a, b) => String(a.deadlineDate || a.deadlineDateStr || "").localeCompare(String(b.deadlineDate || b.deadlineDateStr || "")));
  }

  function matchesSearch(item) {
    const search = state.search.trim().toLowerCase();
    if (!search) return true;
    return [item.title, item.eventName, item.frequency, item.description, seriesTitleOf(activeSeries()), item.publishDate, item.deadlineDate, item.warningLevel]
      .join(" ")
      .toLowerCase()
      .includes(search);
  }

  function renderCalendar() {
    const body = $("#calendar-table-body");
    const count = $("#calendar-count");
    if (!body) return;

    const series = activeSeries();
    const rows = state.schedules.filter(matchesSearch);
    if (count) count.textContent = String(rows.length);

    if (!activeSeriesId()) {
      body.innerHTML = `<tr><td colspan="4">Create a series first.</td></tr>`;
      return;
    }

    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="4">No schedule for selected series.</td></tr>`;
      return;
    }

    body.innerHTML = rows.map(item => {
      const id = item.id ?? item.scheduleId;
      const isLocal = String(id).startsWith("local-schedule") || item.source === "LOCAL_SCHEDULE";
      return `<tr>
        <td>${esc(fmtDate(item.publishDate || item.date || item.scheduledDate))}</td>
        <td>${esc(item.frequency || item.repeatType || "—")}</td>
        <td>${esc(seriesTitleOf(series))}</td>
        <td>${canEdit() ? `<button class="btn-outline delete-schedule" data-id="${esc(id)}" data-local="${isLocal}">Delete</button>` : `<span class="schedule-badge neutral">View only</span>`}</td>
      </tr>`;
    }).join("");

    $$(".delete-schedule").forEach(button => button.addEventListener("click", async () => {
      if (!canEdit()) return;
      if (!confirm("Delete this schedule?")) return;
      const seriesId = activeSeriesId();
      try {
        if (button.dataset.local === "true") deleteLocalSchedule(seriesId, button.dataset.id);
        else await Api.deleteSchedule?.(button.dataset.id);
        toast("Schedule deleted.", "success");
      } catch (error) {
        toast(error.message, "error");
      }
      await loadAndRender();
    }));
  }

  function renderDeadlines() {
    const body = $("#deadline-table-body");
    const count = $("#deadline-count");
    if (!body) return;

    const rows = state.deadlines.filter(matchesSearch);
    if (count) count.textContent = String(rows.length);

    if (!activeSeriesId()) {
      body.innerHTML = `<tr><td colspan="4">Create a series first.</td></tr>`;
      return;
    }

    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="4">No deadlines for selected series.</td></tr>`;
      return;
    }

    body.innerHTML = rows.map(item => {
      const id = item.id ?? item.eventId;
      const isLocal = String(id).startsWith("local-deadline") || item.source === "LOCAL_DEADLINE";
      return `<tr>
        <td>${esc(item.eventName || item.title || "Untitled deadline")}</td>
        <td>${esc(fmtDate(item.deadlineDate || item.deadlineDateStr || item.date))}</td>
        <td>${badge(riskForDeadline(item))}</td>
        <td>${canEdit() ? `<button class="btn-outline delete-deadline" data-id="${esc(id)}" data-local="${isLocal}">Delete</button>` : `<span class="schedule-badge neutral">View only</span>`}</td>
      </tr>`;
    }).join("");

    $$(".delete-deadline").forEach(button => button.addEventListener("click", async () => {
      if (!canEdit()) return;
      if (!confirm("Delete this deadline?")) return;
      const seriesId = activeSeriesId();
      try {
        if (button.dataset.local === "true") deleteLocalDeadline(seriesId, button.dataset.id);
        else await Api.deleteDeadline?.(button.dataset.id);
        toast("Deadline deleted.", "success");
      } catch (error) {
        toast(error.message, "error");
      }
      await loadAndRender();
    }));
  }

  function renderAll() {
    renderSeriesPicker();
    renderCalendar();
    renderDeadlines();
  }

  async function loadAndRender() {
    const calendarBody = $("#calendar-table-body");
    const deadlineBody = $("#deadline-table-body");
    if (calendarBody) calendarBody.innerHTML = `<tr><td colspan="4">Loading schedules...</td></tr>`;
    if (deadlineBody) deadlineBody.innerHTML = `<tr><td colspan="4">Loading deadlines...</td></tr>`;

    await Promise.all([loadSchedules(), loadDeadlines()]);
    renderAll();
  }

  function setActiveTab(tab) {
    state.activeTab = tab;
    $$(".schedule-tab").forEach(button => button.classList.toggle("active", button.dataset.tab === tab));
    $$(".schedule-panel").forEach(panel => panel.classList.toggle("active", panel.id === `${tab}-panel`));
  }

  async function createSchedule() {
    if (!canEdit()) return showMessage("Only Mangaka can create publishing schedules for owned series.", "warning");
    const seriesId = activeSeriesId();
    const publishDate = $("#schedule-date")?.value || "";
    const frequency = $("#schedule-frequency")?.value.trim() || "Weekly";
    if (!seriesId) return toast("Select a series first.", "error");
    if (!publishDate) return toast("Choose a publish date.", "error");

    try {
      await Api.createSchedule?.({ seriesId: Number(seriesId), publishDate, frequency });
      toast("Schedule saved.", "success");
    } catch (error) {
      console.warn("Backend schedule create failed; saving local schedule.", error.message);
      addLocalSchedule(seriesId, { publishDate, frequency, status: "OPEN" });
      toast("Backend rejected schedule, so it was saved locally for this browser.", "info");
    }

    $("#schedule-date").value = "";
    $("#schedule-frequency").value = "Weekly";
    await loadAndRender();
  }

  async function createDeadline() {
    if (!canEdit()) return showMessage("Only Mangaka can create deadline warnings for owned series.", "warning");
    const seriesId = activeSeriesId();
    const eventName = $("#deadline-name")?.value.trim() || "";
    const deadlineDate = $("#deadline-date")?.value || "";
    if (!seriesId) return toast("Select a series first.", "error");
    if (!eventName || !deadlineDate) return toast("Enter event name and deadline date.", "error");

    try {
      await Api.createDeadline?.(seriesId, eventName, deadlineDate);
      toast("Deadline created.", "success");
    } catch (error) {
      console.warn("Backend deadline create failed; saving local deadline.", error.message);
      addLocalDeadline(seriesId, { eventName, deadlineDate, status: "OPEN" });
      toast("Backend rejected deadline, so it was saved locally for this browser.", "info");
    }

    $("#deadline-name").value = "";
    $("#deadline-date").value = "";
    await loadAndRender();
  }

  function applyAvatar() {
    const fullName = localStorage.getItem("fullName") || localStorage.getItem("name") || localStorage.getItem("username") || "MK";
    const initials = fullName.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join("").toUpperCase() || "MK";
    ["#schedule-avatar", "#schedule-top-avatar"].forEach(selector => {
      const node = $(selector);
      if (node) node.textContent = initials;
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    applyAvatar();

    if (!canEdit()) {
      showMessage("This Mangaka schedule page is editable only for Mangaka accounts. You can view data, but edit controls may fail if the backend blocks your role.", "warning");
    }

    $$(".schedule-tab").forEach(button => button.addEventListener("click", () => setActiveTab(button.dataset.tab)));
    $("#series-select")?.addEventListener("change", async (event) => {
      Api.setActiveSeriesId?.(event.target.value);
      await loadAndRender();
    });
    $("#global-schedule-search")?.addEventListener("input", event => {
      state.search = event.target.value || "";
      renderAll();
    });
    $("#schedule-refresh")?.addEventListener("click", async () => {
      await loadOwnedSeries();
      await loadAndRender();
      toast("Schedule refreshed.", "success");
    });
    $("#create-schedule")?.addEventListener("click", createSchedule);
    $("#create-deadline")?.addEventListener("click", createDeadline);

    await loadOwnedSeries();
    await loadAndRender();
  });
})();
