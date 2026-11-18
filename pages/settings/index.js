const appearance = require('../../utils/appearance');
const i18n = require('../../utils/i18n');
const data = require('../../services/data');
const request = require('../../utils/request');
const config = require('../../config/config');
const roleLabel = require('../../utils/role').label;
const adminApi = require('../../services/admin');
const reporter = require('../../utils/reporter');

/**
 * W-110 訂閱校曆的天數（30／90／180）。存 storage：重新編譯、換頁再回來都還在。
 * 刻意只給三個選項而不是自由輸入：日曆看多遠是「習慣」不是「參數」，
 * 三個夠用，也不會有人填 100000 天讓後端每次抓整個學年。
 */
const CAL_DAYS_KEY = 'pv_cal_days';
const CAL_DAYS = [30, 90, 180];

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
      // ── v1.0.7 校曆：直接給學校那條 webcal 網址（不用生成）；個人行程收在「進階」──
      k600: i18n.pick("學校日曆訂閱網址"),
      k601: i18n.pick("按一下複製，貼進手機日曆的「加入訂閱行事曆」就會自己更新（iPhone：行事曆 → 底部「行事曆」→「加入行事曆」→「加入訂閱行事曆」）。這條是學校公開的日曆，全校同一條，不含個人資料。"),
      k602: i18n.pick("收起"),
      k603: i18n.pick("只訂閱我的行程（進階）"),
      // ── W-109 訂閱校曆（把校曆放進手機內建日曆）──
      k67: i18n.pick("訂閱校曆"),
      k68: i18n.pick("校曆訂閱"),
      k69: i18n.pick("未開啟。產生一組網址，貼進手機日曆的「訂閱行事曆」就好。"),
      k70: i18n.pick("已開啟。日曆 App 每隔幾小時會自己回來更新，不必再打開小程序。"),
      k71: i18n.pick("產生網址"),
      k72: i18n.pick("已開啟"),
      k73: i18n.pick("複製訂閱網址"),
      k74: i18n.pick("複製"),
      k75: i18n.pick("重新產生"),
      k76: i18n.pick("舊網址會立刻失效"),
      k77: i18n.pick("停止訂閱"),
      k78: i18n.pick("撤銷"),
      k79: i18n.pick("這條網址等於一把鑰匙：只給自己的裝置用，不要貼到群組。重新產生或停止訂閱之後，舊網址立刻失效。"),
      k80: i18n.pick("示範模式沒有真的日曆網址，關掉示範資料後再產生。"),
      k81: i18n.pick("產生中…"),
      k82: i18n.pick("已複製訂閱網址"),
      // ── W-110 訂閱範圍（天數）＋借閱／借用也在日曆裡 ──
      k83: i18n.pick("訂閱範圍"),
      k84: i18n.pick("日曆上要看多遠。改完不必重新產生網址，日曆 App 下次抓取就換成新的範圍。"),
      k85: i18n.pick("30 天"),
      k86: i18n.pick("90 天"),
      k87: i18n.pick("180 天"),

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
    // W-109 訂閱校曆：權杖狀態與忙碌鎖（產生／重新產生／撤銷共用）
    calToken: { enabled: false, path: null },
    calUrl: '',
    calBusy: false,
    // W-110 訂閱範圍（天數）：30／90／180 三選一，預設 90
    calDays: 90,
    calDayOptions: [],
    // v1.0.7：學校日曆就一條固定網址，貼上就用；個人行程訂閱收在「進階」裡
    publicCal: config.PUBLIC_CALENDAR_URL || '',
    calAdvanced: false,
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
      calDayOptions: [
        { key: 30, label: i18n.pick('30 天') },
        { key: 90, label: i18n.pick('90 天') },
        { key: 180, label: i18n.pick('180 天') },
      ],
    };
  },

  onShow() {
    this.setData(Object.assign({ L: this.labels(), calDays: this.calDaysPref() }, this.labelOptions()));
    this.refresh();
    this.loadTwoFactor();
    // v1.0.7：校曆只給學校那條公開網址，不再問個人權杖（後端端點與方法保留，但頁面不再用）。
    // 會員若之前產生過權杖，舊網址仍然有效，只是這裡不再顯示。
    this.setData({ calToken: { enabled: false, path: null }, calUrl: '', calAdvanced: false });
  },

  /**
   * v1.0.7：複製學校日曆網址。
   * 使用者定案「直接給這條，貼上就好，不用額外生成」——所以沒有「產生」按鈕，
   * 也不需要後端權杖：這是學校已發布的 iCloud 公開日曆，全校共用同一條。
   */
  copyPublicCalendar() {
    const url = this.data.publicCal;
    if (!url) {
      wx.showToast({ title: i18n.pick('沒有設定日曆網址'), icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: url,
      success: () => wx.showToast({ title: i18n.pick('已複製，貼進日曆的「訂閱行事曆」'), icon: 'none' }),
    });
  },

  /** 進階區（只訂閱自己的行程：報名／假單／功課截止／還書）預設收起，避免一般學生看到一堆名詞 */
  toggleCalAdvanced() {
    const next = !this.data.calAdvanced;
    this.setData({ calAdvanced: next });
    if (next && this.data.loggedIn && !this.data.calToken.enabled && !this.data.calBusy) {
      // 展開時才去問狀態；沒開啟就維持「未開啟」，不要自動產生（使用者明確說不要額外生成）
      this.loadCalendarToken();
    }
  },

  /** W-110 訂閱範圍：讀 storage，只認 30／90／180，其餘一律回 90 */
  calDaysPref() {
    try {
      const v = Number(wx.getStorageSync(CAL_DAYS_KEY));
      if (CAL_DAYS.indexOf(v) !== -1) return v;
    } catch (e) {
      // 讀不到用預設
    }
    return 90;
  },

  /** 換天數：權杖不變，只是換一條帶 `days=` 的網址 */
  async pickCalDays(e) {
    const key = Number((e && e.currentTarget && e.currentTarget.dataset.key) || 0);
    if (CAL_DAYS.indexOf(key) === -1 || key === this.data.calDays || this.data.calBusy) return;
    this.setData({ calDays: key, calBusy: true });
    try {
      wx.setStorageSync(CAL_DAYS_KEY, key);
      this.applyCalendarToken(await data.calendarToken(key));
    } catch (err) {
      // 讀不到就留在原本的範圍：這一列只是顯示設定，不該為它彈錯
      reporter.reportError('[settings.pickCalDays] ' + (data.messageOf ? data.messageOf(err) : ''));
      this.setData({ calDays: this.calDaysPref() });
    } finally {
      this.setData({ calBusy: false });
    }
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

  /**
   * W-109 訂閱校曆：把「全校公告與活動 ＋ 我的報名／假單／功課截止」放進手機內建日曆。
   *
   * 為什麼是網址而不是檔案：日曆 App 訂閱一份網址之後會自己回來更新（每幾小時），
   * 而 `.ics` 下載一次就永遠停在那一刻。代價是網址裡帶著權杖，所以它必須能一鍵撤銷 ——
   * 這也是「重新產生」要讓舊網址立刻失效的原因。
   */
  async loadCalendarToken() {
    try {
      const r = await data.calendarToken(this.data.calDays || 90);
      this.applyCalendarToken(r);
    } catch (e) {
      // 讀不到就維持「未開啟」：這一列只是設定頁的一個選項，不該為它彈錯
      this.setData({ calToken: { enabled: false, path: null }, calUrl: '' });
    }
  },

  applyCalendarToken(r) {
    const info = r || {};
    const path = info.path ? String(info.path) : '';
    const base = String(request.apiBase() || '').replace(/\/+$/, '');
    const days = CAL_DAYS.indexOf(Number(info.days)) !== -1 ? Number(info.days) : this.data.calDays || 90;
    if (days !== this.data.calDays) {
      try {
        wx.setStorageSync(CAL_DAYS_KEY, days);
      } catch (e) {
        // storage 不可用只影響下次開啟時的預設值
      }
    }
    this.setData({
      calToken: { enabled: !!info.enabled, path: path },
      calDays: days,
      // 示範模式產生的網址指不到任何東西，不要讓它看起來像真的可以訂閱
      calUrl: info.enabled && path && !this.data.isDemo ? base + path : '',
    });
  },

  /** 第一次產生（已開啟時不做事：重新產生是另一顆按鈕，要按的人明確知道舊網址會失效） */
  async ensureCalendarToken() {
    if (this.data.calBusy) return;
    if (this.data.calToken && this.data.calToken.enabled) return;
    this.setData({ calBusy: true });
    try {
      this.applyCalendarToken(await data.rotateCalendarToken(this.data.calDays || 90));
    } catch (e) {
      reporter.reportError('[settings.calendarToken] ' + (data.messageOf ? data.messageOf(e) : ''));
      wx.showToast({ title: data.messageOf(e), icon: 'none' });
    } finally {
      this.setData({ calBusy: false });
    }
  },

  async rotateCalendarToken() {
    if (this.data.calBusy) return;
    const L = this.data.L || {};
    const ok = await this.confirmCalendar(L.k75 || '', L.k76 || '');
    if (!ok) return;
    this.setData({ calBusy: true });
    try {
      this.applyCalendarToken(await data.rotateCalendarToken(this.data.calDays || 90));
    } catch (e) {
      reporter.reportError('[settings.calendarRotate] ' + (data.messageOf ? data.messageOf(e) : ''));
      wx.showToast({ title: data.messageOf(e), icon: 'none' });
    } finally {
      this.setData({ calBusy: false });
    }
  },

  async revokeCalendarToken() {
    if (this.data.calBusy) return;
    const L = this.data.L || {};
    const ok = await this.confirmCalendar(L.k77 || '', L.k76 || '');
    if (!ok) return;
    this.setData({ calBusy: true });
    try {
      await data.revokeCalendarToken();
      this.setData({ calToken: { enabled: false, path: null }, calUrl: '' });
    } catch (e) {
      reporter.reportError('[settings.calendarRevoke] ' + (data.messageOf ? data.messageOf(e) : ''));
      wx.showToast({ title: data.messageOf(e), icon: 'none' });
    } finally {
      this.setData({ calBusy: false });
    }
  },

  copyCalendarUrl() {
    const url = String(this.data.calUrl || '');
    if (!url) return;
    const L = this.data.L || {};
    wx.setClipboardData({
      data: url,
      success: () => wx.showToast({ title: L.k82 || '', icon: 'none' }),
    });
  },

  /** 一律用原生 showModal：自製的「再按一次」在 Skyline 下第二次點擊落不到同一顆按鈕 */
  confirmCalendar(title, content) {
    return new Promise((resolve) => {
      wx.showModal({
        title: String(title || ''),
        content: String(content || ''),
        success: (res) => resolve(!!(res && res.confirm)),
        fail: () => resolve(false),
      });
    });
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
