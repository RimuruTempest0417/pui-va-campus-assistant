#!/usr/bin/env node
// 成績單列印／存成圖片（W-95 收尾）守門
//
// 為什麼要這支：Canvas 畫錯不會拋例外、也不會進 console ——
// 座標是 NaN 就只是「一片空白」，顏色是 undefined 就只是「什麼都沒畫」，
// 字太長就只是「右邊被切掉」。這三種錯編譯、console、其他守門全部看不到，
// 所以用假 ctx 把 draw() 的每個呼叫記錄下來逐項斷言，並用同一支 build() 驗統計口徑。
//
// 用法：node scripts/check-transcript-print.cjs
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');

const root = process.cwd();
const sheet = require(join(root, 'utils', 'transcriptSheet.js'));

let pass = 0;
const fails = [];
function ok(cond, label) {
  if (cond) {
    pass += 1;
    return;
  }
  fails.push(label);
}

// ── 1. 分數／日期顯示 ─────────────────────────────────────────
ok(sheet.scoreText(88) === '88', '整數分數應顯示 88');
ok(sheet.scoreText(88.45) === '88.5', '小數分數應四捨五入到一位（88.45 → 88.5）');
ok(sheet.scoreText(null) === '—', '沒有分數要顯示破折號，不是 0');
ok(sheet.scoreText(undefined) === '—', 'undefined 分數也要顯示破折號');
ok(sheet.scoreText(0) === '0', '0 分是真實分數，不可變成破折號');
ok(sheet.dateText('2026-10-09T00:00:00.000Z') === '2026/10/09', '日期只取前 10 碼並改用斜線');

// ── 2. 學年／學段分組 ─────────────────────────────────────────
const grades = [
  { id: 'a1', yearTerm: '2025/2026', term: '第三段', courseName: '歷史', testType: '大測', testDate: '2026-06-01', score: 70 },
  { id: 'a2', yearTerm: '2026/2027', term: '第二段', courseName: '英文', testType: '小測', testDate: '2026-12-05', score: 91 },
  { id: 'a3', yearTerm: '2026/2027', term: '第一段', courseName: '數學', testType: '大測一', testDate: '2026-10-10', score: 86 },
  { id: 'a4', yearTerm: '2026/2027', term: '第一段', courseName: '化學', testType: '大測一', testDate: '2026-10-09', score: 100.5 },
  { id: 'a5', yearTerm: '2026/2027', term: '第一段', courseName: '中文', testType: '小測', testDate: '2026-10-12', score: null },
];
ok(JSON.stringify(sheet.yearsOf(grades)) === JSON.stringify(['2026/2027', '2025/2026']), '學年要由新到舊且去重');

const terms = ['第一段', '第二段', '第三段'];
const sec = sheet.sectionsOf(grades, '2026/2027', terms);
ok(sec.length === 2, `本學年只有兩個學段有紀錄，實際 ${sec.length}`);
ok(sec[0].term === '第一段' && sec[1].term === '第二段', '學段要照「第一段→第三段」的固定順序，不是照資料來的順序');
ok(sec[0].rows.length === 3, `第一段應 3 筆，實際 ${sec[0].rows.length}`);
ok(sec[0].rows[0].course === '化學', '同一學段內要按考試日期排序（最早在上）');
ok(sec[0].rows[2].scoreText === '—', '缺考那一筆要顯示破折號');
ok(sec[0].averageText === '93.3', `第一段平均只算有分數的兩筆（(86+100.5)/2），實際 ${sec[0].averageText}`);
ok(sec[1].averageText === '91', '第二段只有一筆，平均就是那一筆');
ok(sheet.sectionsOf(grades, '2025/2026', terms).length === 1, '切到上一個學年只會有一個學段');
ok(sheet.sectionsOf(grades, '2026/2027', terms).every((s) => s.rows.length > 0), '空學段不要留在紙上');
// 不在三個固定值裡的學段（舊資料）要排在最後，不能直接消失
const odd = sheet.sectionsOf([{ yearTerm: '2026/2027', term: '暑期補考', courseName: '數學', score: 60 }], '2026/2027', terms);
ok(odd.length === 1 && odd[0].term === '暑期補考', '非固定學段要照原樣印出來');

