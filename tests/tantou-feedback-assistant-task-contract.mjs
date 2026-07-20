import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const canvas = read("src/pages/CanvasWorkspacePage.jsx");
const review = read("src/pages/MangakaAssistantReviewPage.jsx");
const client = read("src/api/client.js");
const controller = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/controller/TantouFeedbackController.java");
const service = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/service/impl/TantouFeedbackServiceImpl.java");

assert.match(review, /Create Assistant task in Canvas/,
  "Mangaka Tantou review must expose the Canvas task action");
assert.match(review, /pageId=\$\{feedback\.pageId\}&feedbackId=\$\{feedback\.id\}/,
  "The action must deep-link to the exact page and feedback");
assert.match(canvas, /api\.feedback\.byPage\(pageId\)/,
  "Mangaka Canvas must load Tantou feedback areas");
assert.match(canvas, /source: "tantou-feedback"/,
  "Tantou feedback must remain distinguishable from ordinary Mangaka hitboxes");
assert.match(canvas, /BY TANTOU EDITOR\\n/,
  "The Assistant task description must carry the required attribution");
assert.match(canvas, /api\.feedback\.createAssistantTask\(selectedBox\.id, assistantId\)/,
  "Canvas must use the protected feedback-to-task endpoint");
assert.match(canvas, /readOnly=\{isTantouFeedbackBox\(selectedBox\)\}/,
  "The Tantou task description must not lose its attribution in the modal");
assert.match(client, /tantou-feedbacks\/\$\{feedbackId\}\/assistant-task/,
  "The frontend API must expose feedback task creation");
assert.match(controller, /@PostMapping\("\/\{feedbackId\}\/assistant-task"\)/,
  "The backend must expose an authenticated feedback task endpoint");
assert.match(service, /Only the owning Mangaka can create an Assistant task from this Tantou feedback/,
  "The backend must enforce series ownership");
assert.match(service, /Only original Tantou Editor feedback can be converted/,
  "Mangaka comment rows must not be converted as Tantou tasks");
assert.match(service, /workspaceService\.createHitbox\([\s\S]*feedback\.getXCoord\(\)[\s\S]*feedback\.getHeight\(\)/,
  "The task hitbox must clone the exact Tantou feedback rectangle");
assert.match(service, /taskService\.assignAssistantToTask\(createdTask\.getId\(\), mangakaId, assistantId\)/,
  "Creating from feedback must assign and notify the selected Assistant atomically");

console.log("Tantou feedback Assistant task contract: PASS");
