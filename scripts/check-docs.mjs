#!/usr/bin/env node
/**
 * 文件一致性守門（使用者 2026-10-25 反映「經常忽略檢查所有文件的匹配性」）
 *
 * 檢查：
 *  1. 最新 release 檔（docs/releases/vX.Y.Z.md）＝ README 徽章 ＝ 發佈與上傳的版本號
 *  2. 規劃書「現況」寫的版本 ＝ 最新 release
 *  3. 每份 docs/*.md 至少被 README 或規劃書引用一次（沒有孤兒文件）
 *  4. README／規劃書 提到但實際不存在的檔案路徑（幽靈引用）
 *  5. 規劃書裡的 W-xx 編號不得重複；已完成（✅）的項目不得還留在「隊列」語意的段落
 *  6. app.json 頁面數 = README 寫的頁面數（有寫的話）
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const warnings = [];
const read = (rel) => readFileSync(join(root, rel), 'utf8');

// ── 1) 版本三方一致 ──
const rels = readdirSync(join(root, 'docs/releases'))
  .filter((f) => /^v\d+\.\d+\.\d+\.md$/.test(f))
  .map((f) => f.replace(/^v|\.md$/g, ''))
  .sort((a, b) => {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i += 1) if (pa[i] !== pb[i]) return pa[i] - pb[i];
    return 0;
  });
const latest = rels[rels.length - 1];

const readme = read('README.md');
const badge = (readme.match(/version-(\d+\.\d+\.\d+)-/) || [])[1];
const publish = read('docs/發佈與上傳.md');
const publishVer = (publish.match(/\| 微信上傳（教育版） \| \*\*(\d+\.\d+\.\d+)\*\*/) || [])[1];

if (badge !== latest) errors.push(`README 版本徽章 ${badge || '(無)'} ≠ 最新 release ${latest}`);
if (publishVer !== latest) errors.push(`發佈與上傳的版本 ${publishVer || '(無)'} ≠ 最新 release ${latest}`);
// 1b. 小程序執行期顯示的版號（config.VERSION，設定頁「關於」）也要跟得上，否則使用者看到的版本是舊的
{
  const cfg = read('config/config.js');
  const appVer = (cfg.match(/VERSION:\s*'(\d+\.\d+\.\d+)'/) || [])[1];
  if (!appVer) errors.push('config/config.js 找不到 VERSION（設定頁的版本號來源）');
  else if (appVer !== latest) errors.push(`config.VERSION ${appVer} ≠ 最新 release ${latest}（使用者在小程序「關於」看到的是這個）`);
}

