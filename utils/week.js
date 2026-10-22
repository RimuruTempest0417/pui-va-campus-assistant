const { dateKey } = require('./date');

const WEEK_CN = ['日', '一', '二', '三', '四', '五', '六'];

/** 本週一 00:00（offset = 0 本週、1 下週、-1 上週） */
function mondayOf(offset) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay() === 0 ? 7 : d.getDay(); // 週日當 7
  d.setDate(d.getDate() - (dow - 1) + (offset || 0) * 7);
  return d;
}

/** 該週一到週五的日期 key 陣列 */
function weekDates(offset) {
  const base = mondayOf(offset);
  const out = [];
  for (let i = 0; i < 5; i += 1) {
    const d = new Date(base.getTime());
    d.setDate(base.getDate() + i);
    out.push(dateKey(d));
  }
  return out;
}

function weekLabel(offset) {
  if (offset === 0) return '本週';
  if (offset === 1) return '下週';
  if (offset === -1) return '上週';
  return offset > 0 ? '下 ' + offset + ' 週' : '上 ' + Math.abs(offset) + ' 週';
}

function dayLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return { md: (d.getMonth() + 1) + '/' + d.getDate(), wd: '週' + WEEK_CN[d.getDay()] };
}

module.exports = { mondayOf, weekDates, weekLabel, dayLabel, dateKey };
