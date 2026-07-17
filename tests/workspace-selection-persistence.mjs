import assert from "node:assert/strict";
import fs from "node:fs";
import { withWorkspaceSelection } from "../src/utils/workspaceRoute.js";

const read = (file) => fs.readFileSync(file, "utf8");
const client = read("src/api/client.js");
const main = read("src/main.jsx");
const context = read("src/context/WorkspaceSelectionContext.jsx");
const layout = read("src/components/Layout.jsx");
const manuscripts = read("src/pages/ManuscriptsPage.jsx");
const chapters = read("src/pages/ChaptersPagesPage.jsx");
const canvas = read("src/pages/CanvasWorkspacePage.jsx");
const schedule = read("src/pages/SchedulePage.jsx");
const series = read("src/pages/SeriesPage.jsx");

assert.equal(withWorkspaceSelection("/manuscripts", { seriesId: 22 }), "/manuscripts?seriesId=22");
assert.equal(withWorkspaceSelection("/chapters-pages", { seriesId: "22" }), "/chapters-pages?seriesId=22");
assert.equal(
  withWorkspaceSelection("/canvas-workspace", { seriesId: 22, chapterId: 33, pageId: 44 }),
  "/canvas-workspace?seriesId=22&chapterId=33&pageId=44"
);
assert.equal(withWorkspaceSelection("/schedule?view=month", { seriesId: 22 }), "/schedule?view=month&seriesId=22");
assert.equal(withWorkspaceSelection("/tasks?tab=kanban", { seriesId: 22 }), "/tasks?tab=kanban");

assert.match(main, /WorkspaceSelectionProvider/);
assert.match(context, /selectSeries[\s\S]*chapterId: ""[\s\S]*pageId: ""/);
assert.match(layout, /withWorkspaceSelection\(path, workspaceSelection\)/);
assert.match(client, /candidates = \[explicitSeriesId, remembered, currentSeriesId\]/);

for (const [name, source] of [
  ["Manuscripts", manuscripts],
  ["Chapters & Pages", chapters],
  ["Canvas Workspace", canvas],
  ["Schedule / Admin Deadlines", schedule]
]) {
  assert.match(source, /useWorkspaceSelection/,
    `${name} must use the shared tab-scoped workspace selection`);
  assert.match(source, /handleSeriesChange/,
    `${name} must persist a dropdown change synchronously`);
  assert.match(source, /selectSeries\(nextSeriesId\)/,
    `${name} must publish the selected series before navigation`);
}

assert.match(series, /selectSeries\(item\?\.id\)/,
  "Opening a series card must establish the shared active series");

console.log("Cross-page workspace series persistence: PASS");
