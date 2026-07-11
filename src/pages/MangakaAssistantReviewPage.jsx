import { useEffect, useMemo, useState } from "react";
import { api, mediaUrlFrom, normalizeTaskStatus, resolveMediaUrl } from "../api/client";
import { navigate } from "../utils/router";
import { Alert, EmptyState, LoadingBlock, StatusBadge } from "../components/Status";

const COMMENT_PREFIX = "[Mangaka Comment on Feedback #";

function normalizeList(value) {
  return Array.isArray(value) ? value : [];
}

function submittedUrl(task) {
  return mediaUrlFrom(task, task.submittedImageUrl, task.submitted_image_url, task.submissionUrl, task.submission_url, task.imageUrl, task.image_url);
}

function referenceUrl(task) {
  return mediaUrlFrom(task, task.referenceImageUrl, task.reference_image_url, task.pageImageUrl, task.page_image_url, task.imageUrl, task.image_url, task.page?.imageUrl, task.page?.image_url);
}

function isSubmittedForReview(task) {
  const status = normalizeTaskStatus(task.status);
  return status === "REVIEWING" || Boolean(submittedUrl(task));
}

function feedbackContent(feedback) {
  return feedback.content || feedback.comment || feedback.message || "";
}

function isResolved(feedback) {
  return Boolean(feedback.isResolved ?? feedback.is_resolved ?? feedback.resolved);
}

function feedbackX(feedback) {
  return Number(feedback.xCoord ?? feedback.x_coord ?? feedback.x ?? 0);
}

function feedbackY(feedback) {
  return Number(feedback.yCoord ?? feedback.y_coord ?? feedback.y ?? 0);
}

function feedbackWidth(feedback) {
  return Number(feedback.width ?? feedback.w ?? 0);
}

function feedbackHeight(feedback) {
  return Number(feedback.height ?? feedback.h ?? 0);
}

function isMangakaComment(feedback) {
  return feedbackContent(feedback).startsWith(COMMENT_PREFIX);
}

