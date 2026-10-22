# 培華校園助手 · Pui Va Campus Assistant

> 為澳門培華中學師生打造的校園服務小程序
> 學校考試作品 ｜ 參加微信小程序開發大賽

[![CI](https://github.com/RimuruTempest0417/pui-va-campus-assistant/actions/workflows/ci.yml/badge.svg)](https://github.com/RimuruTempest0417/pui-va-campus-assistant/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-2ea44f.svg)](LICENSE)

校園裡每天發生四件高頻小事：**東西丟了找不到人、活動報名靠群裡接龍、今天午餐吃什麼、重要通知埋在群訊息裡**。
本項目把這四類校內資訊流做成可互動、有狀態、能閉環的產品——不是把學校官網搬進小程序，而是讓每一條校園資訊都有狀態、有用戶、有數據回饋。

> 本倉庫根目錄**就是**微信小程序的專案根目錄，可直接用微信開發者工具導入。
> 後端 API 獨立倉庫：[pui-va-campus-server](https://github.com/RimuruTempest0417/pui-va-campus-server)

---

## 功能範圍

| 模組 | 核心能力 | 狀態 |
|---|---|---|
| 校園失物招領 | 發布（失物／拾獲）、圖片、地點、分類篩選、狀態機（待認領 → 已認領 → 已完成）、智能匹配推薦 | 規劃完成 |
| 活動與社團 | 活動列表與詳情、線上報名、名額樂觀鎖防超賣、候補隊列、訂閱消息提醒 | 規劃完成 |
| 午餐與小賣部 | 當週菜單視圖、菜式評分與點讚、每週人氣排行 | 規劃完成 |
| 公告與溫馨提示 | 置頂／緊急／校曆分類、詳情、訂閱推送 | 規劃完成 |
| 老師端管理後台 | 審核失物、發布公告、排菜單、匯出報名名單 | 規劃完成 |

> 不含地圖／導覽功能；不使用微信雲開發（後端另行自建）。

## 技術棧

| 層 | 選型 |
|---|---|
| 前端 | 微信小程序原生 + Skyline 渲染引擎 + glass-easel 組件框架 |
| UI | 自建原子組件庫 + design tokens（避開第三方庫在 Skyline 下的相容性風險） |
| 後端 | Node.js + Fastify + Prisma ORM（RESTful API，獨立部署） |
| 資料庫 | PostgreSQL（開發期 Supabase／上線期騰訊雲，同 schema 平移） |
| 圖片 | 騰訊雲 COS + CDN，客戶端簽名直傳 |
| 認證 | `wx.login` → `code2Session` → 自簽 JWT |

## 目錄結構

```
.
├── app.js / app.json / app.wxss    # 全局入口
├── pages/                          # 頁面
│   └── index/
├── components/                     # 自建組件
│   └── navigation-bar/
├── docs/                           # 設計文件（藍圖、架構、資料模型、API 契約）
│   ├── 01-藍圖與競賽對標.md
│   ├── architecture.html
│   ├── 02-資料模型與API.md
│   ├── openapi.yaml
│   └── releases/                # 版本說明（每版一份）
├── scripts/check-project.mjs       # 結構檢查（CI 用）
├── .github/workflows/ci.yml        # CI：結構檢查 + JSON 解析
├── project.config.json             # 開發者工具專案設定（含 appid）
└── README.md
```

> `docs/` 與 `README.md` 已在 `project.config.json` 的 `packOptions.ignore` 中排除，不會被打包進小程序。

## 本地開發

1. 微信開發者工具 → 導入專案 → 選擇本倉庫根目錄
2. 直接編譯預覽（appid：`wx9f104c034c07e15f`）
3. `project.private.config.json` 為個人本機設定，已加入 `.gitignore`
4. 提交前跑結構檢查：`node scripts/check-project.mjs`（CI 也會跑）

## 目前進度

- [x] 產品定位、痛點分析、功能地圖（P0/P1/P2）
- [x] 競賽評分對標與系統架構設計
- [ ] 設計系統（色彩／字級／組件規範）
- [x] 資料模型與 RESTful API 契約（13 張表在後端倉庫 `prisma/schema.prisma`；`docs/openapi.yaml` 32 個操作）
- [ ] 前端 P0 四大模組
- [ ] 後端 API 與圖片直傳
- [ ] 上線（ICP 備案 → 提審 → 灰度）

## 授權

校內教學與競賽用途。程式碼與設計文件版權歸作者所有。
