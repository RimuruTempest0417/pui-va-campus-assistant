const data = require('../../../services/data');
const request = require('../../../utils/request');
const i18n = require('../../../utils/i18n');
const appearance = require('../../../utils/appearance');
const { decorateLoan, decorateReservation } = require('../../../utils/book');

Page({
  labels() {
    return {
      k01: i18n.pick('我的借閱'),
      k02: i18n.pick('借閱中'),
      k03: i18n.pick('逾期'),
      k04: i18n.pick('候補與留書'),
      k05: i18n.pick('還沒有借書'),
      k06: i18n.pick('到圖書館頁面找一本書，或掃書號直接借'),
      k07: i18n.pick('沒有候補中的書'),
      k08: i18n.pick('書借完了可以排候補，有人還書會通知你'),
      k09: i18n.pick('載入失敗'),
      k10: i18n.pick('重試'),
      k11: i18n.pick('請先登入'),
      k12: i18n.pick('去圖書館'),
      k13: i18n.pick('續借'),
      k14: i18n.pick('歸還'),
      k15: i18n.pick('取消'),
      k16: i18n.pick('已歸還'),
      k17: i18n.pick('已續借'),
      k18: i18n.pick('已取消候補'),
      k19: i18n.pick('取消候補'),
      k20: i18n.pick('不要'),
      k21: i18n.pick('已借出的書'),
      k22: i18n.pick('歸還歷史'),
    };
  },

  data: {
    themeClass: appearance.themeClass(),
    loading: true,
    failed: false,
    errorText: '',
    needLogin: false,
    activeCount: 0,
    overdueCount: 0,
    active: [],
    history: [],
    reservations: [],
    busyId: '',
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
    // 訪客在真 API 模式下必定 401：先擋下來顯示「請先登入」，不要讓畫面變成「載入失敗」
    if (!data.isDemo() && !request.getToken()) {
      this.setData({ loading: false, failed: false, needLogin: true });
      return;
    }
    this.setData({ loading: true, needLogin: false });
    try {
      const res = await data.myLoans();
      const loans = (res.loans || []).map(decorateLoan);
      this.setData({
        loading: false,
        failed: false,
        errorText: '',
        activeCount: res.activeCount || 0,
        overdueCount: res.overdueCount || 0,
        active: loans.filter((l) => !l.returnedAt),
        history: loans.filter((l) => l.returnedAt).slice(0, 10),
        reservations: (res.reservations || []).map(decorateReservation),
      });
    } catch (e) {
      this.setData({ loading: false, failed: true, errorText: data.messageOf(e) });
    }
  },

  retry() {
    this.setData({ failed: false });
    return this.load();
  },

  goList() {
    const pages = getCurrentPages();
    if (pages.length > 1) wx.navigateBack();
    else wx.redirectTo({ url: '/pages/library/list/index' });
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/library/detail/index?id=' + e.currentTarget.dataset.id });
  },

  async doRenew(e) {
    const id = e.currentTarget.dataset.id;
    if (this.data.busyId) return;
    this.setData({ busyId: id });
    try {
      await data.renewLoan(id);
      wx.showToast({ title: i18n.pick('已續借'), icon: 'success' });
      await this.load();
    } catch (err) {
      wx.showToast({ title: data.messageOf(err), icon: 'none' });
      await this.load();
    } finally {
      this.setData({ busyId: '' });
    }
  },

  async doReturn(e) {
    const id = e.currentTarget.dataset.id;
    if (this.data.busyId) return;
    this.setData({ busyId: id });
    try {
      const res = await data.returnLoan(id);
      // 有人候補時後端已經通知對方，這裡只告訴還書的人「下一位被叫到了」
      wx.showToast({
        title: res && res.promotedUserId ? i18n.pick('已歸還，已通知候補的同學') : i18n.pick('已歸還'),
        icon: 'success',
      });
      await this.load();
    } catch (err) {
      wx.showToast({ title: data.messageOf(err), icon: 'none' });
      await this.load();
    } finally {
      this.setData({ busyId: '' });
    }
  },

  doCancel(e) {
    const id = e.currentTarget.dataset.id;
    const title = e.currentTarget.dataset.title || '';
    wx.showModal({
      title: i18n.pick('取消候補'),
      content: title,
      confirmText: i18n.pick('取消候補'),
      cancelText: i18n.pick('不要'),
      success: async (r) => {
        if (!r.confirm) return;
        this.setData({ busyId: id });
        try {
          await data.cancelReservation(id);
          wx.showToast({ title: i18n.pick('已取消候補'), icon: 'success' });
          await this.load();
        } catch (err) {
          wx.showToast({ title: data.messageOf(err), icon: 'none' });
        } finally {
          this.setData({ busyId: '' });
        }
      },
    });
  },
});
