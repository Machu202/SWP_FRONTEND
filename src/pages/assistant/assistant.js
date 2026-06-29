// Backend-compatible Assistant screens for SWP_BACKEND-main(3)
document.addEventListener("DOMContentLoaded", () => {
  if (!window.MangaApi) return;
  const esc = (value = "") => String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const statusOf = (task) => window.MangaApi.normalizeTaskStatus(task?.status || "TODO");
  const titleOf = (task) => task?.title || task?.description || `Task #${task?.id || ""}`;
  const seriesTitleOf = (task) => task?.seriesTitle || task?.hitbox?.page?.chapter?.mangaSeries?.title || "Manga Series";
  const chapterNoOf = (task) => task?.chapterNumber || task?.hitbox?.page?.chapter?.chapterNumber || "?";
  const pageUrlOf = (task) => task?.referenceImageUrl || task?.hitbox?.page?.imageUrl || task?.submittedImageUrl || "";
  async function loadTasks() { try { return await window.MangaApi.tasks(); } catch (err) { console.warn("Assistant tasks unavailable:", err.message); return []; } }
  async function findTask(taskId) { const tasks = await loadTasks(); return tasks.find(t => String(t.id) === String(taskId)); }
  const astDashboardList = document.getElementById("ast-dashboard-task-list");
  if (astDashboardList) {
    (async () => {
      const tasks = await loadTasks();
      const activeTasks = tasks.filter(t => statusOf(t) !== "APPROVED");
      const approvedCount = tasks.filter(t => statusOf(t) === "APPROVED").length;
      const total = Math.max(tasks.length, 1);
      const pct = Math.round((approvedCount / total) * 100);
      if (document.getElementById("pages-completed")) document.getElementById("pages-completed").innerHTML = `${approvedCount} <span>/ ${tasks.length} Tasks</span>`;
      if (document.getElementById("progress-bar-fill")) document.getElementById("progress-bar-fill").style.width = pct + "%";
      if (document.getElementById("progress-text")) document.getElementById("progress-text").innerText = pct + "% Completed";
      if (document.getElementById("target-project")) document.getElementById("target-project").innerText = activeTasks[0] ? seriesTitleOf(activeTasks[0]) : "No active project";
      if (document.getElementById("target-status")) document.getElementById("target-status").innerText = activeTasks[0] ? statusOf(activeTasks[0]) : "Idle";
      astDashboardList.innerHTML = activeTasks.length ? activeTasks.map(task => `
        <a href="task-detail.html" onclick="localStorage.setItem('currentTaskId','${task.id}')" class="ast-task-item">
          <div class="ast-task-thumb"><i class="fa-solid fa-image" style="font-size:24px;color:#9ca3af;display:flex;align-items:center;justify-content:center;height:100%;"></i></div>
          <div class="ast-task-info"><div class="ast-task-title">${esc(titleOf(task))} <span class="badge-tag" style="background:#f59e0b;">${esc(statusOf(task))}</span></div><div class="ast-task-sub">Project: ${esc(seriesTitleOf(task))}</div><div class="ast-task-meta"><span style="color:#6b7280;">Chapter ${esc(chapterNoOf(task))}</span></div></div>
        </a>`).join("") : `<div class="empty-state-box"><p>No assigned tasks returned by backend.</p></div>`;
      const deadlines = document.getElementById("ast-deadlines-list");
      if (deadlines) deadlines.innerHTML = activeTasks.slice(0, 3).map(t => `<div class="ast-deadline-item"><div class="date-box"><div class="date-month">TASK</div><div class="date-day">${t.id}</div></div><div><div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:4px;">${esc(titleOf(t))}</div><div style="font-size:11px;color:#ef4444;font-weight:600;">${esc(statusOf(t))}</div></div></div>`).join("") || `<div class="empty-activity">No upcoming task deadlines.</div>`;
    })();
  }
  const taskTitle = document.getElementById("task-title");
  if (taskTitle) {
    (async () => {
      const taskId = localStorage.getItem("currentTaskId") || new URLSearchParams(location.search).get("taskId");
      if (!taskId) { taskTitle.innerText = "No task selected"; return; }
      const task = await findTask(taskId);
      if (!task) { taskTitle.innerText = "Task not found in your assignments"; return; }
      taskTitle.innerText = titleOf(task);
      if (document.getElementById("task-desc")) document.getElementById("task-desc").innerText = task.description || "No description.";
      if (document.getElementById("task-status-tag")) document.getElementById("task-status-tag").innerText = statusOf(task);
      if (document.getElementById("task-breadcrumb")) document.getElementById("task-breadcrumb").innerHTML = `<span style="color:#6366f1;font-weight:600;">${esc(seriesTitleOf(task))}</span> &rsaquo; Chapter ${esc(chapterNoOf(task))} &rsaquo; Task #${esc(task.id)}`;
      if (document.getElementById("task-due-date")) document.getElementById("task-due-date").innerText = task.createdAt ? new Date(task.createdAt).toLocaleDateString() : "ASAP";
      if (document.getElementById("director-notes-content")) document.getElementById("director-notes-content").innerHTML = `<blockquote>${esc(task.description || "No extra notes.")}</blockquote>`;
      const ref = document.getElementById("ref-img-container");
      const img = pageUrlOf(task);
      if (ref && img) { ref.innerHTML = `<img src="${esc(img)}" class="ref-img">`; ref.style.padding = "0"; ref.style.background = "transparent"; ref.style.border = "none"; }
      else if (ref) ref.innerHTML = `No reference image attached to this task.`;
    })();
  }
  const resourceGrid = document.getElementById("resource-grid-container");
  if (resourceGrid) {
    (async () => {
      try {
        const resources = await window.MangaApi.resources();
        resourceGrid.innerHTML = (resources || []).length ? resources.map(rs => `<div class="resource-card"><div class="rs-thumb"><img src="${esc(rs.fileUrl || 'https://placehold.co/400x300/e2e8f0/94a3b8?text=Asset')}"><div class="rs-type-badge">${esc(rs.resourceType || 'ASSET')}</div></div><div class="rs-info"><div class="rs-title">Resource #${esc(rs.id)} <a href="${esc(rs.fileUrl || '#')}" target="_blank"><i class="fa-solid fa-download" style="color:#6366f1;cursor:pointer;"></i></a></div><div class="rs-desc">${esc(rs.publicId || '')}</div><div class="rs-meta"><div class="rs-author"><i class="fa-solid fa-user-pen"></i> Studio</div></div></div></div>`).join("") : `<div class="empty-state-box" style="grid-column:span 100%;"><p>No resources returned by backend.</p></div>`;
      } catch (error) {
        resourceGrid.innerHTML = `<div class="empty-state-box" style="grid-column:span 100%;color:#ef4444;"><p><i class="fa-solid fa-triangle-exclamation"></i> Resource load failed: ${esc(error.message)}</p></div>`;
      }
    })();
  }
});
