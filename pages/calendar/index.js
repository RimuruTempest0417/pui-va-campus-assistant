const data = require('../../services/data');
const cal = require('../../utils/calendar');
const i18n = require('../../utils/i18n');

const appearance = require('../../utils/appearance');

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
    L: { title: '', today: '', empty: '', emptyDesc: '', event: '', notice: '', calendar: i18n.pick('校曆'), urgent: i18n.pick('緊急'), school: i18n.pick('校曆表') },
    externalCount: 0,
    sources: [],          // W-23：外部校曆來源（[{label,count,ok}]）
    sourceFilter: 'ALL',  // 'ALL' 或某個來源標籤
    sourceChips: [],
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
      this.render(grouped);
      this.setData({ loading: false, failed: false, errorText: '', externalCount: this._external.length });
    } catch (e) {
      this.setData({ loading: false, failed: true, errorText: data.messageOf(e), cells: [], items: [] });
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

  render(grouped) {
    const g = grouped || this._grouped || {};
    const cells = cal.monthSummary(cal.monthGrid(this.data.year, this.data.month), g);
    this.setData({
      cells: cells,
      monthText: cal.monthLabel(this.data.year, this.data.month),
      items: g[this.data.selected] || [],
    });
  },

  labels() {
    return {
      k03: i18n.pick("校曆"),
      k04: i18n.pick(" 項安排"),
      k01: i18n.pick("載入失敗"),
      k02: i18n.pick("重試"),
      title: i18n.t('cal.title'),
      today: i18n.t('cal.today'),
      empty: i18n.t('cal.empty'),
      emptyDesc: i18n.t('cal.emptyDesc'),
      event: i18n.t('cal.event'),
      notice: i18n.t('cal.notice'),
      calendar: i18n.t('common.calendar'),
      school: i18n.t('cal.school'),
      urgent: i18n.t('home.urgent'),
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
      items: (this._grouped || {})[key] || [],
    });
  },

  openItem(e) {
    const { type, id } = e.currentTarget.dataset;
    if (type === 'event') {
      wx.navigateTo({ url: '/pages/events/detail/index?id=' + id });
    } else {
      wx.navigateTo({ url: '/pages/notices/detail/index?id=' + id });
    }
  },
});
