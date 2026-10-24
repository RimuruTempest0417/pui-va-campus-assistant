const data = require('../../../services/data');
const { dateTimeText } = require('../../../utils/date');

Page({
  data: { loading: true, items: [], failed: false, errorText: '' },

  onLoad() {
    this.load();
  },

  onShow() {
    if (this._loadedOnce) this.load();
    this._loadedOnce = true;
  },

  async load() {
    try {
      const res = await data.mySignups();
      const items = (res.items || []).map((x) => Object.assign({}, x, {
        timeText: x.startAt ? dateTimeText(x.startAt) : '',
        statusLabel: x.status === 'CONFIRMED' ? '已報名' : '候補中',
        tagType: x.status === 'CONFIRMED' ? 'success' : 'warning',
        checkedIn: !!x.checkedInAt,
        canCheckIn: x.status === 'CONFIRMED' && !x.checkedInAt,
      }));
      this.setData({ loading: false, failed: false, errorText: '', items: items });
    } catch (e) {
      this.setData({ loading: false, failed: true, errorText: data.messageOf(e), items: [] });
    }
  },

  retry() {
    this.setData({ loading: true, failed: false, errorText: '' });
    return this.load();
  },

  async cancel(e) {
    const id = e.currentTarget.dataset.id;
    try {
      const res = await data.cancelSignup(id);
      wx.showToast({ title: res.promoted ? '已取消，已為候補者補位' : '已取消', icon: 'none' });
      this.load();
    } catch (err) {
      wx.showToast({ title: data.messageOf(err), icon: 'none' });
    }
  },

  goCheckin() {
    wx.navigateTo({ url: '/pages/events/checkin/index' });
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/events/detail/index?id=' + e.currentTarget.dataset.id });
  },

  goList() {
    wx.navigateTo({ url: '/pages/events/list/index' });
  },
});
