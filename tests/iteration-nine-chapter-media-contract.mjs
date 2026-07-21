import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const chaptersPage = read("src/pages/ChaptersPagesPage.jsx");
const canvas = read("src/pages/CanvasWorkspacePage.jsx");
const reader = read("src/components/ChapterReaderModal.jsx");
const client = read("src/api/client.js");
const css = read("src/styles.css");
const pageEntity = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/entity/Page.java");
const pageRepository = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/repository/PageRepository.java");
const pageService = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/service/impl/PageServiceImpl.java");
const chapterController = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/controller/ChapterController.java");
const chapterService = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/service/impl/ChapterServiceImpl.java");
const chapterScheduler = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/component/ChapterPublicationScheduler.java");

// Editable batch numbering is guarded before Cloudinary and by a database constraint.
assert.match(chaptersPage, /data-testid="start-page-number-input"[\s\S]*onChange=/);
assert.doesNotMatch(chaptersPage, /data-testid="start-page-number-input"[^>]*readOnly/);
assert.match(chaptersPage, /requestedPageNumbers[\s\S]*existingPageNumbers/);
assert.match(chaptersPage, /setError\("Page number is unique"\)/);
assert.match(pageRepository, /existsByChapterIdAndPageNumber/);
assert.match(pageService, /existsByChapterIdAndPageNumber[\s\S]*Page number is unique/);
assert.match(pageEntity, /uk_pages_chapter_page_number/);

// Only an approved chapter in an ongoing series exposes the two publication choices.
assert.match(chaptersPage, /normalizedStatus\(series\?\.status\) === "ONGOING"[\s\S]*chapterStatus === "APPROVED"/);
assert.match(chaptersPage, />Publish<\/button>/);
assert.match(chaptersPage, /<strong>Publish now<\/strong>/);
assert.match(chaptersPage, /<strong>Set a publish countdown timer<\/strong>/);
assert.match(client, /chapters\/[\s\S]*schedulePublication:[\s\S]*publication-schedule/);
assert.match(chapterController, /@PostMapping\("\/\{id\}\/publication-schedule"\)/);
assert.match(chapterService, /Chapters can only be published while the manga series is ONGOING/);
assert.match(chapterService, /case "APPROVED" -> Set\.of\("PUBLISHED", "SCHEDULED"\)/);
assert.match(chapterService, /frequency\("CHAPTER_LAUNCH"\)/);
assert.match(chapterScheduler, /@Scheduled\(fixedDelay = 1000\)/);
assert.match(chapterScheduler, /PUBLICATION_SCAN_SECONDS/,
  "The Admin runtime interval must gate chapter publication scans");
assert.match(chapterScheduler, /publishScheduledChapter/);

// Chapter handoff has explicit Assistant and Tantou destinations.
assert.match(canvas, />Assign Assistant<\/button>/);
assert.match(canvas, />Assign Tantou Editor<\/button>/);
assert.match(canvas, /chapter-handoff-assistant-select/);
assert.match(canvas, /chapter-handoff-tantou-select/);
assert.match(canvas, /api\.tasks\.assign/);
assert.match(canvas, /api\.series\.assignTantou/);

// Every orientation and intrinsic size uses the complete stage in both shared modals.
assert.match(css, /\.comparison-image-stage img[\s\S]*width: 100% !important[\s\S]*height: 100% !important[\s\S]*object-fit: contain !important/);
assert.match(css, /\.chapter-reader-stage img[\s\S]*--reader-fit-width[\s\S]*--reader-fit-height[\s\S]*object-fit: contain !important/);
assert.match(reader, /Math\.min\(availableWidth \/ image\.naturalWidth, availableHeight \/ image\.naturalHeight\)/);
assert.match(reader, /key=\{page\?\.id \?\? pageIndex\}/,
  "Changing pages must mount the new image against the same fitted stage instead of retaining stale dimensions");

console.log("SWP19 page numbering, chapter publication, handoff and adaptive media contract: PASS");
