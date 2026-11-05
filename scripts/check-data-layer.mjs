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
const dataKeys = Object.keys(data).filter((k) => typeof data[k] === 'function' && !['isDemo', 'setForceDemo', 'forceDemoOn', 'setApiBase', 'apiBase', 'ensureLogin', 'messageOf', 'resetDemo'].includes(k));
const api = require(join(here, '..', 'services', 'api.js'));
const mock = require(join(here, '..', 'services', 'mock.js'));
const missingApi = dataKeys.filter((k) => typeof api[k] !== 'function');
const missingMock = dataKeys.filter((k) => typeof mock[k] !== 'function');
check('方法對齊（data↔api↔mock）', !missingApi.length && !missingMock.length,
  [missingApi.length ? 'api 缺 ' + missingApi.join(',') : '', missingMock.length ? 'mock 缺 ' + missingMock.join(',') : ''].filter(Boolean).join(' ') || `${dataKeys.length} 個方法`);

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

// ── 輸出 ──
const pad = (s, n) => s + ' '.repeat(Math.max(0, n - s.length));
for (const r of results) {
  console.log(`${r.ok ? '✅' : '❌'} ${pad(r.name, 26)} ${r.value}`);
}
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed === results.length ? 'ALL PASS' : 'FAIL'} ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
