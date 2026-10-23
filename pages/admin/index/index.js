const admin = require('../../../services/admin');
const request = require('../../../utils/request');
const config = require('../../../config/config');
const { dateKey } = require('../../../utils/date');

const TABS = [
  { key: 'stats', label: '概況' },
  { key: 'claims', label: '認領' },
  { key: 'items', label: '失物' },
  { key: 'events', label: '活動' },
  { key: 'notice', label: '公告' },
  { key: 'users', label: '使用者' },
  { key: 'reports', label: '檢舉' },
  { key: 'audit', label: '審計' },
  { key: 'export', label: '名單' },
  { key: 'menu', label: '菜單' },
];

const ROLE_TABS = {
  TEACHER: ['notice', 'events'],
  ADMIN: ['stats', 'claims', 'items', 'events', 'notice', 'users', 'reports', 'export', 'menu'],
  SUPER_ADMIN: ['stats', 'claims', 'items', 'events', 'notice', 'users', 'reports', 'audit', 'export', 'menu'],
};

const ROLES = [
  { key: 'STUDENT', label: '學生' },
  { key: 'TEACHER', label: '老師' },
  { key: 'ADMIN', label: '資訊管理員' },
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
    menuWeekStart: '',
    menuEntries: [],
    events: [],
    eventForm: { title: '', date: '', capacity: '20', location: '' },
    creatingEvent: false,
    users: [],
    roles: ROLES,
    userQuery: { q: '', role: '' },
    meLevel: 0,
    userForm: { account: '', password: '', nickname: '', role: 'STUDENT' },
    creatingUser: false,
    editingId: '',
    editForm: { nickname: '', account: '', password: '', role: 'STUDENT' },
    reports: [],
    audit: [],
    noticeList: [],
    showPerms: false,
    abilities: [],
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
    const allowed = ROLE_TABS[role] || ['notice'];
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
    if (t === 'export') return this.loadEventsForExport();
    if (t === 'events') return this.loadEventsAdmin();
    if (t === 'users') return this.loadUsers();
    if (t === 'reports') return this.loadReports();
    if (t === 'audit') return this.loadAudit();
    if (t === 'notice') return this.loadNoticeList();
    if (t === 'menu') return this.loadMenuWeek();
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

  async loadEventsForExport() {
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

  // ───────── 活動管理 ─────────
  async loadEventsAdmin() {
    try {
      const res = await admin.events();
      this.setData({ events: res.items || [] });
    } catch (e) {
      this.setData({ hint: '讀不到活動：' + (e.message || e.code) });
    }
  },

  onEventField(e) {
    const field = e.currentTarget.dataset.field;
    const patch = {};
    patch['eventForm.' + field] = e.detail.value;
    this.setData(patch);
  },

  async createEvent() {
    if (this.data.creatingEvent) return;
    const f = this.data.eventForm;
    if (!f.title.trim() || !f.date) {
      wx.showToast({ title: '標題與日期必填', icon: 'none' });
      return;
    }
    this.setData({ creatingEvent: true });
    try {
      await admin.createEvent({
        title: f.title.trim(),
        location: f.location.trim() || undefined,
        startAt: new Date(f.date + 'T09:00:00').toISOString(),
        capacity: Number(f.capacity) || 0,
        status: 'PUBLISHED',
      });
      this.setData({ 'eventForm.title': '', 'eventForm.location': '', hint: '活動已建立' });
      wx.showToast({ title: '已建立', icon: 'success' });
      this.loadEventsAdmin();
    } catch (e) {
      wx.showToast({ title: e.message || '建立失敗', icon: 'none' });
    } finally {
      this.setData({ creatingEvent: false });
    }
  },

  async toggleEventStatus(e) {
    const { id, status } = e.currentTarget.dataset;
    const next = status === 'CANCELLED' ? 'PUBLISHED' : 'CANCELLED';
    try {
      await admin.updateEvent(id, { status: next });
      wx.showToast({ title: next === 'CANCELLED' ? '已取消' : '已恢復', icon: 'success' });
      this.loadEventsAdmin();
    } catch (err) {
      wx.showToast({ title: err.message || '操作失敗', icon: 'none' });
    }
  },

  // ───────── 使用者管理 ─────────
  async loadUsers() {
    try {
      const q = this.data.userQuery;
      const res = await admin.users({ q: q.q || undefined, role: q.role || undefined });
      this.setData({ users: res.items || [], meLevel: (res.me || {}).level || 0 });
    } catch (e) {
      this.setData({ hint: '讀不到使用者：' + (e.message || e.code) });
    }
  },

  onUserQuery(e) {
    this.setData({ 'userQuery.q': e.detail.value });
  },

  applyUserQuery() {
    this.loadUsers();
  },

  filterUsers(e) {
    const role = e.currentTarget.dataset.role;
    this.setData({ 'userQuery.role': this.data.userQuery.role === role ? '' : role });
    this.loadUsers();
  },

  onUserField(e) {
    const field = e.currentTarget.dataset.field;
    const patch = {};
    patch['userForm.' + field] = e.detail.value;
    this.setData(patch);
  },

  pickNewUserRole(e) {
    this.setData({ 'userForm.role': e.currentTarget.dataset.role });
  },

  async createUser() {
    if (this.data.creatingUser) return;
    const f = this.data.userForm;
    if (!f.account.trim() || !f.password) {
      wx.showToast({ title: '帳號與密碼必填', icon: 'none' });
      return;
    }
    this.setData({ creatingUser: true });
    try {
      await admin.createUser({
        account: f.account.trim(),
        password: f.password,
        nickname: f.nickname.trim() || undefined,
        role: f.role,
      });
      this.setData({ 'userForm.account': '', 'userForm.password': '', 'userForm.nickname': '', hint: '帳號已建立' });
      wx.showToast({ title: '已建立', icon: 'success' });
      this.loadUsers();
    } catch (e) {
      wx.showToast({ title: e.message || '建立失敗', icon: 'none' });
    } finally {
      this.setData({ creatingUser: false });
    }
  },

  startEdit(e) {
    const { id } = e.currentTarget.dataset;
    const row = (this.data.users || []).filter((u) => u.id === id)[0];
    if (!row) return;
    this.setData({
      editingId: id,
      editForm: { nickname: row.nickname || '', account: row.openid, password: '', role: row.role },
    });
  },

  cancelEdit() {
    this.setData({ editingId: '', editForm: { nickname: '', account: '', password: '', role: 'STUDENT' } });
  },

  onEditField(e) {
    const field = e.currentTarget.dataset.field;
    const patch = {};
    patch['editForm.' + field] = e.detail.value;
    this.setData(patch);
  },

  pickEditRole(e) {
    this.setData({ 'editForm.role': e.currentTarget.dataset.role });
  },

  async saveEdit() {
    const f = this.data.editForm;
    if (!f.nickname.trim() || !f.account.trim()) {
      wx.showToast({ title: '名稱與帳號都要填', icon: 'none' });
      return;
    }
    const payload = { nickname: f.nickname.trim(), account: f.account.trim(), role: f.role };
    if (f.password) {
      if (f.password.length < 8) {
        wx.showToast({ title: '密碼至少 8 位', icon: 'none' });
        return;
      }
      payload.password = f.password;
    }
    try {
      await admin.updateUser(this.data.editingId, payload);
      wx.showToast({ title: '已更新', icon: 'success' });
      this.cancelEdit();
      this.loadUsers();
    } catch (e) {
      wx.showToast({ title: e.message || '更新失敗', icon: 'none' });
    }
  },

  async resetPassword(e) {
    const id = e.currentTarget.dataset.id;
    const self = this;
    wx.showModal({
      title: '重設密碼',
      editable: true,
      placeholderText: '輸入新密碼（至少 8 位）',
      success(res) {
        if (!res.confirm || !res.content) return;
        if (res.content.length < 8) {
          wx.showToast({ title: '密碼至少 8 位', icon: 'none' });
          return;
        }
        admin
          .resetPassword(id, res.content)
          .then(() => wx.showToast({ title: '已重設', icon: 'success' }))
          .catch((err) => wx.showToast({ title: err.message || '重設失敗', icon: 'none' }));
        void self;
      },
    });
  },

  async deleteUser(e) {
    const id = e.currentTarget.dataset.id;
    const account = e.currentTarget.dataset.account;
    const self = this;
    wx.showModal({
      title: '刪除帳號',
      content: '刪除 ' + account + '？相關的認領／報名紀錄會一併清除。',
      confirmColor: '#b3261e',
      success(res) {
        if (!res.confirm) return;
        admin
          .deleteUser(id)
          .then(() => {
            wx.showToast({ title: '已刪除', icon: 'success' });
            self.loadUsers();
          })
          .catch((err) => wx.showToast({ title: err.message || '刪除失敗', icon: 'none' }));
      },
    });
  },

  async setRole(e) {
    const { id, role } = e.currentTarget.dataset;
    try {
      await admin.setRole(id, role);
      wx.showToast({ title: '已設為 ' + role, icon: 'success' });
      this.loadUsers();
    } catch (err) {
      wx.showToast({ title: err.message || '權限不足', icon: 'none' });
    }
  },

  async toggleBan(e) {
    const { id, banned } = e.currentTarget.dataset;
    try {
      await admin.setBanned(id, banned !== '1');
      wx.showToast({ title: banned === '1' ? '已恢復' : '已停用', icon: 'success' });
      this.loadUsers();
    } catch (err) {
      wx.showToast({ title: err.message || '操作失敗', icon: 'none' });
    }
  },

  // ───────── 檢舉 ─────────
  async loadReports() {
    try {
      const res = await admin.reports('PENDING');
      this.setData({ reports: res.items || [] });
    } catch (e) {
      this.setData({ hint: '讀不到檢舉：' + (e.message || e.code) });
    }
  },

  async handleReport(e) {
    const { id, action } = e.currentTarget.dataset;
    try {
      const remove = action === 'RESOLVE';
      const res = await admin.handleReport(id, action, remove);
      wx.showToast({ title: action === 'RESOLVE' ? (res.removed ? '已成立並下架' : '已成立') : '已駁回', icon: 'none' });
      this.loadReports();
    } catch (err) {
      wx.showToast({ title: err.message || '操作失敗', icon: 'none' });
    }
  },

  // ───────── 審計 ─────────
  async togglePerms() {
    const next = !this.data.showPerms;
    this.setData({ showPerms: next });
    if (next && !this.data.abilities.length) {
      try {
        const res = await admin.permissions();
        const labels = { STUDENT: '學生', TEACHER: '老師', ADMIN: '資訊管理員', SUPER_ADMIN: '最高權限' };
        this.setData({ abilities: (res.abilities || []).map((a) => Object.assign({}, a, { allowedText: a.allowed.map((r) => labels[r] || r).join('、') })) });
      } catch (e) {
        this.setData({ hint: '讀不到權限表：' + (e.message || e.code) });
      }
    }
  },

  async loadAudit() {
    try {
      const res = await admin.audit(50);
      this.setData({ audit: res.items || [] });
    } catch (e) {
      this.setData({ hint: '讀不到審計紀錄：' + (e.message || e.code) });
    }
  },

  // ───────── 公告列表／刪除 ─────────
  async loadNoticeList() {
    try {
      const res = await admin.notices();
      this.setData({ noticeList: res.items || [] });
    } catch (e) {
      this.setData({ hint: '讀不到公告：' + (e.message || e.code) });
    }
  },

  async deleteNotice(e) {
    const id = e.currentTarget.dataset.id;
    const self = this;
    wx.showModal({
      title: '刪除公告',
      content: '刪除後無法復原，確定嗎？',
      success(res) {
        if (!res.confirm) return;
        admin
          .deleteNotice(id)
          .then(() => {
            wx.showToast({ title: '已刪除', icon: 'success' });
            self.loadNoticeList();
          })
          .catch((err) => wx.showToast({ title: err.message || '刪除失敗', icon: 'none' }));
      },
    });
  },

  async togglePin(e) {
    const { id, pinned } = e.currentTarget.dataset;
    try {
      await admin.updateNotice(id, { isPinned: pinned !== '1' });
      this.loadNoticeList();
    } catch (err) {
      wx.showToast({ title: err.message || '操作失敗', icon: 'none' });
    }
  },

  // ───────── 菜單整週 ─────────
  async loadMenuWeek() {
    try {
      const res = await admin.menuWeek(this.data.menuWeekStart || undefined);
      this.setData({ menuWeekStart: res.weekStart, menuEntries: res.items || [] });
    } catch (e) {
      this.setData({ hint: '讀不到菜單：' + (e.message || e.code) });
    }
  },

  async deleteMenuEntry(e) {
    const id = e.currentTarget.dataset.id;
    try {
      await admin.deleteMenuEntry(id);
      wx.showToast({ title: '已移除', icon: 'success' });
      this.loadMenuWeek();
    } catch (err) {
      wx.showToast({ title: err.message || '移除失敗', icon: 'none' });
    }
  },
});