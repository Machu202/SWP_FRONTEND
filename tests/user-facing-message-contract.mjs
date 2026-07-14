import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");
const targets = ["pages", "components"];
const files = targets.flatMap((folder) =>
  fs.readdirSync(path.join(root, folder))
    .filter((name) => /\.(jsx?|tsx?)$/.test(name))
    .map((name) => path.join(root, folder, name))
);

const forbiddenVisiblePhrases = [
  "backend page API",
  "backend data",
  "loaded from the backend",
  "returned from backend",
  "Supabase data",
  "synchronized with Supabase",
  "Loading profile from Supabase",
  "backend verifies OTP",
  "Google login needs VITE_GOOGLE_CLIENT_ID",
  "ChapterScript endpoint",
  "backend cascade rules",
  "manga_series.tantou_id",
  "No backend records",
  ">Backend<",
  "notification-connection ${connectionState}",
  ">{connectionState}<"
];

const combined = files.map((file) => fs.readFileSync(file, "utf8")).join("\n");
for (const phrase of forbiddenVisiblePhrases) {
  assert.equal(combined.includes(phrase), false, `User-facing technical phrase remains: ${phrase}`);
}

const client = fs.readFileSync(path.join(root, "api/client.js"), "utf8");
assert.match(client, /friendlyRequestMessage/, "Technical responses must pass through the friendly-message mapper");
assert.doesNotMatch(client, /`API error \$\{response\.status\}`/, "Raw API status errors must not be displayed");

console.log("User-facing message contract: PASS");
