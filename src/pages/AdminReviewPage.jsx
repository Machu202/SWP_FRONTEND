import { useEffect, useState } from "react";
import { api, seriesDisplayNumber } from "../api/client";
import { navigate, useHashRoute } from "../utils/router";
import { Alert, EmptyState, LoadingBlock, StatusBadge } from "../components/Status";
import { SeriesReviewDetails } from "./EditorialBoardReviewPage";

export default function AdminReviewPage() {
  const route = useHashRoute();
  const requestedSeriesId = route.params.get("seriesId") || "";
  const [series, setSeries] = useState([]);
  const [summaries, setSummaries] = useState({});
  const [tantous, setTantous] = useState([]);
  const [selectedTantou, setSelectedTantou] = useState({});
  const [tantouAssignments, setTantouAssignments] = useState({});
  const [expandedSeriesId, setExpandedSeriesId] = useState(requestedSeriesId);
  const [details, setDetails] = useState({});
  const [detailLoading, setDetailLoading] = useState({});
  const [detailErrors, setDetailErrors] = useState({});
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
      const [reviewing, tantouUsers, allSeries] = await Promise.all([
        api.series.list({ status: "REVIEWING", size: 100 }).catch(async () => api.series.list({ size: 100 })),
        api.users.byRole("Tantou Editor").catch(() => []),
        api.series.list({ size: 100 }).catch(() => [])
      ]);
      const queue = (reviewing || []).filter((item) => String(item.status || "").toUpperCase() === "REVIEWING");
      setSeries(queue);
      setTantous(tantouUsers || []);
      const occupied = {};
      (allSeries || []).forEach((item) => {
        const tantouId = item.tantouId ?? item.tantou_id ?? item.tantou?.id;
        if (tantouId) occupied[String(tantouId)] = item.id;
      });
      setTantouAssignments(occupied);
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

  useEffect(() => {
    if (!requestedSeriesId) return;
    setExpandedSeriesId(String(requestedSeriesId));
    loadSeriesDetails(requestedSeriesId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedSeriesId]);

  async function loadSeriesDetails(seriesId) {
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

  function toggleSeriesDetails(seriesId) {
    const key = String(seriesId);
    const isClosing = String(expandedSeriesId) === key;
    setExpandedSeriesId(isClosing ? "" : key);
    if (isClosing) {
      navigate("/admin-review");
    } else {
      loadSeriesDetails(seriesId);
      navigate(`/admin-review?seriesId=${seriesId}`);
    }
  }

  async function decide(seriesId, approved) {
    setDeciding(true);
    setError("");
    setMessage("");
    try {
      const selectedId = selectedTantou[seriesId] || undefined;
      const assignedTantouName = selectedId
        ? resolveTantouLabel(tantous, selectedId, pendingDecision?.item)
        : "";
      await api.series.adminDecision(seriesId, approved, selectedId);
      setPendingDecision(null);
      await load();
      setMessage(approved
        ? `Series approved by admin.${assignedTantouName ? ` Tantou Editor: ${assignedTantouName}.` : ""}`
        : "Series rejected by admin.");
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
                tantouAssignments={tantouAssignments}
                selectedTantou={selectedTantou[item.id] || ""}
                onTantouChange={(value) => setSelectedTantou((old) => ({ ...old, [item.id]: value }))}
                onApprove={() => setPendingDecision({ item, approved: true, summary: summaries[item.id] })}
                onReject={() => setPendingDecision({ item, approved: false, summary: summaries[item.id] })}
                expanded={String(expandedSeriesId) === String(item.id)}
                detail={details[String(item.id)]}
                detailLoading={Boolean(detailLoading[String(item.id)])}
                detailError={detailErrors[String(item.id)] || ""}
                onToggleDetails={toggleSeriesDetails}
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
          tantouLabel={resolveTantouLabel(
            tantous,
            selectedTantou[pendingDecision.item.id],
            pendingDecision.item
          )}
          busy={deciding}
          onCancel={() => !deciding && setPendingDecision(null)}
          onConfirm={() => decide(pendingDecision.item.id, pendingDecision.approved)}
        />
      )}
    </section>
  );
}

function displayUserName(user) {
  return user?.fullName || user?.full_name || user?.displayName || user?.username || user?.email || (user?.id ? `User #${user.id}` : "");
}

function resolveTantouLabel(tantous, selectedId, item) {
  if (selectedId) {
    const selected = (tantous || []).find((user) => String(user.id) === String(selectedId));
    return displayUserName(selected) || `Tantou Editor #${selectedId}`;
  }
  return item?.tantouName || item?.tantouUsername || "Keep current / unassigned";
}

function AdminDecisionModal({ decision, tantouLabel, busy, onCancel, onConfirm }) {
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
        <div className="admin-decision-summary"><span>Decision</span><strong>{approved ? "APPROVE" : "REJECT"}</strong><span>Tantou assignment</span><strong data-testid="admin-selected-tantou-name">{tantouLabel}</strong></div>
        <div className="button-row modal-actions"><button className="btn" disabled={busy} onClick={onCancel}>Cancel</button><button data-testid="admin-confirm-decision" className={approved ? "btn btn-primary" : "btn btn-danger"} disabled={busy} onClick={onConfirm}>{busy ? "Submitting..." : "Confirm final decision"}</button></div>
      </div>
    </div>
  );
}

function AdminDecisionRow({ item, summary, tantous, tantouAssignments, selectedTantou, onTantouChange, onApprove, onReject, expanded, detail, detailLoading, detailError, onToggleDetails }) {
  return (
    <div className={expanded ? "review-row admin-review-row admin-review-expanded" : "review-row admin-review-row"} data-testid={`admin-series-${item.id}`}>
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
          {tantous.map((user) => {
            const occupiedSeriesId = tantouAssignments[String(user.id)];
            const occupiedElsewhere = occupiedSeriesId && String(occupiedSeriesId) !== String(item.id);
            return <option key={user.id} value={user.id} disabled={Boolean(occupiedElsewhere)}>{displayUserName(user)}{occupiedElsewhere ? " — already assigned" : ""}</option>;
          })}
        </select>
        <div className="button-row vertical-buttons">
          <button className="btn btn-primary" data-testid="admin-approve" onClick={onApprove}>Admin approve</button>
          <button className="btn btn-danger" onClick={onReject}>Admin reject</button>
          <button className="btn" data-testid={`admin-open-series-${item.id}`} onClick={() => onToggleDetails(item.id)}>{expanded ? "Close Series" : "Open Series"}</button>
        </div>
      </div>
      {expanded ? (
        <SeriesReviewDetails item={item} detail={detail} loading={detailLoading} error={detailError} />
      ) : null}
    </div>
  );
}
