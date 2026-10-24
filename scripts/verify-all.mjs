#!/usr/bin/env node
// 一鍵驗收：把五支守門腳本串起來跑完並彙總（夜間隊列 #10）。
//
// 用法：
//   node scripts/verify-all.mjs                # 五項全跑（console 需要開發者工具開著本專案）
//   node scripts/verify-all.mjs --no-console   # 只跑不需要 DevTools 的四項（改文件／CI 用）
//   node scripts/verify-all.mjs --strict       # 略過也算不通過（交付前、要簽名的驗收用這個）
//   node scripts/verify-all.mjs --only project,data
//   node scripts/verify-all.mjs --verbose      # 每一步都印完整輸出（預設只在失敗時印）
//
// 為什麼要有這支：五支腳本各自的 exit code 有意義，但每晚要人工記「哪幾支跑過、哪支紅」。
// 這支把順序固定（結構 → API 契約 → 三態 → 資料層 → console），失敗時直接把該步完整輸出貼出來，
// 不必再回頭重跑一次才知道錯在哪；console 在 DevTools 沒開時標成「略過（未驗）」而不是假綠。

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const args = process.argv.slice(2);
const noConsole = args.includes('--no-console');
const strict = args.includes('--strict');
const verbose = args.includes('--verbose');
const only = args.includes('--only')
  ? args[args.indexOf('--only') + 1].split(',').map((s) => s.trim()).filter(Boolean)
  : null;
const STEP_TIMEOUT = 600000; // console 走查 19 頁實測約 2–4 分鐘，留足餘裕

const STEPS = [
  { key: 'project', label: '專案結構', script: 'check-project.mjs', args: [], highlight: /✅ 專案結構檢查通過[^\n]*/ },
  { key: 'openapi', label: 'API 契約', script: 'check-openapi.mjs', args: [], highlight: /✅ OpenAPI 契約檢查通過[^\n]*/ },
  { key: 'states', label: '三態一致', script: 'check-states.mjs', args: [], highlight: /空／載入／失敗狀態：[^\n]*/ },
  { key: 'data', label: '資料層', script: 'check-data-layer.mjs', args: [], highlight: /\b(?:ALL PASS|FAIL) \d+\/\d+\b/ },
  { key: 'docs', label: '文件一致性', script: 'check-docs.mjs', args: [], highlight: /✅ 文件一致性通過[^\n]*/ },
  // console 走查要對齊「0 error／0 warn」的驗收標準，所以預設把 warn 也算不通過
  { key: 'console', label: 'console 走查', script: 'check-console.mjs', args: ['--warn'], needsIde: true, highlight: /console 走查：[^\n]*/ },
];

function tail(text, lines = 120) {
  const all = String(text).replace(/\s+$/, '').split('\n');
  if (all.length <= lines) return all;
  return ['…（前面 ' + (all.length - lines) + ' 行已省略）', ...all.slice(-lines)];
}

/** DevTools 沒開時 wechatide 會直接失敗；先問一次狀態，避免把「工具沒開」記成「頁面有錯」 */
function ideReady() {
  const r = spawnSync('wechatide', ['-c', 'hermes', 'check_wechatide_status', '--skill-version', '0.3.11'], {
    encoding: 'utf8',
    timeout: 30000,
  });
  const out = r.stdout || '';
  const start = out.indexOf('{');
  if (start === -1) return { ready: false, why: 'wechatide 沒有回狀態' };
  try {
    const body = JSON.parse(out.slice(start));
    const res = body.result || {};
    if (!body.ok) return { ready: false, why: String(body.message || 'check_wechatide_status 回 ok:false') };
    if (res.loginExpired) return { ready: false, why: '開發者工具登入已過期' };
    return { ready: true, version: res.skillVersion || '' };
  } catch (e) {
    return { ready: false, why: '狀態回傳不是 JSON' };
  }
}

const results = [];
const startedAll = Date.now();

