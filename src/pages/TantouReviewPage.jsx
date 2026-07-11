import { useEffect, useMemo, useState } from "react";
import { api, mediaUrlFrom, resolveMediaUrl } from "../api/client";
import { navigate } from "../utils/router";
import { Alert, EmptyState, LoadingBlock, StatusBadge } from "../components/Status";

function normalizeList(value) {
  return Array.isArray(value) ? value : [];
}

function isVisibleForTantou(series) {
  const status = String(series?.status || "").toUpperCase();
  // Do not block DRAFT series: the series status can remain DRAFT while
  // individual chapters/pages are already approved by Mangaka for Tantou review.
  return !["ARCHIVED", "CANCELLED"].includes(status);
}

export default function TantouReviewPage() {
  const [series, setSeries] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [pagesByChapter, setPagesByChapter] = useState({});
  const [selectedStatus, setSelectedStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const visibleSeries = await api.series.list({ size: 100 }).catch(() => []);
      const assignedSeries = (visibleSeries || []).filter(isVisibleForTantou);
      setSeries(assignedSeries);
      const chapterGroups = await Promise.all(assignedSeries.map(async (item) => {
        const list = await api.chapters.bySeries(item.id).catch(() => []);
        return normalizeList(list).map((chapter) => ({
          ...chapter,
          seriesId: chapter.seriesId || item.id,
          seriesTitle: chapter.seriesTitle || item.title,
          seriesStatus: item.status,
          mangakaName: item.mangakaName || item.mangakaUsername
        }));
      }));
      setChapters(chapterGroups.flat());
    } catch (err) {
      setError(err.message || "Could not load Tantou review queue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filteredChapters = useMemo(() => {
    if (!selectedStatus) return chapters;
    return chapters.filter((chapter) => String(chapter.publishStatus || chapter.status || "").toUpperCase() === selectedStatus);
  }, [chapters, selectedStatus]);

  async function loadPages(chapterId) {
    if (pagesByChapter[chapterId]) return;
    try {
      const pages = await api.pages.byChapter(chapterId).catch(() => []);
      setPagesByChapter((old) => ({ ...old, [chapterId]: pages || [] }));
    } catch (err) {
      setError(err.message || "Could not load pages for this chapter.");
    }
  }

  async function updateChapter(chapter, status) {
    setError("");
    setMessage("");
    try {
      const updated = await api.chapters.status(chapter.id, status);
      setChapters((old) => old.map((item) => String(item.id) === String(chapter.id) ? { ...item, ...updated, publishStatus: updated?.publishStatus || status } : item));
      setMessage(`Chapter ${chapter.chapterNumber || chapter.id} marked ${status}.`);
    } catch (err) {
      setError(err.message || "Could not update chapter review status.");
    }
  }

  if (loading) return <LoadingBlock label="Loading Tantou review queue..." />;

  return (
    <section className="stack review-screen tantou-chapter-review">
      <Alert type="success">{message}</Alert>
      <Alert type="danger">{error}</Alert>

      <div className="card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Tantou editor review workflow</p>
            <h3>Assigned series and chapter review</h3>
            <small>Use this screen to review chapters/pages before moving them toward board/admin approval.</small>
          </div>
          <div className="button-row">
            <select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)}>
              <option value="">All chapter statuses</option>
              <option value="DRAFT">DRAFT</option>
              <option value="REVIEWING">REVIEWING</option>
              <option value="APPROVED">APPROVED</option>
              <option value="REVISION">REVISION</option>
              <option value="PUBLISHED">PUBLISHED</option>
            </select>
            <button className="btn btn-small" onClick={load}>Refresh</button>
          </div>
        </div>

        {filteredChapters.length ? (
          <div className="review-list">
            {filteredChapters.map((chapter) => (
              <TantouChapterRow
                key={chapter.id}
                chapter={chapter}
                pages={pagesByChapter[chapter.id] || []}
                onLoadPages={() => loadPages(chapter.id)}
                onApprove={() => updateChapter(chapter, "APPROVED")}
                onRevision={() => updateChapter(chapter, "REVISION")}
              />
            ))}
          </div>
        ) : (
          <EmptyState title="No chapters in this review queue" body="Assigned series chapters will appear here after the backend returns them for the Tantou Editor role." />
        )}
      </div>

      {!series.length && <EmptyState title="No assigned series found" body="Make sure manga_series.tantou_id is assigned to this Tantou Editor user. DRAFT series are now allowed here if their chapters/pages are ready for review." />}
    </section>
  );
}

function TantouChapterRow({ chapter, pages, onLoadPages, onApprove, onRevision }) {
  return (
    <div className="review-row tantou-review-row">
      <div className="review-main">
        <div className="row-between">
          <div>
            <p className="eyebrow">{chapter.seriesTitle || "Series"}</p>
            <h3>Chapter {chapter.chapterNumber}: {chapter.title || "Untitled"}</h3>
          </div>
          <StatusBadge value={chapter.publishStatus || chapter.status || "DRAFT"} />
        </div>
        <div className="meta-row wrap">
          <span>Series ID: {chapter.seriesId}</span>
          <span>Mangaka: {chapter.mangakaName || "-"}</span>
          <span>Series status: {chapter.seriesStatus || "-"}</span>
        </div>

        {pages.length ? (
          <div className="page-strip">
            {pages.map((page) => {
              const url = mediaUrlFrom(page, page.imageUrl, page.image_url);
              return (
                <button key={page.id} className="page-mini" onClick={() => navigate(`/workspace/${page.id}?seriesId=${chapter.seriesId}&chapterId=${chapter.id}`)}>
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
        <p className="review-helper">Review the chapter content and page artwork, then approve it or request changes.</p>
        <div className="button-row vertical-buttons">
          <button className="btn btn-primary" onClick={onApprove}>Approve chapter</button>
          <button className="btn btn-danger" onClick={onRevision}>Request changes</button>
          <button className="btn" onClick={() => navigate(`/chapters-pages?seriesId=${chapter.seriesId}`)}>Open series</button>
        </div>
      </div>
    </div>
  );
}
