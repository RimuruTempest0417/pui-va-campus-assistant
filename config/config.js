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
  VERSION: '0.80.0', // 版本號唯一來源（設定頁「關於」顯示；發版時改這裡＋docs/releases）
  API_BASE_URL: 'https://pui-va-campus-server.vercel.app/api/v1', // 雲端 API（Vercel + Neon）；本機開發改成 http://127.0.0.1:3100/api/v1
  DEMO_MODE: 'off',

  // 傳輸方式：
  //   'https' → 直接打 API_BASE_URL（開發版／真機調試可用；正式版要求域名已 ICP 備案）
  //   'cloud' → 走微信雲開發雲函數 apiProxy（不需要備案，需要正式或教育版 appid）
  TRANSPORT: 'https',
  CLOUD_FUNCTION: 'apiProxy',
  CLOUD_ENV: '', // 留空＝用默認環境
  // 訂閱消息模板 ID（在 mp 後台「訂閱消息」建立後填入；留空＝不彈出詢問）
  SUBSCRIBE_TEMPLATES: {
    claim: '', // 認領結果通知
    event: '', // 候補補位／活動通知
    notice: '', // 緊急公告
  },
  // 介面語言：'zh-Hant'（繁體，預設）／'zh-Hans'（簡體）。只影響介面文案，不改資料內容。
  // 使用者可在開發自檢頁切換，存在 storage（pv_locale）。
  LOCALE: 'zh-Hant',
  TIMEOUT: 8000,
  RETRY: 1,
  STORAGE_KEYS: {
    token: 'pv_token',
    user: 'pv_user',
    demo: 'pv_demo_seed',
    forceDemo: 'pv_force_demo',
    apiBase: 'pv_api_base',
    locale: 'pv_locale',
    diag: 'pv_diag', // console 走查收集器（utils/diagnostics.js）
  },
};
