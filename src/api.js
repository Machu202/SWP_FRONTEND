const API_BASE_URL = "http://localhost:8080";
async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("accessToken");
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json().catch(() => ({}));
}
