#!/usr/bin/env node
/**
 * 在 docs/進度.md 的「已完成」表最上面插一列（最新在上）
 *
 * 用法：
 *   node scripts/add-progress.mjs --version 0.33.1 --what "做了什麼" --verify "驗證數字" [--commit abc1234]
 *
 * 為什麼要有這支：以前用文字替換插入，錨點撞到「隊列」表，結果進度列被塞進隊列、表格還被空行打斷。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const val = (f) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};

const version = val('--version');
const what = val('--what');
const verify = val('--verify');
const commit = val('--commit') || '本輪';
if (!version || !what || !verify) {
  console.error('用法：node scripts/add-progress.mjs --version 0.33.1 --what "說明" --verify "驗證" [--commit abc1234]');
  process.exit(2);
}

const file = join(root, 'docs/進度.md');
const text = readFileSync(file, 'utf8');
const marker = '| 時間 | 項目 | 驗證 | Commit |\n|---|---|---|---|\n';
if (!text.includes(marker)) {
  console.error('找不到進度表頭，請先確認 docs/進度.md 結構');
  process.exit(1);
}

const d = new Date(Date.now() + 8 * 3600_000); // Asia/Macau
const stamp = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
const row = `| ${stamp}（v${version}） | ${what.replace(/\|/g, '\\|')} | ${verify.replace(/\|/g, '\\|')} | ${commit} |\n`;

const updated = text.replace(marker, marker + row);
writeFileSync(file, updated, 'utf8');
console.log('✔ 已插入：' + row.trim().slice(0, 100));

try {
  execFileSync('node', [join(root, 'scripts/check-docs.mjs')], { stdio: 'inherit' });
} catch {
  process.exit(1);
}
