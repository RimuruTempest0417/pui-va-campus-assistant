const { dateTimeText } = require('./date');
const i18n = require('./i18n');

/**
 * 二手書／校服轉贈（W-68）的顯示轉換
 *
 * 為什麼要一支共用檔：清單、詳情、我的轉贈三個頁面都要回答「這是書還是校服」
 * 「能不能申請」「是誰送的」。三處各寫一次，遲早出現清單說可申請、詳情說已贈出。
 * 這裡只做顯示與文案，能不能申請永遠以後端回的 canRequest 為準。
 */

const KIND_LABEL = { BOOK: '書籍', UNIFORM: '校服', OTHER: '其他' };
const KIND_MARK = { BOOK: '書', UNIFORM: '服', OTHER: '物' };
const CONDITION_LABEL = { LIKE_NEW: '幾乎全新', GOOD: '良好', FAIR: '可用' };
const STATUS_LABEL = { AVAILABLE: '可申請', GIVEN: '已贈出', CLOSED: '已下架' };
const REQUEST_LABEL = { PENDING: '等物主回覆', ACCEPTED: '物主留給你', REJECTED: '這次沒選你', CANCELLED: '已取消' };

function kindLabel(kind) {
  return i18n.pick(KIND_LABEL[kind] || '其他');
}

/** 單字徽章：比彩色 emoji 穩定，也一眼分得出書／服／物 */
function kindMark(kind) {
  return i18n.pick(KIND_MARK[kind] || '物');
}

function conditionLabel(condition) {
  return i18n.pick(CONDITION_LABEL[condition] || '良好');
}

function statusLabel(status) {
  return i18n.pick(STATUS_LABEL[status] || status || '');
}

function requestLabel(status) {
  return i18n.pick(REQUEST_LABEL[status] || '等物主回覆');
}

function statusTag(status) {
  if (status === 'GIVEN') return 'neutral';
  if (status === 'CLOSED') return 'neutral';
  return 'success';
}

/** 一件轉贈物的顯示欄位（與後端 shapeItem 同名同義，頁面不用分來源） */
function decorateItem(item) {
  if (!item) return item;
  const detail = item.detail ? item.detail : '';
  return Object.assign({}, item, {
    mark: kindMark(item.kind),
    kindText: kindLabel(item.kind),
    conditionText: conditionLabel(item.condition),
    statusText: statusLabel(item.status),
    statusTag: statusTag(item.status),
    /** 一行副標：補充（年級／尺碼） · 面交地點（有才顯示） */
    metaText: [detail, item.pickupPlace ? i18n.pick('面交：') + item.pickupPlace : ''].filter(Boolean).join(' · '),
    /** 物主：暱稱＋班別（有才顯示） */
    ownerText: item.ownerClass ? item.ownerNickname + ' · ' + item.ownerClass : item.ownerNickname || '',
    timeText: item.createdAt ? dateTimeText(item.createdAt) : '',
    requestText: item.requestCount ? i18n.pick('已有 ') + item.requestCount + i18n.pick(' 人想要') : '',
    applyText: item.requestCount
      ? i18n.pick('已有 ') + item.requestCount + i18n.pick(' 人想要') + (item.pendingCount ? '（' + item.pendingCount + i18n.pick(' 待回覆') + '）' : '')
      : i18n.pick('還沒有人申請'),
    myRequestText: item.myRequest ? requestLabel(item.myRequest.status) : '',
    myRequestTag: item.myRequest
      ? item.myRequest.status === 'ACCEPTED'
        ? 'success'
        : item.myRequest.status === 'PENDING'
          ? 'warning'
          : 'neutral'
      : 'neutral',
  });
}

/** 我發出的申請（我的轉贈第二段） */
function decorateRequest(row) {
  if (!row) return row;
  return Object.assign({}, row, {
    mark: kindMark(row.item && row.item.kind),
    statusText: requestLabel(row.status),
    statusTag: row.status === 'ACCEPTED' ? 'success' : row.status === 'PENDING' ? 'warning' : 'neutral',
    timeText: row.createdAt ? dateTimeText(row.createdAt) : '',
    title: (row.item && row.item.title) || '',
    ownerText: (row.item && row.item.ownerNickname) || '',
    canCancel: row.status === 'PENDING',
  });
}

/** 物主看到的申請人（詳情頁） */
function decorateRequestRow(row) {
  if (!row) return row;
  return Object.assign({}, row, {
    statusText: requestLabel(row.status),
    statusTag: row.status === 'PENDING' ? 'warning' : row.status === 'ACCEPTED' ? 'success' : 'neutral',
    whoText: row.className ? row.nickname + ' · ' + row.className : row.nickname,
    timeText: row.createdAt ? dateTimeText(row.createdAt) : '',
    canDecide: row.status === 'PENDING',
  });
}

module.exports = {
  kindLabel,
  kindMark,
  conditionLabel,
  statusLabel,
  requestLabel,
  decorateItem,
  decorateRequest,
  decorateRequestRow,
  KIND_LABEL,
  CONDITION_LABEL,
  STATUS_LABEL,
};
