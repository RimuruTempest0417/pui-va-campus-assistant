/**
 * 測驗倒數與溫習計劃（W-69）的純函式。
 *
 * 資料全部來自既有端點，不新增 API、不呼叫任何外部服務：
 *   ① 活動（`GET /events`）：標題含考試字樣 → 用 startAt 當測驗日期
 *   ② 外部校曆（`GET /calendar/external`，學校發布的 ICS）：date 就是場次日期
 *   ③ 公告（`GET /notices`）：標題或內容含考試字樣時，只抓「寫出來的日期」
 *      （公告的 publishedAt 是發布日，不是考試日，不能拿去當倒數）
 *   ④ 成績（`GET /school/grades` 或家長端的子女成績）→ 每科平均／趨勢／上次考的範圍
 *
 * 這裡刻意不 require wx、不 require services：同一份規則可以被
 * scripts/check-study.cjs 在 Node 裡直接測，不必開開發者工具。
 */

const DAY = 24 * 60 * 60 * 1000;

// 只認明確的考試字樣。用 'test' 這種寬鬆字會把 contest／latest 也算進來（誤判的倒數比沒有更糟）。
const EXAM_WORDS = [
  '測驗', '测验',
  '考試', '考试',
  '統測', '统测',
  '大測', '大测',
  '小測', '小测',
  '段考', '期中考', '期末考',
  '模擬考', '模拟考',
  'quiz', 'exam',
];

function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}

