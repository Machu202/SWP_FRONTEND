import { useEffect, useMemo, useState } from "react";
import { api, mediaUrlFrom, normalizeTaskStatus, resolveMediaUrl } from "../api/client";
import { navigate } from "../utils/router";
import { Alert, EmptyState, LoadingBlock, StatusBadge } from "../components/Status";

const COMMENT_PREFIX = "[Mangaka Comment on Feedback #";

function normalizeList(value) {
  return Array.isArray(value) ? value : [];
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

function toFiniteNumber(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return 0;
}

function boxValue(source, ...keys) {
  for (const key of keys) {
    const numeric = Number(source?.[key]);
    if (Number.isFinite(numeric)) return numeric;
  }
  return 0;
}

function normalizeHitbox(raw) {
  if (!raw || typeof raw !== "object") return null;
  const source = raw.hitbox || raw.hitboxDto || raw.hitbox_dto || raw;
  const id = source.id ?? source.hitboxId ?? source.hitbox_id ?? null;
  const xCoord = toFiniteNumber(source.xCoord, source.x_coord, source.x, source.left);
  const yCoord = toFiniteNumber(source.yCoord, source.y_coord, source.y, source.top);
  const width = toFiniteNumber(source.width, source.w);
  const height = toFiniteNumber(source.height, source.h);
  if (width <= 0 || height <= 0) return null;
  return { ...source, id, xCoord, yCoord, width, height };
}

function taskHitboxId(task) {
  return firstValue(task?.hitboxId, task?.hitbox_id, task?.hitbox?.id, task?.hitboxDto?.id, task?.hitbox_dto?.id);
}

function taskPageId(task) {
  return firstValue(
    task?.pageId,
    task?.page_id,
    task?.page?.id,
    task?.hitbox?.pageId,
    task?.hitbox?.page_id,
    task?.hitbox?.page?.id,
    task?.hitboxDto?.pageId,
    task?.hitboxDto?.page_id
  );
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

function submittedUrl(task) {
  return mediaUrlFrom(task, task.submittedImageUrl, task.submitted_image_url, task.submissionUrl, task.submission_url, task.imageUrl, task.image_url);
}

function referenceUrl(task) {
  return mediaUrlFrom(
    task,
    task.referenceImageUrl,
    task.reference_image_url,
    task.pageImageUrl,
    task.page_image_url,
    task.page?.imageUrl,
    task.page?.image_url,
    task.hitbox?.page?.imageUrl,
    task.hitbox?.page?.image_url,
    task.hitboxDto?.page?.imageUrl,
    task.hitboxDto?.page?.image_url
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

function taskChapterLabel(task) {
  const title = firstValue(task?.chapterTitle, task?.chapter_title, task?.chapter?.title, task?.hitbox?.page?.chapter?.title);
  const number = firstValue(task?.chapterNumber, task?.chapter_number, task?.chapter?.chapterNumber, task?.chapter?.chapter_number, task?.hitbox?.page?.chapter?.chapterNumber, task?.hitbox?.page?.chapter?.chapter_number);
  if (title && number) return `Chapter ${number}: ${title}`;
  if (title) return title;
  if (number) return `Chapter ${number}`;
  return "-";
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

function directTaskHitbox(task) {
  return normalizeHitbox(task?.hitbox || task?.hitboxDto || task?.hitbox_dto || task);
}

function normalizeTaskForReview(task) {
  if (!task || typeof task !== "object") return task;
  return {
    ...task,
    seriesId: firstValue(task.seriesId, task.series_id, task.mangaSeriesId, task.manga_series_id, task.series?.id, task.mangaSeries?.id, task.manga_series?.id),
    seriesTitle: taskSeriesTitle(task) || task.seriesTitle,
    chapterId: taskChapterId(task) || task.chapterId,
    chapterDisplay: taskChapterLabel(task),
    pageId: taskPageId(task) || task.pageId,
    pageNumber: taskPageNumber(task) || task.pageNumber,
    assistantName: taskAssistantName(task) || task.assistantName,
    hitbox: directTaskHitbox(task) || task.hitbox
  };
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

function normalizeChapterStatus(status = "") {
  return String(status || "DRAFT").trim().toUpperCase().replace(/[\s-]+/g, "_") || "DRAFT";
}

function chapterLabel(chapter) {
  const number = firstValue(chapter?.chapterNumber, chapter?.chapter_number);
  const title = firstValue(chapter?.title, chapter?.chapterTitle, chapter?.chapter_title);
  if (number && title) return `Chapter ${number}: ${title}`;
  if (number) return `Chapter ${number}`;
  return title || "Chapter";
}

function chapterTantouId(chapter) {
  return firstValue(chapter?.tantouId, chapter?.tantou_id, chapter?.tantou?.id);
}

function chapterTantouName(chapter) {
  return firstValue(chapter?.tantouName, chapter?.tantou_name, displayName(chapter?.tantou));
}

function buildChapterHandoffs(chapters, allTasks, selectedSeriesId) {
  const tasksByChapter = new Map();
  normalizeList(allTasks).forEach((task) => {
    const chapterId = taskChapterId(task);
    if (!chapterId) return;
    const key = String(chapterId);
    if (!tasksByChapter.has(key)) tasksByChapter.set(key, []);
    tasksByChapter.get(key).push(task);
  });

  return normalizeList(chapters)
    .filter((chapter) => !selectedSeriesId || String(chapter.seriesId) === String(selectedSeriesId))
    .map((chapter) => {
      const chapterId = firstValue(chapter.id, chapter.chapterId, chapter.chapter_id);
      const chapterTasks = tasksByChapter.get(String(chapterId)) || [];
      const approvedTasks = chapterTasks.filter((task) => normalizeTaskStatus(task.status) === "APPROVED");
      const status = normalizeChapterStatus(chapter.publishStatus || chapter.publish_status || chapter.status);
      const tantouId = chapterTantouId(chapter);
      const allApproved = chapterTasks.length > 0 && approvedTasks.length === chapterTasks.length;
      const eligibleToSend = allApproved && ["DRAFT", "REVISION"].includes(status);
      const canSend = eligibleToSend && Boolean(tantouId);
      return {
        ...chapter,
        id: chapterId,
        status,
        label: chapterLabel(chapter),
        tasks: chapterTasks,
        approvedTasks: approvedTasks.length,
        allApproved,
        eligibleToSend,
        tantouId,
        tantouName: chapterTantouName(chapter),
        canSend
      };
    })
    .filter((chapter) => chapter.tasks.length > 0)
    .filter((chapter) => chapter.allApproved || ["REVIEWING", "READY_FOR_TANTOU", "TANTOU_REVIEW", "APPROVED", "REVISION"].includes(chapter.status))
    .sort((a, b) => Number(a.seriesId || 0) - Number(b.seriesId || 0) || Number(a.chapterNumber || 0) - Number(b.chapterNumber || 0));
}

export default function MangakaAssistantReviewPage() {
  const [activeTab, setActiveTab] = useState("tantou");
  const [series, setSeries] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [tantouUsers, setTantouUsers] = useState([]);
  const [selectedTantouBySeries, setSelectedTantouBySeries] = useState({});
  const [feedbackItems, setFeedbackItems] = useState([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("open");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sendingChapterId, setSendingChapterId] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const ownedSeries = await api.series.mine().catch(() => []);
      setSeries(ownedSeries || []);

      const [assistantData, tantouFeedback, availableTantous] = await Promise.all([
        loadAssistantSubmissions(ownedSeries || []),
        loadTantouFeedbackQueue(ownedSeries || []),
        api.users.byRole("Tantou Editor").catch(() => [])
      ]);

      setAllTasks(assistantData.allTasks);
      setTasks(assistantData.reviewTasks);
      setChapters(assistantData.chapters);
      setTantouUsers(normalizeList(availableTantous));
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

  const chapterHandoffs = useMemo(
    () => buildChapterHandoffs(chapters, allTasks, selectedSeriesId),
    [chapters, allTasks, selectedSeriesId]
  );

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
    const currentStatus = normalizeTaskStatus(task.status);
    const nextStatus = normalizeTaskStatus(status);
    if (currentStatus === nextStatus) {
      setError(`Task #${task.id} is already ${nextStatus}.`);
      return;
    }

    try {
      const updated = await api.tasks.review(task.id, nextStatus === "APPROVED");
      const mergedTask = normalizeTaskForReview({ ...task, ...updated });
      const merge = (items) => items.map((item) => String(item.id) === String(task.id) ? { ...item, ...mergedTask } : item);
      setAllTasks(merge);
      setTasks(merge);
      setMessage(successText);
    } catch (err) {
      setError(err.message || "Could not update this assistant submission.");
    }
  }

  async function sendChapterToTantou(chapter) {
    if (!chapter?.id || !chapter.eligibleToSend) return;
    setError("");
    setMessage("");
    setSendingChapterId(String(chapter.id));
    try {
      let tantouId = chapter.tantouId;
      let tantouName = chapter.tantouName;

      if (!tantouId) {
        tantouId = selectedTantouBySeries[String(chapter.seriesId)];
        if (!tantouId) throw new Error("Choose a Tantou Editor before sending this chapter.");
        const assignedSeries = await api.series.assignTantou(chapter.seriesId, tantouId);
        tantouId = firstValue(assignedSeries.tantouId, assignedSeries.tantou_id, tantouId);
        tantouName = firstValue(assignedSeries.tantouName, assignedSeries.tantou_name, tantouUsers.find((user) => String(user.id) === String(tantouId))?.fullName, tantouUsers.find((user) => String(user.id) === String(tantouId))?.username);
        setSeries((old) => old.map((item) => String(item.id) === String(chapter.seriesId) ? { ...item, ...assignedSeries, tantouId, tantouName } : item));
        setChapters((old) => old.map((item) => String(item.seriesId) === String(chapter.seriesId) ? { ...item, tantouId, tantouName } : item));
      }

      const updated = await api.chapters.status(chapter.id, "REVIEWING");
      setChapters((old) => old.map((item) => String(item.id) === String(chapter.id)
        ? { ...item, ...updated, tantouId, tantouName, publishStatus: updated.publishStatus || "REVIEWING", reviewReady: true }
        : item));
      const applyChapterStatus = (items) => items.map((task) => String(taskChapterId(task)) === String(chapter.id)
        ? { ...task, chapterStatus: updated.publishStatus || "REVIEWING", tantouId, tantouName }
        : task);
      setAllTasks(applyChapterStatus);
      setTasks(applyChapterStatus);
      setMessage(`${chapter.label} sent to ${tantouName || "the assigned Tantou Editor"} for review.`);
    } catch (err) {
      setError(err.message || "Could not send this chapter to Tantou review.");
    } finally {
      setSendingChapterId("");
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
            chapterHandoffs={chapterHandoffs}
            sendingChapterId={sendingChapterId}
            tantouUsers={tantouUsers}
            selectedTantouBySeries={selectedTantouBySeries}
            onSelectTantou={(seriesId, tantouId) => setSelectedTantouBySeries((old) => ({ ...old, [String(seriesId)]: tantouId }))}
            onSendChapter={sendChapterToTantou}
            onApprove={(task) => updateTask(task, "APPROVED", `Task #${task.id} approved. Review the chapter handoff section when all chapter tasks are approved.`)}
            onRevision={(task) => updateTask(task, "DOING", `Task #${task.id} sent back for revision.`)}
          />
        )}
      </div>
    </section>
  );
}

async function enrichAssistantSubmission(task) {
  const normalized = normalizeTaskForReview(task);
  if (normalized.hitbox) return normalized;

  const pageId = taskPageId(normalized);
  if (!pageId) return normalized;

  try {
    const hitboxId = taskHitboxId(normalized);
    const response = await api.workspace.hitboxes(pageId).catch(() => []);
    const rawList = Array.isArray(response)
      ? response
      : Array.isArray(response?.hitboxes)
        ? response.hitboxes
        : Array.isArray(response?.data)
          ? response.data
          : [];

    const boxes = rawList.map(normalizeHitbox).filter(Boolean);
    const selectedBox = hitboxId
      ? boxes.find((box) => String(box.id) === String(hitboxId))
      : boxes[0];

    return selectedBox ? { ...normalized, hitbox: selectedBox } : normalized;
  } catch {
    return normalized;
  }
}

async function loadAssistantSubmissions(ownedSeries) {
  const groups = await Promise.all(ownedSeries.map(async (item) => {
    const [list, chapterList] = await Promise.all([
      api.tasks.bySeries(item.id).catch(() => []),
      api.chapters.bySeries(item.id).catch(() => [])
    ]);
    const normalizedChapters = normalizeList(chapterList).map((chapter) => ({
      ...chapter,
      seriesId: firstValue(chapter.seriesId, chapter.series_id, item.id),
      seriesTitle: firstValue(chapter.seriesTitle, chapter.series_title, item.title),
      tantouId: firstValue(chapter.tantouId, chapter.tantou_id),
      tantouName: firstValue(chapter.tantouName, chapter.tantou_name, item.tantouName, item.tantou_name)
    }));
    const chaptersById = new Map(normalizedChapters.map((chapter) => [String(chapter.id), chapter]));
    const normalizedTasks = await Promise.all(normalizeList(list).map(async (task) => {
      const enriched = await enrichAssistantSubmission({
        ...task,
        seriesId: firstValue(task.seriesId, task.series_id, item.id),
        seriesTitle: firstValue(task.seriesTitle, task.series_title, item.title)
      });
      const chapter = chaptersById.get(String(taskChapterId(enriched)));
      return chapter ? {
        ...enriched,
        chapterId: chapter.id,
        chapterNumber: firstValue(enriched.chapterNumber, chapter.chapterNumber, chapter.chapter_number),
        chapterTitle: firstValue(enriched.chapterTitle, chapter.title),
        chapterDisplay: chapterLabel(chapter),
        chapterStatus: normalizeChapterStatus(chapter.publishStatus || chapter.publish_status),
        tantouId: chapterTantouId(chapter),
        tantouName: chapterTantouName(chapter)
      } : enriched;
    }));
    return { tasks: normalizedTasks, chapters: normalizedChapters };
  }));

  const allTasks = groups.flatMap((group) => group.tasks);
  return {
    allTasks,
    reviewTasks: allTasks.filter(isSubmittedForReview),
    chapters: groups.flatMap((group) => group.chapters)
  };
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

function AssistantSubmissionSection({ tasks, chapterHandoffs, sendingChapterId, tantouUsers, selectedTantouBySeries, onSelectTantou, onSendChapter, onApprove, onRevision }) {
  return (
    <div className="stack assistant-submission-workflow">
      <ChapterHandoffSection
        chapters={chapterHandoffs}
        sendingChapterId={sendingChapterId}
        tantouUsers={tantouUsers}
        selectedTantouBySeries={selectedTantouBySeries}
        onSelectTantou={onSelectTantou}
        onSendChapter={onSendChapter}
      />
      {tasks.length ? (
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
      )}
    </div>
  );
}

function ChapterHandoffSection({ chapters, sendingChapterId, tantouUsers, selectedTantouBySeries, onSelectTantou, onSendChapter }) {
  if (!chapters.length) return null;

  return (
    <div className="chapter-handoff-section" data-testid="chapter-handoff-section">
      <div className="row-between chapter-handoff-heading">
        <div>
          <p className="eyebrow">Chapter handoff</p>
          <h3>Send approved chapters to Tantou</h3>
          <small>Assistant task approval and chapter submission are separate steps. Each chapter is sent once after all of its tasks are approved.</small>
        </div>
      </div>
      <div className="chapter-handoff-grid">
        {chapters.map((chapter) => {
          const sent = ["REVIEWING", "READY_FOR_TANTOU", "TANTOU_REVIEW"].includes(chapter.status);
          const completed = ["APPROVED", "PUBLISHED"].includes(chapter.status);
          const noTantou = chapter.allApproved && !chapter.tantouId;
          return (
            <article className={`chapter-handoff-card handoff-${String(chapter.status).toLowerCase()}`} key={chapter.id} data-testid={`chapter-handoff-${chapter.id}`}>
              <div className="row-between">
                <div>
                  <p className="eyebrow">{chapter.seriesTitle || `Series #${chapter.seriesId}`}</p>
                  <h4>{chapter.label}</h4>
                </div>
                <StatusBadge value={chapter.status} />
              </div>
              <div className="chapter-handoff-progress">
                <span>{chapter.approvedTasks}/{chapter.tasks.length} Assistant tasks approved</span>
                <span>Tantou: {chapter.tantouName || "Unassigned"}</span>
              </div>
              {chapter.eligibleToSend && !chapter.tantouId ? (
                <div className="handoff-assign-controls">
                  <label htmlFor={`tantou-select-${chapter.seriesId}`}>Assign Tantou Editor</label>
                  <select
                    id={`tantou-select-${chapter.seriesId}`}
                    data-testid={`chapter-tantou-select-${chapter.seriesId}`}
                    value={selectedTantouBySeries[String(chapter.seriesId)] || ""}
                    onChange={(event) => onSelectTantou(chapter.seriesId, event.target.value)}
                  >
                    <option value="">Choose Tantou</option>
                    {tantouUsers.map((user) => <option key={user.id} value={user.id}>{displayName(user) || user.email || `User #${user.id}`}</option>)}
                  </select>
                  <button
                    className="btn btn-primary"
                    data-testid={`assign-and-send-chapter-${chapter.id}`}
                    disabled={!selectedTantouBySeries[String(chapter.seriesId)] || String(sendingChapterId) === String(chapter.id)}
                    onClick={() => onSendChapter(chapter)}
                  >
                    {String(sendingChapterId) === String(chapter.id) ? "Assigning and sending…" : "Assign Tantou and send chapter"}
                  </button>
                </div>
              ) : chapter.canSend ? (
                <button
                  className="btn btn-primary"
                  data-testid={`send-chapter-to-tantou-${chapter.id}`}
                  disabled={String(sendingChapterId) === String(chapter.id)}
                  onClick={() => onSendChapter(chapter)}
                >
                  {String(sendingChapterId) === String(chapter.id) ? "Sending…" : "Send chapter to Tantou"}
                </button>
              ) : sent ? (
                <div className="handoff-state success" data-testid={`chapter-sent-${chapter.id}`}>✓ Sent to Tantou for review</div>
              ) : completed ? (
                <div className="handoff-state success">✓ Tantou review completed</div>
              ) : noTantou ? (
                <div className="handoff-state warning">Approve all Assistant tasks first, then choose the Tantou Editor here.</div>
              ) : (
                <div className="handoff-state muted">Approve all Assistant tasks for this chapter before sending it.</div>
              )}
              {chapter.seriesId && <button className="btn btn-small" onClick={() => navigate(`/series/${chapter.seriesId}`)}>Open series</button>}
            </article>
          );
        })}
      </div>
    </div>
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
  const status = normalizeTaskStatus(task.status);
  const approved = status === "APPROVED";
  const awaitingDecision = status === "REVIEWING";
  return (
    <div className="review-row assistant-review-row" data-testid={`assistant-review-task-${task.id}`}>
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
          <span>Chapter: {task.chapterDisplay || task.chapterTitle || task.chapterNumber || "-"}</span>
          <span>Page: {task.pageNumber || "-"}</span>
          <span>Assistant: {task.assistantName || task.assistantUsername || task.assistantEmail || "Unassigned"}</span>
        </div>
        <div className="submission-preview-grid">
          <HitboxPreview title="Reference" url={reference} box={task.hitbox || directTaskHitbox(task)} />
          <Preview title="Submitted work" url={submitted} />
        </div>
      </div>
      <div className="vote-panel">
        {approved ? (
          <>
            <div className="approved-work-state" data-testid={`assistant-work-approved-${task.id}`}>
              <strong>✓ Assistant work approved</strong>
              <p>This task is complete. Use the chapter handoff section above to send the whole chapter to Tantou.</p>
            </div>
            <div className="button-row vertical-buttons">
              {task.seriesId && <button className="btn" onClick={() => navigate(`/series/${task.seriesId}`)}>Open series</button>}
            </div>
          </>
        ) : awaitingDecision ? (
          <>
            <p className="review-helper">Approve the Assistant work or return it to Doing for fixes.</p>
            <div className="button-row vertical-buttons">
              <button className="btn btn-primary" data-testid="approve-assistant-work" data-task-id={task.id} onClick={onApprove}>Approve assistant work</button>
              <button className="btn btn-danger" data-testid={`request-assistant-revision-${task.id}`} onClick={onRevision}>Request revision</button>
              {task.seriesId && <button className="btn" onClick={() => navigate(`/series/${task.seriesId}`)}>Open series</button>}
            </div>
          </>
        ) : (
          <>
            <p className="review-helper">This submission is not waiting for a Mangaka decision.</p>
            <div className="button-row vertical-buttons">
              {task.seriesId && <button className="btn" onClick={() => navigate(`/series/${task.seriesId}`)}>Open series</button>}
            </div>
          </>
        )}
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
    <div className="review-row tantou-feedback-row" data-testid={`tantou-feedback-${feedback.id}`}>
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
          {!resolved && <button className="btn" data-testid="resolve-feedback" onClick={() => onResolve(feedback)}>Mark resolved</button>}
          {feedback.pageId && <button className="btn" onClick={() => navigate(`/workspace/${feedback.pageId}?seriesId=${feedback.seriesId}&chapterId=${feedback.chapterId}`)}>Open page canvas</button>}
          {feedback.seriesId && <button className="btn" onClick={() => navigate(`/series/${feedback.seriesId}`)}>Open series</button>}
        </div>
      </div>
    </div>
  );
}

function HitboxPreview({ title, url, box }) {
  const resolved = resolveMediaUrl(url);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    setImageSize({ width: 0, height: 0 });
  }, [resolved]);

  if (!resolved) {
    return <div className="preview-box submission-preview"><strong>{title}</strong><span>No image</span></div>;
  }

  const originalWidth = Math.max(toFiniteNumber(imageSize.width, 1), 1);
  const originalHeight = Math.max(toFiniteNumber(imageSize.height, 1), 1);
  const x = boxValue(box, "xCoord", "x_coord", "x");
  const y = boxValue(box, "yCoord", "y_coord", "y");
  const width = boxValue(box, "width", "w");
  const height = boxValue(box, "height", "h");
  const hasBox = Boolean(box) && width > 0 && height > 0;
  const unitBox = hasBox && x >= 0 && y >= 0 && width > 0 && height > 0 && x <= 1 && y <= 1 && width <= 1 && height <= 1;

  const left = hasBox ? (unitBox ? x * 100 : (x / originalWidth) * 100) : 0;
  const top = hasBox ? (unitBox ? y * 100 : (y / originalHeight) * 100) : 0;
  const boxWidth = hasBox ? (unitBox ? width * 100 : (width / originalWidth) * 100) : 0;
  const boxHeight = hasBox ? (unitBox ? height * 100 : (height / originalHeight) * 100) : 0;

  return (
    <div className="preview-box submission-preview preview-box-hitbox">
      <strong>{title}</strong>
      <div className="preview-image-stage">
        <img
          src={resolved}
          alt={title}
          onLoad={(event) => setImageSize({ width: event.currentTarget.naturalWidth || 0, height: event.currentTarget.naturalHeight || 0 })}
        />
        {hasBox && imageSize.width > 0 && imageSize.height > 0 && (
          <div className="task-hitbox-overlay" style={{ left: `${left}%`, top: `${top}%`, width: `${boxWidth}%`, height: `${boxHeight}%` }}>
            <span className="task-hitbox-label">Task area</span>
          </div>
        )}
      </div>
      {hasBox ? (
        <small className="preview-hitbox-note">Mangaka hitbox is highlighted on the reference page.</small>
      ) : (
        <small className="preview-hitbox-note">No saved hitbox was returned for this task.</small>
      )}
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
