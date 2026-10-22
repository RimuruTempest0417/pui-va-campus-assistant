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
  claimItem(id) {
    return http.post('/items/' + id + '/claims', {});
  },
  listEvents(query) {
    return http.get('/events', query);
  },
  signup(eventId) {
    return http.post('/events/' + eventId + '/signup', {});
  },
  weekMenu(query) {
    return http.get('/menu', query);
  },
  rateDish(dishId, score, liked) {
    return http.post('/dishes/' + dishId + '/ratings', { score: score, liked: !!liked });
  },
  listNotices(query) {
    return http.get('/notices', query);
  },
};
