// Backend-compatible Assistant screens for SWP_BACKEND-main(3)
document.addEventListener("DOMContentLoaded", () => {
  if (!window.MangaApi) return;
  const esc = (value = "") => String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const statusOf = (task) => window.MangaApi.normalizeTaskStatus(task?.status || "TODO");
  const titleOf = (task) => task?.title || task?.description || `Task #${task?.id || ""}`;
  const seriesTitleOf = (task) => task?.seriesTitle || task?.hitbox?.page?.chapter?.mangaSeries?.title || "Manga Series";
  const chapterNoOf = (task) => task?.chapterNumber || task?.hitbox?.page?.chapter?.chapterNumber || "?";
  const pageUrlOf = (task) =>
    task?.referenceImageUrl ||
    task?.pageImageUrl ||
    task?.imageUrl ||
    task?.hitbox?.page?.imageUrl ||
    task?.hitbox?.pageImageUrl ||
    task?.submittedImageUrl ||
    "";
  async function resolveReferenceImage(task) {
    let imageUrl = pageUrlOf(task);
    if (imageUrl) return imageUrl;

    const pageId =
      task?.pageId ||
      task?.hitbox?.pageId ||
      task?.hitbox?.page?.id;

    if (pageId && window.MangaApi?.canvasInit) {
      try {
        const canvas = await window.MangaApi.canvasInit(pageId);
        imageUrl = canvas?.imageUrl || "";
      } catch (err) {
        console.warn("Could not resolve task reference image:", err.message);
      }
    }

    return imageUrl;
  }

  function firstNumber(...values) {
    for (const value of values) {
      if (value !== undefined && value !== null && value !== "") {
        const n = Number(value);
        if (!Number.isNaN(n)) return n;
      }
    }
    return null;
  }

  function clampPercent(value, fallback = 0) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return fallback;
    return Math.min(100, Math.max(0, Number(value)));
  }

  function hitboxOf(task) {
    const h = task?.hitbox || {};
    const x = firstNumber(task?.xCoord, task?.x, task?.xPercent, h?.xCoord, h?.x, h?.xPercent);
    const y = firstNumber(task?.yCoord, task?.y, task?.yPercent, h?.yCoord, h?.y, h?.yPercent);
    const width = firstNumber(task?.width, task?.w, task?.widthPercent, h?.width, h?.w, h?.widthPercent);
    const height = firstNumber(task?.height, task?.h, task?.heightPercent, h?.height, h?.h, h?.heightPercent);

    if (x === null || y === null || width === null || height === null) return null;

    return {
      x: clampPercent(x),
      y: clampPercent(y),
      width: Math.max(1, Math.min(100, Number(width))),
      height: Math.max(1, Math.min(100, Number(height))),
    };
  }

  function renderReferenceWithFixBox(imageUrl, task) {
    const box = hitboxOf(task);
    const detail = esc(task?.description || "No fix details were provided by Mangaka.");

    if (!box) {
      return `<div class="assistant-reference-wrap no-hitbox">
        <img src="${esc(imageUrl)}" class="ref-img" alt="Reference manga page from Mangaka">
        <div class="assistant-fix-callout">
          <strong><i class="fa-solid fa-clipboard-list"></i> What Mangaka needs fixed</strong>
          <p>${detail}</p>
          <small>No hitbox coordinates were included in this task, so only the note is shown.</small>
        </div>
      </div>`;
    }

    return `<div class="assistant-reference-wrap">
      <img src="${esc(imageUrl)}" class="ref-img" alt="Reference manga page from Mangaka">
      <div class="assistant-reference-hitbox" style="left:${box.x}%;top:${box.y}%;width:${box.width}%;height:${box.height}%;">
        <span>Fix this area</span>
      </div>
      <div class="assistant-fix-callout">
        <strong><i class="fa-solid fa-clipboard-list"></i> What Mangaka needs fixed</strong>
        <p>${detail}</p>
        <small>Marked area: X ${box.x.toFixed(1)}%, Y ${box.y.toFixed(1)}%, W ${box.width.toFixed(1)}%, H ${box.height.toFixed(1)}%</small>
      </div>
    </div>`;
  }

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
          <div class="ast-task-info"><div class="ast-task-title">${esc(titleOf(task))} <span class="badge-tag" style="background:#f59e0b;">${esc(statusOf(task))}</span></div><div class="ast-task-sub">Project: ${esc(seriesTitleOf(task))}</div><div class="ast-task-meta"><span style="color:#6b7280;">Chapter ${esc(chapterNoOf(task))}</span><span class="assistant-inline-upload-label"><i class="fa-solid fa-cloud-arrow-up"></i> Open Upload</span></div></div>
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
      const taskStatus = statusOf(task);
      const alreadySubmitted = taskStatus === "REVIEWING" || taskStatus === "APPROVED";
      taskTitle.innerText = titleOf(task);
      document.body.classList.toggle("assistant-task-submitted", alreadySubmitted);
      if (document.getElementById("task-desc")) document.getElementById("task-desc").innerText = task.description || "No description.";
      if (document.getElementById("task-status-tag")) document.getElementById("task-status-tag").innerText = statusOf(task);
      if (document.getElementById("task-breadcrumb")) document.getElementById("task-breadcrumb").innerHTML = `<span style="color:#6366f1;font-weight:600;">${esc(seriesTitleOf(task))}</span> &rsaquo; Chapter ${esc(chapterNoOf(task))} &rsaquo; Task #${esc(task.id)}`;
      if (document.getElementById("task-due-date")) document.getElementById("task-due-date").innerText = task.createdAt ? new Date(task.createdAt).toLocaleDateString() : "ASAP";
      if (document.getElementById("director-notes-content")) {
        const box = hitboxOf(task);
        document.getElementById("director-notes-content").innerHTML = `
          <div class="assistant-fix-detail-card">
            <strong><i class="fa-solid fa-wand-magic-sparkles"></i> Fix Request</strong>
            <blockquote>${esc(task.description || "No extra notes.")}</blockquote>
            ${box ? `<div class="assistant-hitbox-coords">Hitbox: X ${box.x.toFixed(1)}%, Y ${box.y.toFixed(1)}%, W ${box.width.toFixed(1)}%, H ${box.height.toFixed(1)}%</div>` : `<div class="assistant-hitbox-coords missing">No hitbox coordinates included.</div>`}
          </div>`;
      }
      const ref = document.getElementById("ref-img-container");
      const img = await resolveReferenceImage(task);
      if (ref && img) {
        ref.innerHTML = renderReferenceWithFixBox(img, task);
        ref.style.padding = "0";
        ref.style.background = "transparent";
        ref.style.border = "none";
      } else if (ref) {
        ref.innerHTML = `<div class="assistant-ref-missing">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <strong>No reference image received.</strong>
          <span>This usually means the backend task response does not include <code>referenceImageUrl</code> or <code>pageId</code>.</span>
        </div>`;
      }

      const submitBox = document.getElementById("submit-work-box");
      if (!alreadySubmitted && task.submittedImageUrl && submitBox && !submitBox.querySelector(".assistant-revision-open-note")) {
        submitBox.insertAdjacentHTML("afterbegin", `
          <div class="assistant-revision-open-note">
            <strong><i class="fa-solid fa-rotate-left"></i> Revision requested</strong>
            <span>Your previous upload was sent back by Mangaka. Upload a new fixed version for review.</span>
          </div>
        `);
      }
      const topSubmitButton = document.getElementById("btn-submit-work");
      const submitButton = document.getElementById("btn-upload-submit");
      const chooseFileButton = document.getElementById("btn-choose-work-file");
      const dropzone = document.getElementById("file-dropzone");
      const checkFinal = document.getElementById("check-final-review");
      const selectedFile = document.getElementById("selected-work-file");

      if (alreadySubmitted && submitBox) {
        submitBox.classList.add("is-submitted-locked");
        if (topSubmitButton) {
          topSubmitButton.disabled = true;
          topSubmitButton.innerHTML = '<i class="fa-solid fa-lock"></i> Submitted';
        }
        if (submitButton) {
          submitButton.disabled = true;
          submitButton.classList.remove("is-ready");
          submitButton.innerHTML = '<i class="fa-solid fa-lock"></i> Locked - Waiting for Mangaka Review';
        }
        if (chooseFileButton) {
          chooseFileButton.disabled = true;
          chooseFileButton.innerHTML = '<i class="fa-solid fa-lock"></i> File Already Submitted';
        }
        if (dropzone) {
          dropzone.classList.add("is-locked");
          dropzone.innerHTML = `<i class="fa-solid fa-circle-check"></i>
            <p><b>Work submitted to Mangaka</b></p>
            <span>This upload is locked while the task is in review.</span>`;
        }
        if (checkFinal) {
          checkFinal.checked = true;
          checkFinal.disabled = true;
        }
        if (selectedFile) {
          selectedFile.classList.add("has-file");
          selectedFile.innerHTML = task.submittedImageUrl
            ? `<i class="fa-solid fa-file-circle-check"></i> Submitted file: <a href="${esc(task.submittedImageUrl)}" target="_blank" rel="noopener">Open submitted image</a>`
            : `<i class="fa-solid fa-file-circle-check"></i> Submitted. Waiting for Mangaka review.`;
        }

        if (task.submittedImageUrl && submitBox.querySelector(".assistant-submitted-preview") === null) {
          submitBox.insertAdjacentHTML("beforeend", `
            <div class="assistant-submitted-preview">
              <strong><i class="fa-solid fa-image"></i> Submitted Image</strong>
              <a href="${esc(task.submittedImageUrl)}" target="_blank" rel="noopener">
                <img src="${esc(task.submittedImageUrl)}" alt="Submitted work">
              </a>
            </div>
          `);
        }
      }
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
