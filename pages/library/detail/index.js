const data = require('../../../services/data');
const request = require('../../../utils/request');
const i18n = require('../../../utils/i18n');
const appearance = require('../../../utils/appearance');
const { decorateBook, decorateLoan, decorateReservation } = require('../../../utils/book');
const { dateTimeText } = require('../../../utils/date');
const subscribe = require('../../../utils/subscribe');

Page({
  labels() {
    return {
      k01: i18n.pick('書籍資料'),
      k02: i18n.pick('作者'),
      k03: i18n.pick('出版社'),
      k04: i18n.pick('分類'),
      k05: i18n.pick('索書號'),
      k06: i18n.pick('館藏'),
      k07: i18n.pick('可借'),
      k08: i18n.pick('候補'),
      k09: i18n.pick('近 90 天借出'),
      k10: i18n.pick('內容簡介'),
      k11: i18n.pick('借這本書'),
      k12: i18n.pick('排候補'),
      k13: i18n.pick('歸還'),
      k14: i18n.pick('續借'),
      k15: i18n.pick('取消候補'),
      k16: i18n.pick('載入失敗'),
      k17: i18n.pick('重試'),
      k18: i18n.pick('請先登入'),
      k19: i18n.pick('借書成功'),
      k20: i18n.pick('已歸還'),
      k21: i18n.pick('已續借'),
      k22: i18n.pick('已取消候補'),
      k23: i18n.pick('失敗'),
      k24: i18n.pick('這本書目前借不到，已幫你排候補'),
      k25: i18n.pick('我的借閱'),
      k26: i18n.pick('這本書已為你保留'),
    };
  },

  data: {
    themeClass: appearance.themeClass(),
    loading: true,
    failed: false,
    errorText: '',
    id: '',
    book: null,
    myLoan: null,
    myReservation: null,
    barText: '',
    barAction: '',
    barDisabled: true,
    barHint: '',
    secondaryText: '',
    secondaryAction: '',
    busy: false,
  },

  onLoad(q) {
    this.setData({ L: this.labels(), id: (q && q.id) || '' });
    this.load();
  },

  onShow() {
    this.setData({ L: this.labels(), themeClass: appearance.themeClass() });
    if (this._loadedOnce) this.load();
    this._loadedOnce = true;
  },

  async load() {
    if (!this.data.id) {
      this.setData({ loading: false, failed: true, errorText: i18n.pick('找不到這本書') });
      return;
    }
    try {
      const res = await data.getBook(this.data.id);
      const book = decorateBook(res.book);
      const myLoan = res.myLoan ? decorateLoan(res.myLoan) : null;
      const myReservation = res.myReservation ? decorateReservation(res.myReservation) : null;
      this.setData({ loading: false, failed: false, errorText: '', book: book, myLoan: myLoan, myReservation: myReservation }, () =>
        this.syncBar(),
      );
    } catch (e) {
      this.setData({ loading: false, failed: !this.data.book, errorText: data.messageOf(e) });
    }
  },

  /**
   * 底部按鈕是「由 book + myLoan + myReservation 推出來的 c」——
   * 寫成一支純函式，任何會改到那三個值的操作結束後都呼叫它。
   * （活動詳情曾因為只在 onLoad 算一次，選完組別按鈕還停在「選擇組別」）
   */
  syncBar() {
    const { book, myLoan, myReservation } = this.data;
    if (!book) {
      this.setData({ barText: '', barAction: '', barDisabled: true, barHint: '', secondaryText: '', secondaryAction: '' });
      return;
    }

    if (myLoan) {
      this.setData({
        barText: i18n.pick('歸還'),
        barAction: 'return',
        barDisabled: false,
        barHint: myLoan.dueText + (myLoan.overdueDays ? ' · ' + myLoan.statusLabel : ''),
        secondaryText: myLoan.canRenew ? i18n.pick('續借') : '',
        secondaryAction: myLoan.canRenew ? 'renew' : '',
      });
      return;
    }

    if (myReservation && myReservation.status === 'READY') {
      this.setData({
        barText: i18n.pick('借這本書'),
        barAction: 'borrow',
        barDisabled: false,
        barHint: i18n.pick('這本書已為你保留') + ' · ' + myReservation.hint,
        secondaryText: '',
        secondaryAction: '',
      });
      return;
    }

    if (myReservation && myReservation.status === 'WAITING') {
      this.setData({
        barText: i18n.pick('取消候補'),
        barAction: 'cancel',
        barDisabled: false,
        barHint: myReservation.statusLabel + ' · ' + myReservation.hint,
        secondaryText: '',
        secondaryAction: '',
      });
      return;
    }

    // 沒有借也沒有排：能借就借，不能借就排候補（不讓使用者按了才知道）
    this.setData({
      barText: book.borrowable ? i18n.pick('借這本書') : i18n.pick('排候補'),
      barAction: 'borrow',
      barDisabled: false,
      barHint: book.borrowable ? book.stockText : i18n.pick('目前沒有可借的，排候補有人還書就通知你'),
      secondaryText: '',
      secondaryAction: '',
    });
  },

  retry() {
    this.setData({ loading: true, failed: false });
    return this.load();
  },

  /** 借還都要登入；示範模式（離線示範）不需要 token */
  ensureLogin() {
    if (data.isDemo() || request.getToken()) return true;
    wx.showToast({ title: i18n.pick('請先登入'), icon: 'none' });
    return false;
  },

  onPrimary() {
    const action = this.data.barAction;
    if (action === 'return') return this.doReturn();
    if (action === 'borrow') return this.doBorrow();
    if (action === 'cancel') return this.doCancel();
    return null;
  },

  onSecondary() {
    if (this.data.secondaryAction === 'renew') return this.doRenew();
    return null;
  },

  async doBorrow() {
    if (this.data.busy || !this.ensureLogin()) return;
    this.setData({ busy: true });
    try {
      const res = await data.borrowBook({ bookId: this.data.id });
      this.setData({ busy: false });
      const reserved = Boolean(res && res.kind === 'reservation');
      wx.showToast({ title: reserved ? i18n.pick('已排候補') : i18n.pick('借書成功'), icon: 'success' });
      // 排了候補就順便問一次「書到貨要不要通知我」；模板 ID 沒填時 subscribe.request 直接跳過
      if (reserved) await subscribe.request('hold');
      await this.load();
    } catch (e) {
      this.setData({ busy: false });
      wx.showToast({ title: data.messageOf(e), icon: 'none' });
      // 狀態衝突（已借過／已排過）代表畫面上的狀態過期了，重抓一次就正確
      await this.load();
    }
  },

  async doReturn() {
    if (this.data.busy || !this.data.myLoan) return;
    this.setData({ busy: true });
    try {
      await data.returnLoan(this.data.myLoan.id);
      this.setData({ busy: false });
      wx.showToast({ title: i18n.pick('已歸還'), icon: 'success' });
      await this.load();
    } catch (e) {
      this.setData({ busy: false });
      wx.showToast({ title: data.messageOf(e), icon: 'none' });
      await this.load();
    }
  },

  async doRenew() {
    if (this.data.busy || !this.data.myLoan) return;
    this.setData({ busy: true });
    try {
      const res = await data.renewLoan(this.data.myLoan.id);
      this.setData({ busy: false });
      wx.showToast({
        title: i18n.pick('已續借') + ' · ' + dateTimeText(res.dueAt),
        icon: 'none',
      });
      await this.load();
    } catch (e) {
      this.setData({ busy: false });
      wx.showToast({ title: data.messageOf(e), icon: 'none' });
    }
  },

  /** 取消候補會影響排隊順序，用原生確認框（自製兩段式在 Skyline 下點不到第二次） */
  doCancel() {
    if (this.data.busy || !this.data.myReservation) return;
    wx.showModal({
      title: i18n.pick('取消候補'),
      content: this.data.book ? this.data.book.title : '',
      confirmText: i18n.pick('取消候補'),
      cancelText: i18n.pick('不要'),
      success: async (r) => {
        if (!r.confirm) return;
        this.setData({ busy: true });
        try {
          await data.cancelReservation(this.data.myReservation.id);
          this.setData({ busy: false });
          wx.showToast({ title: i18n.pick('已取消候補'), icon: 'success' });
          await this.load();
        } catch (e) {
          this.setData({ busy: false });
          wx.showToast({ title: data.messageOf(e), icon: 'none' });
        }
      },
    });
  },

  goMine() {
    wx.navigateTo({ url: '/pages/library/mine/index' });
  },
});
