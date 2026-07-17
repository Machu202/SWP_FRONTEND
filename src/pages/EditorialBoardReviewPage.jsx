import { useEffect, useState } from "react";
import { api, mediaUrlFrom, seriesDisplayNumber } from "../api/client";
import { navigate, useHashRoute } from "../utils/router";
import { Alert, EmptyState, LoadingBlock, StatusBadge } from "../components/Status";

export default function EditorialBoardReviewPage() {
  const route = useHashRoute();
  const requestedSeriesId = route.params.get("seriesId") || "";
  const [series, setSeries] = useState([]);
  const [summaries, setSummaries] = useState({});
  const [details, setDetails] = useState({});
  const [detailLoading, setDetailLoading] = useState({});
  const [detailErrors, setDetailErrors] = useState({});
  const [expandedSeriesId, setExpandedSeriesId] = useState(requestedSeriesId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const reviewing = await api.series.list({ status: "REVIEWING", size: 100 }).catch(async () => api.series.list({ size: 100 }));
      const queue = (reviewing || []).filter((item) => String(item.status || "").toUpperCase() === "REVIEWING");
      setSeries(queue);
      const nextSummaries = {};
      await Promise.all(queue.slice(0, 40).map(async (item) => {
        nextSummaries[item.id] = await api.votes.summary(item.id).catch(() => null);
      }));
      setSummaries(nextSummaries);
    } catch (err) {
      setError(err.message || "Could not load editorial board queue.");
    } finally {
      setLoading(false);
    }
  }

  async function loadDetails(seriesId) {
    const key = String(seriesId);
    if (details[key] || detailLoading[key]) return;

    setDetailLoading((old) => ({ ...old, [key]: true }));
    setDetailErrors((old) => ({ ...old, [key]: "" }));
    try {
      const [seriesDetail, chapterList] = await Promise.all([
        api.series.get(seriesId),
        api.chapters.bySeries(seriesId).catch(() => [])
      ]);

      const chapters = await Promise.all((chapterList || []).map(async (chapter) => {
        const [pages, script] = await Promise.all([
          api.pages.byChapter(chapter.id).catch(() => []),
          api.chapterScripts.get(chapter.id).catch(() => null)
        ]);
        return { ...chapter, pages: pages || [], script };
      }));

      setDetails((old) => ({ ...old, [key]: { series: seriesDetail, chapters } }));
    } catch (err) {
      setDetailErrors((old) => ({ ...old, [key]: err.message || "Could not load series details." }));
    } finally {
      setDetailLoading((old) => ({ ...old, [key]: false }));
    }
  }

  function toggleDetails(seriesId) {
    const key = String(seriesId);
    const isClosing = String(expandedSeriesId) === key;
    setExpandedSeriesId(isClosing ? "" : key);
    if (!isClosing) {
      loadDetails(seriesId);
      navigate(`/board-review?seriesId=${seriesId}`);
    } else {
      navigate("/board-review");
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!requestedSeriesId) return;
    setExpandedSeriesId(String(requestedSeriesId));
    loadDetails(requestedSeriesId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedSeriesId]);

  async function vote(seriesId, isApproved) {
    setError("");
    setMessage("");
    try {
      await api.votes.cast(seriesId, isApproved);
      const summary = await api.votes.summary(seriesId).catch(() => null);
      setSummaries((old) => ({ ...old, [seriesId]: summary }));
      setMessage(isApproved ? "Approval vote submitted." : "Reject vote submitted.");
    } catch (err) {
      setError(err.message || "Vote failed.");
    }
  }

  if (loading) return <LoadingBlock label="Loading editorial board review..." />;

  return (
    <section className="stack review-screen board-series-review">
      <Alert type="success">{message}</Alert>
      <Alert type="danger">{error}</Alert>

      <div className="card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Editorial board review workflow</p>
            <h3>Series waiting for board votes</h3>
            <small>Open details to review every chapter and page before casting a vote.</small>
          </div>
          <button className="btn btn-small" onClick={load}>Refresh</button>
        </div>

        {series.length ? (
          <div className="review-list">
            {series.map((item) => {
              const key = String(item.id);
              return (
                <BoardVoteRow
                  key={item.id}
                  item={item}
                  summary={summaries[item.id]}
                  onVote={vote}
                  expanded={String(expandedSeriesId) === key}
                  detail={details[key]}
                  detailLoading={Boolean(detailLoading[key])}
                  detailError={detailErrors[key] || ""}
                  onToggleDetails={toggleDetails}
                />
              );
            })}
          </div>
        ) : (
          <EmptyState title="No series waiting for board votes" body="Mangaka or Tantou can move a series to REVIEWING before the board vote phase." />
        )}
      </div>
    </section>
  );
}

