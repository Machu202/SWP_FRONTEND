document.addEventListener("DOMContentLoaded", () => {
    
    // ======================================================== 
    // 1. KANBAN BOARD (Trang Assignments)               
    // ======================================================== 
    const draggables = document.querySelectorAll(".kanban-card");
    const taskLists = document.querySelectorAll(".kanban-task-list");
    if(draggables.length > 0 && taskLists.length > 0) {
        draggables.forEach(d => {
            d.addEventListener("dragstart", () => d.classList.add("dragging"));
            d.addEventListener("dragend", () => d.classList.remove("dragging"));
        });
        taskLists.forEach(list => {
            list.addEventListener("dragover", e => {
                e.preventDefault();
                const dragging = document.querySelector(".dragging");
                if(dragging) list.appendChild(dragging);
            });
        });
    }

    // ======================================================== 
    // 2. TÍNH NĂNG NÚT APPROVE & REQUEST REVISION (Trang Review)               
    // ======================================================== 
    const btnApprove = document.getElementById('btn-approve');
    const btnRequestRev = document.getElementById('btn-request-rev');
    const statusTagReview = document.querySelector('.review-col .status-tag.review');
    const toast = document.getElementById('toast-msg');

    function showToast(message, isError = false) {
        if (!toast) return;
        toast.innerHTML = isError ? `<i class="fa-solid fa-circle-exclamation"></i> ${message}` : `<i class="fa-solid fa-circle-check"></i> ${message}`;
        toast.style.background = isError ? '#ef4444' : '#10b981';
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    if (btnApprove) {
        btnApprove.addEventListener('click', () => {
            // Đổi giao diện nút Approve
            btnApprove.style.background = '#10b981'; // Màu xanh lá
            btnApprove.innerHTML = '<i class="fa-solid fa-check-double"></i> Approved';
            
            // Reset lại nút Request Revision nếu trước đó lỡ bấm
            if (btnRequestRev) {
                btnRequestRev.style.background = 'white';
                btnRequestRev.style.color = '#111827';
                btnRequestRev.innerHTML = '<i class="fa-solid fa-xmark"></i> Request Revision';
            }

            // Đổi tag trạng thái trên ảnh
            if (statusTagReview) {
                statusTagReview.innerText = 'Approved';
                statusTagReview.style.background = '#dcfce7';
                statusTagReview.style.color = '#166534';
            }

            showToast("Submission Approved! Ready for Editor.");
        });
    }

    if (btnRequestRev) {
        btnRequestRev.addEventListener('click', () => {
            // Đổi giao diện nút Request Revision
            btnRequestRev.style.background = '#ef4444'; // Màu đỏ
            btnRequestRev.style.color = 'white';
            btnRequestRev.innerHTML = '<i class="fa-solid fa-rotate-left"></i> Revision Requested';
            
            // Reset lại nút Approve nếu trước đó lỡ bấm
            if (btnApprove) {
                btnApprove.style.background = '#111827';
                btnApprove.innerHTML = '<i class="fa-solid fa-check"></i> Approve';
            }

            // Đổi tag trạng thái trên ảnh
            if (statusTagReview) {
                statusTagReview.innerText = 'Revision Needed';
                statusTagReview.style.background = '#fee2e2';
                statusTagReview.style.color = '#991b1b';
            }

            showToast("Revision requested. Assistant notified.", true);
        });
    }


    // ======================================================== 
    // 3. CHAT FEEDBACK VÀ ĐIỂM CHẤM ĐỎ TƯƠNG TÁC (TỌA ĐỘ ERD)               
    // ======================================================== 
    const chatInput = document.getElementById('chat-input');
    const btnSendChat = document.getElementById('btn-send-chat');
    const chatBox = document.getElementById('chat-box');
    const assistantImgWrapper = document.getElementById('assistant-img-wrapper');
    const chatCountBadge = document.getElementById('chat-count-badge');
    
    let annotationCounter = 1; 
    let selectedAnnotationNum = null;

    if (assistantImgWrapper) {
        assistantImgWrapper.addEventListener('click', function(e) {
            if (e.target.classList.contains('annotation-dot')) return;

            const rect = assistantImgWrapper.getBoundingClientRect();
            const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
            const yPercent = ((e.clientY - rect.top) / rect.height) * 100;

            annotationCounter++;
            selectedAnnotationNum = annotationCounter;

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
        selectedAnnotationNum = null;
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
    // 4. DROPZONE UPLOAD UI (mock-safe, backend-ready placeholder)               
    // ======================================================== 
    const fileDropzone = document.getElementById('file-dropzone');
    const btnUploadSubmit = document.getElementById('btn-upload-submit');

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
            fileDropzone.innerHTML = `<i class="fa-solid fa-file-circle-check" style="color: #10b981;"></i><p style="color: #10b981;">File attached successfully</p><span>Ready to upload</span>`;
            fileDropzone.style.borderColor = '#10b981';
            if (btnUploadSubmit) {
                btnUploadSubmit.style.background = '#111827';
                btnUploadSubmit.style.color = 'white';
                btnUploadSubmit.style.cursor = 'pointer';
            }
        });
    }

    // ======================================================== 
    // 5. EDITOR ENGINE (Trang Page Editor)               
    // ======================================================== 
    const canvas = document.getElementById('manga-canvas');
    if (!canvas) return; 

    const canvasView = document.getElementById('canvas-view');
    const toolSelect = document.getElementById('tool-select');
    const toolDraw = document.getElementById('tool-draw');
    const toolBrush = document.getElementById('tool-brush'); 
    const taskModal = document.getElementById('task-modal');
    const btnConfirm = document.getElementById('btn-confirm-task');
    const inputTaskName = document.getElementById('task-name-input');
    const selectAssignee = document.getElementById('task-assignee-select'); 
    const freehandLayer = document.getElementById('freehand-layer');
    const ctx = freehandLayer.getContext('2d');
    
    if(ctx) {
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#111827'; 
    }

    let currentTool = 'select'; 
    let isDrawingHitbox = false;
    let isDragging = false;
    let isResizing = false;
    let isFreehanding = false; 

    let startX, startY;
    let activeElement = null;
    let tempBox = null;

    let pagesData = {}; 
    let currentPageId = 'page-1'; 
    let pageCount = 1;
    pagesData['page-1'] = { id: 'page-1', name: 'Page 01', hitboxes: '', drawing: null };

    const pageListContainer = document.getElementById('page-list-container');
    function renderPagesList() {
        if(!pageListContainer) return;
        pageListContainer.innerHTML = '';
        Object.values(pagesData).forEach(page => {
            const isActive = page.id === currentPageId ? 'active' : '';
            pageListContainer.innerHTML += `
                <div class="layer-item page-item ${isActive}" data-id="${page.id}">
                    <i class="fa-regular fa-file-lines" style="color: #9ca3af; margin-right: 12px;"></i>
                    <span class="layer-name">${page.name}</span>
                </div>
            `;
        });
    }

    function saveCurrentPage() {
        const hitboxes = Array.from(canvas.querySelectorAll('.editor-hitbox')).map(el => el.outerHTML).join('');
        const drawing = freehandLayer.toDataURL();
        if (pagesData[currentPageId]) {
            pagesData[currentPageId].hitboxes = hitboxes;
            pagesData[currentPageId].drawing = drawing;
        }
    }

    function loadPage(pageId) {
        canvas.querySelectorAll('.editor-hitbox').forEach(el => el.remove());
        ctx.clearRect(0, 0, freehandLayer.width, freehandLayer.height);

        const data = pagesData[pageId];
        if(data) {
            canvas.insertAdjacentHTML('beforeend', data.hitboxes);
            if(data.drawing) {
                const img = new Image();
                img.src = data.drawing;
                img.onload = () => { ctx.drawImage(img, 0, 0); };
            }
        }
        currentPageId = pageId;
        renderPagesList(); 
    }

    renderPagesList();

    if (pageListContainer) {
        pageListContainer.addEventListener('click', (e) => {
            const pageItem = e.target.closest('.page-item');
            if(pageItem) {
                const clickedId = pageItem.dataset.id;
                if(clickedId === currentPageId) return;

                saveCurrentPage();
                loadPage(clickedId);
                toolSelect.click();
            }
        });
    }
    
    const btnAddPage = document.getElementById('btn-add-page');
    if (btnAddPage) {
        btnAddPage.onclick = () => {
            const pageName = prompt("Nhập tên cho trang mới (VD: Page 02):");
            if(pageName) {
                saveCurrentPage();
                pageCount++;
                const newId = 'page-' + pageCount;
                pagesData[newId] = { id: newId, name: pageName, hitboxes: '', drawing: null };
                loadPage(newId);
                toolSelect.click();
            }
        };
    }

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

            if(target === 'draft') {
                freehandLayer.style.display = isHidden ? 'block' : 'none';
            } 
            else if (target === 'hitbox') {
                const boxes = document.querySelectorAll('.editor-hitbox');
                boxes.forEach(b => b.style.display = isHidden ? 'block' : 'none');
            } 
            else if (target === 'grid') {
                document.getElementById('grid-guide-layer').style.display = isHidden ? 'block' : 'none';
            }
        });
    });

    function resetTools() {
        [toolSelect, toolDraw, toolBrush].forEach(t => t.classList.remove('active'));
        freehandLayer.style.pointerEvents = 'none'; 
    }

    toolSelect.onclick = () => {
        resetTools(); currentTool = 'select'; toolSelect.classList.add('active'); canvasView.style.cursor = 'default';
    };

    toolDraw.onclick = () => {
        resetTools(); currentTool = 'draw'; toolDraw.classList.add('active'); canvasView.style.cursor = 'crosshair';
    };

    toolBrush.onclick = () => {
        resetTools(); currentTool = 'brush'; toolBrush.classList.add('active'); canvasView.style.cursor = 'crosshair';
        freehandLayer.style.pointerEvents = 'auto'; 
    };

    canvas.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.hitbox-delete');
        if (deleteBtn) {
            deleteBtn.closest('.editor-hitbox').remove();
            saveCurrentPage(); 
        }
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
        } 
        else if (currentTool === 'select') {
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

    freehandLayer.onmousedown = (e) => {
        if(currentTool === 'brush') {
            isFreehanding = true;
            const rect = freehandLayer.getBoundingClientRect();
            ctx.beginPath();
            ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
        }
    };

    window.onmousemove = (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

        if (isDrawingHitbox && tempBox) {
            tempBox.style.left = Math.min(x, startX) + 'px'; tempBox.style.top = Math.min(y, startY) + 'px';
            tempBox.style.width = Math.abs(x - startX) + 'px'; tempBox.style.height = Math.abs(y - startY) + 'px';
        } 
        else if (isDragging && activeElement) {
            activeElement.style.left = (x - startX) + 'px'; activeElement.style.top = (y - startY) + 'px';
        } 
        else if (isResizing && activeElement) {
            activeElement.style.width = Math.max(20, x - activeElement.offsetLeft) + 'px';
            activeElement.style.height = Math.max(20, y - activeElement.offsetTop) + 'px';
        }
        else if (isFreehanding) {
            ctx.lineTo(x, y); ctx.stroke();
        }
    };

    window.onmouseup = () => {
        if (isDrawingHitbox && tempBox) {
            inputTaskName.value = ''; 
            selectAssignee.value = 'Unassigned'; 
            taskModal.style.display = 'flex'; 
        }
        isDrawingHitbox = false; isDragging = false; isResizing = false; isFreehanding = false;
    };

    if(btnConfirm) {
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
            tempBox.remove(); tempBox = null; taskModal.style.display = 'none';
            saveCurrentPage(); 
            toolSelect.click(); 
        };
    }

    const btnSavePage = document.getElementById('save-page');
    if (btnSavePage) {
        btnSavePage.onclick = () => {
            saveCurrentPage(); 
            console.log("Mock Database:", pagesData);
            showToast("Changes saved to server!");
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
});