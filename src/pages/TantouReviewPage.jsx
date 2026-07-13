import { useEffect, useMemo, useState } from "react";
import { api, mediaUrlFrom } from "../api/client";
import { navigate, useHashRoute } from "../utils/router";
import { Alert, EmptyState, LoadingBlock, StatusBadge } from "../components/Status";

function normalizeList(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.content)) return value.content;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

function normalizeStatus(value, fallback = "") {
  const normalized = String(value ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  return normalized || fallback;
}

function chapterStatus(chapter) {
  return normalizeStatus(
    chapter?.publishStatus ??
    chapter?.publish_status ??
    chapter?.status,
    "DRAFT"
  );
}

function canTantouDecide(chapter) {
  return [
    "READY_FOR_TANTOU",
    "REVIEWING",
    "IN_REVIEW",
    "PENDING_REVIEW",
    "MANGAKA_APPROVED",
    "TANTOU_REVIEW"
  ].includes(chapterStatus(chapter));
}

function seriesStatus(series) {
  return normalizeStatus(series?.status, "DRAFT");
}

export default function TantouReviewPage() {
  const route = useHashRoute();
  const requestedSeriesId = route.params.get("seriesId") || "";
  const [chapters, setChapters] = useState([]);
  const [seriesDetails, setSeriesDetails] = useState({});
  const [pagesByChapter, setPagesByChapter] = useState({});
  const [selectedStatus, setSelectedStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyChapterId, setBusyChapterId] = useState("");
  const [busySeriesId, setBusySeriesId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load({ keepMessage = false } = {}) {
    setLoading(true);
    setError("");
    if (!keepMessage) setMessage("");
    try {
      const queue = normalizeList(await api.chapters.tantouReview());
      setChapters(queue);

      const seriesIds = [...new Set(queue.map((chapter) => String(chapter.seriesId || "")).filter(Boolean))];
      const entries = await Promise.all(seriesIds.map(async (id) => {
        const [series, allChapters] = await Promise.all([
          api.series.get(id).catch(() => null),
          api.chapters.bySeries(id).then(normalizeList).catch(() => [])
        ]);
        return [id, { series, chapters: allChapters }];
      }));
      setSeriesDetails(Object.fromEntries(entries));
    } catch (err) {
      setChapters([]);
      setSeriesDetails({});
      setError(err.message || "Could not load Tantou chapter review queue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const visibleChapters = useMemo(() => {
    return chapters.filter((chapter) => {
      if (requestedSeriesId && String(chapter.seriesId) !== String(requestedSeriesId)) return false;
      if (selectedStatus && chapterStatus(chapter) !== selectedStatus) return false;
      return true;
    });
  }, [chapters, requestedSeriesId, selectedStatus]);

  const visibleSeries = useMemo(() => {
    return Object.entries(seriesDetails)
      .filter(([id]) => !requestedSeriesId || String(id) === String(requestedSeriesId))
      .map(([id, detail]) => ({ id, ...detail }));
  }, [seriesDetails, requestedSeriesId]);

  const pendingCount = useMemo(() => chapters.filter(canTantouDecide).length, [chapters]);
  const assignedSeriesCount = useMemo(() => new Set(chapters.map((chapter) => String(chapter.seriesId))).size, [chapters]);

  async function loadPages(chapterId) {
    if (pagesByChapter[chapterId]) return;
    try {
      const pages = normalizeList(await api.pages.byChapter(chapterId));
      setPagesByChapter((old) => ({ ...old, [chapterId]: pages }));
    } catch (err) {
      setError(err.message || "Could not load pages for this chapter.");
    }
  }

  async function updateChapter(chapter, status) {
    setError("");
    setMessage("");
    setBusyChapterId(String(chapter.id));
    try {
      await api.chapters.status(chapter.id, status);
      if (status === "REVISION") {
        setMessage(`Chapter ${chapter.chapterNumber || chapter.id} was sent back to the Mangaka for revision.`);
      } else {
        setMessage(`Chapter ${chapter.chapterNumber || chapter.id} was approved by Tantou.`);
      }
      await load({ keepMessage: true });
    } catch (err) {
      setError(err.message || "Could not update chapter review status.");
    } finally {
      setBusyChapterId("");
    }
  }

  async function sendSeriesToBoard(id) {
    setError("");
    setMessage("");
    setBusySeriesId(String(id));
    try {
      const updated = await api.series.submitToBoard(id);
      setSeriesDetails((old) => ({
        ...old,
        [String(id)]: {
          ...(old[String(id)] || {}),
          series: updated
        }
      }));
      setMessage(`${updated?.title || `Series ${id}`} was sent to the Editorial Board.`);
    } catch (err) {
      setError(err.message || "Could not send this series to the Editorial Board.");
    } finally {
      setBusySeriesId("");
    }
  }

  if (loading) return <LoadingBlock label="Loading Tantou chapter review queue..." />;

  return (
    <section className="stack review-screen tantou-chapter-review">
      <Alert type="success">{message}</Alert>
      <Alert type="danger">{error}</Alert>

      <div className="stats-grid tantou-review-summary">
        <div className="stat-card stat-warning"><span>Waiting for review</span><strong>{pendingCount}</strong></div>
        <div className="stat-card stat-info"><span>Assigned series</span><strong>{assignedSeriesCount}</strong></div>
        <div className="stat-card stat-success"><span>Approved chapters</span><strong>{chapters.filter((chapter) => chapterStatus(chapter) === "APPROVED").length}</strong></div>
      </div>

      <div className="card tantou-board-handoff-card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Series-level handoff</p>
            <h3>Editorial Board handoff</h3>
            <small>A series can be sent only after every chapter has been approved by the assigned Tantou Editor.</small>
          </div>
        </div>

        {visibleSeries.length ? (
          <div className="tantou-board-handoff-list" data-testid="tantou-board-handoff-list">
            {visibleSeries.map(({ id, series, chapters: allChapters }) => (
              <SeriesBoardHandoff
                key={id}
                seriesId={id}
                series={series}
                chapters={allChapters}
                busy={String(busySeriesId) === String(id)}
                onSend={() => sendSeriesToBoard(id)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No assigned series ready for Board handoff"
            body="Review chapters first. Once all chapters are Tantou-approved, the series handoff action appears here."
          />
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Tantou editor review workflow</p>
            <h3>Chapter reviewing</h3>
            <small>Approve a chapter, or send it back to the Mangaka with revision status.</small>
          </div>
          <div className="button-row">
            <select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)}>
              <option value="">All chapter statuses</option>
              <option value="READY_FOR_TANTOU">READY FOR TANTOU</option>
              <option value="REVIEWING">REVIEWING</option>
              <option value="REVISION">REVISION</option>
              <option value="APPROVED">APPROVED</option>
              <option value="PUBLISHED">PUBLISHED</option>
            </select>
            <button className="btn btn-small" onClick={() => load()}>Refresh</button>
          </div>
        </div>

        {visibleChapters.length ? (
          <div className="review-list" data-testid="tantou-chapter-review-list">
            {visibleChapters.map((chapter) => (
              <TantouChapterRow
                key={chapter.id}
                chapter={chapter}
                pages={pagesByChapter[chapter.id] || []}
                busy={String(busyChapterId) === String(chapter.id)}
                onLoadPages={() => loadPages(chapter.id)}
                onApprove={() => updateChapter(chapter, "APPROVED")}
                onRevision={() => updateChapter(chapter, "REVISION")}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title={requestedSeriesId ? "No reviewable chapters for this series" : "No chapters in this review queue"}
            body="A chapter appears after the Mangaka approves the Assistant work and sends the chapter to Tantou review."
          />
        )}
      </div>
    </section>
  );
}

function SeriesBoardHandoff({ seriesId, series, chapters, busy, onSend }) {
  const status = seriesStatus(series);
  const total = chapters.length;
  const approved = chapters.filter((chapter) => chapterStatus(chapter) === "APPROVED").length;
  const blockers = chapters.filter((chapter) => chapterStatus(chapter) !== "APPROVED");
  const ready = total > 0 && approved === total && status === "DRAFT";
  const alreadySent = status === "REVIEWING";
  const closed = ["APPROVED", "REJECTED", "ONGOING", "COMPLETED", "CANCELLED", "ARCHIVED"].includes(status);

  return (
    <div className="tantou-board-handoff-row" data-testid={`tantou-board-handoff-${seriesId}`}>
      <div>
        <div className="row-between">
          <div>
            <p className="eyebrow">{series?.title || `Series ${seriesId}`}</p>
            <h4>{approved}/{total} chapters approved</h4>
          </div>
          <StatusBadge value={status} />
        </div>
        {blockers.length ? (
          <p className="review-helper">
            Waiting on {blockers.map((chapter) => `Chapter ${chapter.chapterNumber || chapter.id} (${chapterStatus(chapter)})`).join(", ")}.
          </p>
        ) : total ? (
          <p className="review-helper">Every chapter is Tantou-approved and ready for Editorial Board review.</p>
        ) : (
          <p className="review-helper">This series has no chapters and cannot be submitted.</p>
        )}
      </div>
      <div className="button-row">
        {alreadySent ? <span className="status-pill success" data-testid={`series-board-sent-${seriesId}`}>Sent to Editorial Board</span> : null}
        {closed ? <span className="status-pill">Series {status.toLowerCase()}</span> : null}
        {!alreadySent && !closed ? (
          <button
            className="btn btn-primary"
            type="button"
            data-testid={`send-series-to-board-${seriesId}`}
            disabled={!ready || busy}
            onClick={onSend}
          >
            {busy ? "Sending..." : "Send series to Editorial Board"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function TantouChapterRow({ chapter, pages, busy, onLoadPages, onApprove, onRevision }) {
  const status = chapterStatus(chapter);
  const canDecide = canTantouDecide(chapter);
  const approved = status === "APPROVED";
  const sentBack = status === "REVISION";

  return (
    <div className="review-row tantou-review-row" data-testid={`tantou-review-chapter-${chapter.id}`}>
      <div className="review-main">
        <div className="row-between">
          <div>
            <p className="eyebrow">{chapter.seriesTitle || "Series"}</p>
            <h3>Chapter {chapter.chapterNumber}: {chapter.title || "Untitled"}</h3>
          </div>
          <StatusBadge value={status} />
        </div>
        <div className="meta-row wrap">
          <span>Series ID: {chapter.seriesId}</span>
          <span>Mangaka: {chapter.mangakaName || "-"}</span>
          {chapter.tantouName ? <span>Tantou: {chapter.tantouName}</span> : null}
        </div>

        {chapter.reviewReady && status === "READY_FOR_TANTOU" ? (
          <p className="review-helper">Recovered from approved Assistant work created before the chapter review-state fix.</p>
        ) : null}

        {pages.length ? (
          <div className="page-strip">
            {pages.map((page) => {
              const url = mediaUrlFrom(page, page.imageUrl, page.image_url);
              return (
                <button key={page.id} className="page-mini" onClick={() => navigate(`/canvas-workspace?seriesId=${chapter.seriesId}&chapterId=${chapter.id}&pageId=${page.id}`)}>
                  {url ? <img src={url} alt={`Page ${page.pageNumber}`} /> : <span>No image</span>}
                  <small>Page {page.pageNumber}</small>
                </button>
              );
            })}
          </div>
        ) : (
          <button className="btn btn-small fit" onClick={onLoadPages}>Load pages for review</button>
        )}
      </div>
      <div className="vote-panel">
        {approved ? <p className="review-helper success-text">✓ Tantou approved this chapter.</p> : null}
        {sentBack ? <p className="review-helper warning-text">Sent back to Mangaka. Waiting for correction and resubmission.</p> : null}
        {canDecide ? <p className="review-helper">Review the pages, then choose the next workflow destination.</p> : null}
        <div className="button-row vertical-buttons">
          {canDecide ? (
            <>
              <button className="btn btn-primary" data-testid={`tantou-approve-chapter-${chapter.id}`} onClick={onApprove} disabled={busy}>Approve chapter</button>
              <button className="btn btn-danger" data-testid={`tantou-return-chapter-${chapter.id}`} onClick={onRevision} disabled={busy}>Send back to Mangaka</button>
            </>
          ) : null}
          <button className="btn" onClick={() => navigate(`/chapters-pages?seriesId=${chapter.seriesId}`)}>Open series</button>
        </div>
      </div>
    </div>
  );
}
