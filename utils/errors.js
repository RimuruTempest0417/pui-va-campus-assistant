// 後端錯誤碼 → 使用者看得懂的一句話（不要在頁面上顯示 raw code）
const TEXT = {
  UNAUTHORIZED: '請先登入',
  FORBIDDEN: '你沒有這個操作的權限',
  NOT_FOUND: '找不到內容，可能已被刪除',
  VALIDATION_FAILED: '填寫的內容有誤，請檢查後重試',
  EVENT_FULL: '名額已滿，已幫你排入候補',
  ALREADY_SIGNED_UP: '你已經報名過了',
  ALREADY_CLAIMED: '這件物品已有人認領',
  CONTENT_RISKY: '內容未通過安全檢查，請修改後再送出',
  RATE_LIMITED: '操作太頻繁，請稍後再試',
  NETWORK: '網路不穩，已改用離線資料',
  NO_BACKEND: '目前是示範模式',
  INTERNAL: '服務暫時不可用，請稍後再試',
};

function messageOf(err) {
  if (!err) return TEXT.INTERNAL;
  const code = err.code || (err.error && err.error.code);
  if (code && TEXT[code]) return TEXT[code];
  return (err.message || TEXT.INTERNAL).toString().slice(0, 80);
}

function codeOf(err) {
  return (err && (err.code || (err.error && err.error.code))) || 'INTERNAL';
}

// 哪些錯誤值得「落回示範模式」（網路類），哪些必須讓使用者看到（權限、驗證）
const NETWORK_CODES = ['NO_BACKEND', 'NETWORK', 'TIMEOUT', 'INTERNAL'];
function isNetworkish(err) {
  return NETWORK_CODES.indexOf(codeOf(err)) !== -1;
}

module.exports = { TEXT, messageOf, codeOf, isNetworkish };
