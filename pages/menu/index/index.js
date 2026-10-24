const data = require('../../../services/data');
const week = require('../../../utils/week');

const i18n = require('../../../utils/i18n');

const appearance = require('../../../utils/appearance');

Page({
  labels() {
    return {
      k01: i18n.pick("午餐與小賣部"),
      k02: i18n.pick("載入失敗"),
      k03: i18n.pick("重試"),
      k04: i18n.pick("今天"),
      k05: i18n.pick("午餐"),
      k06: i18n.pick("分"),
      k07: i18n.pick("小賣部"),
      k08: i18n.pick("這天沒有排菜單"),
      k09: i18n.pick("可能放假或尚未排定"),
      k10: i18n.pick("本週熱門"),
      k11: i18n.pick("還沒有評分資料"),
      k12: i18n.pick("第一個評分的人決定排行"),
    };
  },

  data: {
    themeClass: appearance.themeClass(),
    loading: true,
    failed: false,
    errorText: '',
    refreshing: false,
    offset: 0,
    weekLabelText: '本週',
    rangeText: '',
    days: [],
    top: [],
  },

  onLoad() {
    this.setData({ L: this.labels(), themeClass: appearance.themeClass() });
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
        failed: false,
        errorText: '',
      });
    } catch (e) {
      this.setData({ loading: false, failed: true, errorText: data.messageOf(e) });
      wx.showToast({ title: data.messageOf(e), icon: 'none' });
    }
  },

  retry() {
    this.setData({ loading: true, failed: false, errorText: '' });
    return this.load();
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
