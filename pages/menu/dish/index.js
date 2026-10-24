const data = require('../../../services/data');
const { codeOf } = require('../../../utils/errors');

Page({
  data: { loading: true, failed: false, errorText: '', dish: null },

  onLoad(query) {
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
