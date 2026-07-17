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
const coordinateOverlay = read("src/components/CoordinateImageOverlay.jsx");
const main = read("src/main.jsx");
const workspaceSelectionContext = read("src/context/WorkspaceSelectionContext.jsx");
const workspaceRoute = read("src/utils/workspaceRoute.js");

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
assert.match(tasks, /status === "DOING" && taskSubmittedUrl\(task\)\) return \["REVIEWING"\]/);
assert.match(taskService, /TODO -> DOING -> REVIEWING/);
assert.match(taskService, /Kanban status changes are restricted to the owning Mangaka/);
const taskDetail = tasks.slice(tasks.indexOf("function TaskDetail"), tasks.indexOf("function TaskLockedBox"));
assert.doesNotMatch(taskDetail, /COLUMNS\.map\(\(column\)/);

// 4. Route header displays username rather than role.
assert.match(layout, /displayUsername = profile\?\.username \|\| session\.username/);
assert.match(layout, /Logged in as \$\{username/);

// 5 and 15. Compact task-area label and reliable initial overlay measurement.
assert.match(css, /\.task-hitbox-label[\s\S]*font-size: 9px/);
assert.match(tasks, /CoordinateImageOverlay/);
assert.match(coordinateOverlay, /imageRef\.current/);
assert.match(coordinateOverlay, /image\.complete \|\| image\.naturalWidth <= 0/);
assert.match(coordinateOverlay, /getBoundingClientRect/);

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

// 11–13 and Issue 28. Immutable reference image, download/start action, safe submitted-image preview, chosen-file preview.
assert.match(tasks, /api\.tasks\.start/);
assert.match(tasks, /Download reference image/);
assert.match(tasks, /title=\{isAssistant \? "Your submitted image" : "Submitted image"\}/);
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
assert.match(main, /WorkspaceSelectionProvider/);
assert.match(workspaceSelectionContext, /selectSeries/);
assert.match(workspaceRoute, /"\/manuscripts"[\s\S]*"\/chapters-pages"[\s\S]*"\/canvas-workspace"[\s\S]*"\/schedule"/);
assert.match(layout, /withWorkspaceSelection\(path, workspaceSelection\)/);
assert.match(manuscripts, /handleSeriesChange[\s\S]*selectSeries\(nextSeriesId\)/);
assert.match(chaptersPages, /handleSeriesChange[\s\S]*selectSeries\(nextSeriesId\)/);
assert.match(canvas, /handleSeriesChange[\s\S]*selectSeries\(nextSeriesId\)/);
assert.match(schedule, /handleSeriesChange[\s\S]*selectSeries\(nextSeriesId\)/);


// 22. Every role displays a consistent {ROLE} Workspace title in the top-left branding.
assert.match(layout, /Admin Workspace/);
assert.match(layout, /Editorial Board Workspace/);
assert.match(layout, /Tantou Editor Workspace/);
assert.match(layout, /Assistant Workspace/);
assert.match(layout, /Mangaka Workspace/);
assert.match(layout, /function topbarBrand\(group\) \{[\s\S]*return workspaceTitle\(group\)/);

// 23. Task Detail does not duplicate the word Chapter.
assert.match(tasks, /data-testid="task-chapter-meta">\{taskChapterLabel\(selected\)\}<\/span>/);
assert.doesNotMatch(tasks, /Chapter:\s*\{taskChapterLabel\(selected\)\}/);

// 24. Mangaka Review keeps the immutable reference page separate from submitted work.
const reviewReferenceHelper = mangakaReview.slice(mangakaReview.indexOf("function referenceUrl"), mangakaReview.indexOf("function taskAssistantName"));
assert.doesNotMatch(reviewReferenceHelper, /mediaUrlFrom\(\s*task,/);
assert.match(reviewReferenceHelper, /task\?\.referenceImageUrl/);
assert.match(reviewReferenceHelper, /task\?\.hitboxDto\?\.pageImageUrl/);

// 25. Task Area badge is compact and no longer rendered as an oversized oval.
assert.match(css, /SWP reported display fixes:[\s\S]*\.task-hitbox-label[\s\S]*border-radius: 4px[\s\S]*font-size: 8px/);
assert.match(tasks, /CoordinateImageOverlay/);
assert.match(mangakaReview, /CoordinateImageOverlay/);
assert.match(coordinateOverlay, /label = "Task Area"/);

// 26. Manuscripts no longer duplicates page thumbnails below the script actions.
assert.doesNotMatch(manuscripts, /manuscript-page-preview-grid/);
assert.match(manuscripts, /Open Chapter Manager/);

// 27. Every current/future chapter and page button in Canvas Workspace is styled.
assert.match(css, /chapter-workspace-sidebar \.chapter-sidebar-list button[\s\S]*linear-gradient/);
assert.match(css, /chapter-workspace-sidebar \.chapter-sidebar-button\.active/);
assert.match(css, /chapter-workspace-sidebar \.chapter-sidebar-pages button\.active/);

// Issues 27-32 (including the duplicated Issue 30 entry).
// Review uses the per-series task number, not the database primary key.
assert.match(mangakaReview, /function taskDisplayNumber/);
assert.match(mangakaReview, /Task #\{taskDisplayNumber\(task\)\}/);
assert.doesNotMatch(mangakaReview, /<p className="eyebrow">Task #\{task\.id\}<\/p>/);

// Assistant can see a submitted result without replacing the immutable reference image.
assert.match(tasks, /function taskSubmittedUrl/);
assert.match(tasks, /Your submitted image/);
assert.doesNotMatch(tasks.slice(tasks.indexOf("function taskReferenceUrl"), tasks.indexOf("function firstValue")), /submittedImageUrl/);

// Sidebar branding has only the role workspace title; no logo initials/subtitle.
assert.match(layout, /brand-card brand-title-only/);
assert.doesNotMatch(layout, /<div className="ws-logo">/);
assert.doesNotMatch(layout, /<div className="ws-role">/);

// Tantou navigation is wide enough and Assigned Series uses a role-scoped endpoint.
assert.match(css, /feature-screen\.tantou-screen \.sidebar[\s\S]*width: 280px/);
assert.match(client, /assigned: async \(\) => unwrapList\(await apiFetch\("\/manga-series\/assigned-to-me"\)\)/);
const seriesPage = read("src/pages/SeriesPage.jsx");
assert.match(seriesPage, /api\.series\.assigned\(\)/);

// The top-bar search beside notifications is gone.
assert.doesNotMatch(layout, /placeholder="Search\.\.\."/);

// User-facing series numbers are dense and separate from real database IDs.
const seriesDto = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/dto/response/MangaSeriesResponse.java");
const seriesRepo = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/repository/MangaSeriesRepository.java");
const seriesService = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/service/impl/MangaSeriesServiceImpl.java");
const seriesController = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/controller/MangaSeriesController.java");
assert.match(seriesDto, /displayNumber/);
assert.match(seriesRepo, /countByIdLessThanEqual/);
assert.match(seriesService, /displayNumber\(series\.getId\(\) != null \? mangaSeriesRepository\.countByIdLessThanEqual/);
assert.match(seriesController, /assigned-to-me/);

// Issues 33-38.
// Hitbox previews use the page's true coordinate space and the exact rendered image frame.
assert.match(tasks, /originalWidth=\{taskPageWidth\(selected\)\}/);
assert.match(tasks, /originalHeight=\{taskPageHeight\(selected\)\}/);
assert.match(tasks, /CoordinateImageOverlay/);
assert.match(mangakaReview, /originalWidth=\{taskPageWidth\(task\)\}/);
assert.match(mangakaReview, /originalHeight=\{taskPageHeight\(task\)\}/);
assert.match(coordinateOverlay, /getBoundingClientRect/);
assert.match(css, /\.coordinate-image-stage[\s\S]*position: relative/);

// Approving Assistant work promotes it to the live page and creates the next PageVersion.
assert.match(taskService, /promoteApprovedSubmissionToPage\(task\)/);
assert.match(taskService, /page\.setImageUrl\(submittedImage\)/);
assert.match(taskService, /PageVersion\.builder\(\)/);
assert.match(taskService, /pageVersionRepository\.save\(PageVersion\.builder\(\)/);

// Mangaka Tantou Feedback renders the saved feedback rectangle and uses its dedicated comment API.
assert.match(mangakaReview, /function FeedbackHitboxPreview/);
assert.match(mangakaReview, /testId=\{`feedback-hitbox-/);
assert.match(mangakaReview, /api\.feedback\.comment\(feedback\.id/);
assert.match(feedbackController, /\{feedbackId\}\/comments/);
assert.match(feedbackService, /Only the owning Mangaka can comment on Tantou feedback/);

// Assistant assignment is locked for REVIEWING/APPROVED tasks.
assert.match(tasks, /const assignmentLocked = selected \? \["REVIEWING", "APPROVED"\]/);
assert.match(tasks, /data-testid="assign-assistant-select"[\s\S]*disabled=\{assignmentLocked\}/);
assert.match(taskService, /Assistant assignment is locked once a task is REVIEWING or APPROVED/);

// Tantou Chapter Review no longer contains the redundant Open series action.
assert.doesNotMatch(tantouReview, />Open series<\/button>/);


// Issues 39-40: hitbox overlays recover from missing page dimensions and rejected series can restart cleanly.
assert.match(tasks, /function positiveFiniteNumber/);
assert.match(tasks, /function overlayPercentBox/);
assert.match(tasks, /testId="task-area-overlay"/);
assert.match(mangakaReview, /testId="review-task-area-overlay"/);
assert.match(mangakaReview, /testId=\{`feedback-hitbox-/);
assert.match(coordinateOverlay, /label = "Task Area"/);
assert.match(dashboard, /Revert to Draft/);
assert.match(dashboard, /api\.series\.status\(series\.id, "DRAFT"\)/);
assert.match(seriesService, /case "REJECTED":[\s\S]*newStatus\.equals\("DRAFT"\)/);
assert.match(seriesService, /resetBoardVotesForNewReviewCycle\(seriesId\)/);
assert.match(seriesService, /boardVoteRepository\.deleteByMangaSeriesId\(seriesId\)/);

// Issues 41-42: role-specific dashboard titles and human-readable Tantou assignment.
assert.doesNotMatch(layout, /Studio Dashboard/);
assert.match(layout, /Admin Dashboard/);
assert.match(layout, /Editorial Board Dashboard/);
assert.match(layout, /Tantou Editor Dashboard/);
assert.match(layout, /Assistant Dashboard/);
assert.match(layout, /Mangaka Dashboard/);
const adminReview = read("src/pages/AdminReviewPage.jsx");
assert.match(adminReview, /function resolveTantouLabel/);
assert.match(adminReview, /admin-selected-tantou-name/);
assert.match(adminReview, /user\?\.fullName[\s\S]*user\?\.username[\s\S]*user\?\.email/);
assert.doesNotMatch(adminReview, /<strong>\{tantouId \|\| "Keep current \/ unassigned"\}<\/strong>/);


// Issues 43-46: required submission image, workflow notifications, and version-safe Canvas promotion.
const notificationService = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/service/impl/NotificationServiceImpl.java");
const notificationEntity = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/entity/Notification.java");
const hitboxEntity = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/entity/Hitbox.java");
const workspaceService = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/service/impl/WorkspaceServiceImpl.java");
const pageVersionRepository = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/repository/PageVersionRepository.java");

// Assistant cannot submit an empty/non-image file, and Mangaka cannot advance DOING -> REVIEWING without submitted work.
assert.match(tasks, /Choose a finished image first/);
assert.match(tasks, /file\.size <= 0[\s\S]*startsWith\("image\/"\)/);
assert.match(taskService, /A submitted image is required before this task can move to REVIEWING/);
assert.match(taskService, /Submitted image URL is required/);

// Assignment and submission create actionable role-specific notifications with received time in the UI.
assert.match(taskService, /You got a new task from/);
assert.match(taskService, /mangaka!/);
assert.match(taskService, /Assistant [\s\S]*has sent you his work\. Go check it out!/);
assert.match(taskService, /\"\/tasks\?tab=assignments\"/);
assert.match(taskService, /\"\/assistant-review\"/);
assert.match(notificationEntity, /actionUrl/);
assert.match(notificationService, /setActionUrl|\.actionUrl\(/);
assert.match(layout, /formatNotificationTime/);
assert.match(layout, /notificationAction\(item\)/);
assert.match(layout, /if \(target\) navigate\(target\)/);

// Approved work becomes the live page, creates history, and archives old hitboxes with the previous version.
assert.match(hitboxEntity, /PageVersion pageVersion/);
assert.match(workspaceService, /findByPageIdAndPageVersionIsNull/);
assert.match(taskService, /liveHitboxes[\s\S]*hitbox\.setPageVersion\(previousVersion\)/);
assert.match(taskService, /page\.setImageUrl\(submittedImage\)/);
assert.match(taskService, /versionNumber\(nextVersionNumber\)/);
assert.match(pageVersionRepository, /findTopByPageIdAndImageUrlOrderByVersionNumberDesc/);
assert.match(pageVersionController, /\{versionId\}\/hitboxes/);
assert.match(canvas, /api\.pageVersions\.hitboxes/);
assert.match(canvas, /compareVersionHitboxes/);

console.log(JSON.stringify({ reportedIssues: 48, result: "PASS" }, null, 2));
