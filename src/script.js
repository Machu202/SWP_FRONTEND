document.addEventListener("DOMContentLoaded", () => {
    /* KHAI BÁO UI */
    const loginTabs = document.getElementById("login-tabs");
    const tabPassword = document.getElementById("tab-password");
    const tabOtp = document.getElementById("tab-otp");
    const formPassword = document.getElementById("form-password-section");
    const formOtp = document.getElementById("form-otp-section");
    const formRegister = document.getElementById("form-register-section");
    const otpStep1 = document.getElementById("otp-step-1");
    const otpStep2 = document.getElementById("otp-step-2");

    /* LOGIC CHUYỂN TAB */
    const resetToPasswordTab = () => {
        tabPassword.classList.add("active");
        tabOtp.classList.remove("active");
        formPassword.style.display = "block";
        formOtp.style.display = "none";
        formRegister.style.display = "none";
        loginTabs.style.display = "flex";
    };

    tabPassword.addEventListener("click", resetToPasswordTab);

    tabOtp.addEventListener("click", () => {
        tabOtp.classList.add("active");
        tabPassword.classList.remove("active");
        formOtp.style.display = "block";
        formPassword.style.display = "none";
        formRegister.style.display = "none";
        otpStep1.style.display = "block";
        otpStep2.style.display = "none";
    });

    const btnGoToRegister = document.getElementById("go-to-register");
    if(btnGoToRegister) {
        btnGoToRegister.addEventListener("click", (e) => {
            e.preventDefault();
            loginTabs.style.display = "none";
            formPassword.style.display = "none";
            formOtp.style.display = "none";
            formRegister.style.display = "block";
        });
    }

    const btnBackToLogin = document.getElementById("back-to-login");
    if(btnBackToLogin) {
        btnBackToLogin.addEventListener("click", (e) => {
            e.preventDefault();
            resetToPasswordTab();
        });
    }

    /* ĐĂNG NHẬP THÀNH CÔNG -> CHUYỂN THEO ROLE */
    const btnLogin = document.getElementById("btn-login");
    const loginRoleSelect = document.getElementById("login-role-select");

    const routeByRole = {
        mangaka: "mangaka-dashboard.html",
        assistant: "assistant-dashboard.html",
        tantou: "tantou-dashboard.html",
        editorial: "board-dashboard.html",
        admin: "admin-dashboard.html"
    };

    if(btnLogin) {
        btnLogin.addEventListener("click", (e) => {
            e.preventDefault();
            const selectedRole = loginRoleSelect ? loginRoleSelect.value : "mangaka";
            window.location.href = routeByRole[selectedRole] || "mangaka-dashboard.html";
        });
    }

    /* LOGIC OTP */
    const btnEnterOtp = document.getElementById("btn-enter-otp");
    const btnSendAgain = document.getElementById("btn-send-again");
    const timerDisplay = document.getElementById("timer-count");
    let countdownInterval;

    const startCountdown = () => {
        let timeLeft = 60;
        if(timerDisplay) timerDisplay.textContent = timeLeft;
        clearInterval(countdownInterval);
        countdownInterval = setInterval(() => {
            timeLeft--;
            if(timerDisplay) timerDisplay.textContent = timeLeft;
            if (timeLeft <= 0) {
                clearInterval(countdownInterval);
                if(timerDisplay) timerDisplay.textContent = "0";
            }
        }, 1000);
    };

    if(btnEnterOtp) {
        btnEnterOtp.addEventListener("click", (e) => {
            e.preventDefault();
            if(otpStep1) otpStep1.style.display = "none";
            if(otpStep2) otpStep2.style.display = "block";
            startCountdown();
        });
    }

    if(btnSendAgain) {
        btnSendAgain.addEventListener("click", (e) => {
            e.preventDefault();
            startCountdown();
            alert("Đã gửi lại mã OTP mới!");
        });
    }

    /* ẨN/HIỆN MẬT KHẨU */
    const eyeIcons = document.querySelectorAll(".eye-icon");
    eyeIcons.forEach(icon => {
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
}); 

/* Extra static interactions for combined role pages */
document.addEventListener("DOMContentLoaded", () => {
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
