const admin = require('../../../services/admin');
const request = require('../../../utils/request');
const config = require('../../../config/config');

Page({
  data: {
    account: '',
    password: '',
    submitting: false,
    error: '',
    currentRole: '',
    currentName: '',
  },

  onLoad() {
    this.refreshCurrent();
  },

  refreshCurrent() {
    let user = {};
    try {
      user = wx.getStorageSync(config.STORAGE_KEYS.user) || {};
    } catch (e) {
      user = {};
    }
    this.setData({ currentRole: user.role || '', currentName: user.nickname || '' });
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
    } finally {
      this.setData({ submitting: false });
    }
  },

  logout() {
    request.setToken('');
    wx.removeStorageSync(config.STORAGE_KEYS.user);
    this.setData({ currentRole: '', currentName: '' });
    wx.showToast({ title: '已登出', icon: 'none' });
  },
});
