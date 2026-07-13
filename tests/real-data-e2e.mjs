import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright-core";

const cwd = process.cwd();
loadEnvFile(path.join(cwd, ".env.e2e.local"));
loadEnvFile(path.join(cwd, ".env.e2e"));

const args = parseArgs(process.argv.slice(2));
const runId = timestamp();
const finalDecision = String(args.final || process.env.E2E_FINAL_DECISION || "approve").toLowerCase();
if (!["approve", "reject"].includes(finalDecision)) throw new Error("--final must be approve or reject");

const config = {
  backendUrl: stripSlash(args.backend || process.env.E2E_BACKEND_URL || "http://localhost:8080/api/v1"),
  frontendUrl: stripSlash(args.frontend || process.env.E2E_FRONTEND_URL || "http://localhost:5173"),
  wsUrl: stripSlash(process.env.E2E_WS_URL || "http://localhost:8080/ws"),
  password: process.env.E2E_PASSWORD || "123456",
  headed: args.headed === true || String(process.env.E2E_HEADLESS || "true").toLowerCase() === "false",
  slowMo: Number(process.env.E2E_SLOW_MO_MS || 0),
  timeout: Number(process.env.E2E_TIMEOUT_MS || 45_000),
  uploadTimeout: Number(process.env.E2E_UPLOAD_TIMEOUT_MS || 120_000),
  browserPath: args.browser || process.env.E2E_BROWSER_PATH || "",
  backendJar: args.jar || process.env.E2E_BACKEND_JAR || "",
  keepOnFailure: args.keep === true || String(process.env.E2E_KEEP_ON_FAILURE || "true").toLowerCase() === "true",
  accounts: {
    mangaka: process.env.E2E_MANGAKA_EMAIL || "HuyMangaka@gmail.com",
    assistant: process.env.E2E_ASSISTANT_EMAIL || "HuyAssistant@gmail.com",
    tantou: process.env.E2E_TANTOU_EMAIL || "HuyTantou@gmail.com",
    board: process.env.E2E_BOARD_EMAIL || "HuyBoard1@gmail.com",
    admin: process.env.E2E_ADMIN_EMAIL || "admin@studio.com"
  }
};

const outputDir = path.resolve(cwd, "e2e-results", runId);
const screenshotDir = path.join(outputDir, "screenshots");
fs.mkdirSync(screenshotDir, { recursive: true });

const state = {
  runId,
  finalDecision,
  backendUrl: config.backendUrl,
  frontendUrl: config.frontendUrl,
  seriesTitle: `UI_E2E_${runId}`,
  chapterTitle: `UI E2E Chapter ${runId}`,
  taskDescription: `UI E2E assistant task ${runId}`,
  feedbackContent: `UI E2E Tantou feedback ${runId}`,
  seriesId: null,
  chapterId: null,
  pageId: null,
  hitboxId: null,
  taskId: null,
  feedbackId: null,
  voteId: null,
  finalStatus: null,
  retained: finalDecision === "approve"
};

const report = {
  runId,
  startedAt: new Date().toISOString(),
  config: {
    backendUrl: config.backendUrl,
    frontendUrl: config.frontendUrl,
    finalDecision,
    headed: config.headed,
    accounts: config.accounts
  },
  steps: [],
  pageErrors: [],
  consoleErrors: [],
  failedResponses: [],
  passwordLeaks: [],
  state,
  result: "RUNNING"
};

let backendProcess = null;
let frontendProcess = null;
let browser = null;
let context = null;
let page = null;
let accounts = {};
let imagePath = "";

function log(message) {
  console.log(`[real-e2e] ${message}`);
}

async function step(name, fn) {
  const item = { name, startedAt: new Date().toISOString(), result: "RUNNING", detail: "" };
  report.steps.push(item);
  const start = Date.now();
  log(`START ${name}`);
  try {
    const value = await fn();
    item.result = "PASS";
    item.durationMs = Date.now() - start;
    item.finishedAt = new Date().toISOString();
    log(`PASS  ${name} (${item.durationMs} ms)`);
    return value;
  } catch (error) {
    item.result = "FAIL";
    item.durationMs = Date.now() - start;
    item.finishedAt = new Date().toISOString();
    item.detail = error?.stack || error?.message || String(error);
    log(`FAIL  ${name}: ${error?.message || error}`);
    if (page) {
      try {
        await page.screenshot({ path: path.join(screenshotDir, `${String(report.steps.length).padStart(2, "0")}-${slug(name)}.png`), fullPage: true });
      } catch {}
    }
    throw error;
  }
}

