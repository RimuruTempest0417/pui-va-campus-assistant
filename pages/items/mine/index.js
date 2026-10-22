const data = require('../../../services/data');
const { decorate } = require('../../../utils/item');

Page({
  data: { loading: true, items: [] },

  onLoad() {
    this.load();
  },

  onShow() {
    if (!this.data.loading) this.load();
  },

  async load() {
    try {
      const res = await data.myItems();
      this.setData({ loading: false, items: (res.items || []).map(decorate) });
    } catch (e) {
      this.setData({ loading: false, items: [] });
      wx.showToast({ title: data.messageOf(e), icon: 'none' });
    }
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
