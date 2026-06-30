
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

    document.querySelectorAll("[data-assistant-panel]").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const panelName = link.dataset.assistantPanel || "dashboard";
        if (panelName === "kanban") showKanban();
        else showDashboard();
      });
    });

    if (location.hash === "#kanban") {
      showKanban();
    }

    function loading(message = "Loading...") {
      return `<div class="api-loading">${esc(message)}</div>`;
    }

    function errorBox(error) {
      return `<div class="api-error">${esc(error?.message || error || "Something went wrong")}</div>`;
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