async function apiRequest(pathname, { method = "GET", token = "", body = undefined } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let requestBody = body;
  if (body !== undefined && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json; charset=utf-8";
    requestBody = JSON.stringify(body);
  }
  const response = await fetch(`${config.backendUrl}${pathname}`, { method, headers, body: requestBody });
  const text = await response.text();
  let json = null;
  if (text) {
    try { json = JSON.parse(text); } catch { json = text; }
  }
  scanForSecrets(`API ${method} ${pathname}`, text);
  return { status: response.status, ok: response.ok, text, json };
}

async function loginApi(key, email, expectedRole) {
  const response = await apiRequest("/auth/login", {
    method: "POST",
    body: { username: email, password: config.password }
  });
  assert.equal(response.status, 200, `${key} login returned ${response.status}: ${truncate(response.text)}`);
  assert.ok(response.json?.token, `${key} login did not return a token`);
  assert.equal(response.json?.role, expectedRole, `${key} returned role ${response.json?.role}, expected ${expectedRole}`);
  accounts[key] = { ...response.json, email, expectedRole };
  return accounts[key];
}

async function loginUi(key) {
  const account = accounts[key];
  assert.ok(account, `No API preflight account for ${key}`);
  await page.goto(`${config.frontendUrl}/#/login`, { waitUntil: "domcontentloaded", timeout: config.timeout });
  await page.evaluate(() => { sessionStorage.clear(); localStorage.clear(); });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator('[data-testid="login-form"]').waitFor({ state: "visible", timeout: config.timeout });
  await page.locator("#login-username").fill(account.email);
  await page.locator("#login-password").fill(config.password);
  const responsePromise = page.waitForResponse((response) => response.url().includes("/auth/login") && response.request().method() === "POST", { timeout: config.timeout });
  await page.locator('[data-testid="login-submit"]').click();
  const response = await responsePromise;
  assert.equal(response.status(), 200, `${key} UI login returned ${response.status()}`);
  const body = await response.text();
  scanForSecrets(`UI login ${key}`, body);
  await page.waitForURL(/#\/dashboard/, { timeout: config.timeout });
  await page.getByText("Dashboard", { exact: false }).first().waitFor({ state: "visible", timeout: config.timeout });
}

async function waitJsonResponse(predicate, action, timeout = config.timeout) {
  const responsePromise = page.waitForResponse((response) => {
    try { return predicate(response); } catch { return false; }
  }, { timeout });
  await action();
  const response = await responsePromise;
  const text = await response.text();
  scanForSecrets(`${response.request().method()} ${response.url()}`, text);
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { response, status: response.status(), text, json };
}

function isApiResponse(response, method, suffix) {
  return response.request().method() === method && new URL(response.url()).pathname.endsWith(suffix);
}

async function waitForOption(locator, value) {
  await locator.locator(`option[value="${String(value)}"]`).waitFor({ state: "attached", timeout: config.timeout });
}

async function screenshot(name) {
  await page.screenshot({ path: path.join(screenshotDir, `${slug(name)}.png`), fullPage: true });
}

function scanForSecrets(source, text) {
  const value = String(text || "");
  if (/"passwordHash"\s*:/i.test(value) || /\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/.test(value)) {
    report.passwordLeaks.push({ source, sample: truncate(value, 300) });
  }
}

async function startBackendIfNeeded() {
  if (await backendReachable()) return;
  if (!config.backendJar) {
    throw new Error(`Backend is not reachable at ${config.backendUrl}. Start the fixed JAR or set E2E_BACKEND_JAR.`);
  }
  const jar = path.resolve(config.backendJar);
  if (!fs.existsSync(jar)) throw new Error(`E2E_BACKEND_JAR not found: ${jar}`);
  log(`Starting backend JAR: ${jar}`);
  backendProcess = spawn("java", ["-jar", jar], { cwd: path.dirname(jar), stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  pipeChild(backendProcess, "backend");
  await waitUntil(backendReachable, 120_000, "backend login endpoint");
}

async function backendReachable() {
  try {
    const response = await fetch(`${config.backendUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "__healthcheck__", password: "__healthcheck__" })
    });
    return [200, 400, 401].includes(response.status);
  } catch {
    return false;
  }
}

async function startFrontend() {
  const url = new URL(config.frontendUrl);
  const viteBin = path.join(cwd, "node_modules", "vite", "bin", "vite.js");
  if (!fs.existsSync(viteBin)) throw new Error("Vite is not installed. Run npm install first.");
  const host = url.hostname;
  const port = url.port || (url.protocol === "https:" ? "443" : "80");
  log(`Starting Vite at ${config.frontendUrl} -> ${config.backendUrl}`);
  frontendProcess = spawn(process.execPath, [viteBin, "--host", host, "--port", port, "--strictPort"], {
    cwd,
    env: {
      ...process.env,
      VITE_API_BASE_URL: config.backendUrl,
      VITE_WS_BASE_URL: config.wsUrl
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  pipeChild(frontendProcess, "frontend");
  await waitUntil(async () => {
    try { return (await fetch(config.frontendUrl)).ok; } catch { return false; }
  }, 60_000, "Vite frontend");
}

async function cleanupRejectedRun() {
  if (!state.seriesId) return;
  const mangakaToken = accounts.mangaka?.token;
  const adminToken = accounts.admin?.token;
  try {
    const current = await apiRequest(`/manga-series/${state.seriesId}`, { token: mangakaToken });
    const status = String(current.json?.status || "").toUpperCase();
    if (status === "REVIEWING") {
      await apiRequest(`/manga-series/${state.seriesId}/admin-decision?isApproved=false`, { method: "PATCH", token: adminToken });
    }
    const afterDecision = await apiRequest(`/manga-series/${state.seriesId}`, { token: mangakaToken });
    if (String(afterDecision.json?.status || "").toUpperCase() === "REJECTED") {
      await apiRequest(`/manga-series/${state.seriesId}/status?newStatus=DRAFT`, { method: "PATCH", token: mangakaToken });
    }
    if (state.hitboxId) await apiRequest(`/workspace/hitboxes/${state.hitboxId}`, { method: "DELETE", token: mangakaToken });
    if (state.pageId) await apiRequest(`/pages/${state.pageId}`, { method: "DELETE", token: mangakaToken });
    if (state.chapterId) await apiRequest(`/chapters/${state.chapterId}`, { method: "DELETE", token: mangakaToken });
    const removed = await apiRequest(`/manga-series/${state.seriesId}`, { method: "DELETE", token: mangakaToken });
    state.retained = !(removed.status === 200 || removed.status === 204);
    state.cleanupStatus = removed.status;
  } catch (error) {
    state.retained = true;
    state.cleanupError = error?.message || String(error);
  }
}

async function main() {
  try {
    await step("Backend is reachable", startBackendIfNeeded);
    await step("Real role-account login preflight", async () => {
      await loginApi("mangaka", config.accounts.mangaka, "ROLE_MANGAKA");
      await loginApi("assistant", config.accounts.assistant, "ROLE_ASSISTANT");
      await loginApi("tantou", config.accounts.tantou, "ROLE_TANTOU EDITOR");
      await loginApi("board", config.accounts.board, "ROLE_EDITORIAL BOARD");
      await loginApi("admin", config.accounts.admin, "ROLE_ADMIN");
    });

    await step("Start real frontend", startFrontend);
    const executablePath = findBrowserExecutable(config.browserPath);
    log(`Using browser: ${executablePath}`);
    browser = await chromium.launch({ executablePath, headless: !config.headed, slowMo: config.slowMo, args: ["--disable-dev-shm-usage", "--no-sandbox"] });
    context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    page = await context.newPage();
    page.setDefaultTimeout(config.timeout);
    page.on("pageerror", (error) => report.pageErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") report.consoleErrors.push(message.text());
    });
    page.on("response", async (response) => {
      if (!response.url().startsWith(config.backendUrl)) return;
      if (response.status() >= 400) report.failedResponses.push({ method: response.request().method(), status: response.status(), url: response.url() });
      const contentType = response.headers()["content-type"] || "";
      if (contentType.includes("json")) {
        try { scanForSecrets(`Browser response ${response.url()}`, await response.text()); } catch {}
      }
    });

    imagePath = createTestPng(outputDir, runId);

    await step("Mangaka logs in through React UI", () => loginUi("mangaka"));

    await step("Mangaka creates a real series through the wizard", async () => {
      await page.goto(`${config.frontendUrl}/#/series`, { waitUntil: "domcontentloaded" });
      await page.locator('[data-testid="series-create-form"]').waitFor();
      await page.locator("#series-title").fill(state.seriesTitle);
      await page.locator("#series-genre").selectOption("Action");
      await page.locator('[data-testid="series-wizard-continue"]').click();
      await page.locator("#series-summary").fill(`Real UI automation summary ${runId}`);
      await page.locator("#series-description").fill(`Created by Playwright against live Supabase and backend services at ${runId}.`);
      await page.locator('[data-testid="series-wizard-continue"]').click();
      const result = await waitJsonResponse(
        (response) => isApiResponse(response, "POST", "/api/v1/manga-series"),
        () => page.locator('[data-testid="series-create-submit"]').click(),
        config.uploadTimeout
      );
      assert.equal(result.status, 201, `Create series returned ${result.status}: ${truncate(result.text)}`);
      state.seriesId = result.json?.id;
      assert.ok(state.seriesId, "Create series did not return id");
      assert.equal(String(result.json?.status).toUpperCase(), "DRAFT");
      await page.locator(`[data-testid="series-card-${state.seriesId}"]`).waitFor({ timeout: config.timeout });
      await screenshot("01-series-created");
    });

    await step("Mangaka creates chapter and uploads a real Cloudinary page", async () => {
      await page.goto(`${config.frontendUrl}/#/chapters-pages?seriesId=${state.seriesId}`, { waitUntil: "domcontentloaded" });
      const seriesSelect = page.locator('[data-testid="chapter-series-select"]');
      await waitForOption(seriesSelect, state.seriesId);
      await seriesSelect.selectOption(String(state.seriesId));
      await page.locator('[data-testid="chapter-number-input"]').fill("1");
      await page.locator('[data-testid="chapter-title-input"]').fill(state.chapterTitle);
      const chapterResult = await waitJsonResponse(
        (response) => isApiResponse(response, "POST", "/api/v1/chapters"),
        () => page.locator('[data-testid="chapter-create-submit"]').click()
      );
      assert.equal(chapterResult.status, 201, `Create chapter returned ${chapterResult.status}: ${truncate(chapterResult.text)}`);
      state.chapterId = chapterResult.json?.id;
      assert.ok(state.chapterId, "Create chapter did not return id");

      const chapterSelect = page.locator('[data-testid="page-chapter-select"]');
      await waitForOption(chapterSelect, state.chapterId);
      await chapterSelect.selectOption(String(state.chapterId));
      const uploadResultPromise = page.waitForResponse((response) => isApiResponse(response, "POST", `/api/v1/pages/chapter/${state.chapterId}`), { timeout: config.uploadTimeout });
      await page.locator('[data-testid="page-upload-input"]').setInputFiles(imagePath);
      const uploadResponse = await uploadResultPromise;
      const uploadText = await uploadResponse.text();
      scanForSecrets("Page upload", uploadText);
      assert.equal(uploadResponse.status(), 201, `Page upload returned ${uploadResponse.status()}: ${truncate(uploadText)}`);
      const uploaded = JSON.parse(uploadText);
      state.pageId = uploaded?.id;
      assert.ok(state.pageId, "Page upload did not return id");
      assert.ok(uploaded?.imageUrl || uploaded?.image_url, "Page upload did not return Cloudinary image URL");
      await page.locator(`[data-testid="page-card-${state.pageId}"]`).waitFor({ timeout: config.uploadTimeout });
      await screenshot("02-page-uploaded");
    });

    await step("Mangaka draws a real hitbox and assigns a real Assistant", async () => {
      await page.goto(`${config.frontendUrl}/#/canvas-workspace?seriesId=${state.seriesId}&chapterId=${state.chapterId}&pageId=${state.pageId}`, { waitUntil: "domcontentloaded" });
      const surface = page.locator('[data-testid="canvas-draw-surface"]');
      await surface.waitFor({ state: "visible", timeout: config.uploadTimeout });
      await page.locator('[data-testid="canvas-draw-surface"] img').waitFor({ state: "visible", timeout: config.uploadTimeout });
      await page.waitForFunction(() => document.querySelector('[data-testid="canvas-draw-surface"]')?.classList.contains("ready"), null, { timeout: config.uploadTimeout });
      const box = await surface.boundingBox();
      assert.ok(box && box.width > 100 && box.height > 100, "Canvas surface has invalid dimensions");
      const hitboxResponsePromise = page.waitForResponse((response) => isApiResponse(response, "POST", `/api/v1/workspace/pages/${state.pageId}/hitboxes`), { timeout: config.timeout });
      await page.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.15);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.48, box.y + box.height * 0.42, { steps: 12 });
      await page.mouse.up();
      const hitboxResponse = await hitboxResponsePromise;
      const hitboxText = await hitboxResponse.text();
      scanForSecrets("Hitbox create", hitboxText);
      assert.equal(hitboxResponse.status(), 201, `Hitbox create returned ${hitboxResponse.status()}: ${truncate(hitboxText)}`);
      const hitbox = JSON.parse(hitboxText);
      state.hitboxId = hitbox?.id;
      assert.ok(state.hitboxId, "Hitbox create did not return id");
      await page.locator(`[data-testid="saved-hitbox-${state.hitboxId}"]`).waitFor();
      await page.locator('[data-testid="open-task-modal"]').click();
      await page.locator('[data-testid="task-assignment-modal"]').waitFor();
      await page.locator('[data-testid="task-assistant-select"]').selectOption(String(accounts.assistant.id));
      await page.locator('[data-testid="task-description-input"]').fill(state.taskDescription);
      const taskPromise = page.waitForResponse((response) => isApiResponse(response, "POST", `/api/v1/workspace/hitboxes/${state.hitboxId}/task`), { timeout: config.timeout });
      const assignPromise = page.waitForResponse((response) => response.request().method() === "PATCH" && new URL(response.url()).pathname.endsWith("/assign"), { timeout: config.timeout });
      await page.locator('[data-testid="task-create-submit"]').click();
      const taskResponse = await taskPromise;
      const taskText = await taskResponse.text();
      scanForSecrets("Task create", taskText);
      assert.equal(taskResponse.status(), 201, `Task create returned ${taskResponse.status()}: ${truncate(taskText)}`);
      const task = JSON.parse(taskText);
      state.taskId = task?.id;
      assert.ok(state.taskId, "Task create did not return id");
      const assignResponse = await assignPromise;
      assert.equal(assignResponse.status(), 200, `Task assignment returned ${assignResponse.status()}`);
      await page.getByText("Task created and assigned", { exact: false }).waitFor();
      await screenshot("03-task-assigned");
    });

    await step("Assistant moves task to Doing and submits a real image", async () => {
      await loginUi("assistant");
      await page.goto(`${config.frontendUrl}/#/tasks?tab=assignments`, { waitUntil: "domcontentloaded" });
      const taskItem = page.locator(`[data-testid="assignment-task-${state.taskId}"]`);
      await taskItem.waitFor({ state: "visible", timeout: config.timeout });
      await taskItem.click();
      const doingResult = await waitJsonResponse(
        (response) => response.request().method() === "PATCH" && new URL(response.url()).pathname.endsWith(`/tasks/${state.taskId}/status`) && response.url().includes("newStatus=DOING"),
        () => page.locator('[data-testid="task-status-doing"]').click()
      );
      assert.equal(doingResult.status, 200, `Move task to DOING returned ${doingResult.status}: ${truncate(doingResult.text)}`);
      await page.locator('[data-testid="assistant-work-file"]').setInputFiles(imagePath);
      await page.locator('[data-testid="assistant-work-confirm"]').check();
      const resourcePromise = page.waitForResponse((response) => isApiResponse(response, "POST", "/api/v1/resources/upload"), { timeout: config.uploadTimeout });
      const submitPromise = page.waitForResponse((response) => response.request().method() === "PATCH" && new URL(response.url()).pathname.endsWith(`/tasks/${state.taskId}/submit`), { timeout: config.uploadTimeout });
      await page.locator('[data-testid="assistant-work-submit"]').click();
      const resourceResponse = await resourcePromise;
      assert.equal(resourceResponse.status(), 201, `Submission upload returned ${resourceResponse.status()}`);
      const submitResponse = await submitPromise;
      const submitText = await submitResponse.text();
      scanForSecrets("Assistant submit", submitText);
      assert.equal(submitResponse.status(), 200, `Assistant submit returned ${submitResponse.status()}: ${truncate(submitText)}`);
      const submitted = JSON.parse(submitText);
      assert.equal(String(submitted?.status).toUpperCase(), "REVIEWING");
      await page.getByText("Submitted for review", { exact: false }).first().waitFor();
      await screenshot("04-assistant-submitted");
    });

    await step("Mangaka approves the real Assistant submission", async () => {
      await loginUi("mangaka");
      await page.goto(`${config.frontendUrl}/#/assistant-review`, { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: /Assistant Submissions/ }).click();
      const row = page.locator(`[data-testid="assistant-review-task-${state.taskId}"]`);
      await row.waitFor({ state: "visible", timeout: config.timeout });
      const taskApprovePromise = page.waitForResponse((response) => response.request().method() === "PATCH" && new URL(response.url()).pathname.endsWith(`/tasks/${state.taskId}/review`) && response.url().includes("approved=true"), { timeout: config.timeout });
      await row.locator('[data-testid="approve-assistant-work"]').click();
      const taskApproveResponse = await taskApprovePromise;
      assert.equal(taskApproveResponse.status(), 200, `Mangaka task approval returned ${taskApproveResponse.status()}`);
      await page.locator(`[data-testid="assistant-work-approved-${state.taskId}"]`).waitFor({ state: "visible", timeout: config.timeout });

      await page.locator(`[data-testid="inline-chapter-handoff-${state.chapterId}"]`).waitFor({ state: "visible", timeout: config.timeout });
      await page.locator(`[data-testid="inline-chapter-tantou-select-${state.seriesId}"]`).selectOption(String(accounts.tantou.id));
      const assignPromise = page.waitForResponse((response) => response.request().method() === "PATCH" && new URL(response.url()).pathname.endsWith(`/manga-series/${state.seriesId}/tantou`) && response.url().includes(`tantouId=${accounts.tantou.id}`), { timeout: config.timeout });
      const chapterReviewPromise = page.waitForResponse((response) => response.request().method() === "PATCH" && new URL(response.url()).pathname.endsWith(`/chapters/${state.chapterId}/status`) && response.url().includes("newStatus=REVIEWING"), { timeout: config.timeout });
      await page.locator(`[data-testid="inline-assign-and-send-chapter-${state.chapterId}"]`).click();
      const assignResponse = await assignPromise;
      assert.equal(assignResponse.status(), 200, `Tantou assignment returned ${assignResponse.status()}`);
      const chapterReviewResponse = await chapterReviewPromise;
      assert.equal(chapterReviewResponse.status(), 200, `Chapter review transition returned ${chapterReviewResponse.status()}`);
      await page.getByText("sent to", { exact: false }).first().waitFor();
      await page.locator(`[data-testid="chapter-sent-${state.chapterId}"]`).waitFor({ state: "visible", timeout: config.timeout });
      await screenshot("05-mangaka-approved-and-sent-chapter");
    });

    await step("Tantou creates feedback on the persisted hitbox", async () => {
      await loginUi("tantou");
      await page.goto(`${config.frontendUrl}/#/workspace/${state.pageId}?seriesId=${state.seriesId}&chapterId=${state.chapterId}`, { waitUntil: "domcontentloaded" });
      const hitbox = page.locator(`[data-testid="review-hitbox-${state.hitboxId}"]`);
      await hitbox.waitFor({ state: "visible", timeout: config.uploadTimeout });
      await hitbox.click();
      await page.locator('[data-testid="tantou-feedback-input"]').fill(state.feedbackContent);
      const feedbackResult = await waitJsonResponse(
        (response) => response.request().method() === "POST" && new URL(response.url()).pathname.endsWith(`/tantou-feedbacks/pages/${state.pageId}`),
        () => page.locator('[data-testid="tantou-feedback-submit"]').click()
      );
      assert.equal(feedbackResult.status, 201, `Create Tantou feedback returned ${feedbackResult.status}: ${truncate(feedbackResult.text)}`);
      state.feedbackId = feedbackResult.json?.id;
      assert.ok(state.feedbackId, "Feedback create did not return id");
      await page.getByText("Tantou feedback created", { exact: false }).waitFor();
      await screenshot("06-tantou-feedback");
    });

    await step("Mangaka resolves real Tantou feedback", async () => {
      await loginUi("mangaka");
      await page.goto(`${config.frontendUrl}/#/assistant-review`, { waitUntil: "domcontentloaded" });
      const row = page.locator(`[data-testid="tantou-feedback-${state.feedbackId}"]`);
      await row.waitFor({ state: "visible", timeout: config.timeout });
      const resolveResult = await waitJsonResponse(
        (response) => response.request().method() === "PATCH" && new URL(response.url()).pathname.endsWith(`/tantou-feedbacks/${state.feedbackId}/resolve`),
        () => row.locator('[data-testid="resolve-feedback"]').click()
      );
      assert.equal(resolveResult.status, 200, `Resolve feedback returned ${resolveResult.status}: ${truncate(resolveResult.text)}`);
      assert.equal(resolveResult.json?.isResolved, true);
      await page.getByText(`Feedback #${state.feedbackId} marked resolved`, { exact: false }).waitFor();
      await screenshot("07-feedback-resolved");
    });

    await step("Tantou approves the chapter and sends the series to Editorial Board", async () => {
      await loginUi("tantou");
      await page.goto(`${config.frontendUrl}/#/tantou-review?seriesId=${state.seriesId}`, { waitUntil: "domcontentloaded" });
      const chapterRow = page.locator(`[data-testid="tantou-review-chapter-${state.chapterId}"]`);
      await chapterRow.waitFor({ state: "visible", timeout: config.timeout });
      const chapterApprove = await waitJsonResponse(
        (response) => response.request().method() === "PATCH" && new URL(response.url()).pathname.endsWith(`/chapters/${state.chapterId}/status`) && response.url().includes("newStatus=APPROVED"),
        () => chapterRow.locator(`[data-testid="tantou-approve-chapter-${state.chapterId}"]`).click()
      );
      assert.equal(chapterApprove.status, 200, `Tantou chapter approval returned ${chapterApprove.status}: ${truncate(chapterApprove.text)}`);
      assert.equal(String(chapterApprove.json?.publishStatus).toUpperCase(), "APPROVED");

      const sendButton = page.locator(`[data-testid="send-series-to-board-${state.seriesId}"]`);
      await sendButton.waitFor({ state: "visible", timeout: config.timeout });
      assert.equal(await sendButton.isEnabled(), true, "Board handoff must be enabled after every chapter is Tantou-approved");
      const result = await waitJsonResponse(
        (response) => response.request().method() === "PATCH" && new URL(response.url()).pathname.endsWith(`/manga-series/${state.seriesId}/submit-to-board`),
        () => sendButton.click()
      );
      assert.equal(result.status, 200, `Tantou Board handoff returned ${result.status}: ${truncate(result.text)}`);
      assert.equal(String(result.json?.status).toUpperCase(), "REVIEWING");
      await page.locator(`[data-testid="series-board-sent-${state.seriesId}"]`).waitFor({ state: "visible", timeout: config.timeout });
      await screenshot("08-tantou-sent-to-board");
    });

    await step("Editorial Board votes approve through the real UI", async () => {
      await loginUi("board");
      await page.goto(`${config.frontendUrl}/#/board-review`, { waitUntil: "domcontentloaded" });
      const row = page.locator(`[data-testid="board-series-${state.seriesId}"]`);
      await row.waitFor({ state: "visible", timeout: config.timeout });
      const voteResult = await waitJsonResponse(
        (response) => response.request().method() === "POST" && new URL(response.url()).pathname.endsWith(`/votes/series/${state.seriesId}`),
        () => row.locator('[data-testid="board-vote-approve"]').click()
      );
      assert.equal(voteResult.status, 200, `Board vote returned ${voteResult.status}: ${truncate(voteResult.text)}`);
      state.voteId = voteResult.json?.id || null;
      assert.equal(voteResult.json?.isApproved, true);
      await page.getByText("Approval vote submitted", { exact: false }).waitFor();
      await screenshot("09-board-voted");
    });

    await step(`Admin ${finalDecision}s the real series through the UI`, async () => {
      await loginUi("admin");
      await page.goto(`${config.frontendUrl}/#/admin-review`, { waitUntil: "domcontentloaded" });
      const row = page.locator(`[data-testid="admin-series-${state.seriesId}"]`);
      await row.waitFor({ state: "visible", timeout: config.timeout });
      await row.locator('[data-testid="admin-tantou-select"]').selectOption(String(accounts.tantou.id));
      const decisionButton = finalDecision === "approve"
        ? row.locator('[data-testid="admin-approve"]')
        : row.getByRole("button", { name: "Admin reject" });
      await decisionButton.click();
      const result = await waitJsonResponse(
        (response) => response.request().method() === "PATCH" && new URL(response.url()).pathname.endsWith(`/manga-series/${state.seriesId}/admin-decision`),
        () => page.locator('[data-testid="admin-confirm-decision"]').click()
      );
      assert.equal(result.status, 200, `Admin decision returned ${result.status}: ${truncate(result.text)}`);
      state.finalStatus = String(result.json?.status || "").toUpperCase();
      assert.equal(state.finalStatus, finalDecision === "approve" ? "APPROVED" : "REJECTED");
      await screenshot(`10-admin-${finalDecision}`);
    });

    await step("Final real database state is persisted and password-safe", async () => {
      const result = await apiRequest(`/manga-series/${state.seriesId}`, { token: accounts.mangaka.token });
      assert.equal(result.status, 200, `Final series read returned ${result.status}: ${truncate(result.text)}`);
      assert.equal(String(result.json?.status).toUpperCase(), finalDecision === "approve" ? "APPROVED" : "REJECTED");
      if (finalDecision === "approve") {
        const tantouId = result.json?.tantou?.id ?? result.json?.tantouId ?? result.json?.tantou_id;
        assert.equal(Number(tantouId), Number(accounts.tantou.id), "Final series does not persist the selected Tantou Editor");
      }
      assert.equal(report.passwordLeaks.length, 0, `Password data leaked in ${report.passwordLeaks.length} response(s)`);
      assert.deepEqual(report.pageErrors, [], `Browser page errors: ${report.pageErrors.join(" | ")}`);
    });

    if (finalDecision === "reject") {
      await step("Cleanup rejected real-data test records", async () => {
        await cleanupRejectedRun();
        assert.equal(state.retained, false, `Cleanup did not remove the temporary series (status ${state.cleanupStatus || "unknown"}): ${state.cleanupError || "no detail"}`);
      });
    }

    report.result = "PASS";
  } catch (error) {
    report.result = "FAIL";
    report.error = error?.stack || error?.message || String(error);
    if (!config.keepOnFailure && finalDecision !== "approve") await cleanupRejectedRun();
    process.exitCode = 1;
  } finally {
    report.finishedAt = new Date().toISOString();
    report.summary = {
      passed: report.steps.filter((item) => item.result === "PASS").length,
      failed: report.steps.filter((item) => item.result === "FAIL").length,
      passwordLeaks: report.passwordLeaks.length,
      pageErrors: report.pageErrors.length,
      failedHttpResponses: report.failedResponses.length
    };
    fs.writeFileSync(path.join(outputDir, "state.json"), JSON.stringify(state, null, 2));
    fs.writeFileSync(path.join(outputDir, "report.json"), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join(outputDir, "report.csv"), toCsv(report.steps));
    if (context) {
      try { await context.tracing.stop({ path: path.join(outputDir, "trace.zip") }); } catch {}
    }
    if (browser) await browser.close().catch(() => {});
    await stopChild(frontendProcess);
    await stopChild(backendProcess);
    if (imagePath && fs.existsSync(imagePath)) fs.rmSync(imagePath, { force: true });

    console.log("\nREAL-DATA UI E2E RESULT");
    console.table(report.steps.map(({ name, result, durationMs }) => ({ Test: name, Result: result, DurationMs: durationMs || 0 })));
    console.log(`Passed: ${report.summary.passed}`);
    console.log(`Failed: ${report.summary.failed}`);
    console.log(`Password leaks: ${report.summary.passwordLeaks}`);
    console.log(`Result folder: ${outputDir}`);
    if (state.seriesId) console.log(`Series: ${state.seriesTitle} (ID ${state.seriesId}) - ${state.retained ? "retained" : "cleaned"}`);
  }
}

