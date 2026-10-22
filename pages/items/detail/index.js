const data = require('../../../services/data');
const { decorate } = require('../../../utils/item');
const { dateKey } = require('../../../utils/date');

Page({
  data: {
    loading: true,
    item: null,
    isMine: false,
    barText: '',
    barHint: '',
    barDisabled: false,
  },

  onLoad(query) {
    this.id = query.id;
    this.load();
  },

  async load() {
    try {
      const raw = await data.getItem(this.id);
      const item = decorate(raw);
      item.happenedAtText = dateKey(new Date(item.happenedAt));
      const me = await data.me().catch(() => null); // 訪客也能看詳情
      const isMine = item.author && item.author.nickname === me.nickname;
      this.setData(Object.assign({ loading: false, item: item, isMine: isMine }, this.barFor(item, isMine)));
    } catch (e) {
      this.setData({ loading: false, item: null });
    }
  },

  barFor(item, isMine) {
    if (isMine) {
      if (item.status === 'OPEN') return { barText: '標記已認領', barHint: '我是作者', barDisabled: false };
      if (item.status === 'CLAIMED') return { barText: '標記已完成', barHint: '我是作者', barDisabled: false };
      return { barText: '已完成', barHint: '', barDisabled: true };
    }
    if (item.status === 'OPEN') {
      return { barText: item.type === 'FOUND' ? '這是我的，申請認領' : '我撿到了', barHint: '', barDisabled: false };
    }
    return { barText: '已結束', barHint: '', barDisabled: true };
  },

  async onPrimaryAction() {
    const item = this.data.item;
    if (!item) return;
    const isMine = this.data.isMine;
    try {
      if (isMine) {
        const next = item.status === 'OPEN' ? 'CLAIMED' : 'CLOSED';
        await data.updateItemStatus(item.id, next);
        wx.showToast({ title: next === 'CLAIMED' ? '已標記認領中' : '已完成', icon: 'success' });
      } else {
        await data.claimItem(item.id);
        wx.showToast({ title: '已送出認領申請', icon: 'success' });
      }
      this.load();
    } catch (e) {
      wx.showToast({ title: data.messageOf(e), icon: 'none' });
    }
  },
});
