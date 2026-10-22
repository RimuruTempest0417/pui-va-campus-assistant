const data = require('../../../services/data');
const { decorate } = require('../../../utils/event');

Page({
  data: {
    loading: true,
    scope: 'upcoming',
    items: [],
    tabs: [
      { key: 'upcoming', label: '即將開始' },
      { key: 'past', label: '已結束' },
      { key: '', label: '全部' },
    ],
  },

  onLoad() {
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
      const res = await data.listEvents({ scope: this.data.scope || undefined });
      this.setData({ loading: false, items: (res.items || []).map(decorate) });
    } catch (e) {
      this.setData({ loading: false, items: [] });
      wx.showToast({ title: data.messageOf(e), icon: 'none' });
    }
  },

  onScopeChange(e) {
    this.setData({ scope: e.detail.key }, () => this.load());
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/events/detail/index?id=' + e.currentTarget.dataset.id });
  },

  goMine() {
    wx.navigateTo({ url: '/pages/events/mine/index' });
  },
});
