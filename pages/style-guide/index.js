const { getNav } = require('../../utils/nav');

const i18n = require('../../utils/i18n');

const appearance = require('../../utils/appearance');

Page({
  labels() {
    return {
      k01: i18n.pick("設計系統"),
      k02: i18n.pick("Apple HIG 風格 · 8 個原子組件 · design tokens v2"),
      k03: i18n.pick("色彩"),
      k04: i18n.pick("字階（pt → rpx，字距隨字級變化）"),
      k05: i18n.pick("按鈕（44pt 最小觸控，按下即時縮放）"),
      k06: i18n.pick("發布失物"),
      k07: i18n.pick("我要認領"),
      k08: i18n.pick("取消"),
      k09: i18n.pick("刪除"),
      k10: i18n.pick("小 34pt"),
      k11: i18n.pick("大 56pt"),
      k12: i18n.pick("禁用"),
      k13: i18n.pick("整行主要動作"),
      k14: i18n.pick("標籤與頭像"),
      k15: i18n.pick("待認領"),
      k16: i18n.pick("已認領"),
      k17: i18n.pick("已結束"),
      k18: i18n.pick("緊急"),
      k19: i18n.pick("校曆"),
      k20: i18n.pick("培華"),
      k21: i18n.pick("分段控制（iOS UISegmentedControl）"),
      k22: i18n.pick("列表（inset grouped）"),
      k23: i18n.pick("校園失物招領"),
      k24: i18n.pick("8 筆 ›"),
      k25: i18n.pick("本週活動"),
      k26: i18n.pick("3 個 ›"),
      k27: i18n.pick("緊急公告"),
      k28: i18n.pick("載入中"),
      k29: i18n.pick("空狀態"),
      k30: i18n.pick("還沒有人發布失物"),
      k31: i18n.pick("第一個發布的人，最有機會找回東西"),
      k32: i18n.pick("我要發布"),
      k33: i18n.pick("底部彈層（抓手 + 安全區）"),
      k34: i18n.pick("開啟彈層"),
      k35: i18n.pick("開發期檢視頁，不進正式導覽"),
      k36: i18n.pick("選擇分類"),
      k37: i18n.pick("卡證／學生證"),
      k38: i18n.pick("電子產品"),
      k39: i18n.pick("書本／文具"),
      k40: i18n.pick("數字排版（等寬數字，小數點才對得齊）"),
      k41: i18n.pick("上排等寬（統計值用）、下排比例（正文用）"),
      k42: i18n.pick("統計卡、名額、評分、簽到碼一律加上 .ui-num"),
    };
  },

  data: {
    themeClass: appearance.themeClass(),
    navTotal: 0,
    colors: [
      { name: i18n.pick('tint 培華紫'), value: '#6D3FC4', varName: '--pv-tint' },
      { name: i18n.pick('brand 培華紅'), value: '#C8102E', varName: '--pv-brand' },
      { name: 'danger', value: '#D70015', varName: '--pv-danger' },
      { name: 'warning', value: '#B25000', varName: '--pv-warning' },
      { name: 'success', value: '#248A3D', varName: '--pv-success' },
      { name: i18n.pick('bg 分組底'), value: '#F2F2F7', varName: '--pv-bg' },
      { name: 'label', value: '#000000', varName: '--pv-label' },
      { name: 'label 2', value: 'rgba(60,60,67,.6)', varName: '--pv-label-2' },
    ],
    types: [
      { cls: 't-large', label: 'Large Title 34pt', text: i18n.pick('培華校園助手') },
      { cls: 't-title', label: 'Title 2 · 22pt', text: i18n.pick('校園失物招領') },
      { cls: 't-headline', label: 'Headline · 17pt semibold', text: i18n.pick('圖書館三樓 · 10 分鐘前') },
      { cls: 't-body', label: 'Body · 17pt', text: i18n.pick('在圖書館三樓自習區遺失，瓶身有貼紙。') },
      { cls: 't-footnote', label: 'Footnote · 13pt', text: i18n.pick('登入後可查看聯絡方式') },
    ],
    tabs: [
      { key: 'all', label: i18n.pick('全部'), badge: 3 },
      { key: 'lost', label: i18n.pick('失物') },
      { key: 'found', label: i18n.pick('拾獲') },
    ],
    tab: 'all',
    sheetShow: false,
    loading: false,
  },
  onLoad() {
    this.setData({ L: this.labels(), themeClass: appearance.themeClass() });
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
