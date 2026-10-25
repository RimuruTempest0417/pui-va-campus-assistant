const data = require('../../../services/data');
const { decorate, decorateClaim } = require('../../../utils/item');

const i18n = require('../../../utils/i18n');

const appearance = require('../../../utils/appearance');

Page({
  labels() {
    return {
      k10: i18n.pick("其他"),
      k01: i18n.pick("我的發布"),
      k02: i18n.pick("載入失敗"),
      k03: i18n.pick("重試"),
      k04: i18n.pick("你還沒發布過"),
      k05: i18n.pick("東西丟了或撿到東西，都在這裡管理"),
      k06: i18n.pick("去發布"),
      k07: i18n.pick("標記已認領"),
      k08: i18n.pick("標記已完成"),
      k09: i18n.pick("查看"),
      k11: i18n.pick("我申請的"),
      k12: i18n.pick("你還沒申請過認領"),
      k13: i18n.pick("看到別人的失物或拾獲，可以在詳情頁按「我要認領」"),
      k14: i18n.pick("申請於"),
      k15: i18n.pick("處理於"),
    };
  },

  data: {
    themeClass: appearance.themeClass(), scope: 'mine', tabs: [],
    loading: true, items: [], claims: [], failed: false, errorText: '' },

  onLoad() {
    this.setData({ tabs: this.tabList() });
    this.load();
  },

  onShow() {
    this.setData({ L: this.labels(), tabs: this.tabList(), themeClass: appearance.themeClass() });
    if (this._loadedOnce) this.load();
    this._loadedOnce = true;
  },

  // 標籤要在 onShow 重算：在設定頁切成簡體再回來，onLoad 不會再跑
  tabList() {
    return [
      { key: 'mine', label: i18n.pick('我的發布') },
      { key: 'claims', label: i18n.pick('我申請的') },
    ];
  },

  onScopeChange(e) {
    const scope = e.detail.key;
    if (scope === this.data.scope) return;
    this.setData({ scope: scope, loading: true, failed: false, errorText: '' });
    this.load();
  },

  async load() {
    try {
      if (this.data.scope === 'claims') {
        const res = await data.myClaims();
        this.setData({
          loading: false, failed: false, errorText: '',
          claims: (res.items || []).map(decorateClaim),
        });
        return;
      }
      const res = await data.myItems();
      this.setData({ loading: false, failed: false, errorText: '', items: (res.items || []).map(decorate) });
    } catch (e) {
      this.setData({ loading: false, failed: true, errorText: data.messageOf(e), items: [], claims: [] });
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
      wx.showToast({ title: next === 'CLAIMED' ? i18n.pick('已標記認領中') : i18n.pick('已完成'), icon: 'success' });
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
