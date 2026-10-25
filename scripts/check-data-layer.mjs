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

// ── 輸出 ──
const pad = (s, n) => s + ' '.repeat(Math.max(0, n - s.length));
for (const r of results) {
  console.log(`${r.ok ? '✅' : '❌'} ${pad(r.name, 26)} ${r.value}`);
}
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed === results.length ? 'ALL PASS' : 'FAIL'} ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
