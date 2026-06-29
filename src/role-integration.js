(() => {
  const Api = window.MangaApi;
  if (!Api) return;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const page = location.pathname.split("/").pop();

  const state = {
    series: [],
    chapters: [],
    pages: [],
    feedbacks: [],
    schedules: [],
    deadlines: [],
    tasks: [],
    users: [],
    params: [],
    voteSummary: null,
  };

  const esc = (value = "") => String(value ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
  const fmtDate = (value) => value ? new Date(value).toLocaleString() : "—";
  const lower = (value = "") => String(value || "").toLowerCase();
  const statusClass = (status = "") => {
    const s = lower(status);
    if (s.includes("approved") || s.includes("active") || s.includes("resolved") || s.includes("ongoing")) return "approved";
    if (s.includes("review") || s.includes("pending") || s.includes("doing") || s.includes("progress")) return "progress";
    if (s.includes("reject") || s.includes("lock") || s.includes("late") || s.includes("high")) return "review";
    return "";
  };
  const badge = (text) => `<span class="status-tag ${statusClass(text)}">${esc(text || "—")}</span>`;
  const toast = (message, type = "info") => window.showToast ? window.showToast(message, type) : alert(message);

  function shell(title, subtitle, actionHtml = "") {
    const content = $(".content-padding");
    if (!content) return null;
    content.innerHTML = `
      <div class="page-header">
        <div><h1>${title}</h1><p>${subtitle}</p></div>
        <div class="integration-actions">${actionHtml}</div>
      </div>
      <div id="integration-root"><div class="card-box api-loading">Loading backend data...</div></div>`;
    return $("#integration-root");
  }

  function errorBox(root, err, hint = "Check backend, JWT role permission, and Vite port 5173.") {
    if (!root) return;
    root.innerHTML = `<div class="card-box api-error"><h2>Backend connection failed</h2><p>${esc(err.message || err)}</p><small>${esc(hint)}</small></div>`;
  }

  function seriesPicker(selectedId = Api.getActiveSeriesId()) {
    if (!state.series.length) return "";
    return `<select id="series-picker" class="form-control compact-control">${state.series.map(s => `<option value="${s.id}" ${String(s.id) === String(selectedId) ? "selected" : ""}>#${s.id} — ${esc(s.title)} (${esc(s.status)})</option>`).join("")}</select>`;
  }

  function chapterPicker(selectedId = Api.getActiveChapterId()) {
    if (!state.chapters.length) return "";
    return `<select id="chapter-picker" class="form-control compact-control">${state.chapters.map(ch => `<option value="${ch.id}" ${String(ch.id) === String(selectedId) ? "selected" : ""}>Ch.${esc(ch.chapterNumber)} — ${esc(ch.title || "Untitled")}</option>`).join("")}</select>`;
  }

  function pagePicker(selectedId = Api.getActivePageId()) {
    if (!state.pages.length) return "";
    return `<select id="page-picker" class="form-control compact-control">${state.pages.map(p => `<option value="${p.id}" ${String(p.id) === String(selectedId) ? "selected" : ""}>Page ${esc(p.pageNumber || p.id)}</option>`).join("")}</select>`;
  }

  async function loadSeries() {
    try {
      state.series = await Api.allSeries();
    } catch (err) {
      // Mangaka-only fallback if backend role does not allow global listing.
      state.series = await Api.mySeries();
    }
    if (state.series.length && !Api.getActiveSeriesId()) Api.setActiveSeriesId(state.series[0].id);
    return state.series;
  }

  async function hydrateSeriesContext() {
    await loadSeries();
    let seriesId = Api.getActiveSeriesId();
    if (!state.series.some(s => String(s.id) === String(seriesId)) && state.series[0]) {
      seriesId = state.series[0].id;
      Api.setActiveSeriesId(seriesId);
    }
    if (seriesId) {
      state.chapters = await Api.chapters(seriesId).catch(() => []);
      if (state.chapters.length && !Api.getActiveChapterId()) Api.setActiveChapterId(state.chapters[0].id);
      let chapterId = Api.getActiveChapterId() || state.chapters[0]?.id || "";
      if (chapterId) {
        state.pages = await Api.pages(chapterId).catch(() => []);
        if (state.pages.length && !Api.getActivePageId()) Api.setActivePageId(state.pages[0].id);
      }
    }
  }

  function bindCommonPickers(reload) {
    $("#series-picker")?.addEventListener("change", async (e) => {
      Api.setActiveSeriesId(e.target.value);
      localStorage.removeItem("activeChapterId");
      localStorage.removeItem("activePageId");
      await reload();
    });
    $("#chapter-picker")?.addEventListener("change", async (e) => {
      Api.setActiveChapterId(e.target.value);
      localStorage.removeItem("activePageId");
      await reload();
    });
    $("#page-picker")?.addEventListener("change", async (e) => {
      Api.setActivePageId(e.target.value);
      await reload();
    });
  }

  async function tantouDashboard() {
    const root = shell("Tantou Dashboard", "Live review queue, assigned tasks, and feedback metrics from Backend 2.", `<a class="btn-publish" href="tantou-review.html">Open Review</a>`);
    try {
      await hydrateSeriesContext();
      state.tasks = await Api.tasks().catch(() => []);
      const pageFeedbacks = await Promise.all((state.pages || []).slice(0, 8).map(p => Api.feedbacks(p.id).catch(() => [])));
      const openFeedbacks = pageFeedbacks.flat().filter(f => !f.isResolved);
      const reviewing = state.series.filter(s => /review/i.test(s.status || "")).length;
      const ready = state.series.filter(s => /approved/i.test(s.status || "")).length;
      root.innerHTML = `
        <div class="toolbar-row">${seriesPicker()}${chapterPicker()}${pagePicker()}</div>
        <div class="stats-grid" style="margin-bottom:30px;">
          <div class="stat-card"><div class="stat-value">${state.tasks.length}</div><div class="stat-label">My Review Tasks</div></div>
          <div class="stat-card"><div class="stat-value">${openFeedbacks.length}</div><div class="stat-label">Open Feedback</div></div>
          <div class="stat-card"><div class="stat-value">${reviewing}</div><div class="stat-label">Board Queue</div></div>
          <div class="stat-card"><div class="stat-value">${ready}</div><div class="stat-label">Ready / Approved</div></div>
        </div>
        <div class="card-box">
          ${state.series.map(s => `<div class="list-card"><div class="list-card-content"><h2 class="list-card-title">${esc(s.title)}</h2><p class="list-card-meta">${esc(s.genre || "No genre")} • ${badge(s.status)} • Mangaka: ${esc(s.mangakaName || "—")}</p></div><button class="btn-icon-only set-series" data-id="${s.id}"><i class="fa-solid fa-arrow-right"></i></button></div>`).join("") || `<div class="empty-state-box">No manga series returned by backend.</div>`}
        </div>`;
      $$(".set-series").forEach(btn => btn.addEventListener("click", () => { Api.setActiveSeriesId(btn.dataset.id); location.href = "tantou-review.html"; }));
      bindCommonPickers(tantouDashboard);
    } catch (err) { errorBox(root, err); }
  }

  async function tantouFeedback() {
    const root = shell("Feedback Tracking", "Create, view, and resolve Tantou feedback stored at /api/v1/tantou-feedbacks.");
    try {
      await hydrateSeriesContext();
      const pageId = Api.getActivePageId() || state.pages[0]?.id;
      state.feedbacks = pageId ? await Api.feedbacks(pageId).catch(() => []) : [];
      root.innerHTML = `
        <div class="toolbar-row">${seriesPicker()}${chapterPicker()}${pagePicker()}<a class="btn-publish" href="tantou-review.html">Add Feedback</a></div>
        <div class="card-box">
          <table class="data-table"><thead><tr><th>ID</th><th>Coordinates</th><th>Feedback</th><th>Status</th><th>Action</th></tr></thead><tbody>
            ${state.feedbacks.map(f => `<tr><td>#${f.id}</td><td>x:${esc(f.xCoord)} y:${esc(f.yCoord)} w:${esc(f.width)} h:${esc(f.height)}</td><td>${esc(f.content)}</td><td>${badge(f.isResolved ? "Resolved" : "Open")}</td><td>${f.isResolved ? "—" : `<button class="btn-outline resolve-feedback" data-id="${f.id}">Resolve</button>`}</td></tr>`).join("") || `<tr><td colspan="5">No feedback found for selected page.</td></tr>`}
          </tbody></table>
        </div>`;
      bindCommonPickers(tantouFeedback);
      $$(".resolve-feedback").forEach(btn => btn.addEventListener("click", async () => {
        try { await Api.resolveFeedback(btn.dataset.id); toast("Feedback resolved.", "success"); tantouFeedback(); }
        catch (err) { toast(err.message, "error"); }
      }));
    } catch (err) { errorBox(root, err); }
  }

  async function tantouReview() {
    const root = shell("Chapter Review & Hitbox Feedback", "Select a backend page, click the manga preview, and create coordinate-based Tantou feedback.");
    try {
      await hydrateSeriesContext();
      const pageId = Api.getActivePageId() || state.pages[0]?.id;
      let canvas = null;
      if (pageId) canvas = await Api.canvasInit(pageId).catch(async () => {
        const p = state.pages.find(item => String(item.id) === String(pageId));
        return p ? { pageId: p.id, imageUrl: p.imageUrl, originalWidth: p.width || 1000, originalHeight: p.height || 1400, hitboxes: [] } : null;
      });
      state.feedbacks = pageId ? await Api.feedbacks(pageId).catch(() => []) : [];
      root.innerHTML = `
        <div class="toolbar-row">${seriesPicker()}${chapterPicker()}${pagePicker()}</div>
        <div class="review-container integration-review-grid">
          <div class="review-col">
            <div class="review-col-header"><span>Backend Page Preview</span>${badge(pageId ? `Page #${pageId}` : "No page")}</div>
            <div id="tantou-preview" class="preview-panel api-canvas-preview" data-x="12" data-y="12">
              ${canvas?.imageUrl ? `<img src="${esc(canvas.imageUrl)}" alt="Manga page">` : `<div class="empty-state-box">Upload pages through Mangaka Batch Upload before review.</div>`}
              ${state.feedbacks.map((f, i) => `<button class="annotation-dot" style="left:${Math.min(95, Math.max(3, f.xCoord || 10))}%;top:${Math.min(95, Math.max(3, f.yCoord || 10))}%;" title="${esc(f.content)}">${i+1}</button>`).join("")}
            </div>
            <small class="muted-note">Click the preview to set x/y percentage for new feedback.</small>
          </div>
          <div class="review-col">
            <div class="review-col-header"><span>Feedback Thread</span><span id="chat-count-badge" class="status-tag progress">${state.feedbacks.length}</span></div>
            <div id="chat-box" class="chat-area compact-chat">
              ${state.feedbacks.map(f => `<div class="chat-msg"><div class="chat-avatar">TE</div><div class="chat-msg-body"><div class="chat-name">Tantou Editor <span class="chat-time">${fmtDate(f.createdAt)}</span></div><div class="chat-bubble">${esc(f.content)}</div></div></div>`).join("") || `<div class="empty-state-box">No feedback yet.</div>`}
            </div>
            <form id="feedback-form" class="feedback-form">
              <div class="form-row"><div class="form-group"><label>X %</label><input class="form-control" id="fb-x" value="12"></div><div class="form-group"><label>Y %</label><input class="form-control" id="fb-y" value="12"></div></div>
              <div class="form-row"><div class="form-group"><label>W %</label><input class="form-control" id="fb-w" value="20"></div><div class="form-group"><label>H %</label><input class="form-control" id="fb-h" value="12"></div></div>
              <div class="form-group"><label>Feedback</label><textarea class="form-control" id="fb-content" placeholder="Write feedback for Mangaka..." required></textarea></div>
              <button class="btn-publish" type="submit">Send Feedback</button>
              <button id="send-revision" type="button" class="btn-outline">Mark Series Reviewing</button>
            </form>
          </div>
        </div>`;
      bindCommonPickers(tantouReview);
      $("#tantou-preview")?.addEventListener("click", (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (((e.clientX - rect.left) / rect.width) * 100).toFixed(2);
        const y = (((e.clientY - rect.top) / rect.height) * 100).toFixed(2);
        $("#fb-x").value = x; $("#fb-y").value = y;
      });
      $("#feedback-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!pageId) return toast("No page selected.", "error");
        try {
          await Api.createFeedback(pageId, { x: $("#fb-x").value, y: $("#fb-y").value, width: $("#fb-w").value, height: $("#fb-h").value, content: $("#fb-content").value });
          toast("Feedback saved to backend.", "success");
          tantouReview();
        } catch (err) { toast(err.message, "error"); }
      });
      $("#send-revision")?.addEventListener("click", async () => {
        try { await Api.updateSeriesStatus(Api.getActiveSeriesId(), "REVIEWING"); toast("Series moved to REVIEWING for board.", "success"); }
        catch (err) { toast(err.message, "error"); }
      });
    } catch (err) { errorBox(root, err); }
  }

  async function tantouRevision() {
    const root = shell("Revision Tracking", "Review current backend pages and feedback resolution before sending to board.");
    try {
      await hydrateSeriesContext();
      const pageCards = await Promise.all(state.pages.map(async p => {
        const fb = await Api.feedbacks(p.id).catch(() => []);
        return `<div class="list-card"><div class="list-card-img">${p.imageUrl ? `<img src="${esc(p.imageUrl)}" alt="Page ${p.pageNumber}">` : `<i class="fa-solid fa-image"></i>`}</div><div class="list-card-content"><h2 class="list-card-title">Page ${esc(p.pageNumber || p.id)}</h2><p class="list-card-meta">${fb.length} feedback item(s), ${fb.filter(x => x.isResolved).length} resolved</p></div><button class="btn-icon-only choose-page" data-id="${p.id}"><i class="fa-solid fa-arrow-right"></i></button></div>`;
      }));
      root.innerHTML = `<div class="toolbar-row">${seriesPicker()}${chapterPicker()}${pagePicker()}</div><div class="card-box">${pageCards.join("") || `<div class="empty-state-box">No pages available for selected chapter.</div>`}<button id="approve-report" class="btn-publish">Approve for Editorial Report</button></div>`;
      bindCommonPickers(tantouRevision);
      $$(".choose-page").forEach(btn => btn.addEventListener("click", () => { Api.setActivePageId(btn.dataset.id); location.href = "tantou-feedback.html"; }));
      $("#approve-report")?.addEventListener("click", async () => {
        try { await Api.updateSeriesStatus(Api.getActiveSeriesId(), "REVIEWING"); toast("Series submitted for Editorial Board voting.", "success"); location.href = "tantou-report.html"; }
        catch (err) { toast(err.message, "error"); }
      });
    } catch (err) { errorBox(root, err); }
  }

  async function tantouReport() {
    const root = shell("Editorial Report", "Backend-ready report gate: move an approved/reviewed series into board voting flow.");
    try {
      await hydrateSeriesContext();
      const s = state.series.find(x => String(x.id) === String(Api.getActiveSeriesId())) || state.series[0];
      root.innerHTML = `
        <div class="toolbar-row">${seriesPicker()}</div>
        <div class="card-box" style="max-width:900px;">
          <h2>${esc(s?.title || "No series selected")}</h2>
          <p>${esc(s?.summary || "No summary")}</p>
          <table class="data-table"><tbody><tr><th>Genre</th><td>${esc(s?.genre || "—")}</td></tr><tr><th>Status</th><td>${badge(s?.status)}</td></tr><tr><th>Mangaka</th><td>${esc(s?.mangakaName || "—")}</td></tr><tr><th>Tantou</th><td>${esc(s?.tantouName || "—")}</td></tr></tbody></table>
          <div class="form-group"><label>Recommendation Notes (frontend only)</label><textarea class="form-control" id="report-notes">Ready for board review after Tantou inspection.</textarea></div>
          <button id="submit-board" class="btn-publish">Submit to Editorial Board</button>
        </div>`;
      bindCommonPickers(tantouReport);
      $("#submit-board")?.addEventListener("click", async () => {
        try { await Api.updateSeriesStatus(Api.getActiveSeriesId(), "REVIEWING"); toast("Submitted to Editorial Board queue. Board members can now review it from their own dashboard.", "success"); location.href = "tantou-dashboard.html"; }
        catch (err) { toast(err.message, "error"); }
      });
    } catch (err) { errorBox(root, err); }
  }

  async function boardDashboard() {
    const root = shell("Board Dashboard", "Editorial Board submission queue and vote status from /votes.", `<a class="btn-publish" href="board-submissions.html">Open Submissions</a>`);
    try {
      await loadSeries();
      const reviewing = state.series.filter(s => /review/i.test(s.status || ""));
      const summaries = await Promise.all(reviewing.map(s => Api.voteSummary(s.id).catch(() => ({ seriesId: s.id, totalVotes: 0, approvedVotes: 0, rejectedVotes: 0 }))));
      root.innerHTML = `
        <div class="stats-grid" style="margin-bottom:30px;"><div class="stat-card"><div class="stat-value">${reviewing.length}</div><div class="stat-label">Submissions</div></div><div class="stat-card"><div class="stat-value">${summaries.reduce((a,b)=>a+(b.totalVotes||0),0)}</div><div class="stat-label">Votes Cast</div></div><div class="stat-card"><div class="stat-value">${summaries.filter(x => (x.totalVotes||0) === 0).length}</div><div class="stat-label">Needs Vote</div></div><div class="stat-card"><div class="stat-value">${summaries.reduce((a,b)=>a+(b.rejectedVotes||0),0)}</div><div class="stat-label">Reject / Revision Votes</div></div></div>
        <div class="card-box">${reviewing.map((s, i) => `<div class="list-card"><div class="list-card-content"><h2 class="list-card-title">${esc(s.title)}</h2><p class="list-card-meta">${badge(s.status)} • Approve ${summaries[i]?.approvedVotes || 0} / Reject ${summaries[i]?.rejectedVotes || 0}</p></div><button class="btn-icon-only set-series" data-id="${s.id}"><i class="fa-solid fa-arrow-right"></i></button></div>`).join("") || `<div class="empty-state-box">No series in REVIEWING status.</div>`}</div>`;
      $$(".set-series").forEach(btn => btn.addEventListener("click", () => { Api.setActiveSeriesId(btn.dataset.id); location.href = "board-submissions.html"; }));
    } catch (err) { errorBox(root, err, "The all-series endpoint requires the patched backend included in this package."); }
  }

  async function boardSubmissions() {
    const root = shell("Board Submissions", "Review manga metadata, chapters, and current vote summary before voting.", `<a class="btn-publish" href="board-voting.html">Start Voting</a>`);
    try {
      await hydrateSeriesContext();
      const seriesId = Api.getActiveSeriesId();
      const s = state.series.find(x => String(x.id) === String(seriesId)) || state.series[0];
      const summary = seriesId ? await Api.voteSummary(seriesId).catch(() => null) : null;
      root.innerHTML = `
        <div class="toolbar-row">${seriesPicker()}${chapterPicker()}</div>
        <div class="grid-layout">
          <div class="card-box"><h2>${esc(s?.title || "No series")}</h2><p>${esc(s?.summary || "No summary")}</p><table class="data-table"><thead><tr><th>Chapter</th><th>Title</th><th>Status</th></tr></thead><tbody>${state.chapters.map(ch => `<tr><td>${esc(ch.chapterNumber)}</td><td>${esc(ch.title)}</td><td>${badge(ch.publishStatus)}</td></tr>`).join("") || `<tr><td colspan="3">No chapters found.</td></tr>`}</tbody></table></div>
          <div class="card-box"><h2>Vote Summary</h2><p>${badge(s?.status)}</p><p><strong>Total:</strong> ${summary?.totalVotes ?? 0}</p><p><strong>Approve:</strong> ${summary?.approvedVotes ?? 0}</p><p><strong>Reject / Revision:</strong> ${summary?.rejectedVotes ?? 0}</p><a class="btn-publish" href="board-voting.html">Vote on this Series</a></div>
        </div>`;
      bindCommonPickers(boardSubmissions);
    } catch (err) { errorBox(root, err); }
  }

  async function boardVoting() {
    const root = shell("Board Voting", "Cast Approve or Reject vote through /api/v1/votes/series/{seriesId}.");
    try {
      await loadSeries();
      const reviewing = state.series.filter(s => /review/i.test(s.status || ""));
      if (reviewing.length && !reviewing.some(s => String(s.id) === String(Api.getActiveSeriesId()))) Api.setActiveSeriesId(reviewing[0].id);
      const seriesId = Api.getActiveSeriesId();
      const s = state.series.find(x => String(x.id) === String(seriesId)) || reviewing[0] || state.series[0];
      const summary = s ? await Api.voteSummary(s.id).catch(() => null) : null;
      root.innerHTML = `
        <div class="toolbar-row">${seriesPicker(s?.id)}</div>
        <div class="card-box">
          <h2>${esc(s?.title || "No series selected")}</h2><p>${esc(s?.summary || "")}</p>
          <div class="series-grid board-vote-grid">
            <button class="action-btn selected" data-vote-value="true"><i class="fa-solid fa-check"></i> Approve</button>
            <button class="action-btn" data-vote-value="false"><i class="fa-solid fa-xmark"></i> Reject / Request Revision</button>
          </div>
          <div class="form-group"><label>Board Comment (kept client-side until backend adds comment field)</label><textarea class="form-control" id="board-comment">Pacing should be improved before publication.</textarea></div>
          <button id="submit-vote" class="btn-publish">Submit Vote</button>
          <p class="muted-note">Current summary: ${summary?.approvedVotes ?? 0} approve, ${summary?.rejectedVotes ?? 0} reject/revision.</p>
        </div>`;
      bindCommonPickers(boardVoting);
      $$("[data-vote-value]").forEach(btn => btn.addEventListener("click", () => { $$("[data-vote-value]").forEach(x => x.classList.remove("selected")); btn.classList.add("selected"); }));
      $("#submit-vote")?.addEventListener("click", async () => {
        try {
          const val = $("[data-vote-value].selected")?.dataset.voteValue === "true";
          await Api.castVote(Api.getActiveSeriesId(), val);
          toast("Vote submitted.", "success");
          location.href = "board-result.html";
        } catch (err) { toast(err.message, "error"); }
      });
    } catch (err) { errorBox(root, err); }
  }

  async function boardResult() {
    const root = shell("Final Result", "Live voting summary for the selected manga series.");
    try {
      await loadSeries();
      const seriesId = Api.getActiveSeriesId();
      const s = state.series.find(x => String(x.id) === String(seriesId)) || state.series[0];
      const summary = s ? await Api.voteSummary(s.id).catch(() => ({ totalVotes: 0, approvedVotes: 0, rejectedVotes: 0 })) : null;
      const result = (summary?.approvedVotes || 0) > (summary?.rejectedVotes || 0) ? "Recommended Approval" : (summary?.totalVotes ? "Revision / Rejection Risk" : "Waiting for Votes");
      root.innerHTML = `<div class="toolbar-row">${seriesPicker(s?.id)}</div><div class="card-box"><span class="status-tag progress">${esc(result)}</span><h2 style="margin-top:15px;">${esc(s?.title || "No series")}</h2><p>Status: ${badge(s?.status)}</p><table class="data-table"><thead><tr><th>Decision</th><th>Count</th></tr></thead><tbody><tr><td>Approve</td><td>${summary?.approvedVotes || 0}</td></tr><tr><td>Reject / Request Revision</td><td>${summary?.rejectedVotes || 0}</td></tr><tr><td>Total</td><td>${summary?.totalVotes || 0}</td></tr></tbody></table></div>`;
      bindCommonPickers(boardResult);
    } catch (err) { errorBox(root, err); }
  }

  async function adminDashboard() {
    const root = shell("Admin Dashboard", "System users, settings, deadlines, schedule, and final approval metrics from Backend 1/2.");
    try {
      const [users, params, series] = await Promise.all([Api.users().catch(() => []), Api.parameters().catch(() => []), Api.allSeries().catch(() => [])]);
      state.users = users; state.params = params; state.series = series;
      const reviewing = series.filter(s => /review/i.test(s.status || "")).length;
      root.innerHTML = `<div class="stats-grid"><div class="stat-card"><div class="stat-value">${users.length}</div><div class="stat-label">Users</div></div><div class="stat-card"><div class="stat-value">${new Set(users.map(u=>u.roleName)).size}</div><div class="stat-label">Roles</div></div><div class="stat-card"><div class="stat-value">${reviewing}</div><div class="stat-label">Final Approvals</div></div><div class="stat-card"><div class="stat-value">${params.length}</div><div class="stat-label">System Parameters</div></div></div><div class="card-box" style="margin-top:30px;"><h2>Reviewing Series</h2>${series.filter(s=>/review/i.test(s.status||"")).map(s=>`<div class="list-card"><div class="list-card-content"><h2 class="list-card-title">${esc(s.title)}</h2><p class="list-card-meta">${badge(s.status)} • ${esc(s.mangakaName || "—")}</p></div><button class="btn-icon-only set-series" data-id="${s.id}"><i class="fa-solid fa-arrow-right"></i></button></div>`).join("") || `<div class="empty-state-box">No reviewing series.</div>`}</div>`;
      $$(".set-series").forEach(btn => btn.addEventListener("click", () => { Api.setActiveSeriesId(btn.dataset.id); location.href = "admin-final-approval.html"; }));
    } catch (err) { errorBox(root, err); }
  }

  async function adminUsers() {
    const root = shell("User Management", "Manage accounts, lock/unlock users, and assign role permissions.");
    try {
      state.users = await Api.users();
      const roles = ["Mangaka", "Assistant", "Tantou Editor", "Editorial Board", "Admin"];
      root.innerHTML = `<div class="card-box"><table class="data-table"><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead><tbody>${state.users.map(u => `<tr><td><strong>${esc(u.username)}</strong><br><small>${esc(u.fullName || "")}</small></td><td>${esc(u.email || "—")}</td><td><select class="form-control role-change" data-id="${u.id}">${roles.map(r => `<option ${r === u.roleName ? "selected" : ""}>${r}</option>`).join("")}</select></td><td>${badge(u.isActive ? "Active" : "Locked")}</td><td><button class="btn-outline lock-user" data-id="${u.id}" data-active="${!u.isActive}">${u.isActive ? "Lock" : "Unlock"}</button></td></tr>`).join("") || `<tr><td colspan="5">No users returned.</td></tr>`}</tbody></table></div>`;
      $$(".role-change").forEach(sel => sel.addEventListener("change", async () => { try { await Api.assignRole(sel.dataset.id, sel.value); toast("Role updated.", "success"); } catch (err) { toast(err.message, "error"); } }));
      $$(".lock-user").forEach(btn => btn.addEventListener("click", async () => { try { await Api.lockUser(btn.dataset.id, btn.dataset.active === "true"); toast("User status updated.", "success"); adminUsers(); } catch (err) { toast(err.message, "error"); } }));
    } catch (err) { errorBox(root, err); }
  }

  async function adminSettings() {
    const root = shell("System Settings", "Configure system parameters through /system-parameters.");
    try {
      state.params = await Api.parameters().catch(() => []);
      root.innerHTML = `<div class="grid-layout"><div class="card-box"><h2>Parameters</h2><table class="data-table"><thead><tr><th>Key</th><th>Value</th><th>Actions</th></tr></thead><tbody>${state.params.map(p => `<tr><td>${esc(p.paramKey)}</td><td><input class="form-control param-value" data-key="${esc(p.paramKey)}" value="${esc(p.paramValue)}"></td><td><button class="btn-outline save-param" data-key="${esc(p.paramKey)}">Save</button> <button class="btn-outline delete-param" data-key="${esc(p.paramKey)}">Delete</button></td></tr>`).join("") || `<tr><td colspan="3">No parameters yet.</td></tr>`}</tbody></table></div><div class="card-box"><h2>Add Parameter</h2><div class="form-group"><label>Key</label><input id="new-param-key" class="form-control" placeholder="MAX_UPLOAD_MB"></div><div class="form-group"><label>Value</label><input id="new-param-value" class="form-control" placeholder="20"></div><button id="create-param" class="btn-publish">Create Parameter</button></div></div>`;
      $$(".save-param").forEach(btn => btn.addEventListener("click", async () => { const val = $(`.param-value[data-key="${CSS.escape(btn.dataset.key)}"]`).value; try { await Api.updateParameter(btn.dataset.key, val); toast("Parameter saved.", "success"); } catch (err) { toast(err.message, "error"); } }));
      $$(".delete-param").forEach(btn => btn.addEventListener("click", async () => { try { await Api.deleteParameter(btn.dataset.key); toast("Parameter deleted.", "success"); adminSettings(); } catch (err) { toast(err.message, "error"); } }));
      $("#create-param")?.addEventListener("click", async () => { try { await Api.createParameter($("#new-param-key").value, $("#new-param-value").value); toast("Parameter created.", "success"); adminSettings(); } catch (err) { toast(err.message, "error"); } });
    } catch (err) { errorBox(root, err); }
  }

  async function adminCalendar() {
    const root = shell("Publishing Calendar", "Track and create publishing schedules by selected series.");
    try {
      await loadSeries();
      const seriesId = Api.getActiveSeriesId();
      state.schedules = seriesId ? await Api.schedules(seriesId).catch(() => []) : [];
      root.innerHTML = `<div class="toolbar-row">${seriesPicker()}</div><div class="grid-layout"><div class="card-box"><table class="data-table"><thead><tr><th>Publish Date</th><th>Frequency</th><th>Series</th><th>Action</th></tr></thead><tbody>${state.schedules.map(sc => `<tr><td>${fmtDate(sc.publishDate)}</td><td>${esc(sc.frequency)}</td><td>#${esc(seriesId)}</td><td><button class="btn-outline delete-schedule" data-id="${sc.id}">Delete</button></td></tr>`).join("") || `<tr><td colspan="4">No schedule for selected series.</td></tr>`}</tbody></table></div><div class="card-box"><h2>Add Schedule</h2><div class="form-group"><label>Publish Date</label><input id="schedule-date" class="form-control" type="datetime-local"></div><div class="form-group"><label>Frequency</label><input id="schedule-frequency" class="form-control" value="Weekly"></div><button id="create-schedule" class="btn-publish">Save Schedule</button></div></div>`;
      bindCommonPickers(adminCalendar);
      $$(".delete-schedule").forEach(btn => btn.addEventListener("click", async () => { try { await Api.deleteSchedule(btn.dataset.id); toast("Schedule deleted.", "success"); adminCalendar(); } catch (err) { toast(err.message, "error"); } }));
      $("#create-schedule")?.addEventListener("click", async () => { try { await Api.createSchedule({ seriesId: Number(Api.getActiveSeriesId()), publishDate: $("#schedule-date").value, frequency: $("#schedule-frequency").value }); toast("Schedule saved.", "success"); adminCalendar(); } catch (err) { toast(err.message, "error"); } });
    } catch (err) { errorBox(root, err); }
  }

  async function adminDeadlines() {
    const root = shell("Deadline Monitor", "Create and monitor color-coded deadline warnings for a selected series.");
    try {
      await loadSeries();
      const seriesId = Api.getActiveSeriesId();
      state.deadlines = seriesId ? await Api.deadlines(seriesId).catch(() => []) : [];
      root.innerHTML = `<div class="toolbar-row">${seriesPicker()}</div><div class="grid-layout"><div class="card-box"><table class="data-table"><thead><tr><th>Task/Event</th><th>Deadline</th><th>Risk</th><th>Action</th></tr></thead><tbody>${state.deadlines.map(d => `<tr><td>${esc(d.eventName)}</td><td>${fmtDate(d.deadlineDate)}</td><td>${badge(d.warningLevel || "Normal")}</td><td><button class="btn-outline delete-deadline" data-id="${d.id}">Delete</button></td></tr>`).join("") || `<tr><td colspan="4">No deadlines for selected series.</td></tr>`}</tbody></table></div><div class="card-box"><h2>Add Deadline</h2><div class="form-group"><label>Event name</label><input id="deadline-name" class="form-control" placeholder="Chapter review due"></div><div class="form-group"><label>Deadline date</label><input id="deadline-date" class="form-control" type="datetime-local"></div><button id="create-deadline" class="btn-publish">Create Deadline</button></div></div>`;
      bindCommonPickers(adminDeadlines);
      $$(".delete-deadline").forEach(btn => btn.addEventListener("click", async () => { try { await Api.deleteDeadline(btn.dataset.id); toast("Deadline deleted.", "success"); adminDeadlines(); } catch (err) { toast(err.message, "error"); } }));
      $("#create-deadline")?.addEventListener("click", async () => { try { await Api.createDeadline(Api.getActiveSeriesId(), $("#deadline-name").value, $("#deadline-date").value); toast("Deadline created.", "success"); adminDeadlines(); } catch (err) { toast(err.message, "error"); } });
    } catch (err) { errorBox(root, err); }
  }

  async function adminFinalApproval() {
    const root = shell("Final Approval", "Admin final publishing approval with Editorial Board vote summary.");
    try {
      await loadSeries();
      const reviewing = state.series.filter(s => /review/i.test(s.status || ""));
      if (reviewing.length && !reviewing.some(s => String(s.id) === String(Api.getActiveSeriesId()))) Api.setActiveSeriesId(reviewing[0].id);
      const s = state.series.find(x => String(x.id) === String(Api.getActiveSeriesId())) || reviewing[0] || state.series[0];
      const summary = s ? await Api.voteSummary(s.id).catch(() => null) : null;
      root.innerHTML = `<div class="toolbar-row">${seriesPicker(s?.id)}</div><div class="card-box"><h2>${esc(s?.title || "No series selected")}</h2><p>${badge(s?.status)} • Mangaka: ${esc(s?.mangakaName || "—")}</p><table class="data-table"><thead><tr><th>Decision</th><th>Count</th></tr></thead><tbody><tr><td>Approve</td><td>${summary?.approvedVotes || 0}</td></tr><tr><td>Reject / Revision</td><td>${summary?.rejectedVotes || 0}</td></tr><tr><td>Total</td><td>${summary?.totalVotes || 0}</td></tr></tbody></table><div style="margin-top:20px;"><button id="admin-approve" class="btn-publish">Approve Publication</button><button id="admin-reject" class="btn-publish danger-button" style="margin-left:10px;">Reject / Request Revision</button></div></div>`;
      bindCommonPickers(adminFinalApproval);
      $("#admin-approve")?.addEventListener("click", async () => { try { await Api.adminDecision(Api.getActiveSeriesId(), true); toast("Admin approved publication.", "success"); adminFinalApproval(); } catch (err) { toast(err.message, "error"); } });
      $("#admin-reject")?.addEventListener("click", async () => { try { await Api.adminDecision(Api.getActiveSeriesId(), false); toast("Admin rejected publication.", "success"); adminFinalApproval(); } catch (err) { toast(err.message, "error"); } });
    } catch (err) { errorBox(root, err); }
  }

  const handlers = {
    "tantou-dashboard.html": tantouDashboard,
    "tantou-feedback.html": tantouFeedback,
    "tantou-review.html": tantouReview,
    "tantou-revision.html": tantouRevision,
    "tantou-report.html": tantouReport,
    "board-dashboard.html": boardDashboard,
    "editorial-board.html": boardDashboard,
    "board-submissions.html": boardSubmissions,
    "board-voting.html": boardVoting,
    "board-result.html": boardResult,
    "admin-dashboard.html": adminDashboard,
    "admin-users.html": adminUsers,
    "admin-settings.html": adminSettings,
    "admin-calendar.html": adminCalendar,
    "admin-deadlines.html": adminDeadlines,
    "admin-final-approval.html": adminFinalApproval,
  };

  document.addEventListener("DOMContentLoaded", () => {
    const userId = localStorage.getItem("userId");
    Api.connectNotifications?.(userId, (message) => toast(typeof message === "string" ? message : (message.message || "New notification"), "info"));
    handlers[page]?.();
  });
})();
