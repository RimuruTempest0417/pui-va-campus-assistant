// 用戶端錯誤上報
// 為什麼要有：學生手機上的白屏、閃退、按下沒反應，開發者看不到他們的 console。
// 三條規矩：
// ① 絕不因為「上報失敗」而讓使用者看到新錯誤 —— 全部 swallow，連 console 都不吵。
// ② 同一個訊息（＋同一個頁面）這次啟動只送一次；後端另有每分鐘 20 則的限流。
// ③ 離線示範模式不上報：示範資料產生的錯誤不是真問題。
const config = require('../config/config');
const { isDemo } = require('../services/data');

const sent = {};
let lastAt = 0;
const MIN_GAP = 1500;

function currentRoute() {
  try {
    const pages = getCurrentPages();
    const page = pages[pages.length - 1];
    return page && page.route ? page.route : '';
  } catch (e) {
    return '';
  }
}

function deviceInfo() {
  try {
    const info = wx.getAppBaseInfo ? wx.getAppBaseInfo() : wx.getSystemInfoSync();
    return { platform: info.platform || '', sdkVersion: info.SDKVersion || '' };
  } catch (e) {
    return { platform: '', sdkVersion: '' };
  }
}

function appVersion() {
  try {
    const acc = wx.getAccountInfoSync ? wx.getAccountInfoSync() : null;
    const mp = acc && acc.miniProgram ? acc.miniProgram : {};
    return mp.version || mp.envVersion || '';
  } catch (e) {
    return '';
  }
}

/** 後端位址：與 utils/request.js 同一套規則（自檢頁可臨時覆蓋） */
function baseUrl() {
  try {
    const custom = wx.getStorageSync(config.STORAGE_KEYS.apiBase);
    if (custom) return String(custom).replace(/\/$/, '');
  } catch (e) {
    // storage 讀不到就用預設
  }
  return config.API_BASE_URL;
}

/**
 * 送一則錯誤。回傳 Promise 只為了自檢頁能斷言「真的送上去了」；
 * 頁面與 App 一律不 await、不看結果。
 */
function reportError(message, stack) {
  const text = String(message === null || message === undefined ? '' : message).slice(0, 300);
  if (!text) return Promise.resolve(false);

  const route = currentRoute();
  const key = route + '|' + text;
  if (sent[key]) return Promise.resolve(false);
  if (isDemo() || !config.API_BASE_URL) return Promise.resolve(false);

  const now = Date.now();
  if (now - lastAt < MIN_GAP) return Promise.resolve(false); // 一次崩一整串時只送第一則
  sent[key] = 1;
  lastAt = now;

  const info = deviceInfo();
  return new Promise((resolve) => {
    wx.request({
      url: baseUrl() + '/client-errors',
      method: 'POST',
      header: { 'content-type': 'application/json' },
      timeout: 4000,
      data: {
        message: text,
        stack: stack ? String(stack).slice(0, 4000) : '',
        route: route,
        platform: info.platform,
        sdkVersion: info.sdkVersion,
        appVersion: appVersion(),
      },
      success: () => resolve(true),
      fail: () => resolve(false), // 上報失敗就算了，不要在這裡再報一次
    });
  });
}

/** 清掉「這次啟動已送過」的紀錄（自檢頁重跑用） */
function resetSent() {
  Object.keys(sent).forEach((k) => delete sent[k]);
}

module.exports = { reportError, resetSent };
