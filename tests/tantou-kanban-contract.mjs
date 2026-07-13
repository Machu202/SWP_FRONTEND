import fs from "node:fs";
import assert from "node:assert/strict";

const tasks = fs.readFileSync(new URL("../src/pages/TasksPage.jsx", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../src/components/Layout.jsx", import.meta.url), "utf8");

assert.match(layout, /Kanban Tasks/);
assert.match(tasks, /const isTantou = hasRole\(role, \["tantou"\]\)/);
assert.match(tasks, /No tasks in assigned series/);
assert.match(tasks, /hasRole\(role, \["assistant", "tantou"\]\)/);
assert.match(tasks, /!isTantou && \(/);
console.log("Tantou Kanban frontend contract: PASS");
