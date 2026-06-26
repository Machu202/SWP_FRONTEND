document.addEventListener("DOMContentLoaded", () => {
    const loginTabs = document.getElementById("login-tabs");
    const tabPassword = document.getElementById("tab-password");
    const tabOtp = document.getElementById("tab-otp");
    const formPassword = document.getElementById("form-password-section");
    const formOtp = document.getElementById("form-otp-section");
    const formRegister = document.getElementById("form-register-section");
    const otpStep1 = document.getElementById("otp-step-1");
    const otpStep2 = document.getElementById("otp-step-2");

    const roleRoutes = {
        mangaka: "dashboard.html",
        assistant: "assistant-dashboard.html",
        tantou: "tantou-dashboard.html",
        editorial: "board-dashboard.html",
        admin: "admin-dashboard.html"
    };

    const demoAccounts = {
        mangaka: {
            username: "mangaka_oda",
            password: "123456",
            label: "Mangaka"
        },
        assistant: {
            username: "assistant_huy",
            password: "123456",
            label: "Assistant"
        },
        tantou: {
            username: "tantou_linh",
            password: "123456",
            label: "Tantou Editor"
        },
        editorial: {
            username: "board_sora",
            password: "123456",
            label: "Editorial Board"
        },
        admin: {
            username: "admin_vip",
            password: "123456",
            label: "Admin"
        }
    };

    function applyRole(role) {
        const safeRole = demoAccounts[role] ? role : "mangaka";
        const account = demoAccounts[safeRole];

        const loginRole = document.getElementById("login-role");
        const otpRole = document.getElementById("otp-role");
        const usernameInput = document.getElementById("login-username");
        const passwordInput = document.getElementById("login-password");
        const otpUsername = document.getElementById("otp-username");

        if (loginRole) loginRole.value = safeRole;
        if (otpRole) otpRole.value = safeRole;
        if (usernameInput) usernameInput.value = account.username;
        if (passwordInput) passwordInput.value = account.password;
        if (otpUsername) otpUsername.value = account.username;
    }

    const urlRole = new URLSearchParams(window.location.search).get("role");
    const pageRole =
        window.location.pathname.includes("assistant-login") ? "assistant" :
        window.location.pathname.includes("mangaka-login") ? "mangaka" :
        window.location.pathname.includes("tantou-login") ? "tantou" :
        window.location.pathname.includes("board-login") ? "editorial" :
        window.location.pathname.includes("admin-login") ? "admin" :
        document.body.dataset.defaultRole || "mangaka";

    applyRole(urlRole || pageRole);

    document.getElementById("login-role")?.addEventListener("change", (event) => {
        applyRole(event.target.value);
    });

    document.getElementById("otp-role")?.addEventListener("change", (event) => {
        applyRole(event.target.value);
    });

    function resetToPasswordTab() {
        tabPassword?.classList.add("active");
        tabOtp?.classList.remove("active");
        if (formPassword) formPassword.style.display = "block";
        if (formOtp) formOtp.style.display = "none";
        if (formRegister) formRegister.style.display = "none";
        if (loginTabs) loginTabs.style.display = "flex";
    }

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

    document.getElementById("go-to-register")?.addEventListener("click", (event) => {
        event.preventDefault();
        if (loginTabs) loginTabs.style.display = "none";
        if (formPassword) formPassword.style.display = "none";
        if (formOtp) formOtp.style.display = "none";
        if (formRegister) formRegister.style.display = "block";
    });

    document.getElementById("back-to-login")?.addEventListener("click", (event) => {
        event.preventDefault();
        resetToPasswordTab();
    });

    function loginBySelectedRole() {
        const role = document.getElementById("login-role")?.value || document.getElementById("otp-role")?.value || "mangaka";
        window.location.href = roleRoutes[role] || "dashboard.html";
    }

    document.getElementById("btn-login")?.addEventListener("click", (event) => {
        event.preventDefault();
        loginBySelectedRole();
    });

    let countdownInterval;

    function startCountdown() {
        const timerDisplay = document.getElementById("timer-count");
        let timeLeft = 60;
        if (timerDisplay) timerDisplay.textContent = timeLeft;

        clearInterval(countdownInterval);
        countdownInterval = setInterval(() => {
            timeLeft--;
            if (timerDisplay) timerDisplay.textContent = Math.max(timeLeft, 0);
            if (timeLeft <= 0) clearInterval(countdownInterval);
        }, 1000);
    }

    document.getElementById("btn-enter-otp")?.addEventListener("click", (event) => {
        event.preventDefault();
        if (otpStep1) otpStep1.style.display = "none";
        if (otpStep2) otpStep2.style.display = "block";
        startCountdown();
    });

    document.getElementById("btn-verify-otp")?.addEventListener("click", (event) => {
        event.preventDefault();
        loginBySelectedRole();
    });

    document.getElementById("btn-send-again")?.addEventListener("click", (event) => {
        event.preventDefault();
        startCountdown();
        alert("Đã gửi lại mã OTP mới!");
    });

    document.querySelectorAll(".eye-icon").forEach((icon) => {
        icon.addEventListener("click", () => {
            const passwordInput = icon.previousElementSibling;
            if (!passwordInput) return;

            if (passwordInput.type === "password") {
                passwordInput.type = "text";
                icon.textContent = "🔒";
            } else {
                passwordInput.type = "password";
                icon.textContent = "👁️";
            }
        });
    });
});
