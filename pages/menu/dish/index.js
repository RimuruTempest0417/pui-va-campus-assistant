const data = require('../../../services/data');
const { codeOf } = require('../../../utils/errors');

const i18n = require('../../../utils/i18n');

const appearance = require('../../../utils/appearance');

Page({
  labels() {
    return {
      k01: i18n.pick("菜式"),
      k02: i18n.pick("載入失敗"),
      k03: i18n.pick("重試"),
      k04: i18n.pick("找不到這道菜"),
      k05: i18n.pick("可能已下架"),
      k06: i18n.pick("平均分"),
      k07: i18n.pick("我的評分"),
      k08: i18n.pick("點讚會影響本週熱門排行"),
    };
  },

  data: {
    themeClass: appearance.themeClass(), loading: true, failed: false, errorText: '', dish: null },

  onLoad(query) {
    this.setData({ L: this.labels(), themeClass: appearance.themeClass() });
    this.id = query.id;
    this.load();
  },

  async load() {
    try {
      const dish = await data.getDish(this.id);
      this.setData({ loading: false, failed: false, errorText: '', dish: dish });
    } catch (e) {
      this.setData({
        loading: false,
        dish: null,
        failed: codeOf(e) !== 'NOT_FOUND',
        errorText: data.messageOf(e),
      });
    }
  },

  retry() {
    this.setData({ loading: true, failed: false, errorText: '' });
    return this.load();
  },

  async onRate(e) {
    const score = Number(e.currentTarget.dataset.score);
    await this.rate(score, this.data.dish.myLiked);
  },

  async onToggleLike() {
    const dish = this.data.dish;
    if (!dish.myScore) {
      wx.showToast({ title: '先給個星評分吧', icon: 'none' });
      return;
    }
    await this.rate(dish.myScore, !dish.myLiked);
  },

  async rate(score, liked) {
    try {
      const dish = await data.rateDish(this.id, { score: score, liked: liked });
      this.setData({ dish: dish });
      wx.showToast({ title: '已記錄', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: data.messageOf(e), icon: 'none' });
    }
  },
});
