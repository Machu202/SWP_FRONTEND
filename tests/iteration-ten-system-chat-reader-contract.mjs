import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const systemPage = read("src/pages/SystemPage.jsx");
const client = read("src/api/client.js");
const reader = read("src/components/ChapterReaderModal.jsx");
const css = read("src/styles.css");
const app = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/BackendApplication.java");
const parameter = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/entity/SystemParameter.java");
const audit = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/entity/SystemParameterAudit.java");
const parameterController = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/controller/SystemParameterController.java");
const parameterService = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/service/impl/SystemParameterServiceImpl.java");
const chatEntity = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/entity/DirectChatMessage.java");
const chatRepository = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/repository/DirectChatMessageRepository.java");
const chatMigration = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/component/DirectChatSchemaMigration.java");

assert.match(parameterController, /@PreAuthorize\("hasRole\('ADMIN'\)"\)[\s\S]*class SystemParameterController/);
assert.match(parameterService, /requireAdmin\(currentUserId\)/);

assert.match(app, /@EnableCaching/);
assert.match(parameterService, /@Cacheable\(cacheNames = "systemParameters"/);
assert.match(parameterService, /@Cacheable\(cacheNames = "systemParameterList"/);
assert.match(parameterService, /@CacheEvict\(cacheNames = "systemParameters", allEntries = true\)/);

assert.match(parameter, /param_type/);
assert.match(parameterService, /SUPPORTED_TYPES/);
assert.match(parameterService, /case "INTEGER" -> Long\.parseLong/);
assert.match(parameterService, /case "BOOLEAN"/);
assert.match(parameterService, /case "JSON" -> objectMapper\.readTree/);
assert.match(systemPage, /PARAMETER_TYPES = \["STRING", "INTEGER", "DECIMAL", "BOOLEAN", "JSON"\]/);
assert.match(client, /create: \(key, value, type = "STRING"\)/);

assert.match(parameter, /updated_by/);
assert.match(parameter, /updated_at/);
assert.match(audit, /System_Parameter_Audit/);
assert.match(parameterService, /"CREATE"/);
assert.match(parameterService, /"UPDATE"/);
assert.match(parameterService, /"DELETE"/);
assert.match(systemPage, /parameterUpdatedBy/);
assert.match(systemPage, /parameterUpdatedAt/);

assert.match(chatEntity, /name = "mat_chat_message"/);
assert.match(chatEntity, /name = "receiver_id"/);
assert.doesNotMatch(chatEntity, /recipient_id/);
assert.match(chatRepository, /message\.receiver/);
assert.match(chatMigration, /INSERT INTO mat_chat_message \(sender_id, receiver_id/);
assert.match(chatMigration, /FROM direct_chat_message legacy/);
assert.match(chatMigration, /missingRows[\s\S]*DROP TABLE direct_chat_message/);

assert.match(reader, /image\.naturalWidth/);
assert.match(reader, /image\.naturalHeight/);
assert.match(reader, /Math\.min\(availableWidth \/ image\.naturalWidth, availableHeight \/ image\.naturalHeight\)/);
assert.match(reader, /ResizeObserver/);
assert.match(reader, />Open full image<\/a>/);
assert.match(css, /\.chapter-reader-stage img[\s\S]*--reader-fit-width[\s\S]*--reader-fit-height[\s\S]*object-fit: contain/);

console.log("SWP20 System Parameters, MAT chat migration and full-image reader contract: PASS");
