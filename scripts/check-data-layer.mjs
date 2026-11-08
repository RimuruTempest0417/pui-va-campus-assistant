#!/usr/bin/env node
// 資料層自我檢查（Node 版，不需要微信開發者工具、不需要後端）
// 用 wx storage 的記憶體替身載入 services/data.js，跑與頁面相同的 9 項檢查。
// CI 也會跑這支：node scripts/check-data-layer.mjs

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

// ── wx 的最小替身（只實作這個專案用到的 storage）──
const store = new Map();
globalThis.wx = {
  getStorageSync: (k) => (store.has(k) ? store.get(k) : ''),
  setStorageSync: (k, v) => void store.set(k, v),
  removeStorageSync: (k) => void store.delete(k),
  getStorageInfoSync: () => ({ keys: Array.from(store.keys()) }),
  // W-98：離線快取那一段要驗「連不上後端」的行為，所以 request 一律失敗。
  // 這支腳本從頭到尾不打任何後端（示範模式不會呼叫它）。
  request: (opts) => {
    setTimeout(() => {
      if (opts && typeof opts.fail === 'function') opts.fail({ errMsg: 'request:fail' });
    }, 0);
  },
};

// 這支檢查的對象是「示範資料層」，所以先明確打開離線示範開關，
// 不受 config.DEMO_MODE 預設值（'off'）影響 —— 否則在 Node 裡會去打 wx.request。
store.set('pv_force_demo', '1');

const data = require(join(here, '..', 'services', 'data.js'));

if (!data.isDemo()) {
  console.error('❌ 無法啟用示範模式，檢查中止（data.isDemo() 應為 true）');
  process.exit(1);
}

const results = [];
const check = (name, ok, value) => results.push({ name, ok: !!ok, value: String(value) });

// 從乾淨狀態開始
data.resetDemo();

const me = await data.me();
check('登入身分', me && me.nickname, `${me.nickname} / ${me.role}`);

const list1 = await data.listItems({});
check('失物列表', list1.items.length >= 4, `${list1.items.length} 筆`);

const created = await data.createItem({
  type: 'LOST',
  title: '自我檢查用物品',
  place: '測試地點',
  description: '由檢查腳本建立',
});
const list2 = await data.listItems({});
check('發布失物', list2.items.length === list1.items.length + 1, `新增後總數 ${list2.items.length}`);

const firstNow = await data.listItems({ page: 1, pageSize: 10 });
check('發布後排在最前', firstNow.items[0] && firstNow.items[0].id === created.id, firstNow.items[0] ? firstNow.items[0].title : '空');

const found = await data.listItems({ type: 'FOUND' });
check('型別篩選', found.items.every((i) => i.type === 'FOUND'), `FOUND ${found.items.length} 筆`);

const search = await data.listItems({ q: '測試地點' });
check('關鍵字搜尋', search.items.length === 1, `命中 ${search.items.length} 筆`);

// 認領：用別人貼的示範物品（i7 藍色保溫瓶），不能用自己剛發布的那筆 ——
// 後端本來就禁止認領自己的物品，自檢如果拿自己建的來試，等於在驗一條不存在的路徑。
const claimBefore = await data.myClaims();
await data.claimItem('i7');
let claimErr = '';
try {
  await data.claimItem('i7');
} catch (e) {
  claimErr = e.code;
}
check('重複認領被擋', claimErr === 'ALREADY_CLAIMED', claimErr || '沒有擋下');

let ownClaimErr = '';
try {
  await data.claimItem(created.id);
} catch (e) {
  ownClaimErr = e.code;
}
check('不能認領自己發布的物品', ownClaimErr === 'VALIDATION_FAILED', ownClaimErr || '沒有擋下');

const claimList = await data.myClaims();
check('我的認領有資料', claimList.items.length === claimBefore.items.length + 1, `${claimList.items.length} 筆`);
check('我的認領帶物品摘要', claimList.items[0] && claimList.items[0].item && claimList.items[0].item.title === '藍色保溫瓶', claimList.items[0] ? claimList.items[0].item.title : '空');
check('我的認領狀態為待審核', claimList.items[0] && claimList.items[0].status === 'PENDING', claimList.items[0] ? claimList.items[0].status : '空');
check('我的認領依申請時間新到舊', claimList.items.every((c, i) => i === 0 || claimList.items[i - 1].createdAt >= c.createdAt), `${claimList.items.length} 筆`);

// 滿額 → 進候補（不是丟錯，而是回傳 WAITLIST 並帶候補位置）
const fullRec = await data.signupEvent('e2'); // 名額 20 / 已報 20
check('滿額轉候補', fullRec.status === 'WAITLIST' && fullRec.waitlistPos >= 1, `${fullRec.status} 第 ${fullRec.waitlistPos} 位`);

const okSignup = await data.signupEvent('e1'); // 名額 40 / 已報 37
check('有名額可報名', okSignup && okSignup.status === 'CONFIRMED', okSignup.status);

// 候補補位：e4 只有 1 個名額，A 報名後 B 只能進候補；A 取消後 B 自動補位
const userA = await data.me();
await data.signupEvent('e4');
await data.switchDemoUser('候補同學', 'demo-user-b');
const bSignup = await data.signupEvent('e4');
check('第二人自動進候補', bSignup.status === 'WAITLIST' && bSignup.waitlistPos === 1, `${bSignup.status} 第 ${bSignup.waitlistPos} 位`);
const bCancel = await data.cancelSignup('e4'); // B 取消候補
check('候補可取消', bCancel.cancelled === true, 'OK');
await data.switchDemoUser(userA.nickname, userA.id);
const aCancel = await data.cancelSignup('e4'); // A 取消（此時沒人候補）
check('正式報名可取消', aCancel.cancelled === true, 'OK');

const menu = await data.weekMenu();
check('當週菜單', menu.days.length >= 1, `${menu.days.length} 天`);

const notices = await data.listNotices();
check('公告置頂優先', notices.items[0].isPinned, notices.items[0].title);

const msg = data.messageOf({ code: 'EVENT_FULL' });
check('錯誤碼轉文案', msg.includes('候補'), msg);

const isDemoMode = data.isDemo();
check('模式判定（無 API 時為示範）', isDemoMode, isDemoMode ? '示範模式' : '真實 API');


// ── 失物模組（W-4）──
const cats = await data.categories();
check('分類清單', cats.items.length >= 5, `${cats.items.length} 個分類`);

const filteredCat = await data.listItems({ categoryKey: 'phone' });
check('分類篩選', filteredCat.items.every((i) => i.categoryKey === 'phone') && filteredCat.items.length >= 1, `電子產品 ${filteredCat.items.length} 筆`);

const page1 = await data.listItems({ page: 1, pageSize: 2 });
const page2 = await data.listItems({ page: 2, pageSize: 2 });
check('分頁', page1.items.length === 2 && page2.page === 2, `第1頁 ${page1.items.length} 筆 / hasMore=${page1.hasMore}`);

const detail = await data.getItem('i2');
check('取得詳情', detail && detail.id === 'i2' && detail.viewCount > 0, `瀏覽 ${detail.viewCount} 次`);

const fresh = await data.createItem({ type: 'LOST', title: '狀態流轉測試', place: '禮堂', description: '' });
const mineAfter = await data.myItems();
check('我的發布包含新建', mineAfter.items.some((i) => i.id === fresh.id), `${mineAfter.items.length} 筆`);

const step1 = (await data.updateItemStatus(fresh.id, 'CLAIMED')).status;
const step2 = (await data.updateItemStatus(fresh.id, 'CLOSED')).status;
check('狀態流轉 OPEN→CLAIMED→CLOSED', step1 === 'CLAIMED' && step2 === 'CLOSED', `${step1} → ${step2}`);

let bad = '';
try {
  await data.updateItemStatus(fresh.id, 'OPEN'); // 已完成不可回頭
} catch (e) {
  bad = e.code;
}
check('非法狀態被擋', bad === 'VALIDATION_FAILED', bad || '沒有擋下');


// ── 菜單與評分（W-6）──
const menuNow = await data.weekMenu({ offset: 0 });
const menuNext = await data.weekMenu({ offset: 1 });
check('週菜單 5 天', menuNow.days.length === 5, `${menuNow.days.length} 天`);
check('切換週次換日期', menuNow.dates[0] !== menuNext.dates[0], `${menuNow.dates[0]} vs ${menuNext.dates[0]}`);
check('每天有午餐', menuNow.days.every((d) => d.lunch.length >= 1), `午餐 ${menuNow.days[0].lunch.length} 道`);

const dishBefore = await data.getDish('d3');
const afterRate = await data.rateDish('d3', { score: 5, liked: true });
check('評分計入平均', afterRate.ratingCount === dishBefore.ratingCount + 1 && afterRate.avgScore > 0,
  `${dishBefore.ratingCount} → ${afterRate.ratingCount} 人，平均 ${afterRate.avgScore}`);

const afterChange = await data.rateDish('d3', { score: 1, liked: false });
check('一人一評（改分不重複計數）', afterChange.ratingCount === afterRate.ratingCount && afterChange.myScore === 1,
  `人數仍 ${afterChange.ratingCount}，我的分數 ${afterChange.myScore}`);

const top = await data.topDishes({ limit: 3 });
check('熱門排行', top.items.length === 3 && top.items[0].avgScore >= top.items[1].avgScore, top.items.map((x) => x.name).join(' > '));

let badScore = '';
try {
  await data.rateDish('d3', { score: 9 });
} catch (e) {
  badScore = e.code;
}
check('評分範圍被擋', badScore === 'VALIDATION_FAILED', badScore || '沒有擋下');


// ── 公告（W-7）──
const noticesAll = await data.listNotices({});
const hasExpired = noticesAll.items.some((n) => n.id === 'n5');
check('過期公告被隱藏', !hasExpired, `列表 ${noticesAll.items.length} 則`);
const pinnedFirst = noticesAll.items.slice(0, 2).every((n) => n.isPinned);
check('置頂永遠在前', pinnedFirst, noticesAll.items.map((n) => (n.isPinned ? '★' : '·') + n.title.slice(0, 4)).join(' '));
check('緊急公告存在', noticesAll.items.some((n) => n.kind === 'URGENT'), `URGENT ${noticesAll.items.filter((n) => n.kind === 'URGENT').length} 則`);
check('未讀數正確', noticesAll.unread === noticesAll.items.length, `${noticesAll.unread} / ${noticesAll.items.length}`);

const detailNotice = await data.getNotice('n2');
const afterOpen = await data.listNotices({});
const n2 = afterOpen.items.filter((n) => n.id === 'n2')[0];
check('打開公告即已讀', n2.isRead === true && afterOpen.unread < noticesAll.unread, `未讀 ${noticesAll.unread} → ${afterOpen.unread}`);

await data.markAllNoticesRead();
const afterAll = await data.listNotices({});
check('全部標為已讀', afterAll.unread === 0, `未讀 ${afterAll.unread}`);

// ── W-59 全校搜尋 ──
// 驗的是「示範層的結論與後端一致」：看得到的才搜得到、標題命中排前面、只有過期公告命中時回空。
const s1 = await data.search('圖書館');
check('搜尋：跨類別有結果', s1.total > 0 && s1.groups.length >= 2, s1.groups.map((g) => g.type + '×' + g.count).join(' '));
const sNotice = s1.groups.filter((g) => g.type === 'notice')[0] || { items: [] };
check('搜尋：標題命中排最前', (sNotice.items[0] || {}).title === '圖書館新增自習區', (sNotice.items[0] || {}).title || '沒有結果');
check('搜尋：過期公告不出現在結果', !s1.groups.some((g) => (g.items || []).some((i) => i.id === 'n5')), 'n5 出現在結果裡');
const s2 = await data.search('繳費');
check('搜尋：只命中過期公告時回空', s2.total === 0, `total ${s2.total}`);
const sItem = s1.groups.filter((g) => g.type === 'item')[0] || { items: [] };
check(
  '搜尋：摘要取自命中的欄位',
  (sItem.items[0] || {}).snippet && sItem.items[0].snippet.indexOf('圖書館') !== -1,
  (sItem.items[0] || {}).snippet || '沒有摘要',
);
const s3 = await data.search('   ');
check('搜尋：空白關鍵字不打後端', s3.total === 0 && s3.groups.length === 0, `groups ${s3.groups.length}`);
// W-71 轉贈進搜尋：示範層與後端同一條規則 —— 只搜 AVAILABLE，已贈出／已下架不出現
const sGv = await data.search('課本');
const sGvGroup = sGv.groups.filter((g) => g.type === 'giveaway')[0] || { count: 0, items: [] };
check('搜尋：轉贈也搜得到（AVAILABLE）', sGvGroup.count > 0, `轉贈 ${sGvGroup.count} 筆`);
check(
  '搜尋：轉贈排到「書籍」那件',
  sGvGroup.items.some((i) => i.id === 'gv1' && i.badge === 'BOOK'),
  sGvGroup.items.map((i) => i.id + ':' + i.badge).join(' ') || '沒有結果',
);
const sGvGiven = await data.search('體育服');
check(
  '搜尋：已贈出的轉贈不出現在結果',
  !sGvGiven.groups.some((g) => g.type === 'giveaway' && g.items.some((i) => i.id === 'gv5')),
  sGvGiven.groups.map((g) => g.type + '×' + g.count).join(' ') || '沒有結果',
);
const sGvOnly = await data.search({ q: '課本', types: 'giveaway' });
check(
  '搜尋：types=giveaway 只回轉贈',
  sGvOnly.groups.length > 0 && sGvOnly.groups.every((g) => g.type === 'giveaway'),
  sGvOnly.groups.map((g) => g.type).join(' ') || '沒有結果',
);
const apiSrcSearch = readFileSync(join(here, '..', 'services', 'api.js'), 'utf8');
check('搜尋：真 API 走 /search', apiSrcSearch.indexOf("'/search'") !== -1, 'services/api.js');
// W-74 菜單進搜尋：示範層也要搜得到，而且只回今天以後
const sMenu = await data.search({ q: '咖喱', types: 'menu' });
const sMenuGroup = sMenu.groups.filter((g) => g.type === 'menu')[0] || { count: 0, items: [] };
check(
  '搜尋：菜單也搜得到（打「咖喱」找得到哪一天有）',
  sMenuGroup.count > 0 && sMenuGroup.items.every((i) => i.badge === 'LUNCH' || i.badge === 'SNACK'),
  sMenuGroup.items.map((i) => i.title + '·' + i.badge).join(' / ') || '沒有結果',
);
const sMenuOnly = await data.search({ q: '咖喱', types: 'notice' });
check(
  '搜尋：types=notice 不會混進菜單',
  !sMenuOnly.groups.some((g) => g.type === 'menu'),
  sMenuOnly.groups.map((g) => g.type).join(' ') || '沒有結果',
);
// W-75 類型篩選：頁面把 chip 的值帶進 types，請求層兩種呼叫形狀都要吃
const searchPageJs = readFileSync(join(here, '..', 'pages', 'search', 'index.js'), 'utf8');
check(
  '搜尋：類型 chip 的 types 會帶進請求',
  searchPageJs.indexOf('{ types: this.data.typeFilter }') !== -1 && searchPageJs.indexOf('pickType') !== -1,
  'pages/search/index.js',
);
check(
  '搜尋：請求層同時吃字串與 { q, types } 兩種形狀',
  apiSrcSearch.indexOf("typeof q === 'object'") !== -1,
  'services/api.js',
);
// W-91 功課與提案進搜尋：示範層與後端同一條規則 —— 功課只搜自己班、提案排除撤回
const mockSrc = readFileSync(join(here, '..', 'services', 'mock.js'), 'utf8');
const sHw = await data.search({ q: '習作', types: 'homework' });
const sHwGroup = sHw.groups.filter((g) => g.type === 'homework')[0] || { count: 0, items: [] };
check(
  '搜尋：功課也搜得到（只限自己班）',
  sHwGroup.count > 0 && sHwGroup.items.every((i) => i.className === '高二仁'),
  sHwGroup.items.map((i) => i.className + '/' + i.title).join(' / ') || '沒有結果',
);
check('搜尋：功課徽章是科目、帶班級', (sHwGroup.items[0] || {}).badge === '數學' && sHwGroup.items[0].className === '高二仁', (sHwGroup.items[0] || {}).badge || '沒有結果');
const sPp = await data.search({ q: '圖書館', types: 'proposal' });
const sPpGroup = sPp.groups.filter((g) => g.type === 'proposal')[0] || { count: 0, items: [] };
check(
  '搜尋：提案也搜得到，且 badge 是「分類:狀態」',
  sPpGroup.count > 0 && /^[A-Z]+:[A-Z]+$/.test(String((sPpGroup.items[0] || {}).badge || '')),
  sPpGroup.items.map((i) => i.title + '·' + i.badge).join(' / ') || '沒有結果',
);
check(
  '搜尋：轉贈與提案都排除已刪除的（示範層過濾條件）',
  /\.filter\(\(p\) => !p\.deletedAt\)/.test(mockSrc) &&
    mockSrc.indexOf('supportCount: (p.supporters || []).length') !== -1,
  'services/mock.js',
);
check(
  '搜尋：功課與提案有類型 chip',
  searchPageJs.indexOf("key: 'homework'") !== -1 && searchPageJs.indexOf("key: 'proposal'") !== -1,
  'pages/search/index.js',
);
check(
  '搜尋：功課 chip 依角色決定（只有學生以上才給）',
  searchPageJs.indexOf('canHomework') !== -1 &&
    searchPageJs.indexOf("'STUDENT', 'TEACHER', 'STAFF', 'ADMIN', 'SUPER_ADMIN'") !== -1,
  'pages/search/index.js',
);
check(
  '搜尋：功課跳清單頁（不接 id），提案跳詳情頁',
  searchPageJs.indexOf("homework: '/pages/homework/index'") !== -1 &&
    searchPageJs.indexOf("proposal: '/pages/proposals/detail/index?id='") !== -1,
  'pages/search/index.js',
);

