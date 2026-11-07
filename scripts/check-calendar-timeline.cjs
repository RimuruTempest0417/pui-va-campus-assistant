#!/usr/bin/env node
/**
 * 校曆整合時間軸（W-100）的邏輯守門（不需要開發者工具）。
 *
 * 為什麼要有：時間軸只是把四種來源排在一起，排錯畫面不會報錯 ——
 * 同一天的考試被畫成兩列、公告裡的考試日期落在發布日、假期的順序亂掉、
 * 視窗外的事件偷偷出現、倒數用「今天」而不是使用者看到的起始日，
 * 這些都只有懂規則的人看得出。所以用固定輸入斷言輸出。
 *
 * 用法：node scripts/check-calendar-timeline.cjs
 */
const path = require('path');

const tl = require(path.join(__dirname, '..', 'utils', 'calendarTimeline.js'));

let pass = 0;
const fails = [];

function check(name, ok, detail) {
  if (ok) pass += 1;
  else fails.push(name + (detail ? '：' + detail : ''));
}

function eq(name, got, want) {
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  check(name, a === b, '得到 ' + a + '，應為 ' + b);
}

const BASE = new Date(2026, 10, 7); // 2026-11-07（週六）

const notice = (id, title, kind, publishedAt) => ({ id: id, title: title, kind: kind, publishedAt: publishedAt });
const event = (id, title, startAt, location) => ({ id: id, title: title, startAt: startAt, location: location || '' });
const ics = (id, title, date, extra) => Object.assign({ id: id, title: title, date: date }, extra || {});
const exam = (id, title, date, source) => ({ id: id, title: title, date: date, source: source || 'event', time: '' });

// ── ① 空資料：不炸、回空清單 ──
{
  const r = tl.buildTimeline({}, { from: BASE, days: 30 });
  eq('沒有來源 → 0 天 0 筆', [r.dayCount, r.total], [0, 0]);
  eq('沒有來源 → list 是陣列', Array.isArray(r.list), true);
  eq('視窗 from/to', [r.from, r.to], ['2026-11-07', '2026-12-06']);
  eq('視窗天數原樣回傳', r.days, 30);
  const r2 = tl.buildTimeline(null, { from: BASE });
  eq('sources 傳 null 也不炸', [r2.dayCount, r2.total, r2.days], [0, 0, 60]);
}

// ── ② 基本分組：同一天的三種來源收成一天 ──
{
  const r = tl.buildTimeline(
    {
      notices: [notice('n1', '校慶安排', 'NORMAL', new Date(2026, 10, 10, 9, 0))],
      events: [event('e1', '校慶典禮', new Date(2026, 10, 10, 10, 30), '禮堂')],
      external: [ics('x1', '校慶假期', '2026-11-10')],
    },
    { from: BASE, days: 30 }
  );
  eq('同一天收成一組', r.dayCount, 1);
  eq('三筆都在', r.list[0].count, 3);
  eq('總數等於各天加總', r.total, 3);
  eq('日期 key', r.list[0].key, '2026-11-10');
  eq('月／日拆好給頁面', [r.list[0].month, r.list[0].day], [11, 10]);
  eq('weekday 週二 = 2', r.list[0].weekday, 2);
  eq('daysLeft 由 from 起算', r.list[0].daysLeft, 3);
  check('每一列都有唯一 id', new Set(r.list[0].items.map((i) => i.id)).size === 3);
  check('每一列都有 nav 欄位（外部校曆是空字串）', r.list[0].items.every((i) => typeof i.nav === 'string'));
  const ext = r.list[0].items.filter((i) => i.type === 'school')[0];
  eq('外部校曆 → type school', [ext.kind, ext.nav], ['SCHOOL', '']);
}

