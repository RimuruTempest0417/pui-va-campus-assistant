function pad(n) { return n < 10 ? '0' + n : '' + n; }

/** 本地日期 key：2026-10-22（不要用 toISOString，會被時區推到前一天） */
function dateKey(d) {
  const dt = d || new Date();
  return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
}

const i18n = require('./i18n');
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
function weekday(d) { return i18n.pick('週') + WEEK[(d || new Date()).getDay()]; }

function greeting(d) {
  const h = (d || new Date()).getHours();
  if (h < 6) return i18n.pick('夜深了');
  if (h < 12) return i18n.pick('早安');
  if (h < 18) return i18n.pick('午安');
  return i18n.pick('晚安');
}

/**
 * 相對時間：剛剛 / 12 分鐘前 / 3 小時前 / 2 天前
 * 真 API 回的是 ISO 字串（2026-10-24T20:32:49.922Z），示範資料是毫秒數字 —— 兩種都要吃。
 * 舊版一律 Number(ts)，ISO 字串會變 NaN，畫面出現「NaN 天前」（與 dateTimeText 同一個坑）。
 */
function fromNow(ts) {
  if (ts === null || ts === undefined || ts === '') return ''; // 沒有時間就不要編一個「1970 年」出來
  const numeric = typeof ts === 'number' || (typeof ts === 'string' && /^\d+$/.test(ts));
  const at = numeric ? Number(ts) : new Date(ts || 0).getTime();
  const diff = Date.now() - (Number.isFinite(at) ? at : Date.now());
  if (diff < 60 * 1000) return i18n.pick('剛剛');
  if (diff < 3600 * 1000) return Math.floor(diff / 60000) + i18n.pick(' 分鐘前');
  if (diff < 24 * 3600 * 1000) return Math.floor(diff / 3600000) + i18n.pick(' 小時前');
  return Math.floor(diff / 86400000) + i18n.pick(' 天前');
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
