// 成績單列印／存成圖片用的版面（W-95 收尾）
//
// 為什麼要抽成純函式：Canvas 畫錯不會拋例外 —— 座標是 NaN 就只是「一片空白」，
// 顏色是 undefined 就只是「什麼都沒畫」，console 一個字都不會有。所以分組、統計、
// 版面與繪圖全部放這裡，由 scripts/check-transcript-print.cjs 用假 ctx 逐項驗。
//
// 這裡不碰 wx、也不含中文字面值（標籤一律由頁面用 pick() 傳進來），
// 簡體模式才不會出現「半繁半簡」的紙。

const TERM_FALLBACK = 3;

/** 去掉重複並由新到舊排序的學年（`2026/2027` → `2025/2026`） */
function yearsOf(items) {
  const list = Array.isArray(items) ? items : [];
  const seen = {};
  const out = [];
  list.forEach((row) => {
    const y = row && row.yearTerm ? String(row.yearTerm) : '';
    if (!y || seen[y]) return;
    seen[y] = true;
    out.push(y);
  });
  return out.sort((a, b) => {
    // 學年字串是 2026/2027 這種可比較格式；比字串就等於比時間，但不要依賴 localeCompare
    if (a === b) return 0;
    return a < b ? 1 : -1;
  });
}

/** 分數顯示：沒有分數（缺考／未批改）一律破折號，不要顯示 0 或 undefined */
function scoreText(score) {
  if (score === null || score === undefined || score === '') return '—';
  const n = Number(score);
  if (!Number.isFinite(n)) return '—';
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

function dateText(value) {
  const raw = value === null || value === undefined ? '' : String(value);
  return raw.slice(0, 10).replace(/-/g, '/');
}

/** 平均分：只算有分數的科目；一個都沒有就回 null（不是 0，0 分跟「沒資料」是兩件事） */
function averageOf(rows) {
  const nums = (rows || [])
    .map((r) => (r && r.score !== null && r.score !== undefined && r.score !== '' ? Number(r.score) : NaN))
    .filter((n) => Number.isFinite(n));
  if (!nums.length) return null;
  const sum = nums.reduce((a, b) => a + b, 0);
  return Math.round((sum / nums.length) * 10) / 10;
}

/**
 * 依學年＋學段分組。
 * termLabels 是頁面傳進來的三個學段字（簡體模式下也要跟著變），長度不足時補空字串。
 * 回傳只包含「有紀錄」的學段 —— 空學段留在紙上只會讓成績單看起來像漏印。
 */
function sectionsOf(items, yearTerm, termLabels) {
  const list = Array.isArray(items) ? items : [];
  const labels = (termLabels || []).map((t) => String(t || ''));
  const byTerm = {};
  list.forEach((row) => {
    if (!row) return;
    if (yearTerm && String(row.yearTerm || '') !== String(yearTerm)) return;
    const term = String(row.term || '');
    if (!byTerm[term]) byTerm[term] = [];
    byTerm[term].push(row);
  });

  const order = labels.length ? labels : Object.keys(byTerm).slice(0, TERM_FALLBACK);
  const seen = {};
  order.forEach((t) => { seen[t] = true; });
  // 後端可能有不在三個固定值裡的學段（例如舊資料），排在最後而不是直接丟掉
  const extra = Object.keys(byTerm).filter((t) => !seen[t]).sort();

  const out = [];
  order.concat(extra).forEach((term) => {
    const rows = (byTerm[term] || []).slice().sort((a, b) => {
      const da = String(a.testDate || '');
      const db = String(b.testDate || '');
      if (da !== db) return da < db ? -1 : 1;
      return String(a.courseName || '') < String(b.courseName || '') ? -1 : 1;
    });
    if (!rows.length) return;
    out.push({
      term: term,
      rows: rows.map((r) => ({
        // key 只給 WXML 的 wx:key 用（同一學段可能同科目考兩次，用科目當 key 會重複）
        key: String(r.id || r.courseName + '|' + r.testType + '|' + String(r.testDate || '')),
        course: String(r.courseName || ''),
        type: String(r.testType || ''),
        dateText: dateText(r.testDate),
        scoreText: scoreText(r.score),
      })),
      count: rows.length,
      average: averageOf(rows),
      averageText: averageOf(rows) === null ? '—' : String(averageOf(rows)),
    });
  });
  return out;
}

/** 出缺席統計：與後端同一套口徑（遲到算出席、請假不算缺席） */
function attendanceStats(items) {
  const list = Array.isArray(items) ? items : [];
  let late = 0;
  let absent = 0;
  let leave = 0;
  let present = 0;
  list.forEach((row) => {
    if (!row) return;
    const am = String(row.amStatus || 'normal');
    const pm = String(row.pmStatus || 'normal');
    const isAbsent = am === 'absent' || pm === 'absent';
    const isLeave = !isAbsent && (am === 'leave' || pm === 'leave');
    const isLate = !isAbsent && !isLeave && (row.isAmLate || row.isPmLate || am === 'late' || pm === 'late');
    if (isAbsent) absent += 1;
    else if (isLeave) leave += 1;
    else if (isLate) late += 1;
    else present += 1;
  });
  const total = list.length;
  return {
    total: total,
    present: present,
    late: late,
    leave: leave,
    absent: absent,
    // 出席率＝(有紀錄 − 缺席) ÷ 有紀錄；沒紀錄回 null，不要假裝 100%
    rate: total ? Math.round(((total - absent) / total) * 1000) / 10 : null,
  };
}

/** 由 raw 資料算出整份成績單要顯示的東西（頁面與守門共用同一份計算） */
function build(raw) {
  const src = raw || {};
  const grades = Array.isArray(src.grades) ? src.grades : [];
  const attendance = Array.isArray(src.attendance) ? src.attendance : [];
  const years = yearsOf(grades);
  const termLabels = Array.isArray(src.termLabels) ? src.termLabels : [];
  const yearTerm = src.yearTerm && years.indexOf(String(src.yearTerm)) !== -1 ? String(src.yearTerm) : (years[0] || '');
  const rowsInYear = attendance.filter((a) => !yearTerm || String((a && a.yearTerm) || '') === yearTerm);
  return {
    years: years,
    yearTerm: yearTerm,
    sections: sectionsOf(grades, yearTerm, termLabels),
    attendance: attendanceStats(rowsInYear),
    empty: !grades.length,
  };
}

// ── Canvas 版面 ────────────────────────────────────────────────
const IMG = {
  width: 1080,
  pad: 48,
  headH: 176,
  termH: 52,
  colHeadH: 46,
  rowH: 60,
  attH: 146,
  footH: 96,
};

/** 版面尺寸：寬固定 1080，高度依「每個學段的列數」長（0 個學段也有最小高度） */
function plan(sections) {
  const list = Array.isArray(sections) ? sections : [];
  const rows = list.reduce((sum, s) => sum + ((s && s.rows && s.rows.length) || 0), 0);
  const blocks = list.reduce((sum, s) => sum + IMG.termH + IMG.colHeadH + ((s && s.rows && s.rows.length) || 0) * IMG.rowH, 0);
  return {
    width: IMG.width,
    height: IMG.pad * 2 + IMG.headH + blocks + IMG.attH + IMG.footH,
    pad: IMG.pad,
    headH: IMG.headH,
    termH: IMG.termH,
    colHeadH: IMG.colHeadH,
    rowH: IMG.rowH,
    attH: IMG.attH,
    footH: IMG.footH,
    rows: rows,
    sections: list.length,
  };
}

/** 欄寬（比例制）：科目吃剩餘寬度，其餘固定比例 */
const COLS = { course: 0.44, type: 0.2, date: 0.2, score: 0.16 };

/** 依字數截斷（Canvas 沒有可靠的自動換行） */
function clip(text, max) {
  const s = String(text === null || text === undefined ? '' : text);
  if (s.length <= max) return s;
  return max <= 1 ? '…' : s.slice(0, max - 1) + '…';
}

function hline(ctx, x1, y, x2, width) {
  ctx.beginPath();
  ctx.lineWidth = width || 1.5;
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
}

/**
 * 畫整張成績單。
 * opts：{
 *   plan, title, studentLine, metaLine, footNote,
 *   colLabels: { course, type, date, score },
 *   sections: [{ term, averageText, rows:[{course,type,dateText,scoreText}] }],
 *   attendanceLines: [字, 字],   // 例：["上課日 43", "出席 40 · 遲到 2 · 請假 1"]
 *   colors: { surface, ink, inkSoft, rule }
 * }
 * colors 由頁面從 utils/theme.js 取（頁面 JS 不准寫死色值）。
 */
function draw(ctx, opts) {
  const o = opts || {};
  const sections = Array.isArray(o.sections) ? o.sections : [];
  const p = o.plan || plan(sections);
  const colors = o.colors || {};
  const colLabels = o.colLabels || {};
  const left = p.pad;
  const right = p.width - p.pad;
  const usable = right - left;
  const colX = {
    course: left,
    type: left + usable * COLS.course,
    date: left + usable * (COLS.course + COLS.type),
    score: left + usable * (COLS.course + COLS.type + COLS.date),
  };

  ctx.fillStyle = colors.surface;
  ctx.fillRect(0, 0, p.width, p.height);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  let y = p.pad;
  ctx.fillStyle = colors.ink;
  ctx.font = 'bold 46px sans-serif';
  ctx.fillText(clip(o.title, 20), left, y);
  y += 62;

  ctx.fillStyle = colors.inkSoft;
  ctx.font = '26px sans-serif';
  ctx.fillText(clip(o.studentLine, 34), left, y);
  y += 38;
  ctx.fillText(clip(o.metaLine, 34), left, y);
  y += 44;

  ctx.strokeStyle = colors.ink;
  hline(ctx, left, y, right, 3);
  y += 26;

  sections.forEach((section) => {
    // 學段標題列（左：學段名；右：平均分）
    ctx.fillStyle = colors.ink;
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(clip(section.term, 10), left, y + 10);
    if (section.averageText) {
      ctx.font = '24px sans-serif';
      ctx.fillStyle = colors.inkSoft;
      ctx.fillText(clip(section.averageText, 5), colX.score, y + 14);
    }
    y += p.termH;

    // 欄位表頭
    ctx.fillStyle = colors.inkSoft;
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(clip(colLabels.course, 4), colX.course, y + 10);
    ctx.fillText(clip(colLabels.type, 4), colX.type, y + 10);
    ctx.fillText(clip(colLabels.date, 6), colX.date, y + 10);
    ctx.fillText(clip(colLabels.score, 3), colX.score, y + 10);
    y += p.colHeadH;

    section.rows.forEach((row) => {
      ctx.fillStyle = colors.ink;
      ctx.font = '24px sans-serif';
      ctx.fillText(clip(row.course, 12), colX.course, y + 14);
      ctx.fillStyle = colors.inkSoft;
      ctx.font = '22px sans-serif';
      ctx.fillText(clip(row.type, 7), colX.type, y + 16);
      ctx.fillText(clip(row.dateText, 10), colX.date, y + 16);
      ctx.fillStyle = colors.ink;
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(clip(row.scoreText, 6), colX.score, y + 14);

      ctx.strokeStyle = colors.rule;
      hline(ctx, left, y + p.rowH, right, 1.2);
      y += p.rowH;
    });
  });

  // 出缺席摘要（放在最後一個學段之後，固定一塊）
  const attTop = y + 18;
  ctx.strokeStyle = colors.ink;
  hline(ctx, left, attTop, right, 2);
  ctx.fillStyle = colors.ink;
  ctx.font = 'bold 24px sans-serif';
  let ay = attTop + 18;
  (o.attendanceLines || []).forEach((lineText, i) => {
    ctx.font = i === 0 ? 'bold 24px sans-serif' : '22px sans-serif';
    ctx.fillStyle = i === 0 ? colors.ink : colors.inkSoft;
    ctx.fillText(clip(lineText, 36), left, ay);
    ay += 30;
  });

  // 頁腳
  const footY = p.height - p.pad - 22;
  ctx.strokeStyle = colors.rule;
  hline(ctx, left, footY - 18, right, 1.2);
  ctx.fillStyle = colors.inkSoft;
  ctx.font = '22px sans-serif';
  ctx.fillText(clip(o.footNote, 40), left, footY);

  return p;
}

/**
 * 頁面參數可能已經解碼、也可能還是 %E9%AB%98… 這種形式
 * （課表列印頁踩過：拿編碼後的字串去查 → 整張表空白，而所有靜態守門全綠）。
 */
function decodeParam(value) {
  const raw = value === null || value === undefined ? '' : String(value);
  if (!raw) return '';
  try {
    return decodeURIComponent(raw);
  } catch (e) {
    return raw;
  }
}

module.exports = {
  yearsOf: yearsOf,
  scoreText: scoreText,
  dateText: dateText,
  averageOf: averageOf,
  sectionsOf: sectionsOf,
  attendanceStats: attendanceStats,
  build: build,
  plan: plan,
  draw: draw,
  clip: clip,
  decodeParam: decodeParam,
  COLS: COLS,
  IMG: IMG,
};
