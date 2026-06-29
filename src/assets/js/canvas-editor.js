// ==========================================
// canvas-editor.js - BỘ NÃO XỬ LÝ HITBOX & UPLOAD
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    
    // 1. Kiểm tra an ninh & Lấy ID Chapter hiện tại
    const chapterId = localStorage.getItem("currentChapterId") || localStorage.getItem("activeChapterId");
    if (!chapterId && window.MangaApi) {
        alert("Chưa xác định được Chapter. Trở về màn hình Quản lý Bản thảo.");
        window.location.href = "manuscripts.html";
        return;
    }

    /* =======================================================
       2. XỬ LÝ CHUYỂN TAB CỘT BÊN PHẢI (Pages / Layers / Tasks)
       ======================================================= */
    const tabs = document.querySelectorAll('.p-tab');
    const panels = document.querySelectorAll('.panel-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            // Xóa active cũ
            tabs.forEach(t => t.classList.remove('active'));
            panels.forEach(p => p.style.display = 'none');
            // Bật active mới
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
            if (files.length === 0) return;

            // Đọc ảnh và hiển thị lên khung Canvas
            const reader = new FileReader();
            reader.onload = function(event) {
                canvas.style.backgroundImage = `url('${event.target.result}')`;
                canvas.style.backgroundSize = 'contain';
                canvas.style.backgroundRepeat = 'no-repeat';
                canvas.style.backgroundPosition = 'center';
                showToast("Tải trang truyện lên thành công!");
            };
            reader.readAsDataURL(files[0]);

            // Ghi chú cho BE: Sử dụng FormData để gọi POST /pages ở đây nếu cần lưu ngay
        });
    }

    /* =======================================================
       4. TÍNH NĂNG KÉO THẢ VẼ HITBOX (FE-34)
       ======================================================= */
    let currentTool = 'select'; 
    const tools = {
        select: document.getElementById('tool-select'),
        draw: document.getElementById('tool-draw'),
        brush: document.getElementById('tool-brush')
    };

    // Đổi công cụ (Select / Draw / Brush)
    Object.keys(tools).forEach(key => {
        if (!tools[key]) return;
        tools[key].addEventListener('click', () => {
            Object.values(tools).forEach(t => t.classList.remove('active'));
            tools[key].classList.add('active');
            currentTool = key;
            canvas.style.cursor = key === 'draw' ? 'crosshair' : 'default';
        });
    });

    // Các biến lưu trạng thái vẽ Hitbox
    let isDrawing = false;
    let startX = 0, startY = 0;
    let tempBox = null;
    let boxCoords = {}; // Lưu phần trăm tọa độ để gửi Backend

    // BẮT ĐẦU VẼ (Mouse Down)
    canvas.addEventListener('mousedown', (e) => {
        if (currentTool !== 'draw') return;
        
        isDrawing = true;
        const rect = canvas.getBoundingClientRect();
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;

        // Tạo 1 khối DIV ảo hiển thị vùng đang quét
        tempBox = document.createElement('div');
        tempBox.className = 'editor-hitbox hitbox-purple';
        tempBox.style.left = (startX / rect.width * 100) + '%';
        tempBox.style.top = (startY / rect.height * 100) + '%';
        tempBox.style.width = '0%';
        tempBox.style.height = '0%';
        tempBox.style.pointerEvents = 'none'; // Không chặn sự kiện di chuột
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

        // Lưu tỷ lệ % để hiển thị đúng trên mọi màn hình (Responsive)
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
        
        // Nếu khung quét quá nhỏ, coi như bấm nhầm -> Xóa
        if (boxCoords.width < 2 || boxCoords.height < 2) {
            tempBox.remove();
            tempBox = null;
            return;
        }

        // Hiện Form Modal để nhập thông tin Task
        const modal = document.getElementById('task-modal');
        if (modal) modal.style.display = 'flex';
    });

    // HỦY VẼ KHI BẤM RA NGOÀI MODAL
    const taskModal = document.getElementById('task-modal');
    if (taskModal) {
        taskModal.addEventListener('click', (e) => {
            if (e.target.id === 'task-modal') {
                taskModal.style.display = 'none';
                if (tempBox) tempBox.remove(); // Xóa khung vừa vẽ dở
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
            const assignee = document.getElementById('task-assignee-select').value;

            if (!taskName) {
                alert("Vui lòng nhập tên công việc!");
                return;
            }

            // Đổi UI báo đang xử lý
            const originalText = btnConfirmTask.innerText;
            btnConfirmTask.innerText = "Đang giao việc...";
            btnConfirmTask.disabled = true;

            try {
                // GỌI API GIAO VIỆC XUỐNG BACKEND
                if (window.MangaApi) {
                    await window.MangaApi.apiFetch("/workspace/pages/" + (localStorage.getItem("activePageId") || localStorage.getItem("currentPageId") || "1") + "/hitboxes?x=" + encodeURIComponent(boxCoords.left) + "&y=" + encodeURIComponent(boxCoords.top) + "&width=" + encodeURIComponent(boxCoords.width) + "&height=" + encodeURIComponent(boxCoords.height), {
                        method: "POST",
                        body: {
                            chapterId: chapterId,
                            title: taskName,
                            assigneeId: assignee, // Lưu ID của trợ lý
                            status: "TODO", // Trạng thái mặc định
                            hitboxX: boxCoords.left,
                            hitboxY: boxCoords.top,
                            hitboxWidth: boxCoords.width,
                            hitboxHeight: boxCoords.height
                        }
                    });
                }

                // Thành công -> Trang trí cho tempBox thành Hitbox thật
                const tag = document.createElement('div');
                tag.className = 'hitbox-tag';
                tag.innerText = assignee !== 'Unassigned' ? `[${assignee}] ${taskName}` : taskName;
                
                const btnDelete = document.createElement('button');
                btnDelete.className = 'hitbox-delete';
                btnDelete.innerHTML = '<i class="fa-solid fa-xmark"></i>';
                
                // Nút xóa Hitbox
                btnDelete.onclick = () => {
                    // TODO: Sau này gọi API DELETE /tasks/{id} trước khi remove
                    tempBox.remove();
                }; 

                tempBox.appendChild(tag);
                tempBox.appendChild(btnDelete);
                tempBox.style.pointerEvents = 'auto'; // Kích hoạt tương tác lại
                
                // Dọn dẹp Modal
                if (taskModal) taskModal.style.display = 'none';
                document.getElementById('task-name-input').value = "";
                tempBox = null;
                
                // Trở về nút trỏ chuột mặc định
                if (tools['select']) tools['select'].click();
                showToast("Đã giao việc thành công!");

            } catch (error) {
                alert("Lỗi khi giao việc: " + error.message);
                if (tempBox) tempBox.remove(); // Bị lỗi thì xóa cái khung vừa vẽ
            } finally {
                // Phục hồi nút bấm
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

    // Lắng nghe sự kiện xóa cho các Hitbox có sẵn ban đầu (Hardcode trong HTML)
    document.querySelectorAll('.hitbox-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const hitbox = e.target.closest('.editor-hitbox');
            if (hitbox) hitbox.remove();
        });
    });
});