import { useEffect, useMemo, useRef, useState } from "react";
import { api, extractMediaUrl, hasRole, mediaUrlFrom, normalizeTaskStatus, resolveMediaUrl } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Alert, EmptyState, LoadingBlock, StatusBadge } from "../components/Status";
import { navigate, useHashRoute } from "../utils/router";
import CoordinateImageOverlay from "../components/CoordinateImageOverlay";
import ImageComparisonModal from "../components/ImageComparisonModal";

const COLUMNS = [
  { key: "TODO", label: "Todo" },
  { key: "DOING", label: "Doing" },
  { key: "REVIEWING", label: "Reviewing" },
  { key: "APPROVED", label: "Approved" }
];

function tabFromRoute(route) {
  const value = String(route.params.get("tab") || "kanban").toLowerCase();
  return value === "assignments" ? "assignments" : "kanban";
}

function toFiniteNumber(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return 0;
}

function positiveFiniteNumber(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
  }
  return 0;
}

function boxValue(source, ...keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (value === undefined || value === null || value === "") continue;
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return 0;
}

function overlayPercentBox(box, coordinateWidth, coordinateHeight) {
  const x = boxValue(box, "xCoord", "x_coord", "x");
  const y = boxValue(box, "yCoord", "y_coord", "y");
  const width = boxValue(box, "width", "w");
  const height = boxValue(box, "height", "h");
  const hasBox = Boolean(box) && width > 0 && height > 0;
  if (!hasBox || coordinateWidth <= 0 || coordinateHeight <= 0) return null;

  const unitBox = x >= 0 && y >= 0 && width > 0 && height > 0 && x <= 1 && y <= 1 && width <= 1 && height <= 1;
  const rawLeft = unitBox ? x * 100 : (x / coordinateWidth) * 100;
  const rawTop = unitBox ? y * 100 : (y / coordinateHeight) * 100;
  const rawWidth = unitBox ? width * 100 : (width / coordinateWidth) * 100;
  const rawHeight = unitBox ? height * 100 : (height / coordinateHeight) * 100;
  const left = Math.max(0, Math.min(100, rawLeft));
  const top = Math.max(0, Math.min(100, rawTop));
  return {
    left,
    top,
    width: Math.max(0.5, Math.min(100 - left, rawWidth)),
    height: Math.max(0.5, Math.min(100 - top, rawHeight))
  };
}

function normalizeHitbox(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = raw.id ?? raw.hitboxId ?? raw.hitbox_id ?? null;
  const xCoord = toFiniteNumber(raw.xCoord, raw.x_coord, raw.x, raw.left);
  const yCoord = toFiniteNumber(raw.yCoord, raw.y_coord, raw.y, raw.top);
  const width = toFiniteNumber(raw.width, raw.w);
  const height = toFiniteNumber(raw.height, raw.h);
  if (width <= 0 || height <= 0) return null;
  return { ...raw, id, xCoord, yCoord, width, height };
}

function taskHitboxId(task) {
  return task?.hitboxId ?? task?.hitbox_id ?? task?.hitbox?.id ?? task?.hitboxDto?.id ?? null;
}

function taskPageId(task) {
  return task?.pageId ?? task?.page_id ?? task?.page?.id ?? task?.hitbox?.pageId ?? task?.hitbox?.page_id ?? null;
}

function taskChapterId(task) {
  return firstValue(
    task?.chapterId,
    task?.chapter_id,
    task?.chapter?.id,
    task?.page?.chapterId,
    task?.page?.chapter_id,
    task?.page?.chapter?.id,
    task?.hitbox?.page?.chapterId,
    task?.hitbox?.page?.chapter_id,
    task?.hitbox?.page?.chapter?.id,
    task?.hitboxDto?.page?.chapterId,
    task?.hitboxDto?.page?.chapter_id
  );
}

function taskSubmittedUrl(task) {
  return mediaUrlFrom(
    task?.submittedImageUrl,
    task?.submitted_image_url,
    task?.submissionUrl,
    task?.submission_url,
    task?.submittedWorkUrl,
    task?.submitted_work_url
  );
}

