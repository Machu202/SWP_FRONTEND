document.addEventListener("DOMContentLoaded", () => {
  const tabPassword = document.getElementById("tab-password");
  const tabOtp = document.getElementById("tab-otp");
  const formPassword = document.getElementById("form-password-section");
  const formOtp = document.getElementById("form-otp-section");
  const btnLogin = document.getElementById("btn-login");
  const roleRoutes = {
    mangaka: "dashboard.html",
    assistant: "assistant-dashboard.html",
    tantou: "tantou-dashboard.html",
    editorial: "board-dashboard.html",
    admin: "admin-dashboard.html"
  };
  tabPassword?.addEventListener("click", () => { tabPassword.classList.add("active"); tabOtp?.classList.remove("active"); formPassword.style.display = "block"; formOtp.style.display = "none"; });
  tabOtp?.addEventListener("click", () => { tabOtp.classList.add("active"); tabPassword?.classList.remove("active"); formOtp.style.display = "block"; formPassword.style.display = "none"; });
  btnLogin?.addEventListener("click", (e) => { e.preventDefault(); const role = document.getElementById("login-role")?.value || "mangaka"; window.location.href = roleRoutes[role] || "dashboard.html"; });
  document.querySelectorAll(".eye-icon").forEach(icon => icon.addEventListener("click", () => { const input = icon.previousElementSibling; input.type = input.type === "password" ? "text" : "password"; }));
});
