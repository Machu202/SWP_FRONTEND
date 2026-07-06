import { useEffect, useMemo, useState } from "react";
import { api, extractMediaUrl, normalizeTaskStatus, resolveMediaUrl } from "../api/client";
import { navigate } from "../utils/router";
import { Alert, EmptyState, LoadingBlock, StatusBadge } from "../components/Status";

function submittedUrl(task) {
  return task.submittedImageUrl || task.submitted_image_url || task.submissionUrl || task.imageUrl || "";
}

function referenceUrl(task) {
  return task.referenceImageUrl || task.pageImageUrl || task.imageUrl || task.page?.imageUrl || "";
}

function isSubmittedForReview(task) {
  const status = normalizeTaskStatus(task.status);
  return status === "REVIEWING" || Boolean(submittedUrl(task));
}

export default function MangakaAssistantReviewPage() {
  const [series, setSeries] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const ownedSeries = await api.series.mine().catch(() => []);
      setSeries(ownedSeries || []);

      const taskGroups = await Promise.all((ownedSeries || []).map(async (item) => {
        const list = await api.tasks.bySeries(item.id).catch(() => []);
        return (list || []).map((task) => ({
          ...task,
          seriesId: task.seriesId || item.id,
          seriesTitle: task.seriesTitle || item.title
        }));
      }));

      setTasks(taskGroups.flat().filter(isSubmittedForReview));
    } catch (err) {
      setError(err.message || "Could not load assistant submissions.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filteredTasks = useMemo(() => {
    if (!selectedSeriesId) return tasks;
    return tasks.filter((task) => String(task.seriesId) === String(selectedSeriesId));
  }, [tasks, selectedSeriesId]);

  async function updateTask(task, status, successText) {
    setError("");
    setMessage("");
    try {
      const updated = await api.tasks.status(task.id, status);
      setTasks((old) => old.map((item) => String(item.id) === String(task.id) ? { ...item, ...updated } : item));
      setMessage(successText);
    } catch (err) {
      setError(err.message || "Could not update this assistant submission.");
    }
  }

  if (loading) return <LoadingBlock label="Loading assistant submissions..." />;

  return (
    <section className="stack review-screen assistant-submission-review">
      <Alert type="success">{message}</Alert>
      <Alert type="danger">{error}</Alert>

      <div className="card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Mangaka review workflow</p>
            <h3>Assistant submissions waiting for Mangaka review</h3>
            <small>Use this screen only to check work submitted by assistants for your own manga tasks.</small>
          </div>
          <div className="button-row">
            <select value={selectedSeriesId} onChange={(event) => setSelectedSeriesId(event.target.value)}>
              <option value="">All owned series</option>
              {series.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
            <button className="btn btn-small" onClick={load}>Refresh</button>
          </div>
        </div>

        {filteredTasks.length ? (
          <div className="review-list">
            {filteredTasks.map((task) => (
              <AssistantSubmissionRow
                key={task.id}
                task={task}
                onApprove={() => updateTask(task, "APPROVED", `Task #${task.id} approved.`)}
                onRevision={() => updateTask(task, "DOING", `Task #${task.id} sent back for revision.`)}
              />
            ))}
          </div>
        ) : (
          <EmptyState title="No assistant submissions" body="When assistants upload finished images and move tasks to REVIEWING, they will appear here for Mangaka approval." />
        )}
      </div>
    </section>
  );
}

function AssistantSubmissionRow({ task, onApprove, onRevision }) {
  const submitted = resolveMediaUrl(submittedUrl(task));
  const reference = resolveMediaUrl(referenceUrl(task));
  return (
    <div className="review-row assistant-review-row">
      <div className="review-main">
        <div className="row-between">
          <div>
            <p className="eyebrow">Task #{task.id}</p>
            <h3>{task.description || "Assistant submission"}</h3>
          </div>
          <StatusBadge value={task.status} />
        </div>
        <div className="meta-row wrap">
          <span>Series: {task.seriesTitle || "-"}</span>
          <span>Chapter: {task.chapterTitle || task.chapterNumber || "-"}</span>
          <span>Page: {task.pageNumber || "-"}</span>
          <span>Assistant: {task.assistantName || task.assistantUsername || task.assistantEmail || "Unassigned"}</span>
        </div>
        <div className="submission-preview-grid">
          <Preview title="Reference" url={reference} />
          <Preview title="Submitted work" url={submitted} />
        </div>
      </div>
      <div className="vote-panel">
        <p className="review-helper">Approve the assistant work or send it back to Doing for fixes.</p>
        <div className="button-row vertical-buttons">
          <button className="btn btn-primary" onClick={onApprove}>Approve assistant work</button>
          <button className="btn btn-danger" onClick={onRevision}>Request revision</button>
          {task.seriesId && <button className="btn" onClick={() => navigate(`/series/${task.seriesId}`)}>Open series</button>}
        </div>
      </div>
    </div>
  );
}

function Preview({ title, url }) {
  return (
    <div className="preview-box submission-preview">
      <strong>{title}</strong>
      {url ? <img src={url} alt={title} /> : <span>No image</span>}
    </div>
  );
}
