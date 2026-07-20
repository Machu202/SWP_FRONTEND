import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const config = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/config/CacheConfig.java");
const app = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/BackendApplication.java");
const service = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/service/impl/SystemParameterServiceImpl.java");
const backendTest = read("../SWP_BACKEND/src/test/java/com/mangastudio/backend/CacheConfigTests.java");

assert.match(app, /@EnableCaching/);
assert.match(config, /@ConditionalOnMissingBean\(CacheManager\.class\)/,
  "The local cache must remain replaceable by Redis or another production CacheManager");
assert.match(config, /public CacheManager cacheManager\(\)/);
assert.match(config, /new ConcurrentMapCacheManager\("systemParameters", "systemParameterList"\)/);
assert.match(service, /@Cacheable\(cacheNames = "systemParameters"/);
assert.match(service, /@Cacheable\(cacheNames = "systemParameterList"/);
assert.match(backendTest, /getCache\("systemParameters"\)/);
assert.match(backendTest, /getCache\("systemParameterList"\)/);

console.log("SWP22 Spring Boot 4 CacheManager startup compatibility contract: PASS");
