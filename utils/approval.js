/**
 * 審批時效的三列表頭（W-113）—— 純函式，不 require wx／services／i18n。
 *
 * 為什麼要抽出來：這段「把 API 回應變成三行文字」的邏輯在後台概況裡，
 * 但它真正容易出錯的地方是規則（沒有樣本要顯示「—」而不是 0 小時、
 * 報修要同時寫接單與完成）。留在頁面裡就只能靠人眼看，
 * 抽成純函式後 `check-data-layer` 可以直接餵假資料斷言。
 *
 * `t` 是文案字典（頁面用 i18n.pick 填），這樣同一支函式在繁／簡介面都成立。
 */
function summarize(res, t) {
  const dict = t || {};
  const days = (res && res.days) || 30;
  const groups = (res && res.groups) || [];
  const labels = dict.labels || {};
  const unit = dict.unit || '';
  const hours = (v) => (v == null ? '—' : v + ' ' + unit);
  const join = (parts) => parts.join(' · ');

  return groups.map((g) => {
    const c = g.counts || {};
    const h = g.hours || {};
    const done = g.doneHours || {};
    const meta = [
      dict.near + ' ' + days + ' ' + dict.dayUnit + ' ' + (c.total || 0) + ' ' + dict.countUnit,
      dict.pending + ' ' + (c.pending || 0),
    ];
    if (g.key === 'repair') {
      // 報修沒有「批准」，時效是接單（誰先按誰拿到），完成另外算
      if (c.inProgress) meta.push(dict.inProgress + ' ' + c.inProgress);
      meta.push(dict.acceptAverage + ' ' + hours(h.avg));
      meta.push(dict.done + ' ' + (done.samples || 0) + ' ' + dict.countUnit + '（' + dict.average + ' ' + hours(done.avg) + '）');
    } else {
      meta.push(dict.approved + ' ' + (c.approved || 0));
      meta.push(dict.average + ' ' + hours(h.avg));
    }
    return {
      key: g.key,
      label: labels[g.key] || g.key,
      p50Text: dict.median + ' ' + hours(h.p50),
      metaText: join(meta),
    };
  });
}

module.exports = { summarize };
