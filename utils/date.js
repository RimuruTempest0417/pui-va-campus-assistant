function pad(n) { return n < 10 ? '0' + n : '' + n; }

/** 本地日期 key：2026-10-22（不要用 toISOString，會被時區推到前一天） */
function dateKey(d) {
  const dt = d || new Date();
  return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
}

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
function weekday(d) { return '週' + WEEK[(d || new Date()).getDay()]; }

function greeting(d) {
  const h = (d || new Date()).getHours();
  if (h < 6) return '夜深了';
  if (h < 12) return '早安';
  if (h < 18) return '午安';
  return '晚安';
}

/** 相對時間：剛剛 / 12 分鐘前 / 3 小時前 / 2 天前 */
function fromNow(ts) {
  const diff = Date.now() - Number(ts || 0);
  if (diff < 60 * 1000) return '剛剛';
  if (diff < 3600 * 1000) return Math.floor(diff / 60000) + ' 分鐘前';
  if (diff < 24 * 3600 * 1000) return Math.floor(diff / 3600000) + ' 小時前';
  return Math.floor(diff / 86400000) + ' 天前';
}

function clock(d) {
  const dt = d || new Date();
  return pad(dt.getHours()) + ':' + pad(dt.getMinutes());
}

/**
 * 後端回的是 ISO 字串（2026-10-24T20:32:49.922Z），示範資料是毫秒數字 ——
 * 兩種都吃。之前一律 Number(ts)，ISO 字串會變成 NaN，畫面就出現「NaN/NaN（undefined）」。
 */
function dateTimeText(ts) {
  const numeric = typeof ts === 'number' || (typeof ts === 'string' && /^\d+$/.test(ts));
  const dt = new Date(numeric ? Number(ts) : ts);
  const W = ['日', '一', '二', '三', '四', '五', '六'];
  return (dt.getMonth() + 1) + '/' + dt.getDate() + '（' + W[dt.getDay()] + '）' + pad(dt.getHours()) + ':' + pad(dt.getMinutes());
}

module.exports = { dateKey, weekday, greeting, fromNow, clock, dateTimeText };