function createTestPng(dir, id) {
  const file = path.join(dir, `ui-e2e-${id}.png`);
  const base64 = "iVBORw0KGgoAAAANSUhEUgAAAZAAAAGQCAIAAAAP3aGbAAAACXBIWXMAAAsSAAALEgHS3X78AAABhUlEQVR4nO3BMQEAAADCoPVPbQ0PoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4G8BvAABoYuQmAAAAABJRU5ErkJggg==";
  fs.writeFileSync(file, Buffer.from(base64, "base64"));
  return file;
}

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index < 1) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    if (value === "--headed") parsed.headed = true;
    else if (value === "--keep") parsed.keep = true;
    else if (value.startsWith("--final=")) parsed.final = value.split("=").slice(1).join("=");
    else if (value.startsWith("--backend=")) parsed.backend = value.split("=").slice(1).join("=");
    else if (value.startsWith("--frontend=")) parsed.frontend = value.split("=").slice(1).join("=");
    else if (value.startsWith("--browser=")) parsed.browser = value.split("=").slice(1).join("=");
    else if (value.startsWith("--jar=")) parsed.jar = value.split("=").slice(1).join("=");
  }
  return parsed;
}

function findBrowserExecutable(explicit) {
  const candidates = [
    explicit,
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env.PROGRAMFILES || "", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env["PROGRAMFILES(X86)"] || "", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env.PROGRAMFILES || "", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env["PROGRAMFILES(X86)"] || "", "Microsoft", "Edge", "Application", "msedge.exe"),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
  ].filter(Boolean);
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error("Chrome, Edge, or Chromium was not found. Set E2E_BROWSER_PATH to the browser executable.");
  return found;
}

