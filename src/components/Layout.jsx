import { useAuth } from "../context/AuthContext";
import { hasRole, roleLabel } from "../api/client";
import { navigate } from "../utils/router";

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
      { path: "/admin/system", label: "System Settings", icon: "⚙" },
      { path: "/schedule", label: "Schedule", icon: "◷" },
      { path: "/admin-review", label: "Final Approval", icon: "✓" },
      { path: "/profile", label: "Settings", icon: "◎" }
    ];
  }
  if (group === "board") {
    return [
      { path: "/dashboard", label: "Dashboard", icon: "▦" },
      { path: "/board-review", label: "Board Voting", icon: "⚖" },
      { path: "/schedule", label: "Schedule", icon: "◷" },
      { path: "/profile", label: "Settings", icon: "◎" }
    ];
  }
  if (group === "tantou") {
    return [
      { path: "/dashboard", label: "Dashboard", icon: "▦" },
      { path: "/tasks", label: "Kanban Tasks", icon: "▤" },
      { path: "/schedule", label: "Schedule", icon: "◷" },
      { path: "/tantou-review", label: "Chapter Review", icon: "☑" },
      { path: "/series", label: "Assigned Series", icon: "◇" },
      { path: "/profile", label: "Settings", icon: "◎" }
    ];
  }
  if (group === "assistant") {
    return [
      { path: "/dashboard", label: "Dashboard", icon: "▦" },
      { path: "/tasks", label: "Assignments", icon: "☑" },
      { path: "/resources", label: "Resources", icon: "⬆" },
      { path: "/schedule", label: "Schedule", icon: "◷" },
      { path: "/profile", label: "Settings", icon: "◎" }
    ];
  }
  return [
    { path: "/dashboard", label: "Dashboard", icon: "▦" },
    { path: "/series", label: "Series", icon: "◇" },
    { path: "/series", label: "Chapters & Pages", icon: "▧" },
    { path: "/tasks", label: "Kanban Board", icon: "▤" },
    { path: "/schedule", label: "Schedule", icon: "◷" },
    { path: "/resources", label: "Resources", icon: "⬆" },
    { path: "/assistant-review", label: "Assistant Review", icon: "☰" },
    { path: "/profile", label: "Settings", icon: "◎" }
  ];
}

function brandForRole(role) {
  const group = roleGroup(role);
  if (group === "admin") return { title: "Manga Admin", subtitle: "Publishing Control", avatar: "AD", cta: "Final Approval", ctaPath: "/admin-review", mode: "Admin Mode" };
  if (group === "board") return { title: "Manga Board", subtitle: "Management Portal", avatar: "MB", cta: "Vote Queue", ctaPath: "/board-review", mode: "Board Mode" };
  if (group === "tantou") return { title: "Tantou Editorial", subtitle: "Production Manager", avatar: "TE", cta: "Chapter Review", ctaPath: "/tantou-review", mode: "Editor Mode" };
  if (group === "assistant") return { title: "Assistant Workspace", subtitle: "Production Tasks", avatar: "AS", cta: "Open Tasks", ctaPath: "/tasks", mode: "Assistant Mode" };
  return { title: "Mangaka Workspace", subtitle: "Studio Flow", avatar: "SF", cta: "New Series", ctaPath: "/series", mode: "Creator Mode" };
}

