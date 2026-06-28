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

    /* =======================================================
       1. LOGIN / REGISTER UI (GIỮ NGUYÊN CODE CŨ)
       ======================================================= */
    const loginTabs = $("#login-tabs");
    const formPassword = $("#form-password-section");
    const formRegister = $("#form-register-section");
    const btnGoToRegister = $("#go-to-register");
    const btnBackToLogin = $("#back-to-login");

    if (btnGoToRegister) {
        btnGoToRegister.addEventListener("click", (e) => {
            e.preventDefault();
            if (loginTabs) loginTabs.style.display = "none";
            if (formPassword) formPassword.style.display = "none";
            if (formRegister) formRegister.style.display = "block";
            const msgBox = $("#api-status-message");
            if(msgBox) msgBox.remove();
        });
    }

    if (btnBackToLogin) {
        btnBackToLogin.addEventListener("click", (e) => {
            e.preventDefault();
            if (loginTabs) loginTabs.style.display = "flex";
            if (formPassword) formPassword.style.display = "block";
            if (formRegister) formRegister.style.display = "none";
            const msgBox = $("#api-status-message");
            if(msgBox) msgBox.remove();
        });
    }

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

    /* =======================================================
       2. GỌI API ĐĂNG NHẬP / ĐĂNG KÝ
       ======================================================= */
    const btnLogin = $("#btn-login");
    if (btnLogin) {
        btnLogin.addEventListener("click", async (e) => {
            e.preventDefault();
            const inputUsername = $("#login-username")?.value.trim();
            const inputPassword = $("#login-password")?.value;

            if (!window.MangaApi) {
                showStatus("Lỗi cấu hình: Không tìm thấy file api.js", true);
                return;
            }
            if (!inputUsername || !inputPassword) {
                showStatus("Vui lòng nhập Email/Tên đăng nhập và Mật khẩu.", true);
                return;
            }

            // Xử lý cắt đuôi email nếu có
            const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inputUsername);
            const loginUsername = isEmail ? inputUsername.split("@")[0] : inputUsername;

            setLoading(btnLogin, true, "Đang xác thực...");
            try {
                const response = await window.MangaApi.apiFetch(window.MangaApi.API_ENDPOINTS.authLogin, {
                    method: "POST",
                    body: { username: loginUsername, password: inputPassword }
                });
                
                if (response && response.token) {
                    window.MangaApi.setAccessToken(response.token, response.role);
                    showStatus("Đăng nhập thành công! Đang chuyển hướng...");
                    window.MangaApi.goToDashboard(response.role);
                } else {
                    showStatus("Lỗi: Không nhận được Token từ Server.", true);
                }
            } catch (error) {
                showStatus("Sai tài khoản hoặc mật khẩu.", true);
            } finally {
                setLoading(btnLogin, false);
            }
        });
    }

    const btnRegister = $("#btn-register") || $(".btn-registrate");
    if (btnRegister) {
        btnRegister.addEventListener("click", async (e) => {
            e.preventDefault();
            const email = $("#reg-email")?.value.trim() || $("#register-email")?.value.trim();
            const password = $("#reg-password")?.value || $("#register-password")?.value;
            const role = $("#reg-role")?.value || $("#register-role")?.value || "Mangaka";

            if (!email || !password) {
                showStatus("Vui lòng nhập đầy đủ Email và Mật khẩu.", true);
                return;
            }

            const username = email.split("@")[0];

            setLoading(btnRegister, true, "Đang đăng ký...");
            try {
                const response = await window.MangaApi.apiFetch(window.MangaApi.API_ENDPOINTS.authRegister, {
                    method: "POST",
                    body: { username, email, password, role }
                });
                showStatus(response.message || "Đăng ký thành công! Hãy quay lại đăng nhập.");
                
                // Tự động chuyển về form đăng nhập
                if (btnBackToLogin) btnBackToLogin.click();
            } catch (error) {
                showStatus(error.message || "Đăng ký thất bại.", true);
            } finally {
                setLoading(btnRegister, false);
            }
        });
    }

    /* =======================================================
       3. CÁC TƯƠNG TÁC UI CŨ (GIỮ NGUYÊN)
       ======================================================= */
    $$('a[href="index.html"]').forEach(link => {
        const text = (link.textContent || "").toLowerCase();
        if (text.includes("logout") || link.innerHTML.includes("right-from-bracket")) {
            link.addEventListener("click", (e) => {
                e.preventDefault();
                if (window.MangaApi) window.MangaApi.logout();
            });
        }
    });

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

    /* =======================================================
       4. LOGIC UPLOAD ẢNH VÀ TẠO SERIES 
       ======================================================= */
    function setupImageUpload(zoneId, inputId, previewId, placeholderId) {
        const zone = document.getElementById(zoneId);
        const input = document.getElementById(inputId);
        const preview = document.getElementById(previewId);
        const placeholder = document.getElementById(placeholderId);

        if (zone && input) {
            zone.addEventListener("click", () => input.click());
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

            if (!title) {
                alert("Vui lòng nhập Tên tác phẩm!");
                return;
            }
            if (!coverFile) {
                alert("Vui lòng tải lên Ảnh bìa!");
                return;
            }

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
                
                alert("Tạo Series thành công! Chuyển về danh sách...");
                window.location.href = "series.html"; 
            } catch (error) {
                alert("Lỗi tạo Series: " + error.message);
                btnCreateSeries.innerText = originalText;
                btnCreateSeries.style.pointerEvents = "auto";
            }
        });
    }

    /* =======================================================
       5. LOGIC HIỂN THỊ DANH SÁCH SERIES
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