// ── ③ 同一天排序：活動（有時間）→ 校曆 → 一般公告 ──
{
  const r = tl.buildTimeline(
    {
      notices: [notice('n1', '一般通知', 'NORMAL', new Date(2026, 10, 12))],
      events: [
        event('e2', '下午活動', new Date(2026, 10, 12, 15, 0)),
        event('e1', '上午活動', new Date(2026, 10, 12, 9, 0)),
      ],
      external: [ics('x1', '校曆場次', '2026-11-12')],
    },
    { from: BASE, days: 30 }
  );
  eq(
    '活動按時間由早到晚，校曆在活動後、一般公告最後',
    r.list[0].items.map((i) => i.title),
    ['上午活動', '下午活動', '校曆場次', '一般通知']
  );
}

// ── ④ 緊急公告／假期／測驗的優先序 ──
{
  const r = tl.buildTimeline(
    {
      notices: [
        notice('n3', '一般公告', 'NORMAL', new Date(2026, 10, 13)),
        notice('n2', '重陽節假期', 'CALENDAR', new Date(2026, 10, 13)),
        notice('n1', '停課緊急通知', 'URGENT', new Date(2026, 10, 13)),
      ],
      events: [event('e1', '講座', new Date(2026, 10, 13, 11, 0))],
    },
    { from: BASE, days: 30 }
  );
  eq(
    '緊急 → 活動 → 假期 → 一般',
    r.list[0].items.map((i) => i.kind),
    ['URGENT', 'EVENT', 'CALENDAR', 'NORMAL']
  );
  eq('有緊急公告的那天 tone 是 urgent', r.list[0].tone, 'urgent');
}

// ── ⑤ 測驗併入既有活動：同一天同標題只出一列 ──
{
  const r = tl.buildTimeline(
    { events: [event('e9', '數學測驗', new Date(2026, 10, 20, 8, 30))] },
    { from: BASE, days: 40, exams: [exam('e9', '數學測驗', '2026-11-20', 'event')] }
  );
  eq('活動＋測驗只出一列', r.total, 1);
  eq('原列被標成測驗', r.list[0].items[0].exam, true);
  eq('原列型別不變（才有詳情可跳）', [r.list[0].items[0].type, r.list[0].items[0].nav], ['event', 'event']);
  eq('那天 tone 是 exam', r.list[0].tone, 'exam');
}

// ── ⑥ 測驗併入外部校曆：同樣只標記不新增 ──
{
  const r = tl.buildTimeline(
    { external: [ics('s7', '統測', '2026-11-24')] },
    { from: BASE, days: 40, exams: [exam('s7', '統測', '2026-11-24', 'school')] }
  );
  eq('校曆場次＋測驗只出一列', r.total, 1);
  eq('標成測驗但仍是校曆型別', [r.list[0].items[0].exam, r.list[0].items[0].type], [true, 'school']);
}

// ── ⑥b 被標成測驗的列要排在同一天的活動之前（實測 11/11：21:38 的籃球賽曾排在 09:00 的化學測驗前面） ──
{
  const r = tl.buildTimeline(
    {
      events: [event('e1', '班際籃球賽', new Date(2026, 10, 11, 21, 38))],
      external: [ics('s1', '化學測驗（第二次）', '2026-11-11', { startTime: '09:00' })],
    },
    { from: BASE, days: 30, exams: [exam('s1', '化學測驗（第二次）', '2026-11-11', 'school')] }
  );
  eq('同日的校曆測驗排在活動前面', r.list[0].items.map((i) => i.title), ['化學測驗（第二次）', '班際籃球賽']);
  eq('兩列都還在（不同事情，不合併）', r.list[0].count, 2);

  const r2 = tl.buildTimeline(
    {
      events: [
        event('e2', '校慶表演', new Date(2026, 10, 12, 14, 0)),
        event('e1', '物理測驗', new Date(2026, 10, 12, 16, 0)),
      ],
    },
    { from: BASE, days: 30, exams: [exam('e1', '物理測驗', '2026-11-12', 'event')] }
  );
  eq('活動＋測驗排在其他活動前面（即使時間較晚）', r2.list[0].items.map((i) => i.title), ['物理測驗', '校慶表演']);
}