function BoardVoteRow({ item, summary, onVote, expanded, detail, detailLoading, detailError, onToggleDetails }) {
  return (
    <article className={expanded ? "review-row board-review-row board-review-expanded" : "review-row board-review-row"} data-testid={`board-series-${item.id}`}>
      <button className="review-main review-clickable" onClick={() => onToggleDetails(item.id)} aria-expanded={expanded}>
        <div className="row-between">
          <div>
            <p className="eyebrow">Series #{seriesDisplayNumber(item)}</p>
            <h3>{item.title}</h3>
          </div>
          <StatusBadge value={item.status} />
        </div>
        <p>{item.summary || item.description || "No summary provided."}</p>
        <div className="meta-row wrap">
          <span>Mangaka: {item.mangakaName || item.mangakaUsername || "-"}</span>
          <span>Tantou: {item.tantouName || item.tantouUsername || "-"}</span>
          <span>Genre: {item.genre || "-"}</span>
        </div>
      </button>
      <div className="vote-panel">
        <div className="metric-grid compact">
          <span>Total <strong>{summary?.totalVotes ?? "-"}</strong></span>
          <span>Yes <strong>{summary?.approvedVotes ?? "-"}</strong></span>
          <span>No <strong>{summary?.rejectedVotes ?? "-"}</strong></span>
          <span>Pending <strong>{summary?.pendingVotes ?? "-"}</strong></span>
        </div>
        <div className="button-row vertical-buttons">
          <button className="btn btn-primary" data-testid="board-vote-approve" onClick={() => onVote(item.id, true)}>Vote approve</button>
          <button className="btn btn-danger" onClick={() => onVote(item.id, false)}>Vote reject</button>
          <button className="btn" data-testid={`board-open-details-${item.id}`} onClick={() => onToggleDetails(item.id)}>
            {expanded ? "Hide details" : "Open details"}
          </button>
        </div>
      </div>

      {expanded ? (
        <SeriesReviewDetails
          item={item}
          detail={detail}
          loading={detailLoading}
          error={detailError}
        />
      ) : null}
    </article>
  );
}

export function SeriesReviewDetails({ item, detail, loading, error }) {
  if (loading) {
    return <div className="board-series-details"><LoadingBlock label="Loading chapters and pages..." /></div>;
  }

  if (error) {
    return <div className="board-series-details"><Alert type="danger">{error}</Alert></div>;
  }

  const series = detail?.series || item;
  const chapters = detail?.chapters || [];
  const cover = mediaUrlFrom(series, series.coverImageUrl, series.cover_image_url, series.coverUrl, series.cover_url, series.imageUrl, series.image_url);

  return (
    <section className="board-series-details" data-testid={`board-series-details-${item.id}`}>
      <div className="board-detail-hero">
        <div className="board-detail-cover">
          {cover ? <img src={cover} alt={`${series.title} cover`} /> : <span>{String(series.title || "M").slice(0, 1)}</span>}
        </div>
        <div>
          <p className="eyebrow">Complete series review</p>
          <h3>{series.title}</h3>
          <p><strong>Summary:</strong> {series.summary || "No summary provided."}</p>
          {series.description ? <p><strong>Description:</strong> {series.description}</p> : null}
          <div className="meta-row wrap">
            <StatusBadge value={series.status} />
            <span>{chapters.length} chapter(s)</span>
            <span>{chapters.reduce((total, chapter) => total + (chapter.pages?.length || 0), 0)} page(s)</span>
          </div>
        </div>
      </div>

      <div className="board-chapter-list">
        {chapters.length ? chapters.map((chapter) => (
          <BoardChapterDetail key={chapter.id} chapter={chapter} />
        )) : (
          <EmptyState title="No chapters found" body="This series does not contain any chapters to review." />
        )}
      </div>
    </section>
  );
}

function BoardChapterDetail({ chapter }) {
  const pages = chapter.pages || [];
  const scriptText = String(chapter.script?.content || chapter.script?.script || chapter.script?.text || "").trim();

  return (
    <details className="board-chapter-detail" open>
      <summary>
        <div>
          <strong>Chapter {chapter.chapterNumber}: {chapter.title || "Untitled chapter"}</strong>
          <small>{pages.length} page(s){scriptText ? " · Script available" : " · No script"}</small>
        </div>
        <StatusBadge value={chapter.publishStatus || chapter.publish_status || chapter.status} />
      </summary>

      <div className="board-chapter-body">
        <div className="board-script-preview">
          <h4>Chapter script</h4>
          <p>{scriptText || "No chapter script was provided."}</p>
        </div>

        {pages.length ? (
          <div className="board-page-grid">
            {pages.map((page) => {
              const imageUrl = mediaUrlFrom(page, page.imageUrl, page.image_url, page.url);
              return (
                <figure key={page.id} className="board-page-card">
                  <div className="board-page-image">
                    {imageUrl ? <img src={imageUrl} alt={`Page ${page.pageNumber}`} /> : <span>No image</span>}
                  </div>
                  <figcaption>Page {page.pageNumber}</figcaption>
                </figure>
              );
            })}
          </div>
        ) : (
          <p className="review-helper">No pages were uploaded for this chapter.</p>
        )}
      </div>
    </details>
  );
}
