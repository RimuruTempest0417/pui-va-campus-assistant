const data = require('../../../services/data');
const i18n = require('../../../utils/i18n');
const appearance = require('../../../utils/appearance');
const venue = require('../../../utils/venue');

Page({
  labels() {
    return {
      k01: i18n.pick('我的借用'),
      k02: i18n.pick('待審批'),
      k03: i18n.pick('已批准'),
      k04: i18n.pick('其他'),
      k05: i18n.pick('還沒有任何申請'),
      k06: i18n.pick('去場地清單挑一個時段吧'),
      k07: i18n.pick('取消申請'),
      k08: i18n.pick('確定要取消嗎？'),
      k09: i18n.pick('已取消申請'),
      k10: i18n.pick('取消失敗'),
      k11: i18n.pick('載入失敗'),
      k12: i18n.pick('重試'),
      k13: i18n.pick('未通過原因'),
      k14: i18n.pick('找場地'),
      k15: i18n.pick('載入中…'),
    };
  },

  data: {
    themeClass: appearance.themeClass(),
    loading: true,
    failed: false,
    errorText: '',
    items: [],
    pendingItems: [],
    approvedItems: [],
    otherItems: [],
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
      const res = await data.myResourceBookings();
      const now = Date.now();
      const items = (res.items || []).map((b) => venue.shapeBooking(b, now));
      this.setData({
        loading: false,
        failed: false,
        errorText: '',
        items: items,
        pendingItems: items.filter((b) => b.status === 'PENDING'),
        approvedItems: items.filter((b) => b.status === 'APPROVED' && !b.past),
        otherItems: items.filter((b) => b.status !== 'PENDING' && !(b.status === 'APPROVED' && !b.past)),
      });
    } catch (e) {
      this.setData({ loading: false, failed: true, errorText: data.messageOf(e) });
    }
  },

  cancelBooking(e) {
    const id = e.currentTarget.dataset.id;
    const label = e.currentTarget.dataset.label || '';
    wx.showModal({
      title: this.data.L.k07,
      content: (this.data.L.k08 + ' ' + label).trim(),
      confirmText: this.data.L.k07,
      cancelText: i18n.pick('保留'),
      success: (res) => {
        if (!res.confirm) return;
        data
          .cancelResourceBooking(id)
          .then(() => {
            wx.showToast({ title: this.data.L.k09, icon: 'none' });
            this.load();
          })
          .catch((err) =>
            wx.showModal({ title: this.data.L.k10, content: data.messageOf(err), showCancel: false }),
          );
      },
    });
  },

  goList() {
    wx.navigateTo({ url: '/pages/venues/list/index' });
  },

  retry() {
    this.load();
  },
});
