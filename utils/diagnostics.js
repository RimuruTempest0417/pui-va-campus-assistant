// 執行期 console 走查（error／warn 收集器）
// 為什麼要有：DevTools 的 console 面板只有人眼在看，而且 get_simulator_console 只回啟動那兩行，
// 19 頁「有沒有 error」根本無法重跑。這裡把 console.error／console.warn 包一層，寫進 storage，
// 再用 scripts/check-console.mjs 逐頁讀回來比對 —— 這樣才會變成可重跑的綠燈，而不是「我記得看起來沒紅」。
//
// 三條規矩：
// ① 不改行為：包完一定呼叫原本的 console，訊息照樣出現在 DevTools。
// ② 絕不自己製造錯誤：storage 讀寫全部 try/catch，收集器壞掉也不能讓頁面掛掉。
// ③ 只留最近 40 則，避免長跑把 storage 撐爆。
const config = require('../config/config');

const LIMIT = 40;
let installed = false;
let writing = false;

function route() {
  try {
    const pages = getCurrentPages();
    const page = pages[pages.length - 1];
    return page && page.route ? page.route : '';
  } catch (e) {
    return '';
  }
}

function textOf(args) {
  const parts = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === null || a === undefined) parts.push(String(a));
    else if (typeof a === 'string') parts.push(a);
    else if (a instanceof Error) parts.push(a.message || String(a));
    else {
      try {
        parts.push(JSON.stringify(a));
      } catch (e) {
        parts.push(String(a));
      }
    }
  }
  return parts.join(' ').slice(0, 400);
}

function push(level, args) {
  if (writing) return;
  writing = true;
  try {
    const key = config.STORAGE_KEYS.diag;
    const list = wx.getStorageSync(key) || [];
    list.push({ level: level, text: textOf(args), route: route(), at: Date.now() });
    while (list.length > LIMIT) list.shift();
    wx.setStorageSync(key, list);
  } catch (e) {
    // 收集器自己壞掉就安靜，不要讓使用者看到新的錯誤
  }
  writing = false;
}

/**
 * 掛上收集器。重複呼叫安全（只包一次）。
 * 一定要在 App.onLaunch 呼叫，否則頁面 onLoad 期間的錯誤會漏掉。
 */
function install() {
  if (installed) return;
  if (typeof console === 'undefined' || !console.error) return;
  const rawError = console.error;
  const rawWarn = console.warn;
  console.error = function () {
    push('error', arguments);
    return rawError.apply(console, arguments);
  };
  console.warn = function () {
    push('warn', arguments);
    return rawWarn.apply(console, arguments);
  };
  installed = true;
}

/** 讀回目前的收集結果（自檢頁用；走查腳本直接讀 storage） */
function list() {
  try {
    return wx.getStorageSync(config.STORAGE_KEYS.diag) || [];
  } catch (e) {
    return [];
  }
}

function clear() {
  try {
    wx.removeStorageSync(config.STORAGE_KEYS.diag);
  } catch (e) {
    // 清不掉就算了
  }
}

module.exports = { install, list, clear };
