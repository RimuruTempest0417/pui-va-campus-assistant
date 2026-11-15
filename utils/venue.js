// 場地／器材借用（W-67）的共用純函式：時間格式、時段選項、狀態文字。
// 為什麼要一支 util：真 API、示範層（mock）與三個頁面都要用同一套「澳門時間 → 顯示字串」，
// 各自寫一份的結果就是同一筆預約在詳情頁與我的預約顯示不同時間。
const KIND_LABEL = { VENUE: '場地', EQUIPMENT: '器材' };

const STATUS_LABEL = {
  PENDING: '待審批',
  APPROVED: '已批准',
  REJECTED: '未通過',
  CANCELLED: '已取消',
};

const WEEK_LABEL = ['日', '一', '二', '三', '四', '五', '六'];

function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}

/** 把 Date／ISO／timestamp 轉成澳門時間的 { ymd, y, m, d, minutes } */
function macauClock(value) {
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  // 澳門固定 UTC+8（沒有夏令時間）：用位移後的 UTC 欄位讀，不依賴手機時區設定
  const shifted = new Date(ms + 8 * 3600 * 1000);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth() + 1;
  const d = shifted.getUTCDate();
  return {
    y: y,
    m: m,
    d: d,
    ymd: y + '-' + pad2(m) + '-' + pad2(d),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

function hhmm(minutes) {
  const h = Math.floor(minutes / 60);
  return pad2(h) + ':' + pad2(minutes % 60);
}

/** 'YYYY-MM-DD' + 'HH:mm' → ISO 字串（澳門時間轉 UTC） */
function slotIso(ymd, time) {
  const parts = String(ymd).split('-').map(Number);
  const hm = String(time).split(':').map(Number);
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], hm[0] - 8, hm[1])).toISOString();
}

/** 資源的顯示欄位（與後端 shapeResource 同名同義，頁面不用分來源） */
function shapeResource(r, now) {
  const clock = macauClock(now || Date.now());
  const from = String(r.openFrom || '08:00').split(':').map(Number);
  const to = String(r.openTo || '18:00').split(':').map(Number);
  const openNow = clock.minutes >= from[0] * 60 + from[1] && clock.minutes < to[0] * 60 + to[1];
  return {
    id: r.id,
    kind: r.kind,
    kindLabel: KIND_LABEL[r.kind] || '場地',
    name: r.name,
    location: r.location || '',
    description: r.description || '',
    openFrom: r.openFrom,
    openTo: r.openTo,
    hoursText: (r.openFrom || '08:00') + '–' + (r.openTo || '18:00'),
    maxHours: r.maxHours || 4,
    needsApproval: r.needsApproval !== false,
    status: r.status || 'ACTIVE',
    version: r.version || 0,
    openNow: openNow,
    upcoming: r.upcoming || 0,
  };
}

/** 預約的顯示欄位（dateText／timeText 由這裡算，WXML 不做日期運算） */
function shapeBooking(b, now) {
  const start = macauClock(b.startAt);
  const end = macauClock(b.endAt);
  return {
    id: b.id,
    resourceId: b.resourceId,
    resource: b.resource || null,
    resourceName: b.resource ? b.resource.name : b.resourceName || '',
    userId: b.userId,
    user: b.user || null,
    startAt: typeof b.startAt === 'string' ? b.startAt : new Date(b.startAt).toISOString(),
    endAt: typeof b.endAt === 'string' ? b.endAt : new Date(b.endAt).toISOString(),
    dateText: start.ymd,
    timeText: hhmm(start.minutes) + '–' + hhmm(end.minutes),
    purpose: b.purpose || '',
    status: b.status,
    statusLabel: STATUS_LABEL[b.status] || b.status,
    rejectReason: b.rejectReason || '',
    past: new Date(b.endAt).getTime() < (now || Date.now()),
    canCancel: b.status === 'PENDING' || b.status === 'APPROVED',
  };
}

/** 選日期用：未來 N 天（今天起），label 例「11/07（五）」 */
function dateOptions(days) {
  const out = [];
  const clock = macauClock(Date.now());
  const base = Date.UTC(clock.y, clock.m - 1, clock.d);
  for (let i = 0; i < (days || 14); i += 1) {
    const d = new Date(base + i * 86400000);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    out.push({
      value: y + '-' + pad2(m) + '-' + pad2(day),
      label: (i === 0 ? '今天 ' : i === 1 ? '明天 ' : '') + pad2(m) + '/' + pad2(day) + '（' + WEEK_LABEL[d.getUTCDay()] + '）',
    });
  }
  return out;
}

/** 選時間用：整點與半點（08:00–21:30），由頁面再依資源的開放時間過濾 */
function timeOptions() {
  const out = [];
  for (let m = 8 * 60; m <= 21 * 60 + 30; m += 30) {
    out.push({ value: hhmm(m), label: hhmm(m) });
  }
  return out;
}

/** 時段是否重疊（半開區間，和後端同規則） */
function overlaps(aStart, aEnd, bStart, bEnd) {
  return new Date(aStart).getTime() < new Date(bEnd).getTime() && new Date(aEnd).getTime() > new Date(bStart).getTime();
}

module.exports = {
  KIND_LABEL: KIND_LABEL,
  STATUS_LABEL: STATUS_LABEL,
  macauClock: macauClock,
  hhmm: hhmm,
  slotIso: slotIso,
  shapeResource: shapeResource,
  shapeBooking: shapeBooking,
  dateOptions: dateOptions,
  timeOptions: timeOptions,
  overlaps: overlaps,
};
