import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backendRoot = path.resolve(root, "../SWP_BACKEND");

function read(relativePath, base = root) {
  return fs.readFileSync(path.join(base, relativePath), "utf8");
}

function requireText(source, expected, label) {
  if (!source.includes(expected)) throw new Error(`${label} is missing: ${expected}`);
}

function rejectText(source, forbidden, label) {
  if (source.includes(forbidden)) throw new Error(`${label} still contains: ${forbidden}`);
}

const systemPage = read("src/pages/SystemPage.jsx");
rejectText(
  systemPage,
  "Examples:",
  "Admin Settings example helper"
);
requireText(systemPage, "key === \"MAX_PAGES_PER_CHAPTER\" ? \"INTEGER\"", "Admin limit type selection");
requireText(systemPage, "min={isMaxPagesPerChapter ? 1 : undefined}", "Admin positive limit input");

const pageService = read(
  "src/main/java/com/mangastudio/backend/service/impl/PageServiceImpl.java",
  backendRoot
);
requireText(pageService, "findByIdForPageUpload(chapterId)", "Concurrent upload guard");
requireText(pageService, "findByParamKeyIgnoreCase(MAX_PAGES_PER_CHAPTER)", "Admin page-limit lookup");
requireText(pageService, "countByChapterId(chapterId)", "Chapter page count");
requireText(pageService, "currentPageCount >= maximum", "Chapter page-limit enforcement");

const parameterService = read(
  "src/main/java/com/mangastudio/backend/service/impl/SystemParameterServiceImpl.java",
  backendRoot
);
requireText(parameterService, "MAX_PAGES_PER_CHAPTER must use the INTEGER type", "Limit type validation");
requireText(parameterService, "MAX_PAGES_PER_CHAPTER must be at least 1", "Positive limit validation");

const vietnameseLetters = "ÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ" +
  "àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ";
const vietnamese = new RegExp(`[${vietnameseLetters}]`, "u");
for (const [base, directories, extensions] of [
  [root, ["src"], new Set([".js", ".jsx", ".css"])],
  [backendRoot, ["src/main/java", "src/test/java"], new Set([".java"])],
]) {
  for (const directory of directories) {
    const stack = [path.join(base, directory)];
    while (stack.length) {
      const current = stack.pop();
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) stack.push(fullPath);
        else if (extensions.has(path.extname(entry.name)) && vietnamese.test(fs.readFileSync(fullPath, "utf8"))) {
          throw new Error(`Non-English text remains in ${path.relative(base, fullPath)}`);
        }
      }
    }
  }
}

console.log("Iteration thirteen English-text and Admin page-limit contract passed.");
