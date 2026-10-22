const { getNav } = require('../../utils/nav');

Page({
  data: {
    navTotal: 0,
    colors: [
      { name: 'tint 培華紫', value: '#6D3FC4', varName: '--pv-tint' },
      { name: 'brand 培華紅', value: '#C8102E', varName: '--pv-brand' },
      { name: 'danger', value: '#D70015', varName: '--pv-danger' },
      { name: 'warning', value: '#B25000', varName: '--pv-warning' },
      { name: 'success', value: '#248A3D', varName: '--pv-success' },
      { name: 'bg 分組底', value: '#F2F2F7', varName: '--pv-bg' },
      { name: 'label', value: '#000000', varName: '--pv-label' },
      { name: 'label 2', value: 'rgba(60,60,67,.6)', varName: '--pv-label-2' },
    ],
    types: [
      { cls: 't-large', label: 'Large Title 34pt', text: '培華校園助手' },
      { cls: 't-title', label: 'Title 2 · 22pt', text: '校園失物招領' },
      { cls: 't-headline', label: 'Headline · 17pt semibold', text: '圖書館三樓 · 10 分鐘前' },
      { cls: 't-body', label: 'Body · 17pt', text: '在圖書館三樓自習區遺失，瓶身有貼紙。' },
      { cls: 't-footnote', label: 'Footnote · 13pt', text: '登入後可查看聯絡方式' },
    ],
    tabs: [
      { key: 'all', label: '全部', badge: 3 },
      { key: 'lost', label: '失物' },
      { key: 'found', label: '拾獲' },
    ],
    tab: 'all',
    sheetShow: false,
    loading: false,
  },
  onLoad() {
    this.setData({ navTotal: getNav().total });
  },

  onTabChange(e) { this.setData({ tab: e.detail.key }); },
  openSheet() { this.setData({ sheetShow: true }); },
  closeSheet() { this.setData({ sheetShow: false }); },
  simulateLoading() {
    this.setData({ loading: true });
    setTimeout(() => this.setData({ loading: false }), 1200);
  },
});
