import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const assetDir = path.resolve("dist/assets");
const jsFile = fs.readdirSync(assetDir).find((name) => name.endsWith(".js"));
const cssFile = fs.readdirSync(assetDir).find((name) => name.endsWith(".css"));
if (!jsFile || !cssFile) throw new Error("Build assets are missing. Run npm run build first.");
const bundleJs = fs.readFileSync(path.join(assetDir, jsFile), "utf8");
const bundleCss = fs.readFileSync(path.join(assetDir, cssFile), "utf8");
fs.mkdirSync(path.resolve("test-results"), { recursive: true });

const svg = (label, fill = "e2e8f0") => `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200"><rect width="100%" height="100%" fill="#${fill}"/><text x="400" y="600" text-anchor="middle" font-size="64" fill="#111827">${label}</text></svg>`).toString("base64")}`;
const imageCurrent = svg("CURRENT", "dbeafe");
const imageOld = svg("VERSION 1", "fef3c7");
const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const nextWeek = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
const smokeToken = `eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.${Buffer.from(JSON.stringify({ sub: "smoke-user", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.signature`;
const expiredSmokeToken = `eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.${Buffer.from(JSON.stringify({ sub: "expired-user", exp: Math.floor(Date.now() / 1000) - 60 })).toString("base64url")}.signature`;

const fixtures = {
  imageCurrent,
  imageOld,
  tomorrow,
  nextWeek,
  series: [
    { id: 1, title: "Ink Horizon", status: "REVIEWING", genre: "Action", summary: "A test manga series.", description: "Smoke-test production data.", mangakaName: "Mika", tantouId: null, tantouName: "Unassigned", coverImageUrl: imageCurrent },
    { id: 2, title: "Rejected Revision", status: "REJECTED", genre: "Drama", summary: "Needs another Board review cycle.", description: "Rejected smoke-test series.", mangakaName: "Mika", tantouId: 4, tantouName: "Taro Editor", coverImageUrl: imageOld }
  ],
  chapters: [{ id: 10, chapterNumber: 1, title: "Opening", publishStatus: "DRAFT", seriesId: 1, tantouId: null, tantouName: "Unassigned" }],
  pages: [{ id: 100, pageNumber: 1, imageUrl: imageCurrent, width: null, height: null, chapterId: 10 }],
  hitboxes: [{ id: 701, xCoord: 100, yCoord: 140, width: 220, height: 180, pageId: 100 }],
  versions: [{ id: 901, versionNumber: 1, imageUrl: imageOld, createdAt: tomorrow }],
  tasks: [{ id: 501, taskNumber: 1, status: "TODO", description: "Ink the background", assistantId: 2, assistantName: "Aya Assistant", seriesId: 1, seriesTitle: "Ink Horizon", chapterId: 10, chapterNumber: 1, chapterTitle: "Opening", pageId: 100, pageNumber: 1, hitboxId: 701, xCoord: 100, yCoord: 140, width: 220, height: 180, referenceImageUrl: imageCurrent, submittedImageUrl: imageOld, pageWidth: null, pageHeight: null }],
  reviewTasks: [{ id: 502, taskNumber: 1, status: "APPROVED", description: "Approved assistant page", assistantId: 2, assistantName: "Aya Assistant", seriesId: 1, seriesTitle: "Ink Horizon", chapterId: 10, chapterNumber: 1, chapterTitle: "Opening", pageId: 100, pageNumber: 1, hitboxId: 701, xCoord: 100, yCoord: 140, width: 220, height: 180, referenceImageUrl: imageCurrent, submittedImageUrl: imageOld, pageWidth: null, pageHeight: null }],
  users: [
    { id: 1, username: "mika", fullName: "Mika Mangaka", email: "mika@example.test", phoneNumber: "0901", roleName: "Mangaka", isActive: true },
    { id: 2, username: "aya", fullName: "Aya Assistant", email: "aya@example.test", phoneNumber: "0902", roleName: "Assistant", isActive: true },
    { id: 3, username: "admin", fullName: "System Admin", email: "admin@example.test", roleName: "Admin", isActive: true },
    { id: 4, username: "taro", fullName: "Taro Editor", email: "taro@example.test", roleName: "Tantou Editor", isActive: true }
  ],
  feedbacks: [{ id: 1001, content: "Strengthen the panel border.", isResolved: false, pageId: 100, xCoord: 100, yCoord: 140, width: 220, height: 180 }],
  comments: [{ id: 1101, content: "Use a darker tone here.", userName: "Mika" }],
  resources: [{ id: 801, fileName: "studio-brush.png", resourceType: "BRUSH", fileUrl: imageCurrent }]
};

function profileFor(role) {
  const normalized = String(role || "Mangaka").toLowerCase();
  return fixtures.users.find((user) => user.roleName.toLowerCase() === normalized)
    || { id: 9, username: normalized.replaceAll(" ", "_"), fullName: role, email: `${normalized.replaceAll(" ", ".")}@example.test`, roleName: role, isActive: true };
}

async function bootstrapApp(browser, { role = "", legacyRole = "", token = smokeToken, hash = "/login", chapterStatus = "" } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.setContent('<div id="root"></div>');
  await page.evaluate(({ roleName, legacyRoleName, initialHash, fixtureData, profile, authToken, initialChapterStatus }) => {
    function makeStorage() {
      const store = new Map();
      return {
        getItem(key) { return store.has(String(key)) ? store.get(String(key)) : null; },
        setItem(key, value) { store.set(String(key), String(value)); },
        removeItem(key) { store.delete(String(key)); },
        clear() { store.clear(); },
        key(index) { return [...store.keys()][index] ?? null; },
        get length() { return store.size; }
      };
    }
    Object.defineProperty(window, "localStorage", { configurable: true, value: makeStorage() });
    Object.defineProperty(window, "sessionStorage", { configurable: true, value: makeStorage() });

    if (legacyRoleName) {
      localStorage.setItem("accessToken", authToken);
      localStorage.setItem("token", authToken);
      localStorage.setItem("role", legacyRoleName);
      localStorage.setItem("username", "legacy-user");
      localStorage.setItem("userId", "99");
    }

    if (roleName) {
      sessionStorage.setItem("accessToken", authToken);
      sessionStorage.setItem("token", authToken);
      sessionStorage.setItem("role", roleName);
      sessionStorage.setItem("username", "smoke-user");
      sessionStorage.setItem("userId", "1");
    }

    window.__DISABLE_NOTIFICATION_STREAM__ = true;
    window.__smokeCapture = {
      lockStates: [], uploads: 0, hitboxesCreated: 0, comments: 0, feedbackComments: 0, restores: 0,
      taskStatuses: [], taskStarts: 0, feedbackCreated: 0, feedbackResolved: 0, votes: [],
      adminDecisions: 0, parameterUpdates: 0, tantouAssignments: [],
      tantouChapterStatus: initialChapterStatus || fixtureData.chapters[0].publishStatus,
      boardSubmissions: 0, seriesStatusChanges: []
    };

    const f = fixtureData;
    const response = (data, status = 200) => new Response(status === 204 ? null : JSON.stringify(data), {
      status,
      headers: status === 204 ? {} : { "Content-Type": "application/json" }
    });

    window.fetch = async (input, options = {}) => {
      const raw = typeof input === "string" ? input : input.url;
      const url = new URL(raw, "http://localhost:8080");
      const path = url.pathname.replace(/^\/api\/v1/, "");
      const method = String(options.method || "GET").toUpperCase();
      const capture = window.__smokeCapture;

      if (path === "/users/profile" && method === "GET") return response(profile);
      if (path === "/users/profile" && method === "PUT") return response({ ...profile, fullName: "Updated Name" });
      if (path === "/users/all") return response(f.users);
      if (path === "/users" && method === "GET") {
        const requestedRole = url.searchParams.get("role");
        return response(requestedRole ? f.users.filter((user) => user.roleName === requestedRole) : f.users);
      }
      if (/^\/users\/\d+\/lock$/.test(path)) {
        capture.lockStates.push(url.searchParams.get("isActive"));
        const id = Number(path.split("/")[2]);
        return response({ ...f.users.find((item) => item.id === id), isActive: url.searchParams.get("isActive") === "true" });
      }
      if (/^\/users\/\d+\/role$/.test(path)) return response({ id: Number(path.split("/")[2]), roleName: url.searchParams.get("roleName") });

      if (path === "/auth/login") return response({ token: authToken, id: 1, username: "smoke", role: roleName || "Mangaka" });
      if (path === "/auth/session") return response({ active: true, id: profile.id, username: profile.username });
      if (path === "/auth/logout") return response({ message: "Logged out" });
      if (path === "/auth/request-otp") return response({ message: "sent" });
      if (path === "/auth/verify-otp") return response({ token: authToken, id: 1, username: "smoke", role: roleName || "Mangaka" });
      if (path === "/auth/register") return response({ id: 55 });
      if (path === "/auth/google") return response({ token: authToken, id: 1, username: "smoke", role: roleName || "Mangaka" });

      if (path === "/manga-series/my-series") return response(f.series);
      if (path === "/manga-series/assigned-to-me") return response(f.series.map((item) => ({ ...item, displayNumber: 1, tantouId: 4, tantouName: "Taro Editor" })));
      if (path === "/manga-series" && method === "GET") return response(profile.roleName === "Tantou Editor"
        ? [
            ...f.series.map((item) => ({ ...item, displayNumber: 1, tantouId: 4, tantouName: "Taro Editor" })),
            { ...f.series[0], id: 99, displayNumber: 2, title: "Not assigned to this Tantou", tantouId: 88, tantouName: "Another Editor" }
          ]
        : f.series.map((item, index) => ({ ...item, displayNumber: index + 1 })));
      if (path === "/manga-series" && method === "POST") return response({ ...f.series[0], id: 2, status: "DRAFT" });
      if (path === "/manga-series/1" && method === "GET") {
        return response(profile.roleName === "Tantou Editor" ? { ...f.series[0], status: "DRAFT", tantouId: 4, tantouName: "Taro Editor" } : f.series[0]);
      }
      if (path === "/manga-series/1/submit-to-board" && method === "PATCH") {
        capture.boardSubmissions += 1;
        return response({ ...f.series[0], status: "REVIEWING" });
      }
      if (path === "/manga-series/1/admin-decision") {
        capture.adminDecisions += 1;
        return response({ ...f.series[0], status: url.searchParams.get("isApproved") === "true" ? "APPROVED" : "REJECTED" });
      }
      if (/^\/manga-series\/\d+\/status$/.test(path)) {
        const id = Number(path.split("/")[2]);
        const status = url.searchParams.get("newStatus");
        const item = f.series.find((series) => Number(series.id) === id) || f.series[0];
        item.status = status;
        capture.seriesStatusChanges.push({ id, status });
        return response({ ...item, status });
      }
      if (path === "/manga-series/1/tantou") {
        capture.tantouAssignments.push(url.searchParams.get("tantouId"));
        return response({ ...f.series[0], tantouId: Number(url.searchParams.get("tantouId")), tantouName: "Taro Editor" });
      }
      if (path === "/manga-series/1" && method === "DELETE") return response(null, 204);

      if (path === "/chapters/tantou-review") return response([
        { ...f.chapters[0], publishStatus: capture.tantouChapterStatus, seriesTitle: f.series[0].title, mangakaName: "Mika Mangaka", tantouId: 4, tantouName: "Taro Editor" }
      ]);
      if (path === "/chapters/series/1") {
        return response(profile.roleName === "Tantou Editor"
          ? [{ ...f.chapters[0], publishStatus: capture.tantouChapterStatus }]
          : f.chapters);
      }
      if (path === "/chapters/10") return response({ ...f.chapters[0], publishStatus: capture.tantouChapterStatus });
      if (path === "/chapters" && method === "POST") return response({ id: 11, chapterNumber: 2, title: "New Chapter" });
      if (path === "/chapters/10/status") {
        capture.tantouChapterStatus = url.searchParams.get("newStatus");
        return response({ ...f.chapters[0], publishStatus: capture.tantouChapterStatus });
      }
      if (path === "/chapters/10" && method === "DELETE") return response(null, 204);

      if (path === "/pages/chapter/10" && method === "GET") return response(f.pages);
      if (path === "/pages/chapter/10" && method === "POST") {
        capture.uploads += 1;
        return response({ id: 100 + capture.uploads, pageNumber: 1 + capture.uploads, imageUrl: f.imageCurrent });
      }
      if (path === "/pages/100/image") return response({ ...f.pages[0], imageUrl: f.imageCurrent });
      if (path === "/pages/100" && method === "DELETE") return response(null, 204);

      if (path === "/chapter-scripts/chapters/10" && method === "GET") return response({ id: 301, chapterId: 10, content: "## Opening\nA formatted script." });
      if (path === "/chapter-scripts/chapters/10" && method === "POST") return response({ id: 301, chapterId: 10, content: String(options.body || "") });
      if (path === "/chapter-scripts/series/1") return response([{ id: 301, chapterId: 10, content: "## Opening" }]);

      if (path === "/workspace/pages/100/canvas-init") return response({ imageUrl: f.imageCurrent, originalWidth: 800, originalHeight: 1200, hitboxes: f.hitboxes });
      if (path === "/workspace/pages/100/hitboxes" && method === "GET") return response(f.hitboxes);
      if (path === "/workspace/pages/100/hitboxes" && method === "POST") {
        capture.hitboxesCreated += 1;
        return response({ id: 702 + capture.hitboxesCreated, xCoord: Number(url.searchParams.get("x")), yCoord: Number(url.searchParams.get("y")), width: Number(url.searchParams.get("width")), height: Number(url.searchParams.get("height")) });
      }
      if (/^\/workspace\/hitboxes\/\d+$/.test(path) && method === "DELETE") return response(null, 204);
      if (/^\/workspace\/hitboxes\/\d+\/task$/.test(path)) return response({ id: 601, description: "Task" });

      if (path === "/page-versions/pages/100") return response(f.versions);
      if (path === "/page-versions/901/restore") { capture.restores += 1; return response({ ...f.pages[0], imageUrl: f.imageOld }); }

      if (path === "/hitbox-comments/701" && method === "GET") return response(f.comments);
      if (path === "/hitbox-comments/701" && method === "POST") {
        capture.comments += 1;
        return response({ id: 1200 + capture.comments, content: url.searchParams.get("content"), userName: roleName });
      }

      if (path === "/tasks/my-tasks") return response(f.tasks);
      if (path === "/tasks/series/1") return response(f.reviewTasks);
      if (/^\/tasks\/\d+\/status$/.test(path)) {
        const status = url.searchParams.get("newStatus");
        capture.taskStatuses.push(status);
        return response({ ...f.tasks[0], status });
      }
      if (/^\/tasks\/\d+\/assign$/.test(path)) return response({ ...f.tasks[0], assistantId: Number(url.searchParams.get("assistantId")), assistantName: "Aya Assistant" });
      if (/^\/tasks\/\d+\/start$/.test(path)) { capture.taskStarts += 1; return response({ ...f.tasks[0], status: "DOING" }); }
      if (/^\/tasks\/\d+\/submit$/.test(path)) return response({ ...f.tasks[0], status: "REVIEWING", submittedImageUrl: url.searchParams.get("imageUrl") });

      if (path === "/resources" && method === "GET") return response(f.resources);
      if (path === "/resources/upload") return response({ id: 899, fileUrl: f.imageCurrent, resourceType: "TASK_SUBMISSION" });
      if (/^\/resources\/\d+$/.test(path) && method === "DELETE") return response(null, 204);

      if (path === "/tantou-feedbacks/pages/100" && method === "GET") return response(f.feedbacks);
      if (path === "/tantou-feedbacks/pages/100" && method === "POST") {
        capture.feedbackCreated += 1;
        return response({
          id: 1002,
          content: url.searchParams.get("content"),
          isResolved: false,
          xCoord: Number(url.searchParams.get("x")),
          yCoord: Number(url.searchParams.get("y")),
          width: Number(url.searchParams.get("width")),
          height: Number(url.searchParams.get("height"))
        });
      }
      if (/^\/tantou-feedbacks\/\d+\/comments$/.test(path) && method === "POST") {
        capture.feedbackComments += 1;
        return response({ id: 1300 + capture.feedbackComments, pageId: 100, xCoord: 100, yCoord: 140, width: 220, height: 180, content: `[Mangaka Comment] ${url.searchParams.get("content")}`, isResolved: false });
      }
      if (/^\/tantou-feedbacks\/\d+\/resolve$/.test(path)) { capture.feedbackResolved += 1; return response({ id: Number(path.split("/")[2]), content: "Resolved feedback", isResolved: true }); }

      if (path === "/votes/series/1/summary") return response({ totalVotes: 3, approvedVotes: 2, rejectedVotes: 1, pendingVotes: 0 });
      if (path === "/votes/series/1") { capture.votes.push(url.searchParams.get("isApproved")); return response({ id: 91, isApproved: url.searchParams.get("isApproved") === "true" }); }

      if (path === "/schedules/series/1") return response([{ id: 41, publishDate: f.nextWeek, frequency: "Weekly" }]);
      if (path === "/schedules" && method === "POST") return response({ id: 42 });
      if (/^\/schedules\/\d+$/.test(path) && method === "DELETE") return response(null, 204);
      if (path === "/deadlines/series/1" && method === "GET") return response([{ id: 51, eventName: "Chapter delivery", deadlineDateStr: f.tomorrow }]);
      if (path === "/deadlines/series/1" && method === "POST") return response({ id: 52, eventName: url.searchParams.get("eventName"), deadlineDateStr: url.searchParams.get("deadlineDateStr") });
      if (/^\/deadlines\/\d+$/.test(path) && method === "DELETE") return response(null, 204);

      if (path === "/notifications/unread") return response([{ id: 61, message: "Task updated", createdAt: f.tomorrow }]);
      if (path === "/notifications/61/read") return response({ id: 61, read: true });
      if (path === "/telemetry/series/1") return response({ pageViews: 120, activeReaders: 18, completionRate: 74 });

      if (path === "/system-parameters" && method === "GET") return response([{ key: "MAX_UPLOAD_MB", value: "25" }, { key: "MAX_PAGES_PER_CHAPTER", value: "80" }]);
      if (path === "/system-parameters" && method === "POST") return response({ key: url.searchParams.get("key"), value: url.searchParams.get("value") });
      if (path === "/system-parameters/MAX_UPLOAD_MB" && method === "PUT") { capture.parameterUpdates += 1; return response({ key: "MAX_UPLOAD_MB", value: url.searchParams.get("value") }); }
      if (/^\/system-parameters\//.test(path) && method === "DELETE") return response(null, 204);

      return response({ message: `Unhandled mock ${method} ${path}` }, 404);
    };

    location.hash = initialHash;
  }, { roleName: role, legacyRoleName: legacyRole, initialHash: hash, fixtureData: fixtures, profile: profileFor(role || legacyRole || "Mangaka"), authToken: token, initialChapterStatus: chapterStatus });

  await page.addStyleTag({ content: bundleCss });
  await page.addScriptTag({ content: bundleJs, type: "module" });
  return { context, page, pageErrors };
}

async function navigate(page, hash) {
  await page.evaluate((target) => { location.hash = target; }, hash);
}

async function waitText(page, text, timeout = 10000) {
  await page.getByText(text, { exact: false }).first().waitFor({ state: "visible", timeout });
}

async function capture(page) {
  return page.evaluate(() => structuredClone(window.__smokeCapture));
}

async function run() {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const passed = [];
  try {
    {
      const { context, page, pageErrors } = await bootstrapApp(browser, { hash: "/login" });
      await waitText(page, "MangaSystem");
      assert.equal(await page.locator("#login-password").getAttribute("type"), "password");
      await page.getByRole("button", { name: "Show password" }).click();
      assert.equal(await page.locator("#login-password").getAttribute("type"), "text");
      await page.getByRole("button", { name: "via OTP" }).click();
      await page.locator('input[type="email"]').waitFor();
      await page.getByRole("button", { name: "PASSWORD", exact: true }).click();
      await page.getByRole("button", { name: /create new account/i }).click();
      const registerPassword = page.locator('#form-register-section input[autocomplete="new-password"]');
      assert.equal(await registerPassword.getAttribute("type"), "password");
      await page.locator('#form-register-section').getByRole("button", { name: "Show password" }).click();
      assert.equal(await registerPassword.getAttribute("type"), "text");
      assert.deepEqual(pageErrors, []);
      passed.push("FE-02 password/OTP login and login/register password visibility");
      await context.close();
    }

    {
      const { context, page, pageErrors } = await bootstrapApp(browser, { legacyRole: "Mangaka", hash: "/dashboard" });
      await waitText(page, "MangaSystem");
      const storageState = await page.evaluate(() => ({
        legacyToken: localStorage.getItem("accessToken"),
        tabToken: sessionStorage.getItem("accessToken")
      }));
      assert.deepEqual(storageState, { legacyToken: null, tabToken: null });
      assert.deepEqual(pageErrors, []);
      passed.push("Authentication ignores and removes legacy persistent localStorage sessions");
      await context.close();
    }

    {
      const { context, page, pageErrors } = await bootstrapApp(browser, { role: "Mangaka", token: expiredSmokeToken, hash: "/dashboard" });
      await waitText(page, "MangaSystem");
      assert.equal(await page.evaluate(() => sessionStorage.getItem("accessToken")), null);
      assert.deepEqual(pageErrors, []);
      passed.push("Expired tab JWT is cleared and redirected to Login");
      await context.close();
    }

    {
      const { context, page, pageErrors } = await bootstrapApp(browser, { role: "Admin", hash: "/dashboard" });
      await waitText(page, "System and Publishing Control");
      await waitText(page, "Pending final");
      assert.equal(await page.getByText("Control", { exact: true }).count(), 0);
      assert.equal(await page.getByRole("button", { name: "Assets", exact: true }).count(), 0);
      assert.equal(await page.getByRole("button", { name: "Workflow", exact: true }).count(), 0);
      await navigate(page, "/admin/users");
      await waitText(page, "All users");
      await page.getByLabel("Search users").fill("Aya");
      assert.equal(await page.locator("tbody tr").count(), 1);
      await page.getByRole("button", { name: "Lock", exact: true }).click();
      await waitText(page, "User updated");
      assert.equal((await capture(page)).lockStates.at(-1), "false", "Lock must send isActive=false");

      await navigate(page, "/admin/system");
      await waitText(page, "Parameters");
      await page.getByRole("button", { name: "Edit", exact: true }).first().click();
      await page.getByPlaceholder("Value / limit").fill("30");
      await page.getByRole("button", { name: "Update", exact: true }).click();
      await waitText(page, "Updated MAX_UPLOAD_MB");
      assert.equal((await capture(page)).parameterUpdates, 1);

      await navigate(page, "/admin-review");
      await waitText(page, "Final series decisions");
      await page.getByRole("button", { name: "Admin approve" }).click();
      await waitText(page, "Approve Ink Horizon?");
      await page.getByRole("button", { name: "Confirm final decision" }).click();
      await waitText(page, "Series approved by admin");
      assert.equal((await capture(page)).adminDecisions, 1);
      assert.deepEqual(pageErrors, []);
      passed.push("FE-04 user filters + lock fix, FE-08 parameter CRUD, FE-18 final approval modal");
      await context.close();
    }

    {
      const { context, page, pageErrors } = await bootstrapApp(browser, { role: "Mangaka", hash: "/dashboard" });
      await waitText(page, "Workflow KPI charts");
      await page.getByTitle("Notifications").click();
      await waitText(page, "Task updated");
      await waitText(page, "polling");
      await page.getByTitle("Notifications").click();
      await page.getByRole("button", { name: "Series", exact: true }).last().click();
      assert.equal(await page.locator('.kpi-chart[aria-label="series bar chart"]').count(), 1);
      const revertButton = page.locator('[data-testid="revert-series-2-to-draft"]');
      await revertButton.waitFor({ state: "visible" });
      await revertButton.click();
      await waitText(page, "reverted to Draft");
      assert.deepEqual((await capture(page)).seriesStatusChanges.at(-1), { id: 2, status: "DRAFT" });

      await navigate(page, "/series");
      await waitText(page, "Create new series");
      await page.getByLabel("Title").fill("Smoke Series");
      await page.getByLabel("Genre").selectOption("Action");
      await page.getByRole("button", { name: "Continue" }).click();
      await page.getByLabel("Summary").fill("A short summary");
      await page.getByLabel("Description").fill("A longer project description");
      await page.getByRole("button", { name: "Continue" }).click();
      await page.locator(".wizard-summary-card").waitFor({ state: "visible" });

      await navigate(page, "/series/1");
      await waitText(page, "Upload Pages");
      assert.match(await page.evaluate(() => location.hash), /^#\/chapters-pages\?seriesId=1/, "Mangaka series cards must open the real Chapters & Pages route");

      await navigate(page, "/chapters-pages?seriesId=1");
      await waitText(page, "Upload Pages");
      await page.locator('input[type="file"][multiple]').first().setInputFiles([
        { name: "page-2.png", mimeType: "image/png", buffer: Buffer.from("fake-image-1") },
        { name: "page-3.png", mimeType: "image/png", buffer: Buffer.from("fake-image-2") }
      ]);
      await waitText(page, "Uploaded 2 of 2 page(s)");
      await waitText(page, "2/2");
      assert.equal((await capture(page)).uploads, 2);

      await navigate(page, "/manuscripts?seriesId=1");
      await waitText(page, "Chapter 1 Script");
      assert.equal(await page.locator(".script-toolbar").count(), 1);
      assert.equal(await page.locator(".manuscript-image-pane img").count(), 1);
      assert.equal(await page.locator(".manuscript-tree").count(), 1);
      assert.ok(await page.locator(".tree-page-item").count() >= 1);
      assert.equal(await page.locator(".manuscript-page-preview-grid").count(), 0, "Redundant page thumbnail strip must be removed below script actions");

      await navigate(page, "/workspace/100?seriesId=1&chapterId=10");
      await waitText(page, "Page Versions");
      assert.match(await page.evaluate(() => location.hash), /^#\/canvas-workspace\?/, "Mangaka legacy canvas URLs must redirect to the real Canvas Workspace");

      await navigate(page, "/canvas-workspace?seriesId=1&chapterId=10&pageId=100");
      await waitText(page, "Page Versions");
      assert.equal(await page.locator(".chapter-workspace-sidebar").count(), 1);
      assert.ok(await page.locator(".chapter-sidebar-pages button").count() >= 1);
      const chapterWorkspaceStyle = await page.locator(".chapter-sidebar-button").first().evaluate((element) => {
        const style = getComputedStyle(element);
        return { borderRadius: style.borderRadius, backgroundImage: style.backgroundImage, minHeight: style.minHeight };
      });
      assert.equal(chapterWorkspaceStyle.borderRadius, "10px");
      assert.match(chapterWorkspaceStyle.backgroundImage, /linear-gradient/);
      const pageWorkspaceStyle = await page.locator(".chapter-sidebar-pages button").first().evaluate((element) => {
        const style = getComputedStyle(element);
        return { borderRadius: style.borderRadius, minHeight: style.minHeight };
      });
      assert.equal(pageWorkspaceStyle.borderRadius, "8px");
      const canvasStage = page.locator(".hitbox-image-wrap");
      const stageBox = await canvasStage.boundingBox();
      assert.ok(stageBox, "Canvas image must have a measurable drawing area");
      await page.mouse.move(stageBox.x + stageBox.width * 0.58, stageBox.y + stageBox.height * 0.58);
      await page.mouse.down();
      await page.mouse.move(stageBox.x + stageBox.width * 0.76, stageBox.y + stageBox.height * 0.74, { steps: 6 });
      await page.mouse.up();
      await waitText(page, "Hitbox created");
      assert.ok((await capture(page)).hitboxesCreated >= 1);
      await page.getByText("Version 1", { exact: false }).click();
      assert.equal(await page.locator('.version-comparison input[type="range"]').count(), 1);
      await page.getByRole("button", { name: "Restore", exact: true }).click();
      await waitText(page, "Restored page to version");
      assert.equal((await capture(page)).restores, 1);

      const savedHitbox = page.locator(".saved-hitbox").first();
      await savedHitbox.waitFor();
      await savedHitbox.click({ button: "right" });
      await waitText(page, "Hitbox comments");
      await page.getByPlaceholder("Add a comment...").fill("Smoke context comment");
      await page.getByRole("button", { name: "Add comment", exact: true }).click();
      await waitText(page, "Comment added");
      assert.equal((await capture(page)).comments, 1);
      await page.locator(".hitbox-context-menu .btn-icon-only").click();
      await savedHitbox.click();
      await page.getByRole("button", { name: "Open Task Assignment Modal" }).click();
      await waitText(page, "Create task from selected hitbox");

      await navigate(page, "/tasks?tab=kanban");
      await waitText(page, "Kanban Board");
      assert.equal(await page.locator('[data-testid="kanban-task-card"]').count(), fixtures.tasks.length, "Kanban must render every API task exactly once");
      const taskCard = page.locator('.task-card[draggable="true"]').first();
      assert.equal(await taskCard.getByRole("button", { name: "Doing", exact: true }).count(), 1);
      assert.equal(await taskCard.getByRole("button", { name: "Approved", exact: true }).count(), 0);
      const doingColumn = page.locator('.kanban-column[data-status="DOING"]');
      await taskCard.dragTo(doingColumn);
      await waitText(page, "moved to DOING");
      assert.ok((await capture(page)).taskStatuses.includes("DOING"));
      const movedCard = page.locator('.kanban-column[data-status="DOING"] [data-testid="kanban-task-card"]').first();
      assert.equal(await movedCard.getByRole("button", { name: "Reviewing", exact: true }).count(), 1);
      assert.equal(await movedCard.getByRole("button", { name: "Todo", exact: true }).count(), 0);
      assert.equal(await movedCard.getByRole("button", { name: "Approved", exact: true }).count(), 0);

      await navigate(page, "/tasks?tab=assignments");
      await waitText(page, "Task Detail");
      assert.equal(await page.locator('[data-testid="task-chapter-meta"]').textContent(), "Chapter 1: Opening", "Task Detail must not show Chapter: Chapter ...");

      await navigate(page, "/assistant-review");
      await waitText(page, "Tantou feedback #1001");
      const feedbackBox = page.locator('[data-testid="feedback-hitbox-1001"]');
      await feedbackBox.waitFor({ state: "visible" });
      assert.equal(await feedbackBox.getByText("Task Area", { exact: true }).count(), 1, "Tantou feedback must display the Task Area label");
      const feedbackStyle = await feedbackBox.evaluate((element) => ({ left: element.style.left, top: element.style.top, width: element.style.width, height: element.style.height }));
      assert.equal(feedbackStyle.left, "12.5%");
      assert.ok(Math.abs(parseFloat(feedbackStyle.top) - (140 / 1200 * 100)) < 0.02);
      assert.ok(Math.abs(parseFloat(feedbackStyle.width) - (220 / 800 * 100)) < 0.02);
      assert.equal(feedbackStyle.height, "15%");
      await page.getByPlaceholder("Write your response or implementation note for the Tantou feedback.").fill("Mangaka response");
      await page.getByRole("button", { name: "Add comment", exact: true }).click();
      await waitText(page, "Comment added to Tantou feedback #1001");
      assert.equal((await capture(page)).feedbackComments, 1, "Mangaka feedback comment must use the dedicated authorized endpoint");

      await page.getByRole("button", { name: /Assistant Submissions/ }).click();
      await waitText(page, "Send approved chapters to Tantou");
      assert.equal(await page.locator('[data-testid="assistant-work-approved-502"]').count(), 1);
      assert.equal(await page.getByText("Task #1", { exact: true }).count(), 1, "Mangaka Review must show the per-series task number rather than task ID 502");
      assert.equal(await page.getByText("Task #502", { exact: true }).count(), 0);
      assert.equal(await page.locator('[data-testid="approve-assistant-work"]').count(), 0, "Approved tasks must not keep an approval button");
      assert.equal(await page.locator('[data-testid="inline-chapter-handoff-10"]').count(), 1, "Approved task card must show its chapter handoff action");
      const reviewRow = page.locator('[data-testid="assistant-review-task-502"]');
      const reviewHitbox = reviewRow.locator(".task-hitbox-overlay");
      await reviewHitbox.waitFor({ state: "visible" });
      const reviewHitboxStyle = await reviewHitbox.evaluate((element) => ({ left: element.style.left, top: element.style.top, width: element.style.width, height: element.style.height }));
      assert.equal(reviewHitboxStyle.left, "12.5%", "Review hitbox X must match Mangaka Canvas coordinates");
      assert.ok(Math.abs(parseFloat(reviewHitboxStyle.top) - (140 / 1200 * 100)) < 0.02, "Review hitbox Y must match Mangaka Canvas coordinates");
      assert.ok(Math.abs(parseFloat(reviewHitboxStyle.width) - (220 / 800 * 100)) < 0.02, "Review hitbox width must match Mangaka Canvas coordinates");
      assert.equal(reviewHitboxStyle.height, "15%", "Review hitbox height must match Mangaka Canvas coordinates");
      assert.equal(await reviewRow.locator('img[alt="Reference"]').getAttribute("src"), fixtures.imageCurrent, "Mangaka Review reference must remain the original page image");
      assert.equal(await reviewRow.locator('img[alt="Submitted work"]').getAttribute("src"), fixtures.imageOld, "Mangaka Review submitted work must remain separate");
      await page.screenshot({ path: path.resolve("test-results/issue16-approved-task-handoff.png"), fullPage: true });
      await page.locator('[data-testid="inline-chapter-tantou-select-1"]').selectOption("4");
      await page.locator('[data-testid="inline-assign-and-send-chapter-10"]').click();
      await waitText(page, "sent to Taro Editor for review");
      assert.deepEqual((await capture(page)).tantouAssignments, ["4"]);
      assert.equal(await page.locator('[data-testid="chapter-sent-10"]').count(), 1);

      await navigate(page, "/schedule");
      await waitText(page, "Upcoming deadline monitoring");
      assert.equal(await page.locator(".month-cell").count(), 42);
      assert.ok(await page.locator(".deadline-warning").count() >= 1);
      assert.deepEqual(pageErrors, []);
      passed.push("FE-10 notifications, FE-12 wizard, FE-14 explorer tree, FE-20 calendar, FE-22 KPI charts, FE-24 deadline warnings, FE-28/29 script split view, FE-32 batch upload, FE-36 pointer hitbox drawing, FE-38 task modal, FE-40 drag/drop, FE-42 context comments, FE-44 version slider/restore, FE-48 chapter sidebar");
      await context.close();
    }

    {
      const { context, page, pageErrors } = await bootstrapApp(browser, { role: "Assistant", hash: "/dashboard" });
      await waitText(page, "Upcoming Deadlines");
      await waitText(page, "Chapter delivery");
      assert.equal(await page.getByText("NOW", { exact: true }).count(), 0);
      assert.equal(await page.getByText("REV", { exact: true }).count(), 0);
      assert.equal(await page.getByRole("button", { name: "Assets", exact: true }).count(), 0);
      await page.locator(".ast-task-item").first().click();
      assert.match(await page.evaluate(() => location.hash), /^#\/tasks\?tab=assignments/, "Active Assignment cards must open Assignments");
      await waitText(page, "Task Detail");
      await waitText(page, "Task #1");
      assert.equal(await page.locator('[data-testid^="task-status-"]').count(), 0, "Assistant Assignments must not show task status controls");
      assert.equal(await page.getByText("Submitted image", { exact: true }).count(), 0, "Assistant must not see the submitted-image panel");
      assert.equal(await page.locator('.assignment-reference-panel img').first().getAttribute("src"), fixtures.imageCurrent, "Reference image must remain the original page image");
      await page.locator(".task-hitbox-overlay").waitFor({ state: "visible" });
      assert.equal(await page.locator(".task-hitbox-overlay").count(), 1, "Task Area overlay must render for the initially selected task");
      const taskAreaBox = await page.locator(".task-hitbox-label").first().boundingBox();
      assert.ok(taskAreaBox && taskAreaBox.width <= 60 && taskAreaBox.height <= 18, "Task Area label must fit the text instead of using an oversized oval");
      const taskAreaStyle = await page.locator(".task-hitbox-label").first().evaluate((element) => ({
        borderRadius: getComputedStyle(element).borderRadius,
        fontSize: getComputedStyle(element).fontSize
      }));
      assert.equal(taskAreaStyle.borderRadius, "4px");
      assert.equal(taskAreaStyle.fontSize, "8px");
      assert.equal(await page.getByText("Your submitted image", { exact: true }).count(), 1, "Assistant must see their submitted result in Task Detail");
      const detailImages = await page.locator(".assignment-reference-panel img").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("src")));
      assert.ok(detailImages.includes(fixtures.imageCurrent), "Reference image must remain the original page");
      assert.ok(detailImages.includes(fixtures.imageOld), "Submitted image must remain separate from the reference");
      await page.getByRole("button", { name: "Download reference image" }).click();
      await waitText(page, "started and moved to Doing");
      assert.equal((await capture(page)).taskStarts, 1);
      await page.locator('[data-testid="assistant-work-file"]').setInputFiles({ name: "finished.png", mimeType: "image/png", buffer: Buffer.from("finished-image") });
      assert.equal(await page.locator('[data-testid="assistant-finished-preview"] img').count(), 1, "Chosen finished work must render an image preview");
      await navigate(page, "/tasks?tab=kanban");
      await waitText(page, "Kanban Board");
      assert.equal(await page.locator('[data-testid="kanban-task-card"][draggable="true"]').count(), 0, "Assistant Kanban must be view-only");
      assert.ok(await page.getByText("View only", { exact: true }).count() >= 1);
      await navigate(page, "/resources");
      await waitText(page, "Resource Library");
      assert.equal(await page.getByRole("link", { name: "Download" }).count(), 1);
      assert.equal(await page.getByText("Upload files", { exact: true }).count(), 0);
      await navigate(page, "/profile");
      await waitText(page, "Edit profile");
      assert.equal(await page.getByLabel("Phone number").count(), 1);
      assert.deepEqual(pageErrors, []);
      passed.push("FE-06 profile editing and FE-46 assistant resource download gallery");
      await context.close();
    }

    {
      const { context, page, pageErrors } = await bootstrapApp(browser, { role: "Tantou Editor", hash: "/series" });
      await waitText(page, "Assigned Series");
      assert.equal(await page.getByText("Ink Horizon", { exact: true }).count(), 1);
      assert.equal(await page.getByText("Not assigned to this Tantou", { exact: true }).count(), 0, "Tantou must not see other editors' series");
      assert.equal(await page.locator(".sidebar .ws-logo").count(), 0);
      assert.equal(await page.locator(".sidebar .ws-role").count(), 0);
      assert.equal(await page.locator(".sidebar").getByText("Tantou Editor Workspace", { exact: true }).count(), 1);
      assert.equal(await page.locator('.topbar input[placeholder="Search..."]').count(), 0);
      const sidebarWidth = await page.locator(".sidebar").evaluate((element) => Math.round(element.getBoundingClientRect().width));
      assert.ok(sidebarWidth >= 260, `Expected Tantou sidebar >= 260px, received ${sidebarWidth}px`);
      assert.deepEqual(pageErrors, []);
      passed.push("Tantou Assigned Series is scoped, branding is clean, sidebar is wide, and top search is removed");
      await context.close();
    }

    {
      const { context, page, pageErrors } = await bootstrapApp(browser, { role: "Tantou Editor", hash: "/tasks?tab=kanban" });
      await waitText(page, "Kanban Board");
      await waitText(page, "Read-only view of Assistant tasks from manga series assigned to this Tantou Editor.");
      assert.equal(await page.locator('[data-testid="kanban-task-card"]').count(), fixtures.tasks.length, "Tantou Kanban must render tasks returned for assigned series");
      assert.equal(await page.locator('[data-testid="kanban-task-card"][draggable="true"]').count(), 0, "Tantou Kanban must remain read-only");
      assert.equal(await page.getByRole("button", { name: "Assignments", exact: true }).count(), 0, "Tantou task screen must not expose the unrelated Assignments tab");
      assert.ok(await page.getByText("View only", { exact: true }).count() >= 1);
      await page.screenshot({ path: path.resolve("test-results/tantou-kanban-fixed.png"), fullPage: true });
      assert.deepEqual(pageErrors, []);
      passed.push("Tantou Kanban renders assigned-series tasks in a read-only board");
      await context.close();
    }

    {
      const { context, page, pageErrors } = await bootstrapApp(browser, { role: "Tantou Editor", hash: "/canvas-workspace?seriesId=1&chapterId=10&pageId=100" });
      await waitText(page, "Tantou Review Canvas");
      await page.locator('[data-testid="canvas-draw-surface"]').waitFor({ state: "visible" });
      const surface = await page.locator('[data-testid="canvas-draw-surface"]').boundingBox();
      assert.ok(surface, "Tantou feedback canvas must be visible");
      await page.mouse.move(surface.x + surface.width * 0.62, surface.y + surface.height * 0.62);
      await page.mouse.down();
      await page.mouse.move(surface.x + surface.width * 0.82, surface.y + surface.height * 0.82, { steps: 5 });
      await page.mouse.up();
      await page.locator('[data-testid="draft-hitbox"]').waitFor({ state: "visible" });
      await page.getByPlaceholder("Describe the revision needed in this area...").fill("Correct the border weight");
      await page.getByRole("button", { name: "Save feedback area" }).click();
      await waitText(page, "independent review workspace");
      assert.equal((await capture(page)).feedbackCreated, 1);
      assert.ok(await page.locator(".tantou-feedback-box").count() >= 1);
      assert.equal(await page.locator(".mangaka-hitbox-box").count(), 0, "Tantou workspace must not display Mangaka hitboxes");
      assert.deepEqual(pageErrors, []);
      passed.push("FE-26 Tantou feedback creation uses an independent visible review canvas");
      await context.close();
    }

    {
      const { context, page, pageErrors } = await bootstrapApp(browser, { role: "Tantou Editor", hash: "/tantou-review", chapterStatus: "REVIEWING" });
      await waitText(page, "Editorial Board handoff");
      await page.locator('[data-testid="tantou-return-chapter-10"]').click();
      await waitText(page, "sent back to the Mangaka for revision");
      assert.equal((await capture(page)).tantouChapterStatus, "REVISION");
      assert.deepEqual(pageErrors, []);
      passed.push("Tantou can send a reviewed chapter back to Mangaka as REVISION");
      await context.close();
    }

    {
      const { context, page, pageErrors } = await bootstrapApp(browser, { role: "Tantou Editor", hash: "/tantou-review", chapterStatus: "APPROVED" });
      await waitText(page, "Editorial Board handoff");
      const sendButton = page.locator('[data-testid="send-series-to-board-1"]');
      await sendButton.waitFor({ state: "visible" });
      assert.equal(await sendButton.isEnabled(), true);
      await sendButton.click();
      await waitText(page, "was sent to the Editorial Board");
      assert.equal((await capture(page)).boardSubmissions, 1);
      assert.equal(await page.locator('[data-testid="series-board-sent-1"]').count(), 1);
      assert.deepEqual(pageErrors, []);
      passed.push("Tantou can submit a fully chapter-approved series to Editorial Board");
      await context.close();
    }

    {
      const { context, page, pageErrors } = await bootstrapApp(browser, { role: "Editorial Board", hash: "/dashboard" });
      await waitText(page, "Voting Dashboard");
      assert.equal(await page.getByRole("button", { name: "Assets", exact: true }).count(), 0);
      assert.equal(await page.getByRole("button", { name: "Workflow", exact: true }).count(), 0);
      assert.equal(await page.getByRole("button", { name: "Vote Queue", exact: true }).count(), 1);
      await navigate(page, "/board-review");
      await waitText(page, "Series waiting for board votes");
      await page.getByRole("button", { name: "Vote approve" }).click();
      await waitText(page, "Approval vote submitted");
      assert.equal((await capture(page)).votes.at(-1), "true");
      assert.deepEqual(pageErrors, []);
      passed.push("FE-16 dynamic Editorial Board approve/reject voting");
      await context.close();
    }

    console.log(JSON.stringify({ passed: passed.length, checks: passed }, null, 2));
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