// ── 3. 平均分 ────────────────────────────────────────────────
ok(sheet.averageOf([{ score: 90 }, { score: 80 }]) === 85, '平均 90／80 應是 85');
ok(sheet.averageOf([{ score: null }]) === null, '全都沒有分數要回 null（不是 0）');
ok(sheet.averageOf([]) === null, '空陣列回 null');
ok(sheet.averageOf([{ score: 90 }, { score: null }, { score: 81 }]) === 85.5, '缺考的科目不進分母');

// ── 4. 出缺席口徑（與後端一致：遲到算出席、請假不算缺席）────────
const attend = [
  { date: '2026-10-01', amStatus: 'normal', pmStatus: 'normal', isAmLate: false },
  { date: '2026-10-02', amStatus: 'late', pmStatus: 'normal', isAmLate: true },
  { date: '2026-10-03', amStatus: 'leave', pmStatus: 'leave' },
  { date: '2026-10-04', amStatus: 'absent', pmStatus: 'normal' },
  { date: '2026-10-05', amStatus: 'normal', pmStatus: 'late', isPmLate: true },
];
const st = sheet.attendanceStats(attend);
ok(st.total === 5, `上課日應 5，實際 ${st.total}`);
ok(st.present === 1, `正常出席應 1，實際 ${st.present}`);
ok(st.late === 2, `遲到應 2（早遲＋遲到都算），實際 ${st.late}`);
ok(st.leave === 1, `請假應 1，實際 ${st.leave}`);
ok(st.absent === 1, `缺席應 1，實際 ${st.absent}`);
ok(st.rate === 80, `出席率＝(5−1)/5＝80，實際 ${st.rate}`);
ok(sheet.attendanceStats([]).rate === null, '沒有紀錄時出席率回 null（不是 100%）');

// ── 5. build()：整份成績單 ────────────────────────────────────
const built = sheet.build({
  grades: grades,
  attendance: [
    { yearTerm: '2026/2027', amStatus: 'normal', pmStatus: 'normal' },
    { yearTerm: '2026/2027', amStatus: 'leave', pmStatus: 'leave' },
    { yearTerm: '2025/2026', amStatus: 'absent', pmStatus: 'absent' },
  ],
  termLabels: terms,
});
ok(built.yearTerm === '2026/2027', '沒有指定學年時要用最新學年');
ok(built.sections.length === 2, 'build 要帶回本學年的兩個學段');
ok(built.attendance.total === 2, `出缺席只算選中學年，實際 ${built.attendance.total}`);
ok(built.attendance.leave === 1 && built.attendance.absent === 0, '上一個學年的缺席不該混進這個學年');
ok(built.empty === false, '有成績時 empty 應為 false');
ok(sheet.build({ grades: [], attendance: [], termLabels: terms }).empty === true, '沒有成績時 empty 應為 true');
ok(sheet.build({ grades: [], attendance: [], termLabels: terms }).years.length === 0, '沒有成績時學年清單是空的');

// ── 6. 版面尺寸 ──────────────────────────────────────────────
const p1 = sheet.plan(built.sections);
ok(p1.width === 1080, '圖片寬固定 1080');
ok(Number.isFinite(p1.height) && p1.height > 800, `高度要是有限正數，實際 ${p1.height}`);
const p2 = sheet.plan(sheet.sectionsOf(grades.concat(grades), '2026/2027', terms));
ok(p2.height > p1.height, '列數變多時圖片要跟著長高，不能把後面的列擠掉');
const p0 = sheet.plan([]);
ok(Number.isFinite(p0.height) && p0.height > 0, '沒有學段時仍要有可畫的高度（不要 0）');
const expectH = p1.pad * 2 + p1.headH + p1.sections * (p1.termH + p1.colHeadH) + p1.rows * p1.rowH + p1.attH + p1.footH;
ok(p1.height === expectH, `高度公式要對得上（預期 ${expectH}，實際 ${p1.height}）`);

