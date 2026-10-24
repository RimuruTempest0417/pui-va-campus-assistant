const data = require('../../services/data');
const cal = require('../../utils/calendar');
const i18n = require('../../utils/i18n');

Page({
  data: {
    loading: true,
    year: 0,
    month: 0,
    monthText: '',
    weekdays: ['一', '二', '三', '四', '五', '六', '日'],
    cells: [],
    selected: '',
    selectedText: '',
    items: [],
    L: { title: '', today: '', empty: '', emptyDesc: '', event: '', notice: '', calendar: '校曆', urgent: '緊急' },
  },

  onLoad() {
    const now = new Date();
    this.setData({
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      selected: cal.dateKey(now),
      selectedText: i18n.t('cal.today'),
    });
    this.load();
  },

  onShow() {
    if (this._loadedOnce) this.load();
    this._loadedOnce = true;
  },

  async load() {
    try {
      const res = await data.calendar();
      const grouped = cal.groupByDate(res.notices, res.events);
      this._grouped = grouped;
      this.render(grouped);
      this.setData({ loading: false });
    } catch (e) {
      this.setData({ loading: false, cells: [], items: [] });
      wx.showToast({ title: data.messageOf(e), icon: 'none' });
    }
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
      title: i18n.t('cal.title'),
      today: i18n.t('cal.today'),
      empty: i18n.t('cal.empty'),
      emptyDesc: i18n.t('cal.emptyDesc'),
      event: i18n.t('cal.event'),
      notice: i18n.t('cal.notice'),
      calendar: i18n.t('common.calendar'),
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
      selectedText: '今天',
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
