import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright-core";

const cwd = process.cwd();
loadEnv(path.join(cwd, ".env.e2e.local"));
loadEnv(path.join(cwd, ".env.e2e"));

const args = parseArgs(process.argv.slice(2));
const runId = stamp();
const config = {
  backendUrl: stripSlash(args.backend || process.env.E2E_BACKEND_URL || "http://localhost:8080/api/v1"),
  frontendUrl: stripSlash(args.frontend || process.env.E2E_FRONTEND_URL || "http://localhost:5173"),
  wsUrl: stripSlash(process.env.E2E_WS_URL || "http://localhost:8080/ws"),
  password: process.env.E2E_PASSWORD || "123456",
  browserPath: args.browser || process.env.E2E_BROWSER_PATH || "",
  backendJar: args.jar || process.env.E2E_BACKEND_JAR || "",
  headed: args.headed === true || String(process.env.E2E_HEADLESS || "true").toLowerCase() === "false",
  timeout: Number(process.env.E2E_TIMEOUT_MS || 45_000),
  settleMs: Number(process.env.E2E_DISPLAY_SETTLE_MS || 2200),
  accounts: {
    mangaka: { email: process.env.E2E_MANGAKA_EMAIL || "HuyMangaka@gmail.com", role: "ROLE_MANGAKA", label: "Mangaka" },
    assistant: { email: process.env.E2E_ASSISTANT_EMAIL || "HuyAssistant@gmail.com", role: "ROLE_ASSISTANT", label: "Assistant" },
    tantou: { email: process.env.E2E_TANTOU_EMAIL || "HuyTantou@gmail.com", role: "ROLE_TANTOU EDITOR", label: "Tantou Editor" },
    board: { email: process.env.E2E_BOARD_EMAIL || "HuyBoard1@gmail.com", role: "ROLE_EDITORIAL BOARD", label: "Editorial Board" },
    admin: { email: process.env.E2E_ADMIN_EMAIL || "admin@studio.com", role: "ROLE_ADMIN", label: "Admin" }
  }
};

const outputDir = path.resolve(cwd, "display-audit-results", runId);
const shotDir = path.join(outputDir, "screenshots");
fs.mkdirSync(shotDir, { recursive: true });

const report = {
  runId,
  startedAt: new Date().toISOString(),
  mode: "READ_ONLY_REAL_DATA",
  backendUrl: config.backendUrl,
  frontendUrl: config.frontendUrl,
  roles: {},
  pages: [],
  issues: [],
  pageErrors: [],
  consoleErrors: [],
  failedResponses: [],
  result: "RUNNING"
};

let backendProcess = null;
let frontendProcess = null;
let browser = null;
let context = null;
let page = null;
let currentVisit = null;

const roleRoutes = {
  mangaka: [
    ["Dashboard", "/dashboard"], ["Series", "/series"], ["Manuscripts", "/manuscripts"],
    ["Chapters & Pages", "/chapters-pages"], ["Canvas Workspace", "/canvas-workspace"],
    ["Kanban", "/tasks?tab=kanban"], ["Assignments", "/tasks?tab=assignments"],
    ["Assistant Review", "/assistant-review"], ["Schedule", "/schedule"],
    ["Resources", "/resources"], ["Profile", "/profile"]
  ],
  assistant: [
    ["Dashboard", "/dashboard"], ["Assignments", "/tasks?tab=assignments"],
    ["Kanban", "/tasks?tab=kanban"], ["Schedule", "/schedule"],
    ["Resources", "/resources"], ["Profile", "/profile"]
  ],
  tantou: [
    ["Dashboard", "/dashboard"], ["Assigned Series", "/series"], ["Tasks", "/tasks"],
    ["Chapter Review", "/tantou-review"], ["Schedule", "/schedule"], ["Profile", "/profile"]
  ],
  board: [
    ["Dashboard", "/dashboard"], ["Voting", "/board-review"], ["Schedule", "/schedule"], ["Profile", "/profile"]
  ],
  admin: [
    ["Dashboard", "/dashboard"], ["Users", "/admin/users"], ["Schedule", "/schedule"],
    ["Final Approval", "/admin-review"], ["System Settings", "/admin/system"], ["Profile", "/profile"]
  ]
};

