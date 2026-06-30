document.addEventListener("DOMContentLoaded", () => {
    const toBackendTaskStatus = (status = "") => window.MangaApi?.normalizeTaskStatus ? window.MangaApi.normalizeTaskStatus(status) : String(status || "TODO").toUpperCase();
    const taskTitleOf = (task) => task.title || task.description || `Task #${task.id}`;
    const taskAssigneeOf = (task) => task.assignee?.username || task.assistant?.username || task.assistantName || task.assignee || "Unassigned";
    const taskStatusOf = (task) => toBackendTaskStatus(task.status || "TODO");
    
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
                        { id: "task-2", title: "Inking Needed - Ch.42", assignee: "Yui", status: "DOING" }
                    ];
                }

                todoList.innerHTML = "";
                inprogressList.innerHTML = "";
                doneList.innerHTML = "";

                let cTodo = 0, cProg = 0, cDone = 0;

                tasks.forEach(task => {
                    const status = taskStatusOf(task);
                    const card = document.createElement("div");
                    card.className = "kanban-card";
                    card.draggable = true;
                    card.dataset.id = task.id;

                    const isSubmittedLocked = status === "REVIEWING" || status === "APPROVED";
                    card.classList.toggle("submitted-locked-card", isSubmittedLocked);
                    card.draggable = !isSubmittedLocked;

                    card.innerHTML = `
                        <div class="tag">${taskAssigneeOf(task)}</div>
                        <div class="task-title">${taskTitleOf(task)}</div>
                        <div class="assistant-card-actions">
                            <span style="font-size: 11px; color: #6b7280;"><i class="fa-regular fa-clock"></i> ASAP</span>
                            ${isSubmittedLocked
                                ? `<span class="assistant-submitted-lock"><i class="fa-solid fa-lock"></i> ${status === "APPROVED" ? "Approved - Locked" : "Submitted - Waiting Review"}</span>`
                                : `<button type="button" class="assistant-upload-card-btn" data-task-id="${task.id}">
                                    <i class="fa-solid fa-cloud-arrow-up"></i> Open Upload
                                  </button>`}
                        </div>
                    `;

                    function openAssistantUpload() {
                        if (!String(task.id).startsWith("task-")) {
                            localStorage.setItem("currentTaskId", task.id);
                            if (location.pathname.includes("/assistant/")) location.href = "task-detail.html";
                        }
                    }

                    card.addEventListener("click", openAssistantUpload);

                    const uploadCardBtn = card.querySelector(".assistant-upload-card-btn");
                    if (uploadCardBtn) {
                        uploadCardBtn.addEventListener("click", (event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            openAssistantUpload();
                        });
                    }

                    card.addEventListener("dragstart", (e) => {
                        if (isSubmittedLocked) {
                            e.preventDefault();
                            return;
                        }
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
                    } else if (status === "DOING") {
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
            if (taskList.id.includes("inprogress")) colStatus = "DOING";
            if (taskList.id.includes("done") || taskList.id.includes("review")) colStatus = "REVIEWING";

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
                        await window.MangaApi.updateTaskStatus(taskId, colStatus);
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
    // 2. ASSISTANT SUBMIT WORK - upload resource then submit task
    // ======================================================== 
    const fileDropzone = document.getElementById('file-dropzone');
    const btnUploadSubmit = document.getElementById('btn-upload-submit');
    const checkFinalReview = document.getElementById('check-final-review');
    let selectedSubmitFile = null;

    if (fileDropzone) {
        const hiddenInput = document.createElement('input');
        hiddenInput.type = 'file';
        hiddenInput.accept = 'image/*,.png,.jpg,.jpeg,.webp,.psd,.clip';
        hiddenInput.style.display = 'none';
        document.body.appendChild(hiddenInput);

        const chooseWorkFileButton = document.getElementById('btn-choose-work-file');
        const selectedWorkFile = document.getElementById('selected-work-file');
        const topSubmitButton = document.getElementById('btn-submit-work');

        if (chooseWorkFileButton) {
            chooseWorkFileButton.addEventListener('click', () => hiddenInput.click());
        }

        if (topSubmitButton) {
            topSubmitButton.addEventListener('click', () => {
                const submitBox = document.getElementById('submit-work-box') || fileDropzone;
                submitBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
                fileDropzone.classList.add('assistant-upload-pulse');
                setTimeout(() => fileDropzone.classList.remove('assistant-upload-pulse'), 1200);
            });
        }

        function setFile(file) {
            selectedSubmitFile = file || null;
            if (selectedSubmitFile) {
                fileDropzone.innerHTML = `<i class="fa-solid fa-file-circle-check" style="color: #10b981;"></i><p style="color: #10b981;"><b>${selectedSubmitFile.name}</b></p><span>File selected. Tick the confirmation box, then submit to Mangaka.</span>`;
                fileDropzone.style.borderColor = '#10b981';
                fileDropzone.style.background = '#ecfdf5';
                if (selectedWorkFile) {
                    selectedWorkFile.innerHTML = `<i class="fa-solid fa-file-circle-check"></i> Selected: <strong>${selectedSubmitFile.name}</strong>`;
                    selectedWorkFile.classList.add('has-file');
                }
            } else if (selectedWorkFile) {
                selectedWorkFile.innerHTML = `<i class="fa-regular fa-file"></i> No file selected yet`;
                selectedWorkFile.classList.remove('has-file');
            }
            checkReadyState();
        }

        fileDropzone.addEventListener('dragover', (e) => { e.preventDefault(); fileDropzone.style.borderColor = 'var(--primary-color)'; fileDropzone.style.background = 'white'; });
        fileDropzone.addEventListener('dragleave', () => { fileDropzone.style.borderColor = '#d1d5db'; fileDropzone.style.background = '#f9fafb'; });
        fileDropzone.addEventListener('drop', (e) => { e.preventDefault(); setFile(e.dataTransfer?.files?.[0]); });
        fileDropzone.addEventListener('click', () => hiddenInput.click());
        hiddenInput.addEventListener('change', (e) => setFile(e.target.files?.[0]));
        if (checkFinalReview) checkFinalReview.addEventListener('change', checkReadyState);

        function checkReadyState() {
            const ready = !!selectedSubmitFile && (!checkFinalReview || checkFinalReview.checked);
            if (!btnUploadSubmit) return;
            btnUploadSubmit.disabled = !ready;
            btnUploadSubmit.classList.toggle('is-ready', ready);
            btnUploadSubmit.style.background = ready ? '#111827' : '#e5e7eb';
            btnUploadSubmit.style.color = ready ? 'white' : '#9ca3af';
            btnUploadSubmit.style.cursor = ready ? 'pointer' : 'not-allowed';
            if (ready) {
                btnUploadSubmit.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit to Mangaka Now';
            } else if (!selectedSubmitFile) {
                btnUploadSubmit.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Choose a file first';
            } else {
                btnUploadSubmit.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Tick confirmation to submit';
            }
        }

        if (btnUploadSubmit) {
            btnUploadSubmit.addEventListener('click', async () => {
                if (btnUploadSubmit.disabled || !selectedSubmitFile) return;
                const taskId = localStorage.getItem('currentTaskId') || new URLSearchParams(location.search).get('taskId');
                if (!taskId) return alert('No task selected. Open this page from Assignments first.');
                const oldText = btnUploadSubmit.innerHTML;
                btnUploadSubmit.disabled = true;
                btnUploadSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading and notifying Mangaka...';
                try {
                    let imageUrl = '';
                    if (window.MangaApi?.uploadResource) {
                        const resource = await window.MangaApi.uploadResource(selectedSubmitFile, 'ASSISTANT_SUBMISSION');
                        imageUrl = resource.fileUrl || resource.url || resource.imageUrl || resource.secureUrl;
                    }
                    if (!imageUrl) imageUrl = selectedSubmitFile.name;
                    await window.MangaApi.submitTask(taskId, imageUrl);
                    alert('Upload successful. Task moved to Reviewing.');
                    window.location.href = 'assistant-assignments.html';
                } catch (error) {
                    alert('Upload failed: ' + error.message);
                } finally {
                    btnUploadSubmit.disabled = false;
                    btnUploadSubmit.innerHTML = oldText;
                    checkReadyState();
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
                let profileData = {};
                try { profileData = JSON.parse(user.profileData || "{}"); } catch {}
                document.getElementById("profile-phone").value = profileData.phone || user.phoneNumber || "";
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

            const profilePayload = {
                fullName: username,
                profileData: JSON.stringify({ phone })
            };

            const oldText = btnSaveProfile.innerHTML;
            btnSaveProfile.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';
            btnSaveProfile.disabled = true;

            try {
                await window.MangaApi.updateProfile(profilePayload);
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

    // ========================================================
    // 5. MANGAKA SUBMISSION REVIEW PAGE - CHOOSE SUBMISSION TO REVIEW
    // ========================================================
    const reviewPageTitle = document.getElementById('review-chapter-title');
    const draftImgContainer = document.getElementById('draft-img-container');
    const submissionImgWrapper = document.getElementById('assistant-img-wrapper');
    const submissionStatusTag = document.getElementById('submission-status');

    if (reviewPageTitle && draftImgContainer && submissionImgWrapper && window.MangaApi) {
        let selectedReviewTaskId =
            new URLSearchParams(location.search).get('taskId') ||
            localStorage.getItem('currentReviewTaskId') ||
            localStorage.getItem('currentTaskId') ||
            '';

        const getArr = (value) => Array.isArray(value) ? value : (value?.content || []);
        const escReview = (value = '') => String(value ?? '').replace(/[&<>'"]/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[c]));

        const reviewGrid = document.querySelector('.review-grid-3');
        let submissionPicker = document.getElementById('submission-picker-panel');

        if (!submissionPicker && reviewGrid) {
            submissionPicker = document.createElement('div');
            submissionPicker.id = 'submission-picker-panel';
            submissionPicker.className = 'submission-picker-panel';
            reviewGrid.parentNode.insertBefore(submissionPicker, reviewGrid);
        }

        const reviewMode =
            new URLSearchParams(location.search).get('mode') ||
            (location.hash === '#tantou-feedback' ? 'tantou' : 'assistant');

        const reviewHeading = document.querySelector('.review-title h2');
        const submitFeedbackBtn = document.getElementById('btn-submit-feedback');

        function setReviewUrlMode(nextMode) {
            const url = new URL(window.location.href);
            if (nextMode === 'tantou') {
                url.searchParams.set('mode', 'tantou');
                url.hash = '';
            } else {
                url.searchParams.delete('mode');
                url.hash = '';
            }
            window.location.href = url.toString();
        }

        function reviewTabsMarkup(activeMode) {
            return `
                <div class="mangaka-review-tabs">
                    <button type="button" class="mangaka-review-tab ${activeMode === 'assistant' ? 'active' : ''}" data-review-mode="assistant">
                        <i class="fa-solid fa-image"></i>
                        Assistant Submissions
                    </button>
                    <button type="button" class="mangaka-review-tab ${activeMode === 'tantou' ? 'active' : ''}" data-review-mode="tantou">
                        <i class="fa-solid fa-location-dot"></i>
                        Tantou Feedback
                    </button>
                </div>
            `;
        }

        function bindReviewModeTabs(activeMode) {
            document.querySelectorAll('[data-review-mode]').forEach(tab => {
                tab.addEventListener('click', () => {
                    const nextMode = tab.dataset.reviewMode;
                    if (nextMode !== activeMode) setReviewUrlMode(nextMode);
                });
            });

            document.querySelectorAll('[data-mode-link]').forEach(link => {
                link.classList.toggle('active', link.dataset.modeLink === activeMode);
            });
        }

        function renderModeTabs(activeMode) {
            if (submissionPicker) submissionPicker.innerHTML = reviewTabsMarkup(activeMode);
            bindReviewModeTabs(activeMode);
        }

        function feedbackX(f) {
            return Number.parseFloat(f?.xCoord ?? f?.x ?? f?.xPercent ?? 0) || 0;
        }

        function feedbackY(f) {
            return Number.parseFloat(f?.yCoord ?? f?.y ?? f?.yPercent ?? 0) || 0;
        }

        function feedbackW(f) {
            return Number.parseFloat(f?.width ?? f?.w ?? f?.widthPercent ?? 6) || 6;
        }

        function feedbackH(f) {
            return Number.parseFloat(f?.height ?? f?.h ?? f?.heightPercent ?? 5) || 5;
        }

        async function loadMangakaSeriesForFeedback() {
            let series = [];
            try {
                series = getArr(await window.MangaApi.mySeries());
            } catch (error) {
                series = [];
            }

            if (!series.length) {
                try {
                    series = getArr(await window.MangaApi.allSeries());
                } catch (error) {
                    series = [];
                }
            }

            return series;
        }

        async function renderMangakaTantouFeedbackView() {
            renderModeTabs('tantou');

            if (reviewHeading) reviewHeading.textContent = 'Tantou Editor Feedback';
            reviewPageTitle.textContent = 'Review pinned Tantou feedback by page.';

            if (btnApprove) btnApprove.style.display = 'none';
            if (btnRequestRev) btnRequestRev.style.display = 'none';

            if (submitFeedbackBtn) {
                submitFeedbackBtn.style.display = 'inline-flex';
                submitFeedbackBtn.textContent = 'Refresh Tantou Feedback';
                submitFeedbackBtn.disabled = false;
                submitFeedbackBtn.onclick = () => renderMangakaTantouFeedbackView();
            }

            const submissionHeader = document.querySelector('.review-grid-3 .review-col:nth-child(2) .review-col-header span');
            if (submissionHeader) submissionHeader.textContent = 'Feedback Map';
            if (submissionStatusTag) {
                submissionStatusTag.textContent = 'TANTOU';
                submissionStatusTag.style.background = '#eef2ff';
                submissionStatusTag.style.color = '#4f46e5';
            }

            try {
                const series = await loadMangakaSeriesForFeedback();

                if (!series.length) {
                    submissionPicker.insertAdjacentHTML('beforeend', `<div class="empty-state-box">No series found for Mangaka.</div>`);
                    showReviewEmpty('No series found.');
                    return;
                }

                const activeSeriesId = window.MangaApi.getActiveSeriesId?.();
                const selectedSeries = series.find(s => String(s.id) === String(activeSeriesId)) || series[0];
                const seriesId = selectedSeries?.id;
                if (seriesId) window.MangaApi.setActiveSeriesId(seriesId);

                let chapters = seriesId ? getArr(await window.MangaApi.chapters(seriesId).catch(() => [])) : [];
                const activeChapterId = window.MangaApi.getActiveChapterId?.();
                const selectedChapter = chapters.find(c => String(c.id ?? c.chapterId) === String(activeChapterId)) || chapters[0];
                const chapterId = selectedChapter?.id ?? selectedChapter?.chapterId;
                if (chapterId) window.MangaApi.setActiveChapterId(chapterId);

                let pages = chapterId ? getArr(await window.MangaApi.pages(chapterId).catch(() => [])) : [];
                const activePageId = window.MangaApi.getActivePageId?.();
                const selectedPage = pages.find(p => String(p.id ?? p.pageId) === String(activePageId)) || pages[0];
                const pageId = selectedPage?.id ?? selectedPage?.pageId;
                if (pageId) window.MangaApi.setActivePageId(pageId);

                let feedbacks = pageId ? getArr(await window.MangaApi.feedbacks(pageId).catch(() => [])) : [];
                let canvas = null;
                if (pageId) {
                    canvas = await window.MangaApi.canvasInit(pageId).catch(() => ({
                        imageUrl: selectedPage?.imageUrl || selectedPage?.pageImageUrl || ''
                    }));
                }

                submissionPicker.innerHTML += `
                    <div class="mangaka-tantou-controls">
                        <select id="mangaka-feedback-series">${series.map(s => `<option value="${escReview(s.id)}" ${String(s.id) === String(seriesId) ? 'selected' : ''}>${escReview(s.title || s.name || `Series #${s.id}`)}</option>`).join('')}</select>
                        <select id="mangaka-feedback-chapter">${chapters.map(c => {
                            const id = c.id ?? c.chapterId;
                            return `<option value="${escReview(id)}" ${String(id) === String(chapterId) ? 'selected' : ''}>Ch. ${escReview(c.chapterNumber ?? c.number ?? '?')} — ${escReview(c.title || 'Untitled')}</option>`;
                        }).join('') || '<option value="">No chapters</option>'}</select>
                        <select id="mangaka-feedback-page">${pages.map(p => {
                            const id = p.id ?? p.pageId;
                            return `<option value="${escReview(id)}" ${String(id) === String(pageId) ? 'selected' : ''}>Page ${escReview(p.pageNumber ?? p.number ?? id)}</option>`;
                        }).join('') || '<option value="">No pages</option>'}</select>
                    </div>
                `;

                document.getElementById('mangaka-feedback-series')?.addEventListener('change', (event) => {
                    window.MangaApi.setActiveSeriesId(event.target.value);
                    localStorage.removeItem('activeChapterId');
                    localStorage.removeItem('activePageId');
                    renderMangakaTantouFeedbackView();
                });

                document.getElementById('mangaka-feedback-chapter')?.addEventListener('change', (event) => {
                    window.MangaApi.setActiveChapterId(event.target.value);
                    localStorage.removeItem('activePageId');
                    renderMangakaTantouFeedbackView();
                });

                document.getElementById('mangaka-feedback-page')?.addEventListener('change', (event) => {
                    window.MangaApi.setActivePageId(event.target.value);
                    renderMangakaTantouFeedbackView();
                });

                const imageUrl = canvas?.imageUrl || selectedPage?.imageUrl || selectedPage?.pageImageUrl || '';

                draftImgContainer.innerHTML = imageUrl
                    ? `<div class="mangaka-tantou-image-wrap">
                        <img src="${escReview(imageUrl)}" class="review-main-img" alt="Tantou feedback reference page">
                        ${feedbacks.map((f, i) => `
                            <button type="button" class="mangaka-tantou-pin ${f.isResolved ? 'resolved' : ''}" data-feedback-id="${escReview(f.id || i)}" style="left:${feedbackX(f)}%;top:${feedbackY(f)}%;width:${feedbackW(f)}%;height:${feedbackH(f)}%;">
                                <span>${i + 1}</span>
                            </button>
                        `).join('')}
                      </div>`
                    : `<div class="empty-state-box">No page image found for this page.</div>`;

                submissionImgWrapper.innerHTML = `
                    <div class="mangaka-tantou-summary">
                        <h3>${feedbacks.length} Tantou feedback item${feedbacks.length === 1 ? '' : 's'}</h3>
                        <p>Red boxes are open feedback. Green boxes are resolved.</p>
                        <div class="mangaka-tantou-counts">
                            <span><b>${feedbacks.filter(f => !f.isResolved).length}</b> Open</span>
                            <span><b>${feedbacks.filter(f => f.isResolved).length}</b> Resolved</span>
                        </div>
                    </div>
                `;

                const chatBox = document.getElementById('chat-box');
                const chatCountBadge = document.getElementById('chat-count-badge');

                if (chatCountBadge) chatCountBadge.textContent = String(feedbacks.length);

                if (chatBox) {
                    chatBox.innerHTML = feedbacks.length ? feedbacks.map((f, i) => `
                        <div class="chat-msg mangaka-tantou-feedback-msg" data-feedback-id="${escReview(f.id || i)}">
                            <div class="chat-avatar">TE</div>
                            <div class="chat-msg-body">
                                <div class="chat-name">
                                    <span>Tantou Editor #${i + 1}</span>
                                    <span class="chat-time">${f.isResolved ? 'Resolved' : 'Open'}</span>
                                </div>
                                <div class="chat-bubble">${escReview(f.content || 'No feedback text.')}</div>
                                <div class="mangaka-feedback-meta">X ${feedbackX(f).toFixed(1)}% · Y ${feedbackY(f).toFixed(1)}% · W ${feedbackW(f).toFixed(1)}% · H ${feedbackH(f).toFixed(1)}%</div>
                            </div>
                        </div>
                    `).join('') : `<div class="empty-state-box">No Tantou feedback found for this page.</div>`;
                }

                document.querySelectorAll('.mangaka-tantou-pin').forEach(pin => {
                    pin.addEventListener('click', () => {
                        const card = document.querySelector(`.mangaka-tantou-feedback-msg[data-feedback-id="${pin.dataset.feedbackId}"]`);
                        card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        card?.classList.add('highlight');
                        setTimeout(() => card?.classList.remove('highlight'), 1200);
                    });
                });
            } catch (error) {
                reviewPageTitle.textContent = 'Could not load Tantou feedback.';
                showReviewEmpty(error.message);
            }
        }

        if (reviewMode === 'tantou') {
            bindReviewModeTabs('tantou');
            renderMangakaTantouFeedbackView();
            return;
        }

        bindReviewModeTabs('assistant');
        renderModeTabs('assistant');

        function normalizeReviewStatus(task) {
            return window.MangaApi?.normalizeTaskStatus
                ? window.MangaApi.normalizeTaskStatus(task?.status || 'REVIEWING')
                : String(task?.status || 'REVIEWING').toUpperCase();
        }

        function referenceImageOf(task) {
            return task?.referenceImageUrl ||
                task?.pageImageUrl ||
                task?.hitbox?.page?.imageUrl ||
                task?.hitbox?.pageImageUrl ||
                '';
        }

        function submittedImageOf(task) {
            return task?.submittedImageUrl ||
                task?.submissionUrl ||
                task?.submittedUrl ||
                task?.imageUrl ||
                '';
        }

        function taskIdOf(task) {
            return task?.id ?? task?.taskId;
        }

        function taskTitleOfReview(task) {
            return task?.title || task?.description || `Task #${taskIdOf(task)}`;
        }

        function isReviewableTask(task) {
            const status = normalizeReviewStatus(task);
            return status === 'REVIEWING';
        }

        async function resolveReferenceImageForReview(task) {
            let imageUrl = referenceImageOf(task);
            const pageId = task?.pageId || task?.hitbox?.pageId || task?.hitbox?.page?.id;

            if (!imageUrl && pageId && window.MangaApi?.canvasInit) {
                try {
                    const canvas = await window.MangaApi.canvasInit(pageId);
                    imageUrl = canvas?.imageUrl || '';
                } catch (error) {
                    console.warn('Could not load reference image:', error.message);
                }
            }

            return imageUrl;
        }

        function showReviewEmpty(message) {
            draftImgContainer.innerHTML = `<div class="empty-state-box">${escReview(message)}</div>`;
            submissionImgWrapper.innerHTML = `<div class="empty-state-box">${escReview(message)}</div>`;

            if (submissionStatusTag) {
                submissionStatusTag.textContent = 'Waiting';
                submissionStatusTag.style.background = '#f3f4f6';
                submissionStatusTag.style.color = '#4b5563';
            }

            if (btnApprove) btnApprove.style.display = 'none';
            if (btnRequestRev) btnRequestRev.style.display = 'none';
        }

        function setSelectedTask(taskId) {
            selectedReviewTaskId = taskId ? String(taskId) : '';
            if (selectedReviewTaskId) {
                localStorage.setItem('currentReviewTaskId', selectedReviewTaskId);
                localStorage.setItem('currentTaskId', selectedReviewTaskId);
                const url = new URL(window.location.href);
                url.searchParams.set('taskId', selectedReviewTaskId);
                window.history.replaceState(null, '', url.toString());
            } else {
                localStorage.removeItem('currentReviewTaskId');
                const url = new URL(window.location.href);
                url.searchParams.delete('taskId');
                window.history.replaceState(null, '', url.toString());
            }
        }

        function renderSubmissionPicker(reviewableTasks) {
            if (!submissionPicker) return;

            if (!reviewableTasks.length) {
                submissionPicker.innerHTML = reviewTabsMarkup('assistant') + `
                    <div class="submission-picker-header">
                        <div>
                            <span class="eyebrow">Choose a submission</span>
                            <h3>No submitted tasks waiting for review</h3>
                        </div>
                        <a class="btn-outline" href="dashboard.html#kanban"><i class="fa-solid fa-table-columns"></i> Back to Kanban</a>
                    </div>
                    <div class="empty-state-box">Assistant submissions will appear here after they upload work and the task moves to REVIEWING.</div>
                `;
                return;
            }

            submissionPicker.innerHTML = reviewTabsMarkup('assistant') + `
                <div class="submission-picker-header">
                    <div>
                        <span class="eyebrow">Choose a submission to review</span>
                        <h3>${reviewableTasks.length} submission${reviewableTasks.length > 1 ? 's' : ''} available</h3>
                    </div>
                    <a class="btn-outline" href="dashboard.html#kanban"><i class="fa-solid fa-table-columns"></i> Back to Kanban</a>
                </div>
                <div class="submission-picker-list">
                    ${reviewableTasks.map(task => {
                        const id = taskIdOf(task);
                        const status = normalizeReviewStatus(task);
                        const thumb = submittedImageOf(task);
                        const active = String(id) === String(selectedReviewTaskId);
                        return `
                            <button type="button" class="submission-picker-card ${active ? 'active' : ''}" data-task-id="${escReview(id)}">
                                <div class="submission-thumb">
                                    ${thumb ? `<img src="${escReview(thumb)}" alt="Submission thumbnail">` : `<i class="fa-solid fa-image"></i>`}
                                </div>
                                <div class="submission-info">
                                    <strong>${escReview(taskTitleOfReview(task))}</strong>
                                    <span>${escReview(task.seriesTitle || 'Manga Series')} · ${escReview(task.chapterNumber ? `Chapter ${task.chapterNumber}` : 'Task Review')}</span>
                                    <small>Task #${escReview(id)} · ${escReview(task.assistantName || 'Assistant')} · ${escReview(status)}</small>
                                </div>
                                <span class="submission-select-label">${active ? 'Selected' : 'Review'}</span>
                            </button>
                        `;
                    }).join('')}
                </div>
            `;

            submissionPicker.querySelectorAll('.submission-picker-card').forEach(card => {
                card.addEventListener('click', async () => {
                    setSelectedTask(card.dataset.taskId);
                    await loadReviewTask();
                });
            });

            bindReviewModeTabs('assistant');
        }

        async function loadAllReviewTasks() {
            const tasks = getArr(await window.MangaApi.tasks());
            return tasks.filter(isReviewableTask);
        }

        async function loadReviewTask() {
            try {
                const reviewableTasks = await loadAllReviewTasks();

                if (!selectedReviewTaskId && reviewableTasks.length === 1) {
                    setSelectedTask(taskIdOf(reviewableTasks[0]));
                }

                renderSubmissionPicker(reviewableTasks);

                if (!selectedReviewTaskId) {
                    reviewPageTitle.textContent = 'Select a submission to review...';
                    showReviewEmpty('Choose one of the submitted tasks above.');
                    loadedReviewTask = null;
                    return null;
                }

                const task = reviewableTasks.find(t => String(taskIdOf(t)) === String(selectedReviewTaskId));

                if (!task) {
                    reviewPageTitle.textContent = `Task #${selectedReviewTaskId} is no longer in REVIEWING status.`;
                    showReviewEmpty('Choose another submitted task above, or return to Kanban.');
                    loadedReviewTask = null;
                    return null;
                }

                const status = normalizeReviewStatus(task);
                const referenceUrl = await resolveReferenceImageForReview(task);
                const submittedUrl = submittedImageOf(task);

                reviewPageTitle.innerHTML = `${escReview(task.seriesTitle || 'Assistant Submission')} &rsaquo; ${escReview(task.chapterNumber ? `Chapter ${task.chapterNumber}` : 'Task Review')} &rsaquo; Task #${escReview(taskIdOf(task))}`;

                if (submissionStatusTag) {
                    submissionStatusTag.textContent = status;
                    submissionStatusTag.style.background = status === 'APPROVED' ? '#dcfce7' : '#fef3c7';
                    submissionStatusTag.style.color = status === 'APPROVED' ? '#166534' : '#92400e';
                }

                draftImgContainer.innerHTML = referenceUrl
                    ? `<img src="${escReview(referenceUrl)}" class="review-main-img" alt="Original draft">`
                    : `<div class="empty-state-box">No original draft image found.</div>`;

                submissionImgWrapper.innerHTML = submittedUrl
                    ? `<img src="${escReview(submittedUrl)}" class="review-main-img" alt="Assistant submitted image">`
                    : `<div class="empty-state-box">No submitted image found for this task.</div>`;

                const chatBox = document.getElementById('chat-box');
                const chatCountBadge = document.getElementById('chat-count-badge');
                if (chatBox) {
                    chatBox.dataset.loadedTaskNote = String(taskIdOf(task));
                    chatBox.innerHTML = `
                        <div class="chat-msg" style="margin-top: 10px;">
                            <div class="chat-avatar">MG</div>
                            <div class="chat-msg-body">
                                <div class="chat-name"><span>Task Request</span><span class="chat-time">Loaded</span></div>
                                <div class="chat-bubble">${escReview(task.description || 'No task description.')}</div>
                            </div>
                        </div>
                    `;
                    if (chatCountBadge) chatCountBadge.textContent = '1';
                }

                if (btnApprove) {
                    btnApprove.style.display = status === 'APPROVED' ? 'none' : 'inline-flex';
                    btnApprove.disabled = false;
                    btnApprove.innerHTML = '<i class="fa-solid fa-check"></i> Approve';
                }

                if (btnRequestRev) {
                    btnRequestRev.style.display = status === 'APPROVED' ? 'none' : 'inline-flex';
                    btnRequestRev.disabled = false;
                    btnRequestRev.innerHTML = '<i class="fa-solid fa-xmark"></i> Request Revision';
                }

                const submitFeedbackBtn = document.getElementById('btn-submit-feedback');
                if (submitFeedbackBtn) {
                    submitFeedbackBtn.style.display = 'none';
                    submitFeedbackBtn.disabled = true;
                }

                loadedReviewTask = task;
                return task;
            } catch (error) {
                reviewPageTitle.textContent = 'Could not load submissions.';
                showReviewEmpty(error.message);
                loadedReviewTask = null;
                return null;
            }
        }

        let loadedReviewTask = null;
        loadReviewTask();

        async function afterDecision(message, isRevision = false) {
            showToast(message, isRevision);
            setSelectedTask('');
            await loadReviewTask();
        }

        if (btnApprove) {
            btnApprove.addEventListener('click', async (event) => {
                if (!loadedReviewTask) return;
                event.preventDefault();
                event.stopImmediatePropagation();

                const taskId = taskIdOf(loadedReviewTask);
                try {
                    btnApprove.disabled = true;
                    btnApprove.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Approving...';
                    await window.MangaApi.updateTaskStatus(taskId, 'APPROVED');
                    await afterDecision('Submission approved. Choose another submission to review.', false);
                } catch (error) {
                    btnApprove.disabled = false;
                    btnApprove.innerHTML = '<i class="fa-solid fa-check"></i> Approve';
                    alert('Approve failed: ' + error.message);
                }
            }, true);
        }

        if (btnRequestRev) {
            btnRequestRev.addEventListener('click', async (event) => {
                if (!loadedReviewTask) return;
                event.preventDefault();
                event.stopImmediatePropagation();

                const taskId = taskIdOf(loadedReviewTask);
                try {
                    btnRequestRev.disabled = true;
                    btnRequestRev.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';
                    await window.MangaApi.updateTaskStatus(taskId, 'DOING');
                    await afterDecision('Revision requested. Choose another submission to review.', true);
                } catch (error) {
                    btnRequestRev.disabled = false;
                    btnRequestRev.innerHTML = '<i class="fa-solid fa-xmark"></i> Request Revision';
                    alert('Request revision failed: ' + error.message);
                }
            }, true);
        }
    }


});