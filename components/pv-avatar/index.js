Component({
  properties: {
    src: { type: String, value: '' },
    name: { type: String, value: '' },
    size: { type: String, value: 'md' }, // sm | md | lg
  },
  data: { initial: '' },
  observers: {
    name(v) { this.setData({ initial: (v || '').slice(0, 1) }); },
  },
});
