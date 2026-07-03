// Backend-compatible Assistant screens for SWP_BACKEND-main(3)
document.addEventListener("DOMContentLoaded", () => {
  if (!window.MangaApi) return;
  const esc = (value = "") => String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const statusOf = (task) => window.MangaApi.normalizeTaskStatus(task?.status || "TODO");
  function assistantTaskDeadlineOf(task = {}) {
    const direct = task.deadlineDate || task.deadlineDateStr || task.deadline || task.dueDate || task.due_date || task.taskDeadline || task.task_deadline;
    if (direct) return direct;
    const text = String([task.title, task.description, task.note, task.comment].filter(Boolean).join(" "));
    const match = text.match(/(?:deadline|due)\s*[:：-]?\s*(\d{4}[/-]\d{1,2}[/-]\d{1,2}(?:[ T]\d{1,2}:\d{2})?)/i);
    return match ? match[1].replace(/\//g, "-") : "";
  }

  function assistantTaskDeadlineRows(tasks = []) {
    let localItems = [];
    try { localItems = window.MangaApi.getScheduleItems?.() || JSON.parse(localStorage.getItem("studioScheduleItems") || "[]"); }
    catch (_) { localItems = []; }

    const taskIds = new Set(tasks.map(t => String(t.id ?? t.taskId)).filter(Boolean));
    const fromTasks = tasks.map(task => {
      const deadline = assistantTaskDeadlineOf(task);
      if (!deadline) return null;
      return { task, taskId: task.id ?? task.taskId, title: titleOf(task), deadline, status: statusOf(task) };
    }).filter(Boolean);

    const fromLocal = localItems
      .filter(item => String(item.type || item.source || "").toUpperCase().includes("TASK_DEADLINE"))
      .filter(item => taskIds.has(String(item.taskId || item.task_id || "")))
      .map(item => ({
        task: tasks.find(t => String(t.id ?? t.taskId) === String(item.taskId || item.task_id || "")) || {},
        taskId: item.taskId || item.task_id || "",
        title: item.title || item.eventName || item.description || `Task #${item.taskId || ""}`,
        deadline: item.deadlineDateStr || item.deadlineDate || item.date || item.dueDate,
        status: item.status || "OPEN"
      }));

    const seen = new Set();
    return [...fromTasks, ...fromLocal].filter(row => {
      const key = `${row.taskId}|${row.deadline}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  }

  function formatAssistantDeadline(value) {
    if (!value) return "ASAP";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).replace("T", " ");
    return date.toLocaleDateString();
  }


  const titleOf = (task) => task?.title || task?.description || `Task #${task?.id || ""}`;
  const seriesTitleOf = (task) => task?.seriesTitle || task?.hitbox?.page?.chapter?.mangaSeries?.title || "Manga Series";
  const chapterNoOf = (task) => task?.chapterNumber || task?.hitbox?.page?.chapter?.chapterNumber || "?";
  function firstUsableUrl(value) {
    if (!value) return "";

    if (typeof value === "string") {
      const text = value.trim();
      if (!text) return "";

      if ((text.startsWith("{") && text.endsWith("}")) || (text.startsWith("[") && text.endsWith("]"))) {
        try { return firstUsableUrl(JSON.parse(text)); } catch (_) { return text; }
      }

      return text;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const url = firstUsableUrl(item);
        if (url) return url;
      }
      return "";
    }

    if (typeof value === "object") {
      return firstUsableUrl(
        value.referenceImageUrl ||
        value.pageImageUrl ||
        value.mangaPageImageUrl ||
        value.originalImageUrl ||
        value.draftImageUrl ||
        value.imageUrl ||
        value.url ||
        value.fileUrl ||
        value.resourceUrl ||
        value.secureUrl ||
        value.downloadUrl ||
        value.path ||
        value.image ||
        value.file ||
        value.data ||
        ""
      );
    }

    return "";
  }

  function mediaUrl(value) {
    const url = firstUsableUrl(value);
    if (!url) return "";
    if (/^(data:|blob:|https?:\/\/)/i.test(url)) return url;
    return window.MangaApi?.resolveMediaUrl?.(url) || url;
  }

  function safeFileName(value = "mangaka-reference") {
    return String(value || "mangaka-reference")
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "-")
      .slice(0, 80) || "mangaka-reference";
  }

  function extensionFromUrl(url = "") {
    const clean = String(url).split("?")[0].split("#")[0];
    const match = clean.match(/\.([a-z0-9]{2,5})$/i);
    return match ? match[1].toLowerCase() : "png";
  }

  function referenceDownloadFileName(task = {}, imageUrl = "") {
    const base = [
      seriesTitleOf(task),
      `chapter-${chapterNoOf(task)}`,
      `task-${task?.id ?? task?.taskId ?? "reference"}`
    ].filter(Boolean).join("-");
    return `${safeFileName(base)}.${extensionFromUrl(imageUrl)}`;
  }

  async function downloadImageFromUrl(url, filename = "mangaka-reference.png") {
    if (!url) return;

    try {
      const response = await fetch(url, { mode: "cors" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    } catch (error) {
      console.warn("Blob download failed, falling back to direct image link:", error.message);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.target = "_blank";
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  }

  window.downloadAssistantReferenceImage = (encodedUrl, encodedFilename) => {
    const url = decodeURIComponent(encodedUrl || "");
    const filename = decodeURIComponent(encodedFilename || "mangaka-reference.png");
    downloadImageFromUrl(url, filename);
  };

  function localTaskReferenceMap() {
    try { return JSON.parse(localStorage.getItem("taskReferenceMap") || "{}"); }
    catch (_) { return {}; }
  }

  function pageUrlOf(task) {
    return mediaUrl([
      task?.referenceImageUrl,
      task?.pageImageUrl,
      task?.mangaPageImageUrl,
      task?.originalImageUrl,
      task?.draftImageUrl,
      task?.sourceImageUrl,
      task?.page?.imageUrl,
      task?.page?.pageImageUrl,
      task?.page?.fileUrl,
      task?.mangaPage?.imageUrl,
      task?.mangaPage?.pageImageUrl,
      task?.mangaPage?.fileUrl,
      task?.backendPage?.imageUrl,
      task?.workspacePage?.imageUrl,
      task?.hitbox?.page?.imageUrl,
      task?.hitbox?.page?.pageImageUrl,
      task?.hitbox?.page?.fileUrl,
      task?.hitbox?.mangaPage?.imageUrl,
      task?.hitbox?.mangaPage?.fileUrl,
      task?.hitbox?.backendPage?.imageUrl,
      task?.hitbox?.pageImageUrl,
      task?.hitbox?.imageUrl
    ]);
  }

  function pageIdOf(task) {
    return (
      task?.pageId ||
      task?.mangaPageId ||
      task?.backendPageId ||
      task?.workspacePageId ||
      task?.page?.id ||
      task?.page?.pageId ||
      task?.mangaPage?.id ||
      task?.mangaPage?.pageId ||
      task?.backendPage?.id ||
      task?.workspacePage?.id ||
      task?.hitbox?.pageId ||
      task?.hitbox?.mangaPageId ||
      task?.hitbox?.backendPageId ||
      task?.hitbox?.page?.id ||
      task?.hitbox?.page?.pageId ||
      task?.hitbox?.mangaPage?.id ||
      task?.hitbox?.backendPage?.id ||
      ""
    );
  }

  function chapterIdOf(task) {
    return (
      task?.chapterId ||
      task?.mangaChapterId ||
      task?.chapter?.id ||
      task?.chapter?.chapterId ||
      task?.page?.chapterId ||
      task?.page?.chapter?.id ||
      task?.mangaPage?.chapterId ||
      task?.hitbox?.page?.chapterId ||
      task?.hitbox?.page?.chapter?.id ||
      task?.hitbox?.mangaPage?.chapterId ||
      ""
    );
  }

  function pageNumberOf(task) {
    return (
      task?.pageNumber ||
      task?.pageNo ||
      task?.page?.pageNumber ||
      task?.mangaPage?.pageNumber ||
      task?.backendPage?.pageNumber ||
      task?.hitbox?.page?.pageNumber ||
      task?.hitbox?.mangaPage?.pageNumber ||
      ""
    );
  }

  function seriesIdOf(task) {
    return (
      task?.seriesId ||
      task?.mangaSeriesId ||
      task?.series?.id ||
      task?.mangaSeries?.id ||
      task?.chapter?.seriesId ||
      task?.chapter?.mangaSeriesId ||
      task?.page?.chapter?.seriesId ||
      task?.page?.chapter?.mangaSeriesId ||
      task?.page?.chapter?.mangaSeries?.id ||
      task?.hitbox?.page?.chapter?.seriesId ||
      task?.hitbox?.page?.chapter?.mangaSeriesId ||
      task?.hitbox?.page?.chapter?.mangaSeries?.id ||
      ""
    );
  }

  function seriesTitleKey(task) {
    return String(
      task?.seriesTitle ||
      task?.mangaSeriesTitle ||
      task?.series?.title ||
      task?.series?.name ||
      task?.mangaSeries?.title ||
      task?.mangaSeries?.name ||
      ""
    ).trim().toLowerCase();
  }

  function taskIdOf(task) {
    return task?.id ?? task?.taskId ?? "";
  }

  async function imageFromCanvasPage(pageId) {
    if (!pageId || !window.MangaApi?.canvasInit) return "";
    try {
      const canvas = await window.MangaApi.canvasInit(pageId);
      return mediaUrl([
        canvas?.imageUrl,
        canvas?.pageImageUrl,
        canvas?.mangaPageImageUrl,
        canvas?.fileUrl,
        canvas?.url,
        canvas?.page?.imageUrl,
        canvas?.page?.fileUrl,
        canvas?.mangaPage?.imageUrl,
        canvas?.mangaPage?.fileUrl
      ]);
    } catch (err) {
      console.warn("Could not load canvas reference image:", err.message);
      return "";
    }
  }

  async function imageFromChapterPage(task) {
    const chapterId = chapterIdOf(task);
    if (!chapterId || !window.MangaApi?.pages) return "";

    try {
      const pages = await window.MangaApi.pages(chapterId);
      const list = Array.isArray(pages) ? pages : (pages?.content || []);
      const wantedPageNumber = String(pageNumberOf(task) || "");
      const selected =
        (wantedPageNumber && list.find((page) => String(page.pageNumber ?? page.number ?? page.pageNo) === wantedPageNumber)) ||
        list.find((page) => mediaUrl(page)) ||
        list[0];

      if (!selected) return "";

      const direct = mediaUrl(selected);
      if (direct) return direct;

      const selectedPageId = selected.id ?? selected.pageId;
      return imageFromCanvasPage(selectedPageId);
    } catch (err) {
      console.warn("Could not resolve chapter page reference:", err.message);
      return "";
    }
  }

  async function imageFromSeriesPage(task) {
    if (!window.MangaApi?.chapters || !window.MangaApi?.pages) return "";

    const knownSeriesId = seriesIdOf(task);
    const knownSeriesTitle = seriesTitleKey(task);
    const seriesCandidates = [];

    if (knownSeriesId) {
      seriesCandidates.push({ id: knownSeriesId });
    } else if (knownSeriesTitle && (window.MangaApi.mySeries || window.MangaApi.allSeries)) {
      const lists = [];

      try {
        if (window.MangaApi.mySeries) lists.push(await window.MangaApi.mySeries());
      } catch (_) {}

      try {
        if (window.MangaApi.allSeries) lists.push(await window.MangaApi.allSeries());
      } catch (_) {}

      lists.flatMap(item => Array.isArray(item) ? item : (item?.content || [])).forEach((series) => {
        const title = String(series?.title || series?.name || "").trim().toLowerCase();
        if (title && title === knownSeriesTitle) seriesCandidates.push(series);
      });
    }

    const seen = new Set();

    for (const series of seriesCandidates) {
      const seriesId = series?.id ?? series?.seriesId;
      if (!seriesId || seen.has(String(seriesId))) continue;
      seen.add(String(seriesId));

      let chapters = [];
      try { chapters = await window.MangaApi.chapters(seriesId); } catch (_) { chapters = []; }
      const chapterList = Array.isArray(chapters) ? chapters : (chapters?.content || []);
      const wantedChapterId = String(chapterIdOf(task) || "");

      const orderedChapters = [
        ...chapterList.filter(chapter => String(chapter.id ?? chapter.chapterId) === wantedChapterId),
        ...chapterList.filter(chapter => String(chapter.id ?? chapter.chapterId) !== wantedChapterId)
      ];

      for (const chapter of orderedChapters) {
        const chapterId = chapter?.id ?? chapter?.chapterId;
        if (!chapterId) continue;

        const imageUrl = await imageFromChapterPage({ ...task, chapterId });
        if (imageUrl) return imageUrl;
      }
    }

    return "";
  }

  async function resolveReferenceImage(task) {
    const taskId = taskIdOf(task);
    const localReference = taskId ? localTaskReferenceMap()[String(taskId)] : null;

    let imageUrl = pageUrlOf(task);
    if (imageUrl) return imageUrl;

    if (localReference?.imageUrl) return mediaUrl(localReference.imageUrl);

    const pageId = pageIdOf(task) || localReference?.pageId;
    imageUrl = await imageFromCanvasPage(pageId);
    if (imageUrl) return imageUrl;

    imageUrl = await imageFromChapterPage({ ...task, chapterId: chapterIdOf(task) || localReference?.chapterId });
    if (imageUrl) return imageUrl;

    imageUrl = await imageFromSeriesPage({ ...task, seriesId: seriesIdOf(task) || localReference?.seriesId });
    if (imageUrl) return imageUrl;

    return "";
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
    const fileName = referenceDownloadFileName(task, imageUrl);
    const downloadButton = `<button type="button" class="assistant-reference-download" onclick="window.downloadAssistantReferenceImage('${encodeURIComponent(imageUrl)}','${encodeURIComponent(fileName)}')">
        <i class="fa-solid fa-download"></i> Download Reference
      </button>`;

    if (!box) {
      return `<div class="assistant-reference-wrap no-hitbox">
        ${downloadButton}
        <img src="${esc(imageUrl)}" class="ref-img" alt="Reference manga page from Mangaka">
        <div class="assistant-fix-callout">
          <strong><i class="fa-solid fa-clipboard-list"></i> What Mangaka needs fixed</strong>
          <p>${detail}</p>
          <small>No hitbox coordinates were included in this task, so only the note is shown.</small>
        </div>
      </div>`;
    }

    return `<div class="assistant-reference-wrap">
      ${downloadButton}
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

  async function loadTasks() {
    try {
      const tasks = await window.MangaApi.tasks();
      return Array.isArray(tasks) ? tasks : (tasks?.content || []);
    } catch (err) {
      console.warn("Assistant tasks unavailable:", err.message);
      return [];
    }
  }

  async function findTask(taskId) {
    const tasks = await loadTasks();
    const fromList = tasks.find(t => String(t.id ?? t.taskId) === String(taskId));

    // Task list data may be shortened. The detail endpoint often contains the page/hitbox relation.
    if (window.MangaApi.taskDetail) {
      try {
        const detail = await window.MangaApi.taskDetail(taskId);
        return { ...(fromList || {}), ...(detail || {}) };
      } catch (err) {
        console.warn("Task detail endpoint did not return extra reference data:", err.message);
      }
    }

    return fromList;
  }
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
      if (deadlines) {
        const deadlineRows = assistantTaskDeadlineRows(activeTasks).slice(0, 4);
        deadlines.innerHTML = deadlineRows.map(row => `<div class="ast-deadline-item" onclick="localStorage.setItem('currentTaskId','${esc(row.taskId)}'); location.href='task-detail.html';" style="cursor:pointer;"><div class="date-box"><div class="date-month">DUE</div><div class="date-day">${esc(formatAssistantDeadline(row.deadline))}</div></div><div><div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:4px;">${esc(row.title)}</div><div style="font-size:11px;color:#ef4444;font-weight:600;">${esc(row.status)}</div></div></div>`).join("") || `<div class="empty-activity">No upcoming task deadlines.</div>`;
      }
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
        const attemptedPageId = pageIdOf(task) || localTaskReferenceMap()[String(task.id ?? task.taskId)]?.pageId || "";
        console.warn("No Assistant reference image could be resolved. Task data:", {
          taskId: task.id ?? task.taskId,
          seriesId: seriesIdOf(task),
          chapterId: chapterIdOf(task),
          pageId: pageIdOf(task),
          pageNumber: pageNumberOf(task),
          hasLocalReference: Boolean(localTaskReferenceMap()[String(task.id ?? task.taskId)])
        }, task);

        ref.innerHTML = `<div class="assistant-ref-missing">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <strong>No reference image received.</strong>
          <span>The task was loaded, but the backend task response did not expose a usable page image URL${attemptedPageId ? ` for page <code>${esc(attemptedPageId)}</code>` : ""}.</span>
          <small>Frontend tried task image fields, local task reference cache, task detail lookup, canvas page lookup, chapter page lookup, and series lookup. If this still appears, the task was created/sent without a page reference.</small>
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
