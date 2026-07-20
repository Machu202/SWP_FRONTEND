import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const canvas = read("src/pages/CanvasWorkspacePage.jsx");
const layout = read("src/components/Layout.jsx");
const resources = read("src/pages/ResourcesPage.jsx");
const mangakaReview = read("src/pages/MangakaAssistantReviewPage.jsx");
const assignments = read("src/pages/TasksPage.jsx");
const boardReview = read("src/pages/EditorialBoardReviewPage.jsx");
const comparisonModal = read("src/components/ImageComparisonModal.jsx");
const chapterReader = read("src/components/ChapterReaderModal.jsx");
const css = read("src/styles.css");

assert.doesNotMatch(canvas, /current-version-row/,
  "Page Versions must not render the old Current row, green dot, or container");
assert.doesNotMatch(canvas, /<strong>Current<\/strong>/,
  "The removed Page Versions row must not leave a Current label behind");
assert.match(canvas, /selectedVersion[\s\S]*setViewedVersionId\(""\)/,
  "Clicking an already-selected historical version must return to the latest page image");

assert.equal((layout.match(/path: "\/resources", label: "Resources"/g) || []).length, 4,
  "Mangaka and Assistant sidebars and top bars must all call the page Resources");
assert.doesNotMatch(layout, /path: "\/resources", label: "(?:Assets|Resource Library)"/);
assert.match(resources, /<h1[^>]*>Resources<\/h1>/);
assert.match(resources, /const response = await fetch\(url\)/);
assert.match(resources, /const blob = await response\.blob\(\)/);
assert.match(resources, /window\.showSaveFilePicker/,
  "Supported browsers must open the operating-system Save As picker");
assert.match(resources, /URL\.createObjectURL\(blob\)/);
assert.match(resources, /anchor\.download = fileName/,
  "Resource downloads must use a local Blob URL and the browser download flow");
assert.match(css, /\.r-tab[\s\S]*border-radius: 999px/);
assert.match(css, /\.r-tab\.active[\s\S]*linear-gradient/);

assert.match(mangakaReview, /import ImageComparisonModal/);
assert.match(mangakaReview, />Compare 2 Images<\/button>/);
assert.match(mangakaReview, /referenceUrl=\{reference\}[\s\S]*submittedUrl=\{submitted\}/);
assert.match(assignments, /submittedImageUrl \? \([\s\S]*Your submitted image[\s\S]*Compare 2 Images/,
  "Assistant compare control must only render after a submitted image exists");
assert.match(assignments, /reference-download-btn compare-images-button assistant-compare-images-button/,
  "Assistant Compare 2 Images must share the Download Reference Image dimensions");
assert.match(comparisonModal, /image-comparison-grid/);
assert.match(comparisonModal, /label="Reference"/);
assert.match(comparisonModal, /label="Submitted work"/);
assert.match(comparisonModal, /aria-label="Close image comparison"/);
assert.match(css, /\.image-comparison-modal[\s\S]*height: calc\(100vh - 36px\)/);
assert.match(css, /\.comparison-image-stage img[\s\S]*max-width: 100% !important[\s\S]*max-height: 100% !important[\s\S]*object-fit: contain !important/,
  "Comparison images must fit fully inside the visible modal");

assert.match(boardReview, />Read Chapter<\/button>/);
assert.match(boardReview, /<ChapterReaderModal/,
  "The shared board/admin series details must use the chapter reader");
assert.match(chapterReader, /numericPageNumber/);
assert.match(chapterReader, /\.sort\(/,
  "Chapter pages must be ordered by page number");
assert.match(chapterReader, /aria-label="Previous page"/);
assert.match(chapterReader, /aria-label="Next page"/);
assert.match(chapterReader, /aria-label="Close chapter reader"/);
assert.match(css, /\.chapter-reader-modal[\s\S]*height: calc\(100vh - 24px\)/);
assert.match(css, /\.chapter-reader-stage img[\s\S]*max-width: 100% !important[\s\S]*max-height: 100% !important[\s\S]*object-fit: contain !important/,
  "Chapter pages must fit fully inside the visible reader");

assert.match(css, /feature-screen\.board-screen \.main-wrapper[\s\S]*background-color: #fffaf0/,
  "Editorial Board workspace background must use a light paper color");
assert.doesNotMatch(css, /feature-screen\.board-screen \.main-wrapper \{[\s\S]{0,120}background-color: #ffd58a/,
  "The previous dark yellow Editorial Board background must not return");

console.log("SWP15 UI media and chapter reader contract: PASS");