/** 當天 00:00（本地時區）—— 倒數一律用「日」比，不比時刻 */
function dayStart(value) {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dateKey(value) {
  const d = dayStart(value);
  if (!d) return '';
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function daysBetween(fromDay, toDay) {
  return Math.round((toDay.getTime() - fromDay.getTime()) / DAY);
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function isExamTitle(title) {
  const t = String(title === null || title === undefined ? '' : title).toLowerCase();
  if (!t) return false;
  for (let i = 0; i < EXAM_WORDS.length; i += 1) {
    if (t.indexOf(EXAM_WORDS[i]) !== -1) return true;
  }
  return false;
}

/** 只有「真的存在」的日期才算（2 月 31 日會被 Date 自動進位，要擋掉） */
function buildDay(year, month, day, today) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const base = dayStart(today || new Date());
  let y = year;
  if (!y) {
    y = base.getFullYear();
    let cand = new Date(y, month - 1, day);
    if (daysBetween(base, cand) < -180) cand = new Date(y + 1, month - 1, day);
    return cand.getMonth() === month - 1 ? cand : null;
  }
  const cand = new Date(y, month - 1, day);
  return cand.getMonth() === month - 1 ? cand : null;
}

/**
 * 從一段文字抓出日期。
 * 支援 2026-11-20／2026/11/20／2026年11月20日／11月20日／11/20；
 * 「11 月 3 日至 7 日」只會抓到 3 日（後面的 7 日沒有月份，不猜）。
 */
function extractDates(text, today) {
  const src = String(text === null || text === undefined ? '' : text);
  const out = [];
  const push = (y, m, d) => {
    const day = buildDay(y, m, d, today);
    if (day) out.push(day);
  };

  let m;
  const full = /(\d{4})\s*[-/年]\s*(\d{1,2})\s*[-/月]\s*(\d{1,2})\s*日?/g;
  while ((m = full.exec(src))) push(Number(m[1]), Number(m[2]), Number(m[3]));

  const md = /(\d{1,2})\s*月\s*(\d{1,2})\s*日/g;
  while ((m = md.exec(src))) push(null, Number(m[1]), Number(m[2]));

  // 前後不接數字或斜線：避免把 2026/11/20 的片段再抓一次，也避開「3/4 班」
  const slash = /(^|[^\d/])(\d{1,2})\/(\d{1,2})(?![\d/])/g;
  while ((m = slash.exec(src))) push(null, Number(m[2]), Number(m[3]));

  return out;
}

function timeOf(value) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  if (d.getHours() === 0 && d.getMinutes() === 0) return '';
  return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

/**
 * 接下來的測驗（依日期由近到遠）。
 * sources = { events, notices, external }
 */
function upcomingExams(sources, today, opts) {
  const o = opts || {};
  const horizon = typeof o.horizonDays === 'number' ? o.horizonDays : 120;
  const base = dayStart(today || new Date());
  const rows = [];
  const seen = {};

  const add = (row) => {
    const key = row.date + '|' + row.title;
    if (seen[key]) return;
    seen[key] = true;
    rows.push(row);
  };

  // ① 活動：startAt 就是真的日期
  ((sources && sources.events) || []).forEach((e) => {
    if (!e || !isExamTitle(e.title)) return;
    const day = dayStart(e.startAt);
    if (!day) return;
    add({
      id: String(e.id || ''),
      source: 'event',
      title: String(e.title || ''),
      date: dateKey(day),
      time: timeOf(e.startAt),
      location: String(e.location || ''),
    });
  });

  // ② 外部校曆（學校發布的 ICS）：date 欄位已經是場次日期
  ((sources && sources.external) || []).forEach((x) => {
    if (!x || !isExamTitle(x.title)) return;
    const day = dayStart(x.date);
    if (!day) return;
    add({
      id: String(x.id || ''),
      source: 'school',
      title: String(x.title || ''),
      date: dateKey(day),
      time: String(x.startTime || ''),
      location: String(x.location || ''),
    });
  });

  // ③ 公告：只採用「文字裡寫出來的日期」
  ((sources && sources.notices) || []).forEach((n) => {
    if (!n) return;
    const text = String(n.title || '') + ' ' + String(n.content || '');
    if (!isExamTitle(text)) return;
    extractDates(text, base).forEach((day) => {
      add({
        id: String(n.id || ''),
        source: 'notice',
        title: String(n.title || ''),
        date: dateKey(day),
        time: '',
        location: '',
      });
    });
  });

  return rows
    .map((r) => Object.assign(r, { daysLeft: daysBetween(base, dayStart(r.date)) }))
    .filter((r) => r.daysLeft >= 0 && r.daysLeft <= horizon)
    .sort((a, b) => a.daysLeft - b.daysLeft || a.title.localeCompare(b.title));
}

/** 每科統計：平均／最高／最低／最近一次／與上一次的差 */
function subjectStats(grades) {
  const byCourse = {};
  (grades || []).forEach((g) => {
    if (!g || !g.courseName) return;
    const score = typeof g.score === 'number' ? g.score : Number(g.score);
    if (g.score === null || g.score === undefined || !isFinite(score)) return;
    const key = String(g.courseName);
    if (!byCourse[key]) byCourse[key] = [];
    byCourse[key].push({
      score: score,
      day: dayStart(g.testDate),
      content: String(g.content || ''),
      testType: String(g.testType || ''),
    });
  });

  const rows = Object.keys(byCourse).map((course) => {
    const list = byCourse[course].slice().sort((a, b) => {
      const ta = a.day ? a.day.getTime() : 0;
      const tb = b.day ? b.day.getTime() : 0;
      return ta - tb;
    });
    const scores = list.map((x) => x.score);
    const sum = scores.reduce((a, b) => a + b, 0);
    const last = list[list.length - 1];
    const prev = list.length > 1 ? list[list.length - 2] : null;
    const delta = prev ? round1(last.score - prev.score) : null;
    return {
      course: course,
      count: scores.length,
      average: round1(sum / scores.length),
      best: Math.max.apply(null, scores),
      worst: Math.min.apply(null, scores),
      latest: last.score,
      latestDate: last.day ? dateKey(last.day) : '',
      latestContent: last.content,
      latestType: last.testType,
      prevScore: prev ? prev.score : null,
      delta: delta,
      trend: delta === null ? 'none' : delta >= 1.5 ? 'up' : delta <= -1.5 ? 'down' : 'flat',
    };
  });

  rows.sort((a, b) => a.average - b.average || a.course.localeCompare(b.course));
  return rows;
}

/** 測驗標題屬於哪一科（用最長的相符科目名，避免「數學」吃掉「高等數學」這種情況） */
function matchCourse(title, courseNames) {
  const t = String(title === null || title === undefined ? '' : title);
  let best = '';
  (courseNames || []).forEach((name) => {
    if (!name) return;
    if (t.indexOf(name) === -1) return;
    if (String(name).length > best.length) best = String(name);
  });
  return best;
}

/**
 * 溫習順序：壓力值越大越先溫。
 *   ① 分數偏低（85 − 平均，夾在 −12…45：平均 97 分的科目不該因為「分數沒到 100」排前面）
 *   ② 最近一次明顯下滑（最多 +15）
 *   ③ 14 天內有這一科的測驗（+50 − 剩餘天數：越近越急）
 *   ④ 只有一次成績又沒有測驗的科目降權（樣本不足）
 * 回傳每列的 `why`（exam／down／low／solid）讓畫面說得出「為什麼排這裡」，不是黑箱排序。
 */
function plan(subjects, exams) {
  const names = (subjects || []).map((s) => s.course);
  const near = {};
  (exams || []).forEach((e) => {
    const course = matchCourse(e.title, names);
    if (!course) return;
    if (typeof e.daysLeft !== 'number' || e.daysLeft > 14) return;
    if (near[course] === undefined || e.daysLeft < near[course]) near[course] = e.daysLeft;
  });

  return (subjects || [])
    .map((s) => {
      const examIn = near[s.course] === undefined ? null : near[s.course];
      const raw = 85 - s.average;
      let pressure = Math.max(-12, Math.min(45, raw));
      const why = [];
      if (s.count >= 2 && s.trend === 'down') {
        pressure += Math.min(15, Math.abs(s.delta));
        why.push('down');
      }
      if (examIn !== null) {
        pressure += 50 - examIn;
        why.unshift('exam');
      } else if (s.count < 2) {
        pressure -= 8;
      }
      if (s.average < 70) why.push('low');
      else if (s.average >= 85 && s.trend !== 'down' && examIn === null) why.push('solid');
      return Object.assign({}, s, {
        examInDays: examIn,
        pressure: round1(pressure),
        why: why,
      });
    })
    .sort((a, b) => b.pressure - a.pressure || a.average - b.average);
}

module.exports = {
  EXAM_WORDS,
  dayStart,
  dateKey,
  daysBetween,
  isExamTitle,
  extractDates,
  upcomingExams,
  subjectStats,
  matchCourse,
  plan,
};
