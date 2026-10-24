const data = require('../../../services/data');
const { dateKey } = require('../../../utils/date');

const i18n = require('../../../utils/i18n');

const appearance = require('../../../utils/appearance');

Page({
  labels() {
    return {
      k17: i18n.pick("我丟了東西"),
      k18: i18n.pick("我撿到東西"),
      k19: i18n.pick("請選擇"),
      k20: i18n.pick("示範模式下圖片只存在本機"),
      k21: i18n.pick("圖片上傳尚未開通，目前只送出文字"),
      k22: i18n.pick("電話"),
      k23: i18n.pick("微信號"),
      k01: i18n.pick("基本資訊"),
      k02: i18n.pick("標題（必填）"),
      k03: i18n.pick("例：藍色水壺"),
      k04: i18n.pick("說明"),
      k05: i18n.pick("顏色、特徵、有沒有貼紙…寫得越具體越容易認回"),
      k06: i18n.pick("地點與時間"),
      k07: i18n.pick("分類"),
      k08: i18n.pick("地點（必填）"),
      k09: i18n.pick("例：圖書館三樓自習區"),
      k10: i18n.pick("發生時間"),
      k11: i18n.pick("圖片（最多 3 張）"),
      k12: i18n.pick("聯絡方式"),
      k13: i18n.pick("讓對方怎麼找你"),
      k14: i18n.pick("僅登入者可見"),
      k15: i18n.pick("發布"),
      k16: i18n.pick("選擇分類"),
    };
  },

  data: {
    themeClass: appearance.themeClass(),
    type: 'LOST',
    typeTabs: [
      { key: 'LOST', label: i18n.pick('我丟了東西') },
      { key: 'FOUND', label: i18n.pick('我撿到東西') },
    ],
    contactOptions: [
      { key: 'inApp', label: i18n.pick('站內聯絡') },
      { key: 'wechat', label: i18n.pick('微信') },
      { key: 'phone', label: i18n.pick('電話') },
    ],
    form: {
      title: '',
      description: '',
      categoryKey: '',
      place: '',
      date: '',
      contactType: 'inApp',
      contactValue: '',
      images: [],
    },
    categoryName: '',
    categories: [],
    categorySheet: false,
    submitting: false,
    isDemo: false,
  },

  onLoad() {
    this.setData({ L: this.labels(), themeClass: appearance.themeClass() });
    this.setData({ 'form.date': dateKey(), isDemo: data.isDemo() });
    this.loadCategories();
  },

  async loadCategories() {
    try {
      const res = await data.categories();
      this.setData({ categories: res.items || [] });
    } catch (e) {
      // 分類載不到不影響發布，只是不能選分類
    }
  },

  onTypeChange(e) {
    this.setData({ type: e.detail.key });
  },

  onInput(e) {
    const key = e.currentTarget.dataset.key;
    const patch = {};
    patch['form.' + key] = e.detail.value;
    this.setData(patch);
  },

  onDateChange(e) {
    this.setData({ 'form.date': e.detail.value });
  },

  onContactChange(e) {
    this.setData({ 'form.contactType': e.currentTarget.dataset.key });
  },

  openCategory() {
    this.setData({ categorySheet: true });
  },
  closeCategory() {
    this.setData({ categorySheet: false });
  },
  pickCategory(e) {
    const key = e.currentTarget.dataset.key;
    const c = this.data.categories.filter((x) => x.key === key)[0];
    this.setData({ 'form.categoryKey': key, categoryName: c ? c.icon + ' ' + c.name : '', categorySheet: false });
  },

  addImage() {
    const left = 3 - this.data.form.images.length;
    if (left <= 0) return;
    wx.chooseMedia({
      count: left,
      mediaType: ['image'],
      sizeType: ['compressed'],
      success: (res) => {
        const add = (res.tempFiles || []).map((f) => f.tempFilePath);
        this.setData({ 'form.images': this.data.form.images.concat(add).slice(0, 3) });
      },
      fail: () => {},
    });
  },

  removeImage(e) {
    const i = Number(e.currentTarget.dataset.index);
    const images = this.data.form.images.slice();
    images.splice(i, 1);
    this.setData({ 'form.images': images });
  },

  async submit() {
    const f = this.data.form;
    if (this.data.submitting) return;
    if (!f.title || f.title.trim().length < 2) {
      wx.showToast({ title: i18n.pick('請填寫標題（至少 2 個字）'), icon: 'none' });
      return;
    }
    if (!f.place || !f.place.trim()) {
      wx.showToast({ title: i18n.pick('請填寫地點'), icon: 'none' });
      return;
    }
    if (f.contactType !== 'inApp' && !f.contactValue) {
      wx.showToast({ title: i18n.pick('請填聯絡方式或改成站內聯絡'), icon: 'none' });
      return;
    }

    // 真 API 要的是 categoryId；示範資料用 categoryKey，兩個都送，各自取用
    const cat = (this.data.categories || []).filter((c) => c.key === f.categoryKey)[0];
    // 圖片目前只在示範模式可用：真 API 模式還沒有直傳 COS，送本機路徑會存成無效網址
    const isDemo = data.isDemo();
    const images = isDemo ? f.images : [];

    this.setData({ submitting: true });
    try {
      await data.createItem({
        type: this.data.type,
        title: f.title.trim(),
        description: f.description.trim(),
        categoryKey: f.categoryKey || undefined,
        categoryId: cat ? cat.id : undefined,
        place: f.place.trim(),
        happenedAt: f.date === dateKey() ? Date.now() : new Date(f.date + 'T09:00:00').getTime(),
        contactType: f.contactType,
        contactValue: f.contactValue || undefined,
        images: images,
      });
      wx.showToast({
        title: !isDemo && f.images.length ? i18n.pick('已發布（圖片暫不支援）') : i18n.pick('已發布'),
        icon: 'success',
      });
      setTimeout(() => wx.navigateBack(), 600);
    } catch (e) {
      wx.showToast({ title: data.messageOf(e), icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
