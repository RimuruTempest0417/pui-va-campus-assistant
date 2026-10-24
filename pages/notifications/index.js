const appearance = require('../../utils/appearance');
const data = require('../../services/data');
const i18n = require('../../utils/i18n');
const date = require('../../utils/date');

const KIND_KEYS = {
  EVENT: i18n.pick('活動'),
  CLAIM: i18n.pick('認領'),
  NOTICE: i18n.pick('公告'),
  SYSTEM: i18n.pick('系統'),
};
const kindText = (kind) => KIND_KEYS[kind] || KIND_KEYS.SYSTEM;

Page({
  data: { themeClass: appearance.themeClass(), loading: true, items: [], unread: 0 },

  onLoad() {
    this.setData({ L: this.labels() });
    this.load();
  },

  onShow() {
    this.setData({ themeClass: appearance.themeClass() });
  },

  labels() {
    return {
      title: i18n.pick('通知'),
      readAll: i18n.pick('全部標為已讀'),
      readFail: i18n.pick('讀不到通知'),
      markFail: i18n.pick('標記失敗'),
      empty: i18n.pick('還沒有通知'),
      emptySub: i18n.pick('報名成功、候補轉正、認領審批、活動改期都會在這裡通知你'),
    };
  },

  async load() {
    try {
      const res = await data.notifications();
      const items = (res.items || []).map((n) => ({
        ...n,
        kindText: kindText(n.kind),
        timeText: date.fromNow(n.createdAt),
        unread: !n.readAt,
      }));
      this.setData({ items, unread: res.unread || 0, loading: false });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: this.data.L ? this.data.L.readFail : i18n.pick('讀不到通知'), icon: 'none' });
    }
  },

  async openItem(e) {
    const item = this.data.items[e.currentTarget.dataset.i];
    if (!item) return;
    if (item.unread) {
      this.setData({ [`items[${e.currentTarget.dataset.i}].unread`]: false });
      data.readNotifications(item.id).catch(() => {});
    }
    if (item.link) wx.navigateTo({ url: item.link });
  },

  async readAll() {
    if (!this.data.unread) return;
    try {
      await data.readNotifications();
      this.setData({ items: this.data.items.map((x) => ({ ...x, unread: false })), unread: 0 });
    } catch (e) {
      wx.showToast({ title: this.data.L ? this.data.L.markFail : i18n.pick('標記失敗'), icon: 'none' });
    }
  },
});
