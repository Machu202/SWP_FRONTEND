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

      const seriesList = asList(series);
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

  if (loading) return <LoadingBlock label="Loading dashboard..." />;

  return (
    <>
      <Alert type="danger">{error}</Alert>
      {hasRole(role, ["assistant"]) ? <AssistantDashboard data={data} profile={profile} session={session} /> : null}
      {hasRole(role, ["mangaka"]) ? <MangakaDashboard data={data} profile={profile} session={session} onSeriesUpdated={updateSeriesInDashboard} /> : null}
      {hasRole(role, ["tantou"]) ? <EditorialDashboard data={data} role="Tantou Editor" /> : null}
      {hasRole(role, ["editorial", "board"]) ? <EditorialDashboard data={data} role="Editorial Board" /> : null}
      {hasRole(role, ["admin"]) ? <AdminDashboard data={data} /> : null}
      {!role && <GenericDashboard data={data} role={role} />}
      <KpiCharts data={data} />
    </>
  );
}

function MangakaDashboard({ data, onSeriesUpdated }) {
  const { selection: workspaceSelection } = useWorkspaceSelection();
  const openWorkspace = (path) => navigate(withWorkspaceSelection(path, workspaceSelection));
  const activeSeries = data.series.filter((item) => String(item.status || "").toUpperCase() !== "ARCHIVED");
  const [seriesActionId, setSeriesActionId] = useState("");
  const [seriesMessage, setSeriesMessage] = useState("");
  const [seriesError, setSeriesError] = useState("");

  async function revertToDraft(series) {
    if (!series?.id || String(series.status || "").toUpperCase() !== "REJECTED") return;
    setSeriesActionId(String(series.id));
    setSeriesMessage("");
    setSeriesError("");
    try {
      const updated = await api.series.status(series.id, "DRAFT");
      onSeriesUpdated?.({ ...series, ...updated, status: "DRAFT" });
      setSeriesMessage(`${series.title || "Series"} reverted to Draft. You can edit it and submit a new Board review cycle.`);
    } catch (err) {
      setSeriesError(err.message || "Could not revert this series to Draft.");
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
                onRevertToDraft={revertToDraft}
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

function DashboardSeriesCard({ series, busy = false, onRevertToDraft }) {
  const cover = mediaUrlFrom(series, series.coverImageUrl, series.cover_image_url, series.coverUrl, series.cover_url, series.imageUrl, series.image_url, series.thumbnailUrl, series.thumbnail_url);
  const rejected = String(series.status || "").trim().toUpperCase() === "REJECTED";
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
      {rejected && (
        <div className="dashboard-series-rejected-actions">
          <button
            type="button"
            className="btn btn-small dashboard-revert-draft-btn"
            data-testid={`revert-series-${series.id}-to-draft`}
            disabled={busy}
            onClick={() => onRevertToDraft?.(series)}
          >
            {busy ? "Reverting…" : "Revert to Draft"}
          </button>
        </div>
      )}
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
