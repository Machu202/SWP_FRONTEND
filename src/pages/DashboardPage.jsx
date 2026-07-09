import { useEffect, useMemo, useState } from "react";
import { api, hasRole, roleLabel } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { navigate } from "../utils/router";
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
  const status = String(series?.status || "").toUpperCase();
  return status && !["DRAFT", "ARCHIVED", "CANCELLED"].includes(status);
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
  const [data, setData] = useState({ series: [], tasks: [], notifications: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const seriesPromise = hasRole(role, ["mangaka"])
        ? api.series.mine()
        : api.series.list({ size: 50 });

      const [series, tasks, notifications] = await Promise.all([
        safeDashboardCall(seriesPromise, []),
        safeDashboardCall(api.tasks.mine(), []),
        safeDashboardCall(api.notifications.unread(), [])
      ]);

      setData({
        series: asList(series),
        tasks: asList(tasks),
        notifications: asList(notifications)
      });
    } catch (err) {
      setData({ series: [], tasks: [], notifications: [] });
      setError(err.message || "Dashboard failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  if (loading) return <LoadingBlock label="Loading dashboard..." />;

  return (
    <>
      <Alert type="danger">{error}</Alert>
      {hasRole(role, ["assistant"]) ? <AssistantDashboard data={data} profile={profile} session={session} /> : null}
      {hasRole(role, ["mangaka"]) ? <MangakaDashboard data={data} profile={profile} session={session} /> : null}
      {hasRole(role, ["tantou"]) ? <EditorialDashboard data={data} role="Tantou Editor" /> : null}
      {hasRole(role, ["editorial", "board"]) ? <EditorialDashboard data={data} role="Editorial Board" /> : null}
      {hasRole(role, ["admin"]) ? <AdminDashboard data={data} /> : null}
      {!role && <GenericDashboard data={data} role={role} />}
    </>
  );
}

function MangakaDashboard({ data }) {
  const activeSeries = data.series.filter((item) => String(item.status || "").toUpperCase() !== "ARCHIVED");
  return (
    <section className="stack mangaka-dashboard-exact">
      <div className="grid-layout">
        <div>
          <h3 style={{ marginBottom: 15, fontSize: 16, fontWeight: 700 }}>Active Series</h3>
          <div className="series-grid" id="active-series-container">
            {activeSeries.length ? activeSeries.slice(0, 4).map((series) => <DashboardSeriesCard key={series.id} series={series} />) : (
              <EmptyState icon="◇" title="Không có series nào đang hoạt động" body="Vui lòng tạo mới để bắt đầu quy trình Mangaka." />
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
              <button className="action-btn" onClick={() => navigate("/series")}><i>▧</i><span>Chapters</span></button>
              <button className="action-btn" onClick={() => navigate("/series")}><i>□</i><span>Canvas</span></button>
              <button className="action-btn" onClick={() => navigate("/tasks")}><i>▤</i><span>Kanban</span></button>
              <button className="action-btn" onClick={() => navigate("/schedule")}><i>◷</i><span>Schedule</span></button>
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
          <div className="section-title-row"><h3>Active Assignments</h3><button className="btn btn-small" onClick={() => navigate("/tasks")}>Open All</button></div>
          <div className="ast-task-list">
            {data.tasks.length ? data.tasks.slice(0, 7).map((task) => <AssistantTaskItem key={task.id} task={task} />) : (
              <EmptyState icon="☑" title="No assignments yet" body="Assigned tasks from Mangaka will appear here." />
            )}
          </div>
        </div>

        <aside>
          <div className="ast-side-card">
            <div className="activity-header"><h3>Deadlines</h3></div>
            <div className="ast-deadline-item"><div className="date-box"><div className="date-month">NOW</div><div className="date-day">{data.tasks.length}</div></div><div><strong>Open tasks</strong><p className="review-helper">Work through your assigned queue.</p></div></div>
            <div className="ast-deadline-item"><div className="date-box"><div className="date-month">REV</div><div className="date-day">{review.length}</div></div><div><strong>In review</strong><p className="review-helper">Submissions waiting for Mangaka checks.</p></div></div>
          </div>
          <div className="ast-side-card">
            <div className="activity-header"><h3>Quick Resources</h3></div>
            <div className="ast-quick-grid">
              <button className="ast-quick-btn" onClick={() => navigate("/resources")}><i>□</i>Resources</button>
              <button className="ast-quick-btn" onClick={() => navigate("/tasks")}><i>☁</i>Submit Work</button>
              <button className="ast-quick-btn" onClick={() => navigate("/schedule")}><i>◷</i>Schedule</button>
              <button className="ast-quick-btn" onClick={() => navigate("/profile")}><i>◎</i>Profile</button>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function EditorialDashboard({ data, role }) {
  const waiting = data.series.filter(isReviewableSeries);
  return (
    <section className="stack">
      <div className="hero-card">
        <div>
          <p className="eyebrow">{role} workspace</p>
          <h2>{role === "Tantou Editor" ? "Production Review" : "Voting Dashboard"}</h2>
          <p>{role === "Tantou Editor" ? "Check assigned chapters, page quality, and editor feedback." : "Review submitted series and vote on board approval."}</p>
        </div>
        <button className="btn-publish" onClick={() => navigate(role === "Tantou Editor" ? "/tantou-review" : "/board-review")}>{role === "Tantou Editor" ? "Open Review" : "Open Voting"}</button>
      </div>
      <div className="stats-grid">
        <Stat label="Visible series" value={data.series.length} tone="info" />
        <Stat label="Reviewing" value={waiting.length} tone="warning" />
        <Stat label="My tasks" value={data.tasks.length} tone="success" />
        <Stat label="Unread" value={data.notifications.length} tone="danger" />
      </div>
      <SeriesListCard title="Review queue" series={waiting} role={role} />
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
        <Stat label="Control" value="✓" tone="success" />
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

function DashboardSeriesCard({ series }) {
  return (
    <button className="dashboard-series-card series-card" onClick={() => navigate(`/series/${series.id}`)}>
      <div className="series-cover"><span>{(series.title || "M").slice(0, 1).toUpperCase()}</span></div>
      <div className="series-body">
        <div className="row-between"><strong>{series.title}</strong><StatusBadge value={series.status} /></div>
        <p>{series.summary || series.description || "No summary provided."}</p>
        <small>{series.genre || "Unknown genre"}</small>
      </div>
    </button>
  );
}

function AssistantTaskItem({ task }) {
  return (
    <button className="ast-task-item" onClick={() => navigate("/tasks")}>
      <div className="ast-task-thumb">#{task.pageNumber || task.id}</div>
      <div className="ast-task-info">
        <div className="ast-task-title"><span>{task.description || `Task #${task.id}`}</span><StatusBadge value={task.status} /></div>
        <div className="ast-task-sub">{task.seriesTitle || "No series"} • Page {task.pageNumber || "?"}</div>
        <div className="ast-task-meta"><span>{task.chapterTitle || task.chapterNumber || "No chapter"}</span><span className="text-danger">Open detail</span></div>
      </div>
    </button>
  );
}

function SeriesListCard({ title, series, role = "" }) {
  return (
    <div className="card">
      <div className="card-header"><h3>{title}</h3><button className="btn btn-small" onClick={() => navigate("/series")}>Open</button></div>
      {series.length ? (
        <div className="list">
          {series.slice(0, 6).map((item) => (
            <button className="list-row interactive" key={item.id} onClick={() => navigate(dashboardSeriesTarget(role, item))}>
              <div><strong>{item.title}</strong><small>{item.genre || item.mangakaName || "No genre"}</small></div>
              <StatusBadge value={item.status} />
            </button>
          ))}
        </div>
      ) : <EmptyState icon="◇" title="No series found" body="Backend data for this role will appear here." />}
    </div>
  );
}

function Stat({ label, value, tone }) {
  return <div className={`stat-card stat-${tone}`}><span>{label}</span><strong>{value}</strong></div>;
}
