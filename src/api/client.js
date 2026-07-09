const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api/v1").replace(/\/$/, "");
const WS_BASE_URL = (import.meta.env.VITE_WS_BASE_URL || "http://localhost:8080/ws").replace(/\/$/, "");

const SESSION_KEYS = [
  "accessToken",
  "token",
  "tokenType",
  "userId",
  "username",
  "email",
  "role",
  "activeSeriesId",
  "activeChapterId",
  "activePageId"
];

export function normalizeRole(role = "") {
  return String(role || "")
    .replace(/^ROLE_/i, "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/[\s-]+/g, " ")
    .trim();
}

export function roleLabel(role = "") {
  const normalized = normalizeRole(role);
  if (normalized.includes("admin")) return "Admin";
  if (normalized.includes("editorial") || normalized.includes("board")) return "Editorial Board";
  if (normalized.includes("tantou")) return "Tantou Editor";
  if (normalized.includes("assistant")) return "Assistant";
  if (normalized.includes("mangaka")) return "Mangaka";
  return role || "User";
}

export function roleHome() {
  return "/dashboard";
}

export function hasRole(role, fragments = []) {
  const normalized = normalizeRole(role);
  return fragments.some((fragment) => normalized.includes(fragment));
}

export function getToken() {
  return localStorage.getItem("accessToken") || localStorage.getItem("token") || "";
}

export function getSession() {
  return {
    token: getToken(),
    id: localStorage.getItem("userId") || "",
    username: localStorage.getItem("username") || "",
    email: localStorage.getItem("email") || "",
    role: localStorage.getItem("role") || ""
  };
}

export function setSession(data = {}) {
  const token = data.token || data.accessToken || data.jwt || "";
  if (token) {
    localStorage.setItem("accessToken", token);
    localStorage.setItem("token", token);
  }

  const userId = data.id || data.userId || data.user_id;
  if (userId !== undefined && userId !== null) localStorage.setItem("userId", String(userId));
  if (data.username) localStorage.setItem("username", data.username);
  if (data.email) localStorage.setItem("email", data.email);
  if (data.role || data.roleName) localStorage.setItem("role", data.role || data.roleName);
  if (data.type) localStorage.setItem("tokenType", data.type);
  return getSession();
}

export function clearSession() {
  SESSION_KEYS.forEach((key) => localStorage.removeItem(key));
}

export function objectToQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, value);
  });
  const text = search.toString();
  return text ? `?${text}` : "";
}

export function unwrapList(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.content)) return payload.content;
  if (payload && Array.isArray(payload.data)) return payload.data;
  if (payload && payload.data && Array.isArray(payload.data.content)) return payload.data.content;
  if (payload && Array.isArray(payload.items)) return payload.items;
  if (payload && Array.isArray(payload.results)) return payload.results;
  return [];
}

