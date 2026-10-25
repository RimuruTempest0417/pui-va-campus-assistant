#!/usr/bin/env node
/**
 * 每頁啟動煙霧測試（不需要開發者工具）。
 *
 * 為什麼要有：連續三次事故都發生在「頁面一打開就炸」——
 *   `request is not defined`、`sections` 抓錯來源、`Can't find variable: adminApi`。
 *   這些只要把頁面真的跑一次就會現形，但自動守門原本只檢查結構與字串。
 *
 * 做法：把每頁的 JS 放進 vm，用「什麼都有的代理」取代 require／wx／getApp，
 * 然後呼叫 onLoad → onShow，任何同步例外或未定義變數都算紅燈。
 * 它不能取代真機點擊（非同步流程、畫面渲染仍要人看），但能擋住「一開就爆」這一類。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));

/** 任何屬性都能呼叫、也能再取屬性的萬用代理；await 它會得到 undefined */
function anything(name = 'stub') {
  const fn = function () { return anything(name); };
  return new Proxy(fn, {
    get(_, prop) {
      if (prop === 'then') return undefined; // 非呼叫結果不要被當成 thenable
      if (prop === Symbol.toPrimitive) return () => '';
      if (prop === 'toString') return () => '';
      if (prop === 'length') return 0;
      return anything(name + '.' + String(prop));
    },
    // 呼叫結果一律回 Promise：頁面普遍寫 `await data.x()` 或 `.then(...)`
    apply() { return Promise.resolve(anything(name + '()')); },
  });
}

const results = [];
process.on('unhandledRejection', () => {}); // 頁面的 async 流程自己會 catch；這裡只防止整個腳本被拖走

function buildSandbox(page) {
  const storage = {};
  let pageObj = null;
  const sandbox = {
    Page: (o) => { pageObj = o; },
    Component: (o) => { pageObj = o; },
    getApp: () => anything('app'),
    getCurrentPages: () => [],
    wx: new Proxy({
      getStorageSync: (k) => storage[k] || '',
      setStorageSync: (k, v) => { storage[k] = v; },
      removeStorageSync: (k) => { delete storage[k]; },
      getSystemInfoSync: () => ({ platform: 'devtools', SDKVersion: '3.17.5', windowWidth: 375, windowHeight: 812 }),
      getWindowInfo: () => ({ windowWidth: 375, windowHeight: 812, safeArea: { top: 0, bottom: 812 } }),
      getMenuButtonBoundingClientRect: () => ({ top: 24, height: 32 }),
      getStorageInfoSync: () => ({ keys: [] }),
      showToast: () => {}, showModal: () => {}, navigateTo: () => {}, switchTab: () => {}, redirectTo: () => {},
      navigateBack: () => {}, stopPullDownRefresh: () => {}, setNavigationBarTitle: () => {}, nextTick: (f) => f && f(),
      createSelectorQuery: () => anything('query'),
      request: () => {}, login: () => {}, getAccountInfoSync: () => ({ miniProgram: { appId: 'wx-test' } }),
      getUpdateManager: () => anything('update'),
    }, { get: (t, p) => (p in t ? t[p] : anything('wx.' + String(p))) }),
    console: { log() {}, info() {}, warn() {}, error() {}, debug() {} },
    setTimeout: (f) => { try { f && f(); } catch (e) { throw e; } return 0; },
    clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    Promise, Date, Math, JSON, Object, Array, String, Number, Boolean, Error, RegExp, Map, Set, Intl,
    require: (p) => anything(p),
    module: { exports: {} }, exports: {},
  };
  sandbox.global = sandbox;
  return { sandbox, getPage: () => pageObj };
}

(async () => {
  for (const page of app.pages) {
    const file = path.join(root, page + '.js');
    if (!fs.existsSync(file)) { results.push({ page, ok: false, why: '找不到檔案' }); continue; }
    const code = fs.readFileSync(file, 'utf8');
    const { sandbox, getPage } = buildSandbox(page);

    try {
      vm.runInNewContext(code, sandbox, { filename: page + '.js' });
    } catch (e) {
      results.push({ page, ok: false, why: '載入即錯誤：' + e.message });
      continue;
    }
    const pageObj = getPage();
    if (!pageObj) { results.push({ page, ok: false, why: '沒有呼叫 Page({})' }); continue; }

    const inst = Object.assign(Object.create(null), pageObj);
    inst.data = JSON.parse(JSON.stringify(pageObj.data || {}));
    inst.setData = function (patch, cb) { Object.assign(this.data, patch || {}); if (typeof cb === 'function') cb.call(this); };
    inst.route = page;

    try {
      if (typeof inst.onLoad === 'function') await inst.onLoad.call(inst, {});
      if (typeof inst.onShow === 'function') await inst.onShow.call(inst);
      results.push({ page, ok: true });
    } catch (e) {
      results.push({ page, ok: false, why: (e && e.name ? e.name + ': ' : '') + (e && e.message) });
    }
  }

  const bad = results.filter((r) => !r.ok);
  for (const r of bad) console.error(`  ✗ ${r.page} —— ${r.why}`);
  if (bad.length) {
    console.error(`❌ 啟動煙霧測試：${results.length} 頁中 ${bad.length} 頁一開就爆`);
    process.exitCode = 1;
  } else {
    console.log(`✅ 啟動煙霧測試通過（${results.length} 頁的 onLoad／onShow 都沒有拋例外）`);
  }
})();
