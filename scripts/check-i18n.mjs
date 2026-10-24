#!/usr/bin/env node
// 繁簡介面守門（不需要開發者工具）：
//   ① 簡體模式下 i18n.pick() 真的會變（不是靜默回傳繁體）
//   ② 對照表每一組的簡體值裡不得殘留只在繁體出現的字（漏轉的典型症狀）
//   ③ 頁面 WXML 用到的每一條 L.* 都由該頁 labels() 提供（漏了＝整頁空白字）
// 用法：node scripts/check-i18n.mjs
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const store = new Map([['pv_locale', 'zh-Hans']]);
globalThis.wx = {
  getStorageSync: (k) => (store.has(k) ? store.get(k) : ''),
  setStorageSync: (k, v) => void store.set(k, v),
  removeStorageSync: (k) => void store.delete(k),
  getAppBaseInfo: () => ({ language: 'zh_CN' }),
};

const i18n = require(join(root, 'utils', 'i18n.js'));
const PHRASES = require(join(root, 'utils', 'i18n-phrases.js'));

const problems = [];
let ok = 0;

// ① 抽樣斷言：這些字在簡體一定要變（opencc t2s 的輸出）
{
  const pairs = [
    ['失物招領', '失物招领'],
    ['活動與社團', '活动与社团'],
    ['已轉正 ', '已转正 '],
    ['候補第 ', '候补第 '],
    ['名額已滿', '名额已满'],
    ['請先登入', '请先登录'],
    ['待認領', '待认领'],
  ];
  for (const [hant, hans] of pairs) {
    const got = i18n.pick(hant);
    if (got === hans) ok += 1;
    else problems.push(`pick('${hant}') 應為「${hans}」，實得「${got}」`);
  }
  if (i18n.isHans() !== true) problems.push('pv_locale=zh-Hans 時 i18n.isHans() 應為 true');
  else ok += 1;
}

// ② 對照表：繁體字不得殘留在簡體值裡（只看「一定會變」的字，避免把同形字當錯）
{
  const ALWAYS = '筆则个张报课错误设计开关读写页饭后历载体验证号码级称会员学应认领检举审计记录数据统计选单转额满当间务类别标题内说';
  const TRAD = '筆則個張報課錯誤設計開關讀寫頁飯後歷載體驗證號碼級稱會員學應認領檢舉審計記錄數據統計選單轉額滿當間務類別標題內說';
  const bad = [];
  for (const [k, v] of Object.entries(PHRASES)) {
    if (k === v) continue;
    for (const ch of k) {
      if (!TRAD.includes(ch)) continue;
      if (v.includes(ch)) { bad.push([k, v, ch]); break; }
    }
  }
  if (!bad.length) ok += 1;
  else for (const [k, v, ch] of bad.slice(0, 10)) problems.push(`對照表「${k}」→「${v}」殘留繁體字「${ch}」（跑 python3 scripts/build-i18n-phrases.py）`);
  if (!ALWAYS) problems.push('ALWAYS 不應為空');
}

// ③ WXML 的 L.* 必須由該頁 labels() 提供
{
  const pages = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')).pages || [];
  for (const page of pages) {
    const wxmlPath = join(root, page + '.wxml');
    const jsPath = join(root, page + '.js');
    if (!existsSync(wxmlPath) || !existsSync(jsPath)) continue;
    const wxml = readFileSync(wxmlPath, 'utf8');
    const used = new Set([...wxml.matchAll(/\{\{\s*L\.([A-Za-z0-9_]+)/g)].map((m) => m[1]));
    if (!used.size) continue;
    const js = readFileSync(jsPath, 'utf8');
    const lm = js.match(/labels\(\)\s*\{[\s\S]*?return\s*\{([\s\S]*?)\n\s*\};/);
    if (!lm) { problems.push(`${page}：WXML 用到 L.* 但 JS 沒有 labels()`); continue; }
    const provided = new Set([...lm[1].matchAll(/([A-Za-z0-9_]+)\s*:/g)].map((m) => m[1]));
    const missing = [...used].filter((k) => !provided.has(k));
    if (missing.length) problems.push(`${page}：WXML 的 L.${missing.join('、L.')} 沒有在 labels() 提供（會是空字串）`);
    else ok += 1;
  }
}

if (problems.length) {
  for (const p of problems) console.error(`❌ ${p}`);
  console.error(`\n檢查失敗：${problems.length} 個問題（通過 ${ok} 項）`);
  process.exit(1);
}
console.log(`✅ 繁簡介面檢查通過（${ok} 項：pick 抽樣／對照表殘留／L.* 供應）`);
