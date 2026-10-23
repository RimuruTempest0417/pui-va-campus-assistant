// 示範模式：資料存在本機 storage，不需要後端、不需要網路。
// 交付給老師時就是靠這一層，四個模組仍能完整操作。
const config = require('../config/config');

const KEY = config.STORAGE_KEYS.demo;

const SEED_VERSION = 7;

const weekUtil = require('../utils/week');

const DISH_LIBRARY = [
  { id: 'd1', name: '葡式焗雞飯', price: null, tags: ['招牌'], desc: '薯仔鋪底，雞肉焗到金黃。', base: { sum: 148, count: 32, likes: 18 } },
  { id: 'd2', name: '豉汁排骨飯', price: null, tags: ['經典'], desc: '排骨先炸後蒸，豉汁偏鹹香。', base: { sum: 105, count: 25, likes: 11 } },
  { id: 'd3', name: '咖喱牛腩飯', price: null, tags: ['辣', '人氣'], desc: '咖喱不辣到嗆，牛腩燉得軟。', base: { sum: 197, count: 41, likes: 30 } },
  { id: 'd4', name: '番茄蛋炒飯', price: null, tags: ['素'], desc: '偏清淡，適合不想吃太油的日子。', base: { sum: 47, count: 12, likes: 5 } },
  { id: 'd5', name: '海南雞飯', price: null, tags: ['人氣'], desc: '附薑蓉與辣椒醬。', base: { sum: 94, count: 20, likes: 15 } },
  { id: 'd6', name: '菠蘿包', price: 8, tags: ['小賣部'], desc: '出爐時間 10:30 與 15:00。', base: { sum: 62, count: 14, likes: 9 } },
  { id: 'd7', name: '魚蛋（串）', price: 10, tags: ['小賣部'], desc: '咖喱汁另加。', base: { sum: 55, count: 12, likes: 7 } },
  { id: 'd8', name: '奶茶', price: 12, tags: ['小賣部'], desc: '凍飲 +2。', base: { sum: 88, count: 19, likes: 14 } },
  { id: 'd9', name: '蛋撻', price: 9, tags: ['小賣部'], desc: '每日限量 60 個。', base: { sum: 70, count: 15, likes: 11 } },
];

/** 依週次生成菜單：每天 1–2 道午餐 + 1 道小賣部 */
function buildMenus() {
  const out = [];
  for (let offset = -1; offset <= 1; offset += 1) {
    const dates = weekUtil.weekDates(offset);
    dates.forEach((date, i) => {
      const lunchA = DISH_LIBRARY[(i + offset + 9) % 5];
      const lunchB = DISH_LIBRARY[(i + offset + 10) % 5];
      const snack = DISH_LIBRARY[5 + ((i + offset + 9) % 4)];
      out.push({
        date: date,
        weekOffset: offset,
        lunch: [lunchA.id, lunchB.id].filter((v, idx, arr) => arr.indexOf(v) === idx).map((id) => dishById(id)),
        snack: [dishById(snack.id)],
      });
    });
  }
  return out;
}

function dishById(id) {
  const d = DISH_LIBRARY.filter((x) => x.id === id)[0];
  return { id: d.id, name: d.name, price: d.price, tags: d.tags, description: d.desc };
}

function seedScores() {
  const out = {};
  DISH_LIBRARY.forEach((d) => {
    out[d.id] = Object.assign({}, d.base);
  });
  return out;
}

