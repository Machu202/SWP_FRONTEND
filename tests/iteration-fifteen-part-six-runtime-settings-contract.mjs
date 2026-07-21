import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backendRoot = path.resolve(frontendRoot, "../SWP_BACKEND");
const readFrontend = (relative) => fs.readFileSync(path.join(frontendRoot, relative), "utf8");
const readBackend = (relative) => fs.readFileSync(path.join(backendRoot, relative), "utf8");

const parameterController = readBackend("src/main/java/com/mangastudio/backend/controller/SystemParameterController.java");
const parameterService = readBackend("src/main/java/com/mangastudio/backend/service/impl/SystemParameterServiceImpl.java");
const runtimeService = readBackend("src/main/java/com/mangastudio/backend/service/RuntimeSystemParameterService.java");
const runtimeController = readBackend("src/main/java/com/mangastudio/backend/controller/RuntimeSettingsController.java");
const pageService = readBackend("src/main/java/com/mangastudio/backend/service/impl/PageServiceImpl.java");
const resourceService = readBackend("src/main/java/com/mangastudio/backend/service/impl/ResourceServiceImpl.java");
const authService = readBackend("src/main/java/com/mangastudio/backend/service/impl/AuthServiceImpl.java");
const chapterService = readBackend("src/main/java/com/mangastudio/backend/service/impl/ChapterServiceImpl.java");
const seriesService = readBackend("src/main/java/com/mangastudio/backend/service/impl/MangaSeriesServiceImpl.java");
const deadlineService = readBackend("src/main/java/com/mangastudio/backend/service/impl/DeadlineEventServiceImpl.java");
const schedulerGate = readBackend("src/main/java/com/mangastudio/backend/component/ConfigurableSchedulerGate.java");
const seriesScheduler = readBackend("src/main/java/com/mangastudio/backend/component/SeriesPublicationScheduler.java");
const chapterScheduler = readBackend("src/main/java/com/mangastudio/backend/component/ChapterPublicationScheduler.java");
const telemetryService = readBackend("src/main/java/com/mangastudio/backend/service/impl/TelemetryBufferServiceImpl.java");
const systemPage = readFrontend("src/pages/SystemPage.jsx");
const loginPage = readFrontend("src/pages/LoginPage.jsx");
const directChat = readFrontend("src/components/DirectMessenger.jsx");
const boardChat = readFrontend("src/components/BoardVotingChat.jsx");

assert.match(parameterController, /@PreAuthorize\("hasRole\('ADMIN'\)"\)[\s\S]*class SystemParameterController/,
  "All Settings reads and writes must be Admin-only");
assert.match(parameterService, /@Cacheable\(cacheNames = "systemParameters"/,
  "Runtime parameter reads must be cached");
assert.match(parameterService, /FORBIDDEN_SENSITIVE_KEYS[\s\S]*JWT_SECRET[\s\S]*CLOUDINARY_API_SECRET/,
  "Deployment secrets must be rejected from the business settings table");
assert.match(parameterService, /KNOWN_PARAMETER_TYPES[\s\S]*MAX_UPLOAD_MB[\s\S]*BOARD_APPROVAL_RATIO[\s\S]*ALLOWED_IMAGE_TYPES/,
  "Known business keys must have enforced types");
assert.match(runtimeService, /optionalPositiveInteger[\s\S]*booleanValue[\s\S]*integerArrayValue/,
  "Business services need typed runtime access with safe fallbacks");
assert.match(runtimeController, /maxChatMessageLength[\s\S]*enablePublicRegistration[\s\S]*enableGoogleLogin[\s\S]*enableEmailOtp/,
  "Public UI must receive only the safe runtime settings it needs");

assert.match(pageService, /enforceConfiguredPageLimit\(chapterId\)/,
  "MAX_PAGES_PER_CHAPTER must block page uploads");
assert.equal((pageService.match(/uploadPolicyService\.validatePageImage/g) || []).length, 2,
  "Both new and replacement page images must use the Admin upload policy");
assert.match(resourceService, /uploadPolicyService\.validateFile\(file\)/,
  "Resource uploads must use MAX_UPLOAD_MB and MAX_REQUEST_MB");

for (const [feature, key] of [
  ["registration", "ENABLE_PUBLIC_REGISTRATION"],
  ["Google login", "ENABLE_GOOGLE_LOGIN"],
  ["email OTP", "ENABLE_EMAIL_OTP"],
]) {
  assert.ok(authService.includes(key), `${feature} must be enforced by the backend`);
}
assert.match(loginPage, /api\.system\.runtime\(\)[\s\S]*registrationEnabled[\s\S]*googleLoginEnabled[\s\S]*emailOtpEnabled/,
  "Login controls must reflect backend feature flags");

assert.match(chapterService, /DEFAULT_CHAPTER_STATUS[\s\S]*REVIEW_TIMEOUT_HOURS/,
  "Chapter defaults and review timeout must be runtime-controlled");
assert.match(seriesService, /DEFAULT_SERIES_STATUS[\s\S]*BOARD_APPROVAL_RATIO/,
  "Series defaults and Board approval threshold must be runtime-controlled");
assert.match(deadlineService, /DEADLINE_WARNING_DAYS[\s\S]*WARNING_/,
  "Configured deadline warning days must send non-duplicate reminders");

assert.match(schedulerGate, /positiveInteger\(intervalParameter, fallbackSeconds, 86_400\)/,
  "Scheduler intervals must be read from cached runtime settings");
assert.match(seriesScheduler, /PUBLICATION_SCAN_SECONDS/);
assert.match(chapterScheduler, /PUBLICATION_SCAN_SECONDS/);
assert.match(deadlineService, /DEADLINE_SCAN_SECONDS/);
assert.match(telemetryService, /TELEMETRY_FLUSH_SECONDS/);

assert.match(directChat, /maxLength=\{maxMessageLength\}/);
assert.match(boardChat, /maxLength=\{maxMessageLength\}/);
assert.doesNotMatch(systemPage, /Examples:\s*MAX_UPLOAD_MB/,
  "The removed hardcoded Settings example line must stay removed");

console.log("Iteration fifteen Part 6 runtime Settings contract passed.");
