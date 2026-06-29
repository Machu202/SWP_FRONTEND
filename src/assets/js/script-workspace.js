document.addEventListener("DOMContentLoaded", () => {
    
    // ======================================================== 
    // 1. KANBAN BOARD - GỌI API & KÉO THẢ (Cho cả Mangaka & Assistant)
    // ======================================================== 
    const todoList = document.getElementById("todo-list") || document.getElementById("ast-todo-list");
    const inprogressList = document.getElementById("inprogress-list") || document.getElementById("ast-inprogress-list");
    const doneList = document.getElementById("done-list") || document.getElementById("ast-review-list");

    const countTodo = document.getElementById("todo-count") || document.getElementById("ast-todo-count");
    const countInprogress = document.getElementById("inprogress-count") || document.getElementById("ast-inprogress-count");
    const countDone = document.getElementById("done-count") || document.getElementById("ast-review-count");

    if (todoList && inprogressList && doneList) {
        
        async function loadAssignments() {
            try {
                let tasks = [];
                if (window.MangaApi) {
                    tasks = await window.MangaApi.apiFetch("/tasks/my-tasks");
                }

                if (!tasks || tasks.length === 0) {
                    tasks = [
                        { id: "task-1", title: "Draw Backgrounds - Ch.42", assignee: "Kenji", status: "TODO" },
                        { id: "task-2", title: "Inking Needed - Ch.42", assignee: "Yui", status: "IN_PROGRESS" }
                    ];
                }

                todoList.innerHTML = "";
                inprogressList.innerHTML = "";
                doneList.innerHTML = "";

                let cTodo = 0, cProg = 0, cDone = 0;

                tasks.forEach(task => {
                    const status = task.status || "TODO";
                    const card = document.createElement("div");
                    card.className = "kanban-card";
                    card.draggable = true;
                    card.dataset.id = task.id;

                    card.innerHTML = `
                        <div class="tag">${task.assignee || 'Unassigned'}</div>
                        <div class="task-title">${task.title}</div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 11px; color: #6b7280;"><i class="fa-regular fa-clock"></i> ASAP</span>
                            <i class="fa-solid fa-grip-lines" style="color: #d1d5db;"></i>
                        </div>
                    `;

                    card.addEventListener("dragstart", (e) => {
                        e.dataTransfer.setData("text/plain", task.id);
                        card.classList.add("dragging");
                        setTimeout(() => card.style.opacity = "0.5", 0);
                    });

                    card.addEventListener("dragend", () => {
                        card.classList.remove("dragging");
                        card.style.opacity = "1";
                    });

                    if (status === "TODO") {
                        todoList.appendChild(card);
                        cTodo++;
                    } else if (status === "IN_PROGRESS") {
                        inprogressList.appendChild(card);
                        cProg++;
                    } else {
                        doneList.appendChild(card);
                        cDone++;
                    }
                });

                if (countTodo) countTodo.innerText = cTodo;
                if (countInprogress) countInprogress.innerText = cProg;
                if (countDone) countDone.innerText = cDone;

            } catch (error) {
                console.error("Lỗi tải Kanban:", error);
            }
        }

        const columns = document.querySelectorAll(".kanban-column");
        columns.forEach(col => {
            const taskList = col.querySelector(".kanban-task-list");
            if (!taskList) return;

            let colStatus = "TODO";
            if (taskList.id.includes("inprogress")) colStatus = "IN_PROGRESS";
            if (taskList.id.includes("done") || taskList.id.includes("review")) colStatus = "REVIEW";

            taskList.addEventListener("dragover", e => {
                e.preventDefault(); 
                taskList.style.background = "rgba(0,0,0,0.03)";
                const dragging = document.querySelector(".dragging");
                if (dragging) taskList.appendChild(dragging);
            });

            taskList.addEventListener("dragleave", () => {
                taskList.style.background = "transparent";
            });

            taskList.addEventListener("drop", async (e) => {
                e.preventDefault();
                taskList.style.background = "transparent";
                
                const taskId = e.dataTransfer.getData("text/plain");
                
                if (window.MangaApi && taskId && !taskId.startsWith('task-')) {
                    try {
                        await window.MangaApi.apiFetch(`/tasks/${taskId}/status?newStatus=${encodeURIComponent(colStatus)}`, {
                            method: "PATCH"
                        });
                        loadAssignments(); 
                    } catch (error) {
                        alert("Lỗi cập nhật tiến độ: " + error.message);
                        loadAssignments(); 
                    }
                } else {
                    loadAssignments(); 
                }
            });
        });

        loadAssignments();
    }

    // ======================================================== 
    // 2. MÔ PHỎNG DROPZONE UPLOAD TRỢ LÝ NỘP BÀI               
    // ======================================================== 
    const fileDropzone = document.getElementById('file-dropzone');
    const btnUploadSubmit = document.getElementById('btn-upload-submit');
    const checkFinalReview = document.getElementById('check-final-review');
    let hasUploadedFile = false;

    if (fileDropzone) {
        fileDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileDropzone.style.borderColor = 'var(--primary-color)';
            fileDropzone.style.background = 'white';
        });
        fileDropzone.addEventListener('dragleave', () => {
            fileDropzone.style.borderColor = '#d1d5db';
            fileDropzone.style.background = '#f9fafb';
        });
        fileDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            hasUploadedFile = true;
            fileDropzone.innerHTML = `<i class="fa-solid fa-file-circle-check" style="color: #10b981;"></i><p style="color: #10b981;">Bản thảo đã được đính kèm</p><span>Sẵn sàng để Upload</span>`;
            fileDropzone.style.borderColor = '#10b981';
            checkReadyState();
        });
        fileDropzone.addEventListener('click', () => {
            hasUploadedFile = true;
            fileDropzone.innerHTML = `<i class="fa-solid fa-file-circle-check" style="color: #10b981;"></i><p style="color: #10b981;">Bản thảo đã được đính kèm</p><span>Sẵn sàng để Upload</span>`;
            fileDropzone.style.borderColor = '#10b981';
            checkReadyState();
        });

        if (checkFinalReview) {
            checkFinalReview.addEventListener('change', checkReadyState);
        }

        function checkReadyState() {
            if (hasUploadedFile && checkFinalReview && checkFinalReview.checked) {
                btnUploadSubmit.style.background = '#111827';
                btnUploadSubmit.style.color = 'white';
                btnUploadSubmit.style.cursor = 'pointer';
            } else {
                btnUploadSubmit.style.background = '#e5e7eb';
                btnUploadSubmit.style.color = '#9ca3af';
                btnUploadSubmit.style.cursor = 'not-allowed';
            }
        }
        
        if (btnUploadSubmit) {
            btnUploadSubmit.addEventListener('click', () => {
                if(btnUploadSubmit.style.cursor === 'pointer') {
                    alert("Tải lên thành công! Đã gửi thông báo cho Mangaka duyệt bài.");
                    window.location.href = "assistant-assignments.html";
                }
            });
        }
    }


    // ======================================================== 
    // 3. TÍNH NĂNG NÚT APPROVE & REQUEST REVISION (Trang Review)               
    // ======================================================== 
    const btnApprove = document.getElementById('btn-approve');
    const btnRequestRev = document.getElementById('btn-request-rev');
    const statusTagReview = document.querySelector('.review-col .status-tag.review');
    const toast = document.getElementById('toast-msg');

    function showToast(message, isError = false) {
        if (!toast) return;
        toast.innerHTML = isError ?
            `<i class="fa-solid fa-circle-exclamation"></i> ${message}` : `<i class="fa-solid fa-circle-check"></i> ${message}`;
        toast.style.background = isError ? '#ef4444' : '#10b981';
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    if (btnApprove) {
        btnApprove.addEventListener('click', () => {
            btnApprove.style.background = '#10b981';
            btnApprove.innerHTML = '<i class="fa-solid fa-check-double"></i> Approved';
            if (btnRequestRev) {
                btnRequestRev.style.background = 'white';
                btnRequestRev.style.color = '#111827';
                btnRequestRev.innerHTML = '<i class="fa-solid fa-xmark"></i> Request Revision';
            }
            if (statusTagReview) {
                statusTagReview.innerText = 'Approved';
                statusTagReview.style.background = '#dcfce7';
                statusTagReview.style.color = '#166534';
            }
            showToast("Bản thảo đã được duyệt thành công!");
        });
    }

    if (btnRequestRev) {
        btnRequestRev.addEventListener('click', () => {
            btnRequestRev.style.background = '#ef4444'; 
            btnRequestRev.style.color = 'white';
            btnRequestRev.innerHTML = '<i class="fa-solid fa-rotate-left"></i> Revision Requested';
            if (btnApprove) {
                btnApprove.style.background = '#111827';
                btnApprove.innerHTML = '<i class="fa-solid fa-check"></i> Approve';
            }
            if (statusTagReview) {
                statusTagReview.innerText = 'Revision Needed';
                statusTagReview.style.background = '#fee2e2';
                statusTagReview.style.color = '#991b1b';
            }
            showToast("Đã gửi yêu cầu chỉnh sửa cho Trợ lý.", true);
        });
    }


    // ======================================================== 
    // 4. CHAT FEEDBACK VÀ ĐIỂM CHẤM ĐỎ TƯƠNG TÁC (Trang Review)               
    // ======================================================== 
    const chatInput = document.getElementById('chat-input');
    const btnSendChat = document.getElementById('btn-send-chat');
    const chatBox = document.getElementById('chat-box');
    const assistantImgWrapper = document.getElementById('assistant-img-wrapper');
    const chatCountBadge = document.getElementById('chat-count-badge');
    
    let annotationCounter = 1;

    if (assistantImgWrapper) {
        assistantImgWrapper.addEventListener('click', function(e) {
            if (e.target.classList.contains('annotation-dot')) return;
            const rect = assistantImgWrapper.getBoundingClientRect();
            const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
            const yPercent = ((e.clientY - rect.top) / rect.height) * 100;

            annotationCounter++;
            
            const newDot = document.createElement('div');
            newDot.className = 'annotation-dot';
            newDot.style.left = xPercent.toFixed(2) + '%';
            newDot.style.top = yPercent.toFixed(2) + '%';
            newDot.innerText = annotationCounter;
            assistantImgWrapper.appendChild(newDot);

            if (chatInput) {
                chatInput.value = `[Annotation ${annotationCounter}] ` + chatInput.value;
                chatInput.focus();
            }
        });
    }

    function sendChatMsg() {
        if (!chatInput || !chatInput.value.trim() || !chatBox) return;
        let annotationTagHtml = '';
        let cleanText = chatInput.value;

        if (cleanText.startsWith('[Annotation')) {
            const closingBracketIndex = cleanText.indexOf(']');
            if (closingBracketIndex !== -1) {
                const annotationNum = cleanText.substring(12, closingBracketIndex);
                annotationTagHtml = `<div class="chat-annotation-ref"><span style="background: #ef4444; color: white; border-radius: 50%; width: 14px; height: 14px; display: inline-flex; align-items: center; justify-content: center; font-size: 9px;">${annotationNum}</span> Annotation</div>`;
                cleanText = cleanText.substring(closingBracketIndex + 1).trim();
            }
        }

        const msgHtml = `
            <div class="chat-msg mine" style="margin-top: 10px;">
                <div class="chat-avatar">SF</div>
                <div class="chat-msg-body">
                    <div class="chat-name"><span>Sensei</span> <span class="chat-time">Just now</span></div>
                    <div class="chat-bubble-border">
                        <div class="chat-bubble">${cleanText}</div>
                        ${annotationTagHtml}
                    </div>
                </div>
            </div>
        `;
        chatBox.insertAdjacentHTML('beforeend', msgHtml);
        chatInput.value = ''; 
        chatBox.scrollTop = chatBox.scrollHeight;

        if (chatCountBadge) {
            let currentCount = parseInt(chatCountBadge.innerText) || 0;
            chatCountBadge.innerText = currentCount + 1;
        }
    }

    if (btnSendChat) btnSendChat.addEventListener('click', sendChatMsg);
    if (chatInput) {
        chatInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendChatMsg();
            }
        });
    }

    // ======================================================== 
    // 5. EDITOR ENGINE & CANVAS LÕI (Trang Page Editor)               
    // ======================================================== 
    const canvas = document.getElementById('manga-canvas');
    if (canvas) {
        const canvasView = document.getElementById('canvas-view');
        const toolSelect = document.getElementById('tool-select');
        const toolDraw = document.getElementById('tool-draw');
        const toolBrush = document.getElementById('tool-brush');
        const taskModal = document.getElementById('task-modal');
        const btnConfirm = document.getElementById('btn-confirm-task');
        const inputTaskName = document.getElementById('task-name-input');
        const selectAssignee = document.getElementById('task-assignee-select'); 
        const freehandLayer = document.getElementById('freehand-layer');
        let ctx = null;
        
        if(freehandLayer) {
            ctx = freehandLayer.getContext('2d');
            if(ctx) {
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                ctx.strokeStyle = '#111827'; 
            }
        }

        let currentTool = 'select'; 
        let isDrawingHitbox = false;
        let isDragging = false;
        let isResizing = false;
        let isFreehanding = false; 

        let startX, startY;
        let activeElement = null;
        let tempBox = null;

        const layerToggles = document.querySelectorAll('.layer-visibility-toggle');
        layerToggles.forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation(); 
                const target = toggle.dataset.layer;
                const icon = toggle.querySelector('i');
                const isHidden = icon.classList.contains('fa-eye-slash');

                if(isHidden) {
                    icon.classList.replace('fa-eye-slash', 'fa-eye');
                    icon.style.color = '#6b7280';
                    toggle.parentElement.classList.remove('locked');
                } else {
                    icon.classList.replace('fa-eye', 'fa-eye-slash');
                    icon.style.color = '#d1d5db';
                    toggle.parentElement.classList.add('locked');
                }

                if(target === 'draft' && freehandLayer) {
                    freehandLayer.style.display = isHidden ? 'block' : 'none';
                } else if (target === 'hitbox') {
                    document.querySelectorAll('.editor-hitbox').forEach(b => b.style.display = isHidden ? 'block' : 'none');
                } else if (target === 'grid') {
                    const gridLayer = document.getElementById('grid-guide-layer');
                    if(gridLayer) gridLayer.style.display = isHidden ? 'block' : 'none';
                }
            });
        });

        function resetTools() {
            if(toolSelect) toolSelect.classList.remove('active');
            if(toolDraw) toolDraw.classList.remove('active');
            if(toolBrush) toolBrush.classList.remove('active');
            if(freehandLayer) freehandLayer.style.pointerEvents = 'none'; 
        }

        if (toolSelect) toolSelect.onclick = () => { resetTools(); currentTool = 'select'; toolSelect.classList.add('active'); if(canvasView) canvasView.style.cursor = 'default'; };
        if (toolDraw) toolDraw.onclick = () => { resetTools(); currentTool = 'draw'; toolDraw.classList.add('active'); if(canvasView) canvasView.style.cursor = 'crosshair'; };
        if (toolBrush) toolBrush.onclick = () => { resetTools(); currentTool = 'brush'; toolBrush.classList.add('active'); if(canvasView) canvasView.style.cursor = 'crosshair'; if(freehandLayer) freehandLayer.style.pointerEvents = 'auto'; };
        
        canvas.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.hitbox-delete');
            if (deleteBtn) deleteBtn.closest('.editor-hitbox').remove();
        });

        canvas.addEventListener('mousedown', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            if (currentTool === 'draw') {
                isDrawingHitbox = true; startX = x; startY = y;
                tempBox = document.createElement('div');
                tempBox.className = 'selection-box';
                canvas.appendChild(tempBox);
            } else if (currentTool === 'select') {
                if (e.target.closest('.hitbox-delete')) return; 
                if (e.target.classList.contains('resize-handle')) {
                    isResizing = true; activeElement = e.target.parentElement; return;
                }
                const hitbox = e.target.closest('.editor-hitbox');
                if (hitbox) {
                    isDragging = true; activeElement = hitbox;
                    startX = x - hitbox.offsetLeft; startY = y - hitbox.offsetTop;
                }
            }
        });

        if (freehandLayer && ctx) {
            freehandLayer.onmousedown = (e) => {
                if(currentTool === 'brush') {
                    isFreehanding = true;
                    const rect = freehandLayer.getBoundingClientRect();
                    ctx.beginPath();
                    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
                }
            };
        }

        window.onmousemove = (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
            const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

            if (isDrawingHitbox && tempBox) {
                tempBox.style.left = Math.min(x, startX) + 'px';
                tempBox.style.top = Math.min(y, startY) + 'px';
                tempBox.style.width = Math.abs(x - startX) + 'px'; tempBox.style.height = Math.abs(y - startY) + 'px';
            } else if (isDragging && activeElement) {
                activeElement.style.left = (x - startX) + 'px';
                activeElement.style.top = (y - startY) + 'px';
            } else if (isResizing && activeElement) {
                activeElement.style.width = Math.max(20, x - activeElement.offsetLeft) + 'px';
                activeElement.style.height = Math.max(20, y - activeElement.offsetTop) + 'px';
            } else if (isFreehanding && ctx) {
                ctx.lineTo(x, y);
                ctx.stroke();
            }
        };

        window.onmouseup = () => {
            if (isDrawingHitbox && tempBox && taskModal && inputTaskName && selectAssignee) {
                inputTaskName.value = '';
                selectAssignee.value = 'Unassigned'; 
                taskModal.style.display = 'flex'; 
            }
            isDrawingHitbox = false; isDragging = false;
            isResizing = false; isFreehanding = false;
        };

        if(btnConfirm && inputTaskName && selectAssignee) {
            btnConfirm.onclick = () => {
                if (!tempBox) return;
                const taskName = inputTaskName.value.trim() || 'Untitled Task';
                const assignee = selectAssignee.value;
                const assigneeText = assignee !== 'Unassigned' ? `[${assignee}] ` : '';
                
                const finalBox = document.createElement('div');
                finalBox.className = 'editor-hitbox hitbox-purple';
                finalBox.style.left = tempBox.style.left; finalBox.style.top = tempBox.style.top;
                finalBox.style.width = tempBox.style.width; finalBox.style.height = tempBox.style.height;

                finalBox.innerHTML = `
                    <div class="hitbox-tag">${assigneeText}${taskName}</div>
                    <button class="hitbox-delete" title="Xóa"><i class="fa-solid fa-xmark"></i></button>
                    <div class="resize-handle"></div>
                `;
                canvas.appendChild(finalBox);
                tempBox.remove(); tempBox = null; if(taskModal) taskModal.style.display = 'none';
                if(toolSelect) toolSelect.click(); 
            };
        }

        const pTabs = document.querySelectorAll(".p-tab");
        pTabs.forEach(tab => {
            tab.addEventListener("click", () => {
                pTabs.forEach(t => t.classList.remove("active"));
                tab.classList.add("active");
                
                const target = tab.dataset.target;
                const pPages = document.getElementById("panel-pages");
                const pLayers = document.getElementById("panel-layers");
                const pTasks = document.getElementById("panel-tasks");
                
                if(pPages && pLayers && pTasks) {
                    pPages.style.display = target === 'pages' ? 'block' : 'none';
                    pLayers.style.display = target === 'layers' ? 'block' : 'none';
                    pTasks.style.display = target === 'tasks' ? 'block' : 'none';
                }
            });
        });
    }

    // ======================================================== 
    // 6. TOPBAR API LOGIC (CHUÔNG THÔNG BÁO, AVATAR, ĐĂNG XUẤT)
    // ======================================================== 
    const btnNoti = document.getElementById("btn-noti-toggle");
    const dropNoti = document.getElementById("noti-dropdown");
    const btnAvatar = document.getElementById("btn-avatar-toggle");
    const dropAvatar = document.getElementById("avatar-dropdown");
    const btnLogout = document.getElementById("btn-global-logout");

    if (btnNoti && dropNoti) {
        btnNoti.addEventListener("click", (e) => {
            e.stopPropagation();
            dropNoti.style.display = dropNoti.style.display === "none" ? "block" : "none";
            if (dropAvatar) dropAvatar.style.display = "none";
        });
    }

    if (btnAvatar && dropAvatar) {
        btnAvatar.addEventListener("click", (e) => {
            e.stopPropagation();
            dropAvatar.style.display = dropAvatar.style.display === "none" ? "block" : "none";
            if (dropNoti) dropNoti.style.display = "none";
        });
    }

    document.addEventListener("click", (e) => {
        if (dropNoti && !dropNoti.contains(e.target)) dropNoti.style.display = "none";
        if (dropAvatar && !dropAvatar.contains(e.target)) dropAvatar.style.display = "none";
    });

    if (btnLogout) {
        btnLogout.addEventListener("click", (e) => {
            e.preventDefault();
            if (window.MangaApi) window.MangaApi.logout();
        });
    }

    async function loadNotifications() {
        const notiList = document.getElementById("noti-list");
        const notiBadge = document.getElementById("noti-badge");
        if (!notiList) return;

        try {
            const notifications = await window.MangaApi.apiFetch("/notifications/unread");
            
            if (!notifications || notifications.length === 0) {
                notiList.innerHTML = `<div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 13px;">Không có thông báo mới</div>`;
                if (notiBadge) notiBadge.style.display = "none";
                return;
            }

            const unreadCount = notifications.filter(n => !n.isRead).length;
            if (notiBadge && unreadCount > 0) {
                notiBadge.innerText = unreadCount;
                notiBadge.style.display = "flex";
            }

            notiList.innerHTML = notifications.map(noti => {
                const bg = noti.isRead ? "white" : "#f0fdf4";
                const dot = noti.isRead ? "" : `<div style="width: 8px; height: 8px; background: #22c55e; border-radius: 50%; margin-top: 5px; flex-shrink: 0;"></div>`;
                return `
                <div style="padding: 12px 15px; border-bottom: 1px solid #f1f5f9; display: flex; gap: 10px; cursor: pointer; background: ${bg}; transition: 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='${bg}'">
                    <div style="flex: 1;">
                        <div style="font-size: 13px; color: #1e293b; line-height: 1.4; margin-bottom: 4px;">${noti.message}</div>
                        <div style="font-size: 11px; color: #94a3b8;"><i class="fa-regular fa-clock"></i> ${noti.createdAt || 'Vừa xong'}</div>
                    </div>
                    ${dot}
                </div>`;
            }).join("");

        } catch (error) {
            notiList.innerHTML = `<div style="padding: 20px; text-align: center; color: #ef4444; font-size: 13px;">Không thể kết nối đến máy chủ thông báo</div>`;
        }
    }

    async function loadTopbarUser() {
        const nameEl = document.getElementById("dropdown-user-name");
        const emailEl = document.getElementById("dropdown-user-email");
        if (!nameEl) return;

        try {
            const user = await window.MangaApi.apiFetch("/users/profile");
            if (user) {
                nameEl.innerText = user.username || "Mangaka";
                emailEl.innerText = user.email || "Đã kết nối";
                if (btnAvatar && user.username) {
                    btnAvatar.innerText = user.username.substring(0, 2).toUpperCase();
                }
            }
        } catch (e) {
            nameEl.innerText = "Lỗi tải thông tin";
            emailEl.innerText = "Vui lòng đăng nhập lại";
        }
    }

    if (document.getElementById("noti-list")) loadNotifications();
    if (document.getElementById("dropdown-user-name")) loadTopbarUser();

    // ======================================================== 
    // 7. PROFILE PAGE LOGIC (Trang Hồ sơ cá nhân)
    // ======================================================== 
    const formProfile = document.getElementById("form-profile");
    if (formProfile) {
        async function loadProfileData() {
            try {
                const user = await window.MangaApi.apiFetch("/users/profile");
                document.getElementById("profile-name").value = user.username || "";
                document.getElementById("profile-email").value = user.email || "";
                document.getElementById("profile-phone").value = user.phone || "";
                if (user.avatarUrl) {
                    document.getElementById("profile-avatar-preview").src = user.avatarUrl;
                }
            } catch (e) {
                console.error("Lỗi tải profile:", e);
            }
        }
        loadProfileData();

        const avatarInput = document.getElementById("profile-avatar-input");
        const avatarPreview = document.getElementById("profile-avatar-preview");
        if (avatarInput) {
            avatarInput.addEventListener("change", (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (evt) => avatarPreview.src = evt.target.result;
                    reader.readAsDataURL(file);
                }
            });
        }

        const btnSaveProfile = document.getElementById("btn-save-profile");
        btnSaveProfile.addEventListener("click", async (e) => {
            e.preventDefault();
            const username = document.getElementById("profile-name").value.trim();
            const phone = document.getElementById("profile-phone").value.trim();
            const file = avatarInput?.files[0];

            if (!username) return alert("Vui lòng nhập tên hiển thị!");

            const formData = new FormData();
            formData.append("username", username);
            formData.append("phone", phone);
            if (file) formData.append("avatar", file);

            const oldText = btnSaveProfile.innerHTML;
            btnSaveProfile.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';
            btnSaveProfile.disabled = true;

            try {
                await window.MangaApi.apiFetch("/users/profile", {
                    method: "PUT",
                    body: formData
                });
                alert("Cập nhật hồ sơ thành công!");
                window.location.reload();
            } catch (error) {
                alert("Lỗi cập nhật: " + error.message);
            } finally {
                btnSaveProfile.innerHTML = oldText;
                btnSaveProfile.disabled = false;
            }
        });
    }
});