const forbiddenInteractiveLabels = {
  mangaka: [/final approval/i, /vote queue/i, /manage users/i, /system parameters/i],
  assistant: [/new series/i, /create series/i, /final approval/i, /vote queue/i, /voting center/i, /chapter review/i, /manage users/i, /system parameters/i],
  tantou: [/new series/i, /create series/i, /final approval/i, /vote queue/i, /manage users/i, /system parameters/i, /assign assistant/i],
  board: [/new series/i, /create series/i, /final approval/i, /manage users/i, /system parameters/i, /upload page/i, /assign assistant/i],
  admin: [/new series/i, /create series/i, /upload page/i, /assign assistant/i, /submit work/i]
};

function addIssue({ severity = "WARNING", role = "SYSTEM", route = "", code, message, detail = "" }) {
  report.issues.push({ severity, role, route, code, message, detail });
}

async function api(pathname, { method = "GET", token = "", body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let requestBody = body;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json; charset=utf-8";
    requestBody = JSON.stringify(body);
  }
  const response = await fetch(`${config.backendUrl}${pathname}`, { method, headers, body: requestBody });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: response.status, text, json };
}

function list(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.content)) return payload.content;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

async function loginApi(key) {
  const account = config.accounts[key];
  const result = await api("/auth/login", { method: "POST", body: { username: account.email, password: config.password } });
  assert.equal(result.status, 200, `${account.label} login returned ${result.status}: ${truncate(result.text)}`);
  assert.equal(result.json?.role, account.role, `${account.label} returned ${result.json?.role}, expected ${account.role}`);
  assert.ok(result.json?.token, `${account.label} login did not return a token`);
  return { ...account, ...result.json };
}

async function collectRoleData(key, account) {
  const token = account.token;
  const profile = await api("/users/profile", { token });
  const series = key === "mangaka"
    ? await api("/manga-series/my-series", { token })
    : await api("/manga-series?page=0&size=100", { token });
  const tasks = await api("/tasks/my-tasks", { token });
  const notifications = await api("/notifications/unread", { token });
  const resources = ["mangaka", "assistant"].includes(key) ? await api("/resources", { token }) : { status: 0, json: [] };
  const users = key === "admin" ? await api("/users/all", { token }) : { status: 0, json: [] };
  const parameters = key === "admin" ? await api("/system-parameters", { token }) : { status: 0, json: [] };
  const reviewChapters = key === "tantou" ? await api("/chapters/tantou-review", { token }) : { status: 0, json: [] };

  const snapshot = {
    profile: profile.json,
    series: list(series.json),
    tasks: list(tasks.json),
    notifications: list(notifications.json),
    resources: list(resources.json),
    users: list(users.json),
    parameters: list(parameters.json),
    reviewChapters: list(reviewChapters.json),
    statuses: {
      profile: profile.status, series: series.status, tasks: tasks.status, notifications: notifications.status,
      resources: resources.status, users: users.status, parameters: parameters.status, reviewChapters: reviewChapters.status
    }
  };

  // Locate a meaningful existing page without modifying data.
  snapshot.selectedSeries = snapshot.series.find((s) => String(s.status || "").toUpperCase() === "APPROVED") || snapshot.series[0] || null;
  snapshot.chapters = [];
  snapshot.pages = [];
  if (snapshot.selectedSeries?.id) {
    const chapters = await api(`/chapters/series/${snapshot.selectedSeries.id}`, { token });
    snapshot.chapters = list(chapters.json);
    snapshot.selectedChapter = snapshot.chapters[0] || null;
    if (snapshot.selectedChapter?.id) {
      const pages = await api(`/pages/chapter/${snapshot.selectedChapter.id}`, { token });
      snapshot.pages = list(pages.json);
      snapshot.selectedPage = snapshot.pages[0] || null;
    }
  }
  return snapshot;
}

async function loginUi(key, account) {
  await page.goto(`${config.frontendUrl}/#/login`, { waitUntil: "domcontentloaded", timeout: config.timeout });
  await page.evaluate(() => { sessionStorage.clear(); localStorage.clear(); });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#login-username").fill(account.email);
  await page.locator("#login-password").fill(config.password);
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/auth/login") && r.request().method() === "POST", { timeout: config.timeout }),
    page.locator('[data-testid="login-submit"]').click()
  ]);
  await page.waitForURL(/#\/dashboard/, { timeout: config.timeout });
  await settle();
}

