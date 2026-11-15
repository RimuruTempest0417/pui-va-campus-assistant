const { dateTimeText, fromNow } = require('./date');
const i18n = require('./i18n');

/**
 * 校園提案（W-88）的顯示轉換
 *
 * 清單、詳情、後台三個地方都要回答同一批問題：這是哪一類、到什麼狀態、幾個人連署、
 * 能不能連署／能不能改。三處各寫一次，遲早出現「清單說可以連署、詳情說已結案」。
 * 這裡只做顯示與文案；能不能做，一律以後端回的 mySupported／canEdit／status 為準。
 */

const CATEGORY_LABEL = {
  FACILITY: '校園設施',
  STUDY: '課堂學習',
  ACTIVITY: '活動建議',
  CANTEEN: '餐飲',
  OTHER: '其他',
};

/** 單字徽章：比彩色 emoji 穩定，也一眼分得出五類 */
const CATEGORY_MARK = { FACILITY: '設', STUDY: '學', ACTIVITY: '活', CANTEEN: '餐', OTHER: '其' };

const STATUS_LABEL = {
  OPEN: '收集中',
  REVIEWING: '校方處理中',
  PLANNED: '已列入計劃',
  DONE: '已完成',
  DECLINED: '暫不採納',
};

const STATUS_TAG = {
  OPEN: 'tint',
  REVIEWING: 'warning',
  PLANNED: 'success',
  DONE: 'success',
  DECLINED: 'neutral',
};

function categoryLabel(key) {
  return i18n.pick(CATEGORY_LABEL[key] || '其他');
}

function categoryMark(key) {
  return i18n.pick(CATEGORY_MARK[key] || '其');
}

function statusLabel(status) {
  return i18n.pick(STATUS_LABEL[status] || '收集中');
}

function statusTag(status) {
  return STATUS_TAG[status] || 'neutral';
}

/** 進度條寬度：0–100 的整數。goal 為 0 或壞值時不畫（回 0） */
function percentOf(count, goal) {
  const g = Number(goal) || 0;
  const c = Number(count) || 0;
  if (g <= 0) return c > 0 ? 100 : 0;
  return Math.max(0, Math.min(100, Math.round((c / g) * 100)));
}

/** 可以連署嗎：訪客不行、作者不行、已結案不行（後端仍會再擋一次） */
function canSupport(item, meId) {
  if (!item) return false;
  if (!meId) return false;
  if (item.isMine) return false;
  if (item.status === 'DONE' || item.status === 'DECLINED') return false;
  return !item.mySupported;
}

function decorateItem(item) {
  if (!item) return item;
  const author = item.author || {};
  const authorText = [author.nickname || '', author.className || ''].filter(Boolean).join(' · ');
  return Object.assign({}, item, {
    mark: categoryMark(item.category),
    categoryText: categoryLabel(item.category),
    statusText: statusLabel(item.status),
    statusTag: statusTag(item.status),
    authorText: authorText,
    timeText: item.createdAt ? fromNow(item.createdAt) : '',
    dateText: item.createdAt ? dateTimeText(item.createdAt) : '',
    replyText: item.repliedAt ? dateTimeText(item.repliedAt) : '',
    percent: percentOf(item.supportCount, item.goal),
    countText: i18n.pick('連署 ') + (item.supportCount || 0) + ' / ' + (item.goal || 0),
    closed: item.status === 'DONE' || item.status === 'DECLINED',
  });
}

module.exports = {
  CATEGORY_LABEL,
  CATEGORY_MARK,
  STATUS_LABEL,
  categoryLabel,
  categoryMark,
  statusLabel,
  statusTag,
  percentOf,
  canSupport,
  decorateItem,
};
