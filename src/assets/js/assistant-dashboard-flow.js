
(function () {
  document.addEventListener("DOMContentLoaded", () => {
    const Api = window.MangaApi;
    const content = document.querySelector(".content-padding");
    if (!content || !Api) return;

    const dashboardPanel = document.createElement("div");
    dashboardPanel.id = "assistant-dashboard-panel";

    while (content.firstChild) {
      dashboardPanel.appendChild(content.firstChild);
    }

    content.appendChild(dashboardPanel);

    const inlinePanel = document.createElement("div");
    inlinePanel.id = "assistant-inline-panel";
    inlinePanel.className = "studio-inline-panel assistant-inline-panel";
    inlinePanel.hidden = true;
    content.appendChild(inlinePanel);

    const $ = (selector, root = inlinePanel) => root.querySelector(selector);
    const $$ = (selector, root = inlinePanel) => Array.from(root.querySelectorAll(selector));
    const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[ch]));

    const getArray = (value) => Array.isArray(value) ? value : (value?.content || []);

    function setActive(panelName) {
      document.querySelectorAll("[data-assistant-panel]").forEach((link) => {
        const isActive = link.dataset.assistantPanel === panelName;
        if (link.classList.contains("nav-item")) {
          link.classList.toggle("active", isActive);
        }
      });
    }

    function showDashboard() {
      inlinePanel.hidden = true;
      inlinePanel.innerHTML = "";
      dashboardPanel.hidden = false;
      setActive("dashboard");
      history.replaceState(null, "", location.pathname);
    }

    function showKanban() {
      dashboardPanel.hidden = true;
      inlinePanel.hidden = false;
      setActive("kanban");
      history.replaceState(null, "", "#kanban");
      renderKanban();
    }

    function showSchedule() {
      dashboardPanel.hidden = true;
      inlinePanel.hidden = false;
      setActive("schedule");
      history.replaceState(null, "", "#schedule");
      renderReadOnlySchedule();
    }

    document.querySelectorAll("[data-assistant-panel]").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const panelName = link.dataset.assistantPanel || "dashboard";
        if (panelName === "kanban") showKanban();
        else if (panelName === "schedule") showSchedule();
        else showDashboard();
      });
    });

    if (location.hash === "#kanban") {
      showKanban();
    } else if (location.hash === "#schedule") {
      showSchedule();
    }

    function loading(message = "Loading...") {
      return `<div class="api-loading">${esc(message)}</div>`;
    }

    function errorBox(error) {
      return `<div class="api-error">${esc(error?.message || error || "Something went wrong")}</div>`;
    }


    function scheduleBadge(value = "") {
      const text = String(value || "—");
      const normalized = text.toUpperCase();
      let klass = "neutral";
      if (/OVERDUE|HIGH|DANGER|LATE/.test(normalized)) klass = "danger";
      else if (/MEDIUM|WARNING|SOON/.test(normalized)) klass = "warning";
      else if (/LOW|NORMAL|OPEN|WEEKLY|ACTIVE/.test(normalized)) klass = "success";
      return `<span class="schedule-badge ${klass}">${esc(text)}</span>`;
    }

    function fmtScheduleDate(value) {
      if (!value) return "—";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value).replace("T", " ");
      return date.toLocaleString();
    }

    function scheduleRisk(deadline = {}) {
      const explicit = deadline.warningLevel || deadline.risk || deadline.status;
      if (explicit) return explicit;

      const raw = deadline.deadlineDate || deadline.deadlineDateStr || deadline.date;
      if (!raw) return "Normal";
      const target = new Date(raw);
      if (Number.isNaN(target.getTime())) return "Normal";
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      target.setHours(0, 0, 0, 0);

      const days = Math.round((target - today) / 86400000);
      if (days < 0) return "Overdue";
      if (days <= 2) return "High";
      if (days <= 7) return "Medium";
      return "Normal";
    }

    function readAssistantLocalJson(key, fallback) {
      try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
      catch (_) { return fallback; }
    }

    function currentAssistantId() {
      const profile = readAssistantLocalJson("profileCache", {});
      return String(
        localStorage.getItem("userId") ||
        localStorage.getItem("id") ||
        profile.id ||
        profile.userId ||
        profile.user_id ||
        ""
      );
    }

    function taskIdOf(task = {}) {
      return task.id ?? task.taskId ?? task.task_id ?? "";
    }

    function taskSeriesIdOf(task = {}) {
      return task.seriesId ||
        task.mangaSeriesId ||
        task.series_id ||
        task.manga_series_id ||
        task.series?.id ||
        task.mangaSeries?.id ||
        task.chapter?.seriesId ||
        task.chapter?.mangaSeriesId ||
        task.hitbox?.page?.chapter?.seriesId ||
        task.hitbox?.page?.chapter?.mangaSeriesId ||
        "";
    }

    function taskDeadlineOf(task = {}) {
      const direct = task.deadlineDate ||
        task.deadlineDateStr ||
        task.deadline ||
        task.dueDate ||
        task.due_date ||
        task.taskDeadline ||
        task.task_deadline ||
        task.scheduledDeadline ||
        task.scheduled_deadline;

      if (direct) return direct;

      const text = String([task.title, task.description, task.note, task.comment].filter(Boolean).join(" "));
      const match = text.match(/(?:deadline|due)\s*[:：-]?\s*(\d{4}[/-]\d{1,2}[/-]\d{1,2}(?:[ T]\d{1,2}:\d{2})?)/i);
      return match ? match[1].replace(/\//g, "-") : "";
    }

    function taskAssistantIdOf(task = {}) {
      return String(
        task.assistantId ||
        task.assistant_id ||
        task.assignedToId ||
        task.assigned_to_id ||
        task.assistant?.id ||
        task.assignedTo?.id ||
        ""
      );
    }

    function localTaskDeadlineItems(tasks = []) {
      const taskIds = new Set(tasks.map(t => String(taskIdOf(t))).filter(Boolean));
      const myId = currentAssistantId();

      return readAssistantLocalJson("studioScheduleItems", [])
        .filter(item => String(item.type || item.source || "").toUpperCase().includes("TASK_DEADLINE"))
        .filter(item => {
          const itemTaskId = String(item.taskId || item.task_id || "");
          const itemAssistantId = String(item.assistantId || item.assistant_id || "");
          return (itemTaskId && taskIds.has(itemTaskId)) || (myId && itemAssistantId && itemAssistantId === myId);
        });
    }

    function taskDeadlineRows(tasks = [], activeSeriesId = "") {
      const fromTasks = tasks
        .map(task => {
          const deadline = taskDeadlineOf(task);
          if (!deadline) return null;
          return {
            id: `task-${taskIdOf(task)}`,
            type: "TASK_DEADLINE",
            source: "TASK",
            taskId: taskIdOf(task),
            seriesId: taskSeriesIdOf(task),
            eventName: titleOfTask(task),
            title: titleOfTask(task),
            deadlineDateStr: deadline,
            date: deadline,
            status: task.status || "OPEN"
          };
        })
        .filter(Boolean);

      const fromLocal = localTaskDeadlineItems(tasks).map(item => ({
        ...item,
        eventName: item.eventName || item.title || item.description || `Task #${item.taskId || ""}`,
        deadlineDateStr: item.deadlineDateStr || item.deadlineDate || item.date || item.dueDate,
        status: item.status || "OPEN"
      }));

      const rows = [...fromTasks, ...fromLocal].filter(row => {
        if (!activeSeriesId) return true;
        const rowSeries = String(row.seriesId || row.mangaSeriesId || "");
        return !rowSeries || rowSeries === String(activeSeriesId);
      });

      const seen = new Set();
      return rows.filter(row => {
        const key = [row.taskId || row.id || "", row.deadlineDateStr || row.deadlineDate || row.date || "", row.eventName || row.title || ""].join("|");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    function titleOfTask(task = {}) {
      return task.title || task.description || `Task #${taskIdOf(task) || "—"}`;
    }

    function seriesIdOf(series = {}) {
      return series.id ?? series.seriesId ?? series.mangaSeriesId ?? "";
    }

    function seriesTitleOf(series = {}) {
      return series.title || series.name || series.seriesTitle || `Series #${seriesIdOf(series)}`;
    }

    async function loadScheduleSeriesForAssistant() {
      let series = [];
      try {
        series = getArray(await Api.allSeries?.());
      } catch (error) {
        console.warn("Assistant could not load global series list.", error.message);
      }

      try {
        const tasks = getArray(await Api.tasks?.());
        const map = new Map(series.map(s => [String(seriesIdOf(s)), s]));

        tasks.forEach(task => {
          const id = taskSeriesIdOf(task);
          if (!id) return;
          map.set(String(id), {
            ...(map.get(String(id)) || {}),
            id,
            title: task.seriesTitle || task.mangaSeriesTitle || task.series?.title || task.mangaSeries?.title || `Series #${id}`
          });
        });

        localTaskDeadlineItems(tasks).forEach(item => {
          const id = item.seriesId || item.mangaSeriesId;
          if (!id) return;
          map.set(String(id), {
            ...(map.get(String(id)) || {}),
            id,
            title: item.seriesTitle || item.mangaSeriesTitle || `Series #${id}`
          });
        });

        series = Array.from(map.values());
      } catch (error) {
        console.warn("Assistant could not infer series from tasks/local deadlines.", error.message);
      }

      return series;
    }

    async function renderReadOnlySchedule() {
      inlinePanel.innerHTML = `
        <div class="inline-panel-header">
          <div>
            <h1>Schedule</h1>
            <p>View publishing schedules and deadline warnings. Assistant cannot edit them.</p>
          </div>
          <div class="inline-panel-actions">
            <button id="assistant-refresh-schedule" class="btn-publish"><i class="fa-solid fa-rotate"></i> Refresh</button>
          </div>
        </div>
        <div id="assistant-schedule-root" class="card-box api-loading">Loading schedule...</div>`;

      const root = $("#assistant-schedule-root");
      try {
        const series = await loadScheduleSeriesForAssistant();

        if (!series.length) {
          root.innerHTML = `<div class="board-filter-note readonly-schedule-note"><i class="fa-solid fa-lock"></i> Schedule is view-only for Assistant.</div><div class="empty-state-box">No series schedule available.</div>`;
          return;
        }

        const activeId = Api.getActiveSeriesId?.() || seriesIdOf(series[0]);
        const activeSeries = series.find(s => String(seriesIdOf(s)) === String(activeId)) || series[0];
        const seriesId = seriesIdOf(activeSeries);
        Api.setActiveSeriesId?.(seriesId);

        const [schedules, deadlines, assistantTasks] = await Promise.all([
          Api.schedules?.(seriesId).catch(() => []) || [],
          Api.deadlines?.(seriesId).catch(() => []) || [],
          Api.tasks?.().catch(() => []) || []
        ]);

        const myTaskDeadlines = taskDeadlineRows(getArray(assistantTasks), seriesId);
        const mergedDeadlines = [...getArray(deadlines), ...myTaskDeadlines];

        root.innerHTML = `
          <div class="toolbar-row">
            <select id="assistant-schedule-series" class="form-control compact-control">
              ${series.map(s => `<option value="${esc(seriesIdOf(s))}" ${String(seriesIdOf(s)) === String(seriesId) ? "selected" : ""}>#${esc(seriesIdOf(s))} — ${esc(seriesTitleOf(s))}</option>`).join("")}
            </select>
          </div>
          <div class="board-filter-note readonly-schedule-note">
            <i class="fa-solid fa-lock"></i> View-only schedule. Only Mangaka can add, edit, or delete schedule/deadline items.
          </div>
          <div class="readonly-schedule-tabs">
            <button type="button" class="readonly-schedule-tab active" data-readonly-tab="calendar"><i class="fa-solid fa-calendar-days"></i> Publishing Calendar</button>
            <button type="button" class="readonly-schedule-tab" data-readonly-tab="deadlines"><i class="fa-solid fa-triangle-exclamation"></i> Deadline Monitor</button>
          </div>
          <div id="readonly-calendar-panel" class="readonly-schedule-panel active">
            <div class="card-box">
              <div class="section-title-row"><h2>Publishing Calendar</h2><span class="schedule-count">${schedules.length} schedules</span></div>
              <table class="data-table dashboard-schedule-table">
                <thead><tr><th>Publish Date</th><th>Frequency</th><th>Series</th><th>Permission</th></tr></thead>
                <tbody>${schedules.map(sc => `<tr><td>${esc(fmtScheduleDate(sc.publishDate || sc.date || sc.scheduledDate))}</td><td>${esc(sc.frequency || sc.repeatType || "—")}</td><td>${esc(seriesTitleOf(activeSeries))}</td><td><span class="schedule-badge neutral">View only</span></td></tr>`).join("") || `<tr><td colspan="4">No schedule for selected series.</td></tr>`}</tbody>
              </table>
            </div>
          </div>
          <div id="readonly-deadlines-panel" class="readonly-schedule-panel">
            <div class="card-box assistant-task-deadlines-card">
              <div class="section-title-row"><h2>My Task Deadlines</h2><span class="schedule-count">${myTaskDeadlines.length} tasks</span></div>
              <p class="muted-note">These are created when Mangaka sends a task to Assistant with a deadline.</p>
              <table class="data-table dashboard-schedule-table">
                <thead><tr><th>Task</th><th>Deadline</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>${myTaskDeadlines.map(d => `<tr><td>${esc(d.eventName || d.title || "Task deadline")}</td><td>${esc(fmtScheduleDate(d.deadlineDate || d.deadlineDateStr || d.date))}</td><td>${scheduleBadge(d.status || "OPEN")}</td><td>${d.taskId ? `<a class="btn-outline" href="task-detail.html" onclick="localStorage.setItem('currentTaskId','${esc(d.taskId)}')">Open task</a>` : `<span class="schedule-badge neutral">View only</span>`}</td></tr>`).join("") || `<tr><td colspan="4">No assigned task deadlines for selected series.</td></tr>`}</tbody>
              </table>
            </div>
            <div class="card-box">
              <div class="section-title-row"><h2>Deadline Monitor</h2><span class="schedule-count">${mergedDeadlines.length} deadlines</span></div>
              <table class="data-table dashboard-schedule-table">
                <thead><tr><th>Task/Event</th><th>Deadline</th><th>Risk</th><th>Permission</th></tr></thead>
                <tbody>${mergedDeadlines.map(d => `<tr><td>${esc(d.eventName || d.title || "Untitled deadline")}</td><td>${esc(fmtScheduleDate(d.deadlineDate || d.deadlineDateStr || d.date))}</td><td>${scheduleBadge(scheduleRisk(d))}</td><td><span class="schedule-badge neutral">View only</span></td></tr>`).join("") || `<tr><td colspan="4">No deadlines for selected series.</td></tr>`}</tbody>
              </table>
            </div>
          </div>
        `;

        $("#assistant-schedule-series")?.addEventListener("change", (event) => {
          Api.setActiveSeriesId?.(event.target.value);
          renderReadOnlySchedule();
        });

        $$(".readonly-schedule-tab").forEach(button => {
          button.addEventListener("click", () => {
            const tab = button.dataset.readonlyTab;
            $$(".readonly-schedule-tab").forEach(item => item.classList.toggle("active", item === button));
            $$(".readonly-schedule-panel").forEach(panel => panel.classList.toggle("active", panel.id === `readonly-${tab}-panel`));
          });
        });
      } catch (error) {
        root.innerHTML = errorBox(error);
      }

      $("#assistant-refresh-schedule")?.addEventListener("click", renderReadOnlySchedule);
    }


    async function renderKanban() {
      inlinePanel.innerHTML = `
        <div class="inline-panel-header">
          <div>
            <h1>Kanban Tasks</h1>
            <p>Update your assigned tasks directly inside the Assistant dashboard.</p>
          </div>
          <div class="inline-panel-actions">
            <button id="assistant-refresh-kanban" class="btn-publish"><i class="fa-solid fa-rotate"></i> Refresh</button>
          </div>
        </div>

        <div class="kanban-grid backend-kanban assistant-kanban-grid">
          <div class="kanban-column" data-status="TODO">
            <h3>Todo <span id="assistant-count-TODO">0</span></h3>
            <div class="kanban-drop" id="assistant-col-TODO"></div>
          </div>
          <div class="kanban-column" data-status="DOING">
            <h3>Doing <span id="assistant-count-DOING">0</span></h3>
            <div class="kanban-drop" id="assistant-col-DOING"></div>
          </div>
          <div class="kanban-column" data-status="REVIEWING">
            <h3>Reviewing <span id="assistant-count-REVIEWING">0</span></h3>
            <div class="kanban-drop" id="assistant-col-REVIEWING"></div>
          </div>
          <div class="kanban-column" data-status="APPROVED">
            <h3>Approved <span id="assistant-count-APPROVED">0</span></h3>
            <div class="kanban-drop" id="assistant-col-APPROVED"></div>
          </div>
        </div>
      `;

      const statuses = ["TODO", "DOING", "REVIEWING", "APPROVED"];
      const normalize = (status) => Api.normalizeTaskStatus
        ? Api.normalizeTaskStatus(status)
        : String(status || "TODO").toUpperCase();

      function taskCard(task) {
        const id = task.id ?? task.taskId;
        const status = normalize(task.status);
        const title = task.title || task.description || `Task #${id}`;
        const description = task.description && task.description !== title ? task.description : "";
        const pageInfo = task.pageNumber ? `Page ${task.pageNumber}` : "Assigned task";
        const locked = status === "REVIEWING" || status === "APPROVED";

        return `<div class="kanban-card backend-task-card ${locked ? "submitted-locked-card" : ""}" draggable="${locked ? "false" : "true"}" data-id="${esc(id)}" data-locked="${locked}">
          <strong>${esc(title)}</strong>
          ${description ? `<p>${esc(description)}</p>` : ""}
          <small>${esc(pageInfo)} · ${esc(status)}</small>
          ${locked
            ? `<span class="assistant-submitted-lock"><i class="fa-solid fa-lock"></i> ${status === "APPROVED" ? "Approved - Locked" : "Submitted - Waiting Review"}</span>`
            : `<button type="button" class="assistant-upload-card-btn"><i class="fa-solid fa-cloud-arrow-up"></i> Open Upload</button>`}
        </div>`;
      }

      async function loadTasks() {
        statuses.forEach((status) => {
          $(`#assistant-col-${status}`).innerHTML = loading("Loading...");
          $(`#assistant-count-${status}`).textContent = "0";
        });

        try {
          const tasks = getArray(await Api.tasks());

          statuses.forEach((status) => {
            const items = tasks.filter((task) => normalize(task.status) === status);
            $(`#assistant-count-${status}`).textContent = items.length;
            $(`#assistant-col-${status}`).innerHTML = items.length
              ? items.map(taskCard).join("")
              : `<div class="empty-column">Drop tasks here</div>`;
          });

          $$(".backend-task-card").forEach((card) => {
            const openUpload = () => {
              if (!card.dataset.id) return;
              localStorage.setItem("currentTaskId", card.dataset.id);
              window.location.href = "task-detail.html";
            };

            card.querySelector(".assistant-upload-card-btn")?.addEventListener("click", (event) => {
              event.preventDefault();
              event.stopPropagation();
              openUpload();
            });

            card.addEventListener("click", () => {
              if (card.dataset.locked === "true") {
                localStorage.setItem("currentTaskId", card.dataset.id);
                window.location.href = "task-detail.html";
              }
            });

            card.addEventListener("dragstart", (event) => {
              if (card.dataset.locked === "true") {
                event.preventDefault();
                return;
              }
              event.dataTransfer.setData("text/plain", card.dataset.id);
            });
          });
        } catch (error) {
          statuses.forEach((status) => {
            $(`#assistant-col-${status}`).innerHTML = errorBox(error);
          });
        }
      }

      $$(".kanban-column").forEach((column) => {
        const drop = column.querySelector(".kanban-drop");
        const status = column.dataset.status;

        drop.addEventListener("dragover", (event) => {
          event.preventDefault();
          drop.classList.add("drag-over");
        });

        drop.addEventListener("dragleave", () => {
          drop.classList.remove("drag-over");
        });

        drop.addEventListener("drop", async (event) => {
          event.preventDefault();
          drop.classList.remove("drag-over");

          const taskId = event.dataTransfer.getData("text/plain");
          if (!taskId) return;

          try {
            await Api.updateTaskStatus(taskId, status);
            await loadTasks();
          } catch (error) {
            alert("Update status failed: " + error.message);
          }
        });
      });

      $("#assistant-refresh-kanban").addEventListener("click", loadTasks);
      loadTasks();
    }
  });
})();
