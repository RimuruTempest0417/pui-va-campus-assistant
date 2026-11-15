const appearance = require('../../utils/appearance');
const data = require('../../services/data');
const i18n = require('../../utils/i18n');
const date = require('../../utils/date');

const KIND_KEYS = {
  EVENT: i18n.pick('活動'),
  CLAIM: i18n.pick('認領'),
  NOTICE: i18n.pick('公告'),
  ITEM: i18n.pick('失物'),
  SYSTEM: i18n.pick('系統'),
  HOMEWORK: i18n.pick('功課'),
  PROPOSAL: i18n.pick('提案'),
  REPAIR: i18n.pick('報修'),
  LIBRARY: i18n.pick('借閱'),
  LEAVE: i18n.pick('假單'),
  BOOKING: i18n.pick('場地'),
};
const kindText = (kind) => KIND_KEYS[kind] || KIND_KEYS.SYSTEM;

// W-96：分組順序固定，跟後端 NOTIFY_GROUP_KEYS 一致；後端回什麼 key 就用什麼 label。
// 不在這張表裡的 key 原樣顯示（不吞掉，方便發現兩邊不同步）。
const GROUP_ORDER = ['ALL', 'HOMEWORK', 'LIBRARY', 'APPROVAL', 'REPAIR', 'OTHER'];

Page({
  data: {
    themeClass: appearance.themeClass(),
    loading: true,
    failed: false,
    errorText: '',
    items: [],
    unread: 0,
    group: 'ALL',
    groupUnread: 0,
    groups: [],
    tabs: [],
  },

  onLoad() {
    this.setData({ L: this.labels(), groupLabels: this.groupLabels() });
    this.load('ALL');
  },

  onShow() {
    this.setData({ themeClass: appearance.themeClass() });
  },

  labels() {
    return {
      title: i18n.pick('通知'),
      readAll: i18n.pick('全部標為已讀'),
      readAllGroup: i18n.pick('清空本組未讀'),
      readDone: i18n.pick('已標為已讀'),
      readFail: i18n.pick('讀不到通知'),
      markFail: i18n.pick('標記失敗'),
      empty: i18n.pick('還沒有通知'),
      emptySub: i18n.pick('報名成功、候補轉正、認領審批、活動改期都會在這裡通知你'),
      emptyGroup: i18n.pick('這一組沒有通知'),
      emptyGroupSub: i18n.pick('切回「全部」可以看到其他通知'),
      retry: i18n.pick('重試'),
      unreadUnit: i18n.pick('則未讀'),
    };
  },

  groupLabels() {
    return {
      ALL: i18n.pick('全部'),
      HOMEWORK: i18n.pick('功課'),
      LIBRARY: i18n.pick('借閱'),
      APPROVAL: i18n.pick('審批'),
      REPAIR: i18n.pick('報修'),
      OTHER: i18n.pick('其他'),
    };
  },

  /** 後端回來的 groups → 畫面用的 chips（badge 是未讀數，0 就不顯示） */
  tabsOf(groups) {
    const labels = this.data.groupLabels || this.groupLabels();
    const rows = (groups || []).slice().sort((a, b) => GROUP_ORDER.indexOf(a.key) - GROUP_ORDER.indexOf(b.key));
    return rows.map((row) => ({
      key: row.key,
      label: labels[row.key] || row.key,
      total: row.total || 0,
      badge: row.unread ? (row.unread > 99 ? '99+' : String(row.unread)) : '',
    }));
  },

  async load(group) {
    const key = group || this.data.group || 'ALL';
    this.setData({ failed: false, errorText: '', group: key });
    try {
      const res = await data.notifications({ group: key });
      const items = (res.items || []).map((n) => ({
        ...n,
        kindText: kindText(n.kind),
        timeText: date.fromNow(n.createdAt),
        unread: !n.readAt,
      }));
      const tabs = this.tabsOf(res.groups);
      const group = res.group || key;
      this.setData({
        items,
        tabs,
        group,
        groupUnread: this.unreadOf(res.groups, group),
        unread: res.unread || 0,
        loading: false,
      });
    } catch (e) {
      // 讀取失敗要說「讀不到」，不能讓清單空著看起來像「沒有通知」
      this.setData({ loading: false, failed: true, errorText: data.messageOf(e) });
    }
  },

  unreadOf(groups, key) {
    const row = (groups || []).filter((g) => g.key === key)[0];
    return row ? row.unread || 0 : 0;
  },

  onGroup(e) {
    const key = e.currentTarget.dataset.key;
    if (!key || key === this.data.group) return;
    this.setData({ loading: true });
    return this.load(key);
  },

  retry() {
    this.setData({ loading: true });
    return this.load(this.data.group);
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
    const group = this.data.group;
    if (!this.data.groupUnread) return;
    try {
      await data.readAllNotifications(group);
      // 重抓而不是只把 items 標已讀：分組 badge 與其他組的計數都必須一起更新
      await this.load(group);
      wx.showToast({ title: (this.data.L && this.data.L.readDone) || i18n.pick('已標為已讀'), icon: 'none' });
    } catch (e) {
      wx.showToast({ title: (this.data.L && this.data.L.markFail) || i18n.pick('標記失敗'), icon: 'none' });
    }
  },
});
