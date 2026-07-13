import assert from "node:assert/strict";
import fs from "node:fs";

const client = fs.readFileSync("src/api/client.js", "utf8");
const login = fs.readFileSync("src/pages/LoginPage.jsx", "utf8");
const realE2e = fs.readFileSync("tests/real-data-e2e.mjs", "utf8");
const audit = fs.readFileSync("tests/role-display-audit.mjs", "utf8");

assert.match(client, /window\.sessionStorage/, "Authentication storage must be tab-scoped sessionStorage");
assert.match(client, /isTokenExpired/, "Expired JWTs must be rejected during startup");
assert.match(client, /clearLegacyPersistentSession/, "Legacy persistent auth data must be removed");
assert.doesNotMatch(client, /localStorage\.setItem\(\s*["'](?:accessToken|token|userId|username|email|role)/, "Auth data must never be written to localStorage");
assert.match(login, /Session stays only in this tab/, "Login UI must explain the tab-scoped session");
assert.match(realE2e, /sessionStorage\.clear\(\)/, "Real-data automation must reset the active tab session");
assert.match(audit, /sessionStorage\.clear\(\)/, "Display audit must reset the active tab session");

console.log("Session storage contract: PASS");