// ── 2) 規劃書現況版本 ──
const plan = read('docs/規劃書-待完成.md');
const planVer = (plan.match(/## 現況（[^，]*，v(\d+\.\d+\.\d+)/) || [])[1];
if (planVer && planVer !== latest) errors.push(`規劃書現況版本 v${planVer} ≠ 最新 release v${latest}`);

// ── 2b) 進度.md：最新一列要等於最新 release；不得偷放隊列；表格不得被空行打斷 ──
const prog = read('docs/進度.md');
const progRows = prog.split('\n').filter((l) => /^\| 20\d\d-/.test(l));
if (!progRows.length) {
  errors.push('docs/進度.md 的「已完成」表是空的');
} else {
  const vers = progRows.map((l) => (l.match(/v(\d+\.\d+\.\d+)/) || [])[1]).filter(Boolean);
  if (vers.length && vers[0] !== latest) {
    errors.push(`docs/進度.md 最新一列是 v${vers[0]}，但最新 release 是 v${latest}（做完沒登記）`);
  }
  const sorted = vers.map((v) => v.split('.').map(Number));
  for (let i = 1; i < sorted.length; i += 1) {
    const [a, b] = [sorted[i - 1], sorted[i]];
    if (a[0] * 1e6 + a[1] * 1e3 + a[2] < b[0] * 1e6 + b[1] * 1e3 + b[2]) {
      errors.push(`docs/進度.md 排序錯誤：v${vers[i - 1]} 排在 v${vers[i]} 之前（最新要在最上面）`);
      break;
    }
  }
  const progBody = prog.split('| 時間 | 項目 | 驗證 | Commit |')[1] || '';
  const tablePart = progBody.split('\n## ')[0].trim();
  if (/\n\s*\n/.test(tablePart)) {
    errors.push('docs/進度.md 的表格中間有空白行（Markdown 會斷表）');
  }
  if (/^\| \d+ \|/m.test(prog)) {
    errors.push('docs/進度.md 出現「隊列」表格：隊列只放規劃書，兩邊各一份一定有一邊過期');
  }
}

// ── 2c) 規劃書：待完成細節不得有「已完成」段；執行順序每項都要有對應章節 ──
{
  const detail = plan.split('## 待完成細節')[1] || '';
  if (/✅/.test(detail)) errors.push('docs/規劃書-待完成.md 的「待完成細節」裡還有 ✅ 已完成項（做完要刪掉）');
  const orderIds = [...plan.split('## 執行順序')[1].split('##')[0].matchAll(/^\| \d+ \| (W-\d+)/gm)].map((m) => m[1]);
  const detailIds = [...detail.matchAll(/^### (W-\d+)/gm)].map((m) => m[1]);
  for (const id of orderIds) {
    if (!detailIds.includes(id)) errors.push(`規劃書「執行順序」有 ${id}，但「待完成細節」沒有這一節`);
  }
  for (const id of detailIds) {
    if (!orderIds.includes(id)) errors.push(`規劃書「待完成細節」有 ${id}，但「執行順序」表沒列`);
  }
}

// ── 3) 孤兒文件 ──
const docs = readdirSync(join(root, 'docs')).filter((f) => f.endsWith('.md'));
const haystack = readme + plan;
for (const f of docs) {
  if (f === '規劃書-待完成.md') continue;
  if (!haystack.includes(f)) warnings.push(`docs/${f} 沒有被 README 或規劃書引用（孤兒文件？）`);
}

// ── 4) 幽靈路徑：README／規劃書 中反引號包住的專案路徑 ──
for (const [name, text] of [['README.md', readme], ['docs/規劃書-待完成.md', plan]]) {
  for (const m of text.matchAll(/`((?:docs|pages|services|utils|components|scripts|styles|config|cloudfunctions)\/[A-Za-z0-9_./\u4e00-\u9fff-]+)`/g)) {
    const rel = m[1];
    if (rel.includes('*') || rel.includes('X.Y.Z')) continue;
    if (!existsSync(join(root, rel))) warnings.push(`${name} 提到不存在的路徑：${rel}`);
  }
}

// ── 5) 規劃書 W 編號重複 ──
const ids = [...plan.matchAll(/### (W-\d+)/g)].map((m) => m[1]);
const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dup.length) errors.push(`規劃書有重複的任務編號：${[...new Set(dup)].join('、')}`);

// ── 6) 頁面數一致 ──
const app = JSON.parse(read('app.json'));
const pageCount = app.pages.length;
for (const m of readme.matchAll(/(\d+)\s*個?頁|(\d+)\s*頁面/g)) {
  const n = Number(m[1] || m[2]);
  if (n && n !== pageCount && n > 5) warnings.push(`README 寫「${n} 頁」，但 app.json 是 ${pageCount} 頁`);
}

// ── 2d) 進度.md「現況」版本 ＝ 最新 release ──
{
  const progText = read('docs/進度.md');
  const m = progText.match(/## 現況[\s\S]*?- 前端 \*\*v(\d+\.\d+\.\d+)\*\*/);
  const now = m && m[1];
  if (!now) errors.push('docs/進度.md 的「現況」沒有寫前端版本');
  else if (now !== latest) errors.push(`docs/進度.md「現況」寫 v${now}，但最新 release 是 v${latest}`);
}

for (const w of warnings) console.warn(`⚠️  ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`❌ ${e}`);
  console.error(`\n文件一致性檢查失敗：${errors.length} 個錯誤，${warnings.length} 個警告`);
  process.exit(1);
}
console.log(`✅ 文件一致性通過（最新版本 v${latest}，${docs.length} 份文件，${warnings.length} 個警告）`);