function mangakaCommentTargetId(feedback) {
  const match = feedbackContent(feedback).match(/^\[Mangaka Comment on Feedback #(\d+)\]/);
  return match ? match[1] : "";
}

function cleanMangakaComment(feedback) {
  return feedbackContent(feedback).replace(/^\[Mangaka Comment on Feedback #\d+\]\s*/, "");
}

export default function MangakaAssistantReviewPage() {
  const [activeTab, setActiveTab] = useState("tantou");
  const [series, setSeries] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [feedbackItems, setFeedbackItems] = useState([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("open");
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

      const [assistantTasks, tantouFeedback] = await Promise.all([
        loadAssistantSubmissions(ownedSeries || []),
        loadTantouFeedbackQueue(ownedSeries || [])
      ]);

      setTasks(assistantTasks);
      setFeedbackItems(tantouFeedback);
    } catch (err) {
      setError(err.message || "Could not load Mangaka review data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filteredTasks = useMemo(() => {
    if (!selectedSeriesId) return tasks;
    return tasks.filter((task) => String(task.seriesId) === String(selectedSeriesId));
  }, [tasks, selectedSeriesId]);

  const commentMap = useMemo(() => {
    const map = {};
    feedbackItems.filter(isMangakaComment).forEach((comment) => {
      const targetId = mangakaCommentTargetId(comment);
      if (!targetId) return;
      if (!map[targetId]) map[targetId] = [];
      map[targetId].push(comment);
    });
    Object.values(map).forEach((items) => items.sort((a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0)));
    return map;
  }, [feedbackItems]);

  const filteredFeedback = useMemo(() => {
    return feedbackItems
      .filter((item) => !isMangakaComment(item))
      .filter((item) => !selectedSeriesId || String(item.seriesId) === String(selectedSeriesId))
      .filter((item) => {
        if (feedbackStatus === "all") return true;
        if (feedbackStatus === "resolved") return isResolved(item);
        return !isResolved(item);
      })
      .sort((a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0));
  }, [feedbackItems, feedbackStatus, selectedSeriesId]);

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

  async function addMangakaComment(feedback, comment) {
    setError("");
    setMessage("");
    try {
      const saved = await api.feedback.create(feedback.pageId, {
        x: feedbackX(feedback),
        y: feedbackY(feedback),
        width: feedbackWidth(feedback),
        height: feedbackHeight(feedback),
        content: `${COMMENT_PREFIX}${feedback.id}] ${comment.trim()}`
      });
      const enriched = {
        ...saved,
        pageId: feedback.pageId,
        pageNumber: feedback.pageNumber,
        pageImageUrl: feedback.pageImageUrl,
        chapterId: feedback.chapterId,
        chapterNumber: feedback.chapterNumber,
        chapterTitle: feedback.chapterTitle,
        seriesId: feedback.seriesId,
        seriesTitle: feedback.seriesTitle
      };
      setFeedbackItems((old) => [enriched, ...old]);
      setMessage(`Comment added to Tantou feedback #${feedback.id}.`);
    } catch (err) {
      setError(err.message || "Could not add Mangaka comment to this feedback.");
    }
  }

  async function resolveFeedback(feedback) {
    setError("");
    setMessage("");
    try {
      const updated = await api.feedback.resolve(feedback.id);
      setFeedbackItems((old) => old.map((item) => String(item.id) === String(feedback.id) ? { ...item, ...updated, isResolved: true } : item));
      setMessage(`Feedback #${feedback.id} marked resolved.`);
    } catch (err) {
      setError(err.message || "Could not resolve this Tantou feedback.");
    }
  }

  if (loading) return <LoadingBlock label="Loading Mangaka review center..." />;

  return (
    <section className="stack review-screen mangaka-review-center">
      <Alert type="success">{message}</Alert>
      <Alert type="danger">{error}</Alert>

      <div className="card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Mangaka review workflow</p>
            <h3>Review center</h3>
            <small>Review Tantou feedback, reply with comments, and approve or return assistant submissions.</small>
          </div>
          <div className="button-row">
            <select value={selectedSeriesId} onChange={(event) => setSelectedSeriesId(event.target.value)}>
              <option value="">All owned series</option>
              {series.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
            <button className="btn btn-small" onClick={load}>Refresh</button>
          </div>
        </div>

        <div className="tabs review-tabs">
          <button className={activeTab === "tantou" ? "tab active" : "tab"} onClick={() => setActiveTab("tantou")}>
            Tantou Feedback ({filteredFeedback.length})
          </button>
          <button className={activeTab === "assistant" ? "tab active" : "tab"} onClick={() => setActiveTab("assistant")}>
            Assistant Submissions ({filteredTasks.length})
          </button>
        </div>

        {activeTab === "tantou" ? (
          <TantouFeedbackSection
            feedbackItems={filteredFeedback}
            commentMap={commentMap}
            feedbackStatus={feedbackStatus}
            setFeedbackStatus={setFeedbackStatus}
            onAddComment={addMangakaComment}
            onResolve={resolveFeedback}
          />
        ) : (
          <AssistantSubmissionSection
            tasks={filteredTasks}
            onApprove={(task) => updateTask(task, "APPROVED", `Task #${task.id} approved.`)}
            onRevision={(task) => updateTask(task, "DOING", `Task #${task.id} sent back for revision.`)}
          />
        )}
      </div>
    </section>
  );
}

async function loadAssistantSubmissions(ownedSeries) {
  const taskGroups = await Promise.all(ownedSeries.map(async (item) => {
    const list = await api.tasks.bySeries(item.id).catch(() => []);
    return normalizeList(list).map((task) => ({
      ...task,
      seriesId: task.seriesId || item.id,
      seriesTitle: task.seriesTitle || item.title
    }));
  }));
  return taskGroups.flat().filter(isSubmittedForReview);
}

async function loadTantouFeedbackQueue(ownedSeries) {
  const rows = [];

  await Promise.all(ownedSeries.map(async (item) => {
    const chapters = await api.chapters.bySeries(item.id).catch(() => []);

    await Promise.all(normalizeList(chapters).map(async (chapter) => {
      const pages = await api.pages.byChapter(chapter.id).catch(() => []);

      await Promise.all(normalizeList(pages).map(async (page) => {
        const feedbacks = await api.feedback.byPage(page.id).catch(() => []);
        normalizeList(feedbacks).forEach((feedback) => {
          rows.push({
            ...feedback,
            pageId: feedback.pageId || feedback.page_id || page.id,
            pageNumber: feedback.pageNumber || feedback.page_number || page.pageNumber || page.page_number,
            pageImageUrl: feedback.pageImageUrl || feedback.imageUrl || feedback.image_url || page.imageUrl || page.image_url,
            chapterId: feedback.chapterId || feedback.chapter_id || chapter.id,
            chapterNumber: feedback.chapterNumber || feedback.chapter_number || chapter.chapterNumber || chapter.chapter_number,
            chapterTitle: feedback.chapterTitle || chapter.title,
            seriesId: feedback.seriesId || feedback.series_id || item.id,
            seriesTitle: feedback.seriesTitle || item.title,
            editorName: feedback.editorName || feedback.editorUsername || feedback.editor?.fullName || feedback.editor?.username,
            editorEmail: feedback.editorEmail || feedback.editor?.email
          });
        });
      }));
    }));
  }));

  return rows;
}

function AssistantSubmissionSection({ tasks, onApprove, onRevision }) {
  return tasks.length ? (
    <div className="review-list">
      {tasks.map((task) => (
        <AssistantSubmissionRow
          key={task.id}
          task={task}
          onApprove={() => onApprove(task)}
          onRevision={() => onRevision(task)}
        />
      ))}
    </div>
  ) : (
    <EmptyState title="No assistant submissions" body="When assistants upload finished images and move tasks to REVIEWING, they will appear here for Mangaka approval." />
  );
}

function TantouFeedbackSection({ feedbackItems, commentMap, feedbackStatus, setFeedbackStatus, onAddComment, onResolve }) {
  return (
    <div className="stack">
      <div className="row-between feedback-filter-row">
        <div>
          <strong>Tantou feedback for your pages</strong>
          <small>Read editor notes, reply with Mangaka comments, and mark items resolved after fixing.</small>
        </div>
        <select value={feedbackStatus} onChange={(event) => setFeedbackStatus(event.target.value)}>
          <option value="open">Open feedback</option>
          <option value="resolved">Resolved feedback</option>
          <option value="all">All feedback</option>
        </select>
      </div>

      {feedbackItems.length ? (
        <div className="review-list tantou-feedback-list">
          {feedbackItems.map((feedback) => (
            <TantouFeedbackRow
              key={feedback.id}
              feedback={feedback}
              comments={commentMap[String(feedback.id)] || []}
              onAddComment={onAddComment}
              onResolve={onResolve}
            />
          ))}
        </div>
      ) : (
        <EmptyState title="No Tantou feedback" body="Tantou feedback on your manga pages will appear here after editors add page comments." />
      )}
    </div>
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

function TantouFeedbackRow({ feedback, comments, onAddComment, onResolve }) {
  const [comment, setComment] = useState("");
  const pageUrl = mediaUrlFrom(feedback, feedback.pageImageUrl, feedback.page_image_url);
  const resolved = isResolved(feedback);
  const created = feedback.createdAt || feedback.created_at || "";

  async function submitComment() {
    if (!comment.trim()) return;
    await onAddComment(feedback, comment);
    setComment("");
  }

  return (
    <div className="review-row tantou-feedback-row">
      <div className="review-main">
        <div className="row-between">
          <div>
            <p className="eyebrow">{feedback.seriesTitle || "Series"} / Chapter {feedback.chapterNumber || "-"} / Page {feedback.pageNumber || "-"}</p>
            <h3>Tantou feedback #{feedback.id}</h3>
          </div>
          <StatusBadge value={resolved ? "RESOLVED" : "OPEN"} />
        </div>

        <div className="feedback-card-body">
          <div className="feedback-page-preview">
            {pageUrl ? <img src={pageUrl} alt={`Page ${feedback.pageNumber}`} /> : <span>No page image</span>}
          </div>
          <div className="stack compact-stack">
            <div className="feedback-content-box">
              <strong>Tantou note</strong>
              <p>{feedbackContent(feedback)}</p>
            </div>
            <div className="meta-row wrap">
              <span>Editor: {feedback.editorName || feedback.editorEmail || "Tantou Editor"}</span>
              <span>Created: {created ? new Date(created).toLocaleString() : "-"}</span>
              <span>X {feedbackX(feedback).toFixed(1)}</span>
              <span>Y {feedbackY(feedback).toFixed(1)}</span>
              <span>W {feedbackWidth(feedback).toFixed(1)}</span>
              <span>H {feedbackHeight(feedback).toFixed(1)}</span>
            </div>

            <div className="comment-thread">
              <strong>Mangaka comments</strong>
              {comments.length ? comments.map((item) => (
                <div className="comment-bubble" key={item.id || feedbackContent(item)}>
                  <p>{cleanMangakaComment(item)}</p>
                  <small>{item.createdAt || item.created_at || "comment"}</small>
                </div>
              )) : <small>No Mangaka comment yet.</small>}
            </div>
          </div>
        </div>
      </div>

      <div className="vote-panel feedback-action-panel">
        <p className="review-helper">Reply to the Tantou Editor, then open the page canvas to fix the marked area.</p>
        <label>
          Mangaka comment
          <textarea rows="4" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Write your response or implementation note for the Tantou feedback." />
        </label>
        <div className="button-row vertical-buttons">
          <button className="btn btn-primary" onClick={submitComment} disabled={!comment.trim()}>Add comment</button>
          {!resolved && <button className="btn" onClick={() => onResolve(feedback)}>Mark resolved</button>}
          {feedback.pageId && <button className="btn" onClick={() => navigate(`/workspace/${feedback.pageId}?seriesId=${feedback.seriesId}&chapterId=${feedback.chapterId}`)}>Open page canvas</button>}
          {feedback.seriesId && <button className="btn" onClick={() => navigate(`/series/${feedback.seriesId}`)}>Open series</button>}
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
