// 全校搜尋（W-59）：一支輸入框搜遍公告／活動／失物／轉贈。
// 規則全部在後端 `/search`（可見性不能在前端重算），這裡只負責「輸入 → 去抖 → 分組顯示」。
const data = require('../../services/data');
const request = require('../../utils/request');
const i18n = require('../../utils/i18n');
const appearance = require('../../utils/appearance');
const giveaway = require('../../utils/giveaway');
const proposal = require('../../utils/proposal');
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
  if (type === 'giveaway') return i18n.pick('二手轉贈');
  if (type === 'menu') return i18n.pick('菜單');
  if (type === 'homework') return i18n.pick('功課');
  if (type === 'proposal') return i18n.pick('校園提案');
  if (type === 'book') return i18n.pick('圖書館館藏');
  if (type === 'resource') return i18n.pick('場地與器材');
  if (type === 'leave') return i18n.pick('我的假單');
  if (type === 'repair') return i18n.pick('我的報修');
  if (type === 'loan') return i18n.pick('我的借閱');
  if (type === 'booking') return i18n.pick('我的借用');
  return i18n.pick('公告');
}

/** 假單的假別／狀態（W-105）：與假單頁同一套語彙，鍵值來自後端 `badge` 的 `假別:狀態` */
function leaveKindLabel(kind) {
  if (kind === 'SICK') return i18n.pick('病假');
  if (kind === 'PERSONAL') return i18n.pick('事假');
  if (kind === 'OFFICIAL') return i18n.pick('公假');
  return kind || '';
}

function leaveStatusLabel(status) {
  if (status === 'APPROVED') return i18n.pick('已批准');
  if (status === 'REJECTED') return i18n.pick('已駁回');
  if (status === 'CANCELLED') return i18n.pick('已取消');
  return i18n.pick('待審批');
}

/** 報修狀態（W-105）：badge 直接是狀態碼 */
function repairStatusLabel(status) {
  if (status === 'IN_PROGRESS') return i18n.pick('處理中');
  if (status === 'DONE') return i18n.pick('已完成');
  if (status === 'CANCELLED') return i18n.pick('已取消');
  return i18n.pick('待接單');
}

/** 借閱狀態（W-111）：badge 是 ACTIVE／OVERDUE —— 搜自己借的書，最要緊的是「有沒有逾期」 */
function loanBadge(status) {
  return status === 'OVERDUE' ? i18n.pick('已逾期') : i18n.pick('借閱中');
}

/** 借用狀態（W-111）：badge 直接是狀態碼（只會是待審批／已批准兩種） */
function bookingStatusLabel(status) {
  if (status === 'APPROVED') return i18n.pick('已批准');
  if (status === 'REJECTED') return i18n.pick('已駁回');
  return i18n.pick('待審批');
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
  giveaway: '/pages/giveaway/detail/index?id=',
  menu: '/pages/menu/dish/index?id=',
  // 功課只有一頁（清單＋打勾同一頁），沒有詳情頁，所以不接 id
  homework: '/pages/homework/index',
  proposal: '/pages/proposals/detail/index?id=',
  book: '/pages/library/detail/index?id=',
  resource: '/pages/venues/detail/index?id=',
  // 我的假單／我的報修（W-105）：都跳各自的清單頁，不接 id（假單與報修沒有詳情頁）
  leave: '/pages/leaves/mine/index',
  repair: '/pages/repair/index/index',
  // 我的借閱／我的借用（W-111）：跳館藏與場地詳情，接的是 book／resource 的 id（後端回的就是它）
  loan: '/pages/library/detail/index?id=',
  booking: '/pages/venues/detail/index?id=',
};

/** 哪些類別的網址要吃 id（功課／假單／報修不吃：它們跳的是整頁清單） */
const NEEDS_ID = {
  notice: true,
  event: true,
  item: true,
  giveaway: true,
  menu: true,
  homework: false,
  proposal: true,
  book: true,
  resource: true,
  leave: false,
  repair: false,
  loan: true,
  booking: true,
};

