
document.addEventListener("DOMContentLoaded", () => {
  const Api = window.MangaApi;
  const $ = (s, r = document) => r.querySelector(s);

  const seriesSelect = $("#series-select");
  const chapterSelect = $("#chapter-select");
  const chaptersTable = $("#chapters-table");
  const chapterCount = $("#chapter-count");
  const uploadLog = $("#upload-log");

  const toast = (msg) => {
    if (window.showToast) window.showToast(msg);
    else console.log(msg);
  };

  function rowChapter(ch) {
    const id = ch.id ?? ch.chapterId;
    const number = ch.chapterNumber ?? ch.number ?? "—";
    const title = ch.title || `Chapter ${number}`;
    const status = ch.status || "DRAFT";
    return `<tr>
      <td><strong>Ch. ${number}</strong></td>
      <td>${title}</td>
      <td><span class="status-tag progress">${status}</span></td>
      <td>
        <a class="btn-outline mini-btn" href="workspace.html?chapterId=${encodeURIComponent(id)}">Open Workspace</a>
      </td>
    </tr>`;
  }

  async function loadSeries() {
    seriesSelect.innerHTML = `<option>Loading...</option>`;
    try {
      const list = await Api.mySeries();
      const items = Array.isArray(list) ? list : (list?.content || []);
      if (!items.length) {
        seriesSelect.innerHTML = `<option value="">No series found</option>`;
        chapterSelect.innerHTML = `<option value="">Create a series first</option>`;
        chaptersTable.innerHTML = `<div class="empty-state-box">No series found. Create a series from the Mangaka dashboard first.</div>`;
        return;
      }
      seriesSelect.innerHTML = items.map(s => `<option value="${s.id}">${s.title || s.name || `Series #${s.id}`}</option>`).join("");
      Api.setActiveSeriesId(seriesSelect.value);
      await loadChapters();
    } catch (err) {
      chaptersTable.innerHTML = `<div class="api-error">${err.message}</div>`;
    }
  }

  async function loadChapters() {
    const seriesId = seriesSelect.value || Api.getActiveSeriesId();
    if (!seriesId) return;
    Api.setActiveSeriesId(seriesId);
    chaptersTable.innerHTML = `<div class="api-loading">Loading chapters...</div>`;
    chapterSelect.innerHTML = `<option>Loading...</option>`;
    try {
      const chapters = await Api.chapters(seriesId);
      const items = Array.isArray(chapters) ? chapters : (chapters?.content || []);
      chapterCount.textContent = items.length;
      chapterSelect.innerHTML = items.length
        ? items.map(c => `<option value="${c.id ?? c.chapterId}">Ch. ${c.chapterNumber ?? c.number ?? "?"} — ${c.title || "Untitled"}</option>`).join("")
        : `<option value="">No chapters yet</option>`;
      chaptersTable.innerHTML = items.length
        ? `<table class="data-table"><thead><tr><th>Chapter</th><th>Title</th><th>Status</th><th>Action</th></tr></thead><tbody>${items.map(rowChapter).join("")}</tbody></table>`
        : `<div class="empty-state-box">No chapters yet. Create the first chapter above.</div>`;
      if (chapterSelect.value) Api.setActiveChapterId(chapterSelect.value);
    } catch (err) {
      chaptersTable.innerHTML = `<div class="api-error">${err.message}</div>`;
    }
  }

  seriesSelect?.addEventListener("change", loadChapters);
  chapterSelect?.addEventListener("change", () => Api.setActiveChapterId(chapterSelect.value));
  $("#btn-refresh-chapters")?.addEventListener("click", () => loadChapters());

  $("#chapter-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const seriesId = seriesSelect.value;
    if (!seriesId) return alert("Select a series first.");
    const chapterNumber = Number($("#chapter-number").value);
    const title = $("#chapter-title").value.trim();
    try {
      await Api.createChapter({ seriesId: Number(seriesId), chapterNumber, title });
      $("#chapter-form").reset();
      await loadChapters();
      toast("Chapter created.");
    } catch (err) {
      alert("Create chapter failed: " + err.message);
    }
  });

  $("#page-upload-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const chapterId = chapterSelect.value;
    const files = Array.from($("#page-files").files || []);
    let pageNumber = Number($("#start-page-number").value || 1);
    if (!chapterId) return alert("Select a chapter first.");
    if (!files.length) return alert("Choose image files first.");
    uploadLog.innerHTML = "";
    for (const file of files) {
      try {
        uploadLog.innerHTML += `<div>Uploading page ${pageNumber}: ${file.name}...</div>`;
        await Api.createPage(chapterId, pageNumber, file);
        uploadLog.innerHTML += `<div class="log-ok">✓ Uploaded page ${pageNumber}</div>`;
      } catch (err) {
        uploadLog.innerHTML += `<div class="log-error">✕ Page ${pageNumber}: ${err.message}</div>`;
      }
      pageNumber += 1;
    }
    await loadChapters();
  });

  loadSeries();
});
