import { useEffect, useState } from "react";
import { api } from "../api/client";
import { navigate } from "../utils/router";
import { Alert, EmptyState, LoadingBlock, StatusBadge } from "../components/Status";

export default function EditorialBoardReviewPage() {
  const [series, setSeries] = useState([]);
  const [summaries, setSummaries] = useState({});
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

  useEffect(() => { load(); }, []);

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
            <small>Board members vote only. Admin final approval is handled on the Admin Final Approval screen.</small>
          </div>
          <button className="btn btn-small" onClick={load}>Refresh</button>
        </div>

        {series.length ? (
          <div className="review-list">
            {series.map((item) => (
              <BoardVoteRow key={item.id} item={item} summary={summaries[item.id]} onVote={vote} />
            ))}
          </div>
        ) : (
          <EmptyState title="No series waiting for board votes" body="Mangaka or Tantou can move a series to REVIEWING before the board vote phase." />
        )}
      </div>
    </section>
  );
}

function BoardVoteRow({ item, summary, onVote }) {
  return (
    <div className="review-row board-review-row">
      <button className="review-main review-clickable" onClick={() => navigate(`/series/${item.id}`)}>
        <div className="row-between">
          <div>
            <p className="eyebrow">Series #{item.id}</p>
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
          <button className="btn btn-primary" onClick={() => onVote(item.id, true)}>Vote approve</button>
          <button className="btn btn-danger" onClick={() => onVote(item.id, false)}>Vote reject</button>
          <button className="btn" onClick={() => navigate(`/series/${item.id}`)}>Open details</button>
        </div>
      </div>
    </div>
  );
}
