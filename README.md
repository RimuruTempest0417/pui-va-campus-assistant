# 培華校園助手 · Pui Va Campus Assistant

> 為澳門培華中學師生打造的校園服務小程序
> 校內考試與學年專題評核作品（**不參加比賽**）

[![CI](https://github.com/RimuruTempest0417/pui-va-campus-assistant/actions/workflows/ci.yml/badge.svg)](https://github.com/RimuruTempest0417/pui-va-campus-assistant/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-2ea44f.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.20.0-6D3FC4.svg)](docs/releases)

> **目標**：這是一個**考試與測驗導向**的作品 —— 以校內評核標準（功能完整度／技術難度／設計與體驗／文件與演示）交付，
> 不做對外報名、不追求上架審核。因此「學校能不能給正式主體」不再是關鍵路徑，重點是「打開就能完整跑通」。

校園裡每天發生四件高頻小事：**東西丟了找不到人、活動報名靠群裡接龍、今天午餐吃什麼、重要通知埋在群訊息裡**。
本項目把這四類校內資訊流做成可互動、有狀態、能閉環的產品——不是把學校官網搬進小程序，而是讓每一條校園資訊都有狀態、有用戶、有數據回饋。

> 本倉庫根目錄**就是**微信小程序的專案根目錄，可直接用微信開發者工具導入。
> 後端 API 獨立倉庫：[pui-va-campus-server](https://github.com/RimuruTempest0417/pui-va-campus-server)

---

## 功能範圍

| 模組 | 核心能力 | 前端 | 後端 |
|---|---|---|---|
| 校園失物招領 | 發布（失物／拾獲）、分類篩選、狀態機（待認領 → 已匹配 → 已認領 → 已完成）、認領申請與審批、我的發布、**智能匹配推薦** | ✅ 4 頁 | ✅ 含審批、權限守衛、pg_trgm 匹配 |
| 活動與社團 | 列表（即將開始／已結束）、詳情、線上報名、名額行鎖防超賣、候補隊列與自動補位、我的報名 | ✅ 3 頁 | ✅ 20 併發壓測通過 |
| 午餐與小賣部 | 週菜單（可切上／下週）、午餐與小賣部分區、1–5 星評分、點讚、每週熱門排行 | ✅ 2 頁 | ✅ 一人一評 upsert |
| 公告與溫馨提示 | 置頂／緊急／校曆分類、詳情、已讀狀態、過期自動隱藏 | ✅ 2 頁 | ✅ 每人各自已讀 |
| 校內管理（小程序內建） | 概況、認領、失物、活動、公告、使用者、檢舉、審計、名單、菜單 | ✅ 10 個分頁 | ✅ 依能力矩陣分權 |

> 不含地圖／導覽功能；不使用微信雲開發（後端另行自建）。

## 技術棧

| 層 | 選型 | 理由 |
|---|---|---|
| 前端 | 微信小程序原生 + **Skyline** 渲染引擎 + glass-easel 組件框架 | 只發一端，跨端框架是額外成本；Skyline 是微信 2023 後的主力渲染引擎 |
| UI | 自建 9 個組件 + design tokens | Vant Weapp／TDesign 在 Skyline 下相容性差；自建才能統一品牌色與按壓手感 |
| 後端 | Fastify 5 + TypeScript（ESM）+ Prisma 6 | 與前端同語言；Prisma schema 即文件；Fastify 啟動快、外掛生態足夠 |
| 資料庫 | PostgreSQL 16（開發本機／上線騰訊雲，同 schema 平移） | 支援關聯查詢與 `pg_trgm`（W-9 智能匹配要用） |
| 圖片 | 騰訊雲 COS + CDN，**簽名直傳**（圖片不經過 API） | 省頻寬、避開 1 MB body 限制 |
| 認證 | `wx.login` → `code2Session` → 自簽 JWT | 不用微信雲開發，身分仍由微信保證 |

## 資料來源：預設連真後端（不是示範版）

**預設 `DEMO_MODE: 'off'`，一律打真 API。** 後端沒開就會看到錯誤與重試，不會偷偷換成假資料——
「刷新一下就變示範版」這種事不會再發生。

| 設定 | 行為 |
|---|---|
| `'off'`（**預設**） | 只用真 API；連不上就是連不上（首頁會顯示失敗與重試） |
| `'auto'` | 先打真 API，網路類錯誤才落回本地 mock（適合隨時給人看的場合） |
| `'on'` | 一律本地 mock（完全離線） |

**要離線演示又不想改程式**：首頁拉到底部點「資料來源」→ 打開「**離線示範模式**」開關。
這個開關存在本地 storage（`pv_force_demo`），關掉立刻回到真 API，不需要重新編譯。

未登入也能瀏覽（訪客）：首頁、失物、活動、菜單、公告都會正常載入，只有發布／認領／報名／評分會提示「請先登入」。

頁面只 require `services/data.js` 一個入口，所以切模式不用改任何頁面。

## 目錄結構

```
.
├── app.js / app.json / app.wxss          # 全局入口（14 個頁面註冊）
├── pages/
│   ├── index/                            # 首頁：四模組入口、緊急公告、今日午餐
│   ├── items/{list,detail,create,mine}/  # 失物招領
│   ├── events/{list,detail,mine}/        # 活動與社團
│   ├── menu/{index,dish}/                # 午餐與小賣部
│   ├── notices/{list,detail}/            # 公告與提示
│   ├── style-guide/                      # 設計系統展示頁
│   └── dev/api-check/                    # 開發自檢頁（9 項互動檢查）
├── components/                           # pv-navbar / pv-button / pv-card / pv-tag
│   └── …                                 # pv-avatar / pv-empty / pv-skeleton / pv-tabs / pv-sheet
├── styles/{tokens.wxss,ui.wxss}          # design tokens 與共用樣式
├── services/{api.js,mock.js,data.js}     # 真 API／示範資料／唯一資料入口
├── utils/{request,errors,date,event,week,notice,item,nav}.js
├── config/config.js                      # API_BASE_URL、DEMO_MODE
├── scripts/
│   ├── check-project.mjs                 # 結構／WXSS／白屏守門
│   └── check-data-layer.mjs              # 資料層自檢（Node 跑，36 項）
├── docs/
│   ├── 01-藍圖與評分對標.md
│   ├── 02-資料模型與API.md
│   ├── openapi.yaml                      # API 契約（與後端實作對齊）
│   ├── architecture.html                 # 系統架構圖
│   ├── 規劃書-待完成.md                  # 還沒做的事（完成就刪除該節）
│   └── releases/                         # 每版一份版本說明
├── project.config.json                   # 開發者工具專案設定（含 appid）
└── .github/workflows/ci.yml              # CI：結構檢查 + 資料層自檢
```

> `docs/` 與 `README.md` 已在 `project.config.json` 的 `packOptions.ignore` 中排除，不會被打包進小程序。

## 打包交付（給老師）

```bash
node scripts/package.mjs     # → dist/pui-va-campus-assistant-vX.Y.Z.zip
```

會自動排除 `.git`／`node_modules`／`docs`／`.github`／個人設定，並把 `docs/交付給老師.md` 複製成包內的 `使用說明.md`；
打包後會驗證四個模組的頁面都在包內。zip 約 120 KB。

## 本地開發

```bash
# 結構與資料層自檢（CI 也會跑）
node scripts/check-project.mjs     # 14 頁面 / 0 警告
node scripts/check-data-layer.mjs  # ALL PASS 39/39（固定跑示範資料層，含 data↔api↔mock 方法對齊）
```

1. 微信開發者工具 → 導入專案 → 選擇本倉庫根目錄
2. 直接編譯預覽（appid：`wx9f104c034c07e15f`）；**不跑後端也能操作**（示範模式）
3. 後端：`npm run dev`（`127.0.0.1:3100`），`config/config.js` 預設就指向它；開發者工具要勾「不校驗合法域名」
4. `project.private.config.json` 為個人本機設定，已加入 `.gitignore`

## 目前進度

- [x] 產品定位、痛點分析、功能地圖（P0/P1/P2）
- [x] 評分對標與系統架構設計
- [x] 設計系統（品牌色、6 級字級、9 個組件、展示頁）
- [x] 資料模型與 RESTful API 契約（14 張表；`docs/openapi.yaml`）
- [x] 請求層與示範模式（JWT 注入、8s 逾時、重試、錯誤正規化）
- [x] **前端 P0 四大模組**（失物 4 頁、活動 3 頁、菜單 2 頁、公告 2 頁 ＋ 首頁、自檢頁、展示頁）
- [x] 後端 P0 端點（認領審批、報名行鎖＋候補、菜單評分、公告已讀、上傳簽名）
- [x] **失物智能匹配**（pg_trgm 加權評分 + 詳情頁「可能是你的東西」）
- [x] 後端 e2e（真實 Postgres，27 項，含 20 併發超賣壓測）
- [x] 老師端管理後台（W-10）：10 個分頁，含**使用者管理**（建立帳號／改名／改帳號／改密碼／改等級／停用／刪除／權限說明）
- [x] 訂閱消息（W-11）
- [x] 雲端部署（W-15）：Vercel + Neon，API `https://pui-va-campus-server.vercel.app/api/v1`
- [x] 交付給老師的一鍵包與 5 步說明（W-12：`node scripts/package.mjs`）
- [ ] 上線（ICP 備案 → 提審 → 灰度）

詳細待辦與順序見 [`docs/規劃書-待完成.md`](docs/規劃書-待完成.md)，每版變更與驗證數據見 [`docs/releases/`](docs/releases)。

## 授權

校內教學與專題評核用途。程式碼與設計文件版權歸作者所有。
