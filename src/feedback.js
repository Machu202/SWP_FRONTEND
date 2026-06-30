
document.addEventListener("DOMContentLoaded", () => {
  const Api = window.MangaApi;
  const $ = (s, r = document) => r.querySelector(s);
  const state = { series: [], chapters: [], pages: [], feedback: [], point: null };

  const pct = n => Math.max(0, Math.min(100, Number(n) || 0));
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;'}[c]));

  async function loadSeries() {
    const list = await Api.allSeries({ status: "REVIEWING" }).catch(() => Api.allSeries().catch(() => []));
    state.series = Array.isArray(list) ? list : (list.content || []);
    $("#series-select").innerHTML = state.series.map(s => `<option value="${s.id}">${esc(s.title || `Series #${s.id}`)}</option>`).join("") || `<option value="">No reviewing series</option>`;
    await loadChapters();
  }

  async function loadChapters() {
    const seriesId = $("#series-select").value;
    Api.setActiveSeriesId(seriesId);
    state.chapters = seriesId ? await Api.chapters(seriesId).catch(() => []) : [];
    $("#chapter-select").innerHTML = state.chapters.map(c => `<option value="${c.id}">Ch. ${c.chapterNumber ?? "?"} — ${esc(c.title || "Untitled")}</option>`).join("") || `<option value="">No chapters</option>`;
    await loadPages();
  }

  async function loadPages() {
    const chapterId = $("#chapter-select").value;
    Api.setActiveChapterId(chapterId);
    state.pages = chapterId ? await Api.pages(chapterId).catch(() => []) : [];
    $("#page-select").innerHTML = state.pages.map(p => `<option value="${p.id}">Page ${p.pageNumber ?? p.id}</option>`).join("") || `<option value="">No pages</option>`;
    await renderPage();
  }

  function setPoint(x, y) {
    state.point = { x: pct(x), y: pct(y) };
    $("#fb-x").value = state.point.x.toFixed(2);
    $("#fb-y").value = state.point.y.toFixed(2);
    $("#review-position").textContent = `${state.point.x.toFixed(1)}%, ${state.point.y.toFixed(1)}%`;
    const dot = $("#review-live-dot");
    if (dot) {
      dot.style.left = `${state.point.x}%`;
      dot.style.top = `${state.point.y}%`;
    }
  }

  async function renderPage() {
    const pageId = $("#page-select").value;
    Api.setActivePageId(pageId);
    const stage = $("#review-stage");
    if (!pageId) {
      stage.innerHTML = `<div class="empty-state-box">No page selected.</div>`;
      return;
    }
    const canvas = await Api.canvasInit(pageId).catch(() => {
      const p = state.pages.find(x => String(x.id) === String(pageId));
      return p ? { imageUrl: p.imageUrl || p.fileUrl || p.url } : null;
    });
    state.feedback = await Api.feedbacks(pageId).catch(() => []);

    if (!canvas?.imageUrl) {
      stage.innerHTML = `<div class="empty-state-box">No image URL for this page.</div>`;
      return;
    }

    stage.innerHTML = `<div class="hitbox-image-wrap" id="review-wrap">
      <img src="${canvas.imageUrl}" alt="Review page">
      <div id="review-layer"></div>
      <button id="review-live-dot" class="annotation-dot active-annotation-dot" type="button" style="display:none;">+</button>
    </div>`;

    const layer = $("#review-layer");
    state.feedback.forEach((f, i) => {
      const x = pct(f.xCoord ?? f.x ?? 0);
      const y = pct(f.yCoord ?? f.y ?? 0);
      layer.innerHTML += `<button class="annotation-dot saved-annotation-dot" style="left:${x}%;top:${y}%;" title="${esc(f.content)}">${i + 1}</button>`;
    });

    $("#feedback-count").textContent = state.feedback.length;
    $("#feedback-list").innerHTML = state.feedback.map((f, i) => `<div class="feedback-item"><strong>#${i + 1}</strong><p>${esc(f.content)}</p><small>${f.resolved ? "Resolved" : "Open"}</small></div>`).join("") || `<div class="empty-state-box">No feedback yet.</div>`;

    $("#review-wrap").addEventListener("click", e => {
      const rect = $("#review-wrap").getBoundingClientRect();
      setPoint(((e.clientX - rect.left) / rect.width) * 100, ((e.clientY - rect.top) / rect.height) * 100);
      $("#review-live-dot").style.display = "block";
    });
  }

  $("#series-select")?.addEventListener("change", loadChapters);
  $("#chapter-select")?.addEventListener("change", loadPages);
  $("#page-select")?.addEventListener("change", renderPage);
  $("#btn-refresh-review")?.addEventListener("click", renderPage);

  $("#feedback-form")?.addEventListener("submit", async e => {
    e.preventDefault();
    const pageId = $("#page-select").value;
    if (!pageId || !state.point) return alert("Click the page to place feedback first.");
    try {
      await Api.createFeedback(pageId, {
        x: $("#fb-x").value,
        y: $("#fb-y").value,
        width: $("#fb-w").value,
        height: $("#fb-h").value,
        content: $("#fb-content").value
      });
      $("#fb-content").value = "";
      await renderPage();
    } catch (err) {
      alert("Feedback failed: " + err.message);
    }
  });

  loadSeries();
});
