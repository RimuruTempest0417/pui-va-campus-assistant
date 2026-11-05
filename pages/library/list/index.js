const data = require('../../../services/data');
const request = require('../../../utils/request');
const i18n = require('../../../utils/i18n');
const appearance = require('../../../utils/appearance');
const { decorateBook } = require('../../../utils/book');

Page({
  labels() {
    return {
      k01: i18n.pick('圖書館'),
      k02: i18n.pick('搜書名、作者、索書號'),
      k03: i18n.pick('載入失敗'),
      k04: i18n.pick('重試'),
      k05: i18n.pick('掃書號'),
      k06: i18n.pick('掃不到書號？可以輸入 ISBN'),
      k07: i18n.pick('館藏裡沒有這個書號'),
      k08: i18n.pick('目前沒有符合的書'),
      k09: i18n.pick('換個關鍵字，或清除「只顯示可借」'),
      k10: i18n.pick('圖書館還沒有登記館藏'),
      k11: i18n.pick('請圖書館職員在後台新增第一本書'),
      k12: i18n.pick('我的借閱'),
      k13: i18n.pick('— 已經到底了 —'),
      k14: i18n.pick('載入中…'),
      k15: i18n.pick('只看可借'),
      k16: i18n.pick('全部'),
      k17: i18n.pick('輸入 ISBN'),
      k18: i18n.pick('送出'),
    };
  },

  data: {
    themeClass: appearance.themeClass(),
    loading: true,
    loadingMore: false,
    failed: false,
    errorText: '',
    items: [],
    page: 1,
    hasMore: false,
    keyword: '',
    onlyAvailable: false,
    pressedId: '',
    tabs: [],
  },

  onLoad() {
    this.setData({ L: this.labels(), tabs: this.buildTabs() });
    this.load(true);
  },

  onShow() {
    this.setData({ L: this.labels(), themeClass: appearance.themeClass(), tabs: this.buildTabs() });
    // 從詳情頁借完／還完回來，清單上的可借量要跟著變
    if (this._loadedOnce) this.load(true);
    this._loadedOnce = true;
  },

  buildTabs() {
    return [
      { key: 'all', label: i18n.pick('全部') },
      { key: 'available', label: i18n.pick('只看可借') },
    ];
  },

  async load(reset) {
    if (reset) this.setData({ loading: true, page: 1 });
    else this.setData({ loadingMore: true });

    try {
      const res = await data.listBooks({
        q: this.data.keyword || undefined,
        available: this.data.onlyAvailable ? '1' : undefined,
        page: reset ? 1 : this.data.page + 1,
        limit: 20,
      });
      const list = (res.items || []).map(decorateBook);
      this.setData({
        loading: false,
        loadingMore: false,
        failed: false,
        errorText: '',
        items: reset ? list : this.data.items.concat(list),
        page: res.page,
        hasMore: res.hasMore,
      });
    } catch (e) {
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

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value });
    // 與失物清單相同的去抖：打字停下 280ms 才查，每打一個字就打一次後端沒有意義
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => this.load(true), 280);
  },

  onSearch() {
    if (this._timer) clearTimeout(this._timer);
    this.load(true);
  },

  onClearKeyword() {
    this.setData({ keyword: '' }, () => this.load(true));
  },

  onTabChange(e) {
    this.setData({ onlyAvailable: e.detail.key === 'available' }, () => this.load(true));
  },

  onRefresh() {
    this.setData({ refreshing: true });
    this.load(true).then(() => this.setData({ refreshing: false }));
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loadingMore) this.load(false);
  },

  onItemTouchStart(e) {
    this.setData({ pressedId: e.currentTarget.dataset.id });
  },

  onItemTouchEnd() {
    this.setData({ pressedId: '' });
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/library/detail/index?id=' + e.currentTarget.dataset.id });
  },

  goMine() {
    if (!request.getToken() && !data.isDemo()) {
      wx.showToast({ title: i18n.pick('請先登入'), icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/library/mine/index' });
  },

  /**
   * 掃書號：`wx.scanCode` 拿到的可能是 ISBN 條碼（EAN-13）或我們自己的書號。
   * 查不到不報錯，改成「換輸入 ISBN」——條碼掃壞是常態，不是失敗。
   */
  scan() {
    wx.scanCode({
      onlyFromCamera: false,
      scanType: ['barCode', 'qrCode'],
      success: (res) => {
        const raw = String(res.result || '').trim();
        if (!raw) return;
        this.lookup(raw);
      },
      fail: () => {
        // 使用者取消掃碼不提示（那不是錯誤）
      },
    });
  },

  async lookup(raw) {
    wx.showLoading({ title: i18n.pick('查書中'), mask: true });
    try {
      const res = await data.lookupIsbn(raw);
      wx.hideLoading();
      if (res && res.found && res.book) {
        wx.navigateTo({ url: '/pages/library/detail/index?id=' + res.book.id });
        return;
      }
      wx.showModal({
        title: this.data.L.k07,
        content: raw,
        showCancel: false,
        confirmText: i18n.pick('知道'),
      });
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: data.messageOf(e), icon: 'none' });
    }
  },

  manualIsbn() {
    wx.showModal({
      title: i18n.pick('輸入 ISBN'),
      editable: true,
      placeholderText: '9789993700011',
      success: (r) => {
        if (r.confirm && r.content) this.lookup(String(r.content).trim());
      },
    });
  },
});
