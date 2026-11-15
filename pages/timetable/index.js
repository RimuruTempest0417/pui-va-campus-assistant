const data = require('../../services/data');
const i18n = require('../../utils/i18n');
const appearance = require('../../utils/appearance');

/**
 * 班級課表（W-73）
 *
 * 兩個檢視：今天（預設，含「現在這一節」高亮）與整週。
 * 判斷「哪一班、第幾節、下一節」全部在後端算好 —— 前端不重算時區，
 * 所以手機時間設錯也不會顯示錯的節次。
 */

Page({
  labels() {
    return {
      k01: i18n.pick('班級課表'),
      k02: i18n.pick('今天'),
      k03: i18n.pick('整週'),
      k04: i18n.pick('現在'),
      k05: i18n.pick('下一節'),
      k06: i18n.pick('今天不用上課'),
      k07: i18n.pick('週末愉快，星期一見。'),
      k08: i18n.pick('這一天沒有課'),
      k09: i18n.pick('還沒有這個班的課表'),
      k10: i18n.pick('請找校務處匯入，或登入後看自己班上的課表。'),
      k11: i18n.pick('載入失敗'),
      k12: i18n.pick('重試'),
      k13: i18n.pick('載入中…'),
      k14: i18n.pick('第'),
      k15: i18n.pick('節'),
      k16: i18n.pick('今天沒有下一節了'),
      k17: i18n.pick('列印／存成圖片'),
      k18: i18n.pick('離線資料 · 上次更新'),
    };
  },

  data: {
    themeClass: appearance.themeClass(),
    loading: true,
    failed: false,
    errorText: '',
    mode: 'today',
    className: '',
    weekdayLabel: '',
    dateText: '',
    schoolDay: true,
    dayOffReason: '',
    dayOffDesc: '',
    todaySlots: [],
    groups: [],
    currentPeriod: 0,
    nextPeriod: 0,
    nextText: '',
    offlineText: '',
    L: {},
  },

  onLoad() {
    this.setData({ L: this.labels() });
    this.load();
  },

  onShow() {
    this.setData({ L: this.labels(), themeClass: appearance.themeClass() });
  },

  async load() {
    this.setData({ loading: true });
    data.offlineReset(); // W-98
    try {
      const today = await data.timetableToday();
      const week = await data.timetable({ className: today.className });
      const L = this.data.L;
      const reason = today.dayOffReason || '';
      const groups = [];
      (week.weekdays || []).forEach((day) => {
        const slots = (week.slots || [])
          .filter((slot) => slot.weekday === day.weekday)
          .map((slot) => Object.assign({}, slot, { periodText: (L.k14 || '') + slot.period + (L.k15 || '') }));
        groups.push({ weekday: day.weekday, label: day.label, slots: slots });
      });
      this.setData({
        loading: false,
        failed: false,
        className: today.className || '',
        weekdayLabel: today.weekdayLabel || '',
        dateText: (today.date || '').replace(/-/g, '/'),
        schoolDay: today.schoolDay !== false,
        dayOffReason: reason,
        // 停課有原因就寫原因（校曆公告／全校活動），週末才用「週末愉快」
        dayOffDesc: reason || L.k07 || '',
        todaySlots: (today.slots || []).map((slot) =>
          Object.assign({}, slot, { periodText: (L.k14 || '') + slot.period + (L.k15 || '') }),
        ),
        groups: groups,
        currentPeriod: today.current ? today.current.period : 0,
        nextPeriod: today.next ? today.next.period : 0,
        nextText: today.nextText || '',
        offlineText: data.offlineText(L.k18 || ''),
      });
    } catch (e) {
      this.setData({ loading: false, failed: true, errorText: data.messageOf(e), offlineText: '' });
    }
  },

  switchMode(e) {
    this.setData({ mode: e.currentTarget.dataset.key });
  },

  retry() {
    this.load();
  },

  /** W-83：把整週課表交給列印頁（紙上版＋存成圖片） */
  openPrint() {
    if (!this.data.className) return;
    wx.navigateTo({
      url: '/pages/print/timetable/index?className=' + encodeURIComponent(this.data.className),
    });
  },
});