export function normalizeTaskStatus(status = "") {
  const value = String(status || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (["TODO", "TO_DO", "OPEN", "NEW", "PENDING"].includes(value)) return "TODO";
  if (["DOING", "IN_PROGRESS", "PROGRESS", "WORKING"].includes(value)) return "DOING";
  if (["REVIEWING", "REVIEW", "IN_REVIEW", "PENDING_REVIEW", "WAITING_REVIEW", "DONE"].includes(value)) return "REVIEWING";
  if (["APPROVED", "COMPLETE", "COMPLETED", "ACCEPTED"].includes(value)) return "APPROVED";
  return value || "TODO";
}

export function extractMediaUrl(payload) {
  if (!payload) return "";
  if (typeof payload === "string") return payload;
  return payload.url ||
    payload.fileUrl ||
    payload.imageUrl ||
    payload.resourceUrl ||
    payload.secureUrl ||
    payload.downloadUrl ||
    payload.path ||
    payload.data?.url ||
    payload.data?.fileUrl ||
    payload.data?.imageUrl ||
    payload.data?.resourceUrl ||
    "";
}

export function resolveMediaUrl(rawUrl) {
  const raw = String(rawUrl || "").trim();
  if (!raw) return "";
  if (/^(data:|blob:|https?:\/\/)/i.test(raw)) return raw;
  try {
    const api = new URL(API_BASE_URL, window.location.origin);
    if (raw.startsWith("/")) return `${api.origin}${raw}`;
    return `${api.origin}/${raw.replace(/^\/+/, "")}`;
  } catch {
    return raw;
  }
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();
  if (!text) return null;
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}

export async function apiFetch(path, options = {}) {
  const token = getToken();
  const normalized = { ...options };
  const isFormData = normalized.body instanceof FormData;
  const isUrlEncoded = normalized.body instanceof URLSearchParams;
  const isBlob = typeof Blob !== "undefined" && normalized.body instanceof Blob;

  if (
    normalized.body &&
    typeof normalized.body === "object" &&
    !isFormData &&
    !isUrlEncoded &&
    !isBlob &&
    !(normalized.body instanceof String)
  ) {
    normalized.body = JSON.stringify(normalized.body);
  }

  const headers = {
    ...(isFormData ? {} : { "Content-Type": normalized.contentType || "application/json" }),
    ...(normalized.headers || {})
  };

  if (token) headers.Authorization = `Bearer ${token}`;
  delete normalized.contentType;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...normalized,
    headers
  });
  const payload = await parseResponse(response);

  if (!response.ok) {
    if (response.status === 401) {
      clearSession();
    }
    const message = typeof payload === "string"
      ? payload
      : payload?.message || payload?.error || payload?.detail || `API error ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

function formPost(path, formData, method = "POST") {
  return apiFetch(path, { method, body: formData });
}

export const api = {
  API_BASE_URL,
  WS_BASE_URL,

  auth: {
    login: async ({ username, password }) => {
      const data = await apiFetch("/auth/login", { method: "POST", body: { username, password } });
      return setSession(data || {});
    },
    register: (payload) => apiFetch("/auth/register", { method: "POST", body: payload }),
    requestOtp: ({ username, password }) => apiFetch("/auth/request-otp", { method: "POST", body: { username, password } }),
    verifyOtp: async (email, otpCode) => {
      const data = await apiFetch("/auth/verify-otp", { method: "POST", body: { email, otpCode } });
      return setSession(data || {});
    },
    google: async (token) => {
      const data = await apiFetch("/auth/google", { method: "POST", body: { token } });
      return setSession(data || {});
    }
  },

  users: {
    profile: () => apiFetch("/users/profile"),
    updateProfile: (payload) => apiFetch("/users/profile", { method: "PUT", body: payload }),
    all: () => apiFetch("/users/all"),
    byRole: (role) => apiFetch(`/users${objectToQuery({ role })}`),
    lock: (id, isActive) => apiFetch(`/users/${id}/lock${objectToQuery({ isActive })}`, { method: "PATCH" }),
    assignRole: (id, roleName) => apiFetch(`/users/${id}/role${objectToQuery({ roleName })}`, { method: "PATCH" })
  },

  series: {
    mine: async () => unwrapList(await apiFetch("/manga-series/my-series")),
    list: async (params = {}) => unwrapList(await apiFetch(`/manga-series${objectToQuery({ page: 0, size: 50, ...params })}`)),
    get: (id) => apiFetch(`/manga-series/${id}`),
    create: (payload) => apiFetch("/manga-series", { method: "POST", body: payload }),
    update: (id, payload) => apiFetch(`/manga-series/${id}`, { method: "PUT", body: payload }),
    remove: (id) => apiFetch(`/manga-series/${id}`, { method: "DELETE" }),
    status: (id, newStatus) => apiFetch(`/manga-series/${id}/status${objectToQuery({ newStatus })}`, { method: "PATCH" }),
    adminDecision: (id, isApproved, tantouId) => apiFetch(`/manga-series/${id}/admin-decision${objectToQuery({ isApproved, tantouId })}`, { method: "PATCH" })
  },

  chapters: {
    bySeries: (seriesId) => apiFetch(`/chapters/series/${seriesId}`),
    get: (id) => apiFetch(`/chapters/${id}`),
    create: (payload) => apiFetch("/chapters", { method: "POST", body: payload }),
    status: (id, newStatus) => apiFetch(`/chapters/${id}/status${objectToQuery({ newStatus })}`, { method: "PATCH" }),
    remove: (id) => apiFetch(`/chapters/${id}`, { method: "DELETE" })
  },

  chapterScripts: {
    get: (chapterId) => apiFetch(`/chapter-scripts/chapters/${chapterId}`),
    save: (chapterId, content) => {
      const text = String(content ?? "").trim();
      if (!text) {
        return Promise.reject(new Error("Write chapter script / notes before saving."));
      }
      return apiFetch(`/chapter-scripts/chapters/${chapterId}`, {
        method: "POST",
        body: text,
        contentType: "text/plain; charset=UTF-8"
      });
    },
    bySeries: (seriesId) => apiFetch(`/chapter-scripts/series/${seriesId}`)
  },

  pages: {
    byChapter: (chapterId) => apiFetch(`/pages/chapter/${chapterId}`),
    upload: (chapterId, pageNumber, file) => {
      const form = new FormData();
      form.append("pageNumber", pageNumber);
      form.append("file", file);
      return formPost(`/pages/chapter/${chapterId}`, form, "POST");
    },
    replaceImage: (pageId, file) => {
      const form = new FormData();
      form.append("file", file);
      return formPost(`/pages/${pageId}/image`, form, "PUT");
    },
    remove: (pageId) => apiFetch(`/pages/${pageId}`, { method: "DELETE" })
  },

  workspace: {
    canvasInit: (pageId) => apiFetch(`/workspace/pages/${pageId}/canvas-init`),
    hitboxes: (pageId) => apiFetch(`/workspace/pages/${pageId}/hitboxes`),
    createHitbox: (pageId, box) => apiFetch(`/workspace/pages/${pageId}/hitboxes${objectToQuery({
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height
    })}`, { method: "POST" }),
    deleteHitbox: (hitboxId) => apiFetch(`/workspace/hitboxes/${hitboxId}`, { method: "DELETE" }),
    createTask: (hitboxId, description) => apiFetch(`/workspace/hitboxes/${hitboxId}/task`, {
      method: "POST",
      body: { description }
    })
  },

  hitboxComments: {
    list: (hitboxId) => apiFetch(`/hitbox-comments/${hitboxId}`),
    create: (hitboxId, content) => apiFetch(`/hitbox-comments/${hitboxId}${objectToQuery({ content })}`, { method: "POST" })
  },

  tasks: {
    mine: () => apiFetch("/tasks/my-tasks"),
    bySeries: (seriesId) => apiFetch(`/tasks/series/${seriesId}`),
    status: (taskId, newStatus) => apiFetch(`/tasks/${taskId}/status${objectToQuery({ newStatus: normalizeTaskStatus(newStatus) })}`, { method: "PATCH" }),
    assign: (taskId, assistantId) => apiFetch(`/tasks/${taskId}/assign${objectToQuery({ assistantId })}`, { method: "PATCH" }),
    submit: (taskId, imageUrl) => apiFetch(`/tasks/${taskId}/submit${objectToQuery({ imageUrl })}`, { method: "PATCH" })
  },

  resources: {
    list: () => apiFetch("/resources"),
    upload: (file, resourceType = "PAGE_IMAGE") => {
      const form = new FormData();
      form.append("file", file);
      form.append("resourceType", resourceType);
      return formPost("/resources/upload", form, "POST");
    },
    remove: (id) => apiFetch(`/resources/${id}`, { method: "DELETE" })
  },

  feedback: {
    byPage: (pageId) => apiFetch(`/tantou-feedbacks/pages/${pageId}`),
    create: (pageId, data) => apiFetch(`/tantou-feedbacks/pages/${pageId}${objectToQuery(data)}`, { method: "POST" }),
    resolve: (feedbackId) => apiFetch(`/tantou-feedbacks/${feedbackId}/resolve`, { method: "PATCH" })
  },

  votes: {
    summary: (seriesId) => apiFetch(`/votes/series/${seriesId}/summary`),
    cast: (seriesId, isApproved) => apiFetch(`/votes/series/${seriesId}${objectToQuery({ isApproved })}`, { method: "POST" })
  },

  schedules: {
    bySeries: (seriesId) => apiFetch(`/schedules/series/${seriesId}`),
    create: (payload) => apiFetch("/schedules", { method: "POST", body: payload }),
    update: (id, payload) => apiFetch(`/schedules/${id}`, { method: "PUT", body: payload }),
    remove: (id) => apiFetch(`/schedules/${id}`, { method: "DELETE" })
  },

  deadlines: {
    bySeries: (seriesId) => apiFetch(`/deadlines/series/${seriesId}`),
    create: (seriesId, eventName, deadlineDateStr) => apiFetch(`/deadlines/series/${seriesId}${objectToQuery({ eventName, deadlineDateStr })}`, { method: "POST" }),
    remove: (eventId) => apiFetch(`/deadlines/${eventId}`, { method: "DELETE" })
  },

  notifications: {
    unread: () => apiFetch("/notifications/unread"),
    markRead: (id) => apiFetch(`/notifications/${id}/read`, { method: "PATCH" })
  },

  telemetry: {
    bySeries: (seriesId) => apiFetch(`/telemetry/series/${seriesId}`),
    chapterView: (chapterId) => apiFetch(`/telemetry/chapters/${chapterId}/view`, { method: "POST" })
  },

  system: {
    parameters: () => apiFetch("/system-parameters"),
    create: (key, value) => apiFetch(`/system-parameters${objectToQuery({ key, value })}`, { method: "POST" }),
    update: (key, value) => apiFetch(`/system-parameters/${encodeURIComponent(key)}${objectToQuery({ value })}`, { method: "PUT" }),
    remove: (key) => apiFetch(`/system-parameters/${encodeURIComponent(key)}`, { method: "DELETE" })
  }
};
