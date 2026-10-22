const data = require('../../../services/data');
const week = require('../../../utils/week');

Page({
  data: {
    loading: true,
    refreshing: false,
    offset: 0,
    weekLabelText: '本週',
    rangeText: '',
    days: [],
    top: [],
  },

  onLoad() {
    this.load();
  },

  onRefresh() {
    this.setData({ refreshing: true });
    this.load().then(() => this.setData({ refreshing: false }));
  },

  async load() {
    const offset = this.data.offset;
    this.setData({ loading: true });

    try {
      const [res, top] = await Promise.all([
        data.weekMenu({ offset: offset }),
        data.topDishes({ limit: 5 }),
      ]);
      const todayKey = week.dateKey();

      const days = (res.days || []).map((d) => {
        const label = week.dayLabel(d.date);
        return Object.assign({}, d, { md: label.md, wd: label.wd, isToday: d.date === todayKey });
      });

      const dates = res.dates || [];
      this.setData({
        loading: false,
        days: days,
        top: top.items || [],
        weekLabelText: week.weekLabel(offset),
        rangeText: dates.length ? dates[0].slice(5).replace('-', '/') + ' — ' + dates[dates.length - 1].slice(5).replace('-', '/') : '',
      });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: data.messageOf(e), icon: 'none' });
    }
  },

  prevWeek() {
    this.setData({ offset: this.data.offset - 1 }, () => this.load());
  },

  nextWeek() {
    this.setData({ offset: this.data.offset + 1 }, () => this.load());
  },

  goDish(e) {
    wx.navigateTo({ url: '/pages/menu/dish/index?id=' + e.currentTarget.dataset.id });
  },
});
