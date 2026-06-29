document.addEventListener("DOMContentLoaded", () => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const toast = (message, type = "info") => {
    let el = document.getElementById("toast-msg");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast-msg";
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.dataset.type = type;
    el.style.display = "block";
    setTimeout(() => { el.style.display = "none"; }, 2600);
  };
  window.showToast = toast;

  const loginTabs = $("#login-tabs");
  const tabPassword = $("#tab-password");
  const tabOtp = $("#tab-otp");
  const formPassword = $("#form-password-section");
  const formOtp = $("#form-otp-section");
  const formRegister = $("#form-register-section");
  const otpStep1 = $("#otp-step-1");
  const otpStep2 = $("#otp-step-2");

  const resetToPasswordTab = () => {
    if (!tabPassword || !tabOtp || !formPassword || !formOtp || !formRegister || !loginTabs) return;
    tabPassword.classList.add("active");
    tabOtp.classList.remove("active");
    formPassword.style.display = "block";
    formOtp.style.display = "none";
    formRegister.style.display = "none";
    loginTabs.style.display = "flex";
  };

  tabPassword?.addEventListener("click", resetToPasswordTab);
  tabOtp?.addEventListener("click", () => {
    tabOtp.classList.add("active");
    tabPassword?.classList.remove("active");
    if (formOtp) formOtp.style.display = "block";
    if (formPassword) formPassword.style.display = "none";
    if (formRegister) formRegister.style.display = "none";
    if (otpStep1) otpStep1.style.display = "block";
    if (otpStep2) otpStep2.style.display = "none";
  });

  $("#go-to-register")?.addEventListener("click", (e) => {
    e.preventDefault();
    if (loginTabs) loginTabs.style.display = "none";
    if (formPassword) formPassword.style.display = "none";
    if (formOtp) formOtp.style.display = "none";
    if (formRegister) formRegister.style.display = "block";
  });
  $("#back-to-login")?.addEventListener("click", (e) => { e.preventDefault(); resetToPasswordTab(); });

  async function handleBackendLogin(e) {
    e?.preventDefault?.();

    const btn = $("#btn-login");
    const usernameInput = $("#login-username") || $("#username") || $("input[type='text']", formPassword || document);
    const passwordInput = $("#login-password") || $("input[type='password']", formPassword || document);
    const selectedRole = "";

    const username = usernameInput?.value?.trim() || "";
    const password = passwordInput?.value || "";

    if (!username || !password) {
      toast("Enter username/email and password first.", "error");
      usernameInput?.focus();
      return;
    }

    const oldText = btn?.textContent || "Login";
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Logging in...";
    }

    try {
      console.log("[Login] POST /api/v1/auth/login", { username });
      const data = await window.MangaApi.login({ username, password });

      console.log("[Login] Success:", data);
      toast(data.message || "Login successful.", "success");

      const target = window.MangaApi.routeForRole(data.role || localStorage.getItem("role"));
      setTimeout(() => {
        window.location.href = target;
      }, 250);
    } catch (err) {
      console.error("[Login] Failed:", err);
      const msg = err?.message || "Login failed.";
      toast(msg, "error");
      const status = $("#login-status");
      if (status) {
        status.textContent = msg;
        status.dataset.type = "error";
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = oldText;
      }
    }
  }

  $("#btn-login")?.addEventListener("click", handleBackendLogin);
  $("#form-password-section")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleBackendLogin(e);
  });


  $(".btn-registrate")?.addEventListener("click", async (e) => {
    e.preventDefault();
    const inputs = $$("input", formRegister || document);
    const selects = $$("select", formRegister || document);
    const loginName = inputs[0]?.value?.trim();
    const password = inputs.find((input) => input.type === "password")?.value || "";
    const phoneNumber = inputs[2]?.value?.trim() || "";
    const selectedRole = selects[0]?.value || "mangaka";
    const roleMap = {
      mangaka: "Mangaka",
      assistant: "Assistant",
      tantou: "Tantou Editor",
      editorial: "Editorial Board",
      admin: "Admin",
    };
    if (!loginName || !password) return toast("Nhập username/email và password trước.", "error");
    const payload = {
      username: loginName.includes("@") ? loginName.split("@")[0].replace(/[^a-zA-Z0-9_.-]/g, "") : loginName,
      email: loginName.includes("@") ? loginName : "",
      password,
      phoneNumber,
      role: roleMap[selectedRole] || "Mangaka",
    };
    try {
      const res = await window.MangaApi.register(payload);
      toast(res.message || "Tạo tài khoản thành công.", "success");
      resetToPasswordTab();
    } catch (err) {
      toast(err.message || "Tạo tài khoản thất bại.", "error");
    }
  });

  let countdownInterval;
  const startCountdown = () => {
    const timerDisplay = $("#timer-count");
    let timeLeft = 60;
    if (timerDisplay) timerDisplay.textContent = timeLeft;
    clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
      timeLeft -= 1;
      if (timerDisplay) timerDisplay.textContent = Math.max(0, timeLeft);
      if (timeLeft <= 0) clearInterval(countdownInterval);
    }, 1000);
  };
  $("#btn-enter-otp")?.addEventListener("click", (e) => {
    e.preventDefault();
    if (otpStep1) otpStep1.style.display = "none";
    if (otpStep2) otpStep2.style.display = "block";
    startCountdown();
  });
  $("#btn-send-again")?.addEventListener("click", (e) => { e.preventDefault(); startCountdown(); toast("Đã gửi lại mã OTP mới.", "success"); });

  $$(".eye-icon").forEach((icon) => {
    icon.addEventListener("click", () => {
      const passwordInput = icon.previousElementSibling;
      if (!passwordInput) return;
      passwordInput.type = passwordInput.type === "password" ? "text" : "password";
      icon.textContent = passwordInput.type === "password" ? "👁️" : "🔒";
    });
  });

  $$("[data-toast]").forEach((btn) => {
    btn.addEventListener("click", () => toast(btn.dataset.toast || "Saved!", "success"));
  });

  $$("[data-vote]").forEach((card) => {
    card.addEventListener("click", () => {
      $$("[data-vote]").forEach((item) => item.classList.remove("selected"));
      card.classList.add("selected");
    });
  });

  const slider = $("#version-range");
  const label = $("#version-label");
  slider?.addEventListener("input", () => { if (label) label.textContent = "Version " + slider.value; });

  $$("a[href='index.html']").forEach((link) => {
    if (/logout/i.test(link.textContent)) {
      link.addEventListener("click", () => window.MangaApi?.clearSession?.());
    }
  });
});