// ── W-92 館藏與場地進搜尋 ──
const sBook = await data.search({ q: '澳門街巷誌', types: 'book' });
const sBookGroup = sBook.groups.filter((g) => g.type === 'book')[0] || { count: 0, items: [] };
check(
  '搜尋：館藏也搜得到（書名）',
  sBookGroup.count > 0 && sBookGroup.items[0].title === '澳門街巷誌',
  sBookGroup.items.map((i) => i.title).join(' / ') || '沒有結果',
);
check(
  '搜尋：館藏帶可借數與總冊數，徽章是 AVAILABLE／OUT',
  typeof sBookGroup.items[0].available === 'number' &&
    typeof sBookGroup.items[0].total === 'number' &&
    ['AVAILABLE', 'OUT'].indexOf(sBookGroup.items[0].badge) !== -1,
  JSON.stringify({ badge: sBookGroup.items[0].badge, available: sBookGroup.items[0].available, total: sBookGroup.items[0].total }),
);
// 借完了照樣搜得到（b3 演算法圖解 availableCopies = 0）：借不到 ≠ 搜不到
const sOut = await data.search({ q: '演算法圖解', types: 'book' });
const sOutGroup = sOut.groups.filter((g) => g.type === 'book')[0] || { count: 0, items: [] };
check(
  '搜尋：借完的書照樣搜得到（徽章 OUT）',
  sOutGroup.count === 1 && sOutGroup.items[0].badge === 'OUT' && sOutGroup.items[0].available === 0,
  sOutGroup.items.map((i) => i.title + '·' + i.badge + '·' + i.available).join(' / ') || '沒有結果',
);
// b9 氣候緊急時代來了是 ARCHIVED：與館藏列表同一條可見規則
const sArchived = await data.search({ q: '氣候緊急', types: 'book' });
check('搜尋：已下架的書不出現', sArchived.total === 0, `total ${sArchived.total}`);

const sVenue = await data.search({ q: '三樓', types: 'resource' });
const sVenueGroup = sVenue.groups.filter((g) => g.type === 'resource')[0] || { count: 0, items: [] };
check(
  '搜尋：可按位置搜到場地（打「三樓」找到物理實驗室）',
  sVenueGroup.count > 0 && sVenueGroup.items[0].location === '三樓',
  sVenueGroup.items.map((i) => i.title + '@' + i.location).join(' / ') || '沒有結果',
);
check(
  '搜尋：場地徽章是「種類:狀態」',
  /^[A-Z]+:[A-Z]+$/.test(String((sVenueGroup.items[0] || {}).badge || '')),
  (sVenueGroup.items[0] || {}).badge || '沒有結果',
);
const sArchivedRes = await data.search({ q: '舊投影機', types: 'resource' });
check('搜尋：已下架的器材不出現', sArchivedRes.total === 0, `total ${sArchivedRes.total}`);
check(
  '搜尋：館藏與場地有類型 chip、都跳詳情頁',
  searchPageJs.indexOf("key: 'book'") !== -1 &&
    searchPageJs.indexOf("key: 'resource'") !== -1 &&
    searchPageJs.indexOf("book: '/pages/library/detail/index?id='") !== -1 &&
    searchPageJs.indexOf("resource: '/pages/venues/detail/index?id='") !== -1,
  'pages/search/index.js',
);

// ── W-105 我的假單／我的報修進搜尋 ──
// 示範層與後端同一條規則：studentId／reporterId 只認登入者（不吃參數），
// 家長與訪客沒有 leave:create／repair:create，所以這兩組對他們連分組都不出現。
const sLeave = await data.search({ q: '發燒', types: 'leave' });
const sLeaveGroup = sLeave.groups.filter((g) => g.type === 'leave')[0] || { count: 0, items: [] };
check(
  '搜尋：我的假單也搜得到（打「發燒」找到自己那張）',
  sLeaveGroup.count === 1 && (sLeaveGroup.items[0] || {}).id === 'lv1' && (sLeaveGroup.items[0] || {}).badge === 'SICK:PENDING',
  sLeaveGroup.items.map((i) => i.id + '·' + i.badge).join(' / ') || '沒有結果',
);
check(
  '搜尋：假單標題寫得出假別與日期（後端與示範層同一個組法）',
  /^\S+ \d{4}\/\d{2}\/\d{2}/.test(String((sLeaveGroup.items[0] || {}).title || '')),
  (sLeaveGroup.items[0] || {}).title || '沒有結果',
);
// lv4／lv5 是家長代子女送的（studentId = demo-child-1）：不是「我的」，不得出現在搜尋
check(
  '搜尋：只回自己的假單（家長代子女送的那兩張不出現）',
  !sLeave.groups.some((g) => (g.items || []).some((i) => i.id === 'lv4' || i.id === 'lv5')),
  'lv4／lv5 出現在結果裡',
);

const sRepair = await data.search({ q: '冷氣', types: 'repair' });
const sRepairGroup = sRepair.groups.filter((g) => g.type === 'repair')[0] || { count: 0, items: [] };
check(
  '搜尋：我的報修也搜得到（打「冷氣」找到 304 室那張）',
  sRepairGroup.count === 1 && (sRepairGroup.items[0] || {}).id === 'rp1' && (sRepairGroup.items[0] || {}).badge === 'PENDING',
  sRepairGroup.items.map((i) => i.id + '·' + i.badge).join(' / ') || '沒有結果',
);
check(
  '搜尋：報修帶地點（結果那一行要知道是哪一間）',
  (sRepairGroup.items[0] || {}).location === '304 室',
  (sRepairGroup.items[0] || {}).location || '沒有地點',
);
// rp4 是黃同學送的（reporterId = demo-other）：關鍵字對得上也不該出現
const sRepairOther = await data.search({ q: '門鎖', types: 'repair' });
check('搜尋：別人送的報修搜不到', sRepairOther.total === 0, `total ${sRepairOther.total}`);

// 家長：兩類都不出現（與後端 `leave:create`／`repair:create` 同一組能力）
await data.switchDemoUser('示範家長', 'demo-parent', 'PARENT');
const sLeaveParent = await data.search({ q: '發燒', types: 'leave' });
const sRepairParent = await data.search({ q: '冷氣', types: 'repair' });
check(
  '搜尋：家長看不到假單與報修兩組',
  sLeaveParent.groups.length === 0 && sRepairParent.groups.length === 0,
  `假單 ${sLeaveParent.groups.length} 組／報修 ${sRepairParent.groups.length} 組`,
);
await data.switchDemoUser('示範學生', 'demo-user', 'STUDENT');

check(
  '搜尋：假單與報修有類型 chip，且跳清單頁（不接 id）',
  searchPageJs.indexOf("key: 'leave'") !== -1 &&
    searchPageJs.indexOf("key: 'repair'") !== -1 &&
    searchPageJs.indexOf("leave: '/pages/leaves/mine/index'") !== -1 &&
    searchPageJs.indexOf("repair: '/pages/repair/index/index'") !== -1 &&
    searchPageJs.indexOf('leave: false') !== -1 &&
    searchPageJs.indexOf('repair: false') !== -1,
  'pages/search/index.js',
);

// ── W-111 我的借閱／我的借用進搜尋 ──
// 與 W-105 同一個形狀：只認登入者、只回「還沒結束」的那幾筆，家長與訪客連分組都不出現。
const sLoan = await data.search({ q: '街巷', types: 'loan' });
const sLoanGroup = sLoan.groups.filter((g) => g.type === 'loan')[0] || { count: 0, items: [] };
check(
  '搜尋：我的借閱也搜得到（打「街巷」找到自己借的那本）',
  sLoanGroup.count === 1 && (sLoanGroup.items[0] || {}).id === 'b1' && (sLoanGroup.items[0] || {}).badge === 'ACTIVE',
  sLoanGroup.items.map((i) => i.id + '·' + i.badge).join(' / ') || '沒有結果',
);
// b7 那筆已經逾期 6 天：搜尋結果要說得出來（逾期不看就沒有人會還書）
const sLoanLate = await data.search({ q: '飲食', types: 'loan' });
const sLoanLateItem = ((sLoanLate.groups.filter((g) => g.type === 'loan')[0] || {}).items || [])[0] || {};
check('搜尋：逾期借閱標成 OVERDUE', sLoanLateItem.badge === 'OVERDUE', sLoanLateItem.badge || '沒有結果');
// l3／l4 是別人的借閱（demo-other）：關鍵字對得上也不該出現
const sLoanOther = await data.search({ q: '演算法', types: 'loan' });
check('搜尋：別人的借閱搜不到', sLoanOther.total === 0, `total ${sLoanOther.total}`);

const sBooking = await data.search({ q: '籃球', types: 'booking' });
const sBookingGroup = sBooking.groups.filter((g) => g.type === 'booking')[0] || { count: 0, items: [] };
check(
  '搜尋：我的借用也搜得到（打「籃球」找到自己排的那個時段）',
  sBookingGroup.count === 1 && (sBookingGroup.items[0] || {}).id === 'r2' && (sBookingGroup.items[0] || {}).badge === 'PENDING',
  sBookingGroup.items.map((i) => i.id + '·' + i.badge).join(' / ') || '沒有結果',
);
check(
  '搜尋：借用結果帶地點（第二行要知道在哪裡）',
  (sBookingGroup.items[0] || {}).location === '地下操場',
  (sBookingGroup.items[0] || {}).location || '沒有地點',
);
// rb1／rb2 是別人的借用（demo-other）：物理實驗室也搜不到
const sBookingOther = await data.search({ q: '實驗室', types: 'booking' });
check('搜尋：別人的借用搜不到', sBookingOther.total === 0, `total ${sBookingOther.total}`);

// 家長：兩類都不出現（家長沒有 library:borrow／resource:book）
await data.switchDemoUser('示範家長', 'demo-parent', 'PARENT');
const sLoanParent = await data.search({ q: '街巷', types: 'loan' });
const sBookingParent = await data.search({ q: '籃球', types: 'booking' });
check(
  '搜尋：家長看不到借閱與借用兩組',
  sLoanParent.groups.length === 0 && sBookingParent.groups.length === 0,
  `借閱 ${sLoanParent.groups.length} 組／借用 ${sBookingParent.groups.length} 組`,
);
await data.switchDemoUser('示範學生', 'demo-user', 'STUDENT');

check(
  '搜尋：借閱與借用有類型 chip，且跳館藏／場地詳情（接 id）',
  searchPageJs.indexOf("key: 'loan'") !== -1 &&
    searchPageJs.indexOf("key: 'booking'") !== -1 &&
    searchPageJs.indexOf("loan: '/pages/library/detail/index?id='") !== -1 &&
    searchPageJs.indexOf("booking: '/pages/venues/detail/index?id='") !== -1 &&
    searchPageJs.indexOf('loan: true') !== -1 &&
    searchPageJs.indexOf('booking: true') !== -1,
  'pages/search/index.js',
);




// ── 介面語言（utils/i18n.js）──
{
  const mod = await import('../utils/i18n.js').catch(() => null);
  const i18n = mod && (mod.default || mod);
  if (!i18n) {
    check('i18n 可載入', false, 'utils/i18n.js 載入失敗');
  } else {
    const dict = i18n.dict();
    const bad = Object.entries(dict).filter(([, v]) => !v.hant || !v.hans);
    check('介面語言：每條都有繁簡兩版', bad.length === 0, bad.map(([k]) => k).join(','));
    i18n.setLocale('zh-Hant');
    const hant = i18n.t('home.module.items');
    i18n.setLocale('zh-Hans');
    const hans = i18n.t('home.module.items');
    check('介面語言：切換後文案改變', hant !== hans, `${hant} / ${hans}`);
    check('介面語言：未知 key 原樣回傳', i18n.t('nope.not.exist') === 'nope.not.exist', i18n.t('nope.not.exist'));
    check('介面語言：非法語言值回退預設', i18n.setLocale('en-US') === i18n.DEFAULT, i18n.locale());
    i18n.setLocale('zh-Hant');
  }
}

