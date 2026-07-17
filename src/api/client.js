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

const WORKSPACE_SELECTION_KEYS = {
  seriesId: "activeSeriesId",
  chapterId: "activeChapterId",
  pageId: "activePageId"
};
const WORKSPACE_SELECTION_PREFIX = "swpWorkspaceSelection";

export function normalizeRole(role = "") {
  return String(role || "")
    .replace(/^ROLE_/i, "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/[\s-]+/g, " ")
    .trim();
}

export function seriesDisplayNumber(series) {
  return series?.displayNumber ?? series?.display_number ?? series?.seriesDisplayNumber ?? series?.series_display_number ?? series?.id ?? "";
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

function sessionStore() {
  return window.sessionStorage;
}

function clearLegacyPersistentSession() {
  // Older builds stored authentication in localStorage, which is shared across
  // every tab and survives browser restarts. Remove only the known session keys
  // so upgrading users are returned to Login without deleting unrelated prefs.
  try {
    SESSION_KEYS.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Storage can be unavailable in hardened/private browser contexts.
  }
}

function decodeJwtPayload(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    return JSON.parse(window.atob(padded));
  } catch {
    return null;
  }
}

export function isTokenExpired(token, now = Date.now()) {
  const payload = decodeJwtPayload(token);
  // A malformed token cannot be trusted as an authenticated browser session.
  if (!payload || typeof payload.exp !== "number") return true;
  return payload.exp * 1000 <= now;
}

export function getToken() {
  clearLegacyPersistentSession();
  let token = "";
  try {
    token = sessionStore().getItem("accessToken") || sessionStore().getItem("token") || "";
  } catch {
    return "";
  }
  if (token && isTokenExpired(token)) {
    clearSession();
    return "";
  }
  return token;
}

export function getSession() {
  const token = getToken();
  if (!token) {
    return { token: "", id: "", username: "", email: "", role: "" };
  }
  const store = sessionStore();
  return {
    token,
    id: store.getItem("userId") || "",
    username: store.getItem("username") || "",
    email: store.getItem("email") || "",
    role: store.getItem("role") || ""
  };
}

export function setSession(data = {}) {
  clearLegacyPersistentSession();
  const store = sessionStore();
  const token = data.token || data.accessToken || data.jwt || "";
  if (token) {
    store.setItem("accessToken", token);
    store.setItem("token", token);
  }

  const userId = data.id || data.userId || data.user_id;
  if (userId !== undefined && userId !== null) store.setItem("userId", String(userId));
  if (data.username) store.setItem("username", data.username);
  if (data.email) store.setItem("email", data.email);
  if (data.role || data.roleName) store.setItem("role", data.role || data.roleName);
  if (data.type) store.setItem("tokenType", data.type);
  return getSession();
}

function workspaceSelectionScopeKey(store = sessionStore()) {
  const userId = store.getItem("userId") || "anonymous";
  const role = normalizeRole(store.getItem("role") || "user").replace(/[^a-z0-9]+/g, "-") || "user";
  return `${WORKSPACE_SELECTION_PREFIX}:${userId}:${role}`;
}

function emptyWorkspaceSelection() {
  return { seriesId: "", chapterId: "", pageId: "" };
}

export function clearSession() {
  try {
    const store = sessionStore();
    SESSION_KEYS.forEach((key) => store.removeItem(key));
    for (let index = store.length - 1; index >= 0; index -= 1) {
      const key = store.key(index);
      if (key && key.startsWith(`${WORKSPACE_SELECTION_PREFIX}:`)) store.removeItem(key);
    }
  } finally {
    clearLegacyPersistentSession();
  }
}

export function getWorkspaceSelection() {
  try {
    const store = sessionStore();
    const scopedRaw = store.getItem(workspaceSelectionScopeKey(store));
    if (scopedRaw) {
      const parsed = JSON.parse(scopedRaw);
      return {
        seriesId: parsed?.seriesId ? String(parsed.seriesId) : "",
        chapterId: parsed?.chapterId ? String(parsed.chapterId) : "",
        pageId: parsed?.pageId ? String(parsed.pageId) : ""
      };
    }
    const legacy = {
      seriesId: store.getItem(WORKSPACE_SELECTION_KEYS.seriesId) || "",
      chapterId: store.getItem(WORKSPACE_SELECTION_KEYS.chapterId) || "",
      pageId: store.getItem(WORKSPACE_SELECTION_KEYS.pageId) || ""
    };
    if (legacy.seriesId || legacy.chapterId || legacy.pageId) {
      store.setItem(workspaceSelectionScopeKey(store), JSON.stringify(legacy));
    }
    return legacy;
  } catch {
    return emptyWorkspaceSelection();
  }
}

export function setWorkspaceSelection(next = {}) {
  try {
    const store = sessionStore();
    const current = getWorkspaceSelection();
    const merged = { ...current };
    Object.entries(WORKSPACE_SELECTION_KEYS).forEach(([field, key]) => {
      if (!(field in next)) return;
      const value = next[field];
      merged[field] = value === undefined || value === null || value === "" ? "" : String(value);
      if (merged[field]) store.setItem(key, merged[field]);
      else store.removeItem(key);
    });
    store.setItem(workspaceSelectionScopeKey(store), JSON.stringify(merged));
    return merged;
  } catch {
    return emptyWorkspaceSelection();
  }
}

export function preferredWorkspaceSeriesId(seriesList = [], { explicitSeriesId = "", currentSeriesId = "" } = {}) {
  const list = Array.isArray(seriesList) ? seriesList : unwrapList(seriesList);
  const remembered = getWorkspaceSelection().seriesId;
  const candidates = [explicitSeriesId, currentSeriesId, remembered]
    .map((value) => String(value || ""))
    .filter(Boolean);
  for (const candidate of candidates) {
    if (list.some((item) => String(item?.id) === candidate)) return candidate;
  }
  return String(list[0]?.id || "");
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
  if (["DOING", "IN_PROGRESS", "PROGRESS", "WORKING", "REVISION", "CHANGES_REQUESTED", "NEEDS_REVISION"].includes(value)) return "DOING";
  if (["REVIEWING", "REVIEW", "IN_REVIEW", "PENDING_REVIEW", "WAITING_REVIEW", "SUBMITTED", "SUBMITTED_FOR_REVIEW", "AWAITING_REVIEW", "DONE"].includes(value)) return "REVIEWING";
  if (["APPROVED", "COMPLETE", "COMPLETED", "ACCEPTED", "VERIFIED"].includes(value)) return "APPROVED";
  return value || "TODO";
}

const MEDIA_URL_KEYS = [
  "url",
  "fileUrl",
  "file_url",
  "imageUrl",
  "image_url",
  "resourceUrl",
  "resource_url",
  "secureUrl",
  "secure_url",
  "downloadUrl",
  "download_url",
  "coverImageUrl",
  "cover_image_url",
  "coverUrl",
  "cover_url",
  "thumbnailUrl",
  "thumbnail_url",
  "submittedImageUrl",
  "submitted_image_url",
  "submissionUrl",
  "submission_url",
  "referenceImageUrl",
  "reference_image_url",
  "pageImageUrl",
  "page_image_url",
  "path"
];

const MEDIA_NESTED_KEYS = ["data", "resource", "file", "image", "cover", "thumbnail", "page", "latestVersion"];

export function extractMediaUrl(payload) {
  if (!payload) return "";
  if (typeof payload === "string") return payload.trim();
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const nested = extractMediaUrl(item);
      if (nested) return nested;
    }
    return "";
  }
  if (typeof payload !== "object") return "";

  for (const key of MEDIA_URL_KEYS) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  for (const key of MEDIA_NESTED_KEYS) {
    const nested = extractMediaUrl(payload[key]);
    if (nested) return nested;
  }

  return "";
}

