(() => {
  const Api = window.MangaApi || {};
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = (value = "") => String(value ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
  const API_BASE = (window.API_BASE_URL || "http://localhost:8080/api/v1").replace(/\/+$/, "");

  const ROLE_CONFIG = {
    MANGAKA: {
      bodyClass: "profile-screen mangaka-profile-screen",
      sidebarClass: "sidebar profile-mangaka-sidebar",
      mainClass: "main-wrapper",
      topbarClass: "topbar",
      title: "Mangaka Workspace",
      subtitle: "",
      brand: "Studio Flow",
      dashboard: "pages/mangaka/dashboard.html",
      cta: ["+ New Series", "pages/mangaka/create-series.html", "fa-plus"],
      navClass: "nav-group",
      nav: [
        ["Dashboard", "pages/mangaka/dashboard.html", "fa-table-cells-large"],
        ["Series", "pages/mangaka/series.html", "fa-book"],
        ["Manuscripts", "pages/mangaka/manuscripts.html", "fa-file-pen"],
        ["Chapters & Pages", "pages/mangaka/dashboard.html#chapters", "fa-layer-group"],
        ["Canvas Workspace", "pages/mangaka/dashboard.html#canvas", "fa-vector-square"],
        ["Kanban Board", "pages/mangaka/dashboard.html#kanban", "fa-table-columns"],
        ["Assignments", "pages/mangaka/assignments.html", "fa-clipboard-list"],
        ["Review", "pages/mangaka/review.html", "fa-comment"],
        ["Analytics", "pages/mangaka/analytics.html", "fa-chart-line"]
      ],
      footer: [
        ["Profile", "profile.html", "fa-user", true],
        ["Notifications", "notifications.html", "fa-bell"],
        ["Logout", "index.html", "fa-right-from-bracket"]
      ],
      search: "Search profile, series, or tasks..."
    },
    ASSISTANT: {
      bodyClass: "profile-screen assistant-profile-screen",
      sidebarClass: "sidebar profile-assistant-sidebar",
      mainClass: "main-wrapper",
      topbarClass: "topbar",
      title: "Studio Flow",
      subtitle: "Production Assistant",
      brand: "Studio Flow",
      dashboard: "pages/assistant/assistant-dashboard.html",
      cta: ["Back Dashboard", "pages/assistant/assistant-dashboard.html", "fa-arrow-left"],
      navClass: "nav-group",
      nav: [
        ["Dashboard", "pages/assistant/assistant-dashboard.html", "fa-table-cells-large"],
        ["Assignments", "pages/assistant/assistant-assignments.html", "fa-clipboard-list"],
        ["Kanban Board", "pages/assistant/assistant-dashboard.html#kanban", "fa-table-columns"],
        ["Resource Library", "pages/assistant/resource-library.html", "fa-box-archive"]
      ],
      footer: [
        ["Profile", "profile.html", "fa-user", true],
        ["Notifications", "notifications.html", "fa-bell"],
        ["Logout", "index.html", "fa-right-from-bracket"]
      ],
      search: "Search my tasks..."
    },
    TANTOU: {
      bodyClass: "profile-screen tantou-screen",
      sidebarClass: "sidebar tantou-sidebar",
      mainClass: "main-wrapper tantou-main",
      topbarClass: "topbar tantou-topbar",
      title: "Tantou Editorial",
      subtitle: "Production Manager",
      brand: "MangaFlow Editorial",
      context: "Profile settings for the Tantou editorial workspace.",
      dashboard: "tantou-dashboard.html",
      cta: ["Start Review", "tantou-review.html", "fa-play"],
      navClass: "nav-group tantou-nav",
      nav: [
        ["Dashboard", "tantou-dashboard.html", "fa-border-all"],
        ["Kanban Tasks", "tantou-dashboard.html#kanban", "fa-table-columns"],
        ["Chapter Review", "tantou-review.html", "fa-list-check"],
        ["Annotation & Feedback", "tantou-feedback.html", "fa-pen-to-square"],
        ["Revision Tracking", "tantou-revision.html", "fa-arrows-rotate"],
        ["Editorial Report", "tantou-report.html", "fa-chart-column"]
      ],
      footer: [
        ["Settings", "profile.html", "fa-gear", true],
        ["Logout", "index.html", "fa-right-from-bracket"]
      ],
      search: "Search profile or editorial settings...",
      mode: "Editor Mode"
    },
    BOARD: {
      bodyClass: "profile-screen board-screen",
      sidebarClass: "sidebar board-sidebar",
      mainClass: "main-wrapper board-main",
      topbarClass: "topbar board-topbar",
      title: "Manga Board",
      subtitle: "Management Portal",
      brand: "Manga Editorial Board",
      dashboard: "board-dashboard.html",
      cta: ["New Decision", "board-voting.html", "fa-plus"],
      navClass: "nav-group board-nav",
      nav: [
        ["Dashboard", "board-dashboard.html", "fa-border-all"],
        ["Review Queue", "board-submissions.html", "fa-folder-open"],
        ["Voting", "board-voting.html", "fa-scale-balanced"],
        ["Decision History", "board-result.html", "fa-clock-rotate-left"]
      ],
      footer: [
        ["Settings", "profile.html", "fa-gear", true],
        ["Help", "notifications.html", "fa-circle-question"]
      ],
      search: "Search profile, decisions, or reports..."
    },
    ADMIN: {
      bodyClass: "profile-screen admin-screen",
      sidebarClass: "sidebar admin-sidebar",
      mainClass: "main-wrapper admin-main",
      topbarClass: "topbar admin-topbar",
      title: "Admin Console",
      subtitle: "Publishing Control",
      brand: "Publishing Administration",
      dashboard: "admin-dashboard.html",
      cta: ["Review Decisions", "admin-final-approval.html", "fa-bolt"],
      navClass: "nav-group admin-nav",
      nav: [
        ["Dashboard", "admin-dashboard.html", "fa-border-all"],
        ["Users", "admin-users.html", "fa-users"],
        ["System Settings", "admin-settings.html", "fa-sliders"],
        ["Scheduling", "admin-calendar.html", "fa-calendar-days"],
        ["Deadlines", "admin-deadlines.html", "fa-triangle-exclamation"],
        ["Final Approval", "admin-final-approval.html", "fa-stamp"]
      ],
      footer: [
        ["Settings", "profile.html", "fa-gear", true],
        ["Logout", "index.html", "fa-right-from-bracket"]
      ],
      search: "Search profile, role, or settings...",
      mode: "Admin Mode"
    }
  };

  function normalizeRole(role = "") {
    const text = String(role || localStorage.getItem("role") || localStorage.getItem("userRole") || "").toUpperCase();
    if (text.includes("ADMIN")) return "ADMIN";
    if (text.includes("EDITORIAL") || text.includes("BOARD")) return "BOARD";
    if (text.includes("TANTOU")) return "TANTOU";
    if (text.includes("ASSISTANT")) return "ASSISTANT";
    return "MANGAKA";
  }

  function getToken() {
    return localStorage.getItem("accessToken") || localStorage.getItem("token") || localStorage.getItem("jwt") || "";
  }

  function initials(name = "", fallback = "U") {
    const source = String(name || fallback || "U").trim();
    const parts = source.split(/\s+/).filter(Boolean);
    if (!parts.length) return "U";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function profileAvatarUrl(profile = activeProfile) {
    return profile.profileImageUrl ||
      profile.avatarUrl ||
      profile.photoUrl ||
      profile.picture ||
      profile.imageUrl ||
      "";
  }

  function avatarHtml(profile = activeProfile, fallback = "U") {
    const name = profile.fullName || profile.name || profile.displayName || profile.username || profile.email || fallback;
    const url = profileAvatarUrl(profile);

    if (url) {
      return `<img class="unified-avatar-img" src="${esc(url)}" alt="${esc(name)} avatar">`;
    }

    return `<span class="unified-avatar-initials">${esc(initials(name, fallback))}</span>`;
  }

  function unwrap(data) {
    if (!data) return {};
    if (data.data && typeof data.data === "object") return data.data;
    if (data.user && typeof data.user === "object") return data.user;
    if (data.profile && typeof data.profile === "object") return data.profile;
    return data;
  }

  async function apiFetch(path, options = {}) {
    const token = getToken();
    const headers = { ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (options.body && !(options.body instanceof FormData) && typeof options.body !== "string") {
      headers["Content-Type"] = headers["Content-Type"] || "application/json";
      options.body = JSON.stringify(options.body);
    }

    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }

    if (!response.ok) {
      const message = data?.message || data?.error || data || `Request failed (${response.status})`;
      throw new Error(message);
    }

    return data;
  }

  async function tryLoadBackendProfile() {
    if (Api.profile) return unwrap(await Api.profile());
    if (Api.currentUser) return unwrap(await Api.currentUser());
    if (Api.me) return unwrap(await Api.me());

    const paths = ["/users/profile", "/users/me", "/auth/me"];
    let lastError = null;
    for (const path of paths) {
      try { return unwrap(await apiFetch(path)); } catch (error) { lastError = error; }
    }
    throw lastError || new Error("Profile endpoint unavailable.");
  }

  async function tryUpdateBackendProfile(payload) {
    if (Api.updateProfile) return unwrap(await Api.updateProfile(payload));
    const paths = [["/users/profile", "PUT"], ["/users/profile", "PATCH"], ["/users/me", "PUT"], ["/users/me", "PATCH"]];
    let lastError = null;
    for (const [path, method] of paths) {
      try { return unwrap(await apiFetch(path, { method, body: payload })); } catch (error) { lastError = error; }
    }
    throw lastError || new Error("Profile update endpoint unavailable.");
  }

  function cachedProfile() {
    try { return JSON.parse(localStorage.getItem("profileCache") || "{}"); } catch (_) { return {}; }
  }

  function profileFromLocalStorage() {
    return {
      id: localStorage.getItem("userId") || localStorage.getItem("id") || "",
      username: localStorage.getItem("username") || localStorage.getItem("userName") || "",
      email: localStorage.getItem("email") || localStorage.getItem("userEmail") || "",
      fullName: localStorage.getItem("fullName") || localStorage.getItem("name") || "",
      role: localStorage.getItem("role") || localStorage.getItem("userRole") || "",
      ...cachedProfile()
    };
  }

  let activeProfile = profileFromLocalStorage();

  function setStatus(message, type = "info") {
    const box = $("#profile-status");
    if (!box) return;
    box.hidden = !message;
    box.textContent = message || "";
    box.dataset.type = type;
  }

  function selectedConfig() {
    return ROLE_CONFIG[normalizeRole(activeProfile.role)] || ROLE_CONFIG.MANGAKA;
  }

  function navMarkup(items, navClass) {
    return items.map(([label, href, icon, active]) => `
      <a href="${href}" class="nav-item ${active ? "active" : ""}"><i class="fa-solid ${icon}"></i><span>${esc(label)}</span></a>
    `).join("");
  }

  function renderBrand(config, avatar, roleKey) {
    const cta = `<a class="sidebar-cta" href="${config.cta[1]}"><i class="fa-solid ${config.cta[2]}"></i><span>${esc(config.cta[0])}</span></a>`;

    if (roleKey === "ADMIN") {
      return `<div class="admin-brand-block"><div class="admin-brand-head"><div class="admin-brand-avatar">${avatar}</div><div><div class="admin-name">${esc(config.title)}</div><div class="admin-role">${esc(config.subtitle)}</div></div></div>${cta}</div>`;
    }

    if (roleKey === "BOARD") {
      return `<div class="board-brand-block"><div class="board-brand-head"><div class="board-brand-avatar">${avatar}</div><div><div class="board-name">${esc(config.title)}</div><div class="board-role">${esc(config.subtitle)}</div></div></div>${cta}</div>`;
    }

    if (roleKey === "TANTOU") {
      return `<div class="tantou-brand-block"><div class="editor-card"><div class="editor-avatar profile-editor-avatar">${avatar}</div><div><div class="editor-name">${esc(config.title)}</div><div class="editor-role">${esc(config.subtitle)}</div></div></div>${cta}</div>`;
    }

    return `<div class="workspace-title"><div class="ws-logo">${avatar}</div><div class="ws-name">${esc(config.title)}</div></div><a class="profile-primary-action" href="${config.cta[1]}"><i class="fa-solid ${config.cta[2]}"></i> ${esc(config.cta[0])}</a>`;
  }

  function renderTopbar(config, avatar, roleKey) {
    const commonSearch = `<div class="search-box ${roleKey === "ADMIN" ? "admin-search" : roleKey === "BOARD" ? "board-search" : roleKey === "TANTOU" ? "tantou-search" : ""}"><i class="fa-solid fa-magnifying-glass"></i><input type="text" placeholder="${esc(config.search)}"></div>`;

    if (roleKey === "ADMIN") {
      $("#profile-topbar-left").className = "admin-header-title";
      $("#profile-topbar-left").textContent = config.brand;
      $("#profile-topbar-right").innerHTML = `${commonSearch}<a href="notifications.html" class="top-icon"><i class="fa-regular fa-bell"></i></a><a href="admin-settings.html" class="top-icon"><i class="fa-solid fa-gear"></i></a><button class="mode-chip">${esc(config.mode)}</button><a href="profile.html" class="admin-top-avatar">${avatar}</a>`;
      return;
    }

    if (roleKey === "BOARD") {
      $("#profile-topbar-left").className = "board-header-title";
      $("#profile-topbar-left").textContent = config.brand;
      $("#profile-topbar-right").innerHTML = `${commonSearch}<a href="notifications.html" class="top-icon"><i class="fa-regular fa-bell"></i></a><a href="notifications.html" class="top-icon"><i class="fa-regular fa-envelope"></i></a><a href="profile.html" class="board-top-avatar">${avatar}</a>`;
      return;
    }

    if (roleKey === "TANTOU") {
      $("#profile-topbar-left").className = "topbar-brand";
      $("#profile-topbar-left").innerHTML = `<div class="brand-lockup"><div class="brand-wordmark">${esc(config.brand)}</div><div class="brand-context">${esc(config.context)}</div></div>`;
      $("#profile-topbar-right").innerHTML = `${commonSearch}<a href="notifications.html" class="top-icon"><i class="fa-regular fa-bell"></i></a><a href="#" class="top-icon"><i class="fa-solid fa-clock-rotate-left"></i></a><a href="#" class="top-icon"><i class="fa-regular fa-circle-question"></i></a><button class="mode-chip">${esc(config.mode)}</button><a href="profile.html" class="topbar-avatar profile-topbar-avatar">${avatar}</a>`;
      return;
    }

    $("#profile-topbar-left").className = "topbar-left";
    $("#profile-topbar-left").innerHTML = `<strong>${esc(config.brand)}</strong><a href="${config.dashboard}">Workflow</a><a href="schedule.html">Schedule</a><a href="#">Assets</a>`;
    $("#profile-topbar-right").innerHTML = `${commonSearch}<a href="notifications.html" class="top-icon"><i class="fa-regular fa-bell"></i></a><div class="profile-avatar-bubble">${avatar}</div>`;
  }

  function renderRoleShell() {
    const roleKey = normalizeRole(activeProfile.role);
    const config = selectedConfig();
    const displayName = activeProfile.fullName || activeProfile.name || activeProfile.username || activeProfile.email || config.title;
    const avatar = initials(displayName, roleKey === "ADMIN" ? "AD" : roleKey === "BOARD" ? "MB" : roleKey === "TANTOU" ? "TE" : "MK");

    document.body.className = config.bodyClass;
    $("#profile-sidebar").className = config.sidebarClass;
    $("#profile-main").className = config.mainClass;
    $("#profile-topbar").className = config.topbarClass;

    $("#profile-brand-block").innerHTML = renderBrand(config, avatar, roleKey);
    $("#profile-role-nav").className = config.navClass;
    $("#profile-role-nav").innerHTML = navMarkup(config.nav, config.navClass);
    $("#profile-footer-nav").className = `${config.navClass} footer-nav`;
    $("#profile-footer-nav").innerHTML = navMarkup(config.footer, config.navClass);

    renderTopbar(config, avatar, roleKey);

    $("#profile-role-kicker").textContent = `${roleKey.replace("_", " ")} PROFILE`;
    $("#profile-role-card-title").textContent = `${config.title} Shortcuts`;
    $("#profile-role-card-text").textContent = `Quick access for ${config.subtitle || config.brand}.`;
    $("#profile-shortcuts").innerHTML = config.nav.slice(0, 6).map(([label, href, icon]) => `
      <a href="${href}" class="profile-shortcut"><i class="fa-solid ${icon}"></i><span>${esc(label)}</span></a>
    `).join("");
  }

  function renderProfile() {
    const displayName = activeProfile.fullName || activeProfile.name || activeProfile.username || activeProfile.email || "User";
    const email = activeProfile.email || activeProfile.mail || "No email returned";
    const username = activeProfile.username || activeProfile.userName || activeProfile.login || "—";
    const role = activeProfile.role || activeProfile.roleName || activeProfile.type || localStorage.getItem("role") || "User";
    const id = activeProfile.id || activeProfile.userId || activeProfile.accountId || localStorage.getItem("userId") || "—";
    const status = activeProfile.status || (activeProfile.locked ? "LOCKED" : "ACTIVE");

    renderRoleShell();

    $("#profile-big-avatar").classList.add("unified-avatar");
    $("#profile-big-avatar").innerHTML = avatarHtml(activeProfile, normalizeRole(role));
    document.querySelectorAll(".profile-avatar-bubble, .profile-topbar-avatar, .admin-top-avatar, .board-top-avatar, .editor-avatar, .admin-brand-avatar, .board-brand-avatar, .ws-logo").forEach(el => {
      el.classList.add("unified-avatar");
      el.innerHTML = avatarHtml(activeProfile, normalizeRole(role));
    });
    $("#profile-display-name").textContent = displayName;
    $("#profile-display-email").textContent = email;
    $("#profile-role-pill").textContent = role;
    $("#profile-status-pill").textContent = status;
    $("#profile-user-id").textContent = id;
    $("#profile-username").textContent = username;
    $("#profile-role-text").textContent = role;
    $("#profile-loaded-at").textContent = new Date().toLocaleString();

    $("#profile-full-name").value = activeProfile.fullName || activeProfile.name || "";
    $("#profile-email").value = email === "No email returned" ? "" : email;
    $("#profile-username-input").value = username === "—" ? "" : username;
    $("#profile-phone").value = activeProfile.phone || activeProfile.phoneNumber || "";
    $("#profile-bio").value = activeProfile.bio || activeProfile.description || activeProfile.note || "";

    $("#profile-token-state").textContent = getToken() ? "Present" : "Missing";
    $("#profile-login-source").textContent = localStorage.getItem("loginSource") || "Password / OAuth";
    $("#profile-cache-state").textContent = localStorage.getItem("profileCache") ? "Using cache fallback" : "No local edits";
  }

  function persistLocalProfile(profile) {
    activeProfile = { ...activeProfile, ...profile };
    localStorage.setItem("profileCache", JSON.stringify(activeProfile));
    if (activeProfile.fullName || activeProfile.name) localStorage.setItem("fullName", activeProfile.fullName || activeProfile.name);
    if (activeProfile.email) localStorage.setItem("email", activeProfile.email);
    if (activeProfile.username) localStorage.setItem("username", activeProfile.username);
    if (activeProfile.role || activeProfile.roleName) localStorage.setItem("role", activeProfile.role || activeProfile.roleName);
    renderProfile();
  }

  async function loadProfile() {
    setStatus("Loading real profile data...", "info");
    activeProfile = profileFromLocalStorage();
    renderProfile();

    try {
      const backendProfile = await tryLoadBackendProfile();
      persistLocalProfile({
        ...backendProfile,
        role: backendProfile.role || backendProfile.roleName || backendProfile.type || activeProfile.role
      });
      setStatus("Profile loaded from backend.", "success");
    } catch (error) {
      console.warn("Profile endpoint fallback:", error.message);
      setStatus("Backend profile endpoint was unavailable, so this page is using saved login data.", "warning");
      renderProfile();
    }
  }

  async function submitProfile(event) {
    event.preventDefault();

    const payload = {
      fullName: $("#profile-full-name").value.trim(),
      name: $("#profile-full-name").value.trim(),
      email: $("#profile-email").value.trim(),
      username: $("#profile-username-input").value.trim(),
      phone: $("#profile-phone").value.trim(),
      bio: $("#profile-bio").value.trim()
    };

    const button = $("#profile-save");
    const oldText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Updating...`;
    setStatus("Saving profile...", "info");

    try {
      const updated = await tryUpdateBackendProfile(payload);
      persistLocalProfile({ ...payload, ...updated });
      setStatus("Profile updated successfully.", "success");
      window.showToast?.("Profile updated successfully.", "success");
    } catch (error) {
      persistLocalProfile(payload);
      setStatus(`Backend update unavailable. Saved locally for this browser. (${error.message})`, "warning");
      window.showToast?.("Saved locally. Backend profile update endpoint was unavailable.", "info");
    } finally {
      button.disabled = false;
      button.innerHTML = oldText;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("#profile-form")?.addEventListener("submit", submitProfile);
    $("#profile-refresh")?.addEventListener("click", loadProfile);
    $("#profile-reset")?.addEventListener("click", () => {
      activeProfile = profileFromLocalStorage();
      renderProfile();
      setStatus("Profile form reset.", "info");
    });
    $("#profile-clear-cache")?.addEventListener("click", () => {
      localStorage.removeItem("profileCache");
      activeProfile = profileFromLocalStorage();
      renderProfile();
      setStatus("Local profile cache cleared.", "success");
    });
    loadProfile();
  });
})();
