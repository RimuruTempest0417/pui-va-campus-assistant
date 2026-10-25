/**
 * A4 列印用的純函式（完全不碰 wx，Node 也能跑 → 守門可驗）
 *
 * 為什麼要有這支：
 *  - 小程序沒有列印 API，「列印」實際上是兩件事：①螢幕上先看到 A4 版面 ②把手機上的表格帶到電腦印。
 *    ① 由頁面用這裡的 sheetHeight／rowsPerPage 算；② 用 toTsv() 複製成表格文字貼進 Word／Excel。
 *  - 每頁列數固定（同一份清單每張紙列數一致），不要用「內容多就往下長」——那樣第一頁永遠特別長，
 *    貼到紙上會斷在奇怪的位置。
 */

const A4_RATIO = 297 / 210; // 1.4142
const MIN_ROWS = 8; // 再少就不像名單了（也避免量測失敗時算出 1 列）
const MAX_ROWS = 40;
const DEFAULT_ROWS = 22;

/** 由可用寬度推 A4 紙高（px）。量不到就回 0，讓頁面先不鎖高，等下一輪量到再鎖。 */
function sheetHeight(width) {
  const w = Number(width) || 0;
  if (w <= 0) return 0;
  return Math.round(w * A4_RATIO);
}

/**
 * 由量到的高度推「每頁幾列」。
 * 任何一個值量不到就回 DEFAULT_ROWS——回 0 會讓畫面整片空白，而 console 不會有任何錯。
 */
function rowsPerPage(opts) {
  const o = opts || {};
  const sheet = Number(o.sheetHeight) || 0;
  const head = Number(o.headHeight) || 0;
  const foot = Number(o.footHeight) || 0;
  const row = Number(o.rowHeight) || 0;
  if (sheet <= 0 || row <= 0) return DEFAULT_ROWS;
  const usable = sheet - head - foot;
  const n = Math.floor(usable / row);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_ROWS;
  return Math.max(MIN_ROWS, Math.min(MAX_ROWS, n));
}

/** 切成每頁固定列數；空清單也回一頁（頁面才好畫「這頁沒有資料」） */
function paginate(rows, perPage) {
  const list = Array.isArray(rows) ? rows : [];
  const size = Math.max(1, Math.floor(Number(perPage) || DEFAULT_ROWS));
  const pages = [];
  for (let i = 0; i < list.length; i += size) {
    pages.push({ index: pages.length + 1, from: i + 1, rows: list.slice(i, i + size) });
  }
  return pages.length ? pages : [{ index: 1, from: 0, rows: [] }];
}

/**
 * 表格文字（Tab 分隔）：貼到 Word／Excel 會自動變成表格，這是手機端最實際的列印路徑。
 * 欄位內的 tab／換行要先清掉，否則貼上會多出欄或斷列。
 */
function toTsv(header, rows) {
  const cell = (v) => String(v === null || v === undefined ? '' : v).replace(/[\t\r\n]+/g, ' ');
  const head = (header || []).map(cell).join('\t');
  const body = (rows || []).map((r) => (r || []).map(cell).join('\t'));
  return [head].concat(body).join('\n');
}

module.exports = { A4_RATIO, DEFAULT_ROWS, MIN_ROWS, MAX_ROWS, sheetHeight, rowsPerPage, paginate, toTsv };
