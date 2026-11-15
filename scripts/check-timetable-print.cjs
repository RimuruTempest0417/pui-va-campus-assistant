#!/usr/bin/env node
// 課表列印／存成圖片（W-83）守門
//
// 為什麼要這支：Canvas 畫錯不會拋例外、也不會進 console —— 座標是 NaN 就只是「一片空白」，
// 顏色傳成 undefined 就只是「什麼都沒畫」。這種錯只有實際跑一次繪圖才看得出來，
// 所以用假 ctx 把 draw() 的每個呼叫記錄下來逐項斷言。
//
// 用法：node scripts/check-timetable-print.cjs
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = process.cwd();
const grid = require(join(root, 'utils', 'timetableGrid.js'));

let pass = 0;
const fails = [];
function ok(cond, label) {
  if (cond) {
    pass += 1;
    return;
  }
  fails.push(label);
}

// ── 1. 攤平成格子 ───────────────────────────────────────────────
const periods = [1, 2, 3, 4, 5, 6, 7, 8].map((p) => ({
  period: p,
  startTime: '0' + p + ':00',
  endTime: '0' + p + ':40',
}));
const weekdays = [1, 2, 3, 4, 5].map((d) => ({ weekday: d, label: '星期' + d }));
const slots = [
  { weekday: 1, period: 1, subject: '中文', room: '302', teacherName: '陳老師' },
  { weekday: 3, period: 2, subject: '數學', room: '', teacherName: '李老師' },
  { weekday: 5, period: 8, subject: '體育', room: '操場', teacherName: '' },
];
const built = grid.buildGrid({ periods, weekdays, slots });

ok(built.rows.length === 8, `節次列數應為 8，實際 ${built.rows.length}`);
ok(built.weekdays.length === 5, `星期欄數應為 5，實際 ${built.weekdays.length}`);
ok(built.total === 40, `格子總數應為 40，實際 ${built.total}`);
ok(built.filled === 3, `有課格子應為 3，實際 ${built.filled}`);
ok(built.rows[0].cells[0].subject === '中文', '星期一第 1 節應是中文');
ok(built.rows[0].cells[0].meta === '302 · 陳老師', `第 1 格說明應為「302 · 陳老師」，實際「${built.rows[0].cells[0].meta}」`);
// 課室與老師要分開放：紙上／圖上一行放不下「實驗室 B · 吳老師」，合成一句一定被截一半
ok(built.rows[0].cells[0].room === '302' && built.rows[0].cells[0].teacher === '陳老師', '課室與老師要各自一個欄位');
ok(built.rows[1].cells[2].subject === '數學', '星期三第 2 節應是數學');
ok(built.rows[1].cells[2].meta === '李老師', '沒課室時說明只留老師，不該出現多餘的分隔符');
ok(built.rows[7].cells[4].meta === '操場', '沒老師時說明只留課室');
ok(built.rows[1].cells[0].empty === true, '沒課的格子要標成 empty（紙上留白）');
ok(built.rows[1].cells[0].subject === '', '空格子的科目應是空字串，不是 undefined');
ok(built.rows[0].timeText === '01:00–01:40', `節次時間應串成「起–迄」，實際「${built.rows[0].timeText}」`);

// 同一格兩筆（後端唯一鍵擋得住，但示範資料可能髒）→ 後面的覆蓋前面的，格子只會出現一次
const dirty = grid.buildGrid({
  periods: periods.slice(0, 1),
  weekdays: weekdays.slice(0, 1),
  slots: [
    { weekday: 1, period: 1, subject: '舊' },
    { weekday: 1, period: 1, subject: '新' },
  ],
});
ok(dirty.filled === 1, '同一格重複資料只算一格');
ok(dirty.rows[0].cells[0].subject === '新', '同一格重複資料取最後一筆');

// 完全沒有課表：不能拋錯（空狀態由頁面判斷）
const blank = grid.buildGrid({ periods, weekdays, slots: [] });
ok(blank.filled === 0 && blank.rows.length === 8, '沒有課表時仍要產生空白格子');
const nothing = grid.buildGrid({});
ok(nothing.rows.length === 0 && nothing.total === 0, '完全沒有資料時要回空網格而不是拋錯');

// ── 2. 本週區間 ────────────────────────────────────────────────
const sat = grid.weekRange(new Date(2026, 10, 7)); // 2026-11-07 星期六
ok(sat.text === '11/02–11/06', `週六應回本週一到週五，實際「${sat.text}」`);
ok(sat.from === '2026/11/02' && sat.to === '2026/11/06', `週區間應為 11/02–11/06，實際 ${sat.from}–${sat.to}`);
const mon = grid.weekRange(new Date(2026, 10, 2)); // 星期一
ok(mon.text === '11/02–11/06', `星期一應回同一個區間，實際「${mon.text}」`);
const sun = grid.weekRange(new Date(2026, 10, 8)); // 星期日屬於上一個週次
ok(sun.text === '11/02–11/06', `星期日應算上一週，實際「${sun.text}」`);
ok(grid.weekRange('').text === '', '日期壞掉時回空字串（不要顯示 NaN）');