// ── 7. draw()：用假 ctx 逐項驗 ────────────────────────────────
function fakeCtx() {
  const calls = { text: [], lines: [], rects: [] };
  const ctx = {
    font: '10px sans-serif',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    textBaseline: '',
    textAlign: '',
    fillRect: (x, y, w, h) => calls.rects.push({ x, y, w, h, fill: ctx.fillStyle }),
    beginPath: () => {},
    moveTo: (x, y) => { ctx._from = { x, y }; },
    lineTo: (x, y) => { calls.lines.push({ from: ctx._from, to: { x, y }, stroke: ctx.strokeStyle, width: ctx.lineWidth }); },
    stroke: () => {},
    fillText: (t, x, y) => calls.text.push({ text: String(t), x, y, fill: ctx.fillStyle, font: ctx.font }),
  };
  return { ctx, calls };
}

const COLORS = { surface: '#FFFFFF', ink: '#000000', inkSoft: 'rgba(60,60,67,0.6)', rule: 'rgba(60,60,67,0.29)' };
const palette = [COLORS.surface, COLORS.ink, COLORS.inkSoft, COLORS.rule];

const longRow = { course: '中國語文及文學（榮譽）選修課程補習班', type: '大測驗第二次', dateText: '2026/10/09', scoreText: '100.5' };
const drawSections = [
  { term: '第一段', averageText: '93.3', rows: sec[0].rows.concat([longRow]) },
  { term: '第二段', averageText: '91', rows: sec[1].rows },
];
const planA = sheet.plan(drawSections);
const { ctx, calls } = fakeCtx();
sheet.draw(ctx, {
  plan: planA,
  title: '培華校園助手 · 學生成績單',
  studentLine: '姓名 陳大文 · 學號 3201301037 · 高二丙',
  metaLine: '學年 2026/2027 · 第三段止 · 列印 2026/11/07',
  colLabels: { course: '科目', type: '測驗', date: '日期', score: '分數' },
  sections: drawSections,
  attendanceLines: ['出缺席（2026/2027）', '上課日 43 · 出席 40 · 遲到 2 · 請假 1 · 缺席 0 · 出席率 97.7%'],
  footNote: '培華校園助手 · 學生成績單 · 2026/11/07',
  colors: COLORS,
});

const rowsDrawn = drawSections.reduce((n, s) => n + s.rows.length, 0);
const expectTexts = 3 /*標題＋學生＋meta*/ + drawSections.length * (1 + 1 + 4) /*學段＋平均＋4 欄名*/ + rowsDrawn * 4 + 2 /*出缺席兩行*/ + 1 /*頁腳*/;
ok(calls.text.length === expectTexts, `文字數量應為 ${expectTexts}，實際 ${calls.text.length}`);
ok(calls.rects.length === 1 && calls.rects[0].fill === COLORS.surface, '第一筆要先鋪白底（深色模式下印出來才不是黑的）');
ok(calls.rects[0].w === 1080 && calls.rects[0].h === planA.height, '白底要蓋滿整張圖');

const nums = [];
calls.text.forEach((t) => nums.push(t.x, t.y));
calls.lines.forEach((l) => nums.push(l.from.x, l.from.y, l.to.x, l.to.y, l.width));
nums.push(...calls.rects.map((r) => r.w), ...calls.rects.map((r) => r.h));
ok(nums.every((n) => Number.isFinite(n)), '所有座標必須是有限數字（NaN 會讓整張圖空白）');
ok(calls.lines.every((l) => l.stroke), '每一條線都要有顏色（undefined 等於沒畫）');
ok(calls.text.every((t) => !!t.fill), '每一段文字都要有顏色');
ok(calls.text.every((t) => palette.indexOf(t.fill) !== -1), '文字只能用主題四色（不得出現品牌紫或寫死色值）');
ok(calls.lines.every((l) => palette.indexOf(l.stroke) !== -1), '線條只能用主題四色');
ok(calls.text.every((t) => t.x >= 0 && t.x <= planA.width), '文字不可畫到畫布左邊界外');
ok(calls.text.every((t) => t.y >= 0 && t.y <= planA.height), '文字不可畫到畫布下邊界外（頁腳會整個消失）');
ok(calls.lines.every((l) => l.from.y <= planA.height && l.to.y <= planA.height), '線條不可超出圖片高度');