for (const step of STEPS) {
  if (only && !only.includes(step.key)) continue;
  if (step.key === 'console' && noConsole) {
    results.push({ ...step, status: 'skip', why: '--no-console', ms: 0, out: '' });
    continue;
  }

  const file = join(root, 'scripts', step.script);
  if (!existsSync(file)) {
    results.push({ ...step, status: 'fail', why: '找不到 scripts/' + step.script, ms: 0, out: '' });
    continue;
  }

  if (step.needsIde) {
    const ready = ideReady();
    if (!ready.ready) {
      results.push({ ...step, status: 'skip', why: '開發者工具未就緒：' + ready.why, ms: 0, out: '' });
      continue;
    }
  }

  console.log('\n━━ ' + step.label + '（node scripts/' + step.script + (step.args.length ? ' ' + step.args.join(' ') : '') + '）');
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [file, ...step.args], {
    cwd: root,
    encoding: 'utf8',
    timeout: STEP_TIMEOUT,
    maxBuffer: 32 * 1024 * 1024,
  });
  const ms = Date.now() - t0;
  const out = '' + (r.stdout || '') + (r.stderr || '');
  const timedOut = !!(r.error && r.error.code === 'ETIMEDOUT');
  const status = !timedOut && r.status === 0 ? 'pass' : 'fail';
  const line = ((out.match(step.highlight) || [])[0]
    || out.trim().split('\n').filter(Boolean).pop()
    || '').trim().replace(/^[\u2705\u274c\u26a0\ufe0f\s]+/u, '');

  if (status === 'pass') {
    console.log('✅ ' + (line || '通過') + '（' + (ms / 1000).toFixed(1) + 's）');
    if (verbose) for (const l of out.trim().split('\n')) console.log('   ' + l);
  } else {
    console.log('❌ ' + (timedOut ? '逾時 ' + STEP_TIMEOUT / 1000 + 's' : '不通過') + '（' + (ms / 1000).toFixed(1) + 's）');
    for (const l of tail(out)) console.log('   ' + l);
  }

  results.push({ ...step, status, why: status === 'fail' ? (timedOut ? '逾時' : 'exit ' + r.status) : '', line, ms, out });
}

// ── 彙總：固定三段，一眼看得出「有沒有跑、跑過幾項、紅的是哪一項」──
const pad = (s, n) => {
  const w = [...String(s)].reduce((a, c) => a + (c.charCodeAt(0) > 127 ? 2 : 1), 0);
  return String(s) + ' '.repeat(Math.max(0, n - w));
};
const passed = results.filter((r) => r.status === 'pass');
const failed = results.filter((r) => r.status === 'fail');
const skipped = results.filter((r) => r.status === 'skip');

console.log('\n━━━━━━━━ 驗收彙總 ━━━━━━━━');
for (const r of results) {
  const mark = r.status === 'pass' ? '✅' : r.status === 'fail' ? '❌' : '⏭️ ';
  const detail = r.status === 'skip' ? '略過（' + r.why + '）' : r.line || r.why || '';
  console.log(mark + ' ' + pad(r.label, 12) + ' ' + pad(detail, 34) + ' ' + (r.ms ? (r.ms / 1000).toFixed(1) + 's' : ''));
}
const seconds = ((Date.now() - startedAll) / 1000).toFixed(1);
console.log('\n→ ' + passed.length + ' 通過、' + failed.length + ' 失敗、' + skipped.length + ' 略過，共 ' + seconds + 's');
if (skipped.length) {
  console.log('⚠️  略過的項目等於「未驗」，不能當成通過：' + skipped.map((r) => r.label).join('、'));
  if (skipped.some((r) => r.key === 'console')) {
    console.log('    開著開發者工具跑 `node scripts/verify-all.mjs --only console`；交付前用 --strict 確認。');
  }
}

if (failed.length || (strict && skipped.length)) {
  if (strict && skipped.length) console.log('（--strict：略過也算不通過）');
  process.exit(1);
}
console.log('全部綠燈' + (skipped.length ? '（含未驗項目，見上）' : ''));
