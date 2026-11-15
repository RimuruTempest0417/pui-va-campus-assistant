const data = require('../../../services/data');
const i18n = require('../../../utils/i18n');
const appearance = require('../../../utils/appearance');
const venue = require('../../../utils/venue');

Page({
  labels() {
    return {
      k01: i18n.pick('場地借用'),
      k02: i18n.pick('我的申請'),
      k03: i18n.pick('搜尋場地、器材或位置'),
      k04: i18n.pick('載入失敗'),
      k05: i18n.pick('重試'),
      k06: i18n.pick('目前沒有可借的場地'),
      k07: i18n.pick('請校內職員在後台新增場地或器材'),
      k08: i18n.pick('開放中'),
      k09: i18n.pick('已休息'),
      k10: i18n.pick('需老師批准'),
      k11: i18n.pick('免審批，送出即生效'),
      k12: i18n.pick('最長'),
      k13: i18n.pick('小時'),
      k14: i18n.pick('筆預約'),
      k15: i18n.pick('沒有符合的場地'),
      k16: i18n.pick('換個關鍵字，或切回「全部」'),
      k17: i18n.pick('載入中…'),
      k18: i18n.pick('場'),
      k19: i18n.pick('器'),
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
    // 從詳情頁送出或取消申請回來，清單上的預約數要跟著變
    if (this._loadedOnce) this.load();
    this._loadedOnce = true;
  },

  buildTabs() {
    return [
      { key: '', label: i18n.pick('全部') },
      { key: 'VENUE', label: i18n.pick('場地') },
      { key: 'EQUIPMENT', label: i18n.pick('器材') },
    ];
  },

  decorate(item) {
    const shaped = venue.shapeResource(item, Date.now());
    const parts = [];
    if (shaped.location) parts.push(shaped.location);
    parts.push(shaped.hoursText);
    return Object.assign({}, shaped, {
      mark: shaped.kind === 'EQUIPMENT' ? this.data.L.k19 : this.data.L.k18,
      stateLabel: shaped.openNow ? this.data.L.k08 : this.data.L.k09,
      stateType: shaped.openNow ? 'success' : 'neutral',
      metaText: parts.join(' · '),
      subText:
        (shaped.needsApproval ? this.data.L.k10 : this.data.L.k11) +
        ' · ' +
        this.data.L.k12 +
        ' ' +
        shaped.maxHours +
        ' ' +
        this.data.L.k13,
      bookingText: shaped.upcoming ? shaped.upcoming + ' ' + this.data.L.k14 : '',
    });
  },

  async load() {
    this.setData({ loading: true });
    try {
      const res = await data.listResources({ kind: this.data.kind || undefined, q: this.data.keyword || undefined, limit: 50 });
      const items = (res.items || []).map((item) => this.decorate(item));
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
    wx.navigateTo({ url: '/pages/venues/detail/index?id=' + id });
  },

  goMine() {
    wx.navigateTo({ url: '/pages/venues/mine/index' });
  },

  onShareAppMessage() {
    return { title: i18n.pick('場地借用'), path: '/pages/venues/list/index' };
  },
});
