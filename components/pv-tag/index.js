Component({
  properties: {
    text: { type: String, value: '' },
    type: { type: String, value: 'default' }, // default | success | warning | danger | info
    plain: { type: Boolean, value: false },
  },
});