// ── ⑦ 公告文字抓出來的考試：落在考試那天，導回公告 ──
{
  const r = tl.buildTimeline(
    { notices: [notice('n5', '十一月考試安排', 'NORMAL', new Date(2026, 10, 8))] },
    { from: BASE, days: 40, exams: [exam('n5', '十一月考試安排', '2026-11-27', 'notice')] }
  );
  eq('發布日一列＋考試日一列', r.total, 2);
  eq('日期由近到遠', r.list.map((d) => d.key), ['2026-11-08', '2026-11-27']);
  const examDay = r.list[1].items[0];
  eq('考試那列 type=exam 且可跳回公告', [examDay.type, examDay.nav, examDay.kind], ['exam', 'notice', 'EXAM']);
  eq('公告那列沒有被標成測驗', r.list[0].items[0].exam, false);
}

// ── ⑧ 視窗邊界：起始日之前、最後一天之後都不出現 ──
{
  const r = tl.buildTimeline(
    {
      events: [
        event('e0', '昨天', new Date(2026, 10, 6, 9, 0)),
        event('e1', '第一天', new Date(2026, 10, 7, 9, 0)),
        event('e2', '最後一天', new Date(2026, 11, 6, 9, 0)),
        event('e3', '多一天', new Date(2026, 11, 7, 9, 0)),
      ],
    },
    { from: BASE, days: 30 }
  );
  eq('只留視窗內兩筆', r.list.map((d) => d.key), ['2026-11-07', '2026-12-06']);
  eq('起始日 daysLeft=0', r.list[0].daysLeft, 0);
  eq('最後一天 daysLeft=29（30 天含頭不含尾）', r.list[1].daysLeft, 29);
}

// ── ⑨ 倒數一律重算：外面傳進來的 daysLeft 不採用 ──
{
  const stale = exam('e1', '物理測驗', '2026-11-09', 'event');
  stale.daysLeft = 999;
  const r = tl.buildTimeline(
    { events: [event('e1', '物理測驗', new Date(2026, 10, 9, 8, 0))] },
    { from: BASE, days: 30, exams: [stale] }
  );
  eq('daysLeft 由 from 重算，不沿用外部值', r.list[0].daysLeft, 2);
  eq('列上的 daysLeft 也重算', r.list[0].items[0].daysLeft, 2);
}

// ── ⑩ 壞資料：無日期／壞日期直接跳過，不產生 undefined 欄位 ──
{
  const r = tl.buildTimeline(
    {
      notices: [notice('n1', '沒有日期'), notice('n2', '壞日期', 'NORMAL', 'not-a-date'), null],
      events: [event('e1', '沒有 startAt'), event('e2', '壞 startAt', 'oops')],
      external: [ics('x1', '沒有日期'), null],
    },
    { from: BASE, days: 30 }
  );
  eq('全部壞資料 → 空', [r.total, r.dayCount], [0, 0]);
  const r2 = tl.buildTimeline({ events: [event('e1', '好活動', new Date(2026, 10, 8, 9, 0))] }, { from: BASE, days: 5 });
  check('好資料照常出現且欄位都定義了', r2.list[0].items.every((i) => i.title && i.date && typeof i.daysLeft === 'number'));
}

// ── ⑪ 同標題不同天：兩天各自一列 ──
{
  const r = tl.buildTimeline(
    {
      events: [
        event('e1', '週會', new Date(2026, 10, 9, 8, 0)),
        event('e2', '週會', new Date(2026, 10, 16, 8, 0)),
      ],
    },
    { from: BASE, days: 30 }
  );
  eq('同標題不同天都保留', r.dayCount, 2);
  check('id 不重複（含日期）', r.list[0].items[0].id !== r.list[1].items[0].id);
}

