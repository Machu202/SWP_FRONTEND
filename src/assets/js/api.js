const API_BASE_URL = (window.MANGA_API_BASE_URL || "http://localhost:8080/api/v1").replace(/\/$/, "");
const WS_BASE_URL = (window.MANGA_WS_BASE_URL || "http://localhost:8080/ws").replace(/\/$/, "");

function getAccessToken() {
  return localStorage.getItem("accessToken") || localStorage.getItem("token") || "";
}

function setSession(data = {}) {
  const token = data.token || data.accessToken || data.jwt || "";
  if (token) {
    localStorage.setItem("accessToken", token);
    localStorage.setItem("token", token);
  }

  const userId = data.id || data.userId || data.user_id;
  if (userId) localStorage.setItem("userId", String(userId));
  if (data.username) localStorage.setItem("username", data.username);
  if (data.email) localStorage.setItem("email", data.email);
  if (data.role || data.roleName) localStorage.setItem("role", data.role || data.roleName);
  if (data.type) localStorage.setItem("tokenType", data.type);
  return data;
}

function clearSession() {
  ["accessToken", "token", "userId", "username", "email", "role", "activeSeriesId", "activeChapterId", "activePageId"].forEach((key) => localStorage.removeItem(key));
}

function normalizeRole(role = "") {
  return String(role || "")
    .replace(/^ROLE_/i, "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/[\s-]+/g, " ")
    .trim();
}

function routeForRole(role = "") {
  const normalized = normalizeRole(role);
  if (normalized.includes("admin")) return "../../admin-dashboard.html";
  if (normalized.includes("editorial") || normalized.includes("board")) return "../../board-dashboard.html";
  if (normalized.includes("tantou")) return "../../tantou-dashboard.html";
  if (normalized.includes("assistant")) return "../../pages/assistant/assistant-dashboard.html";
  if (normalized.includes("mangaka")) return "../../pages/mangaka/dashboard.html";
  return "../../index.html";
}

function objectToQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, value);
  });
  const text = query.toString();
  return text ? `?${text}` : "";
}

function unwrapPage(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.content)) return payload.content;
  if (payload && Array.isArray(payload.data)) return payload.data;
  if (payload && payload.data && Array.isArray(payload.data.content)) return payload.data.content;
  if (payload && Array.isArray(payload.items)) return payload.items;
  if (payload && Array.isArray(payload.results)) return payload.results;
  return payload ? [] : [];
}

function normalizeTaskStatus(status = "") {
  const s = String(status || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (s === "IN_PROGRESS" || s === "PROGRESS" || s === "DOING") return "DOING";
  if (s === "REVIEW" || s === "DONE" || s === "REVIEWING" || s === "IN_REVIEW" || s === "INREVIEW" || s === "PENDING_REVIEW" || s === "WAITING_REVIEW") return "REVIEWING";
  if (s === "APPROVED" || s === "COMPLETE" || s === "COMPLETED") return "APPROVED";
  return "TODO";
}

async function apiFetch(path, options = {}) {
  const token = getAccessToken();
  const normalizedOptions = { ...options };
  const isFormData = normalizedOptions.body instanceof FormData;
  const isUrlEncoded = normalizedOptions.body instanceof URLSearchParams;
  const isBlob = typeof Blob !== "undefined" && normalizedOptions.body instanceof Blob;

  if (
    normalizedOptions.body &&
    typeof normalizedOptions.body === "object" &&
    !isFormData &&
    !isUrlEncoded &&
    !isBlob &&
    typeof normalizedOptions.body !== "string"
  ) {
    normalizedOptions.body = JSON.stringify(normalizedOptions.body);
  }

  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(normalizedOptions.headers || {}),
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...normalizedOptions,
    headers,
  });

  const contentType = response.headers.get("content-type") || "";
  let payload = null;
  if (contentType.includes("application/json")) {
    const text = await response.text();
    payload = text ? JSON.parse(text) : null;
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
  return localStorage.getItem("activeSeriesId") ||
    localStorage.getItem("currentSeriesId") ||
    new URLSearchParams(location.search).get("seriesId") ||
    "";
}
function setActiveSeriesId(id) {
  if (id) {
    localStorage.setItem("activeSeriesId", String(id));
    localStorage.setItem("currentSeriesId", String(id));
  }
}
function getActiveChapterId() {
  return localStorage.getItem("activeChapterId") ||
    localStorage.getItem("currentChapterId") ||
    new URLSearchParams(location.search).get("chapterId") ||
    "";
}
function setActiveChapterId(id) {
  if (id) {
    localStorage.setItem("activeChapterId", String(id));
    localStorage.setItem("currentChapterId", String(id));
  }
}
function getActivePageId() {
  return localStorage.getItem("activePageId") ||
    localStorage.getItem("currentPageId") ||
    new URLSearchParams(location.search).get("pageId") ||
    "";
}
function setActivePageId(id) {
  if (id) {
    localStorage.setItem("activePageId", String(id));
    localStorage.setItem("currentPageId", String(id));
  }
}