// ── 3. 圖片版面 ────────────────────────────────────────────────
const p8 = grid.imagePlan(8);
const p9 = grid.imagePlan(9);
ok(p8.width === 1080, `圖寬固定 1080，實際 ${p8.width}`);
ok(p8.height > 0 && Number.isFinite(p8.height), '圖高必須是有限數字');
ok(p9.height - p8.height === p8.rowH, '多一節就多一個列高（版面不能重疊）');
ok(p8.dayColW > 100, `每欄寬度要夠放 5 個中文字，實際 ${p8.dayColW}`);
ok(p8.pad * 2 + p8.headH + p8.theadH + 8 * p8.rowH + p8.footH === p8.height, '版面高度要等於各區塊之和');
ok(grid.imagePlan(0).rows === 1, '沒有節次時至少留一列（不要回 0 高）');
ok(grid.imagePlan('x').rows === 1, '亂傳參數也不能回 NaN');

// ── 4. 實際畫一次（假 ctx 記錄所有呼叫）────────────────────────
function fakeCtx() {
  const calls = [];
  return {
    calls,
    set fillStyle(v) {
      calls.push(['fillStyle', v]);
    },
    set strokeStyle(v) {
      calls.push(['strokeStyle', v]);
    },
    set font(v) {
      calls.push(['font', v]);
    },
    set lineWidth(v) {
      calls.push(['lineWidth', v]);
    },
    set textBaseline(v) {
      calls.push(['textBaseline', v]);
    },
    set textAlign(v) {
      calls.push(['textAlign', v]);
    },
    fillRect: (...a) => calls.push(['fillRect', ...a]),
    fillText: (...a) => calls.push(['fillText', ...a]),
    beginPath: () => calls.push(['beginPath']),
    moveTo: (...a) => calls.push(['moveTo', ...a]),
    lineTo: (...a) => calls.push(['lineTo', ...a]),
    stroke: () => calls.push(['stroke']),
  };
}

const colors = {
  surface: '#FFFFFF',
  ink: '#000000',
  inkSoft: 'rgba(60, 60, 67, 0.6)',
  rule: 'rgba(60, 60, 67, 0.29)',
};
const plan = grid.imagePlan(built.rows.length);
const ctx = fakeCtx();
grid.draw(ctx, {
  plan,
  title: '高二仁 班級課表',
  sub: '本週 11/02–11/06　列印時間 2026/11/07',
  colPeriod: '節次',
  weekdays: built.weekdays.map((d) => d.label),
  rows: built.rows,
  footNote: '培華校園助手 · 班級課表',
  colors,
});

const texts = ctx.calls.filter((c) => c[0] === 'fillText');
const nums = ctx.calls.filter((c) => c[0] === 'fillText' || c[0] === 'fillRect' || c[0] === 'moveTo' || c[0] === 'lineTo');
const badNum = nums.filter((c) => c.slice(1).some((v) => typeof v === 'number' && !Number.isFinite(v)));
ok(badNum.length === 0, `繪圖座標不得出現 NaN／Infinity（${badNum.length} 個）`);

const allText = texts.map((c) => String(c[1])).join('|');
ok(allText.includes('高二仁 班級課表'), '標題要畫出來');
ok(allText.includes('節次'), '表頭「節次」要畫出來');
built.weekdays.forEach((d) => ok(allText.includes(d.label), `表頭要畫出 ${d.label}`));
ok(allText.includes('中文') && allText.includes('數學') && allText.includes('體育'), '每一節的科目都要畫出來');
ok(allText.includes('陳老師') && allText.includes('302'), '課室與老師要各自畫出來（不能合一行被截斷）');
ok(allText.includes('培華校園助手'), '頁腳要畫出來');
ok(texts.length >= 8 + 5 + built.filled * 2, `文字數量不對（實際 ${texts.length}）`);

// 顏色：canvas 不吃 var()，所以每一個上色都必須是明確的字面色
const styleCalls = ctx.calls.filter((c) => c[0] === 'fillStyle' || c[0] === 'strokeStyle');
ok(styleCalls.length > 0, '必須有上色呼叫');
const allowed = Object.keys(colors).map((k) => colors[k]);
const badStyle = styleCalls.filter((c) => allowed.indexOf(c[1]) === -1);
ok(badStyle.length === 0, `出現非主題色的色值：${JSON.stringify(badStyle.slice(0, 3))}`);

