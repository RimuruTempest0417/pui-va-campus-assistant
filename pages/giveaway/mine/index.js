const data = require('../../../services/data');
const i18n = require('../../../utils/i18n');
const appearance = require('../../../utils/appearance');
const giveaway = require('../../../utils/giveaway');

/**
 * 我的轉贈（W-68）
 *
 * 兩段：我送出的（誰在跟我搶、要給誰）／我申請的（等到哪一步）。
 * 不做「未登入也顯示空清單」的假畫面 —— 沒有 token 就直接顯示登入提示。
 */
Page({
  labels() {
    return {
      k01: i18n.pick('我的轉贈'),
      k02: i18n.pick('我送出的'),
      k03: i18n.pick('我申請的'),
      k04: i18n.pick('載入失敗'),
      k05: i18n.pick('重試'),
      k06: i18n.pick('你還沒有送出東西'),
      k07: i18n.pick('用不到的課本、換季的校服，都可能正是別人要的'),
      k08: i18n.pick('送出東西'),
      k09: i18n.pick('你還沒有申請過東西'),
      k10: i18n.pick('去列表看看有沒有人送東西'),
      k11: i18n.pick('去逛逛'),
      k12: i18n.pick('取消申請'),
      k13: i18n.pick('已取消'),
      k14: i18n.pick('確定要取消這筆申請嗎？'),
      k15: i18n.pick('確認'),
      k16: i18n.pick('保留'),
      k17: i18n.pick('人想要'),
      k18: i18n.pick('待回覆'),
      k19: i18n.pick('請先登入才能看到自己的轉贈'),
    };
  },

  data: {
    themeClass: appearance.themeClass(),
    loading: true,
    failed: false,
    errorText: '',
    needLogin: false,
    segment: 'posted',
    posted: [],
    requests: [],
    L: {},
  },

  onLoad() {
    this.setData({ L: this.labels() });
    this.load();
  },

  onShow() {
    this.setData({ L: this.labels(), themeClass: appearance.themeClass() });
    if (this._loadedOnce) this.load();
    this._loadedOnce = true;
  },

  async load() {
    this.setData({ loading: true });
    try {
      const res = await data.myGiveaways();
      this.setData({
        loading: false,
        failed: false,
        needLogin: false,
        errorText: '',
        posted: (res.posted || []).map((item) => giveaway.decorateItem(item)),
        requests: (res.requests || []).map((row) => giveaway.decorateRequest(row)),
      });
    } catch (e) {
      const code = e && (e.code || e.status);
      const login = code === 'UNAUTHORIZED' || code === 401;
      this.setData({
        loading: false,
        failed: !login,
        needLogin: login,
        errorText: login ? this.data.L.k19 : data.messageOf(e),
        posted: [],
        requests: [],
      });
    }
  },

  onSegment(e) {
    const key = e.currentTarget.dataset.key || 'posted';
    if (key === this.data.segment) return;
    this.setData({ segment: key });
  },

  retry() {
    this.load();
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: '/pages/giveaway/detail/index?id=' + id });
  },

  goList() {
    wx.navigateTo({ url: '/pages/giveaway/list/index' });
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/giveaway/create/index' });
  },

  cancelRequest(e) {
    const id = e.currentTarget.dataset.id;
    const title = e.currentTarget.dataset.title || '';
    if (!id) return;
    wx.showModal({
      title: this.data.L.k12,
      content: title + '\n' + this.data.L.k14,
      confirmText: this.data.L.k15,
      cancelText: this.data.L.k16,
      success: (res) => {
        if (!res.confirm) return;
        data
          .cancelGiveawayRequest(id)
          .then(() => {
            wx.showToast({ title: this.data.L.k13, icon: 'none' });
            this.load();
          })
          .catch((err) => wx.showModal({ title: i18n.pick('取消失敗'), content: data.messageOf(err), showCancel: false }));
      },
    });
  },
});
