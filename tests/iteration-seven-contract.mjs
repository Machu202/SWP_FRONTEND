import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const messenger = read("src/components/DirectMessenger.jsx");
const canvas = read("src/pages/CanvasWorkspacePage.jsx");
const dashboard = read("src/pages/DashboardPage.jsx");
const adminHistory = read("src/pages/AdminEditorialBoardVoteHistoryPage.jsx");
const app = read("src/App.jsx");
const layout = read("src/components/Layout.jsx");
const client = read("src/api/client.js");
const directChatService = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/service/impl/DirectChatServiceImpl.java");
const directChatRepo = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/repository/DirectChatMessageRepository.java");
const voteController = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/controller/BoardVoteController.java");
const voteService = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/service/impl/BoardVoteServiceImpl.java");
const seriesService = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/service/impl/MangaSeriesServiceImpl.java");

// Relationship-scoped chat contacts, series context, and unread counters.
assert.match(directChatService, /taskRepository\.findByMangakaId/);
assert.match(directChatService, /mangaSeriesRepository\.findByMangakaId/);
assert.match(directChatService, /taskRepository\.findByAssistantId/);
assert.match(directChatService, /mangaSeriesRepository\.findAssignedToTantou/);
assert.match(directChatService, /existsByMangaka_IdAndAssistant_Id/);
assert.match(directChatService, /existsByMangaka_IdAndTantou_Id/);
assert.match(directChatRepo, /markConversationRead/);
assert.match(messenger, /contactSeriesLabel/);
assert.match(messenger, /direct-messenger-unread-count/);
assert.match(messenger, /window\.setInterval\(\(\) => loadContacts\(true\), 5000\)/);

// Mangaka sends a chapter from Canvas to the assigned Tantou.
assert.match(canvas, /Send Chapter To Tantou Editor/);
assert.match(canvas, /canvas-send-chapter-to-tantou/);
assert.match(canvas, /api\.chapters\.status\(selectedChapter\.id, "REVIEWING"\)/);

// Admin sees the audit history of every Editorial Board member.
assert.match(app, /\/admin\/board-vote-history/);
assert.match(layout, /Editorial Board Vote History/);
assert.match(client, /adminHistory/);
assert.match(adminHistory, /Every recorded approval and rejection is grouped by Editorial Board user/);
assert.match(voteController, /@GetMapping\("\/admin\/history"\)/);
assert.match(voteController, /ROLE_ADMIN/);
assert.match(voteService, /getAdminVoteHistory/);

// Rejected-series deletion is explicit, confirmed, and cascades through series-owned data.
assert.match(dashboard, /delete-rejected-series-/);
assert.match(dashboard, /confirm-delete-rejected-series-/);
assert.match(dashboard, /api\.series\.remove/);
assert.match(seriesService, /List\.of\("DRAFT", "REJECTED"\)/);
for (const repository of [
  "boardChatMessageRepository",
  "boardVoteHistoryRepository",
  "boardVoteRepository",
  "deadlineEventRepository",
  "publishingScheduleRepository",
  "telemetryAnalyticsRepository"
]) {
  assert.match(seriesService, new RegExp(`${repository}\\.deleteByMangaSeriesId\\(seriesId\\)`));
}
assert.match(seriesService, /chapterRepository\.deleteAll/);
assert.match(seriesService, /mangaSeriesRepository\.delete\(series\)/);

console.log("SWP17 relationship chat, unread, handoff, vote audit and cascade delete contract: PASS");
