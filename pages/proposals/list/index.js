const data = require('../../../services/data');
const i18n = require('../../../utils/i18n');
const appearance = require('../../../utils/appearance');
const proposal = require('../../../utils/proposal');
const request = require('../../../utils/request');

Page({
  labels() {
    return {
      k01: i18n.pick('校園提案'),
      k02: i18n.pick('全部提案'),
      k03: i18n.pick('我參與的'),
      k04: i18n.pick('全部'),
      k05: i18n.pick('收集中'),
      k06: i18n.pick('處理中'),
      k07: i18n.pick('已完成'),
      k08: i18n.pick('不採納'),
      k09: i18n.pick('最新'),
      k10: i18n.pick('最多連署'),
      k11: i18n.pick('載入失敗'),
      k12: i18n.pick('重試'),
      k13: i18n.pick('還沒有人提案'),
      k14: i18n.pick('想到什麼可以變得更好？寫下來，同學連署到門檻，校方就會回覆'),
      k15: i18n.pick('提出建議'),
      k16: i18n.pick('沒有符合的提案'),
      k17: i18n.pick('換個狀態，或切回「全部」'),
      k18: i18n.pick('載入中…'),
      k19: i18n.pick('人連署'),
      k20: i18n.pick('已達門檻'),
      k21: i18n.pick('已連署'),
      k22: i18n.pick('載入更多…'),
      k23: i18n.pick('已經到底了'),
    };
  },

  data: {
    themeClass: appearance.themeClass(),
    loading: true,
    failed: false,
    errorText: '',
    items: [],
    scope: 'all',
    status: 'ALL',
    sort: 'new',
    statusTabs: [],
    pressedId: '',
    refreshing: false,
    L: {},
  },

  onLoad() {
    this.setData({ L: this.labels(), statusTabs: this.buildStatusTabs(), themeClass: appearance.themeClass() });
    this.load();
  },

  onShow() {
    this.setData({ L: this.labels(), statusTabs: this.buildStatusTabs(), themeClass: appearance.themeClass() });
    // 從詳情頁連署／撤回後返回，票數與狀態要跟著更新
    if (this._loadedOnce) this.load();
    this._loadedOnce = true;
  },

  buildStatusTabs() {
    return [
      { key: 'ALL', label: i18n.pick('全部') },
      { key: 'OPEN', label: i18n.pick('收集中') },
      { key: 'REVIEWING', label: i18n.pick('處理中') },
      { key: 'DONE', label: i18n.pick('已完成') },
      { key: 'DECLINED', label: i18n.pick('不採納') },
    ];
  },

  meId() {
    try {
      const user = wx.getStorageSync('pv_user') || {};
      return user.id || '';
    } catch (e) {
      return '';
    }
  },

  async load() {
    this.setData({ loading: true });
    try {
      const res = await data.listProposals({
        status: this.data.status,
        sort: this.data.sort,
        scope: this.data.scope,
        limit: 30,
      });
      const meId = this.meId();
      const items = (res.items || []).map((item) => {
        const row = proposal.decorateItem(item);
        row.canSupport = proposal.canSupport(item, meId);
        return row;
      });
      this.setData({ loading: false, failed: false, errorText: '', items: items });
    } catch (e) {
      this.setData({ loading: false, failed: true, errorText: data.messageOf(e), items: [] });
    }
  },

  onScopeChange(e) {
    const scope = e.currentTarget.dataset.scope || 'all';
    if (scope === this.data.scope) return;
    this.setData({ scope: scope });
    this.load();
  },

  onStatusChange(e) {
    const status = e.currentTarget.dataset.key || 'ALL';
    if (status === this.data.status) return;
    this.setData({ status: status });
    this.load();
  },

  onSortToggle() {
    this.setData({ sort: this.data.sort === 'new' ? 'support' : 'new' });
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
    wx.navigateTo({ url: '/pages/proposals/detail/index?id=' + id });
  },

  goCreate() {
    // 訪客先登入：提案要有人署名，也才擋得住灌票
    if (!request.getToken() && !data.isDemo()) {
      wx.navigateTo({ url: '/pages/admin/login/index' });
      return;
    }
    wx.navigateTo({ url: '/pages/proposals/create/index' });
  },
});