function taskReferenceUrl(task) {
  // Never pass the whole task object first: extractMediaUrl would prefer the
  // Assistant's submitted image and accidentally replace the reference page.
  return mediaUrlFrom(
    task?.referenceImageUrl,
    task?.reference_image_url,
    task?.pageImageUrl,
    task?.page_image_url,
    task?.page?.imageUrl,
    task?.page?.image_url,
    task?.hitbox?.pageImageUrl,
    task?.hitbox?.page_image_url,
    task?.hitbox?.page?.imageUrl,
    task?.hitbox?.page?.image_url,
    task?.hitboxDto?.pageImageUrl,
    task?.hitboxDto?.page_image_url,
    task?.hitboxDto?.page?.imageUrl,
    task?.hitboxDto?.page?.image_url
  );
}


function firstValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return "";
}

function displayName(user) {
  if (!user || typeof user !== "object") return "";
  return firstValue(user.fullName, user.full_name, user.username, user.email, user.name);
}

function taskAssistantId(task) {
  return firstValue(
    task?.assistantId,
    task?.assistant_id,
    task?.assistant?.id,
    task?.assignedAssistant?.id,
    task?.assigned_assistant?.id,
    task?.assistantDto?.id
  );
}

function taskAssistantName(task) {
  return firstValue(
    task?.assistantName,
    task?.assistant_name,
    task?.assistantUsername,
    task?.assistant_username,
    task?.assistantEmail,
    task?.assistant_email,
    displayName(task?.assistant),
    displayName(task?.assignedAssistant),
    displayName(task?.assigned_assistant),
    displayName(task?.assistantDto)
  );
}

function taskPageNumber(task) {
  return firstValue(
    task?.pageNumber,
    task?.page_number,
    task?.page?.pageNumber,
    task?.page?.page_number,
    task?.hitbox?.pageNumber,
    task?.hitbox?.page_number,
    task?.hitbox?.page?.pageNumber,
    task?.hitbox?.page?.page_number
  );
}

function taskPageWidth(task) {
  return firstValue(task?.pageWidth, task?.page_width, task?.page?.width, task?.hitbox?.pageWidth, task?.hitbox?.page_width, task?.hitboxDto?.pageWidth, task?.hitboxDto?.page_width);
}

function taskPageHeight(task) {
  return firstValue(task?.pageHeight, task?.page_height, task?.page?.height, task?.hitbox?.pageHeight, task?.hitbox?.page_height, task?.hitboxDto?.pageHeight, task?.hitboxDto?.page_height);
}

function taskSeriesTitle(task) {
  return firstValue(
    task?.seriesTitle,
    task?.series_title,
    task?.mangaTitle,
    task?.manga_title,
    task?.series?.title,
    task?.mangaSeries?.title,
    task?.manga_series?.title,
    task?.chapter?.seriesTitle,
    task?.chapter?.series_title,
    task?.hitbox?.page?.chapter?.mangaSeries?.title,
    task?.hitbox?.page?.chapter?.manga_series?.title
  );
}

function taskDisplayNumber(task) {
  return firstValue(
    task?.taskNumber,
    task?.task_number,
    task?.seriesTaskNumber,
    task?.series_task_number,
    task?.displayNumber,
    task?.display_number,
    task?.id
  );
}

function taskChapterLabel(task) {
  const title = firstValue(task?.chapterTitle, task?.chapter_title, task?.chapter?.title, task?.hitbox?.page?.chapter?.title);
  const number = firstValue(task?.chapterNumber, task?.chapter_number, task?.chapter?.chapterNumber, task?.chapter?.chapter_number, task?.hitbox?.page?.chapter?.chapterNumber, task?.hitbox?.page?.chapter?.chapter_number);
  if (title && number) return `Chapter ${number}: ${title}`;
  if (title) return title;
  if (number) return `Chapter ${number}`;
  return "-";
}

function normalizeTaskRecord(task) {
  if (!task || typeof task !== "object") return task;
  const assistantId = taskAssistantId(task);
  const assistantName = taskAssistantName(task);
  const pageNumber = taskPageNumber(task);
  const seriesTitle = taskSeriesTitle(task);
  const chapterId = taskChapterId(task);
  const chapterLabel = taskChapterLabel(task);
  return {
    ...task,
    assistantId: assistantId || task.assistantId,
    assistantName: assistantName || task.assistantName,
    chapterId: chapterId || task.chapterId,
    pageNumber: pageNumber || task.pageNumber,
    seriesTitle: seriesTitle || task.seriesTitle,
    chapterDisplay: chapterLabel
  };
}

function normalizeTaskList(payload) {
  const tasks = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.content)
      ? payload.content
      : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.items)
          ? payload.items
          : [];
  return tasks.map(normalizeTaskRecord);
}

