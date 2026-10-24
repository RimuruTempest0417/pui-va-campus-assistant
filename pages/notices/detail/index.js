const data = require('../../../services/data');
const { codeOf } = require('../../../utils/errors');
const { decorate } = require('../../../utils/notice');
const { dateKey } = require('../../../utils/date');

const reportSheet = require('../../../utils/reportSheet');

const i18n = require('../../../utils/i18n');

const appearance = require('../../../utils/appearance');

Page({
  labels() {
    return {
      k01: i18n.pick("公告"),
      k02: i18n.pick("載入失敗"),
      k03: i18n.pick("重試"),
      k04: i18n.pick("找不到這則公告"),
      k05: i18n.pick("可能已下架或過期"),
      k06: i18n.pick("置頂"),
      k07: i18n.pick("檢舉這則公告"),
      k08: i18n.pick("檢舉這則內容"),
    };
  },

  ...reportSheet.methods('NOTICE', function () { return this.data.notice && this.data.notice.id; }),

  data: {
    themeClass: appearance.themeClass(),
    ...reportSheet.data(), loading: true, failed: false, errorText: '', notice: null },

  onLoad(query) {
    this.setData({ L: this.labels(), themeClass: appearance.themeClass() });
    this.id = query.id;
    this.load();
  },

  async load() {
    try {
      const n = decorate(await data.getNotice(this.id));
      if (n.expiresAt) n.expiresText = dateKey(new Date(n.expiresAt));
      this.setData({ loading: false, failed: false, errorText: '', notice: n });
    } catch (e) {
      this.setData({
        loading: false,
        notice: null,
        failed: codeOf(e) !== 'NOT_FOUND',
        errorText: data.messageOf(e),
      });
    }
  },

  retry() {
    this.setData({ loading: true, failed: false, errorText: '' });
    return this.load();
  },
});
