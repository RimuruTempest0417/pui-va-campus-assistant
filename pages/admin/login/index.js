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

  async submit() {
    if (this.data.submitting) return;
    const account = this.data.account.trim();
    const password = this.data.password;
    if (!account || !password) {
      this.setData({ error: '請填帳號與密碼' });
      return;
    }

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
      this.setData({ error: e.message || '登入失敗' });
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
