const data = require('../../../services/data');
const { decorate } = require('../../../utils/notice');
const i18n = require('../../../utils/i18n');

const appearance = require('../../../utils/appearance');

Page({
  labels() {
    return {
      k01: i18n.pick("公告與提示"),
      k02: i18n.pick("載入失敗"),
      k03: i18n.pick("重試"),
      k04: i18n.pick("目前沒有公告"),
      k05: i18n.pick("重要通知會出現在這裡"),
      k06: i18n.pick("置頂"),
      // DICT 共用鍵：onShow 會整個覆蓋 L，漏在這裡就會變空字串（v0.37.0 修）
      list: i18n.t('common.list'),
      calendar: i18n.t('common.calendar'),
      allRead: i18n.t('common.allRead'),
    };
  },

  data: {
    themeClass: appearance.themeClass(), loading: true, refreshing: false, failed: false, errorText: '', items: [], unread: 0 },

  onLoad() {
    this.load();
  },

  onShow() {
    this.setData({ L: this.labels(), themeClass: appearance.themeClass() });
    if (this._loadedOnce) this.load();
    this._loadedOnce = true;
  },

  onRefresh() {
    this.setData({ refreshing: true });
    this.load().then(() => this.setData({ refreshing: false }));
  },

  async load() {
    try {
      const res = await data.listNotices({});
      this.setData({
        loading: false,
        items: (res.items || []).map(decorate),
        unread: res.unread || 0,
        failed: false,
        errorText: '',
      });
    } catch (e) {
      this.setData({ loading: false, failed: true, errorText: data.messageOf(e), items: [] });
      wx.showToast({ title: data.messageOf(e), icon: 'none' });
    }
  },

  retry() {
    this.setData({ loading: true, failed: false, errorText: '' });
    return this.load();
  },

  async markAllRead() {
    await data.markAllNoticesRead();
    this.load();
  },

  goCalendar() {
    wx.navigateTo({ url: '/pages/calendar/index' });
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/notices/detail/index?id=' + e.currentTarget.dataset.id });
  },
});
