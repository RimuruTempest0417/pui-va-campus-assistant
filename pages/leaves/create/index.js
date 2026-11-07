const data = require('../../../services/data');
const i18n = require('../../../utils/i18n');
const appearance = require('../../../utils/appearance');

/**
 * 請假申請（W-72）
 *
 * 學生自己送；家長代「已綁定的那一位子女」送（家校通一個家長帳號只對應一個孩子，
 * 所以這裡不做子女 chips，直接顯示名字）。
 * 前端只做「填得完整」的檢查，日期重疊、權限、是否已批過全部由後端判斷 ——
 * 兩邊各算一份遲早不一致，而且前端算的只是「他看到的那一刻」。
 */

const KINDS = ['SICK', 'PERSONAL', 'OFFICIAL'];

function pad(n) {
  return n < 10 ? '0' + n : String(n);
}

/** 裝置本地日期（澳門）：`2026-11-06`。不用 toISOString()，那會被 UTC 推前／後一天 */
function localDate(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + (offsetDays || 0));
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

Page({
  labels() {
    return {
      k01: i18n.pick('請假申請'),
      k02: i18n.pick('假別'),
      k03: i18n.pick('開始日期'),
      k04: i18n.pick('結束日期'),
      k05: i18n.pick('原因'),
      k06: i18n.pick('例如：發燒，醫生建議休息一天'),
      k07: i18n.pick('送出假單'),
      k08: i18n.pick('送出中…'),
      k09: i18n.pick('病假'),
      k10: i18n.pick('事假'),
      k11: i18n.pick('公假'),
      k12: i18n.pick('替子女請假'),
      k13: i18n.pick('這張假單會用你的家長帳號送出，班主任看到的是孩子的名字。'),
      k14: i18n.pick('送出後由班主任或校務處審批，批完會收到站內通知。'),
      k15: i18n.pick('請先登入才能請假'),
      k16: i18n.pick('只有學生與家長可以送假單'),
      k17: i18n.pick('載入中…'),
      k18: i18n.pick('還沒對應到子女'),
      k19: i18n.pick('請聯絡學校把你的家校通帳號對應到孩子的學號'),
      k20: i18n.pick('請寫一下原因'),
      k21: i18n.pick('結束日期不能早於開始日期'),
      k22: i18n.pick('假單已送出'),
      k23: i18n.pick('送出失敗'),
      k24: i18n.pick('去登入'),
      k25: i18n.pick('天'),
    };
  },

  data: {
    themeClass: appearance.themeClass(),
    loading: true,
    guest: false,
    denied: false,
    isParent: false,
    childName: '',
    childId: '',
    kind: 'SICK',
    kinds: [],
    fromDate: '',
    toDate: '',
    reason: '',
    submitting: false,
    L: {},
  },

  onLoad(query) {
    // W-99：從家長頁「代請假」進來時會帶 studentId，假單就送給目前選中的那一位子女
    this.presetChild = (query && query.studentId) || '';
    const L = this.labels();
    this.setData({
      L: this.labels(),
      themeClass: appearance.themeClass(),
      fromDate: localDate(0),
      toDate: localDate(0),
      kinds: [
        { key: 'SICK', label: L.k09 },
        { key: 'PERSONAL', label: L.k10 },
        { key: 'OFFICIAL', label: L.k11 },
      ],
    });
    this.load();
  },

  onShow() {
    const L = this.labels();
    this.setData({ L: L, themeClass: appearance.themeClass(), kinds: [
      { key: 'SICK', label: L.k09 },
      { key: 'PERSONAL', label: L.k10 },
      { key: 'OFFICIAL', label: L.k11 },
    ] });
  },

  async load() {
    this.setData({ loading: true });
    try {
      await data.ensureLogin();
      const me = await data.me().catch(() => null);
      if (!me) {
        this.setData({ loading: false, guest: true });
        return;
      }
      const isParent = me.role === 'PARENT';
      let childName = '';
      let childId = '';
      if (isParent) {
        const res = await data.parentChildren().catch(() => ({ items: [] }));
        const items = res.items || [];
        const preset = this.presetChild ? items.filter((c) => (c.studentId || c.id) === this.presetChild)[0] : null;
        const first = preset || items[0];
        if (!first) {
          this.setData({ loading: false, isParent: true, denied: false, childName: '', childId: '' });
          return;
        }
        childName = first.nickname || '';
        childId = first.studentId || first.id || '';
      }
      this.setData({ loading: false, guest: false, isParent: isParent, childName: childName, childId: childId });
    } catch (e) {
      this.setData({ loading: false, guest: true });
      console.error('[leaves.create.init]', data.messageOf(e));
    }
  },

  pickKind(e) {
    this.setData({ kind: e.currentTarget.dataset.key });
  },

  onFrom(e) {
    const value = e.detail.value;
    const patch = { fromDate: value };
    // 開始日往後移時，結束日跟著走，避免一送出就撞「結束早於開始」
    if (this.data.toDate < value) patch.toDate = value;
    this.setData(patch);
  },

  onTo(e) {
    this.setData({ toDate: e.detail.value });
  },

  onReason(e) {
    this.setData({ reason: e.detail.value });
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/settings/index' });
  },

  async submit() {
    if (this.data.submitting) return;
    const L = this.data.L;
    if (!String(this.data.reason || '').trim()) {
      wx.showToast({ title: L.k20, icon: 'none' });
      return;
    }
    if (this.data.toDate < this.data.fromDate) {
      wx.showToast({ title: L.k21, icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      const body = {
        kind: this.data.kind,
        fromDate: this.data.fromDate,
        toDate: this.data.toDate,
        reason: String(this.data.reason).trim(),
      };
      if (this.data.isParent && this.data.childId) body.studentId = this.data.childId;
      await data.createLeave(body);
      wx.showToast({ title: L.k22, icon: 'none' });
      setTimeout(() => {
        wx.redirectTo({ url: '/pages/leaves/mine/index' });
      }, 600);
    } catch (e) {
      this.setData({ submitting: false });
      wx.showModal({ title: L.k23, content: data.messageOf(e), showCancel: false });
    }
  },
});
