const data = require('../../../services/data');
const week = require('../../../utils/week');

const i18n = require('../../../utils/i18n');

const appearance = require('../../../utils/appearance');
const authGuard = require('../../../utils/auth-guard');

Page({
  labels() {
    return {
      k13: i18n.pick(" · 我給 "),
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
      // v1.0.9：學校公布的套餐（A／B／C 餐）
      k600: i18n.pick("今日套餐"),
      k601: i18n.pick("A 餐"),
      k602: i18n.pick("B 餐"),
      k603: i18n.pick("C 餐"),
      k604: i18n.pick("湯／糖水"),
      k607: i18n.pick("可評分"),
    };
  },

  data: {
    themeClass: appearance.themeClass(),
    loading: true,
    failed: false,
    errorText: '',
    refreshing: false,
    offset: 0,
    weekLabelText: i18n.pick('本週'),
    rangeText: '',
    days: [],
    top: [],
  },

  onLoad() {
    // v1.0.15：沒有登入不能用
    if (!authGuard.guard()) return;
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
      // v1.0.9：兩個來源 —— 套餐（A／B／C 餐，學校公布的那張）與舊的單點菜色。
      // 套餐抓不到（舊後端）時整段當作沒有，不要讓整個頁面失敗：菜色還是要看得到。
      const setsPromise = data.mealSets({ weekOffset: offset }).catch(() => ({ days: [] }));
      const [res, top, sets] = await Promise.all([
        data.weekMenu({ offset: offset }),
        data.topDishes({ limit: 5 }),
        setsPromise,
      ]);
      const todayKey = week.dateKey();
      const setByDate = {};
      (sets.days || []).forEach((s) => {
        setByDate[s.date] = s;
      });

      const days = (res.days || []).map((d) => {
        const label = week.dayLabel(d.date);
        const set = setByDate[d.date] || {};
        const hasSet = Boolean(set.A || set.B || set.C);   // 湯／糖水單獨存在時不算「有套餐」
        const hasSoup = Boolean(set.soup);
        return Object.assign({}, d, {
          md: label.md,
          wd: label.wd,
          isToday: d.date === todayKey,
          A: set.A || '',
          B: set.B || '',
          C: set.C || '',
          soup: set.soup || '',
          // v1.0.24：每一格的 dishId（後端用同日排菜單對名字回傳），有點到才能進詳情頁評分
          ids: set.ids || {},
          hasSet: hasSet,
          hasSoup: hasSoup,
        });
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