// ── ⑫ 同一天重複的測驗輸入不會長出第二列 ──
{
  const r = tl.buildTimeline(
    { events: [event('e1', '英文測驗', new Date(2026, 10, 18, 9, 0))] },
    { from: BASE, days: 30, exams: [exam('e1', '英文測驗', '2026-11-18'), exam('e1', '英文測驗', '2026-11-18')] }
  );
  eq('重複輸入仍只有一列', r.total, 1);
}

// ── ⑬ 沒有時間的活動排在後面；00:00 視為沒寫時間 ──
{
  eq('timeText 00:00 → 空字串', tl.timeText(new Date(2026, 10, 7, 0, 0)), '');
  eq('timeText 08:05 → 08:05', tl.timeText(new Date(2026, 10, 7, 8, 5)), '08:05');
  const r = tl.buildTimeline(
    {
      events: [
        event('e1', '不確定時間', new Date(2026, 10, 14, 0, 0)),
        event('e2', '下午三點', new Date(2026, 10, 14, 15, 0)),
      ],
    },
    { from: BASE, days: 30 }
  );
  eq('有時間的排前面', r.list[0].items.map((i) => i.title), ['下午三點', '不確定時間']);
  eq('沒有時間的那列 time 是空字串', r.list[0].items[1].time, '');
}

// ── ⑭ 日期工具 ──
{
  eq('weekdayOf 2026-11-07 = 6（週六）', tl.weekdayOf(new Date(2026, 10, 7)), 6);
  eq('weekdayOf 2026-11-08 = 7（週日）', tl.weekdayOf(new Date(2026, 10, 8)), 7);
  eq('weekdayOf 2026-11-09 = 1（週一）', tl.weekdayOf(new Date(2026, 10, 9)), 1);
  eq('壞日期 weekdayOf = 0', tl.weekdayOf('nope'), 0);
  eq('addDays 跨月', tl.dateKey(tl.addDays(new Date(2026, 10, 30), 2)), '2026-12-02');
  eq('diffDays 由 from 到第一天 = 0', tl.diffDays(tl.dayStart(BASE), tl.dayStart(BASE)), 0);
}

// ── ⑮ dayTone 的優先序 ──
{
  eq('有緊急 → urgent', tl.dayTone([{ kind: 'NORMAL' }, { kind: 'URGENT' }]), 'urgent');
  eq('有測驗 → exam', tl.dayTone([{ kind: 'EVENT' }, { exam: true }]), 'exam');
  eq('有活動 → event', tl.dayTone([{ kind: 'EVENT' }]), 'event');
  eq('都沒有 → plain', tl.dayTone([{ kind: 'CALENDAR' }]), 'plain');
  eq('空 → plain', tl.dayTone([]), 'plain');
}

// ── ⑯ 排序穩定：整天順序、日內順序都可重現 ──
{
  const build = () =>
    tl.buildTimeline(
      {
        notices: [
          notice('n2', 'B 通知', 'NORMAL', new Date(2026, 10, 15)),
          notice('n1', 'A 通知', 'NORMAL', new Date(2026, 10, 15)),
        ],
        events: [
          event('e2', 'Z 活動', new Date(2026, 10, 15, 9, 0)),
          event('e1', 'A 活動', new Date(2026, 10, 15, 9, 0)),
        ],
      },
      { from: BASE, days: 30 }
    );
  const a = build();
  const b = build();
  eq('同輸入兩次結果一致', a.list[0].items.map((i) => i.title), b.list[0].items.map((i) => i.title));
  eq('同時間同類型按標題排', a.list[0].items.map((i) => i.title), ['A 活動', 'Z 活動', 'A 通知', 'B 通知']);
}

