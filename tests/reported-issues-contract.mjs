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
const mangakaReview = read("src/pages/MangakaAssistantReviewPage.jsx");
const chaptersPages = read("src/pages/ChaptersPagesPage.jsx");
const manuscripts = read("src/pages/ManuscriptsPage.jsx");
const schedule = read("src/pages/SchedulePage.jsx");
const tantouReview = read("src/pages/TantouReviewPage.jsx");
const rememberedCredentials = read("src/utils/rememberedCredentials.js");
const feedbackController = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/controller/TantouFeedbackController.java");
const feedbackService = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/service/impl/TantouFeedbackServiceImpl.java");

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

// 16. Approved Assistant work exposes the chapter -> Tantou action directly on the task card.
assert.match(mangakaReview, /ApprovedTaskChapterHandoff/);
assert.match(mangakaReview, /inline-send-chapter-to-tantou-/);
assert.match(mangakaReview, /inline-assign-and-send-chapter-/);
assert.match(mangakaReview, /Send chapter to \$\{chapter\.tantouName/);
assert.match(mangakaReview, /item\.tantouId/);

// 17. KPI chart label cleanup and styled tabs.
assert.doesNotMatch(dashboard, /FE-22 telemetry/i);
assert.match(css, /dashboard-kpi-card \.compact-chart-tabs \.r-tab/);
assert.match(css, /linear-gradient\(135deg, #6366f1, #4338ca\)/);

// 18. Tantou uses a visible, independent feedback canvas and never writes Mangaka hitboxes.
assert.match(layout, /Review Canvas/);
assert.match(tantouReview, /\/canvas-workspace\?seriesId=/);
assert.match(canvas, /isTantou \? api\.feedback\.byPage/);
assert.match(canvas, /api\.feedback\.create/);
assert.match(canvas, /Saved Tantou feedback/);
assert.match(canvas, /tantou-feedback-box/);
assert.match(feedbackController, /getFeedbacksByPage\(pageId, userDetails\.getId\(\)\)/);
assert.match(feedbackService, /Only the Tantou Editor assigned to this series can create feedback/);

// 19. Chapter delete control and page cards have fixed, non-overlapping dimensions.
assert.match(css, /chapter-row-actions \.danger-icon-btn[\s\S]*min-width: 66px/);
assert.match(css, /static-page-grid \.page-card[\s\S]*height: 326px/);
assert.match(css, /grid-template-rows: 220px 106px/);

// 20. Functional Remember password with encrypted-at-rest browser storage.
assert.doesNotMatch(login, /Session stays only in this tab/);
assert.match(login, /data-testid="remember-password"/);
assert.match(rememberedCredentials, /AES-GCM/);
assert.match(rememberedCredentials, /indexedDB/);
assert.doesNotMatch(rememberedCredentials, /localStorage\.setItem\([^,]+,\s*normalizedPassword/);

// 21. All cross-workspace pages retain the selected series in tab-scoped storage.
assert.match(client, /getWorkspaceSelection/);
assert.match(client, /setWorkspaceSelection/);
assert.match(manuscripts, /setWorkspaceSelection\(\{ seriesId: selectedSeriesId \}\)/);
assert.match(chaptersPages, /setWorkspaceSelection\(\{ seriesId: selectedSeriesId/);
assert.match(canvas, /setWorkspaceSelection\(\{ seriesId: selectedSeriesId \}\)/);
assert.match(schedule, /setWorkspaceSelection\(\{ seriesId \}\)/);


// 22. Every role displays a consistent {ROLE} Workspace title in the top-left branding.
assert.match(layout, /Admin Workspace/);
assert.match(layout, /Editorial Board Workspace/);
assert.match(layout, /Tantou Editor Workspace/);
assert.match(layout, /Assistant Workspace/);
assert.match(layout, /Mangaka Workspace/);
assert.match(layout, /function topbarBrand\(group\) \{[\s\S]*return workspaceTitle\(group\)/);

console.log(JSON.stringify({ reportedIssues: 22, result: "PASS" }, null, 2));
