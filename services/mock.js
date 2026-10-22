// 示範模式：資料存在本機 storage，不需要後端、不需要網路。
// 交付給老師時就是靠這一層，四個模組仍能完整操作。
const config = require('../config/config');

const KEY = config.STORAGE_KEYS.demo;

const SEED_VERSION = 3;

function seed() {
  const now = Date.now();
  const h = 3600 * 1000;
  return {
    seedVersion: SEED_VERSION,
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
    menu: [
      { date: '2026-10-20', lunch: [{ id: 'd1', name: '葡式焗雞飯', avgScore: 4.6, ratingCount: 32, liked: 18 }], snack: [{ id: 'd2', name: '菠蘿包', price: 8 }] },
      { date: '2026-10-21', lunch: [{ id: 'd3', name: '豉汁排骨飯', avgScore: 4.2, ratingCount: 25, liked: 11 }], snack: [{ id: 'd4', name: '魚蛋', price: 10 }] },
      { date: '2026-10-22', lunch: [{ id: 'd5', name: '咖喱牛腩飯', avgScore: 4.8, ratingCount: 41, liked: 30 }], snack: [{ id: 'd6', name: '奶茶', price: 12 }] },
      { date: '2026-10-23', lunch: [{ id: 'd7', name: '番茄蛋炒飯', avgScore: 3.9, ratingCount: 12, liked: 5 }], snack: [{ id: 'd8', name: '蛋撻', price: 9 }] },
      { date: '2026-10-24', lunch: [{ id: 'd9', name: '海南雞飯', avgScore: 4.7, ratingCount: 20, liked: 15 }], snack: [] },
    ],
    notices: [
      { id: 'n1', title: '颱風期間停課安排', kind: 'URGENT', isPinned: true, publishedAt: now - 3 * h, content: '八號風球生效時停課，詳見學校公告。' },
      { id: 'n2', title: '期中考試時間表', kind: 'CALENDAR', isPinned: true, publishedAt: now - 30 * h, content: '11 月 3 日至 7 日。' },
      { id: 'n3', title: '圖書館新增自習區', kind: 'NORMAL', isPinned: false, publishedAt: now - 60 * h, content: '三樓新增 40 個座位。' },
    ],
    ratings: {},
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

function mineFor(data, eventId) {
  return data.signups.filter((x) => x.eventId === eventId && x.userId === data.user.id)[0] || null;
}

function waitlistCount(data, eventId) {
  return data.signups.filter((x) => x.eventId === eventId && x.status === 'WAITLIST').length;
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
    const data = db();
    const e = data.events.filter((x) => x.id === id)[0];
    if (!e) return Promise.reject({ code: 'NOT_FOUND' });

    const me = mineFor(data, id);
    if (me) return Promise.reject({ code: 'ALREADY_SIGNED_UP' });

    const full = e.capacity > 0 && e.signedCount >= e.capacity;
    const rec = {
      id: 's' + Date.now() + Math.random().toString(16).slice(2, 6),
      eventId: id,
      userId: data.user.id,
      status: full ? 'WAITLIST' : 'CONFIRMED',
      waitlistPos: full ? waitlistCount(data, id) + 1 : null,
      createdAt: Date.now(),
    };
    if (!full) e.signedCount += 1;
    data.signups.push(rec);
    save(data);

    // 滿額不是「錯誤」而是「進候補」—— 用結果表達，不讓呼叫端把它當失敗吞掉
    return Promise.resolve(Object.assign({}, rec));
  },

  cancelSignup(id) {
    const data = db();
    const rec = mineFor(data, id);
    if (!rec) return Promise.reject({ code: 'NOT_FOUND' });

    const e = data.events.filter((x) => x.id === id)[0];
    data.signups = data.signups.filter((x) => x.id !== rec.id);

    let promoted = null;
    if (rec.status === 'CONFIRMED' && e) {
      e.signedCount = Math.max(0, e.signedCount - 1);
      // 有人取消 → 最早排隊的人補位
      const waiting = data.signups
        .filter((x) => x.eventId === id && x.status === 'WAITLIST')
        .sort((a, b) => a.createdAt - b.createdAt);
      if (waiting.length) {
        promoted = waiting[0];
        promoted.status = 'CONFIRMED';
        promoted.waitlistPos = null;
        e.signedCount += 1;
      }
      // 重排候補序號
      data.signups
        .filter((x) => x.eventId === id && x.status === 'WAITLIST')
        .sort((a, b) => a.createdAt - b.createdAt)
        .forEach((x, i) => { x.waitlistPos = i + 1; });
    }
    save(data);
    return Promise.resolve({ cancelled: true, promoted: promoted ? promoted.id : null });
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
  weekMenu() {
    return Promise.resolve({ days: db().menu });
  },
  rateDish(dishId, score) {
    const data = db();
    const prev = data.ratings[dishId] || { score: score, count: 0 };
    data.ratings[dishId] = { score: score, count: prev.count + 1 };
    save(data);
    return Promise.resolve({ dishId: dishId, myScore: score });
  },

  // ── 公告 ──
  listNotices() {
    const items = db().notices.slice().sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
    return Promise.resolve({ items: items });
  },
};
