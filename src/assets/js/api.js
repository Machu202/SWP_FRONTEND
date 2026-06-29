const API_BASE_URL = (window.MANGA_API_BASE_URL || "http://localhost:8080/api/v1").replace(/\/$/, "");
const WS_BASE_URL = (window.MANGA_WS_BASE_URL || "http://localhost:8080/ws").replace(/\/$/, "");

function getAccessToken() {
  return localStorage.getItem("accessToken") || localStorage.getItem("token") || "";
}

function setSession(data = {}) {
  if (data.token) {
    localStorage.setItem("accessToken", data.token);
  }
  if (data.id || data.userId) {
    localStorage.setItem("userId", String(data.id || data.userId));
  }
  if (data.username) {
    localStorage.setItem("username", data.username);
  }
  if (data.email) {
    localStorage.setItem("email", data.email);
  }
  if (data.role) {
    localStorage.setItem("role", data.role);
  }
  return data;
}

function clearSession() {
  ["accessToken", "token", "userId", "username", "email", "role", "activeSeriesId", "activeChapterId", "activePageId"].forEach((key) => localStorage.removeItem(key));
}

function normalizeRole(role = "") {
  return String(role)
    .replace(/^ROLE_/i, "")
    .toLowerCase()
    .replace(/[\s_-]+/g, " ")
    .trim();
}

function routeForRole(role = "") {
  const normalized = normalizeRole(role);
  if (normalized.includes("admin")) return "admin-dashboard.html";
  if (normalized.includes("editorial")) return "board-dashboard.html";
  if (normalized.includes("tantou")) return "tantou-dashboard.html";
  if (normalized.includes("assistant")) return "pages/assistant/assistant-dashboard.html";
  return "pages/mangaka/dashboard.html";
}

function objectToQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, value);
  });
  const text = query.toString();
  return text ? `?${text}` : "";
}

async function apiFetch(path, options = {}) {
  const token = getAccessToken();
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    ...options,
    headers,
  });

  const contentType = response.headers.get("content-type") || "";
  let payload;
  if (contentType.includes("application/json")) {
    payload = await response.json();
  } else {
    payload = await response.text();
  }

  if (!response.ok) {
    const message = typeof payload === "string"
      ? payload
      : (payload?.message || payload?.error || JSON.stringify(payload));
    throw new Error(message || `API Error: ${response.status}`);
  }

  return payload;
}

async function apiForm(path, formData, options = {}) {
  return apiFetch(path, { ...options, body: formData, headers: options.headers || {} });
}

function getActiveSeriesId() {
  return localStorage.getItem("activeSeriesId") || new URLSearchParams(location.search).get("seriesId") || "1";
}
function setActiveSeriesId(id) {
  if (id) localStorage.setItem("activeSeriesId", String(id));
}
function getActiveChapterId() {
  return localStorage.getItem("activeChapterId") || new URLSearchParams(location.search).get("chapterId") || "";
}
function setActiveChapterId(id) {
  if (id) localStorage.setItem("activeChapterId", String(id));
}
function getActivePageId() {
  return localStorage.getItem("activePageId") || new URLSearchParams(location.search).get("pageId") || "";
}
function setActivePageId(id) {
  if (id) localStorage.setItem("activePageId", String(id));
}

