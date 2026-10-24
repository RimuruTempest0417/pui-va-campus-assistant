const { dateTimeText } = require('./date');

const i18n = require('./i18n');
const SIGNUP_LABEL = { CONFIRMED: '已報名', WAITLIST: '候補中' };
const signupLabel = (k) => (SIGNUP_LABEL[k] ? i18n.pick(SIGNUP_LABEL[k]) : '');

function myStatusOf(ev) {
  if (!ev) return '';
  if (ev.mySignup && ev.mySignup.status) return ev.mySignup.status;
  return ev.myStatus || '';
}

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
    capacityText: capacity > 0 ? signed + ' / ' + capacity + i18n.pick(' 人') : i18n.pick('不限名額 · ') + signed + i18n.pick(' 人已報名'),
    remaining: remaining,
    full: full,
    ended: ended,
    ratio: ratio,
    // 示範資料帶 mySignup、真 API 直接帶 myStatus —— 只讀其中一種，
    // 另一種模式下就會顯示成「沒有報名」（真 API 曾因此一直顯示「立即報名」）。
    myLabel: SIGNUP_LABEL[myStatusOf(ev)] || '',
    myStatus: myStatusOf(ev),
    waitlistPos: ev.mySignup ? ev.mySignup.waitlistPos : (ev.waitlistPos === undefined ? null : ev.waitlistPos),
  });
}

module.exports = { decorate, SIGNUP_LABEL };
