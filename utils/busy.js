/**
 * 全域「正在載入」計數器（v1.0.3）。
 *
 * 為什麼需要：家校通同步一次要八秒以上，小程序在這段時間只有一片空白，
 * 使用者的第一個念頭是「是不是卡住了」，於是重複點、以為壞掉。這裡只做一件事：
 * 告訴頁面「現在有請求在跑」，讓頁面畫一條會動的進度條 —— 有動靜就不像當機。
 *
 * 兩條規矩（不做會比沒有更差）：
 * ① 250ms 內就結束的請求不顯示：切頁時條一直閃，看起來像畫面在抽動。
 * ② 歸零後再留 320ms 才收起：連續幾個請求之間條不要一閃一閃。
 *
 * 刻意不用 setInterval 輪詢：狀態只在 begin／end 時算一次，閒置時零開銷。
 */
const SHOW_DELAY_MS = 250;
const HIDE_DELAY_MS = 320;

let count = 0;
let visible = false;
let showTimer = null;
let hideTimer = null;
const listeners = [];

function notify() {
  listeners.slice().forEach((fn) => {
    try {
      fn(visible);
    } catch (e) {
      // 單一訂閱者出錯不能影響其他人（頁面卸載後仍被通知的情況）
    }
  });
}

function setVisible(next) {
  if (visible === next) return;
  visible = next;
  notify();
}

function begin() {
  count += 1;
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  if (visible || showTimer) return;
  showTimer = setTimeout(() => {
    showTimer = null;
    if (count > 0) setVisible(true);
  }, SHOW_DELAY_MS);
}

function end() {
  count = Math.max(0, count - 1);
  if (count > 0) return;
  if (showTimer) {
    clearTimeout(showTimer);
    showTimer = null;
    return;
  }
  if (!visible || hideTimer) return;
  hideTimer = setTimeout(() => {
    hideTimer = null;
    if (count === 0) setVisible(false);
  }, HIDE_DELAY_MS);
}

/** 訂閱會立刻先收到一次目前狀態，元件掛載時不必另外問 */
function subscribe(fn) {
  listeners.push(fn);
  fn(visible);
  return () => {
    const i = listeners.indexOf(fn);
    if (i !== -1) listeners.splice(i, 1);
  };
}

module.exports = { begin, end, subscribe, isActive: () => visible, pending: () => count };
