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
  myClaims() {
    return http.get('/my/claims');
  },
  listEvents(query) {
    return http.get('/events', query);
  },
  getEvent(id) {
    return http.get('/events/' + id);
  },
  signupEvent(eventId, groupKey, teamCode) {
    return http.post('/events/' + eventId + '/signup', groupKey ? { groupKey: groupKey } : {});
  },
  cancelSignup(eventId) {
    return http.del('/events/' + eventId + '/signup');
  },
  mySignups() {
    return http.get('/events/mine');
  },
  /** 現場簽到：只送碼，後端自己認活動（不信任前端傳來的 eventId） */
  checkin(code) {
    return http.post('/events/checkin', { code: code });
  },
  // 家長端：只能碰「已綁定」的子女（後端 parent-scope 閘門，未綁定一律 403）
  parentChildren() {
    return http.get('/parents/me/children');
  },
  parentChild(studentId) {
    return http.get('/parents/me/children/' + studentId);
  },
  /** 子女的成績／出缺席（家長端專用；閘門在後端 parent-scope，未綁定 403） */
  parentChildGrades(studentId, q) {
    return http.get('/parents/me/children/' + studentId + '/grades', q || {});
  },
  parentChildAttendance(studentId, q) {
    return http.get('/parents/me/children/' + studentId + '/attendance', q || {});
  },
  /** 用家長自己的家校通連結同步子女的成績（寫在子女身上；未連結後端回 422） */
  parentChildSync(studentId) {
    return http.post('/parents/me/children/' + studentId + '/sync', {});
  },
  parentSignupEvent(studentId, eventId) {
    return http.post('/parents/me/children/' + studentId + '/events/' + eventId + '/signup', {});
  },
  parentCancelSignup(studentId, eventId) {
    return http.del('/parents/me/children/' + studentId + '/events/' + eventId + '/signup');
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
  /** W-59 全校搜尋：公告／活動／失物一次搜（可見性規則在後端，前端不重算） */
  search(q) {
    return http.get('/search', { q: q });
  },
  getNotice(id) {
    return http.get('/notices/' + id);
  },
  createReport(targetType, targetId, reason) {
    return http.post('/reports', { targetType: targetType, targetId: targetId, reason: reason });
  },
  markAllNoticesRead() {
    return http.post('/notices/read-all', {});
  },
  /** 外部校曆（學校／個人 iCloud 發布的 ICS）：後端抓取＋展開後回場次 */
  externalCalendar(range) {
    const q = range || {};
    return http.get('/calendar/external', { from: q.from || undefined, to: q.to || undefined });
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

  // ── W-34 站內通知 ──
  notifications(unreadOnly) {
    return http.get('/notifications', unreadOnly ? { unreadOnly: '1' } : {});
  },
  notificationsUnread() {
    return http.get('/notifications/unread-count');
  },
  readNotifications(id) {
    return http.patch('/notifications/read', id ? { id } : {});
  },

  // ── W-31 活動回饋 ──
  eventFeedback(eventId) {
    return http.get('/events/' + eventId + '/feedback');
  },
  submitFeedback(eventId, rating, comment) {
    return http.post('/events/' + eventId + '/feedback', { rating, comment });
  },

  // ── W-30 組隊 ──
  eventTeams(eventId) {
    return http.get('/events/' + eventId + '/teams');
  },
  createTeam(eventId, name) {
    return http.post('/events/' + eventId + '/teams', { name });
  },

  // ── W-38 活動附件（清單跟著 /events/:id 一起回，這裡只補寫入兩支）──
  addEventAttachment(eventId, payload) {
    return http.post('/events/' + eventId + '/attachments', payload);
  },
  deleteEventAttachment(eventId, attachmentId) {
    return http.del('/events/' + eventId + '/attachments/' + attachmentId);
  },
  /** COS 直傳簽名：未開通時後端回 UPLOAD_NOT_CONFIGURED，前端照實提示，不要假成功 */
  signUpload(purpose, ext) {
    return http.post('/uploads/signature', { purpose: purpose, ext: ext });
  },

  // ── W-43 使用者手動回報問題 ──
  // 走既有的 client-errors 家族（不是新的一組端點）：同一套節流、聚合與後台分頁。
  reportIssue(payload) {
    return http.post('/client-errors/report', payload);
  },

  // ── 家校通（W-50/51/52）──
  schoolStatus() { return http.get('/school/status'); },
  schoolLink(account, password) { return http.post('/school/link', { account, password }); },
  schoolUnlink() { return http.del('/school/link'); },
  schoolSync(yearTerms) { return http.post('/school/sync', yearTerms ? { yearTerms } : {}); },
  schoolGrades(q) { return http.get('/school/grades', q || {}); },
  schoolAttendance(q) { return http.get('/school/attendance', q || {}); },
  schoolManualGrade(body) { return http.post('/school/manual/grades', body); },
  schoolManualAttendance(body) { return http.post('/school/manual/attendance', body); },

  // ── W-66 圖書館 ──
  listBooks(query) { return http.get('/library/books', query); },
  getBook(id) { return http.get('/library/books/' + id); },
  /** 掃碼查書：查不到回 200 found:false（不是 404），前端顯示「登記新書」 */
  lookupIsbn(isbn) { return http.get('/library/isbn/' + encodeURIComponent(isbn)); },
  hotBooks() { return http.get('/library/hot'); },
  borrowBook(payload) { return http.post('/library/loans', payload); },
  myLoans() { return http.get('/library/loans/mine'); },
  returnLoan(id) { return http.post('/library/loans/' + id + '/return', {}); },
  renewLoan(id) { return http.post('/library/loans/' + id + '/renew', {}); },
  cancelReservation(id) { return http.del('/library/reservations/' + id); },
};
