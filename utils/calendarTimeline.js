/**
 * 校曆整合時間軸（W-100）的純函式。
 *
 * 把四種來源攤成同一條「由近到遠」的時間軸：
 *   ① 公告（`GET /notices`，`kind: URGENT` 緊急、`CALENDAR` 假期、其餘一般）
 *   ② 活動（`GET /events`，`startAt` 就是場次時間）
 *   ③ 外部校曆（`GET /calendar/external`，學校發布的 ICS，已由後端展開重複規則）
 *   ④ 測驗倒數（`utils/study.upcomingExams` 的結果，呼叫端算好再傳進來）
 *
 * 這裡刻意不 require wx／services／i18n：同一份規則可以被
 * `scripts/check-calendar-timeline.cjs` 在 Node 裡直接測，不必開開發者工具。
 * 顯示文字（今天／明天／週幾／N 天後）留给頁面用 i18n.pick 組，模組只回數字與 key。
 *
 * 兩個容易錯的規則，寫在這裡而不是頁面裡：
 *   - **同一筆資料既是活動又是測驗 → 只出一列**。賽程／考試本來就會被老師建成活動，
 *     若照 `upcomingExams` 的結果再加一列，同一天會出現兩張一樣的卡。
 *   - **公告裡的考試日期不是發布日**。`upcomingExams` 已經從公告文字抓出日期，
 *     這種測驗要落在「考試那天」，不是「公告發布那天」。
 */

// 同一天內的排序：緊急 → 測驗 → 活動 → 校曆 → 假期 → 一般。
// 月視圖圓點用的是另一組優先序（urgent → event → school → notice），兩者互不影響。
const ORDER = { URGENT: 0, EXAM: 1, EVENT: 2, SCHOOL: 3, CALENDAR: 4, NORMAL: 5 };

function pad(n) {
  return n < 10 ? '0' + n : String(n);
}

function dayStart(value) {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dateKey(value) {
  const d = dayStart(value);
  if (!d) return '';
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function addDays(day, n) {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() + n);
}

function diffDays(from, to) {
  const MS = 24 * 60 * 60 * 1000;
  return Math.round((to.getTime() - from.getTime()) / MS);
}

/** 週一 = 1 … 週日 = 7（跟月視圖的欄位一致） */
function weekdayOf(value) {
  const d = dayStart(value);
  if (!d) return 0;
  const w = d.getDay();
  return w === 0 ? 7 : w;
}

/** 只取 HH:MM；00:00 視為「沒寫時間」（老師建活動常常不設時刻） */
function timeText(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '';
  if (d.getHours() === 0 && d.getMinutes() === 0) return '';
  return pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function timeRank(t) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || ''));
  if (!m) return 1e9; // 沒有時間的排在有時間的後面
  return Number(m[1]) * 60 + Number(m[2]);
}

function kindOfNotice(n) {
  const k = String((n && n.kind) || 'NORMAL').toUpperCase();
  return ORDER[k] === undefined ? 'NORMAL' : k;
}

function rowKey(prefix, refId, date, title) {
  return prefix + '-' + (refId || '') + '-' + date + '-' + String(title || '');
}

/** ①②③：三種來源各自攤成一樣形狀的列 */
function baseRows(sources) {
  const src = sources || {};
  const rows = [];

  (src.notices || []).forEach((n) => {
    if (!n) return;
    const key = dateKey(n.publishedAt || n.createdAt);
    if (!key) return;
    const kind = kindOfNotice(n);
    const title = String(n.title || '');
    rows.push({
      id: rowKey('n', n.id, key, title),
      refId: String(n.id === null || n.id === undefined ? '' : n.id),
      type: 'notice',
      kind: kind,
      nav: 'notice',
      title: title,
      date: key,
      time: '',
      location: '',
      exam: false,
    });
  });

  (src.events || []).forEach((e) => {
    if (!e) return;
    const key = dateKey(e.startAt);
    if (!key) return;
    const title = String(e.title || '');
    rows.push({
      id: rowKey('e', e.id, key, title),
      refId: String(e.id === null || e.id === undefined ? '' : e.id),
      type: 'event',
      kind: 'EVENT',
      nav: 'event',
      title: title,
      date: key,
      time: timeText(e.startAt),
      location: String(e.location || ''),
      exam: false,
    });
  });

  (src.external || []).forEach((x) => {
    if (!x) return;
    const key = dateKey(x.date);
    if (!key) return;
    const title = String(x.title || '');
    rows.push({
      id: rowKey('s', x.id, key, title),
      refId: String(x.id === null || x.id === undefined ? '' : x.id),
      type: 'school',
      kind: 'SCHOOL',
      nav: '', // 外部校曆沒有站內詳情頁
      title: title,
      date: key,
      time: String(x.startTime || ''),
      location: String(x.location || ''),
      exam: false,
      source: String(x.source || ''),
    });
  });

  return rows;
}

/**
 * ④：把測驗併進來。
 * 已經有「同一天同標題」的活動／校曆列 → 只標記 exam=true，不新增一列；
 * 公告抓出來的考試日期 → 新增一列（type 'exam'，導回那則公告）。
 */
