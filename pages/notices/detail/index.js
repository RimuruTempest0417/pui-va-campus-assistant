const data = require('../../../services/data');
const { decorate } = require('../../../utils/notice');
const { dateKey } = require('../../../utils/date');

Page({
  data: { loading: true, notice: null },

  onLoad(query) {
    this.id = query.id;
    this.load();
  },

  async load() {
    try {
      const n = decorate(await data.getNotice(this.id));
      if (n.expiresAt) n.expiresText = dateKey(new Date(n.expiresAt));
      this.setData({ loading: false, notice: n });
    } catch (e) {
      this.setData({ loading: false, notice: null });
    }
  },
});
