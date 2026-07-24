import assert from "node:assert/strict";
import fs from "node:fs";

const loginPage = fs.readFileSync("src/pages/LoginPage.jsx", "utf8");
const apiClient = fs.readFileSync("src/api/client.js", "utf8");
const authContext = fs.readFileSync("src/context/AuthContext.jsx", "utf8");
const authService = fs.readFileSync("../backend/src/main/java/com/mangastudio/backend/service/impl/AuthServiceImpl.java", "utf8");
const googleResponse = fs.readFileSync("../backend/src/main/java/com/mangastudio/backend/dto/response/GoogleLoginResponse.java", "utf8");

assert.match(authService, /userOptional\.isEmpty\(\)/);
assert.match(authService, /GoogleLoginResponse\.registrationRequired\(email\)/);
assert.doesNotMatch(authService, /Automatically register a new account when none exists/);
assert.doesNotMatch(authService, /findByRoleName\("Mangaka"\)[\s\S]{0,500}GoogleLoginResponse\.registrationRequired/, "Unknown Google users must not be assigned Mangaka automatically");
assert.match(googleResponse, /registrationRequired/);
assert.match(apiClient, /if \(data\?\.registrationRequired\) return data/);
assert.match(authContext, /if \(result\?\.registrationRequired\) return result/);
assert.match(loginPage, /setMode\("register"\)/);
assert.match(loginPage, /email:\s*googleEmail/);
assert.match(loginPage, /No account exists for this Google email/);

console.log(JSON.stringify({
  unknownGoogleAccountAutoCreated: false,
  redirectsToRegistration: true,
  googleEmailPrefilled: true
}, null, 2));
