document.addEventListener("DOMContentLoaded", () => {
    const toast = document.getElementById("toast-msg");
    function showToast(message) {
        if (!toast) return;
        toast.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${message}`;
        toast.classList.add("show");
        setTimeout(() => toast.classList.remove("show"), 1800);
    }

    // Tantou review hitbox click
    const hitboxes = document.querySelectorAll(".review-hitbox[data-title]");
    const fbTitle = document.getElementById("fb-title");
    const fbType = document.getElementById("fb-type");
    const fbStatus = document.getElementById("fb-status");
    const fbComment = document.getElementById("fb-comment");

    hitboxes.forEach((box) => {
        box.addEventListener("click", () => {
            hitboxes.forEach((item) => item.classList.remove("active"));
            box.classList.add("active");

            if (fbTitle) fbTitle.textContent = box.dataset.title;
            if (fbType) fbType.textContent = `Type: ${box.dataset.type}`;
            if (fbStatus) {
                fbStatus.textContent = box.dataset.status;
                fbStatus.className = box.dataset.status === "Fixed" ? "badge-review success" : "badge-review warning";
            }
            if (fbComment) fbComment.textContent = box.dataset.comment;
        });
    });

    // Tantou right panel tabs
    const tabs = document.querySelectorAll(".review-feedback-panel .p-tab");
    tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            tabs.forEach((item) => item.classList.remove("active"));
            tab.classList.add("active");

            document.querySelectorAll(".review-tab-content").forEach((panel) => {
                panel.style.display = "none";
            });

            const panel = document.getElementById(`panel-${tab.dataset.target}`);
            if (panel) panel.style.display = "block";
        });
    });

    // Add feedback comment
    const addFeedbackBtn = document.getElementById("btn-add-feedback");
    if (addFeedbackBtn) {
        addFeedbackBtn.addEventListener("click", () => {
            const input = document.getElementById("new-comment");
            const thread = document.getElementById("comment-thread");
            if (!input || !thread || !input.value.trim()) return;

            const item = document.createElement("div");
            item.className = "thread-item";
            item.innerHTML = `<strong>Tantou Editor</strong><p>${input.value}</p>`;
            thread.prepend(item);
            input.value = "";
            showToast("Feedback saved!");
        });
    }

    // Version slider
    const versionSlider = document.getElementById("version-slider");
    const versionNumber = document.getElementById("version-number");
    if (versionSlider && versionNumber) {
        versionSlider.addEventListener("input", () => {
            versionNumber.textContent = versionSlider.value;
        });
    }

    // Board vote selection
    const voteCards = document.querySelectorAll(".board-vote-card");
    let selectedVote = "Request Revision";
    voteCards.forEach((card) => {
        card.addEventListener("click", () => {
            voteCards.forEach((item) => item.classList.remove("active"));
            card.classList.add("active");
            selectedVote = card.dataset.vote;
        });
    });

    // Submit board vote
    const submitVoteBtn = document.getElementById("btn-submit-vote");
    if (submitVoteBtn) {
        submitVoteBtn.addEventListener("click", () => {
            const comment = document.getElementById("board-comment")?.value || "No comment.";
            const thread = document.getElementById("vote-thread");
            if (thread) {
                const item = document.createElement("div");
                item.className = "thread-item";
                item.innerHTML = `<strong>Current Board Member</strong><p>${selectedVote}. ${comment}</p>`;
                thread.prepend(item);
            }

            const approve = document.getElementById("approve-count");
            const revision = document.getElementById("revision-count");
            const reject = document.getElementById("reject-count");
            if (selectedVote === "Approve" && approve) approve.textContent = Number(approve.textContent) + 1;
            if (selectedVote === "Request Revision" && revision) revision.textContent = Number(revision.textContent) + 1;
            if (selectedVote === "Reject" && reject) reject.textContent = Number(reject.textContent) + 1;

            showToast("Vote submitted!");
        });
    }

    const finalizeBtn = document.getElementById("btn-finalize-decision");
    const modal = document.getElementById("decision-modal");
    const closeModal = document.getElementById("close-decision-modal");
    if (finalizeBtn && modal) {
        finalizeBtn.addEventListener("click", () => {
            modal.style.display = "flex";
        });
    }
    if (closeModal && modal) {
        closeModal.addEventListener("click", () => {
            modal.style.display = "none";
        });
    }

    const submitBoardBtn = document.getElementById("btn-submit-board");
    if (submitBoardBtn) {
        submitBoardBtn.addEventListener("click", () => {
            window.location.href = "editorial-board.html";
        });
    }
});