function seed() {
  const now = Date.now();
  const h = 3600 * 1000;
  return {
    seedVersion: SEED_VERSION,
    dishScores: seedScores(),
    myRatings: {},
    user: { id: 'demo-user', nickname: '示範學生', role: 'STUDENT', grade: '高二', className: '仁' },
    categories: [
      { key: 'card', name: '卡證', icon: '🪪' },
      { key: 'phone', name: '電子產品', icon: '📱' },
      { key: 'book', name: '書本／文具', icon: '📚' },
      { key: 'clothes', name: '衣物', icon: '🧥' },
      { key: 'daily', name: '日用品', icon: '🧴' },
      { key: 'other', name: '其他', icon: '📦' },
    ],
    items: [
      { id: 'i1', type: 'LOST', title: '藍色水壺', place: '圖書館三樓', status: 'OPEN', categoryKey: 'daily', categoryName: '日用品', happenedAt: now - 2 * h, description: '瓶身有貼紙，瓶蓋是白色的。', images: [], author: { nickname: '陳同學' }, contactType: 'inApp', viewCount: 12 },
      { id: 'i2', type: 'FOUND', title: '學生證（已遮姓名）', place: '二號操場', status: 'OPEN', categoryKey: 'card', categoryName: '卡證', happenedAt: now - 5 * h, description: '在跑道邊撿到，已交到教務處。', images: [], author: { nickname: '李同學' }, contactType: 'inApp', viewCount: 31 },
      { id: 'i3', type: 'LOST', title: '黑色耳機盒', place: '禮堂', status: 'CLAIMED', categoryKey: 'phone', categoryName: '電子產品', happenedAt: now - 26 * h, description: 'AirPods 盒子，上面有卡通貼紙。', images: [], author: { nickname: '黃同學' }, contactType: 'inApp', viewCount: 44 },
      { id: 'i4', type: 'FOUND', title: '數學課本（初二）', place: '二樓走廊', status: 'CLOSED', categoryKey: 'book', categoryName: '書本／文具', happenedAt: now - 50 * h, description: '封面有名字，已歸還。', images: [], author: { nickname: '周同學' }, contactType: 'inApp', viewCount: 9 },
      { id: 'i5', type: 'FOUND', title: '灰色外套', place: '體育館', status: 'OPEN', categoryKey: 'clothes', categoryName: '衣物', happenedAt: now - 8 * h, description: '尺寸 M，左袖有校徽。', images: [], author: { nickname: '吳同學' }, contactType: 'inApp', viewCount: 17 },
      { id: 'i7', type: 'FOUND', title: '藍色保溫瓶', place: '圖書館三樓', status: 'OPEN', categoryKey: 'daily', categoryName: '日用品', happenedAt: now - 3 * h, description: '瓶身有貼紙，瓶蓋是白色的。', images: [], author: { nickname: '何同學' }, contactType: 'inApp', viewCount: 6 },
      { id: 'i6', type: 'LOST', title: '計算機（Casio fx-991）', place: '三樓自習室', status: 'OPEN', categoryKey: 'phone', categoryName: '電子產品', happenedAt: now - 12 * h, description: '背面貼了姓名貼。', images: [], author: { nickname: '鄭同學' }, contactType: 'inApp', viewCount: 22 },
    ],
    events: [
      { id: 'e1', title: '校運會報名', club: '體育組', location: '二號操場', startAt: now + 24 * h, endAt: now + 27 * h,
        capacity: 40, signedCount: 37, status: 'PUBLISHED',
        description: '個人項目與接力，報名後請於賽前到體育組領取號碼布。' },
      { id: 'e2', title: '科學社 · 水質檢測工作坊', club: '科學社', location: '實驗室 B', startAt: now + 48 * h, endAt: now + 51 * h,
        capacity: 20, signedCount: 20, status: 'PUBLISHED',
        description: '帶一支學校附近收集的水樣，現場測 pH 與濁度。' },
      { id: 'e3', title: '英文歌唱比賽', club: '英文科', location: '禮堂', startAt: now + 72 * h, endAt: now + 75 * h,
        capacity: 0, signedCount: 12, status: 'PUBLISHED',
        description: '不限名額，歡迎個人或組隊參加。' },
      { id: 'e4', title: '班際籃球賽（示範只有 1 個名額）', club: '體育組', location: '體育館', startAt: now + 96 * h, endAt: now + 98 * h,
        capacity: 1, signedCount: 0, status: 'PUBLISHED',
        description: '用來驗證「第二個人報名會自動進候補」。' },
      { id: 'e5', title: '畢業旅行說明會', club: '訓導處', location: '禮堂', startAt: now + 240 * h, endAt: now + 242 * h,
        capacity: 200, signedCount: 85, status: 'PUBLISHED',
        description: '家長與同學都可參加，會後可現場提問。' },
      { id: 'e6', title: '上學期成果回顧展', club: '視藝科', location: '一樓展覽廳', startAt: now - 72 * h, endAt: now - 60 * h,
        capacity: 0, signedCount: 64, status: 'FINISHED',
        description: '已結束。' },
    ],
    signups: [], // { id, eventId, userId, status: CONFIRMED|WAITLIST, waitlistPos, createdAt }
    // 家長示範資料：後端是 parent_links，這裡只放兩筆「已綁定的子女」，
    // 用來驗證「切換兩位子女 → 各自的報名互不干擾」。
    parent: {
      children: [
        { linkId: 'pl1', relation: 'mother', relationLabel: '母親', studentId: 'demo-child-1', nickname: '培華同學甲', grade: '初二', className: '忠' },
        { linkId: 'pl2', relation: 'father', relationLabel: '父親', studentId: 'demo-child-2', nickname: '培華同學乙', grade: '初三', className: '仁' },
      ],
    },
    // 菜單以「本週」為基準生成（offset -1 上週、0 本週、1 下週），永遠有資料可看
    menu: buildMenus(),
    notices: [
      { id: 'n1', title: '颱風期間停課安排', kind: 'URGENT', isPinned: true,
        publishedAt: now - 3 * h, expiresAt: now + 48 * h,
        content: '八號風球生效期間停課。停課期間所有課堂與活動取消。住宿生留在宿舍，由舍監統一照顧。復課安排將於風球除下後兩小時內公布。' },
      { id: 'n2', title: '期中考試時間表', kind: 'CALENDAR', isPinned: true,
        publishedAt: now - 30 * h, expiresAt: null,
        content: '11 月 3 日至 7 日為期中考試週。各科考試時間請見派發的時間表。考試期間圖書館延長開放至 19:00。' },
      { id: 'n3', title: '圖書館新增自習區', kind: 'NORMAL', isPinned: false,
        publishedAt: now - 60 * h, expiresAt: null,
        content: '圖書館三樓新增 40 個自習座位，附電源插座。開放時間與圖書館相同。' },
      { id: 'n4', title: '本週五校服日提醒', kind: 'NORMAL', isPinned: false,
        publishedAt: now - 5 * h, expiresAt: null,
        content: '本週五為校服日，請穿著整齊校服。' },
      { id: 'n5', title: '上學期繳費通知（已過期）', kind: 'NORMAL', isPinned: false,
        publishedAt: now - 30 * 24 * h, expiresAt: now - 10 * 24 * h,
        content: '此公告已於十日前過期，列表不應再顯示。' },
    ],
    noticeReads: [], // 已讀的公告 id
  };
}

