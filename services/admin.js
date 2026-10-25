// 教職員後台 API（只走真 API；示範模式沒有後台）
const http = require('../utils/request');

module.exports = {
  login(account, password, code) {
    // 學生／家長也用這支（/auth/login）；教職員登入後照樣進後台，由 role 分流
    return http.post('/auth/password', { account: account, password: password, code: code || undefined }, { auth: false });
  },
  stats() {
    return http.get('/admin/stats');
  },
  // 後台第一屏五張卡（本週新使用者／本週報名／待審認領／未解決錯誤／未認領失物）
  statsOverview() {
    return http.get('/admin/stats/overview');
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
  // W-41：解除登入失敗鎖定
  unlockUser(id) {
    return http.post('/admin/users/' + id + '/unlock', {});
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
  errors(status, kind) {
    return http.get('/admin/errors', { status: status || '', kind: kind || '', limit: 50 });
  },
  setErrorStatus(id, action) {
    return http.patch('/admin/errors/' + id, { action: action });
  },
  // 同類一次解決：後端以「訊息＋頁面」為 signature；省略 route = 同一句話的所有頁面
  resolveSimilarErrors(message, route) {
    return http.post('/admin/error-logs/resolve-similar', { message: message, route: route || null });
  },
  // 清理舊錯誤：預設只刪已解決的，回傳 { deleted, kept }
  cleanupErrors(days, includeOpen) {
    return http.post('/admin/error-logs/cleanup', { olderThanDays: days, includeOpen: !!includeOpen });
  },
  // 推送紀錄（W-37）：每一次發送的成敗與原因，回答「為什麼我沒收到」
  pushLogs(ok, channel, limit) {
    return http.get('/admin/push-logs', { ok: ok || 'all', channel: channel || '', limit: limit || 50 });
  },
  // 資源回收桶（W-40）：公告與失物都是軟刪除，這裡看得到、可以還原
  trash(type) {
    return http.get('/admin/trash', { type: type || 'all' });
  },
  restoreTrash(type, id) {
    return http.post('/admin/trash/restore', { type: type, id: id });
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
  deleteEvent(id) {
    return http.del('/admin/events/' + id);
  },

  deleteItem(id) {
    return http.del('/admin/items/' + id);
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

  // ── W-53 第二階段：老師／職員在小程序內補登成績與出缺席 ──
  // 能力是後端的 school:manage；前端只負責把參數送對，規則（同步資料不可覆蓋）在後端。
  schoolStudents(q) {
    return http.get('/admin/school/students', q ? { q: q } : {});
  },
  schoolGrades(studentId) {
    return http.get('/admin/school/grades', { studentId: studentId });
  },
  schoolGradeCreate(body) {
    return http.post('/admin/school/grades', body);
  },
  // 批次匯入：dryRun 只驗不寫（與活動／菜單匯入同一套語意）
  schoolGradeBatch(body) {
    return http.post('/admin/school/grades/batch', body);
  },
  schoolGradeTemplate() {
    return http.get('/admin/school/grades/template');
  },
  schoolGradeDelete(id) {
    return http.del('/admin/school/grades/' + id);
  },
  schoolAttendance(studentId) {
    return http.get('/admin/school/attendance', { studentId: studentId });
  },
  schoolAttendCreate(body) {
    return http.post('/admin/school/attendance', body);
  },
  schoolAttendDelete(id) {
    return http.del('/admin/school/attendance/' + id);
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
