Component({
  properties: {
    text: { type: String, value: '' },
    // neutral | tint | success | warning | danger | brand
    type: { type: String, value: 'neutral' },
    plain: { type: Boolean, value: false },
  },
});