function enrichedRoutes(key, snapshot) {
  const routes = [...roleRoutes[key]];
  const seriesId = snapshot.selectedSeries?.id;
  const chapterId = snapshot.selectedChapter?.id;
  const pageId = snapshot.selectedPage?.id;
  if (key === "mangaka" && seriesId) routes.push(["Existing Series Detail", `/series/${seriesId}`]);
  if (key === "mangaka" && seriesId) routes.push(["Existing Chapters", `/chapters-pages?seriesId=${seriesId}`]);
  if (key === "mangaka" && seriesId) routes.push(["Existing Manuscripts", `/manuscripts?seriesId=${seriesId}`]);
  if (key === "mangaka" && pageId) routes.push(["Existing Canvas", `/canvas-workspace?seriesId=${seriesId}&chapterId=${chapterId}&pageId=${pageId}`]);
  if (key === "tantou" && seriesId) routes.push(["Assigned Series Review", `/tantou-review?seriesId=${seriesId}`]);
  if (key === "board" && seriesId) routes.push(["Series Vote View", `/board-review?seriesId=${seriesId}`]);
  if (key === "admin" && seriesId) routes.push(["Series Final View", `/admin-review?seriesId=${seriesId}`]);
  return dedupeRoutes(routes);
}

async function auditRoute(key, label, route, snapshot) {
  const visit = {
    role: config.accounts[key].label,
    roleKey: key,
    label,
    route,
    startedAt: new Date().toISOString(),
    issues: [],
    consoleErrors: [],
    pageErrors: [],
    failedResponses: []
  };
  currentVisit = visit;
  const shotName = `${key}-${slug(label)}.png`;
  visit.screenshot = `screenshots/${shotName}`;

  try {
    await page.goto(`${config.frontendUrl}/#${route}`, { waitUntil: "domcontentloaded", timeout: config.timeout });
    await settle();
    await page.screenshot({ path: path.join(shotDir, shotName), fullPage: true });

    const metrics = await page.evaluate(() => {
      const visible = (el) => {
        const s = getComputedStyle(el); const r = el.getBoundingClientRect();
        return s.display !== "none" && s.visibility !== "hidden" && Number(s.opacity) !== 0 && r.width > 0 && r.height > 0;
      };
      const bodyText = (document.body?.innerText || "").replace(/\u00a0/g, " ");
      const imgs = [...document.images].filter(visible).map((img) => ({ src: img.currentSrc || img.src, alt: img.alt, complete: img.complete, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight }));
      const interactives = [...document.querySelectorAll("button,a,[role=button]")].filter(visible).map((el) => (el.innerText || el.getAttribute("aria-label") || el.getAttribute("title") || "").trim()).filter(Boolean);
      const activeNav = [...document.querySelectorAll(".nav-item.active")].filter(visible).map((el) => (el.innerText || "").trim());
      const statCards = [...document.querySelectorAll(".stat-card")].filter(visible).map((el) => {
        const label = el.querySelector("span")?.textContent?.trim() || "";
        const value = el.querySelector("strong")?.textContent?.trim() || "";
        return { label, value };
      });
      const assistantStats = [...document.querySelectorAll(".ast-stat-card")].filter(visible).map((el) => (el.innerText || "").trim());
      const headings = [...document.querySelectorAll("h1,h2,h3")].filter(visible).map((el) => (el.textContent || "").trim()).filter(Boolean);
      const viewportWidth = window.innerWidth;
      const overflow = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0) - viewportWidth;
      const wide = [...document.querySelectorAll("body *")].filter(visible).map((el) => {
        const r = el.getBoundingClientRect(); return { tag: el.tagName, cls: el.className?.toString?.() || "", text: (el.textContent || "").trim().slice(0, 80), right: Math.round(r.right), left: Math.round(r.left), width: Math.round(r.width) };
      }).filter((x) => x.right > viewportWidth + 8 || x.left < -8).sort((a, b) => b.right - a.right).slice(0, 8);
      const kanbanTaskCount = document.querySelectorAll('[data-testid="kanban-task-card"]').length;
      const kanbanDeclaredCount = Number(document.querySelector('[data-testid="kanban-board"]')?.dataset.taskCount || 0);
      return { bodyText, imgs, interactives, activeNav, statCards, assistantStats, headings, overflow, wide, href: location.href, title: document.title, kanbanTaskCount, kanbanDeclaredCount };
    });
    visit.href = metrics.href;
    visit.headings = metrics.headings.slice(0, 12);
    visit.activeNav = metrics.activeNav;
    visit.stats = metrics.statCards;

    const issue = (severity, code, message, detail = "") => {
      const item = { severity, code, message, detail };
      visit.issues.push(item);
      addIssue({ severity, role: visit.role, route, code, message, detail });
    };

    if (/\/login(?:$|[?#])/.test(new URL(metrics.href).hash.replace(/^#/, "")) || metrics.bodyText.includes("Sign in to MangaSystem")) {
      issue("ERROR", "UNEXPECTED_LOGIN_REDIRECT", "Authenticated role was redirected to the login page.");
    }
    if (/Page not found|This review screen is for another role/i.test(metrics.bodyText)) {
      issue("ERROR", "WRONG_ROLE_OR_ROUTE", "The route displays a missing-page or wrong-role message.");
    }
    const suspicious = metrics.bodyText.match(/\bundefined\b|\bNaN\b|\[object Object\]|\$\{[^}]+\}|\{\{[^}]+\}\}/gi) || [];
    if (suspicious.length) issue("ERROR", "RAW_PLACEHOLDER", "Raw placeholder/programming values are visible.", [...new Set(suspicious)].join(", "));
    if (/\bROLE_[A-Z_ ]+\b/.test(metrics.bodyText)) issue("WARNING", "RAW_ROLE_CODE", "A raw backend role code is visible instead of a friendly role label.");
    if (/Ã.|Â.|ï¿½|�/.test(metrics.bodyText)) issue("ERROR", "MOJIBAKE", "Text encoding corruption is visible.", truncate(metrics.bodyText.match(/.{0,25}(?:Ã.|Â.|ï¿½|�).{0,25}/)?.[0] || ""));
    const broken = metrics.imgs.filter((img) => img.complete && img.naturalWidth === 0);
    if (broken.length) issue("ERROR", "BROKEN_IMAGE", `${broken.length} visible image(s) failed to load.`, broken.slice(0, 5).map((x) => x.src).join(" | "));
    if (metrics.overflow > 8) issue("WARNING", "HORIZONTAL_OVERFLOW", `The page is ${metrics.overflow}px wider than the viewport.`, JSON.stringify(metrics.wide));
    if (!metrics.headings.length) issue("WARNING", "MISSING_HEADING", "No visible H1/H2/H3 heading was found.");
    if (metrics.activeNav.length > 1) issue("WARNING", "MULTIPLE_ACTIVE_NAV", "More than one sidebar navigation item is active.", metrics.activeNav.join(" | "));

    const forbidden = forbiddenInteractiveLabels[key] || [];
    const badControls = metrics.interactives.filter((text) => forbidden.some((rx) => rx.test(text)));
    if (badControls.length) issue("WARNING", "CROSS_ROLE_CONTROL", "Controls belonging to another role are visible.", [...new Set(badControls)].join(" | "));

    checkDataSense(key, label, route, metrics, snapshot, issue);

    if (visit.pageErrors.length) issue("ERROR", "PAGE_ERROR", `${visit.pageErrors.length} browser page error(s) occurred.`, visit.pageErrors.join(" | "));
    if (visit.consoleErrors.length) issue("WARNING", "CONSOLE_ERROR", `${visit.consoleErrors.length} console error(s) occurred.`, visit.consoleErrors.slice(0, 5).join(" | "));
    const readOnlyBadRequests = visit.failedResponses.filter((r) => r.status === 400 && r.method === "GET");
    if (readOnlyBadRequests.length) issue("ERROR", "GET_BAD_REQUEST", `${readOnlyBadRequests.length} read-only API request(s) returned HTTP 400.`, readOnlyBadRequests.map((r) => r.url).join(" | "));
    const unexpectedHttp = visit.failedResponses.filter((r) => ![400, 401, 403, 404].includes(r.status));
    if (unexpectedHttp.length) issue("ERROR", "FAILED_HTTP", `${unexpectedHttp.length} API request(s) returned unexpected errors.`, JSON.stringify(unexpectedHttp.slice(0, 8)));
  } catch (error) {
    visit.error = error?.stack || error?.message || String(error);
    addIssue({ severity: "ERROR", role: visit.role, route, code: "AUDIT_ROUTE_FAILED", message: `Could not audit ${label}.`, detail: visit.error });
    try { await page.screenshot({ path: path.join(shotDir, shotName), fullPage: true }); } catch {}
  } finally {
    visit.finishedAt = new Date().toISOString();
    report.pages.push(visit);
    currentVisit = null;
  }
}