// ── 校曆工具（utils/calendar.js）──
{
  const cal = await import('../utils/calendar.js').catch(() => null);
  const c = cal && (cal.default || cal);
  if (!c) {
    check('校曆工具可載入', false, 'utils/calendar.js 載入失敗');
  } else {
    const cells = c.monthGrid(2026, 10);
    const todayKey = c.dateKey(new Date());
    const grouped = c.groupByDate(
      [{ id: 'n1', title: '颱風停課', kind: 'URGENT', publishedAt: Date.now() }],
      [{ id: 'e1', title: '校運會', startAt: Date.now() + 3600000 }],
    );
    const summary = c.monthSummary(cells, grouped);
    const dayKey = c.dateKey(new Date());
    check('校曆：月視圖固定 42 格', cells.length === 42, `實際 ${cells.length}`);
    check('校曆：本月 1 號在格子裡', cells.some((x) => x.key === c.dateKey(new Date(2026, 9, 1)) && x.inMonth), '找不到 2026-10-01');
    check('校曆：今天被標記', summary.some((x) => x.key === todayKey && x.isToday), '今天不在格子裡');
    check('校曆：同日公告與活動被收在一起', (grouped[dayKey] || []).length >= 0 && summary.some((x) => x.key === dayKey && x.count >= 1), '當天沒有項目');
    const merged = c.mergeExternal(c.groupByDate([], []), [
      { id: 'x1', title: '校慶文藝匯演', date: '2026-11-20', startTime: '19:00', location: '禮堂' },
    ]);
    check('校曆：合併外部校曆場次', (merged['2026-11-20'] || []).some((i) => i.type === 'school'), JSON.stringify(merged['2026-11-20'] || []));
    const summary2 = c.monthSummary(c.monthGrid(2026, 11), merged);
    check('校曆：外部場次會畫圓點', summary2.some((x) => x.hasSchool), '沒有 hasSchool 的格子');
    check('校曆：緊急公告優先', (grouped[dayKey] || [])[0]?.kind === 'URGENT' || (grouped[dayKey] || []).length === 0, JSON.stringify(grouped[dayKey] || []));
  }
}

// ── 資料入口／真實 API／示範資料三方方法必須對齊 ──
const dataKeys = Object.keys(data).filter((k) => typeof data[k] === 'function' && !['isDemo', 'setForceDemo', 'forceDemoOn', 'setApiBase', 'apiBase', 'ensureLogin', 'messageOf', 'resetDemo', 'offlineReset', 'offlineInfo', 'offlineText', 'clearCache'].includes(k));
const api = require(join(here, '..', 'services', 'api.js'));
const mock = require(join(here, '..', 'services', 'mock.js'));
const missingApi = dataKeys.filter((k) => typeof api[k] !== 'function');
const missingMock = dataKeys.filter((k) => typeof mock[k] !== 'function');
check('方法對齊（data↔api↔mock）', !missingApi.length && !missingMock.length,
  [missingApi.length ? 'api 缺 ' + missingApi.join(',') : '', missingMock.length ? 'mock 缺 ' + missingMock.join(',') : ''].filter(Boolean).join(' ') || `${dataKeys.length} 個方法`);

// ── 後台菜單評分統計（W-101）：示範層與後端 /admin/menu/stats 同一組規則 ──
{
  const stats = await mock.menuStats({ days: 30 });
  check(
    '菜單評分統計：每道菜都有平均分與人數',
    stats.items.length > 0 && stats.items.every((r) => r.count > 0 && r.avgScore > 0 && r.avgScore <= 5),
    `${stats.items.length} 道，全校平均 ${stats.summary.avgScore}`,
  );

  const d3row = stats.items.filter((r) => r.dishId === 'd3')[0];
  const distSum = d3row ? [1, 2, 3, 4, 5].reduce((s, k) => s + d3row.dist[k], 0) : -1;
  check(
    '菜單評分統計：1–5 分分佈加總等於人數',
    !!d3row && distSum === d3row.count,
    d3row ? `${JSON.stringify(d3row.dist)} → ${distSum} / ${d3row.count}` : '找不到 d3',
  );

  // 全校平均必須是「各菜精確平均 × 人數」的加權，不是各菜四捨五入後再平均
  const totalSum = stats.items.reduce(
    (s, r) => s + [1, 2, 3, 4, 5].reduce((x, k) => x + k * r.dist[k], 0),
    0,
  );
  const totalCount = stats.summary.ratings;
  const weighted = totalCount ? Math.round((totalSum / totalCount) * 10) / 10 : null;
  check(
    '菜單評分統計：全校平均是按人數加權',
    weighted === stats.summary.avgScore,
    `${weighted} vs ${stats.summary.avgScore}（${totalCount} 則）`,
  );

  check(
    '菜單評分統計：樣本 < 3 不進最好／最差排名',
    stats.best.every((x) => x.count >= 3) && stats.worst.every((x) => x.count >= 3),
    `best ${stats.best.length}、worst ${stats.worst.length}、樣本不足 ${stats.summary.insufficient}`,
  );
  check(
    '菜單評分統計：最差排序是 1–2 分比例遞減',
    stats.worst.every((x, i, arr) => i === 0 || arr[i - 1].lowRate >= x.lowRate),
    stats.worst.map((x) => `${x.name} ${x.lowRate}%`).join(' > ') || '沒有樣本足夠的菜',
  );

  // 改分後統計要跟著變（分佈與聚合同一份來源，不是兩份各自維護）
  // 注意：這裡改的是 d4，前面 d3 已被自檢改過，不要混用
  const beforeD4 = stats.items.filter((r) => r.dishId === 'd4')[0];
  await data.rateDish('d4', { score: 1, liked: false });
  const afterStats = await mock.menuStats({ days: 30 });
  const afterD4 = afterStats.items.filter((r) => r.dishId === 'd4')[0];
  check(
    '菜單評分統計：改分後低分比例跟著變',
    !!beforeD4 &&
      !!afterD4 &&
      afterD4.count === beforeD4.count + 1 &&
      afterD4.lowCount === beforeD4.lowCount + 1 &&
      afterD4.avgScore < beforeD4.avgScore,
    beforeD4 && afterD4
      ? `低分 ${beforeD4.lowCount} → ${afterD4.lowCount}，平均 ${beforeD4.avgScore} → ${afterD4.avgScore}`
      : '找不到 d4',
  );
}

// ── 失物智能匹配（W-9）──
const m1 = await data.matches('i1'); // 藍色水壺（LOST）
check('匹配命中相近物品', m1.items.some((x) => x.id === 'i7'), m1.items.map((x) => `${x.title} ${x.score}`).join(' / ') || '沒有推薦');
const m2 = await data.matches('i2'); // 學生證（FOUND，操場）
check('不相近就不推薦', m2.items.length === 0, `${m2.items.length} 筆`);

// ── 日期工具：真 API 的 ISO 字串也要能顯示（原本 Number() 會變 NaN）──
{
  const dateUtil = require(join(here, '..', 'utils', 'date.js'));
  const iso = dateUtil.dateTimeText('2026-10-24T20:32:49.922Z');
  const num = dateUtil.dateTimeText(Date.UTC(2026, 9, 24, 20, 32));
  const isoDt = new Date('2026-10-24T20:32:49.922Z');
  const expectText = (isoDt.getMonth() + 1) + '/' + isoDt.getDate();
  check('日期工具：ISO 字串可顯示', iso.indexOf('NaN') === -1 && iso.indexOf(expectText) === 0, iso);
  check('日期工具：毫秒數字仍可顯示', num.indexOf('NaN') === -1, num);
}

// ── 家長（P3）：切換兩位子女、代報名只扣一次、代取消名額歸還 ──
const kids = await data.parentChildren();
check('家長：子女清單', kids.items.length === 2, kids.items.map((c) => c.nickname).join(' / '));

const kid1 = kids.items[0].studentId;
const kid2 = kids.items[1].studentId;
const evBefore = await data.getEvent('e1');

const rec = await data.parentSignupEvent(kid1, 'e1');
const afterSignup = await data.getEvent('e1');
check('家長：代報名名額只扣一次', rec.status === 'CONFIRMED' && afterSignup.signedCount === evBefore.signedCount + 1,
  `名額 ${evBefore.signedCount} → ${afterSignup.signedCount}`);

let dupCode = '';
try {
  await data.parentSignupEvent(kid1, 'e1');
} catch (e) {
  dupCode = e.code;
}
const afterDup = await data.getEvent('e1');
check('家長：重複代報被擋且名額不變', dupCode === 'ALREADY_SIGNED_UP' && afterDup.signedCount === afterSignup.signedCount,
  dupCode || '沒有擋下');

const k1 = await data.parentChild(kid1);
const k2 = await data.parentChild(kid2);
check('家長：切換子女資料互不干擾', k1.signups.length === 1 && k2.signups.length === 0,
  `子女1 ${k1.signups.length} 筆 / 子女2 ${k2.signups.length} 筆`);

await data.parentCancelSignup(kid1, 'e1');
const afterCancel = await data.getEvent('e1');
check('家長：代取消後名額歸還', afterCancel.signedCount === evBefore.signedCount,
  `名額 ${afterSignup.signedCount} → ${afterCancel.signedCount}`);

// ── 現場簽到（QR）──
const ci1 = await data.checkin('246810');
check('簽到：示範碼可簽到', ci1.ok === true && ci1.eventId === 'e1', `${ci1.title}（${ci1.already ? '已簽過' : '首次'}）`);

const ci2 = await data.checkin('246810');
check('簽到：重複掃不重複計', ci2.already === true, `already=${ci2.already}`);

let ciBad = '';
try {
  await data.checkin('000000');
} catch (e) {
  ciBad = e.code;
}
check('簽到：無效碼被擋', ciBad === 'VALIDATION_FAILED', ciBad || '沒有擋下');

const myAfterCheckin = await data.mySignups();
check('簽到：我的報名帶簽到時間',
  myAfterCheckin.items.some((x) => x.eventId === 'e1' && x.checkedInAt),
  `已簽到 ${myAfterCheckin.items.filter((x) => x.checkedInAt).length} 筆`);

// ── 活動資料轉換：真 API 的 myStatus 不能被清空（曾因此在真機一直顯示「立即報名」）──
{
  const { decorate } = require(join(here, '..', 'utils', 'event.js'));
  const apiShape = decorate({
    id: 'x', capacity: 10, signedCount: 4,
    myStatus: 'CONFIRMED', waitlistPos: null, myCheckedIn: '2026-10-24T12:00:00.000Z',
  });
  check('活動：myStatus 兩種來源都認', apiShape.myStatus === 'CONFIRMED' && apiShape.myCheckedIn,
    `myStatus=${apiShape.myStatus || '空'} / 簽到=${apiShape.myCheckedIn ? '有' : '無'}`);
}

// ── 活動分組（示範層與後端同一規則：有設組別就必須選）──
{
  const evs = await data.listEvents({ scope: 'upcoming' });
  const grouped = (evs.items || []).filter((e) => (e.groups || []).length)[0];
  check('活動分組：示範資料有分組活動', Boolean(grouped), grouped ? grouped.title : '找不到 groups 非空的活動');
  if (grouped) {
    let blocked = '';
    await data.signupEvent(grouped.id).catch((err) => {
      blocked = (err && err.code) || 'UNKNOWN';
    });
    check('活動分組：未選組被擋', blocked === 'VALIDATION_FAILED', blocked || '沒有擋下');

    const rec = await data.signupEvent(grouped.id, grouped.groups[1]).catch((err) => ({ error: err }));
    check(
      '活動分組：選組後記下組別',
      rec && rec.groupKey === grouped.groups[1],
      JSON.stringify(rec && (rec.groupKey || rec.error || rec)),
    );
  }
}


// ── W-34 站內通知 ──
{
  const list = await data.notifications();
  check('通知：清單可讀', Array.isArray(list.items) && list.items.length > 0, `${list.items.length} 則`);
  check('通知：未讀數是數字', typeof list.unread === 'number', String(list.unread));
  const only = await data.notifications({ unreadOnly: true });
  check('通知：只看未讀', only.items.every((x) => !x.readAt), `${only.items.length} 則未讀`);
  // W-57：示範資料要留一則配對通知，否則示範模式看不到這個功能長什麼樣
  check('通知：示範資料有配對通知（ITEM）', list.items.some((x) => x.kind === 'ITEM'), `${list.items.filter((x) => x.kind === 'ITEM').length} 則`);
}

// ── W-29 活動延期／取消要能顯示 ──
{
  const { decorate } = require(join(here, '..', 'utils', 'event.js'));
  const ev = decorate({ id: 'x', title: 't', startAt: Date.now() + 86400000, capacity: 10, signedCount: 1, status: 'CANCELLED', postponedFrom: '2026-11-10T01:00:00.000Z' });
  check('活動：取消狀態可判', ev.cancelled === true, String(ev.cancelled));
  check('活動：延期顯示原定時間', !!ev.postponedText, ev.postponedText || '空');
}


// ── W-31 活動回饋 ──
{
  const before = await data.eventFeedback('e1');
  await data.submitFeedback('e1', 5, '很好玩');
  const after = await data.eventFeedback('e1');
  check('回饋：送出後看得到', after.mine && after.mine.rating === 5, JSON.stringify(after.mine));
  check('回饋：平均分有算', typeof after.avg === 'number' && after.avg > 0, String(after.avg));
}


// ── W-30 組隊報名（示範模式） ──
{
  const team = await data.createTeam('e7', '測試隊');
  check('組隊：建隊拿到邀請碼', !!(team && team.code && team.code.length === 6), team && team.code);
  const list = await data.eventTeams('e7');
  check('組隊：隊伍列表看得到自己', list.teams.some((t) => t.name === '測試隊' && t.mine), `${list.teams.length} 隊`);
}

// ── W-28 列印版（A4 分頁與表格文字；純函式，不依賴 IDE） ──
{
  const print = require(join(here, '..', 'utils', 'print.js'));
  const rows = Array.from({ length: 45 }, (_, i) => ({ no: i + 1 }));
  const pages = print.paginate(rows, 20);
  check(
    '列印：分頁列數固定',
    pages.length === 3 && pages[1].rows.length === 20 && pages[2].rows.length === 5,
    `${pages.length} 頁／最後一頁 ${pages[2].rows.length} 列`,
  );
  const per = print.rowsPerPage({ sheetHeight: 800, headHeight: 80, footHeight: 40, rowHeight: 24 });
  check('列印：每頁列數由紙高推算', per === 28, String(per));
  const tsv = print.toTsv(['A', 'B'], [['x\ty', 'z\nw']]);
  check('列印：表格文字清掉跳字', tsv.split('\n').length === 2 && tsv.indexOf('\t\n') === -1, JSON.stringify(tsv));
}

