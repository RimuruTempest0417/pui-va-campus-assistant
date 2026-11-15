const data = require('../../../services/data');
const i18n = require('../../../utils/i18n');
const appearance = require('../../../utils/appearance');
const request = require('../../../utils/request');

/**
 * 提出建議／修改自己的提案
 *
 * 同一頁兩種模式：沒帶 id 是新增，帶 id 是修改（只有 OPEN 的提案改得動，
 * 後端會再擋一次；這裡只是不要讓使用者白填一次表）。
 */
Page({
  labels() {
    return {
      k01: i18n.pick('提出建議'),
      k02: i18n.pick('修改提案'),
      k03: i18n.pick('分類'),
      k04: i18n.pick('標題'),
      k05: i18n.pick('一句話說明你想改什麼'),
      k06: i18n.pick('內容'),
      k07: i18n.pick('為什麼要改、改了有什麼好處、影響哪些人'),
      k08: i18n.pick('送出'),
      k09: i18n.pick('儲存'),
      k10: i18n.pick('送出中…'),
      k11: i18n.pick('請先登入'),
      k12: i18n.pick('標題至少 4 個字'),
      k13: i18n.pick('內容至少 10 個字，寫清楚一點比較容易得到連署'),
      k14: i18n.pick('已送出'),
      k15: i18n.pick('已儲存'),
      k16: i18n.pick('送出失敗'),
      k17: i18n.pick('載入失敗'),
      k18: i18n.pick('提示'),
      k19: i18n.pick('送出後你就是第一位連署人，同學連署到門檻時校方會收到通知。'),
    };
  },

  data: {
    themeClass: appearance.themeClass(),
    id: '',
    isEdit: false,
    loading: false,
    submitting: false,
    category: 'FACILITY',
    categoryTabs: [],
    title: '',
    body: '',
    version: 0,
    L: {},
  },

  onLoad(query) {
    const id = (query && query.id) || '';
    this.setData({
      L: this.labels(),
      themeClass: appearance.themeClass(),
      id: id,
      isEdit: !!id,
      categoryTabs: this.buildTabs(),
    });
    if (id) this.loadExisting();
  },

  onShow() {
    this.setData({ L: this.labels(), themeClass: appearance.themeClass(), categoryTabs: this.buildTabs() });
  },

  buildTabs() {
    return [
      { key: 'FACILITY', label: i18n.pick('校園設施') },
      { key: 'STUDY', label: i18n.pick('課堂學習') },
      { key: 'ACTIVITY', label: i18n.pick('活動建議') },
      { key: 'CANTEEN', label: i18n.pick('餐飲') },
      { key: 'OTHER', label: i18n.pick('其他') },
    ];
  },

  async loadExisting() {
    this.setData({ loading: true });
    try {
      const res = await data.getProposal(this.data.id);
      this.setData({
        loading: false,
        title: res.title || '',
        body: res.body || '',
        category: res.category || 'FACILITY',
        version: res.version || 0,
      });
    } catch (e) {
      this.setData({ loading: false });
      wx.showModal({ title: this.data.L.k17, content: data.messageOf(e), showCancel: false });
    }
  },

  onCategoryChange(e) {
    this.setData({ category: e.currentTarget.dataset.key || 'OTHER' });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    if (!field) return;
    this.setData({ [field]: e.detail.value });
  },

  async submit() {
    if (this.data.submitting) return;
    if (!request.getToken() && !data.isDemo()) {
      wx.showToast({ title: this.data.L.k11, icon: 'none' });
      return;
    }
    const title = String(this.data.title || '').trim();
    const body = String(this.data.body || '').trim();
    if (title.length < 4) {
      wx.showToast({ title: this.data.L.k12, icon: 'none' });
      return;
    }
    if (body.length < 10) {
      wx.showToast({ title: this.data.L.k13, icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    try {
      if (this.data.isEdit) {
        await data.updateProposal(this.data.id, {
          title: title,
          body: body,
          category: this.data.category,
          version: this.data.version,
        });
        wx.showToast({ title: this.data.L.k15, icon: 'none' });
      } else {
        const res = await data.createProposal({ title: title, body: body, category: this.data.category });
        wx.showToast({ title: this.data.L.k14, icon: 'none' });
        const id = (res && res.id) || '';
        if (id) {
          wx.redirectTo({ url: '/pages/proposals/detail/index?id=' + id });
          return;
        }
      }
      setTimeout(() => wx.navigateBack(), 500);
    } catch (e) {
      wx.showModal({ title: this.data.L.k16, content: data.messageOf(e), showCancel: false });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
