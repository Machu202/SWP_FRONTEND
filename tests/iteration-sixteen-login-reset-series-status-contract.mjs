import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const loginPage = read("src/pages/LoginPage.jsx");
const dashboard = read("src/pages/DashboardPage.jsx");
const client = read("src/api/client.js");
const authController = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/controller/AuthController.java");
const authService = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/service/impl/AuthServiceImpl.java");
const resetEntity = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/entity/PasswordResetCode.java");
const resetRepository = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/repository/PasswordResetCodeRepository.java");
const securityConfig = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/config/SecurityConfig.java");
const authFilter = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/security/AuthTokenFilter.java");
const seriesService = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/service/impl/MangaSeriesServiceImpl.java");

assert.match(loginPage, /className="forgot-link" onClick=\{openForgotPassword\}/,
  "Forgot password must no longer be a dead button");
assert.match(loginPage, /mode === "forgot"[\s\S]*Send Reset Code[\s\S]*6-digit reset code[\s\S]*Confirm new password[\s\S]*Reset Password/,
  "Forgot password UI must collect email, one-time code, and confirmed new password");
assert.match(client, /requestPasswordReset:[\s\S]*\/auth\/forgot-password\/request/);
assert.match(client, /resetPassword:[\s\S]*\/auth\/forgot-password\/reset/);
assert.match(authController, /@PostMapping\("\/forgot-password\/request"\)/);
assert.match(authController, /@PostMapping\("\/forgot-password\/reset"\)/);
assert.match(securityConfig, /\/api\/v1\/auth\/forgot-password\/request[\s\S]*\/api\/v1\/auth\/forgot-password\/reset/);
assert.match(authFilter, /\/api\/v1\/auth\/forgot-password\/request[\s\S]*\/api\/v1\/auth\/forgot-password\/reset/);

assert.match(resetEntity, /Password_Reset_Code/,
  "Password reset codes must be separate from passwordless login OTP records");
assert.match(resetRepository, /PESSIMISTIC_WRITE/,
  "A reset code must not be consumed concurrently more than once");
assert.match(authService, /passwordEncoder|encoder\.encode\(request\.getNewPassword\(\)\)/);
assert.match(authService, /user\.setActiveSessionId\(null\)/,
  "Changing a password must revoke the previous login session");
assert.match(authService, /Invalid or expired password reset code/);

assert.match(loginPage, />Google Login<\/span>/,
  "The visible Google control name must be Google Login");
assert.match(loginPage, /locale: "en"/,
  "Google's official rendered button must not inherit a Vietnamese browser locale");
assert.doesNotMatch(loginPage, /Đăng Nhập Bằng Google/);

assert.match(dashboard, /const SERIES_STATUS_OPTIONS = \["ONGOING", "HIATUS", "CANCELLED", "COMPLETED"\]/);
assert.match(dashboard, /\{status === "ONGOING" \? \([\s\S]*Edit Status/,
  "Edit Status must only be shown on an ONGOING series card");
assert.match(dashboard, /api\.series\.status\(statusTarget\.id, nextSeriesStatus\)/);
assert.match(dashboard, /confirm-edit-series-status-/);
assert.match(seriesService, /case "ONGOING":[\s\S]*"COMPLETED"[\s\S]*"HIATUS"[\s\S]*"CANCELLED"/,
  "The backend must accept every status offered by the ONGOING Edit Status UI");
assert.match(seriesService, /hasRole\(currentUser, "MANGAKA"\)[\s\S]*series\.getMangaka\(\)\.getId\(\)\.equals\(currentUserId\)/,
  "Only the owning Mangaka can change the series status");

console.log("Iteration sixteen forgot-password, Google label, and series status contract passed.");
