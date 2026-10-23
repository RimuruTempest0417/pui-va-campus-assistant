// 真實後端（契約見 docs/openapi.yaml）
const http = require('../utils/request');

module.exports = {
  login(code) {
    return http.post('/auth/login', { code: code }, { auth: false });
  },
  me() {
    return http.get('/auth/me');
  },
  listItems(query) {
    return http.get('/items', query);
  },
  createItem(payload) {
    return http.post('/items', payload);
  },
  getItem(id) {
    return http.get('/items/' + id);
  },
  myItems() {
    return http.get('/items/mine');
  },
  updateItemStatus(id, status) {
    return http.patch('/items/' + id, { status: status });
  },
  categories() {
    return http.get('/categories');
  },
  matches(id) {
    return http.get('/items/' + id + '/matches');
  },
  claimItem(id) {
    return http.post('/items/' + id + '/claims', {});
  },
  listEvents(query) {
    return http.get('/events', query);
  },
  getEvent(id) {
    return http.get('/events/' + id);
  },
  signupEvent(eventId) {
    return http.post('/events/' + eventId + '/signup', {});
  },
  cancelSignup(eventId) {
    return http.del('/events/' + eventId + '/signup');
  },
  mySignups() {
    return http.get('/events/mine');
  },
  switchDemoUser() {
    return Promise.reject({ code: 'FORBIDDEN', message: '示範模式專用' });
  },
  weekMenu(query) {
    const q = query || {};
    return http.get('/menu/week', { weekOffset: q.offset || 0 });
  },
  getDish(id) {
    return http.get('/dishes/' + id);
  },
  rateDish(dishId, score, liked) {
    return http.post('/dishes/' + dishId + '/ratings', { score: score, liked: !!liked });
  },
  topDishes(query) {
    return http.get('/dishes/top', query);
  },
  subscribe(templateIds, scene) {
    return http.post('/subscriptions', { templateIds: templateIds, scene: scene });
  },
  mySubscriptions() {
    return http.get('/subscriptions');
  },
  listNotices(query) {
    return http.get('/notices', query);
  },
  getNotice(id) {
    return http.get('/notices/' + id);
  },
  markAllNoticesRead() {
    return http.post('/notices/read-all', {});
  },
  /** 校曆：公告（含校曆類）＋ 活動，兩支既有端點組合，不新增 API */
  calendar() {
    return Promise.all([
      http.get('/notices', { pageSize: 50 }).catch(() => ({ items: [] })),
      http.get('/events', { scope: 'all', pageSize: 50 }).catch(() => ({ items: [] })),
    ]).then(function (res) {
      return { notices: (res[0] && res[0].items) || [], events: (res[1] && res[1].items) || [] };
    });
  },
};
