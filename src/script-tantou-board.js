document.addEventListener("DOMContentLoaded", () => {
  const toast = (message) => window.showToast ? window.showToast(message) : alert(message);
  const hitboxes = document.querySelectorAll(".review-hitbox[data-title]");
  const fbTitle = document.getElementById("fb-title");
  const fbType = document.getElementById("fb-type");
  const fbStatus = document.getElementById("fb-status");
  const fbComment = document.getElementById("fb-comment");
  hitboxes.forEach(box => box.addEventListener("click", () => {
    hitboxes.forEach(item => item.classList.remove("active"));
    box.classList.add("active");
    if (fbTitle) fbTitle.textContent = box.dataset.title;
    if (fbType) fbType.textContent = `Type: ${box.dataset.type}`;
    if (fbStatus) { fbStatus.textContent = box.dataset.status; fbStatus.className = box.dataset.status === "Fixed" ? "badge-review success" : "badge-review warning"; }
    if (fbComment) fbComment.textContent = box.dataset.comment;
  }));
  const addFeedbackBtn = document.getElementById("btn-add-feedback");
  addFeedbackBtn?.addEventListener("click", () => {
    const input = document.getElementById("new-comment");
    const thread = document.getElementById("comment-thread");
    if (!input || !thread || !input.value.trim()) return;
    const item = document.createElement("div");
    item.className = "thread-item";
    item.innerHTML = `<strong>Tantou Editor</strong><p>${input.value}</p>`;
    thread.prepend(item); input.value = ""; toast("Feedback saved!");
  });
  const versionSlider = document.getElementById("version-slider");
  const versionNumber = document.getElementById("version-number");
  versionSlider?.addEventListener("input", () => { if (versionNumber) versionNumber.textContent = versionSlider.value; });
  const voteCards = document.querySelectorAll(".board-vote-card");
  let selectedVote = "Request Revision";
  voteCards.forEach(card => card.addEventListener("click", () => { voteCards.forEach(item => item.classList.remove("active")); card.classList.add("active"); selectedVote = card.dataset.vote; }));
  document.getElementById("btn-submit-vote")?.addEventListener("click", () => {
    const comment = document.getElementById("board-comment")?.value || "No comment.";
    const thread = document.getElementById("vote-thread");
    if (thread) { const item = document.createElement("div"); item.className = "thread-item"; item.innerHTML = `<strong>Current Board Member</strong><p>${selectedVote}. ${comment}</p>`; thread.prepend(item); }
    const ids = { Approve: "approve-count", "Request Revision": "revision-count", Reject: "reject-count" };
    const el = document.getElementById(ids[selectedVote]); if (el) el.textContent = Number(el.textContent) + 1;
    toast("Vote submitted!");
  });
  const modal = document.getElementById("decision-modal");
  document.getElementById("btn-finalize-decision")?.addEventListener("click", () => { modal.style.display = "flex"; });
  document.getElementById("close-decision-modal")?.addEventListener("click", () => { modal.style.display = "none"; });
});
