# 資料模型與 API 契約 v1

> 對應檔案：`docs/openapi.yaml`（本倉庫）｜ `prisma/schema.prisma`（後端倉庫 pui-va-campus-server，資料庫唯一來源）
> 資料庫：PostgreSQL 16 ｜ ORM：Prisma ｜ 風格：RESTful + JSON

---

## 1. 資料表總覽（13 張）

| 表 | 用途 | 關鍵設計 |
|---|---|---|
| `users` | 師生身份（openid、角色、班級） | `openid` unique；`role` = SUPER_ADMIN / ADMIN / TEACHER / STUDENT（**未登入不是角色，是沒有 JWT 的狀態**）；權限矩陣見後端 後端 repo 的 `docs/03-權限分級.md` |
| `categories` | 失物分類（卡證、電子、書本…） | `applicableTo` 區分失物／拾獲 |
| `lost_items` | 失物與拾獲主表 | `type` + `status` 狀態機；soft delete `deletedAt` |
| `item_images` | 失物圖片（1–3 張） | 存 COS key；`sortOrder` 控制封面 |
| `item_claims` | 認領申請 | `unique(itemId, claimantId)` 防重複申請 |
| `clubs` | 社團 | — |
| `events` | 活動與通告 | `capacity` + `signedCount` 支援樂觀鎖 |
| `event_signups` | 報名記錄 | `unique(eventId, userId)`；`WAITLIST` + `waitlistPos` |
| `dishes` | 菜式（午餐／小賣部） | `tags[]` 陣列；`mealType` |
| `menu_entries` | 每日菜單排程 | `unique(date, mealType, dishId)` |
| `dish_ratings` | 評分與點讚 | `unique(dishId, userId)` 一人一評 |
| `notices` | 公告／校曆／緊急 | `kind` + `isPinned` + `expiresAt` |
| `audit_logs` | 管理端審計 | 操作者、動作、目標、payload |

> `reports`（舉報）以 `targetType + targetId` 多型方式設計，Prisma 不支援多型 FK，故不建外鍵，於服務層保證一致性。

**索引策略**：所有列表查詢都有對應複合索引（`type+status`、`status+startAt`、`date`、`kind+publishedAt`），避免上線後才補索引。

---

## 2. 兩個狀態機（答辯會問）

### 失物 `lost_items.status`
```
OPEN ──(系統匹配到對方)──► MATCHED ──(認領獲批)──► CLAIMED ──(交接完成)──► CLOSED
  └──────────(發布者撤銷 / 逾期 30 天)──────────────────────────────────► CLOSED
```
- 認領申請 `item_claims.status`：`PENDING → APPROVED / REJECTED`
- 只有 `authorId` 本人（或 ADMIN）能審批；`APPROVED` 時把 item 推進到 `CLAIMED`

### 活動報名 `event_signups.status`
```
報名 ──有空位──► CONFIRMED
     └─滿員────► WAITLIST(waitlistPos = 目前候補數 + 1)
取消 ──► CANCELLED（若原為 CONFIRMED 且有人候補 → 自動補位並發訂閱消息）
```

簽到（v0.24.0）不另開表：`event_signups.checkedInAt` ＋ `checkedInBy`（誰簽的：自己或代簽老師），
活動上只有一組 `checkInCode`／`checkInActive`／`checkInOpenedAt` —— 一次只會開一個簽到時段，
多開一張 `checkin_sessions` 表只是為了歷史時段，代價大於收益。出席率 = 已簽到 ÷ 正取，沒有人報名時回 `null`（不是 0%）。

---

## 3. 併發正確性：名額樂觀鎖（技術亮點）

**不做**：先 `SELECT signed_count` 再判斷（兩個請求同時通過 → 超賣）。

**做**：單條 SQL 原子更新，以影響行數判斷結果。
```sql
UPDATE events
   SET signed_count = signed_count + 1, updated_at = now()
 WHERE id = $1
   AND (capacity = 0 OR signed_count < capacity)
   AND status = 'PUBLISHED';
-- rowCount = 0 → 已滿員 → 進候補
```
取消時對稱：`signed_count = signed_count - 1 WHERE signed_count > 0`，並在同一交易內把最早的 `WAITLIST` 升為 `CONFIRMED`。