function checkDataSense(key, label, route, metrics, snapshot, issue) {
  const text = metrics.bodyText;
  const count = (name) => ({ series: snapshot.series.length, tasks: snapshot.tasks.length, notifications: snapshot.notifications.length, resources: snapshot.resources.length, users: snapshot.users.length, parameters: snapshot.parameters.length }[name]);

  if (route.startsWith("/dashboard")) {
    for (const stat of metrics.statCards) {
      const numeric = Number(String(stat.value).replace(/[^0-9.-]/g, ""));
      if (!Number.isFinite(numeric)) continue;
      const l = stat.label.toLowerCase();
      if ((l === "series" || l === "visible series") && numeric !== count("series")) issue("ERROR", "COUNT_MISMATCH", `Dashboard series count shows ${numeric}, API returned ${count("series")}.`);
      if ((l === "tasks" || l === "my tasks") && numeric !== count("tasks")) issue("ERROR", "COUNT_MISMATCH", `Dashboard task count shows ${numeric}, API returned ${count("tasks")}.`);
      if (l === "unread" && numeric !== count("notifications")) issue("ERROR", "COUNT_MISMATCH", `Dashboard unread count shows ${numeric}, API returned ${count("notifications")}.`);
    }
    if (key === "assistant") {
      const combined = metrics.assistantStats.join(" ");
      const match = combined.match(/Active assignments\s+Today\s+(\d+)\s+tasks/i);
      if (match && Number(match[1]) !== count("tasks")) issue("ERROR", "COUNT_MISMATCH", `Assistant active assignments shows ${match[1]}, API returned ${count("tasks")}.`);
      if (/Deadlines/i.test(text) && /NOW\s+\d+\s+Open tasks/i.test(text)) issue("WARNING", "MISLEADING_DEADLINE_CARD", "The 'Deadlines' card displays task counts as NOW/REV date boxes rather than actual deadline dates.");
    }
    if (key === "admin" && metrics.statCards.some((x) => x.label === "Control" && x.value === "✓")) issue("WARNING", "NON_DATA_KPI", "Admin dashboard uses a checkmark as a KPI ('Control ✓'), which does not communicate useful current data.");
    if (count("series") > 0 && /No series found|Không có series nào/i.test(text)) issue("ERROR", "FALSE_EMPTY_STATE", `Dashboard says there are no series, but the API returned ${count("series")}.`);
    if (key === "board") {
      const expected = snapshot.series.filter((item) => String(item.status || "").toUpperCase() === "REVIEWING").length;
      const stat = metrics.statCards.find((item) => item.label.toLowerCase() === "reviewing");
      if (stat && Number(stat.value) !== expected) issue("ERROR", "BOARD_QUEUE_MISMATCH", `Editorial Board dashboard shows ${stat.value} reviewing, but the voting queue has ${expected}.`);
    }
    if (key === "tantou") {
      const expected = snapshot.reviewChapters.length;
      const stat = metrics.statCards.find((item) => item.label.toLowerCase() === "chapter reviews");
      if (stat && Number(stat.value) !== expected) issue("ERROR", "TANTOU_QUEUE_MISMATCH", `Tantou dashboard shows ${stat.value} chapter reviews, but the review API returned ${expected}.`);
    }
  }

  if (route === "/series" && count("series") > 0 && /No series found|No series yet|Không có series/i.test(text)) issue("ERROR", "FALSE_EMPTY_STATE", `Series screen is empty, but the API returned ${count("series")} series.`);
  if (route.startsWith("/tasks") && count("tasks") > 0) {
    if (route.includes("tab=kanban") && metrics.kanbanTaskCount !== count("tasks")) issue("ERROR", "TASK_RENDER_MISMATCH", `Kanban rendered ${metrics.kanbanTaskCount} task cards, but the API returned ${count("tasks")} tasks.`);
    if (route.includes("tab=assignments") && /No assignments yet|Nothing assigned/i.test(text)) issue("ERROR", "FALSE_EMPTY_STATE", `Assignments screen is empty, but the API returned ${count("tasks")} tasks.`);
  }
  if (route === "/resources" && count("resources") > 0 && /No resources|No assets/i.test(text)) issue("ERROR", "FALSE_EMPTY_STATE", `Resource screen is empty, but the API returned ${count("resources")} resources.`);
  if (route === "/admin/users" && count("users") > 0 && /No users/i.test(text)) issue("ERROR", "FALSE_EMPTY_STATE", `Admin user screen is empty, but the API returned ${count("users")} users.`);
  if (route === "/admin/system" && count("parameters") > 0 && /No parameters|No settings/i.test(text)) issue("ERROR", "FALSE_EMPTY_STATE", `System settings screen is empty, but the API returned ${count("parameters")} parameters.`);

  if (key !== "mangaka" && metrics.interactives.some((x) => /^Assets$/i.test(x)) && !roleRoutes[key].some(([, r]) => r === "/resources")) {
    issue("WARNING", "ORPHAN_TOPBAR_LINK", "The top bar shows 'Assets' even though this role has no Assets/Resources item in its sidebar.");
  }
  if (["board", "admin"].includes(key) && metrics.interactives.some((x) => /^Workflow$/i.test(x))) {
    issue("WARNING", "GENERIC_TOPBAR_LABEL", "The top bar shows a generic 'Workflow' control that is not role-specific.");
  }
  if (key === "board" && metrics.interactives.some((x) => /^Settings$/i.test(x)) && route !== "/profile") {
    issue("WARNING", "MISLABELED_PROFILE_NAV", "Editorial Board sidebar labels the profile page as 'Settings', while the footer separately labels it 'Profile'.");
  }
}

