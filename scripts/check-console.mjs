#!/usr/bin/env node
// 19 頁 console 走查（error／warn）＋「這頁真的畫出東西了嗎」—— 需要開發者工具開著這個專案。
// 用法：node scripts/check-console.mjs            走完 19 頁，有任何 error 就 exit 1
//       node scripts/check-console.mjs --only items-list
//       node scripts/check-console.mjs --warn      連 warn 也算不通過（預設只列出）
//
// 原理：app.js onLaunch 會用 utils/diagnostics.js 把 console.error／console.warn 包一層寫進 storage `pv_diag`。
// 這支腳本逐頁「清空 → 開頁 → 等載入完 → 讀回」，判定不依賴人眼看 DevTools 面板。
// 為什麼不用 get_simulator_console：實測 skill v0.3.11 只回啟動那兩行（WeChatLib／Lazy code loading），
// 連我們自己在 evaluate 裡 console.error 的測試字串都抓不到（已實測）→ 拿它當走查等於永遠假綠。
//
// 第二欄「內容」是防空綠：console 沒紅不代表畫得出來（線上 API 掛掉時頁面只進 failed 狀態，不會 console.error）。
// 所以順便讀一次當前頁 data 的陣列／物件長度，並輪詢到 loading=false 才判定（固定 sleep 會誤判「還在載入」）。

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : '';
const warnFails = args.includes('--warn');
const debug = args.includes('--debug');
const settle = args.includes('--settle') ? Number(args[args.indexOf('--settle') + 1]) : 9000;

const API = 'https://pui-va-campus-server.vercel.app/api/v1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 詳情頁要有真實 id 才走得到內容分支；抓不到就退回無 id（只驗「不會炸」，不驗內容）
async function sampleIds() {
  const ids = {};
  const probe = async (path, key) => {
    try {
      const res = await fetch(API + path, { headers: { 'content-type': 'application/json' } });
      if (!res.ok) return;
      const body = await res.json();
      const list = body.data || body.items || body.notices || body.dishes || body.events || [];
      const first = Array.isArray(list) ? list[0] : null;
      if (first && first.id) ids[key] = first.id;
    } catch (e) {
      // 沒網路就跳過，腳本仍然能跑（詳情頁走「找不到內容」分支）
    }
  };
  await probe('/items?page=1&pageSize=1', 'item');
  await probe('/events?page=1&pageSize=1', 'event');
  await probe('/notices?page=1&pageSize=1', 'notice');
  // 菜單詳情：dish id 只在 /menu/week 的 days[].lunch／snack 裡（/dishes/top 沒評分時是空的）
  try {
    const res = await fetch(API + '/menu/week', { headers: { 'content-type': 'application/json' } });
    if (res.ok) {
      const body = await res.json();
      const day = (body.days || [])[0] || {};
      const first = (day.lunch || [])[0] || (day.snack || [])[0];
      if (first && first.id) ids.dish = first.id;
    }
  } catch (e) {
    // 沒網路就跳過
  }
  return ids;
}

function cli(tool, flags) {
  // 用 spawnSync 而不是 execFileSync：工具回 ok:false 時 exit code 非 0，
  // execFileSync 會直接 throw，把有用的 JSON 錯誤訊息吃掉。
  const res = spawnSync('wechatide', ['-c', 'hermes', tool, '--project', root, ...flags], { encoding: 'utf8' });
  const out = res.stdout || '';
  const start = out.indexOf('{');
  if (start === -1) throw new Error(tool + ' 沒有回 JSON：' + (res.stderr || out).slice(0, 200));
  return JSON.parse(out.slice(start));
}

// CLI 回的是 { ok, result: { success, result: { result: <值> } } } → 逐層剝到真正的值
function unwrap(res) {
  let out = res.result.result;
  while (out && typeof out === 'object' && !Array.isArray(out) && Object.prototype.hasOwnProperty.call(out, 'result')) {
    out = out.result;
  }
  return out;
}

/**
 * automator 連線偶發會掛掉（skill 記載：timeout waiting for automator response），
 * 一次失敗不代表頁面有問題 → 重試 3 次，每次間隔 900ms。三次都掛才當工具層失敗。
 */
async function evaluate(source) {
  let why = 'evaluate 失敗';
  for (let i = 0; i < 3; i++) {
    const res = cli('automation_evaluate', ['--fn-source', source]);
    if (res.ok && res.result && res.result.success !== false) return unwrap(res);
    why = String((res.result && res.result.error) || res.message || 'evaluate 失敗');
    if (debug) console.error('EVAL_RETRY ' + why);
    await sleep(900);
  }
  throw new Error(why);
}

const CLEAR = 'function(){ wx.removeStorageSync("pv_diag"); return "cleared"; }';
const READ = 'function(){ return JSON.stringify(wx.getStorageSync("pv_diag") || []); }';
// 看這頁有沒有真的畫出東西：把常見清單／物件欄位長度加總
const PROBE = [
  'function(){',
  '  var ps = getCurrentPages();',
  '  var p = ps[ps.length - 1];',
  '  var d = (p && p.data) || {};',
  '  var n = 0;',
  '  var keys = ["list","items","events","notices","dishes","days","children","links","cells","tabs","stats","rows","me","dish","notice","item","event","modules","top","banners","users","reports","claims","parents","menu","weeks"];',
  '  for (var i = 0; i < keys.length; i++) {',
  '    var v = d[keys[i]];',
  '    if (Array.isArray(v)) n += v.length;',
  '    else if (v && typeof v === "object") n += Object.keys(v).length;',
  '  }',
  '  return JSON.stringify({ route: (p && p.route) || "", n: n, failed: !!d.failed, loading: !!d.loading });',
  '}',
].join('\n');

