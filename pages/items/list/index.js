const data = require('../../../services/data');
const { decorate } = require('../../../utils/item');

const i18n = require('../../../utils/i18n');

const appearance = require('../../../utils/appearance');

Page({
  labels() {
    return {
      k09: i18n.pick("沒有符合的結果"),
      k10: i18n.pick("這裡還空著"),
      k11: i18n.pick("換個關鍵字，或清除篩選條件"),
      k12: i18n.pick("第一個發布的人，最有機會找回東西"),
      k13: i18n.pick("其他"),
      k01: i18n.pick("校園失物招領"),
      k02: i18n.pick("搜標題、地點、描述"),
      k03: i18n.pick("載入失敗"),
      k04: i18n.pick("重試"),
      k05: i18n.pick("我要發布"),
      k06: i18n.pick("載入中…"),
      k07: i18n.pick("— 已經到底了 —"),
      k08: i18n.pick("＋ 發布"),
    };
  },

  data: {
    themeClass: appearance.themeClass(),
    refreshing: false,
    loading: true,
    loadingMore: false,
    failed: false,
    errorText: '',
    items: [],
    total: 0,
    page: 1,
    hasMore: false,
    type: '',
    status: '',
    keyword: '',
    pressedId: '',
    typeTabs: [
      { key: '', label: i18n.pick('全部') },
      { key: 'LOST', label: i18n.pick('失物') },
      { key: 'FOUND', label: i18n.pick('拾獲') },
    ],
    statusChips: [
      { key: '', label: i18n.pick('不限狀態') },
      { key: 'OPEN', label: i18n.pick('待認領') },
      { key: 'CLAIMED', label: i18n.pick('已認領') },
      { key: 'CLOSED', label: i18n.pick('已完成') },
    ],
  },

  onLoad() {
    this.load(true);
  },

  // 從詳情／發布頁返回時要重新抓，否則認領後狀態還是舊的
  onShow() {
    this.setData({ L: this.labels(), themeClass: appearance.themeClass() });
    if (this._loadedOnce) this.load(true);
    this._loadedOnce = true;
  },

  onRefresh() {
    this.setData({ refreshing: true });
    this.load(true, false).then(() => this.setData({ refreshing: false }));
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loadingMore) this.load(false);
  },

  async load(reset) {
    if (reset) this.setData({ loading: true, page: 1 });
    else this.setData({ loadingMore: true });

    try {
      const res = await data.listItems({
        type: this.data.type || undefined,
        status: this.data.status || undefined,
        q: this.data.keyword || undefined,
        page: reset ? 1 : this.data.page + 1,
        pageSize: 10,
      });
      const decorated = (res.items || []).map(decorate);
      this.setData({
        loading: false,
        loadingMore: false,
        items: reset ? decorated : this.data.items.concat(decorated),
        total: res.total,
        hasMore: res.hasMore,
        page: res.page,
        failed: false,
        errorText: '',
      });
    } catch (e) {
      // 只有「畫面上本來就沒有東西」才整塊換成失敗畫面；分頁的第二頁失敗不該蓋掉已載入的清單
      this.setData({
        loading: false,
        loadingMore: false,
        failed: !this.data.items.length,
        errorText: data.messageOf(e),
      });
      wx.showToast({ title: data.messageOf(e), icon: 'none' });
    }
  },

  retry() {
    this.setData({ loading: true, failed: false, errorText: '' });
    return this.load(true);
  },

  onTypeChange(e) {
    this.setData({ type: e.detail.key }, () => this.load(true));
  },

  onStatusChange(e) {
    this.setData({ status: e.currentTarget.dataset.key }, () => this.load(true));
  },

  onKeywordInput(e) {
    const keyword = e.detail.value;
    this.setData({ keyword: keyword });
    clearTimeout(this._t);
    this._t = setTimeout(() => this.load(true), 280); // 輸入停頓才查，避免每個字打一次請求
  },

  onSearch() {
    this.load(true);
  },

  onClearKeyword() {
    this.setData({ keyword: '' }, () => this.load(true));
  },

  onItemTouchStart(e) {
    this.setData({ pressedId: e.currentTarget.dataset.id });
  },
  onItemTouchEnd() {
    if (this.data.pressedId) this.setData({ pressedId: '' });
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/items/detail/index?id=' + id });
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/items/create/index' });
  },
});
