# 貢獻指南

本專案是**校內考試與專題評核作品**（不參加比賽），協作者以校內同學與老師為主。

## 環境

- 微信開發者工具（Stable）
- 後端另見 [pui-va-campus-server](https://github.com/RimuruTempest0417/pui-va-campus-server)

## 本地開發

1. 微信開發者工具 → 導入本倉庫根目錄（`project.config.json` 已設定好，無需 `miniprogramRoot`）
2. 直接編譯預覽；請求本地 API 時，在開發者工具「詳情 → 本地設置」勾選 **不校驗合法域名、HTTPS 憑證**
3. 提交前跑一次結構檢查：

```bash
node scripts/check-project.mjs
```

它會驗證：所有 JSON 可解析、`app.json` 的頁面四件套齊全、`usingComponents` 指向的組件存在。

## Commit 訊息

Conventional Commits + 中文描述：

```
feat(items): 失物列表支援依地點篩選
fix(index): 修正首頁在 Skyline 下捲動失效
docs(blueprint): 補上評分對標的證據欄位
```

## PR 要求

- 一個 PR 只做一件事
- 涉及 API 呼叫時，契約以 `docs/openapi.yaml` 為準，變更要同步文件
- 新增頁面必須同時補 `app.json` 的 `pages` 並在模擬器驗證（含 console 零 error）