// ── W-43 使用者手動回報問題 ──
// 驗收要求「前端有一條回報路徑」：只做後端端點不算，畫面點不到就等於沒做。
// 這裡同時驗四層的最後兩層（data.js 入口＋示範模式寫得進去）與第五層的靜態證據
// （api.js 真的打 /client-errors/report）；第一層（設定頁按鈕）由 check-project 的
// 「WXML 用到的 handler 必須在頁面 JS 存在」擋住。
{
  const settingsSrc = readFileSync(join(here, '..', 'pages', 'settings', 'index.js'), 'utf8');
  const settingsWxml = readFileSync(join(here, '..', 'pages', 'settings', 'index.wxml'), 'utf8');
  check(
    '回報問題：設定頁有入口',
    settingsWxml.indexOf('bindtap="reportIssue"') !== -1 && settingsSrc.indexOf('reportIssue()') !== -1,
    'pages/settings',
  );

  check('回報問題：data.js 有入口', typeof data.reportIssue === 'function', typeof data.reportIssue);

  const first = await data.reportIssue({ message: '自我檢查回報', route: 'pages/settings/index' }).catch((e) => e);
  check(
    '回報問題：示範模式寫本地並標明 demo',
    first && first.ok === true && first.demo === true,
    JSON.stringify(first),
  );

  const second = await data.reportIssue({ message: '自我檢查回報', route: 'pages/settings/index' }).catch((e) => e);
  check('回報問題：送兩次都有記錄（不靜默吞掉）', second && second.id !== first.id, `${first.id} → ${second && second.id}`);

  const rejected = await data
    .reportIssue({ message: '   ' })
    .then(() => false)
    .catch(() => true);
  check('回報問題：空訊息被拒', rejected, rejected);

  const apiSrc = readFileSync(join(here, '..', 'services', 'api.js'), 'utf8');
  check(
    '回報問題：真 API 走 /client-errors/report',
    apiSrc.indexOf("'/client-errors/report'") !== -1,
    'services/api.js',
  );
}

// ── W-38 活動附件 ──
// 驗收要點：老師加得了、學生看得到但改不了、COS 沒開通要明確報而不是假成功。
{
  const ev = await data.getEvent('e1');
  check('附件：詳情頁帶附件清單', (ev.attachments || []).length === 2, `${(ev.attachments || []).length} 份`);
  check(
    '附件：連結與檔案兩種都示範得到',
    (ev.attachments || []).some((a) => a.type === 'link') && (ev.attachments || []).some((a) => a.type === 'pdf'),
    (ev.attachments || []).map((a) => a.type).join('/'),
  );
  check('附件：示範身分是學生 → 不給管理入口', ev.canManageAttachments === false, String(ev.canManageAttachments));

  const added = await data
    .addEventAttachment('e1', { name: '自我檢查附件', url: 'https://www.puiva.edu.mo/', type: 'link' })
    .catch((e) => e);
  check('附件：新增後寫進示範資料', added && added.id, added && added.id ? added.name : JSON.stringify(added));

  const afterAdd = await data.getEvent('e1');
  check('附件：重新讀取還在（不是只在記憶體）', (afterAdd.attachments || []).length === 3, `${(afterAdd.attachments || []).length} 份`);

  const badUrl = await data
    .addEventAttachment('e1', { name: '壞連結', url: 'javascript:alert(1)' })
    .then(() => false)
    .catch(() => true);
  check('附件：非 http(s) 連結被拒', badUrl, badUrl);

  await data.deleteEventAttachment('e1', added.id).catch(() => null);
  const afterDel = await data.getEvent('e1');
  check('附件：刪除後清單回到兩份', (afterDel.attachments || []).length === 2, `${(afterDel.attachments || []).length} 份`);

  const sign = await data.signUpload('event', 'pdf').then(() => null).catch((e) => e);
  check(
    '附件：COS 未開通時明確報未開通（不假成功）',
    sign && sign.code === 'UPLOAD_NOT_CONFIGURED',
    sign ? sign.code : '沒有拒絕',
  );

  // 第五層：畫面入口（沒有入口等於功能沒做）
  const evWxml = readFileSync(join(here, '..', 'pages', 'events', 'detail', 'index.wxml'), 'utf8');
  const evJs = readFileSync(join(here, '..', 'pages', 'events', 'detail', 'index.js'), 'utf8');
  check(
    '附件：詳情頁有入口（開檔＋新增＋刪除）',
    evWxml.indexOf('bindtap="openAttachment"') !== -1 &&
      evWxml.indexOf('bindtap="addAttachment"') !== -1 &&
      evWxml.indexOf('catchtap="removeAttachment"') !== -1 &&
      evJs.indexOf('openAttachment(') !== -1 &&
      evJs.indexOf('addAttachment(') !== -1 &&
      evJs.indexOf('removeAttachment(') !== -1,
    'pages/events/detail',
  );
  const apiSrc2 = readFileSync(join(here, '..', 'services', 'api.js'), 'utf8');
  check(
    '附件：真 API 走 /events/:id/attachments',
    apiSrc2.indexOf("'/events/' + eventId + '/attachments'") !== -1 && apiSrc2.indexOf("'/uploads/signature'") !== -1,
    'services/api.js',
  );
}

// ── W-64 報名截止（欄位本來就有，重點是「真的擋得住」）──
{
  const { decorate: decorateEvent } = require(join(here, '..', 'utils', 'event.js'));

  const closed = await data.signupEvent('e8').then(() => null).catch((e) => e);
  check('報名截止：截止後報名被擋（SIGNUP_CLOSED）', closed && closed.code === 'SIGNUP_CLOSED', closed ? closed.code : '沒有拒絕');

  const ev8 = decorateEvent(await data.getEvent('e8'));
  check('報名截止：詳情頁判斷為已截止且有截止時間', ev8.signupClosed === true && !!ev8.signupEndText, `${ev8.signupClosed} / ${ev8.signupEndText}`);

  const ev1 = decorateEvent(await data.getEvent('e1'));
  check('報名截止：沒設截止的活動不受影響', ev1.signupClosed === false, String(ev1.signupClosed));

  const listClosed = (await data.listEvents({ scope: 'upcoming' })).items.filter((x) => x.id === 'e8').map((x) => decorateEvent(x))[0];
  check('報名截止：清單也標得出來（列表顯示「報名已截止」）', listClosed && listClosed.signupClosed === true, listClosed ? String(listClosed.signupClosed) : '清單沒有 e8');

  const evWxml2 = readFileSync(join(here, '..', 'pages', 'events', 'detail', 'index.wxml'), 'utf8');
  const evJs2 = readFileSync(join(here, '..', 'pages', 'events', 'detail', 'index.js'), 'utf8');
  const adminJs2 = readFileSync(join(here, '..', 'pages', 'admin', 'index', 'index.js'), 'utf8');
  check(
    '報名截止：詳情頁顯示截止時間、後台可設定',
    evWxml2.indexOf('ev.signupEndText') !== -1 && evJs2.indexOf('ev.signupClosed') !== -1 && adminJs2.indexOf('signupEndAt') !== -1,
    'pages/events/detail + pages/admin/index',
  );
}

// ── W-66 圖書館（示範層也要借得動，否則交付現場斷網時這個功能是死的）──
{
  const list1 = await data.listBooks({});
  const hasArchived = list1.items.filter((b) => b.id === 'b9').length > 0;
  check('圖書館：列表排除已下架', !hasArchived && list1.items.length >= 8, `${list1.items.length} 本／含下架=${hasArchived}`);

  const hit = await data.lookupIsbn('978-999-3700-02-8');
  check('圖書館：書號查詢（含連字號）', hit && hit.found === true && hit.book.id === 'b2', hit && hit.book ? hit.book.title : '查不到');

  const miss = await data.lookupIsbn('9780000000002');
  check('圖書館：查不到回 found:false（不是錯誤）', miss && miss.found === false, String(miss && miss.found));

  const borrowed = await data.borrowBook({ bookId: 'b2' });
  const afterBorrow = await data.getBook('b2');
  check('圖書館：借書扣可借量', borrowed.kind === 'loan' && afterBorrow.book.availableCopies === 4, `${borrowed.kind}／可借 ${afterBorrow.book.availableCopies}`);

  const dupLoan = await data.borrowBook({ bookId: 'b2' }).then(() => null).catch((e) => e);
  check('圖書館：同一本不能重複借（409 同族）', dupLoan && dupLoan.code === 'ALREADY_BORROWED', dupLoan ? dupLoan.code : '沒有拒絕');

  // b3 可借量 0 且有候補 → 借不到要排候補，不是丟錯
  const wait = await data.borrowBook({ bookId: 'b3' });
  check('圖書館：沒可借的排候補', wait.kind === 'reservation' && wait.reservation.position >= 2, `${wait.kind}／第 ${wait.reservation ? wait.reservation.position : '-'} 位`);

  const dupWait = await data.borrowBook({ bookId: 'b3' }).then(() => null).catch((e) => e);
  check('圖書館：已排候補不會重複排（ALREADY_RESERVED）', dupWait && dupWait.code === 'ALREADY_RESERVED', dupWait ? dupWait.code : '沒有拒絕');

  // 還 b3 的另一筆借閱 → 最早候補（rv1）被叫到
  const ret = await data.returnLoan('l3');
  check('圖書館：還書叫最早候補（READY）', ret.promotedUserId === 'demo-other', String(ret.promotedUserId));

  const renewed = await data.renewLoan('l1');
  const twice = await data.renewLoan('l1').then(() => null).catch((e) => e);
  check('圖書館：續借上限 1 次', renewed.renewals === 1 && twice && twice.code === 'RENEW_LIMIT', twice ? twice.code : '沒有拒絕');

  const mine = await data.myLoans();
  check('圖書館：我的借閱有逾期天數', mine.loans.some((l) => l.overdueDays > 0), `逾期 ${mine.overdueCount} 筆`);

  const rv2 = { id: 'rv1' };
  const cancelled = await data.cancelReservation(rv2.id);
  check('圖書館：取消候補', cancelled && cancelled.cancelled === true, String(cancelled && cancelled.cancelled));

  const pageWxml = readFileSync(join(here, '..', 'pages', 'library', 'list', 'index.wxml'), 'utf8');
  const homeWxml = readFileSync(join(here, '..', 'pages', 'index', 'index.wxml'), 'utf8');
  const apiSrc3 = readFileSync(join(here, '..', 'services', 'api.js'), 'utf8');
  check(
    '圖書館：有畫面入口＋真 API 端點',
    pageWxml.indexOf('bindtap="scan"') !== -1 && homeWxml.indexOf('goLibrary') !== -1 && apiSrc3.indexOf("'/library/loans'") !== -1,
    '首頁 → 列表（掃碼）→ 借還',
  );

  // W-85 熱門榜：示範層（斷網交付現場）也要排得出來，且必須依借出次數遞減
  const hot = await data.hotBooks({ limit: 5 });
  const hotItems = hot.items || [];
  const hotSorted = hotItems.every((b, i) => i === 0 || hotItems[i - 1].loans >= b.loans);
  check(
    '圖書館：熱門榜有資料且依借出次數遞減',
    hotItems.length >= 1 && hotSorted && hotItems.every((b) => b.title && typeof b.loans === 'number'),
    `${hotItems.length} 筆／次數 ${hotItems.map((b) => b.loans).join('>')}`,
  );

  const pageJs3 = readFileSync(join(here, '..', 'pages', 'library', 'list', 'index.js'), 'utf8');
  check(
    '圖書館：熱門榜有畫面入口（列表頁「熱門」分頁）',
    pageWxml.indexOf("mode === 'hot'") !== -1 && pageJs3.indexOf('data.hotBooks') !== -1 && apiSrc3.indexOf("'/library/hot'") !== -1,
    'pages/library/list → 熱門 chip',
  );

  // W-85 預約到書：排候補時要問一次訂閱同意，且場景是 hold（不是共用 event）
  const detailJs3 = readFileSync(join(here, '..', 'pages', 'library', 'detail', 'index.js'), 'utf8');
  const cfgSrc = readFileSync(join(here, '..', 'config', 'config.js'), 'utf8');
  check(
    '圖書館：排候補時請求 hold 訂閱，模板鍵存在',
    detailJs3.indexOf("subscribe.request('hold')") !== -1 && cfgSrc.indexOf('hold:') !== -1,
    'pages/library/detail → subscribe.request(hold)',
  );
}

// ── W-67 場地／器材（示範層也要借得動、批得了）──
{
  const venueUtil = require(join(here, '..', 'utils', 'venue.js'));

  const all = await data.listResources({});
  const hasArchived = all.items.filter((r) => r.id === 'r6').length > 0;
  check('場地：列表排除已下架', !hasArchived && all.items.length >= 5, `${all.items.length} 個／含下架=${hasArchived}`);

  const onlyEquip = await data.listResources({ kind: 'EQUIPMENT' });
  check('場地：可用類型過濾', onlyEquip.items.every((r) => r.kind === 'EQUIPMENT') && onlyEquip.items.length >= 2, `${onlyEquip.items.length} 件器材`);

  const detail = await data.getResource('r1');
  check('場地：詳情帶未來時段與申請人', detail.bookings.length >= 2 && !!detail.bookings[0].user.nickname, `${detail.bookings.length} 筆`);

  const day = venueUtil.dateOptions(3)[1].value;
  const slotA = await data.createResourceBooking('r3', {
    startAt: venueUtil.slotIso(day, '09:00'),
    endAt: venueUtil.slotIso(day, '10:00'),
    purpose: '分組報告',
  });
  check('場地：需審批的送出後待批（PENDING）', slotA.pending === true && slotA.booking.status === 'PENDING', slotA.booking.status);

  const clash = await data
    .createResourceBooking('r3', { startAt: venueUtil.slotIso(day, '09:30'), endAt: venueUtil.slotIso(day, '10:30'), purpose: '測試重疊' })
    .then(() => null)
    .catch((e) => e);
  check('場地：重疊時段被擋（CONFLICT）', clash && clash.code === 'CONFLICT', clash ? clash.code : '沒有拒絕');

  const touching = await data.createResourceBooking('r3', {
    startAt: venueUtil.slotIso(day, '10:00'),
    endAt: venueUtil.slotIso(day, '11:00'),
    purpose: '接著用',
  });
  check('場地：邊界相接不算重疊', touching.booking.status === 'PENDING', touching.booking.timeText);

  const studentReview = await data.reviewResourceBooking(slotA.booking.id, { action: 'APPROVE' }).then(() => null).catch((e) => e);
  check('場地：學生批不了（FORBIDDEN）', studentReview && studentReview.code === 'FORBIDDEN', studentReview ? studentReview.code : '沒有拒絕');

  // 切老師（保留同一個 userId，否則「我的申請」會換人）→ 批第一筆
  await data.switchDemoUser('示範老師', 'demo-user', 'TEACHER');
  const approved = await data.reviewResourceBooking(slotA.booking.id, { action: 'APPROVE' });
  check('場地：老師可批准', approved.booking.status === 'APPROVED', approved.booking.status);

  const pendingList = await data.pendingResourceBookings();
  check('場地：待審批清單含種子資料', pendingList.pending.length >= 2, `${pendingList.pending.length} 筆待審`);

  const rejected = await data.reviewResourceBooking(touching.booking.id, { action: 'REJECT', reason: '當天有考試' });
  check('場地：駁回要留原因', rejected.booking.status === 'REJECTED' && rejected.booking.rejectReason === '當天有考試', rejected.booking.status);

  const mineBookings = await data.myResourceBookings();
  check('場地：我的申請分得出待審／已批准', mineBookings.items.length >= 2 && mineBookings.upcoming >= 1, `${mineBookings.items.length} 筆／已批准 ${mineBookings.upcoming}`);

  const cancelled = await data.cancelResourceBooking(slotA.booking.id);
  check('場地：取消後狀態 CANCELLED', cancelled.status === 'CANCELLED', cancelled.status);

  const reuse = await data.createResourceBooking('r3', {
    startAt: venueUtil.slotIso(day, '09:00'),
    endAt: venueUtil.slotIso(day, '10:00'),
    purpose: '別人接手',
  });
  check('場地：取消後時段被釋放', reuse.booking.status === 'PENDING', reuse.booking.status);

  const free = await data.createResourceBooking('r4', {
    startAt: venueUtil.slotIso(day, '13:00'),
    endAt: venueUtil.slotIso(day, '14:00'),
    purpose: '借用投影機',
  });
  check('場地：免審批的送出即生效', free.pending === false && free.booking.status === 'APPROVED', free.booking.status);

  // 建場地是校內職員（STAFF）的能力，老師只有審批 —— 切職員再建
  await data.switchDemoUser('示範職員', 'demo-user', 'STAFF');
  const created = await data.createResource({ kind: 'VENUE', name: '示範新場地', openFrom: '09:00', openTo: '17:00', maxHours: 2 });
  check('場地：職員可新增場地', created.resource.name === '示範新場地', created.resource.id);

  await data.switchDemoUser('示範學生', 'demo-user', 'STUDENT');
  const deniedCreate = await data.createResource({ kind: 'VENUE', name: '學生偷建' }).then(() => null).catch((e) => e);
  check('場地：學生建不了場地（FORBIDDEN）', deniedCreate && deniedCreate.code === 'FORBIDDEN', deniedCreate ? deniedCreate.code : '沒有拒絕');

  const pageWxml2 = readFileSync(join(here, '..', 'pages', 'venues', 'detail', 'index.wxml'), 'utf8');
  const homeWxml2 = readFileSync(join(here, '..', 'pages', 'index', 'index.wxml'), 'utf8');
  const apiSrc4 = readFileSync(join(here, '..', 'services', 'api.js'), 'utf8');
  check(
    '場地：有畫面入口＋真 API 端點',
    pageWxml2.indexOf('bind:tap="submit"') !== -1 && homeWxml2.indexOf('goVenues') !== -1 && apiSrc4.indexOf("'/resources/'") !== -1,
    '首頁 → 列表 → 詳情（選時段送出）',
  );
}

