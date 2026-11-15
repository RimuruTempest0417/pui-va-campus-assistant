#!/usr/bin/env node
/**
 * 首頁「今日待辦」卡（W-93）的邏輯守門（不需要開發者工具）。
 *
 * 為什麼要有：這張卡只顯示三行字，錯了畫面不會報錯 ——
 * 未交數算錯、取不到時顯示 0（讓人以為交清了）、放假卻寫「今天沒有下一節了」、
 * 家長看到自己的班級而不是子女的功課，這些都只有懂規則的人看得出。
 * 所以用固定輸入斷言輸出，並把「訪客不顯示」「單支失敗只降級一行」寫成測試。
 *
 * 用法：node scripts/check-todo.cjs
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const todo = require(path.join(root, 'utils', 'todo.js'));

let pass = 0;
const fails = [];

function check(name, ok, detail) {
  if (ok) pass += 1;
  else fails.push(name + (detail ? '：' + detail : ''));
}

function eq(name, got, want) {
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  check(name, a === b, '得到 ' + a + '，應為 ' + b);
}

function rowOf(rows, key) {
  return rows.filter((r) => r.key === key)[0] || null;
}

const HW = (todo, overdue, extra) =>
  Object.assign({ stats: { todo: todo, overdue: overdue } }, extra || {});
const TT = (extra) =>
  Object.assign({ schoolDay: true, dayOffReason: '', nextText: '數學 · 302（10:30）' }, extra || {});

// ── ① 訪客：整張卡不顯示（沒有功課也沒有通知） ──
eq('未登入（role 空）不顯示任何一行', todo.rows({ role: '', unread: 2 }), []);

// ── ② 學生：三行、順序固定、最後一行標 last ──
{
  const rows = todo.rows({ role: 'STUDENT', homework: HW(2, 0), timetable: TT(), unread: 4 });
  eq('學生三行', rows.length, 3);
  eq('順序：功課 → 下一節 → 通知', rows.map((r) => r.key), ['homework', 'timetable', 'notices']);
  eq('只有最後一行 last=true', rows.map((r) => !!r.last), [false, false, true]);
  check('每一行都有跳轉路徑', rows.every((r) => typeof r.route === 'string' && r.route.indexOf('/pages/') === 0));
  check('每一行的 value 都不是空字串', rows.every((r) => typeof r.value === 'string' && r.value.length > 0));
  check(
    'tone 只在四種裡（WXML 有對應的 class）',
    rows.every((r) => ['default', 'warn', 'ok', 'muted'].indexOf(r.tone) !== -1)
  );
}

// ── ③ 功課那行 ──
{
  eq('功課取不到 → 暫時取不到（不是 0）', todo.homeworkRow(null).value, '暫時取不到');
  eq('功課取不到 → tone muted', todo.homeworkRow(null).tone, 'muted');
  eq('沒班級 → —', todo.homeworkRow({ needsClass: true, stats: null }).value, '—');
  eq('沒班級 → 說明寫還沒有班級資料', todo.homeworkRow({ needsClass: true, stats: null }).detail, '還沒有班級資料');
  eq('都交了 → 都交了', todo.homeworkRow(HW(0, 0)).value, '都交了');
  eq('都交了 → tone ok', todo.homeworkRow(HW(0, 0)).tone, 'ok');
  eq('3 項未交、無逾期 → 3 項未交', todo.homeworkRow(HW(3, 0)).value, '3 項未交');
  eq('3 項未交、無逾期 → tone 不要警示', todo.homeworkRow(HW(3, 0)).tone, 'default');
  eq('有逾期 → 說明寫幾項逾期', todo.homeworkRow(HW(3, 1)).detail, '1 項已逾期');
  eq('有逾期 → tone warn', todo.homeworkRow(HW(3, 1)).tone, 'warn');
  eq('stats 缺欄位時不會變 NaN', todo.homeworkRow({ stats: {} }).value, '都交了');
}

// ── ④ 下一節那行 ──
{
  eq('課表取不到 → 暫時取不到', todo.timetableRow(null).value, '暫時取不到');
  eq('下一節直接用 nextText', todo.timetableRow(TT()).value, '數學 · 302（10:30）');
  eq('放假 → 寫出原因（與課表頁同一份）', todo.timetableRow(TT({ schoolDay: false, dayOffReason: '重陽節假期（校曆公告）' })).value, '重陽節假期（校曆公告）');
  eq('放假沒原因 → 今天不用上課', todo.timetableRow(TT({ schoolDay: false, dayOffReason: '', nextText: '' })).value, '今天不用上課');
  eq('放學後 → 今天沒有下一節了', todo.timetableRow(TT({ nextText: '' })).value, '今天沒有下一節了');
  eq('放學後 → tone muted', todo.timetableRow(TT({ nextText: '' })).tone, 'muted');
}

// ── ⑤ 未讀通知那行 ──
{
  eq('沒有未讀 → 沒有未讀', todo.noticeRow(0).value, '沒有未讀');
  eq('沒有未讀 → tone ok', todo.noticeRow(0).tone, 'ok');
  eq('5 則未讀', todo.noticeRow(5).value, '5 則未讀');
  eq('超過 99 就寫 99+（不撐爆版面）', todo.noticeRow(120).value, '99+ 則未讀');
  eq('未讀數拿不到 → 暫時取不到', todo.noticeRow(undefined).value, '暫時取不到');
  eq('未讀數不是數字（NaN）→ 暫時取不到', todo.noticeRow(NaN).value, '暫時取不到');
}

// ── ⑥ 家長：只兩行，看的是子女功課、沒有「下一節」 ──
{
  const rows = todo.rows({
    role: 'PARENT',
    kid: { homeworkTodo: 3, homeworkOverdue: 1 },
    homework: HW(9, 9), // 家長自己的功課不該被算進來
    timetable: TT(),
    unread: 1,
  });
  eq('家長兩行', rows.map((r) => r.key), ['kid', 'notices']);
  eq('家長那行數字來自子女', rowOf(rows, 'kid').value, '3 項未交');
  eq('家長那行有逾期就警示', rowOf(rows, 'kid').tone, 'warn');
  eq('家長看不到「下一節」', rowOf(rows, 'timetable'), null);
  eq('子女概要拿不到 → 暫時取不到', todo.kidRow(null).value, '暫時取不到');
  eq('子女還沒綁班級 → —', todo.kidRow({ homeworkTodo: null }).value, '—');
  eq('子女都交了', todo.kidRow({ homeworkTodo: 0, homeworkOverdue: 0 }).value, '都交了');
}

// ── ⑦ 單支失敗只降級那一行（其他行照常） ──
{
  const rows = todo.rows({ role: 'STUDENT', homework: null, timetable: TT(), unread: 3 });
  eq('功課失敗時通知那行仍是實際數字', rowOf(rows, 'notices').value, '3 則未讀');
  eq('課表仍正常', rowOf(rows, 'timetable').value, '數學 · 302（10:30）');
  check('功課失敗不會讓清單變空', rows.length === 3);
}

// ── ⑧ 跳轉路徑真的存在（避免打錯字，點下去 404） ──
{
  const rows = todo.rows({ role: 'STUDENT', homework: HW(1, 0), timetable: TT(), unread: 1 });
  for (const r of rows) {
    check(r.key + ' 的跳轉頁存在（' + r.route + '）', fs.existsSync(path.join(root, r.route.replace(/^\//, '') + '.js')));
  }
  check('家長那行的跳轉頁存在', fs.existsSync(path.join(root, 'pages', 'parent', 'index.js')));
}

// ── ⑨ 頁面真的有掛上這張卡（少一行 setData 就整張不見） ──
{
  const pageJs = fs.readFileSync(path.join(root, 'pages', 'index', 'index.js'), 'utf8');
  const pageWxml = fs.readFileSync(path.join(root, 'pages', 'index', 'index.wxml'), 'utf8');
  check('首頁 JS require 了 utils/todo.js', /require\('\.\.\/\.\.\/utils\/todo'\)/.test(pageJs));
  check('首頁 JS 有 todoRows/todoVisible', /todoRows:/.test(pageJs) && /todoVisible:/.test(pageJs));
  check('首頁 WXML 有 todoVisible 區塊', /wx:if="\{\{todoVisible\}\}"/.test(pageWxml));
  check('首頁 WXML 有 onTapTodo', /bindtap="onTapTodo"/.test(pageWxml));
  check('首頁 JS 有 onTapTodo 方法', /onTapTodo\s*\(/.test(pageJs));
}

if (fails.length) {
  console.error('❌ 今日待辦檢查失敗 ' + fails.length + ' 項（通過 ' + pass + ' 項）');
  for (const f of fails) console.error('   - ' + f);
  process.exit(1);
}
console.log('✅ 今日待辦檢查通過（' + pass + ' 項）');