// MANGAKA LOCAL SCRIPT STORAGE
// Backend currently exposes series summaries and chapter/page data,
// but not a guaranteed chapter-script endpoint in every build.
// Keep scripts locally keyed by backend IDs so the UI can attach notes
// to newly created series/chapters without breaking older backend DTOs.
function getLocalScriptStore(type) {
  try {
    return JSON.parse(localStorage.getItem(`mangaka${type}Scripts`) || "{}");
  } catch (_) {
    return {};
  }
}

function saveLocalScript(type, id, scriptText) {
  if (!id) return;
  const store = getLocalScriptStore(type);
  store[String(id)] = String(scriptText || "");
  localStorage.setItem(`mangaka${type}Scripts`, JSON.stringify(store));
}

function getLocalScript(type, id) {
  if (!id) return "";
  return getLocalScriptStore(type)[String(id)] || "";
}


// MANGAKA LOCAL SERIES METADATA
// Used when the current backend DTO does not persist cover images/descriptions yet.
function getLocalSeriesMetaStore() {
  try {
    return JSON.parse(localStorage.getItem("mangakaSeriesMeta") || "{}");
  } catch (_) {
    return {};
  }
}

function saveLocalSeriesMeta(seriesId, meta = {}) {
  if (!seriesId) return;
  const store = getLocalSeriesMetaStore();
  store[String(seriesId)] = { ...(store[String(seriesId)] || {}), ...meta };
  localStorage.setItem("mangakaSeriesMeta", JSON.stringify(store));
}

function getLocalSeriesMeta(seriesId) {
  if (!seriesId) return {};
  return getLocalSeriesMetaStore()[String(seriesId)] || {};
}

function extractUploadedUrl(payload) {
  if (!payload) return "";
  if (typeof payload === "string") return payload;
  return payload.url ||
    payload.imageUrl ||
    payload.fileUrl ||
    payload.resourceUrl ||
    payload.secureUrl ||
    payload.downloadUrl ||
    payload.path ||
    payload.data?.url ||
    payload.data?.imageUrl ||
    payload.data?.fileUrl ||
    payload.data?.resourceUrl ||
    "";
}


function resolveMediaUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (/^(data:|blob:|https?:\/\/)/i.test(raw)) return raw;

  try {
    const apiUrl = new URL(API_BASE_URL, window.location.origin);
    if (raw.startsWith("/")) return `${apiUrl.origin}${raw}`;
    return `${apiUrl.origin}/${raw.replace(/^\/+/, "")}`;
  } catch (_) {
    return raw;
  }
}


// LOCAL SCHEDULE ITEMS
// Used by the shared Schedule page and as a fallback when the backend has no task-deadline field.
function getLocalScheduleItems() {
  try {
    return JSON.parse(localStorage.getItem("studioScheduleItems") || "[]");
  } catch (_) {
    return [];
  }
}

function saveLocalScheduleItems(items) {
  localStorage.setItem("studioScheduleItems", JSON.stringify(Array.isArray(items) ? items : []));
}