// ── W-68 二手書／校服轉贈（示範層也要走完整流程：送出 → 申請 → 給誰 → 下架）──
{
  const list1 = await data.listGiveaways({});
  const hasGiven = list1.items.some((i) => i.id === 'gv5');
  check('轉贈：列表只回可申請（已贈出隱藏）', !hasGiven && list1.items.length === 4, `${list1.items.length} 件／含已贈出=${hasGiven}`);

  const books = await data.listGiveaways({ kind: 'BOOK' });
  check('轉贈：分類過濾', books.items.length === 2 && books.items.every((i) => i.kind === 'BOOK'), `${books.items.length} 本書`);

  const hit = await data.listGiveaways({ q: '外套' });
  check('轉贈：關鍵字命中', hit.items.length === 1 && hit.items[0].id === 'gv2', hit.items.length ? hit.items[0].title : '沒有結果');

  const otherItem = await data.getGiveaway('gv1');
  check(
    '轉贈：別人的物品看不到聯絡方式',
    otherItem.item.contactValue === null && otherItem.canRequest === true,
    `contact=${otherItem.item.contactValue}／可申請=${otherItem.canRequest}`,
  );

  const ownItem = await data.getGiveaway('gv2');
  check(
    '轉贈：自己的物品看得到聯絡方式且不能申請',
    ownItem.item.contactValue === '3201201002' && ownItem.canRequest === false && ownItem.isOwner === true,
    `contact=${ownItem.item.contactValue}／可申請=${ownItem.canRequest}`,
  );

  const mine1 = await data.myGiveaways();
  check(
    '轉贈：我的轉贈分得出我送出的與我申請的',
    mine1.posted.some((i) => i.id === 'gv2') && mine1.requests.some((r) => r.item.id === 'gv3' && r.status === 'PENDING') && mine1.requests.length === 2,
    `送出 ${mine1.posted.length} 件／申請 ${mine1.requests.length} 筆`,
  );

  const ownReq = await data.requestGiveaway('gv2', '自己申請自己').then(() => null).catch((e) => e);
  check('轉贈：不能申請自己的東西', ownReq && ownReq.code === 'VALIDATION_FAILED', ownReq ? ownReq.code : '沒有拒絕');

  const dupReq = await data.requestGiveaway('gv3', '再申請一次').then(() => null).catch((e) => e);
  check('轉贈：重複申請被擋（CONFLICT）', dupReq && dupReq.code === 'CONFLICT', dupReq ? dupReq.code : '沒有拒絕');

  const made = await data.requestGiveaway('gv1', '我這學期要修化學');
  check('轉贈：可申請別人的東西', made && made.ok === true, String(made && made.requestId));

  const mine2 = await data.myGiveaways();
  check(
    '轉贈：申請後出現在「我申請的」且狀態待回覆',
    mine2.requests.some((r) => r.item.id === 'gv1' && r.status === 'PENDING'),
    `${mine2.requests.length} 筆`,
  );

  const cancelled = await data.cancelGiveawayRequest(made.requestId);
  const mine3 = await data.myGiveaways();
  check(
    '轉贈：取消申請後狀態變已取消',
    cancelled.ok === true && mine3.requests.some((r) => r.id === made.requestId && r.status === 'CANCELLED'),
    'CANCELLED',
  );

  // 物主接受 gv2 的申請（申請人是另一位同學）→ 物品變已贈出
  const before = await data.getGiveaway('gv2');
  const pendingId = before.requests.filter((r) => r.status === 'PENDING')[0].id;
  const accepted = await data.decideGiveawayRequest(pendingId, 'ACCEPT');
  const after = await data.getGiveaway('gv2');
  check('轉贈：物主接受後物品變已贈出', accepted.action === 'ACCEPT' && after.item.status === 'GIVEN', after.item.status);

  const listAfterGive = await data.listGiveaways({});
  check(
    '轉贈：贈出後前台清單看不到',
    !listAfterGive.items.some((i) => i.id === 'gv2') && listAfterGive.items.length === 3,
    `${listAfterGive.items.length} 件`,
  );

  await data.setGiveawayStatus('gv1', 'CLOSED').then(
    () => {
      throw new Error('未預期：學生不該能下架別人的貼文');
    },
    () => null,
  );

  // 自己的東西才可以下架／重新上架：先建一件自己的
  const created = await data.createGiveaway({ kind: 'UNIFORM', title: '運動服外套', condition: 'GOOD', detail: 'L' });
  const listNew = await data.listGiveaways({});
  check(
    '轉贈：送出東西後清單 +1',
    created && created.item && created.item.status === 'AVAILABLE' && listNew.items.length === listAfterGive.items.length + 1,
    `${listNew.items.length} 件`,
  );

  await data.setGiveawayStatus(created.item.id, 'CLOSED');
  const listClosed = await data.listGiveaways({});
  check('轉贈：下架後清單看不到', !listClosed.items.some((i) => i.id === created.item.id), `${listClosed.items.length} 件`);

  await data.setGiveawayStatus(created.item.id, 'AVAILABLE');
  const listReopen = await data.listGiveaways({});
  check('轉贈：重新上架回到清單', listReopen.items.some((i) => i.id === created.item.id), `${listReopen.items.length} 件`);

  const deny = await data.setGiveawayStatus('gv3', 'CLOSED').then(() => null).catch((e) => e);
  check('轉贈：學生下架不了別人的貼文（FORBIDDEN）', deny && deny.code === 'FORBIDDEN', deny ? deny.code : '沒有拒絕');

  const detailWxml = readFileSync(join(here, '..', 'pages', 'giveaway', 'detail', 'index.wxml'), 'utf8');
  const homeWxml3 = readFileSync(join(here, '..', 'pages', 'index', 'index.wxml'), 'utf8');
  const apiSrc5 = readFileSync(join(here, '..', 'services', 'api.js'), 'utf8');
  check(
    '轉贈：有畫面入口＋真 API 端點',
    detailWxml.indexOf('bind:tap="onPrimary"') !== -1 && homeWxml3.indexOf('goGiveaway') !== -1 && apiSrc5.indexOf("'/giveaways/'") !== -1,
    '首頁 → 列表 → 詳情（我想要／給這位）',
  );
}

// ── W-72 請假申請（示範層也要走得完：送出 → 重疊被擋 → 取消 → 改狀態）──
{
  const before = await data.myLeaves();
  check('請假：我的假單有三種狀態', before.items.length >= 3 && before.pending >= 1, `${before.items.length} 張／待審 ${before.pending}`);

  const made = await data.createLeave({ kind: 'SICK', fromDate: '2030-01-07', toDate: '2030-01-08', reason: '示範層自檢用' });
  check('請假：送出後是待審批', made && made.leave && made.leave.status === 'PENDING' && made.leave.days === 2, made && made.leave ? `${made.leave.status}/${made.leave.days} 天` : '沒有建立');

  const after = await data.myLeaves();
  check('請假：送出後出現在我的假單', after.items.some((row) => row.id === made.leave.id) && after.pending === before.pending + 1, `${after.items.length} 張`);

  const dup = await data.createLeave({ kind: 'SICK', fromDate: '2030-01-08', toDate: '2030-01-09', reason: '重疊' }).then(() => null).catch((e) => e);
  check('請假：重疊日期被擋（CONFLICT）', dup && dup.code === 'CONFLICT', dup ? dup.code : '沒有拒絕');

  const bad = await data.createLeave({ kind: 'SICK', fromDate: '2030-02-05', toDate: '2030-02-01', reason: '倒轉' }).then(() => null).catch((e) => e);
  check('請假：結束早於開始被擋（VALIDATION_FAILED）', bad && bad.code === 'VALIDATION_FAILED', bad ? bad.code : '沒有拒絕');

  const cancelled = await data.cancelLeave(made.leave.id);
  const listAfterCancel = await data.myLeaves();
  check(
    '請假：取消後狀態變已取消',
    cancelled && cancelled.status === 'CANCELLED' && listAfterCancel.items.some((row) => row.id === made.leave.id && row.status === 'CANCELLED'),
    cancelled ? cancelled.status : '沒有取消',
  );

  const again = await data.cancelLeave(made.leave.id).then(() => null).catch((e) => e);
  check('請假：同一張不能取消兩次（CONFLICT）', again && again.code === 'CONFLICT', again ? again.code : '沒有拒絕');

  const createJs = readFileSync(join(here, '..', 'pages', 'leaves', 'create', 'index.js'), 'utf8');
  const mineWxml = readFileSync(join(here, '..', 'pages', 'leaves', 'mine', 'index.wxml'), 'utf8');
  const homeWxml4 = readFileSync(join(here, '..', 'pages', 'index', 'index.wxml'), 'utf8');
  const apiSrc6 = readFileSync(join(here, '..', 'services', 'api.js'), 'utf8');
  check(
    '請假：有畫面入口＋真 API 端點',
    createJs.indexOf('createLeave') !== -1 && mineWxml.indexOf('goCreate') !== -1 && homeWxml4.indexOf('goLeaves') !== -1 && apiSrc6.indexOf("'/leaves'") !== -1,
    '首頁 → 我的假單 → 請假（送出／取消）',
  );
}

// ── W-99 家長代子女請假（示範層也要走完：代送 → 標記來源 → 只能替自己的孩子）──
{
  await data.switchDemoUser('培華家長', 'demo-parent', 'PARENT');

  const asParent = await data.myLeaves();
  check(
    '家長請假：看得到子女的假單（含家長代送與學生自送兩種）',
    asParent.items.length >= 2 &&
      asParent.items.some((row) => row.source === 'PARENT') &&
      asParent.items.every((row) => row.studentId !== 'demo-parent'),
    `${asParent.items.length} 張／代送 ${asParent.items.filter((row) => row.source === 'PARENT').length} 張`,
  );
  check(
    '家長請假：代送的單標「家長代送」',
    asParent.items.filter((row) => row.source === 'PARENT').every((row) => row.sourceText === '家長代送'),
    'sourceText 與 source 一致',
  );

  const madeByParent = await data
    .createLeave({ studentId: 'demo-child-1', kind: 'SICK', fromDate: '2031-03-03', toDate: '2031-03-04', reason: '家長代送自檢' })
    .then((r) => r)
    .catch((e) => e);
  check(
    '家長請假：代子女送出成功且來源是家長',
    madeByParent && madeByParent.leave && madeByParent.leave.source === 'PARENT' && madeByParent.leave.days === 2,
    madeByParent && madeByParent.leave ? `${madeByParent.leave.sourceText}／${madeByParent.leave.days} 天` : '沒有建立',
  );
  const listedAfter = await data.myLeaves();
  check(
    '家長請假：代送後出現在家長的我的假單',
    madeByParent && madeByParent.leave && listedAfter.items.some((row) => row.id === madeByParent.leave.id),
    madeByParent && madeByParent.leave ? madeByParent.leave.id : '沒有建立',
  );

  const notMine = await data
    .createLeave({ studentId: 'demo-user', kind: 'SICK', fromDate: '2031-04-01', toDate: '2031-04-01', reason: '代別人請假' })
    .then(() => null)
    .catch((e) => e);
  check('家長請假：替沒綁定的學生請假被擋（FORBIDDEN）', notMine && notMine.code === 'FORBIDDEN', notMine ? notMine.code : '沒有拒絕');

  const noChild = await data
    .createLeave({ kind: 'SICK', fromDate: '2031-04-02', toDate: '2031-04-02', reason: '沒指定子女' })
    .then(() => null)
    .catch((e) => e);
  check('家長請假：沒指定子女被擋（VALIDATION_FAILED）', noChild && noChild.code === 'VALIDATION_FAILED', noChild ? noChild.code : '沒有拒絕');

  await data.switchDemoUser('示範學生', 'demo-user', 'STUDENT');
  const asStudent = await data
    .createLeave({ studentId: 'demo-child-1', kind: 'SICK', fromDate: '2031-05-01', toDate: '2031-05-01', reason: '替別人請假' })
    .then(() => null)
    .catch((e) => e);
  check('家長請假：學生帶別人的 studentId 被擋（FORBIDDEN）', asStudent && asStudent.code === 'FORBIDDEN', asStudent ? asStudent.code : '沒有拒絕');

  const parentWxml = readFileSync(join(here, '..', 'pages', 'parent', 'index.wxml'), 'utf8');
  const parentJs = readFileSync(join(here, '..', 'pages', 'parent', 'index.js'), 'utf8');
  const createPageJs = readFileSync(join(here, '..', 'pages', 'leaves', 'create', 'index.js'), 'utf8');
  check(
    '家長請假：家長頁有「代請假」入口與孩子的假單區',
    parentWxml.indexOf('goLeaveCreate') !== -1 && parentWxml.indexOf('{{L.k30}}') !== -1 && parentJs.indexOf('data.myLeaves()') !== -1,
    '家長頁 → 代請假／孩子的假單',
  );
  check(
    '家長請假：代請假會帶上目前選中的子女',
    parentJs.indexOf("'?studentId='") !== -1 && createPageJs.indexOf('presetChild') !== -1,
    'parent → leaves/create?studentId=…',
  );
}

