import { useEffect, useMemo, useState } from "react";
import { api, extractMediaUrl, hasRole, normalizeTaskStatus, resolveMediaUrl } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Alert, EmptyState, LoadingBlock, StatusBadge } from "../components/Status";

const COLUMNS = [
  { key: "TODO", label: "To do" },
  { key: "DOING", label: "Doing" },
  { key: "REVIEWING", label: "Reviewing" },
  { key: "APPROVED", label: "Approved" }
];

export default function TasksPage() {
  const { profile, session } = useAuth();
  const role = profile?.roleName || session.role;
  const [tasks, setTasks] = useState([]);
  const [assistants, setAssistants] = useState([]);
  const [selected, setSelected] = useState(null);
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

  const grouped = useMemo(() => {
    const groups = Object.fromEntries(COLUMNS.map((column) => [column.key, []]));
    tasks.forEach((task) => {
      const key = normalizeTaskStatus(task.status);
      if (!groups[key]) groups[key] = [];
      groups[key].push(task);
    });
    return groups;
  }, [tasks]);

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
    try {
      const updated = await api.tasks.assign(taskId, assistantId);
      setTasks((old) => old.map((item) => String(item.id) === String(taskId) ? updated : item));
      setSelected(updated);
      setMessage("Assistant assigned.");
    } catch (err) {
      setError(err.message || "Could not assign assistant");
    }
  }

  async function submitWork(task, file) {
    if (!file) return;
    setError("");
    setMessage("");
    try {
      const resource = await api.resources.upload(file, "TASK_SUBMISSION");
      const imageUrl = extractMediaUrl(resource);
      if (!imageUrl) throw new Error("Upload succeeded but no image URL was returned.");
      const updated = await api.tasks.submit(task.id, imageUrl);
      setTasks((old) => old.map((item) => String(item.id) === String(task.id) ? updated : item));
      setSelected(updated);
      setSelectedFileName("");
      setConfirmReady(false);
      setMessage("Task submitted for review.");
    } catch (err) {
      setError(err.message || "Could not submit work");
    }
  }

  if (loading) return <LoadingBlock label="Loading tasks..." />;

  return (
    <section className="stack backend-kanban">
      <Alert type="success">{message}</Alert>
      <Alert type="danger">{error}</Alert>

      <div className="kanban-board">
        {COLUMNS.map((column) => (
          <div className="kanban-column" key={column.key}>
            <div className="kanban-column-header column-title">
              <span>{column.label}</span>
              <span className="task-count">{grouped[column.key]?.length || 0}</span>
            </div>
            <div className="kanban-task-list kanban-list">
              {(grouped[column.key] || []).map((task) => <TaskCard key={task.id} task={task} onClick={() => setSelected(task)} onMove={updateStatus} />)}
              {!grouped[column.key]?.length && <div className="drop-placeholder">No tasks</div>}
            </div>
          </div>
        ))}
      </div>

      <div className="task-content-grid">
        <div className="task-box">
          <div className="task-box-title"><span>Task Detail</span>{selected && <StatusBadge value={selected.status} />}</div>
          {selected ? (
            <div className="stack">
              <div className="task-detail-header">
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
                  <select className="form-control" value={selected.assistantId || ""} onChange={(event) => assignAssistant(selected.id, event.target.value)}>
                    <option value="">Choose assistant</option>
                    {assistants.map((assistant) => <option key={assistant.id} value={assistant.id}>{assistant.fullName || assistant.username || assistant.email}</option>)}
                  </select>
                </div>
              )}

              <div className="button-row">
                {COLUMNS.map((column) => <button key={column.key} className="btn btn-small" onClick={() => updateStatus(selected, column.key)}>{column.label}</button>)}
              </div>

              <div className="reference-panel">
                <Preview title="Reference image" url={selected.referenceImageUrl} />
                <Preview title="Submitted image" url={selected.submittedImageUrl} />
              </div>
            </div>
          ) : <EmptyState icon="☑" title="Select a task" body="Click any card in the Kanban board to view details, assign an assistant, move status, or submit work." />}
        </div>

        {canSubmit && (
          <div className="task-box assistant-submit-box" id="submit-work-box">
            <div className="task-box-title assistant-submit-title"><span>☁ Submit Finished Work to Mangaka</span><span className="assistant-submit-step">Final step</span></div>
            <div className="assistant-submit-help"><strong>Upload your finished drawing here.</strong><span>After upload, the task moves to <b>In Review</b> so Mangaka can check it.</span></div>
            <label className="assistant-file-button btn full">
              Choose Finished File
              <input type="file" accept="image/*" onChange={(event) => setSelectedFileName(event.target.files?.[0]?.name || "")} />
            </label>
            <label className="upload-dropzone assistant-upload-dropzone">
              <i>☁</i>
              <p><b>Drop finished file here</b> or click this box</p>
              <span>Supports .png, .jpg, .webp</span>
              <input type="file" accept="image/*" onChange={(event) => {
                const file = event.target.files?.[0];
                setSelectedFileName(file?.name || "");
                if (selected && file && confirmReady) submitWork(selected, file);
              }} disabled={!selected} />
            </label>
            <div id="selected-work-file" className="selected-work-file">{selectedFileName || "No file selected yet"}</div>
            <label className="assistant-review-check"><input type="checkbox" checked={confirmReady} onChange={(event) => setConfirmReady(event.target.checked)} /><span>I confirm this file is ready for Mangaka review</span></label>
            <p className="assistant-submit-note">Choose a selected task first, confirm, then choose the file in the dropzone to submit.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function TaskCard({ task, onClick, onMove }) {
  return (
    <button className="kanban-card task-card" onClick={onClick}>
      <span className="tag">{normalizeTaskStatus(task.status)}</span>
      <div className="task-title">{task.description || "No description"}</div>
      <small>{task.seriesTitle || "No series"} • Page {task.pageNumber || "?"}</small>
      <div className="button-row" onClick={(event) => event.stopPropagation()} style={{ marginTop: 12 }}>
        {COLUMNS.filter((column) => column.key !== normalizeTaskStatus(task.status)).slice(0, 2).map((column) => <button key={column.key} className="btn btn-tiny" onClick={() => onMove(task, column.key)}>{column.label}</button>)}
      </div>
    </button>
  );
}

function Preview({ title, url }) {
  const resolved = resolveMediaUrl(url);
  return <div className="preview-box"><strong>{title}</strong>{resolved ? <img src={resolved} alt={title} /> : <span>No image</span>}</div>;
}
