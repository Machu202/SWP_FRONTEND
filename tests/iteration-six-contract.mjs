import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const login = read("src/pages/LoginPage.jsx");
const client = read("src/api/client.js");
const css = read("src/styles.css");
const app = read("src/App.jsx");
const layout = read("src/components/Layout.jsx");
const seriesPage = read("src/pages/SeriesPage.jsx");
const boardHistoryPage = read("src/pages/EditorialBoardVoteHistoryPage.jsx");
const adminReview = read("src/pages/AdminReviewPage.jsx");
const boardReview = read("src/pages/EditorialBoardReviewPage.jsx");
const voteController = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/controller/BoardVoteController.java");
const voteService = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/service/impl/BoardVoteServiceImpl.java");
const voteHistoryEntity = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/entity/BoardVoteHistory.java");
const seriesRepository = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/repository/MangaSeriesRepository.java");
const seriesService = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/service/impl/MangaSeriesServiceImpl.java");

assert.match(login, /<span>Manga Creation Workflow<\/span>[\s\S]*login-title-ampersand[\s\S]*<span>Publishing Management System<\/span>/);
assert.match(css, /\.login-system-title[\s\S]*display: grid[\s\S]*justify-items: center[\s\S]*text-align: center/);

assert.match(client, /const isPasswordLogin = path === "\/auth\/login"/);
assert.match(client, /Username or password is incorrect, please try again!/);
assert.match(client, /response\.status === 401 && !isPasswordLogin/,
  "A bad password must not trigger session invalidation");

assert.match(voteHistoryEntity, /Board_Vote_History/);
assert.match(voteService, /boardVoteHistoryRepository\.save\(new BoardVoteHistory/,
  "Every vote action must create a durable audit entry");
assert.match(voteController, /@GetMapping\("\/my-history"\)/);
assert.match(client, /history: async \(\) => unwrapList\(await apiFetch\("\/votes\/my-history"\)\)/);
assert.match(app, /route\.pathname === "\/board-vote-history"/);
assert.match(layout, /My Vote History/);
assert.match(boardHistoryPage, /data-testid="board-vote-history-list"/);

assert.match(seriesRepository, /existsByTantou_IdAndIdNot/);
assert.match(seriesService, /ensureTantouAvailableForSeries\(tantou, seriesId\)/);
assert.match(seriesService, /ensureTantouAvailableForSeries\(tantouEditor, seriesId\)/);
assert.match(seriesService, /Each Tantou Editor can only be assigned to one manga series/);
assert.match(adminReview, /already assigned/,
  "Admin must see occupied Tantou Editors as unavailable");

assert.match(seriesPage, />Edit Manga Profile<\/button>/);
assert.match(seriesPage, /api\.series\.update\(editingSeries\.id/);
assert.match(seriesPage, /api\.resources\.upload\(editCoverFile, "SERIES_COVER"\)/);
for (const field of ["title", "genre", "summary", "description", "cover"]) {
  assert.match(seriesPage, new RegExp(`edit-series-${field}`), `Edit Manga Profile must expose ${field}`);
}

assert.match(adminReview, /data-testid=\{`admin-open-series-\$\{item\.id\}`\}[\s\S]*"Open Series"/);
assert.match(adminReview, /api\.chapters\.bySeries\(seriesId\)/);
assert.match(adminReview, /api\.pages\.byChapter\(chapter\.id\)/);
assert.match(adminReview, /<SeriesReviewDetails/);
assert.match(boardReview, /<strong>Summary:<\/strong>/);

console.log("Iteration six requested fixes contract: PASS");
