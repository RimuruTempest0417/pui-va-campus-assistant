const data = require('../../services/data');
const { dateTimeText } = require('../../utils/date');
const { codeOf } = require('../../utils/errors');

/**
 * 家長端 P3：切換子女 ＋ 代報名／取消
 *
 * 所有寫入都帶 activeId（子女的 studentId），真正的門在後端：
 * role 必須是 PARENT、studentId 必須存在於 parent_links，否則 403。
 * 前端不自己判斷「這是不是我的孩子」—— 那只會多一份會過期的真相。
 */
Page({
  data: {
    loading: true,
    failed: false,
    errorText: '',
    children: [],
    tabs: [],
    activeId: '',
    child: null,
    signups: [],
    openEvents: [],
    submitting: false,
    refreshing: false,
  },

  onLoad(query) {
    this.preset = (query && query.studentId) || '';
    this.load();
  },

  onShow() {
    // 從活動詳情返回時重抓（首次跳過），否則狀態會停在舊的
    if (this._loadedOnce) this.load();
    this._loadedOnce = true;
  },

  onRefresh() {
    this.setData({ refreshing: true });
    this.load().then(() => this.setData({ refreshing: false }));
  },

  async load() {
    try {
      const res = await data.parentChildren();
      const children = res.items || [];
      const known = children.filter((c) => c.studentId === this.data.activeId)[0];
      const presetHit = this.preset && children.filter((c) => c.studentId === this.preset)[0];
      const activeId = known
        ? this.data.activeId
        : presetHit
          ? this.preset
          : children[0]
            ? children[0].studentId
            : '';

      this.setData({
        children: children,
        tabs: children.map((c) => ({ key: c.studentId, label: c.nickname || '同學' })),
        activeId: activeId,
        loading: false,
        failed: false,
      });
      if (activeId) await this.loadChild(activeId);
    } catch (e) {
      // 訪客／學生／老師打進來都是 401・403：給人話，不要把後端的權限訊息直接丟到畫面上
      const code = codeOf(e);
      const needLogin = code === 'UNAUTHORIZED' || code === 'FORBIDDEN' || code === 'UNAUTHENTICATED';
      this.setData({
        loading: false,
        failed: true,
        errorText: needLogin ? '請先在家長帳號登入（首頁右上角頭像），而且這個帳號要已綁定子女' : data.messageOf(e),
      });
    }
  },

  async loadChild(studentId) {
    try {
      const [detail, evs] = await Promise.all([
        data.parentChild(studentId),
        data.listEvents({}).catch(() => ({ items: [] })),
      ]);

      const signups = (detail.signups || []).map((s) => Object.assign({}, s, {
        timeText: s.event && s.event.startAt ? dateTimeText(s.event.startAt) : '',
        statusLabel: s.status === 'CONFIRMED' ? '已報名' : '候補第 ' + (s.waitlistPos || 0) + ' 位',
        tagType: s.status === 'CONFIRMED' ? 'success' : 'warning',
      }));

      const joined = {};
      signups.forEach((s) => {
        if (s.event && s.event.id) joined[s.event.id] = true;
      });

      const openEvents = (evs.items || [])
        // 真 API 的 startAt 是 ISO 字串、示範資料是毫秒數字 → 一律走 Date 解析，不要 Number()
        .filter((e) => e.status !== 'FINISHED' && new Date(e.startAt).getTime() >= Date.now() && !joined[e.id])
        .slice(0, 5)
        .map((e) => Object.assign({}, e, {
          timeText: e.startAt ? dateTimeText(e.startAt) : '',
          capText: e.capacity > 0 ? '剩 ' + (e.remaining == null ? 0 : e.remaining) + ' 位' : '不限名額',
          full: e.capacity > 0 && e.remaining === 0,
        }));

      this.setData({ child: detail, signups: signups, openEvents: openEvents, submitting: false });
    } catch (e) {
      this.setData({ signups: [], openEvents: [], submitting: false });
      wx.showToast({ title: data.messageOf(e), icon: 'none' });
    }
  },

  onSwitchChild(e) {
    const key = e.detail && e.detail.key;
    if (!key || key === this.data.activeId) return;
    this.preset = '';
    this.setData({ activeId: key, child: null, signups: [], openEvents: [] });
    this.loadChild(key);
  },

  async onSignup(e) {
    const eventId = e.currentTarget.dataset.id;
    if (!eventId || this.data.submitting) return;
    this.setData({ submitting: true });
    try {
      const rec = await data.parentSignupEvent(this.data.activeId, eventId);
      wx.showToast({
        title: rec.status === 'WAITLIST' ? '已額滿，代為候補第 ' + rec.waitlistPos + ' 位' : '已代為報名',
        icon: 'none',
      });
      await this.loadChild(this.data.activeId);
    } catch (err) {
      this.setData({ submitting: false });
      wx.showToast({ title: data.messageOf(err), icon: 'none' });
    }
  },

  async onCancel(e) {
    const eventId = e.currentTarget.dataset.id;
    if (!eventId || this.data.submitting) return;
    this.setData({ submitting: true });
    try {
      const res = await data.parentCancelSignup(this.data.activeId, eventId);
      wx.showToast({ title: res.promoted ? '已取消，已為候補者補位' : '已取消', icon: 'none' });
      await this.loadChild(this.data.activeId);
    } catch (err) {
      this.setData({ submitting: false });
      wx.showToast({ title: data.messageOf(err), icon: 'none' });
    }
  },

  goEvent(e) {
    const id = e.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: '/pages/events/detail/index?id=' + id });
  },
});
