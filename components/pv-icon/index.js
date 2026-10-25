// 線性圖標（v0.60.0，W-47）：單一來源，24px 網格、2rpx 描邊、單色。
// 為什麼用 view＋border 畫而不是 SVG 檔：Skyline 對 <image src="*.svg"> 與 data-URI 支援不穩，
// 而這個專案已經用同一招畫過鈴鐺與空狀態圓環（實機與模擬器都正常）；畫出來的線寬是 rpx，
// 深色模式靠 CSS 變數自動跟著換色，也不需要額外的 PNG 資產。
// 用法：<pv-icon name="search" size="32" tone="muted" />
Component({
  properties: {
    // items | events | menu | notices | bell | search | inbox | chevron
    name: { type: String, value: '' },
    // 邊長（rpx）。內部幾何以百分比定位，所以同一個圖標可以任意放大縮小、線寬恆為 2rpx。
    size: { type: String, value: '44' },
    // default（label-2）| muted（label-3）| tint（品牌紫）| on-tint（紫底白）| brand（校徽紅）
    tone: { type: String, value: 'default' },
  },
});