---

## 4. API 統一規範

| 項目 | 規範 |
|---|---|
| Base URL | `https://<已備案域名>/api/v1` |
| 認證 | `Authorization: Bearer <JWT>`；登入端點除外 |
| 身分來源 | 只信 JWT 內的 `sub`（userId），**不接受前端傳 userId** |
| 分頁 | `?page=1&pageSize=20`（上限 50），回 `{ items, page, pageSize, total, hasMore }` |
| 時間 | 一律 ISO 8601 UTC（`2026-10-22T12:00:00Z`），前端轉 +08:00 |
| 錯誤格式 | `{ "error": { "code": "EVENT_FULL", "message": "活動名額已滿", "details": {...} } }` |
| 冪等 | 報名／認領等寫入端點要求 `Idempotency-Key` 標頭（可選但建議） |
| 速率限制 | 每使用者 60 req/min，發布類 10 req/min |
| 內容安全 | 所有文字／圖片寫入前過 `msgSecCheck` / `imgSecCheck`，失敗回 `CONTENT_RISKY` |

### 錯誤碼（節錄）
| code | HTTP | 說明 |
|---|---|---|
| `UNAUTHORIZED` | 401 | JWT 缺失／過期 |
| `FORBIDDEN` | 403 | 角色不足（非老師／非作者） |
| `NOT_FOUND` | 404 | 資源不存在或已刪除 |
| `VALIDATION_FAILED` | 422 | 欄位驗證失敗，`details` 帶欄位級錯誤 |
| `EVENT_FULL` | 409 | 名額已滿（可改報候補） |
| `ALREADY_SIGNED_UP` | 409 | 重複報名 |
| `ALREADY_CLAIMED` | 409 | 已有人認領／已申請 |
| `CONTENT_RISKY` | 422 | 內容安全檢查未通過 |
| `RATE_LIMITED` | 429 | 觸發限流 |

---

## 5. 端點一覽（47 個操作 / 42 條路徑，全部已在 `docs/openapi.yaml` 定義並驗證）

### 認證 `/auth`
| 方法 | 路徑 | 說明 |
|---|---|---|
| POST | `/auth/login` | `{ code }` → `{ token, user }`（首次自動建帳號） |
| GET | `/auth/me` | 當前使用者＋未讀公告數 |
| PATCH | `/auth/me` | 更新暱稱／班級（頭像走 `wx.getUserProfile`） |

### 失物 `/items`
| 方法 | 路徑 | 說明 |
|---|---|---|
| GET | `/items` | 篩選：`type` `categoryId` `status` `q` `page` |
| POST | `/items` | 發布（含 `images[]` key） |
| GET | `/items/:id` | 詳情（含作者、認領申請數、相似推薦 3 條） |
| PATCH | `/items/:id` | 作者或 ADMIN 修改 |
| DELETE | `/items/:id` | soft delete |
| POST | `/items/:id/claims` | 申請認領 |
| POST | `/items/:id/claims/:claimId/review` | 作者審批 `{ approve: bool }` |
| GET | `/items/mine` | 我發布的 |
| GET | `/items/matches` | 智能匹配推薦（見 §6） |

### 活動 `/events`
| 方法 | 路徑 | 說明 |
|---|---|---|
| GET | `/events` | `status` `clubId` `from` `to` |
| GET | `/events/:id` | 詳情＋我是否已報名 |
| POST | `/events/:id/signup` | 報名（樂觀鎖） |
| DELETE | `/events/:id/signup` | 取消（觸發候補補位） |
| GET | `/events/mine` | 我的報名（含候補位置與簽到時間 `checkedInAt`） |
| POST | `/events/checkin` | 現場簽到（只認 6 位碼，**不接受前端傳 eventId**；非正取 422，重複掃回 `already: true`） |
| GET | `/events/:id/checkin` | 老師簽到看板（`event:checkin`）：碼、QR data URL、已簽到／正取、出席率 |
| POST | `/events/:id/checkin/open` | 開始簽到（每次換新碼，舊碼立即失效） |
| POST | `/events/:id/checkin/close` | 結束簽到（碼留紀錄但掃了失效） |
| GET | `/events/:id/attendance` | 出席名單（正取在前，含候補供核對） |
| PATCH | `/admin/events/:id/signups/batch` | 批次：`PROMOTE_ALL`／`CANCEL`／`CHECK_IN`／`CHECK_OUT`（代簽只動正取） |

