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
      setMessage("Task submitted for review.");
    } catch (err) {
      setError(err.message || "Could not submit work");
    }
  }

  if (loading) return <LoadingBlock label="Loading tasks..." />;

  return (
    <section className="stack">
      <Alert type="success">{message}</Alert>
      <Alert type="danger">{error}</Alert>

      <div className="kanban-board">
        {COLUMNS.map((column) => (
          <div className="kanban-column" key={column.key}>
            <div className="column-title">
              <h3>{column.label}</h3>
              <span>{grouped[column.key]?.length || 0}</span>
            </div>
            <div className="kanban-list">
              {(grouped[column.key] || []).map((task) => (
                <TaskCard key={task.id} task={task} onClick={() => setSelected(task)} onMove={updateStatus} />
              ))}
              {!grouped[column.key]?.length && <div className="drop-placeholder">No tasks</div>}
            </div>
          </div>
        ))}
      </div>

      <div className="card stack">
        <h3>Task detail</h3>
        {selected ? (
          <div className="task-detail-grid">
            <div className="stack">
              <div className="row-between"><strong>Task #{selected.id}</strong><StatusBadge value={selected.status} /></div>
              <p>{selected.description || "No description."}</p>
              <div className="meta-row wrap">
                <span>Series: {selected.seriesTitle || "-"}</span>
                <span>Chapter: {selected.chapterTitle || selected.chapterNumber || "-"}</span>
                <span>Page: {selected.pageNumber || "-"}</span>
                <span>Assistant: {selected.assistantName || "Unassigned"}</span>
              </div>

              {canAssign && (
                <label>
                  Assign assistant
                  <select value={selected.assistantId || ""} onChange={(event) => assignAssistant(selected.id, event.target.value)}>
                    <option value="">Choose assistant</option>
                    {assistants.map((assistant) => (
                      <option key={assistant.id} value={assistant.id}>{assistant.fullName || assistant.username || assistant.email}</option>
                    ))}
                  </select>
                </label>
              )}

              <div className="button-row">
                {COLUMNS.map((column) => (
                  <button key={column.key} className="btn btn-small" onClick={() => updateStatus(selected, column.key)}>{column.label}</button>
                ))}
              </div>

              {canSubmit && (
                <label className="btn btn-primary file-button fit">
                  Upload finished image
                  <input type="file" accept="image/*" onChange={(event) => submitWork(selected, event.target.files?.[0])} />
                </label>
              )}
            </div>

            <div className="reference-panel">
              <Preview title="Reference image" url={selected.referenceImageUrl} />
              <Preview title="Submitted image" url={selected.submittedImageUrl} />
            </div>
          </div>
        ) : <EmptyState title="Select a task" body="Click any card in the Kanban board to view details, assign an assistant, move status, or submit work." />}
      </div>
    </section>
  );
}

function TaskCard({ task, onClick, onMove }) {
  return (
    <button className="task-card" onClick={onClick}>
      <div className="row-between">
        <strong>#{task.id}</strong>
        <StatusBadge value={task.status} />
      </div>
      <p>{task.description || "No description"}</p>
      <small>{task.seriesTitle || "No series"} • Page {task.pageNumber || "?"}</small>
      <div className="button-row" onClick={(event) => event.stopPropagation()}>
        {COLUMNS.filter((column) => column.key !== normalizeTaskStatus(task.status)).slice(0, 2).map((column) => (
          <button key={column.key} className="btn btn-tiny" onClick={() => onMove(task, column.key)}>{column.label}</button>
        ))}
      </div>
    </button>
  );
}

function Preview({ title, url }) {
  const resolved = resolveMediaUrl(url);
  return (
    <div className="preview-box">
      <strong>{title}</strong>
      {resolved ? <img src={resolved} alt={title} /> : <span>No image</span>}
    </div>
  );
}
