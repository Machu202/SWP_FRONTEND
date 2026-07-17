import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api, hasRole, roleLabel } from "../api/client";
import { useWorkspaceSelection } from "../context/WorkspaceSelectionContext";
import { navigate } from "../utils/router";
import { connectNotificationStream } from "../utils/notificationStream";
import { withWorkspaceSelection } from "../utils/workspaceRoute";

function roleGroup(role = "") {
  if (hasRole(role, ["admin"])) return "admin";
  if (hasRole(role, ["editorial", "board"])) return "board";
  if (hasRole(role, ["tantou"])) return "tantou";
  if (hasRole(role, ["assistant"])) return "assistant";
  return "mangaka";
}

function navForRole(role) {
  const group = roleGroup(role);
  if (group === "admin") {
    return [
      { path: "/dashboard", label: "Dashboard", icon: "▦" },
      { path: "/admin/users", label: "Users", icon: "👥" },
      { path: "/schedule", label: "Deadlines", icon: "◷" },
      { path: "/admin-review", label: "Final Approval", icon: "✓" },
      { path: "/admin/system", label: "Settings", icon: "⚙" }
    ];
  }
  if (group === "board") {
    return [
      { path: "/dashboard", label: "Dashboard", icon: "▦" },
      { path: "/board-review", label: "Voting Center", icon: "⚖" },
      { path: "/schedule", label: "Schedule", icon: "◷" }
    ];
  }
  if (group === "tantou") {
    return [
      { path: "/dashboard", label: "Dashboard", icon: "▦" },
      { path: "/series", label: "Assigned Series", icon: "◇" },
      { path: "/tasks?tab=kanban", label: "Kanban Tasks", icon: "▤" },
      { path: "/tantou-review", label: "Chapter Review", icon: "☑" },
      { path: "/canvas-workspace", label: "Review Canvas", icon: "□" },
      { path: "/schedule", label: "Schedule", icon: "◷" }
    ];
  }
  if (group === "assistant") {
    return [
      { path: "/dashboard", label: "Dashboard", icon: "▦" },
      { path: "/tasks?tab=assignments", label: "Assignments", icon: "☑" },
      { path: "/tasks?tab=kanban", label: "Kanban Board", icon: "▤" },
      { path: "/schedule", label: "Schedule", icon: "◷" },
      { path: "/resources", label: "Resource Library", icon: "□" }
    ];
  }
  return [
    { path: "/dashboard", label: "Dashboard", icon: "▦" },
    { path: "/series", label: "Series", icon: "◇" },
    { path: "/manuscripts", label: "Manuscripts", icon: "✎" },
    { path: "/chapters-pages", label: "Chapters & Pages", icon: "▧" },
    { path: "/canvas-workspace", label: "Canvas Workspace", icon: "□" },
    { path: "/tasks?tab=kanban", label: "Kanban Board", icon: "▤" },
    { path: "/schedule", label: "Schedule", icon: "◷" },
    { path: "/tasks?tab=assignments", label: "Assignments", icon: "☑" },
    { path: "/assistant-review", label: "Review", icon: "☰" },
    { path: "/resources", label: "Assets", icon: "⬆" }
  ];
}

function workspaceTitle(group) {
  if (group === "admin") return "Admin Workspace";
  if (group === "board") return "Editorial Board Workspace";
  if (group === "tantou") return "Tantou Editor Workspace";
  if (group === "assistant") return "Assistant Workspace";
  return "Mangaka Workspace";
}

function brandForRole(role) {
  const group = roleGroup(role);
  if (group === "admin") return { title: workspaceTitle(group), subtitle: "Publishing Control", avatar: "AD", cta: "Final Approval", ctaPath: "/admin-review", mode: "Admin Mode" };
  if (group === "board") return { title: workspaceTitle(group), subtitle: "Management Portal", avatar: "MB", cta: "Vote Queue", ctaPath: "/board-review", mode: "Board Mode" };
  if (group === "tantou") return { title: workspaceTitle(group), subtitle: "Production Manager", avatar: "TE", cta: "Chapter Review", ctaPath: "/tantou-review", mode: "Editor Mode" };
  if (group === "assistant") return { title: workspaceTitle(group), subtitle: "Production Assistant", avatar: "AS", cta: "Open Tasks", ctaPath: "/tasks", mode: "Assistant Mode" };
  return { title: workspaceTitle(group), subtitle: "Studio Flow", avatar: "SF", cta: "New Series", ctaPath: "/series", mode: "Creator Mode" };
}


function topbarLinks(group) {
  if (group === "admin") return [
    { path: "/admin/users", label: "Users" },
    { path: "/admin-review", label: "Final Approval" },
    { path: "/admin/system", label: "System Settings" }
  ];
  if (group === "board") return [
    { path: "/board-review", label: "Vote Queue" },
    { path: "/schedule", label: "Schedule" },
    { path: "/profile", label: "Profile" }
  ];
  if (group === "tantou") return [
    { path: "/tantou-review", label: "Chapter Review" },
    { path: "/canvas-workspace", label: "Review Canvas" },
    { path: "/series", label: "Assigned Series" },
    { path: "/schedule", label: "Schedule" }
  ];
  if (group === "assistant") return [
    { path: "/tasks?tab=assignments", label: "Assignments" },
    { path: "/tasks?tab=kanban", label: "Kanban" },
    { path: "/resources", label: "Resources" }
  ];
  return [
    { path: "/dashboard", label: "Workflow" },
    { path: "/schedule", label: "Schedule" },
    { path: "/resources", label: "Assets" }
  ];
}