function addLocalScheduleItem(item = {}) {
  const items = getLocalScheduleItems();
  const id = item.id || `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const saved = {
    id,
    createdAt: new Date().toISOString(),
    status: "OPEN",
    ...item,
    id
  };

  const existingIndex = items.findIndex(existing => String(existing.id) === String(id));
  if (existingIndex >= 0) items[existingIndex] = { ...items[existingIndex], ...saved };
  else items.unshift(saved);

  saveLocalScheduleItems(items);
  return saved;
}

function updateLocalScheduleItem(id, patch = {}) {
  const items = getLocalScheduleItems();
  const updated = items.map(item => String(item.id) === String(id) ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item);
  saveLocalScheduleItems(updated);
  return updated.find(item => String(item.id) === String(id));
}

function deleteLocalScheduleItem(id) {
  const items = getLocalScheduleItems().filter(item => String(item.id) !== String(id));
  saveLocalScheduleItems(items);
  return true;
}

const MangaApi = {
  API_BASE_URL,
  WS_BASE_URL,
  apiFetch,
  apiForm,
  saveChapterScript: (chapterId, scriptText) => saveLocalScript("Chapter", chapterId, scriptText),
  getChapterScript: (chapterId) => getLocalScript("Chapter", chapterId),
  saveSeriesScript: (seriesId, scriptText) => saveLocalScript("Series", seriesId, scriptText),
  getSeriesScript: (seriesId) => getLocalScript("Series", seriesId),
  saveSeriesMeta: saveLocalSeriesMeta,
  getSeriesMeta: getLocalSeriesMeta,
  extractUploadedUrl,
  resolveMediaUrl,
  objectToQuery,
  unwrapPage,
  normalizeTaskStatus,
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
  requestOtp: (email) => apiFetch("/auth/otp/request", { method: "POST", body: { email } }),
  verifyOtp: (email, otp) => apiFetch("/auth/otp/verify", { method: "POST", body: { email, otp } }),
  googleLoginUrl: () => `${API_BASE_URL}/auth/google`,


  profile: () => apiFetch("/users/profile"),
  updateProfile: (payload) => apiFetch("/users/profile", { method: "PUT", body: payload }),

  getScheduleItems: getLocalScheduleItems,
  addScheduleItem: addLocalScheduleItem,
  updateScheduleItem: updateLocalScheduleItem,
  deleteScheduleItem: deleteLocalScheduleItem,
  users: () => apiFetch("/users/all"),
  usersByRole: (role) => apiFetch(`/users${objectToQuery({ role })}`),
  getRoles: () => Promise.resolve([
    "Mangaka",
    "Assistant",
    "Tantou Editor",
    "Editorial Board",
    "Admin"
  ]),
  assistants: () => apiFetch(`/users${objectToQuery({ role: "Assistant" })}`),
  lockUser: (id, isActive) => apiFetch(`/users/${id}/lock${objectToQuery({ isActive })}`, { method: "PATCH" }),
  assignRole: (id, roleName) => apiFetch(`/users/${id}/role${objectToQuery({ roleName })}`, { method: "PATCH" }),

  parameters: () => apiFetch("/system-parameters"),
  createParameter: (key, value) => apiFetch(`/system-parameters${objectToQuery({ key, value })}`, { method: "POST" }),
  updateParameter: (key, value) => apiFetch(`/system-parameters/${encodeURIComponent(key)}${objectToQuery({ value })}`, { method: "PUT" }),
  deleteParameter: (key) => apiFetch(`/system-parameters/${encodeURIComponent(key)}`, { method: "DELETE" }),

  allSeries: async (params = {}) => unwrapPage(await apiFetch(`/manga-series${objectToQuery(params)}`)),
  mySeries: async () => unwrapPage(await apiFetch("/manga-series/my-series")),
  series: (id) => apiFetch(`/manga-series/${id}`),
  updateSeriesStatus: (id, newStatus) => apiFetch(`/manga-series/${id}/status${objectToQuery({ newStatus })}`, { method: "PATCH" }),
  adminDecision: (id, isApproved, tantouId) => apiFetch(`/manga-series/${id}/admin-decision${objectToQuery({ isApproved, tantouId })}`, { method: "PATCH" }),

  chapters: async (seriesId) => unwrapPage(await apiFetch(`/chapters/series/${seriesId}`)),
  chapter: (id) => apiFetch(`/chapters/${id}`),
  updateChapterStatus: (id, newStatus) => apiFetch(`/chapters/${id}/status${objectToQuery({ newStatus })}`, { method: "PATCH" }),
  createChapter: (payload) => apiFetch("/chapters", { method: "POST", body: payload }),
  pages: async (chapterId) => unwrapPage(await apiFetch(`/pages/chapter/${chapterId}`)),
  createPage: (chapterId, pageNumber, file) => {
    const fd = new FormData();
    fd.append("pageNumber", pageNumber);
    fd.append("file", file);
    return apiForm(`/pages/chapter/${chapterId}`, fd, { method: "POST" });
  },
  updatePageImage: (pageId, file) => {
    const fd = new FormData();
    fd.append("file", file);
    return apiForm(`/pages/${pageId}/image`, fd, { method: "PUT" });
  },
  canvasInit: (pageId) => apiFetch(`/workspace/pages/${pageId}/canvas-init`),
  createHitbox: (pageId, box) => apiFetch(`/workspace/pages/${pageId}/hitboxes${objectToQuery({ x: box.x, y: box.y, width: box.width, height: box.height })}`, { method: "POST" }),
  assignTaskToHitbox: (hitboxId, description) => apiFetch(`/workspace/hitboxes/${hitboxId}/task`, { method: "POST", body: { description } }),

  tasks: async () => unwrapPage(await apiFetch("/tasks/my-tasks")),
  tasksBySeries: (seriesId) => apiFetch(`/tasks/series/${seriesId}`),
  taskById: async (taskId) => {
    const tasks = await apiFetch("/tasks/my-tasks");
    return (tasks || []).find(t => String(t.id) === String(taskId));
  },
  updateTaskStatus: (taskId, newStatus) => apiFetch(`/tasks/${taskId}/status${objectToQuery({ newStatus: normalizeTaskStatus(newStatus) })}`, { method: "PATCH" }),
  assignTask: (taskId, assistantId) => apiFetch(`/tasks/${taskId}/assign${objectToQuery({ assistantId })}`, { method: "PATCH" }),
  submitTask: (taskId, imageUrl) => apiFetch(`/tasks/${taskId}/submit${objectToQuery({ imageUrl })}`, { method: "PATCH" }),

  feedbacks: (pageId) => apiFetch(`/tantou-feedbacks/pages/${pageId}`),
  createFeedback: (pageId, data) => apiFetch(`/tantou-feedbacks/pages/${pageId}${objectToQuery(data)}`, { method: "POST" }),
  resolveFeedback: (id) => apiFetch(`/tantou-feedbacks/${id}/resolve`, { method: "PATCH" }),

  voteSummary: (seriesId) => apiFetch(`/votes/series/${seriesId}/summary`),
  telemetry: (seriesId) => apiFetch(`/telemetry/series/${seriesId}`),
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

  logout() {
    clearSession();
    window.location.href = routeForRole("").replace("index.html", "index.html");
  },

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
