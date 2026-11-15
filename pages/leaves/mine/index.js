const data = require('../../../services/data');
const i18n = require('../../../utils/i18n');
const appearance = require('../../../utils/appearance');

/**
 * 我的假單（W-72）
 *
 * 待審批的可以自己取消；已批准的要找老師改（取消已批准的紀錄等於把請假紀錄刪掉，
 * 月底統計會對不上）。「新增假單」是這一頁右上角的膠囊，不另開入口。
 */

Page({
  labels() {
    return {
      k01: i18n.pick('我的假單'),
      k02: i18n.pick('待審批'),
      k03: i18n.pick('已批准'),
      k04: i18n.pick('其他'),
      k05: i18n.pick('還沒有假單'),
      k06: i18n.pick('要請假時按右上角「請假」，送出後班主任會收到。'),
      k07: i18n.pick('請假'),
      k08: i18n.pick('取消'),
      k09: i18n.pick('確定要取消這張假單嗎？'),
      k10: i18n.pick('已取消'),
      k11: i18n.pick('取消失敗'),
      k12: i18n.pick('載入失敗'),
      k13: i18n.pick('重試'),
      k14: i18n.pick('未通過原因'),
      k15: i18n.pick('請先登入'),
      k16: i18n.pick('登入後才看得到自己的假單。'),
      k17: i18n.pick('去登入'),
      k18: i18n.pick('載入中…'),
      k19: i18n.pick('保留'),
      k20: i18n.pick('天'),
    };
  },

  data: {
    themeClass: appearance.themeClass(),
    loading: true,
    failed: false,
    guest: false,
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
      await data.ensureLogin();
      const res = await data.myLeaves();
      const items = (res.items || []).map((row) => Object.assign({}, row, {
        statusTone: row.status === 'APPROVED' ? 'success' : row.status === 'REJECTED' ? 'danger' : row.status === 'PENDING' ? 'warning' : 'neutral',
        subText: row.kindText + ' · ' + row.days + this.data.L.k20,
      }));
      this.setData({
        loading: false,
        failed: false,
        guest: false,
        errorText: '',
        items: items,
        pendingItems: items.filter((row) => row.status === 'PENDING'),
        approvedItems: items.filter((row) => row.status === 'APPROVED'),
        otherItems: items.filter((row) => row.status !== 'PENDING' && row.status !== 'APPROVED'),
      });
    } catch (e) {
      const code = (e && e.code) || '';
      if (code === 'UNAUTHORIZED') {
        this.setData({ loading: false, guest: true, failed: false });
        return;
      }
      this.setData({ loading: false, failed: true, errorText: data.messageOf(e) });
    }
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/leaves/create/index' });
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/settings/index' });
  },

  cancelLeave(e) {
    const id = e.currentTarget.dataset.id;
    const label = e.currentTarget.dataset.label || '';
    wx.showModal({
      title: this.data.L.k08,
      content: (this.data.L.k09 + ' ' + label).trim(),
      confirmText: this.data.L.k08,
      cancelText: this.data.L.k19,
      success: (res) => {
        if (!res.confirm) return;
        data
          .cancelLeave(id)
          .then(() => {
            wx.showToast({ title: this.data.L.k10, icon: 'none' });
            this.load();
          })
          .catch((err) => wx.showModal({ title: this.data.L.k11, content: data.messageOf(err), showCancel: false }));
      },
    });
  },

  retry() {
    this.load();
  },
});
