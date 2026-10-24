const admin = require('../../../services/admin');
const request = require('../../../utils/request');
const config = require('../../../config/config');
const roleLabel = require('../../../utils/role').label;

const i18n = require('../../utils/i18n');

Page({
  labels() {
    return {
      k01: i18n.pick("登入"),
      k02: i18n.pick("培華校園助手"),
      k03: i18n.pick("回首頁"),
      k04: i18n.pick("到設定管理帳號"),
      k05: i18n.pick("帳號"),
      k06: i18n.pick("例如 3201201001"),
      k07: i18n.pick("密碼"),
      k08: i18n.pick("請輸入密碼"),
    };
  },

  data: {
    loggedIn: false,      // 已登入就只顯示「目前身分＋登出」，不再同時擺一份登入表單（使用者回報的怪畫面）
    account: '',
    password: '',
    submitting: false,
    error: '',
    currentRole: '',
    currentRoleText: '',
    currentName: '',
  },

  onLoad() {
    this.refreshCurrent();
  },

  onShow() {
    this.setData({ L: this.labels() });
    // 從背景回來或換頁回來時，不要把上一次的「登入中…」帶進來
    if (this.data.submitting) this.setData({ submitting: false });
  },

  onUnload() {
    if (this._watchdog) clearTimeout(this._watchdog);
  },

  /// 看門狗：15 秒內沒有任何結果就自己收手（避免渲染層壞掉時永久卡在「登入中…」）
  armWatchdog() {
    this.disarmWatchdog();
    this._watchdog = setTimeout(() => {
      if (!this.data.submitting) return;
      this.setData({ submitting: false, error: '連線逾時（15 秒沒有回應），請檢查網路或後端狀態' });
      wx.showModal({ title: '登入逾時', content: '15 秒內沒有收到後端回應。\n請確認網路，或到「資料來源」頁看後端位址是否正確。', showCancel: false });
    }, 15000);
  },

  disarmWatchdog() {
    if (this._watchdog) {
      clearTimeout(this._watchdog);
      this._watchdog = null;
    }
  },

  refreshCurrent() {
    let user = {};
    try {
      user = wx.getStorageSync(config.STORAGE_KEYS.user) || {};
    } catch (e) {
      user = {};
    }
    const role = user.role || '';
    this.setData({
      currentRole: role,
      currentRoleText: roleLabel(role),
      currentName: user.nickname || '',
      loggedIn: !!role && !!request.getToken(),
    });
  },

  onAccount(e) {
    this.setData({ account: e.detail.value, error: '' });
  },

  onPassword(e) {
    this.setData({ password: e.detail.value, error: '' });
  },

  // 原生 form 送出：值直接由表單回傳，即使 bindinput 沒觸發也拿得到
  onSubmit(e) {
    const v = (e && e.detail && e.detail.value) || {};
    const account = v.account || this.data.account;
    const password = v.password || this.data.password;
    return this.doLogin(account, password);
  },

  async submit() {
    return this.doLogin(this.data.account, this.data.password);
  },

  async doLogin(accountRaw, passwordRaw) {
    const account = String(accountRaw || '').trim();
    const password = String(passwordRaw || '');
    if (!account || !password) {
      this.setData({ error: '請填帳號與密碼' });
      return;
    }
    return this._login(account, password);
  },

  async _login(account, password) {
    if (this.data.submitting) return;
    this.setData({ submitting: true, error: '' });
    this.armWatchdog();
    try {
      const res = await admin.login(account, password);
      request.setToken(res.token);
      wx.setStorageSync(config.STORAGE_KEYS.user, { nickname: res.nickname, role: res.role });
      wx.showToast({ title: '已登入', icon: 'success' });
      this.refreshCurrent();
      // 登入只負責「登入」；後台入口由首頁那顆按鈕負責
      setTimeout(() => wx.navigateBack(), 400);
    } catch (e) {
      // 錯誤要看得懂：把代碼也顯示出來，否則「登入失敗」四個字無法判斷是網路、密碼還是權限
      const code = (e && e.code) || 'UNKNOWN';
      const msg = (e && e.message) || '登入失敗';
      const hint =
        code === 'NETWORK' || code === 'TIMEOUT'
          ? msg + '（連不到後端：' + config.API_BASE_URL + '）'
          : code === 'RATE_LIMITED'
            ? '嘗試太多次，請等一分鐘再試'
            : msg + '（' + code + '）';
      this.setData({ error: hint });
      console.error('[admin-login]', code, msg);
      // 原生彈窗：即使頁面渲染層異常，使用者仍能看到失敗原因
      wx.showModal({ title: '登入未成功', content: hint, showCancel: false });
    } finally {
      this.disarmWatchdog();
      this.setData({ submitting: false });
    }
  },

  goBack() {
    if (getCurrentPages().length > 1) wx.navigateBack();
    else wx.reLaunch({ url: '/pages/index/index' });
  },

  goSettings() {
    wx.navigateTo({ url: '/pages/settings/index' });
  },

  logout() {
    request.setToken('');
    wx.removeStorageSync(config.STORAGE_KEYS.user);
    this.setData({ currentRole: '', currentRoleText: '', currentName: '', loggedIn: false });
    wx.showToast({ title: '已登出', icon: 'none' });
  },
});
