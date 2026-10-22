const data = require('../../../services/data');
const { decorate } = require('../../../utils/item');

Page({
  data: {
    refreshing: false,
    loading: true,
    loadingMore: false,
    items: [],
    total: 0,
    page: 1,
    hasMore: false,
    type: '',
    status: '',
    keyword: '',
    pressedId: '',
    typeTabs: [
      { key: '', label: '全部' },
      { key: 'LOST', label: '失物' },
      { key: 'FOUND', label: '拾獲' },
    ],
    statusChips: [
      { key: '', label: '不限狀態' },
      { key: 'OPEN', label: '待認領' },
      { key: 'CLAIMED', label: '已認領' },
      { key: 'CLOSED', label: '已完成' },
    ],
  },

  onLoad() {
    this.load(true);
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
      });
    } catch (e) {
      this.setData({ loading: false, loadingMore: false });
      wx.showToast({ title: data.messageOf(e), icon: 'none' });
    }
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