const MangaApi = {
  API_BASE_URL,
  WS_BASE_URL,
  apiFetch,
  apiForm,
  objectToQuery,
  getAccessToken,
  setSession,
  clearSession,
  normalizeRole,
  routeForRole,
  getActiveSeriesId,
  setActiveSeriesId,
  getActiveChapterId,
  setActiveChapterId,
  getActivePageId,
  setActivePageId,

  login: async ({ username, password }) => setSession(await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  })),

  register: (payload) => apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  }),

  profile: () => apiFetch("/users/profile"),
  users: () => apiFetch("/users/all"),
  lockUser: (id, isActive) => apiFetch(`/users/${id}/lock${objectToQuery({ isActive })}`, { method: "PATCH" }),
  assignRole: (id, roleName) => apiFetch(`/users/${id}/role${objectToQuery({ roleName })}`, { method: "PATCH" }),

  parameters: () => apiFetch("/system-parameters"),
  createParameter: (key, value) => apiFetch(`/system-parameters${objectToQuery({ key, value })}`, { method: "POST" }),
  updateParameter: (key, value) => apiFetch(`/system-parameters/${encodeURIComponent(key)}${objectToQuery({ value })}`, { method: "PUT" }),
  deleteParameter: (key) => apiFetch(`/system-parameters/${encodeURIComponent(key)}`, { method: "DELETE" }),

  allSeries: () => apiFetch("/manga-series"),
  mySeries: () => apiFetch("/manga-series/my-series"),
  series: (id) => apiFetch(`/manga-series/${id}`),
  updateSeriesStatus: (id, newStatus) => apiFetch(`/manga-series/${id}/status${objectToQuery({ newStatus })}`, { method: "PATCH" }),
  adminDecision: (id, isApproved) => apiFetch(`/manga-series/${id}/admin-decision${objectToQuery({ isApproved })}`, { method: "PATCH" }),

  chapters: (seriesId) => apiFetch(`/chapters/series/${seriesId}`),
  chapter: (id) => apiFetch(`/chapters/${id}`),
  updateChapterStatus: (id, newStatus) => apiFetch(`/chapters/${id}/status${objectToQuery({ newStatus })}`, { method: "PATCH" }),
  pages: (chapterId) => apiFetch(`/pages/chapter/${chapterId}`),
  canvasInit: (pageId) => apiFetch(`/workspace/pages/${pageId}/canvas-init`),

  tasks: () => apiFetch("/tasks/my-tasks"),
  updateTaskStatus: (taskId, newStatus) => apiFetch(`/tasks/${taskId}/status${objectToQuery({ newStatus })}`, { method: "PATCH" }),

  feedbacks: (pageId) => apiFetch(`/tantou-feedbacks/pages/${pageId}`),
  createFeedback: (pageId, data) => apiFetch(`/tantou-feedbacks/pages/${pageId}${objectToQuery(data)}`, { method: "POST" }),
  resolveFeedback: (id) => apiFetch(`/tantou-feedbacks/${id}/resolve`, { method: "PATCH" }),

  voteSummary: (seriesId) => apiFetch(`/votes/series/${seriesId}/summary`),
  castVote: (seriesId, isApproved) => apiFetch(`/votes/series/${seriesId}${objectToQuery({ isApproved })}`, { method: "POST" }),

  schedules: (seriesId) => apiFetch(`/schedules/series/${seriesId}`),
  createSchedule: (payload) => apiFetch("/schedules", { method: "POST", body: JSON.stringify(payload) }),
  updateSchedule: (id, payload) => apiFetch(`/schedules/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteSchedule: (id) => apiFetch(`/schedules/${id}`, { method: "DELETE" }),

  deadlines: (seriesId) => apiFetch(`/deadlines/series/${seriesId}`),
  createDeadline: (seriesId, eventName, deadlineDateStr) => apiFetch(`/deadlines/series/${seriesId}${objectToQuery({ eventName, deadlineDateStr })}`, { method: "POST" }),
  deleteDeadline: (eventId) => apiFetch(`/deadlines/${eventId}`, { method: "DELETE" }),

  resources: () => apiFetch("/resources"),
  uploadResource: (file, resourceType = "PAGE_IMAGE") => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("resourceType", resourceType);
    return apiForm("/resources/upload", fd, { method: "POST" });
  },

  unreadNotifications: () => apiFetch("/notifications/unread"),
  markNotificationRead: (id) => apiFetch(`/notifications/${id}/read`, { method: "PATCH" }),

  connectNotifications(userId, onMessage) {
    if (!userId || typeof SockJS === "undefined" || typeof StompJs === "undefined") return null;
    const socket = new SockJS(WS_BASE_URL);
    const client = new StompJs.Client({ webSocketFactory: () => socket, reconnectDelay: 5000 });
    client.onConnect = () => client.subscribe(`/topic/notifications/${userId}`, (message) => {
      try { onMessage(JSON.parse(message.body)); } catch { onMessage(message.body); }
    });
    client.activate();
    return client;
  },
};

window.API_BASE_URL = API_BASE_URL;
window.apiFetch = apiFetch;
window.MangaApi = MangaApi;


// FE-core2 compatibility aliases for nested Mangaka/Assistant pages.
(function () {
  if (!window.MangaApi) return;
  const api = window.MangaApi;
  if (!api.loginWithPassword && api.login) {
    api.loginWithPassword = (username, password) => api.login({ username, password });
  }
  if (!api.registerUser && api.register) {
    api.registerUser = (userData) => api.register(userData);
  }
  if (!api.setAccessToken) {
    api.setAccessToken = function (token, role) {
      if (token) localStorage.setItem("accessToken", token);
      if (role) localStorage.setItem("role", role);
    };
  }
  if (!api.goToDashboard) {
    api.goToDashboard = function (roleName) {
      const normalized = api.normalizeRole ? api.normalizeRole(roleName || localStorage.getItem("role") || "") : String(roleName || "").toLowerCase();
      let route = "../../pages/mangaka/dashboard.html";
      if (normalized.includes("assistant")) route = "../../pages/assistant/assistant-dashboard.html";
      else if (normalized.includes("admin")) route = "../../admin-dashboard.html";
      else if (normalized.includes("editorial")) route = "../../board-dashboard.html";
      else if (normalized.includes("tantou")) route = "../../tantou-dashboard.html";
      window.location.href = route;
    };
  }
})();
