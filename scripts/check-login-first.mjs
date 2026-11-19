#!/usr/bin/env node
/**
 * 登入守門自檢（v1.0.15）
 *
 * Gary 定案：「小程序進入的頁面改成直接登入帳號，沒有登入不能使用」。
 * 這支把四件事釘住，以後有人改回去就紅：
 *   ① app.json 的第一頁就是登入頁
 *   ② 每個主入口頁的 onShow／onLoad 第一件事就是 authGuard.guard()
 *   ③ 登出會 reLaunch 回登入頁（不是只清 token 留在原頁）
 *   ④ 401（登入態失效）也會被帶回登入頁
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (p) => readFileSync(join(root, p), 'utf8');
let fail = 0;
const ok = (cond, label, detail = '') => {
  console.log(`${cond ? '✅' : '❌'} ${label}${detail ? '  ' + detail : ''}`);
  if (!cond) fail += 1;
};

// ① 入口頁
const appJson = JSON.parse(read('app.json'));
ok(appJson.pages[0] === 'pages/admin/login/index', '第一頁是登入頁', appJson.pages[0]);

// ② 主入口頁都要有守門
const PAGES = [
  'pages/index/index.js',
  'pages/settings/index.js',
  'pages/notifications/index.js',
  'pages/timetable/index.js',
  'pages/homework/index.js',
  'pages/menu/index/index.js',
  'pages/school/index.js',
  'pages/study/index.js',
  'pages/parent/index.js',
  'pages/admin/index/index.js',
  'pages/search/index.js',
];
for (const p of PAGES) {
  const src = read(p);
  const has = src.includes("require('../") && src.includes('auth-guard') && src.includes('authGuard.guard()');
  ok(has, `${p} 有登入守門`);
}

// ③ 登出要回登入頁
const settings = read('pages/settings/index.js');
ok(
  /logout\(\)[\s\S]{0,600}reLaunch\(\{ url: '\/pages\/admin\/login\/index' \}\)/.test(settings),
  '登出後 reLaunch 回登入頁',
);

// ④ 401 也會回登入頁
const request = read('utils/request.js');
ok(
  /dropSession\(\);[\s\S]{0,600}reason=expired/.test(request),
  '登入態失效（401）帶回登入頁',
);

// ⑤ 已登入的人開登入頁會被送去首頁（否則每次開程式都停在登入頁）
const login = read('pages/admin/login/index.js');
ok(/from !== 'switch' && request\.getToken\(\)/.test(login), '已登入自動進首頁');

// ⑥ 版本過舊要擋下來（v1.0.16）
const appJs = read('app.js');
ok(appJs.includes('versionCheck.check()'), '開機檢查版本');
ok(appJs.includes('versionCheck.watchUpdate()'), '接微信更新管理器');
const vc = read('utils/version-check.js');
ok(vc.includes("request\n") || vc.includes(".get('/app/version'"), '版本檢查打 /app/version');
ok(/compare\(config\.VERSION, min\) < 0/.test(vc), '版本較舊就擋 modal');

// ⑦ 家校通憑證：登入時就存好，不再叫使用者另外綁定（v1.0.18）
const loginSrc = read('pages/admin/login/index.js');
ok(/加密保存這組帳密/.test(loginSrc), '登入頁說明「會加密保存」');
ok(!/不會儲存你的家校通密碼/.test(loginSrc), '登入頁不再寫「不會儲存密碼」');
ok(!/系統不會保存/.test(read('pages/help/index.js')), '使用說明不再寫「系統不會保存」');

// ⑧ 家校通連結只有後台能管（v1.0.19）
const schoolWxml = read('pages/school/index.wxml');
ok(!schoolWxml.includes('bind:tap="link"'), '小程式成績頁沒有「連結家校通」按鈕');
ok(!schoolWxml.includes('bind:tap="unlink"'), '小程式成績頁沒有「解除連結」按鈕');
// 後端是同一個 workspace 的兄弟資料夾；不在就跳過（只跑前端的人不該因此紅）
const adminPath = join(root, '../../pui-va-campus-server/public/admin.html');
if (existsSync(adminPath)) {
  const adminHtml = readFileSync(adminPath, 'utf8');
  ok(adminHtml.includes('data-sec="schoolLinks"'), '網頁後台有家校通分頁');
  ok(adminHtml.includes('/admin/school-links'), '網頁後台打 /admin/school-links');
}

// ⑨ 題庫／說明不能再寫「訪客可以看」
const help = read('pages/help/index.js');
ok(!help.includes('沒登入也可以'), '使用說明不再寫「沒登入也可以看…」');

console.log('');
if (fail) {
  console.log(`登入守門檢查失敗：${fail} 項`);
  process.exit(1);
}
console.log('✅ 登入守門檢查通過（一開即登入、沒登入不能用）');
