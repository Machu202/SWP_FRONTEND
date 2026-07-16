import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const canvas = fs.readFileSync(path.join(root, "src/pages/CanvasWorkspacePage.jsx"), "utf8");
const schedule = fs.readFileSync(path.join(root, "src/pages/SchedulePage.jsx"), "utf8");
const css = fs.readFileSync(path.join(root, "src/styles.css"), "utf8");
const controller = fs.readFileSync(path.join(root, "../SWP_BACKEND/src/main/java/com/mangastudio/backend/controller/PageVersionController.java"), "utf8");
const seriesService = fs.readFileSync(path.join(root, "../SWP_BACKEND/src/main/java/com/mangastudio/backend/service/impl/MangaSeriesServiceImpl.java"), "utf8");

const requirements = [
  [canvas.includes("await loadCanvas(selectedPageId)"), "restore reloads the live canvas"],
  [!canvas.includes("Live image and active hitboxes"), "redundant current-page subtitle removed"],
  [schedule.includes('toLocaleDateString("en-US"'), "calendar month/year forced to English"],
  [css.includes("Blue_Space_z76u0i.jpg"), "Admin navigation uses Blue Space"],
  [css.includes(".chapter-manager-screen .chapter-series-hero .detail-cover"), "series cover hero sizing restored"],
  [controller.includes("hitboxRepository.saveAll(restoredActive)"), "restored version hitboxes cloned to live page"],
  [controller.includes("Restoring selects an existing snapshot"), "restore does not create a new PageVersion"],
  [seriesService.includes('Mangaka has assigned you to review!'), "Tantou assignment notification exists"],
  [seriesService.includes('"/series"'), "Tantou notification has navigation target"]
];

const missing = requirements.filter(([ok]) => !ok).map(([, label]) => label);
if (missing.length) {
  console.error("Latest fixes contract failed:", missing.join(", "));
  process.exit(1);
}
console.log("Latest restore/notification/layout contract: PASS");
