// 教職員後台 API（只走真 API；示範模式沒有後台）
const http = require('../utils/request');

module.exports = {
  login(account, password, code) {
    return http.post('/admin/login', { account: account, password: password, code: code || undefined }, { auth: false });
  }, { auth: false });
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
  // 現場簽到（老師端）：開／關簽到、出席名單、代簽
  eventCheckin(eventId) {
    return http.get('/events/' + eventId + '/checkin');
  },
  openEventCheckin(eventId) {
    return http.post('/events/' + eventId + '/checkin/open', {});
  },
  closeEventCheckin(eventId) {
    return http.post('/events/' + eventId + '/checkin/close', {});
  },
  attendance(eventId) {
    return http.get('/events/' + eventId + '/attendance');
  },
  // 批次匯入（W-19）：逐列回報，dryRun 只驗不寫
  importEvents(csv, dryRun) {
    return http.post('/admin/import/events', { csv: csv, dryRun: !!dryRun });
  },
  importMenu(csv, dryRun) {
    return http.post('/admin/import/menu', { csv: csv, dryRun: !!dryRun });
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
  // 錯誤日誌：手機上沒人看得到的白屏／閃退會送到這裡，按出現次數排序
  errors(status) {
    return http.get('/admin/errors', { status: status || '', limit: 50 });
  },
  setErrorStatus(id, action) {
    return http.patch('/admin/errors/' + id, { action: action });
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

  // ── W-22 兩步驗證 ──
  twoFactorStatus() {
    return http.get('/admin/2fa');
  },
  twoFactorBegin() {
    return http.post('/admin/2fa/begin', {});
  },
  twoFactorEnable(code) {
    return http.post('/admin/2fa/enable', { code: code });
  },
  twoFactorDisable(password) {
    return http.post('/admin/2fa/disable', { password: password });
  },
};
