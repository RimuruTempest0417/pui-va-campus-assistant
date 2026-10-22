const { getNav } = require('../../utils/nav');

Component({
  properties: {
    title: { type: String, value: '' },
    back: { type: Boolean, value: true },
    transparent: { type: Boolean, value: false },
  },
  data: { nav: { statusBarHeight: 20, navHeight: 44, total: 64 } },
  lifetimes: {
    attached() {
      this.setData({ nav: getNav() });
    },
  },
  methods: {
    onBack() {
      const pages = getCurrentPages();
      if (pages.length > 1) {
        wx.navigateBack();
      } else {
        wx.reLaunch({ url: '/pages/index/index' });
      }
    },
  },
});
