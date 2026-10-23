#!/usr/bin/env node
/**
 * 切換小程序 appid（同一個資料夾，兩邊共用程式碼）
 *
 *   node scripts/use-appid.mjs           → 顯示目前 appid 與可選清單
 *   node scripts/use-appid.mjs test      → 切回測試號
 *   node scripts/use-appid.mjs edu       → 切到教育版／正式主體
 *   node scripts/use-appid.mjs wx123456  → 直接指定 appid
 *
 * 為什麼要切：微信開發者工具把 appid 寫在 project.config.json，
 * 同一個資料夾只能有一個 appid；切換只改這一個欄位，程式碼完全共用。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cfgPath = join(root, 'project.config.json');
const mapPath = join(root, 'config/appids.json');

const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
const map = existsSync(mapPath) ? JSON.parse(readFileSync(mapPath, 'utf8')).appids || {} : {};
const arg = process.argv[2];

if (!arg) {
  console.log(`目前 appid：${cfg.appid}（${Object.values(map).find((v) => v.appid === cfg.appid)?.label || '未登記'}）\n`);
  console.log('可選：');
  for (const [k, v] of Object.entries(map)) {
    const mark = v.appid === cfg.appid ? ' ← 目前' : v.appid ? '' : '（尚未填寫 appid）';
    console.log(`  ${k.padEnd(6)} ${v.appid || '(空)'.padEnd(18)} ${v.label}${mark}`);
  }
  console.log('\n用法：node scripts/use-appid.mjs <test|edu|wx開頭的appid>');
  process.exit(0);
}

const next = map[arg]?.appid || (arg.startsWith('wx') ? arg : '');
if (!next) {
  console.error(`找不到 appid：${arg}${map[arg] ? '（' + map[arg].label + ' 的 appid 還沒填）' : ''}`);
  process.exit(1);
}
if (next === cfg.appid) {
  console.log(`已經是 ${next}，沒有變更。`);
  process.exit(0);
}
cfg.appid = next;
writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');
console.log(`✅ appid 已切換為 ${next}（${map[arg]?.label || '自訂'}）`);
console.log('提醒：回微信開發者工具按「重新編譯」，或用 wechatide close_project_window → open_project_window。');