function hasInlinePageHeader(pathname = "") {
  return pathname.startsWith("/chapters-pages") ||
    pathname.startsWith("/canvas-workspace") ||
    pathname.startsWith("/manuscripts");
}

export function Layout({ children, route }) {
  const { session, profile, logout } = useAuth();
  const { selection: workspaceSelection } = useWorkspaceSelection();
  const role = profile?.roleName || session.role;
  const group = roleGroup(role);
  const brand = brandForRole(role);
  const nav = navForRole(role);
  const active = route.pathname;
  const displayUsername = profile?.username || session.username || profile?.fullName || roleLabel(role);
  const initials = (displayUsername || brand.avatar).slice(0, 2).toUpperCase();
  const isEditor = active.startsWith("/workspace/");
  const showRouteHeader = !isEditor && !hasInlinePageHeader(route.pathname);
  const openRoute = (path) => navigate(withWorkspaceSelection(path, workspaceSelection));

  return (
    <div className={`app-shell ${group}-screen feature-screen`}>
      <aside className={`sidebar ${group}-sidebar`}>
        <div className={`${group}-brand-block workspace-title`}>
          <button className="brand-card brand-title-only" onClick={() => navigate("/dashboard")}>
            <div className="ws-name">{brand.title}</div>
          </button>
          <button className="btn-sidebar-action sidebar-cta" onClick={() => navigate(brand.ctaPath)}>
            <span>＋</span> {brand.cta}
          </button>
        </div>

        <nav className={`nav-group ${group}-nav`}>
          {nav.map((item, index) => {
            const itemPath = item.path.split("?")[0];
            const exactHash = route.hash === item.path;
            const baseActive = active === itemPath || (itemPath !== "/series" && active.startsWith(`${itemPath}/`)) || (itemPath === "/series" && active.startsWith("/series") && !active.startsWith("/series/"));
            const isActive = item.path.includes("?") ? exactHash : baseActive;
            return (
              <button
                key={`${item.path}-${item.label}-${index}`}
                onClick={() => openRoute(item.path)}
                className={isActive ? "nav-item active" : "nav-item"}
              >
                <i>{item.icon}</i>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-spacer" />
        <div className="sidebar-divider" />
        <nav className={`nav-group ${group}-nav footer-nav`}>
          <button className="nav-item" onClick={() => navigate("/profile")}><i>⚙</i><span>Profile</span></button>
          <button className="nav-item" data-testid="logout-button" onClick={logout}><i>↪</i><span>Logout</span></button>
        </nav>
      </aside>

      <main className={`main-wrapper ${group}-main`}>
        <header className={`topbar ${group}-topbar ${group === "mangaka" ? "mangaka-clean-topbar" : ""}`}>
          <div className="topbar-left">
            <strong>{topbarBrand(group)}</strong>
            {topbarLinks(group).map((item) => (
              <button key={item.path} onClick={() => openRoute(item.path)}>{item.label}</button>
            ))}
          </div>
          <div className="topbar-right">
            <NotificationBell userId={profile?.id || session.id} />
            <button className="topbar-avatar plain-user-avatar" onClick={() => navigate("/profile")} title={profile?.email || session.email || roleLabel(role)}>{initials}</button>
          </div>
        </header>

        <section className={`content-padding ${isEditor ? "editor-content-padding" : ""}`}>
          {showRouteHeader && (
            <div className="page-header route-header">
              <div>
                <h1>{pageTitle(route.pathname, role)}</h1>
                <p>{pageSubtitle(route.pathname, role, displayUsername)}</p>
              </div>
            </div>
          )}
          {children}
        </section>
      </main>
    </div>
  );
}


function formatNotificationTime(value) {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleString();
}

function notificationAction(item) {
  return item?.actionUrl || item?.action_url || item?.targetUrl || item?.target_url || "";
}

function NotificationBell({ userId }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [connectionState, setConnectionState] = useState("connecting");

  async function loadNotifications() {
    try {
      const data = await api.notifications.unread().catch(() => []);
      setItems(Array.isArray(data) ? data : data?.content || data?.data || []);
    } catch {
      setItems([]);
    }
  }

  async function markRead(item) {
    if (!item?.id) return;
    const target = notificationAction(item);
    try {
      await api.notifications.markRead(item.id);
      setItems((old) => old.filter((entry) => String(entry.id) !== String(item.id)));
    } catch {
      // Navigation remains available even if the read state could not be saved.
    }
    setOpen(false);
    if (target) navigate(target);
  }

  useEffect(() => {
    loadNotifications();
    const disconnect = window.__DISABLE_NOTIFICATION_STREAM__
      ? (() => { setConnectionState("polling"); return () => {}; })()
      : connectNotificationStream({
        userId,
        onNotification: (item) => {
          setItems((old) => {
            const itemId = item?.id ?? `${item?.message || item?.content || "notification"}-${item?.createdAt || Date.now()}`;
            if (old.some((entry) => String(entry?.id) === String(itemId))) return old;
            return [{ ...item, id: item?.id ?? itemId }, ...old];
          });
        },
        onState: setConnectionState
      });
    // Polling remains as a fallback for deployments where the WebSocket broker
    // is disabled or temporarily unavailable.
    const interval = window.setInterval(loadNotifications, 30000);
    return () => {
      window.clearInterval(interval);
      disconnect();
    };
  }, [userId]);

  return (
    <div className="notification-bell-wrap">
      <button className="top-icon notification-button" title="Notifications" type="button" onClick={() => setOpen((value) => !value)}>
        🔔
        {items.length > 0 && <span className="notification-dot">{items.length > 9 ? "9+" : items.length}</span>}
      </button>
      {open && (
        <div className="notification-menu">
          <div className="notification-menu-head">
            <div><strong>Notifications</strong></div>
            <button type="button" onClick={loadNotifications}>Refresh</button>
          </div>
          {items.length ? (
            <div className="notification-list">
              {items.map((item) => (
                <button key={item.id} type="button" className="notification-item" onClick={() => markRead(item)}>
                  <span>{item.message || item.content || `Notification #${item.id}`}</span>
                  <small title={item.createdAt || item.created_at || ""}>{formatNotificationTime(item.createdAt || item.created_at)}</small>
                </button>
              ))}
            </div>
          ) : (
            <p className="notification-empty">No unread notifications.</p>
          )}
        </div>
      )}
    </div>
  );
}

function topbarBrand(group) {
  return workspaceTitle(group);
}

function dashboardTitle(role) {
  if (hasRole(role, ["admin"])) return "Admin Dashboard";
  if (hasRole(role, ["editorial", "board"])) return "Editorial Board Dashboard";
  if (hasRole(role, ["tantou"])) return "Tantou Editor Dashboard";
  if (hasRole(role, ["assistant"])) return "Assistant Dashboard";
  return "Mangaka Dashboard";
}

function pageTitle(pathname, role) {
  if (pathname.startsWith("/series/")) return "Chapter Manager & Page Upload";
  if (pathname.startsWith("/chapters-pages")) return "Chapter Manager & Page Upload";
  if (pathname.startsWith("/manuscripts")) return "Manuscripts";
  if (pathname.startsWith("/canvas-workspace")) return hasRole(role, ["tantou"]) ? "Tantou Review Canvas" : "Canvas Workspace";
  if (pathname.startsWith("/workspace/")) return "Page Canvas";
  if (pathname.startsWith("/admin/users")) return "User Administration";
  if (pathname.startsWith("/admin/system")) return "Admin Settings";
  if (pathname.startsWith("/assistant-review")) return "Review";
  if (pathname.startsWith("/tantou-review")) return "Chapter Review Queue";
  if (pathname.startsWith("/board-review")) return "Editorial Voting";
  if (pathname.startsWith("/admin-review")) return "Final Approval Console";
  if (pathname.startsWith("/series")) return hasRole(role, ["mangaka"]) ? "My Series" : "Manga Series";
  if (pathname.startsWith("/tasks")) return "Kanban Board";
  if (pathname.startsWith("/resources")) return "Resource Library";
  if (pathname.startsWith("/schedule")) return "Schedule";
  if (pathname.startsWith("/profile")) return "Profile";
  return dashboardTitle(role);
}

function pageSubtitle(pathname, role, username = "") {
  if (pathname.startsWith("/workspace/")) return "Draw hitboxes, pin comments, and create assistant tasks.";
  if (pathname.startsWith("/canvas-workspace")) return hasRole(role, ["tantou"])
    ? "Draw independent Tantou feedback areas without changing Mangaka task hitboxes."
    : "Open a manga page, draw hitboxes, and create assistant tasks.";
  if (pathname.startsWith("/chapters-pages")) return "Create chapters and upload manga pages.";
  if (pathname.startsWith("/manuscripts")) return "Browse chapter scripts, page files, and manuscript structure.";
  if (pathname.startsWith("/series/")) return "Create chapters and upload manga pages.";
  if (pathname.startsWith("/series")) return hasRole(role, ["mangaka"]) ? `Logged in as ${username || "user"}.` : "View manga series available to your role.";
  if (pathname.startsWith("/tasks")) return "Track Todo, Doing, Reviewing, and Approved work.";
  if (pathname.startsWith("/assistant-review")) return "Review Tantou feedback, add comments, and check assistant submissions.";
  if (pathname.startsWith("/tantou-review")) return "Review assigned pages and leave annotation feedback.";
  if (pathname.startsWith("/board-review")) return "Cast approval or rejection votes for submitted manga series.";
  if (pathname.startsWith("/admin-review")) return "Board results and final publishing decisions.";
  if (pathname.startsWith("/schedule")) return "Publishing schedules and deadline events.";
  return `Logged in as ${username || roleLabel(role)}.`;
}
