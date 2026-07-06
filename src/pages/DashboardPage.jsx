import { useEffect, useState } from "react";
import { api, hasRole, roleLabel } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { navigate } from "../utils/router";
import { Alert, EmptyState, LoadingBlock, StatusBadge } from "../components/Status";

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
        : api.series.list({ size: 8 });
      const [series, tasks, notifications] = await Promise.all([
        seriesPromise.catch(() => []),
        api.tasks.mine().catch(() => []),
        api.notifications.unread().catch(() => [])
      ]);
      setData({ series, tasks, notifications });
    } catch (err) {
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

  const reviewCount = data.tasks.filter((task) => String(task.status || "").toLowerCase().includes("review")).length;

  return (
    <section className="stack">
      <Alert type="danger">{error}</Alert>

      <div className="hero-card">
        <div>
          <p className="eyebrow">Welcome back</p>
          <h2>{profile?.fullName || profile?.username || session.username || "MangaSystem user"}</h2>
          <p>Your role is <strong>{roleLabel(role)}</strong>. This React frontend uses JWT authorization and the Spring Boot `/api/v1` endpoints.</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate(hasRole(role, ["assistant"]) ? "/tasks" : "/series")}>Continue work</button>
      </div>

      <div className="stats-grid">
        <Stat label="Series" value={data.series.length} tone="info" />
        <Stat label="My tasks" value={data.tasks.length} tone="warning" />
        <Stat label="In review" value={reviewCount} tone="success" />
        <Stat label="Unread notifications" value={data.notifications.length} tone="danger" />
      </div>

      <div className="grid two">
        <div className="card">
          <div className="card-header">
            <h3>Recent series</h3>
            <button className="btn btn-small" onClick={() => navigate("/series")}>Open</button>
          </div>
          {data.series.length ? (
            <div className="list">
              {data.series.slice(0, 5).map((series) => (
                <button className="list-row interactive" key={series.id} onClick={() => navigate(`/series/${series.id}`)}>
                  <div>
                    <strong>{series.title}</strong>
                    <small>{series.genre || series.mangakaName || "No genre"}</small>
                  </div>
                  <StatusBadge value={series.status} />
                </button>
              ))}
            </div>
          ) : <EmptyState title="No series found" body="Create a series or ask the backend admin to assign data to your user." />}
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Current tasks</h3>
            <button className="btn btn-small" onClick={() => navigate("/tasks")}>Open</button>
          </div>
          {data.tasks.length ? (
            <div className="list">
              {data.tasks.slice(0, 5).map((task) => (
                <div className="list-row" key={task.id}>
                  <div>
                    <strong>{task.description || `Task #${task.id}`}</strong>
                    <small>{task.seriesTitle || "No series"} • Page {task.pageNumber || "?"}</small>
                  </div>
                  <StatusBadge value={task.status} />
                </div>
              ))}
            </div>
          ) : <EmptyState title="No tasks assigned" body="Mangaka can create tasks from the workspace canvas." />}
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className={`stat-card stat-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
