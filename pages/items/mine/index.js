const data = require('../../../services/data');
const { decorate } = require('../../../utils/item');

const i18n = require('../../utils/i18n');

const appearance = require('../../utils/appearance');

Page({
  labels() {
    return {
      k01: i18n.pick("我的發布"),
      k02: i18n.pick("載入失敗"),
      k03: i18n.pick("重試"),
      k04: i18n.pick("你還沒發布過"),
      k05: i18n.pick("東西丟了或撿到東西，都在這裡管理"),
      k06: i18n.pick("去發布"),
      k07: i18n.pick("標記已認領"),
      k08: i18n.pick("標記已完成"),
      k09: i18n.pick("查看"),
    };
  },

  data: {
    themeClass: appearance.themeClass(), loading: true, items: [], failed: false, errorText: '' },

  onLoad() {
    this.load();
  },

  onShow() {
    this.setData({ L: this.labels(), themeClass: appearance.themeClass() });
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