/** 餐別文字：午餐／小賣部。與菜單頁同一個語彙，不另造新詞 */
function mealLabel(mealType) {
  return mealType === 'SNACK' ? i18n.pick('小賣部') : i18n.pick('午餐');
}

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
  } else if (row.type === 'giveaway') {
    // 徽章用「書籍／校服／其他」，與轉贈清單同一支 utils/giveaway（不在這裡抄第二份對照表）
    badgeLabel = giveaway.kindLabel(row.badge);
    badgeTag = 'tint';
    metaText = fromNow(row.date);
  } else if (row.type === 'menu') {
    // 菜單：徽章是餐別，時間寫「哪天有」而不是「多久以前」—— 搜菜的用途是安排這一週吃飯
    badgeLabel = mealLabel(row.badge);
    badgeTag = 'tint';
    metaText = dateTimeText(row.date).split(' ')[0];
  } else if (row.type === 'homework') {
    // 功課：徽章是科目；時間寫「截止」而不是「多久以前」—— 搜功課是想知道哪天要交
    badgeLabel = row.badge || '';
    badgeTag = 'tint';
    metaText = i18n.pick('截止') + ' ' + dateTimeText(row.date);
  } else if (row.type === 'proposal') {
    // 提案：badge 是「分類:狀態」（後端與示範層同一個形狀），顯示用 proposal 這支 util，
    // 不在這裡抄第二份分類／狀態對照表
    const cat = (row.badge || '').split(':')[0];
    const st = (row.badge || '').split(':')[1];
    badgeLabel = proposal.categoryLabel(cat) + ' · ' + proposal.statusLabel(st);
    badgeTag = proposal.statusTag(st);
    const count = Number(row.supportCount || 0);
    const goal = Number(row.goal || 0);
    metaText = i18n.pick('連署 ') + count + ' / ' + goal + ' · ' + fromNow(row.date);
  } else if (row.type === 'book') {
    // 館藏（W-92）：徽章寫「可借／已借完」，第二行直接寫可借冊數 ——
    // 搜書的人要知道的是「現在借不借得到」，不是「多久以前上架」。借完的照樣列出來。
    badgeLabel = row.badge === 'OUT' ? i18n.pick('已借完') : i18n.pick('可借');
    badgeTag = row.badge === 'OUT' ? 'warning' : 'tint';
    metaText = i18n.pick('可借') + ' ' + Number(row.available || 0) + ' / ' + Number(row.total || 0) + ' ' + i18n.pick('冊');
  } else if (row.type === 'resource') {
    // 場地器材（W-92）：badge 是「種類:狀態」，這裡只取種類；第二行寫位置 ——
    // 「有鋼琴的那間房」按進去之前就要知道在哪一層樓。
    const kind = (row.badge || '').split(':')[0];
    badgeLabel = kind === 'EQUIPMENT' ? i18n.pick('器材') : i18n.pick('場地');
    badgeTag = 'tint';
    metaText = row.location || '';
  } else if (row.type === 'leave') {
    // 我的假單（W-105）：badge 是「假別:狀態」。標題已經是後端組好的「病假 2026/11/09」，
    // 第二行補狀態與原因摘要 —— 搜假單的人通常是要確認「老師批了沒」。
    const kind = (row.badge || '').split(':')[0];
    const st = (row.badge || '').split(':')[1];
    badgeLabel = leaveKindLabel(kind);
    badgeTag = st === 'APPROVED' ? 'tint' : st === 'REJECTED' ? 'warning' : 'neutral';
    metaText = leaveStatusLabel(st) + ' · ' + dateTimeText(row.date).split(' ')[0];
  } else if (row.type === 'repair') {
    // 我的報修（W-105）：badge 直接是狀態碼；第二行寫「地點 · 送出時間」，
    // 因為標題只寫了「地點 器材」，看不出是什麼時候報的。
    badgeLabel = repairStatusLabel(row.badge);
    badgeTag = row.badge === 'DONE' ? 'tint' : row.badge === 'CANCELLED' ? 'neutral' : 'warning';
    metaText = (row.location ? row.location + ' · ' : '') + fromNow(row.date);
  } else if (row.type === 'loan') {
    // 我的借閱（W-111）：`date` 是到期日（不是借出日），第二行直接寫「到期 2026/11/19」——
    // 搜自己借的書，要看的就是「什麼時候要還」；逾期的那筆轉警示色。
    badgeLabel = loanBadge(row.badge);
    badgeTag = row.badge === 'OVERDUE' ? 'warning' : 'tint';
    metaText = i18n.pick('到期') + ' ' + dateTimeText(row.date).split(' ')[0];
  } else if (row.type === 'booking') {
    // 我的借用（W-111）：`date` 是使用時段的開始時間，第二行寫「時間 · 地點」。
    badgeLabel = bookingStatusLabel(row.badge);
    badgeTag = row.badge === 'APPROVED' ? 'tint' : 'warning';
    metaText = dateTimeText(row.date) + (row.location ? ' · ' + row.location : '');
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
    url: NEEDS_ID[row.type] ? (ROUTE[row.type] || '') + row.id : ROUTE[row.type] || '',
  };
}

