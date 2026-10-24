const data = require('../../../services/data');
const reportSheet = require('../../../utils/reportSheet');
const { codeOf } = require('../../../utils/errors');
const { decorate } = require('../../../utils/item');
const { dateKey } = require('../../../utils/date');
const subscribe = require('../../../utils/subscribe');

const theme = require('../../../utils/theme');

const i18n = require('../../utils/i18n');

Page({
  labels() {
    return {
      k01: i18n.pick("失物詳情"),
      k02: i18n.pick("載入失敗"),
      k03: i18n.pick("重試"),
      k04: i18n.pick("找不到這筆資料"),
      k05: i18n.pick("可能已被作者刪除"),
      k06: i18n.pick("沒有圖片"),
      k07: i18n.pick("地點"),
      k08: i18n.pick("時間"),
      k09: i18n.pick("聯絡"),
      k10: i18n.pick("瀏覽"),
      k11: i18n.pick("說明"),
      k12: i18n.pick("可能是你的東西"),
      k13: i18n.pick("發布者"),
      k14: i18n.pick("檢舉"),
      k15: i18n.pick("檢舉這則內容"),
    };
  },

  ...reportSheet.methods('ITEM', function () { return this.data.item && this.data.item.id; }),

  data: {
    theme,
    loading: true,
    item: null,
    ...reportSheet.data(),
    failed: false,
    errorText: '',
    matches: [],
    matchHint: '分數越高越像',
    isMine: false,
    barText: '',
    barHint: '',
    barDisabled: false,
  },

  onLoad(query) {
    this.setData({ L: this.labels() });
    this.id = query.id;
    this.load();
  },

  async load() {
    try {
      const raw = await data.getItem(this.id);
      const item = decorate(raw);
      item.happenedAtText = dateKey(new Date(item.happenedAt));
      const me = await data.me().catch(() => null); // 訪客也能看詳情
      const isMine = !!(item.author && me && item.author.nickname === me.nickname); // 訪客時 me 是 null
      this.setData(Object.assign({ loading: false, item: item, isMine: isMine }, this.barFor(item, isMine)));

      // 智能匹配：失敗不影響詳情本身（後端沒開或舊資料都只是沒有推薦）
      const matches = await data.matches(this.id).catch(() => ({ items: [] }));
      const rows = (matches.items || []).map((m) => Object.assign({}, m, {
        percent: Math.round((m.score || 0) * 100),
        typeLabel: m.type === 'FOUND' ? '拾獲' : '遺失',
      }));
      this.setData({ matches: rows });
    } catch (e) {
      // 404＝真的沒有這筆（走空狀態）；其他（斷網／後端掛）不要偽裝成「已刪除」
      this.setData({
        loading: false,
        item: null,
    ...reportSheet.data(),
        failed: codeOf(e) !== 'NOT_FOUND',
        errorText: data.messageOf(e),
      });
    }
  },

  retry() {
    this.setData({ loading: true, failed: false, errorText: '' });
    return this.load();
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

  goMatch(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/items/detail/index?id=' + id });
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
        await subscribe.request('claim'); // 模板 ID 未填就自動跳過
        await data.claimItem(item.id);
        wx.showToast({ title: '已送出認領申請', icon: 'success' });
      }
      this.load();
    } catch (e) {
      wx.showToast({ title: data.messageOf(e), icon: 'none' });
    }
  },
});
