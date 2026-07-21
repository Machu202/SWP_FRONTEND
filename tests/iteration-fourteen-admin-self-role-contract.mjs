import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backendRoot = path.resolve(root, "../SWP_BACKEND");

function read(relativePath, base = root) {
  return fs.readFileSync(path.join(base, relativePath), "utf8");
}

function requireText(source, expected, label) {
  if (!source.includes(expected)) throw new Error(`${label} is missing: ${expected}`);
}

const usersPage = read("src/pages/AdminUsersPage.jsx");
requireText(usersPage, "const { profile, session } = useAuth();", "Authenticated Admin identity");
requireText(usersPage, "disabled={isCurrentAdmin}", "Self-role selector lock");
requireText(usersPage, "You cannot change your own Admin role.", "Self-role lock explanation");

const userController = read(
  "src/main/java/com/mangastudio/backend/controller/UserController.java",
  backendRoot
);
requireText(userController, "@AuthenticationPrincipal UserDetailsImpl currentAdmin", "Authenticated Admin backend identity");
requireText(userController, "currentAdmin.getId()", "Authenticated Admin ID propagation");

const userService = read(
  "src/main/java/com/mangastudio/backend/service/impl/UserServiceImpl.java",
  backendRoot
);
requireText(userService, "userId.equals(currentAdminId)", "Backend self-role guard");
requireText(userService, "Admin cannot change their own role.", "Backend self-role error");

console.log("SWP24 Admin self-role protection contract: PASS");
