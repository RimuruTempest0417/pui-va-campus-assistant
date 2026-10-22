Page({
  data: {
    colors: [
      { name: 'primary', value: '#17694A' },
      { name: 'primary-strong', value: '#0F4F37' },
      { name: 'primary-soft', value: '#E8F3EE' },
      { name: 'accent', value: '#C9A227' },
      { name: 'danger', value: '#C8372D' },
      { name: 'warning', value: '#E08A1E' },
      { name: 'info', value: '#2F6FB0' },
      { name: 'text', value: '#10211A' },
    ],
    tabs: [
      { key: 'all', label: '全部', badge: 3 },
      { key: 'lost', label: '失物' },
      { key: 'found', label: '拾獲' },
    ],
    tab: 'all',
    sheetShow: false,
    loading: false,
    styles: {
      swatch: 'width: 96rpx; height: 96rpx; border-radius: 16rpx; border: 2rpx solid #E2EAE6;',
    },
  },
  onTabChange(e) {
    this.setData({ tab: e.detail.key });
  },
  openSheet() {
    this.setData({ sheetShow: true });
  },
  closeSheet() {
    this.setData({ sheetShow: false });
  },
  simulateLoading() {
    this.setData({ loading: true });
    setTimeout(() => this.setData({ loading: false }), 1200);
  },
});
