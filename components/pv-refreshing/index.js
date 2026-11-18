const busy = require('../../utils/busy');
const i18n = require('../../utils/i18n');

/**
 * 刷新中指示條（v1.0.3）。
 *
 * 用法：頁面最上面放一個 `<pv-refreshing />`，不用傳參數。
 * 它在任何請求持續超過 250ms 時出現，請求全部結束後再收起 ——
 * 目的是讓「家校通同步要等八秒」看起來是「正在抓」，不是「壞了」。
 *
 * 預設文案可以在頁面用 text 覆蓋（例如列表頁想寫「正在載入功課」）。
 */
Component({
  properties: {
    text: { type: String, value: '' },
    // inline：不固定在畫面頂端，改成貼在內容上方（列印頁、彈層裡用）
    inline: { type: Boolean, value: false },
  },
  data: { show: false, label: '' },
  lifetimes: {
    attached() {
      this.setData({ label: this.data.text || i18n.pick('正在更新') });
      this._off = busy.subscribe((on) => {
        if (this.data.show !== on) this.setData({ show: on });
      });
    },
    detached() {
      if (this._off) this._off();
      this._off = null;
    },
  },
});
