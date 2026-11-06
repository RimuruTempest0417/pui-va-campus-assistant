const data = require('../../../services/data');
const i18n = require('../../../utils/i18n');
const appearance = require('../../../utils/appearance');

/**
 * 我的報修（W-89）
 *
 * 只列自己送的單子；「處理中」把待接單與已接單放在一起（對報修人來說都是「還沒修好」），
 * 已完成的另外一組。新增報修是右上角那顆膠囊，不另開入口。
 */

function pad(n) {
  return n < 10 ? '0' + n : String(n);
}

/** `11/06 09:12`：報修單的時間是「哪一天送的」，不需要年份 */
function timeText(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return pad(d.getMonth() + 1) + '/' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

const TONE = { PENDING: 'warning', IN_PROGRESS: 'tint', DONE: 'success', CANCELLED: 'neutral' };

Page({
  labels() {
    return {
      k01: i18n.pick('課室報修'),
      k02: i18n.pick('處理中'),
      k03: i18n.pick('已處理'),
      k04: i18n.pick('報修'),
      k05: i18n.pick('還沒有報修紀錄'),
      k06: i18n.pick('課室的冷氣、投影機、門鎖壞了，在這裡報一次，總務就會收到。'),
      k07: i18n.pick('取消'),
      k08: i18n.pick('確定要取消這張報修嗎？'),
      k09: i18n.pick('已取消'),
      k10: i18n.pick('取消失敗'),
      k11: i18n.pick('載入失敗'),
      k12: i18n.pick('重試'),
      k13: i18n.pick('請先登入'),
      k14: i18n.pick('登入後才看得到自己的報修紀錄。'),
      k15: i18n.pick('去登入'),
      k16: i18n.pick('保留'),
      k17: i18n.pick('已處理'),
      k18: i18n.pick('處理人'),
      k19: i18n.pick('用了'),
      k20: i18n.pick('小時'),
      k21: i18n.pick('處理備註'),
      k22: i18n.pick('張處理中'),
      k23: i18n.pick('張已完成'),
      k24: i18n.pick('送出時間'),
    };
  },

  data: {
    themeClass: appearance.themeClass(),
    loading: true,
    failed: false,
    guest: false,
    errorText: '',
    items: [],
    activeItems: [],
    doneItems: [],
    summary: '',
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
    const L = this.data.L;
    try {
      await data.ensureLogin();
      const res = await data.myRepairs();
      const items = (res.items || []).map((row) =>
        Object.assign({}, row, {
          statusTone: TONE[row.status] || 'neutral',
          placeText: row.location + ' · ' + row.equipment,
          timeText: timeText(row.createdAt),
          subText:
            row.urgencyText +
            ' · ' +
            i18n.pick('送出時間') +
            ' ' +
            timeText(row.createdAt) +
            (row.hours != null ? ' · ' + L.k19 + ' ' + row.hours + ' ' + L.k20 : ''),
          canCancel: row.status === 'PENDING',
        }),
      );
      const activeItems = items.filter((row) => row.status === 'PENDING' || row.status === 'IN_PROGRESS');
      const doneItems = items.filter((row) => row.status !== 'PENDING' && row.status !== 'IN_PROGRESS');
      const active = res.active || activeItems.length;
      const done = res.done || items.filter((row) => row.status === 'DONE').length;
      this.setData({
        loading: false,
        failed: false,
        guest: false,
        errorText: '',
        items: items,
        activeItems: activeItems,
        doneItems: doneItems,
        summary: active + ' ' + L.k22 + ' · ' + done + ' ' + L.k23,
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
    wx.navigateTo({ url: '/pages/repair/create/index' });
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/settings/index' });
  },

  retry() {
    this.load();
  },

  cancelRepair(e) {
    const id = e.currentTarget.dataset.id;
    const label = e.currentTarget.dataset.label || '';
    wx.showModal({
      title: this.data.L.k07,
      content: (this.data.L.k08 + ' ' + label).trim(),
      confirmText: this.data.L.k07,
      cancelText: this.data.L.k16,
      success: (res) => {
        if (!res.confirm) return;
        data
          .cancelRepair(id)
          .then(() => {
            wx.showToast({ title: this.data.L.k09, icon: 'none' });
            this.load();
          })
          .catch((err) => wx.showModal({ title: this.data.L.k10, content: data.messageOf(err), showCancel: false }));
      },
    });
  },
});
