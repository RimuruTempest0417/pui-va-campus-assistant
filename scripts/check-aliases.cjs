#!/usr/bin/env node
/**
 * 別名守門：頁面／組件裡用到的模組別名，必須真的宣告過。
 *
 * 為什麼要有：連續兩次事故都是同類 —— `request is not defined`（api.js 用錯別名）、
 * `Can't find variable: adminApi`（重寫函式時取了沒 import 的名字）。
 * 這兩種錯自動守門原本抓不到，只能等人點到那一頁。
 *
 * 做法：列出本專案「常見別名 → 正確用法」，看到用了卻沒宣告就紅燈。
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const KNOWN = {
  adminApi: 'admin（services/admin）',
  dataApi: 'data（services/data）',
  apiApi: 'http（services/api）',
  requestApi: 'request（utils/request）',
  httpApi: 'http（utils/request）',
};
const files = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.js')) files.push(p);
  }
};
['pages', 'components', 'utils', 'services'].forEach((d) => walk(path.join(root, d)));

const bad = [];
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  for (const alias of Object.keys(KNOWN)) {
    const used = new RegExp('\\b' + alias + '\\s*\\.').test(src);
    if (!used) continue;
    const declared = new RegExp('(const|let|var|function)\\s+' + alias + '\\b').test(src);
    if (!declared) bad.push(`${path.relative(root, f)}：用了 ${alias}，但沒宣告（應該是 ${KNOWN[alias]}）`);
  }
}
// 動詞守門：`http.delete(...)` 這種寫法在 utils/request.js 不存在（匯出的是 del）→ 呼叫就炸
{
  const reqPath = path.join(root, 'utils/request.js');
  const reqSrc = fs.readFileSync(reqPath, 'utf8');
  const exported = new Set(['request']);
  const m = reqSrc.match(/module\.exports\s*=\s*\{([\s\S]*?)\};/);
  if (m) {
    for (const line of m[1].split('\n')) {
      const k = line.match(/^\s*([A-Za-z_$][\w$]*)\s*[:,]/);
      if (k) exported.add(k[1]);
    }
  }
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    for (const hit of src.matchAll(/\b(?:http|request)\.([A-Za-z_$][\w$]*)\s*\(/g)) {
      const verb = hit[1];
      if (!exported.has(verb)) bad.push(`${path.relative(root, f)}：呼叫 .${verb}()，但 utils/request.js 沒有匯出它（可用：${[...exported].join('／')}）`);
    }
  }
}

if (bad.length) {
  console.error('❌ 別名守門失敗：');
  bad.forEach((b) => console.error('  ' + b));
  process.exitCode = 1;
} else {
  console.log(`✅ 別名守門通過（${files.length} 個 JS 檔，沒有未宣告的模組別名）`);
}
