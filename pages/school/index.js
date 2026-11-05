const appearance = require('../../utils/appearance');
const i18n = require('../../utils/i18n');
const data = require('../../services/data');
const config = require('../../config/config');

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
    status: null,
    grades: [],
    attendance: [],
    summary: { total: 0, late: 0, absent: 0 },
  },

  onLoad() {
    this.setData({ L: this.labels() });
    this.init();
  },

  onShow() {
    this.setData({ themeClass: appearance.themeClass() });
  },

  labels() {
    return {
      title: i18n.pick('成績與出缺席'),
      grades: i18n.pick('成績'),
      attendance: i18n.pick('出缺席'),
      link: i18n.pick('連結家校通'),
      linkHint: i18n.pick('用你自己的家校通帳號登入（學校系統），只會讀你自己的資料；帳密加密儲存，可以隨時解除。'),
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
      viewing: i18n.pick('目前查看'),
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
    try {
      const childId = this.data.activeChildId;
      const pair = this.data.isParent
        ? await Promise.all([data.parentChildGrades(childId), data.parentChildAttendance(childId)])
        : await Promise.all([data.schoolGrades(), data.schoolAttendance()]);
      const g = pair[0];
      const a = pair[1];
      const grades = (g.items || []).map((x) => ({ ...x, dateText: (x.testDate || '').slice(0, 10), scoreText: x.score === null || x.score === undefined ? '—' : String(x.score), manual: x.source === 'MANUAL' }));
      const attendance = (a.items || []).map((x) => ({
        ...x,
        dateText: (x.date || '').slice(0, 10),
        manual: x.source === 'MANUAL',
        statusText: x.amStatus === 'late' || x.isAmLate ? i18n.pick('遲到') : (x.amStatus === 'leave' ? i18n.pick('請假') : (x.amStatus === 'absent' ? i18n.pick('缺席') : i18n.pick('出席'))),
        tone: x.amStatus === 'leave' ? 'warning' : (x.amStatus === 'absent' ? 'danger' : (x.isAmLate ? 'warning' : 'success')),
      }));
      this.setData({ grades, attendance, summary: (a && a.summary) || { total: 0, late: 0, absent: 0 } });
    } catch (e) {
      this.setData({ failed: true, errorText: data.messageOf(e) });
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

  async sync() {
    this.setData({ syncing: true });
    try {
      const r = this.data.isParent
        ? await data.parentChildSync(this.data.activeChildId)
        : await data.schoolSync();
      this.setData({ syncing: false });
      wx.showToast({ title: this.data.L.syncedPrefix + (r.grades || 0) + this.data.L.gradeUnit, icon: 'none' });
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
