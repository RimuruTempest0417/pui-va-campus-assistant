// 顏色常數：只給「WXML 屬性」用（switch 的 color、swiper 的 indicator-active-color、
// wx.showModal 的 confirmColor）——這些屬性吃的是字面色值，不能用 var()。
// 唯一來源仍是 styles/tokens.wxss；這裡的值由 scripts/check-project.mjs 逐項比對，
// 兩邊只要有一個字不一樣就會擋下來，所以不要在這裡自行改色。
module.exports = {
  tint: '#6D3FC4',     // --pv-tint 培華紫
  brand: '#C8102E',    // --pv-brand 培華紅
  danger: '#D70015',   // --pv-danger 破壞性操作
  onTint: '#FFFFFF',   // --pv-on-tint 紫／紅底上的文字
};
