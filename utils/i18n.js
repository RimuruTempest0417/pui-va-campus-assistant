// 介面語言（繁／簡）：只處理「介面文案」，不動使用者產生的內容。
// 用法：t('home.module.items')；未收錄的 key 會原樣回傳，方便逐步遷移。
const config = require('../config/config');

const STORAGE = (config.STORAGE_KEYS && config.STORAGE_KEYS.locale) || 'pv_locale';
const DEFAULT = config.LOCALE || 'zh-Hant';
const LOCALES = ['zh-Hant', 'zh-Hans'];

const DICT = {
  // 首頁
  'home.brand': { hant: '培華校園助手', hans: '培华校园助手' },
  'home.demoTag': { hant: '示範資料', hans: '示范数据' },
  'home.urgent': { hant: '緊急', hans: '紧急' },
  'home.guest': { hant: '訪客', hans: '访客' },
  'home.student': { hant: '同學', hans: '同学' },
  'home.failed': { hant: '載入失敗', hans: '加载失败' },
  'home.failedDesc': { hant: '連不到後端', hans: '连不到后端' },
  'home.justNow': { hant: '剛剛更新', hans: '刚刚更新' },
  'home.module.items': { hant: '失物招領', hans: '失物招领' },
  'home.module.events': { hant: '活動與社團', hans: '活动与社团' },
  'home.module.menu': { hant: '午餐與小賣部', hans: '午餐与小卖部' },
  'home.module.notices': { hant: '公告與提示', hans: '公告与提示' },
  'home.unit.items': { hant: '筆', hans: '条' },
  'home.unit.events': { hant: '個', hans: '个' },
  'home.unit.dishes': { hant: '款', hans: '款' },
  'home.unit.notices': { hant: '則', hans: '条' },
  'home.unread': { hant: '則未讀', hans: '条未读' },
  // 問候（依時段）
  'greet.night': { hant: '夜深了', hans: '夜深了' },
  'greet.morning': { hant: '早安', hans: '早安' },
  'greet.noon': { hant: '午安', hans: '午安' },
  'greet.evening': { hant: '晚安', hans: '晚安' },
  // 校曆
  'cal.title': { hant: '校曆', hans: '校历' },
  'cal.today': { hant: '今天', hans: '今天' },
  'cal.empty': { hant: '這天沒有安排', hans: '这天没有安排' },
  'cal.emptyDesc': { hant: '有公告或活動的日子會標上圓點', hans: '有公告或活动的日子会标上圆点' },
  'cal.event': { hant: '活動', hans: '活动' },
  'cal.notice': { hant: '公告', hans: '公告' },
  // 共用
  'common.list': { hant: '列表', hans: '列表' },
  'common.calendar': { hant: '校曆', hans: '校历' },
  'common.allRead': { hant: '全部標為已讀', hans: '全部标为已读' },
  'common.loading': { hant: '載入中…', hans: '加载中…' },
  'common.retry': { hant: '重試', hans: '重试' },
  // 開發自檢
  'dev.locale': { hant: '介面語言', hans: '界面语言' },
  'dev.localeHint': { hant: '只改介面文案，不影響資料', hans: '只改界面文案，不影响数据' },
};

function normalize(loc) {
  return LOCALES.indexOf(loc) !== -1 ? loc : DEFAULT;
}

function locale() {
  try {
    const v = wx.getStorageSync(STORAGE);
    return normalize(v || DEFAULT);
  } catch (e) {
    return DEFAULT;
  }
}

function setLocale(loc) {
  const next = normalize(loc);
  try {
    wx.setStorageSync(STORAGE, next);
  } catch (e) {
    // storage 不可用時只影響本次顯示
  }
  return next;
}

function isHans() {
  return locale() === 'zh-Hans';
}

/** 取文案；找不到 key 就原樣回傳（方便漸進遷移，不會出現 undefined） */
function t(key, loc) {
  const entry = DICT[key];
  if (!entry) return key;
  const use = normalize(loc || locale());
  return use === 'zh-Hans' ? entry.hans : entry.hant;
}

function greetingByHour(hour) {
  const h = typeof hour === 'number' ? hour : new Date().getHours();
  if (h < 6) return t('greet.night');
  if (h < 12) return t('greet.morning');
  if (h < 18) return t('greet.noon');
  return t('greet.evening');
}

module.exports = {
  t,
  locale,
  setLocale,
  isHans,
  greetingByHour,
  dict: () => DICT,
  LOCALES,
  DEFAULT,
};