Page({
  labels() {
    return {
      title: i18n.pick('搜尋'),
      placeholder: i18n.pick('搜尋公告、活動、失物、轉贈、館藏、場地、菜單、功課、假單、報修與借閱'),
      hintTitle: i18n.pick('想找什麼？'),
      hintDesc: i18n.pick('輸入關鍵字，一次搜遍公告、活動、失物、轉贈、館藏、場地、菜單、功課、提案，以及你自己送出的假單、報修、借閱與借用'),
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
    // W-75 類型篩選：all＝不帶 types（五類一起回）
    typeFilter: 'all',
    typeFilters: [],
  },

  onLoad() {
    this._seq = 0;
    this._timer = null;
    this._role = '';
    this.setData({ L: this.labels(), recent: readRecent(), typeFilters: this.filters() });
    // 讀到角色後才決定要不要給「功課」chip（訪客與家長沒有 homework:read）
    data
      .me()
      .then((me) => {
        const role = (me && me.role) || '';
        if (!role) return;
        this._role = role;
        const filters = this.filters();
        const patch = { typeFilters: filters };
        // 已經切到功課／假單／報修才發現沒權限（例如切了角色）→ 回到「全部」，不要停在一個空結果上
        if (
          ['homework', 'leave', 'repair', 'loan', 'booking'].indexOf(this.data.typeFilter) !== -1 &&
          !filters.some((f) => f.key === this.data.typeFilter)
        ) {
          patch.typeFilter = 'all';
        }
        this.setData(patch);
      })
      .catch(() => {});
  },

  onShow() {
    // 在別頁切了繁／簡再回來，文案要重取（L 只在 onLoad 設一次就會停在舊語言）
    this.setData({ L: this.labels(), themeClass: appearance.themeClass(), typeFilters: this.filters() });
  },

  /** 類型篩選的 chips（W-75；W-105 加「我的」兩類）：key 對應後端 `types` 的值，all 代表不帶參數 */
  filters() {
    const role = this._role || '';
    // 功課要登入才有（後端 `homework:read`）：未登入與家長不給這顆 chip，
    // 否則點下去只會得到「沒有找到相符的內容」，看起來像搜尋壞了。
    // 「我的假單／我的報修」同一條道理：家長沒有 leave:create／repair:create，
    // 訪客更沒有 —— 給了一樣只會搜到空結果。
    // 角色還沒讀到時（第一輪）先看有沒有 token，寧可先給、讀到角色再收。
    const canHomework = role
      ? ['STUDENT', 'TEACHER', 'STAFF', 'ADMIN', 'SUPER_ADMIN'].indexOf(role) !== -1
      : !!request.getToken();
    const list = [
      { key: 'all', label: i18n.pick('全部') },
      { key: 'notice', label: i18n.pick('公告') },
      { key: 'event', label: i18n.pick('活動') },
      { key: 'item', label: i18n.pick('失物') },
      { key: 'giveaway', label: i18n.pick('轉贈') },
      // 館藏與場地（W-92）：library:read／resource:read 連訪客都有，所以不必看角色
      { key: 'book', label: i18n.pick('館藏') },
      { key: 'resource', label: i18n.pick('場地') },
      { key: 'menu', label: i18n.pick('菜單') },
    ];
    if (canHomework) {
      list.push({ key: 'homework', label: i18n.pick('功課') });
      // W-105：我的假單／我的報修 —— 與功課同一組身分（學生以上、家長沒有）
      list.push({ key: 'leave', label: i18n.pick('假單') });
      list.push({ key: 'repair', label: i18n.pick('報修') });
      // W-111：我的借閱／我的借用 —— 同一組身分（library:borrow／resource:book 都是學生以上）
      list.push({ key: 'loan', label: i18n.pick('借閱') });
      list.push({ key: 'booking', label: i18n.pick('借用') });
    }
    list.push({ key: 'proposal', label: i18n.pick('提案') });
    return list;
  },

  /**
   * 切換類型：**重跑一次查詢**而不是在前端過濾已抓回來的結果 ——
   * 每一類的「看得到」規則在後端，前端過濾等於把規則抄第二份；
   * 而且某些類原本就被 limit 截斷，前端過濾會讓「只看失物」永遠比實際少。
   */
  pickType(e) {
    const key = e.currentTarget.dataset.key;
    if (!key || key === this.data.typeFilter) return;
    this.setData({ typeFilter: key }, () => {
      const kw = (this.data.keyword || '').trim();
      if (kw) this.run(kw);
    });
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
      const res = await data.search(word, this.data.typeFilter === 'all' ? null : { types: this.data.typeFilter });
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
    if (!ROUTE[type]) return;
    const needsId = NEEDS_ID[type] !== false;
    if (needsId && !id) return;
    wx.navigateTo({ url: needsId ? ROUTE[type] + id : ROUTE[type] });
  },

  onRowTouchStart(e) {
    this.setData({ pressedId: e.currentTarget.dataset.id || '' });
  },

  onRowTouchEnd() {
    this.setData({ pressedId: '' });
  },
});