// ── W-73 班級課表（示範層也要有資料，首頁「下一節」斷網時不能空白）──
{
  const today = await data.timetableToday();
  check('課表：今天有課或有「不用上課」的說明', !!today && typeof today.schoolDay === 'boolean', today ? `${today.weekdayLabel || '—'}／${today.slots.length} 節` : '沒有回應');

  const week = await data.timetable({});
  check('課表：整週有 5 天且每格帶 timeText', (week.weekdays || []).length === 5 && week.slots.every((s) => !!s.timeText), `${week.slots.length} 格`);
  // 印出來／存成圖片的課表要像真的：每格都要有課室與老師（以前按節次給 room，音樂會排在操場）
  check(
    '課表：示範資料每格都有課室與老師',
    week.slots.every((s) => !!s.room && !!s.teacherName),
    `${week.slots.filter((s) => !!s.room && !!s.teacherName).length}/${week.slots.length} 格`,
  );

  const dry = await data.importTimetable({ csv: '高二仁,1,1,數學\n高二仁,9,1,地理', dryRun: true });
  check('課表：CSV 先檢查（壞行回報、不寫入）', dry.dryRun === true && dry.errors.length === 1 && dry.created === 0, `${dry.ok}/${dry.total}、錯 ${dry.errors.length}`);

  const saved = await data.saveTimetableSlot({ className: '高二仁', weekday: 3, period: 8, subject: '自習', room: '302' });
  const again = await data.saveTimetableSlot({ className: '高二仁', weekday: 3, period: 8, subject: '自習（代課）', room: '302' });
  const week2 = await data.timetable({ className: '高二仁' });
  const cell = week2.slots.filter((s) => s.weekday === 3 && s.period === 8)[0];
  check('課表：同一班同一節是「改那一格」不是長第二格', !!saved && !!again && week2.slots.filter((s) => s.weekday === 3 && s.period === 8).length === 1 && cell.subject === '自習（代課）', cell ? cell.subject : '沒有寫入');

  const apiSrcTt = readFileSync(join(here, '..', 'services', 'api.js'), 'utf8');
  const homeWxmlTt = readFileSync(join(here, '..', 'pages', 'index', 'index.wxml'), 'utf8');
  check('課表：有畫面入口＋真 API 端點', homeWxmlTt.indexOf('goTimetable') !== -1 && apiSrcTt.indexOf("'/timetable/today'") !== -1, '首頁 → 課表（今日／整週）');

  // ── W-82 放假：示範層要跑同一套規則（不是寫死 null），否則示範模式永遠看不到「今天不用上課：<原因>」──
  check(
    '課表：回 dayOff／dayOffReason 兩個欄位（真 API 與示範層契約一致）',
    'dayOff' in today && typeof today.dayOffReason === 'string',
    today.dayOffReason || '今天不是放假',
  );
  const demoKey = 'pv_demo_seed'; // config.STORAGE_KEYS.demo（不要用 includes('demo') 抓：會抓到 pv_force_demo）
  const demoDB = store.get(demoKey) || null;
  if (demoDB && today.weekday >= 1 && today.weekday <= 5) {
    // 造一則「今天」的 CALENDAR 公告 → 應該停課並寫出原因；移除後要恢復（兩件一起算一條）
    demoDB.notices = (demoDB.notices || []).concat([
      { id: 'w82-holiday', title: '重陽節假期', kind: 'CALENDAR', isPinned: false, publishedAt: new Date(today.date + 'T08:00:00'), expiresAt: null, content: '自我檢查用：放假一天。' },
    ]);
    store.set(demoKey, demoDB);
    const hol = await data.timetableToday();
    const fired = hol.schoolDay === false && hol.dayOffReason === '重陽節假期（校曆公告）' && hol.slots.length === 0;
    demoDB.notices = demoDB.notices.filter((n) => n.id !== 'w82-holiday');
    store.set(demoKey, demoDB);
    const back = await data.timetableToday();
    check(
      '課表：當天有校曆公告 → 停課並寫出原因，移除後恢復（示範層同一套規則）',
      fired && back.schoolDay === true && back.slots.length === today.slots.length,
      fired ? `${hol.dayOffReason}／移除後 ${back.slots.length} 節` : '（未生效）',
    );
  } else {
    check(
      '課表：放假規則（今天是週末：schoolDay=false 但 dayOff 為 null，不誤標成放假）',
      today.schoolDay === false && today.dayOff === null && today.dayOffReason === '',
      today.weekday >= 6 ? `週${today.weekday}` : '沒有示範資料',
    );
  }
}

// ── W-79 首頁家長摘要：子女功課未交數（示範層要有非 0，交付現場斷網時這格才有東西看）──
{
  const kidsHw = await data.parentChildren();
  const kid = (kidsHw.items || [])[0];
  const kidHw = await data.parentChildHomework(kid.studentId);
  check(
    '家長摘要：子女功課未交數（示範層非 0）',
    kidHw && kidHw.stats && kidHw.stats.todo > 0 && kidHw.stats.todo + kidHw.stats.done === kidHw.stats.total,
    `todo ${kidHw.stats.todo}／total ${kidHw.stats.total}（${kid.nickname}）`,
  );

  const homeJsHw = readFileSync(join(here, '..', 'pages', 'index', 'index.js'), 'utf8');
  const homeWxmlHw = readFileSync(join(here, '..', 'pages', 'index', 'index.wxml'), 'utf8');
  check(
    '家長摘要：畫面有那行且接得到功課端點',
    homeJsHw.indexOf('parentChildHomework') !== -1 && homeWxmlHw.indexOf('parentSummary.homeworkText') !== -1,
    'pages/index',
  );
}

// ── W-88 校園提案（示範層也要提得動、連署得了、校方回覆得了）──
{
  const listAll = await data.listProposals({});
  const counts = listAll.counts || {};
  const sumOf = ['OPEN', 'REVIEWING', 'PLANNED', 'DONE', 'DECLINED'].reduce((s, k) => s + (counts[k] || 0), 0);
  check(
    '提案：示範清單有資料且計數對得上',
    (listAll.items || []).length >= 4 && counts.ALL === sumOf && counts.OPEN >= 1,
    `${(listAll.items || []).length} 筆／OPEN ${counts.OPEN}／DONE ${counts.DONE}`,
  );

  const created = await data.createProposal({ title: '樓梯加裝扶手', body: '三樓到四樓的樓梯沒有扶手，下雨天很滑，希望加裝。', category: 'FACILITY' });
  check(
    '提案：作者自動算第一票且狀態是收集中',
    created.supportCount === 1 && created.isMine === true && created.status === 'OPEN' && created.mySupported === true,
    `${created.supportCount}/${created.goal}`,
  );

  const tooShort = await data.createProposal({ title: '太短', body: '太短' }).then((r) => r).catch((e) => e);
  check('提案：標題或內容太短會被擋', tooShort && tooShort.code === 'VALIDATION_FAILED', tooShort && tooShort.code);

  // 換一個人來連署：示範層要真的走「另一個人」的路徑，不是自己加自己
  await data.switchDemoUser('李同學', 'demo-mate-1', 'STUDENT');
  const first = await data.supportProposal('pp2');
  const again = await data.supportProposal('pp2');
  check(
    '提案：連署加票，重複按不再加（already）',
    first.already === false && again.already === true && first.supportCount === again.supportCount,
    `${first.supportCount} → ${again.supportCount}`,
  );

  const closed = await data.supportProposal('pp3').then((r) => r).catch((e) => e);
  check('提案：已完成的提案不能再連署', closed && closed.code === 'CONFLICT', closed && closed.code);

  const sorted = await data.listProposals({ sort: 'support', limit: 20 });
  const descending = (sorted.items || []).every((p, i) => i === 0 || sorted.items[i - 1].supportCount >= p.supportCount);
  check('提案：最多連署排序遞減', descending, (sorted.items || []).map((p) => p.supportCount).join('>'));

  const supported = await data.listProposals({ scope: 'supported', limit: 20 });
  const allMine = (supported.items || []).every((p) => p.mySupported === true);
  check('提案：我連署的清單只回我參與過的', allMine && (supported.items || []).length >= 1, `${(supported.items || []).length} 筆`);

  // 作者不能取消自己那一票
  await data.switchDemoUser('示範學生', 'demo-user', 'STUDENT');
  const own = await data.unsupportProposal('pp2').then((r) => r).catch((e) => e);
  check('提案：提案人不能取消自己的連署', own && own.code === 'VALIDATION_FAILED', own && own.code);

  const studentReply = await data.replyProposal('pp2', { reply: '不應該成功' }).then((r) => r).catch((e) => e);
  check('提案：學生不能回覆', studentReply && studentReply.code === 'FORBIDDEN', studentReply && studentReply.code);

  await data.switchDemoUser('校務處', 'demo-staff', 'STAFF');
  const replied = await data.replyProposal('pp2', { reply: '已請總務評估扶手位置。', status: 'REVIEWING' });
  check(
    '提案：校方回覆會改狀態並算出通知人數',
    replied.reply && replied.reply.body.indexOf('扶手') !== -1 && replied.status === 'REVIEWING' && replied.notified >= 1,
    `${replied.status}／通知 ${replied.notified} 人`,
  );

  const admin = await data.adminProposals({});
  check(
    '提案：後台統計由資料層算（不用前端加總）',
    admin.stats.proposals === admin.counts.ALL && admin.stats.supports >= admin.stats.proposals && !!admin.categories,
    `${admin.stats.proposals} 個／${admin.stats.supports} 人次`,
  );

  const removed = await data.removeProposal('pp4');
  const afterRemove = await data.listProposals({ limit: 20 });
  check(
    '提案：下架後前台清單看不到',
    removed.deleted === true && !(afterRemove.items || []).some((p) => p.id === 'pp4'),
    `剩 ${(afterRemove.items || []).length} 筆`,
  );

  await data.switchDemoUser('示範學生', 'demo-user', 'STUDENT');
  const homeWxmlPp = readFileSync(join(here, '..', 'pages', 'index', 'index.wxml'), 'utf8');
  const apiSrcPp = readFileSync(join(here, '..', 'services', 'api.js'), 'utf8');
  const appJsonPp = JSON.parse(readFileSync(join(here, '..', 'app.json'), 'utf8'));
  check(
    '提案：有畫面入口＋真 API 端點＋頁面已登記',
    homeWxmlPp.indexOf('goProposals') !== -1 &&
      apiSrcPp.indexOf("'/proposals'") !== -1 &&
      appJsonPp.pages.indexOf('pages/proposals/list/index') !== -1 &&
      appJsonPp.pages.indexOf('pages/proposals/detail/index') !== -1 &&
      appJsonPp.pages.indexOf('pages/proposals/create/index') !== -1,
    '首頁 → 列表 → 詳情／提出建議',
  );
}

// ── W-90 提案連署名單（詳情只帶 12 位，其餘分頁翻）──
{
  const detail = await data.getProposal('pp1');
  const shown = (detail.supporters || []).length;
  check(
    '連署名單：詳情只帶前 12 位，票數仍是全部',
    shown === 12 && detail.supportCount > 12 && detail.supportersTotal === detail.supportCount,
    `帶 ${shown} 位／共 ${detail.supportCount} 人`,
  );

  const pages = [];
  for (let p = 1; p <= 4; p += 1) pages.push(await data.proposalSupports('pp1', { page: p, limit: 5 }));
  const ids = pages.reduce((acc, r) => acc.concat((r.items || []).map((s) => s.id)), []);
  const sameOrder = (pages[0].items || []).every((s, i) => s.id === detail.supporters[i].id);
  check(
    '連署名單：逐頁翻得完、不重複不漏人，順序與詳情一致',
    (pages[0].items || []).length === 5 &&
      pages[0].hasMore === true &&
      pages[3].hasMore === false &&
      ids.length === detail.supportCount &&
      new Set(ids).size === detail.supportCount &&
      sameOrder,
    `${ids.length} 筆／${new Set(ids).size} 位不重複／共 ${pages[0].total}`,
  );

  const row = (pages[0].items || [])[0] || {};
  check(
    '連署名單：每一列都有名字、身分與時間（前端不用自己補）',
    Boolean(row.nickname) && Boolean(row.role) && typeof row.at === 'string',
    `${row.nickname || '—'}／${row.role || '—'}`,
  );

  const missing = await data.proposalSupports('pp-not-exist', {}).then((r) => r).catch((e) => e);
  check('連署名單：不存在的提案回 NOT_FOUND', Boolean(missing && missing.code === 'NOT_FOUND'), missing && missing.code);

  const detailWxmlSup = readFileSync(join(here, '..', 'pages', 'proposals', 'detail', 'index.wxml'), 'utf8');
  const apiSrcSup = readFileSync(join(here, '..', 'services', 'api.js'), 'utf8');
  const appJsonSup = JSON.parse(readFileSync(join(here, '..', 'app.json'), 'utf8'));
  check(
    '連署名單：詳情有「看全部」入口＋真 API 端點＋頁面已登記',
    detailWxmlSup.indexOf('goSupporters') !== -1 &&
      apiSrcSup.indexOf("'/supports'") !== -1 &&
      appJsonSup.pages.indexOf('pages/proposals/supporters/index') !== -1,
    '詳情 → 看全部 → 名單頁',
  );
}

