const data = require('../../../services/data');
const i18n = require('../../../utils/i18n');
const appearance = require('../../../utils/appearance');
const giveaway = require('../../../utils/giveaway');

Page({
  labels() {
    return {
      k01: i18n.pick('二手轉贈'),
      k02: i18n.pick('我的轉贈'),
      k03: i18n.pick('搜尋書名、科目或尺碼'),
      k04: i18n.pick('載入失敗'),
      k05: i18n.pick('重試'),
      k06: i18n.pick('目前沒有人送東西'),
      k07: i18n.pick('用不到的教科書、換季的校服都可以放上來，讓它去到需要的人手上'),
      k08: i18n.pick('送出東西'),
      k09: i18n.pick('沒有符合的物品'),
      k10: i18n.pick('換個關鍵字，或切回「全部」'),
      k11: i18n.pick('載入中…'),
      k12: i18n.pick('全部'),
      k13: i18n.pick('書籍'),
      k14: i18n.pick('校服'),
      k15: i18n.pick('其他'),
      k16: i18n.pick('免費贈送'),
      k17: i18n.pick('送出中…'),
    };
  },

  data: {
    themeClass: appearance.themeClass(),
    loading: true,
    failed: false,
    errorText: '',
    items: [],
    keyword: '',
    kind: '',
    pressedId: '',
    refreshing: false,
    tabs: [],
    L: {},
  },

  onLoad() {
    this.setData({ L: this.labels(), tabs: this.buildTabs() });
    this.load();
  },

  onShow() {
    this.setData({ L: this.labels(), themeClass: appearance.themeClass(), tabs: this.buildTabs() });
    // 從詳情頁回來（東西被贈出、自己下架、剛發布）清單要跟著變
    if (this._loadedOnce) this.load();
    this._loadedOnce = true;
  },

  buildTabs() {
    return [
      { key: '', label: i18n.pick('全部') },
      { key: 'BOOK', label: i18n.pick('書籍') },
      { key: 'UNIFORM', label: i18n.pick('校服') },
      { key: 'OTHER', label: i18n.pick('其他') },
    ];
  },

  async load() {
    this.setData({ loading: true });
    try {
      const res = await data.listGiveaways({ kind: this.data.kind || undefined, q: this.data.keyword || undefined, limit: 50 });
      const items = (res.items || []).map((item) => giveaway.decorateItem(item));
      this.setData({ loading: false, failed: false, errorText: '', items: items });
    } catch (e) {
      this.setData({ loading: false, failed: true, errorText: data.messageOf(e), items: [] });
    }
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value });
  },

  onSearch() {
    this.load();
  },

  onClearKeyword() {
    this.setData({ keyword: '' });
    this.load();
  },

  onTabChange(e) {
    const key = e.currentTarget.dataset.key || '';
    this.setData({ kind: key });
    this.load();
  },

  onRefresh() {
    this.setData({ refreshing: true });
    this.load().then(() => this.setData({ refreshing: false }));
  },

  retry() {
    this.load();
  },

  onItemTouchStart(e) {
    this.setData({ pressedId: e.currentTarget.dataset.id });
  },

  onItemTouchEnd() {
    this.setData({ pressedId: '' });
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: '/pages/giveaway/detail/index?id=' + id });
  },

  goMine() {
    wx.navigateTo({ url: '/pages/giveaway/mine/index' });
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/giveaway/create/index' });
  },

  onShareAppMessage() {
    return { title: i18n.pick('二手轉贈'), path: '/pages/giveaway/list/index' };
  },
});
