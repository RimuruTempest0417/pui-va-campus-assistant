#!/usr/bin/env node
// 資料層自我檢查（Node 版，不需要微信開發者工具、不需要後端）
// 用 wx storage 的記憶體替身載入 services/data.js，跑與頁面相同的 9 項檢查。
// CI 也會跑這支：node scripts/check-data-layer.mjs

import { createRequire } from 'node:module';
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

await data.claimItem(created.id);
let claimErr = '';
try {
  await data.claimItem(created.id);
} catch (e) {
  claimErr = e.code;
}
check('重複認領被擋', claimErr === 'ALREADY_CLAIMED', claimErr || '沒有擋下');

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

// ── 輸出 ──
const pad = (s, n) => s + ' '.repeat(Math.max(0, n - s.length));
for (const r of results) {
  console.log(`${r.ok ? '✅' : '❌'} ${pad(r.name, 26)} ${r.value}`);
}
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed === results.length ? 'ALL PASS' : 'FAIL'} ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
