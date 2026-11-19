const admin = require('../../../services/admin');
const data = require('../../../services/data');
const request = require('../../../utils/request');
const config = require('../../../config/config');
const roleLabel = require('../../../utils/role').label;

const i18n = require('../../../utils/i18n');

const appearance = require('../../../utils/appearance');

Page({
  labels() {
    return {
      // W-41：這兩條原本也用 k01/k02，被下面「登入／培華校園助手」蓋掉 →
      // 登入頁的兩步驗證欄位標籤顯示成「登入」、placeholder 顯示成「培華校園助手」。改獨立號碼。
      k12: i18n.pick("兩步驗證碼"),
      k13: i18n.pick("驗證器上的 6 位數字（或備用碼）"),
      k09: i18n.pick("已登入"),
      k10: i18n.pick("登入中…"),
      k11: i18n.pick("登入"),
      k01: i18n.pick("登入"),
      k02: i18n.pick("培華校園助手"),
      k03: i18n.pick("回首頁"),
      k04: i18n.pick("到設定管理帳號"),
      k05: i18n.pick("帳號"),
      k06: i18n.pick("例如 3201201001"),
      k07: i18n.pick("密碼"),
      k08: i18n.pick("請輸入密碼"),
      // 家校通帳密直接登入（不用微信授權、不用等管理員開帳號）
      k14: i18n.pick("校內帳號"),
      k15: i18n.pick("家校通"),
      k16: i18n.pick("家校通帳號"),
      k17: i18n.pick("請輸入家校通密碼"),
      k18: i18n.pick("用家校通登入"),
      k19: i18n.pick("用你在家校通的帳號密碼登入，不必用微信授權。"),
      k20: i18n.pick("登入後不會儲存你的家校通密碼。"),
      k21: i18n.pick("學校系統暫時連不上，可改用校內帳號"),
      k22: i18n.pick("家長用 pv 開頭或純數字帳號，學生用 s 開頭帳號；登入後會自動對應子女。"),
    };
  },

  data: {
    themeClass: appearance.themeClass(),
    canBack: false,   // v1.0.15：登入頁是第一頁時沒有「返回」（沒有上一頁可回）
    loggedIn: false,
    needCode: false,
    code: '',      // 已登入就只顯示「目前身分＋登出」，不再同時擺一份登入表單（使用者回報的怪畫面）
    account: '',
    password: '',
    // account＝校內帳號（openid／後台設定的密碼）；school＝直接輸入家校通帳密
    loginMode: 'account',
    schoolAccount: '',
    schoolPassword: '',
    pressedKey: '',
    submitting: false,
    error: '',
    currentRole: '',
    currentRoleText: '',
    currentName: '',
  },

  onLoad(options) {
    this.refreshCurrent();
    // v1.0.15：登入頁是小程式的第一頁。
    // 已經登入的人不該停在登入頁 → 直接進首頁（除非是從「切換帳號」帶 from=switch 進來的）。
    const from = (options && (options.from || options.reason)) || '';
    this._from = from;
    this.setData({ canBack: getCurrentPages().length > 1 });
    if (from !== 'switch' && request.getToken()) {
      wx.reLaunch({ url: '/pages/index/index' });
      return;
    }
    if (from === 'needLogin' || from === 'expired') {
      this.setData({ error: i18n.pick('請先登入才能使用培華校園助手') });
    }
  },

  onShow() {
    this.setData({ L: this.labels(), themeClass: appearance.themeClass() });
    // 從背景回來或換頁回來時，不要把上一次的「登入中…」帶進來
    if (this.data.submitting) this.setData({ submitting: false });
  },

  onUnload() {
    if (this._watchdog) clearTimeout(this._watchdog);
  },

  /// 看門狗：15 秒內沒有任何結果就自己收手（避免渲染層壞掉時永久卡在「登入中…」）
  armWatchdog() {
    this.disarmWatchdog();
    this._watchdog = setTimeout(() => {
      if (!this.data.submitting) return;
      this.setData({ submitting: false, error: i18n.pick('連線逾時（30 秒沒有回應），請檢查網路或後端狀態') });
      wx.showModal({ title: i18n.pick('登入逾時'), content: i18n.pick('30 秒內沒有收到後端回應。\n請確認網路，或到「資料來源」頁看後端位址是否正確。'), showCancel: false });
    }, 30000); // 家校通登入實測就 8.4 秒，加上同步可能要 12 秒；15 秒會在後端還在跑時就宣告逾時
  },

  disarmWatchdog() {
    if (this._watchdog) {
      clearTimeout(this._watchdog);
      this._watchdog = null;
    }
  },

  refreshCurrent() {
    let user = {};
    try {
      user = wx.getStorageSync(config.STORAGE_KEYS.user) || {};
    } catch (e) {
      user = {};
    }
    const role = user.role || '';
    this.setData({
      currentRole: role,
      currentRoleText: roleLabel(role),
      currentName: user.nickname || '',
      loggedIn: !!role && !!request.getToken(),
    });
  },

  /* ── 切換登入方式（校內帳號／家校通）── */
  setMode(e) {
    const mode = (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.mode) || 'account';
    if (mode !== 'account' && mode !== 'school') return;
    this.setData({ loginMode: mode, error: '', pressedKey: '' });
  },

  // 按壓回饋自己來（Skyline 下 hover-class 不可靠）
  pressIn(e) {
    const key = e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.mode;
    if (key) this.setData({ pressedKey: key });
  },

  pressOut() {
    if (this.data.pressedKey) this.setData({ pressedKey: '' });
  },

  onAccount(e) {
    this.setData({ account: e.detail.value, error: '' });
  },

  onPassword(e) {
    this.setData({ password: e.detail.value, error: '' });
  },

  onCode(e) {
    this.setData({ code: e.detail.value, error: '' });
  },

  onSchoolAccount(e) {
    this.setData({ schoolAccount: e.detail.value, error: '' });
  },

  onSchoolPassword(e) {
    this.setData({ schoolPassword: e.detail.value, error: '' });
  },

  // 原生 form 送出：值直接由表單回傳，即使 bindinput 沒觸發也拿得到
  onSubmit(e) {
    const v = (e && e.detail && e.detail.value) || {};
    const account = v.account || this.data.account;
    const password = v.password || this.data.password;
    const code = v.code || this.data.code;
    return this.doLogin(account, password, code);
  },

  onSubmitSchool(e) {
    const v = (e && e.detail && e.detail.value) || {};
    return this.doSchoolLogin(v.account || this.data.schoolAccount, v.password || this.data.schoolPassword);
  },

  async submit() {
    return this.doLogin(this.data.account, this.data.password, this.data.code);
  },

  async schoolSubmit() {
    return this.doSchoolLogin(this.data.schoolAccount, this.data.schoolPassword);
  },

  async doLogin(accountRaw, passwordRaw, codeRaw) {
    const account = String(accountRaw || '').trim();
    const password = String(passwordRaw || '');
    if (!account || !password) {
      this.setData({ error: i18n.pick('請填帳號與密碼') });
      return;
    }
    return this._login(account, password, String(codeRaw || '').trim());
  },

  async doSchoolLogin(accountRaw, passwordRaw) {
    const account = String(accountRaw || '').trim();
    const password = String(passwordRaw || '');
    if (!account || !password) {
      this.setData({ error: i18n.pick('請填家校通帳號與密碼') });
      return;
    }
    return this._loginSchool(account, password);
  },

  /** 登入成功後的共同收尾（兩條路徑都一樣：存 token、存身分、回首頁） */
  afterLogin(res) {
    request.setToken(res.token);
    wx.setStorageSync(config.STORAGE_KEYS.user, { nickname: res.nickname, role: res.role });
    // 登入後首頁要自己重抓：以前只有 navigateBack，首頁的 onShow 不會重跑 refresh，
    // 使用者看到的是「登入成功但畫面還是訪客狀態」（實測回報）。
    const app = getApp();
    if (app && app.globalData) app.globalData.needRefresh = true;
    wx.showToast({ title: i18n.pick('已登入'), icon: 'success' });
    // 家校通登入成功＝後端已經在伺服器那一邊同步完了（v1.0.2：登入即同步）。
    // 只有後端回報「沒拿到／逾時」才由手機再補一次，否則會變成登入後多等 8 秒重複抓同一份。
    if (res && res.source === 'school') {
      const sync = res.autoSync || {};
      if (!sync.ok) data.schoolRefresh(true).catch(() => {});
      else if (typeof sync.grades === 'number' || typeof sync.attendance === 'number') {
        const n = (sync.grades || 0) + (sync.attendance || 0);
        if (n > 0) setTimeout(() => wx.showToast({ title: i18n.pick('已同步 ') + n + i18n.pick(' 筆'), icon: 'none' }), 900);
      }
    }
    this.refreshCurrent();
    // v1.0.15：登入頁是第一頁 → 登入成功直接進首頁（不再 navigateBack，因為沒有上一頁可回）
    setTimeout(() => {
      if (getCurrentPages().length > 1) wx.navigateBack();
      else wx.reLaunch({ url: '/pages/index/index' });
    }, 400);
  },

  /** 失敗文案：代碼＋實際打的位址，否則「登入失敗」四個字無法判斷是網路、密碼還是權限 */
  errorHint(code, msg) {
    if (code === 'NETWORK' || code === 'TIMEOUT') {
      // 逾時 ≠ 連不到：學校系統忙的時候家校通本身就要 8 秒以上，
      // 一律說「連不到後端」會讓使用者以為網路斷了，其實只是慢。
      if (/timeout|超時|超时|lack of response/i.test(String(msg || ''))) {
        return i18n.pick('後端回應太慢（學校系統可能正在忙），請再試一次。') + '（' + config.API_BASE_URL + '）';
      }
      return msg + i18n.pick('（連不到後端：') + config.API_BASE_URL + '）';
    }
    if (code === 'RATE_LIMITED') {
      // 後端的訊息已帶「請 N 分鐘後再試」，直接沿用比前端再猜一個數字準
      return msg;
    }
    if (code === 'SCHOOL_UNAVAILABLE') return msg;
    return msg + '（' + code + '）';
  },

  async _login(account, password, code) {
    if (this.data.submitting) return;
    this.setData({ submitting: true, error: '' });
    this.armWatchdog();
    try {
      const res = await admin.login(account, password, code);
      this.afterLogin(res);
    } catch (e) {
      const code = (e && e.code) || 'UNKNOWN';
      const msg = (e && e.message) || i18n.pick('登入失敗');
      if (code === 'TOTP_REQUIRED' || code === 'TOTP_INVALID') {
        this.setData({ needCode: true });
      }
      const hint = this.errorHint(code, msg);
      this.setData({ error: hint });
      console.error('[admin-login]', code, msg);
      // 原生彈窗：即使頁面渲染層異常，使用者仍能看到失敗原因
      wx.showModal({ title: i18n.pick('登入未成功'), content: hint, showCancel: false });
    } finally {
      this.disarmWatchdog();
      this.setData({ submitting: false });
    }
  },

  /**
   * 家校通帳密直接登入：後端先向家校通驗證，通過才建／對應本系統帳號。
   * 失敗時「帳號不存在」與「密碼錯」是同一句話；學校系統掛掉（SCHOOL_UNAVAILABLE）
   * 會明講可以改用校內帳號，不會讓人以為是自己打錯密碼。
   * 成功時如果後端自動對應到子女（家長），要講出來 —— 否則家長不知道自己的資料在哪。
   */
  async _loginSchool(account, password) {
    if (this.data.submitting) return;
    this.setData({ submitting: true, error: '' });
    this.armWatchdog();
    try {
      const res = await admin.schoolLogin(account, password);
      const kids = (res && res.children) || [];
      const count = res && typeof res.linkedChildren === 'number' ? res.linkedChildren : kids.length;
      this.afterLogin(res);
      if (count) {
        setTimeout(() => wx.showToast({ title: i18n.pick('已對應子女：') + count + i18n.pick(' 位'), icon: 'none' }), 500);
      }
    } catch (e) {
      const code = (e && e.code) || 'UNKNOWN';
      const msg = (e && e.message) || i18n.pick('登入失敗');
      const hint = this.errorHint(code, msg);
      this.setData({ error: hint });
      console.error('[school-login]', code, msg);
      wx.showModal({ title: i18n.pick('登入未成功'), content: hint, showCancel: false });
    } finally {
      this.disarmWatchdog();
      this.setData({ submitting: false });
    }
  },

  goBack() {
    if (getCurrentPages().length > 1) wx.navigateBack();
    else wx.reLaunch({ url: '/pages/index/index' });
  },

  goSettings() {
    wx.navigateTo({ url: '/pages/settings/index' });
  },

  logout() {
    request.setToken('');
    wx.removeStorageSync(config.STORAGE_KEYS.user);
    this.setData({ currentRole: '', currentRoleText: '', currentName: '', loggedIn: false });
    wx.showToast({ title: i18n.pick('已登出'), icon: 'none' });
  },
});
