
document.addEventListener("DOMContentLoaded", () => {
  const Api = window.MangaApi;
  const googleBtn = document.getElementById("btn-google");
  if (googleBtn) {
    googleBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (Api?.googleLoginUrl) window.location.href = Api.googleLoginUrl();
      else alert("Google login endpoint is not configured.");
    });
  }

  const requestBtn = document.getElementById("btn-request-otp");
  const verifyBtn = document.getElementById("btn-verify-otp");
  requestBtn?.addEventListener("click", async () => {
    const email = document.getElementById("otp-email")?.value?.trim();
    if (!email) return alert("Enter email first.");
    try { await Api.requestOtp(email); alert("OTP requested. Check email."); }
    catch (err) { alert("OTP request failed: " + err.message); }
  });

  verifyBtn?.addEventListener("click", async () => {
    const email = document.getElementById("otp-email")?.value?.trim();
    const otp = document.getElementById("otp-code")?.value?.trim();
    if (!email || !otp) return alert("Enter email and OTP.");
    try {
      const data = await Api.verifyOtp(email, otp);
      Api.setSession(data);
      window.location.href = Api.routeForRole(data.role || localStorage.getItem("role"));
    } catch (err) { alert("OTP verify failed: " + err.message); }
  });
});