function pipeChild(child, name) {
  child.stdout?.on("data", (chunk) => process.stdout.write(`[${name}] ${chunk}`));
  child.stderr?.on("data", (chunk) => process.stderr.write(`[${name}] ${chunk}`));
  child.on("exit", (code) => log(`${name} process exited with code ${code}`));
}

async function stopChild(child) {
  if (!child || child.killed) return;
  child.kill("SIGTERM");
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 3_000);
    child.once("exit", () => { clearTimeout(timer); resolve(); });
  });
  if (!child.killed) child.kill("SIGKILL");
}

async function waitUntil(check, timeout, label) {
  const deadline = Date.now() + timeout;
  let lastError = null;
  while (Date.now() < deadline) {
    try { if (await check()) return; } catch (error) { lastError = error; }
    await new Promise((resolve) => setTimeout(resolve, 800));
  }
  throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ""}`);
}

function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
function stripSlash(value) { return String(value || "").replace(/\/+$/, ""); }
function slug(value) { return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80); }
function truncate(value, max = 220) { const s = String(value || "").replace(/\s+/g, " "); return s.length > max ? `${s.slice(0, max)}...` : s; }
function csvEscape(value) { const s = String(value ?? ""); return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s; }
function toCsv(items) {
  const columns = ["name", "result", "durationMs", "startedAt", "finishedAt", "detail"];
  return [columns.join(","), ...items.map((item) => columns.map((key) => csvEscape(item[key])).join(","))].join(os.EOL);
}

await main();