// ── W-89 課室設備報修（示範層也要驗到「寫得進、接得走、算得對」）──
{
  const before = await data.myRepairs();
  check('報修：示範清單有資料且進行中數對得上', (before.items || []).length > 0 && before.active >= 1, `${(before.items || []).length} 筆／進行中 ${before.active}`);

  const created = await data.createRepair({
    location: '化學實驗室',
    equipment: '水龍頭',
    description: '洗手台的水龍頭關不緊，一直在滴水。',
    urgency: 'NORMAL',
  });
  check('報修：送出成功且狀態是待接單', created.repair.status === 'PENDING' && created.repair.statusText === '待接單', created.repair.statusText);

  const after = await data.myRepairs();
  check('報修：送出後我的清單多一筆', (after.items || []).length === (before.items || []).length + 1, `${(after.items || []).length} 筆`);

  const shortDesc = await data.createRepair({ location: '304 室', equipment: '燈', description: '壞' }).then(() => null).catch((e) => e);
  check('報修：描述太短被擋', shortDesc && shortDesc.code === 'VALIDATION_FAILED', shortDesc ? shortDesc.code : '沒有拒絕');

  const badPhoto = await data.createRepair({ location: '304 室', equipment: '燈', description: '燈管在閃', photoUrl: 'cos://x.jpg' }).then(() => null).catch((e) => e);
  check('報修：非 http(s) 照片被擋', badPhoto && badPhoto.code === 'VALIDATION_FAILED', badPhoto ? badPhoto.code : '沒有拒絕');

  const cancelled = await data.cancelRepair(created.repair.id);
  check('報修：待接單可以自己取消', cancelled && cancelled.status === 'CANCELLED', cancelled ? cancelled.status : '沒有成功');

  // 老師沒有 repair:handle：後台清單要擋
  await data.switchDemoUser('示範老師', 'demo-user', 'TEACHER');
  const teacherAdmin = await data.adminRepairs({ status: 'PENDING' }).then(() => null).catch((e) => e);
  check('報修：老師打後台清單被擋（沒有 repair:handle）', teacherAdmin && teacherAdmin.code === 'FORBIDDEN', teacherAdmin ? teacherAdmin.code : '沒有拒絕');

  // 職員：接單 → 完成
  await data.switchDemoUser('校務處', 'demo-staff', 'STAFF');
  const pending = await data.adminRepairs({ status: 'PENDING' });
  const target = (pending.items || []).filter((row) => row.status === 'PENDING')[0];
  check('報修：後台清單有待接單的單子', !!target, target ? target.location + ' · ' + target.equipment : '沒有待接單');

  if (target) {
    const accepted = await data.acceptRepair(target.id);
    check('報修：接單後變處理中並記下處理人', accepted.repair.status === 'IN_PROGRESS' && !!accepted.repair.handler, `${accepted.repair.status}／${(accepted.repair.handler || {}).nickname}`);
    const again = await data.acceptRepair(target.id).then(() => null).catch((e) => e);
    check('報修：同一張不能再接第二次', again && again.code === 'CONFLICT', again ? again.code : '沒有拒絕');
    const finished = await data.finishRepair(target.id, { note: '換了水龍頭墊片' });
    check('報修：完成後有備註與處理時數', finished.repair.status === 'DONE' && finished.repair.note === '換了水龍頭墊片' && typeof finished.repair.hours === 'number', `${finished.repair.status}／${finished.repair.hours} 小時`);
  }

  const stats = await data.repairStats();
  const sum = Object.keys(stats.counts).reduce((n, k) => n + stats.counts[k], 0);
  check('報修：統計總數等於各狀態加總', sum === stats.total, `${sum}／${stats.total}`);
  check('報修：近 7 天序列是 7 格', (stats.timeline || []).length === 7, `${(stats.timeline || []).length} 格`);
  check('報修：熱門地點有資料且數量遞減', (stats.byLocation || []).length > 0 && stats.byLocation[0].count >= (stats.byLocation[1] ? stats.byLocation[1].count : 0), `${(stats.byLocation || []).length} 個地點`);

  await data.switchDemoUser('示範學生', 'demo-user', 'STUDENT');

  const apiSrcRp = readFileSync(join(here, '..', 'services', 'api.js'), 'utf8');
  const appJsonRp = JSON.parse(readFileSync(join(here, '..', 'app.json'), 'utf8'));
  const homeWxmlRp = readFileSync(join(here, '..', 'pages', 'index', 'index.wxml'), 'utf8');
  check(
    '報修：有畫面入口＋真 API 端點＋頁面已登記',
    homeWxmlRp.indexOf('goRepair') !== -1 &&
      apiSrcRp.indexOf("'/repairs'") !== -1 &&
      appJsonRp.pages.indexOf('pages/repair/index/index') !== -1 &&
      appJsonRp.pages.indexOf('pages/repair/create/index') !== -1,
    '首頁 → 我的報修 → 報修',
  );
}

// ── W-113 審批時效（三組同一把尺；樣本只算已批准、沒有樣本回 null）──
{
  const wide = await data.approvalStats(90);
  const narrow = await data.approvalStats(7);
  const gOf = (res, key) => (res.groups || []).filter((g) => g.key === key)[0] || {};
  const leaveWide = gOf(wide, 'leave');
  const leaveNarrow = gOf(narrow, 'leave');
  const bookingWide = gOf(wide, 'booking');
  const repairWide = gOf(wide, 'repair');

  check(
    '審批時效：三組齊全（假單／場地器材／報修）',
    (wide.groups || []).length === 3 && ['leave', 'booking', 'repair'].every((key) => !!gOf(wide, key).counts),
    (wide.groups || []).map((g) => g.key).join('、'),
  );
  check(
    '審批時效：件數等於各狀態加總（送出多少張對得起來）',
    (wide.groups || []).every((g) => {
      const sum = Object.keys(g.counts).filter((k) => k !== 'total').reduce((n, k) => n + (g.counts[k] || 0), 0);
      return sum === g.counts.total;
    }),
    (wide.groups || []).map((g) => g.counts.total).join('／'),
  );
  check(
    '審批時效：已駁回不進時效（三個樣本會把中位數拉到 20 小時）',
    leaveWide.hours.samples === 2 && leaveWide.hours.p50 === 10 && leaveWide.hours.avg === 15,
    `${leaveWide.hours.samples} 個樣本／p50 ${leaveWide.hours.p50}／avg ${leaveWide.hours.avg}`,
  );
  check(
    '審批時效：沒有樣本回 null 不是 0（近 7 天沒有已批准的假單）',
    leaveNarrow.hours.samples === 0 && leaveNarrow.hours.p50 === null && leaveNarrow.hours.avg === null,
    `${leaveNarrow.hours.samples} 個樣本／p50 ${String(leaveNarrow.hours.p50)}`,
  );
  check(
    '審批時效：借用與報修用同一個形狀（p50／p90／avg 都有鍵）',
    ['p50', 'p90', 'avg'].every((k) => k in bookingWide.hours && k in repairWide.hours) &&
      !!repairWide.doneHours &&
      ['p50', 'p90', 'avg'].every((k) => k in repairWide.doneHours),
    `借用 ${bookingWide.hours.samples} 樣本／報修完成 ${repairWide.doneHours.samples} 樣本`,
  );

  // 畫面文字由 utils/approval.js 的純函式組出來：規則（沒樣本顯示「—」、報修分接單與完成）要在這裡釘住
  const approvalUtil = require(join(here, '..', 'utils', 'approval.js'));
  const t = {
    unit: '小時', near: '近', dayUnit: '天送出的單', countUnit: '張', pending: '待審', approved: '已批',
    average: '平均', acceptAverage: '接單平均', done: '完成', inProgress: '處理中', median: '中位',
    labels: { leave: '假單', booking: '場地／器材', repair: '報修' },
  };
  const blankRow = approvalUtil.summarize(
    { days: 30, groups: [{ key: 'leave', counts: { total: 0, pending: 0, approved: 0 }, hours: { samples: 0, p50: null, p90: null, avg: null } }] },
    t,
  )[0];
  check(
    '審批時效：沒有樣本顯示「—」不是 0 小時',
    blankRow.p50Text.indexOf('—') !== -1 && blankRow.metaText.indexOf('0 小時') === -1,
    blankRow.p50Text + ' / ' + blankRow.metaText,
  );
  const rowTexts = approvalUtil.summarize(wide, t);
  check(
    '審批時效：三行都有名稱與中位數',
    rowTexts.length === 3 && rowTexts.every((row) => !!row.label && row.p50Text.indexOf('中位') === 0),
    rowTexts.map((row) => row.label).join('、'),
  );
  check(
    '審批時效：報修那行分開寫接單與完成',
    rowTexts[2].metaText.indexOf('接單平均') !== -1 && rowTexts[2].metaText.indexOf('完成') !== -1,
    rowTexts[2].metaText.slice(0, 48),
  );

  const adminSrcAp = readFileSync(join(here, '..', 'services', 'admin.js'), 'utf8');
  const adminWxmlAp = readFileSync(join(here, '..', 'pages', 'admin', 'index', 'index.wxml'), 'utf8');
  check(
    '審批時效：有真 API 端點＋畫面入口（不是只有方法沒人呼叫）',
    adminSrcAp.indexOf('/admin/approvals/stats') !== -1 && adminWxmlAp.indexOf('approvalRows') !== -1,
    '概況 → 審批時效',
  );
}

// ── W-94 教師端班級總覽（聚合數字必須與各模組清單同一份口徑）──
{
  await data.switchDemoUser('示範老師', 'demo-user', 'TEACHER');
  const ov = await data.classOverview();
  const hwStats = await data.homeworkStats();
  const list = await data.listHomework({ scope: 'all' });

  check('班級總覽：老師看得到自己班', ov && ov.className && ov.classSize > 0, `${ov && ov.className}／${ov && ov.classSize} 人`);
  check(
    '班級總覽：未交人次等於「班上人數 − 已交」總和',
    ov && ov.homework && ov.homework.pendingTotal === (hwStats.items || []).reduce((n, row) => n + Math.max(0, ov.classSize - row.done), 0),
    `${ov && ov.homework && ov.homework.pendingTotal}`,
  );
  check(
    '班級總覽：依科目分組加總等於總人次',
    ov && ov.homework && (ov.homework.subjects || []).reduce((n, s) => n + s.pending, 0) === ov.homework.pendingTotal,
    `${(ov && ov.homework && ov.homework.subjects.length) || 0} 科`,
  );
  check(
    '班級總覽：功課項數與功課清單一致',
    ov && ov.homework && ov.homework.items === (list.items || []).length,
    `${ov && ov.homework && ov.homework.items}／${(list.items || []).length}`,
  );
  check(
    '班級總覽：待審假單數與假單後台清單一致',
    ov && (await data.adminLeaves({ status: 'PENDING' })).total === ov.leaves.pending,
    `${ov && ov.leaves && ov.leaves.pending} 張`,
  );

  const otherClass = await data.classOverview({ className: '高二忠' }).then(() => null).catch((e) => e);
  check('班級總覽：老師帶別班被擋', otherClass && otherClass.code === 'FORBIDDEN', otherClass ? otherClass.code : '沒有拒絕');

  await data.switchDemoUser('示範學生', 'demo-user', 'STUDENT');
  const asStudent = await data.classOverview().then(() => null).catch((e) => e);
  check('班級總覽：學生被擋（這一頁有學生姓名）', asStudent && asStudent.code === 'FORBIDDEN', asStudent ? asStudent.code : '沒有拒絕');

  const apiSrcOv = readFileSync(join(here, '..', 'services', 'api.js'), 'utf8');
  const hwWxmlOv = readFileSync(join(here, '..', 'pages', 'homework', 'index.wxml'), 'utf8');
  check(
    '班級總覽：有畫面入口＋真 API 端點',
    hwWxmlOv.indexOf('L.k46') !== -1 && hwWxmlOv.indexOf('overviewStats') !== -1 && apiSrcOv.indexOf("'/teacher/class'") !== -1,
    '功課頁 → 班級總覽',
  );
}

// ── W-106 本班出席率月報（與後台月報同一份口徑：缺席 = 人日、請假不算缺席、沒紀錄回 null）──
{
  await data.switchDemoUser('示範老師', 'demo-user', 'TEACHER');
  const att = await data.classAttendance();

  check('本班出席率：老師看得到自己班', att && att.className && att.summary && att.summary.records > 0, `${att && att.className}／${att && att.summary && att.summary.records} 人日`);
  check(
    '本班出席率：四類加總等於紀錄人日',
    att && att.summary && att.summary.present + att.summary.late + att.summary.absent + att.summary.leave === att.summary.records,
    att && att.summary ? `${att.summary.present}+${att.summary.late}+${att.summary.absent}+${att.summary.leave}` : '沒有資料',
  );
  check(
    '本班出席率：出席率＝(人日−缺席)÷人日，遲到仍算出席',
    att && att.summary && att.summary.rate === Math.round(((att.summary.records - att.summary.absent) / att.summary.records) * 1000) / 10,
    `${att && att.summary && att.summary.rate}%`,
  );
  check(
    '本班出席率：每日明細加總等於 summary',
    att && (att.byDay || []).length > 0 &&
      att.byDay.reduce((n, d) => n + d.records, 0) === att.summary.records &&
      att.byDay.reduce((n, d) => n + d.absent, 0) === att.summary.absent,
    `${(att && (att.byDay || []).length) || 0} 天`,
  );
  check(
    '本班出席率：缺席最多的三天最多 3 筆、只含有缺席的日子且由多到少',
    att && (att.worstDays || []).every((d) => d.absent > 0) &&
      (att.worstDays || []).length <= 3 &&
      (att.worstDays || []).every((d, i, arr) => i === 0 || arr[i - 1].absent >= d.absent),
    `${(att && (att.worstDays || []).length) || 0} 天`,
  );
  check(
    '本班出席率：示範層重新整理數字不會跳（穩定雜湊）',
    await data.classAttendance().then((again) => again.summary.records === (att && att.summary && att.summary.records) && again.summary.absent === att.summary.absent),
    '同一個月兩次呼叫相同',
  );

  const future = await data.classAttendance({ month: '2099-01' });
  check('本班出席率：還沒有紀錄的月份回 null 而不是 0%', future && future.summary.rate === null && (future.byDay || []).length === 0, `${future && future.summary && future.summary.rate}`);

  const otherAtt = await data.classAttendance({ className: '高二忠' }).then(() => null).catch((e) => e);
  check('本班出席率：老師帶別班被擋', otherAtt && otherAtt.code === 'FORBIDDEN', otherAtt ? otherAtt.code : '沒有拒絕');

  await data.switchDemoUser('示範學生', 'demo-user', 'STUDENT');
  const attAsStudent = await data.classAttendance().then(() => null).catch((e) => e);
  check('本班出席率：學生被擋', attAsStudent && attAsStudent.code === 'FORBIDDEN', attAsStudent ? attAsStudent.code : '沒有拒絕');

  const apiSrcAtt = readFileSync(join(here, '..', 'services', 'api.js'), 'utf8');
  const hwWxmlAtt = readFileSync(join(here, '..', 'pages', 'homework', 'index.wxml'), 'utf8');
  check(
    '本班出席率：有畫面入口＋真 API 端點',
    hwWxmlAtt.indexOf('L.k55') !== -1 && hwWxmlAtt.indexOf('attendance.dayLines') !== -1 && apiSrcAtt.indexOf("'/teacher/class/attendance'") !== -1,
    '功課頁 → 本月出席率',
  );
}

// ── W-96 通知中心分組（示範層與後端同一份口袋）──
{
  await data.switchDemoUser('示範學生', 'demo-user', 'STUDENT');
  const all = await data.notifications();
  const groups = all.groups || [];
  const buckets = groups.filter((g) => g.key !== 'ALL');

  check('通知分組：六個口袋都在', groups.length === 6 && groups[0].key === 'ALL', groups.map((g) => g.key).join('/'));
  check(
    '通知分組：各組加總等於全部',
    buckets.reduce((n, g) => n + g.total, 0) === (groups[0] || {}).total &&
      buckets.reduce((n, g) => n + g.unread, 0) === (groups[0] || {}).unread,
    `全部 ${(groups[0] || {}).total}／未讀 ${(groups[0] || {}).unread}`,
  );
  check(
    '通知分組：每筆都帶正確的 group',
    (all.items || []).every((n) => {
      const expected = { HOMEWORK: 'HOMEWORK', LIBRARY: 'LIBRARY', LEAVE: 'APPROVAL', BOOKING: 'APPROVAL', REPAIR: 'REPAIR' }[n.kind] || 'OTHER';
      return n.group === expected;
    }),
    `${(all.items || []).length} 筆`,
  );

  const homework = await data.notifications({ group: 'HOMEWORK' });
  check(
    '通知分組：只回那一組',
    homework.group === 'HOMEWORK' && homework.items.length > 0 && homework.items.every((n) => n.kind === 'HOMEWORK'),
    `${homework.items.length} 筆`,
  );

  const approvalUnread = await data.notificationsUnread('APPROVAL');
  const approvalRow = (all.groups || []).filter((g) => g.key === 'APPROVAL')[0] || {};
  check('通知分組：單組未讀數與統計一致', approvalUnread.unread === approvalRow.unread, `${approvalUnread.unread}／${approvalRow.unread}`);

  const beforeRepair = (all.groups || []).filter((g) => g.key === 'REPAIR')[0] || { unread: 0 };
  const cleared = await data.readAllNotifications('REPAIR');
  const after = await data.notifications();
  const afterRepair = (after.groups || []).filter((g) => g.key === 'REPAIR')[0] || { unread: 0 };
  const afterAll = (after.groups || [])[0] || { unread: 0 };
  check(
    '通知分組：清一組不影響別組',
    cleared.cleared === beforeRepair.unread && afterRepair.unread === 0 && afterAll.unread > 0 && afterAll.unread < (all.groups[0] || {}).unread,
    `清了 ${cleared.cleared} 則，剩 ${afterAll.unread} 則未讀`,
  );

  const apiSrcNotif = readFileSync(join(here, '..', 'services', 'api.js'), 'utf8');
  const notifWxml = readFileSync(join(here, '..', 'pages', 'notifications', 'index.wxml'), 'utf8');
  check(
    '通知分組：有畫面入口＋真 API 端點',
    notifWxml.indexOf('notif-chip') !== -1 &&
      notifWxml.indexOf('bindtap="onGroup"') !== -1 &&
      apiSrcNotif.indexOf("'/notifications/read-all'") !== -1,
    '通知頁 chips → read-all',
  );
}

