
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

      if (!series.length) {
        try {
          const tasks = getArray(await Api.tasks?.());
          const map = new Map();
          tasks.forEach(task => {
            const id = task.seriesId || task.mangaSeriesId || task.series?.id || task.mangaSeries?.id;
            if (!id) return;
            map.set(String(id), {
              id,
              title: task.seriesTitle || task.mangaSeriesTitle || task.series?.title || task.mangaSeries?.title || `Series #${id}`
            });
          });
          series = Array.from(map.values());
        } catch (error) {
          console.warn("Assistant could not infer series from tasks.", error.message);
        }
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

        const [schedules, deadlines] = await Promise.all([
          Api.schedules?.(seriesId).catch(() => []) || [],
          Api.deadlines?.(seriesId).catch(() => []) || []
        ]);

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
            <div class="card-box">
              <div class="section-title-row"><h2>Deadline Monitor</h2><span class="schedule-count">${deadlines.length} deadlines</span></div>
              <table class="data-table dashboard-schedule-table">
                <thead><tr><th>Task/Event</th><th>Deadline</th><th>Risk</th><th>Permission</th></tr></thead>
                <tbody>${deadlines.map(d => `<tr><td>${esc(d.eventName || d.title || "Untitled deadline")}</td><td>${esc(fmtScheduleDate(d.deadlineDate || d.deadlineDateStr || d.date))}</td><td>${scheduleBadge(scheduleRisk(d))}</td><td><span class="schedule-badge neutral">View only</span></td></tr>`).join("") || `<tr><td colspan="4">No deadlines for selected series.</td></tr>`}</tbody>
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