function db() {
  let data = wx.getStorageSync(KEY);
  // 版本不符就重生：改過 seed 之後，舊裝置上才不會一直看到舊的示範資料
  if (!data || !data.items || data.seedVersion !== SEED_VERSION) {
    data = seed();
    wx.setStorageSync(KEY, data);
  }
  return data;
}
function save(data) {
  wx.setStorageSync(KEY, data);
  return data;
}

/** 雙字母組相似度（0–1），與後端 pg_trgm 的概念一致但更輕量 */
function dice(a, b) {
  const s1 = String(a || '').toLowerCase().replace(/\s+/g, '');
  const s2 = String(b || '').toLowerCase().replace(/\s+/g, '');
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;
  const grams = (str) => {
    const out = [];
    for (let i = 0; i < str.length - 1; i += 1) out.push(str.slice(i, i + 2));
    return out;
  };
  const g1 = grams(s1);
  const g2 = grams(s2);
  if (!g1.length || !g2.length) return s1 === s2 ? 1 : 0;
  const pool = new Map();
  g2.forEach((g) => pool.set(g, (pool.get(g) || 0) + 1));
  let hit = 0;
  g1.forEach((g) => {
    const n = pool.get(g) || 0;
    if (n > 0) {
      hit += 1;
      pool.set(g, n - 1);
    }
  });
  return (2 * hit) / (g1.length + g2.length);
}

