
document.addEventListener("DOMContentLoaded", () => {
  const Api = window.MangaApi;
  const statuses = ["TODO", "DOING", "REVIEWING", "APPROVED"];
  let tasks = [];

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
      <strong>${t.title || t.description || `Task #${id}`}</strong>
      <p>${t.description || ""}</p>
      <small>${t.assigneeName || t.assistantName || "Unassigned"} · ${status}</small>
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
