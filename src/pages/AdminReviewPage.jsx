import { useEffect, useState } from "react";
import { api } from "../api/client";
import { navigate } from "../utils/router";
import { Alert, EmptyState, LoadingBlock, StatusBadge } from "../components/Status";

export default function AdminReviewPage() {
  const [series, setSeries] = useState([]);
  const [summaries, setSummaries] = useState({});
  const [tantous, setTantous] = useState([]);
  const [selectedTantou, setSelectedTantou] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pendingDecision, setPendingDecision] = useState(null);
  const [deciding, setDeciding] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const [reviewing, tantouUsers] = await Promise.all([
        api.series.list({ status: "REVIEWING", size: 100 }).catch(async () => api.series.list({ size: 100 })),
        api.users.byRole("Tantou Editor").catch(() => [])
      ]);
      const queue = (reviewing || []).filter((item) => String(item.status || "").toUpperCase() === "REVIEWING");
      setSeries(queue);
      setTantous(tantouUsers || []);
      const nextSummaries = {};
      await Promise.all(queue.slice(0, 40).map(async (item) => {
        nextSummaries[item.id] = await api.votes.summary(item.id).catch(() => null);
      }));
      setSummaries(nextSummaries);
    } catch (err) {
      setError(err.message || "Could not load admin final approval queue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function decide(seriesId, approved) {
    setDeciding(true);
    setError("");
    setMessage("");
    try {
      await api.series.adminDecision(seriesId, approved, selectedTantou[seriesId] || undefined);
      setPendingDecision(null);
      await load();
      setMessage(approved ? "Series approved by admin." : "Series rejected by admin.");
    } catch (err) {
      setError(err.message || "Admin decision failed.");
    } finally {
      setDeciding(false);
    }
  }

  if (loading) return <LoadingBlock label="Loading admin final approvals..." />;

  return (
    <section className="stack review-screen admin-final-review">
      <Alert type="success">{message}</Alert>
      <Alert type="danger">{error}</Alert>

      <div className="card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Admin final approval workflow</p>
            <h3>Final series decisions</h3>
            <small>Admin sees board vote totals, optionally assigns a Tantou Editor, then approves or rejects the series.</small>
          </div>
          <button className="btn btn-small" onClick={load}>Refresh</button>
        </div>

        {series.length ? (
          <div className="review-list">
            {series.map((item) => (
              <AdminDecisionRow
                key={item.id}
                item={item}
                summary={summaries[item.id]}
                tantous={tantous}
                selectedTantou={selectedTantou[item.id] || ""}
                onTantouChange={(value) => setSelectedTantou((old) => ({ ...old, [item.id]: value }))}
                onApprove={() => setPendingDecision({ item, approved: true, summary: summaries[item.id] })}
                onReject={() => setPendingDecision({ item, approved: false, summary: summaries[item.id] })}
              />
            ))}
          </div>
        ) : (
          <EmptyState title="No final approvals waiting" body="Series with status REVIEWING will appear here after they enter final approval." />
        )}
      </div>
      {pendingDecision && (
        <AdminDecisionModal
          decision={pendingDecision}
          tantouId={selectedTantou[pendingDecision.item.id] || ""}
          busy={deciding}
          onCancel={() => !deciding && setPendingDecision(null)}
          onConfirm={() => decide(pendingDecision.item.id, pendingDecision.approved)}
        />
      )}
    </section>
  );
}

function AdminDecisionModal({ decision, tantouId, busy, onCancel, onConfirm }) {
  const { item, approved, summary } = decision;
  return (
    <div className="feature-modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <div className="feature-modal-card admin-decision-modal" role="dialog" aria-modal="true" aria-labelledby="admin-decision-title" onMouseDown={(event) => event.stopPropagation()}>
        <p className="eyebrow">FE-18 final approval summary</p>
        <h3 id="admin-decision-title">{approved ? "Approve" : "Reject"} {item.title}?</h3>
        <p>{item.summary || item.description || "No series summary provided."}</p>
        <div className="metric-grid compact">
          <span>Total <strong>{summary?.totalVotes ?? "-"}</strong></span>
          <span>Yes <strong>{summary?.approvedVotes ?? "-"}</strong></span>
          <span>No <strong>{summary?.rejectedVotes ?? "-"}</strong></span>
          <span>Pending <strong>{summary?.pendingVotes ?? "-"}</strong></span>
        </div>
        <div className="admin-decision-summary"><span>Decision</span><strong>{approved ? "APPROVE" : "REJECT"}</strong><span>Tantou assignment</span><strong>{tantouId || "Keep current / unassigned"}</strong></div>
        <div className="button-row modal-actions"><button className="btn" disabled={busy} onClick={onCancel}>Cancel</button><button data-testid="admin-confirm-decision" className={approved ? "btn btn-primary" : "btn btn-danger"} disabled={busy} onClick={onConfirm}>{busy ? "Submitting..." : "Confirm final decision"}</button></div>
      </div>
    </div>
  );
}

function AdminDecisionRow({ item, summary, tantous, selectedTantou, onTantouChange, onApprove, onReject }) {
  return (
    <div className="review-row admin-review-row" data-testid={`admin-series-${item.id}`}>
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
          <span>Current Tantou: {item.tantouName || item.tantouUsername || "Unassigned"}</span>
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
        <select data-testid="admin-tantou-select" value={selectedTantou} onChange={(event) => onTantouChange(event.target.value)}>
          <option value="">Keep / assign Tantou optionally</option>
          {tantous.map((user) => <option key={user.id} value={user.id}>{user.fullName || user.username || user.email}</option>)}
        </select>
        <div className="button-row vertical-buttons">
          <button className="btn btn-primary" data-testid="admin-approve" onClick={onApprove}>Admin approve</button>
          <button className="btn btn-danger" onClick={onReject}>Admin reject</button>
          <button className="btn" onClick={() => navigate(`/series/${item.id}`)}>Open details</button>
        </div>
      </div>
    </div>
  );
}
