import { useEffect, useState } from "react";
import { api, mediaUrlFrom } from "../api/client";
import { Alert, EmptyState, LoadingBlock, StatusBadge } from "../components/Status";

function voteDecision(item) {
  const approved = item?.isApproved ?? item?.approved ?? item?.is_approved;
  return approved === true || String(approved).toLowerCase() === "true";
}

function voteTime(item) {
  const raw = item?.votedAt || item?.voted_at || item?.createdAt || item?.created_at;
  if (!raw) return "Time unavailable";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? String(raw) : date.toLocaleString();
}

export default function EditorialBoardVoteHistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setHistory(await api.votes.history());
    } catch (err) {
      setError(err.message || "Could not load your vote history.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <LoadingBlock label="Loading your vote history..." />;

  return (
    <section className="stack board-vote-history-screen">
      <Alert type="danger">{error}</Alert>

      <div className="card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Editorial Board personal record</p>
            <h3>My Vote History</h3>
            <small>Every approval or rejection vote cast by this account is listed newest first.</small>
          </div>
          <button className="btn btn-small" type="button" onClick={load}>Refresh</button>
        </div>

        {history.length ? (
          <div className="vote-history-list" data-testid="board-vote-history-list">
            {history.map((item, index) => {
              const approved = voteDecision(item);
              const title = item.seriesTitle || item.series_title || "Manga Series";
              const cover = mediaUrlFrom(item, item.coverImageUrl, item.cover_image_url);
              return (
                <article className="vote-history-card" key={`${item.voteId ?? item.id ?? index}-${index}`} data-testid={`vote-history-${item.voteId ?? item.id ?? index}`}>
                  <div className="vote-history-cover">
                    {cover ? <img src={cover} alt={`${title} cover`} /> : <span>{title.slice(0, 1).toUpperCase()}</span>}
                  </div>
                  <div className="vote-history-content">
                    <div className="row-between">
                      <div>
                        <p className="eyebrow">Vote #{history.length - index}</p>
                        <h3>{title}</h3>
                      </div>
                      <StatusBadge value={item.seriesStatus || item.series_status || "UNKNOWN"} />
                    </div>
                    <p>{item.summary || item.description || "No series summary provided."}</p>
                    <div className="meta-row wrap">
                      <span>Genre: {item.genre || "-"}</span>
                      <span className={approved ? "vote-history-decision approved" : "vote-history-decision rejected"}>
                        {approved ? "Voted APPROVE" : "Voted REJECT"}
                      </span>
                      <small>{voteTime(item)}</small>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState title="No vote history yet" body="Your approval and rejection votes will appear here after you vote on a manga series." />
        )}
      </div>
    </section>
  );
}
