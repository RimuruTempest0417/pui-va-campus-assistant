// 資料入口：頁面只 require 這支，不直接碰 api.js / mock.js
// 預設（DEMO_MODE='off'）一律打真 API；只有明確開啟「離線示範」才會用本地資料。
const config = require('../config/config');
const api = require('./api');
const mock = require('./mock');
const cache = require('./cache');
const offline = require('../utils/offline');
const request = require('../utils/request');
const { codeOf, isNetworkish, messageOf } = require('../utils/errors');

// W-98：值得快取的「讀取」清單。
// 白名單而不是黑名單 —— 新增的寫入類方法預設不快取，永遠不會出現假的「已送出」。
const CACHEABLE = {
  listNotices: 1, // 公告
  timetable: 1, // 課表（整週）
  timetableToday: 1, // 課表（今天＋下一節）
  listHomework: 1, // 功課
  schoolGrades: 1,
  schoolAttendance: 1,
  parentChildGrades: 1,
  parentChildAttendance: 1,
};

/**
 * 「每次動作都抓一次家校通」的節流器。
 *
 * 為什麼放在資料層：要每個頁面自己記得呼叫 refresh 是不可能守住的（新增頁面一定漏）。
 * 放在 call() 這裡，任何讀到家校通資料的動作都會順手踢一次背景刷新；10 分鐘一次、
 * 8 秒預算、失敗完全靜音 —— 使用者不會因為自動刷新而多等一秒。
 */
const SCHOOL_TOUCH = { schoolGrades: 1, schoolAttendance: 1, schoolStatus: 1, parentChildGrades: 1, parentChildAttendance: 1, teacherClass: 1 };
let lastSchoolKick = 0;
const SCHOOL_KICK_GAP_MS = 10 * 60_000;

function kickSchoolRefresh() {
  if (isDemo()) return;
  if (!request.getToken()) return;
  const now = Date.now();
  if (now - lastSchoolKick < SCHOOL_KICK_GAP_MS) return;
  lastSchoolKick = now;
  Promise.resolve()
    .then(() => api.schoolRefresh(false))
    .catch(() => {});
}

let demoActive = false;

function forceDemoOn() {
  try {
    const v = wx.getStorageSync(config.STORAGE_KEYS.forceDemo);
    return v === '1' || v === true;
  } catch (e) {
    return false;
  }
}

function setApiBase(url) {
  try {
    if (url) wx.setStorageSync(config.STORAGE_KEYS.apiBase, String(url).replace(/\/$/, ''));
    else wx.removeStorageSync(config.STORAGE_KEYS.apiBase);
  } catch (e) {
    // storage 失敗不影響主流程
  }
  demoActive = false;
  cache.clear(); // 換了後端位址，舊快取一定是別人的資料
  return request.apiBase();
}

function isDemo() {
  if (config.DEMO_MODE === 'on') return true;
  if (forceDemoOn()) return true; // 開發自檢頁的臨時開關
  if (config.DEMO_MODE === 'off') return false;
  if (!config.API_BASE_URL) return true;
  return demoActive;
}

/** 開發自檢頁用：切換離線示範（不改程式碼、關掉即回真 API） */
function setForceDemo(on) {
  try {
    wx.setStorageSync(config.STORAGE_KEYS.forceDemo, on ? '1' : '');
  } catch (e) {
    // storage 失敗不影響主流程
  }
  demoActive = false;
  return isDemo();
}

/**
 * 首次進入時用 wx.login 換 JWT。失敗（沒後端、AppSecret 未設定）就當訪客，
 * 讀取類頁面照常運作，只是不能發布／報名。
 */
async function ensureLogin() {
  if (isDemo()) return null;
  if (request.getToken()) return null;
  try {
    const code = await new Promise((resolve, reject) => {
      wx.login({ success: (r) => resolve(r.code), fail: reject });
    });
    if (!code) return null;
    const res = await api.login(code);
    if (res && res.token) {
      request.setToken(res.token);
      return res.user || null;
    }
  } catch (e) {
    // 訪客模式：不打擾使用者
  }
  return null;
}

