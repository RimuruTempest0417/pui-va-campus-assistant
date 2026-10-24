const i18n = require('../../../utils/i18n');
const admin = require('../../../services/admin');
const request = require('../../../utils/request');
const config = require('../../../config/config');
const { dateKey, fromNow, dateTimeText } = require('../../../utils/date');
const role = require('../../../utils/role');
const theme = require('../../../utils/theme');

const TABS = [
  { key: 'stats', label: i18n.pick('概況') },
  { key: 'claims', label: i18n.pick('認領') },
  { key: 'items', label: i18n.pick('失物') },
  { key: 'trash', label: i18n.pick('垃圾桶') },
  { key: 'events', label: i18n.pick('活動') },
  { key: 'notice', label: i18n.pick('公告') },
  { key: 'users', label: i18n.pick('使用者') },
  { key: 'parents', label: i18n.pick('家長') },
  { key: 'reports', label: i18n.pick('檢舉') },
  { key: 'errors', label: i18n.pick('錯誤') },
  { key: 'push', label: i18n.pick('推送') },
  { key: 'audit', label: i18n.pick('審計') },
  { key: 'export', label: i18n.pick('名單') },
  { key: 'menu', label: i18n.pick('菜單') },
];

const ROLE_TABS = {
  // 校內職員：排菜單＋匯出報名名單。沒有 event:create（不能開活動）、沒有 notice:create（不能發公告）
  STAFF: ['notice', 'claims', 'menu', 'export'],
  TEACHER: ['notice', 'events'],
  ADMIN: ['stats', 'claims', 'items', 'trash', 'events', 'notice', 'users', 'parents', 'reports', 'errors', 'push', 'export', 'menu'],
  SUPER_ADMIN: ['stats', 'claims', 'items', 'trash', 'events', 'notice', 'users', 'parents', 'reports', 'errors', 'push', 'audit', 'export', 'menu'],
};

// 離線備援：線上一律用 GET /admin/users 回來的 roles（帶 level，後端單一來源）。
// level 不能少 —— 下面的「設為 X」按鈕靠 item.level > r.level 判斷，缺了就永遠不顯示。
const ROLES = [
  { key: 'PARENT', level: 1, label: i18n.pick('家長') },
  { key: 'STUDENT', level: 1, label: i18n.pick('學生') },
  { key: 'TEACHER', level: 2, label: i18n.pick('老師') },
  { key: 'STAFF', level: 2, label: i18n.pick('校內職員') },
  { key: 'ADMIN', level: 3, label: i18n.pick('資訊管理員') },
];


const appearance = require('../../../utils/appearance');

