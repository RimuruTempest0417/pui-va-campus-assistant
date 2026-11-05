#!/usr/bin/env node
// 空狀態／載入狀態／失敗狀態一致性守門（19 頁對照表）。
// 用法：node scripts/check-states.mjs          檢查，不一致就 exit 1
//       node scripts/check-states.mjs --table  連同 Markdown 對照表一起印出（release note 用）
//
// 判定方式（全部靠 WXML／JS 文字，不需要開發者工具）：
//   載入中  <pv-skeleton> 或 wx:if="{{loading}}"
//   空狀態  <pv-empty> 或 *-empty class
//   失敗    failed／errorText／載入失敗／讀取失敗（要有分支，不是只有 toast）
// 每頁「該不該有」寫在 REQUIRE 表，dev/style-guide 這類頁面明確標成 N/A，避免為了湊數硬加。

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const wantTable = process.argv.includes('--table');

const REQUIRE = {
  'pages/index/index': { loading: true, empty: true, failed: true },
  'pages/search/index': { loading: true, empty: true, failed: true },
  'pages/items/list/index': { loading: true, empty: true, failed: true },
  'pages/items/detail/index': { loading: true, empty: true, failed: true },
  'pages/items/create/index': { loading: false, empty: false, failed: false, why: '純表單，提交時按鈕 loading' },
  'pages/items/mine/index': { loading: true, empty: true, failed: true },
  'pages/library/list/index': { loading: true, empty: true, failed: true },
  'pages/library/detail/index': { loading: true, empty: true, failed: true },
  'pages/library/mine/index': { loading: true, empty: true, failed: true },
  'pages/venues/list/index': { loading: true, empty: true, failed: true },
  'pages/venues/detail/index': { loading: true, empty: true, failed: true },
  'pages/venues/mine/index': { loading: true, empty: true, failed: true },
  'pages/giveaway/list/index': { loading: true, empty: true, failed: true },
  'pages/giveaway/detail/index': { loading: true, empty: true, failed: true },
  'pages/giveaway/create/index': { loading: false, empty: false, failed: false, why: '純表單頁：沒有載入／空／失敗三態，錯誤用彈窗' },
  'pages/giveaway/mine/index': { loading: true, empty: true, failed: true },
  'pages/events/list/index': { loading: true, empty: true, failed: true },
  'pages/events/detail/index': { loading: true, empty: true, failed: true },
  'pages/events/mine/index': { loading: true, empty: true, failed: true },
  'pages/events/checkin/index': { loading: false, empty: false, failed: false, why: '掃碼／輸入表單' },
  'pages/parent/index': { loading: true, empty: true, failed: true },
  'pages/menu/index/index': { loading: true, empty: true, failed: true },
  'pages/menu/dish/index': { loading: true, empty: true, failed: true },
  'pages/notices/list/index': { loading: true, empty: true, failed: true },
  'pages/notices/detail/index': { loading: true, empty: true, failed: true },
  'pages/calendar/index': { loading: true, empty: true, failed: true },
  'pages/admin/login/index': { loading: false, empty: false, failed: false, why: '登入表單，錯誤寫在 error 欄位' },
  'pages/admin/index/index': { loading: true, empty: true, failed: true },
  'pages/style-guide/index': { loading: false, empty: false, failed: false, why: '設計基準頁，資料寫死' },
  'pages/dev/api-check/index': { loading: false, empty: false, failed: false, why: '自檢頁，結果本身就是清單' },
  'pages/settings/index': { loading: false, empty: false, failed: false, why: '設定頁，偏好全在本機 storage，沒有網路載入' },
  'pages/print/items/index': { loading: true, empty: true, failed: true },
  'pages/print/event/index': { loading: true, empty: true, failed: true },
  'pages/notifications/index': { loading: true, empty: true, failed: true },
  'pages/help/index': { loading: false, empty: false, failed: false, why: '站內說明，內容寫死沒有網路載入' },
  'pages/school/index': { loading: true, empty: true, failed: true },
};

const DETECT = {
  loading: (wxml) => /<pv-skeleton/.test(wxml) || /wx:(?:if|elif)="\{\{\s*loading\s*\}\}"/.test(wxml),
  empty: (wxml) => /<pv-empty/.test(wxml) || /class="[^"]*-empty/.test(wxml),
  failed: (wxml) => /(wx:(?:if|elif)="\{\{\s*failed\s*\}\}")|errorText|載入失敗|讀取失敗/.test(wxml),
};

const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8'));
const pages = app.pages || [];
const rows = [];
const problems = [];

for (const page of pages) {
  const wxmlPath = join(root, page + '.wxml');
  const jsPath = join(root, page + '.js');
  const req = REQUIRE[page];
  if (!req) {
    problems.push(`未在 REQUIRE 表登記的頁面：${page}（新頁面要一起想清楚三態）`);
    continue;
  }
  if (!existsSync(wxmlPath)) {
    problems.push(`頁面缺檔：${page}.wxml`);
    continue;
  }
  const wxml = readFileSync(wxmlPath, 'utf8');
  const js = existsSync(jsPath) ? readFileSync(jsPath, 'utf8') : '';
  const got = {
    loading: DETECT.loading(wxml),
    empty: DETECT.empty(wxml),
    failed: DETECT.failed(wxml),
  };
  const marks = {};
  for (const k of ['loading', 'empty', 'failed']) {
    if (!req[k]) marks[k] = 'N/A';
    else if (got[k]) marks[k] = '✓';
    else {
      marks[k] = '✗';
      problems.push(`${page}：缺 ${k} 態`);
    }
  }
  // 失敗態只靠 toast（catch 裡沒有 setData）也是缺：抓「catch 之後沒有 failed」
  const catchCount = (js.match(/catch \(/g) || []).length;
  const failedInJs = /failed/.test(js);
  rows.push({
    page,
    marks,
    why: req.why || '',
    toastOnly: req.failed && !failedInJs && catchCount > 0 ? `catch×${catchCount} 只有 toast` : '',
  });
}

const cell = (v) => (v === '✓' ? '✓' : v === 'N/A' ? '—' : '**✗**');

if (wantTable) {
  console.log('| # | 頁面 | 載入中 | 空狀態 | 失敗（可重試） | 備註 |');
  console.log('|---|---|---|---|---|---|');
  rows.forEach((r, i) => {
    console.log(`| ${i + 1} | \`${r.page}\` | ${cell(r.marks.loading)} | ${cell(r.marks.empty)} | ${cell(r.marks.failed)} | ${r.why || r.toastOnly || ''} |`);
  });
  console.log('');
}

if (problems.length) {
  console.log(`空／載入／失敗狀態不一致：${problems.length} 處`);
  for (const p of problems) console.log('  ✗ ' + p);
  process.exit(1);
}
console.log(`空／載入／失敗狀態：${rows.length} 頁全部符合 REQUIRE 表`);
