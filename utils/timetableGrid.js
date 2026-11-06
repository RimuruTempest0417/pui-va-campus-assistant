// 課表列印／存成圖片用的網格與 Canvas 版面（W-83）
//
// 為什麼要先攤成格子：紙上的課表是「節次 × 星期」的固定格子，沒課的格子也要留白，
// 否則整張表會塌成不對齊的列（一看就知道是拿手機清單印出來的）。
// 這裡全部是純函式（不碰 wx、不含中文字面值），所以 Node 端可以直接跑測試。

/** 節次與星期攤成二維格子 */
function buildGrid(input) {
  const src = input || {};
  const periods = (src.periods || []).slice().sort((a, b) => a.period - b.period);
  const weekdays = (src.weekdays || []).slice().sort((a, b) => a.weekday - b.weekday);
  const byCell = {};
  (src.slots || []).forEach((slot) => {
    byCell[slot.weekday + ':' + slot.period] = slot;
  });

  const rows = periods.map((p) => {
    const cells = weekdays.map((d) => {
      const hit = byCell[d.weekday + ':' + p.period];
      if (!hit) return { weekday: d.weekday, empty: true, subject: '', room: '', teacher: '', meta: '' };
      const bits = [];
      if (hit.room) bits.push(hit.room);
      if (hit.teacherName) bits.push(hit.teacherName);
      return {
        weekday: d.weekday,
        empty: false,
        subject: hit.subject || '',
        // 課室與老師分開給：紙上／圖上一行放不下「實驗室 B · 吳老師」，
        // 合成一句只會被截成「實驗室 B · …」（實測看圖才發現）。
        room: hit.room || '',
        teacher: hit.teacherName || '',
        meta: bits.join(' · '),
      };
    });
    return {
      period: p.period,
      timeText: (p.startTime || '') + (p.endTime ? '–' + p.endTime : ''),
      cells: cells,
    };
  });

  let filled = 0;
  rows.forEach((row) => {
    row.cells.forEach((cell) => {
      if (!cell.empty) filled += 1;
    });
  });

  return { weekdays: weekdays, rows: rows, filled: filled, total: rows.length * weekdays.length };
}

function p2(n) {
  return n < 10 ? '0' + n : '' + n;
}

/** 本週的上課區間（星期一 → 星期五），給標題的「本週 11/02–11/06」用 */
function weekRange(value) {
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (isNaN(d.getTime())) return { from: '', to: '', text: '' };
  const day = d.getDay() === 0 ? 7 : d.getDay();
  const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (day - 1));
  const fri = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 4);
  const fmt = (x) => x.getFullYear() + '/' + p2(x.getMonth() + 1) + '/' + p2(x.getDate());
  const md = (x) => p2(x.getMonth() + 1) + '/' + p2(x.getDate());
  return { from: fmt(mon), to: fmt(fri), text: md(mon) + '–' + md(fri) };
}

/**
 * Canvas 版面：寬固定 1080，高度隨節次數長（8 節約 1400），
 * 這樣存下來的圖在任何手機看都清楚，也不會因為機型不同而擠成一團。
 */
const IMG = { width: 1080, pad: 48, headH: 138, theadH: 78, rowH: 112, footH: 96, colNoW: 196 };

function imagePlan(rowCount) {
  const rows = Math.max(1, Number(rowCount) || 0);
  const dayColW = (IMG.width - IMG.pad * 2 - IMG.colNoW) / 5;
  return {
    width: IMG.width,
    height: IMG.pad * 2 + IMG.headH + IMG.theadH + rows * IMG.rowH + IMG.footH,
    pad: IMG.pad,
    headH: IMG.headH,
    theadH: IMG.theadH,
    rowH: IMG.rowH,
    footH: IMG.footH,
    colNoW: IMG.colNoW,
    dayColW: dayColW,
    rows: rows,
  };
}

/** 依字數截斷（Canvas 沒有可靠的換行；中文一格約等於字級寬，取保守值） */
function clip(text, max) {
  const s = String(text == null ? '' : text);
  if (s.length <= max) return s;
  return s.slice(0, max) + '…';
}

