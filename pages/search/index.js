// 全校搜尋（W-59）：一支輸入框搜遍公告／活動／失物。
// 規則全部在後端 `/search`（可見性不能在前端重算），這裡只負責「輸入 → 去抖 → 分組顯示」。
const data = require('../../services/data');
const i18n = require('../../utils/i18n');
const appearance = require('../../utils/appearance');
const { fromNow, dateTimeText } = require('../../utils/date');

const RECENT_KEY = 'pv_recent_searches';
const MAX_RECENT = 5;
/// 打字時等 280ms 再送（與失物列表同一個節奏）：一個字一支請求會讓手機端一直看到閃動的骨架
const DEBOUNCE_MS = 280;

/**
 * 徽章文字一律「用的時候才 pick」——宣告成常數會停在 App 啟動時的語言，
 * 使用者在設定頁切成簡體再回到這頁，分組標題就會是新語言、徽章還是繁體。
 */
function typeLabel(type) {
  if (type === 'event') return i18n.pick('活動');
  if (type === 'item') return i18n.pick('失物招領');
  return i18n.pick('公告');
}

function noticeBadge(kind) {
  if (kind === 'URGENT') return i18n.pick('緊急');
  if (kind === 'CALENDAR') return i18n.pick('校曆');
  return i18n.pick('公告');
}

function itemBadge(type) {
  return type === 'LOST' ? i18n.pick('遺失') : i18n.pick('拾獲');
}

function itemStatus(status) {
  if (status === 'CLAIMED') return i18n.pick('已認領');
  if (status === 'CLOSED') return i18n.pick('已完成');
  return i18n.pick('待認領');
}

function eventStatus(status) {
  if (status === 'CANCELLED') return i18n.pick('已取消');
  if (status === 'FINISHED') return i18n.pick('已結束');
  if (status === 'DRAFT') return i18n.pick('草稿');
  return '';
}
const ROUTE = {
  notice: '/pages/notices/detail/index?id=',
  event: '/pages/events/detail/index?id=',
  item: '/pages/items/detail/index?id=',
};

function readRecent() {
  try {
    const v = wx.getStorageSync(RECENT_KEY);
    return Array.isArray(v) ? v.slice(0, MAX_RECENT) : [];
  } catch (e) {
    return [];
  }
}

function writeRecent(list) {
  try {
    wx.setStorageSync(RECENT_KEY, list.slice(0, MAX_RECENT));
  } catch (e) {
    // storage 不可用只影響「最近搜尋」，不影響搜尋本身
  }
}

/** 一列結果的顯示欄位（徽章與時間依類型不同，全部在這裡算好，WXML 不做運算） */
function decorateRow(row) {
  let badgeLabel = '';
  let badgeTag = 'neutral';
  let metaText = '';
  if (row.type === 'notice') {
    badgeLabel = noticeBadge(row.badge);
    badgeTag = row.badge === 'URGENT' ? 'danger' : row.badge === 'CALENDAR' ? 'tint' : 'neutral';
    metaText = fromNow(row.date);
  } else if (row.type === 'event') {
    badgeLabel = eventStatus(row.badge);
    badgeTag = row.badge === 'CANCELLED' ? 'danger' : 'neutral';
    metaText = dateTimeText(row.date);
  } else {
    const t = (row.badge || '').split(':')[0];
    const s = (row.badge || '').split(':')[1];
    badgeLabel = itemBadge(t);
    badgeTag = s === 'OPEN' ? 'warning' : s === 'CLAIMED' ? 'tint' : 'neutral';
    metaText = fromNow(row.date) + (s && s !== 'OPEN' ? ' · ' + itemStatus(s) : '');
  }
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    snippet: row.snippet || '',
    badgeLabel: badgeLabel,
    badgeTag: badgeTag,
    metaText: metaText,
    url: (ROUTE[row.type] || '') + row.id,
  };
}