async function call(name, args) {
  if (isDemo()) return mock[name].apply(null, args || []);
  const a = args || [];
  const cacheable = !!CACHEABLE[name];
  // 訪客沒有 token，指紋就是空 → 快取也分得開（訪客看不到登入後的資料）
  const token = cacheable ? request.getToken() : '';
  try {
    const res = await api[name].apply(null, a);
    if (cacheable) cache.write(name, a, token, res); // 成功才寫
    if (SCHOOL_TOUCH[name]) kickSchoolRefresh(); // 順手刷新家校通（節流、靜音）
    return res;
  } catch (err) {
    if (config.DEMO_MODE === 'auto' && isNetworkish(err) && codeOf(err) !== 'UNAUTHORIZED') {
      demoActive = true;
      console.warn('[data] 後端不可用，已切換示範模式：' + codeOf(err));
      return mock[name].apply(null, a);
    }
    // 只有「連不上」才回上次成功的資料；權限／找不到／參數錯照原樣失敗。
    // 頁面必須把「離線資料 · 上次更新 X」寫出來，不能讓它看起來是即時的。
    if (cacheable && isNetworkish(err)) {
      const hit = cache.read(name, a, token);
      if (hit) {
        offline.note(name, hit.at);
        return hit.value;
      }
    }
    throw err;
  }
}

