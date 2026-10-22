const { fromNow } = require('./date');

const TYPE_LABEL = { LOST: '失物', FOUND: '拾獲' };
const STATUS_LABEL = { OPEN: '待認領', CLAIMED: '已認領', CLOSED: '已完成' };
const STATUS_TAG = { OPEN: 'warning', CLAIMED: 'tint', CLOSED: 'neutral' };

function decorate(item) {
  if (!item) return item;
  return Object.assign({}, item, {
    typeLabel: TYPE_LABEL[item.type] || '',
    statusLabel: STATUS_LABEL[item.status] || item.status,
    statusTag: STATUS_TAG[item.status] || 'neutral',
    timeText: fromNow(item.happenedAt),
    cover: (item.images && item.images.length) ? item.images[0] : '',
    contactLabel:
      item.contactType === 'phone' ? (item.contactValue || '電話（登入後可見）')
        : item.contactType === 'wechat' ? '微信（登入後可見）'
        : '站內聯絡',
  });
}

module.exports = { TYPE_LABEL, STATUS_LABEL, STATUS_TAG, decorate };
