
document.addEventListener("DOMContentLoaded", () => {
  const Api = window.MangaApi;
  const statuses = ["TODO", "DOING", "REVIEWING", "APPROVED"];
  let tasks = [];


  const esc = (value = "") => String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));

  let assistantDirectory = {};

  function getArray(value) {
    return Array.isArray(value) ? value : (value?.content || value?.data || value?.items || []);
  }

  function userIdOf(user = {}) {
    return user.id ?? user.userId ?? user.accountId ?? "";
  }

  function userNameOf(user = {}) {
    return user.fullName || user.name || user.username || user.email || "";
  }

  async function loadAssistantDirectory() {
    const users = [];
    try { users.push(...getArray(await Api.assistants?.())); } catch (_) {}
    if (!users.length) {
      try { users.push(...getArray(await Api.users?.())); } catch (_) {}
    }

    assistantDirectory = {};
    users.forEach((user) => {
      const id = userIdOf(user);
      const name = userNameOf(user);
      if (id && name) assistantDirectory[String(id)] = name;
    });
  }

  function localAssistantMap() {
    try { return JSON.parse(localStorage.getItem("taskAssistantMap") || "{}"); }
    catch (_) { return {}; }
  }

  function rememberTaskAssistant(taskId, assistantId, assistantName = "") {
    if (!taskId || !assistantId) return;
    const map = localAssistantMap();
    map[String(taskId)] = {
      assistantId: String(assistantId),
      assistantName: assistantName || assistantDirectory[String(assistantId)] || `Assistant #${assistantId}`
    };
    localStorage.setItem("taskAssistantMap", JSON.stringify(map));
  }

  function nestedUserName(value) {
    if (!value) return "";
    if (typeof value === "string") return value;
    return value.fullName || value.name || value.username || value.email || "";
  }

  function assistantIdOf(task = {}) {
    return (
      task.assistantId ??
      task.assigneeId ??
      task.assignedToId ??
      task.assignedUserId ??
      task.assistant?.id ??
      task.assignee?.id ??
      task.assignedTo?.id ??
      task.assignedUser?.id ??
      ""
    );
  }

  function assistantNameOf(task = {}) {
    const direct =
      task.assigneeName ||
      task.assistantName ||
      task.assignedToName ||
      task.assignedUserName ||
      nestedUserName(task.assistant) ||
      nestedUserName(task.assignee) ||
      nestedUserName(task.assignedTo) ||
      nestedUserName(task.assignedUser);

    if (direct && !/^unassigned$/i.test(String(direct).trim())) return direct;

    const taskId = task.id ?? task.taskId;
    const id = assistantIdOf(task);
    const local = localAssistantMap();

    if (taskId && local[String(taskId)]?.assistantName) return local[String(taskId)].assistantName;
    if (id && assistantDirectory[String(id)]) return assistantDirectory[String(id)];
    if (id && local[String(taskId)]?.assistantId === String(id) && local[String(taskId)]?.assistantName) return local[String(taskId)].assistantName;
    if (id) return `Assistant #${id}`;
    return "Unassigned";
  }


  function normalize(status) {
    return Api.normalizeTaskStatus ? Api.normalizeTaskStatus(status) : String(status || "TODO").toUpperCase();
  }

  function card(t) {
    const status = normalize(t.status);
    const id = t.id ?? t.taskId;
    const isAssistant = new URLSearchParams(location.search).get("actor") === "assistant" || String(localStorage.getItem("role") || "").toLowerCase().includes("assistant");
    const isMangaka = new URLSearchParams(location.search).get("actor") === "mangaka" || String(localStorage.getItem("role") || "").toLowerCase().includes("mangaka");
    const locked = isAssistant && (status === "REVIEWING" || status === "APPROVED");
    const canReview = isMangaka && status === "REVIEWING" && !!t.submittedImageUrl;
    return `<div class="kanban-card backend-task-card ${locked ? "submitted-locked-card" : ""} ${canReview ? "mangaka-review-card" : ""}" draggable="${locked || canReview ? "false" : "true"}" data-id="${id}" data-locked="${locked}" data-review="${canReview}">
      <strong>${esc(t.title || t.description || `Task #${id}`)}</strong>
      <p>${esc(t.description || "")}</p>
      <small>${esc(assistantNameOf(t))} · ${esc(status)}</small>
      ${locked ? `<span class="assistant-submitted-lock"><i class="fa-solid fa-lock"></i> ${status === "APPROVED" ? "Approved - Locked" : "Submitted - Waiting Review"}</span>` : ""}
      ${canReview ? `<button type="button" class="mangaka-review-submission-btn" data-task-id="${id}"><i class="fa-solid fa-eye"></i> Review Submitted Image</button>` : ""}
    </div>`;
  }

  async function loadTasks() {
    statuses.forEach(s => {
      document.getElementById(`col-${s}`).innerHTML = `<div class="api-loading">Loading...</div>`;
      document.getElementById(`count-${s}`).textContent = "0";
    });
    try {
      await loadAssistantDirectory();
      tasks = await Api.tasks();
      if (!Array.isArray(tasks)) tasks = tasks?.content || [];
      statuses.forEach(s => {
        const items = tasks.filter(t => normalize(t.status) === s);
        document.getElementById(`count-${s}`).textContent = items.length;
        document.getElementById(`col-${s}`).innerHTML = items.map(card).join("") || `<div class="empty-column">Drop tasks here</div>`;
      });
      document.querySelectorAll(".backend-task-card").forEach(el => {
        const reviewBtn = el.querySelector(".mangaka-review-submission-btn");
        if (reviewBtn) {
          reviewBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            const taskId = el.dataset.id;
            localStorage.setItem("currentReviewTaskId", taskId);
            localStorage.setItem("currentTaskId", taskId);
            window.location.href = location.pathname.includes("/pages/mangaka/")
              ? `review.html?taskId=${encodeURIComponent(taskId)}`
              : `pages/mangaka/review.html?taskId=${encodeURIComponent(taskId)}`;
          });
        }

        el.addEventListener("dragstart", e => {
          if (el.dataset.locked === "true" || el.dataset.review === "true") {
            e.preventDefault();
            return;
          }
          e.dataTransfer.setData("text/plain", el.dataset.id);
        });
      });
    } catch (err) {
      statuses.forEach(s => document.getElementById(`col-${s}`).innerHTML = `<div class="api-error">${err.message}</div>`);
    }
  }

  document.querySelectorAll(".kanban-column").forEach(col => {
    const drop = col.querySelector(".kanban-drop");
    const status = col.dataset.status;
    drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("drag-over"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("drag-over"));
    drop.addEventListener("drop", async e => {
      e.preventDefault();
      drop.classList.remove("drag-over");
      const taskId = e.dataTransfer.getData("text/plain");
      if (!taskId) return;
      try {
        await Api.updateTaskStatus(taskId, status);
        await loadTasks();
      } catch (err) {
        alert("Update status failed: " + err.message);
      }
    });
  });

  document.getElementById("refresh-kanban")?.addEventListener("click", loadTasks);
  loadTasks();
});
