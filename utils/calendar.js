// 校曆：把公告與活動攤成「日期 → 當天項目」，並產生月視圖格子。
// 兩邊資料都是既有端點，這裡只做組合與格式化，不新增 API。

function pad(n) {
  return n < 10 ? '0' + n : String(n);
}

function dateKey(d) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return '';
  return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
}

function monthLabel(year, month) {
  return year + ' 年 ' + month + ' 月';
}

/** 月視圖格子：固定 6 列 × 7 欄（42 格），週一為第一欄 */
function monthGrid(year, month) {
  const first = new Date(year, month - 1, 1);
  const dow = first.getDay() === 0 ? 7 : first.getDay(); // 週一 = 1
  const start = new Date(year, month - 1, 1 - (dow - 1));
  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push({
      key: dateKey(d),
      day: d.getDate(),
      inMonth: d.getMonth() === month - 1,
      weekday: d.getDay(),
      isToday: dateKey(d) === dateKey(new Date()),
    });
  }
  return cells;
}

/** 把「同一天」的項目收在一起（公告先於活動） */
function groupByDate(notices, events) {
  const map = {};
  const push = (key, item) => {
    if (!key) return;
    if (!map[key]) map[key] = [];
    map[key].push(item);
  };

  (notices || []).forEach((n) => {
    push(dateKey(n.publishedAt || n.createdAt), {
      type: 'notice',
      id: n.id,
      title: n.title,
      kind: n.kind || 'NORMAL',
      pinned: !!n.isPinned,
      time: '',
    });
  });

  (events || []).forEach((e) => {
    const start = e.startAt ? new Date(e.startAt) : null;
    push(dateKey(e.startAt), {
      type: 'event',
      id: e.id,
      title: e.title,
      kind: 'EVENT',
      pinned: false,
      time: start && !isNaN(start.getTime()) ? pad(start.getHours()) + ':' + pad(start.getMinutes()) : '',
    });
  });

  Object.keys(map).forEach((k) => {
    map[k].sort((a, b) => {
      const order = { URGENT: 0, EVENT: 1, CALENDAR: 2, NORMAL: 3 };
      return (order[a.kind] ?? 9) - (order[b.kind] ?? 9);
    });
  });
  return map;
}

/** 給月視圖用：每天有幾筆（畫圓點用） */
function monthSummary(cells, grouped) {
  return cells.map((c) => {
    const items = grouped[c.key] || [];
    return Object.assign({}, c, {
      count: items.length,
      hasUrgent: items.some((i) => i.kind === 'URGENT'),
      hasEvent: items.some((i) => i.type === 'event'),
      hasNotice: items.some((i) => i.type === 'notice'),
    });
  });
}

module.exports = { dateKey, monthLabel, monthGrid, groupByDate, monthSummary, pad };
