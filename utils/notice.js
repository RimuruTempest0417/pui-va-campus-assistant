const { fromNow } = require('./date');

const KIND_LABEL = { NORMAL: '公告', URGENT: '緊急', CALENDAR: '校曆' };

function decorate(n) {
  if (!n) return n;
  return Object.assign({}, n, {
    kindLabel: KIND_LABEL[n.kind] || '公告',
    kindTag: n.kind === 'URGENT' ? 'danger' : n.kind === 'CALENDAR' ? 'tint' : 'neutral',
    timeText: fromNow(n.publishedAt),
    preview: (n.content || '').slice(0, 42),
  });
}

module.exports = { decorate, KIND_LABEL };