function directTaskHitbox(task) {
  return normalizeHitbox(task?.hitbox || task?.hitboxDto || task);
}

function taskWorkflowStatus(task) {
  return normalizeTaskStatus(task?.status);
}

function isTaskFinalApproved(task) {
  return taskWorkflowStatus(task) === "APPROVED";
}

function isTaskLockedForAssistant(task) {
  const status = taskWorkflowStatus(task);
  return status === "REVIEWING" || status === "APPROVED";
}

function allowedKanbanTargets(task, role) {
  if (!hasRole(role, ["mangaka"])) return [];
  const status = taskWorkflowStatus(task);
  if (status === "TODO") return ["DOING"];
  if (status === "DOING" && taskSubmittedUrl(task)) return ["REVIEWING"];
  return [];
}

export default function TasksPage() {
  const route = useHashRoute();
  const requestedTab = tabFromRoute(route);
  const { profile, session } = useAuth();
  const role = profile?.roleName || session.role;
  const [tasks, setTasks] = useState([]);
  const [assistants, setAssistants] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedHitbox, setSelectedHitbox] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [confirmReady, setConfirmReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hitboxLoading, setHitboxLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const isAssistant = hasRole(role, ["assistant"]);
  const isMangaka = hasRole(role, ["mangaka"]);
  const isTantou = hasRole(role, ["tantou"]);
  const canAssign = isMangaka;
  const canSubmit = isAssistant;
  const activeTab = isTantou ? "kanban" : requestedTab;

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [taskData, assistantData] = await Promise.all([
        api.tasks.mine(),
        canAssign ? api.users.byRole("Assistant").catch(() => []) : Promise.resolve([])
      ]);
      const normalizedTasks = normalizeTaskList(taskData);
      setTasks(normalizedTasks);
      setSelected((current) => {
        if (current && normalizedTasks.some((task) => String(task.id) === String(current.id))) {
          return normalizedTasks.find((task) => String(task.id) === String(current.id));
        }
        return normalizedTasks[0] || null;
      });
      setAssistants(Array.isArray(assistantData) ? assistantData : assistantData?.content || assistantData?.data || []);
    } catch (err) {
      setError(err.message || "Could not load tasks");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!selected && tasks.length) setSelected(tasks[0]);
    if (selected && tasks.length && !tasks.some((task) => String(task.id) === String(selected.id))) setSelected(tasks[0]);
  }, [tasks, selected]);

  useEffect(() => {
    setSelectedFile(null);
    setSelectedFileName("");
    setConfirmReady(false);
  }, [selected?.id]);

  useEffect(() => {
    let cancelled = false;

    async function loadSelectedHitbox() {
      if (!selected) {
        setSelectedHitbox(null);
        setHitboxLoading(false);
        return;
      }

      const direct = directTaskHitbox(selected);
      if (direct) {
        setSelectedHitbox(direct);
        setHitboxLoading(false);
        return;
      }

      const hitboxId = taskHitboxId(selected);
      const pageId = taskPageId(selected);
      if (!pageId) {
        setSelectedHitbox(null);
        setHitboxLoading(false);
        return;
      }

      setHitboxLoading(true);
      try {
        const response = await api.workspace.hitboxes(pageId).catch(() => []);
        const rawList = Array.isArray(response)
          ? response
          : Array.isArray(response?.hitboxes)
            ? response.hitboxes
            : [];
        const normalizedList = rawList.map(normalizeHitbox).filter(Boolean);
        let match = null;
        if (hitboxId !== null && hitboxId !== undefined && hitboxId !== "") {
          match = normalizedList.find((box) => String(box.id) === String(hitboxId));
        }
        if (!match && normalizedList.length === 1) match = normalizedList[0];
        if (!cancelled) setSelectedHitbox(match || null);
      } catch {
        if (!cancelled) setSelectedHitbox(null);
      } finally {
        if (!cancelled) setHitboxLoading(false);
      }
    }

    loadSelectedHitbox();
    return () => { cancelled = true; };
  }, [selected]);

  const grouped = useMemo(() => {
    const groups = Object.fromEntries(COLUMNS.map((column) => [column.key, []]));
    tasks.forEach((task) => {
      const normalized = normalizeTaskStatus(task.status);
      const key = COLUMNS.some((column) => column.key === normalized) ? normalized : "TODO";
      groups[key].push({ ...task, normalizedStatus: key });
    });
    return groups;
  }, [tasks]);

  const counts = useMemo(() => {
    return COLUMNS.reduce((acc, column) => {
      acc[column.key] = grouped[column.key]?.length || 0;
      return acc;
    }, {});
  }, [grouped]);

  async function updateStatus(task, newStatus) {
    if (normalizeTaskStatus(newStatus) === "REVIEWING" && !taskSubmittedUrl(task)) {
      setMessage("");
      setError("Assistant must submit a finished image before this task can move to Reviewing.");
      return;
    }
    setError("");
    setMessage("");
    try {
      const updated = await api.tasks.status(task.id, newStatus);
      const normalized = normalizeTaskRecord({ ...task, ...updated });

      setTasks((old) => old.map((item) => String(item.id) === String(task.id) ? normalized : item));
      if (selected && String(selected.id) === String(task.id)) setSelected(normalized);
      setMessage(newStatus === "APPROVED"
        ? `Task #${task.id} approved. Send its chapter from the Mangaka Review center after all chapter tasks are approved.`
        : `Task #${task.id} moved to ${newStatus}.`);
    } catch (err) {
      setError(err.message || "Could not update task status");
    }
  }

  async function startAndDownloadReference(task) {
    if (!task) return;
    const referenceUrl = taskReferenceUrl(task);
    if (!referenceUrl) {
      setError("This task does not have a reference image yet.");
      return;
    }

    setError("");
    setMessage("");
    try {
      let updatedTask = task;
      if (taskWorkflowStatus(task) === "TODO") {
        const updated = await api.tasks.start(task.id);
        updatedTask = normalizeTaskRecord({ ...task, ...updated });
        setTasks((old) => old.map((item) => String(item.id) === String(task.id) ? updatedTask : item));
        setSelected(updatedTask);
        setMessage(`Task #${taskDisplayNumber(task)} started and moved to Doing.`);
      }

      const anchor = document.createElement("a");
      anchor.href = referenceUrl;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.download = `task-${taskDisplayNumber(task)}-reference`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (err) {
      setError(err.message || "Could not start the task or download the reference image.");
    }
  }

  async function assignAssistant(taskId, assistantId) {
    if (!assistantId) return;
    setError("");
    setMessage("");
    try {
      const updated = await api.tasks.assign(taskId, assistantId);
      const normalized = normalizeTaskRecord(updated);
      setTasks((old) => old.map((item) => String(item.id) === String(taskId) ? normalized : item));
      setSelected(normalized);
      setMessage("Assistant assigned.");
    } catch (err) {
      setError(err.message || "Could not assign assistant");
    }
  }

  async function submitWork(task, file = selectedFile) {
    if (!task) {
      setError("Select a task before submitting work.");
      return;
    }
    if (!file) {
      setError("Choose a finished image first.");
      return;
    }
    if (file.size <= 0 || !String(file.type || "").startsWith("image/")) {
      setError("Choose a valid PNG, JPG, or WEBP image before submitting.");
      return;
    }
    if (!confirmReady) {
      setError("Confirm the work is ready for Mangaka review first.");
      return;
    }
    setError("");
    setMessage("");
    try {
      const resource = await api.resources.upload(file, "TASK_SUBMISSION");
      const imageUrl = extractMediaUrl(resource);
      if (!imageUrl) throw new Error("The selected image could not be prepared. Please try again.");
      const updated = await api.tasks.submit(task.id, imageUrl);
      const normalized = normalizeTaskRecord(updated);
      setTasks((old) => old.map((item) => String(item.id) === String(task.id) ? normalized : item));
      setSelected(normalized);
      setSelectedFile(null);
      setSelectedFileName("");
      setConfirmReady(false);
      setMessage("Task submitted for review.");
    } catch (err) {
      setError(err.message || "Could not submit work");
    }
  }

  function chooseFile(file) {
    setSelectedFile(file || null);
    setSelectedFileName(file?.name || "");
  }

  if (loading) return <LoadingBlock label="Loading tasks..." />;

  return (
    <section className="task-page stack">
      <Alert type="success">{message}</Alert>
      <Alert type="danger">{error}</Alert>

      <div className="resource-filter-tabs task-page-tabs" role="tablist" aria-label="Task views">
        <button
          type="button"
          className={activeTab === "kanban" ? "r-tab active" : "r-tab"}
          onClick={() => navigate("/tasks?tab=kanban")}
        >
          Kanban Board
        </button>
        {!isTantou && (
          <button
            type="button"
            className={activeTab === "assignments" ? "r-tab active" : "r-tab"}
            onClick={() => navigate("/tasks?tab=assignments")}
          >
            Assignments
          </button>
        )}
      </div>

      {activeTab === "kanban" ? (
        <KanbanBoard
          grouped={grouped}
          counts={counts}
          selected={selected}
          onSelect={(task) => setSelected(task)}
          onMove={updateStatus}
          totalTasks={tasks.length}
          role={role}
          isTantou={isTantou}
        />
      ) : (
        <AssignmentsPanel
          tasks={tasks}
          selected={selected}
          selectedHitbox={selectedHitbox}
          hitboxLoading={hitboxLoading}
          assistants={assistants}
          canAssign={canAssign}
          canSubmit={canSubmit}
          selectedFileName={selectedFileName}
          confirmReady={confirmReady}
          onSelect={(task) => setSelected(task)}
          onAssign={assignAssistant}
          onMove={updateStatus}
          onChooseFile={chooseFile}
          onConfirm={setConfirmReady}
          onSubmit={() => submitWork(selected)}
          role={role}
          selectedFile={selectedFile}
          onDownloadReference={startAndDownloadReference}
        />
      )}
    </section>
  );
}

