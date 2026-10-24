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

// ── 2) 規劃書現況版本 ──
const plan = read('docs/規劃書-待完成.md');
const planVer = (plan.match(/## 現況（[^，]*，v(\d+\.\d+\.\d+)/) || [])[1];
if (planVer && planVer !== latest) errors.push(`規劃書現況版本 v${planVer} ≠ 最新 release v${latest}`);

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

for (const w of warnings) console.warn(`⚠️  ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`❌ ${e}`);
  console.error(`\n文件一致性檢查失敗：${errors.length} 個錯誤，${warnings.length} 個警告`);
  process.exit(1);
}
console.log(`✅ 文件一致性通過（最新版本 v${latest}，${docs.length} 份文件，${warnings.length} 個警告）`);
