const data = require('../../services/data');
const { dateKey, weekday, fromNow } = require('../../utils/date');
const i18n = require('../../utils/i18n');
const { getNav } = require('../../utils/nav');

// 尚未實作的模組先用提示卡，實作後只要改這裡的路徑
const MODULE_ROUTES = {
  items: { path: '/pages/items/list/index', ready: true, name: i18n.pick('失物招領') },
  events: { path: '/pages/events/list/index', ready: true, name: i18n.pick('活動與社團') },
  menu: { path: '/pages/menu/index/index', ready: true, name: i18n.pick('午餐與小賣部') },
  notices: { path: '/pages/notices/list/index', ready: true, name: i18n.pick('公告與提示') },
};

// 管理後台入口卡的副標：依角色寫出他進去真的做得到的事，避免 STAFF 看到「審核認領」這種他打不開的功能
const ADMIN_SUB = {
  TEACHER: i18n.pick('發公告 · 建立活動 · 報名名單'),
  STAFF: i18n.pick('排菜單 · 報名名單'),
  ADMIN: i18n.pick('審核認領 · 發公告 · 排菜單 · 名單'),
  SUPER_ADMIN: i18n.pick('審核認領 · 發公告 · 排菜單 · 名單 · 審計'),
};

const appearance = require('../../utils/appearance');

