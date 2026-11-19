/**
 * 版本檢查（v1.0.16）
 *
 * Gary 的要求：「舊版開進去還是舊畫面，要提醒他重開」。
 *
 * 做法：開機問後端 `/app/version`，拿 `minClient` 跟本機 `config.VERSION` 比。
 * 版本太舊 → 擋一個 modal，只有「重新載入」一個選項（不給「稍後再說」，
 * 否則他會按掉繼續用一個行為已經變了的介面）。
 *
 * 另外接 `wx.getUpdateManager()`：微信用新版覆蓋舊 bundle 時會通知，
 * 這裡順手問要不要立刻重啟（不然要下次冷啟動才生效）。
 */
const config = require('../config/config');
const request = require('./request');
const i18n = require('./i18n');

/** '1.0.16' → [1,0,16]；不是數字的段落當 0 */
function parse(v) {
  return String(v || '')
    .split('.')
    .map((s) => parseInt(s.replace(/[^0-9]/g, ''), 10) || 0);
}

/** a < b 回 -1、相等 0、a > b 回 1 */
function compare(a, b) {
  const x = parse(a);
  const y = parse(b);
  const len = Math.max(x.length, y.length);
  for (let i = 0; i < len; i += 1) {
    const dx = x[i] || 0;
    const dy = y[i] || 0;
    if (dx !== dy) return dx < dy ? -1 : 1;
  }
  return 0;
}

function restart(message) {
  wx.showModal({
    title: i18n.pick('需要更新'),
    content: message || i18n.pick('這個版本已經太舊，請重新載入小程式。'),
    showCancel: false,
    confirmText: i18n.pick('重新載入'),
    success: () => {
      try {
        const um = wx.getUpdateManager && wx.getUpdateManager();
        if (um && um.applyUpdate) {
          um.applyUpdate();
          return;
        }
      } catch (e) {
        /* 沒有更新管理器就走下面的重啟 */
      }
      wx.reLaunch({ url: '/pages/admin/login/index' });
    },
  });
}

/**
 * 開機檢查。抓不到後端就靜默跳過 —— 版本檢查不該變成新的「連不上就進不去」。
 * @returns {Promise<boolean>} 版本是否可用
 */
function check() {
  return request
    .get('/app/version', {}, { auth: false, retry: false, timeout: 6000 })
    .then((res) => {
      const min = (res && res.minClient) || '';
      if (!min) return true;
      if (compare(config.VERSION, min) < 0) {
        restart(res.message);
        return false;
      }
      return true;
    })
    .catch(() => true);
}

/** 微信已下載新 bundle：問一次要不要現在重啟 */
function watchUpdate() {
  try {
    const um = wx.getUpdateManager && wx.getUpdateManager();
    if (!um) return;
    um.onUpdateReady(() => {
      wx.showModal({
        title: i18n.pick('有新版本'),
        content: i18n.pick('新版本已經下載好，重新開啟就會生效。'),
        confirmText: i18n.pick('立即重啟'),
        cancelText: i18n.pick('稍後'),
        success: (r) => {
          if (r.confirm) um.applyUpdate();
        },
      });
    });
  } catch (e) {
    /* 舊基礎庫沒有更新管理器：忽略 */
  }
}

module.exports = { check, watchUpdate, compare };
