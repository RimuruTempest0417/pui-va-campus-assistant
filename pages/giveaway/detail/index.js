const data = require('../../../services/data');
const request = require('../../../utils/request');
const i18n = require('../../../utils/i18n');
const appearance = require('../../../utils/appearance');
const giveaway = require('../../../utils/giveaway');

/**
 * 轉贈詳情（W-68）
 *
 * 三種身分看到三種底部操作，判斷全部來自身分（isOwner／canRequest／myRequest），
 * 不在前端自己推算「他能不能申請」；後端才是唯一答案。
 */
Page({
  labels() {
    return {
      k01: i18n.pick('轉贈詳情'),
      k02: i18n.pick('物品'),
      k03: i18n.pick('新舊'),
      k04: i18n.pick('補充'),
      k05: i18n.pick('面交地點'),
      k06: i18n.pick('物主'),
      k07: i18n.pick('送出時間'),
      k08: i18n.pick('說明'),
      k09: i18n.pick('聯絡方式'),
      k10: i18n.pick('我想要'),
      k11: i18n.pick('已送出申請，等物主回覆'),
      k12: i18n.pick('物主把這件留給你了'),
      k13: i18n.pick('這次沒有留給你'),
      k14: i18n.pick('你已取消申請'),
      k15: i18n.pick('取消申請'),
      k16: i18n.pick('申請人'),
      k17: i18n.pick('給這位'),
      k18: i18n.pick('婉拒'),
      k19: i18n.pick('下架'),
      k20: i18n.pick('重新上架'),
      k21: i18n.pick('已贈出'),
      k22: i18n.pick('已下架'),
      k23: i18n.pick('可申請'),
      k24: i18n.pick('載入失敗'),
      k25: i18n.pick('重試'),
      k26: i18n.pick('找不到這件轉贈物品'),
      k27: i18n.pick('請先登入才能申請'),
      k28: i18n.pick('送出申請中…'),
      k29: i18n.pick('已送出申請'),
      k30: i18n.pick('申請已取消'),
      k31: i18n.pick('想說的話（選填）'),
      k32: i18n.pick('確定要把這件留給這位同學嗎？其他人的申請會一併婉拒。'),
      k33: i18n.pick('確定要婉拒這位同學嗎？'),
      k34: i18n.pick('確定'),
      k35: i18n.pick('再想想'),
      k36: i18n.pick('已送出，謝謝你'),
      k37: i18n.pick('已下架，別人在清單看不到'),
      k38: i18n.pick('目前沒有人申請'),
      k39: i18n.pick('下架後別人在清單看不到，隨時可以重新上架'),
      k40: i18n.pick('這是你的物品，不能申請自己的東西'),
    };
  },

  data: {
    themeClass: appearance.themeClass(),
    loading: true,
    failed: false,
    errorText: '',
    id: '',
    item: null,
    requests: [],
    isOwner: false,
    canRequest: false,
    canManage: false,
    submitting: false,
    barText: '',
    barDisabled: true,
    L: {},
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
      this.setData({ loading: false, failed: true, errorText: i18n.pick('找不到這件轉贈物品') });
      return;
    }
    try {
      const res = await data.getGiveaway(this.data.id);
      const item = giveaway.decorateItem(res.item);
      this.setData({
        loading: false,
        failed: false,
        errorText: '',
        item: item,
        requests: (res.requests || []).map((row) => giveaway.decorateRequestRow(row)),
        isOwner: !!res.isOwner,
        canRequest: !!res.canRequest,
        canManage: !!res.canManage,
      });
      this.syncBar();
    } catch (e) {
      this.setData({ loading: false, failed: !this.data.item, errorText: data.messageOf(e) });
    }
  },

  /**
   * 底部那一顆按鈕的文字與可否按下，一律由 item 狀態＋身分重算。
   * 任何會改變狀態的操作（申請、取消、贈出、下架）結尾都要再叫一次，
   * 否則會出現「按鈕還寫著我想要，但其實已經申請過了」。
   */
  syncBar() {
    const item = this.data.item;
    if (!item) {
      this.setData({ barText: '', barDisabled: true });
      return;
    }
    if (this.data.isOwner) {
      if (item.status === 'AVAILABLE') {
        this.setData({ barText: this.data.L.k19, barDisabled: false });
      } else if (item.status === 'CLOSED') {
        this.setData({ barText: this.data.L.k20, barDisabled: false });
      } else {
        this.setData({ barText: this.data.L.k21, barDisabled: true });
      }
      return;
    }
    if (this.data.canRequest) {
      this.setData({ barText: this.data.L.k10, barDisabled: false });
      return;
    }
    if (item.myRequest && item.myRequest.status === 'PENDING') {
      this.setData({ barText: this.data.L.k11, barDisabled: true });
      return;
    }
    if (item.myRequest && item.myRequest.status === 'ACCEPTED') {
      this.setData({ barText: this.data.L.k12, barDisabled: true });
      return;
    }
    if (item.status === 'GIVEN') {
      this.setData({ barText: this.data.L.k21, barDisabled: true });
      return;
    }
    if (item.status === 'CLOSED') {
      this.setData({ barText: this.data.L.k22, barDisabled: true });
      return;
    }
    this.setData({ barText: this.data.L.k13, barDisabled: true });
  },

  /** 主按鈕：依身分分流，不讓使用者按到「與他無關」的動作 */
  onPrimary() {
    if (this.data.barDisabled || this.data.submitting) return;
    if (this.data.isOwner) {
      this.toggleStatus();
      return;
    }
    this.apply();
  },

  apply() {
    if (!request.getToken() && !data.isDemo()) {
      wx.showToast({ title: this.data.L.k27, icon: 'none' });
      return;
    }
    wx.showModal({
      title: this.data.L.k10,
      editable: true,
      placeholderText: this.data.L.k31,
      success: (res) => {
        if (!res.confirm) return;
        this.submitRequest(res.content || '');
      },
    });
  },

  async submitRequest(message) {
    if (this.data.submitting) return;
    this.setData({ submitting: true, barText: this.data.L.k28, barDisabled: true });
    try {
      await data.requestGiveaway(this.data.id, message);
      wx.showToast({ title: this.data.L.k29, icon: 'none' });
      await this.load();
    } catch (e) {
      wx.showModal({ title: i18n.pick('送不出去'), content: data.messageOf(e), showCancel: false });
    } finally {
      this.setData({ submitting: false });
      this.syncBar();
    }
  },

  cancelMine() {
    const mine = this.data.item && this.data.item.myRequest;
    if (!mine) return;
    wx.showModal({
      title: this.data.L.k15,
      content: this.data.item.title,
      confirmText: this.data.L.k34,
      cancelText: this.data.L.k35,
      success: (res) => {
        if (!res.confirm) return;
        data
          .cancelGiveawayRequest(mine.id)
          .then(() => {
            wx.showToast({ title: this.data.L.k30, icon: 'none' });
            this.load();
          })
          .catch((err) => wx.showModal({ title: i18n.pick('取消失敗'), content: data.messageOf(err), showCancel: false }));
      },
    });
  },

  decide(e) {
    const id = e.currentTarget.dataset.id;
    const action = e.currentTarget.dataset.action;
    const who = e.currentTarget.dataset.who || '';
    if (!id) return;
    wx.showModal({
      title: action === 'ACCEPT' ? this.data.L.k17 : this.data.L.k18,
      content: action === 'ACCEPT' ? this.data.L.k32 : this.data.L.k33 + ' ' + who,
      confirmText: this.data.L.k34,
      cancelText: this.data.L.k35,
      success: (res) => {
        if (!res.confirm) return;
        data
          .decideGiveawayRequest(id, action)
          .then(() => {
            wx.showToast({ title: action === 'ACCEPT' ? this.data.L.k36 : this.data.L.k18, icon: 'none' });
            this.load();
          })
          .catch((err) => wx.showModal({ title: i18n.pick('處理失敗'), content: data.messageOf(err), showCancel: false }));
      },
    });
  },

  toggleStatus() {
    const item = this.data.item;
    if (!item) return;
    const closing = item.status === 'AVAILABLE';
    wx.showModal({
      title: closing ? this.data.L.k19 : this.data.L.k20,
      content: closing ? this.data.L.k39 : item.title,
      confirmText: this.data.L.k34,
      cancelText: this.data.L.k35,
      success: (res) => {
        if (!res.confirm) return;
        data
          .setGiveawayStatus(item.id, closing ? 'CLOSED' : 'AVAILABLE')
          .then(() => {
            wx.showToast({ title: closing ? this.data.L.k37 : this.data.L.k23, icon: 'none' });
            this.load();
          })
          .catch((err) => wx.showModal({ title: i18n.pick('改不了'), content: data.messageOf(err), showCancel: false }));
      },
    });
  },

  retry() {
    this.load();
  },

  goMine() {
    wx.navigateTo({ url: '/pages/giveaway/mine/index' });
  },

  onShareAppMessage() {
    return {
      title: this.data.item ? this.data.item.title : i18n.pick('二手轉贈'),
      path: '/pages/giveaway/detail/index?id=' + this.data.id,
    };
  },
});
