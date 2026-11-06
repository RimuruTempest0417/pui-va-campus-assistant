const data = require('../../../services/data');
const i18n = require('../../../utils/i18n');
const appearance = require('../../../utils/appearance');
const proposal = require('../../../utils/proposal');
const request = require('../../../utils/request');
const reporter = require('../../../utils/reporter');

Page({
  labels() {
    return {
      k01: i18n.pick('提案詳情'),
      k02: i18n.pick('載入失敗'),
      k03: i18n.pick('重試'),
      k04: i18n.pick('找不到這個提案'),
      k05: i18n.pick('可能已被撤回'),
      k06: i18n.pick('建議內容'),
      k07: i18n.pick('連署進度'),
      k08: i18n.pick('校方回覆'),
      k09: i18n.pick('校方還沒回覆'),
      k10: i18n.pick('連署支持'),
      k11: i18n.pick('已連署 · 取消'),
      k12: i18n.pick('登入後可連署'),
      k13: i18n.pick('已結案'),
      k14: i18n.pick('撤回提案'),
      k15: i18n.pick('下架'),
      k16: i18n.pick('修改內容'),
      k17: i18n.pick('連署成功'),
      k18: i18n.pick('已取消連署'),
      k19: i18n.pick('確定要撤回這個提案嗎？撤回後會移到資源回收桶，校方仍可救回。'),
      k20: i18n.pick('確定要下架這個提案嗎？下架後前台看不到，可在回收桶救回。'),
      k21: i18n.pick('確定'),
      k22: i18n.pick('取消'),
      k23: i18n.pick('已撤回'),
      k24: i18n.pick('已下架'),
      k25: i18n.pick('連署的人'),
      k26: i18n.pick('提案人'),
      k27: i18n.pick('已達門檻，校方會收到通知'),
      k28: i18n.pick('處理中…'),
    };
  },

  data: {
    themeClass: appearance.themeClass(),
    id: '',
    loading: true,
    failed: false,
    notFound: false,
    errorText: '',
    item: null,
    barText: '',
    barKind: '',
    barDisabled: true,
    busy: false,
    L: {},
  },

  onLoad(query) {
    const id = (query && query.id) || '';
    this.setData({ L: this.labels(), themeClass: appearance.themeClass(), id: id });
    this.load();
  },

  onShow() {
    this.setData({ L: this.labels(), themeClass: appearance.themeClass() });
    if (this._loadedOnce) this.load();
    this._loadedOnce = true;
  },

  meId() {
    try {
      const user = wx.getStorageSync('pv_user') || {};
      return user.id || '';
    } catch (e) {
      return '';
    }
  },

  /** 底部按鈕由「誰在看 ＋ 目前狀態」推導；任何會改變這兩者的操作後都要重算 */
  barFor(item) {
    if (!item) return { barKind: 'none', barText: '', barDisabled: true };
    const loggedIn = !!request.getToken() || data.isDemo();
    if (!loggedIn) return { barKind: 'login', barText: i18n.pick('登入後可連署'), barDisabled: false };
    if (item.isMine) {
      if (item.status === 'OPEN') return { barKind: 'edit', barText: i18n.pick('修改內容'), barDisabled: false };
      return { barKind: 'closed', barText: i18n.pick('已送交校方處理'), barDisabled: true };
    }
    if (item.closed) return { barKind: 'closed', barText: i18n.pick('已結案'), barDisabled: true };
    if (item.mySupported) return { barKind: 'unsupport', barText: i18n.pick('已連署 · 取消'), barDisabled: false };
    return { barKind: 'support', barText: i18n.pick('連署支持'), barDisabled: false };
  },

  async load() {
    if (!this.data.id) {
      this.setData({ loading: false, notFound: true, failed: false });
      return;
    }
    this.setData({ loading: true });
    try {
      const res = await data.getProposal(this.data.id);
      const item = proposal.decorateItem(res);
      const bar = this.barFor(item);
      this.setData(Object.assign({ loading: false, failed: false, notFound: false, errorText: '', item: item }, bar));
    } catch (e) {
      const code = (e && e.code) || '';
      const notFound = code === 'NOT_FOUND';
      this.setData({
        loading: false,
        failed: !notFound,
        notFound: notFound,
        errorText: data.messageOf(e),
        item: null,
      });
      if (!notFound) reporter.reportError('[proposal.detail] ' + data.messageOf(e));
    }
  },

  retry() {
    this.load();
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/admin/login/index' });
  },

  onPrimary() {
    const kind = this.data.barKind;
    if (kind === 'login') {
      this.goLogin();
      return;
    }
    if (kind === 'edit') {
      wx.navigateTo({ url: '/pages/proposals/create/index?id=' + this.data.id });
      return;
    }
    if (kind === 'support') {
      this.support();
      return;
    }
    if (kind === 'unsupport') {
      this.unsupport();
    }
  },

  async support() {
    if (this.data.busy) return;
    this.setData({ busy: true });
    try {
      await data.supportProposal(this.data.id);
      wx.showToast({ title: this.data.L.k17, icon: 'none' });
      await this.load();
    } catch (e) {
      wx.showModal({ title: this.data.L.k02, content: data.messageOf(e), showCancel: false });
    } finally {
      this.setData({ busy: false });
    }
  },

  async unsupport() {
    if (this.data.busy) return;
    this.setData({ busy: true });
    try {
      await data.unsupportProposal(this.data.id);
      wx.showToast({ title: this.data.L.k18, icon: 'none' });
      await this.load();
    } catch (e) {
      wx.showModal({ title: this.data.L.k02, content: data.messageOf(e), showCancel: false });
    } finally {
      this.setData({ busy: false });
    }
  },

  onWithdraw() {
    const item = this.data.item;
    if (!item) return;
    if (!item.isMine && !item.canModerate) return;
    const title = item.isMine ? this.data.L.k14 : this.data.L.k15;
    const content = item.isMine ? this.data.L.k19 : this.data.L.k20;
    wx.showModal({
      title: title,
      content: content,
      confirmText: this.data.L.k21,
      cancelText: this.data.L.k22,
      success: (res) => {
        if (!res.confirm) return;
        this.remove(item.isMine ? this.data.L.k23 : this.data.L.k24);
      },
    });
  },

  async remove(doneText) {
    if (this.data.busy) return;
    this.setData({ busy: true });
    try {
      await data.removeProposal(this.data.id);
      wx.showToast({ title: doneText, icon: 'none' });
      setTimeout(() => wx.navigateBack(), 600);
    } catch (e) {
      wx.showModal({ title: this.data.L.k02, content: data.messageOf(e), showCancel: false });
    } finally {
      this.setData({ busy: false });
    }
  },
});
