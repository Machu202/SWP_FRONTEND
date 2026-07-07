import { useEffect, useMemo, useRef, useState } from "react";
import { api, extractMediaUrl, hasRole, normalizeTaskStatus, resolveMediaUrl } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Alert, EmptyState, LoadingBlock, StatusBadge } from "../components/Status";
import { navigate, useHashRoute } from "../utils/router";

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

export default function TasksPage() {
  const route = useHashRoute();
  const activeTab = tabFromRoute(route);
  const { profile, session } = useAuth();
  const role = profile?.roleName || session.role;
  const [tasks, setTasks] = useState([]);
  const [assistants, setAssistants] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [confirmReady, setConfirmReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const canAssign = hasRole(role, ["mangaka", "tantou", "admin"]);
  const canSubmit = hasRole(role, ["assistant"]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [taskData, assistantData] = await Promise.all([
        api.tasks.mine().catch(() => []),
        api.users.byRole("Assistant").catch(() => [])
      ]);
      setTasks(taskData || []);
      setAssistants(assistantData || []);
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

  const grouped = useMemo(() => {
    const groups = Object.fromEntries(COLUMNS.map((column) => [column.key, []]));
    tasks.forEach((task) => {
      const key = normalizeTaskStatus(task.status);
      if (!groups[key]) groups[key] = [];
      groups[key].push(task);
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
    setError("");
    setMessage("");
    try {
      const updated = await api.tasks.status(task.id, newStatus);
      setTasks((old) => old.map((item) => String(item.id) === String(task.id) ? updated : item));
      if (selected && String(selected.id) === String(task.id)) setSelected(updated);
      setMessage(`Task #${task.id} moved to ${newStatus}.`);
    } catch (err) {
      setError(err.message || "Could not update task status");
    }
  }

  async function assignAssistant(taskId, assistantId) {
    if (!assistantId) return;
    setError("");
    setMessage("");
    try {
      const updated = await api.tasks.assign(taskId, assistantId);
      setTasks((old) => old.map((item) => String(item.id) === String(taskId) ? updated : item));
      setSelected(updated);
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
    if (!confirmReady) {
      setError("Confirm the work is ready for Mangaka review first.");
      return;
    }
    setError("");
    setMessage("");
    try {
      const resource = await api.resources.upload(file, "TASK_SUBMISSION");
      const imageUrl = extractMediaUrl(resource);
      if (!imageUrl) throw new Error("Upload succeeded but no image URL was returned.");
      const updated = await api.tasks.submit(task.id, imageUrl);
      setTasks((old) => old.map((item) => String(item.id) === String(task.id) ? updated : item));
      setSelected(updated);
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
        <button
          type="button"
          className={activeTab === "assignments" ? "r-tab active" : "r-tab"}
          onClick={() => navigate("/tasks?tab=assignments")}
        >
          Assignments
        </button>
      </div>

      {activeTab === "kanban" ? (
        <KanbanBoard
          grouped={grouped}
          counts={counts}
          selected={selected}
          onSelect={(task) => setSelected(task)}
          onMove={updateStatus}
        />
      ) : (
        <AssignmentsPanel
          tasks={tasks}
          selected={selected}
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
        />
      )}
    </section>
  );
}

function KanbanBoard({ grouped, counts, selected, onSelect, onMove }) {
  return (
    <div className="task-kanban-panel">
      <div className="kanban-grid backend-kanban task-kanban-grid">
        {COLUMNS.map((column) => (
          <div className="kanban-column" key={column.key} data-status={column.key}>
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
                />
              ))}
              {!grouped[column.key]?.length && <div className="empty-column">No tasks</div>}
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
  onSubmit
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
                className={selected && String(selected.id) === String(task.id) ? "ast-task-item assignment-task-item active" : "ast-task-item assignment-task-item"}
                onClick={() => onSelect(task)}
              >
                <TaskThumbnail task={task} />
                <div className="ast-task-info">
                  <div className="ast-task-title">
                    <span>{task.description || `Task #${task.id}`}</span>
                    <StatusBadge value={task.status} />
                  </div>
                  <div className="ast-task-sub">{task.seriesTitle || "No series"} • Page {task.pageNumber || "?"}</div>
                  <div className="ast-task-meta">
                    <span>Assistant: {task.assistantName || "Unassigned"}</span>
                    <span>#{task.id}</span>
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
          assistants={assistants}
          canAssign={canAssign}
          onAssign={onAssign}
          onMove={onMove}
        />

        {canSubmit && (
          <SubmitWorkBox
            disabled={!selected}
            selectedFileName={selectedFileName}
            confirmReady={confirmReady}
            onChooseFile={onChooseFile}
            onConfirm={onConfirm}
            onSubmit={onSubmit}
          />
        )}
      </div>
    </div>
  );
}

function TaskCard({ task, selected, onClick, onMove }) {
  const status = normalizeTaskStatus(task.status);
  return (
    <div
      className={selected ? "backend-task-card task-card active" : "backend-task-card task-card"}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onClick();
      }}
    >
      <span className="tag">{status}</span>
      <strong>{task.description || `Task #${task.id}`}</strong>
      <p>{task.seriesTitle || "No series"} • Page {task.pageNumber || "?"}</p>
      <small>Assistant: {task.assistantName || "Unassigned"}</small>
      <div className="button-row" onClick={(event) => event.stopPropagation()}>
        {COLUMNS.filter((column) => column.key !== status).slice(0, 2).map((column) => (
          <button key={column.key} type="button" className="btn btn-tiny" onClick={() => onMove(task, column.key)}>{column.label}</button>
        ))}
      </div>
    </div>
  );
}

function TaskDetail({ selected, assistants, canAssign, onAssign, onMove }) {
  return (
    <div className="task-box assignment-detail-box">
      <div className="task-box-title">
        <span>Task Detail</span>
        {selected && <StatusBadge value={selected.status} />}
      </div>

      {selected ? (
        <div className="stack">
          <div className="task-detail-header compact-task-detail-header">
            <div className="task-detail-meta"><span>Task #{selected.id}</span><span>{selected.seriesTitle || "No series"}</span></div>
            <h1>{selected.description || `Task #${selected.id}`}</h1>
            <div className="meta-row wrap">
              <span>Chapter: {selected.chapterTitle || selected.chapterNumber || "-"}</span>
              <span>Page: {selected.pageNumber || "-"}</span>
              <span>Assistant: {selected.assistantName || "Unassigned"}</span>
            </div>
          </div>

          {canAssign && (
            <div className="form-group">
              <label>Assign assistant</label>
              <select className="form-control" value={selected.assistantId || ""} onChange={(event) => onAssign(selected.id, event.target.value)}>
                <option value="">Choose assistant</option>
                {assistants.map((assistant) => (
                  <option key={assistant.id} value={assistant.id}>{assistant.fullName || assistant.username || assistant.email}</option>
                ))}
              </select>
            </div>
          )}

          <div className="button-row">
            {COLUMNS.map((column) => (
              <button key={column.key} type="button" className="btn btn-small" onClick={() => onMove(selected, column.key)}>{column.label}</button>
            ))}
          </div>

          <div className="reference-panel assignment-reference-panel">
            <Preview title="Reference image" url={selected.referenceImageUrl} />
            <Preview title="Submitted image" url={selected.submittedImageUrl} />
          </div>
        </div>
      ) : (
        <EmptyState icon="☑" title="Select a task" body="Open the Assignments tab and select a card to assign an assistant, move status, or submit work." />
      )}
    </div>
  );
}

function SubmitWorkBox({ disabled, selectedFileName, confirmReady, onChooseFile, onConfirm, onSubmit }) {
  const inputRef = useRef(null);

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

      <label className="assistant-review-check">
        <input type="checkbox" checked={confirmReady} disabled={disabled || !hasFile} onChange={(event) => onConfirm(event.target.checked)} />
        <span>I confirm this file is ready for Mangaka review</span>
      </label>

      <button
        type="button"
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
  const url = resolveMediaUrl(task.submittedImageUrl || task.referenceImageUrl);
  if (url) return <img className="ast-task-thumb" src={url} alt="Task preview" />;
  return <div className="ast-task-thumb assignment-task-thumb-placeholder">▧</div>;
}

function Preview({ title, url }) {
  const resolved = resolveMediaUrl(url);
  return <div className="preview-box"><strong>{title}</strong>{resolved ? <img src={resolved} alt={title} /> : <span>No image</span>}</div>;
}
