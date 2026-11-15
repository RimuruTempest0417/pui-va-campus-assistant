const data = require('../../../services/data');
const i18n = require('../../../utils/i18n');
const appearance = require('../../../utils/appearance');
const role = require('../../../utils/role');
const { fromNow } = require('../../../utils/date');
const reporter = require('../../../utils/reporter');

/**
 * 提案的完整連署名單（W-90）
 *
 * 詳情頁的「連署的人」只帶前 12 位（後端 take: 12，避免熱門提案把詳情拖慢），
 * 這裡用 GET /proposals/:id/supports 逐頁翻完。順序由後端決定（先連署的在前），
 * 前端不再排序 —— 兩邊各排一次，遲早出現「詳情第一名跟名單第一名不同人」。
 */
const PAGE_SIZE = 20;

Page({
  labels() {
    return {
      k01: i18n.pick('連署的人'),
      k02: i18n.pick('載入失敗'),
      k03: i18n.pick('重試'),
      k04: i18n.pick('還沒有人連署'),
      k05: i18n.pick('載入中…'),
      k06: i18n.pick('載入更多'),
      k07: i18n.pick('第一位連署的人就是提案人'),
      k08: i18n.pick('已經到底了'),
      k09: i18n.pick('找不到這個提案'),
      k10: i18n.pick('可能已被撤回'),
    };
  },

  data: {
    themeClass: appearance.themeClass(),
    id: '',
    loading: true,
    failed: false,
    notFound: false,
    errorText: '',
    items: [],
    page: 1,
    total: 0,
    hasMore: false,
    loadingMore: false,
    refreshing: false,
    totalText: '',
    L: {},
  },

  onLoad(query) {
    const id = (query && query.id) || '';
    this.setData({ L: this.labels(), themeClass: appearance.themeClass(), id: id });
    this.load(true);
  },

  onShow() {
    this.setData({ L: this.labels(), themeClass: appearance.themeClass() });
  },

  /** 每一列要顯示的三段：單字頭像、身分／班級、什麼時候連署 */
  decorate(list) {
    return (list || []).map((s) => {
      const name = s.nickname || i18n.pick('同學');
      const meta = [role.label(s.role), s.className || ''].filter(Boolean).join(' · ');
      return {
        id: s.id,
        nickname: name,
        initial: name.slice(0, 1),
        metaText: meta,
        timeText: fromNow(s.at),
      };
    });
  },

  async load(reset) {
    if (!this.data.id) {
      this.setData({ loading: false, notFound: true, failed: false });
      return;
    }
    const page = reset ? 1 : this.data.page + 1;
    if (reset) this.setData({ loading: true });
    else this.setData({ loadingMore: true });

    try {
      const res = await data.proposalSupports(this.data.id, { page: page, limit: PAGE_SIZE });
      const fresh = this.decorate(res.items);
      const items = reset ? fresh : this.data.items.concat(fresh);
      const total = Number(res.total) || 0;
      this.setData({
        loading: false,
        loadingMore: false,
        failed: false,
        notFound: false,
        errorText: '',
        items: items,
        page: page,
        total: total,
        hasMore: Boolean(res.hasMore),
        totalText: i18n.pick('共 {n} 人連署').replace('{n}', String(total)),
      });
    } catch (e) {
      const code = (e && e.code) || '';
      const notFound = code === 'NOT_FOUND';
      this.setData({
        loading: false,
        loadingMore: false,
        failed: !notFound,
        notFound: notFound,
        errorText: data.messageOf(e),
        items: reset ? [] : this.data.items,
      });
      if (!notFound) reporter.reportError('[proposal.supporters] ' + data.messageOf(e));
    }
  },

  onMore() {
    if (!this.data.hasMore || this.data.loadingMore || this.data.loading) return;
    this.load(false);
  },

  onScrollToLower() {
    this.onMore();
  },

  onRefresh() {
    this.setData({ refreshing: true, page: 1 });
    Promise.resolve(this.load(true)).then(() => this.setData({ refreshing: false }));
  },

  retry() {
    this.load(true);
  },
});
