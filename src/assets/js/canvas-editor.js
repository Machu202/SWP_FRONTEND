// ==========================================
// canvas-editor.js - BỘ NÃO XỬ LÝ HITBOX & UPLOAD
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    
    // 1. Kiểm tra an ninh & Lấy ID Chapter hiện tại
    const chapterId = localStorage.getItem("currentChapterId") || localStorage.getItem("activeChapterId") || new URLSearchParams(location.search).get("chapterId");
    if (!chapterId && window.MangaApi) {
        alert("Chưa xác định được Chapter. Trở về màn hình Quản lý Bản thảo.");
        window.location.href = "manuscripts.html";
        return;
    }

    // =======================================================
    // [MỚI] TẢI DANH SÁCH TRỢ LÝ TỪ API (GIẢI QUYẾT BÀI TOÁN KCG_ASSISTANT)
    // =======================================================
    async function loadStudioAssistants() {
        const assigneeSelect = document.getElementById('task-assignee-select');
        if (!assigneeSelect || !window.MangaApi) return;

        try {
            // BE CẦN CUNG CẤP API: GET /users/assistants (Trả về mảng user có role assistant)
            const assistants = await window.MangaApi.usersByRole("Assistant");

            assigneeSelect.innerHTML = '<option value="Unassigned">Unassigned (Open to all)</option>';

            if (assistants && assistants.length > 0) {
                assistants.forEach(ast => {
                    const option = document.createElement("option");
                    option.value = ast.id; // Lấy ID thật của Trợ lý
                    option.textContent = ast.fullName || ast.username || ast.email; // Hiển thị Tên thật
                    assigneeSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error("Lỗi tải danh sách trợ lý:", error);
            assigneeSelect.innerHTML = '<option value="Unassigned">Lỗi tải danh sách trợ lý (Chờ API)</option>';
        }
    }
    
    // Khởi chạy load danh sách ngay khi vào Editor
    loadStudioAssistants();

    /* =======================================================
       2. XỬ LÝ CHUYỂN TAB CỘT BÊN PHẢI (Pages / Layers / Tasks)
       ======================================================= */
    const tabs = document.querySelectorAll('.p-tab');
    const panels = document.querySelectorAll('.panel-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            tabs.forEach(t => t.classList.remove('active'));
            panels.forEach(p => p.style.display = 'none');
            e.target.classList.add('active');
            const targetPanel = document.getElementById('panel-' + e.target.dataset.target);
            if (targetPanel) targetPanel.style.display = 'block';
        });
    });

    /* =======================================================
       3. TÍNH NĂNG UPLOAD TRANG TRUYỆN (FE-32)
       ======================================================= */
    const btnAddPage = document.getElementById('btn-add-page');
    const fileUpload = document.getElementById('page-file-upload');
    const canvas = document.getElementById('manga-canvas');

    if (btnAddPage && fileUpload) {
        btnAddPage.addEventListener('click', () => fileUpload.click());
        fileUpload.addEventListener('change', async (e) => {
            const files = e.target.files;
            if (!files || files.length === 0) return;
            const file = files[0];
            const oldText = btnAddPage.innerHTML;
            btnAddPage.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading...';
            try {
                const existingPages = window.MangaApi ? await window.MangaApi.pages(chapterId).catch(() => []) : [];
                const nextPageNumber = (existingPages?.length || 0) + 1;
                const savedPage = await window.MangaApi.createPage(chapterId, nextPageNumber, file);
                const pageId = savedPage.id;
                if (pageId) {
                    localStorage.setItem('activePageId', pageId);
                    localStorage.setItem('currentPageId', pageId);
                }
                const imageUrl = savedPage.imageUrl;
                if (imageUrl) {
                    canvas.style.backgroundImage = `url('${imageUrl}')`;
                    canvas.style.backgroundSize = 'contain';
                    canvas.style.backgroundRepeat = 'no-repeat';
                    canvas.style.backgroundPosition = 'center';
                } else {
                    const reader = new FileReader();
                    reader.onload = (event) => { canvas.style.backgroundImage = `url('${event.target.result}')`; };
                    reader.readAsDataURL(file);
                }
                showToast("Page uploaded to backend successfully.");
            } catch (error) {
                alert("Page upload failed: " + error.message);
            } finally {
                btnAddPage.innerHTML = oldText;
            }
        });
    }

    async function loadCurrentPageFromBackend() {
        const pageId = localStorage.getItem('activePageId') || localStorage.getItem('currentPageId') || new URLSearchParams(location.search).get('pageId');
        if (!pageId || !window.MangaApi || !canvas) return;
        try {
            const init = await window.MangaApi.canvasInit(pageId);
            if (init?.imageUrl) {
                canvas.style.backgroundImage = `url('${init.imageUrl}')`;
                canvas.style.backgroundSize = 'contain';
                canvas.style.backgroundRepeat = 'no-repeat';
                canvas.style.backgroundPosition = 'center';
            }
            (init?.hitboxes || []).forEach(h => {
                const box = document.createElement('div');
                box.className = 'editor-hitbox hitbox-purple';
                box.style.left = (h.xCoord ?? h.x ?? 0) + '%';
                box.style.top = (h.yCoord ?? h.y ?? 0) + '%';
                box.style.width = (h.width ?? 0) + '%';
                box.style.height = (h.height ?? 0) + '%';
                box.style.pointerEvents = 'auto';
                box.innerHTML = `<div class="hitbox-tag">Hitbox #${h.id}</div>`;
                canvas.appendChild(box);
            });
        } catch (error) {
            console.warn('Canvas init failed:', error.message);
        }
    }
    loadCurrentPageFromBackend();

    /* =======================================================
       4. TÍNH NĂNG KÉO THẢ VẼ HITBOX (FE-34)
       ======================================================= */
    let currentTool = 'select';
    const tools = {
        select: document.getElementById('tool-select'),
        draw: document.getElementById('tool-draw'),
        brush: document.getElementById('tool-brush')
    };

    Object.keys(tools).forEach(key => {
        if (!tools[key]) return;
        tools[key].addEventListener('click', () => {
            Object.values(tools).forEach(t => t.classList.remove('active'));
            tools[key].classList.add('active');
            currentTool = key;
            canvas.style.cursor = key === 'draw' ? 'crosshair' : 'default';
        });
    });

    let isDrawing = false;
    let startX = 0, startY = 0;
    let tempBox = null;
    let boxCoords = {};

    // BẮT ĐẦU VẼ (Mouse Down)
    canvas.addEventListener('mousedown', (e) => {
        if (currentTool !== 'draw') return;
        
        isDrawing = true;
        const rect = canvas.getBoundingClientRect();
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;

        tempBox = document.createElement('div');
        tempBox.className = 'editor-hitbox hitbox-purple';
        tempBox.style.left = (startX / rect.width * 100) + '%';
        tempBox.style.top = (startY / rect.height * 100) + '%';
        tempBox.style.width = '0%';
        tempBox.style.height = '0%';
        tempBox.style.pointerEvents = 'none'; 
        canvas.appendChild(tempBox);
    });

    // QUÉT CHUỘT (Mouse Move)
    canvas.addEventListener('mousemove', (e) => {
        if (!isDrawing || !tempBox) return;

        const rect = canvas.getBoundingClientRect();
        const curX = e.clientX - rect.left;
        const curY = e.clientY - rect.top;

        const width = Math.abs(curX - startX);
        const height = Math.abs(curY - startY);
        const left = Math.min(curX, startX);
        const top = Math.min(curY, startY);

        boxCoords = {
            left: (left / rect.width * 100),
            top: (top / rect.height * 100),
            width: (width / rect.width * 100),
            height: (height / rect.height * 100)
        };

        tempBox.style.left = boxCoords.left + '%';
        tempBox.style.top = boxCoords.top + '%';
        tempBox.style.width = boxCoords.width + '%';
        tempBox.style.height = boxCoords.height + '%';
    });

    // KẾT THÚC VẼ (Mouse Up)
    canvas.addEventListener('mouseup', () => {
        if (!isDrawing) return;
        isDrawing = false;
        
        if (boxCoords.width < 2 || boxCoords.height < 2) {
            tempBox.remove();
            tempBox = null;
            return;
        }

        const modal = document.getElementById('task-modal');
        if (modal) modal.style.display = 'flex';
    });

    // HỦY VẼ KHI BẤM RA NGOÀI MODAL
    const taskModal = document.getElementById('task-modal');
    if (taskModal) {
        taskModal.addEventListener('click', (e) => {
            if (e.target.id === 'task-modal') {
                taskModal.style.display = 'none';
                if (tempBox) tempBox.remove(); 
            }
        });
    }

    /* =======================================================
       5. GỬI TASK XUỐNG BACKEND & LƯU LÊN CANVAS
       ======================================================= */
    const btnConfirmTask = document.getElementById('btn-confirm-task');
    if (btnConfirmTask) {
        btnConfirmTask.addEventListener('click', async () => {
            const taskName = document.getElementById('task-name-input').value.trim();
            const assigneeSelect = document.getElementById('task-assignee-select');
            
            // Lấy ID thật của Trợ lý từ Dropdown
            const assigneeId = assigneeSelect.value;
            // Lấy Tên hiển thị để dán lên Hitbox trên màn hình
            const assigneeName = assigneeId !== 'Unassigned' ? assigneeSelect.options[assigneeSelect.selectedIndex].text : '';

            if (!taskName) {
                alert("Vui lòng nhập tên công việc!");
                return;
            }

            const originalText = btnConfirmTask.innerText;
            btnConfirmTask.innerText = "Đang giao việc...";
            btnConfirmTask.disabled = true;

            try {
                // Create hitbox first, then create a task under that hitbox, then optionally assign Assistant.
                let createdTask = null;
                if (window.MangaApi) {
                    const pageId = localStorage.getItem("activePageId") || localStorage.getItem("currentPageId") || new URLSearchParams(location.search).get("pageId");
                    if (!pageId) throw new Error("No page selected. Upload or select a page first.");
                    const hitbox = await window.MangaApi.createHitbox(pageId, {
                        x: boxCoords.left,
                        y: boxCoords.top,
                        width: boxCoords.width,
                        height: boxCoords.height
                    });
                    createdTask = await window.MangaApi.assignTaskToHitbox(hitbox.id, taskName);
                    if (assigneeId && assigneeId !== "Unassigned" && createdTask?.id) {
                        createdTask = await window.MangaApi.assignTask(createdTask.id, assigneeId);
                    }
                }

                // Thành công -> Trang trí cho tempBox thành Hitbox thật
                const tag = document.createElement('div');
                tag.className = 'hitbox-tag';
                tag.innerText = assigneeId !== 'Unassigned' ? `[${assigneeName}] ${taskName}` : taskName;
                if (createdTask?.id) tempBox.dataset.taskId = createdTask.id;
                
                const btnDelete = document.createElement('button');
                btnDelete.className = 'hitbox-delete';
                btnDelete.innerHTML = '<i class="fa-solid fa-xmark"></i>';
                
                btnDelete.onclick = () => {
                    tempBox.remove();
                }; 

                tempBox.appendChild(tag);
                tempBox.appendChild(btnDelete);
                tempBox.style.pointerEvents = 'auto'; 
                
                if (taskModal) taskModal.style.display = 'none';
                document.getElementById('task-name-input').value = "";
                tempBox = null;
                
                if (tools['select']) tools['select'].click();
                showToast("Đã giao việc thành công!");

            } catch (error) {
                alert("Lỗi khi giao việc: " + error.message);
                if (tempBox) tempBox.remove(); 
            } finally {
                btnConfirmTask.innerText = originalText;
                btnConfirmTask.disabled = false;
            }
        });
    }

    // =======================================================
    // 6. CÁC HÀM TIỆN ÍCH HỖ TRỢ
    // =======================================================
    function showToast(msg) {
        const toast = document.getElementById('toast-msg');
        if (toast) {
            toast.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${msg}`;
            toast.classList.add('show'); 
            toast.style.display = 'block';
            setTimeout(() => {
                toast.style.display = 'none';
                toast.classList.remove('show');
            }, 2500);
        }
    }

    document.querySelectorAll('.hitbox-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const hitbox = e.target.closest('.editor-hitbox');
            if (hitbox) hitbox.remove();
        });
    });
});