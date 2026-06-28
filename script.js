document.addEventListener("DOMContentLoaded", () => {
    /* =======================================================
       1. KHAI BÁO UI & LOGIC CHUYỂN TAB CƠ BẢN
       ======================================================= */
    const loginTabs = document.getElementById("login-tabs");
    const tabPassword = document.getElementById("tab-password");
    const tabOtp = document.getElementById("tab-otp");
    const formPassword = document.getElementById("form-password-section");
    const formOtp = document.getElementById("form-otp-section");
    const formRegister = document.getElementById("form-register-section");
    const otpStep1 = document.getElementById("otp-step-1");
    const otpStep2 = document.getElementById("otp-step-2");

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

    /* =======================================================
       2. LOGIC ĐĂNG NHẬP MẬT KHẨU (PASSWORD)
       ======================================================= */
    const btnLogin = document.getElementById("btn-login");
    const inputUsername = document.getElementById("login-username");
    const inputPassword = document.getElementById("login-password");

    if(btnLogin) {
        btnLogin.addEventListener("click", (e) => {
            e.preventDefault();
            const username = inputUsername ? inputUsername.value.trim().toLowerCase() : "";
            const password = inputPassword ? inputPassword.value : "";

            if (!username || !password) {
                alert("Vui lòng nhập đầy đủ Tài khoản và Mật khẩu!");
                return;
            }

            const originalText = btnLogin.innerText;
            btnLogin.innerText = "Authenticating...";
            btnLogin.style.pointerEvents = "none";

            // TODO (BACKEND): Bật FETCH API Login tại đây

            setTimeout(() => { 
                if (username === 'assistant') {
                    localStorage.setItem('userRole', 'assistant');
                    window.location.href = "assistant-dashboard.html";
                } 
                else if (username === 'mangaka') {
                    localStorage.setItem('userRole', 'mangaka');
                    window.location.href = "dashboard.html";
                } 
                else {
                    alert("Sai tài khoản hoặc mật khẩu! (Demo: 'mangaka' hoặc 'assistant')");
                    btnLogin.innerText = originalText;
                    btnLogin.style.pointerEvents = "auto";
                }
            }, 1000);
        });
    }

    /* =======================================================
       3. LOGIC ĐĂNG NHẬP OTP (2 BƯỚC)
       ======================================================= */
    const btnEnterOtp = document.getElementById("btn-enter-otp"); 
    const btnVerifyOtp = document.getElementById("btn-verify-otp"); 
    const btnSendAgain = document.getElementById("btn-send-again"); 
    const timerDisplay = document.getElementById("timer-count");
    const inputOtpEmail = document.getElementById("otp-email");
    const inputOtpCode = document.getElementById("otp-code");
    
    let countdownInterval;

    const startCountdown = () => {
        let timeLeft = 60;
        if(timerDisplay) timerDisplay.textContent = timeLeft;
        clearInterval(countdownInterval);
        
        if(btnSendAgain) {
            btnSendAgain.style.opacity = "0.5";
            btnSendAgain.style.pointerEvents = "none";
        }

        countdownInterval = setInterval(() => {
            timeLeft--;
            if(timerDisplay) timerDisplay.textContent = timeLeft;
            if (timeLeft <= 0) {
                clearInterval(countdownInterval);
                if(timerDisplay) timerDisplay.textContent = "0";
                if(btnSendAgain) {
                    btnSendAgain.style.opacity = "1";
                    btnSendAgain.style.pointerEvents = "auto";
                }
            }
        }, 1000);
    };

    if(btnEnterOtp) {
        btnEnterOtp.addEventListener("click", (e) => {
            e.preventDefault();
            const email = inputOtpEmail ? inputOtpEmail.value.trim() : "";
            
            if (!email) {
                alert("Vui lòng nhập Email để nhận mã OTP!");
                return;
            }

            const originalText = btnEnterOtp.innerText;
            btnEnterOtp.innerText = "Sending OTP...";
            btnEnterOtp.style.pointerEvents = "none";

            // TODO (BACKEND): Viết FETCH API gửi Email OTP tại đây

            setTimeout(() => { 
                if(otpStep1) otpStep1.style.display = "none";
                if(otpStep2) otpStep2.style.display = "block";
                startCountdown();
                
                btnEnterOtp.innerText = originalText;
                btnEnterOtp.style.pointerEvents = "auto";
            }, 800);
        });
    }

    if(btnVerifyOtp) {
        btnVerifyOtp.addEventListener("click", (e) => {
            e.preventDefault();
            const email = inputOtpEmail ? inputOtpEmail.value.trim().toLowerCase() : "";
            const otpCode = inputOtpCode ? inputOtpCode.value.trim() : "";

            if (!otpCode || otpCode.length < 4) {
                alert("Vui lòng nhập mã OTP hợp lệ!");
                return;
            }

            const originalText = btnVerifyOtp.innerText;
            btnVerifyOtp.innerText = "Verifying...";
            btnVerifyOtp.style.pointerEvents = "none";

            // TODO (BACKEND): Viết FETCH API xác nhận OTP tại đây

            setTimeout(() => {
                if (otpCode === "123456") { 
                    if (email.includes("assistant")) {
                        localStorage.setItem('userRole', 'assistant');
                        window.location.href = "assistant-dashboard.html";
                    } else {
                        localStorage.setItem('userRole', 'mangaka');
                        window.location.href = "dashboard.html";
                    }
                } else {
                    alert("Mã OTP không chính xác. (Mã Demo là: 123456)");
                    btnVerifyOtp.innerText = originalText;
                    btnVerifyOtp.style.pointerEvents = "auto";
                }
            }, 1000);
        });
    }

    if(btnSendAgain) {
        btnSendAgain.addEventListener("click", (e) => {
            e.preventDefault();
            startCountdown();
            alert("Đã gửi lại mã OTP mới vào hộp thư của bạn!");
        });
    }

    /* =======================================================
       4. LOGIC ĐĂNG KÝ (REGISTRATION)
       ======================================================= */
    const btnRegister = document.querySelector(".btn-registrate");
    
    if (btnRegister) {
        btnRegister.addEventListener("click", (e) => {
            e.preventDefault();
            
            const inputs = document.querySelectorAll("#form-register-section input[type='text']");
            const emailOrName = inputs[0] ? inputs[0].value.trim() : "";
            const phone = inputs[1] ? inputs[1].value.trim() : "";
            const passwordElement = document.querySelector("#form-register-section input[type='password']");
            const password = passwordElement ? passwordElement.value : "";
            const roleElement = document.querySelector(".role-select");
            const role = roleElement ? roleElement.value : "mangaka";

            if (!emailOrName || !password) {
                alert("Vui lòng nhập tối thiểu Tên/Email và Mật khẩu để đăng ký!");
                return;
            }

            const originalText = btnRegister.innerText;
            btnRegister.innerText = "Creating Account...";
            btnRegister.style.pointerEvents = "none";

            // TODO (BACKEND DEVELOPER): FETCH API Đăng ký tại đây

            setTimeout(() => {
                alert(`Đăng ký thành công!\nTài khoản: ${emailOrName}\nVai trò: ${role}\n\nHệ thống sẽ chuyển bạn về trang Đăng nhập.`);
                
                btnRegister.innerText = originalText;
                btnRegister.style.pointerEvents = "auto";

                const btnBack = document.getElementById("back-to-login");
                if(btnBack) btnBack.click();
                
            }, 1000);
        });
    }

    /* =======================================================
       5. LOGIC SOCIAL LOGIN (GOOGLE / APPLE)
       ======================================================= */
    const btnGoogle = document.getElementById("btn-google");
    const btnApple = document.getElementById("btn-apple");

    if (btnGoogle) {
        btnGoogle.addEventListener("click", (e) => {
            e.preventDefault();
            const originalHTML = btnGoogle.innerHTML;
            btnGoogle.innerHTML = "<strong>Đang kết nối...</strong>";
            btnGoogle.style.pointerEvents = "none";
            // TODO (BACKEND): Nhúng SDK Google
            setTimeout(() => {
                alert("Tính năng Đăng nhập bằng Google đang chờ Backend tích hợp.");
                btnGoogle.innerHTML = originalHTML;
                btnGoogle.style.pointerEvents = "auto";
            }, 800);
        });
    }

    if (btnApple) {
        btnApple.addEventListener("click", (e) => {
            e.preventDefault();
            const originalHTML = btnApple.innerHTML;
            btnApple.innerHTML = "<strong>Đang kết nối...</strong>";
            btnApple.style.pointerEvents = "none";
            // TODO (BACKEND): Nhúng SDK Apple
            setTimeout(() => {
                alert("Tính năng Đăng nhập bằng Apple ID đang chờ Backend tích hợp.");
                btnApple.innerHTML = originalHTML;
                btnApple.style.pointerEvents = "auto";
            }, 800);
        });
    }

    /* =======================================================
       6. TIỆN ÍCH: ẨN/HIỆN MẬT KHẨU
       ======================================================= */
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