function decorateDish(data, dish) {
  const agg = (data.dishScores || {})[dish.id] || { sum: 0, count: 0, likes: 0 };
  const mine = (data.myRatings || {})[dish.id] || null;
  return Object.assign({}, dish, {
    avgScore: agg.count ? Math.round((agg.sum / agg.count) * 10) / 10 : 0,
    ratingCount: agg.count,
    likedCount: agg.likes,
    myScore: mine ? mine.score : 0,
    myLiked: mine ? !!mine.liked : false,
  });
}

function mineFor(data, eventId) {
  return data.signups.filter((x) => x.eventId === eventId && x.userId === data.user.id)[0] || null;
}

function waitlistCount(data, eventId) {
  return data.signups.filter((x) => x.eventId === eventId && x.status === 'WAITLIST').length;
}

/** 這位 studentId 是不是示範家長的子女（後端對應 parent_links 的一次查詢） */
function childOf(data, studentId) {
  const list = (data.parent && data.parent.children) || [];
  return list.filter((x) => x.studentId === studentId)[0] || null;
}

/**
 * 報名核心：userId 為 null 代表「自己」，否則代表「代這位子女」。
 * 自己報名與家長代報名共用同一份名額判斷，示範層才不會出現兩套結果。
 */
function signupCore(id, userId) {
  const data = db();
  const who = userId || data.user.id;
  const e = data.events.filter((x) => x.id === id)[0];
  if (!e) return Promise.reject({ code: 'NOT_FOUND' });
  if (e.status !== 'PUBLISHED') return Promise.reject({ code: 'VALIDATION_FAILED', message: '這個活動目前沒有開放報名' });

  const me = data.signups.filter((x) => x.eventId === id && x.userId === who && x.status !== 'CANCELLED')[0];
  if (me) return Promise.reject({ code: 'ALREADY_SIGNED_UP' });

  const full = e.capacity > 0 && e.signedCount >= e.capacity;
  const rec = {
    id: 's' + Date.now() + Math.random().toString(16).slice(2, 6),
    eventId: id,
    userId: who,
    status: full ? 'WAITLIST' : 'CONFIRMED',
    waitlistPos: full ? waitlistCount(data, id) + 1 : null,
    createdAt: Date.now(),
  };
  if (!full) e.signedCount += 1;
  data.signups.push(rec);
  save(data);

  // 滿額不是「錯誤」而是「進候補」—— 用結果表達，不讓呼叫端把它當失敗吞掉
  return Promise.resolve(Object.assign({}, rec));
}

/** 取消核心：一樣用 userId 區分自己／代子女；有人補位時總數不變 */
function cancelCore(id, userId) {
  const data = db();
  const who = userId || data.user.id;
  const rec = data.signups.filter((x) => x.eventId === id && x.userId === who && x.status !== 'CANCELLED')[0];
  if (!rec) return Promise.reject({ code: 'VALIDATION_FAILED', message: '你沒有報名這個活動' });

  const wasConfirmed = rec.status === 'CONFIRMED';
  const e = data.events.filter((x) => x.id === id)[0];
  rec.status = 'CANCELLED';
  rec.waitlistPos = null;

  let promoted = null;
  if (wasConfirmed && e) {
    e.signedCount = Math.max(0, e.signedCount - 1);
    // 有人取消 → 最早排隊的人補位（補位後總數不變）
    const waiting = data.signups
      .filter((x) => x.eventId === id && x.status === 'WAITLIST')
      .sort((a, b) => a.createdAt - b.createdAt);
    if (waiting.length) {
      promoted = waiting[0];
      promoted.status = 'CONFIRMED';
      promoted.waitlistPos = null;
      e.signedCount += 1;
    }
  }
  // 重排候補序號，不留空號
  data.signups
    .filter((x) => x.eventId === id && x.status === 'WAITLIST')
    .sort((a, b) => a.createdAt - b.createdAt)
    .forEach((x, i) => { x.waitlistPos = i + 1; });
  save(data);
  return Promise.resolve({ cancelled: true, promoted: promoted ? promoted.id : null });
}

