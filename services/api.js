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
    return http.get('/menu', query);
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
  listNotices(query) {
    return http.get('/notices', query);
  },
  getNotice(id) {
    return http.get('/notices/' + id);
  },
  markAllNoticesRead() {
    return http.post('/notices/read-all', {});
  },
};
