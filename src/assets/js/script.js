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

    function setLoading(button, isLoading, labelWhenLoading = "Đang xử lý...") {
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
        
        const rawUsername = usernameInput ? usernameInput.value.trim() : "";
        const password = passwordInput ? passwordInput.value : "";

        if (!window.MangaApi) {
            showStatus("Lỗi cấu hình: Không tìm thấy file api.js", true);
            return;
        }
        if (!rawUsername || !password) {
            showStatus("Vui lòng nhập Email/Tên đăng nhập và Mật khẩu.", true);
            return;
        }

        const loginUsername = isEmail(rawUsername) ? rawUsername.split("@")[0] : rawUsername;

        setLoading(btnLogin, true, "Đang xác thực...");
        try {
            const response = await window.MangaApi.loginWithPassword(loginUsername, password);
            
            if (response && response.token) {
                window.MangaApi.setAccessToken(response.token);
                if (response.role) localStorage.setItem("userRole", response.role);
                
                showStatus("Đăng nhập thành công! Đang chuyển hướng...");
                window.MangaApi.goToDashboard(response.role);
                return;
            }

            pendingLoginUsername = loginUsername;
            pendingLoginPassword = password;
            
            pendingOtpEmail = isEmail(rawUsername) ? rawUsername : "";
            if (pendingOtpEmail) {
                localStorage.setItem("pendingOtpEmail", pendingOtpEmail);
                const otpEmailInput = getOtpEmailInput();
                if (otpEmailInput) otpEmailInput.value = pendingOtpEmail;
            }

            showStatus(response.message || "Hệ thống yêu cầu xác thực bảo mật OTP. Vui lòng kiểm tra email.");
            showOtpStep({ askEmail: !pendingOtpEmail });
            startCountdown();
        } catch (error) {
            console.error("Lỗi đăng nhập:", error);
            showStatus(error.message || "Sai tài khoản hoặc mật khẩu (Lỗi 401).", true);
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
            showStatus("Vui lòng nhập email hợp lệ để xác thực OTP.", true);
            showOtpStep({ askEmail: true });
            return;
        }
        if (!otpCode) {
            showStatus("Vui lòng nhập mã OTP.", true);
            return;
        }

        pendingOtpEmail = email;
        localStorage.setItem("pendingOtpEmail", email);
        setLoading(verifyBtn, true, "Đang xác thực...");
        try {
            const data = await window.MangaApi.verifyOtp(email, otpCode);
            localStorage.removeItem("pendingOtpEmail");
            showStatus("Đăng nhập thành công! Đang chuyển hướng...");
            window.MangaApi.goToDashboard(data.role);
        } catch (error) {
            console.error("Lỗi OTP:", error);
            showStatus(error.message || "Xác thực OTP thất bại.", true);
        } finally {
            setLoading(verifyBtn, false);
        }
    }

    async function handleRegister(event) {
        event.preventDefault();
        const btn = event.currentTarget;
        const emailInput = $("#register-email") || $("#form-register-section input[type='text']") || $("#form-register-section input[type='email']");
        const passwordInput = $("#register-password") || $("#form-register-section input[type='password']");
        const roleInput = $("#register-role") || $("#form-register-section select.role-select");

        const emailOrName = emailInput ? emailInput.value.trim() : "";
        const password = passwordInput ? passwordInput.value : "";
        const role = roleInput ? roleInput.value : "Mangaka";

        if (!emailOrName || !password) {
            showStatus("Vui lòng nhập đầy đủ Email và Mật khẩu.", true);
            return;
        }

        if (!isEmail(emailOrName)) {
            showStatus("Vui lòng nhập một địa chỉ Email hợp lệ (VD: mangaka@gmail.com) để đăng ký.", true);
            return;
        }

        const email = emailOrName;
        const username = email.split("@")[0];

        setLoading(btn, true, "Đang đăng ký...");
        try {
            const response = await window.MangaApi.registerUser({ username, email, password, role });
            showStatus(response.message || "Đăng ký thành công! Bạn có thể đăng nhập ngay bây giờ.");
            showPasswordTab();
            
            const usernameInputLogin = getLoginUsernameInput();
            if (usernameInputLogin) usernameInputLogin.value = email;
        } catch (error) {
            console.error("Lỗi đăng ký:", error);
            showStatus(error.message || "Lỗi hệ thống. Vui lòng kiểm tra lại Backend đã khởi động chưa.", true);
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
            const msgBox = $("#api-status-message");
            if(msgBox) msgBox.remove();
        });
    }

    const btnBackToLogin = $("#back-to-login");
    if (btnBackToLogin) {
        btnBackToLogin.addEventListener("click", (e) => {
            e.preventDefault();
            showPasswordTab();
            const msgBox = $("#api-status-message");
            if(msgBox) msgBox.remove();
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
                showStatus("Vui lòng nhập Email hợp lệ để nhận mã OTP.", true);
                return;
            }
            localStorage.setItem("pendingOtpEmail", pendingOtpEmail);
            showOtpStep({ askEmail: false });
            startCountdown();
        });
    }

    const btnVerifyOtp = $("#btn-verify-otp");
    if (btnVerifyOtp) {
        btnVerifyOtp.addEventListener("click", handleVerifyOtp);
    }

    const btnSendAgain = $("#btn-send-again");
    if (btnSendAgain) {
        btnSendAgain.addEventListener("click", async (e) => {
            e.preventDefault();
            if (!pendingLoginUsername || !pendingLoginPassword) {
                startCountdown();
                showStatus("Vui lòng đăng nhập lại bằng mật khẩu để hệ thống gửi OTP mới.", true);
                return;
            }
            setLoading(btnSendAgain, true, "Đang gửi...");
            try {
                const response = await window.MangaApi.loginWithPassword(pendingLoginUsername, pendingLoginPassword);
                
                if (response && response.token) {
                    window.MangaApi.setAccessToken(response.token);
                    if (response.role) localStorage.setItem("userRole", response.role);
                    window.MangaApi.goToDashboard(response.role);
                    return;
                }

                startCountdown();
                showStatus(response.message || "OTP mới đã được gửi!");
            } catch (error) {
                showStatus(error.message || "Không thể gửi lại OTP. Vui lòng thử lại sau.", true);
            } finally {
                setLoading(btnSendAgain, false);
            }
        });
    }

    const btnRegister = $("#btn-register") || $(".btn-registrate");
    if (btnRegister) btnRegister.addEventListener("click", handleRegister);

    /* GOOGLE LOGIN */
    window.handleGoogleCredentialResponse = async function (response) {
        if (!response || !response.credential) return;
        try {
            const data = await window.MangaApi.loginWithGoogle(response.credential);
            window.MangaApi.goToDashboard(data.role);
        } catch (error) {
            showStatus(error.message || "Đăng nhập Google thất bại.", true);
        }
    };

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

    /* =======================================================
       LOGIC UPLOAD ẢNH VÀ TẠO SERIES (KÈM BẮT LỖI VALIDATION)
       ======================================================= */
    function setupImageUpload(zoneId, inputId, previewId, placeholderId) {
        const zone = document.getElementById(zoneId);
        const input = document.getElementById(inputId);
        const preview = document.getElementById(previewId);
        const placeholder = document.getElementById(placeholderId);

        if (zone && input) {
            // Khi click vào khung -> Tự động click vào thẻ input file ẩn
            zone.addEventListener("click", () => input.click());
            
            // Khi file được chọn từ Windows Explorer
            input.addEventListener("change", function () {
                const file = this.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function (e) {
                        preview.src = e.target.result;
                        preview.style.display = "block";
                        placeholder.style.display = "none";
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
    }

    setupImageUpload("cover-upload-zone", "cover-file-input", "cover-preview", "cover-placeholder");
    setupImageUpload("bg-upload-zone", "bg-file-input", "bg-preview", "bg-placeholder");

    const btnCreateSeries = document.getElementById("btn-create-series");
    if (btnCreateSeries) {
        btnCreateSeries.addEventListener("click", async (e) => {
            e.preventDefault();
            
            const titleInput = document.getElementById("series-title");
            const descInput = document.getElementById("series-desc");
            const title = titleInput?.value.trim();
            const desc = descInput?.value.trim();
            const coverFile = document.getElementById("cover-file-input")?.files[0];
            const bgFile = document.getElementById("bg-file-input")?.files[0];

            // 1. KIỂM TRA ĐIỀU KIỆN (VALIDATION)
            if (!title) {
                alert("⛔ BẮT BUỘC: Vui lòng nhập Tên tác phẩm (Series Title)!");
                titleInput.focus();
                return;
            }
            if (!desc) {
                alert("⛔ BẮT BUỘC: Vui lòng nhập Mô tả (Synopsis)!");
                descInput.focus();
                return;
            }
            if (!coverFile) {
                alert("⛔ BẮT BUỘC: Vui lòng click vào khung ảnh và tải lên Ảnh bìa (Series Cover)!");
                return;
            }

            // 2. GÓI DỮ LIỆU ĐỂ GỬI BE
            const formData = new FormData();
            formData.append("title", title);
            formData.append("description", desc);
            formData.append("coverImage", coverFile);
            if (bgFile) formData.append("backgroundImage", bgFile); 

            const originalText = btnCreateSeries.innerText;
            btnCreateSeries.innerText = "Đang tải lên Server...";
            btnCreateSeries.style.pointerEvents = "none";

            try {
                await window.MangaApi.apiFetch(window.MangaApi.API_ENDPOINTS.mangaSeries, {
                    method: "POST",
                    body: formData
                });
                
                alert("✅ Tạo Series thành công! Hệ thống sẽ chuyển về danh sách Series.");
                window.location.href = "series.html"; 
            } catch (error) {
                console.error("Lỗi khi tạo series:", error);
                alert("❌ Lỗi Backend: " + error.message);
                btnCreateSeries.innerText = originalText;
                btnCreateSeries.style.pointerEvents = "auto";
            }
        });
    }

    /* =======================================================
       LOGIC HIỂN THỊ DANH SÁCH SERIES (Trang series.html)
       ======================================================= */
    const seriesListContainer = document.getElementById("series-list-container");
    if (seriesListContainer) {
        async function loadMySeries() {
            try {
                const seriesList = await window.MangaApi.apiFetch(window.MangaApi.API_ENDPOINTS.mySeries);
                
                if (seriesList && seriesList.length > 0) {
                    seriesListContainer.innerHTML = ""; 
                    seriesListContainer.style.display = "grid";
                    seriesListContainer.style.gridTemplateColumns = "repeat(auto-fill, minmax(300px, 1fr))";
                    seriesListContainer.style.gap = "20px";

                    seriesList.forEach(series => {
                        const coverUrl = series.coverImageUrl || "cover.png";
                        seriesListContainer.innerHTML += `
                            <div class="card-box" style="padding: 0; overflow: hidden; display: flex; flex-direction: column; cursor: pointer;">
                                <div style="height: 200px; background: #e5e7eb;">
                                    <img src="${coverUrl}" style="width: 100%; height: 100%; object-fit: cover;">
                                </div>
                                <div style="padding: 15px;">
                                    <h2 style="font-size: 18px; margin-bottom: 5px;">${series.title}</h2>
                                    <p style="font-size: 13px; color: #6b7280; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                                        ${series.description || "Chưa có mô tả..."}
                                    </p>
                                </div>
                            </div>
                        `;
                    });
                }
            } catch (error) {
                console.error("Không thể tải danh sách series:", error);
            }
        }
        loadMySeries();
    }
});