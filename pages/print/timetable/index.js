// 列印版 · 班級課表（W-83）
// 用途：班會要貼在課室後面的那張紙 —— 節次 × 星期的固定格子，列印預覽可截圖，
// 也可以直接「存成圖片」貼到班群。
// 紙永遠是白的：本頁強制 theme-light，深色模式下也是白底黑字（否則印出來是黑底）。
const data = require('../../../services/data');
const i18n = require('../../../utils/i18n');
const grid = require('../../../utils/timetableGrid');
const theme = require('../../../utils/theme');

Page({
  labels() {
    return {
      k01: i18n.pick('列印版 · 班級課表'),
      k02: i18n.pick('班級課表'),
      k03: i18n.pick('節次'),
      k04: i18n.pick('本週'),
      k05: i18n.pick('列印時間'),
      k06: i18n.pick('列印預覽'),
      k07: i18n.pick('退出預覽'),
      k08: i18n.pick('存成圖片'),
      k09: i18n.pick('已存到相簿'),
      k10: i18n.pick('需要相簿權限'),
      k11: i18n.pick('請在設定開啟「儲存到相簿」後再試一次'),
      k12: i18n.pick('產生失敗'),
      k13: i18n.pick('載入失敗'),
      k14: i18n.pick('重試'),
      k15: i18n.pick('還沒有這個班的課表'),
      k16: i18n.pick('請找校務處匯入，或登入後看自己班上的課表。'),
      k17: i18n.pick('這台裝置不支援'),
      k18: i18n.pick('正在產生圖片…'),
      k19: i18n.pick('培華校園助手 · 班級課表'),
      k20: i18n.pick('共'),
      k21: i18n.pick(' 節有課'),
    };
  },

  data: {
    // 列印頁一律淺色：紙不會跟著手機變黑
    themeClass: 'theme-light',
    preview: false,
    loading: true,
    failed: false,
    errorText: '',
    busy: false,
    className: '',
    sheetTitle: '',
    weekText: '',
    dateText: '',
    weekdays: [],
    rows: [],
    filled: 0,
    empty: false,
    L: {},
  },

  onLoad(query) {
    this.setData({
      L: this.labels(),
      className: grid.decodeParam(query && query.className),
      dateText: todayText(),
    });
    this.load();
  },

  onShow() {
    this.setData({ L: this.labels() });
  },

  async load() {
    this.setData({ loading: true, failed: false, errorText: '' });
    try {
      const week = await data.timetable(this.data.className ? { className: this.data.className } : {});
      const built = grid.buildGrid(week);
      const range = grid.weekRange(new Date());
      const L = this.labels();
      const className = week.className || this.data.className || '';
      this.setData({
        loading: false,
        className: className,
        sheetTitle: (className ? className + ' ' : '') + L.k02,
        weekText: L.k04 + ' ' + range.text,
        weekdays: built.weekdays,
        rows: built.rows,
        filled: built.filled,
        empty: !(week.slots || []).length,
      });
    } catch (e) {
      this.setData({ loading: false, failed: true, errorText: data.messageOf(e) });
    }
  },

  retry() {
    return this.load();
  },

  togglePreview() {
    this.setData({ preview: !this.data.preview });
  },

  /**
   * 存成圖片：用「離屏 canvas」畫，不查節點。
   *
   * 為什麼不用 <canvas> 節點：Skyline 下 `NodesRef.fields({node:true})` 對不在屏的節點
   * 不會回呼（實測 console：「NodesRef.fields 不能立即回调」），症狀是按下按鈕後
   * loading 一直轉、圖永遠不出來；把 canvas 挪到畫面內、改成 opacity 0 也一樣。
   * wx.createOffscreenCanvas（基礎庫 2.16.1+，本專案下限 2.29.2）沒有這個問題，
   * 而且 canvasToTempFilePath 直接吃它的實例（本機實測成功匯出 PNG）。
   *
   * 顏色全部從 utils/theme.js 取（canvas 不吃 var()），check-project 第 13 條
   * 會逐項比對它與 tokens.wxss。
   */
  saveImage() {
    const L = this.labels();
    if (this.data.busy || this.data.empty) return;
    if (typeof wx.createOffscreenCanvas !== 'function') {
      wx.showToast({ title: L.k17, icon: 'none' });
      return;
    }

    this.setData({ busy: true });
    wx.showLoading({ title: L.k18, mask: true });

    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      if (this._watchdog) {
        clearTimeout(this._watchdog);
        this._watchdog = null;
      }
      wx.hideLoading();
      this.setData({ busy: false });
    };

    // 保險：任何一步沒有回呼都不能讓按鈕卡在 loading（最壞情況給「產生失敗」）
    this._watchdog = setTimeout(() => {
      if (settled) return;
      done();
      wx.showToast({ title: L.k12, icon: 'none' });
    }, 8000);

    try {
      const plan = grid.imagePlan(this.data.rows.length);
      const canvas = wx.createOffscreenCanvas({ type: '2d', width: plan.width, height: plan.height });
      const ctx = canvas.getContext('2d');
      grid.draw(ctx, {
        plan: plan,
        title: this.data.sheetTitle,
        sub: this.data.weekText + '　' + L.k05 + ' ' + this.data.dateText,
        colPeriod: L.k03,
        weekdays: this.data.weekdays.map((d) => d.label),
        rows: this.data.rows,
        footNote: L.k19,
        colors: {
          surface: theme.surface,
          ink: theme.ink,
          inkSoft: theme.inkSoft,
          rule: theme.rule,
        },
      });

      wx.canvasToTempFilePath({
        canvas: canvas,
        success: (r) => {
          wx.saveImageToPhotosAlbum({
            filePath: r.tempFilePath,
            success: () => {
              done();
              wx.showToast({ title: L.k09, icon: 'success' });
            },
            fail: () => {
              done();
              wx.showModal({ title: L.k10, content: L.k11, showCancel: false });
            },
          });
        },
        fail: () => {
          done();
          wx.showToast({ title: L.k12, icon: 'none' });
        },
      });
    } catch (e) {
      done();
      wx.showToast({ title: L.k12, icon: 'none' });
    }
  },
});

function todayText() {
  const d = new Date();
  const p2 = (n) => (n < 10 ? '0' + n : '' + n);
  return d.getFullYear() + '/' + p2(d.getMonth() + 1) + '/' + p2(d.getDate());
}
