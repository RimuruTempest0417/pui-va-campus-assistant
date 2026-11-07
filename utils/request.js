const config = require('../config/config');
const { codeOf } = require('./errors');

/** 後端位址：預設吃 config.API_BASE_URL，可在自檢頁臨時覆蓋（pv_api_base） */
function apiBase() {
  try {
    const custom = wx.getStorageSync(config.STORAGE_KEYS.apiBase);
    if (custom) return String(custom).replace(/\/$/, '');
  } catch (e) {
    // storage 讀不到就用預設
  }
  return config.API_BASE_URL;
}

function getToken() {
  return wx.getStorageSync(config.STORAGE_KEYS.token) || '';
}

function setToken(token) {
  if (token) wx.setStorageSync(config.STORAGE_KEYS.token, token);
  else wx.removeStorageSync(config.STORAGE_KEYS.token);
}

/** 清掉本機登入態（token ＋ 快取的使用者角色／暱稱）。
 *  只在「本來帶了 token，後端卻回 401」時呼叫 —— 那代表 JWT 過期或被撤銷。
 *  不清的話畫面會自相矛盾：登入頁說「已登入 巡查／最高權限」、後台卻說「請先登入」。 */
function dropSession() {
  setToken('');
  try {
    wx.removeStorageSync(config.STORAGE_KEYS.user);
  } catch (e) {
    // storage 不可用時只影響本次顯示
  }
}

/** GET 參數清洗：把 undefined／null／空字串／字面 "undefined" 全部拿掉 */
function cleanParams(data) {
  if (!data || typeof data !== 'object') return data;
  const out = {};
  Object.keys(data).forEach((k) => {
    const v = data[k];
    if (v === undefined || v === null) return;
    if (typeof v === 'string' && (v === '' || v === 'undefined' || v === 'null')) return;
    out[k] = v;
  });
  return out;
}

/** 雲開發通道：wx.cloud.callFunction → 雲函數 apiProxy → 後端 HTTPS */
let cloudReady = false;
function ensureCloud() {
  if (cloudReady) return;
  if (!wx.cloud) throw { code: 'NO_CLOUD', message: '這個基礎庫不支援雲開發' };
  wx.cloud.init(config.CLOUD_ENV ? { env: config.CLOUD_ENV, traceUser: true } : { traceUser: true });
  cloudReady = true;
}

function onceCloud(method, url, data, withAuth) {
  return new Promise((resolve, reject) => {
    try {
      ensureCloud();
    } catch (e) {
      return reject(e);
    }
    wx.cloud.callFunction({
      name: config.CLOUD_FUNCTION || 'apiProxy',
      data: {
        path: url,
        method: method,
        data: data || {},
        auth: withAuth ? getToken() : '',
      },
      success(res) {
        const out = (res && res.result) || {};
        const body = out.body || {};
        if (out.statusCode >= 200 && out.statusCode < 300) return resolve(body);
        const err = body.error || {};
        reject({
          code: err.code || (out.statusCode === 401 ? 'UNAUTHORIZED' : 'INTERNAL'),
          message: err.message || out.message || '',
          statusCode: out.statusCode,
          details: err.details,
        });
      },
      fail(e) {
        reject({ code: 'NETWORK', message: (e && e.errMsg) || 'cloud:fail' });
      },
    });
  });
}

function once(method, url, data, withAuth, text) {
  return new Promise((resolve, reject) => {
    const header = { 'content-type': 'application/json' };
    if (withAuth) {
      const token = getToken();
      if (token) header.Authorization = 'Bearer ' + token;
    }
    wx.request({
      url: apiBase() + url,
      method: method,
      data: data,
      header: header,
      timeout: config.TIMEOUT,
      // 匯出（CSV）要用 dataType:'text'：預設的 json 會嘗試 JSON.parse，
      // 雖然解析失敗會退回原文，但有些基礎庫會直接回空字串 —— 明講才不會拿到一份空檔。
      dataType: text ? 'text' : 'json',
      success(res) {
        const body = res.data || {};
        if (res.statusCode >= 200 && res.statusCode < 300) return resolve(body);
        const err = body.error || {};
        reject({
          code: err.code || (res.statusCode === 401 ? 'UNAUTHORIZED' : 'INTERNAL'),
          message: err.message || '',
          statusCode: res.statusCode,
          details: err.details,
        });
      },
      fail(e) {
        reject({ code: 'NETWORK', message: (e && e.errMsg) || 'request:fail' });
      },
    });
  });
}

/**
 * 統一請求：注入 JWT、逾時、一次重試、錯誤碼正規化。
 * 不在這裡決定要不要示範模式（那是 services/data.js 的事）。
 */
function request(method, url, data, options) {
  const opts = options || {};
  if (!config.API_BASE_URL) {
    return Promise.reject({ code: 'NO_BACKEND', message: 'API_BASE_URL 未設定' });
  }
  const withAuth = opts.auth !== false;
  if (method === 'GET') data = cleanParams(data);
  const transport = opts.transport || config.TRANSPORT || 'https';
  const attempts = 1 + Math.max(0, config.RETRY || 0);

  const run = (left) =>
    (transport === 'cloud' ? onceCloud(method, url, data, withAuth) : once(method, url, data, withAuth, opts.text === true)).catch((err) => {
      // 帶了 token 卻回 401 ＝ JWT 過期／被撤銷：清掉本機登入態，回一個使用者看得懂的
      // SESSION_EXPIRED（否則頁面只顯示「請先登入」，而他明明剛登入過）。
      // auth:false 的呼叫（登入本身）不會走進來，所以打錯密碼不會把人踢掉。
      if (withAuth && getToken() && (err.statusCode === 401 || codeOf(err) === 'UNAUTHORIZED')) {
        dropSession();
        throw { code: 'SESSION_EXPIRED', message: '', statusCode: 401 };
      }
      const retryable = ['NETWORK', 'TIMEOUT', 'INTERNAL'].indexOf(codeOf(err)) !== -1;
      if (left > 1 && retryable) return run(left - 1);
      throw err;
    });

  return run(attempts);
}

module.exports = {
  request,
  get: (url, data, opts) => request('GET', url, data, opts),
  post: (url, data, opts) => request('POST', url, data, opts),
  patch: (url, data, opts) => request('PATCH', url, data, opts),
  del: (url, data, opts) => request('DELETE', url, data, opts),
  getToken,
  setToken,
  apiBase,
};
