const { getNav } = require('../../utils/nav');

Component({
  properties: {
    // type: null＝任意型別：頁面首次渲染時 L 還沒 setData，`title="{{L.k01}}"` 會傳 null，
    // 用 type: String 會讓 DevTools 每頁吐一條 type-uncompatible 警告（不影響顯示，但會淹掉真警告）。
    title: { type: null, value: '' },
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
