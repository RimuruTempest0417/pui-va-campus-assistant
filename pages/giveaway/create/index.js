const data = require('../../../services/data');
const request = require('../../../utils/request');
const i18n = require('../../../utils/i18n');
const appearance = require('../../../utils/appearance');

/**
 * 送出東西（W-68）
 *
 * 表單只有六個真正要填的欄位（其餘選填），因為這件事的門檻愈低，東西愈流動得起來。
 * 「新舊」與「種類」都用 selector，不打字 —— 學生在走廊上單手填也填得完。
 */
Page({
  labels() {
    return {
      k01: i18n.pick('送出東西'),
      k02: i18n.pick('種類'),
      k03: i18n.pick('標題'),
      k04: i18n.pick('例如：高二化學課本（第八版）'),
      k05: i18n.pick('新舊'),
      k06: i18n.pick('補充'),
      k07: i18n.pick('年級、科目或尺碼（選填）'),
      k08: i18n.pick('面交地點'),
      k09: i18n.pick('例如：圖書館門口'),
      k10: i18n.pick('說明'),
      k11: i18n.pick('有沒有畫線、缺頁、尺寸不合的地方，寫清楚可以少問幾次（選填）'),
      k12: i18n.pick('聯絡方式'),
      k13: i18n.pick('例如：電話、微信或課室；只有你選中的同學看得到（選填）'),
      k14: i18n.pick('圖片連結'),
      k15: i18n.pick('http(s) 開頭的圖片網址（選填）'),
      k16: i18n.pick('送出'),
      k17: i18n.pick('送出中…'),
      k18: i18n.pick('已送出，等同學來申請'),
      k19: i18n.pick('請填標題（至少 2 個字）'),
      k20: i18n.pick('請先登入才能送出'),
      k21: i18n.pick('送不出去'),
      k22: i18n.pick('書籍'),
      k23: i18n.pick('校服'),
      k24: i18n.pick('其他'),
      k25: i18n.pick('幾乎全新'),
      k26: i18n.pick('良好'),
      k27: i18n.pick('可用'),
    };
  },

  data: {
    themeClass: appearance.themeClass(),
    kindIndex: 0,
    kindLabels: [],
    kindLabel: '',
    kindKeys: ['BOOK', 'UNIFORM', 'OTHER'],
    conditionIndex: 1,
    conditionLabels: [],
    conditionLabel: '',
    conditionKeys: ['LIKE_NEW', 'GOOD', 'FAIR'],
    title: '',
    detail: '',
    pickupPlace: '',
    body: '',
    contactValue: '',
    imageUrl: '',
    submitting: false,
    L: {},
  },

  onLoad() {
    const kindLabels = [i18n.pick('書籍'), i18n.pick('校服'), i18n.pick('其他')];
    const conditionLabels = [i18n.pick('幾乎全新'), i18n.pick('良好'), i18n.pick('可用')];
    this.setData({
      L: this.labels(),
      kindLabels: kindLabels,
      kindLabel: kindLabels[0],
      conditionLabels: conditionLabels,
      conditionLabel: conditionLabels[1],
    });
  },

  onShow() {
    this.setData({ L: this.labels(), themeClass: appearance.themeClass() });
  },

  onKindChange(e) {
    const idx = Number(e.detail.value) || 0;
    this.setData({ kindIndex: idx, kindLabel: this.data.kindLabels[idx] || '' });
  },

  onConditionChange(e) {
    const idx = Number(e.detail.value) || 0;
    this.setData({ conditionIndex: idx, conditionLabel: this.data.conditionLabels[idx] || '' });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    if (!field) return;
    this.setData({ [field]: e.detail.value });
  },

  async submit() {
    if (this.data.submitting) return;
    if (!request.getToken() && !data.isDemo()) {
      wx.showToast({ title: this.data.L.k20, icon: 'none' });
      return;
    }
    const title = String(this.data.title || '').trim();
    if (title.length < 2) {
      wx.showToast({ title: this.data.L.k19, icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      const res = await data.createGiveaway({
        kind: this.data.kindKeys[this.data.kindIndex],
        title: title,
        condition: this.data.conditionKeys[this.data.conditionIndex],
        detail: String(this.data.detail || '').trim() || undefined,
        pickupPlace: String(this.data.pickupPlace || '').trim() || undefined,
        body: String(this.data.body || '').trim() || undefined,
        contactValue: String(this.data.contactValue || '').trim() || undefined,
        imageUrl: String(this.data.imageUrl || '').trim() || undefined,
      });
      wx.showToast({ title: this.data.L.k18, icon: 'none' });
      const id = res && res.item ? res.item.id : '';
      if (id) {
        wx.redirectTo({ url: '/pages/giveaway/detail/index?id=' + id });
      } else {
        wx.navigateBack();
      }
    } catch (e) {
      wx.showModal({ title: this.data.L.k21, content: data.messageOf(e), showCancel: false });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
