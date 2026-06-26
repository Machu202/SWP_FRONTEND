document.addEventListener("DOMContentLoaded", () => {
  const toast = document.getElementById("toast-msg");
  function showToast(message = "Saved!") {
    if (!toast) return;
    toast.querySelector("span") ? toast.querySelector("span").textContent = message : toast.innerHTML = `<i class="fa-solid fa-circle-check"></i><span>${message}</span>`;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 1800);
  }
  window.showToast = showToast;
  document.querySelectorAll(".js-toast").forEach(btn => btn.addEventListener("click", (e) => { e.preventDefault(); showToast(btn.dataset.message || "Saved successfully!"); }));
  const openAssign = document.getElementById("open-assign-modal");
  const closeAssign = document.getElementById("close-assign-modal");
  const assignModal = document.getElementById("assign-modal");
  openAssign?.addEventListener("click", () => assignModal.style.display = "flex");
  closeAssign?.addEventListener("click", () => { assignModal.style.display = "none"; showToast("Assignment saved!"); });
});
