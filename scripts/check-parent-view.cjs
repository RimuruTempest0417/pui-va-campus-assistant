#!/usr/bin/env node
/**
 * 家長視角的「成績與出缺席」頁面邏輯模擬（不需要開發者工具）。
 *
 * 為什麼要有：家長免綁定（v0.83.0）讓同一頁要服務兩種身分 ——
 * 學生讀 `/school/grades`（自己的），家長讀 `/parents/me/children/:id/*`（子女的）。
 * 這種「依身分換資料來源」的分支，編譯不會報錯、`check-project` 也不會紅，
 * 只有真的以家長身分打開那一頁才會知道有沒有讀錯人。實測踩過一次：
 * 頁面把家長當學生，畫面永遠空白（而所有守門全綠）。
 *
 * 做法：把 `pages/school/index.js` 放進 vm，`services/data` 換成間諜物件，
 * 分別以 PARENT／STUDENT 跑 onLoad，斷言：
 *   - 家長：讀的是子女端點、預設第一位子女、切換子女會重抓、成績與 summary 有渲染
 *   - 學生：讀的是自己的端點、完全不碰子女端點
 * 它不能取代真機（手感與版面要人看），但能擋住「資料來源接錯」這一類。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');

function buildHarness(role) {
  const calls = { children: 0, childGrades: null, childAttendance: null, selfGrades: 0, selfAttendance: 0 };
  const dataStub = {
    schoolStatus: () => Promise.resolve({ linked: role === 'STUDENT', studentNo: '3201301037', className: '高二丙' }),
    parentChildren: () => { calls.children += 1; return Promise.resolve({ items: [{ studentId: 'c1', nickname: '甲同學' }, { studentId: 'c2', nickname: '乙同學' }] }); },
    parentChildGrades: (id) => { calls.childGrades = id; return Promise.resolve({ items: [{ id: 'g1', courseName: '數學', testDate: '2026-10-09', score: 88, source: 'SYNC' }], years: ['2026/2027'] }); },
    parentChildAttendance: (id) => { calls.childAttendance = id; return Promise.resolve({ items: [{ id: 'a1', date: '2026-10-12', amStatus: 'late', isAmLate: true, source: 'SYNC' }], summary: { total: 1, late: 1, absent: 0 } }); },
    parentChildSync: (id) => { calls.childSync = id; return Promise.resolve({ ok: true, grades: 1 }); },
    schoolGrades: () => { calls.selfGrades += 1; return Promise.resolve({ items: [{ id: 'sg1', courseName: '化學', testDate: '2026-10-08', score: 91, source: 'SYNC' }], years: ['2026/2027'] }); },
    schoolAttendance: () => { calls.selfAttendance += 1; return Promise.resolve({ items: [{ id: 'sa1', date: '2026-10-11', amStatus: 'normal', isAmLate: false, source: 'SYNC' }], summary: { total: 1, late: 0, absent: 0 } }); },
    schoolSync: () => Promise.resolve({ ok: true, grades: 1 }),
    schoolLink: () => Promise.resolve({ linked: true }),
    schoolUnlink: () => Promise.resolve({ linked: false }),
    messageOf: (e) => (e && e.message) || String(e),
    isDemo: () => false,
  };

  const storage = { pv_token: 'fake-token', pv_user: { role, nickname: role === 'PARENT' ? '甲家長' : '甲同學' } };
  let pageObj = null;
  const sandbox = {
    Page: (o) => { pageObj = o; },
    getApp: () => ({ globalData: {} }),
    getCurrentPages: () => [],
    wx: new Proxy({
      getStorageSync: (k) => storage[k] || '',
      setStorageSync: (k, v) => { storage[k] = v; },
      removeStorageSync: (k) => { delete storage[k]; },
      showToast: () => {}, showModal: () => {}, navigateTo: () => {}, navigateBack: () => {},
    }, { get: (t, p) => (p in t ? t[p] : () => ({})) }),
    console: { log() {}, info() {}, warn() {}, error() {} },
    setTimeout: (f) => { try { f && f(); } catch (e) { /* 畫面層的計時器不影響斷言 */ } return 0; },
    clearTimeout: () => {},
    Promise, Date, Math, JSON, Object, Array, String, Number, Boolean, Error, RegExp, Map, Set,
    require: (p) => {
      if (p.includes('services/data')) return dataStub;
      if (p.includes('utils/request')) return { getToken: () => storage.pv_token || '', setToken: (v) => { storage.pv_token = v; } };
      if (p.includes('utils/i18n')) return { pick: (s) => s };
      if (p.includes('utils/appearance')) return { themeClass: () => 'theme-light' };
      if (p.includes('utils/reporter')) return { reportError: () => {} };
      if (p.includes('config/config')) return { STORAGE_KEYS: { user: 'pv_user', token: 'pv_token' }, API_BASE_URL: 'https://example.test/api/v1' };
      throw new Error('unexpected require: ' + p);
    },
    module: { exports: {} }, exports: {},
  };
  sandbox.global = sandbox;

  const code = fs.readFileSync(path.join(root, 'pages/school/index.js'), 'utf8');
  vm.runInNewContext(code, sandbox, { filename: 'pages/school/index.js' });
  const inst = Object.assign(Object.create(null), pageObj);
  inst.data = JSON.parse(JSON.stringify(pageObj.data || {}));
  inst.setData = function (patch, cb) { Object.assign(this.data, patch || {}); if (typeof cb === 'function') cb.call(this); };
  inst.route = 'pages/school/index';
  return { inst, calls };
}