Page({
  data: {
    themeClass: appearance.themeClass(),
    navTotal: 0,
    refreshing: false,
    loading: true,
    failed: false,
    isDemo: false,
    unread: 0,
    greeting: '',
    L: { demoTag: '', urgent: '', guest: '', student: '', failed: '', failedDesc: '', retry: '' },
    today: '',
    weekday: '',
    clock: '',
    user: {},
    urgent: null,
    modules: [],
    lunch: null,
    snack: null,
    updatedAt: '',
    pressedKey: '',
    urgentPressed: false,
    showAdmin: false,
    showData: false,
    adminUrl: '',
    adminSub: '',
    apiBaseText: '',
    // 家長：只在家長身分時才有值（切換子女就在首頁做，不必先點進別的頁）
    parentChildren: [],
    parentActiveId: '',
    parentSummary: null,
  },

  onLoad() {
    this.setData({ navTotal: getNav().total });
    this.refresh();
  },

  // scroll-view 的下拉刷新（頁面已改成 scroll-view，不再用 onPullDownRefresh）
  labels() {
    return {
      k13: i18n.pick("培華校園助手"),
      k14: i18n.pick("班"),
      k15: i18n.pick("正在讀取…"),
      k01: i18n.pick("重新載入"),
      k02: i18n.pick("設定後端位址"),
      k03: i18n.pick("今日午餐"),
      k04: i18n.pick("分"),
      k05: i18n.pick("今天沒有午餐資料"),
      k06: i18n.pick("可能尚未排菜單或今天是假日"),
      k07: i18n.pick("小賣部"),
      k08: i18n.pick("我的子女"),
      k09: i18n.pick("代報名 ›"),
      k10: i18n.pick("管理後台"),
      k11: i18n.pick("· 示範資料（未連後端）"),
      k12: i18n.pick("· 資料來源"),
      brand: i18n.pick('培華校園助手'),
      brandSub: i18n.pick('PUI VA CAMPUS'),
      demoTag: i18n.t('home.demoTag'),
      urgent: i18n.t('home.urgent'),
      guest: i18n.t('home.guest'),
      student: i18n.t('home.student'),
      failed: i18n.t('home.failed'),
      failedDesc: i18n.t('home.failedDesc'),
      retry: i18n.t('common.retry'),
    };
  },

  onRefresh() {
    this.setData({ refreshing: true });
    this.refresh(true).then(() => this.setData({ refreshing: false }));
  },

  onShow() {
    // 語言可能在自檢頁被改過：回來先更新介面文字
    this.setData({ greeting: i18n.greetingByHour(), L: this.labels(), themeClass: appearance.themeClass() });
    this.refreshUnread();
    // 從「資料來源」頁切換離線示範回來時，模式變了必須整頁重抓，
    // 否則會出現「設定已改、首頁數字還是舊的」的假畫面。
    let cachedRole = '';
    try {
      cachedRole = (wx.getStorageSync('pv_user') || {}).role || '';
    } catch (e) {
      cachedRole = '';
    }
    if (this._lastRole !== undefined && this._lastRole !== cachedRole) {
      this._lastRole = cachedRole;
      this.refresh();
      return;
    }
    this._lastRole = cachedRole;

    // 語言在設定頁／自檢頁被改過 → 模組名稱、摘要句都是 refresh() 才算的，必須重抓
    const localeNow = i18n.locale();
    if (this._lastLocale !== undefined && this._lastLocale !== localeNow) {
      this._lastLocale = localeNow;
      this.refresh();
      return;
    }
    this._lastLocale = localeNow;

    const modeNow = data.isDemo();
    if (this._lastDemo !== undefined && this._lastDemo !== modeNow) {
      this._lastDemo = modeNow;
      this.refresh();
      return;
    }
    this._lastDemo = modeNow;
    // 模式沒變：只更新時間欄位，不整頁重抓
    if (!this.data.loading) this.setClockFields();
  },

  // 頭像＝登入／帳號；管理要另外按「管理後台」那顆
  refreshUnread() {
    data
      .notificationsUnread()
      .then((r) => this.setData({ unread: (r && r.unread) || 0 }))
      .catch(() => this.setData({ unread: 0 }));
  },

  goNotifications() {
    wx.navigateTo({ url: '/pages/notifications/index' });
  },

  goAccount() {
    // 右上角頭像 → 設定（登入／登出、語言、外觀都在那裡）
    wx.navigateTo({ url: '/pages/settings/index' });
  },

  goAdmin() {
    wx.navigateTo({ url: '/pages/admin/index/index' });
  },

  /** 家長卡片用：子女概況（報名數／認領數／未讀公告） */
  async loadKidSummary(studentId) {
    const d = await data.parentChild(studentId);
    const s = d.student || {};
    return {
      studentId: studentId,
      nickname: s.nickname || i18n.pick('同學'),
      grade: s.grade || '',
      className: s.className || '',
      signupCount: (d.signups || []).length,
      claimCount: d.claimCount || 0,
      unreadNotices: d.unreadNotices || 0,
    };
  },

  /** 首頁切換子女：只換這張卡的數字，不整頁重抓 */
  async onSwitchKid(e) {
    const id = e.currentTarget.dataset.id;
    if (!id || id === this.data.parentActiveId) return;
    this.setData({ parentActiveId: id });
    try {
      const summary = await this.loadKidSummary(id);
      this.setData({ parentSummary: summary });
    } catch (err) {
      this.setData({ parentSummary: null });
    }
  },

  goParent() {
    const id = this.data.parentActiveId;
    wx.navigateTo({ url: '/pages/parent/index' + (id ? '?studentId=' + id : '') });
  },

  goDev() {
    wx.navigateTo({ url: '/pages/dev/api-check/index' });
  },

  setClockFields() {
    this.setData({
      greeting: i18n.greetingByHour(),
      today: dateKey().slice(5).replace('-', i18n.pick(' 月 ')) + i18n.pick(' 日'),
      weekday: weekday(),
      clock: require('../../utils/date').clock(),
    });
  },

  async refresh(fromPull) {
    if (!fromPull) this.setData({ loading: true, failed: false });
    this.setClockFields();

    try {
      // 首次進入先嘗試登入（沒有後端就當訪客，不阻塞畫面）
      await data.ensureLogin();

      const [me, items, events, menu, notices] = await Promise.all([
        // 未登入時 me() 會 401；首頁是公開頁，訪客照樣要能看到四個模組
        data.me().catch(() => null),
        data.listItems({}),
        data.listEvents({}),
        data.weekMenu(),
        data.listNotices({}),
      ]);

      // 緊急公告：只在真的有 URGENT 時顯示第一則
      const urgent = (notices.items || []).find((n) => n.kind === 'URGENT') || null;

      // 今日菜單：用本地日期比對，找不到就取第一天
      const todayKey = dateKey();
      const days = menu.days || [];
      const todayMenu = days.find((d) => d.date === todayKey) || days[0] || null;

      const modules = [
        { key: 'items', icon: i18n.pick('失'), label: i18n.t('home.module.items'), sub: items.total + ' ' + i18n.t('home.unit.items'), tone: 'solid' },
        { key: 'events', icon: i18n.pick('活'), label: i18n.t('home.module.events'), sub: (events.items || []).length + ' ' + i18n.t('home.unit.events'), tone: 'solid' },
        { key: 'menu', icon: i18n.pick('餐'), label: i18n.t('home.module.menu'), sub: todayMenu ? (todayMenu.lunch || []).length + ' ' + i18n.t('home.unit.dishes') : '—', tone: 'solid' },
        { key: 'notices', icon: i18n.pick('告'), label: i18n.t('home.module.notices'), sub: notices.unread ? notices.unread + ' ' + i18n.t('home.unread') : (notices.items || []).length + ' ' + i18n.t('home.unit.notices'), tone: 'solid' },
      ];

      const role = (me && me.role) || '';

      // 家長端：載入綁定的子女與目前這位的概況（訪客／學生／老師都不會打到這兩支）
      let parentChildren = [];
      let parentActiveId = '';
      let parentSummary = null;
      if (role === 'PARENT') {
        try {
          const kids = await data.parentChildren();
          parentChildren = kids.items || [];
          const keep = parentChildren.filter((c) => c.studentId === this.data.parentActiveId)[0];
          parentActiveId = keep ? keep.studentId : parentChildren[0] ? parentChildren[0].studentId : '';
          if (parentActiveId) parentSummary = await this.loadKidSummary(parentActiveId);
        } catch (e) {
          parentChildren = [];
          parentActiveId = '';
          parentSummary = null;
        }
      }
      // 管理後台入口：有後台分頁的角色就看得到（校內職員只有菜單與名單）
      const staff = ['TEACHER', 'STAFF', 'ADMIN', 'SUPER_ADMIN'].indexOf(role) !== -1;
      const canSeeData = ['ADMIN', 'SUPER_ADMIN'].indexOf(role) !== -1;
      const base = data.apiBase() || '';
      const adminUrl = base.replace(/\/api\/v1\/?$/, '') + '/admin';

      this._lastDemo = data.isDemo();
      this._lastRole = role;
      this.setData({
        showAdmin: staff,
        adminSub: ADMIN_SUB[role] || '',
        showData: canSeeData,
        adminUrl: adminUrl,
        loading: false,
        failed: false,
        isDemo: data.isDemo(),
        user: me || {},
        parentChildren: parentChildren,
        parentActiveId: parentActiveId,
        parentSummary: parentSummary,
        urgent: urgent,
        modules: modules,
        lunch: todayMenu ? todayMenu.lunch : null,
        snack: todayMenu ? todayMenu.snack : null,
        updatedAt: i18n.t('home.justNow'),
        L: this.labels(), themeClass: appearance.themeClass(),
      });
    } catch (e) {
      console.error('[home] 載入失敗', e);
      this.setData({
        loading: false,
        failed: true,
        updatedAt: '',
        apiBaseText: (data.apiBase && data.apiBase()) || i18n.pick('未設定'),
      });
    } finally {
      if (fromPull) wx.stopPullDownRefresh();
    }
  },

  // 按下即時回饋（Skyline 下 hover-class 不可靠，改用 touch 事件）
  onCellTouchStart(e) {
    this.setData({ pressedKey: e.currentTarget.dataset.key });
  },
  onCellTouchEnd() {
    if (this.data.pressedKey) this.setData({ pressedKey: '' });
  },
  onUrgentTouchStart() {
    this.setData({ urgentPressed: true });
  },
  onUrgentTouchEnd() {
    if (this.data.urgentPressed) this.setData({ urgentPressed: false });
  },

  onTapModule(e) {
    const key = e.currentTarget.dataset.key;
    const mod = MODULE_ROUTES[key];
    if (!mod) return;
    if (!mod.ready) {
      wx.showToast({ title: mod.name + i18n.pick(' 即將推出'), icon: 'none' });
      return;
    }
    wx.navigateTo({ url: mod.path });
  },

  onTapUrgent() {
    if (!this.data.urgent) return;
    wx.navigateTo({ url: '/pages/notices/detail/index?id=' + this.data.urgent.id });
  },

  onRetry() {
    this.refresh();
  },
});
