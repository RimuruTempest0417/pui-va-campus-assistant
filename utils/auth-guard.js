/**
 * 登入守門（v1.0.15）
 *
 * Gary 定案：**小程式一開就是登入頁，沒有登入不能用**。
 * 以前首頁可以先看一遍（訪客狀態），分享連結也能進到內頁，
 * 結果同學打開只看到「請先登入」或一片空白，不知道要做什麼。
 *
 * 用法：主入口頁的 `onShow` 第一行 `if (!guard()) return;`
 * 回傳 false 代表已經被踢去登入頁，這個頁面就不要繼續抓資料。
 */
const config = require('../config/config');

const LOGIN_PAGE = '/pages/admin/login/index';

function hasToken() {
  try {
    return Boolean(wx.getStorageSync(config.STORAGE_KEYS.token));
  } catch (e) {
    return false;
  }
}

function currentRoute() {
  const pages = getCurrentPages();
  const cur = pages[pages.length - 1];
  return cur ? '/' + cur.route : '';
}

/** 導到登入頁（已經在登入頁就不要重導，否則會無限繞） */
function goLogin(reason) {
  if (currentRoute() === LOGIN_PAGE) return false;
  const url = reason ? `${LOGIN_PAGE}?reason=${encodeURIComponent(reason)}` : LOGIN_PAGE;
  wx.reLaunch({ url });
  return false;
}

/** 沒登入就踢回登入頁；回傳 true 才可以繼續 */
function guard() {
  return hasToken() ? true : goLogin('needLogin');
}

module.exports = { hasToken, guard, goLogin, LOGIN_PAGE };
