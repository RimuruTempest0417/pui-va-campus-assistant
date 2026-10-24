#!/usr/bin/env node
// OpenAPI 契約守門：重複鍵、可解析、操作數下限；--parity 額外與後端路由表對帳。
// 為什麼要有：docs/openapi.yaml 曾把同一路徑寫兩次（YAML 取後者，前面那段操作被靜默丟掉），
// 也出現過 { : "#/components/..." } 這種壞行（$ref 被吃掉）——兩者都不會被其他守門發現。
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const FILE = "docs/openapi.yaml";
const MIN_OPS = 59; // 2026-10-25 合併重複鍵＋刪掉 2 條後端不存在的假操作後的操作數，只准往上
const QT = String.fromCharCode(34, 39); // 雙引號與單引號
const errors = [];

if (!fs.existsSync(FILE)) {
  console.error("缺少 " + FILE);
  process.exit(1);
}

const lines = fs.readFileSync(FILE, "utf8").split("\n");
const ps = lines.findIndex((l) => /^paths:\s*$/.test(l));
const cs = lines.findIndex((l, i) => i > ps && /^[a-zA-Z]/.test(l));
if (ps < 0 || cs < 0) {
  console.error("找不到 paths: 到元件區段的邊界");
  process.exit(1);
}

const paths = new Map();
const dups = [];
let cur = null;
for (let i = ps + 1; i < cs; i++) {
  const pl = lines[i].match(/^  (\/\S*):\s*$/);
  if (pl) {
    cur = pl[1];
    if (paths.has(cur)) dups.push(cur + "（行 " + (i + 1) + "）");
    paths.set(cur, new Set());
    continue;
  }
  const ml = lines[i].match(/^    (get|post|put|patch|delete):\s*$/);
  if (ml && cur) {
    if (paths.get(cur).has(ml[1])) dups.push(cur + " " + ml[1] + "（行 " + (i + 1) + "）");
    paths.get(cur).add(ml[1]);
  }
}

const ops = [...paths.values()].reduce((a, s) => a + s.size, 0);
for (const d of dups) errors.push("重複鍵：" + d + "（後面的會靜默蓋掉前面的）");
if (ops < MIN_OPS) errors.push("操作數 " + ops + " 低於下限 " + MIN_OPS + "（有段落被吃掉？）");

// YAML 可解析性：用系統 ruby 的 Psych；找不到 ruby 就標略過，不假綠
const ruby = spawnSync("ruby", ["-ryaml", "-e", "YAML.load_file(ARGV[0])", FILE], { encoding: "utf8" });
let parseState = "ok";
if (ruby.error) parseState = "skipped";
else if (ruby.status !== 0) {
  parseState = "fail";
  const msg = (ruby.stderr || "").split("\n").filter((x) => x.trim()).slice(-2).join(" ");
  errors.push("YAML 解析失敗：" + msg);
}

if (process.argv.includes("--parity")) {
  const backend = [process.env.BACKEND_DIR, "../../../pui-va-campus-server", "../../pui-va-campus-server"]
    .filter(Boolean)
    .find((d) => fs.existsSync(d + "/src/routes"));
  if (!backend) console.log("（--parity：找不到後端 repo，略過對帳）");
  else {
    const norm = (s) => s.replace(/\{([^}]+)\}/g, ":$1");
    const be = new Set();
    for (const f of fs.readdirSync(backend + "/src/routes")) {
      const t = fs.readFileSync(backend + "/src/routes/" + f, "utf8");
      const re = new RegExp("app\\.(get|post|put|patch|delete)\\(\\s*[" + QT + "]([^" + QT + "]+)[" + QT + "]", "g");
      for (const m of t.matchAll(re)) be.add(m[1] + " " + norm(m[2]));
    }
    const doc = new Set();
    for (const [p, ms] of paths) for (const m of ms) doc.add(m + " " + norm(p));
    const missing = [...be].filter((x) => !doc.has(x));
    const stale = [...doc].filter((x) => !be.has(x));
    console.log("後端有、文件沒有：" + missing.length + " 條");
    for (const x of missing) console.log("  - " + x);
    console.log("文件有、後端沒有：" + stale.length + " 條");
    for (const x of stale) console.log("  - " + x);
  }
}

if (errors.length) {
  for (const e of errors) console.error("❌ " + e);
  console.error("\n檢查失敗：" + errors.length + " 個錯誤");
  process.exit(1);
}
const note = parseState === "skipped" ? "（YAML 解析未驗：找不到 ruby）" : "";
console.log("✅ OpenAPI 契約檢查通過：" + paths.size + " 條路徑／" + ops + " 個操作，0 重複鍵" + note);
