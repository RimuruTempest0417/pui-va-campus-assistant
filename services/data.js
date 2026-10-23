// 資料入口：頁面只 require 這支，不直接碰 api.js / mock.js
// 預設（DEMO_MODE='off'）一律打真 API；只有明確開啟「離線示範」才會用本地資料。
const config = require('../config/config');
const api = require('./api');
const mock = require('./mock');
const request = require('../utils/request');
const { codeOf, isNetworkish, messageOf } = require('../utils/errors');

let demoActive = false;

function forceDemoOn() {
  try {
    const v = wx.getStorageSync(config.STORAGE_KEYS.forceDemo);
    return v === '1' || v === true;
  } catch (e) {
    return false;
  }
}

function setApiBase(url) {
  try {
    if (url) wx.setStorageSync(config.STORAGE_KEYS.apiBase, String(url).replace(/\/$/, ''));
    else wx.removeStorageSync(config.STORAGE_KEYS.apiBase);
  } catch (e) {
    // storage 失敗不影響主流程
  }
  demoActive = false;
  return request.apiBase();
}

function isDemo() {
  if (config.DEMO_MODE === 'on') return true;
  if (forceDemoOn()) return true; // 開發自檢頁的臨時開關
  if (config.DEMO_MODE === 'off') return false;
  if (!config.API_BASE_URL) return true;
  return demoActive;
}

/** 開發自檢頁用：切換離線示範（不改程式碼、關掉即回真 API） */
function setForceDemo(on) {
  try {
    wx.setStorageSync(config.STORAGE_KEYS.forceDemo, on ? '1' : '');
  } catch (e) {
    // storage 失敗不影響主流程
  }
  demoActive = false;
  return isDemo();
}

/**
 * 首次進入時用 wx.login 換 JWT。失敗（沒後端、AppSecret 未設定）就當訪客，
 * 讀取類頁面照常運作，只是不能發布／報名。
 */
async function ensureLogin() {
  if (isDemo()) return null;
  if (request.getToken()) return null;
  try {
    const code = await new Promise((resolve, reject) => {
      wx.login({ success: (r) => resolve(r.code), fail: reject });
    });
    if (!code) return null;
    const res = await api.login(code);
    if (res && res.token) {
      request.setToken(res.token);
      return res.user || null;
    }
  } catch (e) {
    // 訪客模式：不打擾使用者
  }
  return null;
}

async function call(name, args) {
  if (isDemo()) return mock[name].apply(null, args || []);
  try {
    return await api[name].apply(null, args || []);
  } catch (err) {
    if (config.DEMO_MODE === 'auto' && isNetworkish(err) && codeOf(err) !== 'UNAUTHORIZED') {
      demoActive = true;
      console.warn('[data] 後端不可用，已切換示範模式：' + codeOf(err));
      return mock[name].apply(null, args || []);
    }
    throw err;
  }
}

module.exports = {
  isDemo: isDemo,
  ensureLogin: ensureLogin,
  setForceDemo: setForceDemo,
  setApiBase: setApiBase,
  apiBase: () => request.apiBase(),
  forceDemoOn: forceDemoOn,
  messageOf: messageOf,
  resetDemo: () => mock.reset(),
  login: (...a) => call('login', a),
  // 沒有 token 就不可能登入成功，直接回 null（訪客），不要白打一條 401
  me: (...a) => (isDemo() || request.getToken() ? call('me', a) : Promise.resolve(null)),
  listItems: (...a) => call('listItems', a),
  createItem: (...a) => call('createItem', a),
  getItem: (...a) => call('getItem', a),
  myItems: (...a) => call('myItems', a),
  updateItemStatus: (...a) => call('updateItemStatus', a),
  categories: (...a) => call('categories', a),
  claimItem: (...a) => call('claimItem', a),
  matches: (...a) => call('matches', a),
  listEvents: (...a) => call('listEvents', a),
  signupEvent: (...a) => call('signupEvent', a),
  cancelSignup: (...a) => call('cancelSignup', a),
  mySignups: (...a) => call('mySignups', a),
  getEvent: (...a) => call('getEvent', a),
  switchDemoUser: (...a) => call('switchDemoUser', a),
  weekMenu: (...a) => call('weekMenu', a),
  getDish: (...a) => call('getDish', a),
  rateDish: (...a) => call('rateDish', a),
  topDishes: (...a) => call('topDishes', a),
  listNotices: (...a) => call('listNotices', a),
  getNotice: (...a) => call('getNotice', a),
  markAllNoticesRead: (...a) => call('markAllNoticesRead', a),
};