/** 開頁後輪詢到 loading=false（或逾時），避免固定 sleep 造成「還在載入」的假判定 */
async function settlePage() {
  const started = Date.now();
  let last = {};
  while (Date.now() - started < settle) {
    await sleep(700);
    try {
      const raw = await evaluate(PROBE);
      last = typeof raw === 'string' ? JSON.parse(raw) : raw || {};
    } catch (e) {
      if (debug) console.error('PROBE_ERR ' + (e && e.message));
      last = {};
    }
    if (!last.loading) return last;
  }
  return last;
}

const entries = await sampleIds();
const app = JSON.parse(readFileSync(`${root}/app.json`, 'utf8'));
const pages = app.pages || [];

const QUERY = {
  'pages/items/detail/index': entries.item ? `id=${entries.item}` : '',
  'pages/events/detail/index': entries.event ? `id=${entries.event}` : '',
  'pages/notices/detail/index': entries.notice ? `id=${entries.notice}` : '',
  'pages/menu/dish/index': entries.dish ? `id=${entries.dish}` : '',
};

const rows = [];
const problems = [];
const notices = [];
const frameworkNoise = [];

for (const page of pages) {
  const name = page.replace(/^pages\//, '').replace(/\/index$/, '');
  if (only && name !== only && page !== only) continue;

  try {
    await evaluate(CLEAR);
    const flags = ['--page', page];
    const q = QUERY[page];
    if (q) flags.push('--query', q);
    cli('simulator_open_page', flags);
    // 剛開頁時 automator 常還沒接上 → 先給它一點時間，再開始輪詢
    await sleep(900);
    const probe = await settlePage();
    const raw = await evaluate(READ);
    const list = Array.isArray(raw) ? raw : JSON.parse(raw || '[]');
    const errors = list.filter((e) => e.level === 'error');
    const warns = list.filter((e) => e.level === 'warn');
    rows.push({ page, errors, warns, q, probe });
    // 「routeDone with a webviewId … is not found」是腳本快速切頁時框架自己印的競態（單獨開這頁不會出現，已實測），
    // 不是頁面程式的錯 → 只列出、不算失敗；其餘 error 一律不通過。
    const isFrameworkRace = (t) => /routeDone with a webviewId/.test(String(t));
    for (const e of errors) {
      if (isFrameworkRace(e.text)) frameworkNoise.push(`${page}：${e.text}`);
      else problems.push(`${page} [error] ${e.text}`);
    }
    if (warnFails) for (const w of warns) problems.push(`${page} [warn] ${w.text}`);
    if (probe.failed) notices.push(`${page}：頁面進 failed 狀態（console 沒紅，但是載入失敗）`);
    else if (probe.loading) notices.push(`${page}：${settle}ms 後仍在 loading`);
    else if (probe.route === undefined) notices.push(`${page}：探針沒讀到頁面資料（automator 沒接上）`);
  } catch (err) {
    const stackLines = String(err.stack || '').split(String.fromCharCode(10));
    const dbg = debug ? ' @ ' + stackLines.slice(1, 4).join(' | ') : '';
    problems.push(`${page} 走查失敗（工具層）：${String(err.message || err).slice(0, 160)}${dbg}`);
    rows.push({ page, errors: [], warns: [], crashed: true });
  }
}

const pad = (s, n) => String(s) + ' '.repeat(Math.max(0, n - String(s).length));
console.log(pad('頁面', 34) + pad('error', 8) + pad('warn', 6) + pad('內容', 6) + '備註');
for (const r of rows) {
  const p = r.probe || {};
  const flags = [];
  if (r.crashed) flags.push('工具層失敗');
  if (r.q) flags.push(`query ${r.q}`);
  if (p.failed) flags.push('failed=true');
  if (p.loading) flags.push('仍在 loading');
  if (!r.crashed && !p.loading && p.n === 0 && !p.failed) flags.push('內容 0 筆（空狀態）');
  const content = p.n === undefined ? '-' : p.n;
  console.log(pad(r.page, 34) + pad(r.errors.length, 8) + pad(r.warns.length, 6) + pad(content, 6) + flags.join('、'));
}

for (const n of frameworkNoise) console.log("  ~ " + n);
for (const n of notices) console.log("  ! " + n);

if (problems.length) {
  console.log(`\nconsole 走查不通過：${problems.length} 處`);
  for (const p of problems) console.log('  ✗ ' + p.slice(0, 300));
  process.exit(1);
}
const totalWarn = rows.reduce((n, r) => n + r.warns.length, 0);
console.log(`\nconsole 走查：${rows.length} 頁 0 error${totalWarn ? `、${totalWarn} 則 warn（未計入失敗）` : '、0 warn'}${notices.length ? `；另有 ${notices.length} 項待查（見上）` : ''}`);
