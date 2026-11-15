// 列印版 · 學生成績單（W-95 收尾）
//
// 三種身分共用同一頁（入口不同、資料來源不同、紙長得一樣）：
//  - 學生／職員：`/school/grades`＋`/school/attendance`（自己那一列）
//  - 家長：`/parents/me/children/:id/grades|attendance`（?child=<studentId>）
//  - 老師／資訊管理員：`/admin/school/grades?studentId=`（?studentId=，能力 school:manage）
//
// 紙永遠是白的：本頁強制 theme-light，深色模式下也是白底黑字（否則印出來是黑底）。
// 版面與統計都在 utils/transcriptSheet.js（純函式，由 scripts/check-transcript-print.cjs 驗）。
const data = require('../../../services/data');
const i18n = require('../../../utils/i18n');
const sheet = require('../../../utils/transcriptSheet');
const theme = require('../../../utils/theme');

Page({
  labels() {
    return {
      k01: i18n.pick('列印版 · 學生成績單'),
      k02: i18n.pick('學生成績單'),
      k03: i18n.pick('科目'),
      k04: i18n.pick('測驗'),
      k05: i18n.pick('日期'),
      k06: i18n.pick('分數'),
      k07: i18n.pick('列印時間'),
      k08: i18n.pick('列印預覽'),
      k09: i18n.pick('退出預覽'),
      k10: i18n.pick('存成圖片'),
      k11: i18n.pick('已存到相簿'),
      k12: i18n.pick('需要相簿權限'),
      k13: i18n.pick('請在設定開啟「儲存到相簿」後再試一次'),
      k14: i18n.pick('產生失敗'),
      k15: i18n.pick('載入失敗'),
      k16: i18n.pick('重試'),
      k17: i18n.pick('還沒有成績資料'),
      k18: i18n.pick('請先在「成績與出缺席」按「立即同步」，或請老師代為補登。'),
      k19: i18n.pick('這台裝置不支援'),
      k20: i18n.pick('正在產生圖片…'),
      k21: i18n.pick('培華校園助手 · 學生成績單'),
      k22: i18n.pick('學年'),
      k23: i18n.pick('姓名'),
      k24: i18n.pick('班別'),
      k25: i18n.pick('出缺席'),
      k26: i18n.pick('上課日'),
      k27: i18n.pick('出席'),
      k28: i18n.pick('遲到'),
      k29: i18n.pick('請假'),
      k30: i18n.pick('缺席'),
      k31: i18n.pick('出席率'),
      k32: i18n.pick('平均'),
      k33: i18n.pick('請先登入'),
      k34: i18n.pick('成績單要對應到你自己的帳號，所以要先登入。'),
      k35: i18n.pick('去登入'),
      k36: i18n.pick('共'),
      k37: i18n.pick(' 科'),
      k38: i18n.pick('學段'),
      k39: i18n.pick('沒有學年資料'),
      k40: i18n.pick('第一段'),
      k41: i18n.pick('第二段'),
      k42: i18n.pick('第三段'),
    };
  },

  data: {
    // 列印頁一律淺色：紙不會跟著手機變黑
    themeClass: 'theme-light',
    preview: false,
    loading: true,
    failed: false,
    needLogin: false,
    errorText: '',
    busy: false,
    empty: false,
    sheetTitle: '',
    studentLine: '',
    metaLine: '',
    years: [],
    yearTerm: '',
    sections: [],
    attendanceText: '',
    courseText: '',
    dateText: '',
    L: {},
  },

  onLoad(query) {
    // 入口參數一律解碼（實測課表列印頁：拿編碼後的班名去查 → 整張表空白）
    this._src = {
      studentId: sheet.decodeParam(query && query.studentId),
      childId: sheet.decodeParam(query && query.child),
      yearTerm: sheet.decodeParam(query && query.yearTerm),
    };
    this._raw = { grades: [], attendance: [], student: null };
    this.setData({ L: this.labels(), dateText: todayText() });
    this.load();
  },

  onShow() {
    // 語言可能在設定頁被改過，回來要重取文案（onLoad 不會再跑）
    this.setData({ L: this.labels(), themeClass: 'theme-light' });
  },

  retry() {
    return this.load();
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/admin/login/index' });
  },

  async load() {
    const request = require('../../../utils/request');
    // 沒登入就不要打 API（否則只會看到「載入失敗」，看不出其實是沒登入）
    if (!data.isDemo() && !request.getToken()) {
      this.setData({ loading: false, needLogin: true });
      return;
    }
    this.setData({ loading: true, failed: false, errorText: '', needLogin: false });
    try {
      const raw = await this.fetchAll();
      this._raw = raw;
      this.render(raw, this._src.yearTerm);
      this.setData({ loading: false, failed: false });
    } catch (e) {
      // token 過期 → 清掉並回「請先登入」，不要讓使用者以為系統壞了
      const code = (e && e.code) || '';
      if (code === 'UNAUTHORIZED' || code === 'UNAUTHENTICATED' || (e && e.statusCode === 401)) {
        try { request.setToken(''); } catch (err) { /* 清不掉不影響畫面 */ }
        this.setData({ loading: false, needLogin: true, failed: false });
        return;
      }
      const msg = data.messageOf(e);
      this.setData({ loading: false, failed: true, errorText: msg });
      try {
        const reporter = require('../../../utils/reporter');
        if (reporter && reporter.reportError) reporter.reportError('[print.transcript] ' + msg);
      } catch (err) { /* 上報失敗不影響畫面 */ }
    }
  },

  /** 依身分抓同一份資料（三條路徑都回同一個形狀） */
  async fetchAll() {
    const s = this._src;
    if (s.studentId) {
      const adminApi = require('../../../services/admin');
      const pair = await Promise.all([adminApi.schoolGrades(s.studentId), adminApi.schoolAttendance(s.studentId)]);
      return {
        grades: (pair[0] && pair[0].items) || [],
        attendance: (pair[1] && pair[1].items) || [],
        student: (pair[0] && pair[0].student) || (pair[1] && pair[1].student) || null,
      };
    }
    if (s.childId) {
      const triple = await Promise.all([
        data.parentChildGrades(s.childId),
        data.parentChildAttendance(s.childId),
        data.parentChildren().catch(() => null),
      ]);
      const kids = (triple[2] && triple[2].items) || [];
      const kid = kids.filter((x) => x.studentId === s.childId)[0] || null;
      return {
        grades: (triple[0] && triple[0].items) || [],
        attendance: (triple[1] && triple[1].items) || [],
        student: kid,
      };
    }
    const pair = await Promise.all([data.schoolGrades(), data.schoolAttendance()]);
    const me = await data.me().catch(() => null);
    return {
      grades: (pair[0] && pair[0].items) || [],
      attendance: (pair[1] && pair[1].items) || [],
      student: me,
    };
  },

  /**
   * 算畫面與圖片共用的內容。
   * 學年切換只重算，不重抓 —— 三支端點一次就把整份回傳（上限 500 筆），
   * 每切一次就打一次 API 只會讓家長在慢網路上等更久。
   */
  render(raw, yearTerm) {
    const L = this.labels();
    const built = sheet.build({
      grades: raw.grades,
      attendance: raw.attendance,
      yearTerm: yearTerm,
      termLabels: [L.k40, L.k41, L.k42],
    });
    const student = raw.student || {};
    const nameText = student.nickname || '';
    const classText = ((student.grade || '') + (student.className || '')) || '';
    const bits = [];
    if (nameText) bits.push(L.k23 + ' ' + nameText);
    if (classText) bits.push(L.k24 + ' ' + classText);
    const studentLine = bits.join(' · ') || L.k02;
    const metaLine = L.k22 + ' ' + (built.yearTerm || '—') + '　' + L.k07 + ' ' + this.data.dateText;
    const att = built.attendance;
    const attendanceText = [
      L.k26 + ' ' + att.total,
      L.k27 + ' ' + att.present,
      L.k28 + ' ' + att.late,
      L.k29 + ' ' + att.leave,
      L.k30 + ' ' + att.absent,
      L.k31 + ' ' + (att.rate === null ? '—' : att.rate + '%'),
    ].join(' · ');
    const courseCount = built.sections.reduce((n, sec) => n + sec.rows.length, 0);

    this.setData({
      years: built.years,
      yearTerm: built.yearTerm,
      sections: built.sections,
      empty: built.empty,
      sheetTitle: L.k02,
      studentLine: studentLine,
      metaLine: metaLine,
      attendanceText: attendanceText,
      courseText: L.k36 + ' ' + courseCount + L.k37,
    });
  },

  pickYear(e) {
    const y = e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.year;
    if (!y || y === this.data.yearTerm) return;
    this.render(this._raw, y);
  },

  togglePreview() {
    this.setData({ preview: !this.data.preview });
  },

  /**
   * 存成圖片：用「離屏 canvas」畫，不查節點。
   * Skyline 下 `NodesRef.fields({node:true})` 對不在屏的節點不回呼（實測卡在 loading），
   * `wx.createOffscreenCanvas`（2.16.1+，本專案下限 2.29.2）沒有這個問題。
   * 顏色全部從 utils/theme.js 取（canvas 不吃 var()），check-project 第 13 條會比對它與 tokens.wxss。
   */
  saveImage() {
    const L = this.labels();
    if (this.data.busy || this.data.empty) return;
    if (typeof wx.createOffscreenCanvas !== 'function') {
      wx.showToast({ title: L.k19, icon: 'none' });
      return;
    }

    this.setData({ busy: true });
    wx.showLoading({ title: L.k20, mask: true });

    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      if (this._watchdog) {
        clearTimeout(this._watchdog);
        this._watchdog = null;
      }
      wx.hideLoading();
      this.setData({ busy: false });
    };

    // 保險：任何一步沒有回呼都不能讓按鈕卡在 loading
    this._watchdog = setTimeout(() => {
      if (settled) return;
      done();
      wx.showToast({ title: L.k14, icon: 'none' });
    }, 8000);

    try {
      const att = this.data.attendanceText;
      const plan = sheet.plan(this.data.sections);
      const canvas = wx.createOffscreenCanvas({ type: '2d', width: plan.width, height: plan.height });
      const ctx = canvas.getContext('2d');
      sheet.draw(ctx, {
        plan: plan,
        title: L.k21,
        studentLine: this.data.studentLine,
        metaLine: this.data.metaLine,
        colLabels: { course: L.k03, type: L.k04, date: L.k05, score: L.k06 },
        sections: this.data.sections,
        attendanceLines: [L.k25 + ' ' + (this.data.yearTerm || ''), att],
        footNote: L.k21 + ' · ' + this.data.dateText,
        colors: {
          surface: theme.surface,
          ink: theme.ink,
          inkSoft: theme.inkSoft,
          rule: theme.rule,
        },
      });

      wx.canvasToTempFilePath({
        canvas: canvas,
        success: (r) => {
          wx.saveImageToPhotosAlbum({
            filePath: r.tempFilePath,
            success: () => {
              done();
              wx.showToast({ title: L.k11, icon: 'success' });
            },
            fail: () => {
              done();
              wx.showModal({ title: L.k12, content: L.k13, showCancel: false });
            },
          });
        },
        fail: () => {
          done();
          wx.showToast({ title: L.k14, icon: 'none' });
        },
      });
    } catch (e) {
      done();
      wx.showToast({ title: L.k14, icon: 'none' });
    }
  },
});

function todayText() {
  const d = new Date();
  const p2 = (n) => (n < 10 ? '0' + n : '' + n);
  return d.getFullYear() + '/' + p2(d.getMonth() + 1) + '/' + p2(d.getDate());
}
