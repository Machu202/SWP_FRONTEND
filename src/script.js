document.addEventListener("DOMContentLoaded", () => {
    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

    function showStatus(message, isError = false, anchorSelector = ".form-container") {
        const anchor = $(anchorSelector) || document.body;
        let box = $("#api-status-message");
        if (!box) {
            box = document.createElement("div");
            box.id = "api-status-message";
            box.style.margin = "12px 0";
            box.style.padding = "10px 12px";
            box.style.borderRadius = "10px";
            box.style.fontSize = "14px";
            box.style.lineHeight = "1.35";
            if (anchor.firstElementChild) {
                anchor.insertBefore(box, anchor.firstElementChild.nextSibling);
            } else {
                anchor.prepend(box);
            }
        }
        box.textContent = message;
        box.style.background = isError ? "#fee2e2" : "#dcfce7";
        box.style.color = isError ? "#991b1b" : "#166534";
        box.style.border = isError ? "1px solid #fecaca" : "1px solid #bbf7d0";
    }

    function setLoading(button, isLoading, labelWhenLoading = "Please wait...") {
        if (!button) return;
        if (isLoading) {
            button.dataset.originalText = button.textContent;
            button.textContent = labelWhenLoading;
            button.disabled = true;
        } else {
            button.textContent = button.dataset.originalText || button.textContent;
            button.disabled = false;
        }
    }

    function isEmail(value) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
    }

    /* LOGIN / REGISTER UI */
    const loginTabs = $("#login-tabs");
    const tabPassword = $("#tab-password");
    const tabOtp = $("#tab-otp");
    const formPassword = $("#form-password-section");
    const formOtp = $("#form-otp-section");
    const formRegister = $("#form-register-section");
    const otpStep1 = $("#otp-step-1");
    const otpStep2 = $("#otp-step-2");

    let pendingOtpEmail = localStorage.getItem("pendingOtpEmail") || "";
    let pendingLoginUsername = "";
    let pendingLoginPassword = "";

    function showPasswordTab() {
        if (tabPassword) tabPassword.classList.add("active");
        if (tabOtp) tabOtp.classList.remove("active");
        if (formPassword) formPassword.style.display = "block";
        if (formOtp) formOtp.style.display = "none";
        if (formRegister) formRegister.style.display = "none";
        if (loginTabs) loginTabs.style.display = "flex";
    }

    function showOtpStep({ askEmail = false } = {}) {
        if (tabOtp) tabOtp.classList.add("active");
        if (tabPassword) tabPassword.classList.remove("active");
        if (formOtp) formOtp.style.display = "block";
        if (formPassword) formPassword.style.display = "none";
        if (formRegister) formRegister.style.display = "none";
        if (otpStep1) otpStep1.style.display = askEmail ? "block" : "none";
        if (otpStep2) otpStep2.style.display = askEmail ? "none" : "block";
        ensureVerifyOtpButton();
    }

    function getLoginUsernameInput() {
        return $("#login-username") || $("input[name='username']") || $("#form-password-section input[type='text']");
    }

    function getLoginPasswordInput() {
        return $("#login-password") || $("input[name='password']") || $("#form-password-section input[type='password']");
    }

    function getOtpEmailInput() {
        return $("#otp-email") || $("input[name='email']", otpStep1 || document) || $("#otp-step-1 input[type='text']");
    }

    function getOtpCodeInput() {
        return $("#otp-code") || $("input[name='otpCode']") || $("#otp-step-2 input[type='text']");
    }

    function ensureVerifyOtpButton() {
        if (!otpStep2 || $("#btn-verify-otp")) return;
        const wrapper = document.createElement("div");
        wrapper.className = "center-btn";
        wrapper.style.marginTop = "14px";
        wrapper.innerHTML = `<button class="btn-secondary" id="btn-verify-otp">Verify OTP</button>`;
        otpStep2.appendChild(wrapper);
        $("#btn-verify-otp").addEventListener("click", handleVerifyOtp);
    }

    function startCountdown() {
        const timerDisplay = $("#timer-count");
        let timeLeft = 60;
        if (timerDisplay) timerDisplay.textContent = timeLeft;
        clearInterval(window.__otpCountdownInterval);
        window.__otpCountdownInterval = setInterval(() => {
            timeLeft--;
            if (timerDisplay) timerDisplay.textContent = timeLeft;
            if (timeLeft <= 0) {
                clearInterval(window.__otpCountdownInterval);
                if (timerDisplay) timerDisplay.textContent = "0";
            }
        }, 1000);
    }

    async function handlePasswordLogin(event) {
        event.preventDefault();
        const btnLogin = event.currentTarget;
        const usernameInput = getLoginUsernameInput();
        const passwordInput = getLoginPasswordInput();
        const username = usernameInput ? usernameInput.value.trim() : "";
        const password = passwordInput ? passwordInput.value : "";

        if (!window.MangaApi) {
            showStatus("api.js is missing. Make sure <script src=\"api.js\"></script> loads before script.js.", true);
            return;
        }
        if (!username || !password) {
            showStatus("Please enter username/email and password.", true);
            return;
        }

        setLoading(btnLogin, true, "Sending OTP...");
        try {
            const response = await window.MangaApi.loginWithPassword(username, password);
            pendingLoginUsername = username;
            pendingLoginPassword = password;
            pendingOtpEmail = isEmail(username) ? username : "";
            if (pendingOtpEmail) {
                localStorage.setItem("pendingOtpEmail", pendingOtpEmail);
                const otpEmailInput = getOtpEmailInput();
                if (otpEmailInput) otpEmailInput.value = pendingOtpEmail;
            }

            showStatus(response.message || "Login accepted. Check email for OTP.");
            showOtpStep({ askEmail: !pendingOtpEmail });
            startCountdown();
        } catch (error) {
            showStatus(error.message || "Login failed.", true);
        } finally {
            setLoading(btnLogin, false);
        }
    }

    async function handleVerifyOtp(event) {
        if (event) event.preventDefault();
        const verifyBtn = event ? event.currentTarget : $("#btn-verify-otp");
        const otpEmailInput = getOtpEmailInput();
        const otpCodeInput = getOtpCodeInput();
        const email = (pendingOtpEmail || (otpEmailInput ? otpEmailInput.value : "")).trim();
        const otpCode = otpCodeInput ? otpCodeInput.value.trim().replace(/-/g, "") : "";

        if (!email || !isEmail(email)) {
            showStatus("Backend /auth/verify-otp requires the account email. Please enter a valid email.", true);
            showOtpStep({ askEmail: true });
            return;
        }
        if (!otpCode) {
            showStatus("Please enter the OTP code from email.", true);
            return;
        }

        pendingOtpEmail = email;
        localStorage.setItem("pendingOtpEmail", email);
        setLoading(verifyBtn, true, "Verifying...");
        try {
            const data = await window.MangaApi.verifyOtp(email, otpCode);
            localStorage.removeItem("pendingOtpEmail");
            showStatus("Login successful. Redirecting...");
            window.MangaApi.goToDashboard(data.role);
        } catch (error) {
            showStatus(error.message || "OTP verification failed.", true);
        } finally {
            setLoading(verifyBtn, false);
        }
    }

    async function handleRegister(event) {
        event.preventDefault();
        const btn = event.currentTarget;
        const emailInput = $("#register-email") || $("#form-register-section input[type='text']");
        const usernameInput = $("#register-username");
        const passwordInput = $("#register-password") || $("#form-register-section input[type='password']");
        const roleInput = $("#register-role") || $("#form-register-section select.role-select");

        const emailOrName = emailInput ? emailInput.value.trim() : "";
        const email = isEmail(emailOrName) ? emailOrName : "";
        const username = usernameInput && usernameInput.value.trim()
            ? usernameInput.value.trim()
            : (email ? email.split("@")[0] : emailOrName);
        const password = passwordInput ? passwordInput.value : "";
        const role = roleInput ? roleInput.value : "Mangaka";

        if (!username || !email || !password) {
            showStatus("Register needs username, valid email, and password for backend compatibility.", true);
            return;
        }

        setLoading(btn, true, "Registering...");
        try {
            const response = await window.MangaApi.registerUser({ username, email, password, role });
            showStatus(response.message || "Registered successfully. You can login now.");
            showPasswordTab();
            const usernameInputLogin = getLoginUsernameInput();
            if (usernameInputLogin) usernameInputLogin.value = username;
        } catch (error) {
            showStatus(error.message || "Registration failed.", true);
        } finally {
            setLoading(btn, false);
        }
    }

    if (tabPassword) tabPassword.addEventListener("click", showPasswordTab);
    if (tabOtp) {
        tabOtp.addEventListener("click", () => {
            showOtpStep({ askEmail: true });
        });
    }

    const btnGoToRegister = $("#go-to-register");
    if (btnGoToRegister) {
        btnGoToRegister.addEventListener("click", (e) => {
            e.preventDefault();
            if (loginTabs) loginTabs.style.display = "none";
            if (formPassword) formPassword.style.display = "none";
            if (formOtp) formOtp.style.display = "none";
            if (formRegister) formRegister.style.display = "block";
        });
    }

    const btnBackToLogin = $("#back-to-login");
    if (btnBackToLogin) {
        btnBackToLogin.addEventListener("click", (e) => {
            e.preventDefault();
            showPasswordTab();
        });
    }

    const btnLogin = $("#btn-login");
    if (btnLogin) btnLogin.addEventListener("click", handlePasswordLogin);

    const btnEnterOtp = $("#btn-enter-otp");
    if (btnEnterOtp) {
        btnEnterOtp.addEventListener("click", (e) => {
            e.preventDefault();
            const otpEmailInput = getOtpEmailInput();
            pendingOtpEmail = otpEmailInput ? otpEmailInput.value.trim() : pendingOtpEmail;
            if (!pendingOtpEmail || !isEmail(pendingOtpEmail)) {
                showStatus("Enter the email that received the backend OTP first.", true);
                return;
            }
            localStorage.setItem("pendingOtpEmail", pendingOtpEmail);
            showOtpStep({ askEmail: false });
            startCountdown();
        });
    }

    const btnSendAgain = $("#btn-send-again");
    if (btnSendAgain) {
        btnSendAgain.addEventListener("click", async (e) => {
            e.preventDefault();
            if (!pendingLoginUsername || !pendingLoginPassword) {
                startCountdown();
                showStatus("To resend from backend, use password login again so /auth/login can regenerate OTP.", true);
                return;
            }
            setLoading(btnSendAgain, true, "Sending...");
            try {
                const response = await window.MangaApi.loginWithPassword(pendingLoginUsername, pendingLoginPassword);
                startCountdown();
                showStatus(response.message || "OTP sent again.");
            } catch (error) {
                showStatus(error.message || "Could not resend OTP.", true);
            } finally {
                setLoading(btnSendAgain, false);
            }
        });
    }

    const btnRegister = $("#btn-register") || $(".btn-registrate");
    if (btnRegister) btnRegister.addEventListener("click", handleRegister);

    ensureVerifyOtpButton();

    /* GOOGLE LOGIN: requires Google Identity Services to call this with a real ID token. */
    window.handleGoogleCredentialResponse = async function (response) {
        if (!response || !response.credential) return;
        try {
            const data = await window.MangaApi.loginWithGoogle(response.credential);
            window.MangaApi.goToDashboard(data.role);
        } catch (error) {
            showStatus(error.message || "Google login failed.", true);
        }
    };

    /* PASSWORD VISIBILITY */
    $$(".eye-icon").forEach(icon => {
        icon.addEventListener("click", () => {
            const passwordInput = icon.previousElementSibling;
            if (passwordInput && passwordInput.type === "password") {
                passwordInput.type = "text";
                icon.textContent = "🔒";
            } else if (passwordInput) {
                passwordInput.type = "password";
                icon.textContent = "👁️";
            }
        });
    });

    /* SAFE LOGOUT: clear JWT before returning to login. */
    $$('a[href="index.html"]').forEach(link => {
        const text = (link.textContent || "").toLowerCase();
        if (text.includes("logout") || link.innerHTML.includes("right-from-bracket")) {
            link.addEventListener("click", (e) => {
                e.preventDefault();
                if (window.MangaApi) window.MangaApi.logout("index.html");
                else window.location.href = "index.html";
            });
        }
    });

    /* Extra static interactions for combined role pages */
    document.querySelectorAll("[data-toast]").forEach(btn => {
        btn.addEventListener("click", () => {
            let toast = document.getElementById("toast-msg");
            if (!toast) {
                toast = document.createElement("div");
                toast.id = "toast-msg";
                toast.style.position = "fixed";
                toast.style.right = "24px";
                toast.style.bottom = "24px";
                toast.style.background = "#111827";
                toast.style.color = "white";
                toast.style.padding = "12px 16px";
                toast.style.borderRadius = "10px";
                toast.style.zIndex = "999";
                toast.style.display = "none";
                document.body.appendChild(toast);
            }
            toast.textContent = btn.dataset.toast || "Saved!";
            toast.style.display = "block";
            setTimeout(() => toast.style.display = "none", 1800);
        });
    });

    document.querySelectorAll("[data-vote]").forEach(card => {
        card.addEventListener("click", () => {
            document.querySelectorAll("[data-vote]").forEach(item => item.classList.remove("selected"));
            card.classList.add("selected");
        });
    });

    const slider = document.getElementById("version-range");
    const label = document.getElementById("version-label");
    if (slider && label) {
        slider.addEventListener("input", () => {
            label.textContent = "Version " + slider.value;
        });
    }
});