module.exports = {
  reset() {
    const fresh = seed();
    return save(fresh);
  },

  // ── 認證 ──
  login() {
    const data = db();
    return Promise.resolve({ token: 'demo-token', user: data.user });
  },
  me() {
    return Promise.resolve(db().user);
  },

  // ── 失物 ──
  listItems(query) {
    const q = query || {};
    let items = db().items.slice();
    if (q.type) items = items.filter((i) => i.type === q.type);
    if (q.status) items = items.filter((i) => i.status === q.status);
    if (q.categoryKey) items = items.filter((i) => i.categoryKey === q.categoryKey);
    if (q.q) {
      const kw = String(q.q);
      items = items.filter((i) => (i.title + i.place + (i.description || '')).indexOf(kw) !== -1);
    }
    items.sort((a, b) => b.happenedAt - a.happenedAt);

    const page = Number(q.page) || 1;
    const pageSize = Number(q.pageSize) || 10;
    const start = (page - 1) * pageSize;
    const slice = items.slice(start, start + pageSize);
    return Promise.resolve({
      items: slice,
      total: items.length,
      page: page,
      pageSize: pageSize,
      hasMore: start + slice.length < items.length,
    });
  },

  getItem(id) {
    const item = db().items.filter((i) => i.id === id)[0];
    if (!item) return Promise.reject({ code: 'NOT_FOUND' });
    item.viewCount = (item.viewCount || 0) + 1;
    save(db());
    return Promise.resolve(item);
  },

  myItems() {
    const data = db();
    const mine = data.items.filter((i) => (i.author && i.author.nickname === data.user.nickname) || i.isMine);
    return Promise.resolve({ items: mine });
  },

  updateItemStatus(id, status) {
    const data = db();
    const item = data.items.filter((i) => i.id === id)[0];
    if (!item) return Promise.reject({ code: 'NOT_FOUND' });
    const allowed = { OPEN: ['CLAIMED', 'CLOSED'], CLAIMED: ['CLOSED'], CLOSED: [] };
    if ((allowed[item.status] || []).indexOf(status) === -1) {
      return Promise.reject({ code: 'VALIDATION_FAILED', message: '狀態不可從 ' + item.status + ' 變成 ' + status });
    }
    item.status = status;
    save(data);
    return Promise.resolve(Object.assign({}, item));
  },

  categories() {
    return Promise.resolve({ items: db().categories });
  },
  createItem(payload) {
    const data = db();
    const item = Object.assign(
      {
        id: 'i' + Date.now(),
        status: 'OPEN',
        happenedAt: Date.now(),
        images: [],
        author: { nickname: data.user.nickname },
      },
      payload
    );
    item.place = payload.place;
    item.isMine = true;
    item.viewCount = 0;
    if (payload.categoryKey) {
      const c = (data.categories || []).filter((x) => x.key === payload.categoryKey)[0];
      item.categoryName = c ? c.name : '';
    }
    data.items.unshift(item);
    save(data);
    return Promise.resolve(item);
  },
  claimItem(id) {
    const data = db();
    const item = data.items.filter((i) => i.id === id)[0];
    if (!item) return Promise.reject({ code: 'NOT_FOUND' });
    if (item.status !== 'OPEN') return Promise.reject({ code: 'ALREADY_CLAIMED' });
    item.status = 'CLAIMED';
    save(data);
    return Promise.resolve(Object.assign({}, item));
  },

  // ── 活動 ──
  listEvents(query) {
    const q = query || {};
    const data = db();
    const now = Date.now();
    let items = data.events.slice();

    if (q.scope === 'upcoming') items = items.filter((e) => e.status === 'PUBLISHED' && e.startAt >= now);
    if (q.scope === 'past') items = items.filter((e) => e.status === 'FINISHED' || e.startAt < now);

    items.sort((a, b) => a.startAt - b.startAt);
    return Promise.resolve({
      items: items.map((e) => Object.assign({}, e, { mySignup: mineFor(data, e.id) })),
    });
  },

  getEvent(id) {
    const data = db();
    const e = data.events.filter((x) => x.id === id)[0];
    if (!e) return Promise.reject({ code: 'NOT_FOUND' });
    return Promise.resolve(Object.assign({}, e, { mySignup: mineFor(data, id) }));
  },

  signupEvent(id) {
    return signupCore(id, null);
  },

  cancelSignup(id) {
    return cancelCore(id, null);
  },

  // ── 家長（示範層）──
  // 與後端同一原則：先確認「這是我的孩子」，再走同一支報名核心（名額只算一次）。
  parentChildren() {
    const data = db();
    return Promise.resolve({ items: (data.parent && data.parent.children) || [] });
  },

  parentChild(studentId) {
    const data = db();
    const c = childOf(data, studentId);
    if (!c) return Promise.reject({ code: 'FORBIDDEN', message: '沒有綁定這位學生' });

    const signups = data.signups
      .filter((x) => x.userId === studentId && x.status !== 'CANCELLED')
      .map((rec) => {
        const e = data.events.filter((x) => x.id === rec.eventId)[0] || {};
        return {
          id: rec.id,
          status: rec.status,
          waitlistPos: rec.waitlistPos,
          event: { id: rec.eventId, title: e.title, startAt: e.startAt, location: e.location },
        };
      });

    return Promise.resolve({
      student: { id: studentId, nickname: c.nickname, grade: c.grade, className: c.className },
      relation: c.relation,
      relationLabel: c.relationLabel,
      signups: signups,
      claimCount: data.items.filter((i) => i.isMine).length,
      unreadNotices: Math.max(0, data.notices.length - (data.noticeReads || []).length),
    });
  },

  parentSignupEvent(studentId, eventId) {
    const data = db();
    if (!childOf(data, studentId)) {
      return Promise.reject({ code: 'FORBIDDEN', message: '沒有綁定這位學生' });
    }
    return signupCore(eventId, studentId);
  },

  parentCancelSignup(studentId, eventId) {
    const data = db();
    if (!childOf(data, studentId)) {
      return Promise.reject({ code: 'FORBIDDEN', message: '沒有綁定這位學生' });
    }
    return cancelCore(eventId, studentId);
  },

  mySignups() {
    const data = db();
    const mine = data.signups.filter((x) => x.userId === data.user.id);
    const items = mine.map((rec) => {
      const e = data.events.filter((x) => x.id === rec.eventId)[0] || {};
      return {
        id: rec.id,
        eventId: rec.eventId,
        status: rec.status,
        waitlistPos: rec.waitlistPos,
        title: e.title,
        location: e.location,
        startAt: e.startAt,
        capacity: e.capacity,
        signedCount: e.signedCount,
      };
    });
    return Promise.resolve({ items: items });
  },

  // 示範模式專用：切換身分（用來驗證「第二個人報名 → 候補」）
  switchDemoUser(nickname, id) {
    const data = db();
    data.user = Object.assign({}, data.user, { nickname: nickname, id: id || 'demo-' + nickname });
    save(data);
    return Promise.resolve(data.user);
  },

  // ── 菜單 ──
  weekMenu(query) {
    const q = query || {};
    const offset = Number(q.offset) || 0;
    const data = db();
    const dates = weekUtil.weekDates(offset);
    const days = dates.map((date) => {
      const entry = (data.menu || []).filter((x) => x.date === date)[0];
      const lunch = entry ? entry.lunch.map((d) => decorateDish(data, d)) : [];
      const snack = entry ? entry.snack.map((d) => decorateDish(data, d)) : [];
      return { date: date, lunch: lunch, snack: snack };
    });
    return Promise.resolve({ offset: offset, dates: dates, days: days });
  },

  getDish(id) {
    const data = db();
    const dish = DISH_LIBRARY.filter((x) => x.id === id)[0];
    if (!dish) return Promise.reject({ code: 'NOT_FOUND' });
    return Promise.resolve(decorateDish(data, dishById(id)));
  },

  rateDish(id, payload) {
    const data = db();
    const p = payload || {};
    const score = Number(p.score);
    if (!(score >= 1 && score <= 5)) {
      return Promise.reject({ code: 'VALIDATION_FAILED', message: '評分必須是 1–5 星' });
    }
    data.dishScores = data.dishScores || seedScores();
    data.myRatings = data.myRatings || {};

    const agg = data.dishScores[id] || { sum: 0, count: 0, likes: 0 };
    const prev = data.myRatings[id];

    if (prev) {
      // 一人一評：改分時先把舊分扣掉，不會重複計算
      agg.sum = agg.sum - prev.score + score;
      if (prev.liked && !p.liked) agg.likes = Math.max(0, agg.likes - 1);
      if (!prev.liked && p.liked) agg.likes += 1;
    } else {
      agg.sum += score;
      agg.count += 1;
      if (p.liked) agg.likes += 1;
    }
    data.dishScores[id] = agg;
    data.myRatings[id] = { score: score, liked: !!p.liked };
    save(data);

    return Promise.resolve(decorateDish(db(), dishById(id)));
  },

  topDishes(query) {
    const q = query || {};
    const limit = Number(q.limit) || 5;
    const data = db();
    data.dishScores = data.dishScores || seedScores();
    const rows = DISH_LIBRARY.map((d) => decorateDish(data, dishById(d.id)))
      .filter((d) => d.ratingCount > 0)
      .sort((a, b) => b.avgScore - a.avgScore || b.ratingCount - a.ratingCount)
      .slice(0, limit);
    return Promise.resolve({ items: rows });
  },

  // ── 失物智能匹配（與後端 /items/:id/matches 同一套權重，示範模式才看得出效果）──
  matches(id) {
    const db0 = db();
    const base = (db0.items || []).filter((x) => x.id === id)[0];
    if (!base) return Promise.reject({ code: 'NOT_FOUND' });

    const sim = (a, b) => dice(String(a || ''), String(b || ''));
    const rows = (db0.items || [])
      .filter((x) => x.id !== base.id && x.type !== base.type && x.status !== 'CLOSED')
      .map((x) => {
        const sameCat = !!x.categoryKey && x.categoryKey === base.categoryKey;
        const placeSim = sim(x.place, base.place);
        const textSim = Math.max(sim(x.title, base.title), sim(x.description, base.description));
        const hoursApart = Math.abs(new Date(x.happenedAt) - new Date(base.happenedAt)) / 3600000;
        const score =
          (sameCat ? 0.35 : 0) +
          (placeSim > 0.4 ? 0.25 * placeSim : 0) +
          (hoursApart < 72 ? 0.15 : 0) +
          0.25 * textSim;
        return {
          id: x.id,
          type: x.type,
          title: x.title,
          place: x.place,
          status: x.status,
          happenedAt: x.happenedAt,
          score: Math.round(score * 100) / 100,
          gate: placeSim > 0.4 || textSim > 0.3,
          reasons: [
            sameCat ? '同分類' : null,
            placeSim > 0.4 ? '地點相近' : null,
            hoursApart < 72 ? Math.round(hoursApart) + ' 小時內' : null,
            textSim > 0.3 ? '描述相似' : null,
          ].filter(Boolean),
        };
      })
      .filter((r) => r.gate && r.score >= 0.45)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((r) => {
        delete r.gate;
        return r;
      });

    return Promise.resolve({ items: rows, minScore: 0.45 });
  },

  // ── 訂閱消息（示範模式只記錄，不真的發送）──
  subscribe(templateIds, scene) {
    const data = db();
    data.subscriptions = data.subscriptions || [];
    (templateIds || []).forEach((id) => {
      if (!data.subscriptions.some((x) => x.templateId === id && x.scene === scene)) {
        data.subscriptions.push({ templateId: id, scene: scene, createdAt: Date.now() });
      }
    });
    save(data);
    return Promise.resolve({ ok: true, scene: scene, count: data.subscriptions.filter((x) => x.scene === scene).length });
  },

  mySubscriptions() {
    const rows = db().subscriptions || [];
    return Promise.resolve({ items: rows });
  },

  // ── 公告 ──
  listNotices(query) {
    const q = query || {};
    const data = db();
    const now = Date.now();
    const reads = data.noticeReads || [];

    let items = (data.notices || []).filter((n) => !n.expiresAt || n.expiresAt > now);
    if (q.kind) items = items.filter((n) => n.kind === q.kind);

    // 置頂優先，其餘依發布時間新到舊
    items.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) || b.publishedAt - a.publishedAt);
    items = items.map((n) => Object.assign({}, n, { isRead: reads.indexOf(n.id) !== -1 }));

    return Promise.resolve({ items: items, unread: items.filter((n) => !n.isRead).length });
  },

  /** 校曆：由既有示範資料組合（公告＋活動） */
  calendar() {
    const notices = (db().notices || []).filter((n) => !n.expiresAt || n.expiresAt > Date.now());
    const events = (db().events || []).filter((e) => e.status !== 'CANCELLED');
    return Promise.resolve({ notices: notices, events: events });
  },

  getNotice(id) {
    const data = db();
    const n = (data.notices || []).filter((x) => x.id === id)[0];
    if (!n) return Promise.reject({ code: 'NOT_FOUND' });

    data.noticeReads = data.noticeReads || [];
    if (data.noticeReads.indexOf(id) === -1) {
      data.noticeReads.push(id);
      save(data);
    }
    return Promise.resolve(Object.assign({}, n, { isRead: true }));
  },

  markAllNoticesRead() {
    const data = db();
    data.noticeReads = (data.notices || []).map((n) => n.id);
    save(data);
    return Promise.resolve({ ok: true });
  },

  // 示範模式專用：切換身分（用來驗證「第二個人報名 → 候補」）
  switchDemoUser(nickname, id) {
    const data = db();
    data.user = Object.assign({}, data.user, { nickname: nickname, id: id || 'demo-' + nickname });
    save(data);
    return Promise.resolve(data.user);
  },

  // ── 菜單 ──
  weekMenu(query) {
    const q = query || {};
    const offset = Number(q.offset) || 0;
    const data = db();
    const dates = weekUtil.weekDates(offset);
    const days = dates.map((date) => {
      const entry = (data.menu || []).filter((x) => x.date === date)[0];
      const lunch = entry ? entry.lunch.map((d) => decorateDish(data, d)) : [];
      const snack = entry ? entry.snack.map((d) => decorateDish(data, d)) : [];
      return { date: date, lunch: lunch, snack: snack };
    });
    return Promise.resolve({ offset: offset, dates: dates, days: days });
  },

  getDish(id) {
    const data = db();
    const dish = DISH_LIBRARY.filter((x) => x.id === id)[0];
    if (!dish) return Promise.reject({ code: 'NOT_FOUND' });
    return Promise.resolve(decorateDish(data, dishById(id)));
  },

  rateDish(id, payload) {
    const data = db();
    const p = payload || {};
    const score = Number(p.score);
    if (!(score >= 1 && score <= 5)) {
      return Promise.reject({ code: 'VALIDATION_FAILED', message: '評分必須是 1–5 星' });
    }
    data.dishScores = data.dishScores || seedScores();
    data.myRatings = data.myRatings || {};

    const agg = data.dishScores[id] || { sum: 0, count: 0, likes: 0 };
    const prev = data.myRatings[id];

    if (prev) {
      // 一人一評：改分時先把舊分扣掉，不會重複計算
      agg.sum = agg.sum - prev.score + score;
      if (prev.liked && !p.liked) agg.likes = Math.max(0, agg.likes - 1);
      if (!prev.liked && p.liked) agg.likes += 1;
    } else {
      agg.sum += score;
      agg.count += 1;
      if (p.liked) agg.likes += 1;
    }
    data.dishScores[id] = agg;
    data.myRatings[id] = { score: score, liked: !!p.liked };
    save(data);

    return Promise.resolve(decorateDish(db(), dishById(id)));
  },

  topDishes(query) {
    const q = query || {};
    const limit = Number(q.limit) || 5;
    const data = db();
    data.dishScores = data.dishScores || seedScores();
    const rows = DISH_LIBRARY.map((d) => decorateDish(data, dishById(d.id)))
      .filter((d) => d.ratingCount > 0)
      .sort((a, b) => b.avgScore - a.avgScore || b.ratingCount - a.ratingCount)
      .slice(0, limit);
    return Promise.resolve({ items: rows });
  },

};
