const appearance = require('../../utils/appearance');
const i18n = require('../../utils/i18n');
const data = require('../../services/data');
const request = require('../../utils/request');
const config = require('../../config/config');
const roleLabel = require('../../utils/role').label;
const adminApi = require('../../services/admin');

Page({
  labels() {
    return {
      k01: i18n.pick("安全"),
      k02: i18n.pick("兩步驗證"),
      k03: i18n.pick("開啟（產生密鑰）"),
      k04: i18n.pick("複製密鑰"),
      k05: i18n.pick("輸入驗證器上的 6 位數字"),
      k06: i18n.pick("輸入登入密碼以關閉"),
      k17: i18n.pick("已登入"),
      k18: i18n.pick(" · 示範模式"),
      k19: i18n.pick("離線示範資料"),
      k20: i18n.pick("校內後端"),
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
      k30: i18n.pick("安全"),
      k31: i18n.pick("兩步驗證"),
      k32: i18n.pick("已開啟 · 備用碼"),
      k33: i18n.pick("組"),
      k34: i18n.pick("未開啟（建議資訊管理員開啟）"),
      k35: i18n.pick("開啟（產生密鑰）"),
      k36: i18n.pick("密鑰："),
      k37: i18n.pick("複製密鑰"),
      k38: i18n.pick("輸入驗證器上的 6 位數字"),
      k39: i18n.pick("確認中…"),
      k40: i18n.pick("確認開啟"),
      k41: i18n.pick("輸入登入密碼以關閉"),
      k42: i18n.pick("處理中…"),
      k43: i18n.pick("關閉兩步驗證"),
      k44: i18n.pick("備用碼（只顯示這一次，請抄下來或複製收好；每組只能用一次）"),
      k45: i18n.pick("複製全部"),
      k46: i18n.pick("我已保存"),
      k47: i18n.pick("未開啟（請在網頁後台設定）"),
      k48: i18n.pick("複製設定網址"),
      k49: i18n.pick("使用說明"),
      k50: i18n.pick("依身分看操作步驟（學生／家長／老師／管理員）"),

    };
  },

  data: {
    theme: 'system',
    themeClass: appearance.themeClass(),
    localePref: 'system',
    // 選項文字由 options() 在 onShow 產生（含切換後的重算），這裡不重複一份
    themeOptions: [],
    localeOptions: [],
    loggedIn: false,
    user: {},
    roleText: '',
    isDemo: false,
    isStaff: false,
    apiBase: '',
    version: config.VERSION || '',
    statusBarHeight: 20,
    // W-22 兩步驗證
    tfaEnabled: false,
    tfaCodesLeft: 0,
    tfaSetup: null,        // { secret, otpauth, backupCodes }
    tfaBackupCodes: [],    // 啟用成功後要「只顯示一次」的備用碼
    tfaCode: '',
    tfaPassword: '',
    tfaBusy: false,
    tfa2faUrl: 'https://pui-va-campus-server.vercel.app/admin/2fa-ui',
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

  /** 外觀／語言選項的顯示字（切換後要重算，否則留在舊語言） */
  labelOptions() {
    return {
      themeOptions: [
        { key: 'system', label: i18n.pick('跟隨系統') },
        { key: 'light', label: i18n.pick('淺色') },
        { key: 'dark', label: i18n.pick('深色') },
      ],
      localeOptions: [
        { key: 'system', label: i18n.pick('跟隨系統') },
        { key: 'zh-Hant', label: i18n.pick('繁體') },
        { key: 'zh-Hans', label: i18n.pick('簡體') },
      ],
    };
  },

  onShow() {
    this.setData(Object.assign({ L: this.labels() }, this.labelOptions()));
    this.refresh();
    this.loadTwoFactor();
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

  async loadTwoFactor() {
    if (!this.data.isStaff) return;
    try {
      const r = await adminApi.twoFactorStatus();
      this.setData({ tfaEnabled: !!r.enabled, tfaCodesLeft: r.backupCodesLeft || 0 });
    } catch (e) {
      // 沒登入或權限不足時不顯示錯誤，保持頁面安靜
    }
  },

  async tfaBegin() {
    if (this.data.tfaBusy) return;
    this.setData({ tfaBusy: true });
    try {
      const r = await adminApi.twoFactorBegin();
      this.setData({ tfaSetup: r, tfaCode: '' });
      wx.showModal({
        title: i18n.pick('把密鑰加進驗證器'),
        content: i18n.pick('在驗證器 App 選「輸入設定金鑰」，貼上：') + '\n' + r.secret,
        showCancel: false,
      });
    } catch (e) {
      wx.showToast({ title: data.messageOf(e), icon: 'none' });
    } finally {
      this.setData({ tfaBusy: false });
    }
  },

  onTfaCode(e) {
    this.setData({ tfaCode: e.detail.value });
  },

  async tfaEnable() {
    if (this.data.tfaBusy) return;
    this.setData({ tfaBusy: true });
    try {
      const pending = (this.data.tfaSetup && this.data.tfaSetup.backupCodes) || [];
      await adminApi.twoFactorEnable(String(this.data.tfaCode || '').trim());
      // 備用碼只會出現這一次：留在畫面上給使用者抄／複製，並提示收好
      this.setData({ tfaSetup: null, tfaCode: '', tfaBackupCodes: pending });
      await this.loadTwoFactor();
      wx.showToast({ title: i18n.pick('已開啟兩步驗證'), icon: 'success' });
    } catch (e) {
      wx.showToast({ title: data.messageOf(e), icon: 'none' });
    } finally {
      this.setData({ tfaBusy: false });
    }
  },

  onTfaPassword(e) {
    this.setData({ tfaPassword: e.detail.value });
  },

  async tfaDisable() {
    if (this.data.tfaBusy) return;
    this.setData({ tfaBusy: true });
    try {
      await adminApi.twoFactorDisable(String(this.data.tfaPassword || ''));
      this.setData({ tfaPassword: '' });
      await this.loadTwoFactor();
      wx.showToast({ title: i18n.pick('已關閉兩步驗證'), icon: 'none' });
    } catch (e) {
      wx.showToast({ title: data.messageOf(e), icon: 'none' });
    } finally {
      this.setData({ tfaBusy: false });
    }
  },

  goHelp() {
    wx.navigateTo({ url: '/pages/help/index' });
  },

  copy2faUrl() {
    wx.setClipboardData({ data: this.data.tfa2faUrl });
  },

  copyBackupCodes() {
    const codes = this.data.tfaBackupCodes || [];
    if (!codes.length) return;
    wx.setClipboardData({ data: codes.join('\n') });
  },

  hideBackupCodes() {
    this.setData({ tfaBackupCodes: [] });
  },

  copySecret() {
    if (!this.data.tfaSetup) return;
    wx.setClipboardData({ data: this.data.tfaSetup.secret });
  },

  pickTheme(e) {
    const v = e.currentTarget.dataset.key;
    appearance.setTheme(v);
    this.setData({ theme: appearance.getTheme(), themeClass: appearance.themeClass() });
    wx.showToast({ title: i18n.pick('外觀已更新'), icon: 'none' });
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
    this.setData(Object.assign({ localePref: v, L: this.labels() }, this.labelOptions()));
    wx.showToast({ title: i18n.pick('語言已切換'), icon: 'none' });
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
    wx.showToast({ title: i18n.pick('已登出'), icon: 'none' });
  },

  back() {
    if (getCurrentPages().length > 1) wx.navigateBack();
    else wx.reLaunch({ url: '/pages/index/index' });
  },
});