async function settle() {
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 7000 }).catch(() => {});
  await page.waitForTimeout(config.settleMs);
}

async function backendReachable() {
  try {
    const r = await fetch(`${config.backendUrl}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "__health__", password: "__health__" }) });
    return [200, 400, 401].includes(r.status);
  } catch { return false; }
}

async function startBackendIfNeeded() {
  if (await backendReachable()) return;
  if (!config.backendJar) throw new Error(`Backend is not reachable at ${config.backendUrl}. Start the latest fixed JAR or pass --jar=<path>.`);
  const jar = path.resolve(config.backendJar);
  if (!fs.existsSync(jar)) throw new Error(`Backend JAR does not exist: ${jar}`);
  backendProcess = spawn("java", ["-jar", jar], { cwd: path.dirname(jar), stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  pipe(backendProcess, "backend");
  await waitUntil(backendReachable, 120_000, "backend");
}

async function startFrontend() {
  const vite = path.join(cwd, "node_modules", "vite", "bin", "vite.js");
  if (!fs.existsSync(vite)) throw new Error("Vite is not installed. Run npm install first.");
  const u = new URL(config.frontendUrl);
  frontendProcess = spawn(process.execPath, [vite, "--host", u.hostname, "--port", u.port || "5173", "--strictPort"], {
    cwd,
    env: { ...process.env, VITE_API_BASE_URL: config.backendUrl, VITE_WS_BASE_URL: config.wsUrl },
    stdio: ["ignore", "pipe", "pipe"], windowsHide: true
  });
  pipe(frontendProcess, "frontend");
  await waitUntil(async () => { try { return (await fetch(config.frontendUrl)).ok; } catch { return false; } }, 60_000, "frontend");
}

async function main() {
  try {
    await startBackendIfNeeded();
    for (const key of Object.keys(config.accounts)) {
      const account = await loginApi(key);
      const snapshot = await collectRoleData(key, account);
      report.roles[key] = { account: { id: account.id, email: account.email, username: account.username, role: account.role }, data: snapshot };
    }

    await startFrontend();
    const executablePath = findBrowser(config.browserPath);
    browser = await chromium.launch({ executablePath, headless: !config.headed, args: ["--disable-dev-shm-usage", "--no-sandbox"] });
    context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    page = await context.newPage();
    page.setDefaultTimeout(config.timeout);
    page.on("pageerror", (error) => {
      report.pageErrors.push({ role: currentVisit?.role || "SYSTEM", route: currentVisit?.route || "", message: error.message });
      if (currentVisit) currentVisit.pageErrors.push(error.message);
    });
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const item = { role: currentVisit?.role || "SYSTEM", route: currentVisit?.route || "", message: message.text() };
      report.consoleErrors.push(item); if (currentVisit) currentVisit.consoleErrors.push(message.text());
    });
    page.on("response", (response) => {
      if (!response.url().startsWith(config.backendUrl) || response.status() < 400) return;
      const item = { role: currentVisit?.role || "SYSTEM", route: currentVisit?.route || "", method: response.request().method(), status: response.status(), url: response.url() };
      report.failedResponses.push(item); if (currentVisit) currentVisit.failedResponses.push(item);
    });

    for (const key of Object.keys(config.accounts)) {
      const account = report.roles[key].account;
      // API login response token is intentionally not written to report. Login again through UI.
      await loginUi(key, { email: account.email });
      const snapshot = report.roles[key].data;
      for (const [label, route] of enrichedRoutes(key, snapshot)) await auditRoute(key, label, route, snapshot);
    }

    const errors = report.issues.filter((x) => x.severity === "ERROR").length;
    report.result = errors ? "FAIL" : "PASS_WITH_WARNINGS";
  } catch (error) {
    report.result = "FAILED_TO_RUN";
    report.fatalError = error?.stack || error?.message || String(error);
    process.exitCode = 1;
  } finally {
    report.finishedAt = new Date().toISOString();
    report.summary = {
      rolesAudited: Object.keys(report.roles).length,
      pagesAudited: report.pages.length,
      errors: report.issues.filter((x) => x.severity === "ERROR").length,
      warnings: report.issues.filter((x) => x.severity === "WARNING").length,
      pageErrors: report.pageErrors.length,
      consoleErrors: report.consoleErrors.length,
      failedResponses: report.failedResponses.length
    };
    fs.writeFileSync(path.join(outputDir, "display-audit.json"), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join(outputDir, "display-issues.csv"), issuesCsv(report.issues));
    fs.writeFileSync(path.join(outputDir, "current-data-snapshot.json"), JSON.stringify(safeSnapshot(report.roles), null, 2));
    fs.writeFileSync(path.join(outputDir, "display-audit.html"), htmlReport(report));
    if (context) { try { await context.tracing.stop({ path: path.join(outputDir, "trace.zip") }); } catch {} }
    if (browser) await browser.close().catch(() => {});
    await stop(frontendProcess); await stop(backendProcess);

    console.log("\nSWP REAL-DATA ROLE DISPLAY AUDIT");
    console.table(report.issues.map((x) => ({ Severity: x.severity, Role: x.role, Route: x.route, Issue: x.message })).slice(0, 80));
    console.log(`Roles audited: ${report.summary.rolesAudited}`);
    console.log(`Pages audited: ${report.summary.pagesAudited}`);
    console.log(`Display errors: ${report.summary.errors}`);
    console.log(`Display warnings: ${report.summary.warnings}`);
    console.log(`Report: ${path.join(outputDir, "display-audit.html")}`);
    if (report.result === "FAILED_TO_RUN") console.error(report.fatalError);
  }
}

function safeSnapshot(roles) {
  const out = {};
  for (const [key, value] of Object.entries(roles)) {
    out[key] = {
      account: value.account,
      data: {
        profile: value.data.profile,
        series: value.data.series,
        tasks: value.data.tasks,
        notifications: value.data.notifications,
        resources: value.data.resources,
        users: value.data.users,
        parameters: value.data.parameters,
        chapters: value.data.chapters,
        pages: value.data.pages
      }
    };
  }
  return out;
}

function htmlReport(r) {
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const issueRows = r.issues.map((x) => `<tr class="${x.severity.toLowerCase()}"><td>${esc(x.severity)}</td><td>${esc(x.role)}</td><td>${esc(x.route)}</td><td>${esc(x.message)}</td><td>${esc(x.detail)}</td></tr>`).join("");
  const pageCards = r.pages.map((p) => `<article><h3>${esc(p.role)} — ${esc(p.label)}</h3><p><code>${esc(p.route)}</code></p><a href="${esc(p.screenshot)}"><img src="${esc(p.screenshot)}" alt="${esc(p.role)} ${esc(p.label)}"></a><p>${p.issues.length} issue(s)</p></article>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>SWP Role Display Audit ${esc(r.runId)}</title><style>body{font-family:Arial,sans-serif;margin:28px;color:#1f2937}h1{margin-bottom:4px}.summary{display:flex;gap:14px;flex-wrap:wrap;margin:20px 0}.pill{padding:10px 14px;border:1px solid #ddd;border-radius:10px}table{border-collapse:collapse;width:100%;font-size:13px}th,td{border:1px solid #ddd;padding:8px;vertical-align:top}th{background:#f4f4f4}.error{background:#fee2e2}.warning{background:#fef3c7}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:18px;margin-top:24px}article{border:1px solid #ddd;border-radius:12px;padding:12px}article img{width:100%;max-height:420px;object-fit:contain;background:#f8fafc;border:1px solid #eee}code{word-break:break-all}</style></head><body><h1>SWP real-data role display audit</h1><p>Run ${esc(r.runId)} · read-only · ${esc(r.backendUrl)}</p><div class="summary"><div class="pill">Roles: <b>${r.summary.rolesAudited}</b></div><div class="pill">Pages: <b>${r.summary.pagesAudited}</b></div><div class="pill">Errors: <b>${r.summary.errors}</b></div><div class="pill">Warnings: <b>${r.summary.warnings}</b></div></div><h2>Issues</h2><table><thead><tr><th>Severity</th><th>Role</th><th>Route</th><th>Issue</th><th>Detail</th></tr></thead><tbody>${issueRows || '<tr><td colspan="5">No issues detected.</td></tr>'}</tbody></table><h2>Screenshots</h2><div class="grid">${pageCards}</div></body></html>`;
}

function issuesCsv(items) {
  const cols = ["severity", "role", "route", "code", "message", "detail"];
  return [cols.join(","), ...items.map((x) => cols.map((k) => csv(x[k])).join(","))].join(os.EOL);
}
function csv(v) { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s; }
function dedupeRoutes(routes) { const seen = new Set(); return routes.filter(([, r]) => { if (seen.has(r)) return false; seen.add(r); return true; }); }
function parseArgs(values) { const x = {}; for (const v of values) { if (v === "--headed") x.headed = true; else if (v.startsWith("--backend=")) x.backend = v.slice(10); else if (v.startsWith("--frontend=")) x.frontend = v.slice(11); else if (v.startsWith("--browser=")) x.browser = v.slice(10); else if (v.startsWith("--jar=")) x.jar = v.slice(6); } return x; }
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const line = raw.trim(); if (!line || line.startsWith("#")) continue; const i = line.indexOf("="); if (i < 1) continue; const k = line.slice(0, i).trim(); let v = line.slice(i + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (process.env[k] === undefined) process.env[k] = v; } }
function findBrowser(explicit) { const c = [explicit, process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome", path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"), path.join(process.env.PROGRAMFILES || "", "Google", "Chrome", "Application", "chrome.exe"), path.join(process.env["PROGRAMFILES(X86)"] || "", "Google", "Chrome", "Application", "chrome.exe"), path.join(process.env.PROGRAMFILES || "", "Microsoft", "Edge", "Application", "msedge.exe"), path.join(process.env["PROGRAMFILES(X86)"] || "", "Microsoft", "Edge", "Application", "msedge.exe")].filter(Boolean); const f = c.find(fs.existsSync); if (!f) throw new Error("Chrome, Edge, or Chromium not found. Set E2E_BROWSER_PATH."); return f; }
function pipe(child, name) { child.stdout?.on("data", (c) => process.stdout.write(`[${name}] ${c}`)); child.stderr?.on("data", (c) => process.stderr.write(`[${name}] ${c}`)); }
async function stop(child) { if (!child || child.killed) return; child.kill("SIGTERM"); await new Promise((resolve) => { const t = setTimeout(resolve, 2500); child.once("exit", () => { clearTimeout(t); resolve(); }); }); }
async function waitUntil(fn, timeout, label) { const end = Date.now() + timeout; while (Date.now() < end) { try { if (await fn()) return; } catch {} await new Promise((r) => setTimeout(r, 800)); } throw new Error(`Timed out waiting for ${label}`); }
function stripSlash(v) { return String(v || "").replace(/\/+$/, ""); }
function slug(v) { return String(v).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70); }
function stamp() { const d = new Date(), p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; }
function truncate(v, n = 240) { const s = String(v || "").replace(/\s+/g, " "); return s.length > n ? `${s.slice(0,n)}...` : s; }

await main();
