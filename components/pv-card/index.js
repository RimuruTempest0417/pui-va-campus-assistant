Component({
  options: { multipleSlots: true },
  properties: {
    title: { type: String, value: '' },
    extra: { type: String, value: '' },
    padded: { type: Boolean, value: true },
    tapable: { type: Boolean, value: false },
  },
  methods: {
    onTap() {
      if (this.data.tapable) this.triggerEvent('tap');
    },
  },
});