Page({
  labels() {
    return {
      title: i18n.pick('搜尋'),
      placeholder: i18n.pick('搜尋公告、活動、失物'),
      hintTitle: i18n.pick('想找什麼？'),
      hintDesc: i18n.pick('輸入關鍵字，一次搜遍公告、活動與失物'),
      recent: i18n.pick('最近搜尋'),
      clearRecent: i18n.pick('清除'),
      failed: i18n.pick('搜尋失敗'),
      retry: i18n.pick('重試'),
      emptyTitle: i18n.pick('沒有找到相符的內容'),
      emptyDesc: i18n.pick('換個關鍵字試試，或只打其中兩個字'),
      foundPrefix: i18n.pick('找到'),
      foundUnit: i18n.pick('筆'),
      countUnit: i18n.pick('筆'),
    };
  },

  data: {
    themeClass: appearance.themeClass(),
    keyword: '',
    hasKeyword: false,
    loading: false,
    failed: false,
    errorText: '',
    total: 0,
    groups: [],
    recent: [],
    pressedId: '',
    summaryText: '',
    emptyDesc: '',
  },

  onLoad() {
    this._seq = 0;
    this._timer = null;
    this.setData({ L: this.labels(), recent: readRecent() });
  },

  onShow() {
    // 在別頁切了繁／簡再回來，文案要重取（L 只在 onLoad 設一次就會停在舊語言）
    this.setData({ L: this.labels(), themeClass: appearance.themeClass() });
  },

  onUnload() {
    if (this._timer) clearTimeout(this._timer);
  },

  onInput(e) {
    const keyword = (e.detail && e.detail.value) || '';
    const hasKeyword = !!keyword.trim();
    this.setData({ keyword: keyword, hasKeyword: hasKeyword });
    if (this._timer) clearTimeout(this._timer);
    if (!hasKeyword) {
      // 清空不是「查空白」——直接回到提示畫面，不要留一個 422 的失敗畫面
      this._seq += 1;
      this.setData({ loading: false, failed: false, errorText: '', groups: [], total: 0, summaryText: '' });
      return;
    }
    this._timer = setTimeout(() => {
      this.run(keyword.trim());
    }, DEBOUNCE_MS);
  },

  onConfirm() {
    if (this._timer) clearTimeout(this._timer);
    const kw = (this.data.keyword || '').trim();
    if (kw) this.run(kw);
  },

  onClear() {
    if (this._timer) clearTimeout(this._timer);
    this._seq += 1;
    this.setData({ keyword: '', hasKeyword: false, loading: false, failed: false, groups: [], total: 0, summaryText: '' });
  },

  tapRecent(e) {
    const word = e.currentTarget.dataset.word;
    if (!word) return;
    this.setData({ keyword: word, hasKeyword: true });
    this.run(word);
  },

  clearRecent() {
    writeRecent([]);
    this.setData({ recent: [] });
  },

  retry() {
    const kw = (this.data.keyword || '').trim();
    if (kw) this.run(kw);
  },

  /** 記住最近搜尋（去重、最新的排最前） */
  remember(word) {
    const list = [word].concat(readRecent().filter((w) => w !== word));
    writeRecent(list);
    this.setData({ recent: readRecent() });
  },

  async run(word) {
    const seq = (this._seq += 1);
    this.setData({ loading: true, failed: false, errorText: '' });
    try {
      const res = await data.search(word);
      // 慢的那一支回來時使用者已經打了新的字 → 丟掉，避免畫面顯示上一個關鍵字的結果
      if (seq !== this._seq) return;
      const groups = (res.groups || []).map((g) => ({
        type: g.type,
        typeLabel: typeLabel(g.type),
        count: g.count,
        items: (g.items || []).map(decorateRow),
      }));
      const total = res.total || 0;
      const L = this.data.L || {};
      this.setData({
        loading: false,
        groups: groups,
        total: total,
        summaryText: total ? (L.foundPrefix || '') + ' ' + total + ' ' + (L.foundUnit || '') : '',
      });
      if (total) this.remember(word);
    } catch (e) {
      if (seq !== this._seq) return;
      const msg = data.messageOf(e);
      this.setData({ loading: false, failed: true, errorText: msg, groups: [], total: 0 });
      wx.showToast({ title: msg, icon: 'none' });
    }
  },

  goRow(e) {
    const { id, type } = e.currentTarget.dataset;
    if (!id || !ROUTE[type]) return;
    wx.navigateTo({ url: ROUTE[type] + id });
  },

  onRowTouchStart(e) {
    this.setData({ pressedId: e.currentTarget.dataset.id || '' });
  },

  onRowTouchEnd() {
    this.setData({ pressedId: '' });
  },
});
