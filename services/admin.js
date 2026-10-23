// 教職員後台 API（只走真 API；示範模式沒有後台）
const http = require('../utils/request');

module.exports = {
  login(account, password) {
    return http.post('/admin/login', { account: account, password: password }, { auth: false });
  },
  stats() {
    return http.get('/admin/stats');
  },
  items(status) {
    return http.get('/admin/items', status ? { status: status } : {});
  },
  moderateItem(id, action, reason) {
    return http.patch('/admin/items/' + id, { action: action, reason: reason });
  },
  claims(status) {
    return http.get('/admin/claims', { status: status || 'PENDING' });
  },
  reviewClaim(id, approve) {
    return http.patch('/claims/' + id, { action: approve ? 'APPROVE' : 'REJECT' });
  },
  createNotice(payload) {
    return http.post('/admin/notices', payload);
  },
  events() {
    return http.get('/admin/events');
  },
  signups(eventId) {
    return http.get('/admin/events/' + eventId + '/signups');
  },
  createDish(name, mealType) {
    return http.post('/admin/dishes/ensure', { name: name, mealType: mealType || 'LUNCH' });
  },
  scheduleMenu(date, mealType, dishIds) {
    return http.post('/admin/menu', { date: date, mealType: mealType, dishIds: dishIds });
  },
  dishes() {
    return http.get('/admin/dishes');
  },
};
