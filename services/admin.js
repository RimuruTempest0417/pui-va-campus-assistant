// 教職員後台 API（只走真 API；示範模式沒有後台）
const http = require('../utils/request');

module.exports = {
  login(account, password, code) {
    // 學生／家長也用這支（/auth/login）；教職員登入後照樣進後台，由 role 分流
    return http.post('/auth/password', { account: account, password: password, code: code || undefined }, { auth: false });
  },
  /**
   * 家校通帳密直接登入：不需要微信授權，也不需要管理員先開帳號。
   * 後端會先向家校通驗證，通過才建立／對應本系統使用者（openid = sc:<帳號>）。
   * 密碼只在這次請求裡用掉，不會存到後端資料庫。
   */
  schoolLogin(account, password) {
    return http.post('/auth/school', { account: account, password: password }, { auth: false });
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
  // W-55：回饋統計（平均分／回覆率／星等分佈／最近留言）
  feedbackStats(eventId) {
    return http.get('/admin/events/' + eventId + '/feedback-stats');
  },
  // W-56：催填回饋（只催已簽到且還沒填的人，12 小時內不重複）
  remindFeedback(eventId) {
    return http.post('/admin/events/' + eventId + '/feedback-remind', {});
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
  /**
   * W-86 班級名單：班級不是一張表，而是 `User.className` 的集合視圖。
   * 回 `{ items: [{ className, students, hasTimetable, hasHomework }], unassigned, total }`。
   */
  classes() {
    return http.get('/admin/classes');
  },
  /** 批次指派／移出（action: 'ADD' | 'REMOVE'） */
  assignClass(className, userIds, action) {
    return http.post('/admin/classes/' + encodeURIComponent(className) + '/members', {
      userIds: userIds,
      action: action || 'ADD',
    });
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
  /** W-54 已讀統計（誰看了、誰還沒看） */
  noticeReadStats(id) {
    return http.get('/admin/notices/' + id + '/read-stats');
  },
  /** W-54 催讀：只對未讀者發站內通知（不含已讀者，不騷擾） */
  remindNotice(id) {
    return http.post('/admin/notices/' + id + '/remind', {});
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

  // ── W-66 圖書館（館藏與借閱紀錄）──
  libraryBooks(query) {
    return http.get('/admin/library/books', query || {});
  },
  libraryBookCreate(payload) {
    return http.post('/admin/library/books', payload);
  },
  libraryBookUpdate(id, payload) {
    return http.patch('/admin/library/books/' + id, payload);
  },
  libraryBookArchive(id, archived) {
    return http.post('/admin/library/books/' + id + '/archive', { archived: archived });
  },
  libraryBookDelete(id) {
    return http.del('/admin/library/books/' + id);
  },
  libraryLoans(query) {
    return http.get('/admin/library/loans', query || {});
  },
  libraryReturn(loanId) {
    return http.post('/admin/library/loans/' + loanId + '/return', {});
  },
  libraryRemind() {
    return http.post('/admin/library/remind', {});
  },

  // ── W-67 場地／器材（與前台共用同一組端點；後端能力守衛自己會擋）──
  resourcePending() {
    return http.get('/resources/pending');
  },
  resourceReview(id, body) {
    return http.patch('/resources/bookings/' + id, body);
  },
  resourcesAll() {
    return http.get('/resources/all');
  },
  resourceCreate(body) {
    return http.post('/resources', body);
  },
  resourceUpdate(id, body) {
    return http.patch('/resources/' + id, body);
  },
  resourceArchive(id) {
    return http.del('/resources/' + id);
  },
  // W-68 二手書／校服轉贈：後台只有「下架」與「重新上架」兩種操作
  giveaways(status) {
    return http.get('/admin/giveaways', status && status !== 'all' ? { status: status } : {});
  },
  setGiveawayStatus(id, status) {
    return http.post('/giveaways/' + id + '/status', { status: status });
  },

  // ── W-72 請假申請：待審清單與審批（能力 leave:review：老師／校務處）──
  leaves(status) {
    return http.get('/admin/leaves', status ? { status: status } : {});
  },
  reviewLeave(id, body) {
    return http.patch('/admin/leaves/' + id, body);
  },

  // ── W-73 班級課表（校內職員）──
  timetableAll() {
    return http.get('/admin/timetable');
  },
  saveTimetableSlot(body) {
    return http.post('/admin/timetable', body);
  },
  deleteTimetableSlot(id) {
    return http.del('/admin/timetable/' + id);
  },
  importTimetable(body) {
    return http.post('/admin/timetable/import', body);
  },

  // ── W-77 功課後台：跨班一覽、未交名單、收回（能力 homework:manage：資訊管理員以上）──
  homeworkAll(params) {
    const q = params || {};
    const query = {};
    if (q.className) query.className = q.className;
    if (q.scope && q.scope !== 'all') query.scope = q.scope;
    // W-84：完成率趨勢要看幾天（後端預設 7、上限 30）
    if (q.days) query.days = q.days;
    return http.get('/admin/homework', query);
  },
  homeworkPending(id) {
    return http.get('/homework/' + id + '/pending');
  },
  /** 收回＝軟刪除（回收桶看得到、審計有紀錄）；不是真的刪掉 */
  deleteHomework(id) {
    return http.del('/homework/' + id);
  },

  // ── W-81 示範資料一鍵匯入／清除（能力 system:config：只有最高權限）──
  /** 目前有多少示範資料（按鈕旁顯示「場地 5 · 館藏 6 · 課表 35 格」） */
  demoSummary() {
    return http.get('/admin/demo-data');
  },
  /** kind = venues|library|timetable|all；action = SEED|CLEAR */
  demoData(kind, action, className) {
    const body = { kind: kind, action: action };
    if (className) body.className = className;
    return http.post('/admin/demo-data', body);
  },

  // ── W-88 校園提案後台（能力 proposal:reply：校內職員以上）──
  proposalsAll(params) {
    const q = params || {};
    const query = {};
    if (q.status && q.status !== 'ALL') query.status = q.status;
    if (q.category) query.category = q.category;
    if (q.q) query.q = q.q;
    return http.get('/admin/proposals', query);
  },
  /** 回覆會同時改狀態，並通知提案人與所有連署人（後端一次做完） */
  replyProposal(id, body) {
    return http.post('/admin/proposals/' + id + '/reply', body);
  },
  /** 下架＝軟刪除，回收桶救得回來 */
  removeProposal(id) {
    return http.del('/proposals/' + id);
  },

  // ── W-89 課室設備報修後台（能力 repair:handle：總務／校務處）──
  repairs(params) {
    const q = params || {};
    const query = {};
    query.status = q.status || 'PENDING';
    if (q.location) query.location = q.location;
    if (q.q) query.q = q.q;
    return http.get('/admin/repairs', query);
  },
  /** 接單：後端條件式更新，被別人接走時回 409（前端只提示，不重試） */
  acceptRepair(id) {
    return http.post('/admin/repairs/' + id + '/accept', {});
  },
  finishRepair(id, body) {
    return http.post('/admin/repairs/' + id + '/done', body || {});
  },
  repairStats() {
    return http.get('/admin/repairs/stats');
  },
};
