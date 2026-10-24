const data = require('../../../services/data');
const { decorate } = require('../../../utils/item');

Page({
  data: { loading: true, items: [], failed: false, errorText: '' },

  onLoad() {
    this.load();
  },

  onShow() {
    if (this._loadedOnce) this.load();
    this._loadedOnce = true;
  },

  async load() {
    try {
      const res = await data.myItems();
      this.setData({ loading: false, failed: false, errorText: '', items: (res.items || []).map(decorate) });
    } catch (e) {
      this.setData({ loading: false, failed: true, errorText: data.messageOf(e), items: [] });
    }
  },

  retry() {
    this.setData({ loading: true, failed: false, errorText: '' });
    return this.load();
  },

  async advance(e) {
    const id = e.currentTarget.dataset.id;
    const next = e.currentTarget.dataset.next;
    try {
      await data.updateItemStatus(id, next);
      wx.showToast({ title: next === 'CLAIMED' ? '已標記認領中' : '已完成', icon: 'success' });
      this.load();
    } catch (err) {
      wx.showToast({ title: data.messageOf(err), icon: 'none' });
    }
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/items/detail/index?id=' + e.currentTarget.dataset.id });
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/items/create/index' });
  },
});
