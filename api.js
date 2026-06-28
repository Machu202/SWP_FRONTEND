/*
 * MangaSystem frontend/backend compatibility layer.
 * Backend expected: Spring Boot at http://localhost:8080/api/v1
 * Frontend expected by backend CORS: Vite at http://localhost:5173
 */
(function () {
  const DEFAULT_API_BASE_URL = "http://localhost:8080/api/v1";

  const ROLE_ROUTES = {
    mangaka: "dashboard.html",
    assistant: "assistant-dashboard.html",
    tantou: "tantou-dashboard.html",
    editorial: "board-dashboard.html",
    admin: "admin-dashboard.html",
  };

  const API_ENDPOINTS = Object.freeze({
    authLogin: "/auth/login",
    authRegister: "/auth/register",
    mySeries: "/manga-series/my-series",
    mangaSeries: "/manga-series",
    chapters: "/chapters"
  });

  function getAccessToken() {
    return localStorage.getItem("accessToken");
  }

  function setAccessToken(token, role) {
      if (token) localStorage.setItem("accessToken", token);
      if (role) localStorage.setItem("userRole", role.toLowerCase());
  }

  function clearAuth() {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("userRole");
  }

  // HÀM GỌI API CHUẨN: Tự động nhét Token vào mọi request
  async function apiFetch(endpoint, options = {}) {
    const url = DEFAULT_API_BASE_URL + endpoint;
    const headers = { ...options.headers };
    
    const token = getAccessToken();
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    // Tự động phân loại dữ liệu: FormData (File) hoặc JSON (Text)
    if (options.body && !(options.body instanceof FormData)) {
        headers["Content-Type"] = headers["Content-Type"] || "application/json";
        if (typeof options.body === "object") {
            options.body = JSON.stringify(options.body);
        }
    }

    const response = await fetch(url, { ...options, headers });
    
    let data;
    try {
        data = await response.json();
    } catch (e) {
        data = null;
    }

    if (!response.ok) {
        // Nếu Token hết hạn hoặc sai (401)
        if (response.status === 401 && endpoint !== API_ENDPOINTS.authLogin) {
            clearAuth();
            window.location.href = "index.html";
            throw new Error("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
        }
        throw new Error((data && data.message) ? data.message : `Lỗi hệ thống: ${response.status}`);
    }

    return data;
  }

  function goToDashboard(roleName) {
    const route = ROLE_ROUTES[(roleName || "mangaka").toLowerCase()] || "index.html";
    window.location.href = route;
  }

  function logout() {
      clearAuth();
      window.location.href = "index.html";
  }

  window.MangaApi = {
    API_ENDPOINTS,
    getAccessToken,
    setAccessToken,
    clearAuth,
    apiFetch,
    goToDashboard,
    logout
  };
})();