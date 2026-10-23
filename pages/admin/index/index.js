const admin = require('../../../services/admin');
const request = require('../../../utils/request');
const config = require('../../../config/config');
const { dateKey } = require('../../../utils/date');

const TABS = [
  { key: 'stats', label: '概況' },
  { key: 'claims', label: '認領' },
  { key: 'items', label: '失物' },
  { key: 'notice', label: '公告' },
  { key: 'export', label: '名單' },
  { key: 'menu', label: '菜單' },
];

Page({
  data: {
    tabs: TABS,
    tab: 'stats',
    role: '',
    stats: { users: 0, items: { open: 0, claimed: 0, added7d: 0 }, claimsPending: 0, signups: { confirmed: 0, waitlist: 0 }, noticesActive: 0, ratings: { count: 0, avg: 0 } },
    claims: [],
    items: [],
    itemStatus: 'OPEN',
    statusFilters: [
      { key: 'OPEN', label: '待認領' },
      { key: 'MATCHED', label: '已匹配' },
      { key: 'CLAIMED', label: '已認領' },
      { key: '', label: '全部' },
    ],
    events: [],
    eventId: '',
    signups: [],
    notice: { title: '', content: '', kind: 'NORMAL', isPinned: false },
    kinds: [
      { key: 'NORMAL', label: '一般' },
      { key: 'CALENDAR', label: '校曆' },
      { key: 'URGENT', label: '緊急' },
    ],
    meals: [
      { key: 'LUNCH', label: '午餐' },
      { key: 'SNACK', label: '小賣部' },
    ],
    menu: { date: '', mealType: 'LUNCH', names: '' },
    sending: false,
    hint: '',
  },

  onLoad() {
    let user = {};
    try {
      user = wx.getStorageSync(config.STORAGE_KEYS.user) || {};
    } catch (e) {
      user = {};
    }
    const role = user.role || '';
    if (['TEACHER', 'ADMIN', 'SUPER_ADMIN'].indexOf(role) === -1) {
      wx.redirectTo({ url: '/pages/admin/login/index' });
      return;
    }
    this.setData({ role: role, 'menu.date': dateKey() });

    // 依能力決定看得到哪些分頁（真正的權限仍在後端）
    const allowed = role === 'TEACHER' ? ['notice'] : ['stats', 'claims', 'items', 'notice', 'export', 'menu'];
    const tabs = TABS.filter((t) => allowed.indexOf(t.key) !== -1);
    this.setData({ tabs: tabs, tab: tabs[0].key });
    this.loadTab();
  },

  logout() {
    request.setToken('');
    wx.removeStorageSync(config.STORAGE_KEYS.user);
    wx.showToast({ title: '已登出', icon: 'none' });
    setTimeout(() => wx.navigateBack(), 400);
  },

  switchTab(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ tab: key, hint: '' });
    this.loadTab();
  },

  loadTab() {
    const t = this.data.tab;
    if (t === 'stats') return this.loadStats();
    if (t === 'claims') return this.loadClaims();
    if (t === 'items') return this.loadItems();
    if (t === 'export') return this.loadEvents();
    if (t === 'menu') return null;
    return null;
  },

  async loadStats() {
    try {
      const stats = await admin.stats();
      this.setData({ stats: stats });
    } catch (e) {
      this.setData({ hint: '讀不到數據：' + (e.message || e.code) });
    }
  },

  async loadClaims() {
    try {
      const res = await admin.claims('PENDING');
      this.setData({ claims: res.items || [] });
    } catch (e) {
      this.setData({ hint: '讀不到申請：' + (e.message || e.code) });
    }
  },

  async loadItems() {
    try {
      const res = await admin.items(this.data.itemStatus);
      this.setData({ items: res.items || [] });
    } catch (e) {
      this.setData({ hint: '讀不到失物：' + (e.message || e.code) });
    }
  },

  async loadEvents() {
    try {
      const res = await admin.events();
      const events = res.items || [];
      this.setData({ events: events });
      if (events.length && !this.data.eventId) {
        this.pickEventById(events[0].id);
      }
    } catch (e) {
      this.setData({ hint: '讀不到活動：' + (e.message || e.code) });
    }
  },

  filterItems(e) {
    this.setData({ itemStatus: e.currentTarget.dataset.key });
    this.loadItems();
  },

  async review(e) {
    const { id, ok } = e.currentTarget.dataset;
    try {
      await admin.reviewClaim(id, ok === '1');
      wx.showToast({ title: ok === '1' ? '已通過' : '已拒絕', icon: 'success' });
      this.loadClaims();
    } catch (err) {
      wx.showToast({ title: err.message || '操作失敗', icon: 'none' });
    }
  },

  async moderate(e) {
    const { id, act } = e.currentTarget.dataset;
    try {
      await admin.moderateItem(id, act);
      wx.showToast({ title: act === 'REMOVE' ? '已下架' : '已恢復', icon: 'success' });
      this.loadItems();
    } catch (err) {
      wx.showToast({ title: err.message || '操作失敗', icon: 'none' });
    }
  },

  onNoticeTitle(e) {
    this.setData({ 'notice.title': e.detail.value });
  },
  onNoticeContent(e) {
    this.setData({ 'notice.content': e.detail.value });
  },
  pickKind(e) {
    this.setData({ 'notice.kind': e.currentTarget.dataset.key });
  },
  onPinned(e) {
    this.setData({ 'notice.isPinned': e.detail.value });
  },

  async publish() {
    if (this.data.sending) return;
    const n = this.data.notice;
    if (!n.title.trim() || !n.content.trim()) {
      wx.showToast({ title: '標題與內容都要填', icon: 'none' });
      return;
    }
    this.setData({ sending: true });
    try {
      const res = await admin.createNotice({
        title: n.title.trim(),
        content: n.content.trim(),
        kind: n.kind,
        isPinned: n.isPinned,
      });
      this.setData({
        'notice.title': '',
        'notice.content': '',
        hint: '已發布：' + res.title + (res.pushed ? '，已推播 ' + res.pushed + ' 人' : ''),
      });
      wx.showToast({ title: '已發布', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: e.message || '發布失敗', icon: 'none' });
    } finally {
      this.setData({ sending: false });
    }
  },

  pickEvent(e) {
    this.pickEventById(e.currentTarget.dataset.id);
  },

  async pickEventById(id) {
    this.setData({ eventId: id });
    try {
      const res = await admin.signups(id);
      this.setData({ signups: res.items || [] });
    } catch (e) {
      this.setData({ signups: [], hint: '讀不到名單：' + (e.message || e.code) });
    }
  },

  copySignups() {
    const lines = this.data.signups.map((s, i) =>
      `${i + 1}. ${s.nickname || '（未設定）'} ${s.grade || ''}${s.className || ''} — ${s.status === 'CONFIRMED' ? '正取' : '候補' + s.waitlistPos}`,
    );
    wx.setClipboardData({
      data: lines.join('\n'),
      success: () => wx.showToast({ title: '名單已複製', icon: 'none' }),
    });
  },

  onMenuDate(e) {
    this.setData({ 'menu.date': e.detail.value });
  },
  pickMeal(e) {
    this.setData({ 'menu.mealType': e.currentTarget.dataset.key });
  },
  onMenuNames(e) {
    this.setData({ 'menu.names': e.detail.value });
  },

  async saveMenu() {
    if (this.data.sending) return;
    const m = this.data.menu;
    const names = (m.names || '').split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    if (!m.date || !names.length) {
      wx.showToast({ title: '日期與菜名都要填', icon: 'none' });
      return;
    }
    this.setData({ sending: true });
    try {
      const ids = [];
      for (const name of names) {
        const dish = await admin.createDish(name, m.mealType);
        ids.push(dish.id);
      }
      const res = await admin.scheduleMenu(m.date, m.mealType, ids);
      this.setData({ hint: `${res.date} 已排入 ${res.count} 道菜`, 'menu.names': '' });
      wx.showToast({ title: '已排入', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: e.message || '排菜單失敗', icon: 'none' });
    } finally {
      this.setData({ sending: false });
    }
  },
});
