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

    function fileToDataUrl(file) {
        return new Promise((resolve) => {
            if (!file) return resolve("");
            const reader = new FileReader();
            reader.onload = (event) => resolve(String(event.target?.result || ""));
            reader.onerror = () => resolve("");
            reader.readAsDataURL(file);
        });
    }

    function getPendingSeriesMetaStore() {
        try {
            return JSON.parse(localStorage.getItem("mangakaPendingSeriesMetaByTitle") || "{}");
        } catch (_) {
            return {};
        }
    }

    function savePendingSeriesMeta(title, meta = {}) {
        const key = String(title || "").trim().toLowerCase();
        if (!key) return;
        const store = getPendingSeriesMetaStore();
        store[key] = { ...(store[key] || {}), ...meta };
        localStorage.setItem("mangakaPendingSeriesMetaByTitle", JSON.stringify(store));
    }

    function getPendingSeriesMeta(title) {
        const key = String(title || "").trim().toLowerCase();
        return getPendingSeriesMetaStore()[key] || {};
    }

    function seriesKey(series) {
        return String(series?.id ?? series?.seriesId ?? series?.title ?? series?.name ?? "").trim().toLowerCase();
    }

    function mergeSeriesLists(...lists) {
        const merged = new Map();

        lists.flat().filter(Boolean).forEach(series => {
            const key = seriesKey(series);
            if (!key) return;

            // Prefer later values only when they have real fields,
            // but do not drop older series from another endpoint.
            merged.set(key, {
                ...(merged.get(key) || {}),
                ...series
            });
        });

        return Array.from(merged.values());
    }

    function readLocalJson(key) {
        try { return JSON.parse(localStorage.getItem(key) || "{}"); }
        catch (_) { return {}; }
    }

    function normalizeIdentity(value = "") {
        return String(value || "").trim().toLowerCase();
    }

    function currentMangakaIdentity() {
        const cached = readLocalJson("profileCache");
        const user = readLocalJson("user");
        const authUser = readLocalJson("authUser");
        const currentUser = readLocalJson("currentUser");

        return {
            id: normalizeIdentity(
                localStorage.getItem("userId") ||
                localStorage.getItem("id") ||
                localStorage.getItem("currentUserId") ||
                localStorage.getItem("authUserId") ||
                localStorage.getItem("loggedInUserId") ||
                localStorage.getItem("user_id") ||
                cached.id || cached.userId || cached.user_id ||
                user.id || user.userId || user.user_id ||
                authUser.id || authUser.userId || authUser.user_id ||
                currentUser.id || currentUser.userId || currentUser.user_id
            ),
            username: normalizeIdentity(
                localStorage.getItem("username") ||
                localStorage.getItem("userName") ||
                cached.username || cached.userName ||
                user.username || user.userName ||
                authUser.username || authUser.userName ||
                currentUser.username || currentUser.userName
            ),
            email: normalizeIdentity(
                localStorage.getItem("email") ||
                localStorage.getItem("userEmail") ||
                cached.email ||
                user.email ||
                authUser.email ||
                currentUser.email
            ),
            fullName: normalizeIdentity(
                localStorage.getItem("fullName") ||
                localStorage.getItem("name") ||
                cached.fullName || cached.name ||
                user.fullName || user.name ||
                authUser.fullName || authUser.name ||
                currentUser.fullName || currentUser.name
            )
        };
    }

    function seriesOwnerTokens(series = {}) {
        const mangaka = series.mangaka || series.author || series.creator || series.owner || series.user || series.createdBy || {};
        return {
            id: normalizeIdentity(
                series.manga_id ||
                series.mangaId ||
                series.mangaka_id ||
                series.mangakaId ||
                series.authorId ||
                series.creatorId ||
                series.ownerId ||
                series.userId ||
                series.createdById ||
                mangaka.id ||
                mangaka.userId ||
                mangaka.user_id ||
                mangaka.accountId
            ),
            username: normalizeIdentity(
                series.mangakaUsername || series.mangaUsername || series.authorUsername || series.creatorUsername || series.ownerUsername || series.username ||
                mangaka.username || mangaka.userName || mangaka.login
            ),
            email: normalizeIdentity(
                series.mangakaEmail || series.mangaEmail || series.authorEmail || series.creatorEmail || series.ownerEmail || series.email ||
                mangaka.email || mangaka.mail
            ),
            fullName: normalizeIdentity(
                series.mangakaName || series.mangaName || series.authorName || series.creatorName || series.ownerName || series.fullName ||
                mangaka.fullName || mangaka.name || mangaka.displayName
            )
        };
    }

    function ownerFieldsExist(owner = {}) {
        return Boolean(owner.id || owner.username || owner.email || owner.fullName);
    }

    function isSeriesOwnedByCurrentMangaka(series = {}) {
        const identity = currentMangakaIdentity();
        const owner = seriesOwnerTokens(series);

        if (identity.id && owner.id && identity.id === owner.id) return true;
        if (identity.username && owner.username && identity.username === owner.username) return true;
        if (identity.email && owner.email && identity.email === owner.email) return true;
        if (identity.fullName && owner.fullName && identity.fullName === owner.fullName) return true;

        // Only trust /my-series if backend does not expose owner fields.
        if (series.__fromMySeries === true && !ownerFieldsExist(owner)) return true;
        return false;
    }

    async function deleteMangakaSeries(series, refresh) {
        const seriesId = series.id ?? series.seriesId;
        const title = series.title || series.name || `Series #${seriesId}`;
        if (!seriesId) return alert("Missing series id.");
        if (!isSeriesOwnedByCurrentMangaka(series)) {
            alert("You can only delete series created by the logged-in Mangaka.");
            return;
        }
        if (!confirm(`Delete series "${title}"? This will only work if the backend allows deleting this series and its related data.`)) return;

        try {
            await window.MangaApi.deleteSeries(seriesId);
            if (String(localStorage.getItem("activeSeriesId") || "") === String(seriesId)) {
                ["activeSeriesId", "currentSeriesId", "activeSeriesTitle", "currentSeriesTitle"].forEach(key => localStorage.removeItem(key));
            }
            await refresh();
        } catch (error) {
            alert("Delete series failed: " + (error.message || error));
        }
    }

    const btnCreateSeries = document.getElementById("btn-create-series");
    if (btnCreateSeries) {
        btnCreateSeries.addEventListener("click", async (e) => {
            e.preventDefault();
            
            const titleInput = document.getElementById("series-title");
            const descInput = document.getElementById("series-desc");
            const genreInput = document.getElementById("series-genre"); // Bắt ID của Genre
            const targetInput = document.getElementById("series-target");
            const statusInput = document.getElementById("series-status");
            const scriptInput = document.getElementById("series-script");

            const title = titleInput?.value.trim();
            const desc = descInput?.value.trim();
            const genre = genreInput?.value;
            const targetAudience = targetInput?.value;
            const status = statusInput?.value;
            const seriesScript = scriptInput?.value.trim() || "";
            const coverFile = document.getElementById("cover-file-input")?.files?.[0] || null;
            const coverLocalDataUrl = await fileToDataUrl(coverFile);
            
            if (!title) { alert("⛔ Vui lòng nhập Tên tác phẩm!"); titleInput.focus(); return; }
            if (!desc) { alert("⛔ Vui lòng nhập Tóm tắt nội dung!"); descInput.focus(); return; }

            let coverImageUrl = "";
            if (coverFile && window.MangaApi.uploadResource) {
                try {
                    const uploaded = await window.MangaApi.uploadResource(coverFile, "COVER_IMAGE");
                    coverImageUrl = window.MangaApi.extractUploadedUrl?.(uploaded) || "";
                } catch (coverError) {
                    console.warn("Cover upload as COVER_IMAGE failed, trying PAGE_IMAGE fallback:", coverError);
                    try {
                        const uploaded = await window.MangaApi.uploadResource(coverFile, "PAGE_IMAGE");
                        coverImageUrl = window.MangaApi.extractUploadedUrl?.(uploaded) || "";
                    } catch (fallbackError) {
                        console.warn("Cover upload failed. The series will still be created without a server cover URL.", fallbackError);
                    }
                }
            }

            const coverDisplayUrl = window.MangaApi.resolveMediaUrl?.(coverImageUrl) || coverImageUrl || coverLocalDataUrl;

            // Backend /manga-series expects JSON: title, genre, summary.
            // Extra cover/description fields are included for backend builds that support them.
            const payload = {
                title,
                genre: genre || "",
                description: desc,
                summary: [desc, seriesScript ? `--- Series Script / Story Bible ---\n${seriesScript}` : "", targetAudience ? `Target: ${targetAudience}` : "", status ? `Status: ${status}` : ""].filter(Boolean).join("\n"),
                coverImageUrl,
                coverUrl: coverImageUrl,
                imageUrl: coverImageUrl,
                thumbnailUrl: coverImageUrl,
                coverImage: coverImageUrl,
                primaryArtUrl: coverImageUrl
            };

            savePendingSeriesMeta(title, {
                description: desc,
                summary: payload.summary,
                coverImageUrl: coverDisplayUrl,
                coverUrl: coverDisplayUrl,
                genre,
                title
            });

            const originalText = btnCreateSeries.innerHTML;
            btnCreateSeries.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang tải lên Server...`;
            btnCreateSeries.style.pointerEvents = "none";
            btnCreateSeries.style.opacity = "0.7";

            try {
                const createdSeries = await window.MangaApi.apiFetch("/manga-series", {
                    method: "POST",
                    body: payload
                });

                const createdSeriesId = createdSeries?.id || createdSeries?.seriesId;
                if (createdSeriesId) {
                    if (seriesScript) window.MangaApi.saveSeriesScript?.(createdSeriesId, seriesScript);
                    window.MangaApi.saveSeriesMeta?.(createdSeriesId, {
                        description: desc,
                        summary: payload.summary,
                        coverImageUrl: coverDisplayUrl,
                        coverUrl: coverDisplayUrl,
                        genre,
                        title
                    });
                }

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


    function cleanSeriesDescription(raw = "") {
        const text = String(raw || "").trim();
        if (!text) return "";

        return text
            .split("\n")
            .filter(line => !line.startsWith("--- Series Script"))
            .filter(line => !line.startsWith("Target:"))
            .filter(line => !line.startsWith("Status:"))
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function seriesMetaOf(series) {
        const byId = window.MangaApi.getSeriesMeta?.(series.id || series.seriesId) || {};
        const byTitle = getPendingSeriesMeta(series.title || series.name || "");
        return { ...byTitle, ...byId };
    }

    function seriesDescriptionOf(series) {
        const meta = seriesMetaOf(series);
        return cleanSeriesDescription(
            series.description ||
            series.summary ||
            series.synopsis ||
            meta.description ||
            meta.summary ||
            ""
        ) || "Chưa có mô tả chi tiết...";
    }

    function firstUsableUrl(value) {
        if (!value) return "";
        if (typeof value === "string") {
            const text = value.trim();
            if (!text) return "";
            if ((text.startsWith("{") && text.endsWith("}")) || (text.startsWith("[") && text.endsWith("]"))) {
                try { return firstUsableUrl(JSON.parse(text)); } catch (_) { return text; }
            }
            return text;
        }
        if (Array.isArray(value)) {
            for (const item of value) {
                const url = firstUsableUrl(item);
                if (url) return url;
            }
            return "";
        }
        if (typeof value === "object") {
            return firstUsableUrl(
                value.coverImageUrl || value.coverUrl || value.imageUrl || value.thumbnailUrl ||
                value.url || value.fileUrl || value.resourceUrl || value.secureUrl || value.downloadUrl ||
                value.path || value.data || value.file || value.image || ""
            );
        }
        return "";
    }

    function resolveSeriesCoverUrl(raw) {
        const value = firstUsableUrl(raw);
        if (!value) return "";
        if (/^(data:|blob:|https?:\/\/)/i.test(value)) return value;
        if (/^(\.\.?\/|assets\/|public\/|images\/|img\/|cover\.png)/i.test(value)) {
            try { return new URL(value, window.location.href).href; } catch (_) { return value; }
        }
        return window.MangaApi.resolveMediaUrl?.(value) || value;
    }

    function seriesCoverOf(series) {
        const meta = seriesMetaOf(series);
        const candidates = [
            series.coverImageUrl,
            series.coverUrl,
            series.imageUrl,
            series.thumbnailUrl,
            series.cover,
            series.coverImage,
            series.image,
            series.thumbnail,
            series.primaryArt,
            series.poster,
            series.resource,
            series.resources,
            meta.coverImageUrl,
            meta.coverUrl,
            meta.imageUrl,
            meta.thumbnailUrl,
            meta.cover,
            meta.coverImage,
            meta.image,
            meta.thumbnail
        ];

        for (const candidate of candidates) {
            const resolved = resolveSeriesCoverUrl(candidate);
            if (resolved) return resolved;
        }

        return "";
    }

    function seriesPlaceholder(title = "") {
        const initials = String(title || "SF")
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(word => word[0]?.toUpperCase())
            .join("") || "SF";
        return `<div class="series-cover-placeholder"><span>${initials}</span><small>No cover image</small></div>`;
    }


    /* =======================================================
       2. TÍNH NĂNG LIST SERIES (Trang series.html)
       ======================================================= */
    const seriesGrid = document.getElementById("series-grid");
    if (seriesGrid) {
        async function fetchAndRenderSeries() {
            try {
                const unwrap = window.MangaApi.unwrapPage || ((value) => Array.isArray(value) ? value : (value?.content || []));
                let mySeriesList = [];
                let allSeriesList = [];

                try {
                    mySeriesList = window.MangaApi.mySeries
                        ? await window.MangaApi.mySeries()
                        : unwrap(await window.MangaApi.apiFetch("/manga-series/my-series"));
                    mySeriesList = unwrap(mySeriesList).map(series => ({ ...series, __fromMySeries: true }));
                } catch (error) {
                    console.warn("Could not load /manga-series/my-series", error);
                    mySeriesList = [];
                }

                try {
                    allSeriesList = window.MangaApi.allSeries
                        ? await window.MangaApi.allSeries()
                        : unwrap(await window.MangaApi.apiFetch("/manga-series"));
                    allSeriesList = unwrap(allSeriesList);
                } catch (error) {
                    console.warn("Could not load /manga-series", error);
                    allSeriesList = [];
                }

                // Important: do not replace the list with only /my-series.
                // Some backend builds return only the newly created Mangaka-owned series from /my-series,
                // while older/imported series are returned by /manga-series.
                const seriesList = mergeSeriesLists(allSeriesList, mySeriesList);

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
                    const seriesId = series.id || series.seriesId;
                    const pendingMeta = getPendingSeriesMeta(series.title || series.name || "");
                    if (seriesId && Object.keys(pendingMeta).length) {
                        window.MangaApi.saveSeriesMeta?.(seriesId, pendingMeta);
                    }
                    const cover = seriesCoverOf(series);
                    const description = seriesDescriptionOf(series);
                    const card = document.createElement("div");
                    card.className = "series-card-real";
                    card.onmouseover = () => { card.style.transform = "translateY(-4px)"; card.style.boxShadow = "0 10px 15px rgba(0,0,0,0.1)"; };
                    card.onmouseout = () => { card.style.transform = "translateY(0)"; card.style.boxShadow = "0 2px 4px rgba(0,0,0,0.05)"; };

                    const meta = seriesMetaOf(series);
                    const genre = series.genre || meta.genre || "";
                    const genreBadge = genre ? `<span class="series-genre-badge">${genre}</span>` : "";
                    const coverHtml = cover
                        ? `<img src="${cover}" alt="${series.title || "Series cover"}" class="series-cover-img" onerror="this.closest('.series-cover-box').innerHTML=this.dataset.fallback;" data-fallback="${seriesPlaceholder(series.title).replace(/"/g, '&quot;')}">`
                        : seriesPlaceholder(series.title);

                    card.innerHTML = `
                        <div class="series-cover-box">
                            ${coverHtml}
                            <div class="series-status-pill">
                                <i class="fa-solid fa-circle"></i> ${series.status || "Ongoing"}
                            </div>
                        </div>
                        <div class="series-card-body">
                            <div class="series-card-title-row">
                                <h3>${series.title || "Untitled"} ${genreBadge}</h3>
                                ${isSeriesOwnedByCurrentMangaka(series) ? `<button type="button" class="danger-mini-btn delete-series-btn" data-delete-series="${seriesId}" title="Delete this series"><i class="fa-solid fa-trash"></i></button>` : ""}
                            </div>
                            <p>${description}</p>
                        </div>
                    `;

                    card.querySelector("[data-delete-series]")?.addEventListener("click", async (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        await deleteMangakaSeries(series, fetchAndRenderSeries);
                    });

                    card.addEventListener("click", () => {
                        localStorage.setItem("currentSeriesId", series.id); localStorage.setItem("activeSeriesId", series.id);
                        localStorage.setItem("currentSeriesTitle", series.title); localStorage.setItem("activeSeriesTitle", series.title);
                        const meta = seriesMetaOf(series);
                        window.MangaApi.saveSeriesMeta?.(series.id || series.seriesId, {
                            title: series.title,
                            description: seriesDescriptionOf(series),
                            coverImageUrl: seriesCoverOf(series),
                            genre: series.genre || meta.genre || ""
                        });
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