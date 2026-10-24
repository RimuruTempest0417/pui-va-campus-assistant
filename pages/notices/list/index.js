const data = require('../../../services/data');
const { decorate } = require('../../../utils/notice');
const i18n = require('../../../utils/i18n');

Page({
  data: { loading: true, refreshing: false, items: [], unread: 0 },

  onLoad() {
    this.setData({ L: { list: i18n.t('common.list'), calendar: i18n.t('common.calendar'), allRead: i18n.t('common.allRead') } });
    this.load();
  },

  onShow() {
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
      });
    } catch (e) {
      this.setData({ loading: false, items: [] });
      wx.showToast({ title: data.messageOf(e), icon: 'none' });
    }
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
