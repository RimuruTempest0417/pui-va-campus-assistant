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
  },
  methods: {
    onTap() {
      if (this.data.disabled || this.data.loading) return;
      this.triggerEvent('tap');
    },
  },
});
