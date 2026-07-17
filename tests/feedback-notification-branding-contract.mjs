import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const index = read("index.html");
const login = read("src/pages/LoginPage.jsx");
const layout = read("src/components/Layout.jsx");
const app = read("src/App.jsx");
const canvas = read("src/pages/CanvasWorkspacePage.jsx");
const mangakaReview = read("src/pages/MangakaAssistantReviewPage.jsx");
const feedbackService = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/service/impl/TantouFeedbackServiceImpl.java");

assert.match(index, /<title>Manga System<\/title>/, "Every route must use the Manga System browser-tab title");
assert.doesNotMatch(index, /MangaSystem React/, "The old browser-tab title must be removed");
assert.match(login, /<span>Manga Creation Workflow<\/span>/);
assert.match(login, /<span className="login-title-ampersand">&amp;<\/span>/);
assert.match(login, /<span>Publishing Management System<\/span>/,
  "Login must show the centered three-line system name");

assert.match(feedbackService, /private final NotificationService notificationService;/);
assert.ok(
  feedbackService.includes('"Tantou \\"" + displayName(editor) + "\\" has sent you a feedback. Go check it out!"'),
  "Saving Tantou feedback must notify the owning Mangaka with the Tantou full name"
);
assert.ok(
  feedbackService.includes('"\\"" + seriesTitle.trim() + "\\" Mangaka has reviewed your feedback!"'),
  "Resolving feedback must notify its Tantou author with the series title"
);
assert.match(feedbackService, /if \(Boolean\.TRUE\.equals\(feedback\.getIsResolved\(\)\)\) return feedback;/,
  "Repeated resolve requests must not create duplicate notifications");
assert.match(
  feedbackService,
  /\/canvas-workspace\?seriesId=[\s\S]*&chapterId=[\s\S]*&pageId=[\s\S]*&feedbackId=/,
  "The Tantou notification must target the exact series, chapter, page, and feedback"
);

assert.match(layout, /function formatNotificationTime\(value\)/);
assert.match(layout, /<small className="notification-time" data-testid="notification-time"/,
  "Notifications must render a small received-time label");
assert.match(layout, /if \(target\) navigate\(target\)/, "Actionable notifications must navigate to their target");

assert.match(app, /initialFeedbackId=\{route\.params\.get\("feedbackId"\) \|\| ""\}/,
  "The router must pass the feedback deep-link parameter to review pages");
assert.match(canvas, /initialFeedbackId = ""/);
assert.match(canvas, /loadedHitboxes\.find\(\(item\) => String\(item\.id\) === String\(initialFeedbackId\)\)/,
  "Tantou Review Canvas must select the requested feedback");
assert.match(mangakaReview, /tantou-feedback-\$\{initialFeedbackId\}/,
  "Mangaka Review must reveal the requested feedback");

console.log("Feedback notifications and branding contract: PASS");
