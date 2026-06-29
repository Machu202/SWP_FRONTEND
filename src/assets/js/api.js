/*
 * MangaSystem frontend/backend compatibility layer.
 * Backend expected: Spring Boot at http://localhost:8080/api/v1
 */
(function () {
  const DEFAULT_API_BASE_URL = "http://localhost:8080/api/v1";

  // Cập nhật đường dẫn tương đối chuẩn theo cấu trúc thư mục VS Code của bạn
  const ROLE_ROUTES = {
    mangaka: "./src/pages/mangaka/dashboard.html",
    assistant: "./src/pages/assistant/assistant-dashboard.html",
    tantou: "./src/pages/shared/tantou-dashboard.html",
    editorial: "./src/pages/shared/board-dashboard.html",
    admin: "./src/pages/admin/admin-dashboard.html",
  };

  const API_ENDPOINTS = Object.freeze({
    authLogin: "/auth/login",
    authRegister: "/auth/register",
    verifyOtp: "/auth/verify-otp", // Endpoint xác thực OTP
    googleLogin: "/auth/google",   // Endpoint đăng nhập Google
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

  async function apiFetch(endpoint, options = {}) {
    const url = DEFAULT_API_BASE_URL + endpoint;
    const headers = { ...options.headers };
    
    const token = getAccessToken();
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

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
        if (response.status === 401 && endpoint !== API_ENDPOINTS.authLogin) {
            clearAuth();
            window.location.href = "../../../index.html";
            throw new Error("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
        }
        throw new Error((data && data.message) ? data.message : `Lỗi hệ thống: ${response.status}`);
    }

    return data;
  }

  // =================================================================
  // BỔ SUNG 4 HÀM BỊ THIẾU (Đã bọc apiFetch bên trong)
  // =================================================================

  async function loginWithPassword(username, password) {
      return await apiFetch(API_ENDPOINTS.authLogin, {
          method: "POST",
          body: { username, password }
      });
  }

  async function registerUser(userData) {
      return await apiFetch(API_ENDPOINTS.authRegister, {
          method: "POST",
          body: userData
      });
  }

  async function verifyOtp(email, otpCode) {
      return await apiFetch(API_ENDPOINTS.verifyOtp, {
          method: "POST",
          body: { email, otpCode }
      });
  }

  async function loginWithGoogle(credential) {
      return await apiFetch(API_ENDPOINTS.googleLogin, {
          method: "POST",
          body: { token: credential }
      });
  }

  function goToDashboard(roleName) {
    const route = ROLE_ROUTES[(roleName || "mangaka").toLowerCase()] || "./index.html";
    window.location.href = route;
  }

  function logout() {
      clearAuth();
      window.location.href = "../../../index.html";
  }

  // Xuất đầy đủ danh sách hàm ra toàn cục
  window.MangaApi = {
    API_ENDPOINTS,
    getAccessToken,
    setAccessToken,
    clearAuth,
    apiFetch,
    loginWithPassword, // <-- Đã thêm
    registerUser,      // <-- Đã thêm
    verifyOtp,         // <-- Đã thêm
    loginWithGoogle,   // <-- Đã thêm
    goToDashboard,
    logout
  };
})();