// 離線資料的「標籤」（W-98）
//
// services/data.js 在回快取時會呼叫 note()；頁面在載入前 reset()、載入後 text() 取
// 「離線資料 · 上次更新 14:32」這句話。**畫面一定要寫出來**：Gary 明確反對靜默降級，
// 使用者看到的必須分得出「這是剛剛抓的」還是「這是上次抓的」。
//
// 這裡只放數字格式，文字一律由頁面用 i18n 文案帶進來（繁簡切換才跟著換）。
const cache = require('../services/cache');

let hits = [];

function reset() {
  hits = [];
}

function note(name, at) {
  if (!name || !at) return;
  hits.push({ name: name, at: at });
}

/**
 * 這一批載入裡「哪幾支呼叫吃了快取」。
 * at 取最舊的那一筆 —— 一句「上次更新」只能寫一個時間，寫最新的會讓人以為很新。
 */
function info() {
  if (!hits.length) return null;
  let at = hits[0].at;
  const names = [];
  hits.forEach((h) => {
    if (h.at < at) at = h.at;
    if (names.indexOf(h.name) === -1) names.push(h.name);
  });
  return { at: at, count: hits.length, names: names };
}

function pad2(n) {
  return n < 10 ? '0' + n : '' + n;
}

/** 時間戳 → 「14:32」（今天）／「11/05 08:20」（不是今天） */
function stamp(ts, now) {
  const t = new Date(ts);
  const n = new Date(typeof now === 'number' ? now : Date.now());
  const sameDay = t.getFullYear() === n.getFullYear() && t.getMonth() === n.getMonth() && t.getDate() === n.getDate();
  const time = pad2(t.getHours()) + ':' + pad2(t.getMinutes());
  return sameDay ? time : pad2(t.getMonth() + 1) + '/' + pad2(t.getDate()) + ' ' + time;
}

/** 畫面文字：i18n 前綴 ＋ 時間；沒有吃快取就回空字串（橫幅不顯示） */
function text(prefix, now) {
  const i = info();
  if (!i) return '';
  const parts = [];
  if (prefix) parts.push(prefix);
  parts.push(stamp(i.at, now));
  return parts.join(' ');
}

module.exports = { reset: reset, note: note, info: info, stamp: stamp, text: text, clear: cache.clear };
