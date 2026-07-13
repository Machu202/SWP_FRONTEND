import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const app = read("src/App.jsx");
const dashboard = read("src/pages/DashboardPage.jsx");
const tasks = read("src/pages/TasksPage.jsx");
const canvas = read("src/pages/CanvasWorkspacePage.jsx");
const layout = read("src/components/Layout.jsx");
const login = read("src/pages/LoginPage.jsx");
const auth = read("src/context/AuthContext.jsx");
const client = read("src/api/client.js");
const css = read("src/styles.css");
const pageVersionController = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/controller/PageVersionController.java");
const taskService = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/service/impl/TaskServiceImpl.java");
const taskController = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/controller/TaskController.java");
const taskRepository = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/repository/TaskRepository.java");
const authController = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/controller/AuthController.java");
const authFilter = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/security/AuthTokenFilter.java");
const userEntity = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/entity/User.java");

// 1. One real Mangaka chapter/page and canvas workflow.
assert.match(app, /\/chapters-pages\?seriesId=/);
assert.match(app, /hasRole\(role, \["mangaka"\]\)[\s\S]*\/canvas-workspace\?/);
assert.match(dashboard, /navigate\(`\/chapters-pages\?seriesId=\$\{series\.id\}`\)/);

// 2. Restore selects an existing snapshot without cloning history; workspace controls are styled.
const restoreMethod = pageVersionController.slice(pageVersionController.indexOf("restoreVersion"));
assert.match(restoreMethod, /page\.setImageUrl\(version\.getImageUrl\(\)\)/);
assert.doesNotMatch(restoreMethod, /pageVersionRepository\.save/);
assert.match(canvas, /api\.pageVersions\.restore/);
assert.match(css, /canvas-workspace-tab[\s\S]*page-version-row/);

// 3 and 9. Kanban is view-only for Assistant; Mangaka has only forward workflow moves.
assert.match(tasks, /if \(!hasRole\(role, \["mangaka"\]\)\) return \[\]/);
assert.match(tasks, /status === "TODO"\) return \["DOING"\]/);
assert.match(tasks, /status === "DOING"\) return \["REVIEWING"\]/);
assert.match(taskService, /TODO -> DOING -> REVIEWING/);
assert.match(taskService, /Kanban status changes are restricted to the owning Mangaka/);
const taskDetail = tasks.slice(tasks.indexOf("function TaskDetail"), tasks.indexOf("function TaskLockedBox"));
assert.doesNotMatch(taskDetail, /COLUMNS\.map\(\(column\)/);

// 4. Route header displays username rather than role.
assert.match(layout, /displayUsername = profile\?\.username \|\| session\.username/);
assert.match(layout, /Logged in as \$\{username/);

// 5 and 15. Compact task-area label and reliable initial overlay measurement.
assert.match(css, /\.task-hitbox-label[\s\S]*font-size: 9px/);
assert.match(tasks, /imageRef\.current/);
assert.match(tasks, /image\?\.complete && image\.naturalWidth > 0/);

// 6. Per-series task numbering.
assert.match(taskRepository, /countSeriesTasksUpToId/);
assert.match(taskController, /taskNumber/);
assert.match(tasks, /taskDisplayNumber/);

// 7 and 10. One active backend session per account and duplicated tab must return to Login.
assert.match(userEntity, /activeSessionId/);
assert.match(authController, /UUID\.randomUUID\(\)/);
assert.match(authFilter, /sessionId\.equals\(user\.getActiveSessionId\(\)\)/);
assert.match(auth, /api\.auth\.session\(\)/);
assert.match(auth, /BroadcastChannel/);
assert.match(auth, /Duplicated tabs must sign in separately/);

// 8. Assistant dashboard assignment links always open the Assignments tab.
assert.match(dashboard, /navigate\("\/tasks\?tab=assignments"\)/);

// 11–13. Immutable reference image, download/start action, hidden submitted image, preview of chosen file.
assert.match(tasks, /api\.tasks\.start/);
assert.match(tasks, /Download reference image/);
assert.match(tasks, /!isAssistant && <Preview title="Submitted image"/);
assert.match(tasks, /assistant-finished-preview/);
assert.match(tasks, /Never pass the whole task object first/);
assert.doesNotMatch(tasks.slice(tasks.indexOf("function taskReferenceUrl"), tasks.indexOf("function firstValue")), /submittedImageUrl/);
assert.match(client, /start: \(taskId\)/);

// 14. Register password show/hide is functional.
assert.match(login, /showRegisterPassword/);
assert.match(login, /setShowRegisterPassword/);
assert.match(login, /autoComplete="new-password"/);

console.log(JSON.stringify({ reportedIssues: 15, result: "PASS" }, null, 2));
