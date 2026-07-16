import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const css = fs.readFileSync(path.join(root, "src/styles.css"), "utf8");
const required = [
  "Green_Space_p4rbuh.jpg",
  "Red_Space_wrjdlw.png",
  "Purple_Space_sxkcvt.jpg",
  "Orange_Space_gf3tx5.jpg",
  "Blue_Space_z76u0i.jpg",
  ".feature-screen.board-screen .sidebar",
  "width: 310px",
  ".feature-screen.board-screen .main-wrapper",
  "#ffd58a",
  ".feature-screen.admin-screen .main-wrapper",
  "#eaf4ff",
  ".feature-screen .btn-sidebar-action",
  ".feature-screen .nav-item.active"
];
const missing = required.filter((token) => !css.includes(token));
if (missing.length) {
  console.error("Missing navigation/theme requirements:", missing.join(", "));
  process.exit(1);
}
console.log("Role navigation/theme contract: PASS");