function KanbanBoard({ grouped, counts, selected, onSelect, onMove, totalTasks, role, isTantou = false }) {
  const [draggedTask, setDraggedTask] = useState(null);
  const [dropTarget, setDropTarget] = useState("");

  function drop(event, status) {
    event.preventDefault();
    const allowed = draggedTask ? allowedKanbanTargets(draggedTask, role) : [];
    if (draggedTask && allowed.includes(status)) {
      onMove(draggedTask, status);
    }
    setDraggedTask(null);
    setDropTarget("");
  }

  if (!totalTasks) {
    return (
      <EmptyState
        icon="▤"
        title={isTantou ? "No tasks in assigned series" : "No tasks assigned"}
        body={isTantou
          ? "Tasks will appear here when a Mangaka assigns this Tantou Editor to a series that contains Assistant work."
          : "Tasks created from page hitboxes will appear here."}
      />
    );
  }

  return (
    <div className="task-kanban-panel" data-testid="kanban-board" data-task-count={totalTasks}>
      {isTantou ? (
        <div className="tantou-kanban-scope-note" data-testid="tantou-kanban-scope">
          Read-only view of Assistant tasks from manga series assigned to this Tantou Editor.
        </div>
      ) : null}
      <div className="kanban-grid backend-kanban task-kanban-grid">
        {COLUMNS.map((column) => (
          <div
            className={`kanban-column ${dropTarget === column.key ? "drag-over" : ""}`}
            key={column.key}
            data-status={column.key}
            onDragOver={(event) => { event.preventDefault(); setDropTarget(column.key); }}
            onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDropTarget(""); }}
            onDrop={(event) => drop(event, column.key)}
          >
            <h3>
              <span>{column.label}</span>
              <span className="task-count">{counts[column.key] || 0}</span>
            </h3>
            <div className="kanban-drop">
              {(grouped[column.key] || []).map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  selected={selected && String(selected.id) === String(task.id)}
                  onClick={() => onSelect(task)}
                  onMove={onMove}
                  role={role}
                  onDragStart={() => setDraggedTask(task)}
                  onDragEnd={() => { setDraggedTask(null); setDropTarget(""); }}
                />
              ))}
              {!grouped[column.key]?.length && <div className="empty-column">Empty column</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AssignmentsPanel({
  tasks,
  selected,
  selectedHitbox,
  hitboxLoading,
  assistants,
  canAssign,
  canSubmit,
  selectedFileName,
  confirmReady,
  onSelect,
  onAssign,
  onMove,
  onChooseFile,
  onConfirm,
  onSubmit,
  role,
  selectedFile,
  onDownloadReference
}) {
  return (
    <div className="assignments-shell">
      <div className="task-box assignments-list-box">
        <div className="task-box-title">
          <span>Active Assignments</span>
          <span className="task-count">{tasks.length}</span>
        </div>

        {tasks.length ? (
          <div className="ast-task-list assignment-task-list">
            {tasks.map((task) => (
              <button
                type="button"
                key={task.id}
                data-testid={`assignment-task-${task.id}`}
                className={selected && String(selected.id) === String(task.id) ? "ast-task-item assignment-task-item active" : "ast-task-item assignment-task-item"}
                onClick={() => onSelect(task)}
              >
                <TaskThumbnail task={task} />
                <div className="ast-task-info">
                  <div className="ast-task-title">
                    <span>{task.description || `Task #${taskDisplayNumber(task)}`}</span>
                    <StatusBadge value={task.status} />
                  </div>
                  <div className="ast-task-sub">{taskSeriesTitle(task) || "No series"} • Page {taskPageNumber(task) || "?"}</div>
                  <div className="ast-task-meta">
                    <span>Assistant: {taskAssistantName(task) || "Unassigned"}</span>
                    <span>Task #{taskDisplayNumber(task)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState icon="☑" title="No assignments" body="Tasks created from canvas hitboxes will appear here." />
        )}
      </div>

      <div className="assignments-detail-stack">
        <TaskDetail
          selected={selected}
          selectedHitbox={selectedHitbox}
          hitboxLoading={hitboxLoading}
          assistants={assistants}
          canAssign={canAssign}
          onAssign={onAssign}
          onMove={onMove}
          role={role}
          onDownloadReference={onDownloadReference}
        />

        {canSubmit && selected && isTaskLockedForAssistant(selected) ? (
          <TaskLockedBox task={selected} />
        ) : canSubmit ? (
          <SubmitWorkBox
            disabled={!selected}
            selectedFileName={selectedFileName}
            selectedFile={selectedFile}
            confirmReady={confirmReady}
            onChooseFile={onChooseFile}
            onConfirm={onConfirm}
            onSubmit={onSubmit}
          />
        ) : null}
      </div>
    </div>
  );
}

function TaskCard({ task, selected, onClick, onMove, onDragStart, onDragEnd, role }) {
  const status = normalizeTaskStatus(task.status);
  const targets = allowedKanbanTargets(task, role);
  return (
    <div
      className={selected ? "backend-task-card task-card active" : "backend-task-card task-card"}
      data-testid="kanban-task-card"
      data-task-id={task.id}
      role="button"
      tabIndex={0}
      draggable={targets.length > 0}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(task.id));
        onDragStart?.();
      }}
      onDragEnd={onDragEnd}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onClick();
      }}
    >
      <span className="tag">{status}</span>
      <strong>{task.description || `Task #${taskDisplayNumber(task)}`}</strong>
      <p>{taskSeriesTitle(task) || "No series"} • Page {taskPageNumber(task) || "?"}</p>
      <small>Assistant: {taskAssistantName(task) || "Unassigned"}</small>
      {targets.length > 0 && (
        <div className="button-row" onClick={(event) => event.stopPropagation()}>
          {COLUMNS.filter((column) => targets.includes(column.key)).map((column) => (
            <button key={column.key} type="button" className="btn btn-tiny" onClick={() => onMove(task, column.key)}>{column.label}</button>
          ))}
        </div>
      )}
      {!targets.length && hasRole(role, ["assistant", "tantou"]) && <small className="kanban-readonly-note">View only</small>}
    </div>
  );
}

