import assert from "node:assert/strict";
import fs from "node:fs";

const loginPage = fs.readFileSync("src/pages/LoginPage.jsx", "utf8");
const apiClient = fs.readFileSync("src/api/client.js", "utf8");
const authContext = fs.readFileSync("src/context/AuthContext.jsx", "utf8");
const authController = fs.readFileSync("../SWP_BACKEND/src/main/java/com/mangastudio/backend/controller/AuthController.java", "utf8");
const authService = fs.readFileSync("../SWP_BACKEND/src/main/java/com/mangastudio/backend/service/impl/AuthServiceImpl.java", "utf8");
const requestDto = fs.readFileSync("../SWP_BACKEND/src/main/java/com/mangastudio/backend/dto/request/RequestOtpRequest.java", "utf8");
const userRepository = fs.readFileSync("../SWP_BACKEND/src/main/java/com/mangastudio/backend/repository/UserRepository.java", "utf8");

assert.doesNotMatch(loginPage, /otpPassword|showOtpPassword/, "OTP login must not keep password state or inputs");
assert.match(loginPage, /requestOtp\(otpEmail\.trim\(\)\)/, "OTP request must send only the account email");
assert.match(loginPage, /Enter your account email, then request an OTP\./);
assert.match(apiClient, /requestOtp:\s*\(email\).*body:\s*\{\s*email\s*\}/s, "OTP API body must contain only email");
assert.match(authContext, /requestOtp\(email\).*api\.auth\.requestOtp\(email\)/s);
assert.match(requestDto, /class RequestOtpRequest/);
assert.match(requestDto, /@Email/);
assert.doesNotMatch(requestDto, /password|username/i, "The OTP request DTO must not accept a password or username");
assert.match(authController, /requestOtp\(@Valid @RequestBody RequestOtpRequest request\)/);
assert.match(authService, /generateOtpForEmail\(RequestOtpRequest request\)/);
assert.doesNotMatch(
  authService.slice(authService.indexOf("generateOtpForEmail"), authService.indexOf("verifyOtpAndLogin")),
  /authenticationManager\.authenticate|UsernamePasswordAuthenticationToken/,
  "Requesting an OTP must not authenticate a password"
);
assert.match(authService, /SecureRandom/);
assert.match(userRepository, /findByEmailIgnoreCase/);

assert.match(loginPage, /accounts\.google\.com\/gsi\/client/);
assert.match(loginPage, /client_id:\s*GOOGLE_CLIENT_ID/);
assert.match(loginPage, /callback:\s*handleGoogleCredential/);
assert.match(loginPage, /googleLogin\(credential\)/);
assert.match(apiClient, /apiFetch\("\/auth\/google".*body:\s*\{\s*token\s*\}/s);
assert.match(authService, /GsonFactory\.getDefaultInstance\(\)/);
assert.match(authService, /setAudience\(Collections\.singletonList\(googleClientId\.trim\(\)\)\)/);
assert.match(authService, /getEmailVerified\(\)/);
assert.match(authService, /findByEmailIgnoreCase\(email\)/);

console.log(JSON.stringify({
  passwordlessOtp: true,
  googleCredentialFlow: true,
  otpPayloadFields: ["email"]
}, null, 2));
