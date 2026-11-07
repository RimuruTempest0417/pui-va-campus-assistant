/**
 * 首頁「今日待辦」卡（W-93）的組裝邏輯。
 *
 * 為什麼不是一支新端點：三個數字在首頁 refresh() 都已經抓回來了
 * （功課 `scope=todo` 的 stats、課表 `timetable/today` 的 next、通知未讀數），
 * 再開一支聚合 API 等於同一份資料兩個來源，改了一邊另一邊不會跟著改。
 *
 * 規則（不靜默降級）：
 *   ① 任何一支取不到（null／undefined）→ 只有那一行寫「暫時取不到」，其他行照常顯示；
 *   ② 未登入（role 為空）→ 整張卡不顯示；
 *   ③ 家長只看得到子女的功課與自己的未讀通知（沒有班級，不顯示「下一節」）。
 *
 * 這裡刻意不 require wx、不 require services：同一份規則可以被
 * scripts/check-todo.cjs 在 Node 裡直接測，不必開開發者工具。
 */
const i18n = require('./i18n');

const ROUTE = {
  homework: '/pages/homework/index',
  timetable: '/pages/timetable/index',
  notices: '/pages/notifications/index',
  kid: '/pages/parent/index',
};

function mk(key, label, value, tone, detail) {
  return {
    key: key,
    label: label,
    value: value,
    detail: detail || '',
    tone: tone || 'default',
    route: ROUTE[key] || '',
  };
}

/** 功課：未交幾項、其中幾項已逾期；沒有班級就寫「—」而不是 0 */
function homeworkRow(homework) {
  const label = i18n.pick('未交功課');
  // 順序很重要：needsClass 的帳號 stats 本來就是 null，先判 stats 會把它誤報成「暫時取不到」
  if (homework && homework.needsClass) {
    return mk('homework', label, '—', 'muted', i18n.pick('還沒有班級資料'));
  }
  if (!homework || !homework.stats) {
    return mk('homework', label, i18n.pick('暫時取不到'), 'muted');
  }
  const todo = Number(homework.stats.todo) || 0;
  const overdue = Number(homework.stats.overdue) || 0;
  if (todo <= 0) return mk('homework', label, i18n.pick('都交了'), 'ok');
  return mk(
    'homework',
    label,
    todo + i18n.pick(' 項未交'),
    overdue > 0 ? 'warn' : 'default',
    overdue > 0 ? overdue + i18n.pick(' 項已逾期') : ''
  );
}

/** 子女功課（家長）：家長沒有班級，資料來自家長卡的 summary */
function kidRow(kid) {
  const label = i18n.pick('子女未交功課');
  if (!kid) return mk('kid', label, i18n.pick('暫時取不到'), 'muted');
  const todo = kid.homeworkTodo;
  if (todo === null || todo === undefined) {
    return mk('kid', label, '—', 'muted', i18n.pick('還沒有功課資料'));
  }
  const overdue = Number(kid.homeworkOverdue) || 0;
  if (Number(todo) <= 0) return mk('kid', label, i18n.pick('都交了'), 'ok');
  return mk(
    'kid',
    label,
    Number(todo) + i18n.pick(' 項未交'),
    overdue > 0 ? 'warn' : 'default',
    overdue > 0 ? overdue + i18n.pick(' 項已逾期') : ''
  );
}

/** 下一節：放假時寫出原因（與課表頁同一份 dayOffReason），放學後寫「今天沒有下一節了」 */
function timetableRow(timetable) {
  const label = i18n.pick('下一節');
  if (!timetable) return mk('timetable', label, i18n.pick('暫時取不到'), 'muted');
  if (!timetable.schoolDay) {
    return mk('timetable', label, timetable.dayOffReason || i18n.pick('今天不用上課'), 'muted');
  }
  if (timetable.nextText) return mk('timetable', label, timetable.nextText, 'default');
  return mk('timetable', label, i18n.pick('今天沒有下一節了'), 'muted');
}

/** 未讀通知：沒有未讀時寫「沒有未讀」，取不到時只有這一行降級 */
function noticeRow(unread) {
  const label = i18n.pick('未讀通知');
  if (typeof unread !== 'number' || isNaN(unread)) {
    return mk('notices', label, i18n.pick('暫時取不到'), 'muted');
  }
  if (unread <= 0) return mk('notices', label, i18n.pick('沒有未讀'), 'ok');
  const shown = unread > 99 ? '99+' : String(unread);
  return mk('notices', label, shown + i18n.pick(' 則未讀'), 'default');
}

/**
 * 整張卡要顯示哪幾行。
 * @param {{role?:string, homework?:object|null, timetable?:object|null, kid?:object|null, unread?:number}} input
 * @returns {Array<{key:string,label:string,value:string,detail:string,tone:string,route:string,last:boolean}>}
 */
function rows(input) {
  const src = input || {};
  const role = src.role || '';
  const out = [];
  if (!role) return out; // 訪客：整張卡不顯示（沒有功課也沒有通知）
  if (role === 'PARENT') {
    out.push(kidRow(src.kid));
    out.push(noticeRow(src.unread));
  } else {
    out.push(homeworkRow(src.homework));
    out.push(timetableRow(src.timetable));
    out.push(noticeRow(src.unread));
  }
  out[out.length - 1].last = true;
  return out;
}

module.exports = { rows, homeworkRow, kidRow, timetableRow, noticeRow };
