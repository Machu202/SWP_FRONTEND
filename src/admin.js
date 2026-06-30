
document.addEventListener("DOMContentLoaded", () => {
  const Api = window.MangaApi;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;'}[c]));
  let selected = null;

  function log(msg, ok = true) {
    $("#voting-log").innerHTML = `<div class="${ok ? "log-ok" : "log-error"}">${msg}</div>`;
  }

  async function loadSeries() {
    $("#reviewing-series-list").innerHTML = `<div class="api-loading">Loading...</div>`;
    try {
      const list = await Api.allSeries({ status: "REVIEWING" });
      const items = Array.isArray(list) ? list : (list?.content || []);
      $("#reviewing-series-list").innerHTML = items.length ? items.map(s => `
        <button class="series-decision-card" data-id="${s.id}">
          <strong>${esc(s.title || `Series #${s.id}`)}</strong>
          <span>${esc(s.genre || "")}</span>
          <small>${esc(s.status || "REVIEWING")}</small>
        </button>`).join("") : `<div class="empty-state-box">No series in REVIEWING status.</div>`;
      document.querySelectorAll(".series-decision-card").forEach(btn => btn.addEventListener("click", () => selectSeries(items.find(s => String(s.id) === btn.dataset.id))));
    } catch (err) {
      $("#reviewing-series-list").innerHTML = `<div class="api-error">${err.message}</div>`;
    }
  }

  async function selectSeries(series) {
    selected = series;
    Api.setActiveSeriesId(series.id);
    $("#selected-series-box").className = "selected-series-box";
    $("#selected-series-box").innerHTML = `<h3>${esc(series.title)}</h3><p>${esc(series.summary || "No summary")}</p><small>${esc(series.genre || "")} · ${esc(series.status || "")}</small>`;
    await loadSummary();
  }

  async function loadSummary() {
    if (!selected) return;
    $("#vote-summary-box").innerHTML = `<div class="api-loading">Loading vote summary...</div>`;
    try {
      const summary = await Api.voteSummary(selected.id);
      $("#vote-summary-box").innerHTML = `<div class="vote-summary">
        <div><strong>${summary.approveCount ?? summary.approves ?? 0}</strong><span>Approve</span></div>
        <div><strong>${summary.rejectCount ?? summary.rejects ?? 0}</strong><span>Reject</span></div>
        <div><strong>${summary.totalVotes ?? summary.total ?? 0}</strong><span>Total</span></div>
      </div>`;
    } catch (err) {
      $("#vote-summary-box").innerHTML = `<div class="api-error">${err.message}</div>`;
    }
  }

  async function vote(isApproved) {
    if (!selected) return alert("Select a series first.");
    try {
      await Api.castVote(selected.id, isApproved);
      log(isApproved ? "Vote approve submitted." : "Vote reject submitted.");
      await loadSummary();
    } catch (err) {
      log(err.message, false);
    }
  }

  async function adminDecision(isApproved) {
    if (!selected) return alert("Select a series first.");
    const tantouId = $("#tantou-id").value || localStorage.getItem("userId") || "";
    try {
      await Api.adminDecision(selected.id, isApproved, tantouId);
      log(isApproved ? "Admin approved final publishing." : "Admin rejected publishing.");
      await loadSeries();
    } catch (err) {
      log(err.message, false);
    }
  }

  $("#vote-approve")?.addEventListener("click", () => vote(true));
  $("#vote-reject")?.addEventListener("click", () => vote(false));
  $("#admin-approve")?.addEventListener("click", () => adminDecision(true));
  $("#admin-reject")?.addEventListener("click", () => adminDecision(false));
  $("#btn-refresh-voting")?.addEventListener("click", loadSeries);

  loadSeries();
});