export function Layout({ children, route }) {
  const { session, profile, logout } = useAuth();
  const role = profile?.roleName || session.role;
  const group = roleGroup(role);
  const brand = brandForRole(role);
  const nav = navForRole(role);
  const active = route.pathname;
  const initials = (profile?.username || profile?.fullName || session.username || brand.avatar).slice(0, 2).toUpperCase();

  return (
    <div className={`app-shell ${group}-screen`}>
      <aside className={`sidebar ${group}-sidebar`}>
        <div className={`${group}-brand-block workspace-title`}>
          <button className="brand-card" onClick={() => navigate("/dashboard")}>
            <div className="ws-logo">{brand.avatar}</div>
            <div>
              <div className="ws-name">{brand.title}</div>
              <div className="ws-role">{brand.subtitle}</div>
            </div>
          </button>
          <button className="btn-sidebar-action sidebar-cta" onClick={() => navigate(brand.ctaPath)}>
            <span>＋</span> {brand.cta}
          </button>
        </div>

        <nav className={`nav-group ${group}-nav`}>
          {nav.map((item, index) => (
            <button
              key={`${item.path}-${item.label}-${index}`}
              onClick={() => navigate(item.path)}
              className={active === item.path || active.startsWith(`${item.path}/`) ? "nav-item active" : "nav-item"}
            >
              <i>{item.icon}</i>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />
        <div className="sidebar-divider" />
        <nav className={`nav-group ${group}-nav footer-nav`}>
          <button className="nav-item" onClick={() => navigate("/profile")}><i>⚙</i><span>Profile</span></button>
          <button className="nav-item" onClick={logout}><i>↪</i><span>Logout</span></button>
        </nav>
      </aside>

      <main className={`main-wrapper ${group}-main`}>
        <header className={`topbar ${group}-topbar`}>
          <div className="topbar-left">
            <strong>{topbarBrand(group)}</strong>
            <button onClick={() => navigate("/dashboard")}>Workflow</button>
            <button onClick={() => navigate("/schedule")}>Schedule</button>
            <button onClick={() => navigate("/resources")}>Assets</button>
          </div>
          <div className="topbar-right">
            <div className={`search-box ${group}-search`}>
              <span>⌕</span>
              <input type="text" placeholder="Search..." aria-label="Search" />
            </div>
            <button className="top-icon" title="Notifications">♡</button>
            <button className="mode-chip">{brand.mode}</button>
            <button className="topbar-avatar" onClick={() => navigate("/profile")} title={profile?.email || session.email || roleLabel(role)}>{initials}</button>
          </div>
        </header>

        <section className="content-padding">
          <div className="page-header route-header">
            <div>
              <h1>{pageTitle(route.pathname)}</h1>
              <p>{pageSubtitle(route.pathname, role)}</p>
            </div>
            <div className="route-chip">{roleLabel(role)}</div>
          </div>
          {children}
        </section>
      </main>
    </div>
  );
}

function topbarBrand(group) {
  if (group === "admin") return "Publishing Administration";
  if (group === "board") return "Manga Editorial Board";
  if (group === "tantou") return "MangaFlow Editorial";
  if (group === "assistant") return "Assistant Production";
  return "Studio Flow";
}

function pageTitle(pathname) {
  if (pathname.startsWith("/series/")) return "Series Workspace";
  if (pathname.startsWith("/workspace/")) return "Page Canvas";
  if (pathname.startsWith("/admin/users")) return "User Management";
  if (pathname.startsWith("/admin/system")) return "System Settings";
  if (pathname.startsWith("/assistant-review")) return "Assistant Review";
  if (pathname.startsWith("/tantou-review")) return "Tantou Review";
  if (pathname.startsWith("/board-review")) return "Board Review";
  if (pathname.startsWith("/admin-review")) return "Final Approval";
  if (pathname.startsWith("/review")) return "Review Queue";
  if (pathname.startsWith("/series")) return "My Series";
  if (pathname.startsWith("/tasks")) return "Kanban Board";
  if (pathname.startsWith("/resources")) return "Resource Library";
  if (pathname.startsWith("/schedule")) return "Schedule";
  if (pathname.startsWith("/profile")) return "Profile";
  return "Studio Dashboard";
}

function pageSubtitle(pathname, role) {
  if (pathname.startsWith("/workspace/")) return "Draw hitboxes, pin comments, and create assistant tasks.";
  if (pathname.startsWith("/series/")) return "Manage chapters, scripts, page uploads, and series tasks.";
  if (pathname.startsWith("/tasks")) return "Track Todo, Doing, Reviewing, and Approved work.";
  if (pathname.startsWith("/assistant-review")) return "Mangaka checks assistant submissions and approves or requests revision.";
  if (pathname.startsWith("/tantou-review")) return "Tantou Editor reviews assigned chapters and page progress.";
  if (pathname.startsWith("/board-review")) return "Editorial Board casts approval or rejection votes.";
  if (pathname.startsWith("/admin-review")) return "Admin makes final approval decisions after review.";
  if (pathname.startsWith("/review")) return "Review submissions, cast votes, and finalize decisions.";
  if (pathname.startsWith("/schedule")) return "Publishing schedules and deadline events.";
  return `Logged in as ${roleLabel(role)}.`;
}
