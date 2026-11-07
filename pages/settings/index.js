const appearance = require('../../utils/appearance');
const i18n = require('../../utils/i18n');
const data = require('../../services/data');
const request = require('../../utils/request');
const config = require('../../config/config');
const roleLabel = require('../../utils/role').label;
const adminApi = require('../../services/admin');
const reporter = require('../../utils/reporter');

Page({
  labels() {
    return {
      k17: i18n.pick("已登入"),
      k18: i18n.pick(" · 示範模式"),
      k19: i18n.pick("離線示範資料"),
      k20: i18n.pick("校內後端"),
      k01: i18n.pick("設定"),
      k02: i18n.pick("帳號"),
      k03: i18n.pick("管理後台"),
      k04: i18n.pick("切換帳號"),
      k05: i18n.pick("登出"),
      k06: i18n.pick("登入"),
      k07: i18n.pick("教職員、家長、學生登入後才能報名或管理"),
      k08: i18n.pick("介面語言"),
      k09: i18n.pick("預設跟隨手機語言；只想看繁體或簡體可以在這裡鎖定。只影響介面文字，不動公告與貼文內容。"),
      k10: i18n.pick("外觀"),
      k11: i18n.pick("跟隨系統：手機切換深色時自動跟著變。"),
      k12: i18n.pick("資料來源"),
      k13: i18n.pick("關於"),
      k14: i18n.pick("版本"),
      k15: i18n.pick("學校"),
      k16: i18n.pick("澳門培華中學"),
      k30: i18n.pick("安全"),
      k31: i18n.pick("兩步驗證"),
      k32: i18n.pick("已開啟 · 備用碼"),
      k33: i18n.pick("組"),
      k34: i18n.pick("未開啟（建議資訊管理員開啟）"),
      k35: i18n.pick("開啟（產生密鑰）"),
      k36: i18n.pick("密鑰："),
      k37: i18n.pick("複製密鑰"),
      k38: i18n.pick("輸入驗證器上的 6 位數字"),
      k39: i18n.pick("確認中…"),
      k40: i18n.pick("確認開啟"),
      k41: i18n.pick("輸入登入密碼以關閉"),
      k42: i18n.pick("處理中…"),
      k43: i18n.pick("關閉兩步驗證"),
      k44: i18n.pick("備用碼（只顯示這一次，請抄下來或複製收好；每組只能用一次）"),
      k45: i18n.pick("複製全部"),
      k46: i18n.pick("我已保存"),
      k47: i18n.pick("未開啟（請在網頁後台設定）"),
      k48: i18n.pick("複製設定網址"),
      k51: i18n.pick("通知"),
      k52: i18n.pick("報名、候補、認領、活動改期的提醒"),
      k49: i18n.pick("使用說明"),
      k50: i18n.pick("依身分看操作步驟（學生／家長／老師／管理員）"),
      k53: i18n.pick("回報問題"),
      k54: i18n.pick("按鈕沒反應、畫面怪，寫一句話告訴管理員"),
      // ── W-102 我的資料（個資自主：自己的紀錄自己帶走）──
      k55: i18n.pick("我的資料"),
      k56: i18n.pick("成績"),
      k57: i18n.pick("出缺席"),
      k58: i18n.pick("借閱"),
      k59: i18n.pick("請假"),
      k60: i18n.pick("複製成 CSV 文字，貼到記事本或表格軟體就能存檔；只包含你自己的紀錄。"),
      k61: i18n.pick("已複製"),
      k62: i18n.pick("複製"),
      k63: i18n.pick("匯出中…"),
      k64: i18n.pick("匯出失敗"),
      k65: i18n.pick("列"),
      k66: i18n.pick("還沒有資料"),

    };
  },

  data: {
    theme: 'system',
    themeClass: appearance.themeClass(),
    localePref: 'system',
    // 選項文字由 options() 在 onShow 產生（含切換後的重算），這裡不重複一份
    themeOptions: [],
    localeOptions: [],
    loggedIn: false,
    user: {},
    roleText: '',
    isDemo: false,
    isStaff: false,
    apiBase: '',
    version: config.VERSION || '',
    statusBarHeight: 20,
    // W-22 兩步驗證
    tfaEnabled: false,
    tfaCodesLeft: 0,
    tfaSetup: null,        // { secret, otpauth, backupCodes }
    tfaBackupCodes: [],    // 啟用成功後要「只顯示一次」的備用碼
    tfaCode: '',
    tfaPassword: '',
    tfaBusy: false,
    tfa2faUrl: 'https://pui-va-campus-server.vercel.app/admin/2fa-ui',
    // W-102：正在匯出的那一類（四個按鈕共用一個鎖，避免連點疊出四份檔案）
    exporting: '',
  },

  onLoad() {
    let info = {};
    try {
      info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    } catch (e) {
      info = {};
    }
    this.setData({ statusBarHeight: info.statusBarHeight || 20, apiBase: request.apiBase() });
  },

  /** 外觀／語言選項的顯示字（切換後要重算，否則留在舊語言） */
  labelOptions() {
    return {
      themeOptions: [
        { key: 'system', label: i18n.pick('跟隨系統') },
        { key: 'light', label: i18n.pick('淺色') },
        { key: 'dark', label: i18n.pick('深色') },
      ],
      localeOptions: [
        { key: 'system', label: i18n.pick('跟隨系統') },
        { key: 'zh-Hant', label: i18n.pick('繁體') },
        { key: 'zh-Hans', label: i18n.pick('簡體') },
      ],
    };
  },

  onShow() {
    this.setData(Object.assign({ L: this.labels() }, this.labelOptions()));
    this.refresh();
    this.loadTwoFactor();
  },

  refresh() {
    let user = {};
    try {
      user = wx.getStorageSync(config.STORAGE_KEYS.user) || {};
    } catch (e) {
      user = {};
    }
    const role = user.role || '';
    this.setData({
      theme: appearance.getTheme(),
      themeClass: appearance.themeClass(),
      localePref: appearance.getLocalePref(),
      isDemo: data.isDemo ? data.isDemo() : false,
      loggedIn: !!role && !!request.getToken(),
      user,
      roleText: roleLabel(role),
      isStaff: ['SUPER_ADMIN', 'ADMIN', 'STAFF', 'TEACHER'].indexOf(role) >= 0,
      apiBase: request.apiBase(),
    });
  },

  async loadTwoFactor() {
    if (!this.data.isStaff) return;
    try {
      const r = await adminApi.twoFactorStatus();
      this.setData({ tfaEnabled: !!r.enabled, tfaCodesLeft: r.backupCodesLeft || 0 });
    } catch (e) {
      // 沒登入或權限不足時不顯示錯誤，保持頁面安靜
    }
  },

  async tfaBegin() {
    if (this.data.tfaBusy) return;
    this.setData({ tfaBusy: true });
    try {
      const r = await adminApi.twoFactorBegin();
      this.setData({ tfaSetup: r, tfaCode: '' });
      wx.showModal({
        title: i18n.pick('把密鑰加進驗證器'),
        content: i18n.pick('在驗證器 App 選「輸入設定金鑰」，貼上：') + '\n' + r.secret,
        showCancel: false,
      });
    } catch (e) {
      wx.showToast({ title: data.messageOf(e), icon: 'none' });
    } finally {
      this.setData({ tfaBusy: false });
    }
  },

  onTfaCode(e) {
    this.setData({ tfaCode: e.detail.value });
  },

  async tfaEnable() {
    if (this.data.tfaBusy) return;
    this.setData({ tfaBusy: true });
    try {
      const pending = (this.data.tfaSetup && this.data.tfaSetup.backupCodes) || [];
      await adminApi.twoFactorEnable(String(this.data.tfaCode || '').trim());
      // 備用碼只會出現這一次：留在畫面上給使用者抄／複製，並提示收好
      this.setData({ tfaSetup: null, tfaCode: '', tfaBackupCodes: pending });
      await this.loadTwoFactor();
      wx.showToast({ title: i18n.pick('已開啟兩步驗證'), icon: 'success' });
    } catch (e) {
      wx.showToast({ title: data.messageOf(e), icon: 'none' });
    } finally {
      this.setData({ tfaBusy: false });
    }
  },

  onTfaPassword(e) {
    this.setData({ tfaPassword: e.detail.value });
  },

  async tfaDisable() {
    if (this.data.tfaBusy) return;
    this.setData({ tfaBusy: true });
    try {
      await adminApi.twoFactorDisable(String(this.data.tfaPassword || ''));
      this.setData({ tfaPassword: '' });
      await this.loadTwoFactor();
      wx.showToast({ title: i18n.pick('已關閉兩步驗證'), icon: 'none' });
    } catch (e) {
      wx.showToast({ title: data.messageOf(e), icon: 'none' });
    } finally {
      this.setData({ tfaBusy: false });
    }
  },

  /**
   * W-102 個資自主：匯出自己的成績／出缺席／借閱／請假
   *
   * 小程序不能下載 CSV（`wx.openDocument` 不支援），所以走「複製內容」：
   * 使用者貼到記事本或表格軟體就能存檔，也不需要任何檔案權限。
   * 家長匯出的是綁定的那位子女 —— 後端用 parent_links 反查，前端不傳任何 id。
   */
  async exportMy(e) {
    const type = (e && e.currentTarget && e.currentTarget.dataset.type) || '';
    const L = this.data.L || {};
    if (!type || this.data.exporting) return;
    const nameOf = { grades: L.k56, attendance: L.k57, library: L.k58, leaves: L.k59 };
    this.setData({ exporting: type });
    try {
      const text = String((await data.myExport(type)) || '');
      const lines = text.replace(/^\uFEFF/, '').split('\r\n').filter((line) => line !== '');
      const count = Math.max(0, lines.length - 1);
      if (!count) {
        wx.showToast({ title: L.k66 || L.k64 || '', icon: 'none' });
        return;
      }
      await new Promise((resolve, reject) => {
        wx.setClipboardData({ data: text, success: resolve, fail: reject });
      });
      wx.showToast({ title: (L.k61 || '') + (nameOf[type] || '') + ' ' + count + (L.k65 || ''), icon: 'none' });
    } catch (err) {
      const msg = data.messageOf ? data.messageOf(err) : '';
      reporter.reportError('[settings.exportMy] ' + (msg || ''));
      wx.showToast({ title: L.k64 || '', icon: 'none' });
    } finally {
      this.setData({ exporting: '' });
    }
  },

  goNotifications() {
    wx.navigateTo({ url: '/pages/notifications/index' });
  },

  goHelp() {
    wx.navigateTo({ url: '/pages/help/index' });
  },

  /**
   * 回報問題（W-43）
   *
   * 「按鈕沒反應」這類問題不會拋錯，`app.onError` 收不到，只能讓使用者自己寫一句話。
   * 兩個刻意的地方：
   * ① 離線示範模式直接講明「不會送出」而不是假裝成功 —— 靜默降級會讓人分不清真假；
   * ② 失敗訊息帶錯誤碼與實際打的位址，否則是「回報失敗」四個字，誰都查不下去。
   */
  reportIssue() {
    if (this.data.isDemo) {
      wx.showModal({
        title: i18n.pick('目前是離線示範'),
        content: i18n.pick('示範模式不會把回報送到學校後端。要回報問題，請先到「資料來源」關掉示範資料。'),
        showCancel: false,
      });
      return;
    }

    wx.showModal({
      title: i18n.pick('回報問題'),
      editable: true,
      placeholderText: i18n.pick('例如：活動詳情的報名按鈕按下去沒反應'),
      success: (res) => {
        if (!res.confirm) return;
        const text = String(res.content || '').trim();
        if (text.length < 3) {
          wx.showToast({ title: i18n.pick('請多寫幾個字，方便管理員重現'), icon: 'none' });
          return;
        }
        this.sendIssue(text);
      },
    });
  },

  async sendIssue(text) {
    const payload = Object.assign({ message: text.slice(0, 300) }, reporter.devicePayload());
    try {
      const r = await data.reportIssue(payload);
      if (r && r.demo) {
        wx.showToast({ title: i18n.pick('示範模式沒有送出'), icon: 'none' });
        return;
      }
      wx.showToast({ title: i18n.pick('已送出，謝謝你的回報'), icon: 'success' });
    } catch (e) {
      const code = (e && (e.code || e.codeName)) || 'ERROR';
      const msg = (e && e.message) || '';
      wx.showModal({
        title: i18n.pick('回報沒有送出'),
        content: msg + '（' + code + '）\n' + i18n.pick('後端：') + request.apiBase(),
        showCancel: false,
      });
    }
  },

  copy2faUrl() {
    wx.setClipboardData({ data: this.data.tfa2faUrl });
  },

  copyBackupCodes() {
    const codes = this.data.tfaBackupCodes || [];
    if (!codes.length) return;
    wx.setClipboardData({ data: codes.join('\n') });
  },

  hideBackupCodes() {
    this.setData({ tfaBackupCodes: [] });
  },

  copySecret() {
    if (!this.data.tfaSetup) return;
    wx.setClipboardData({ data: this.data.tfaSetup.secret });
  },

  pickTheme(e) {
    const v = e.currentTarget.dataset.key;
    appearance.setTheme(v);
    this.setData({ theme: appearance.getTheme(), themeClass: appearance.themeClass() });
    wx.showToast({ title: i18n.pick('外觀已更新'), icon: 'none' });
  },

  pickLocale(e) {
    const v = e.currentTarget.dataset.key;
    appearance.setLocalePref(v);
    // i18n 的 storage 與偏好共用 pv_locale：'system' 代表跟隨系統
    try {
      wx.setStorageSync(config.STORAGE_KEYS.locale || 'pv_locale', v);
    } catch (err) {
      /* ignore */
    }
    i18n.setLocale(v === 'system' ? appearance.systemLocale() : v);
    this.setData(Object.assign({ localePref: v, L: this.labels() }, this.labelOptions()));
    wx.showToast({ title: i18n.pick('語言已切換'), icon: 'none' });
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/admin/login/index' });
  },

  goAdmin() {
    wx.navigateTo({ url: '/pages/admin/index/index' });
  },

  goDev() {
    wx.navigateTo({ url: '/pages/dev/api-check/index' });
  },

  logout() {
    request.setToken('');
    try {
      wx.removeStorageSync(config.STORAGE_KEYS.user);
    } catch (e) {
      /* ignore */
    }
    this.refresh();
    wx.showToast({ title: i18n.pick('已登出'), icon: 'none' });
  },

  back() {
    if (getCurrentPages().length > 1) wx.navigateBack();
    else wx.reLaunch({ url: '/pages/index/index' });
  },
});
