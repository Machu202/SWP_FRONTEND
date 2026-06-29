// ==========================================
// manuscripts.js - QUẢN LÝ CÂY THƯ MỤC CHAPTERS & PAGES
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    
    if (!window.MangaApi) return;
    
    const seriesId = localStorage.getItem("currentSeriesId");
    const seriesTitle = localStorage.getItem("currentSeriesTitle");

    const headerTitle = document.getElementById("header-series-title");
    const chaptersList = document.getElementById("chapters-list");
    const btnOpenModal = document.getElementById("btn-open-modal");

    // =======================================================
    // 1. KIỂM TRA ĐÃ CHỌN TRUYỆN CHƯA
    // =======================================================
    if (!seriesId) {
        if (headerTitle) headerTitle.innerHTML = `<i class="fa-solid fa-book-open" style="margin-right:5px;"></i> Chưa chọn Tác phẩm`;
        
        if (chaptersList) {
            chaptersList.innerHTML = `
                <div style="text-align: center; padding: 60px;">
                    <i class="fa-solid fa-folder-tree" style="font-size: 40px; color: #94a3b8; margin-bottom: 15px;"></i>
                    <h3 style="color: #334155; margin: 0 0 10px 0;">Chưa có Tác phẩm nào được chọn</h3>
                    <p style="color: #64748b; margin: 0;">Vui lòng quay lại trang Series để chọn dự án.</p>
                    <button onclick="window.location.href='series.html'" style="margin-top: 20px; padding: 10px 20px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; color: #475569; font-weight: bold; cursor: pointer;">
                        Đến trang Series
                    </button>
                </div>`;
        }
        
        if (btnOpenModal) {
            btnOpenModal.style.opacity = "0.5";
            btnOpenModal.style.cursor = "not-allowed";
            btnOpenModal.onclick = (e) => {
                e.preventDefault();
                alert("Vui lòng chọn một Tác phẩm trước khi tạo Chapter mới!");
            };
        }
        return; 
    }

    if (headerTitle) headerTitle.innerHTML = `<i class="fa-solid fa-book-open" style="margin-right:5px;"></i> ${seriesTitle}`;

    // =======================================================
    // 2. GỌI API & VẼ CÂY THƯ MỤC
    // =======================================================
    async function fetchChapters() {
        if (!chaptersList) return;
        
        try {
            // BACKEND CẦN API: Trả về danh sách Chapters, trong mỗi Chapter có mảng con chứa các Pages
            const chapters = await window.MangaApi.apiFetch(`/chapters/series/${seriesId}`);

            if (!chapters || chapters.length === 0) {
                chaptersList.innerHTML = `
                    <div style="text-align: center; padding: 60px;">
                        <i class="fa-solid fa-file-circle-plus" style="font-size: 40px; color: #94a3b8; margin-bottom: 15px;"></i>
                        <h3 style="color: #334155; margin: 0 0 10px 0;">Chưa có Chương nào</h3>
                        <p style="color: #64748b; margin: 0;">Hãy bấm 'Thêm Chapter' để bắt đầu vẽ trang truyện.</p>
                    </div>`;
                return;
            }

            chaptersList.innerHTML = "";
            
            // Sắp xếp chapter từ thấp đến cao
            chapters.sort((a, b) => a.chapterNumber - b.chapterNumber).forEach(chapter => {
                const pages = chapter.pages || []; // Lấy danh sách trang của chapter (từ Backend)

                const chapterWrap = document.createElement("div");

                // --- THANH TIÊU ĐỀ CHAPTER ---
                const chapHeader = document.createElement("div");
                chapHeader.className = "tree-chapter-header";
                chapHeader.innerHTML = `
                    <div style="display: flex; align-items: center;">
                        <i class="fa-solid fa-folder" style="color: #6366f1; font-size: 18px; margin-right: 12px;"></i>
                        <span>Chapter ${chapter.chapterNumber} ${chapter.title ? `- ${chapter.title}` : ''}</span>
                    </div>
                    <div style="font-size: 12px; color: #64748b;">
                        <span style="background: #e2e8f0; padding: 2px 8px; border-radius: 12px; margin-right: 10px;">${pages.length} Trang</span>
                        <i class="fa-solid fa-chevron-down toggle-icon"></i>
                    </div>
                `;

                // --- CONTAINER CHỨA CÁC TRANG (PAGES) ---
                const pagesContainer = document.createElement("div");
                pagesContainer.style.display = "none"; // Ẩn mặc định

                if (pages.length === 0) {
                    pagesContainer.innerHTML = `<div style="padding: 15px 50px; font-size: 13px; color: #9ca3af; border-bottom: 1px solid #f1f5f9;">Chưa có bản thảo nào. Tải trang lên ở góc phải màn hình Canvas.</div>`;
                } else {
                    pages.forEach(page => {
                        const pageItem = document.createElement("div");
                        pageItem.className = "tree-page-item";
                        pageItem.innerHTML = `
                            <div style="font-size: 13px; color: #475569; display: flex; align-items: center;">
                                <i class="fa-regular fa-file-image" style="color: #10b981; margin-right: 10px; font-size: 16px;"></i>
                                Trang ${page.pageNumber || 'Không tên'}
                            </div>
                            <div style="font-size: 11px; background: #e0e7ff; color: #4f46e5; padding: 4px 10px; border-radius: 4px; font-weight: 600;">
                                Mở Canvas <i class="fa-solid fa-arrow-right" style="margin-left: 5px;"></i>
                            </div>
                        `;

                        // CLICK VÀO TRANG -> MỞ EDITOR (Vá lỗ hổng 2)
                        pageItem.addEventListener("click", () => {
                            localStorage.setItem("currentChapterId", chapter.id);
                            localStorage.setItem("currentPageId", page.id);
                            window.location.href = "page-editor.html";
                        });

                        pagesContainer.appendChild(pageItem);
                    });
                }

                // Hiệu ứng Đóng/Mở thư mục
                chapHeader.addEventListener("click", () => {
                    const isHidden = pagesContainer.style.display === "none";
                    pagesContainer.style.display = isHidden ? "block" : "none";
                    
                    const icon = chapHeader.querySelector('.toggle-icon');
                    if (isHidden) {
                        icon.classList.replace("fa-chevron-down", "fa-chevron-up");
                        chapHeader.querySelector('.fa-folder').classList.replace('fa-folder', 'fa-folder-open');
                    } else {
                        icon.classList.replace("fa-chevron-up", "fa-chevron-down");
                        chapHeader.querySelector('.fa-folder-open').classList.replace('fa-folder-open', 'fa-folder');
                    }
                });

                chapterWrap.appendChild(chapHeader);
                chapterWrap.appendChild(pagesContainer);
                chaptersList.appendChild(chapterWrap);
            });

        } catch (error) {
            chaptersList.innerHTML = `
                <div style="padding: 20px; color: #991b1b; text-align: center; background: #fee2e2;">
                    Lỗi tải danh sách: ${error.message}
                </div>`;
        }
    }

    fetchChapters();

    // =======================================================
    // 3. LOGIC MODAL TẠO CHAPTER MỚI
    // =======================================================
    const modal = document.getElementById("chapter-modal");
    const btnClose = document.getElementById("btn-close-modal");
    const btnSubmit = document.getElementById("btn-submit-chapter");

    if (btnOpenModal && seriesId) {
        btnOpenModal.addEventListener("click", () => {
            modal.style.display = "flex";
            document.getElementById("chapter-number").focus();
        });
    }
    
    if (btnClose) btnClose.addEventListener("click", () => {
        modal.style.display = "none";
        document.getElementById("chapter-number").value = "";
        document.getElementById("chapter-title").value = "";
    });

    if (btnSubmit) {
        btnSubmit.addEventListener("click", async () => {
            const numInput = document.getElementById("chapter-number").value;
            const titleInput = document.getElementById("chapter-title").value.trim();

            if (!numInput) { alert("Vui lòng nhập số thứ tự Chapter!"); return; }

            const originalText = btnSubmit.innerText;
            btnSubmit.innerText = "Đang tạo...";
            btnSubmit.disabled = true;

            try {
                await window.MangaApi.apiFetch("/chapters", {
                    method: "POST",
                    body: {
                        seriesId: seriesId,
                        chapterNumber: parseInt(numInput),
                        title: titleInput
                    }
                });

                alert("Tạo Chapter thành công!");
                modal.style.display = "none";
                document.getElementById("chapter-number").value = "";
                document.getElementById("chapter-title").value = "";
                
                fetchChapters();
            } catch (error) {
                alert("Lỗi tạo Chapter: " + error.message);
            } finally {
                btnSubmit.innerText = originalText;
                btnSubmit.disabled = false;
            }
        });
    }
});