// 示範模式：資料存在本機 storage，不需要後端、不需要網路。
// 交付給老師時就是靠這一層，四個模組仍能完整操作。
const config = require('../config/config');

const KEY = config.STORAGE_KEYS.demo;

function seed() {
  const now = Date.now();
  const h = 3600 * 1000;
  return {
    user: { id: 'demo-user', nickname: '示範學生', role: 'STUDENT', grade: '高二', className: '仁' },
    items: [
      { id: 'i1', type: 'LOST', title: '藍色水壺', place: '圖書館三樓', status: 'OPEN', categoryName: '日用品', happenedAt: now - 2 * h, description: '瓶身有貼紙', images: [], author: { nickname: '陳同學' } },
      { id: 'i2', type: 'FOUND', title: '學生證（已遮姓名）', place: '二號操場', status: 'OPEN', categoryName: '卡證', happenedAt: now - 5 * h, description: '在跑道邊撿到', images: [], author: { nickname: '李同學' } },
      { id: 'i3', type: 'LOST', title: '黑色耳機盒', place: '禮堂', status: 'CLAIMED', categoryName: '電子', happenedAt: now - 26 * h, description: 'AirPods 盒子', images: [], author: { nickname: '黃同學' } },
      { id: 'i4', type: 'FOUND', title: '數學課本（初二）', place: '二樓走廊', status: 'CLOSED', categoryName: '書本', happenedAt: now - 50 * h, description: '封面有名字', images: [], author: { nickname: '周同學' } },
    ],
    events: [
      { id: 'e1', title: '校運會報名', location: '操場', startAt: now + 24 * h, capacity: 40, signedCount: 37, status: 'PUBLISHED' },
      { id: 'e2', title: '科學社 · 水質檢測工作坊', location: '實驗室 B', startAt: now + 48 * h, capacity: 20, signedCount: 20, status: 'PUBLISHED' },
      { id: 'e3', title: '英文歌唱比賽', location: '禮堂', startAt: now + 72 * h, capacity: 0, signedCount: 12, status: 'PUBLISHED' },
    ],
    signups: [],
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
  if (!data || !data.items) {
    data = seed();
    wx.setStorageSync(KEY, data);
  }
  return data;
}
function save(data) {
  wx.setStorageSync(KEY, data);
  return data;
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
    if (q.q) items = items.filter((i) => (i.title + i.place + (i.description || '')).indexOf(q.q) !== -1);
    return Promise.resolve({ items: items, total: items.length, page: 1, pageSize: 20, hasMore: false });
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
    data.items.unshift(item);
    save(data);
    return Promise.resolve(item);
  },
  claimItem(id) {
    const data = db();
    const item = data.items.filter((i) => i.id === id)[0];
    if (!item) return Promise.reject({ code: 'NOT_FOUND' });
    if (item.status === 'CLAIMED') return Promise.reject({ code: 'ALREADY_CLAIMED' });
    item.status = 'CLAIMED';
    save(data);
    return Promise.resolve(item);
  },

  // ── 活動 ──
  listEvents() {
    return Promise.resolve({ items: db().events });
  },
  signup(eventId) {
    const data = db();
    const ev = data.events.filter((e) => e.id === eventId)[0];
    if (!ev) return Promise.reject({ code: 'NOT_FOUND' });
    if (data.signups.some((s) => s.eventId === eventId)) return Promise.reject({ code: 'ALREADY_SIGNED_UP' });
    const full = ev.capacity > 0 && ev.signedCount >= ev.capacity;
    const rec = {
      id: 's' + Date.now(),
      eventId: eventId,
      status: full ? 'WAITLIST' : 'CONFIRMED',
      waitlistPos: full ? data.signups.filter((s) => s.status === 'WAITLIST').length + 1 : null,
    };
    if (!full) ev.signedCount += 1;
    data.signups.push(rec);
    save(data);
    return full ? Promise.reject({ code: 'EVENT_FULL', data: rec }) : Promise.resolve(rec);
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
