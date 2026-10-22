Component({
  properties: {
    type: { type: String, value: 'primary' }, // primary | secondary | ghost | danger
    size: { type: String, value: 'md' }, // md | sm
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
