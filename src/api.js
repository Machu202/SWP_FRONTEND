/*
 * MangaSystem frontend/backend compatibility layer.
 * Backend expected: Spring Boot at http://localhost:8080/api/v1
 * Frontend expected by backend CORS: Vite at http://localhost:5173
 *
 * This file intentionally does NOT fully integrate every mock screen.
 * It only provides safe, reusable API/auth helpers so each page can be wired
 * to real data gradually without changing backend contracts.
 */
(function () {
  const DEFAULT_API_BASE_URL = "http://localhost:8080/api/v1";
  const DEFAULT_WS_URL = "http://localhost:8080/ws";

  const ROLE_ROUTES = {
    mangaka: "dashboard.html",
    assistant: "assistant-dashboard.html",
    tantou: "tantou-dashboard.html",
    editorial: "board-dashboard.html",
    admin: "admin-dashboard.html",
  };

  const BACKEND_ROLES = {
    mangaka: "Mangaka",
    assistant: "Assistant",
    tantou: "Tantou Editor",
    editorial: "Editorial Board",
    board: "Editorial Board",
    admin: "Admin",
  };

  function getApiBaseUrl() {
    return (
      window.MANGA_API_BASE_URL ||
      localStorage.getItem("apiBaseUrl") ||
      DEFAULT_API_BASE_URL
    ).replace(/\/$/, "");
  }

  function getWsUrl() {
    return (
      window.MANGA_WS_URL ||
      localStorage.getItem("wsUrl") ||
      DEFAULT_WS_URL
    ).replace(/\/$/, "");
  }

  function getAccessToken() {
    return localStorage.getItem("accessToken") || "";
  }

  function setAccessToken(token) {
    if (token) localStorage.setItem("accessToken", token);
  }

  function clearAccessToken() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("currentUser");
  }

  function getCurrentUser() {
    try {
      return JSON.parse(localStorage.getItem("currentUser") || "null");
    } catch (_) {
      return null;
    }
  }

  function setCurrentUser(user) {
    if (user) localStorage.setItem("currentUser", JSON.stringify(user));
  }

  function normalizeRole(role) {
    const value = String(role || "")
      .trim()
      .toLowerCase()
      .replace(/^role_/, "")
      .replace(/[_-]+/g, " ");

    if (value.includes("admin")) return "admin";
    if (value.includes("editorial") || value.includes("board")) return "editorial";
    if (value.includes("tantou")) return "tantou";
    if (value.includes("assistant")) return "assistant";
    if (value.includes("mangaka")) return "mangaka";
    return value || "mangaka";
  }

  function backendRoleFromUi(role) {
    return BACKEND_ROLES[normalizeRole(role)] || role || "Mangaka";
  }

  function routeForRole(role) {
    return ROLE_ROUTES[normalizeRole(role)] || ROLE_ROUTES.mangaka;
  }

  function goToDashboard(role) {
    window.location.href = routeForRole(role);
  }

  function isPlainObject(value) {
    return Object.prototype.toString.call(value) === "[object Object]";
  }

  async function parseApiError(response) {
    let rawText = "";
    try {
      rawText = await response.text();
    } catch (_) {
      rawText = "";
    }

    if (!rawText) return `API Error ${response.status}`;

    try {
      const json = JSON.parse(rawText);
      return json.message || json.error || json.path || rawText;
    } catch (_) {
      return rawText;
    }
  }

  async function apiFetch(path, options = {}) {
    const isFullUrl = /^https?:\/\//i.test(path);
    const url = isFullUrl ? path : `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
    const token = getAccessToken();
    const headers = { ...(options.headers || {}) };
    const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

    if (!isFormData && !headers["Content-Type"] && !headers["content-type"]) {
      headers["Content-Type"] = "application/json";
    }

    if (token && !headers.Authorization) {
      headers.Authorization = `Bearer ${token}`;
    }

    let body = options.body;
    if (body !== undefined && !isFormData && isPlainObject(body)) {
      body = JSON.stringify(body);
    }

    const response = await fetch(url, {
      ...options,
      headers,
      body,
    });

    if (!response.ok) {
      throw new Error(await parseApiError(response));
    }

    if (response.status === 204) return null;

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) return response.json();
    return response.text();
  }

  async function loginWithPassword(username, password) {
    // Backend contract: POST /auth/login only verifies credentials and sends OTP.
    // It returns MessageResponse, not JWT. JWT comes from verifyOtp().
    return apiFetch("/auth/login", {
      method: "POST",
      body: { username, password },
    });
  }

  async function verifyOtp(email, otpCode) {
    const data = await apiFetch("/auth/verify-otp", {
      method: "POST",
      body: { email, otpCode },
    });

    if (data && data.token) {
      setAccessToken(data.token);
      setCurrentUser({
        id: data.id,
        username: data.username,
        email: data.email,
        role: data.role,
        tokenType: data.type || "Bearer",
      });
    }

    return data;
  }

  async function registerUser({ username, email, password, role }) {
    return apiFetch("/auth/register", {
      method: "POST",
      body: {
        username,
        email,
        password,
        role: backendRoleFromUi(role),
      },
    });
  }

  async function loginWithGoogle(googleIdToken) {
    const data = await apiFetch("/auth/google", {
      method: "POST",
      body: { token: googleIdToken },
    });

    if (data && data.token) {
      setAccessToken(data.token);
      setCurrentUser({
        id: data.id,
        username: data.username,
        email: data.email,
        role: data.role,
        tokenType: data.type || "Bearer",
      });
    }

    return data;
  }

  function requireAuth({ redirectTo = "index.html" } = {}) {
    if (!getAccessToken()) {
      window.location.href = redirectTo;
      return false;
    }
    return true;
  }

  function logout(redirectTo = "index.html") {
    clearAccessToken();
    window.location.href = redirectTo;
  }

  // Endpoint map for gradual integration. Use these paths instead of hardcoding URLs in pages.
  const API_ENDPOINTS = Object.freeze({
    authLogin: "/auth/login",
    authVerifyOtp: "/auth/verify-otp",
    authRegister: "/auth/register",
    authGoogle: "/auth/google",
    profile: "/users/profile",
    allUsers: "/users/all",
    mySeries: "/manga-series/my-series",
    resourceLibrary: "/resources",
    assistantTasks: "/tasks/assistant",
    taskDetail: "/tasks",
    mangaSeries: "/manga-series",
    chapters: "/chapters",
    myTasks: "/tasks/my-tasks",
    notificationsUnread: "/notifications/unread",
    resources: "/resources",
    resourceUpload: "/resources/upload",
    schedules: "/schedules",
    deadlines: "/deadlines",
    systemParameters: "/system-parameters",
  });

  window.MangaApi = {
    DEFAULT_API_BASE_URL,
    DEFAULT_WS_URL,
    ROLE_ROUTES,
    BACKEND_ROLES,
    API_ENDPOINTS,
    getApiBaseUrl,
    getWsUrl,
    getAccessToken,
    setAccessToken,
    clearAccessToken,
    getCurrentUser,
    setCurrentUser,
    normalizeRole,
    backendRoleFromUi,
    routeForRole,
    goToDashboard,
    apiFetch,
    loginWithPassword,
    verifyOtp,
    registerUser,
    loginWithGoogle,
    requireAuth,
    logout,
  };

  // Keep old global function name working for existing/future scripts.
  window.apiFetch = apiFetch;
})();