function line(ctx, x1, y1, x2, y2, width) {
  ctx.beginPath();
  ctx.lineWidth = width || 1.5;
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

/**
 * 畫出整張課表。
 * opts：{ plan, title, sub, colPeriod, weekdays:[字], rows, footNote, colors:{surface,ink,inkSoft,rule} }
 * colors 由頁面從 utils/theme.js 取（頁面 JS 不准寫死色值）。
 */
function draw(ctx, opts) {
  const o = opts || {};
  const plan = o.plan || imagePlan((o.rows || []).length);
  const colors = o.colors || {};
  const rows = o.rows || [];
  const days = o.weekdays || [];

  ctx.fillStyle = colors.surface;
  ctx.fillRect(0, 0, plan.width, plan.height);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  let y = plan.pad;
  ctx.fillStyle = colors.ink;
  ctx.font = 'bold 46px sans-serif';
  ctx.fillText(clip(o.title, 20), plan.pad, y);
  y += 62;
  ctx.fillStyle = colors.inkSoft;
  ctx.font = '24px sans-serif';
  ctx.fillText(clip(o.sub, 60), plan.pad, y);
  y += 40;
  y += 18;
  ctx.strokeStyle = colors.ink;
  line(ctx, plan.pad, y, plan.width - plan.pad, y, 3);
  y += 18;

  const left = plan.pad;
  const right = plan.width - plan.pad;
  const noRight = left + plan.colNoW;
  const colX = (i) => noRight + i * plan.dayColW;

  // 表頭：節次／星期
  ctx.fillStyle = colors.ink;
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(String(o.colPeriod || ''), left + 12, y + 24);
  days.forEach((label, i) => {
    ctx.fillText(clip(label, 5), colX(i) + 12, y + 24);
  });
  ctx.strokeStyle = colors.ink;
  line(ctx, left, y + plan.theadH, right, y + plan.theadH, 2.5);
  y += plan.theadH;

  // 每一節
  rows.forEach((row) => {
    const mid = y + 20;
    ctx.fillStyle = colors.ink;
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(String(row.period), left + 12, mid);
    ctx.fillStyle = colors.inkSoft;
    ctx.font = '20px sans-serif';
    ctx.fillText(clip(row.timeText, 12), left + 56, mid + 6);

    (row.cells || []).forEach((cell, i) => {
      if (cell.empty) return;
      ctx.fillStyle = colors.ink;
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText(clip(cell.subject, 5), colX(i) + 12, mid);

      // 課室與老師分兩行：合一行時「實驗室 B · 吳老師」一定被截掉一半
      if (cell.room) {
        ctx.fillStyle = colors.inkSoft;
        ctx.font = '20px sans-serif';
        ctx.fillText(clip(cell.room, 8), colX(i) + 12, mid + 36);
      }
      if (cell.teacher) {
        ctx.fillStyle = colors.inkSoft;
        ctx.font = '20px sans-serif';
        ctx.fillText(clip(cell.teacher, 6), colX(i) + 12, mid + 62);
      }
    });

    ctx.strokeStyle = colors.rule;
    line(ctx, left, y + plan.rowH, right, y + plan.rowH, 1.5);
    y += plan.rowH;
  });

  // 直線（節次欄右緣與每一天的分隔）
  ctx.strokeStyle = colors.rule;
  for (let i = 0; i <= days.length; i += 1) {
    const x = i === 0 ? noRight : colX(i - 1);
    line(ctx, x, plan.pad + plan.headH, x, y, 1.5);
  }
  line(ctx, left, plan.pad + plan.headH, left, y, 2);

  // 頁腳
  const footY = y + 34;
  ctx.strokeStyle = colors.rule;
  line(ctx, left, footY - 16, right, footY - 16, 1.5);
  ctx.fillStyle = colors.inkSoft;
  ctx.font = '20px sans-serif';
  ctx.fillText(clip(o.footNote, 40), left, footY);

  return plan;
}

/**
 * 頁面參數可能已經解碼、也可能還是 %E9%AB%98… 這種形式
 * （實測：課表頁用 encodeURIComponent 帶班名過來，列印頁 onLoad 收到的仍是編碼後的字串，
 *   於是拿錯的班名去查 → 整張表空白，而編譯、console、所有靜態守門全綠）。
 * decodeURIComponent 對沒有 % 的字串是原樣回傳，所以兩種情況都能吃。
 */
function decodeParam(value) {
  const raw = value == null ? '' : String(value);
  if (!raw) return '';
  try {
    return decodeURIComponent(raw);
  } catch (e) {
    return raw;
  }
}

module.exports = {
  buildGrid: buildGrid,
  weekRange: weekRange,
  imagePlan: imagePlan,
  draw: draw,
  clip: clip,
  decodeParam: decodeParam,
};
