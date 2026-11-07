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
const venue = require('../../utils/venue');
const study = require('../../utils/study');
const todo = require('../../utils/todo');
const reporter = require('../../utils/reporter');

/** W-79：家長卡那行「功課未交」的文字（取不到就「—」，不要顯示 0 讓人誤會已交清） */
function homeworkLine(hw) {
  const st = (hw && hw.stats) || null;
  if (!st || (hw && hw.needsClass)) return i18n.pick('功課') + ' —';
  if (!st.todo) return i18n.pick('功課都交了');
  const tail = st.overdue ? i18n.pick(' 項未交（含逾期）') : i18n.pick(' 項未交');
  return i18n.pick('功課') + ' ' + st.todo + tail;
}

/** 首頁提案入口的副標：有幾個還在收集中、其中幾個我還沒連署（後端已排除結案） */
function proposalsTextOf(res, meId) {
  const items = (res && res.items) || [];
  if (!items.length) return i18n.pick('還沒有提案，你可以當第一個');
  const open = (res.counts && res.counts.OPEN) || items.length;
  const todo = items.filter((p) => !p.mySupported && !p.isMine && meId).length;
  if (todo > 0) return open + i18n.pick(' 個提案 · ') + todo + i18n.pick(' 個等你連署');
  return open + i18n.pick(' 個提案收集中');
}

/** 首頁報修入口的副標：幾張還在處理中（待接單＋處理中都算「還沒修好」） */
function repairsTextOf(res) {
  if (!res) return i18n.pick('壞了的東西在這裡報');
  const items = res.items || [];
  if (!items.length) return i18n.pick('冷氣、門鎖壞了在這裡報');
  if (res.active) return res.active + i18n.pick(' 張處理中');
  return i18n.pick('報過的都處理完了');
}

