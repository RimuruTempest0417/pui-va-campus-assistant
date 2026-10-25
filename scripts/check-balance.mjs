#!/usr/bin/env node
/**
 * 讀 DeepSeek 餘額（給排程任務用）。
 *
 * 為什麼要一支腳本：排程的 prompt 裡塞多行 AppleScript 很容易被跳脫字元弄壞，
 * 而且**不刷新就會拿到舊值**（實測差 ¥8–10）。這支固定做三件事：
 *   1. 找到 Safari 裡含 "deepseek" 的分頁 → location.reload()
 *   2. 等 8 秒（頁面是 SPA，要等數字渲染）
 *   3. 讀 innerText，抓「充值余额 ¥x」＋「赠送余额 ¥y」
 * 輸出固定格式，方便排程直接判斷：
 *   BALANCE_TOTAL=29.65 RECHARGE=29.65 GIFT=0.00
 *   BALANCE_UNKNOWN reason=no-tab      （Safari 沒開那個分頁）
 *   BALANCE_UNKNOWN reason=js-blocked  （Safari 未允許「從 Apple 事件執行 JavaScript」）
 */
import { execFileSync } from 'node:child_process';

const run = (script) => {
  try {
    return execFileSync('osascript', ['-e', script], { encoding: 'utf8' }).trim();
  } catch (e) {
    return '';
  }
};

const RELOAD = `tell application "Safari"
  repeat with w in windows
    repeat with t in tabs of w
      if (URL of t) contains "deepseek" then
        do JavaScript "location.reload()" in t
        return "reloaded"
      end if
    end repeat
  end repeat
  return "notab"
end tell`;

const READ = `tell application "Safari"
  set out to ""
  repeat with w in windows
    repeat with t in tabs of w
      if (URL of t) contains "deepseek" then
        set out to (do JavaScript "document.body.innerText" in t)
      end if
    end repeat
  end repeat
  return out
end tell`;

const reload = run(RELOAD);
if (!reload || reload === 'notab') {
  console.log('BALANCE_UNKNOWN reason=no-tab');
  process.exit(0);
}
if (reload !== 'reloaded') {
  console.log('BALANCE_UNKNOWN reason=js-blocked');
  process.exit(0);
}

const sleep = (ms) => execFileSync('sleep', [String(ms / 1000)]);
sleep(8000);

const text = run(READ).replace(/\s+/g, ' ');
const pick = (label) => {
  const m = text.match(new RegExp(label + '[^¥]*¥\\s*([\\d.]+)'));
  return m ? Number(m[1]) : null;
};

const recharge = pick('充值余额');
const gift = pick('赠送余额');
if (recharge === null) {
  console.log('BALANCE_UNKNOWN reason=parse (頁面可能還沒載完，或不是用量頁)');
  process.exit(0);
}
const total = Math.round((recharge + (gift ?? 0)) * 100) / 100;
console.log(`BALANCE_TOTAL=${total.toFixed(2)} RECHARGE=${recharge.toFixed(2)} GIFT=${(gift ?? 0).toFixed(2)}`);
console.log(`LOW=${total < 12 ? 'yes' : 'no'}`);
