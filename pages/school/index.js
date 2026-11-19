const appearance = require('../../utils/appearance');
const i18n = require('../../utils/i18n');
const data = require('../../services/data');
const config = require('../../config/config');
const authGuard = require('../../utils/auth-guard');

/**
 * 成績與出缺席。
 *
 * 兩種身分共用同一頁（第 0 項「家長免綁定」的落地）：
 *  - 學生／職員：讀自己那一列（`/school/grades`），要先連結家校通才能同步。
 *  - 家長：家校通帳號登入時後端已自動對應子女，這裡只負責選子女 + 讀
 *    `/parents/me/children/:id/grades|attendance`。
 *
 * 家長的「連結家校通」仍然保留 —— 那是同步用的憑證（同步會寫在子女那一列），
 * 和「有沒有子女」是兩件事，所以畫面上分成 `children.length` 與 `credLinked` 兩個旗標。
 */
Page({
  data: {
    themeClass: appearance.themeClass(),
    loading: true,
    needLogin: false,
    failed: false,
    errorText: '',
    isParent: false,
    credLinked: false, // 有沒有存家校通帳密（同步的前提）
    children: [],
    activeChildId: '',
    tab: 'grades',
    account: '',
    password: '',
    linking: false,
    syncing: false,
    /** 分批同步還沒抓完的段數（0＝全部同步完成）。從 /school/status 的 pendingCells 來 */
    pendingCells: 0,
    status: null,
    grades: [],
    attendance: [],
    summary: { total: 0, late: 0, absent: 0 },
    // 家長：子女這一班的功課（唯讀；打勾是小孩自己打的）
    homework: [],
    hwStats: { total: 0, done: 0, todo: 0, overdue: 0 },
    hwText: '',
    hwNeedsClass: false,
    offlineText: '',
  },

  onLoad() {
    this.setData({ L: this.labels() });
    this.init();
  },

  onShow() {
    // v1.0.15：沒有登入不能用（小程式第一頁是登入頁，這裡擋分享連結與逾時）
    if (!authGuard.guard()) return;
    this.setData({ themeClass: appearance.themeClass() });
  },

  labels() {
    return {
      title: i18n.pick('成績與出缺席'),
      grades: i18n.pick('成績'),
      attendance: i18n.pick('出缺席'),
      link: i18n.pick('連結家校通'),
      linkHintTitle: i18n.pick('還沒抓到家校通資料'),
      linkHint: i18n.pick('用家校通帳號登入一次，系統就會自動連結並同步；小程式不提供解除，需要處理請找資訊管理員。'),
      account: i18n.pick('家校通帳號（學號）'),
      password: i18n.pick('家校通密碼'),
      sync: i18n.pick('立即同步'),
      syncChild: i18n.pick('同步子女成績'),
      unlink: i18n.pick('解除連結'),
      linked: i18n.pick('已連結'),
      emptyGrades: i18n.pick('還沒有成績資料，按「立即同步」抓取'),
      emptyGradesChild: i18n.pick('還沒有成績資料。可以先按「同步子女成績」。'),
      emptyAttend: i18n.pick('還沒有出缺席資料'),
      manual: i18n.pick('同步不到？可以在後台手動輸入，或請老師代為補登。'),
      printTranscript: i18n.pick('列印成績單'),
      manualTag: i18n.pick('手動補登'),
      needCreds: i18n.pick('請填帳號與密碼'),
      syncFail: i18n.pick('同步失敗'),
      syncedPrefix: i18n.pick('已同步 '),
      gradeUnit: i18n.pick(' 筆成績'),
      unlinkConfirm: i18n.pick('解除後會刪掉已儲存的帳密，已同步的成績與出缺席會保留。'),
      total: i18n.pick('上課日'),
      late: i18n.pick('遲到'),
      absent: i18n.pick('缺席／請假'),
      failTitle: i18n.pick('載入失敗'),
      needLoginTitle: i18n.pick('請先登入'),
      needLoginHint: i18n.pick('成績與出缺席要對應到你自己的帳號，所以要先登入。'),
      goLogin: i18n.pick('去登入'),
      failHint: i18n.pick('請稍後再試'),
      retry: i18n.pick('重試'),
      myChildren: i18n.pick('我的子女'),
      childUnit: i18n.pick(' 位'),
      noChildren: i18n.pick('還沒有對應到子女'),
      noChildrenHint: i18n.pick('用家長的家校通帳號登入後會自動對應子女；如果沒有，請聯絡學校。'),
      childNoSyncHint: i18n.pick('已自動對應子女，可以直接查看已同步的成績與出缺席。要抓取最新資料，請在下面用你自己的家校通帳號連結。'),
      viewing: i18n.pick('目前查看'),
      partialNote: i18n.pick('學校系統較慢，這次先同步一部分；下次同步會補齊。'),
      // 分批同步（W-66）：一次只抓一段時間預算內的資料，剩下靠「再按一次」續傳
      pendingPrefix: i18n.pick('還有 '),
      pendingSuffix: i18n.pick(' 段未同步，可再按一次繼續'),
      allSynced: i18n.pick('所有學年都已同步'),
      // 家長看子女功課（W-76 延伸）
      hwTab: i18n.pick('功課'),
      hwEmpty: i18n.pick('還沒有功課'),
      hwEmptyHint: i18n.pick('老師派了功課就會出現在這裡。'),
      hwNeedsClass: i18n.pick('孩子的帳號還沒有班級資料'),
      hwDone: i18n.pick('已交'),
      hwOverdue: i18n.pick('已逾期'),
      hwSummary: i18n.pick('未交 '),
      hwSummaryMid: i18n.pick(' · 逾期 '),
      hwSummaryEnd: i18n.pick(' · 已交 '),
      offline: i18n.pick('離線資料 · 上次更新'),
    };
  },

  /** 失敗卡的「重試」：重新讀連結狀態與資料 */
  goLogin() {
    wx.navigateTo({ url: '/pages/admin/login/index' });
  },

  retry() {
    this.setData({ loading: true, failed: false, errorText: '' });
    this.init();
  },

  /** 目前身分（讀 storage 的 role，與首頁／家長頁同一份快取） */
  cachedRole() {
    try {
      const u = wx.getStorageSync(config.STORAGE_KEYS.user) || {};
      return u.role || '';
    } catch (e) {
      return '';
    }
  },

  async init() {
    // 沒登入就不要打 API（否則只會看到「載入失敗」，看不出其實是沒登入）
    const request = require('../../utils/request');
    if (!request.getToken()) {
      this.setData({ loading: false, needLogin: true });
      return;
    }
    const isParent = this.cachedRole() === 'PARENT';
    try {
      // 家長要兩件事：有沒有存家校通帳密（同步用）＋ 有沒有自動對應到子女（看資料用）
      const results = await Promise.all([
        data.schoolStatus(),
        isParent ? data.parentChildren() : Promise.resolve({ items: [] }),
      ]);
      const st = results[0];
      const children = (results[1] && results[1].items) || [];
      this.setData({
        status: st,
        isParent,
        credLinked: !!(st && st.linked),
        // 分批同步：打開頁面就知道「還有幾段沒抓」，不用按了才發現
        pendingCells: (st && st.pendingCells) || 0,
        children,
        activeChildId: children.length ? children[0].studentId : '',
        loading: false,
        failed: false,
      });
      if (isParent ? children.length > 0 : !!(st && st.linked)) await this.loadAll();
    } catch (e) {
      // token 過期／失效：清掉並回到「請先登入」，不要讓使用者以為是系統壞了
      const code = (e && e.code) || '';
      if (code === 'UNAUTHORIZED' || code === 'UNAUTHENTICATED' || (e && e.statusCode === 401)) {
        try { request.setToken(''); } catch (err) { /* 清不掉也不影響畫面 */ }
        this.setData({ loading: false, needLogin: true, failed: false });
        return;
      }
      const msg = data.messageOf(e);
      this.setData({ loading: false, failed: true, errorText: msg });
      // 上報到後端錯誤記錄，這樣「載入失敗」不會只剩畫面上四個字（我隔天查得到真正原因）
      try {
        const reporter = require('../../utils/reporter');
        if (reporter && reporter.reportError) reporter.reportError('[school.init] ' + msg);
      } catch (err) { /* 上報失敗不影響畫面 */ }
    }
  },

  async loadAll() {
    data.offlineReset(); // W-98
    try {
      const childId = this.data.activeChildId;
      const pair = this.data.isParent
        ? await Promise.all([
          data.parentChildGrades(childId),
          data.parentChildAttendance(childId),
          data.parentChildHomework(childId).catch(() => null),
        ])
        : await Promise.all([data.schoolGrades(), data.schoolAttendance()]);
      const g = pair[0];
      const a = pair[1];
      const hw = pair[2] || null;
      const grades = (g.items || []).map((x) => ({ ...x, dateText: (x.testDate || '').slice(0, 10), scoreText: x.score === null || x.score === undefined ? '—' : String(x.score), manual: x.source === 'MANUAL' }));
      const attendance = (a.items || []).map((x) => ({
        ...x,
        dateText: (x.date || '').slice(0, 10),
        manual: x.source === 'MANUAL',
        statusText: x.amStatus === 'late' || x.isAmLate ? i18n.pick('遲到') : (x.amStatus === 'leave' ? i18n.pick('請假') : (x.amStatus === 'absent' ? i18n.pick('缺席') : i18n.pick('出席'))),
        tone: x.amStatus === 'leave' ? 'warning' : (x.amStatus === 'absent' ? 'danger' : (x.isAmLate ? 'warning' : 'success')),
      }));
      this.setData({ grades, attendance, summary: (a && a.summary) || { total: 0, late: 0, absent: 0 }, offlineText: data.offlineText(this.data.L.offline || '') });
      if (this.data.isParent) {
        const L = this.data.L;
        const hwItems = ((hw && hw.items) || []).map((x) => ({
          ...x,
          dueText: (x.dueAt || '').slice(0, 10).replace(/-/g, '/'),
          statusText: x.done ? (L.hwDone || '') : (x.overdue ? (L.hwOverdue || '') : ''),
          tone: x.done ? 'success' : (x.overdue ? 'danger' : 'neutral'),
        }));
        const st = (hw && hw.stats) || { total: 0, done: 0, todo: 0, overdue: 0 };
        this.setData({
          homework: hwItems,
          hwStats: st,
          hwNeedsClass: !!(hw && hw.needsClass),
          hwText: hwItems.length ? (L.hwSummary || '') + st.todo + (L.hwSummaryMid || '') + st.overdue + (L.hwSummaryEnd || '') + st.done : '',
        });
      }
    } catch (e) {
      this.setData({ failed: true, errorText: data.messageOf(e), offlineText: '' });
    }
  },

  /** 切換子女：換人就重抓，不要只換標題（否則畫面還是上一位的成績） */
  async pickChild(e) {
    const id = e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id;
    if (!id || id === this.data.activeChildId) return;
    this.setData({ activeChildId: id, grades: [], attendance: [], summary: { total: 0, late: 0, absent: 0 } });
    await this.loadAll();
  },

  pickTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab });
  },

  /**
   * 列印成績單（W-95）：同一頁服務學生／家長／老師 —— 這裡只負責帶「這是誰的」。
   * 家長帶 `child`（後端仍會用 parent_links 反查，不信前端），學生自己什麼都不帶。
   */
  openTranscript() {
    const childId = this.data.isParent ? this.data.activeChildId : '';
    const url = childId
      ? '/pages/print/transcript/index?child=' + encodeURIComponent(childId)
      : '/pages/print/transcript/index';
    wx.navigateTo({ url: url });
  },

  onAccount(e) { this.setData({ account: e.detail.value }); },
  onPassword(e) { this.setData({ password: e.detail.value }); },

  async link() {
    if (!this.data.account || !this.data.password) {
      wx.showToast({ title: this.data.L.needCreds, icon: 'none' });
      return;
    }
    this.setData({ linking: true });
    try {
      await data.schoolLink(this.data.account.trim(), this.data.password);
      this.setData({ credLinked: true, password: '', linking: false });
      wx.showToast({ title: i18n.pick('已連結'), icon: 'success' });
      await this.sync();
    } catch (e) {
      this.setData({ linking: false });
      wx.showToast({ title: data.messageOf(e), icon: 'none' });
    }
  },

  /**
   * 同步（分批）。
   *
   * 後端一次只抓「時間預算內」的段數（實測一次完整同步 44.5 秒、離 Vercel 60 秒上限
   * 只剩 15 秒），所以回傳會帶 `done` 與 `remaining`：
   *  - done=true → 全部學年都同步完了（游標已清空）；
   *  - done=false → 還有 N 段，畫面提示「可再按一次繼續」。
   * 刻意**不自動連發**：家長網路慢時連發只會排隊卡住，而且看不見進度。
   */
  async sync() {
    this.setData({ syncing: true });
    try {
      const r = this.data.isParent
        ? await data.parentChildSync(this.data.activeChildId)
        : await data.schoolSync();
      const pending = typeof r.remaining === 'number' ? r.remaining : 0;
      const from = (r.thisBatch && r.thisBatch.from) || '';
      const to = (r.thisBatch && r.thisBatch.to) || '';
      const batch = from && from !== to ? from + ' – ' + to : from;
      this.setData({ syncing: false, pendingCells: r.done ? 0 : pending });
      wx.showToast({ title: this.data.L.syncedPrefix + (r.grades || 0) + this.data.L.gradeUnit, icon: 'none' });
      if (!r.done) {
        // 有剩下才跳說明，不然每按一次都彈一輪太吵
        const head = batch ? this.data.L.syncedPrefix + batch + '；' : '';
        wx.showModal({
          title: this.data.L.sync,
          content: head + this.data.L.pendingPrefix + pending + this.data.L.pendingSuffix,
          showCancel: false,
        });
      }
      await this.loadAll();
    } catch (e) {
      this.setData({ syncing: false });
      wx.showModal({ title: this.data.L.syncFail, content: data.messageOf(e) + ' · ' + this.data.L.manual, showCancel: false });
    }
  },

  unlink() {
    wx.showModal({
      title: i18n.pick('解除連結'),
      content: this.data.L.unlinkConfirm,
      success: async (r) => {
        if (!r.confirm) return;
        try {
          await data.schoolUnlink();
          this.setData({ credLinked: false, status: null });
        } catch (e) {
          wx.showToast({ title: data.messageOf(e), icon: 'none' });
        }
      },
    });
  },
});
