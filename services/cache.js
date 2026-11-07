// 離線快取（W-98）
//
// 規則只有三條，任何一條反過來就不是「快取」而是「假資料」：
//   1. **成功才寫**：只有真的打到後端、拿到 2xx 回應才落 storage。
//   2. **失敗才讀**：只有「連不上」（NETWORK／TIMEOUT／NO_BACKEND）才拿出來用；
//      權限不足、找不到、參數錯誤一律照原樣失敗。
//   3. **過期就當沒有**：預設 24 小時，過了就刪掉、照常顯示失敗。
//
// 兩個容易做錯的地方：
//   - key 一定要帶「身分指紋」與「參數」，否則拿 A 的成績給 B 看（家長的子女資料尤其危險）。
//   - 只快取讀取類；快取自己的寫入回應等於回使用者一個假的「已送出」。
const config = require('../config/config');

const PREFIX = 'pv_off:';
const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 小時
const MAX_ENTRY_CHARS = 120 * 1024; // 單筆上限：storage 總共 10 MB，一張清單不該吃掉大半
const MAX_ENTRIES = 24; // 超過就從最舊的開始丟

function storage() {
  return typeof wx !== 'undefined' && wx ? wx : null;
}

function hash(str) {
  let h = 5381;
  const s = String(str || '');
  for (let i = 0; i < s.length; i += 1) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** 參數正規化：key 的順序不能影響 cache key（{a,b} 與 {b,a} 是同一種查詢） */
function stable(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}';
}

/** token 不進 key（避免把 JWT 寫進 storage 的鍵名），只放指紋 */
function keyOf(name, params, token) {
  return PREFIX + config.VERSION + ':' + String(name) + ':' + hash(token) + ':' + hash(stable(params));
}

function allKeys() {
  const s = storage();
  if (!s || typeof s.getStorageInfoSync !== 'function') return [];
  try {
    const info = s.getStorageInfoSync() || {};
    return (info.keys || []).filter((k) => String(k).indexOf(PREFIX) === 0);
  } catch (e) {
    return [];
  }
}

function removeKey(key) {
  const s = storage();
  if (!s) return;
  try {
    s.removeStorageSync(key);
  } catch (e) {
    // 刪不掉只影響容量，不影響畫面
  }
}

/** 超過上限就丟最舊的（at 最小）。storage 滿了只會讓寫入失敗，不能讓頁面跟著掛。 */
function prune() {
  const list = allKeys();
  if (list.length <= MAX_ENTRIES) return 0;
  const s = storage();
  const items = list.map((k) => {
    let at = 0;
    try {
      const box = JSON.parse(s.getStorageSync(k));
      at = box && typeof box.at === 'number' ? box.at : 0;
    } catch (e) {
      at = 0;
    }
    return { k: k, at: at };
  });
  items.sort((a, b) => a.at - b.at);
  const drop = items.slice(0, items.length - MAX_ENTRIES);
  drop.forEach((item) => removeKey(item.k));
  return drop.length;
}

/**
 * 寫入一次成功的回應。
 * @param {string} name 資料層方法名（listNotices、timetable…）
 * @param {Array} params 呼叫參數（會正規化成 key）
 * @param {string} token 當時的 JWT（只取指紋；訪客傳空字串）
 * @param {*} value 後端回應
 * @param {number} [at] 覆寫時間（只在測試與自檢時用）
 * @returns {boolean} 有沒有真的寫進去
 */
function write(name, params, token, value, at) {
  const s = storage();
  if (!s || !name || value === undefined || value === null) return false;
  let raw = '';
  try {
    raw = JSON.stringify({ at: typeof at === 'number' ? at : Date.now(), value: value });
  } catch (e) {
    return false; // 含函式／循環引用就放棄，不要讓快取把主流程拖死
  }
  if (!raw || raw.length > MAX_ENTRY_CHARS) return false;
  try {
    s.setStorageSync(keyOf(name, params, token), raw);
    prune();
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 讀回上次成功的回應。沒有、壞掉、過期 → 一律回 null（呼叫端照原樣失敗）。
 * @param {number} [ttlMs] 不傳用 24 小時；0 代表一定過期（測試用）
 * @returns {{value:*, at:number}|null}
 */
function read(name, params, token, ttlMs) {
  const s = storage();
  if (!s) return null;
  const key = keyOf(name, params, token);
  let raw = '';
  try {
    raw = s.getStorageSync(key);
  } catch (e) {
    return null;
  }
  if (!raw) return null;
  let box = null;
  try {
    box = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (e) {
    removeKey(key);
    return null;
  }
  if (!box || typeof box.at !== 'number') {
    removeKey(key);
    return null;
  }
  const ttl = ttlMs === undefined ? DEFAULT_TTL : ttlMs;
  if (!(ttl > 0) || Date.now() - box.at > ttl) {
    removeKey(key);
    return null;
  }
  return { value: box.value, at: box.at };
}

/** 清掉全部（換後端位址、使用者登出、自檢頁重整時用） */
function clear() {
  const list = allKeys();
  list.forEach(removeKey);
  return list.length;
}

function size() {
  return allKeys().length;
}

module.exports = { DEFAULT_TTL, PREFIX, keyOf, write, read, clear, size, stable };
