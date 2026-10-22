const { dateTimeText } = require('./date');

const SIGNUP_LABEL = { CONFIRMED: '已報名', WAITLIST: '候補中' };

function decorate(ev) {
  if (!ev) return ev;
  const capacity = Number(ev.capacity) || 0;
  const signed = Number(ev.signedCount) || 0;
  const remaining = capacity > 0 ? Math.max(0, capacity - signed) : null;
  const ratio = capacity > 0 ? Math.min(100, Math.round((signed / capacity) * 100)) : 0;
  const full = capacity > 0 && signed >= capacity;
  const ended = ev.status === 'FINISHED' || Number(ev.startAt) < Date.now();

  return Object.assign({}, ev, {
    timeText: dateTimeText(ev.startAt),
    endText: ev.endAt ? dateTimeText(ev.endAt) : '',
    capacityText: capacity > 0 ? signed + ' / ' + capacity + ' 人' : '不限名額 · ' + signed + ' 人已報名',
    remaining: remaining,
    full: full,
    ended: ended,
    ratio: ratio,
    myLabel: ev.mySignup ? SIGNUP_LABEL[ev.mySignup.status] || '' : '',
    myStatus: ev.mySignup ? ev.mySignup.status : '',
    waitlistPos: ev.mySignup ? ev.mySignup.waitlistPos : null,
  });
}

module.exports = { decorate, SIGNUP_LABEL };