// ── W-95 收尾：成績單列印（示範層同語意＋三條資料路徑）──
{
  const sheetLib = require(join(here, '..', 'utils', 'transcriptSheet.js'));
  await data.switchDemoUser('示範學生', 'demo-user', 'STUDENT');
  const g = await data.schoolGrades();
  const a = await data.schoolAttendance();
  const built = sheetLib.build({ grades: g.items, attendance: a.items, termLabels: ['第一段', '第二段', '第三段'] });

  check('成績單：示範層有兩個學年', built.years.length === 2, built.years.join(' / '));
  check('成績單：預設取最新學年', built.yearTerm === built.years[0], built.yearTerm);
  check('成績單：本學年有兩個學段', built.sections.length === 2, built.sections.map((s) => s.term).join(' / '));
  check('成績單：平均分只算有分數的科目', built.sections[1] && built.sections[1].averageText === '83.8', built.sections[1] ? built.sections[1].averageText : '沒有第二段');
  check('成績單：出缺席只算本學年', built.attendance.total === 8 && built.attendance.absent === 1, `上課日 ${built.attendance.total}／缺席 ${built.attendance.absent}`);

  const yFiltered = await data.schoolGrades({ yearTerm: '2025/2026' });
  check(
    '成績單：示範層 ?yearTerm= 真的過濾',
    yFiltered.items.length === 2 && yFiltered.items.every((r) => r.yearTerm === '2025/2026'),
    `${yFiltered.items.length} 筆`,
  );
  const aFiltered = await data.schoolAttendance({ yearTerm: '2025/2026' });
  check(
    '成績單：出缺席也過濾並重算 summary',
    aFiltered.items.length === 1 && aFiltered.summary.total === 1,
    `${aFiltered.items.length} 筆／summary ${aFiltered.summary.total}`,
  );

  // 家長路徑：未綁定仍 403（示範模式不可以比真 API 寬鬆）
  const denied = await data.parentChildGrades('nobody').then(() => null, (e) => e);
  check('成績單：家長讀未綁定子女被擋', denied && denied.code === 'FORBIDDEN', denied ? denied.code : '沒有拒絕');

  const apiSrcTr = readFileSync(join(here, '..', 'services', 'api.js'), 'utf8');
  const adminSrcTr = readFileSync(join(here, '..', 'services', 'admin.js'), 'utf8');
  check(
    '成績單：真 API 三條路徑都在',
    apiSrcTr.indexOf("'/school/grades'") !== -1 &&
      apiSrcTr.indexOf("'/school/attendance'") !== -1 &&
      adminSrcTr.indexOf("'/admin/school/grades'") !== -1 &&
      adminSrcTr.indexOf("'/admin/school/attendance'") !== -1,
    'self + parent + admin',
  );
  check('成績單：後台出席率月報已接', adminSrcTr.indexOf("'/admin/school/attendance/monthly'") !== -1, 'monthly');
}

// ── W-98 離線快取（成功才寫／失敗才讀／過期就當沒有／示範與快取分得開）──
{
  const cache = require(join(here, '..', 'services', 'cache.js'));

  // 這一段驗的是「真 API 走不通」時的行為，所以關掉示範模式，讓 wx.request（一定失敗）真的被呼叫。
  store.set('pv_force_demo', '');
  store.set('pv_token', 'offline-check-token');
  data.offlineReset();
  cache.clear();

  const wrote = cache.write('listNotices', [{}], 'offline-check-token', { items: [{ id: 'n-cache-1', title: '上次的資料' }], unread: 2 });
  check('離線快取：成功回應寫得進去', wrote && cache.size() === 1, `${cache.size()} 筆`);

  const hit = cache.read('listNotices', [{}], 'offline-check-token');
  check('離線快取：同一個查詢讀得回來', !!hit && hit.value.items[0].id === 'n-cache-1', hit ? `${hit.value.items.length} 筆` : '沒讀到');
  check('離線快取：帶回寫入時間', !!hit && Date.now() - hit.at < 60000, hit ? `${Date.now() - hit.at} ms 前` : '沒有時間');

  // 換人登入（指紋不同）／換查詢參數 → 一定讀不到，不能把甲的成绩給乙
  const otherUser = cache.read('listNotices', [{}], 'someone-else-token');
  check('離線快取：不同使用者不共用', otherUser === null, otherUser ? '讀到別人的' : 'null');
  const otherParams = cache.read('listNotices', [{ scope: 'all' }], 'offline-check-token');
  check('離線快取：參數不同不混用', otherParams === null, otherParams ? '讀到別的查詢' : 'null');

  // 走完整資料層：後端一定連不上 → 應該回上次成功的資料，而且頁面拿得到「上次更新於」
  data.offlineReset();
  const fromCache = await data.listNotices({}).then((r) => r, (e) => e);
  check(
    '離線快取：連不上後端時回上次成功的資料',
    !!(fromCache && fromCache.items && fromCache.items[0] && fromCache.items[0].id === 'n-cache-1'),
    fromCache && fromCache.items ? `${fromCache.items.length} 筆` : String(fromCache && fromCache.code),
  );
  const info = data.offlineInfo();
  check('離線快取：頁面拿得到「上次更新」時間', !!info && info.at > 0, info ? data.offlineText('offline') : 'null');
  check('離線快取：畫面文字一定帶得出時間', /\d{2}:\d{2}/.test(data.offlineText('offline')), data.offlineText('offline'));

  // TTL：24 小時前的資料不採用，而且會把那筆刪掉（不要留著下次又讀）
  cache.clear();
  cache.write('listNotices', [{}], 'offline-check-token', { items: [{ id: 'too-old' }] }, Date.now() - 25 * 3600 * 1000);
  data.offlineReset();
  const expired = await data.listNotices({}).then((r) => r, (e) => e);
  check('離線快取：超過 24 小時不採用', !!(expired && expired.code === 'NETWORK'), expired && expired.items ? '還是回舊資料' : String(expired && expired.code));
  check('離線快取：過期的那筆會刪掉', cache.size() === 0, `${cache.size()} 筆`);

  // 完全沒有快取 → 照原樣失敗（不是空白、也不是示範資料）
  data.offlineReset();
  const none = await data.listNotices({}).then((r) => r, (e) => e);
  check('離線快取：沒有快取時維持失敗態', !!(none && none.code === 'NETWORK'), String(none && none.code));
  check('離線快取：失敗時不出現離線標籤', data.offlineText('offline') === '', JSON.stringify(data.offlineText('offline')));

  // 白名單只收讀取：寫入類一旦被快取，就等於回使用者一個假的「已送出」
  const dataSrc = readFileSync(join(here, '..', 'services', 'data.js'), 'utf8');
  const block = (dataSrc.match(/const CACHEABLE = \{[\s\S]*?\};/) || [''])[0];
  check(
    '離線快取：白名單只有讀取，沒有寫入類',
    !!block && block.indexOf('listNotices') !== -1 && !/(create|claim|signup|cancel|mark|update|remove|delete|rate)[A-Z(]/.test(block),
    block ? 'listNotices 在、寫入類不在' : '找不到 CACHEABLE',
  );

  // 四個頁面都要真的有橫幅（漏一頁＝那一頁看起來像即時資料）
  const bannerPages = ['notices/list', 'timetable', 'homework', 'school'];
  const missing = bannerPages.filter((p) => readFileSync(join(here, '..', 'pages', p, 'index.wxml'), 'utf8').indexOf('ui-offline') === -1);
  check('離線快取：四個頁面都有離線橫幅', missing.length === 0, missing.length ? '缺 ' + missing.join('、') : bannerPages.join('／'));

  // 示範模式與快取要分得開：開著示範時走 mock、不寫也不讀快取
  store.set('pv_force_demo', '1');
  data.offlineReset();
  const demoList = await data.listNotices({});
  check(
    '離線快取：示範模式不碰快取（兩者不會混）',
    demoList.items.length > 0 && data.offlineInfo() === null,
    `${demoList.items.length} 筆（示範）、標籤 ${data.offlineText('offline') === '' ? '無' : '有'}`,
  );

  // ── W-102 匯出自己的資料（示範模式＝斷網演示時也要拿得到內容）──
  const linesOf = (text) => String(text || '').replace(/^\uFEFF/, '').split('\r\n').filter((line) => line !== '');
  const exportOf = (type) => data.myExport(type).then((t) => t, (e) => e);

  const gradesCsv = await exportOf('grades');
  const gradeLines = linesOf(gradesCsv);
  check(
    '我的資料：成績 CSV 帶 BOM 與八個欄位',
    typeof gradesCsv === 'string' && gradesCsv.charCodeAt(0) === 0xfeff && gradeLines[0] === '"學年","學段","科目","測驗","日期","分數","備註","來源"',
    typeof gradesCsv === 'string' ? `${gradeLines.length - 1} 列` : String(gradesCsv && gradesCsv.code),
  );
  // 缺考是「沒有分數」：寫 0 會被 Excel 算進平均，成績單就錯了
  const absentLine = gradeLines.slice(1).filter((line) => line.split('","')[5] === '')[0] || '';
  check('我的資料：缺考的分數是空欄不是 0', absentLine !== '', absentLine || '找不到分數空的那列');

  const others = {};
  for (const type of ['attendance', 'library', 'leaves']) {
    const text = await exportOf(type);
    const rows = linesOf(text);
    const width = rows[0] ? rows[0].split('","').length : 0;
    const uniform = rows.every((line) => line.split('","').length === width);
    others[type] = { rows: rows.length - 1, uniform, ok: typeof text === 'string' && text.charCodeAt(0) === 0xfeff };
  }
  check(
    '我的資料：出缺席／借閱／請假都有資料且欄數整齊',
    Object.keys(others).every((k) => others[k].ok && others[k].rows > 0 && others[k].uniform),
    Object.keys(others).map((k) => `${k} ${others[k].rows} 列`).join('／'),
  );
  check(
    '我的資料：借閱的逾期天數是數字',
    /,"\d+","\d+"$/.test(linesOf(await exportOf('library'))[1] || ''),
    (linesOf(await exportOf('library'))[1] || '').slice(-14),
  );
  const unknown = await exportOf('users');
  check('我的資料：不認識的類型要報錯（不是回空檔）', !!(unknown && unknown.code), String(unknown && (unknown.code || unknown.slice(0, 20))));

  // 真 API 那一支要真的打 /me/export，而且用 text 模式（否則 CSV 會被當 JSON 解析）
  const apiSrc = readFileSync(join(here, '..', 'services', 'api.js'), 'utf8');
  check(
    '我的資料：api.js 打 /me/export 且要求純文字',
    apiSrc.indexOf("http.get('/me/export'") !== -1 && apiSrc.indexOf('text: true') !== -1,
    apiSrc.indexOf('/me/export') !== -1 ? '有 /me/export' : '找不到端點',
  );
  // 匯出是「當下要帶走的檔案」，進快取只會讓人拿到舊資料
  check('我的資料：匯出不做離線快取', !!block && block.indexOf('myExport') === -1, block ? 'CACHEABLE 沒有 myExport' : '找不到 CACHEABLE');

  // ── W-109 訂閱校曆（示範模式模擬「權杖的存在與撤銷」）──
  // 重點是「重新整理還在、按撤銷就消失」，而且示範模式不會假裝生出一份日曆。
  wx.removeStorageSync('pv_demo_calendar_token');
  const cal0 = await data.calendarToken();
  check('訂閱校曆：未產生時 enabled=false 且沒有網址', cal0 && cal0.enabled === false && !cal0.path, JSON.stringify(cal0));

  const cal1 = await data.rotateCalendarToken();
  const calPath = String((cal1 && cal1.path) || '');
  check(
    '訂閱校曆：產生後 enabled=true 且路徑帶權杖',
    cal1 && cal1.enabled === true && calPath.indexOf('/calendar/me.ics?token=') === 0 && cal1.token && calPath.indexOf(cal1.token) > 0,
    calPath,
  );
  const cal2 = await data.calendarToken();
  check('訂閱校曆：重新整理後權杖還在（不是每次重產生）', cal2 && cal2.enabled === true && cal2.token === cal1.token, String(cal2 && cal2.token));

  const cal3 = await data.rotateCalendarToken();
  check('訂閱校曆：重新產生會換一支新權杖（舊網址失效）', cal3 && cal3.token && cal3.token !== cal1.token, `${cal1.token} → ${cal3.token}`);

  const cal4 = await data.revokeCalendarToken();
  const cal5 = await data.calendarToken();
  check(
    '訂閱校曆：撤銷後兩個入口都回未開啟',
    cal4 && cal4.enabled === false && cal5 && cal5.enabled === false && !cal5.path,
    `${JSON.stringify(cal4)} / ${JSON.stringify(cal5)}`,
  );
  check('訂閱校曆：狀態不做離線快取（權杖屬個人狀態）', !!block && block.indexOf('calendarToken') === -1, block ? 'CACHEABLE 沒有 calendarToken' : '找不到 CACHEABLE');

  // ── W-110 訂閱再加深：天數可調（網址帶 days，權杖不變）──
  const calD30 = await data.rotateCalendarToken(30);
  check(
    '訂閱校曆：選 30 天會寫進網址（換範圍不必重產生權杖）',
    calD30 && calD30.days === 30 && String(calD30.path || '').indexOf('&days=30') > 0,
    String(calD30 && calD30.path),
  );
  const calD90 = await data.calendarToken(90);
  check(
    '訂閱校曆：預設 90 天不帶 days 參數（權杖不變、網址維持短）',
    calD90 && calD90.enabled === true && calD90.token === calD30.token && String(calD90.path || '').indexOf('days=') === -1,
    String(calD90 && calD90.path),
  );
}

// ── 輸出 ──
const pad = (s, n) => s + ' '.repeat(Math.max(0, n - s.length));
for (const r of results) {
  console.log(`${r.ok ? '✅' : '❌'} ${pad(r.name, 26)} ${r.value}`);
}
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed === results.length ? 'ALL PASS' : 'FAIL'} ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