const first = ctx.calls[0];
ok(first[0] === 'fillStyle' && first[1] === colors.surface, '第一筆要先鋪白底（列印圖不跟深色主題）');
const rect = ctx.calls.filter((c) => c[0] === 'fillRect')[0];
ok(rect && rect[1] === 0 && rect[2] === 0 && rect[3] === plan.width && rect[4] === plan.height, '白底要鋪滿整張圖');

// 所有文字都要落在版面內（畫到畫布外＝存下來的圖被切掉）
const outside = texts.filter((c) => c[2] < 0 || c[2] > plan.width - 20 || c[3] < 0 || c[3] > plan.height - 20);
ok(outside.length === 0, `有文字畫到版面外（${outside.length} 筆）`);

// ── 5. 截斷 ────────────────────────────────────────────────────
ok(grid.clip('中文科', 5) === '中文科', '沒超長就原樣回傳');
ok(grid.clip('很長的科目名稱甲乙丙', 5) === '很長的科目…', `超長要截斷加省略號，實際「${grid.clip('很長的科目名稱甲乙丙', 5)}」`);
ok(grid.clip(null, 5) === '', 'null 要回空字串（不是 "null"）');

// ── 5b. 頁面參數解碼（實測踩到的坑）────────────────────────────
// 課表頁用 encodeURIComponent 帶班名過來，列印頁 onLoad 收到的仍是 %E9%AB%98… 的形式，
// 於是拿編碼後的字串去查課表 → 整張表空白，而編譯、console、靜態守門全綠。
const encoded = encodeURIComponent('高二仁');
ok(grid.decodeParam(encoded) === '高二仁', `編碼後的班名要解回中文，實際「${grid.decodeParam(encoded)}」`);
ok(grid.decodeParam('高二仁') === '高二仁', '已解碼的字串要原樣回傳（不能重複解碼）');
ok(grid.decodeParam('') === '' && grid.decodeParam(null) === '' && grid.decodeParam(undefined) === '', '空值一律回空字串');
ok(grid.decodeParam('%E0%A4%A') === '%E0%A4%A', '壞掉的百分比序列不能拋錯（照原樣回傳）');

// ── 6. 頁面接線（靜態）────────────────────────────────────────
const pageJs = readFileSync(join(root, 'pages/print/timetable/index.js'), 'utf8');
const pageWxml = readFileSync(join(root, 'pages/print/timetable/index.wxml'), 'utf8');
const appJson = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8'));
const ttWxml = readFileSync(join(root, 'pages/timetable/index.wxml'), 'utf8');
const theme = require(join(root, 'utils/theme.js'));

ok((appJson.pages || []).includes('pages/print/timetable/index'), '列印頁要登記到 app.json');
ok(/theme\.ink\b/.test(pageJs) && /theme\.surface\b/.test(pageJs), '存圖顏色要從 utils/theme.js 取，不寫死色值');
ok(!/#[0-9a-fA-F]{3,8}/.test(pageJs), '頁面 JS 不得出現字面色值');
// 存圖一律走離屏 canvas：實測 Skyline 下 <canvas> 節點的 NodesRef.fields 不回呼，
// 按下「存成圖片」會一直轉 loading；createOffscreenCanvas 沒有這個問題。
ok(/createOffscreenCanvas/.test(pageJs), '存圖要用 wx.createOffscreenCanvas（不要查 canvas 節點）');
ok(!/createSelectorQuery/.test(pageJs), '存圖不該再查 canvas 節點（Skyline 下不會回呼）');
ok(/setTimeout/.test(pageJs), '存圖要有 watchdog，不能讓 loading 卡死');
ok(!/<canvas/.test(pageWxml), '列印頁不需要 WXML canvas 節點（用離屏 canvas）');
ok(/openPrint/.test(ttWxml) && /bind:tap="openPrint"/.test(ttWxml), '課表頁要有進入列印頁的按鈕');
ok(/grid\.decodeParam\(/.test(pageJs), '列印頁要用 decodeParam 解 query（不然中文班名會變 %E9%AB%98…）');
ok(theme.ink === '#000000' && theme.surface === '#FFFFFF', 'theme.js 的列印色必須是黑字白底');

// ── 結果 ──────────────────────────────────────────────────────
if (fails.length) {
  console.log(`❌ 課表列印／存圖：${pass}/${pass + fails.length} 項通過`);
  fails.forEach((f) => console.log('  ✗ ' + f));
  process.exit(1);
}
console.log(`✅ 課表列印／存圖檢查通過（${pass} 項：網格攤平／週區間／版面尺寸／繪圖座標與顏色／頁面接線）`);
