import { useEffect, useState } from "react";
import { api, hasRole } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { navigate } from "../utils/router";
import { Alert, EmptyState, LoadingBlock, StatusBadge } from "../components/Status";

export default function ReviewPage() {
  const { profile, session } = useAuth();
  const role = profile?.roleName || session.role;
  const [series, setSeries] = useState([]);
  const [summaries, setSummaries] = useState({});
  const [tantous, setTantous] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [reviewing, allTantous] = await Promise.all([
        api.series.list({ status: "REVIEWING", size: 50 }).catch(async () => api.series.list({ size: 50 })),
        api.users.byRole("Tantou Editor").catch(() => [])
      ]);
      setSeries(reviewing || []);
      setTantous(allTantous || []);
      const nextSummaries = {};
      await Promise.all((reviewing || []).slice(0, 20).map(async (item) => {
        try { nextSummaries[item.id] = await api.votes.summary(item.id); } catch { nextSummaries[item.id] = null; }
      }));
      setSummaries(nextSummaries);
    } catch (err) {
      setError(err.message || "Could not load review queue");
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
      setError(err.message || "Vote failed");
    }
  }

  async function adminDecision(seriesId, approved, tantouId) {
    setError("");
    setMessage("");
    try {
      await api.series.adminDecision(seriesId, approved, tantouId || undefined);
      setMessage(approved ? "Admin approved series." : "Admin rejected series.");
      await load();
    } catch (err) {
      setError(err.message || "Admin decision failed");
    }
  }

  if (loading) return <LoadingBlock label="Loading review queue..." />;

  const isAdmin = hasRole(role, ["admin"]);

  return (
    <section className="stack">
      <Alert type="success">{message}</Alert>
      <Alert type="danger">{error}</Alert>

      <div className="card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Editorial and admin workflow</p>
            <h3>Series waiting for review</h3>
          </div>
          <button className="btn btn-small" onClick={load}>Refresh</button>
        </div>

        {series.length ? (
          <div className="list">
            {series.map((item) => (
              <ReviewRow
                key={item.id}
                item={item}
                summary={summaries[item.id]}
                isAdmin={isAdmin}
                tantous={tantous}
                onVote={vote}
                onAdminDecision={adminDecision}
              />
            ))}
          </div>
        ) : <EmptyState title="No reviewing series" body="Mangaka can send a series to REVIEWING from the series detail page." />}
      </div>
    </section>
  );
}

function ReviewRow({ item, summary, isAdmin, tantous, onVote, onAdminDecision }) {
  const [tantouId, setTantouId] = useState("");
  return (
    <div className="review-row">
      <button className="review-main" onClick={() => navigate(`/series/${item.id}`)}>
        <strong>{item.title}</strong>
        <small>{item.summary || item.description || "No summary"}</small>
        <div className="meta-row"><StatusBadge value={item.status} /><span>Mangaka: {item.mangakaName || item.mangakaUsername || "-"}</span></div>
      </button>
      <div className="vote-panel">
        <div className="metric-grid compact">
          <span>Total <strong>{summary?.totalVotes ?? "-"}</strong></span>
          <span>Yes <strong>{summary?.approvedVotes ?? "-"}</strong></span>
          <span>No <strong>{summary?.rejectedVotes ?? "-"}</strong></span>
        </div>
        <div className="button-row">
          <button className="btn btn-small" onClick={() => onVote(item.id, true)}>Vote approve</button>
          <button className="btn btn-small btn-danger" onClick={() => onVote(item.id, false)}>Vote reject</button>
        </div>
        {isAdmin && (
          <div className="admin-decision">
            <select value={tantouId} onChange={(event) => setTantouId(event.target.value)}>
              <option value="">Assign Tantou optionally</option>
              {tantous.map((user) => <option key={user.id} value={user.id}>{user.fullName || user.username || user.email}</option>)}
            </select>
            <div className="button-row">
              <button className="btn btn-small btn-primary" onClick={() => onAdminDecision(item.id, true, tantouId)}>Admin approve</button>
              <button className="btn btn-small btn-danger" onClick={() => onAdminDecision(item.id, false, "")}>Admin reject</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