function TaskDetail({ selected, selectedHitbox, hitboxLoading, assistants, canAssign, onAssign, onMove, role, onDownloadReference }) {
  const referenceUrl = taskReferenceUrl(selected);
  const submittedImageUrl = taskSubmittedUrl(selected);
  const isAssistant = hasRole(role, ["assistant"]);
  const statusTargets = selected ? allowedKanbanTargets(selected, role) : [];
  const assignmentLocked = selected ? ["REVIEWING", "APPROVED"].includes(taskWorkflowStatus(selected)) : false;
  const [compareOpen, setCompareOpen] = useState(false);

  useEffect(() => { setCompareOpen(false); }, [selected?.id]);

  return (
    <div className="task-box assignment-detail-box">
      <div className="task-box-title">
        <span>Task Detail</span>
        {selected && <StatusBadge value={selected.status} />}
      </div>

      {selected ? (
        <div className="stack">
          <div className="task-detail-header compact-task-detail-header">
            <div className="task-detail-meta"><span>Task #{taskDisplayNumber(selected)}</span><span>{taskSeriesTitle(selected) || "No series"}</span></div>
            <h1>{selected.description || `Task #${taskDisplayNumber(selected)}`}</h1>
            <div className="meta-row wrap">
              <span data-testid="task-chapter-meta">{taskChapterLabel(selected)}</span>
              <span>Page: {taskPageNumber(selected) || "-"}</span>
              <span>Assistant: {taskAssistantName(selected) || "Unassigned"}</span>
            </div>
          </div>

          {canAssign && (
            <div className="form-group">
              <label>Assign assistant</label>
              <select className="form-control" data-testid="assign-assistant-select" value={taskAssistantId(selected) || ""} disabled={assignmentLocked} title={assignmentLocked ? "Assistant assignment is locked while the task is Reviewing or Approved." : ""} onChange={(event) => onAssign(selected.id, event.target.value)}>
                <option value="">Choose assistant</option>
                {assistants.map((assistant) => (
                  <option key={assistant.id} value={assistant.id}>{assistant.fullName || assistant.username || assistant.email}</option>
                ))}
              </select>
              {assignmentLocked && <small className="assignment-lock-note">Assistant assignment is locked for {taskWorkflowStatus(selected)} tasks.</small>}
            </div>
          )}

          {hasRole(role, ["mangaka"]) && taskWorkflowStatus(selected) === "DOING" && !taskSubmittedUrl(selected) ? (
            <div className="assignment-lock-note" data-testid="reviewing-requires-submission">
              Waiting for the assigned Assistant to submit a finished image before Reviewing becomes available.
            </div>
          ) : null}

          {statusTargets.length > 0 ? (
            <div className="button-row">
              {COLUMNS.filter((column) => statusTargets.includes(column.key)).map((column) => (
                <button key={column.key} type="button" data-testid={`task-status-${column.key.toLowerCase()}`} className="btn btn-small" onClick={() => onMove(selected, column.key)}>{column.label}</button>
              ))}
            </div>
          ) : isTaskFinalApproved(selected) ? (
            <div className="task-approved-notice compact-approved-notice">This task is approved and locked. It cannot be moved or resubmitted by Assistant.</div>
          ) : null}

          <div className="reference-panel assignment-reference-panel">
            <div className="assignment-reference-column">
              <HitboxPreview key={`${selected.id}-${selectedHitbox?.id || "loading"}`} title="Reference image" url={referenceUrl} box={selectedHitbox} originalWidth={taskPageWidth(selected)} originalHeight={taskPageHeight(selected)} loading={hitboxLoading} />
              {isAssistant && (
                <button className="btn btn-primary full reference-download-btn" type="button" onClick={() => onDownloadReference(selected)} disabled={!referenceUrl}>
                  Download reference image
                </button>
              )}
            </div>
            {submittedImageUrl ? (
              <div className="assignment-submitted-column">
                <Preview
                  title={isAssistant ? "Your submitted image" : "Submitted image"}
                  url={submittedImageUrl}
                />
                {isAssistant ? <button className="btn btn-primary full reference-download-btn compare-images-button assistant-compare-images-button" type="button" onClick={() => setCompareOpen(true)}>Compare 2 Images</button> : null}
              </div>
            ) : null}
          </div>
          {isAssistant && submittedImageUrl ? <ImageComparisonModal open={compareOpen} referenceUrl={referenceUrl} submittedUrl={submittedImageUrl} onClose={() => setCompareOpen(false)} /> : null}
        </div>
      ) : (
        <EmptyState icon="☑" title="Select a task" body="Open the Assignments tab and select a card to assign an assistant, move status, or submit work." />
      )}
    </div>
  );
}

