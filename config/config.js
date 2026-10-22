// 執行環境設定（唯一開關檔）
// DEMO_MODE：
//   'auto'（預設）有 API_BASE_URL 就先用真的，請求失敗自動落回示範資料
//   'on'  一律示範模式（交付給老師、沒後端時）
//   'off' 一律走真 API（除錯用，失敗就是失敗，不偷偷吞掉）
module.exports = {
  API_BASE_URL: '', // 例：https://api.example.com/api/v1（未備案前留空＝示範模式）
  DEMO_MODE: 'auto',
  TIMEOUT: 8000,
  RETRY: 1,
  STORAGE_KEYS: {
    token: 'pv_token',
    user: 'pv_user',
    demo: 'pv_demo_seed',
  },
};
