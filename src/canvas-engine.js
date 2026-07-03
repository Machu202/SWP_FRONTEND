
document.addEventListener("DOMContentLoaded", () => {
  const Api = window.MangaApi;
  const $ = (s, r = document) => r.querySelector(s);

  const state = { series: [], chapters: [], pages: [], page: null, lastBox: null, hitboxId: null };

  function optionText(item, fallback) { return item.title || item.name || fallback; }
  function pct(n) { return Math.max(0, Math.min(100, Number(n) || 0)); }

  async function loadSeries() {
    const list = await Api.mySeries().catch(() => []);
    state.series = Array.isArray(list) ? list : (list.content || []);
    $("#series-select").innerHTML = state.series.map(s => `<option value="${s.id}">${optionText(s, `Series #${s.id}`)}</option>`).join("") || `<option value="">No series</option>`;
    if (Api.getActiveSeriesId()) $("#series-select").value = Api.getActiveSeriesId();
    await loadChapters();
  }

  async function loadChapters() {
    const seriesId = $("#series-select").value;
    Api.setActiveSeriesId(seriesId);
    state.chapters = seriesId ? await Api.chapters(seriesId).catch(() => []) : [];
    $("#chapter-select").innerHTML = state.chapters.map(c => `<option value="${c.id}">Ch. ${c.chapterNumber ?? "?"} — ${c.title || "Untitled"}</option>`).join("") || `<option value="">No chapters</option>`;
    const queryChapterId = new URLSearchParams(location.search).get("chapterId") || Api.getActiveChapterId();
    if (queryChapterId) $("#chapter-select").value = queryChapterId;
    await loadPages();
  }

  async function loadPages() {
    const chapterId = $("#chapter-select").value;
    Api.setActiveChapterId(chapterId);
    state.pages = chapterId ? await Api.pages(chapterId).catch(() => []) : [];
    $("#page-select").innerHTML = state.pages.map(p => `<option value="${p.id}">Page ${p.pageNumber ?? p.id}</option>`).join("") || `<option value="">No pages</option>`;
    if (Api.getActivePageId()) $("#page-select").value = Api.getActivePageId();
    await renderPage();
  }

  async function loadAssistants() {
    const assistants = await Api.assistants().catch(() => []);
    const items = Array.isArray(assistants) ? assistants : (assistants.content || []);
    $("#assistant-select").innerHTML = items.map(u => `<option value="${u.id}">${u.fullName || u.username || u.email || `Assistant #${u.id}`}</option>`).join("") || `<option value="">No assistants found</option>`;
  }

  function setFormBox(box) {
    state.lastBox = box;
    $("#box-x").value = box.x.toFixed(2);
    $("#box-y").value = box.y.toFixed(2);
    $("#box-w").value = box.width.toFixed(2);
    $("#box-h").value = box.height.toFixed(2);
  }

  function drawBox(box, cls = "drawn-hitbox") {
    const el = document.createElement("div");
    el.className = cls;
    el.style.left = `${box.x}%`;
    el.style.top = `${box.y}%`;
    el.style.width = `${box.width}%`;
    el.style.height = `${box.height}%`;
    return el;
  }

  async function renderPage() {
    const pageId = $("#page-select").value;
    const stage = $("#canvas-stage");
    Api.setActivePageId(pageId);
    state.hitboxId = null;
    state.lastBox = null;
    if (!pageId) {
      stage.innerHTML = `<div class="empty-state-box">No pages uploaded for this chapter.</div>`;
      return;
    }

    const canvas = await Api.canvasInit(pageId).catch(() => {
      const p = state.pages.find(x => String(x.id) === String(pageId));
      return p ? { pageId: p.id, imageUrl: p.imageUrl || p.fileUrl || p.url, hitboxes: [] } : null;
    });

    const canvasImageUrl = pageImageOf(canvas);
    state.currentCanvas = canvas;
    state.currentPageImageUrl = canvasImageUrl;

    if (!canvasImageUrl) {
      stage.innerHTML = `<div class="empty-state-box">This page has no image URL.</div>`;
      return;
    }

    stage.innerHTML = `
      <div class="hitbox-image-wrap" id="hitbox-wrap">
        <img id="manga-page-img" src="${esc(canvasImageUrl)}" alt="Manga page">
        <div id="hitbox-layer"></div>
      </div>`;

    const layer = $("#hitbox-layer");
    (canvas.hitboxes || []).forEach(h => {
      const box = {
        x: pct(h.x ?? h.xCoord),
        y: pct(h.y ?? h.yCoord),
        width: pct(h.width ?? 10),
        height: pct(h.height ?? 10)
      };
      layer.appendChild(drawBox(box, "saved-hitbox"));
    });

    let start = null;
    const wrap = $("#hitbox-wrap");
    wrap.addEventListener("pointerdown", (e) => {
      const rect = wrap.getBoundingClientRect();
      start = { x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 };
      layer.querySelector(".drawn-hitbox")?.remove();
      wrap.setPointerCapture?.(e.pointerId);
    });

    wrap.addEventListener("pointermove", (e) => {
      if (!start) return;
      const rect = wrap.getBoundingClientRect();
      const current = { x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 };
      const box = {
        x: pct(Math.min(start.x, current.x)),
        y: pct(Math.min(start.y, current.y)),
        width: pct(Math.abs(current.x - start.x)),
        height: pct(Math.abs(current.y - start.y)),
      };
      layer.querySelector(".drawn-hitbox")?.remove();
      layer.appendChild(drawBox(box));
      setFormBox(box);
    });

    wrap.addEventListener("pointerup", () => { start = null; });
  }

  $("#series-select")?.addEventListener("change", loadChapters);
  $("#chapter-select")?.addEventListener("change", loadPages);
  $("#page-select")?.addEventListener("change", renderPage);
  $("#btn-load-workspace")?.addEventListener("click", renderPage);

  $("#hitbox-task-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const pageId = $("#page-select").value;
    const assistantId = $("#assistant-select").value;
    const description = $("#task-desc").value.trim();
    if (!pageId || !state.lastBox) return alert("Draw a hitbox first.");
    if (!description) return alert("Enter task description.");
    try {
      const hitbox = await Api.createHitbox(pageId, state.lastBox);
      const hitboxId = hitbox?.id || hitbox?.hitboxId || hitbox;
      const task = await Api.assignTaskToHitbox(hitboxId, description);
      const taskId = task?.id || task?.taskId;
      if (taskId && assistantId) {
        await Api.assignTask(taskId, assistantId);
        const assistantName = $("#assistant-select")?.selectedOptions?.[0]?.textContent?.trim() || "";
        rememberTaskAssistant(taskId, assistantId, assistantName);
      }

      if (taskId) {
        const selectedPage = state.pages.find((page) => String(page.id ?? page.pageId) === String(pageId));
        rememberTaskReference(taskId, {
          pageId,
          chapterId: $("#chapter-select")?.value || "",
          seriesId: $("#series-select")?.value || "",
          imageUrl: state.currentPageImageUrl || pageImageOf(selectedPage) || pageImageOf(state.currentCanvas),
          pageNumber: selectedPage?.pageNumber ?? selectedPage?.number ?? "",
          hitbox: state.lastBox
        });
      }
      $("#workspace-log").innerHTML = `<div class="log-ok">✓ Hitbox task created successfully.</div>`;
      await renderPage();
    } catch (err) {
      $("#workspace-log").innerHTML = `<div class="log-error">✕ ${err.message}</div>`;
    }
  });

  Promise.all([loadSeries(), loadAssistants()]);
});