/** 依字級估算寬度（中文 1em、英文 0.56em），確認每一段字都在紙內 */
const measure = (text, font) => {
  const px = Number(String(font).replace(/[^0-9.]/g, '')) || 16;
  let w = 0;
  for (const ch of String(text)) w += ch.charCodeAt(0) > 127 ? px : px * 0.56;
  return w;
};
const overflow = calls.text.filter((t) => t.x + measure(t.text, t.font) > planA.width - 8);
ok(overflow.length === 0, '有文字超出紙張右緣：' + overflow.map((t) => t.text).join(' / '));
ok(calls.text.every((t) => t.text.length > 0), '不可畫出空字串（代表資料形狀壞了）');
ok(calls.text.some((t) => t.text.indexOf('…') !== -1), '超長科目名要被截斷成「…」而不是整段印出來壓到分數欄');

// 沒有出缺席資料時仍要畫得出來（只是數字是 0，不是空白）
const emptyAtt = fakeCtx();
sheet.draw(emptyAtt.ctx, {
  plan: sheet.plan(drawSections),
  title: 't',
  studentLine: 's',
  metaLine: 'm',
  colLabels: { course: 'a', type: 'b', date: 'c', score: 'd' },
  sections: drawSections,
  attendanceLines: [],
  footNote: 'f',
  colors: COLORS,
});
ok(emptyAtt.calls.text.length > 0, '沒有出缺席資料時仍要畫出成績（不要整張空白）');

// ── 8. 頁面與服務有真的接上（靜態檢查，避免「畫得出來但沒入口」）──
const pagePath = join(root, 'pages', 'print', 'transcript', 'index.js');
ok(existsSync(pagePath), '缺少 pages/print/transcript/index.js');
if (existsSync(pagePath)) {
  const page = readFileSync(pagePath, 'utf8');
  ok(page.indexOf('transcriptSheet') !== -1 || page.indexOf('utils/transcriptSheet') !== -1, '列印頁要 require utils/transcriptSheet');
  ok(page.indexOf('themeClass') !== -1, '列印頁要固定淺色（紙不會跟著手機變黑）');
  ok(page.indexOf('createOffscreenCanvas') !== -1, '「存成圖片」要用離屏 canvas（Skyline 對不在屏的節點不回呼）');
  ok(page.indexOf('canvasToTempFilePath') !== -1, '要真的匯出 PNG');
  ok(page.indexOf('L: this.labels()') !== -1, 'labels() 要 setData 才會有字（漏了整頁只有色塊）');
}
const appJson = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8'));
ok(appJson.pages.indexOf('pages/print/transcript/index') !== -1, '新頁面要登記在 app.json');

const schoolPage = readFileSync(join(root, 'pages', 'school', 'index.js'), 'utf8');
ok(schoolPage.indexOf('print/transcript') !== -1, '成績頁要有進「列印成績單」的入口');
ok(readFileSync(join(root, 'pages', 'school', 'index.wxml'), 'utf8').indexOf('openTranscript') !== -1, '成績頁的入口要真的接到 openTranscript');
const adminPage = readFileSync(join(root, 'pages', 'admin', 'index', 'index.wxml'), 'utf8');
ok(adminPage.indexOf('amStats') !== -1, '小程序後台成績分頁要有出席率月報區塊');
ok(adminPage.indexOf('openTranscript') !== -1, '後台要能從選中的學生直接列印成績單');

