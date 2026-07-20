import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const component = read("src/components/BoardVotingChat.jsx");
const boardPage = read("src/pages/EditorialBoardReviewPage.jsx");
const adminPage = read("src/pages/AdminReviewPage.jsx");
const client = read("src/api/client.js");
const entity = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/entity/BoardChatMessage.java");
const repository = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/repository/BoardChatMessageRepository.java");
const controller = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/controller/BoardChatController.java");
const service = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/service/impl/BoardChatServiceImpl.java");

assert.match(entity, /@Entity/);
assert.match(entity, /Board_Chat_Message/,
  "Voting chat must be stored in its own database table");
assert.match(repository, /ORDER BY chat\.createdAt ASC, chat\.id ASC/,
  "Saved room messages must be returned in stable chronological order");
assert.match(client, /boardChat:[\s\S]*list:[\s\S]*send:/,
  "Frontend API must expose saved message list and send operations");
assert.match(component, /window\.setInterval\(\(\) => loadMessages\(true\), 5000\)/,
  "Shared chat must refresh while members are voting");
assert.match(component, /api\.boardChat\.send\(seriesId, content\)/,
  "Editorial Board messages must be persisted through the backend");
assert.match(boardPage, /<BoardVotingChat seriesId=\{item\.id\} \/>/,
  "Editorial Board series review must display the writable shared chat");
assert.match(adminPage, /<BoardVotingChat seriesId=\{item\.id\} readOnly \/>/,
  "Admin Final Approval must display the same chat as read-only");
assert.match(controller, /@GetMapping\("\/series\/\{seriesId\}\/messages"\)[\s\S]*ROLE_ADMIN/,
  "Admin must be authorized only on the chat read endpoint");
const postEndpoint = controller.slice(controller.indexOf('@PostMapping("/series/{seriesId}/messages")'));
assert.doesNotMatch(postEndpoint.split("public ResponseEntity")[0], /ROLE_ADMIN/,
  "Admin must not be authorized to post chat messages");
assert.match(service, /Only Editorial Board members can send voting chat messages/,
  "Backend must enforce Editorial Board-only posting");
assert.match(service, /!"REVIEWING"\.equalsIgnoreCase\(series\.getStatus\(\)\)/,
  "The room must close when the Admin final decision changes the series status");
assert.match(service, /available only before the Admin final decision/,
  "Admin access must be explicitly limited to the pre-decision period");

console.log("Editorial Board voting chat contract: PASS");
