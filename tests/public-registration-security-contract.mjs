import assert from "node:assert/strict";
import fs from "node:fs";

const login = fs.readFileSync("src/pages/LoginPage.jsx", "utf8");
const authService = fs.readFileSync("../SWP_BACKEND/src/main/java/com/mangastudio/backend/service/impl/AuthServiceImpl.java", "utf8");

const rolesDeclaration = login.match(/const PUBLIC_REGISTRATION_ROLES = \[([^\]]+)\]/)?.[1] || "";
assert.match(rolesDeclaration, /Mangaka/);
assert.match(rolesDeclaration, /Assistant/);
assert.match(rolesDeclaration, /Tantou Editor/);
assert.match(rolesDeclaration, /Editorial Board/);
assert.doesNotMatch(rolesDeclaration, /Admin/);
assert.match(login, /PUBLIC_REGISTRATION_ROLES\.map/);
assert.match(login, /Admin accounts cannot be created through public registration/);

assert.match(authService, /PUBLIC_REGISTRATION_ROLES/);
assert.match(authService, /"admin"\.equals\(normalizedRole\)/);
assert.match(authService, /throw new AccessDeniedException\("Admin accounts cannot be created through public registration\."\)/);
assert.match(authService, /findByRoleName\(publicRoleName\)/);

console.log(JSON.stringify({
  publicRegistrationRoles: ["Mangaka", "Assistant", "Tantou Editor", "Editorial Board"],
  adminSelectable: false,
  backendAdminRegistrationBlocked: true
}, null, 2));
