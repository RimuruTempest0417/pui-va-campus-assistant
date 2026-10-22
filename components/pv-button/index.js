Component({
  properties: {
    // filled（實心 tint）| tinted（淡底 tint 字）| plain（純文字）| destructive（紅字）
    type: { type: String, value: 'filled' },
    // lg（56pt）| md（44pt，預設，符合最小觸控目標）| sm（34pt）
    size: { type: String, value: 'md' },
    block: { type: Boolean, value: false },
    disabled: { type: Boolean, value: false },
    loading: { type: Boolean, value: false },
    customStyle: { type: String, value: '' },
    haptic: { type: Boolean, value: true }, // 預設有輕震，可用 haptic="{{false}}" 關掉
  },
  data: { pressed: false },
  methods: {
    // Skyline 下 hover-class 不可靠 → 用 touchstart 自己控制按下態，手指落下同一幀就變
    onTouchStart() {
      if (this.data.disabled || this.data.loading) return;
      this.setData({ pressed: true });
    },
    onTouchEnd() {
      if (!this.data.pressed) return;
      this.setData({ pressed: false });
    },
    onTap() {
      if (this.data.disabled || this.data.loading) return;
      if (this.data.haptic) wx.vibrateShort({ type: 'light', fail: () => {} });
      this.triggerEvent('tap');
    },
  },
});