### 菜單 `/dishes` `/menu`
| 方法 | 路徑 | 說明 |
|---|---|---|
| GET | `/menu?week=2026-W43` | 該週菜單（依日期分組） |
| GET | `/dishes/:id` | 菜式詳情＋平均分＋評分數 |
| POST | `/dishes/:id/ratings` | 評分 `{ score, liked, comment? }`（upsert） |
| GET | `/dishes/top` | 熱門 TOP N（`?days=7`） |

### 公告 `/notices`
| 方法 | 路徑 | 說明 |
|---|---|---|
| GET | `/notices` | `kind` `pinnedOnly`；預設排除 `expiresAt < now` |
| GET | `/notices/:id` | 詳情 |
| POST | `/notices/:id/read` | 標記已讀（前端本地快取 + 後端計數） |

### 上傳與訂閱 `/uploads` `/subscriptions`
| 方法 | 路徑 | 說明 |
|---|---|---|
| POST | `/uploads/policy` | 回 COS 直傳簽名（`key`, `url`, `headers`, `expiresAt`） |
| POST | `/subscriptions` | 記錄使用者同意的模板（`itemClaimed` / `eventOpen` / `urgentNotice`） |

### 家長 `/parents`（需角色 PARENT；`parentId` 一律取自 JWT）
| 方法 | 路徑 | 說明 |
|---|---|---|
| GET | `/parents/me/children` | 我的子女（`linkId`／關係／暱稱／班級） |
| GET | `/parents/me/children/:studentId` | 子女概況：報名、認領件數、未讀公告；**沒有綁定一律 403** |
| GET | `/parents/me/children/:studentId/items` | 子女發布的失物／拾獲（唯讀） |
| GET | `/parents/me/children/:studentId/claims` | 子女提出的認領申請（唯讀） |
| GET | `/admin/parents` | 綁定列表＋關鍵字（`parent:manage`） |
| POST | `/admin/parents/link` | 建立綁定（`parentAccount`／`studentAccount`／`relation`） |
| DELETE | `/admin/parents/link/:id` | 解除綁定 |

> 隔離規則：`studentId` 只是查詢鍵，必須存在於 `parent_links` 才算數；未綁定回 **403 且訊息固定**（不區分「不存在」與「不是你的孩子」），避免學號探測。

### 管理 `/admin`（需 TEACHER / ADMIN）
| 方法 | 路徑 | 說明 |
|---|---|---|
| GET | `/admin/items?status=OPEN&page=1&pageSize=20` | 失物清單（含已下架，需 item:moderate） |
| PATCH | `/admin/items/:id` | 下架／恢復（body `{action: REMOVE／RESTORE}`，寫審計） |
| POST | `/admin/notices` | 發公告（可推訂閱消息） |
| POST | `/admin/menu` | 排菜單（同日同餐別覆蓋為指定菜色，body `{date, mealType, dishIds}`） |
| GET | `/admin/events/:id/signups.csv` | 匯出報名名單 |
| GET | `/admin/stats` | 營運看板（使用者與角色分布／失物／待審認領／報名／平均評分，需 stats:read） |

---

## 6. 智能匹配（亮點 1 的 API 契約）

`GET /items/matches?itemId=xxx` 回：
```json
{ "matches": [ { "id": "...", "title": "藍色水壺", "score": 0.83,
                 "reasons": ["同分類", "同地點", "描述相似 72%"] } ] }
```
排序權重（可調）：分類相同 `+0.35`、地點相似（`pg_trgm`）`+0.25`、時間差 <72h `+0.15`、標題/描述 `similarity()` 加權 `+0.25`。低於 0.45 不回傳，避免噪音。

---

## 7. 前端需要遵守的三條

1. **不要在客戶端過濾分頁資料**：所有篩選走 API 參數，保證排行榜與總數一致
2. **不要樂觀假設報名成功**：以 HTTP 409 + `EVENT_FULL` 為準，前端只做 loading 態
3. **圖片先要 policy 再直傳**：不要把 base64 塞進 API body（會打爆 2MB 限制）
