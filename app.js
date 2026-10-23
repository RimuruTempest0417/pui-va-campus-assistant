// app.js
const reporter = require('./utils/reporter');

App({
  globalData: {
    nav: null,
    reportError: reporter.reportError,
  },

  onLaunch() {
    this.globalData.nav = measureNav();
  },

  // 全域錯誤（白屏、閃退最常見的來源）→ 送到後端，後台「錯誤」分頁看得到。
  // 不上報的話，這些錯誤只留在使用者手機上，誰都看不到。
  onError(err) {
    const msg = err && err.message ? err.message : err;
    reporter.reportError(msg, err && err.stack);
  },

  onUnhandledRejection(res) {
    const reason = res && res.reason;
    const msg = (reason && (reason.message || reason.errMsg || reason.code)) || '未處理的 Promise 失敗';
    reporter.reportError(msg, reason && reason.stack);
  },
});

/**
 * 量出「狀態列 + 膠囊導航列」的實際高度。
 * 不做這件事的後果：動態島與右上角膠囊會蓋住頁面頂部，連點都點不到。
 */
function measureNav() {
  let info = {};
  try {
    info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
  } catch (e) {
    info = {};
  }
  const statusBarHeight = info.statusBarHeight || 20;

  let rect = null;
  try {
    rect = wx.getMenuButtonBoundingClientRect();
  } catch (e) {
    rect = null;
  }

  // 膠囊的上下留白對稱 → 導航列高度 = (膠囊 top - 狀態列高) * 2 + 膠囊高
  const navHeight = rect && rect.height ? (rect.top - statusBarHeight) * 2 + rect.height : 44;

  return {
    statusBarHeight: statusBarHeight,
    navHeight: navHeight,
    total: statusBarHeight + navHeight,
    capsuleTop: rect ? rect.top : 0,
    capsuleHeight: rect ? rect.height : 0,
    windowWidth: info.windowWidth || 375,
    windowHeight: info.windowHeight || 667,
  };
}
