const data = require('../../services/data');
const { dateKey, weekday, greeting, fromNow } = require('../../utils/date');
const { getNav } = require('../../utils/nav');

// 尚未實作的模組先用提示卡，實作後只要改這裡的路徑
const MODULE_ROUTES = {
  items: { path: '/pages/items/list/index', ready: true, name: '失物招領' },
  events: { path: '/pages/events/list/index', ready: false, name: '活動與社團' },
  menu: { path: '/pages/menu/index/index', ready: false, name: '午餐與小賣部' },
  notices: { path: '/pages/notices/list/index', ready: false, name: '公告與提示' },
};

Page({
  data: {
    navTotal: 0,
    refreshing: false,
    loading: true,
    failed: false,
    isDemo: false,
    greeting: '',
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
  },

  onLoad() {
    this.setData({ navTotal: getNav().total });
    this.refresh();
  },

  // scroll-view 的下拉刷新（頁面已改成 scroll-view，不再用 onPullDownRefresh）
  onRefresh() {
    this.setData({ refreshing: true });
    this.refresh(true).then(() => this.setData({ refreshing: false }));
  },

  onShow() {
    // 從其他頁返回時只更新時間欄位，不整頁重抓
    if (!this.data.loading) this.setClockFields();
  },

  setClockFields() {
    this.setData({
      greeting: greeting(),
      today: dateKey().slice(5).replace('-', ' 月 ') + ' 日',
      weekday: weekday(),
      clock: require('../../utils/date').clock(),
    });
  },

  async refresh(fromPull) {
    if (!fromPull) this.setData({ loading: true, failed: false });
    this.setClockFields();

    try {
      const [me, items, events, menu, notices] = await Promise.all([
        data.me(),
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
        { key: 'items', icon: '🔍', label: '失物招領', sub: items.total + ' 筆', tone: 'tint' },
        { key: 'events', icon: '🎪', label: '活動與社團', sub: (events.items || []).length + ' 個', tone: 'brand' },
        { key: 'menu', icon: '🍚', label: '午餐與小賣部', sub: todayMenu ? (todayMenu.lunch || []).length + ' 款' : '—', tone: 'warning' },
        { key: 'notices', icon: '📢', label: '公告與提示', sub: (notices.items || []).length + ' 則', tone: 'success' },
      ];

      this.setData({
        loading: false,
        failed: false,
        isDemo: data.isDemo(),
        user: me || {},
        urgent: urgent,
        modules: modules,
        lunch: todayMenu ? todayMenu.lunch : null,
        snack: todayMenu ? todayMenu.snack : null,
        updatedAt: '剛剛更新',
      });
    } catch (e) {
      console.error('[home] 載入失敗', e);
      this.setData({ loading: false, failed: true, updatedAt: '' });
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
      wx.showToast({ title: mod.name + ' 即將推出', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: mod.path });
  },

  onTapUrgent() {
    wx.showToast({ title: '公告模組即將推出', icon: 'none' });
  },

  onRetry() {
    this.refresh();
  },
});