module.exports = {
  isDemo: isDemo,
  ensureLogin: ensureLogin,
  setForceDemo: setForceDemo,
  setApiBase: setApiBase,
  apiBase: () => request.apiBase(),
  forceDemoOn: forceDemoOn,
  messageOf: messageOf,
  resetDemo: () => mock.reset(),
  // ── W-98 離線快取 ──
  // 頁面在 load 前 offlineReset()、load 後 offlineText() 拿「上次更新於 X」；
  // 沒吃快取就回空字串（橫幅不顯示），不會出現「離線資料 剛剛」這種廢話。
  offlineReset: offline.reset,
  offlineInfo: offline.info,
  offlineText: (prefix) => offline.text(prefix),
  clearCache: () => cache.clear(),
  login: (...a) => call('login', a),
  // 沒有 token 就不可能登入成功，直接回 null（訪客），不要白打一條 401
  me: (...a) => (isDemo() || request.getToken() ? call('me', a) : Promise.resolve(null)),
  listItems: (...a) => call('listItems', a),
  createItem: (...a) => call('createItem', a),
  getItem: (...a) => call('getItem', a),
  myItems: (...a) => call('myItems', a),
  updateItemStatus: (...a) => call('updateItemStatus', a),
  categories: (...a) => call('categories', a),
  claimItem: (...a) => call('claimItem', a),
  myClaims: (...a) => call('myClaims', a),
  matches: (...a) => call('matches', a),
  listEvents: (...a) => call('listEvents', a),
  signupEvent: (...a) => call('signupEvent', a),
  cancelSignup: (...a) => call('cancelSignup', a),
  mySignups: (...a) => call('mySignups', a),
  checkin: (...a) => call('checkin', a),
  parentChildren: (...a) => call('parentChildren', a),
  parentChild: (...a) => call('parentChild', a),
  parentSignupEvent: (...a) => call('parentSignupEvent', a),
  parentCancelSignup: (...a) => call('parentCancelSignup', a),
  getEvent: (...a) => call('getEvent', a),
  switchDemoUser: (...a) => call('switchDemoUser', a),
  weekMenu: (...a) => call('weekMenu', a),
  mealSets: (...a) => call('mealSets', a),
  getDish: (...a) => call('getDish', a),
  rateDish: (...a) => call('rateDish', a),
  topDishes: (...a) => call('topDishes', a),
  listNotices: (...a) => call('listNotices', a),
  // W-59 全校搜尋（示範模式也搜得到，交付現場斷網時這個功能不能是死的）
  search: (...a) => call('search', a),
  getNotice: (...a) => call('getNotice', a),
  subscribe: (...a) => call('subscribe', a),
  mySubscriptions: (...a) => call('mySubscriptions', a),
  markAllNoticesRead: (...a) => call('markAllNoticesRead', a),
  calendar: (...a) => call('calendar', a),
  createReport: (...a) => call('createReport', a),
  externalCalendar: (...a) => call('externalCalendar', a),

  // ── W-34 站內通知（W-96 加分組：group 可只取某一組） ──
  notifications(opts) {
    const o = opts && typeof opts === 'object' ? opts : { unreadOnly: !!opts };
    return call('notifications', [o]);
  },
  notificationsUnread(group) {
    return call('notificationsUnread', [group]);
  },
  readNotifications(id) {
    return call('readNotifications', [id]);
  },
  readAllNotifications(group) {
    return call('readAllNotifications', [group]);
  },

  // ── W-31 活動回饋 ──
  eventFeedback: (...a) => call('eventFeedback', a),
  submitFeedback: (...a) => call('submitFeedback', a),

  // ── W-30 組隊 ──
  eventTeams: (...a) => call('eventTeams', a),
  createTeam: (...a) => call('createTeam', a),

  // ── W-38 活動附件 ──
  addEventAttachment: (...a) => call('addEventAttachment', a),
  deleteEventAttachment: (...a) => call('deleteEventAttachment', a),
  signUpload: (...a) => call('signUpload', a),

  // ── W-43 使用者回報問題 ──
  // 示範模式寫本地並回 demo: true（畫面不會謊報已送出）；真 API 走 /client-errors/report。
  reportIssue: (...a) => call('reportIssue', a),

  // ── 家校通 ──
  schoolStatus: (...a) => call('schoolStatus', a),
  schoolLink: (...a) => call('schoolLink', a),
  schoolUnlink: (...a) => call('schoolUnlink', a),
  schoolSync: (...a) => call('schoolSync', a),
  schoolRefresh: (...a) => call('schoolRefresh', a),
  schoolGrades: (...a) => call('schoolGrades', a),
  schoolAttendance: (...a) => call('schoolAttendance', a),
  // 家長讀子女的成績／出缺席（與上面同形狀；閘門在後端 parent-scope，未綁定 403）
  parentChildGrades: (...a) => call('parentChildGrades', a),
  parentChildAttendance: (...a) => call('parentChildAttendance', a),
  parentChildSync: (...a) => call('parentChildSync', a),
  schoolManualGrade: (...a) => call('schoolManualGrade', a),
  schoolManualAttendance: (...a) => call('schoolManualAttendance', a),

  // ── W-66 圖書館（借還要登入；館藏查詢訪客也可以用）──
  // 訪客查館藏不該先被 ensureLogin 擋住：後端 library:read 對 GUEST 開放。
  listBooks: (...a) => call('listBooks', a),
  getBook: (...a) => call('getBook', a),
  lookupIsbn: (...a) => call('lookupIsbn', a),
  hotBooks: (...a) => call('hotBooks', a),
  borrowBook: (...a) => call('borrowBook', a),
  myLoans: (...a) => call('myLoans', a),
  returnLoan: (...a) => call('returnLoan', a),
  renewLoan: (...a) => call('renewLoan', a),
  cancelReservation: (...a) => call('cancelReservation', a),

  // ── W-67 場地／器材借用（查詢訪客可看；申請要登入；審批老師以上）──
  listResources: (...a) => call('listResources', a),
  getResource: (...a) => call('getResource', a),
  myResourceBookings: (...a) => call('myResourceBookings', a),
  createResourceBooking: (...a) => call('createResourceBooking', a),
  cancelResourceBooking: (...a) => call('cancelResourceBooking', a),
  pendingResourceBookings: (...a) => call('pendingResourceBookings', a),
  reviewResourceBooking: (...a) => call('reviewResourceBooking', a),
  allResources: (...a) => call('allResources', a),
  createResource: (...a) => call('createResource', a),
  updateResource: (...a) => call('updateResource', a),
  archiveResource: (...a) => call('archiveResource', a),

  // ── W-68 二手書／校服轉贈（查詢訪客可看；送出與申請要登入）──
  listGiveaways: (...a) => call('listGiveaways', a),
  getGiveaway: (...a) => call('getGiveaway', a),
  myGiveaways: (...a) => call('myGiveaways', a),
  createGiveaway: (...a) => call('createGiveaway', a),
  updateGiveaway: (...a) => call('updateGiveaway', a),
  setGiveawayStatus: (...a) => call('setGiveawayStatus', a),
  requestGiveaway: (...a) => call('requestGiveaway', a),
  cancelGiveawayRequest: (...a) => call('cancelGiveawayRequest', a),
  decideGiveawayRequest: (...a) => call('decideGiveawayRequest', a),

  // ── W-72 請假申請（學生／家長送出、老師與校務處審批）──
  myLeaves: (...a) => call('myLeaves', a),
  createLeave: (...a) => call('createLeave', a),
  cancelLeave: (...a) => call('cancelLeave', a),
  adminLeaves: (...a) => call('adminLeaves', a),
  reviewLeave: (...a) => call('reviewLeave', a),

  // ── W-73 班級課表（讀取訪客可看；匯入與修改是校內職員）──
  timetable: (...a) => call('timetable', a),
  timetableToday: (...a) => call('timetableToday', a),
  adminTimetable: (...a) => call('adminTimetable', a),
  saveTimetableSlot: (...a) => call('saveTimetableSlot', a),
  deleteTimetableSlot: (...a) => call('deleteTimetableSlot', a),
  importTimetable: (...a) => call('importTimetable', a),
  // v1.0.2：班級與格線調堂（示範層同一套規則）
  timetableLayout: (...a) => call('timetableLayout', a),
  setTimetableCell: (...a) => call('setTimetableCell', a),
  swapTimetable: (...a) => call('swapTimetable', a),
  classes: (...a) => call('classes', a),
  createClass: (...a) => call('createClass', a),
  deleteClass: (...a) => call('deleteClass', a),

  // ── W-76 功課清單（依班級；打勾是每人一列）──
  listHomework: (...a) => call('listHomework', a),
  createHomework: (...a) => call('createHomework', a),
  updateHomework: (...a) => call('updateHomework', a),
  removeHomework: (...a) => call('removeHomework', a),
  markHomework: (...a) => call('markHomework', a),
  unmarkHomework: (...a) => call('unmarkHomework', a),
  parentChildHomework: (...a) => call('parentChildHomework', a),
  homeworkStats: (...a) => call('homeworkStats', a),
  homeworkPending: (...a) => call('homeworkPending', a),
  /** W-94：教師端班級總覽（示範層由同一組示範資料算出同一個形狀） */
  classOverview: (...a) => call('classOverview', a),
  /** W-106：本班出席率月報（示範層用日期算出穩定數字，重新整理不會跳） */
  classAttendance: (...a) => call('classAttendance', a),

  // ── W-88 校園提案與連署（讀取訪客可看；提案／連署要登入；回覆是校內職員）──
  listProposals: (...a) => call('listProposals', a),
  getProposal: (...a) => call('getProposal', a),
  proposalSupports: (...a) => call('proposalSupports', a),
  createProposal: (...a) => call('createProposal', a),
  updateProposal: (...a) => call('updateProposal', a),
  supportProposal: (...a) => call('supportProposal', a),
  unsupportProposal: (...a) => call('unsupportProposal', a),
  removeProposal: (...a) => call('removeProposal', a),
  adminProposals: (...a) => call('adminProposals', a),
  replyProposal: (...a) => call('replyProposal', a),

  // ── W-89 課室設備報修（送出與取消要登入；接單與統計是總務／校務處）──
  myRepairs: (...a) => call('myRepairs', a),
  getRepair: (...a) => call('getRepair', a),
  createRepair: (...a) => call('createRepair', a),
  cancelRepair: (...a) => call('cancelRepair', a),
  adminRepairs: (...a) => call('adminRepairs', a),
  acceptRepair: (...a) => call('acceptRepair', a),
  finishRepair: (...a) => call('finishRepair', a),
  repairStats: (...a) => call('repairStats', a),
  // W-113 審批時效（示範層用同一組示範資料算出同形狀，斷網演示時這一段也不能是空的）
  approvalStats: (...a) => call('approvalStats', a),

  // ── W-102 個資自主：匯出自己的成績／出缺席／借閱／請假（回 CSV 純文字）──
  // 刻意不加進 CACHEABLE：這是「當下要帶走的檔案」，不是畫面，快取只會讓人拿到舊資料。
  myExport: (...a) => call('myExport', a),

  // ── W-109 個人校曆訂閱（看狀態／產生／撤銷；.ics 本身由日曆 App 自己抓）──
  calendarToken: (...a) => call('calendarToken', a),
  rotateCalendarToken: (...a) => call('rotateCalendarToken', a),
  revokeCalendarToken: (...a) => call('revokeCalendarToken', a),
};