const checks = [];
const check = (name, ok) => checks.push({ name, ok: Boolean(ok) });

(async () => {
  // ── 家長 ──
  const parent = buildHarness('PARENT');
  await parent.inst.onLoad.call(parent.inst, {});
  await new Promise((r) => setTimeout(r, 20));
  const pd = parent.inst.data;

  check('家長：isParent = true', pd.isParent === true);
  check('家長：讀了子女清單', parent.calls.children === 1);
  check('家長：children = 2 位', Array.isArray(pd.children) && pd.children.length === 2);
  check('家長：預設選第一位子女', pd.activeChildId === 'c1');
  check('家長：成績讀的是子女端點（c1）', parent.calls.childGrades === 'c1');
  check('家長：出缺席讀的是子女端點（c1）', parent.calls.childAttendance === 'c1');
  check('家長：完全沒有讀「自己的」成績／出缺席', parent.calls.selfGrades === 0 && parent.calls.selfAttendance === 0);
  check('家長：成績有渲染（88）', pd.grades.length === 1 && pd.grades[0].scoreText === '88');
  check('家長：出缺席 summary 有值', pd.summary && pd.summary.total === 1 && pd.summary.late === 1);
  check('家長：沒有誤入失敗／載入中', pd.failed === false && pd.loading === false);

  await parent.inst.pickChild.call(parent.inst, { currentTarget: { dataset: { id: 'c2' } } });
  check('家長：切換到第二位子女會重抓', parent.calls.childGrades === 'c2' && pd.activeChildId === 'c2');

  // ── 學生 ──
  const student = buildHarness('STUDENT');
  await student.inst.onLoad.call(student.inst, {});
  await new Promise((r) => setTimeout(r, 20));
  const sd = student.inst.data;

  check('學生：isParent = false', sd.isParent === false);
  check('學生：讀自己的成績／出缺席', student.calls.selfGrades === 1 && student.calls.selfAttendance === 1);
  check('學生：完全不碰子女端點', student.calls.childGrades === null && student.calls.children === 0);
  check('學生：成績有渲染（91）', sd.grades.length === 1 && sd.grades[0].scoreText === '91');

  const bad = checks.filter((c) => !c.ok);
  for (const c of bad) console.error(`  ✗ ${c.name}`);
  if (bad.length) {
    console.error(`❌ 家長視角模擬：${checks.length} 項中 ${bad.length} 項失敗`);
    process.exitCode = 1;
  } else {
    console.log(`✅ 家長視角模擬通過（${checks.length} 項：家長讀子女、學生讀自己，兩條路徑不互相污染）`);
  }
})();
