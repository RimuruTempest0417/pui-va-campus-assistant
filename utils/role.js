/** 角色顯示名稱（介面一律用中文，不要把 SUPER_ADMIN 這種內部代碼丟給使用者看） */
const i18n = require('./i18n');
const LABELS = {
  SUPER_ADMIN: '最高權限',
  ADMIN: '資訊管理員',
  STAFF: '校內職員',
  TEACHER: '老師',
  PARENT: '家長',
  STUDENT: '學生',
  GUEST: '訪客',
};

const LEVELS = { SUPER_ADMIN: 4, ADMIN: 3, STAFF: 2, TEACHER: 2, PARENT: 1, STUDENT: 1, GUEST: 0 };

function label(role) {
  return i18n.pick(LABELS[role] || role || '');
}

function level(role) {
  return LEVELS[role] || 0;
}

module.exports = { label, level, LABELS };
