// 執行環境設定（唯一開關檔）
// DEMO_MODE：
//   'off'（預設）一律走真 API。後端沒開就是連不上，會顯示錯誤與重試按鈕，
//                 不會偷偷換成示範資料 —— 這樣看到的畫面一定是真的。
//   'auto' 有 API_BASE_URL 就先用真的，網路類錯誤才落回示範資料（適合隨時給人看的場合）
//   'on'   一律示範模式（完全離線）
//
// 想臨時離線演示又不想改程式：到「開發自檢頁」把「離線示範模式」打開，
// 這個開關存在 storage（pv_force_demo），關掉就回到真 API。
module.exports = {
  API_BASE_URL: 'http://127.0.0.1:3100/api/v1', // 上線後換成已備案域名的 https 位址
  DEMO_MODE: 'off',
  TIMEOUT: 8000,
  RETRY: 1,
  STORAGE_KEYS: {
    token: 'pv_token',
    user: 'pv_user',
    demo: 'pv_demo_seed',
    forceDemo: 'pv_force_demo',
    apiBase: 'pv_api_base',
  },
};