function mergeExams(rows, exams) {
  const out = (rows || []).slice();
  const byKey = {};
  out.forEach((r) => {
    byKey[r.date + '|' + r.title] = r;
  });

  (exams || []).forEach((x) => {
    if (!x) return;
    const key = dateKey(x.date);
    if (!key) return;
    const title = String(x.title || '');
    const hit = byKey[key + '|' + title];
    if (hit) {
      hit.exam = true;
      hit.examSource = String(x.source || '');
      return;
    }
    const row = {
      id: rowKey('x', x.id, key, title),
      refId: String(x.id === null || x.id === undefined ? '' : x.id),
      type: 'exam',
      kind: 'EXAM',
      nav: String(x.source || '') === 'notice' ? 'notice' : '',
      title: title,
      date: key,
      time: String(x.time || ''),
      location: String(x.location || ''),
      exam: true,
      examSource: String(x.source || ''),
    };
    byKey[key + '|' + title] = row;
    out.push(row);
  });

  return out;
}

/** 一列在同一天裡的排序權重：被標成測驗的列一律當「測驗」排（即使它原本是活動或校曆場次） */
function rankOf(row) {
  const base = ORDER[row.kind] === undefined ? 9 : ORDER[row.kind];
  if (row && row.exam && base > ORDER.EXAM) return ORDER.EXAM;
  return base;
}

function sortRows(rows) {
  return rows.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const oa = rankOf(a);
    const ob = rankOf(b);
    if (oa !== ob) return oa - ob;
    const ta = timeRank(a.time);
    const tb = timeRank(b.time);
    if (ta !== tb) return ta - tb;
    return a.title < b.title ? -1 : a.title > b.title ? 1 : 0;
  });
}

/** 一個日期格子的色調：緊急 > 測驗 > 活動 > 其他 */
function dayTone(items) {
  if ((items || []).some((i) => i.kind === 'URGENT')) return 'urgent';
  if ((items || []).some((i) => i.exam)) return 'exam';
  if ((items || []).some((i) => i.type === 'event' || i.kind === 'EVENT')) return 'event';
  return 'plain';
}

/**
 * 一列要顯示的標籤與附註。放這裡而不是頁面，是因為「哪一種列該掛哪個徽章」是規則：
 *   緊急公告 > 測驗 > 活動 > 校曆場次 > 假期 > 一般公告
 * 標籤文字由呼叫端傳（頁面用 i18n），模組只決定「用哪一個」。
 * labels = { notice, urgent, exam, event, school, calendar }
 */
function decorate(raw, labels, last) {
  const L = labels || {};
  const row = raw || {};
  let text = L.notice || '';
  let type = 'neutral';
  if (row.kind === 'URGENT') {
    text = L.urgent || '';
    type = 'danger';
  } else if (row.exam) {
    text = L.exam || '';
    type = 'warning';
  } else if (row.type === 'event') {
    text = L.event || '';
    type = 'tint';
  } else if (row.type === 'school') {
    text = L.school || '';
    type = 'neutral';
  } else if (row.kind === 'CALENDAR') {
    text = L.calendar || '';
    type = 'neutral';
  }
  const meta = [row.time || '', row.location || ''].filter((x) => !!x).join(' · ');
  const nav = row.nav === undefined || row.nav === null
    ? (row.type === 'event' ? 'event' : row.type === 'school' ? '' : 'notice')
    : row.nav;
  return {
    id: row.id || '',
    refId: row.refId || row.id || '',
    type: row.type || 'notice',
    nav: nav,
    title: row.title || '',
    time: row.time || '',
    exam: !!row.exam,
    tagText: text,
    tagType: type,
    meta: meta,
    last: !!last,
  };
}

/**
 * 主入口。
 * sources = { notices, events, external }；opts = { from, days, exams }
 * 回傳 { from, to, days, total, dayCount, list: [{ key, daysLeft, weekday, month, day, count, tone, items }] }
 * 只回「有東西的那幾天」（時間軸是議程，不是月曆，空白天不佔版面）。
 */
function buildTimeline(sources, opts) {
  const o = opts || {};
  const base = dayStart(o.from || new Date());
  const span = typeof o.days === 'number' && o.days > 0 ? Math.floor(o.days) : 60;
  const to = addDays(base, span - 1);
  const fromKey = dateKey(base);
  const toKey = dateKey(to);

  const merged = mergeExams(baseRows(sources), o.exams);
  const inWindow = merged.filter((r) => r.date >= fromKey && r.date <= toKey);
  inWindow.forEach((r) => {
    r.daysLeft = diffDays(base, dayStart(r.date));
  });
  sortRows(inWindow);

  const map = {};
  const list = [];
  inWindow.forEach((r) => {
    if (!map[r.date]) {
      const d = dayStart(r.date);
      map[r.date] = {
        key: r.date,
        daysLeft: r.daysLeft,
        weekday: weekdayOf(d),
        month: d.getMonth() + 1,
        day: d.getDate(),
        count: 0,
        items: [],
      };
      list.push(map[r.date]);
    }
    map[r.date].items.push(r);
    map[r.date].count += 1;
  });

  list.forEach((d) => {
    d.tone = dayTone(d.items);
  });

  return { from: fromKey, to: toKey, days: span, total: inWindow.length, dayCount: list.length, list: list };
}

module.exports = {
  ORDER,
  dateKey,
  dayStart,
  addDays,
  diffDays,
  weekdayOf,
  timeText,
  baseRows,
  mergeExams,
  buildTimeline,
  dayTone,
  decorate,
};