function TaskLockedBox({ task }) {
  const status = taskWorkflowStatus(task);
  const isApproved = status === "APPROVED";
  return (
    <div className={isApproved ? "task-box assistant-submit-box task-locked-box approved" : "task-box assistant-submit-box task-locked-box"}>
      <div className="task-box-title assistant-submit-title">
        <span>{isApproved ? "✓ Work approved" : "⏳ Submitted for review"}</span>
        <span className="assistant-submit-step">Locked</span>
      </div>
      <div className="assistant-submit-help locked-submit-help">
        <strong>{isApproved ? "Mangaka approved this work." : "This work is already waiting for Mangaka review."}</strong>
        <span>{isApproved ? "The upload form is hidden because the task is final." : "The upload form is locked until Mangaka requests a revision."}</span>
      </div>
    </div>
  );
}

function SubmitWorkBox({ disabled, selectedFileName, selectedFile, confirmReady, onChooseFile, onConfirm, onSubmit }) {
  const inputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    if (!selectedFile || !String(selectedFile.type || "").startsWith("image/")) {
      setPreviewUrl("");
      return undefined;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  function choose(file) {
    onChooseFile(file || null);
  }

  function openPicker() {
    if (!disabled) inputRef.current?.click();
  }

  function handleDrop(event) {
    event.preventDefault();
    if (disabled) return;
    choose(event.dataTransfer?.files?.[0]);
  }

  const hasFile = Boolean(selectedFileName);

  return (
    <div className="task-box assistant-submit-box" id="submit-work-box">
      <div className="task-box-title assistant-submit-title">
        <span>☁ Submit Finished Work to Mangaka</span>
        <span className="assistant-submit-step">Final step</span>
      </div>

      <div className="assistant-submit-help">
        <strong>Upload your finished drawing here.</strong>
        <span>After upload, the task moves to <b>Reviewing</b> so Mangaka can check it.</span>
      </div>

      <input
        ref={inputRef}
        className="assistant-hidden-file-input"
        data-testid="assistant-work-file"
        type="file"
        accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
        disabled={disabled}
        onChange={(event) => choose(event.target.files?.[0])}
      />

      <button
        className="assistant-file-button"
        type="button"
        disabled={disabled}
        onClick={openPicker}
      >
        📁 Choose Finished File
      </button>

      <div
        className={hasFile ? "upload-dropzone assistant-upload-dropzone has-file" : "upload-dropzone assistant-upload-dropzone"}
        id="file-dropzone"
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={openPicker}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") openPicker();
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        aria-disabled={disabled}
      >
        <i>{hasFile ? "✓" : "☁"}</i>
        <p><b>{hasFile ? selectedFileName : "Drop finished file here"}</b>{hasFile ? "" : " or click this box"}</p>
        <span>{hasFile ? "File selected. Tick the confirmation box, then submit to Mangaka." : "Supports .png, .jpg, .webp"}</span>
      </div>

      <div id="selected-work-file" className={hasFile ? "selected-work-file has-file" : "selected-work-file"}>
        <span>{hasFile ? "✅" : "📄"}</span>
        {hasFile ? <>Selected: <strong>{selectedFileName}</strong></> : "No file selected yet"}
      </div>

      {previewUrl && (
        <div className="assistant-finished-preview" data-testid="assistant-finished-preview">
          <strong>Finished image preview</strong>
          <img src={previewUrl} alt={selectedFileName || "Finished work preview"} />
        </div>
      )}

      <label className="assistant-review-check">
        <input type="checkbox" data-testid="assistant-work-confirm" checked={confirmReady} disabled={disabled || !hasFile} onChange={(event) => onConfirm(event.target.checked)} />
        <span>I confirm this file is ready for Mangaka review</span>
      </label>

      <button
        type="button"
        data-testid="assistant-work-submit"
        className={hasFile && confirmReady ? "btn btn-dark full assistant-final-submit-btn is-ready" : "btn btn-dark full assistant-final-submit-btn"}
        disabled={disabled || !hasFile || !confirmReady}
        onClick={onSubmit}
      >
        Submit to Review
      </button>
      <p className="assistant-submit-note">Choose an assignment first, upload the finished image, confirm, then submit.</p>
    </div>
  );
}

function TaskThumbnail({ task }) {
  const url = taskReferenceUrl(task);
  if (url) return <img className="ast-task-thumb" src={url} alt="Task preview" />;
  return <div className="ast-task-thumb assignment-task-thumb-placeholder">▧</div>;
}

function Preview({ title, url }) {
  const resolved = resolveMediaUrl(url);
  return <div className="preview-box"><strong>{title}</strong>{resolved ? <img src={resolved} alt={title} /> : <span>No image</span>}</div>;
}

function HitboxPreview({ title, url, box, originalWidth: explicitWidth, originalHeight: explicitHeight, loading }) {
  const resolved = resolveMediaUrl(url);
  if (!resolved) {
    return <div className="preview-box"><strong>{title}</strong><span>No image</span></div>;
  }
  const hasBox = Boolean(box) && boxValue(box, "width", "w") > 0 && boxValue(box, "height", "h") > 0;

  return (
    <div className="preview-box preview-box-hitbox">
      <strong>{title}</strong>
      <CoordinateImageOverlay
        url={resolved}
        alt={title}
        box={box}
        originalWidth={explicitWidth}
        originalHeight={explicitHeight}
        testId="task-area-overlay"
      />
      {loading ? (
        <small className="preview-hitbox-note">Loading hitbox area…</small>
      ) : hasBox ? (
        <small className="preview-hitbox-note">Task area matches the Mangaka Canvas coordinates.</small>
      ) : (
        <small className="preview-hitbox-note">No saved hitbox was returned for this task yet.</small>
      )}
    </div>
  );
}
