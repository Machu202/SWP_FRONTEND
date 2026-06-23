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

    /* ĐĂNG NHẬP THÀNH CÔNG -> CHUYỂN TRANG MANGAKA DASHBOARD */
    const btnLogin = document.getElementById("btn-login");
    if(btnLogin) {
        btnLogin.addEventListener("click", (e) => {
            e.preventDefault();
            window.location.href = "dashboard.html"; 
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