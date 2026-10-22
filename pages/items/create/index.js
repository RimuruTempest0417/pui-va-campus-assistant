const data = require('../../../services/data');
const { dateKey } = require('../../../utils/date');

Page({
  data: {
    type: 'LOST',
    typeTabs: [
      { key: 'LOST', label: '我丟了東西' },
      { key: 'FOUND', label: '我撿到東西' },
    ],
    contactOptions: [
      { key: 'inApp', label: '站內聯絡' },
      { key: 'wechat', label: '微信' },
      { key: 'phone', label: '電話' },
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
      wx.showToast({ title: '請填寫標題（至少 2 個字）', icon: 'none' });
      return;
    }
    if (!f.place || !f.place.trim()) {
      wx.showToast({ title: '請填寫地點', icon: 'none' });
      return;
    }
    if (f.contactType !== 'inApp' && !f.contactValue) {
      wx.showToast({ title: '請填聯絡方式或改成站內聯絡', icon: 'none' });
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
        title: !isDemo && f.images.length ? '已發布（圖片暫不支援）' : '已發布',
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
