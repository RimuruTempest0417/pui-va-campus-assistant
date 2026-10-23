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
  eventStats(eventId) {
    return http.get('/events/' + eventId + '/stats');
  },
  batchSignups(eventId, action, ids) {
    return http.patch('/admin/events/' + eventId + '/signups/batch', { action: action, ids: ids });
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
  menuWeek(weekStart) {
    return http.get('/admin/menu', weekStart ? { weekStart: weekStart } : {});
  },
  deleteMenuEntry(id) {
    return http.del('/admin/menu/' + id);
  },
  createEvent(payload) {
    return http.post('/admin/events', payload);
  },
  updateEvent(id, payload) {
    return http.patch('/admin/events/' + id, payload);
  },
  users(query) {
    return http.get('/admin/users', query || {});
  },
  setRole(id, role) {
    return http.patch('/admin/users/' + id + '/role', { role: role });
  },
  createUser(payload) {
    return http.post('/admin/users', payload);
  },
  updateUser(id, payload) {
    return http.patch('/admin/users/' + id, payload);
  },
  resetPassword(id, password) {
    return http.patch('/admin/users/' + id + '/password', { password: password });
  },
  deleteUser(id) {
    return http.del('/admin/users/' + id);
  },
  setBanned(id, banned) {
    return http.patch('/admin/users/' + id + '/ban', { banned: banned });
  },
  reports(status) {
    return http.get('/admin/reports', { status: status || 'PENDING' });
  },
  handleReport(id, action, removeContent) {
    return http.patch('/admin/reports/' + id, { action: action, removeContent: !!removeContent });
  },
  permissions() {
    return http.get('/admin/permissions');
  },
  audit(limit) {
    return http.get('/admin/audit', { limit: limit || 50 });
  },
  notices() {
    return http.get('/admin/notices');
  },
  updateNotice(id, payload) {
    return http.patch('/admin/notices/' + id, payload);
  },
  deleteNotice(id) {
    return http.del('/admin/notices/' + id);
  },
  // 家長綁定（P2）：建立／解除一律由後端驗身分與是否存在，前端只送帳號
  parents(query) {
    return http.get('/admin/parents', query || {});
  },
  linkParent(parentAccount, studentAccount, relation) {
    return http.post('/admin/parents/link', {
      parentAccount: parentAccount,
      studentAccount: studentAccount,
      relation: relation || 'guardian',
    });
  },
  unlinkParent(id) {
    return http.del('/admin/parents/link/' + id);
  },
};
