
(function () {
  document.addEventListener("DOMContentLoaded", () => {
    const Api = window.MangaApi;
    const content = document.querySelector(".content-padding");
    if (!content || !Api) return;

    const dashboardPanel = document.createElement("div");
    dashboardPanel.id = "studio-dashboard-panel";
    while (content.firstChild) dashboardPanel.appendChild(content.firstChild);
    content.appendChild(dashboardPanel);

    const inlinePanel = document.createElement("div");
    inlinePanel.id = "studio-inline-panel";
    inlinePanel.className = "studio-inline-panel";
    inlinePanel.hidden = true;
    content.appendChild(inlinePanel);

    const $ = (selector, root = inlinePanel) => root.querySelector(selector);
    const $$ = (selector, root = inlinePanel) => Array.from(root.querySelectorAll(selector));

    const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));

    const getArray = (value) => Array.isArray(value) ? value : (value?.content || []);
    const pct = (value) => Math.max(0, Math.min(100, Number(value) || 0));

    function setActive(panelName) {
      document.querySelectorAll("[data-dashboard-panel]").forEach((link) => {
        const isActive = link.dataset.dashboardPanel === panelName;
        if (link.classList.contains("nav-item")) link.classList.toggle("active", isActive);
      });
    }

    function showDashboard() {
      inlinePanel.hidden = true;
      inlinePanel.innerHTML = "";
      dashboardPanel.hidden = false;
      setActive("dashboard");
      renderDashboardSeries();
    }

    async function showPanel(panelName) {
      dashboardPanel.hidden = panelName !== "dashboard";
      inlinePanel.hidden = panelName === "dashboard";
      setActive(panelName);

      if (panelName === "chapters") {
        if (location.hash !== "#chapters") history.replaceState(null, "", "#chapters");
        return renderChapters();
      }
      if (panelName === "canvas") {
        if (location.hash !== "#canvas") history.replaceState(null, "", "#canvas");
        return renderCanvas();
      }
      if (panelName === "kanban") {
        if (location.hash !== "#kanban") history.replaceState(null, "", "#kanban");
        return renderKanban();
      }

      if (location.hash) history.replaceState(null, "", location.pathname);
      return showDashboard();
    }

    document.querySelectorAll("[data-dashboard-panel]").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const panelName = link.dataset.dashboardPanel || "dashboard";
        showPanel(panelName);
      });
    });

    if (location.hash === "#chapters") showPanel("chapters");
    else if (location.hash === "#canvas") showPanel("canvas");
    else if (location.hash === "#kanban") showPanel("kanban");
    else renderDashboardSeries();

    function loading(message = "Loading...") {
      return `<div class="api-loading">${message}</div>`;
    }

    function errorBox(error) {
      return `<div class="api-error">${esc(error?.message || error || "Something went wrong")}</div>`;
    }

    function panelHeader(title, subtitle, actions = "") {
      return `<div class="inline-panel-header">
        <div>
          <h1>${esc(title)}</h1>
          <p>${esc(subtitle)}</p>
        </div>
        <div class="inline-panel-actions">${actions}</div>
      </div>`;
    }

    function seriesMergeKey(series) {
      return String(series?.id ?? series?.seriesId ?? series?.title ?? series?.name ?? "").trim().toLowerCase();
    }

    function mergeSeriesLists(...lists) {
      const merged = new Map();

      lists.flat().filter(Boolean).forEach((series) => {
        const key = seriesMergeKey(series);
        if (!key) return;
        merged.set(key, {
          ...(merged.get(key) || {}),
          ...series
        });
      });

      return Array.from(merged.values());
    }

    async function loadMangakaSeriesList() {
      let mySeries = [];
      let allSeries = [];

      try {
        mySeries = getArray(await Api.mySeries());
      } catch (error) {
        console.warn("Could not load /manga-series/my-series", error);
        mySeries = [];
      }

      try {
        allSeries = getArray(await Api.allSeries());
      } catch (error) {
        console.warn("Could not load /manga-series", error);
        allSeries = [];
      }

      // Important: always merge both endpoints.
      // /my-series can return only the newly created Mangaka-owned series,
      // while /manga-series can return older/imported visible series.
      return mergeSeriesLists(allSeries, mySeries);
    }

    function cleanSeriesDescription(raw = "") {
      const text = String(raw || "").trim();
      if (!text) return "";

      return text
        .split("\n")
        .filter(line => !line.startsWith("--- Series Script"))
        .filter(line => !line.startsWith("Target:"))
        .filter(line => !line.startsWith("Status:"))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    }

    function getPendingSeriesMeta(title) {
      try {
        const store = JSON.parse(localStorage.getItem("mangakaPendingSeriesMetaByTitle") || "{}");
        return store[String(title || "").trim().toLowerCase()] || {};
      } catch (_) {
        return {};
      }
    }

    function seriesMetaOf(series) {
      const id = series?.id ?? series?.seriesId;
      const byId = Api.getSeriesMeta?.(id) || {};
      const byTitle = getPendingSeriesMeta(series?.title || series?.name || "");
      return { ...byTitle, ...byId };
    }

    function seriesDescriptionOf(series) {
      const meta = seriesMetaOf(series);
      return cleanSeriesDescription(
        series?.description ||
        series?.summary ||
        series?.synopsis ||
        meta.description ||
        meta.summary ||
        ""
      ) || "Chưa có mô tả chi tiết...";
    }

    function seriesCoverOf(series) {
      const meta = seriesMetaOf(series);
      const raw = series?.coverImageUrl ||
        series?.coverUrl ||
        series?.imageUrl ||
        series?.thumbnailUrl ||
        series?.cover ||
        meta.coverImageUrl ||
        meta.coverUrl ||
        "";
      return Api.resolveMediaUrl?.(raw) || raw;
    }

    function seriesPlaceholder(title = "") {
      const initials = String(title || "SF")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(word => word[0]?.toUpperCase())
        .join("") || "SF";
      return `<div class="series-cover-placeholder"><span>${initials}</span><small>No cover image</small></div>`;
    }

    function dashboardSeriesCard(series) {
      const id = series?.id ?? series?.seriesId;
      const title = series?.title || series?.name || `Series #${id || "—"}`;
      const meta = seriesMetaOf(series);
      const genre = series?.genre || meta.genre || "";
      const status = series?.status || "Ongoing";
      const cover = seriesCoverOf(series);
      const description = seriesDescriptionOf(series);
      const coverHtml = cover
        ? `<img src="${esc(cover)}" alt="${esc(title)}" class="series-cover-img" onerror="this.closest('.series-cover-box').innerHTML=this.dataset.fallback;" data-fallback="${esc(seriesPlaceholder(title))}">`
        : seriesPlaceholder(title);

      return `
        <button type="button" class="dashboard-series-card series-card-real" data-series-id="${esc(id)}">
          <div class="series-cover-box">
            ${coverHtml}
            <div class="series-status-pill"><i class="fa-solid fa-circle"></i> ${esc(status)}</div>
          </div>
          <div class="series-card-body">
            <h3>${esc(title)} ${genre ? `<span class="series-genre-badge">${esc(genre)}</span>` : ""}</h3>
            <p>${esc(description)}</p>
          </div>
        </button>
      `;
    }

    async function renderDashboardSeries() {
      const container = document.getElementById("active-series-container");
      if (!container) return;

      container.innerHTML = `<div class="api-loading" style="grid-column: 1 / -1;">Loading active series...</div>`;

      try {
        const series = await loadMangakaSeriesList();

        if (!series.length) {
          container.innerHTML = `
            <div class="empty-state-box" style="grid-column: 1 / -1;">
              <i class="fa-solid fa-book-open"></i>
              <p>Không có series nào đang hoạt động. Vui lòng tạo mới!</p>
            </div>`;
          return;
        }

        container.innerHTML = series.map(dashboardSeriesCard).join("");

        container.querySelectorAll("[data-series-id]").forEach(card => {
          card.addEventListener("click", () => {
            const selected = series.find(item => String(item.id ?? item.seriesId) === String(card.dataset.seriesId));
            if (!selected) return;

            const id = selected.id ?? selected.seriesId;
            const title = selected.title || selected.name || `Series #${id}`;

            Api.setActiveSeriesId?.(id);
            localStorage.setItem("currentSeriesId", String(id));
            localStorage.setItem("activeSeriesId", String(id));
            localStorage.setItem("currentSeriesTitle", title);
            localStorage.setItem("activeSeriesTitle", title);

            Api.saveSeriesMeta?.(id, {
              title,
              description: seriesDescriptionOf(selected),
              coverImageUrl: seriesCoverOf(selected),
              genre: selected.genre || seriesMetaOf(selected).genre || ""
            });

            window.location.href = "manuscripts.html";
          });
        });
      } catch (error) {
        container.innerHTML = errorBox(error);
      }
    }

    async function enrichChaptersWithPages(chapters = []) {
      return Promise.all(getArray(chapters).map(async (chapter) => {
        const chapterId = chapter.id ?? chapter.chapterId;
        let pages = chapter.pages || chapter.pageList || chapter.mangaPages || [];
        if (!Array.isArray(pages) || pages.length === 0) {
          try {
            pages = getArray(await Api.pages(chapterId));
          } catch (error) {
            console.warn("Could not load pages for chapter", chapterId, error);
            pages = [];
          }
        }
        return { ...chapter, pages };
      }));
    }


    function openScriptModal(chapter, scriptText = "") {
      const existing = document.getElementById("chapter-script-modal");
      if (existing) existing.remove();

      const chapterLabel = `Ch. ${chapter?.chapterNumber ?? chapter?.number ?? "?"} — ${chapter?.title || "Untitled"}`;
      document.body.insertAdjacentHTML("beforeend", `
        <div class="chapter-script-modal" id="chapter-script-modal">
          <div class="chapter-script-dialog">
            <div class="chapter-script-header">
              <div>
                <span class="eyebrow">Chapter Script</span>
                <h2>${esc(chapterLabel)}</h2>
              </div>
              <button type="button" class="modal-x" id="close-chapter-script"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <pre class="chapter-script-content">${esc(scriptText || "No script saved for this chapter.")}</pre>
          </div>
        </div>
      `);

      const modal = document.getElementById("chapter-script-modal");
      const close = () => modal?.remove();
      document.getElementById("close-chapter-script")?.addEventListener("click", close);
      modal?.addEventListener("click", (event) => {
        if (event.target === modal) close();
      });
    }

    async function renderChapters() {
      inlinePanel.innerHTML = `
        ${panelHeader("Chapters & Pages", "Create chapters and upload manga page images without leaving the Mangaka dashboard.", `<button class="btn-publish" id="inline-refresh-chapters"><i class="fa-solid fa-rotate"></i> Refresh</button>`)}
        <div class="inline-feature-grid two-cols">
          <div class="card-box">
            <h3>Select Series</h3>
            <div class="form-group"><label>Manga Series</label><select id="inline-series-select" class="form-control"></select></div>
            <form id="inline-chapter-form" class="feature-form">
              <h3>Create New Chapter</h3>
              <div class="form-row">
                <div class="form-group"><label>Chapter Number</label><input id="inline-chapter-number" class="form-control" type="number" min="1" required></div>
                <div class="form-group"><label>Chapter Title</label><input id="inline-chapter-title" class="form-control" placeholder="Chapter title"></div>
              </div>
              <div class="form-group">
                <label>Chapter Script / Notes</label>
                <textarea id="inline-chapter-script" class="form-control chapter-script-input" placeholder="Add chapter script, dialogue, panel notes, or direction for this chapter..."></textarea>
                <small class="muted-note">This script is attached to the chapter and can be used when creating Assistant tasks.</small>
              </div>
              <button class="btn-publish" type="submit"><i class="fa-solid fa-plus"></i> Create Chapter</button>
            </form>
          </div>
          <div class="card-box">
            <h3>Upload Pages</h3>
            <form id="inline-page-upload-form" class="feature-form">
              <div class="form-group"><label>Chapter</label><select id="inline-chapter-select" class="form-control"></select></div>
              <div class="form-row">
                <div class="form-group"><label>Start Page Number</label><input id="inline-start-page-number" class="form-control" type="number" min="1" value="1"></div>
                <div class="form-group"><label>Image Files</label><input id="inline-page-files" class="form-control" type="file" accept="image/*" multiple></div>
              </div>
              <button class="btn-publish" type="submit"><i class="fa-solid fa-upload"></i> Upload Pages</button>
            </form>
            <div id="inline-upload-log" class="upload-log"></div>
          </div>
        </div>
        <div class="card-box">
          <div class="section-title-row"><h3>Chapters</h3><span id="inline-chapter-count" class="status-tag progress">0</span></div>
          <div id="inline-chapters-table">${loading("Loading chapters...")}</div>
        </div>`;

      const seriesSelect = $("#inline-series-select");
      const chapterSelect = $("#inline-chapter-select");
      const chaptersTable = $("#inline-chapters-table");
      const chapterCount = $("#inline-chapter-count");
      const uploadLog = $("#inline-upload-log");

      async function loadSeries() {
        seriesSelect.innerHTML = `<option>Loading...</option>`;
        try {
          const items = await loadMangakaSeriesList();
          if (!items.length) {
            seriesSelect.innerHTML = `<option value="">No series found</option>`;
            chapterSelect.innerHTML = `<option value="">Create a series first</option>`;
            chaptersTable.innerHTML = `<div class="empty-state-box">No series found. Create a series first.</div>`;
            return;
          }
          seriesSelect.innerHTML = items.map((s) => `<option value="${s.id}">${esc(s.title || s.name || `Series #${s.id}`)}</option>`).join("");
          const activeSeriesId = Api.getActiveSeriesId();
          if (activeSeriesId && items.some((s) => String(s.id) === String(activeSeriesId))) {
            seriesSelect.value = activeSeriesId;
          } else {
            seriesSelect.value = String(items[0].id);
          }
          Api.setActiveSeriesId(seriesSelect.value);
          const selectedSeries = items.find((s) => String(s.id) === String(seriesSelect.value));
          if (selectedSeries?.title) localStorage.setItem("currentSeriesTitle", selectedSeries.title);
          await loadChapters();
        } catch (error) {
          chaptersTable.innerHTML = errorBox(error);
        }
      }

      async function loadChapters() {
        const seriesId = seriesSelect.value || Api.getActiveSeriesId();
        if (!seriesId) return;
        Api.setActiveSeriesId(seriesId);
        chaptersTable.innerHTML = loading("Loading chapters...");
        chapterSelect.innerHTML = `<option>Loading...</option>`;
        try {
          const items = await enrichChaptersWithPages(await Api.chapters(seriesId));
          chapterCount.textContent = items.length;
          chapterSelect.innerHTML = items.length
            ? items.map((c) => `<option value="${c.id ?? c.chapterId}">Ch. ${c.chapterNumber ?? c.number ?? "?"} — ${esc(c.title || "Untitled")}</option>`).join("")
            : `<option value="">No chapters yet</option>`;
          chaptersTable.innerHTML = items.length
            ? `<table class="data-table"><thead><tr><th>Chapter</th><th>Title</th><th>Pages</th><th>Script</th><th>Status</th><th>Action</th></tr></thead><tbody>${items.map((c) => {
                const id = c.id ?? c.chapterId;
                const pageCount = getArray(c.pages).length;
                const chapterScript = c.script || c.scriptText || c.content || Api.getChapterScript?.(id) || "";
                return `<tr>
                  <td><strong>Ch. ${c.chapterNumber ?? c.number ?? "?"}</strong></td>
                  <td>${esc(c.title || "Untitled")}</td>
                  <td><span class="status-tag progress">${pageCount} page${pageCount === 1 ? "" : "s"}</span></td>
                  <td>${chapterScript ? `<button class="btn-outline mini-btn" data-view-script="${id}"><i class="fa-solid fa-scroll"></i> View Script</button>` : `<span class="muted-note">No script</span>`}</td>
                  <td><span class="status-tag progress">${esc(c.status || "DRAFT")}</span></td>
                  <td><button class="btn-outline mini-btn" data-open-canvas="${id}">Open Canvas</button></td>
                </tr>`;
              }).join("")}</tbody></table>`
            : `<div class="empty-state-box">No chapters yet. Create the first chapter above.</div>`;
          if (chapterSelect.value) Api.setActiveChapterId(chapterSelect.value);

          $$("[data-view-script]").forEach((btn) => btn.addEventListener("click", () => {
            const chapterId = btn.dataset.viewScript;
            const chapter = items.find((c) => String(c.id ?? c.chapterId) === String(chapterId));
            const scriptText = chapter?.script || chapter?.scriptText || chapter?.content || Api.getChapterScript?.(chapterId) || "";
            openScriptModal(chapter, scriptText);
          }));

          $$("[data-open-canvas]").forEach((btn) => btn.addEventListener("click", () => {
            const chapterId = btn.dataset.openCanvas;
            const chapter = items.find((c) => String(c.id ?? c.chapterId) === String(chapterId));
            Api.setActiveChapterId(chapterId);
            const firstPage = getArray(chapter?.pages)[0];
            if (firstPage?.id) Api.setActivePageId(firstPage.id);
            showPanel("canvas");
          }));
        } catch (error) {
          chaptersTable.innerHTML = errorBox(error);
        }
      }

      seriesSelect.addEventListener("change", loadChapters);
      chapterSelect.addEventListener("change", () => Api.setActiveChapterId(chapterSelect.value));
      $("#inline-refresh-chapters").addEventListener("click", loadChapters);

      $("#inline-chapter-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const seriesId = seriesSelect.value;
        if (!seriesId) return alert("Select a series first.");
        try {
          const scriptText = $("#inline-chapter-script")?.value.trim() || "";
          const createdChapter = await Api.createChapter({
            seriesId: Number(seriesId),
            chapterNumber: Number($("#inline-chapter-number").value),
            title: $("#inline-chapter-title").value.trim()
          });

          const createdChapterId = createdChapter?.id || createdChapter?.chapterId;
          if (createdChapterId && scriptText) {
            Api.saveChapterScript?.(createdChapterId, scriptText);
          }

          event.target.reset();
          await loadChapters();
        } catch (error) {
          alert("Create chapter failed: " + error.message);
        }
      });

      $("#inline-page-upload-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const chapterId = chapterSelect.value;
        const files = Array.from($("#inline-page-files").files || []);
        let pageNumber = Number($("#inline-start-page-number").value || 1);
        if (!chapterId) return alert("Select a chapter first.");
        if (!files.length) return alert("Choose image files first.");

        uploadLog.innerHTML = "";
        for (const file of files) {
          try {
            uploadLog.innerHTML += `<div>Uploading page ${pageNumber}: ${esc(file.name)}...</div>`;
            await Api.createPage(chapterId, pageNumber, file);
            uploadLog.innerHTML += `<div class="log-ok">✓ Uploaded page ${pageNumber}</div>`;
          } catch (error) {
            uploadLog.innerHTML += `<div class="log-error">✕ Page ${pageNumber}: ${esc(error.message)}</div>`;
          }
          pageNumber += 1;
        }
        await loadChapters();
      });

      loadSeries();
    }

    async function renderCanvas() {
      inlinePanel.innerHTML = `
        ${panelHeader("Canvas Workspace", "Draw hitboxes and assign Assistant tasks directly inside the dashboard.", `<button class="btn-outline" data-dashboard-panel="chapters"><i class="fa-solid fa-layer-group"></i> Manage Chapters</button>`)}
        <div class="toolbar-row">
          <select id="inline-canvas-series" class="form-control"></select>
          <select id="inline-canvas-chapter" class="form-control"></select>
          <select id="inline-canvas-page" class="form-control"></select>
          <button id="inline-load-page" class="btn-publish">Load Page</button>
        </div>
        <div class="inline-workspace-split">
          <div class="card-box">
            <div class="section-title-row"><h3>Canvas</h3><span class="muted-note">Drag on the image to draw a hitbox</span></div>
            <div id="inline-canvas-stage" class="hitbox-stage"><div class="empty-state-box">Select a page to start.</div></div>
          </div>
          <div class="card-box">
            <h3>Create Task From Hitbox</h3>
            <form id="inline-hitbox-task-form" class="feature-form">
              <div class="form-row">
                <div class="form-group"><label>X %</label><input id="inline-box-x" class="form-control" type="number" step="0.01" readonly></div>
                <div class="form-group"><label>Y %</label><input id="inline-box-y" class="form-control" type="number" step="0.01" readonly></div>
              </div>
              <div class="form-row">
                <div class="form-group"><label>W %</label><input id="inline-box-w" class="form-control" type="number" step="0.01" readonly></div>
                <div class="form-group"><label>H %</label><input id="inline-box-h" class="form-control" type="number" step="0.01" readonly></div>
              </div>
              <div class="form-group"><label>Assistant</label><select id="inline-assistant-select" class="form-control"></select></div>
              <div class="form-group">
                <label>Task Description</label>
                <textarea id="inline-task-desc" class="form-control" required placeholder="Describe the work..."></textarea>
                <small id="inline-chapter-script-hint" class="muted-note"></small>
              </div>
              <button class="btn-publish" type="submit">Create Hitbox Task</button>
            </form>
            <div id="inline-workspace-log" class="upload-log"></div>
          </div>
        </div>`;

      $("[data-dashboard-panel='chapters']")?.addEventListener("click", (event) => {
        event.preventDefault();
        showPanel("chapters");
      });

      const state = { series: [], chapters: [], pages: [], lastBox: null };

      function updateChapterScriptHint() {
        const chapterId = $("#inline-canvas-chapter")?.value;
        const chapter = state.chapters.find((c) => String(c.id ?? c.chapterId) === String(chapterId));
        const scriptText = chapter?.script || chapter?.scriptText || chapter?.content || Api.getChapterScript?.(chapterId) || "";
        const hint = $("#inline-chapter-script-hint");
        if (hint) {
          hint.innerHTML = scriptText
            ? `<i class="fa-solid fa-scroll"></i> Chapter script available. It will be appended to the task note.`
            : "";
        }
      }

      async function loadSeries() {
        state.series = await loadMangakaSeriesList();
        $("#inline-canvas-series").innerHTML = state.series.map((s) => `<option value="${s.id}">${esc(s.title || s.name || `Series #${s.id}`)}</option>`).join("") || `<option value="">No series</option>`;
        const activeSeriesId = Api.getActiveSeriesId();
        if (activeSeriesId && state.series.some((s) => String(s.id) === String(activeSeriesId))) {
          $("#inline-canvas-series").value = activeSeriesId;
        } else if (state.series[0]) {
          $("#inline-canvas-series").value = String(state.series[0].id);
          Api.setActiveSeriesId(state.series[0].id);
        }
        await loadChapters();
      }

      async function loadChapters() {
        const seriesId = $("#inline-canvas-series").value;
        Api.setActiveSeriesId(seriesId);
        state.chapters = seriesId ? await enrichChaptersWithPages(await Api.chapters(seriesId).catch(() => [])) : [];
        $("#inline-canvas-chapter").innerHTML = state.chapters.map((c) => `<option value="${c.id}">Ch. ${c.chapterNumber ?? "?"} — ${esc(c.title || "Untitled")}</option>`).join("") || `<option value="">No chapters</option>`;
        if (Api.getActiveChapterId()) $("#inline-canvas-chapter").value = Api.getActiveChapterId();
        await loadPages();
      }

      async function loadPages() {
        const chapterId = $("#inline-canvas-chapter").value;
        Api.setActiveChapterId(chapterId);
        state.pages = chapterId ? getArray(await Api.pages(chapterId).catch(() => [])) : [];
        $("#inline-canvas-page").innerHTML = state.pages.map((p) => `<option value="${p.id}">Page ${p.pageNumber ?? p.id}</option>`).join("") || `<option value="">No pages</option>`;
        if (Api.getActivePageId()) $("#inline-canvas-page").value = Api.getActivePageId();
        await renderPage();
      }

      async function loadAssistants() {
        const assistants = getArray(await Api.assistants().catch(() => []));
        $("#inline-assistant-select").innerHTML = assistants.map((u) => `<option value="${u.id}">${esc(u.fullName || u.username || u.email || `Assistant #${u.id}`)}</option>`).join("") || `<option value="">No assistants found</option>`;
      }

      function drawBox(box, className = "drawn-hitbox") {
        const el = document.createElement("div");
        el.className = className;
        el.style.left = `${box.x}%`;
        el.style.top = `${box.y}%`;
        el.style.width = `${box.width}%`;
        el.style.height = `${box.height}%`;
        return el;
      }

      function setBox(box) {
        state.lastBox = box;
        $("#inline-box-x").value = box.x.toFixed(2);
        $("#inline-box-y").value = box.y.toFixed(2);
        $("#inline-box-w").value = box.width.toFixed(2);
        $("#inline-box-h").value = box.height.toFixed(2);
      }

      async function renderPage() {
        const pageId = $("#inline-canvas-page").value;
        const stage = $("#inline-canvas-stage");
        Api.setActivePageId(pageId);
        state.lastBox = null;

        if (!pageId) {
          stage.innerHTML = `<div class="empty-state-box">No pages uploaded for this chapter.</div>`;
          return;
        }

        const canvas = await Api.canvasInit(pageId).catch(() => {
          const p = state.pages.find((item) => String(item.id) === String(pageId));
          return p ? { imageUrl: p.imageUrl || p.fileUrl || p.url, hitboxes: [] } : null;
        });

        if (!canvas?.imageUrl) {
          stage.innerHTML = `<div class="empty-state-box">This page has no image URL.</div>`;
          return;
        }

        stage.innerHTML = `<div class="hitbox-image-wrap" id="inline-hitbox-wrap"><img src="${esc(canvas.imageUrl)}" alt="Manga page"><div id="inline-hitbox-layer"></div></div>`;
        const layer = $("#inline-hitbox-layer");

        getArray(canvas.hitboxes).forEach((h) => layer.appendChild(drawBox({
          x: pct(h.x ?? h.xCoord),
          y: pct(h.y ?? h.yCoord),
          width: pct(h.width ?? 10),
          height: pct(h.height ?? 10),
        }, "saved-hitbox")));

        let start = null;
        const wrap = $("#inline-hitbox-wrap");
        wrap.addEventListener("pointerdown", (event) => {
          const rect = wrap.getBoundingClientRect();
          start = { x: ((event.clientX - rect.left) / rect.width) * 100, y: ((event.clientY - rect.top) / rect.height) * 100 };
          layer.querySelector(".drawn-hitbox")?.remove();
          wrap.setPointerCapture?.(event.pointerId);
        });
        wrap.addEventListener("pointermove", (event) => {
          if (!start) return;
          const rect = wrap.getBoundingClientRect();
          const current = { x: ((event.clientX - rect.left) / rect.width) * 100, y: ((event.clientY - rect.top) / rect.height) * 100 };
          const box = {
            x: pct(Math.min(start.x, current.x)),
            y: pct(Math.min(start.y, current.y)),
            width: pct(Math.abs(current.x - start.x)),
            height: pct(Math.abs(current.y - start.y)),
          };
          layer.querySelector(".drawn-hitbox")?.remove();
          layer.appendChild(drawBox(box));
          setBox(box);
        });
        wrap.addEventListener("pointerup", () => { start = null; });
      }

      $("#inline-canvas-series").addEventListener("change", loadChapters);
      $("#inline-canvas-chapter").addEventListener("change", loadPages);
      $("#inline-canvas-page").addEventListener("change", renderPage);
      $("#inline-load-page").addEventListener("click", renderPage);

      $("#inline-hitbox-task-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const pageId = $("#inline-canvas-page").value;
        const assistantId = $("#inline-assistant-select").value;
        const description = $("#inline-task-desc").value.trim();
        const log = $("#inline-workspace-log");

        if (!pageId || !state.lastBox) return alert("Draw a hitbox first.");
        if (!description) return alert("Enter task description.");

        const chapterId = $("#inline-canvas-chapter")?.value;
        const chapter = state.chapters.find((c) => String(c.id ?? c.chapterId) === String(chapterId));
        const chapterScript = chapter?.script || chapter?.scriptText || chapter?.content || Api.getChapterScript?.(chapterId) || "";
        const taskDescription = [
          description,
          chapterScript ? `\n--- Chapter Script / Notes ---\n${chapterScript}` : ""
        ].filter(Boolean).join("\n");

        try {
          const hitbox = await Api.createHitbox(pageId, state.lastBox);
          const hitboxId = hitbox?.id || hitbox?.hitboxId || hitbox;
          const task = await Api.assignTaskToHitbox(hitboxId, taskDescription);
          const taskId = task?.id || task?.taskId;
          if (taskId && assistantId) await Api.assignTask(taskId, assistantId);
          log.innerHTML = `<div class="log-ok">✓ Hitbox task created successfully.</div>`;
          await renderPage();
        } catch (error) {
          log.innerHTML = `<div class="log-error">✕ ${esc(error.message)}</div>`;
        }
      });

      Promise.all([loadSeries(), loadAssistants()]);
    }

    async function renderKanban() {
      inlinePanel.innerHTML = `
        ${panelHeader("Kanban Board", "Track task workflow directly inside the Mangaka dashboard.", `<button id="inline-refresh-kanban" class="btn-publish"><i class="fa-solid fa-rotate"></i> Refresh</button>`)}
        <div class="kanban-grid backend-kanban">
          <div class="kanban-column" data-status="TODO"><h3>Todo <span id="inline-count-TODO">0</span></h3><div class="kanban-drop" id="inline-col-TODO"></div></div>
          <div class="kanban-column" data-status="DOING"><h3>Doing <span id="inline-count-DOING">0</span></h3><div class="kanban-drop" id="inline-col-DOING"></div></div>
          <div class="kanban-column" data-status="REVIEWING"><h3>Reviewing <span id="inline-count-REVIEWING">0</span></h3><div class="kanban-drop" id="inline-col-REVIEWING"></div></div>
          <div class="kanban-column" data-status="APPROVED"><h3>Approved <span id="inline-count-APPROVED">0</span></h3><div class="kanban-drop" id="inline-col-APPROVED"></div></div>
        </div>`;

      const statuses = ["TODO", "DOING", "REVIEWING", "APPROVED"];
      const normalize = (status) => Api.normalizeTaskStatus ? Api.normalizeTaskStatus(status) : String(status || "TODO").toUpperCase();

      function taskCard(task) {
        const id = task.id ?? task.taskId;
        const status = normalize(task.status);
        const submittedUrl = task.submittedImageUrl || task.submissionUrl || task.imageUrl || "";
        const canReview = status === "REVIEWING" && !!submittedUrl;
        return `<div class="kanban-card backend-task-card ${canReview ? "mangaka-review-card" : ""}" draggable="${canReview ? "false" : "true"}" data-id="${id}" data-review="${canReview}">
          <strong>${esc(task.title || task.description || `Task #${id}`)}</strong>
          <p>${esc(task.description || "")}</p>
          <small>${esc(task.assigneeName || task.assistantName || "Unassigned")} · ${esc(status)}</small>
          ${canReview
            ? `<button type="button" class="mangaka-review-submission-btn" data-task-id="${id}">
                <i class="fa-solid fa-eye"></i> Review Submitted Image
              </button>`
            : ""}
        </div>`;
      }

      async function loadTasks() {
        statuses.forEach((status) => {
          $(`#inline-col-${status}`).innerHTML = loading("Loading...");
          $(`#inline-count-${status}`).textContent = "0";
        });

        try {
          const tasks = getArray(await Api.tasks());
          statuses.forEach((status) => {
            const items = tasks.filter((task) => normalize(task.status) === status);
            $(`#inline-count-${status}`).textContent = items.length;
            $(`#inline-col-${status}`).innerHTML = items.length ? items.map(taskCard).join("") : `<div class="empty-column">Drop tasks here</div>`;
          });

          $$(".backend-task-card").forEach((card) => {
            const reviewBtn = card.querySelector(".mangaka-review-submission-btn");
            if (reviewBtn) {
              reviewBtn.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                const taskId = card.dataset.id;
                localStorage.setItem("currentReviewTaskId", taskId);
                localStorage.setItem("currentTaskId", taskId);
                window.location.href = `review.html?taskId=${encodeURIComponent(taskId)}`;
              });
            }

            card.addEventListener("dragstart", (event) => {
              if (card.dataset.review === "true") {
                event.preventDefault();
                return;
              }
              event.dataTransfer.setData("text/plain", card.dataset.id);
            });
          });
        } catch (error) {
          statuses.forEach((status) => {
            $(`#inline-col-${status}`).innerHTML = errorBox(error);
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
        drop.addEventListener("dragleave", () => drop.classList.remove("drag-over"));
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


      function imageFromTask(task, type = "submitted") {
        if (type === "submitted") {
          return task.submittedImageUrl || task.submissionUrl || task.imageUrl || "";
        }
        return task.referenceImageUrl || task.pageImageUrl || task.hitbox?.page?.imageUrl || "";
      }

      function openSubmissionReview(task, reloadTasks) {
        const taskId = task.id ?? task.taskId;
        const submittedUrl = imageFromTask(task, "submitted");
        const referenceUrl = imageFromTask(task, "reference");
        const title = task.title || task.description || `Task #${taskId}`;

        const existing = document.getElementById("mangaka-submission-modal");
        if (existing) existing.remove();

        document.body.insertAdjacentHTML("beforeend", `
          <div class="mangaka-submission-modal" id="mangaka-submission-modal">
            <div class="mangaka-submission-dialog">
              <div class="mangaka-submission-header">
                <div>
                  <h2>Review Assistant Submission</h2>
                  <p>${esc(title)}</p>
                </div>
                <button type="button" class="modal-x" id="close-submission-modal"><i class="fa-solid fa-xmark"></i></button>
              </div>

              <div class="mangaka-submission-body">
                <div class="submission-panel">
                  <strong>Submitted Image</strong>
                  ${submittedUrl ? `<img src="${esc(submittedUrl)}" alt="Assistant submitted work">` : `<div class="empty-state-box">No submitted image URL found.</div>`}
                </div>
                <div class="submission-panel">
                  <strong>Original Reference</strong>
                  ${referenceUrl ? `<img src="${esc(referenceUrl)}" alt="Original reference image">` : `<div class="empty-state-box">No original reference image found.</div>`}
                </div>
              </div>

              <div class="mangaka-submission-note">
                <strong>Task Request</strong>
                <p>${esc(task.description || "No task description.")}</p>
              </div>

              <div class="mangaka-submission-actions">
                <button type="button" class="btn-outline" id="request-submission-revision">
                  <i class="fa-solid fa-rotate-left"></i> Request Revision
                </button>
                <button type="button" class="btn-publish" id="approve-submission">
                  <i class="fa-solid fa-check"></i> Approve Submission
                </button>
              </div>
            </div>
          </div>
        `);

        const modal = document.getElementById("mangaka-submission-modal");
        const close = () => modal?.remove();

        document.getElementById("close-submission-modal")?.addEventListener("click", close);
        modal?.addEventListener("click", (event) => {
          if (event.target === modal) close();
        });

        document.getElementById("approve-submission")?.addEventListener("click", async () => {
          try {
            await Api.updateTaskStatus(taskId, "APPROVED");
            close();
            await reloadTasks();
          } catch (error) {
            alert("Approve failed: " + error.message);
          }
        });

        document.getElementById("request-submission-revision")?.addEventListener("click", async () => {
          try {
            await Api.updateTaskStatus(taskId, "DOING");
            close();
            await reloadTasks();
          } catch (error) {
            alert("Request revision failed: " + error.message);
          }
        });
      }

      $("#inline-refresh-kanban").addEventListener("click", loadTasks);
      loadTasks();
    }
  });
})();
