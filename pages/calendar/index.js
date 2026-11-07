const data = require('../../services/data');
const cal = require('../../utils/calendar');
const tl = require('../../utils/calendarTimeline');
const study = require('../../utils/study');
const i18n = require('../../utils/i18n');

const appearance = require('../../utils/appearance');

/**
 * 校曆（v0.21.0）＋ 整合時間軸（W-100）。
 *
 * 兩個檢視用同一份資料（`data.calendar()` ＋ `data.externalCalendar()`，
 * 加上 `utils/study.upcomingExams` 從同一批來源算出的測驗）：
 *   月視圖 —— 42 格固定版面，選一天看那天的事
 *   時間軸 —— 由今天起 60 天，同一天把公告（含假期）、活動、外部校曆、測驗排在一起
 * 沒有新端點、沒有新頁面：時間軸只是同一份資料的第二種視圖。
 */

const TIMELINE_DAYS = 60;

Page({
  data: {
    themeClass: appearance.themeClass(),
    loading: true,
    failed: false,
    errorText: '',
    year: 0,
    month: 0,
    monthText: '',
    weekdays: [i18n.pick('一'), i18n.pick('二'), i18n.pick('三'), i18n.pick('四'), i18n.pick('五'), i18n.pick('六'), i18n.pick('日')],
    cells: [],
    selected: '',
    selectedText: '',
    items: [],
    L: {
      title: '',
      today: '',
      empty: '',
      emptyDesc: '',
      event: '',
      notice: '',
      calendar: i18n.pick('校曆'),
      urgent: i18n.pick('緊急'),
      school: i18n.pick('校曆表'),
      monthUnit: i18n.pick('月'),
      dayUnit: i18n.pick('日'),
      weekPrefix: i18n.pick('週'),
    },
    externalCount: 0,
    sources: [],          // W-23：外部校曆來源（[{label,count,ok}]）
    sourceFilter: 'ALL',  // 'ALL' 或某個來源標籤
    sourceChips: [],
    // W-100 整合時間軸
    mode: 'month',        // 'month' | 'timeline'
    tlDays: [],
    tlTotal: 0,
    tlRangeText: '',
    pressedKey: '',
  },

  onLoad() {
    const now = new Date();
    this.setData({
      L: this.labels(), themeClass: appearance.themeClass(),              // 以前漏了這行 → 「今天」按鈕文字是空的，只剩一個紫色方塊
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      selected: cal.dateKey(now),
      selectedText: i18n.t('cal.today'),
    });
    this.load();
  },

  onShow() {
    // 回來時重新套一次標籤（使用者可能在自檢頁切了繁／簡）
    this.setData({ L: this.labels(), themeClass: appearance.themeClass() });
    if (this._loadedOnce) this.load();
    this._loadedOnce = true;
  },

  async load() {
    try {
      const res = await data.calendar();
      // 外部校曆（學校／個人 iCloud 發布的 ICS）：取前一年到後一年，月切換不必再打
      const year = new Date().getFullYear();
      const ext = await data
        .externalCalendar({ from: year - 1 + '-01-01', to: year + 1 + '-12-31' })
        .catch(function () {
          return { items: [] };
        });
      this._external = (ext && ext.items) || [];
      // W-23：多來源時提供「全部／各來源」篩選（只有一個來源就不顯示 chips）
      const sources = (ext && ext.sources) || [];
      const chips = sources.length > 1
        ? [{ key: 'ALL', label: i18n.pick('全部來源') }].concat(sources.map(function (s) { return { key: s.label, label: s.label }; }))
        : [];
      if (this.data.sourceFilter !== 'ALL' && !sources.some((s) => s.label === this.data.sourceFilter)) {
        this.setData({ sourceFilter: 'ALL' });
      }
      this.setData({ sources: sources, sourceChips: chips });
      const filtered = this.data.sourceFilter === 'ALL'
        ? this._external
        : this._external.filter((e) => e.source === this.data.sourceFilter);
      const grouped = cal.mergeExternal(cal.groupByDate(res.notices, res.events), filtered);
      this._grouped = grouped;

      // W-100：時間軸多一種來源（測驗）。用同一批 cal／ext 資料算，不另外打 API、
      // 也不重寫考試日期的規則 —— 那是 utils/study.upcomingExams 的既有邏輯。
      const now = new Date();
      const exams = study.upcomingExams(
        {
          events: (res && res.events) || [],
          notices: (res && res.notices) || [],
          external: filtered,
        },
        now,
        { horizonDays: 120 }
      );
      this._timeline = tl.buildTimeline(
        { notices: (res && res.notices) || [], events: (res && res.events) || [], external: filtered },
        { from: now, days: TIMELINE_DAYS, exams: exams }
      );

      this.render();
      this.setData({ loading: false, failed: false, errorText: '', externalCount: this._external.length });
    } catch (e) {
      this.setData({ loading: false, failed: true, errorText: data.messageOf(e), cells: [], items: [], tlDays: [] });
      wx.showToast({ title: data.messageOf(e), icon: 'none' });
    }
  },

  pickSource(e) {
    const key = e.currentTarget.dataset.key;
    if (key === this.data.sourceFilter) return;
    this.setData({ sourceFilter: key });
    this.load();
  },

  retry() {
    this.setData({ loading: true, failed: false, errorText: '' });
    return this.load();
  },

  /** 月視圖／時間軸切換（按壓回饋自己管，不用 hover-class：Skyline 下它不可靠） */
  switchMode(e) {
    const mode = e.currentTarget.dataset.mode;
    if (!mode || mode === this.data.mode) return;
    this.setData({ mode: mode, pressedKey: '' });
  },

  pressIn(e) {
    const key = e.currentTarget.dataset.id;
    if (key && key !== this.data.pressedKey) this.setData({ pressedKey: key });
  },

  pressOut() {
    if (this.data.pressedKey) this.setData({ pressedKey: '' });
  },

  /** 點時間軸的日期標題 → 切回月視圖並選中那天（不新增頁面，兩種看法指向同一批事） */
  jumpToDay(e) {
    const key = e.currentTarget.dataset.key;
    if (!key) return;
    const parts = key.split('-');
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    if (!y || !m) return;
    this.setData({
      mode: 'month',
      year: y,
      month: m,
      selected: key,
      selectedText: key === cal.dateKey(new Date()) ? i18n.t('cal.today') : key.slice(5).replace('-', ' / '),
      pressedKey: '',
    });
    this.render();
  },

  render() {
    const g = this._grouped || {};
    const cells = cal.monthSummary(cal.monthGrid(this.data.year, this.data.month), g);
    const dayItems = (g[this.data.selected] || []).map((it, i, arr) => this.decorateRow(it, i === arr.length - 1));
    this.setData({
      cells: cells,
      monthText: cal.monthLabel(this.data.year, this.data.month),
      items: dayItems,
      tlDays: this.decorateTimeline(),
      tlTotal: (this._timeline && this._timeline.total) || 0,
      tlRangeText: this.rangeText(),
    });
  },

  /** 一列的顯示欄位（兩個檢視共用；規則在 utils/calendarTimeline.decorate，可被 Node 直接測） */
  decorateRow(raw, last) {
    const L = this.data.L || this.labels();
    return tl.decorate(
      raw,
      {
        notice: L.notice,
        urgent: L.urgent,
        exam: L.k15,
        event: L.event,
        school: L.school,
        calendar: L.calendar,
      },
      last
    );
  },

  decorateTimeline() {
    const raw = this._timeline;
    if (!raw || !Array.isArray(raw.list)) return [];
    const L = this.data.L || this.labels();
    return raw.list.map((d) => {
      const rows = d.items.map((it, i, arr) => this.decorateRow(it, i === arr.length - 1));
      return {
        key: d.key,
        label: d.month + L.monthUnit + d.day + L.dayUnit,
        weekdayText: L.weekPrefix + this.data.weekdays[(d.weekday || 1) - 1],
        badge: d.daysLeft === 0 ? L.k13 : d.daysLeft === 1 ? L.k14 : '',
        count: d.count,
        tone: d.tone,
        items: rows,
      };
    });
  },

  rangeText() {
    const raw = this._timeline;
    if (!raw || typeof raw.from !== 'string' || typeof raw.to !== 'string') return '';
    const L = this.data.L || this.labels();
    const from = new Date(raw.from + 'T00:00:00');
    const to = new Date(raw.to + 'T00:00:00');
    const fmt = (d) => d.getMonth() + 1 + L.monthUnit + d.getDate() + L.dayUnit;
    return fmt(from) + ' – ' + fmt(to);
  },

  labels() {
    return {
      k03: i18n.pick("校曆"),
      k04: i18n.pick(" 項安排"),
      k01: i18n.pick("載入失敗"),
      k02: i18n.pick("重試"),
      k10: i18n.pick("月視圖"),
      k11: i18n.pick("時間軸"),
      k12: i18n.pick("未來 60 天"),
      k13: i18n.pick("今天"),
      k14: i18n.pick("明天"),
      k15: i18n.pick("測驗"),
      k19: i18n.pick("這段時間沒有安排"),
      k20: i18n.pick("老師還沒有在校曆加入活動、公告或考試；新增之後這裡會自動出現。"),
      k21: i18n.pick("這項來自學校校曆，沒有站內詳情"),
      k22: i18n.pick("想用月曆看？點上面的日期就會切回月視圖。"),
      k23: i18n.pick(" 項"),
      title: i18n.t('cal.title'),
      today: i18n.t('cal.today'),
      empty: i18n.t('cal.empty'),
      emptyDesc: i18n.t('cal.emptyDesc'),
      event: i18n.t('cal.event'),
      notice: i18n.t('cal.notice'),
      calendar: i18n.t('common.calendar'),
      school: i18n.t('cal.school'),
      urgent: i18n.t('home.urgent'),
      monthUnit: i18n.pick("月"),
      dayUnit: i18n.pick("日"),
      weekPrefix: i18n.pick("週"),
    };
  },

  prevMonth() {
    const { year, month } = this.data;
    const m = month === 1 ? 12 : month - 1;
    const y = month === 1 ? year - 1 : year;
    this.setData({ year: y, month: m });
    this.render();
  },

  nextMonth() {
    const { year, month } = this.data;
    const m = month === 12 ? 1 : month + 1;
    const y = month === 12 ? year + 1 : year;
    this.setData({ year: y, month: m });
    this.render();
  },

  goToday() {
    const now = new Date();
    this.setData({
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      selected: cal.dateKey(now),
      selectedText: i18n.pick('今天'),
    });
    this.render();
  },

  selectDay(e) {
    const key = e.currentTarget.dataset.key;
    const cell = (this.data.cells || []).filter((c) => c.key === key)[0];
    this.setData({
      selected: key,
      selectedText: cell && cell.isToday ? i18n.t('cal.today') : key.slice(5).replace('-', ' / '),
      items: ((this._grouped || {})[key] || []).map((it, i, arr) => this.decorateRow(it, i === arr.length - 1)),
    });
  },

  openItem(e) {
    const ds = e.currentTarget.dataset;
    const nav = ds.nav || '';
    const ref = ds.ref || ds.id;
    if (nav === 'event' && ref) {
      wx.navigateTo({ url: '/pages/events/detail/index?id=' + ref });
      return;
    }
    if (nav === 'notice' && ref) {
      wx.navigateTo({ url: '/pages/notices/detail/index?id=' + ref });
      return;
    }
    // 外部校曆（學校 ICS）沒有站內詳情頁：明講原因，不要按了完全沒反應
    wx.showToast({ title: (this.data.L && this.data.L.k21) || '', icon: 'none' });
  },
});
