Component({
  properties: {
    rows: { type: Number, value: 3 },
    avatar: { type: Boolean, value: false },
  },
  data: { list: [] },
  observers: {
    rows(v) {
      this.setData({ list: Array.from({ length: Math.max(1, v) }) });
    },
  },
  lifetimes: {
    attached() {
      this.setData({ list: Array.from({ length: Math.max(1, this.data.rows) }) });
    },
  },
});
