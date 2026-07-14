import { useEffect, useRef, useState } from "react";
import { api, hasRole, resolveMediaUrl, unwrapList } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { navigate } from "../utils/router";
import { Alert, EmptyState, LoadingBlock, StatusBadge } from "../components/Status";

function hitboxId(box) {
  return box.id || `${box.xCoord}-${box.yCoord}-${box.width}-${box.height}`;
}

export default function WorkspacePage({ pageId, query }) {
  const { profile, session } = useAuth();
  const role = profile?.roleName || session.role;
  const canCreateTask = hasRole(role, ["mangaka"]);
  const canCreateFeedback = hasRole(role, ["tantou"]);
  const canResolveFeedback = hasRole(role, ["tantou", "mangaka"]);
  const imageRef = useRef(null);
  const [canvas, setCanvas] = useState(null);
  const [hitboxes, setHitboxes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [dragStart, setDragStart] = useState(null);
  const [draftBox, setDraftBox] = useState(null);
  const [description, setDescription] = useState("");
  const [assistants, setAssistants] = useState([]);
  const [assistantId, setAssistantId] = useState("");
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [feedbackContent, setFeedbackContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const seriesId = query?.get("seriesId");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [data, assistantData, feedbackData] = await Promise.all([
        api.workspace.canvasInit(pageId),
        canCreateTask ? api.users.byRole("Assistant").catch(() => []) : Promise.resolve([]),
        api.feedback.byPage(pageId).catch(() => [])
      ]);
      setCanvas(data);
      setHitboxes(data?.hitboxes || []);
      setAssistants(unwrapList(assistantData));
      setFeedbacks(unwrapList(feedbackData));
    } catch (err) {
      setError(err.message || "Could not load canvas");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId, canCreateTask]);

  async function loadComments(box) {
    setSelected(box);
    setComments([]);
    setComment("");
    try {
      const data = await api.hitboxComments.list(box.id);
      setComments(data || []);
    } catch {
      setComments([]);
    }
  }

  function toImageCoords(event) {
    const image = imageRef.current;
    if (!image) return null;
    const rect = image.getBoundingClientRect();
    const displayWidth = rect.width || 1;
    const displayHeight = rect.height || 1;
    const originalWidth = Number(canvas?.originalWidth || image.naturalWidth || displayWidth);
    const originalHeight = Number(canvas?.originalHeight || image.naturalHeight || displayHeight);
    const x = Math.max(0, Math.min(originalWidth, ((event.clientX - rect.left) / displayWidth) * originalWidth));
    const y = Math.max(0, Math.min(originalHeight, ((event.clientY - rect.top) / displayHeight) * originalHeight));
    return { x, y, originalWidth, originalHeight };
  }

  function handlePointerDown(event) {
    if (event.target.dataset.box) return;
    const coords = toImageCoords(event);
    if (!coords) return;
    setDragStart(coords);
    setDraftBox(null);
    setSelected(null);
  }

  function handlePointerMove(event) {
    if (!dragStart) return;
    const coords = toImageCoords(event);
    if (!coords) return;
    const x = Math.min(dragStart.x, coords.x);
    const y = Math.min(dragStart.y, coords.y);
    const width = Math.abs(coords.x - dragStart.x);
    const height = Math.abs(coords.y - dragStart.y);
    setDraftBox({ xCoord: x, yCoord: y, width, height });
  }

  async function handlePointerUp() {
    if (!dragStart || !draftBox) {
      setDragStart(null);
      return;
    }
    setDragStart(null);
    if (draftBox.width < 5 || draftBox.height < 5) {
      setDraftBox(null);
      return;
    }
    setError("");
    setMessage("");
    try {
      const saved = await api.workspace.createHitbox(pageId, {
        x: Number(draftBox.xCoord.toFixed(2)),
        y: Number(draftBox.yCoord.toFixed(2)),
        width: Number(draftBox.width.toFixed(2)),
        height: Number(draftBox.height.toFixed(2))
      });
      setHitboxes((old) => [...old, saved]);
      setSelected(saved);
      setMessage("Hitbox created. Add task details on the right.");
    } catch (err) {
      setError(err.message || "Could not create hitbox");
    } finally {
      setDraftBox(null);
    }
  }

  async function deleteSelected() {
    if (!selected?.id) return;
    setError("");
    try {
      await api.workspace.deleteHitbox(selected.id);
      setHitboxes((old) => old.filter((box) => String(box.id) !== String(selected.id)));
      setSelected(null);
      setMessage("Hitbox deleted.");
    } catch (err) {
      setError(err.message || "Could not delete hitbox");
    }
  }

  async function createTask() {
    if (!selected?.id || !description.trim()) return;
    setError("");
    setMessage("");
    try {
      const created = await api.workspace.createTask(selected.id, description.trim());
      if (assistantId && created?.id) await api.tasks.assign(created.id, assistantId);
      setDescription("");
      setAssistantId("");
      setTaskModalOpen(false);
      setMessage(assistantId ? "Task created and assigned to an Assistant." : "Task created from hitbox.");
    } catch (err) {
      setError(err.message || "Could not create task. Maybe this hitbox already has a task.");
    }
  }

  async function createFeedback() {
    if (!selected?.id || !feedbackContent.trim() || !canCreateFeedback) return;
    setError("");
    try {
      const saved = await api.feedback.create(pageId, {
        content: feedbackContent.trim(),
        x: Number(selected.xCoord || selected.x || 0),
        y: Number(selected.yCoord || selected.y || 0),
        width: Number(selected.width || 0),
        height: Number(selected.height || 0)
      });
      setFeedbacks((old) => [saved, ...old]);
      setFeedbackContent("");
      setMessage("Tantou feedback created for the selected region.");
    } catch (err) {
      setError(err.message || "Could not create Tantou feedback");
    }
  }

  async function resolveFeedback(item) {
    if (!item?.id || !canResolveFeedback) return;
    setError("");
    try {
      const updated = await api.feedback.resolve(item.id);
      setFeedbacks((old) => old.map((entry) => String(entry.id) === String(item.id) ? { ...entry, ...(updated || {}), isResolved: true } : entry));
      setMessage("Feedback marked resolved.");
    } catch (err) {
      setError(err.message || "Could not resolve feedback");
    }
  }

  async function addComment() {
    if (!selected?.id || !comment.trim()) return;
    setError("");
    try {
      const saved = await api.hitboxComments.create(selected.id, comment.trim());
      setComments((old) => [saved, ...old]);
      setComment("");
      setMessage("Comment added.");
    } catch (err) {
      setError(err.message || "Could not add comment");
    }
  }

  if (loading) return <LoadingBlock label="Loading canvas..." />;
  if (!canvas) return <EmptyState icon="□" title="Canvas unavailable" body="Select a page from the series detail page." />;

  const imageUrl = resolveMediaUrl(canvas.imageUrl);

  return (
    <section className="editor-layout react-editor">
      <div className="floating-tools">
        <button className="tool-btn active" title="Hitbox tool">□</button>
        <button className="tool-btn" title="Comment tool">✎</button>
        <button className="tool-btn" title="Move tool">↕</button>
        <button className="tool-btn" title="Grid">#</button>
      </div>

      <div className="center-workspace">
        <Alert type="success">{message}</Alert>
        <Alert type="danger">{error}</Alert>
        <div className="canvas-view">
          <div
            data-testid="review-canvas"
            className="manga-page"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            <div className="grid-guide" />
            {imageUrl ? <img ref={imageRef} src={imageUrl} alt="Manga page" draggable="false" /> : <EmptyState icon="▧" title="No image URL" body="The page exists but has no image URL." />}
            {hitboxes.map((box, index) => (
              <HitboxOverlay
                key={hitboxId(box)}
                box={box}
                canvas={canvas}
                active={selected && String(selected.id) === String(box.id)}
                label={`Task ${index + 1}`}
                onClick={(event) => { event.stopPropagation(); loadComments(box); }}
              />
            ))}
            {draftBox && <HitboxOverlay box={draftBox} canvas={canvas} draft label="New" />}
          </div>
        </div>
      </div>

      <aside className="right-panel">
        <div className="panel-tabs">
          <button className="p-tab active">Layers</button>
          <button className="p-tab">Details</button>
        </div>

        <div className="panel-content">
          <div className="layer-item active">
            <span className="layer-visibility-toggle">●</span>
            <div className="layer-preview">PG</div>
            <div className="layer-name">Page #{pageId}</div>
          </div>
          {hitboxes.map((box, index) => (
            <button key={hitboxId(box)} className={selected && String(selected.id) === String(box.id) ? "layer-item active" : "layer-item"} onClick={() => loadComments(box)}>
              <span className="layer-visibility-toggle">□</span>
              <div className="layer-preview">HB</div>
              <div className="layer-name">Hitbox {index + 1}</div>
            </button>
          ))}

          <button className="btn-add-page-right" onClick={() => seriesId ? navigate(`/chapters-pages?seriesId=${seriesId}`) : navigate("/chapters-pages")}>＋ Back to Chapter</button>

          <div className="form-section" style={{ padding: 14, marginTop: 12 }}>
            <div className="form-section-title">Selected Hitbox</div>
            {selected ? (
              <>
                <div className="metric-grid compact">
                  <span>X <strong>{Number(selected.xCoord).toFixed(1)}</strong></span>
                  <span>Y <strong>{Number(selected.yCoord).toFixed(1)}</strong></span>
                  <span>W <strong>{Number(selected.width).toFixed(1)}</strong></span>
                  <span>H <strong>{Number(selected.height).toFixed(1)}</strong></span>
                </div>
                {canCreateTask && <button className="btn-publish full" onClick={() => setTaskModalOpen(true)}>Create / Assign Task</button>}
                {canCreateTask && <button className="btn btn-danger full" onClick={deleteSelected}>Delete hitbox</button>}

                <div className="divider-line" />
                <label>Comment<textarea className="form-control" rows="3" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Pin a note/comment to this hitbox." /></label>
                <button className="btn full" onClick={addComment} disabled={!comment.trim()}>Add comment</button>
                <div className="list" style={{ marginTop: 12 }}>
                  {comments.map((item) => <div className="list-row" key={item.id || item.content}><div><strong>{item.content}</strong><small>{item.createdAt || item.user?.username || "comment"}</small></div></div>)}
                </div>

                {canCreateFeedback && (
                  <>
                    <div className="divider-line" />
                    <label>Tantou feedback<textarea className="form-control" data-testid="tantou-feedback-input" rows="4" value={feedbackContent} onChange={(event) => setFeedbackContent(event.target.value)} placeholder="Describe the editorial issue in this selected region." /></label>
                    <button className="btn-publish full" data-testid="tantou-feedback-submit" onClick={createFeedback} disabled={!feedbackContent.trim()}>Create feedback</button>
                  </>
                )}
              </>
            ) : <EmptyState icon="□" title="No hitbox selected" body="Drag on the image to create a hitbox, or click an existing one." />}
          </div>

          <div className="form-section feedback-resolution-panel" style={{ padding: 14, marginTop: 12 }}>
            <div className="form-section-title">Tantou Feedback</div>
            {feedbacks.length ? feedbacks.map((item) => {
              const resolved = item.isResolved === true || item.is_resolved === true;
              return <div className="feedback-resolution-row" key={item.id}><div><strong>{item.content || `Feedback #${item.id}`}</strong><small>{resolved ? "Resolved" : "Open"}</small></div><label><input type="checkbox" checked={resolved} disabled={resolved || !canResolveFeedback} onChange={() => resolveFeedback(item)} /> Resolved</label></div>;
            }) : <small>No feedback for this page.</small>}
          </div>
        </div>

        <div className="page-info-footer">
          <div className="info-row"><span className="info-label">Hitboxes</span><span className="info-val">{hitboxes.length}</span></div>
          <div className="info-row"><span className="info-label">Mode</span><span className="info-val">Task Marking</span></div>
          <div className="info-row"><span className="info-label">Status</span><span className="info-val"><StatusBadge value="Ready" /></span></div>
        </div>
      </aside>

      {taskModalOpen && (
        <div className="feature-modal-backdrop" role="presentation" onMouseDown={() => setTaskModalOpen(false)}>
          <div className="feature-modal-card" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <div className="card-header"><div><p className="eyebrow">Task assignment</p><h3>Create task from hitbox</h3></div><button className="btn-icon-only" onClick={() => setTaskModalOpen(false)}>×</button></div>
            <label>Assistant<select className="form-control" value={assistantId} onChange={(event) => setAssistantId(event.target.value)}><option value="">Leave unassigned</option>{assistants.map((assistant) => <option key={assistant.id} value={assistant.id}>{assistant.fullName || assistant.username || assistant.email}</option>)}</select></label>
            <label>Task description<textarea className="form-control" rows="5" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe what the assistant needs to draw or revise." /></label>
            <div className="button-row modal-actions"><button className="btn" onClick={() => setTaskModalOpen(false)}>Cancel</button><button className="btn-publish" onClick={createTask} disabled={!description.trim()}>Create task</button></div>
          </div>
        </div>
      )}
    </section>
  );
}

function HitboxOverlay({ box, canvas, active, draft, onClick, label }) {
  const originalWidth = Number(canvas?.originalWidth || 1);
  const originalHeight = Number(canvas?.originalHeight || 1);
  const left = `${(Number(box.xCoord || box.x || 0) / originalWidth) * 100}%`;
  const top = `${(Number(box.yCoord || box.y || 0) / originalHeight) * 100}%`;
  const width = `${(Number(box.width || 0) / originalWidth) * 100}%`;
  const height = `${(Number(box.height || 0) / originalHeight) * 100}%`;
  return (
    <button
      data-box="true"
      data-testid={`review-hitbox-${box.id || "new"}`}
      type="button"
      className={`editor-hitbox ${active ? "active" : ""} ${draft ? "selection-box" : ""}`}
      style={{ left, top, width, height }}
      onClick={onClick}
      title={`Hitbox ${box.id || "new"}`}
    >
      {!draft && <span className="hitbox-tag">{label}</span>}
      {!draft && <span className="resize-handle" />}
    </button>
  );
}
