const data = require('../../../services/data');
const i18n = require('../../../utils/i18n');
const appearance = require('../../../utils/appearance');
const reporter = require('../../../utils/reporter');

/**
 * 送出報修（W-89）
 *
 * 三欄就夠：在哪裡、壞什麼、怎麼壞。地點與設備都是「常用選項 + 可自己打」，
 * 因為學校的課室叫法每學年都會變，硬編一份清單一定落後。
 * 照片先只收 http(s) 連結（COS 直傳還沒接），不要讓使用者以為選了本機圖片就會上傳。
 */

const ROOMS = [i18n.pick('304 室'), i18n.pick('圖書館'), i18n.pick('禮堂'), i18n.pick('操場')];
const EQUIPMENTS = [
  i18n.pick('冷氣'),
  i18n.pick('投影機'),
  i18n.pick('門鎖'),
  i18n.pick('燈'),
  i18n.pick('水龍頭'),
  i18n.pick('電腦'),
  i18n.pick('其他'),
];

Page({
  labels() {
    return {
      k01: i18n.pick('報修'),
      k02: i18n.pick('在哪裡'),
      k03: i18n.pick('例如：304 室、圖書館三樓'),
      k04: i18n.pick('壞了什麼'),
      k05: i18n.pick('怎麼壞'),
      k06: i18n.pick('例如：出風口滴水，滴到第二排的桌上'),
      k07: i18n.pick('有多急'),
      k08: i18n.pick('可以等'),
      k09: i18n.pick('一般'),
      k10: i18n.pick('急'),
      k11: i18n.pick('照片連結（選填）'),
      k12: i18n.pick('只收 https 開頭的圖片網址'),
      k13: i18n.pick('送出報修'),
      k14: i18n.pick('送出中…'),
      k15: i18n.pick('送出後總務會收到通知；接單與修好時你也會收到通知。'),
      k16: i18n.pick('請先登入才能報修'),
      k17: i18n.pick('登入後才送得出報修單。'),
      k18: i18n.pick('去登入'),
      k19: i18n.pick('請填課室或地點'),
      k20: i18n.pick('請選或填設備類型'),
      k21: i18n.pick('請簡單描述壞在哪裡'),
      k22: i18n.pick('報修已送出'),
      k23: i18n.pick('送出失敗'),
      k24: i18n.pick('載入中…'),
      k25: i18n.pick('其他'),
    };
  },

  data: {
    themeClass: appearance.themeClass(),
    loading: true,
    guest: false,
    rooms: [],
    equipments: [],
    urgencies: [],
    location: '',
    equipment: '',
    urgency: 'NORMAL',
    description: '',
    photoUrl: '',
    submitting: false,
    L: {},
  },

  onLoad() {
    const L = this.labels();
    this.setData({
      L: this.labels(),
      themeClass: appearance.themeClass(),
      rooms: ROOMS.slice(),
      equipments: EQUIPMENTS.slice(),
      urgencies: [
        { key: 'LOW', label: L.k08 },
        { key: 'NORMAL', label: L.k09 },
        { key: 'HIGH', label: L.k10 },
      ],
    });
    this.load();
  },

  onShow() {
    const L = this.labels();
    this.setData({
      L: L,
      themeClass: appearance.themeClass(),
      urgencies: [
        { key: 'LOW', label: L.k08 },
        { key: 'NORMAL', label: L.k09 },
        { key: 'HIGH', label: L.k10 },
      ],
    });
  },

  async load() {
    this.setData({ loading: true });
    try {
      await data.ensureLogin();
      const me = await data.me().catch(() => null);
      this.setData({ loading: false, guest: !me });
    } catch (e) {
      this.setData({ loading: false, guest: true });
      console.error('[repair.create.init]', data.messageOf(e));
    }
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/settings/index' });
  },

  pickRoom(e) {
    this.setData({ location: e.currentTarget.dataset.value });
  },

  onLocation(e) {
    this.setData({ location: e.detail.value });
  },

  pickEquipment(e) {
    this.setData({ equipment: e.currentTarget.dataset.value });
  },

  onEquipment(e) {
    this.setData({ equipment: e.detail.value });
  },

  pickUrgency(e) {
    this.setData({ urgency: e.currentTarget.dataset.key });
  },

  onDescription(e) {
    this.setData({ description: e.detail.value });
  },

  onPhoto(e) {
    this.setData({ photoUrl: e.detail.value });
  },

  async submit() {
    if (this.data.submitting) return;
    const L = this.data.L;
    if (!String(this.data.location || '').trim()) {
      wx.showToast({ title: L.k19, icon: 'none' });
      return;
    }
    if (!String(this.data.equipment || '').trim()) {
      wx.showToast({ title: L.k20, icon: 'none' });
      return;
    }
    if (String(this.data.description || '').trim().length < 4) {
      wx.showToast({ title: L.k21, icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      await data.createRepair({
        location: String(this.data.location).trim(),
        equipment: String(this.data.equipment).trim(),
        urgency: this.data.urgency,
        description: String(this.data.description).trim(),
        photoUrl: String(this.data.photoUrl || '').trim() || undefined,
      });
      wx.showToast({ title: L.k22, icon: 'none' });
      setTimeout(() => {
        wx.redirectTo({ url: '/pages/repair/index/index' });
      }, 600);
    } catch (e) {
      this.setData({ submitting: false });
      reporter.reportError('[repair.create] ' + data.messageOf(e));
      wx.showModal({ title: L.k23, content: data.messageOf(e), showCancel: false });
    }
  },
});
