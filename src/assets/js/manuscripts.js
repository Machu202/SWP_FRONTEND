// ==========================================
// manuscripts.js - LOGIC QUẢN LÝ CHAPTERS
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    
    if (!window.MangaApi) return;
    
    const seriesId = localStorage.getItem("currentSeriesId");
    const seriesTitle = localStorage.getItem("currentSeriesTitle");

    const headerTitle = document.getElementById("header-series-title");
    const chaptersList = document.getElementById("chapters-list");
    const btnOpenModal = document.getElementById("btn-open-modal");

    // =======================================================
    // 1. XỬ LÝ TRẠNG THÁI CHƯA CHỌN TRUYỆN (Sửa lỗi đá văng)
    // =======================================================
    if (!seriesId) {
        // KHÔNG redirect nữa. Ở lại trang và báo trạng thái trống.
        if (headerTitle) headerTitle.innerHTML = `<i class="fa-solid fa-book-open" style="margin-right:5px;"></i> Chưa chọn Tác phẩm`;
        
        if (chaptersList) {
            chaptersList.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 60px; background: white; border-radius: 10px; border: 2px dashed #cbd5e1;">
                    <i class="fa-solid fa-folder-tree" style="font-size: 40px; color: #94a3b8; margin-bottom: 15px;"></i>
                    <h3 style="color: #334155; margin: 0 0 10px 0;">Chưa có Tác phẩm nào được chọn</h3>
                    <p style="color: #64748b; margin: 0;">Vui lòng sử dụng <strong>Cây thư mục (Explorer Tree)</strong> hoặc quay lại trang Series để chọn dự án.</p>
                    <button onclick="window.location.href='series.html'" style="margin-top: 20px; padding: 10px 20px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; color: #475569; font-weight: bold; cursor: pointer;">
                        Đến trang Series
                    </button>
                </div>`;
        }
        
        // Vô hiệu hóa nút tạo Chapter vì chưa biết tạo cho truyện nào
        if (btnOpenModal) {
            btnOpenModal.style.opacity = "0.5";
            btnOpenModal.style.cursor = "not-allowed";
            btnOpenModal.onclick = (e) => {
                e.preventDefault();
                alert("Vui lòng chọn một Tác phẩm trước khi tạo Chapter mới!");
            };
        }
        return; // Dừng chạy các hàm bên dưới
    }

    // =======================================================
    // 2. NẾU ĐÃ CÓ ID TRUYỆN -> TẢI CHAPTER BÌNH THƯỜNG
    // =======================================================
    if (headerTitle) {
        headerTitle.innerHTML = `<i class="fa-solid fa-book-open" style="margin-right:5px;"></i> ${seriesTitle}`;
    }

    async function fetchChapters() {
        if (!chaptersList) return;
        
        try {
            const chapters = await window.MangaApi.apiFetch(`/chapters/series/${seriesId}`);

            if (!chapters || chapters.length === 0) {
                chaptersList.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 60px; background: white; border-radius: 10px; border: 2px dashed #cbd5e1;">
                        <i class="fa-solid fa-file-circle-plus" style="font-size: 40px; color: #94a3b8; margin-bottom: 15px;"></i>
                        <h3 style="color: #334155; margin: 0 0 10px 0;">Chưa có Chương nào</h3>
                        <p style="color: #64748b; margin: 0;">Hãy bấm 'Thêm Chapter' để bắt đầu vẽ trang truyện.</p>
                    </div>`;
                return;
            }

            chaptersList.innerHTML = "";
            
            chapters.sort((a, b) => a.chapterNumber - b.chapterNumber).forEach(chapter => {
                const card = document.createElement("div");
                card.style = "background: white; border-radius: 10px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: flex; flex-direction: column; justify-content: space-between; border-left: 4px solid #4f46e5; cursor: pointer; transition: 0.2s;";
                card.onmouseover = () => card.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)";
                card.onmouseout = () => card.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";

                const titleText = chapter.title ? `: ${chapter.title}` : "";
                
                card.innerHTML = `
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                            <h3 style="margin: 0; font-size: 18px; color: #1e293b;">Chapter ${chapter.chapterNumber}${titleText}</h3>
                            <span style="background: #f1f5f9; color: #64748b; font-size: 12px; padding: 4px 8px; border-radius: 20px; font-weight: 600;">
                                ${chapter.status || 'Draft'}
                            </span>
                        </div>
                        <div style="display: flex; gap: 15px; color: #64748b; font-size: 13px;">
                            <span><i class="fa-regular fa-file-image"></i> ${chapter.pageCount || 0} Pages</span>
                            <span><i class="fa-solid fa-list-check"></i> ${chapter.taskCount || 0} Tasks</span>
                        </div>
                    </div>
                `;

                card.addEventListener("click", () => {
                    localStorage.setItem("currentChapterId", chapter.id);
                    localStorage.setItem("currentChapterNumber", chapter.chapterNumber);
                    alert(`Đã chọn Chapter ${chapter.chapterNumber}. Chuyển sang Upload Trang (FE-32)...`);
                });

                chaptersList.appendChild(card);
            });

        } catch (error) {
            chaptersList.innerHTML = `
                <div style="grid-column: 1 / -1; padding: 20px; background: #fee2e2; color: #991b1b; border-radius: 8px;">
                    Lỗi tải danh sách: ${error.message}
                </div>`;
        }
    }

    fetchChapters();

    // =======================================================
    // 3. LOGIC MODAL TẠO CHAPTER
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