export function mediaUrlFrom(...values) {
  for (const value of values) {
    const extracted = extractMediaUrl(value);
    const resolved = resolveMediaUrl(extracted);
    if (resolved) return resolved;
  }
  return "";
}

export function resolveMediaUrl(rawUrl) {
  let raw = String(rawUrl || "").trim();
  if (!raw) return "";

  // Some backend/debug outputs include wrapped quotes or escaped slashes.
  raw = raw.replace(/^["']|["']$/g, "").replace(/\\\//g, "/").trim();

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

const TECHNICAL_MESSAGE_PATTERN = /\b(?:api|backend|endpoint|supabase|database|postgres(?:ql)?|sql|jdbc|hibernate|spring|tomcat|hikari|cloudinary|websocket|sockjs|stomp|jwt|bearer|token|repository|controller|stack trace|exception|request body|payload|foreign key|constraint|relation|column|http\s*\d{3}|status code)\b/i;

function friendlyRequestMessage(payload, status) {
  const raw = typeof payload === "string"
    ? payload.trim()
    : String(payload?.message || payload?.error || payload?.detail || "").trim();

  if (status === 401) return "Your session has ended. Please log in again.";
  if (status === 403) return "You do not have permission to perform this action.";
  if (status === 404) return "The requested item could not be found.";
  if (status === 409) return "This action conflicts with existing information.";
  if (status >= 500) return "Something went wrong. Please try again.";
  if (!raw || TECHNICAL_MESSAGE_PATTERN.test(raw)) return "The action could not be completed. Please review the information and try again.";
  return raw;
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

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...normalized,
      headers
    });
  } catch {
    throw new Error("Unable to complete the request. Check your connection and try again.");
  }

  const payload = await parseResponse(response);

  if (!response.ok) {
    const message = friendlyRequestMessage(payload, response.status);
    if (response.status === 401) {
      clearSession();
      window.dispatchEvent(new CustomEvent("swp-auth-invalidated", {
        detail: { message }
      }));
    }
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
    },
    session: () => apiFetch("/auth/session"),
    logout: () => apiFetch("/auth/logout", { method: "POST" })
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
    assigned: async () => unwrapList(await apiFetch("/manga-series/assigned-to-me")),
    list: async (params = {}) => unwrapList(await apiFetch(`/manga-series${objectToQuery({ page: 0, size: 50, ...params })}`)),
    get: (id) => apiFetch(`/manga-series/${id}`),
    create: (payload) => apiFetch("/manga-series", { method: "POST", body: payload }),
    update: (id, payload) => apiFetch(`/manga-series/${id}`, { method: "PUT", body: payload }),
    remove: (id) => apiFetch(`/manga-series/${id}`, { method: "DELETE" }),
    status: (id, newStatus) => apiFetch(`/manga-series/${id}/status${objectToQuery({ newStatus })}`, { method: "PATCH" }),
    assignTantou: (id, tantouId) => apiFetch(`/manga-series/${id}/tantou${objectToQuery({ tantouId })}`, { method: "PATCH" }),
    submitToBoard: (id) => apiFetch(`/manga-series/${id}/submit-to-board`, { method: "PATCH" }),
    adminDecision: (id, isApproved, tantouId) => apiFetch(`/manga-series/${id}/admin-decision${objectToQuery({ isApproved, tantouId })}`, { method: "PATCH" })
  },

  chapters: {
    bySeries: (seriesId) => apiFetch(`/chapters/series/${seriesId}`),
    tantouReview: () => apiFetch("/chapters/tantou-review"),
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

  pageVersions: {
    byPage: (pageId) => apiFetch(`/page-versions/pages/${pageId}`),
    hitboxes: (versionId) => apiFetch(`/page-versions/${versionId}/hitboxes`),
    restore: (versionId) => apiFetch(`/page-versions/${versionId}/restore`, { method: "PATCH" })
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
    start: (taskId) => apiFetch(`/tasks/${taskId}/start`, { method: "PATCH" }),
    review: (taskId, approved) => apiFetch(`/tasks/${taskId}/review${objectToQuery({ approved })}`, { method: "PATCH" }),
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
    comment: (feedbackId, content) => apiFetch(`/tantou-feedbacks/${feedbackId}/comments${objectToQuery({ content })}`, { method: "POST" }),
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
