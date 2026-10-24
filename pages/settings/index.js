const appearance = require('../../utils/appearance');
const i18n = require('../../utils/i18n');
const data = require('../../services/data');
const request = require('../../utils/request');
const config = require('../../config/config');
const roleLabel = require('../../utils/role').label;

Page({
  labels() {
    return {
      k01: i18n.pick("設定"),
      k02: i18n.pick("帳號"),
      k03: i18n.pick("管理後台"),
      k04: i18n.pick("切換帳號"),
      k05: i18n.pick("登出"),
      k06: i18n.pick("登入"),
      k07: i18n.pick("教職員、家長、學生登入後才能報名或管理"),
      k08: i18n.pick("介面語言"),
      k09: i18n.pick("預設跟隨手機語言；只想看繁體或簡體可以在這裡鎖定。只影響介面文字，不動公告與貼文內容。"),
      k10: i18n.pick("外觀"),
      k11: i18n.pick("跟隨系統：手機切換深色時自動跟著變。"),
      k12: i18n.pick("資料來源"),
      k13: i18n.pick("關於"),
      k14: i18n.pick("版本"),
      k15: i18n.pick("學校"),
      k16: i18n.pick("澳門培華中學"),
    };
  },

  data: {
    theme: 'system',
    themeClass: appearance.themeClass(),
    localePref: 'system',
    themeOptions: [
      { key: 'system', label: '跟隨系統' },
      { key: 'light', label: '淺色' },
      { key: 'dark', label: '深色' },
    ],
    localeOptions: [
      { key: 'system', label: '跟隨系統' },
      { key: 'zh-Hant', label: '繁體' },
      { key: 'zh-Hans', label: '簡體' },
    ],
    loggedIn: false,
    user: {},
    roleText: '',
    isDemo: false,
    isStaff: false,
    apiBase: '',
    version: '0.34.0',
    statusBarHeight: 20,
  },

  onLoad() {
    let info = {};
    try {
      info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    } catch (e) {
      info = {};
    }
    this.setData({ statusBarHeight: info.statusBarHeight || 20, apiBase: request.apiBase() });
  },

  onShow() {
    this.setData({ L: this.labels() });
    this.refresh();
  },

  refresh() {
    let user = {};
    try {
      user = wx.getStorageSync(config.STORAGE_KEYS.user) || {};
    } catch (e) {
      user = {};
    }
    const role = user.role || '';
    this.setData({
      theme: appearance.getTheme(),
      themeClass: appearance.themeClass(),
      localePref: appearance.getLocalePref(),
      isDemo: data.isDemo ? data.isDemo() : false,
      loggedIn: !!role && !!request.getToken(),
      user,
      roleText: roleLabel(role),
      isStaff: ['SUPER_ADMIN', 'ADMIN', 'STAFF', 'TEACHER'].indexOf(role) >= 0,
      apiBase: request.apiBase(),
    });
  },

  pickTheme(e) {
    const v = e.currentTarget.dataset.key;
    appearance.setTheme(v);
    this.setData({ theme: appearance.getTheme(), themeClass: appearance.themeClass() });
    wx.showToast({ title: '外觀已更新', icon: 'none' });
  },

  pickLocale(e) {
    const v = e.currentTarget.dataset.key;
    appearance.setLocalePref(v);
    // i18n 的 storage 與偏好共用 pv_locale：'system' 代表跟隨系統
    try {
      wx.setStorageSync(config.STORAGE_KEYS.locale || 'pv_locale', v);
    } catch (err) {
      /* ignore */
    }
    i18n.setLocale(v === 'system' ? appearance.systemLocale() : v);
    this.setData({ localePref: v });
    wx.showToast({ title: '語言已切換', icon: 'none' });
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/admin/login/index' });
  },

  goAdmin() {
    wx.navigateTo({ url: '/pages/admin/index/index' });
  },

  goDev() {
    wx.navigateTo({ url: '/pages/dev/api-check/index' });
  },

  logout() {
    request.setToken('');
    try {
      wx.removeStorageSync(config.STORAGE_KEYS.user);
    } catch (e) {
      /* ignore */
    }
    this.refresh();
    wx.showToast({ title: '已登出', icon: 'none' });
  },

  back() {
    if (getCurrentPages().length > 1) wx.navigateBack();
    else wx.reLaunch({ url: '/pages/index/index' });
  },
});
