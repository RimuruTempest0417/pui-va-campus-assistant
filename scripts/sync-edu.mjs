#!/usr/bin/env node
/**
 * 同步程式碼到教育版資料夾（../exam-edu）
 *
 *   node scripts/sync-edu.mjs        第一次會建立 ../exam-edu，之後只同步有變動的程式碼
 *
 * 為什麼要有第二個資料夾：
 *   project.config.json 的 appid 是「一個資料夾一個」，
 *   測試號與教育版 appid 不同 → 同一資料夾只能輪流開。
 *   分成兩個資料夾後，兩個開發者工具可以同時開，改完一行指令同步。
 *
 * 不會覆蓋的東西：project.config.json / project.private.config.json（各自的 appid 與個人設定）
 */
import { cpSync, existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dest = join(root, '..', 'exam-edu');
const SKIP = new Set(['.git', 'node_modules', 'minitest', 'dist', 'project.config.json', 'project.private.config.json', '.DS_Store']);

cpSync(root, dest, {
  recursive: true,
  filter: (src) => {
    const name = src.split('/').pop();
    if (SKIP.has(name)) return false;
    if (name.startsWith('.')) return false;
    return true;
  },
});

// 教育版自己的 project.config.json（appid 從 config/appids.json 取）
const map = JSON.parse(readFileSync(join(root, 'config/appids.json'), 'utf8')).appids;
const eduAppid = map.edu && map.edu.appid;
if (!eduAppid) {
  console.error('config/appids.json 的 edu.appid 還是空的，先填教育版 AppID');
  process.exit(1);
}
const base = JSON.parse(readFileSync(join(root, 'project.config.json'), 'utf8'));
base.appid = eduAppid;
base.projectname = 'pui-va-campus-assistant-edu';
writeFileSync(join(dest, 'project.config.json'), JSON.stringify(base, null, 2) + '\n');

// 統計
const count = (dir) => readdirSync(dir, { withFileTypes: true }).reduce((n, e) => {
  if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'minitest') return n;
  return n + (e.isDirectory() ? count(join(dir, e.name)) : 1);
}, 0);

console.log(`✅ 已同步到 ${dest}`);
console.log(`   appid：${eduAppid}（教育版）`);
console.log(`   檔案：${count(dest)} 個`);
console.log('   在教育版開發者工具導入這個資料夾即可；之後每次改完再跑一次這行。');
if (existsSync(join(dest, 'minitest'))) console.log('   （minitest 未同步，屬個人設定）');
