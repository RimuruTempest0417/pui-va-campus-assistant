const { fromNow, dateTimeText } = require('./date');
const i18n = require('./i18n');

const TYPE_LABEL = { LOST: '失物', FOUND: '拾獲' };
// MATCHED 是後端內部狀態（有人申請、還沒批），公開清單也會出現，不給標籤就會印出英文原值
const STATUS_LABEL = { OPEN: '待認領', MATCHED: '有人申請', CLAIMED: '已認領', CLOSED: '已完成' };
const STATUS_TAG = { OPEN: 'warning', MATCHED: 'tint', CLAIMED: 'tint', CLOSED: 'neutral' };

const CLAIM_STATUS_LABEL = { PENDING: '待審核', APPROVED: '已通過', REJECTED: '未通過' };
const CLAIM_STATUS_TAG = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'neutral' };

// 用字面值 pick()：對照表建置腳本只收字面值，走查表會漏收（切簡體時這些字不變）
function statusLabel(status) {
  if (status === 'OPEN') return i18n.pick('待認領');
  if (status === 'MATCHED') return i18n.pick('有人申請');
  if (status === 'CLAIMED') return i18n.pick('已認領');
  if (status === 'CLOSED') return i18n.pick('已完成');
  return status;
}

function claimStatusLabel(status) {
  if (status === 'PENDING') return i18n.pick('待審核');
  if (status === 'APPROVED') return i18n.pick('已通過');
  if (status === 'REJECTED') return i18n.pick('未通過');
  return status;
}

/** 我的認領卡片：把狀態翻成中文，並附「申請於／處理於」兩種時間 */
function decorateClaim(claim) {
  if (!claim) return claim;
  const item = claim.item || {};
  return Object.assign({}, claim, {
    statusLabel: claimStatusLabel(claim.status),
    statusTag: CLAIM_STATUS_TAG[claim.status] || 'neutral',
    itemTitle: item.title || '',
    itemId: item.id || '',
    categoryName: item.categoryName || '',
    place: item.place || '',
    typeLabel: i18n.pick(TYPE_LABEL[item.type] || ''),
    appliedText: claim.createdAt ? dateTimeText(claim.createdAt) : '',
    handledText: claim.handledAt ? dateTimeText(claim.handledAt) : '',
    handled: Boolean(claim.handledAt),
  });
}

function decorate(item) {
  if (!item) return item;
  return Object.assign({}, item, {
    typeLabel: i18n.pick(TYPE_LABEL[item.type] || ''),
    statusLabel: statusLabel(item.status) || item.status,
    statusTag: STATUS_TAG[item.status] || 'neutral',
    timeText: fromNow(item.happenedAt),
    cover: (item.images && item.images.length) ? item.images[0] : '',
    contactLabel:
      item.contactType === 'phone' ? (item.contactValue || i18n.pick('電話（登入後可見）'))
        : item.contactType === 'wechat' ? i18n.pick('微信（登入後可見）')
        : i18n.pick('站內聯絡'),
  });
}

module.exports = { TYPE_LABEL, STATUS_LABEL, STATUS_TAG, decorate, decorateClaim };
