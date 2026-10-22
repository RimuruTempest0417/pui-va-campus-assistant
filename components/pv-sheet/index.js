Component({
  options: { multipleSlots: true },
  properties: {
    show: { type: Boolean, value: false },
    title: { type: String, value: '' },
    closable: { type: Boolean, value: true },
    grabber: { type: Boolean, value: true },
  },
  methods: {
    onMask() { if (this.data.closable) this.triggerEvent('close'); },
    onClose() { this.triggerEvent('close'); },
    noop() {},
  },
});