/** 首頁場地入口的副標：現在開放的場地／器材數（澳門時間判定，與詳情頁同一套） */
function venueOpenText(items) {
  const now = Date.now();
  const open = items.filter((item) => venue.shapeResource(item, now).openNow).length;
  return open ? i18n.pick('現在開放 ') + open + i18n.pick(' 個') : i18n.pick('目前都已休息');
}

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
    searchPressed: false,
    urgentPressed: false,
    showAdmin: false,
    showData: false,
    adminUrl: '',
    adminSub: '',
    apiBaseText: '',
    libraryText: '',
    libPressed: false,
    venueText: '',
    venuePressed: false,
    giveawayText: '',
    giveawayPressed: false,
    studyText: '',
    studyPressed: false,
    leavePressed: false,
    timetableText: '',
    timetablePressed: false,
    homeworkText: '',
    homeworkPressed: false,
    proposalsText: '',
    proposalPressed: false,
    repairText: '',
    repairPressed: false,
    // W-93 今日待辦：三行（未交功課／下一節／未讀通知），資料源與各模組頁相同
    todoRows: [],
    todoVisible: false,
    todoKey: '',
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
      k16: i18n.pick("圖書館"),
      k17: i18n.pick("可借 "),
      k18: i18n.pick(" 本"),
      k19: i18n.pick("查看館藏 ›"),
      k20: i18n.pick('場地借用'),
      k21: i18n.pick('二手轉贈'),
      k22: i18n.pick('測驗倒數'),
      k23: i18n.pick('今天'),
      k24: i18n.pick('明天'),
      k25: i18n.pick(' 天後'),
      k26: i18n.pick('目前沒有測驗安排'),
      k27: i18n.pick('請假申請'),
      k28: i18n.pick('送出後班主任會收到'),
      k29: i18n.pick('今日課表'),
      k31: i18n.pick('功課'),
      k32: i18n.pick('校園提案'),
      k33: i18n.pick('提出改善建議，同學連署'),
      k34: i18n.pick('課室報修'),
      k35: i18n.pick('今日待辦'),
      k30: i18n.pick('今天不用上課'),
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
      .then((r) => {
        const unread = (r && r.unread) || 0;
        const patch = { unread: unread };
        // W-93：未讀數也是「今日待辦」的一行，拿到新數字就地重算那一行，
        // 不必為了一個數字整頁重抓（_todoSrc 只有 refresh() 跑過才存在）
        if (this._todoSrc) patch.todoRows = todo.rows(Object.assign({}, this._todoSrc, { unread: unread }));
        this.setData(patch);
      })
      .catch(() => {
        const patch = { unread: 0 };
        if (this._todoSrc) patch.todoRows = todo.rows(Object.assign({}, this._todoSrc, { unread: undefined }));
        this.setData(patch);
      });
  },

  goNotifications() {
    wx.navigateTo({ url: '/pages/notifications/index' });
  },

  // ── W-93 今日待辦：一張卡三行，按哪一行就跳到那個模組（路徑由 utils/todo.js 給）──
  onTodoTouchStart(e) {
    this.setData({ todoKey: e.currentTarget.dataset.key });
  },

  onTodoTouchEnd() {
    if (this.data.todoKey) this.setData({ todoKey: '' });
  },

  onTapTodo(e) {
    const key = e.currentTarget.dataset.key;
    const row = (this.data.todoRows || []).filter((r) => r.key === key)[0];
    if (!row || !row.route) return;
    let url = row.route;
    if (key === 'kid' && this.data.parentActiveId) url += '?studentId=' + this.data.parentActiveId;
    wx.navigateTo({ url: url });
  },

  /** W-59 全校搜尋：右上角放大鏡（不放在宮格裡，避免首屏可點元素再 +1） */
  goSearch() {
    wx.navigateTo({ url: '/pages/search/index' });
  },

  onSearchTouchStart() {
    this.setData({ searchPressed: true });
  },

  onSearchTouchEnd() {
    this.setData({ searchPressed: false });
  },

  goAccount() {
    // 右上角頭像 → 設定（登入／登出、語言、外觀都在那裡）
    wx.navigateTo({ url: '/pages/settings/index' });
  },

  goAdmin() {
    wx.navigateTo({ url: '/pages/admin/index/index' });
  },

  /** 家長卡片用：子女概況（報名數／認領數／未讀公告／功課未交數） */
  async loadKidSummary(studentId) {
    const d = await data.parentChild(studentId);
    const s = d.student || {};
    // W-79：子女功課未交數。這支失敗（沒班級／後端暫時取不到）只讓那一行顯示「—」，
    // 不能把整張家長卡打掉 —— 家長最有感的仍是報名／認領那幾個數字。
    let hw = null;
    try {
      hw = await data.parentChildHomework(studentId);
    } catch (err) {
      hw = null;
      reporter.reportError('[index.loadKidSummary.homework] ' + (err && err.message ? err.message : err));
    }
    const st = (hw && hw.stats) || null;
    return {
      studentId: studentId,
      nickname: s.nickname || i18n.pick('同學'),
      grade: s.grade || '',
      className: s.className || '',
      signupCount: (d.signups || []).length,
      claimCount: d.claimCount || 0,
      unreadNotices: d.unreadNotices || 0,
      homeworkTodo: st ? st.todo : null,
      homeworkOverdue: st ? st.overdue : 0,
      homeworkText: homeworkLine(hw),
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

      const [me, items, events, menu, notices, lib, resources, giveaways, timetable, homework, proposals, repairs] = await Promise.all([
        // 未登入時 me() 會 401；首頁是公開頁，訪客照樣要能看到四個模組
        data.me().catch(() => null),
        data.listItems({}),
        data.listEvents({}),
        data.weekMenu(),
        data.listNotices({}),
        // 圖書館入口的副標（可借幾本）：失敗不影響首頁，寧可顯示「—」
        data.listBooks({ available: '1', limit: 1 }).catch(() => ({ total: 0 })),
        // 場地入口的副標（現在開放的場地數）；訪客也看得到，失敗就顯示「—」
        data.listResources({ limit: 50 }).catch(() => ({ items: [] })),
        // 轉贈入口的副標（有幾件東西可以拿）；同樣失敗不影響首頁
        data.listGiveaways({ limit: 50 }).catch(() => ({ items: [] })),
        // 今日課表入口的副標「下一節」：失敗不影響首頁
        data.timetableToday().catch(() => null),
        // 功課入口的副標（未交幾項）：未登入或沒班級時失敗，副標顯示「—」
        data.listHomework({ scope: 'todo' }).catch(() => null),
        // 提案入口的副標（幾個提案、幾個等我連署）：失敗不影響首頁
        data.listProposals({ status: 'OPEN', sort: 'support', limit: 10 }).catch(() => null),
        // 報修入口的副標（幾張處理中）：未登入或後端掛了都顯示預設文案
        data.myRepairs().catch(() => null),
      ]);

      // 緊急公告：只在真的有 URGENT 時顯示第一則
      const urgent = (notices.items || []).find((n) => n.kind === 'URGENT') || null;

      // 測驗倒數（W-69）：用剛抓回來的公告＋活動推算，不另外再打一輪 API
      const studyExams = study.upcomingExams(
        { events: (events && events.items) || [], notices: (notices && notices.items) || [] },
        new Date()
      );
      const nextExam = studyExams[0] || null;
      const studyText = nextExam
        ? (nextExam.daysLeft === 0
            ? i18n.pick('今天')
            : nextExam.daysLeft === 1
              ? i18n.pick('明天')
              : nextExam.daysLeft + i18n.pick(' 天後')) +
          ' · ' +
          nextExam.title
        : i18n.pick('目前沒有測驗安排');

      // 今日菜單：用本地日期比對，找不到就取第一天
      const todayKey = dateKey();
      const days = menu.days || [];
      const todayMenu = days.find((d) => d.date === todayKey) || days[0] || null;

      // v0.60.0：icon 欄位拿掉 —— 四宮格改用 pv-icon（name 就是 key），不再用單字當圖標
      const modules = [
        { key: 'items', label: i18n.t('home.module.items'), sub: items.total + ' ' + i18n.t('home.unit.items') },
        { key: 'events', label: i18n.t('home.module.events'), sub: (events.items || []).length + ' ' + i18n.t('home.unit.events') },
        { key: 'menu', label: i18n.t('home.module.menu'), sub: todayMenu ? (todayMenu.lunch || []).length + ' ' + i18n.t('home.unit.dishes') : '—' },
        { key: 'notices', label: i18n.t('home.module.notices'), sub: notices.unread ? notices.unread + ' ' + i18n.t('home.unread') : (notices.items || []).length + ' ' + i18n.t('home.unit.notices') },
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
      // W-93：「今日待辦」卡片 —— 三個來源（功課 stats／課表 next／通知未讀）都在上面抓好了，
      // 這裡只做組裝；refreshUnread() 之後拿到新的未讀數時會就地重算那一行。
      this._todoSrc = { role: role, homework: homework, timetable: timetable, kid: parentSummary };
      const todoRows = todo.rows(Object.assign({}, this._todoSrc, { unread: this.data.unread }));
      this.setData({
        todoRows: todoRows,
        todoVisible: todoRows.length > 0,
        showAdmin: staff,
        adminSub: ADMIN_SUB[role] || '',
        showData: canSeeData,
        adminUrl: adminUrl,
        loading: false,
        failed: false,
        isDemo: data.isDemo(),
        libraryText: lib && lib.total ? i18n.pick('可借 ') + lib.total + i18n.pick(' 本') : '—',
        venueText: resources && resources.items ? venueOpenText(resources.items) : '—',
        giveawayText:
          giveaways && giveaways.items ? (giveaways.items.length ? giveaways.items.length + i18n.pick(' 件等你拿') : i18n.pick('目前沒有人送東西')) : '—',
        studyText: studyText,
        timetableText: timetable
          ? timetable.schoolDay
            ? timetable.nextText || i18n.pick('今天沒有下一節了')
            : // W-82：放假時把原因寫出來（重陽節假期／全校旅行日），不只四個字
              timetable.dayOffReason || i18n.pick('今天不用上課')
          : '—',
        homeworkText: homework
          ? homework.needsClass
            ? i18n.pick('還沒有班級資料')
            : homework.stats && homework.stats.todo
              ? homework.stats.overdue
                ? homework.stats.todo + i18n.pick(' 項未交（含逾期）')
                : homework.stats.todo + i18n.pick(' 項未交')
              : i18n.pick('功課都交了')
          : '—',
        proposalsText: proposalsTextOf(proposals, (me && me.id) || ''),
        repairText: repairsTextOf(repairs),
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

  // ── 圖書館入口（W-66）：一條列，不動四宮格的 2×2 版面 ──
  onLibTouchStart() {
    this.setData({ libPressed: true });
  },

  onLibTouchEnd() {
    this.setData({ libPressed: false });
  },

  goLibrary() {
    wx.navigateTo({ url: '/pages/library/list/index' });
  },

  onVenueTouchStart() {
    this.setData({ venuePressed: true });
  },

  onVenueTouchEnd() {
    this.setData({ venuePressed: false });
  },

  goVenues() {
    wx.navigateTo({ url: '/pages/venues/list/index' });
  },

  // ── 二手轉贈入口（W-68）：第三條列，與圖書館／場地同一個語彙 ──
  onGvTouchStart() {
    this.setData({ giveawayPressed: true });
  },

  onGvTouchEnd() {
    this.setData({ giveawayPressed: false });
  },

  goGiveaway() {
    wx.navigateTo({ url: '/pages/giveaway/list/index' });
  },

  // ── 測驗倒數入口（W-69）：第四條列 ──
  onStudyTouchStart() {
    this.setData({ studyPressed: true });
  },

  onStudyTouchEnd() {
    this.setData({ studyPressed: false });
  },

  goStudy() {
    wx.navigateTo({ url: '/pages/study/index' });
  },

  // ── 請假申請入口（W-72）：第五條列；進去就是「我的假單」，右上角有請假膠囊 ──
  onLeaveTouchStart() {
    this.setData({ leavePressed: true });
  },

  onLeaveTouchEnd() {
    this.setData({ leavePressed: false });
  },

  goLeaves() {
    wx.navigateTo({ url: '/pages/leaves/mine/index' });
  },

  // ── 今日課表入口（W-73）：第六條列；副標是「下一節」（後端算好，前端不重算時區）──
  onTtTouchStart() {
    this.setData({ timetablePressed: true });
  },

  onTtTouchEnd() {
    this.setData({ timetablePressed: false });
  },

  goTimetable() {
    wx.navigateTo({ url: '/pages/timetable/index' });
  },

  // ── 功課入口（W-76）：第七條列；副標是「未交 N 項」──
  onHwTouchStart() {
    this.setData({ homeworkPressed: true });
  },

  onHwTouchEnd() {
    this.setData({ homeworkPressed: false });
  },

  goHomework() {
    wx.navigateTo({ url: '/pages/homework/index' });
  },

  // ── 校園提案入口（W-88）：第八條列；副標是「N 個提案 · M 個等你連署」──
  onPpTouchStart() {
    this.setData({ proposalPressed: true });
  },

  onPpTouchEnd() {
    this.setData({ proposalPressed: false });
  },

  goProposals() {
    wx.navigateTo({ url: '/pages/proposals/list/index' });
  },

  onRpTouchStart() {
    this.setData({ repairPressed: true });
  },

  onRpTouchEnd() {
    this.setData({ repairPressed: false });
  },

  goRepair() {
    wx.navigateTo({ url: '/pages/repair/index/index' });
  },

  onRetry() {
    this.refresh();
  },
});
