const data = require('../../../services/data');
const { codeOf } = require('../../../utils/errors');
const { decorate } = require('../../../utils/notice');
const { dateKey } = require('../../../utils/date');

Page({
  data: { loading: true, failed: false, errorText: '', notice: null },

  onLoad(query) {
    this.id = query.id;
    this.load();
  },

  async load() {
    try {
      const n = decorate(await data.getNotice(this.id));
      if (n.expiresAt) n.expiresText = dateKey(new Date(n.expiresAt));
      this.setData({ loading: false, failed: false, errorText: '', notice: n });
    } catch (e) {
      this.setData({
        loading: false,
        notice: null,
        failed: codeOf(e) !== 'NOT_FOUND',
        errorText: data.messageOf(e),
      });
    }
  },

  retry() {
    this.setData({ loading: true, failed: false, errorText: '' });
    return this.load();
  },
});
