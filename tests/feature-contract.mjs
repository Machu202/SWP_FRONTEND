import assert from "node:assert/strict";
import fs from "node:fs";

const files = {
  app: fs.readFileSync("src/App.jsx", "utf8"),
  auth: fs.readFileSync("src/context/AuthContext.jsx", "utf8"),
  layout: fs.readFileSync("src/components/Layout.jsx", "utf8"),
  stream: fs.readFileSync("src/utils/notificationStream.js", "utf8"),
  series: fs.readFileSync("src/pages/SeriesPage.jsx", "utf8"),
  chapters: fs.readFileSync("src/pages/ChaptersPagesPage.jsx", "utf8"),
  manuscripts: fs.readFileSync("src/pages/ManuscriptsPage.jsx", "utf8"),
  canvas: fs.readFileSync("src/pages/CanvasWorkspacePage.jsx", "utf8"),
  workspace: fs.readFileSync("src/pages/WorkspacePage.jsx", "utf8"),
  tasks: fs.readFileSync("src/pages/TasksPage.jsx", "utf8"),
  schedule: fs.readFileSync("src/pages/SchedulePage.jsx", "utf8"),
  dashboard: fs.readFileSync("src/pages/DashboardPage.jsx", "utf8"),
  board: fs.readFileSync("src/pages/EditorialBoardReviewPage.jsx", "utf8"),
  adminReview: fs.readFileSync("src/pages/AdminReviewPage.jsx", "utf8"),
  adminUsers: fs.readFileSync("src/pages/AdminUsersPage.jsx", "utf8"),
  system: fs.readFileSync("src/pages/SystemPage.jsx", "utf8"),
  resources: fs.readFileSync("src/pages/ResourcesPage.jsx", "utf8"),
  profile: fs.readFileSync("src/pages/ProfilePage.jsx", "utf8"),
  mangakaReview: fs.readFileSync("src/pages/MangakaAssistantReviewPage.jsx", "utf8"),
  tantouReview: fs.readFileSync("src/pages/TantouReviewPage.jsx", "utf8"),
  apiClient: fs.readFileSync("src/api/client.js", "utf8"),
  scriptEditor: fs.readFileSync("src/components/ScriptEditor.jsx", "utf8")
};

const contracts = {
  "FE-02": [files.app, /isAllowed/, /Redirect/, files.auth, /401/],
  "FE-04": [files.adminUsers, /admin-user-filters/, /roleFilter/, /statusFilter/],
  "FE-06": [files.profile, /phoneNumber/, /updateProfile/, /profile-supabase-sync/, /save-profile/],
  "FE-08": [files.system, /api\.system\.update/, /api\.system\.remove/],
  "FE-10": [files.layout, /connectNotificationStream/, files.stream, /new Client/, /new SockJS/, /subscribe/],
  "FE-12": [files.series, /wizardStep/, /wizard-steps/, /Cover & Review/],
  "FE-14": [files.manuscripts, /manuscript-tree/, /tree-page-item/],
  "FE-16": [files.board, /Vote approve/, /Vote reject/, /api\.votes\.cast/],
  "FE-18": [files.adminReview, /AdminDecisionModal/, /Confirm final decision/],
  "FE-20": [files.schedule, /MonthCalendar/, /month-grid/],
  "FE-22": [files.dashboard, /KpiCharts/, /kpi-bar-fill/, /telemetry/],
  "FE-24": [files.schedule, /DeadlineMonitoringTable/, /warningLevel/, /deadline-warning/],
  "FE-26": [files.workspace, /createFeedback/, /resolveFeedback/, /feedback-resolution-row/],
  "FE-28": [files.scriptEditor, /FORMAT_ACTIONS/, /Markdown formatting/],
  "FE-29": [files.manuscripts, /manuscript-split-review/, /manuscript-image-pane/],
  "FE-32": [files.chapters, /uploadQueue/, /multiple/, /status: "failed"/],
  "FE-34": [files.canvas, /hitbox-layer-react/, /CanvasBox/],
  "FE-36": [files.canvas, /handlePointerDown/, /handlePointerMove/, /createHitbox/, /delete-selected-hitbox/, /deleteHitbox/],
  "FE-38": [files.canvas, /taskModalOpen/, /Create and assign/],
  "FE-40": [files.tasks, /draggable=/, /onDrop=/, /drag-over/],
  "FE-42": [files.canvas, /openHitboxContext/, /hitbox-context-menu/, /addContextComment/],
  "FE-44": [files.canvas, /VersionComparison/, /type="range"/, /restoreVersion/],
  "FE-46": [files.resources, /resource-grid/, /URL\.createObjectURL/, /anchor\.download/, /canManage/],
  "FE-48": [files.canvas, /ChapterWorkspaceSidebar/, /chapter-workspace-sidebar/],
  "FLOW-MANGAKA-TANTOU": [files.mangakaReview, /Chapter handoff/, /Send approved chapters to Tantou/, /assignTantou/, /send-chapter-to-tantou/, /inline-send-chapter-to-tantou/, /inline-assign-and-send-chapter/, /assistant-work-approved/],
  "FLOW-TANTOU-BOARD": [files.tantouReview, /Editorial Board handoff/, /Send series to Editorial Board/, /Send back to Mangaka/, /send-series-to-board-/, files.apiClient, /submitToBoard/]
};

for (const [id, checks] of Object.entries(contracts)) {
  let currentText = "";
  for (const check of checks) {
    if (typeof check === "string") currentText = check;
    else assert.match(currentText, check, `${id} is missing ${check}`);
  }
}

console.log(JSON.stringify({ taskContracts: Object.keys(contracts).length, ids: Object.keys(contracts) }, null, 2));