Page({
  labels() {
    return {
      k100: i18n.pick("（未設定）"),
      k101: i18n.pick("已簽到"),
      k102: i18n.pick("未簽到"),
      k103: i18n.pick("候補"),
      k104: i18n.pick("撤銷"),
      k105: i18n.pick("代簽"),
      k106: i18n.pick("已取消"),
      k107: i18n.pick("報名中"),
      k108: i18n.pick("不限"),
      k109: i18n.pick("恢復"),
      k110: i18n.pick("取消活動"),
      k111: i18n.pick(" · 已停用"),
      k112: i18n.pick(" · 最後登入 "),
      k113: i18n.pick("停用"),
      k114: i18n.pick("匿名"),
      k115: i18n.pick("沒有待處理的錯誤"),
      k116: i18n.pick("沒有已解決的紀錄"),
      k117: i18n.pick("（未記錄頁面）"),
      k118: i18n.pick("標記已解決"),
      k119: i18n.pick("重新打開"),
      k120: i18n.pick("正取"),
      k121: i18n.pick("候補 "),
      k122: i18n.pick("午餐"),
      k123: i18n.pick("小賣部"),
      k124: i18n.pick("菜單"),
      k125: i18n.pick('活動'),
      k126: i18n.pick('列印清單'),
      k127: i18n.pick('列印名單'),
      k128: i18n.pick('同類一次解決'),
      k131: i18n.pick('清理舊紀錄'),
      k132: i18n.pick('推送紀錄'),
      k133: i18n.pick('總計'),
      k134: i18n.pick('成功'),
      k135: i18n.pick('失敗紀錄'),
      k136: i18n.pick('近 24 小時'),
      k137: i18n.pick('全部通路'),
      k138: i18n.pick('站內通知'),
      k139: i18n.pick('微信消息'),
      k140: i18n.pick('沒有推送紀錄'),
      k141: i18n.pick('發一則公告，或有人報名活動之後，這裡會出現每一筆發送的結果'),
      k142: i18n.pick('（無標題）'),
      k143: i18n.pick('原因：'),
      // W-40 資源回收桶（新增區塊一律用固定號碼，不要重跑遷移腳本重新編號）
      k145: i18n.pick('垃圾桶'),
      k146: i18n.pick('刪掉的公告與下架的失物會先放在這裡，按還原就回到原本的分頁；這裡不做永久刪除。'),
      k147: i18n.pick('公告'),
      k148: i18n.pick('失物'),
      k149: i18n.pick('合計'),
      k150: i18n.pick('筆'),
      k151: i18n.pick('刪除時間'),
      k152: i18n.pick('誰刪的'),
      k153: i18n.pick('還原'),
      k154: i18n.pick('垃圾桶是空的'),
      k155: i18n.pick('刪掉或下架的內容會出現在這裡'),
      k156: i18n.pick('（未記錄）'),
      k85: i18n.pick("已下架"),
      k86: i18n.pick("拾獲"),
      k87: i18n.pick("遺失"),
      k88: i18n.pick("緊急"),
      k89: i18n.pick("校曆"),
      k90: i18n.pick("一般"),
      k91: i18n.pick("取消置頂"),
      k92: i18n.pick("置頂"),
      k93: i18n.pick("已滿"),
      k94: i18n.pick("不限名額"),
      k95: i18n.pick("有名額"),
      k96: i18n.pick("開放中"),
      k97: i18n.pick("未開放"),
      k98: i18n.pick("換一張新碼"),
      k99: i18n.pick("開始簽到"),
      k01: i18n.pick("管理"),
      k02: i18n.pick("讀取失敗"),
      k03: i18n.pick("重試"),
      k04: i18n.pick("使用者"),
      k05: i18n.pick("待認領"),
      k06: i18n.pick("待審認領"),
      k07: i18n.pick("正取報名"),
      k08: i18n.pick("候補中"),
      k09: i18n.pick("有效公告"),
      k10: i18n.pick("登出"),
      k11: i18n.pick("沒有待審申請"),
      k12: i18n.pick("學生提出認領後會出現在這裡"),
      k13: i18n.pick("通過"),
      k14: i18n.pick("拒絕"),
      k15: i18n.pick("恢復"),
      k16: i18n.pick("下架"),
      k17: i18n.pick("標題"),
      k18: i18n.pick("內容"),
      k19: i18n.pick("類型"),
      k20: i18n.pick("置頂"),
      k21: i18n.pick("發布公告"),
      k22: i18n.pick("刪除"),
      k23: i18n.pick("新增活動"),
      k24: i18n.pick("活動名稱"),
      k25: i18n.pick("地點（可空）"),
      k26: i18n.pick("日期 YYYY-MM-DD"),
      k27: i18n.pick("名額（0 = 不限）"),
      k144: i18n.pick("開放組隊報名（隊長建隊拿 6 碼邀請碼）"),
      k28: i18n.pick("分組（可空，例：A組,B組）"),
      k29: i18n.pick("建立活動"),
      k30: i18n.pick("匯入 CSV"),
      k31: i18n.pick("正取"),
      k32: i18n.pick("候補"),
      k33: i18n.pick("剩餘"),
      k34: i18n.pick("取消"),
      k35: i18n.pick("候補全部轉正"),
      k36: i18n.pick("收起"),
      k37: i18n.pick("按「開始簽到」產生 6 位碼與 QR；學生在小程序掃碼就完成簽到。"),
      k38: i18n.pick("結束簽到"),
      k39: i18n.pick("統計"),
      k40: i18n.pick("簽到"),
      k41: i18n.pick("權限說明"),
      k42: i18n.pick("新增帳號"),
      k43: i18n.pick("帳號（登入用）"),
      k44: i18n.pick("密碼（至少 8 位）"),
      k45: i18n.pick("顯示名稱（可空）"),
      k46: i18n.pick("建立帳號"),
      k47: i18n.pick("搜尋帳號或名稱"),
      k48: i18n.pick("搜尋"),
      k49: i18n.pick("全部"),
      k50: i18n.pick("名稱"),
      k51: i18n.pick("登入帳號"),
      k52: i18n.pick("新密碼（不填就不改）"),
      k53: i18n.pick("留空＝維持原密碼"),
      k54: i18n.pick("等級"),
      k55: i18n.pick("儲存"),
      k56: i18n.pick("編輯"),
      k57: i18n.pick("重設密碼"),
      k58: i18n.pick("同等或更高權限，只能查看"),
      k59: i18n.pick("新增綁定"),
      k60: i18n.pick("家長帳號（先到使用者分頁把角色設為家長）"),
      k61: i18n.pick("學生學號，例如 3201201001"),
      k62: i18n.pick("綁定"),
      k63: i18n.pick("還沒有任何綁定"),
      k64: i18n.pick("上方填家長帳號與學生學號即可建立"),
      k65: i18n.pick("解除綁定"),
      k66: i18n.pick("沒有待處理檢舉"),
      k67: i18n.pick("待處理"),
      k68: i18n.pick("成立並下架"),
      k69: i18n.pick("駁回"),
      k70: i18n.pick("使用者手機上的白屏、閃退會自動出現在這裡"),
      k71: i18n.pick("沒有紀錄"),
      k72: i18n.pick("複製名單"),
      k73: i18n.pick("這個活動還沒有人報名"),
      k74: i18n.pick("日期"),
      k75: i18n.pick("餐別"),
      k76: i18n.pick("菜名（逗號分隔）"),
      k77: i18n.pick("例：葡式焗雞飯, 番茄蛋炒飯"),
      k78: i18n.pick("排入菜單"),
      k79: i18n.pick("移除"),
      k80: i18n.pick("這週還沒排菜"),
      k81: i18n.pick("把 CSV 貼在這裡，或按下面「選擇 CSV 檔」從聊天記錄挑一個"),
      k82: i18n.pick("選擇 CSV 檔"),
      k83: i18n.pick("先檢查"),
      k84: i18n.pick("確認匯入"),
      // v0.48.0 後台統計首頁（W-39）：第一屏五張數字卡
      // 注意：這裡的 key 一定要用「本檔還沒用過」的號碼 —— 舊版沿用 k100~k102，
      // 和上面出席名單的「（未設定）／已簽到／未簽到」撞號，後面的定義會靜默蓋掉前面的，
      // 結果簽到名單顯示成「累計／點卡片跳到對應分頁」。新增 key 前先 grep 一次最大號。
      k157: i18n.pick("本週概況"),
      k158: i18n.pick("累計"),
      k159: i18n.pick("點卡片跳到對應分頁"),
      // W-41：登入失敗鎖定（帳號層級，與 IP 限流互補）
      k160: i18n.pick(" · 已鎖定"),
      k161: i18n.pick("解除鎖定"),
      k162: i18n.pick("已解除鎖定"),
    };
  },

  data: {
    themeClass: appearance.themeClass(),
    theme,
    tabs: TABS,
    tab: 'stats',
    role: '',
    stats: { users: 0, items: { open: 0, claimed: 0, added7d: 0 }, claimsPending: 0, signups: { confirmed: 0, waitlist: 0 }, noticesActive: 0, ratings: { count: 0, avg: 0 } },
    // 第一屏五張數字卡：值與標籤在 loadStats 一起備好（WXML 不做運算）
    ovCards: [],
    ovPressed: -1,
    claims: [],
    items: [],
    itemStatus: 'OPEN',
    statusFilters: [
      { key: 'OPEN', label: i18n.pick('待認領') },
      { key: 'MATCHED', label: i18n.pick('已匹配') },
      { key: 'CLAIMED', label: i18n.pick('已認領') },
      { key: '', label: i18n.pick('全部') },
    ],
    // W-40 資源回收桶：公告與失物都是軟刪除，這裡看得到、可以還原
    trashType: 'all',
    trashFilters: [
      { key: 'all', label: i18n.pick('全部') },
      { key: 'notice', label: i18n.pick('公告') },
      { key: 'item', label: i18n.pick('失物') },
    ],
    trashRows: [],
    trashCounts: { notice: 0, item: 0, all: 0 },
    events: [],
    ci: null, // 現場簽到面板（老師／管理員）
    attendance: null,
    ciSending: false,
    evStats: null,
    eventId: '',
    signups: [],
    notice: { title: '', content: '', kind: 'NORMAL', isPinned: false },
    kinds: [
      { key: 'NORMAL', label: i18n.pick('一般') },
      { key: 'CALENDAR', label: i18n.pick('校曆') },
      { key: 'URGENT', label: i18n.pick('緊急') },
    ],
    meals: [
      { key: 'LUNCH', label: i18n.pick('午餐') },
      { key: 'SNACK', label: i18n.pick('小賣部') },
    ],
    menu: { date: '', mealType: 'LUNCH', names: '' },
    menuWeekStart: '',
    menuEntries: [],
    eventForm: { title: '', date: '', capacity: '20', location: '', groups: '' },
    teamsEnabled: false,
    creatingEvent: false,
    users: [],
    parents: [],
    relations: [
      { key: 'guardian', label: i18n.pick('監護人') },
      { key: 'father', label: i18n.pick('父親') },
      { key: 'mother', label: i18n.pick('母親') },
    ],
    parentForm: { parentAccount: '', studentAccount: '', relation: 'guardian' },
    creatingParent: false,
    roles: ROLES,
    userQuery: { q: '', role: '' },
    meLevel: 0,
    userForm: { account: '', password: '', nickname: '', role: 'STUDENT' },
    creatingUser: false,
    editingId: '',
    editForm: { nickname: '', account: '', password: '', role: 'STUDENT' },
    reports: [],
    errors: [],
    errStatus: 'OPEN',
    errFilters: [
      { key: 'OPEN', label: i18n.pick('待處理') },
      { key: 'RESOLVED', label: i18n.pick('已解決') },
    ],
    errSummary: { open: 0, total: 0, kinds: 0, last24h: 0 },
    // 推送紀錄（W-37）
    pushLogs: [],
    pushOk: 'all',
    pushChannel: '',
    pushFilters: [
      { key: 'all', label: i18n.pick('全部') },
      { key: 'failed', label: i18n.pick('只看失敗') },
    ],
    pushSummary: { total: 0, ok: 0, failed: 0, last24h: 0 },
    pushTplHint: '',
    audit: [],
    noticeList: [],
    showPerms: false,
    abilities: [],
    sending: false,
    hint: '',
    // 批次匯入（W-19）：同一塊面板依目前分頁決定匯入活動或菜單
    importType: '',
    importCsv: '',
    importHint: '',
    importResult: null,
    importChecked: false,
    importBusy: false,
    tabLoading: false,
    failed: false,
    errorText: '',
  },

  onLoad() {
    this.setData({ L: this.labels(), themeClass: appearance.themeClass() });
    let user = {};
    try {
      user = wx.getStorageSync(config.STORAGE_KEYS.user) || {};
    } catch (e) {
      user = {};
    }
    const role = user.role || '';
    // 後台入口＝這個角色至少有一個分頁（TEACHER / STAFF / ADMIN / SUPER_ADMIN）；其他一律踢回登入頁
    const allowed = ROLE_TABS[role] || [];
    if (!allowed.length) {
      wx.redirectTo({ url: '/pages/admin/login/index' });
      return;
    }
    this.setData({ role: role, 'menu.date': dateKey() });

    // 依能力決定看得到哪些分頁（真正的權限仍在後端）
    const tabs = TABS.filter((t) => allowed.indexOf(t.key) !== -1);
    this.setData({ tabs: tabs, tab: tabs[0].key });
    this.loadTab();
  },

  logout() {
    request.setToken('');
    wx.removeStorageSync(config.STORAGE_KEYS.user);
    wx.showToast({ title: i18n.pick('已登出'), icon: 'none' });
    setTimeout(() => wx.navigateBack(), 400);
  },

  switchTab(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ tab: key, hint: '' });
    this.loadTab();
  },

  loadTab() {
    const t = this.data.tab;
    this.setData({ tabLoading: true, failed: false, errorText: '' });

    let p = null;
    if (t === 'stats') p = this.loadStats();
    else if (t === 'claims') p = this.loadClaims();
    else if (t === 'items') p = this.loadItems();
    else if (t === 'trash') p = this.loadTrash();
    else if (t === 'export') p = this.loadEventsForExport();
    else if (t === 'events') p = this.loadEventsAdmin();
    else if (t === 'users') p = this.loadUsers();
    else if (t === 'parents') p = this.loadParents();
    else if (t === 'reports') p = this.loadReports();
    else if (t === 'errors') p = this.loadErrors();
    else if (t === 'push') p = this.loadPushLogs();
    else if (t === 'audit') p = this.loadAudit();
    else if (t === 'notice') p = this.loadNoticeList();
    else if (t === 'menu') p = this.loadMenuWeek();

    if (!p || typeof p.then !== 'function') {
      this.setData({ tabLoading: false });
      return p;
    }
    // 讀取類的 catch 一律寫成 hint「讀不到…」；這裡統一翻成失敗畫面（含重試），
    // 不要讓「後端掛掉」在畫面上長得像「後台沒有資料」。
    return p.then(() => {
      const hint = this.data.hint || '';
      const failed = hint.indexOf(i18n.pick('讀不到')) === 0;
      this.setData({ tabLoading: false, failed: failed, errorText: failed ? hint : '' });
    });
  },

  reloadTab() {
    this.loadTab();
  },

  async loadStats() {
    try {
      // 累計報表與「本週五張卡」一起打。第二支失敗不讓整頁變失敗畫面：
      // 卡片是加值資訊，累計數字才是後台原本就有的內容。
      const [stats, ov] = await Promise.all([admin.stats(), admin.statsOverview().catch(() => null)]);
      this.setData({ stats: stats, ovCards: this.buildOvCards(ov) });
    } catch (e) {
      this.setData({ hint: i18n.pick('讀不到數據：') + (e.message || e.code) });
    }
  },

  /**
   * 五張卡的值、標籤與跳轉目標一起算好。
   * 標籤不寫在 WXML 是因為它要跟著介面語言變；target 放這裡讓 WXML 只負責顯示，
   * 之後要改「點卡片去哪一頁」只改這一處。
   */
  buildOvCards(ov) {
    const o = ov || {};
    const n = (v) => (typeof v === 'number' ? v : 0);
    return [
      { key: 'usersNew7d', label: i18n.pick('本週新使用者'), value: n(o.usersNew7d), target: 'users' },
      { key: 'signups7d', label: i18n.pick('本週報名'), value: n(o.signups7d), target: 'export' },
      { key: 'claimsPending', label: i18n.pick('待審認領'), value: n(o.claimsPending), target: 'claims' },
      { key: 'errorsOpen', label: i18n.pick('未解決錯誤'), value: n(o.errorsOpen), target: 'errors' },
      { key: 'itemsOpen', label: i18n.pick('未認領失物'), value: n(o.itemsOpen), target: 'items' },
    ];
  },

  // 按壓回饋（Skyline 下 hover-class 不可靠）：按下 60ms、放開 180ms
  ovDown(e) {
    this.setData({ ovPressed: Number(e.currentTarget.dataset.i) });
  },
  ovUp() {
    if (this.data.ovPressed !== -1) this.setData({ ovPressed: -1 });
  },

  async loadClaims() {
    try {
      const res = await admin.claims('PENDING');
      this.setData({ claims: res.items || [] });
    } catch (e) {
      this.setData({ hint: i18n.pick('讀不到申請：') + (e.message || e.code) });
    }
  },

  async loadItems() {
    try {
      const res = await admin.items(this.data.itemStatus);
      this.setData({ items: res.items || [] });
    } catch (e) {
      this.setData({ hint: i18n.pick('讀不到失物：') + (e.message || e.code) });
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
      this.setData({ hint: i18n.pick('讀不到活動：') + (e.message || e.code) });
    }
  },

  filterItems(e) {
    this.setData({ itemStatus: e.currentTarget.dataset.key });
    this.loadItems();
  },

  // W-28：列印版（A4 黑白）——失物清單帶目前篩選、活動名單帶該場活動
  openPrint(e) {
    const { kind, id } = e.currentTarget.dataset;
    if (kind === 'event') {
      wx.navigateTo({ url: '/pages/print/event/index?id=' + id });
      return;
    }
    // 後台的 MATCHED 是內部狀態，公開清單只認 OPEN／CLAIMED／CLOSED，其餘一律印全部
    const printable = ['OPEN', 'CLAIMED', 'CLOSED'];
    const status = printable.indexOf(this.data.itemStatus) >= 0 ? this.data.itemStatus : '';
    wx.navigateTo({ url: '/pages/print/items/index?status=' + status });
  },

  async review(e) {
    const { id, ok } = e.currentTarget.dataset;
    try {
      await admin.reviewClaim(id, ok === '1');
      wx.showToast({ title: ok === '1' ? i18n.pick('已通過') : i18n.pick('已拒絕'), icon: 'success' });
      this.loadClaims();
    } catch (err) {
      wx.showToast({ title: err.message || i18n.pick('操作失敗'), icon: 'none' });
    }
  },

  async moderate(e) {
    const { id, act } = e.currentTarget.dataset;
    try {
      await admin.moderateItem(id, act);
      wx.showToast({ title: act === 'REMOVE' ? i18n.pick('已下架') : i18n.pick('已恢復'), icon: 'success' });
      this.loadItems();
    } catch (err) {
      wx.showToast({ title: err.message || i18n.pick('操作失敗'), icon: 'none' });
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
      wx.showToast({ title: i18n.pick('標題與內容都要填'), icon: 'none' });
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
        hint: i18n.pick('已發布：') + res.title + (res.pushed ? i18n.pick('，已推播 ') + res.pushed + i18n.pick(' 人') : ''),
      });
      wx.showToast({ title: i18n.pick('已發布'), icon: 'success' });
    } catch (e) {
      wx.showToast({ title: e.message || i18n.pick('發布失敗'), icon: 'none' });
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
      this.setData({ signups: [], hint: i18n.pick('讀不到名單：') + (e.message || e.code) });
    }
  },

  copySignups() {
    const lines = this.data.signups.map((s, i) =>
      `${i + 1}. ${s.nickname || i18n.pick('（未設定）')} ${s.grade || ''}${s.className || ''} — ${s.status === 'CONFIRMED' ? i18n.pick('正取') : i18n.pick('候補') + s.waitlistPos}`,
    );
    wx.setClipboardData({
      data: lines.join('\n'),
      success: () => wx.showToast({ title: i18n.pick('名單已複製'), icon: 'none' }),
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
      wx.showToast({ title: i18n.pick('日期與菜名都要填'), icon: 'none' });
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
      wx.showToast({ title: i18n.pick('已排入'), icon: 'success' });
    } catch (e) {
      wx.showToast({ title: e.message || i18n.pick('排菜單失敗'), icon: 'none' });
    } finally {
      this.setData({ sending: false });
    }
  },

  // ───────── 活動管理 ─────────
  async loadEventStats(e) {
    const id = e.currentTarget.dataset.id;
    try {
      const s = await admin.eventStats(id);
      this.setData({ evStats: s, eventId: id });
    } catch (err) {
      wx.showToast({ title: err.message || i18n.pick('讀不到統計'), icon: 'none' });
    }
  },

  closeEventStats() {
    this.setData({ evStats: null, eventId: '' });
  },

  async promoteAll() {
    const id = this.data.eventId;
    if (!id) return;
    try {
      const res = await admin.batchSignups(id, 'PROMOTE_ALL');
      wx.showToast({ title: i18n.pick('已轉正 ') + res.affected + i18n.pick(' 人'), icon: 'none' });
      this.loadEventStats({ currentTarget: { dataset: { id: id } } });
    } catch (err) {
      wx.showToast({ title: err.message || i18n.pick('操作失敗'), icon: 'none' });
    }
  },

  // ───────── 現場簽到（QR） ─────────
  async loadEventCheckin(e) {
    const id = e.currentTarget.dataset.id;
    try {
      this.setData({ ci: await admin.eventCheckin(id), attendance: null });
      this.loadAttendance();
    } catch (err) {
      wx.showToast({ title: err.message || i18n.pick('讀不到簽到狀態'), icon: 'none' });
    }
  },

  async loadAttendance() {
    const ci = this.data.ci;
    if (!ci) return;
    try {
      this.setData({ attendance: await admin.attendance(ci.eventId) });
    } catch (err) {
      wx.showToast({ title: err.message || i18n.pick('讀不到出席名單'), icon: 'none' });
    }
  },

  async openCheckin() {
    const ci = this.data.ci;
    if (!ci || this.data.ciSending) return;
    this.setData({ ciSending: true });
    try {
      this.setData({ ci: await admin.openEventCheckin(ci.eventId) });
      wx.showToast({ title: i18n.pick('已開放簽到'), icon: 'success' });
      this.loadAttendance();
    } catch (err) {
      wx.showToast({ title: err.message || i18n.pick('開不到簽到'), icon: 'none' });
    } finally {
      this.setData({ ciSending: false });
    }
  },

  async closeCheckin() {
    const ci = this.data.ci;
    if (!ci || this.data.ciSending) return;
    this.setData({ ciSending: true });
    try {
      this.setData({ ci: await admin.closeEventCheckin(ci.eventId) });
      wx.showToast({ title: i18n.pick('已結束簽到'), icon: 'none' });
    } catch (err) {
      wx.showToast({ title: err.message || i18n.pick('關不到簽到'), icon: 'none' });
    } finally {
      this.setData({ ciSending: false });
    }
  },

  async toggleAttendance(e) {
    const { id, on } = e.currentTarget.dataset;
    const ci = this.data.ci;
    if (!ci) return;
    try {
      const res = await admin.batchSignups(ci.eventId, on === '1' ? 'CHECK_IN' : 'CHECK_OUT', [id]);
      const rate = res.signed ? Math.round((res.checkedIn / res.signed) * 1000) / 10 : null;
      this.setData({ 'ci.checkedIn': res.checkedIn, 'ci.signed': res.signed, 'ci.rate': rate });
      wx.showToast({ title: on === '1' ? i18n.pick('已代簽') : i18n.pick('已撤銷代簽'), icon: 'none' });
      this.loadAttendance();
    } catch (err) {
      wx.showToast({ title: err.message || i18n.pick('操作失敗'), icon: 'none' });
    }
  },

  closeCheckinPanel() {
    this.setData({ ci: null, attendance: null });
  },

  // ───────── 批次匯入（CSV）─────────
  openImport(e) {
    const type = e && e.currentTarget && e.currentTarget.dataset.type === 'menu' ? 'menu' : 'events';
    const hint =
      type === 'events'
        ? i18n.pick('欄名：標題,開始時間,結束時間,地點,名額,組別,說明,狀態。時間寫成 2026-11-05 09:00；組別用逗號分隔時整格要加引號，例如 "甲組,乙組"。')
        : i18n.pick('欄名：日期,餐別,菜色。日期寫成 2026-11-05；餐別填 午餐 或 小食；同一餐多道菜用 | 分隔。');
    this.setData({ importType: type, importCsv: '', importResult: null, importChecked: false, importHint: hint });
  },

  closeImport() {
    this.setData({ importType: '', importCsv: '', importResult: null, importChecked: false });
  },

  onImportText(e) {
    this.setData({ importCsv: e.detail.value, importChecked: false });
  },

  /** 從微信聊天記錄選一個 CSV，讀成文字後貼進同一個輸入框（兩條入口共用一套驗證） */
  pickCsvFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['csv'],
      success: (res) => {
        const file = (res.tempFiles || [])[0];
        if (!file) return;
        try {
          const text = wx.getFileSystemManager().readFileSync(file.path, 'utf8');
          this.setData({ importCsv: String(text || ''), importResult: null, importChecked: false });
          wx.showToast({ title: i18n.pick('已讀入 ') + (file.name || 'CSV'), icon: 'none' });
        } catch (err) {
          wx.showToast({ title: i18n.pick('讀不到這個檔案'), icon: 'none' });
        }
      },
      fail: () => {
        // 使用者取消選擇不算錯誤
      },
    });
  },

  checkImport() {
    return this.runImport(true);
  },

  confirmImport() {
    if (!this.data.importChecked) {
      wx.showToast({ title: i18n.pick('請先按「先檢查」'), icon: 'none' });
      return Promise.resolve();
    }
    return this.runImport(false);
  },

  async runImport(dryRun) {
    if (this.data.importBusy) return;
    const csv = (this.data.importCsv || '').trim();
    if (!csv) {
      wx.showToast({ title: i18n.pick('先貼上或選 CSV'), icon: 'none' });
      return;
    }
    this.setData({ importBusy: true });
    try {
      const res =
        this.data.importType === 'menu' ? await admin.importMenu(csv, dryRun) : await admin.importEvents(csv, dryRun);
      // 只有「檢查過而且至少有一列寫得進去」才放行確認匯入
      this.setData({ importResult: res, importChecked: dryRun && res.success > 0 });
      wx.showToast({ title: dryRun ? i18n.pick('檢查完成') : i18n.pick('已匯入 ') + res.success + i18n.pick(' 筆'), icon: 'none' });
      if (!dryRun) this.reloadTab();
    } catch (e) {
      wx.showToast({ title: (e && e.message) || i18n.pick('匯入失敗'), icon: 'none' });
    } finally {
      this.setData({ importBusy: false });
    }
  },

  async loadEventsAdmin() {
    try {
      const res = await admin.events();
      this.setData({ events: res.items || [] });
    } catch (e) {
      this.setData({ hint: i18n.pick('讀不到活動：') + (e.message || e.code) });
    }
  },

  toggleEvTeams() {
    this.setData({ teamsEnabled: !this.data.teamsEnabled });
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
      wx.showToast({ title: i18n.pick('標題與日期必填'), icon: 'none' });
      return;
    }
    this.setData({ creatingEvent: true });
    try {
      const groups = (f.groups || '')
        .split(/[,，、]/)
        .map((x) => x.trim())
        .filter(Boolean);
      await admin.createEvent({
        title: f.title.trim(),
        location: f.location.trim() || undefined,
        startAt: new Date(f.date + 'T09:00:00').toISOString(),
        capacity: Number(f.capacity) || 0,
        status: 'PUBLISHED',
        groups: groups.length ? groups : undefined,
        teamsEnabled: this.data.teamsEnabled || undefined,
      });
      this.setData({ 'eventForm.title': '', 'eventForm.location': '', 'eventForm.groups': '', hint: i18n.pick('活動已建立') });
      wx.showToast({ title: i18n.pick('已建立'), icon: 'success' });
      this.loadEventsAdmin();
    } catch (e) {
      wx.showToast({ title: e.message || i18n.pick('建立失敗'), icon: 'none' });
    } finally {
      this.setData({ creatingEvent: false });
    }
  },

  async toggleEventStatus(e) {
    const { id, status } = e.currentTarget.dataset;
    const next = status === 'CANCELLED' ? 'PUBLISHED' : 'CANCELLED';
    try {
      await admin.updateEvent(id, { status: next });
      wx.showToast({ title: next === 'CANCELLED' ? i18n.pick('已取消') : i18n.pick('已恢復'), icon: 'success' });
      this.loadEventsAdmin();
    } catch (err) {
      wx.showToast({ title: err.message || i18n.pick('操作失敗'), icon: 'none' });
    }
  },

  // ───────── 家長綁定（P2）─────────
  async loadParents() {
    try {
      const res = await admin.parents({});
      this.setData({ parents: res.items || [], relations: res.relations || this.data.relations });
    } catch (e) {
      this.setData({ hint: i18n.pick('讀不到家長綁定：') + (e.message || e.code) });
    }
  },

  onParentField(e) {
    const patch = {};
    patch['parentForm.' + e.currentTarget.dataset.field] = e.detail.value;
    this.setData(patch);
  },

  pickRelation(e) {
    this.setData({ 'parentForm.relation': e.currentTarget.dataset.key });
  },

  async bindParent() {
    if (this.data.creatingParent) return;
    const f = this.data.parentForm;
    if (!f.parentAccount.trim() || !f.studentAccount.trim()) {
      wx.showToast({ title: i18n.pick('家長帳號與學生學號都要填'), icon: 'none' });
      return;
    }
    this.setData({ creatingParent: true });
    try {
      const res = await admin.linkParent(f.parentAccount.trim(), f.studentAccount.trim(), f.relation);
      this.setData({
        'parentForm.parentAccount': '',
        'parentForm.studentAccount': '',
        hint: i18n.pick('已綁定：') + res.parent.account + ' → ' + res.student.account,
      });
      wx.showToast({ title: i18n.pick('已綁定'), icon: 'success' });
      this.loadParents();
    } catch (e) {
      wx.showToast({ title: e.message || i18n.pick('綁定失敗'), icon: 'none' });
    } finally {
      this.setData({ creatingParent: false });
    }
  },

  unbindParent(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name || i18n.pick('這位學生');
    wx.showModal({
      title: i18n.pick('解除綁定'),
      content: i18n.pick('確定要解除與 ') + name + i18n.pick(' 的綁定？解除後家長就看不到這個孩子的資料。'),
      confirmText: i18n.pick('解除'),
      confirmColor: theme.danger,
      success: async (r) => {
        if (!r.confirm) return;
        try {
          await admin.unlinkParent(id);
          wx.showToast({ title: i18n.pick('已解除'), icon: 'success' });
          this.loadParents();
        } catch (err) {
          wx.showToast({ title: err.message || i18n.pick('解除失敗'), icon: 'none' });
        }
      },
    });
  },

  // ───────── 使用者管理 ─────────
  async loadUsers() {
    try {
      const q = this.data.userQuery;
      const res = await admin.users({ q: q.q || undefined, role: q.role || undefined });
      // roles 用後端回來的（帶 level 與 label，單一來源）；離線或舊後端才退回本地 ROLES
      const roles = (res.roles && res.roles.length) ? res.roles : ROLES;
      // W-41：最後登入時間換成本地時區、加上鎖定旗標（locked 由後端算，前端不比時間）
      const users = (res.items || []).map((u) => ({
        ...u,
        locked: Boolean(u.locked),
        lastLoginText: u.lastLoginAt ? dateTimeText(u.lastLoginAt) : '',
      }));
      this.setData({ users: users, meLevel: (res.me || {}).level || 0, roles: roles });
    } catch (e) {
      this.setData({ hint: i18n.pick('讀不到使用者：') + (e.message || e.code) });
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
      wx.showToast({ title: i18n.pick('帳號與密碼必填'), icon: 'none' });
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
      this.setData({ 'userForm.account': '', 'userForm.password': '', 'userForm.nickname': '', hint: i18n.pick('帳號已建立') });
      wx.showToast({ title: i18n.pick('已建立'), icon: 'success' });
      this.loadUsers();
    } catch (e) {
      wx.showToast({ title: e.message || i18n.pick('建立失敗'), icon: 'none' });
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
      wx.showToast({ title: i18n.pick('名稱與帳號都要填'), icon: 'none' });
      return;
    }
    const payload = { nickname: f.nickname.trim(), account: f.account.trim(), role: f.role };
    if (f.password) {
      if (f.password.length < 8) {
        wx.showToast({ title: i18n.pick('密碼至少 8 位'), icon: 'none' });
        return;
      }
      payload.password = f.password;
    }
    try {
      await admin.updateUser(this.data.editingId, payload);
      wx.showToast({ title: i18n.pick('已更新'), icon: 'success' });
      this.cancelEdit();
      this.loadUsers();
    } catch (e) {
      wx.showToast({ title: e.message || i18n.pick('更新失敗'), icon: 'none' });
    }
  },

  async resetPassword(e) {
    const id = e.currentTarget.dataset.id;
    const self = this;
    wx.showModal({
      title: i18n.pick('重設密碼'),
      editable: true,
      placeholderText: i18n.pick('輸入新密碼（至少 8 位）'),
      success(res) {
        if (!res.confirm || !res.content) return;
        if (res.content.length < 8) {
          wx.showToast({ title: i18n.pick('密碼至少 8 位'), icon: 'none' });
          return;
        }
        admin
          .resetPassword(id, res.content)
          .then(() => wx.showToast({ title: i18n.pick('已重設'), icon: 'success' }))
          .catch((err) => wx.showToast({ title: err.message || i18n.pick('重設失敗'), icon: 'none' }));
        void self;
      },
    });
  },

  async deleteUser(e) {
    const id = e.currentTarget.dataset.id;
    const account = e.currentTarget.dataset.account;
    const self = this;
    wx.showModal({
      title: i18n.pick('刪除帳號'),
      content: i18n.pick('刪除 ') + account + i18n.pick('？相關的認領／報名紀錄會一併清除。'),
      confirmColor: theme.danger,
      success(res) {
        if (!res.confirm) return;
        admin
          .deleteUser(id)
          .then(() => {
            wx.showToast({ title: i18n.pick('已刪除'), icon: 'success' });
            self.loadUsers();
          })
          .catch((err) => wx.showToast({ title: err.message || i18n.pick('刪除失敗'), icon: 'none' }));
      },
    });
  },

  async setRole(e) {
    const { id, role } = e.currentTarget.dataset;
    try {
      await admin.setRole(id, role);
      wx.showToast({ title: i18n.pick('已設為 ') + role, icon: 'success' });
      this.loadUsers();
    } catch (err) {
      wx.showToast({ title: err.message || i18n.pick('權限不足'), icon: 'none' });
    }
  },

  async toggleBan(e) {
    const { id, banned } = e.currentTarget.dataset;
    try {
      await admin.setBanned(id, banned !== '1');
      wx.showToast({ title: banned === '1' ? i18n.pick('已恢復') : i18n.pick('已停用'), icon: 'success' });
      this.loadUsers();
    } catch (err) {
      wx.showToast({ title: err.message || i18n.pick('操作失敗'), icon: 'none' });
    }
  },

  /** W-41：解除登入失敗鎖定（密碼錯太多次會鎖 15 分鐘） */
  async unlockUser(e) {
    const { id } = e.currentTarget.dataset;
    try {
      await admin.unlockUser(id);
      wx.showToast({ title: i18n.pick('已解除鎖定'), icon: 'success' });
      this.loadUsers();
    } catch (err) {
      wx.showToast({ title: err.message || i18n.pick('操作失敗'), icon: 'none' });
    }
  },

  // ───────── 檢舉 ─────────
  async loadReports() {
    try {
      const res = await admin.reports('PENDING');
      this.setData({ reports: res.items || [] });
    } catch (e) {
      this.setData({ hint: i18n.pick('讀不到檢舉：') + (e.message || e.code) });
    }
  },

  // ───────── 錯誤日誌（用戶端上報）─────────
  async loadErrors() {
    try {
      const res = await admin.errors(this.data.errStatus);
      const summary = res.summary || {};
      this.setData({
        errors: (res.items || []).map((e) =>
          Object.assign({}, e, {
            seenText: fromNow(e.lastSeenAt),
            firstSeenText: fromNow(e.firstSeenAt),
            // 「同類」＝同一句話（不限頁面）。指紋含頁面，所以同一支 API 在不同頁出錯會拆成好幾列
            similarText: e.similar > 1 ? i18n.pick('同類 ') + e.similar + i18n.pick(' 筆') : '',
          }),
        ),
        errSummary: summary,
      });
    } catch (e) {
      this.setData({ hint: i18n.pick('讀不到錯誤日誌：') + (e.message || e.code) });
    }
  },

  // ───────── 推送紀錄（W-37）─────────
  // 家長說「沒收到通知」時，這裡看得到是沒有同意過、沒有帳號，還是微信回了錯誤碼。
  async loadPushLogs() {
    try {
      const res = await admin.pushLogs(this.data.pushOk, this.data.pushChannel, 50);
      const t = res.templates || {};
      // 模板未設定＝這個場景根本不會發微信消息（不是發了失敗），要明講，不然會被誤判成 bug
      const missing = ['claim', 'event', 'notice'].filter((k) => !t[k]);
      const NAMES = { claim: i18n.pick('認領通過'), event: i18n.pick('活動提醒'), notice: i18n.pick('緊急公告') };
      const SCENES = {
        EVENT: i18n.pick('活動'),
        CLAIM: i18n.pick('認領'),
        NOTICE: i18n.pick('公告'),
        SYSTEM: i18n.pick('系統'),
        claim: i18n.pick('認領通過'),
        event: i18n.pick('活動提醒'),
        notice: i18n.pick('緊急公告'),
      };
      this.setData({
        pushLogs: (res.items || []).map((x) =>
          Object.assign({}, x, {
            timeText: fromNow(x.createdAt),
            nameText: x.nickname || i18n.pick('（已刪除的使用者）'),
            roleText: x.role ? role.label(x.role) : '',
            titleText: x.title || i18n.pick('（無標題）'),
            sceneText: SCENES[x.scene] || '',
            channelText: x.channel === 'WX' ? i18n.pick('微信') : i18n.pick('站內'),
            resultText: x.ok ? i18n.pick('已送出') : i18n.pick('失敗'),
            errorText: x.error || i18n.pick('未知原因'),
          }),
        ),
        pushSummary: res.summary || { total: 0, ok: 0, failed: 0, last24h: 0 },
        pushTplHint: missing.length
          ? i18n.pick('微信模板未設定：') + missing.map((k) => NAMES[k]).join(i18n.pick('、')) + i18n.pick('（這幾個場景不會發微信消息）')
          : i18n.pick('微信模板三個場景都已設定'),
      });
    } catch (e) {
      this.setData({ hint: i18n.pick('讀不到推送紀錄：') + (e.message || e.code) });
    }
  },

  pickPushOk(e) {
    this.setData({ pushOk: e.currentTarget.dataset.key });
    this.loadPushLogs();
  },

  pickPushChannel(e) {
    this.setData({ pushChannel: e.currentTarget.dataset.key });
    this.loadPushLogs();
  },

  // ── W-40 資源回收桶 ──
  /** 讀取被刪的公告／失物清單。deletedByName 後端已算好（公告讀 deletedBy、失物回推審計） */
  async loadTrash() {
    try {
      const res = await admin.trash(this.data.trashType);
      const TYPE = { notice: i18n.pick('公告'), item: i18n.pick('失物') };
      const KIND = {
        NORMAL: i18n.pick('一般公告'),
        URGENT: i18n.pick('緊急公告'),
        CALENDAR: i18n.pick('校曆'),
      };
      const ITEM_KIND = { LOST: i18n.pick('遺失'), FOUND: i18n.pick('拾獲') };
      this.setData({
        trashRows: (res.items || []).map((x) => {
          const sub =
            x.type === 'notice'
              ? KIND[x.subtitle] || ''
              : (ITEM_KIND[x.itemType] || '') + (x.subtitle ? ' · ' + x.subtitle : '');
          return {
            id: x.id,
            type: x.type,
            title: x.title,
            typeText: TYPE[x.type] || x.type,
            subText: sub,
            timeText: fromNow(x.deletedAt),
            deleterText: x.deletedByName || i18n.pick('（未記錄）'),
          };
        }),
        trashCounts: res.counts || { notice: 0, item: 0, all: 0 },
      });
    } catch (e) {
      this.setData({ hint: i18n.pick('讀不到垃圾桶：') + (e.message || e.code) });
    }
  },

  pickTrashType(e) {
    this.setData({ trashType: e.currentTarget.dataset.key });
    this.loadTab();
  },

  /** 還原：二次確認後才送出 —— 還原公告等於把它重新公開給全校 */
  restoreTrash(e) {
    const id = e.currentTarget.dataset.id;
    const type = e.currentTarget.dataset.type;
    const title = e.currentTarget.dataset.title || '';
    const self = this;
    wx.showModal({
      title: i18n.pick('還原這筆內容'),
      content: title ? i18n.pick('「') + title + i18n.pick('」會立刻恢復顯示，確定嗎？') : i18n.pick('還原後會立刻恢復顯示，確定嗎？'),
      success(res) {
        if (!res.confirm) return;
        admin
          .restoreTrash(type, id)
          .then(() => {
            wx.showToast({ title: i18n.pick('已還原'), icon: 'none' });
            self.loadTab();
          })
          .catch((err) => wx.showToast({ title: (err && err.message) || i18n.pick('還原失敗'), icon: 'none' }));
      },
    });
  },

  // 同類一次解決：把同一句話在「所有頁面」的錯誤一起標成已解決
  resolveSimilarErr(e) {
    const message = e.currentTarget.dataset.message;
    const self = this;
    wx.showModal({
      title: i18n.pick('同類一次解決'),
      content: i18n.pick('同一句話在不同頁面出現的錯誤會一起標記為已解決，確定嗎？'),
      success(res) {
        if (!res.confirm) return;
        admin
          .resolveSimilarErrors(message, '')
          .then((r) => {
            wx.showToast({ title: i18n.pick('已解決 ') + r.resolved + i18n.pick(' 筆'), icon: 'none' });
            self.loadErrors();
          })
          .catch((err) => wx.showToast({ title: err.message || i18n.pick('操作失敗'), icon: 'none' }));
      },
    });
  },

  // 清理舊紀錄：只刪「已解決」的，未解決的不動（刪待辦事項等於把 bug 藏起來）
  cleanupErrors() {
    const self = this;
    const days = [30, 90, 180];
    wx.showActionSheet({
      itemList: days.map((d) => d + i18n.pick(' 天前')),
      success(res) {
        const picked = days[res.tapIndex];
        if (!picked) return;
        wx.showModal({
          title: i18n.pick('清理舊紀錄'),
          content: i18n.pick('只會刪除 ') + picked + i18n.pick(' 天前已解決的紀錄，未解決的不會動。'),
          success(m) {
            if (!m.confirm) return;
            admin
              .cleanupErrors(picked, false)
              .then((r) => {
                const tail = r.kept ? i18n.pick('，保留 ') + r.kept + i18n.pick(' 筆未解決') : '';
                wx.showToast({ title: i18n.pick('已清理 ') + r.deleted + i18n.pick(' 筆') + tail, icon: 'none' });
                self.loadErrors();
              })
              .catch((err) => wx.showToast({ title: err.message || i18n.pick('操作失敗'), icon: 'none' }));
          },
        });
      },
    });
  },

  pickErrStatus(e) {
    this.setData({ errStatus: e.currentTarget.dataset.key });
    this.loadErrors();
  },

  async toggleErrStatus(e) {
    const { id, action } = e.currentTarget.dataset;
    try {
      await admin.setErrorStatus(id, action);
      wx.showToast({ title: action === 'RESOLVE' ? i18n.pick('已標記解決') : i18n.pick('已重新打開'), icon: 'none' });
      this.loadErrors();
    } catch (err) {
      wx.showToast({ title: err.message || i18n.pick('操作失敗'), icon: 'none' });
    }
  },

  async handleReport(e) {
    const { id, action } = e.currentTarget.dataset;
    try {
      const remove = action === 'RESOLVE';
      const res = await admin.handleReport(id, action, remove);
      wx.showToast({ title: action === 'RESOLVE' ? (res.removed ? i18n.pick('已成立並下架') : i18n.pick('已成立')) : i18n.pick('已駁回'), icon: 'none' });
      this.loadReports();
    } catch (err) {
      wx.showToast({ title: err.message || i18n.pick('操作失敗'), icon: 'none' });
    }
  },

  // ───────── 審計 ─────────
  async togglePerms() {
    const next = !this.data.showPerms;
    this.setData({ showPerms: next });
    if (next && !this.data.abilities.length) {
      try {
        const res = await admin.permissions();
        const labels = { STUDENT: i18n.pick('學生'), TEACHER: i18n.pick('老師'), ADMIN: i18n.pick('資訊管理員'), SUPER_ADMIN: i18n.pick('最高權限') };
        this.setData({ abilities: (res.abilities || []).map((a) => Object.assign({}, a, { allowedText: a.allowed.map((r) => labels[r] || r).join('、') })) });
      } catch (e) {
        this.setData({ hint: i18n.pick('讀不到權限表：') + (e.message || e.code) });
      }
    }
  },

  async loadAudit() {
    try {
      const res = await admin.audit(50);
      this.setData({ audit: res.items || [] });
    } catch (e) {
      this.setData({ hint: i18n.pick('讀不到審計紀錄：') + (e.message || e.code) });
    }
  },

  // ───────── 公告列表／刪除 ─────────
  async loadNoticeList() {
    try {
      const res = await admin.notices();
      this.setData({ noticeList: res.items || [] });
    } catch (e) {
      this.setData({ hint: i18n.pick('讀不到公告：') + (e.message || e.code) });
    }
  },

  async deleteNotice(e) {
    const id = e.currentTarget.dataset.id;
    const self = this;
    wx.showModal({
      title: i18n.pick('刪除公告'),
      content: i18n.pick('刪除後無法復原，確定嗎？'),
      success(res) {
        if (!res.confirm) return;
        admin
          .deleteNotice(id)
          .then(() => {
            wx.showToast({ title: i18n.pick('已刪除'), icon: 'success' });
            self.loadNoticeList();
          })
          .catch((err) => wx.showToast({ title: err.message || i18n.pick('刪除失敗'), icon: 'none' }));
      },
    });
  },

  async togglePin(e) {
    const { id, pinned } = e.currentTarget.dataset;
    try {
      await admin.updateNotice(id, { isPinned: pinned !== '1' });
      this.loadNoticeList();
    } catch (err) {
      wx.showToast({ title: err.message || i18n.pick('操作失敗'), icon: 'none' });
    }
  },

  // ───────── 菜單整週 ─────────
  async loadMenuWeek() {
    try {
      const res = await admin.menuWeek(this.data.menuWeekStart || undefined);
      this.setData({ menuWeekStart: res.weekStart, menuEntries: res.items || [] });
    } catch (e) {
      this.setData({ hint: i18n.pick('讀不到菜單：') + (e.message || e.code) });
    }
  },

  async deleteMenuEntry(e) {
    const id = e.currentTarget.dataset.id;
    try {
      await admin.deleteMenuEntry(id);
      wx.showToast({ title: i18n.pick('已移除'), icon: 'success' });
      this.loadMenuWeek();
    } catch (err) {
      wx.showToast({ title: err.message || i18n.pick('移除失敗'), icon: 'none' });
    }
  },
});