// ── ⑰ 天數統計與頁面要用的欄位齊全 ──
{
  const r = tl.buildTimeline(
    {
      notices: [notice('n1', '公告', 'NORMAL', new Date(2026, 10, 8))],
      events: [event('e1', '活動', new Date(2026, 10, 9, 10, 0))],
      external: [ics('x1', '校曆', '2026-11-09')],
    },
    { from: BASE, days: 10 }
  );
  eq('兩天三筆', [r.dayCount, r.total], [2, 3]);
  eq('total 等於各天 count 之和', r.total, r.list.reduce((s, d) => s + d.count, 0));
  check(
    '每一天都有頁面需要的欄位',
    r.list.every(
      (d) =>
        typeof d.key === 'string' &&
        typeof d.month === 'number' &&
        typeof d.day === 'number' &&
        typeof d.weekday === 'number' &&
        typeof d.count === 'number' &&
        typeof d.tone === 'string' &&
        Array.isArray(d.items)
    )
  );
  check(
    '每一列都有頁面需要的欄位',
    r.list.every((d) =>
      d.items.every(
        (i) =>
          typeof i.id === 'string' &&
          typeof i.title === 'string' &&
          typeof i.kind === 'string' &&
          typeof i.type === 'string' &&
          typeof i.time === 'string' &&
          typeof i.exam === 'boolean'
      )
    )
  );
}

// ── ⑱ 標籤規則：哪一種列掛哪個徽章（頁面只負責把 i18n 文字傳進來） ──
{
  const L = { notice: '公告', urgent: '緊急', exam: '測驗', event: '活動', school: '校曆表', calendar: '校曆' };
  const tag = (row) => tl.decorate(row, L).tagText + '/' + tl.decorate(row, L).tagType;

  eq('緊急公告 → 緊急/danger', tag({ kind: 'URGENT', type: 'notice' }), '緊急/danger');
  eq('緊急＋測驗 → 以緊急為先', tag({ kind: 'URGENT', type: 'notice', exam: true }), '緊急/danger');
  eq('活動＋測驗 → 測驗/warning', tag({ kind: 'EVENT', type: 'event', exam: true }), '測驗/warning');
  eq('純活動 → 活動/tint', tag({ kind: 'EVENT', type: 'event' }), '活動/tint');
  eq('校曆場次＋測驗 → 測驗（校曆場次沒有站內頁，先講是考試）', tag({ kind: 'SCHOOL', type: 'school', exam: true }), '測驗/warning');
  eq('純校曆場次 → 校曆表/neutral', tag({ kind: 'SCHOOL', type: 'school' }), '校曆表/neutral');
  eq('假期公告 → 校曆/neutral', tag({ kind: 'CALENDAR', type: 'notice' }), '校曆/neutral');
  eq('一般公告 → 公告/neutral', tag({ kind: 'NORMAL', type: 'notice' }), '公告/neutral');
  eq('未知 kind 不當成緊急', tag({ kind: 'WHATEVER', type: 'notice' }), '公告/neutral');

  const row = tl.decorate({ id: 'e1', title: '家長會', type: 'event', time: '19:00', location: '禮堂' }, L, true);
  eq('附註由時間與地點組成', row.meta, '19:00 · 禮堂');
  eq('last 旗標照傳', row.last, true);
  eq('event 預設導去活動詳情', row.nav, 'event');
  eq('refId 沒給就用 id', row.refId, 'e1');
  const noLoc = tl.decorate({ id: 'n1', title: '通知', type: 'notice' }, L);
  eq('沒有時間也沒有地點 → 附註是空字串', noLoc.meta, '');
  eq('notice 預設導去公告詳情', noLoc.nav, 'notice');
  eq('school 沒有站內詳情（nav 空字串）', tl.decorate({ id: 's1', title: '校慶', type: 'school' }, L).nav, '');
  eq('外部傳進來的 nav 優先', tl.decorate({ id: 'x1', title: '考試', type: 'exam', nav: '' }, L).nav, '');
  eq('decorate 不會因空物件爆掉', tl.decorate(null, L).title, '');
}

console.log('');
if (fails.length) {
  console.log('❌ 校曆時間軸：' + pass + ' 過 / ' + fails.length + ' 敗');
  fails.forEach((f) => console.log('   ✗ ' + f));
  process.exit(1);
}
console.log('✅ 校曆時間軸檢查通過：' + pass + ' 項');
