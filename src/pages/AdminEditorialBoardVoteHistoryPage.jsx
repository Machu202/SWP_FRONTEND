import { useEffect, useMemo, useState } from "react";
import { api, mediaUrlFrom } from "../api/client";
import { Alert, EmptyState, LoadingBlock } from "../components/Status";

function isApprovedVote(item) {
  const value = item?.isApproved ?? item?.is_approved ?? item?.approved;
  return value === true || String(value).toLowerCase() === "true";
}

function voteTime(item) {
  const raw = item?.votedAt || item?.voted_at || item?.createdAt || item?.created_at;
  if (!raw) return "Time unavailable";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? String(raw) : date.toLocaleString();
}

export default function AdminEditorialBoardVoteHistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setHistory(await api.votes.adminHistory());
    } catch (err) {
      setError(err.message || "Could not load Editorial Board vote history.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const memberGroups = useMemo(() => {
    const groups = new Map();
    history.forEach((item) => {
      const memberId = item.boardMemberId ?? item.board_member_id ?? "unknown";
      const key = String(memberId);
      if (!groups.has(key)) groups.set(key, {
        id: memberId,
        name: item.boardMemberName || item.board_member_name || `Editorial Board #${memberId}`,
        votes: []
      });
      groups.get(key).votes.push(item);
    });
    return Array.from(groups.values()).sort((left, right) => left.name.localeCompare(right.name));
  }, [history]);

  if (loading) return <LoadingBlock label="Loading Editorial Board vote history..." />;

  return (
    <section className="stack admin-board-vote-history-screen" data-testid="admin-board-vote-history">
      <Alert type="danger">{error}</Alert>
      <div className="card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Admin audit view</p>
            <h3>Editorial Board Vote History</h3>
            <small>Every recorded approval and rejection is grouped by Editorial Board user.</small>
          </div>
          <button className="btn btn-small" type="button" onClick={load}>Refresh</button>
        </div>

        {memberGroups.length ? (
          <div className="admin-board-member-history-list">
            {memberGroups.map((member) => (
              <article className="admin-board-member-history" key={member.id} data-testid={`admin-board-member-${member.id}`}>
                <header>
                  <div className="admin-board-member-avatar">{member.name.slice(0, 2).toUpperCase()}</div>
                  <div><strong>{member.name}</strong><small>{member.votes.length} recorded vote{member.votes.length === 1 ? "" : "s"}</small></div>
                </header>
                <div className="admin-board-vote-table-wrap">
                  <table className="admin-board-vote-table">
                    <thead><tr><th>Manga series</th><th>Vote</th><th>Time</th></tr></thead>
                    <tbody>
                      {member.votes.map((item, index) => {
                        const approved = isApprovedVote(item);
                        const title = item.seriesTitle || item.series_title || "Manga Series";
                        const cover = mediaUrlFrom(item, item.coverImageUrl, item.cover_image_url);
                        return (
                          <tr key={`${item.voteId ?? item.vote_id ?? index}-${index}`}>
                            <td><div className="admin-vote-series-cell">{cover ? <img src={cover} alt="" /> : <span>{title.slice(0, 1).toUpperCase()}</span>}<strong>{title}</strong></div></td>
                            <td><span className={approved ? "admin-vote-decision approve" : "admin-vote-decision reject"}>{approved ? "APPROVE" : "REJECT"}</span></td>
                            <td><small>{voteTime(item)}</small></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </article>
            ))}
          </div>
        ) : <EmptyState title="No Editorial Board vote history" body="Votes will appear here after Editorial Board users vote on submitted manga series." />}
      </div>
    </section>
  );
}
