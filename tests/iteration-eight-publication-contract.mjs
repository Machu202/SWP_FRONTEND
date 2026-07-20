import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const dashboard = read("src/pages/DashboardPage.jsx");
const client = read("src/api/client.js");
const seriesController = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/controller/MangaSeriesController.java");
const seriesService = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/service/impl/MangaSeriesServiceImpl.java");
const scheduler = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/component/SeriesPublicationScheduler.java");
const telemetryService = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/service/impl/TelemetryBufferServiceImpl.java");

// Frontend: only APPROVED series can activate Publish; JWT is attached centrally.
assert.match(dashboard, /const approved = status === "APPROVED"/);
assert.match(dashboard, /disabled=\{busy \|\| !approved\}/);
assert.match(dashboard, /Publish Chapter 1 now/);
assert.match(dashboard, /Schedule launch/);
assert.match(dashboard, /api\.series\.status\(publishTarget\.id, "ONGOING"\)/);
assert.match(dashboard, /api\.series\.schedulePublication\(publishTarget\.id, publishAt\)/);
assert.match(dashboard, /series-launch-countdown-/);
assert.match(client, /if \(token\) headers\.Authorization = `Bearer \$\{token\}`/);
assert.match(client, /publication-schedule/);

// Backend: role/ownership state machine plus empty-publication guard.
assert.match(seriesController, /@PatchMapping\("\/\{id\}\/status"\)/);
assert.match(seriesController, /@PreAuthorize\("hasRole\('MANGAKA'\)"\)/);
assert.match(seriesService, /case "APPROVED":[\s\S]*newStatus\.equals\("ONGOING"\)/);
assert.match(seriesService, /hasRole\(currentUser, "MANGAKA"\)/);
assert.match(seriesService, /series\.getMangaka\(\)\.getId\(\)\.equals\(currentUserId\)/);
assert.match(seriesService, /Cannot publish an empty manga series/);
assert.match(seriesService, /List\.of\("APPROVED", "SCHEDULED"\)/);
assert.match(seriesService, /launchChapter\.setPublishStatus\("PUBLISHED"\)/);
assert.match(seriesService, /series\.setStatus\("ONGOING"\)/);

// Scheduled launches are durable and activate telemetry at the launch boundary.
assert.match(seriesController, /@PostMapping\("\/\{id\}\/publication-schedule"\)/);
assert.match(seriesService, /launchChapter\.setPublishStatus\("SCHEDULED"\)/);
assert.match(seriesService, /frequency\("SERIES_LAUNCH"\)/);
assert.match(scheduler, /@Scheduled\(fixedDelay = 5000\)/);
assert.match(scheduler, /publishScheduledSeries/);
assert.match(seriesService, /telemetryBufferService\.initializeSeries\(series\.getId\(\)\)/);
assert.match(telemetryService, /readerVotes\(0\)/);
assert.match(telemetryService, /views\(0\)/);

console.log("SWP18 guarded publication, cascade chapter launch, scheduling and telemetry contract: PASS");
