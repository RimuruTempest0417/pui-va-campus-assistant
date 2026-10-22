Component({
  properties: {
    tabs: { type: Array, value: [] }, // [{ key, label, badge? }]
    current: { type: String, value: '' },
  },
  methods: {
    onTap(e) {
      const key = e.currentTarget.dataset.key;
      if (key === this.data.current) return;
      this.triggerEvent('change', { key });
    },
  },
});
