import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const config = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/config/JacksonCompatibilityConfig.java");
const service = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/service/impl/SystemParameterServiceImpl.java");
const backendTest = read("../SWP_BACKEND/src/test/java/com/mangastudio/backend/JacksonCompatibilityConfigTests.java");

assert.match(config, /@Configuration\(proxyBeanMethods = false\)/);
assert.match(config, /@Bean/);
assert.match(config, /@ConditionalOnMissingBean\(ObjectMapper\.class\)/,
  "Compatibility mapper must not override a mapper explicitly supplied by the application");
assert.match(config, /public ObjectMapper legacyObjectMapper\(\)/);
assert.match(config, /return new ObjectMapper\(\)/);
assert.match(service, /private final ObjectMapper objectMapper/);
assert.match(service, /objectMapper\.readTree\(normalized\)/);
assert.match(backendTest, /legacyObjectMapper\(\)/);

console.log("SWP21 Jackson 2 ObjectMapper startup compatibility contract: PASS");
