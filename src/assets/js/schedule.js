(function () {
  document.addEventListener("DOMContentLoaded", () => {
    const Api = window.MangaApi;
    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => Array.from(document.querySelectorAll(selector));

    const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));

    const getArray = (value) => Array.isArray(value) ? value : (value?.content || value?.data || value?.items || []);
    const role = localStorage.getItem("role") || localStorage.getItem("userRole") || "User";
    const normalizedRole = String(role || "").toLowerCase();
    const canEditSchedule = normalizedRole.includes("mangaka") || normalizedRole.includes("role_mangaka");

    function applySchedulePermissions() {
      const editorPanel = $("#schedule-editor-panel");
      const permissionNote = $("#schedule-permission-note");

      if (editorPanel) {
        editorPanel.hidden = !canEditSchedule;
        editorPanel.classList.toggle("schedule-readonly-hidden", !canEditSchedule);
      }

      if (permissionNote) {
        permissionNote.hidden = canEditSchedule;
        permissionNote.innerHTML = `
          <i class="fa-solid fa-lock"></i>
          <strong>View-only schedule.</strong>
          The current backend lets Mangaka create/edit/delete publishing schedules. ${esc(role)} can view deadlines but edit controls are disabled.
        `;
      }
    }

    function normalizeDate(item) {
      return item.deadlineDate || item.deadlineDateStr || item.date || item.dueDate || item.scheduledDate || "";
    }

    function normalizeStatus(item) {
      return String(item.status || item.state || "OPEN").toUpperCase();
    }

    function daysUntil(dateStr) {
      if (!dateStr) return null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const target = new Date(dateStr);
      target.setHours(0, 0, 0, 0);
      return Math.round((target - today) / 86400000);
    }

    function dateBadge(dateStr) {
      const days = daysUntil(dateStr);
      if (days === null || Number.isNaN(days)) return `<span class="schedule-badge neutral">No date</span>`;
      if (days < 0) return `<span class="schedule-badge danger">Overdue ${Math.abs(days)}d</span>`;
      if (days === 0) return `<span class="schedule-badge warning">Today</span>`;
      if (days <= 3) return `<span class="schedule-badge warning">${days}d left</span>`;
      return `<span class="schedule-badge success">${days}d left</span>`;
    }

    async function loadBackendDeadlines() {
      if (!Api?.allSeries || !Api?.deadlines) return [];
      let seriesList = [];
      try {
        seriesList = getArray(await Api.allSeries());
      } catch (_) {
        return [];
      }

      const deadlineGroups = await Promise.all(seriesList.slice(0, 25).map(async (series) => {
        const seriesId = series.id ?? series.seriesId;
        if (!seriesId) return [];
        try {
          const deadlines = getArray(await Api.deadlines(seriesId));
          return deadlines.map((item) => ({
            id: `backend-${item.id ?? item.eventId ?? seriesId}-${item.eventName || item.title || item.deadlineDateStr || ""}`,
            backendId: item.id ?? item.eventId,
            source: "BACKEND_DEADLINE",
            title: item.eventName || item.title || "Series deadline",
            description: item.description || "",
            seriesId,
            seriesTitle: series.title || series.name || `Series #${seriesId}`,
            date: item.deadlineDateStr || item.deadlineDate || item.date,
            deadlineDate: item.deadlineDateStr || item.deadlineDate || item.date,
            status: item.status || "OPEN"
          }));
        } catch (_) {
          return [];
        }
      }));

      return deadlineGroups.flat();
    }

    function mergeItems(...lists) {
      const map = new Map();
      lists.flat().filter(Boolean).forEach((item) => {
        const key = String(item.id || `${item.source}-${item.title}-${normalizeDate(item)}`);
        map.set(key, { ...(map.get(key) || {}), ...item });
      });
      return Array.from(map.values()).sort((a, b) => String(normalizeDate(a)).localeCompare(String(normalizeDate(b))));
    }

    function renderItems(items) {
      const list = $("#schedule-list");
      const count = $("#schedule-count");
      const statusFilter = $("#schedule-status-filter")?.value || "ALL";
      const search = ($("#schedule-search")?.value || "").trim().toLowerCase();

      let visible = items;
      if (statusFilter !== "ALL") visible = visible.filter((item) => normalizeStatus(item) === statusFilter);
      if (search) {
        visible = visible.filter((item) => [
          item.title, item.description, item.seriesTitle, item.chapterTitle, item.assistantName, item.type
        ].join(" ").toLowerCase().includes(search));
      }

      if (count) count.textContent = String(visible.length);

      if (!visible.length) {
        list.innerHTML = `<div class="empty-state-box">No schedule items found.</div>`;
        return;
      }

      list.innerHTML = visible.map((item) => {
        const date = normalizeDate(item);
        const local = String(item.id || "").startsWith("local-") || item.source === "MANGAKA_CANVAS" || item.source === "MANUAL";
        return `
          <article class="schedule-item ${normalizeStatus(item) === "DONE" ? "done" : ""}">
            <div class="schedule-item-main">
              <div class="schedule-item-title-row">
                <h3>${esc(item.title || item.eventName || "Untitled deadline")}</h3>
                ${dateBadge(date)}
              </div>
              <p>${esc(item.description || "No description.")}</p>
              <div class="schedule-meta">
                ${item.seriesTitle ? `<span><i class="fa-solid fa-book"></i> ${esc(item.seriesTitle)}</span>` : ""}
                ${item.chapterTitle ? `<span><i class="fa-solid fa-layer-group"></i> ${esc(item.chapterTitle)}</span>` : ""}
                ${item.assistantName ? `<span><i class="fa-solid fa-user"></i> ${esc(item.assistantName)}</span>` : ""}
                <span><i class="fa-solid fa-calendar-day"></i> ${esc(date || "No date")}</span>
                <span>${esc(item.source || item.type || "Schedule")}</span>
              </div>
            </div>
            <div class="schedule-actions">
              ${canEditSchedule ? `<button type="button" class="btn-outline mini-btn" data-toggle-done="${esc(item.id)}">${normalizeStatus(item) === "DONE" ? "Reopen" : "Mark Done"}</button>` : `<span class="schedule-badge neutral">View only</span>`}
              ${canEditSchedule && local ? `<button type="button" class="btn-outline mini-btn danger" data-delete-item="${esc(item.id)}">Delete</button>` : ""}
            </div>
          </article>`;
      }).join("");

      if (canEditSchedule) {
        $$("[data-toggle-done]").forEach((button) => {
          button.addEventListener("click", () => {
            const current = items.find((item) => String(item.id) === String(button.dataset.toggleDone));
            if (!current || !Api?.updateScheduleItem) return;
            Api.updateScheduleItem(current.id, { status: normalizeStatus(current) === "DONE" ? "OPEN" : "DONE" });
            loadAndRender();
          });
        });

        $$("[data-delete-item]").forEach((button) => {
          button.addEventListener("click", () => {
            if (!confirm("Delete this local schedule item?")) return;
            Api?.deleteScheduleItem?.(button.dataset.deleteItem);
            loadAndRender();
          });
        });
      }
    }

    async function loadAndRender() {
      const list = $("#schedule-list");
      list.innerHTML = `<div class="api-loading">Loading schedule...</div>`;

      const localItems = Api?.getScheduleItems?.() || [];
      const backendItems = await loadBackendDeadlines();
      const items = mergeItems(backendItems, localItems);
      window.__studioScheduleItems = items;
      renderItems(items);
    }

    $("#schedule-status-filter")?.addEventListener("change", () => renderItems(window.__studioScheduleItems || []));
    $("#schedule-search")?.addEventListener("input", () => renderItems(window.__studioScheduleItems || []));
    $("#schedule-refresh")?.addEventListener("click", loadAndRender);

    $("#manual-schedule-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!canEditSchedule) {
        alert("Only Mangaka can create or edit publishing schedules in the current backend flow.");
        return;
      }

      const title = $("#manual-title").value.trim();
      const date = $("#manual-date").value;
      if (!title || !date) return alert("Enter title and date.");

      Api?.addScheduleItem?.({
        source: "MANGAKA_MANUAL",
        type: "PUBLISHING_SCHEDULE",
        title,
        description: $("#manual-description").value.trim(),
        deadlineDate: date,
        date,
        status: "OPEN",
        createdByRole: role
      });

      event.target.reset();
      loadAndRender();
    });

    $("#schedule-role-label").textContent = role;
    applySchedulePermissions();
    loadAndRender();
  });
})();