// ── 9. 頁面邏輯模擬：三種身分各讀對來源（不需要開發者工具）──
// 這一段擋的是「編譯過、守門綠、只有真的打開那一頁才發現讀錯人」那一類：
// 家長帶 child 要打子女端點、老師帶 studentId 要打後台端點、學生自己打 /school/grades。
// 包成 async 函式：這支是 CommonJS，頂層不能 await。
async function identityChecks() {
  const vm = require('node:vm');
  const gradeRows = [
    { id: 'p1', yearTerm: '2026/2027', term: '第一段', courseName: '數學', testType: '大測一', testDate: '2026-10-10', score: 86 },
    { id: 'p2', yearTerm: '2026/2027', term: '第二段', courseName: '英文', testType: '大測一', testDate: '2026-11-18', score: 90 },
  ];
  const attRows = [
    { id: 'x1', yearTerm: '2026/2027', date: '2026-10-01', amStatus: 'normal', pmStatus: 'normal' },
    { id: 'x2', yearTerm: '2026/2027', date: '2026-10-02', amStatus: 'late', pmStatus: 'normal', isAmLate: true },
  ];

  function run(query, opts) {
    const o = opts || {};
    const calls = { selfGrades: 0, childGrades: null, adminGrades: null, me: 0 };
    const dataStub = {
      isDemo: () => false,
      messageOf: (e) => (e && e.message) || String(e),
      schoolGrades: () => { calls.selfGrades += 1; return Promise.resolve({ items: gradeRows, years: ['2026/2027'] }); },
      schoolAttendance: () => Promise.resolve({ items: attRows, summary: { total: 2, late: 1, absent: 1 } }),
      parentChildGrades: (id) => { calls.childGrades = id; return Promise.resolve({ items: gradeRows, years: ['2026/2027'] }); },
      parentChildAttendance: () => Promise.resolve({ items: attRows, summary: { total: 2, late: 1, absent: 1 } }),
      parentChildren: () => Promise.resolve({ items: [{ studentId: 'c9', nickname: '甲同學', grade: '高二', className: '丙' }] }),
      me: () => { calls.me += 1; return Promise.resolve({ nickname: '甲同學', grade: '高二', className: '丙' }); },
    };
    const adminStub = {
      schoolGrades: (id) => { calls.adminGrades = id; return Promise.resolve({ student: { id: id, account: '3201301037', nickname: '乙同學', grade: '高二', className: '甲' }, items: gradeRows, years: ['2026/2027'] }); },
      schoolAttendance: () => Promise.resolve({ student: { id: 'adm', account: '3201301037', nickname: '乙同學', grade: '高二', className: '甲' }, items: attRows, summary: { total: 2, late: 1, absent: 1 } }),
    };
    let pageObj = null;
    const storage = { pv_token: o.token === false ? '' : 'fake-token' };
    const sandbox = {
      Page: (obj) => { pageObj = obj; },
      getApp: () => ({ globalData: {} }),
      getCurrentPages: () => [],
      wx: new Proxy(
        {
          getStorageSync: (k) => storage[k] || '',
          setStorageSync: (k, v) => { storage[k] = v; },
          removeStorageSync: (k) => { delete storage[k]; },
          getAppBaseInfo: () => ({ language: 'zh_TW', theme: 'light' }),
          showToast: () => {},
          navigateTo: () => {},
        },
        { get: (t, p) => (p in t ? t[p] : () => ({})) },
      ),
      console: { log() {}, info() {}, warn() {}, error() {} },
      setTimeout: (f) => { try { f && f(); } catch (e) { /* 不影響斷言 */ } return 0; },
      clearTimeout: () => {},
      Promise, Date, Math, JSON, Object, Array, String, Number, Boolean, Error, RegExp, Map, Set,
      require: (p) => {
        if (p.includes('services/data')) return dataStub;
        if (p.includes('services/admin')) return adminStub;
        if (p.includes('utils/request')) return { getToken: () => storage.pv_token || '', setToken: (v) => { storage.pv_token = v; } };
        if (p.includes('utils/i18n')) return { pick: (s) => s };
        if (p.includes('utils/theme')) return { surface: '#FFFFFF', ink: '#000000', inkSoft: 'rgba(60,60,67,0.6)', rule: 'rgba(60,60,67,0.29)' };
        if (p.includes('utils/transcriptSheet')) return sheet;
        if (p.includes('utils/reporter')) return { reportError: () => {} };
        if (p.includes('utils/appearance')) return { themeClass: () => 'theme-light' };
        if (p.includes('config/config')) return { STORAGE_KEYS: { user: 'pv_user', token: 'pv_token' }, API_BASE_URL: 'https://example.test/api/v1', DEMO_MODE: 'off' };
        throw new Error('unexpected require: ' + p);
      },
      module: { exports: {} },
      exports: {},
    };
    sandbox.global = sandbox;
    const code = readFileSync(join(root, 'pages', 'print', 'transcript', 'index.js'), 'utf8');
    vm.runInNewContext(code, sandbox, { filename: 'pages/print/transcript/index.js' });
    const inst = Object.assign(Object.create(null), pageObj);
    inst.data = JSON.parse(JSON.stringify(pageObj.data || {}));
    inst.setData = function (patch, cb) { Object.assign(this.data, patch || {}); if (typeof cb === 'function') cb.call(this); };
    inst.route = 'pages/print/transcript/index';
    return { inst, calls, storage };
  }

  const adminRun = run({ studentId: 'stu-1' });
  adminRun.inst.onLoad({ studentId: 'stu-1' });
  await adminRun.inst.load();
  ok(adminRun.calls.adminGrades === 'stu-1', '老師帶 studentId 要打後台端點（實際 ' + adminRun.calls.adminGrades + '）');
  ok(adminRun.calls.selfGrades === 0 && adminRun.calls.childGrades === null, '老師那條路徑不可以去打自己的／子女的端點');
  ok(adminRun.inst.data.sections.length === 2, '老師的成績單要分學段（實際 ' + adminRun.inst.data.sections.length + ' 段）');
  ok(String(adminRun.inst.data.studentLine).indexOf('乙同學') !== -1, '紙上要寫出學生的名字');
  ok(String(adminRun.inst.data.attendanceText).indexOf('97') !== -1 || String(adminRun.inst.data.attendanceText).indexOf('%') !== -1, '出缺席摘要要帶出席率');
  ok(adminRun.inst.data.empty === false && adminRun.inst.data.needLogin === false, '有資料時不該是空狀態或未登入');

  const parentRun = run({ child: 'c9' });
  parentRun.inst.onLoad({ child: 'c9' });
  await parentRun.inst.load();
  ok(parentRun.calls.childGrades === 'c9', '家長帶 child 要打子女端點（實際 ' + parentRun.calls.childGrades + '）');
  ok(parentRun.calls.selfGrades === 0, '家長不可以去打「自己的成績」');
  ok(String(parentRun.inst.data.studentLine).indexOf('甲同學') !== -1, '家長那張紙要寫孩子的名字');

  const selfRun = run({});
  selfRun.inst.onLoad({});
  await selfRun.inst.load();
  ok(selfRun.calls.selfGrades >= 1, '學生自己要打 /school/grades（實際 ' + selfRun.calls.selfGrades + ' 次）');
  ok(selfRun.calls.me >= 1, '學生自己那張紙要向 /auth/me 取名字');

  const guestRun = run({}, { token: false });
  guestRun.inst.onLoad({});
  await guestRun.inst.load();
  ok(guestRun.inst.data.needLogin === true, '沒有 token 要顯示「請先登入」，不是「載入失敗」');
  ok(guestRun.calls.selfGrades === 0, '沒有 token 就不該打 API');
}

identityChecks().then(() => {
  if (fails.length) {
    console.log('❌ 成績單列印檢查失敗 ' + fails.length + ' 項（通過 ' + pass + '）');
    fails.forEach((f) => console.log('   - ' + f));
    process.exit(1);
  }
  console.log('✅ 成績單列印檢查通過（' + pass + ' 項）');
});
