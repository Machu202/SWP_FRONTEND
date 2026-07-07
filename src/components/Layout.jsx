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
      { path: "/schedule", label: "Deadlines", icon: "◷" },
      { path: "/admin-review", label: "Final Approval", icon: "✓" },
      { path: "/admin/system", label: "Settings", icon: "⚙" }
    ];
  }
  if (group === "board") {
    return [
      { path: "/dashboard", label: "Dashboard", icon: "▦" },
      { path: "/board-review", label: "Voting Center", icon: "⚖" },
      { path: "/schedule", label: "Schedule", icon: "◷" },
      { path: "/profile", label: "Settings", icon: "◎" }
    ];
  }
  if (group === "tantou") {
    return [
      { path: "/dashboard", label: "Dashboard", icon: "▦" },
      { path: "/series", label: "Approved Series", icon: "◇" },
      { path: "/tasks", label: "Kanban Tasks", icon: "▤" },
      { path: "/tantou-review", label: "Chapter Review", icon: "☑" },
      { path: "/schedule", label: "Schedule", icon: "◷" },
      { path: "/profile", label: "Settings", icon: "◎" }
    ];
  }
  if (group === "assistant") {
    return [
      { path: "/dashboard", label: "Dashboard", icon: "▦" },
      { path: "/tasks", label: "Assignments", icon: "☑" },
      { path: "/tasks", label: "Kanban Board", icon: "▤" },
      { path: "/schedule", label: "Schedule", icon: "◷" },
      { path: "/resources", label: "Resource Library", icon: "□" }
    ];
  }
  return [
    { path: "/dashboard", label: "Dashboard", icon: "▦" },
    { path: "/series", label: "Series", icon: "◇" },
    { path: "/series", label: "Manuscripts", icon: "✎" },
    { path: "/series", label: "Chapters & Pages", icon: "▧" },
    { path: "/series", label: "Canvas Workspace", icon: "□" },
    { path: "/tasks", label: "Kanban Board", icon: "▤" },
    { path: "/schedule", label: "Schedule", icon: "◷" },
    { path: "/tasks", label: "Assignments", icon: "☑" },
    { path: "/assistant-review", label: "Review", icon: "☰" },
    { path: "/resources", label: "Assets", icon: "⬆" }
  ];
}

function brandForRole(role) {
  const group = roleGroup(role);
  if (group === "admin") return { title: "Manga Admin", subtitle: "Publishing Control", avatar: "AD", cta: "Final Approval", ctaPath: "/admin-review", mode: "Admin Mode" };
  if (group === "board") return { title: "Manga Board", subtitle: "Management Portal", avatar: "MB", cta: "Vote Queue", ctaPath: "/board-review", mode: "Board Mode" };
  if (group === "tantou") return { title: "Tantou Editorial", subtitle: "Production Manager", avatar: "TE", cta: "Chapter Review", ctaPath: "/tantou-review", mode: "Editor Mode" };
  if (group === "assistant") return { title: "Studio Flow", subtitle: "Production Assistant", avatar: "AS", cta: "Open Tasks", ctaPath: "/tasks", mode: "Assistant Mode" };
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
  const isEditor = active.startsWith("/workspace/");

  return (
    <div className={`app-shell ${group}-screen feature-screen`}>
      <aside className={`sidebar ${group}-sidebar`}>
        {group === "assistant" ? (
          <div className="assistant-profile-box">
            <div className="topbar-avatar">{initials}</div>
            <div className="assistant-profile-info">
              <h3>{brand.title}</h3>
              <p>{brand.subtitle}</p>
            </div>
          </div>
        ) : (
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
        )}

        <nav className={`nav-group ${group}-nav`}>
          {nav.map((item, index) => (
            <button
              key={`${item.path}-${item.label}-${index}`}
              onClick={() => navigate(item.path)}
              className={active === item.path || (item.path !== "/series" && active.startsWith(`${item.path}/`)) || (item.path === "/series" && active.startsWith("/series")) ? "nav-item active" : "nav-item"}
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
        <header className={`topbar ${group}-topbar ${group === "mangaka" ? "mangaka-clean-topbar" : ""}`}>
          <div className="topbar-left">
            <strong>{topbarBrand(group)}</strong>
            <button onClick={() => navigate("/dashboard")}>Workflow</button>
            <button onClick={() => navigate("/schedule")}>Schedule</button>
            <button onClick={() => navigate("/resources")}>Assets</button>
          </div>
          <div className="topbar-right">
            <div className={`search-box ${group}-search`}>
              <span>⌕</span>
              <input type="text" placeholder={group === "assistant" ? "Search brushes, models..." : "Search..."} aria-label="Search" />
            </div>
            <button className="top-icon" title="Notifications">♡</button>
            <button className="mode-chip">{brand.mode}</button>
            <button className="topbar-avatar plain-user-avatar" onClick={() => navigate("/profile")} title={profile?.email || session.email || roleLabel(role)}>{initials}</button>
          </div>
        </header>

        <section className={`content-padding ${isEditor ? "editor-content-padding" : ""}`}>
          {!isEditor && (
            <div className="page-header route-header">
              <div>
                <h1>{pageTitle(route.pathname)}</h1>
                <p>{pageSubtitle(route.pathname, role)}</p>
              </div>
              <div className="route-chip">{roleLabel(role)}</div>
            </div>
          )}
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
  if (group === "assistant") return "Studio Flow › Asset Library";
  return "Studio Flow";
}

function pageTitle(pathname) {
  if (pathname.startsWith("/series/")) return "Chapter Manager & Page Upload";
  if (pathname.startsWith("/workspace/")) return "Page Canvas";
  if (pathname.startsWith("/admin/users")) return "User Administration";
  if (pathname.startsWith("/admin/system")) return "Admin Settings";
  if (pathname.startsWith("/assistant-review")) return "Review";
  if (pathname.startsWith("/tantou-review")) return "Chapter Review Queue";
  if (pathname.startsWith("/board-review")) return "Editorial Voting";
  if (pathname.startsWith("/admin-review")) return "Final Approval Console";
  if (pathname.startsWith("/series")) return "Create New Series";
  if (pathname.startsWith("/tasks")) return "Kanban Board";
  if (pathname.startsWith("/resources")) return "Resource Library";
  if (pathname.startsWith("/schedule")) return "Schedule";
  if (pathname.startsWith("/profile")) return "Profile";
  return "Studio Dashboard";
}

function pageSubtitle(pathname, role) {
  if (pathname.startsWith("/workspace/")) return "Draw hitboxes, pin comments, and create assistant tasks.";
  if (pathname.startsWith("/series/")) return "Create chapters and upload manga pages through the backend page API.";
  if (pathname.startsWith("/series")) return "Initialize a new manga series project and define its core metadata.";
  if (pathname.startsWith("/tasks")) return "Track Todo, Doing, Reviewing, and Approved work.";
  if (pathname.startsWith("/assistant-review")) return "Review Tantou feedback, add comments, and check assistant submissions.";
  if (pathname.startsWith("/tantou-review")) return "Review assigned pages and leave annotation feedback.";
  if (pathname.startsWith("/board-review")) return "Cast approval or rejection votes for submitted manga series.";
  if (pathname.startsWith("/admin-review")) return "Board results and final publishing decisions.";
  if (pathname.startsWith("/schedule")) return "Publishing schedules and deadline events.";
  return `Logged in as ${roleLabel(role)}.`;
}
