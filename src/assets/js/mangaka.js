// ==========================================
// mangaka.js - LOGIC NGHIỆP VỤ RIÊNG CỦA MANGAKA
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    
    if (!window.MangaApi) {
        console.error("Lỗi: Không tìm thấy api.js. Vui lòng kiểm tra lại thứ tự nạp file HTML.");
        return;
    }

    /* =======================================================
       1. TÍNH NĂNG CREATE SERIES (Trang create-series.html)
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
            const genreInput = document.getElementById("series-genre"); // Bắt ID của Genre
            const targetInput = document.getElementById("series-target");
            const statusInput = document.getElementById("series-status");

            const title = titleInput?.value.trim();
            const desc = descInput?.value.trim();
            const genre = genreInput?.value;
            const targetAudience = targetInput?.value;
            const status = statusInput?.value;
            
            if (!title) { alert("⛔ Vui lòng nhập Tên tác phẩm!"); titleInput.focus(); return; }
            if (!desc) { alert("⛔ Vui lòng nhập Tóm tắt nội dung!"); descInput.focus(); return; }

            // Backend /manga-series expects JSON: title, genre, summary.
            const payload = {
                title,
                genre: genre || "",
                summary: [desc, targetAudience ? `Target: ${targetAudience}` : "", status ? `Status: ${status}` : ""].filter(Boolean).join("\n")
            }; 

            const originalText = btnCreateSeries.innerHTML;
            btnCreateSeries.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang tải lên Server...`;
            btnCreateSeries.style.pointerEvents = "none";
            btnCreateSeries.style.opacity = "0.7";

            try {
                await window.MangaApi.apiFetch("/manga-series", {
                    method: "POST",
                    body: payload
                });
                
                alert("✅ Tạo Series thành công! Nhấn OK để về danh sách.");
                window.location.href = "series.html"; 
            } catch (error) {
                alert("❌ Lỗi Backend: " + error.message);
                btnCreateSeries.innerHTML = originalText;
                btnCreateSeries.style.pointerEvents = "auto";
                btnCreateSeries.style.opacity = "1";
            }
        });
    }

    /* =======================================================
       2. TÍNH NĂNG LIST SERIES (Trang series.html)
       ======================================================= */
    const seriesGrid = document.getElementById("series-grid");
    if (seriesGrid) {
        async function fetchAndRenderSeries() {
            try {
                const seriesList = await window.MangaApi.apiFetch("/manga-series/my-series");

                if (!seriesList || seriesList.length === 0) {
                    seriesGrid.innerHTML = `
                        <div style="text-align:center; grid-column: 1 / -1; padding: 60px; color: #64748b;">
                            <i class="fa-solid fa-book-open" style="font-size: 48px; margin-bottom: 20px;"></i>
                            <h3 style="color: #334155; margin: 0 0 10px 0;">Chưa có tác phẩm nào</h3>
                            <p style="margin: 0;">Bạn chưa tạo dự án nào. Bấm 'New Series' để bắt đầu.</p>
                        </div>`;
                    return;
                }

                seriesGrid.innerHTML = ""; 
                
                seriesList.forEach(series => {
                    const cover = series.coverImageUrl || "cover.png"; 
                    const card = document.createElement("div");
                    card.style = "background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.05); cursor: pointer; transition: 0.2s;";
                    card.onmouseover = () => { card.style.transform = "translateY(-4px)"; card.style.boxShadow = "0 10px 15px rgba(0,0,0,0.1)"; };
                    card.onmouseout = () => { card.style.transform = "translateY(0)"; card.style.boxShadow = "0 2px 4px rgba(0,0,0,0.05)"; };
                    
                    // Hiện Genre thẳng lên thẻ truyện nếu Backend có trả về
                    const genreBadge = series.genre ? `<span style="margin-left: 5px; background: #e0e7ff; color: #4f46e5; padding: 2px 6px; border-radius: 4px; font-size: 10px;">${series.genre}</span>` : "";

                    card.innerHTML = `
                        <div style="height: 200px; background: #e2e8f0; position: relative;">
                            <img src="${cover}" style="width: 100%; height: 100%; object-fit: cover;">
                            <div style="position: absolute; top: 12px; right: 12px; background: rgba(15, 23, 42, 0.75); color: white; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; backdrop-filter: blur(4px);">
                                <i class="fa-solid fa-circle" style="color: #4ade80; font-size: 8px; margin-right: 4px;"></i> ${series.status || "Ongoing"}
                            </div>
                        </div>
                        <div style="padding: 20px;">
                            <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #1e293b; font-weight: 700;">${series.title} ${genreBadge}</h3>
                            <p style="margin: 0; font-size: 13px; color: #64748b; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.5;">
                                ${series.description || "Chưa có mô tả chi tiết..."}
                            </p>
                        </div>
                    `;
                    
                    card.addEventListener("click", () => {
                        localStorage.setItem("currentSeriesId", series.id);
                        localStorage.setItem("currentSeriesTitle", series.title);
                        window.location.href = "manuscripts.html"; 
                    });
                    
                    seriesGrid.appendChild(card);
                });
            } catch (error) {
                seriesGrid.innerHTML = `
                    <div style="grid-column: 1 / -1; padding: 20px; background: #fee2e2; color: #991b1b; border-radius: 8px; border: 1px solid #fecaca;">
                        <i class="fa-solid fa-triangle-exclamation" style="margin-right: 8px;"></i> <strong>Lỗi tải dữ liệu:</strong> ${error.message}
                    </div>`;
            }
        }
        fetchAndRenderSeries();
    }
});