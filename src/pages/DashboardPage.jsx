import { useEffect, useMemo, useState } from "react";
import { api, hasRole, mediaUrlFrom, roleLabel } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useWorkspaceSelection } from "../context/WorkspaceSelectionContext";
import { navigate } from "../utils/router";
import { withWorkspaceSelection } from "../utils/workspaceRoute";
import { Alert, EmptyState, LoadingBlock, StatusBadge } from "../components/Status";

function safeDashboardCall(promise, fallback = [], timeoutMs = 7000) {
  return Promise.race([
    promise,
    new Promise((resolve) => window.setTimeout(() => resolve(fallback), timeoutMs))
  ]).catch(() => fallback);
}

function asList(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.content)) return value.content;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

function isReviewableSeries(series) {
  return String(series?.status || "").trim().toUpperCase() === "REVIEWING";
}

function taskSeriesId(task) {
  return task?.seriesId ?? task?.series_id ?? task?.series?.id ?? task?.mangaSeries?.id ?? task?.manga_series?.id ?? null;
}

function deadlineDate(item) {
  return item?.deadlineDate || item?.deadline_date || item?.deadlineDateStr || item?.date || "";
}

function validDate(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function localDateTimeInputValue(date = new Date(Date.now() + 5 * 60 * 1000)) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function launchCountdown(value, now = Date.now()) {
  const target = validDate(value);
  if (!target) return "";
  const remaining = target.getTime() - now;
  if (remaining <= 0) return "Launching…";
  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [days ? `${days}d` : "", `${String(hours).padStart(2, "0")}h`, `${String(minutes).padStart(2, "0")}m`, `${String(seconds).padStart(2, "0")}s`].filter(Boolean).join(" ");
}

function dashboardQueuePath(role) {
  if (hasRole(role, ["tantou"])) return "/tantou-review";
  if (hasRole(role, ["editorial", "board"])) return "/board-review";
  if (hasRole(role, ["admin"])) return "/admin-review";
  return "/series";
}

function dashboardSeriesTarget(role, series) {
  if (hasRole(role, ["tantou"])) return `/tantou-review?seriesId=${series.id}`;
  if (hasRole(role, ["editorial", "board"])) return `/board-review?seriesId=${series.id}`;
  if (hasRole(role, ["admin"])) return `/admin-review?seriesId=${series.id}`;
  return `/series/${series.id}`;
}

export default function DashboardPage() {
  const { profile, session } = useAuth();
  const role = profile?.roleName || session.role;
  const [data, setData] = useState({ series: [], tasks: [], notifications: [], reviewChapters: [], deadlines: [], telemetry: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const seriesPromise = hasRole(role, ["mangaka"])
        ? api.series.mine()
        : api.series.list({ size: 50 });

      const reviewChaptersPromise = hasRole(role, ["tantou"])
        ? api.chapters.tantouReview()
        : Promise.resolve([]);

      const [series, tasks, notifications, reviewChapters] = await Promise.all([
        safeDashboardCall(seriesPromise, []),
        safeDashboardCall(api.tasks.mine(), []),
        safeDashboardCall(api.notifications.unread(), []),
        safeDashboardCall(reviewChaptersPromise, [])
      ]);

      let seriesList = asList(series);
      if (hasRole(role, ["mangaka"])) {
        const approvedSeries = seriesList.filter((item) => String(item.status || "").toUpperCase() === "APPROVED");
        const scheduleResults = await Promise.all(approvedSeries.map(async (item) => ({
          id: String(item.id),
          schedules: asList(await safeDashboardCall(api.schedules.bySeries(item.id), []))
        })));
        const launchTimes = new Map(scheduleResults.map(({ id, schedules }) => [
          id,
          schedules.find((schedule) => String(schedule.frequency || "").toUpperCase() === "SERIES_LAUNCH")?.publishDate || ""
        ]));
        seriesList = seriesList.map((item) => ({ ...item, publicationScheduledAt: launchTimes.get(String(item.id)) || "" }));
      }
      const taskList = asList(tasks);
      const deadlineSeriesIds = [...new Set(taskList.map(taskSeriesId).filter(Boolean).map(String))];
      const deadlineLists = hasRole(role, ["assistant"]) && deadlineSeriesIds.length
        ? await Promise.all(deadlineSeriesIds.map((id) => safeDashboardCall(api.deadlines.bySeries(id), [])))
        : [];
      const deadlines = deadlineLists.flatMap(asList);
      const telemetry = seriesList[0]?.id
        ? await safeDashboardCall(api.telemetry.bySeries(seriesList[0].id), null, 4000)
        : null;

      setData({
        series: seriesList,
        tasks: taskList,
        notifications: asList(notifications),
        reviewChapters: asList(reviewChapters),
        deadlines,
        telemetry
      });
    } catch (err) {
      setData({ series: [], tasks: [], notifications: [], reviewChapters: [], deadlines: [], telemetry: null });
      setError(err.message || "Dashboard failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  function updateSeriesInDashboard(updatedSeries) {
    if (!updatedSeries?.id) return;
    setData((current) => ({
      ...current,
      series: current.series.map((item) => String(item.id) === String(updatedSeries.id) ? { ...item, ...updatedSeries } : item)
    }));
  }

  function removeSeriesFromDashboard(seriesId) {
    setData((current) => ({
      ...current,
      series: current.series.filter((item) => String(item.id) !== String(seriesId))
    }));
  }

  if (loading) return <LoadingBlock label="Loading dashboard..." />;

  return (
    <>
      <Alert type="danger">{error}</Alert>
      {hasRole(role, ["assistant"]) ? <AssistantDashboard data={data} profile={profile} session={session} /> : null}
      {hasRole(role, ["mangaka"]) ? <MangakaDashboard data={data} profile={profile} session={session} onSeriesUpdated={updateSeriesInDashboard} onSeriesDeleted={removeSeriesFromDashboard} /> : null}
      {hasRole(role, ["tantou"]) ? <EditorialDashboard data={data} role="Tantou Editor" /> : null}
      {hasRole(role, ["editorial", "board"]) ? <EditorialDashboard data={data} role="Editorial Board" /> : null}
      {hasRole(role, ["admin"]) ? <AdminDashboard data={data} /> : null}
      {!role && <GenericDashboard data={data} role={role} />}
      <KpiCharts data={data} />
    </>
  );
}

function MangakaDashboard({ data, onSeriesUpdated, onSeriesDeleted }) {
  const { selection: workspaceSelection, updateSelection } = useWorkspaceSelection();
  const openWorkspace = (path) => navigate(withWorkspaceSelection(path, workspaceSelection));
  const activeSeries = data.series.filter((item) => String(item.status || "").toUpperCase() !== "ARCHIVED");
  const [seriesActionId, setSeriesActionId] = useState("");
  const [seriesMessage, setSeriesMessage] = useState("");
  const [seriesError, setSeriesError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [publishTarget, setPublishTarget] = useState(null);
  const [publishMode, setPublishMode] = useState("NOW");
  const [publishAt, setPublishAt] = useState(() => localDateTimeInputValue());

  async function deleteRejectedSeries(series) {
    if (!series?.id || String(series.status || "").toUpperCase() !== "REJECTED") return;
    setSeriesActionId(String(series.id));
    setSeriesMessage("");
    setSeriesError("");
    try {
      await api.series.remove(series.id);
      onSeriesDeleted?.(series.id);
      if (String(workspaceSelection.seriesId) === String(series.id)) {
        updateSelection({ seriesId: "", chapterId: "", pageId: "" });
      }
      setSeriesMessage(`Deleted ${series.title || "Series"} and all related project data.`);
      setDeleteTarget(null);
    } catch (err) {
      setSeriesError(err.message || "Could not delete this series.");
    } finally {
      setSeriesActionId("");
    }
  }

  function openPublishModal(series) {
    if (String(series?.status || "").toUpperCase() !== "APPROVED") return;
    setPublishTarget(series);
    setPublishMode(series.publicationScheduledAt ? "SCHEDULE" : "NOW");
    setPublishAt(series.publicationScheduledAt
      ? localDateTimeInputValue(new Date(series.publicationScheduledAt))
      : localDateTimeInputValue());
    setSeriesError("");
    setSeriesMessage("");
  }

  async function publishSeries() {
    if (!publishTarget?.id || String(publishTarget.status || "").toUpperCase() !== "APPROVED") return;
    if (publishMode === "SCHEDULE" && (!publishAt || new Date(publishAt).getTime() <= Date.now())) {
      setSeriesError("Choose a future date and time for the series launch.");
      return;
    }
    setSeriesActionId(String(publishTarget.id));
    setSeriesError("");
    setSeriesMessage("");
    try {
      if (publishMode === "NOW") {
        const updated = await api.series.status(publishTarget.id, "ONGOING");
        onSeriesUpdated?.({ ...publishTarget, ...updated, publicationScheduledAt: "" });
        setSeriesMessage(`${publishTarget.title || "Series"} and its first approved chapter are now published.`);
      } else {
        const schedule = await api.series.schedulePublication(publishTarget.id, publishAt);
        const scheduledAt = schedule?.publishDate || schedule?.publish_date || publishAt;
        onSeriesUpdated?.({ ...publishTarget, publicationScheduledAt: scheduledAt });
        setSeriesMessage(`${publishTarget.title || "Series"} is scheduled to launch on ${new Date(scheduledAt).toLocaleString()}.`);
      }
      setPublishTarget(null);
    } catch (err) {
      setSeriesError(err.message || "Could not publish this series.");
    } finally {
      setSeriesActionId("");
    }
  }

  return (
    <section className="stack mangaka-dashboard-exact">
      <Alert type="success">{seriesMessage}</Alert>
      <Alert type="danger">{seriesError}</Alert>
      <div className="grid-layout">
        <div>
          <h3 style={{ marginBottom: 15, fontSize: 16, fontWeight: 700 }}>Active Series</h3>
          <div className="series-grid" id="active-series-container">
            {activeSeries.length ? activeSeries.slice(0, 4).map((series) => (
              <DashboardSeriesCard
                key={series.id}
                series={series}
                busy={String(seriesActionId) === String(series.id)}
                onDelete={() => setDeleteTarget(series)}
                onPublish={() => openPublishModal(series)}
              />
            )) : (
              <EmptyState icon="◇" title="No active series" body="Create a series to begin the Mangaka workflow." />
            )}
          </div>
        </div>

        <div>
          <div className="card-box">
            <div className="activity-header">
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>Quick Actions</h3>
            </div>
            <div className="quick-actions-grid">
              <button className="action-btn" onClick={() => navigate("/series")}><i>＋</i><span>+ New Series</span></button>
              <button className="action-btn" onClick={() => openWorkspace("/chapters-pages")}><i>▧</i><span>Chapters</span></button>
              <button className="action-btn" onClick={() => openWorkspace("/canvas-workspace")}><i>□</i><span>Canvas</span></button>
              <button className="action-btn" onClick={() => navigate("/tasks?tab=kanban")}><i>▤</i><span>Kanban</span></button>
              <button className="action-btn" onClick={() => openWorkspace("/schedule")}><i>◷</i><span>Schedule</span></button>
              <button className="action-btn" onClick={() => navigate("/assistant-review")}><i>☰</i><span>Review</span></button>
            </div>
          </div>

          <div className="card-box" style={{ marginTop: 20 }}>
            <div className="activity-header"><h3 style={{ fontSize: 14, fontWeight: 700 }}>Recent Activity</h3></div>
            {data.tasks.length ? (
              <div className="list">
                {data.tasks.slice(0, 4).map((task) => (
                  <div className="list-row" key={task.id}>
                    <div><strong>{task.description || `Task #${task.id}`}</strong><small>{task.seriesTitle || "No series"}</small></div>
                    <StatusBadge value={task.status} />
                  </div>
                ))}
              </div>
            ) : <div className="empty-activity">No workflow activity yet.</div>}
          </div>
        </div>
      </div>
      {deleteTarget ? (
        <div className="delete-modal-backdrop" role="presentation" onMouseDown={() => !seriesActionId && setDeleteTarget(null)}>
          <div className="delete-modal-card" role="dialog" aria-modal="true" aria-labelledby="dashboard-delete-series-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="delete-modal-icon">!</div>
            <h3 id="dashboard-delete-series-title">Delete {deleteTarget.title || "this manga series"} permanently?</h3>
            <p className="dashboard-delete-warning">This will delete every chapter, page, version, hitbox, task, feedback, schedule, deadline, vote and saved Editorial Board chat related to this series. This action cannot be undone.</p>
            <div className="delete-modal-actions">
              <button className="btn" type="button" disabled={Boolean(seriesActionId)} onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger solid-danger" data-testid={`confirm-delete-rejected-series-${deleteTarget.id}`} type="button" disabled={Boolean(seriesActionId)} onClick={() => deleteRejectedSeries(deleteTarget)}>{seriesActionId ? "Deleting..." : "Confirm Delete"}</button>
            </div>
          </div>
        </div>
      ) : null}
      {publishTarget ? (
        <div className="delete-modal-backdrop publish-modal-backdrop" role="presentation" onMouseDown={() => !seriesActionId && setPublishTarget(null)}>
          <div className="delete-modal-card publish-series-modal" role="dialog" aria-modal="true" aria-labelledby="dashboard-publish-series-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="publish-modal-icon">↗</div>
            <p className="eyebrow">Approved publication</p>
            <h3 id="dashboard-publish-series-title">Publish {publishTarget.title || "this manga series"}</h3>
            <p className="publish-modal-copy">Choose whether to publish the series with its first approved chapter now or schedule the public launch.</p>
            <div className="publish-mode-grid" role="radiogroup" aria-label="Publication method">
              <button type="button" className={publishMode === "NOW" ? "publish-mode-option active" : "publish-mode-option"} role="radio" aria-checked={publishMode === "NOW"} onClick={() => setPublishMode("NOW")}>
                <strong>Publish Chapter 1 now</strong><small>Series becomes ONGOING and the first approved chapter becomes PUBLISHED.</small>
              </button>
              <button type="button" className={publishMode === "SCHEDULE" ? "publish-mode-option active" : "publish-mode-option"} role="radio" aria-checked={publishMode === "SCHEDULE"} onClick={() => setPublishMode("SCHEDULE")}>
                <strong>Schedule launch</strong><small>Keep the series APPROVED until the backend countdown reaches the selected time.</small>
              </button>
            </div>
            {publishMode === "SCHEDULE" ? (
              <label className="publish-date-field">Launch date and time
                <input data-testid="publish-series-date" type="datetime-local" min={localDateTimeInputValue()} value={publishAt} onChange={(event) => setPublishAt(event.target.value)} />
                <small>Countdown: {launchCountdown(publishAt)}</small>
              </label>
            ) : null}
            <div className="delete-modal-actions">
              <button className="btn" type="button" disabled={Boolean(seriesActionId)} onClick={() => setPublishTarget(null)}>Cancel</button>
              <button className="btn btn-primary" data-testid={`confirm-publish-series-${publishTarget.id}`} type="button" disabled={Boolean(seriesActionId) || (publishMode === "SCHEDULE" && !publishAt)} onClick={publishSeries}>{seriesActionId ? "Publishing..." : publishMode === "NOW" ? "Publish Now" : "Schedule Launch"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function AssistantDashboard({ data, profile, session }) {
  const { selection: workspaceSelection } = useWorkspaceSelection();
  const openWorkspace = (path) => navigate(withWorkspaceSelection(path, workspaceSelection));
  const doing = data.tasks.filter((task) => /doing|progress/i.test(String(task.status || "")));
  const review = data.tasks.filter((task) => /review/i.test(String(task.status || "")));
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  return (
    <section className="stack assistant-dashboard-exact">
      <div className="ast-dashboard-header">
        <span>Production Assistant</span>
        <h1>
          Welcome, {profile?.fullName || profile?.username || session.username || "Assistant"}
          <span className="date">{today}</span>
        </h1>
      </div>

      <div className="ast-stats-grid">
        <div className="ast-stat-card dark">
          <div className="ast-stat-title"><span>Active assignments</span><span>Today</span></div>
          <div className="ast-stat-value">{data.tasks.length}<span> tasks</span></div>
          <div className="ast-stat-desc">{review.length} waiting for Mangaka review</div>
        </div>
        <div className="ast-stat-card">
          <div className="ast-stat-title"><span>In progress</span><span>Queue</span></div>
          <div className="ast-stat-value">{doing.length}<span> doing</span></div>
        </div>
      </div>

      <div className="assistant-home-grid">
        <div>
          <div className="section-title-row"><h3>Active Assignments</h3><button className="btn btn-small" onClick={() => navigate("/tasks?tab=assignments")}>Open All</button></div>
          <div className="ast-task-list">
            {data.tasks.length ? data.tasks.slice(0, 7).map((task) => <AssistantTaskItem key={task.id} task={task} />) : (
              <EmptyState icon="☑" title="No assignments yet" body="Assigned tasks from Mangaka will appear here." />
            )}
          </div>
        </div>

        <aside>
          <div className="ast-side-card">
            <div className="activity-header"><h3>Upcoming Deadlines</h3><button className="btn btn-small" onClick={() => openWorkspace("/schedule")}>Calendar</button></div>
            <AssistantDeadlineList deadlines={data.deadlines || []} />
          </div>
          <div className="ast-side-card">
            <div className="activity-header"><h3>Quick Resources</h3></div>
            <div className="ast-quick-grid">
              <button className="ast-quick-btn" onClick={() => navigate("/resources")}><i>□</i>Resources</button>
              <button className="ast-quick-btn" onClick={() => navigate("/tasks?tab=assignments")}><i>☁</i>Submit Work</button>
              <button className="ast-quick-btn" onClick={() => openWorkspace("/schedule")}><i>◷</i>Schedule</button>
              <button className="ast-quick-btn" onClick={() => navigate("/profile")}><i>◎</i>Profile</button>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function AssistantDeadlineList({ deadlines }) {
  const upcoming = [...deadlines]
    .map((item) => ({ item, date: validDate(deadlineDate(item)) }))
    .filter((entry) => entry.date)
    .sort((a, b) => a.date - b.date)
    .slice(0, 3);

  if (!upcoming.length) {
    return <div className="assistant-deadline-empty"><strong>No scheduled deadlines</strong><p className="review-helper">Deadlines for your assigned series will appear here.</p></div>;
  }

  return upcoming.map(({ item, date }) => (
    <div className="ast-deadline-item" key={item.id || `${item.eventName}-${date.toISOString()}`}>
      <div className="date-box"><div className="date-month">{date.toLocaleDateString(undefined, { month: "short" }).toUpperCase()}</div><div className="date-day">{date.getDate()}</div></div>
      <div><strong>{item.eventName || item.event_name || "Deadline"}</strong><p className="review-helper">{date.toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" })}</p></div>
    </div>
  ));
}

function EditorialDashboard({ data, role }) {
  const waiting = data.series.filter(isReviewableSeries);
  const isTantou = role === "Tantou Editor";
  const pendingChapters = (data.reviewChapters || []).filter((chapter) => !["APPROVED", "PUBLISHED", "ARCHIVED"].includes(String(chapter.publishStatus || "").toUpperCase()));
  const assignedSeriesCount = new Set((data.reviewChapters || []).map((chapter) => String(chapter.seriesId))).size;
  return (
    <section className="stack">
      <div className="hero-card">
        <div>
          <p className="eyebrow">{role} workspace</p>
          <h2>{isTantou ? "Production Review" : "Voting Dashboard"}</h2>
          <p>{isTantou ? "Check assigned chapters, page quality, and editor feedback." : "Review submitted series and vote on board approval."}</p>
        </div>
        <button className="btn-publish" onClick={() => navigate(isTantou ? "/tantou-review" : "/board-review")}>{isTantou ? "Open Review" : "Open Voting"}</button>
      </div>
      <div className="stats-grid">
        <Stat label={isTantou ? "Assigned series" : "Visible series"} value={isTantou ? assignedSeriesCount : data.series.length} tone="info" />
        <Stat label={isTantou ? "Chapter reviews" : "Reviewing"} value={isTantou ? pendingChapters.length : waiting.length} tone="warning" />
        <Stat label="My tasks" value={data.tasks.length} tone="success" />
        <Stat label="Unread" value={data.notifications.length} tone="danger" />
      </div>
      {isTantou
        ? <ChapterReviewListCard chapters={pendingChapters} />
        : <SeriesListCard title="Review queue" series={waiting} role={role} />}
    </section>
  );
}

function AdminDashboard({ data }) {
  return (
    <section className="stack">
      <div className="hero-card">
        <div>
          <p className="eyebrow">Administration Console</p>
          <h2>System and Publishing Control</h2>
          <p>Manage users, system parameters, schedules, and final approval decisions.</p>
        </div>
        <div className="button-row"><button className="btn" onClick={() => navigate("/admin/users")}>Users</button><button className="btn-publish" onClick={() => navigate("/admin-review")}>Final Approval</button></div>
      </div>
      <div className="stats-grid">
        <Stat label="Series" value={data.series.length} tone="info" />
        <Stat label="Tasks" value={data.tasks.length} tone="warning" />
        <Stat label="Unread" value={data.notifications.length} tone="danger" />
        <Stat label="Pending final" value={data.series.filter(isReviewableSeries).length} tone="success" />
      </div>
      <SeriesListCard title="Latest series" series={data.series} role="Admin" />
    </section>
  );
}

function GenericDashboard({ data, role }) {
  return (
    <section className="stack">
      <div className="hero-card"><div><p className="eyebrow">Welcome back</p><h2>MangaSystem user</h2><p>Your role is <strong>{roleLabel(role)}</strong>.</p></div></div>
      <SeriesListCard title="Series" series={data.series} role={role} />
    </section>
  );
}

function DashboardSeriesCard({ series, busy = false, onDelete, onPublish }) {
  const cover = mediaUrlFrom(series, series.coverImageUrl, series.cover_image_url, series.coverUrl, series.cover_url, series.imageUrl, series.image_url, series.thumbnailUrl, series.thumbnail_url);
  const status = String(series.status || "").trim().toUpperCase();
  const rejected = status === "REJECTED";
  const approved = status === "APPROVED";
  const alreadyPublished = ["ONGOING", "COMPLETED"].includes(status);
  const scheduledAt = series.publicationScheduledAt || series.publication_scheduled_at || "";
  const [countdownNow, setCountdownNow] = useState(Date.now());

  useEffect(() => {
    if (!scheduledAt) return undefined;
    const timer = window.setInterval(() => setCountdownNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [scheduledAt]);

  return (
    <article className="dashboard-series-card series-card dashboard-series-card-with-actions">
      <button className="dashboard-series-card-main" type="button" onClick={() => navigate(`/chapters-pages?seriesId=${series.id}`)}>
        <div className="series-cover">{cover ? <img src={cover} alt={series.title || "Series cover"} /> : <span>{(series.title || "M").slice(0, 1).toUpperCase()}</span>}</div>
        <div className="series-body">
          <div className="row-between"><strong>{series.title}</strong><StatusBadge value={series.status} /></div>
          <p>{series.summary || series.description || "No summary provided."}</p>
          <small>{series.genre || "Unknown genre"}</small>
        </div>
      </button>
      <div className="dashboard-series-workflow-actions">
        <button
          type="button"
          className={approved ? "btn btn-small btn-primary dashboard-publish-series-btn" : "btn btn-small dashboard-publish-series-btn"}
          data-testid={`publish-series-${series.id}`}
          disabled={busy || !approved}
          onClick={() => onPublish?.(series)}
          title={approved ? "Publish this approved manga series" : "Publish is available only after final Admin approval"}
        >
          {busy ? "Working…" : alreadyPublished ? "Published" : scheduledAt ? "Manage Publish" : "Publish"}
        </button>
        {rejected ? (
          <button
            type="button"
            className="btn btn-small btn-danger solid-danger dashboard-delete-series-btn"
            data-testid={`delete-rejected-series-${series.id}`}
            disabled={busy}
            onClick={() => onDelete?.(series)}
          >
            {busy ? "Deleting…" : "Delete Series"}
          </button>
        ) : null}
        {scheduledAt ? <small className="series-launch-countdown" data-testid={`series-launch-countdown-${series.id}`}>Launch in {launchCountdown(scheduledAt, countdownNow)}</small> : null}
      </div>
    </article>
  );
}

function AssistantTaskItem({ task }) {
  const thumb = mediaUrlFrom(task, task.submittedImageUrl, task.submitted_image_url, task.referenceImageUrl, task.reference_image_url, task.pageImageUrl, task.page_image_url, task.imageUrl, task.image_url, task.page);
  return (
    <button className="ast-task-item" onClick={() => navigate("/tasks?tab=assignments")}>
      <div className="ast-task-thumb">{thumb ? <img src={thumb} alt={task.description || `Task #${task.id}`} /> : <span>#{task.pageNumber || task.id}</span>}</div>
      <div className="ast-task-info">
        <div className="ast-task-title"><span>{task.description || `Task #${task.id}`}</span><StatusBadge value={task.status} /></div>
        <div className="ast-task-sub">{task.seriesTitle || "No series"} • Page {task.pageNumber || "?"}</div>
        <div className="ast-task-meta"><span>{task.chapterTitle || task.chapterNumber || "No chapter"}</span><span className="text-danger">Open detail</span></div>
      </div>
    </button>
  );
}

function ChapterReviewListCard({ chapters }) {
  return (
    <div className="card">
      <div className="card-header"><h3>Chapter review queue</h3><button className="btn btn-small" onClick={() => navigate("/tantou-review")}>Open</button></div>
      {chapters.length ? (
        <div className="list">
          {chapters.slice(0, 6).map((chapter) => (
            <button className="list-row interactive" key={chapter.id} onClick={() => navigate(`/tantou-review?seriesId=${chapter.seriesId}`)}>
              <div><strong>{chapter.seriesTitle || `Series #${chapter.seriesId}`}</strong><small>Chapter {chapter.chapterNumber}: {chapter.title || "Untitled"}</small></div>
              <StatusBadge value={chapter.publishStatus || "READY_FOR_TANTOU"} />
            </button>
          ))}
        </div>
      ) : <EmptyState icon="✓" title="No chapter reviews waiting" body="Chapters appear after Mangaka approves Assistant work and sends them to Tantou review." />}
    </div>
  );
}

function SeriesListCard({ title, series, role = "" }) {
  return (
    <div className="card">
      <div className="card-header"><h3>{title}</h3><button className="btn btn-small" onClick={() => navigate(dashboardQueuePath(role))}>Open</button></div>
      {series.length ? (
        <div className="list">
          {series.slice(0, 6).map((item) => (
            <button className="list-row interactive series-list-row-with-cover" key={item.id} onClick={() => navigate(dashboardSeriesTarget(role, item))}>
              <div className="mini-series-cover">{mediaUrlFrom(item, item.coverImageUrl, item.cover_image_url, item.coverUrl, item.cover_url, item.imageUrl, item.image_url, item.thumbnailUrl, item.thumbnail_url) ? <img src={mediaUrlFrom(item, item.coverImageUrl, item.cover_image_url, item.coverUrl, item.cover_url, item.imageUrl, item.image_url, item.thumbnailUrl, item.thumbnail_url)} alt={item.title || "Series cover"} /> : <span>{String(item.title || "M").slice(0, 1).toUpperCase()}</span>}</div>
              <div><strong>{item.title}</strong><small>{item.genre || item.mangakaName || "No genre"}</small></div>
              <StatusBadge value={item.status} />
            </button>
          ))}
        </div>
      ) : <EmptyState icon="◇" title="No series found" body="Your series will appear here." />}
    </div>
  );
}

function Stat({ label, value, tone }) {
  return <div className={`stat-card stat-${tone}`}><span>{label}</span><strong>{value}</strong></div>;
}

function KpiCharts({ data }) {
  const [activeChart, setActiveChart] = useState("tasks");
  const taskStatuses = ["TODO", "DOING", "REVIEWING", "APPROVED"].map((status) => ({
    label: status,
    value: data.tasks.filter((task) => String(task.status || "").toUpperCase().replace(/[\s-]+/g, "_") === status).length
  }));
  const seriesStatuses = ["DRAFT", "REVIEWING", "APPROVED", "REJECTED"].map((status) => ({
    label: status,
    value: data.series.filter((item) => String(item.status || "").toUpperCase() === status).length
  }));
  const telemetry = data.telemetry && typeof data.telemetry === "object"
    ? Object.entries(data.telemetry)
      .filter(([, value]) => Number.isFinite(Number(value)))
      .slice(0, 6)
      .map(([label, value]) => ({ label, value: Number(value) }))
    : [];
  const datasets = { tasks: taskStatuses, series: seriesStatuses, telemetry };
  const current = datasets[activeChart].length ? datasets[activeChart] : taskStatuses;
  const max = Math.max(...current.map((item) => item.value), 1);

  return (
    <section className="dashboard-kpi-card card" aria-label="Interactive KPI charts">
      <div className="card-header">
        <div><h3>Workflow KPI charts</h3></div>
        <div className="resource-filter-tabs compact-chart-tabs" role="tablist">
          <button className={activeChart === "tasks" ? "r-tab active" : "r-tab"} onClick={() => setActiveChart("tasks")}>Tasks</button>
          <button className={activeChart === "series" ? "r-tab active" : "r-tab"} onClick={() => setActiveChart("series")}>Series</button>
          <button className={activeChart === "telemetry" ? "r-tab active" : "r-tab"} onClick={() => setActiveChart("telemetry")}>Telemetry</button>
        </div>
      </div>
      <div className="kpi-chart" role="img" aria-label={`${activeChart} bar chart`}>
        {current.map((item) => (
          <button className="kpi-bar-item" key={item.label} title={`${item.label}: ${item.value}`}>
            <span className="kpi-value">{item.value}</span>
            <span className="kpi-bar-track"><span className="kpi-bar-fill" style={{ height: `${Math.max(6, (item.value / max) * 100)}%` }} /></span>
            <small>{String(item.label).replace(/_/g, " ")}</small>
          </button>
        ))}
      </div>
      {activeChart === "telemetry" && !telemetry.length && <p className="muted-note">No KPI data is available yet; task metrics are shown instead.</p>}
    </section>
  );
}
