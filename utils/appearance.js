/**
 * 外觀與語言偏好（使用者 2026-10-24 定案）
 *  - 語言：預設「跟隨手機系統」，可覆寫繁體／簡體
 *  - 外觀：預設「跟隨系統」，可覆寫淺色／深色
 * 兩者都存 storage，切換後由各頁 onShow 重新套用。
 */
const config = require('../config/config');

const THEME_KEY = 'pv_theme';      // 'system' | 'light' | 'dark'
const LOCALE_KEY = 'pv_locale';    // 'system' | 'zh-Hant' | 'zh-Hans'

function getTheme() {
  try {
    return wx.getStorageSync(THEME_KEY) || 'system';
  } catch (e) {
    return 'system';
  }
}

function setTheme(v) {
  const next = ['system', 'light', 'dark'].indexOf(v) >= 0 ? v : 'system';
  try {
    wx.setStorageSync(THEME_KEY, next);
  } catch (e) {
    /* storage 不可用只影響本次 */
  }
  return next;
}

/** 系統目前是深還是淺（拿不到就當淺色） */
function systemTheme() {
  try {
    const info = wx.getAppBaseInfo ? wx.getAppBaseInfo() : wx.getSystemInfoSync();
    return info.theme === 'dark' ? 'dark' : 'light';
  } catch (e) {
    return 'light';
  }
}

/** 實際要用的主題：'light' | 'dark' */
function resolvedTheme() {
  const t = getTheme();
  return t === 'system' ? systemTheme() : t;
}

/** 給頁面根節點用的 class（Skyline 可用 CSS 變數，但不能用 prefers-color-scheme 動態切） */
function themeClass() {
  return resolvedTheme() === 'dark' ? 'theme-dark' : 'theme-light';
}

function getLocalePref() {
  try {
    return wx.getStorageSync(LOCALE_KEY) || 'system';
  } catch (e) {
    return 'system';
  }
}

function setLocalePref(v) {
  const next = ['system', 'zh-Hant', 'zh-Hans'].indexOf(v) >= 0 ? v : 'system';
  try {
    wx.setStorageSync(LOCALE_KEY, next);
  } catch (e) {
    /* ignore */
  }
  return next;
}

/** 系統語言 → 繁／簡（中文系一律看地區） */
function systemLocale() {
  let lang = '';
  try {
    const info = wx.getAppBaseInfo ? wx.getAppBaseInfo() : wx.getSystemInfoSync();
    lang = String(info.language || '');
  } catch (e) {
    lang = '';
  }
  if (!lang) return config.LOCALE || 'zh-Hant';
  const lower = lang.toLowerCase();
  if (lower === 'zh_cn' || lower === 'zh_sg' || lower === 'zh-hans') return 'zh-Hans';
  return 'zh-Hant';
}

function resolvedLocale() {
  const pref = getLocalePref();
  return pref === 'system' ? systemLocale() : pref;
}

/** 監聽系統主題變化（跟隨系統時要即時反應） */
function watchTheme(cb) {
  if (!wx.onThemeChange) return null;
  return wx.onThemeChange((res) => {
    if (getTheme() === 'system' && cb) cb(res.theme === 'dark' ? 'dark' : 'light');
  });
}

module.exports = {
  THEME_KEY,
  LOCALE_KEY,
  getTheme,
  setTheme,
  systemTheme,
  resolvedTheme,
  themeClass,
  getLocalePref,
  setLocalePref,
  systemLocale,
  resolvedLocale,
  watchTheme,
};
