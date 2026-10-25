Component({
  properties: {
    // 保留 icon 參數以免既有頁面報錯；實際不渲染 emoji，改成統一的線性圓環標記。
    // 含有 ⚠ 的視為警示（淡紅），其餘中性（灰）。
    icon: { type: String, value: '' },
    tone: { type: String, value: '' }, // '' = 自動；'warning' | 'neutral'
    title: { type: String, value: '這裡還空著' },
    desc: { type: String, value: '' },
  },
  observers: {
    icon(v) {
      if (this.data.tone) return;
      this.setData({ autoTone: /⚠|❕|❗/.test(v || '') ? 'warning' : 'neutral' });
    },
  },
  data: { autoTone: 'neutral' },
});
