Component({
  properties: {
    rows: { type: Number, value: 3 },
    avatar: { type: Boolean, value: false },
  },
  data: { list: [0, 1, 2] },
  observers: {
    rows(v) { this.setData({ list: Array.from({ length: Math.max(1, v) }, (_, i) => i) }); },
  },
});
