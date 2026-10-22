function getNav() {
  let app = null;
  try {
    app = getApp();
  } catch (e) {
    app = null;
  }
  if (app && app.globalData && app.globalData.nav) return app.globalData.nav;
  return { statusBarHeight: 20, navHeight: 44, total: 64, windowWidth: 375, windowHeight: 667 };
}

module.exports = { getNav };
