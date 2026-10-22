// app.js
App({
  globalData: {
    nav: null,
  },

  onLaunch() {
    this.globalData.nav = measureNav();
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
