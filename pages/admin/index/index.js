const i18n = require('../../../utils/i18n');
const admin = require('../../../services/admin');
const request = require('../../../utils/request');
const config = require('../../../config/config');
const { dateKey, fromNow, dateTimeText } = require('../../../utils/date');
const role = require('../../../utils/role');
const theme = require('../../../utils/theme');
const { decorateBook, decorateLoan } = require('../../../utils/book');
const venueUtil = require('../../../utils/venue');
const giveawayUtil = require('../../../utils/giveaway');

const TABS = [
  { key: 'stats', label: i18n.pick('概況') },
  { key: 'claims', label: i18n.pick('認領') },
  { key: 'items', label: i18n.pick('失物') },
  { key: 'trash', label: i18n.pick('垃圾桶') },
  { key: 'events', label: i18n.pick('活動') },
  { key: 'notice', label: i18n.pick('公告') },
  { key: 'school', label: i18n.pick('成績') },
  { key: 'users', label: i18n.pick('使用者') },
  { key: 'parents', label: i18n.pick('家長') },
  { key: 'reports', label: i18n.pick('檢舉') },
  { key: 'errors', label: i18n.pick('錯誤') },
  { key: 'push', label: i18n.pick('推送') },
  { key: 'audit', label: i18n.pick('審計') },
  { key: 'export', label: i18n.pick('名單') },
  { key: 'menu', label: i18n.pick('菜單') },
  { key: 'library', label: i18n.pick('圖書館') },
  { key: 'venues', label: i18n.pick('場地') },
  { key: 'giveaways', label: i18n.pick('轉贈') },
  { key: 'leaves', label: i18n.pick('假單') },
  { key: 'timetable', label: i18n.pick('課表') },
  { key: 'homework', label: i18n.pick('功課') },
  { key: 'demo', label: i18n.pick('示範資料') },
];

// 學段三個固定值（後端 TERMS）：key 必須送原文，簡體下字形相同所以直接用 pick 的結果當 key
const TERM_KEYS = [i18n.pick('第一段'), i18n.pick('第二段'), i18n.pick('第三段')];

const ROLE_TABS = {
  // 校內職員：排菜單＋匯出報名名單＋補登成績。沒有 event:create（不能開活動）、沒有 notice:create（不能發公告）
  STAFF: ['notice', 'claims', 'school', 'menu', 'library', 'venues', 'giveaways', 'leaves', 'timetable', 'export'],
  TEACHER: ['notice', 'school', 'events', 'venues', 'leaves'],
  ADMIN: ['stats', 'claims', 'items', 'trash', 'events', 'notice', 'school', 'users', 'parents', 'reports', 'errors', 'push', 'export', 'menu', 'library', 'venues', 'giveaways', 'leaves', 'timetable', 'homework'],
  SUPER_ADMIN: ['stats', 'claims', 'items', 'trash', 'events', 'notice', 'school', 'users', 'parents', 'reports', 'errors', 'push', 'audit', 'export', 'menu', 'library', 'venues', 'giveaways', 'leaves', 'timetable', 'homework', 'demo'],
};

// 離線備援：線上一律用 GET /admin/users 回來的 roles（帶 level，後端單一來源）。
// level 不能少 —— 下面的「設為 X」按鈕靠 item.level > r.level 判斷，缺了就永遠不顯示。
const ROLES = [
  { key: 'PARENT', level: 1, label: i18n.pick('家長') },
  { key: 'STUDENT', level: 1, label: i18n.pick('學生') },
  { key: 'TEACHER', level: 2, label: i18n.pick('老師') },
  { key: 'STAFF', level: 2, label: i18n.pick('校內職員') },
  { key: 'ADMIN', level: 3, label: i18n.pick('資訊管理員') },
];


const appearance = require('../../../utils/appearance');

/**
 * W-42：編輯衝突保護的共用收尾。
 *
 * `CONFLICT` 代表「別人先存過了」—— 提示後**重抓清單**，但**不把這次的修改偷偷重送**：
 * 偷偷重送就等於讓後存的人蓋掉前一位，正是這道鎖要擋掉的事。
 */
function onWriteError(err, reload) {
  if (err && err.code === 'CONFLICT') {
    wx.showModal({
      title: i18n.pick('這筆剛被別人改過'),
      content: i18n.pick('你看到的不是最新版本，已重新載入，請確認後再操作一次。'),
      showCancel: false,
    });
    if (typeof reload === 'function') reload();
    return;
  }
  wx.showToast({ title: (err && err.message) || i18n.pick('操作失敗'), icon: 'none' });
}

/**
 * W-42：WXML 的 `data-version` 一律是字串（甚至可能是 undefined），
 * 只有真的是數字才放進 payload；沒有就不帶欄位＝後端維持舊行為（相容）。
 */
function versionPatch(dataset) {
  const v = Number((dataset || {}).version);
  return Number.isFinite(v) ? { version: v } : {};
}

Page({
  labels() {
    return {
      k100: i18n.pick("（未設定）"),
      k101: i18n.pick("已簽到"),
      k102: i18n.pick("未簽到"),
      k103: i18n.pick("候補"),
      k104: i18n.pick("撤銷"),
      k105: i18n.pick("代簽"),
      k106: i18n.pick("已取消"),
      k107: i18n.pick("報名中"),
      k108: i18n.pick("不限"),
      k109: i18n.pick("恢復"),
      k110: i18n.pick("取消活動"),
      k111: i18n.pick(" · 已停用"),
      k112: i18n.pick(" · 最後登入 "),
      k113: i18n.pick("停用"),
      k114: i18n.pick("匿名"),
      k115: i18n.pick("沒有待處理的錯誤"),
      k116: i18n.pick("沒有已解決的紀錄"),
      k117: i18n.pick("（未記錄頁面）"),
      k118: i18n.pick("標記已解決"),
      k119: i18n.pick("重新打開"),
      k120: i18n.pick("正取"),
      k121: i18n.pick("候補 "),
      k122: i18n.pick("午餐"),
      k123: i18n.pick("小賣部"),
      k124: i18n.pick("菜單"),
      k125: i18n.pick('活動'),
      k126: i18n.pick('列印清單'),
      k127: i18n.pick('列印名單'),
      k128: i18n.pick('同類一次解決'),
      k131: i18n.pick('清理舊紀錄'),
      k132: i18n.pick('推送紀錄'),
      k133: i18n.pick('總計'),
      k134: i18n.pick('成功'),
      k135: i18n.pick('失敗紀錄'),
      k136: i18n.pick('近 24 小時'),
      k137: i18n.pick('全部通路'),
      k138: i18n.pick('站內通知'),
      k139: i18n.pick('微信消息'),
      k140: i18n.pick('沒有推送紀錄'),
      k141: i18n.pick('發一則公告，或有人報名活動之後，這裡會出現每一筆發送的結果'),
      k142: i18n.pick('（無標題）'),
      k143: i18n.pick('原因：'),
      // W-40 資源回收桶（新增區塊一律用固定號碼，不要重跑遷移腳本重新編號）
      k145: i18n.pick('垃圾桶'),
      k146: i18n.pick('刪掉的公告與下架的失物會先放在這裡，按還原就回到原本的分頁；這裡不做永久刪除。'),
      k147: i18n.pick('公告'),
      k148: i18n.pick('失物'),
      k149: i18n.pick('合計'),
      k150: i18n.pick('筆'),
      k151: i18n.pick('刪除時間'),
      k152: i18n.pick('誰刪的'),
      k153: i18n.pick('還原'),
      k154: i18n.pick('垃圾桶是空的'),
      k155: i18n.pick('刪掉或下架的內容會出現在這裡'),
      k156: i18n.pick('（未記錄）'),
      k85: i18n.pick("已下架"),
      k86: i18n.pick("拾獲"),
      k87: i18n.pick("遺失"),
      k88: i18n.pick("緊急"),
      k89: i18n.pick("校曆"),
      k90: i18n.pick("一般"),
      k91: i18n.pick("取消置頂"),
      k92: i18n.pick("置頂"),
      k93: i18n.pick("已滿"),
      k94: i18n.pick("不限名額"),
      k95: i18n.pick("有名額"),
      k96: i18n.pick("開放中"),
      k97: i18n.pick("未開放"),
      k98: i18n.pick("換一張新碼"),
      k99: i18n.pick("開始簽到"),
      k01: i18n.pick("管理"),
      k02: i18n.pick("讀取失敗"),
      k03: i18n.pick("重試"),
      k04: i18n.pick("使用者"),
      k05: i18n.pick("未認領失物"),
      k06: i18n.pick("待審認領"),
      k07: i18n.pick("正取報名"),
      k08: i18n.pick("候補中"),
      k09: i18n.pick("有效公告"),
      k10: i18n.pick("登出"),
      k11: i18n.pick("沒有待審申請"),
      k12: i18n.pick("學生提出認領後會出現在這裡"),
      k13: i18n.pick("通過"),
      k14: i18n.pick("拒絕"),
      k15: i18n.pick("恢復"),
      k16: i18n.pick("下架"),
      k17: i18n.pick("標題"),
      k18: i18n.pick("內容"),
      k19: i18n.pick("類型"),
      k20: i18n.pick("置頂"),
      k21: i18n.pick("發布公告"),
      k22: i18n.pick("刪除"),
      k23: i18n.pick("新增活動"),
      k24: i18n.pick("活動名稱"),
      k25: i18n.pick("地點（可空）"),
      k26: i18n.pick("日期 YYYY-MM-DD"),
      k27: i18n.pick("名額（0 = 不限）"),
      k144: i18n.pick("開放組隊報名（隊長建隊拿 6 碼邀請碼）"),
      k28: i18n.pick("分組（可空，例：A組,B組）"),
      k29: i18n.pick("建立活動"),
      k30: i18n.pick("匯入 CSV"),
      k31: i18n.pick("正取"),
      k32: i18n.pick("候補"),
      k33: i18n.pick("剩餘"),
      k34: i18n.pick("取消"),
      k35: i18n.pick("候補全部轉正"),
      k36: i18n.pick("收起"),
      k37: i18n.pick("按「開始簽到」產生 6 位碼與 QR；學生在小程序掃碼就完成簽到。"),
      k38: i18n.pick("結束簽到"),
      k39: i18n.pick("統計"),
      k40: i18n.pick("簽到"),
      k41: i18n.pick("權限說明"),
      k42: i18n.pick("新增帳號"),
      k43: i18n.pick("帳號（登入用）"),
      k44: i18n.pick("密碼（至少 8 位）"),
      k45: i18n.pick("顯示名稱（可空）"),
      k46: i18n.pick("建立帳號"),
      k47: i18n.pick("搜尋帳號或名稱"),
      k48: i18n.pick("搜尋"),
      k49: i18n.pick("全部"),
      k50: i18n.pick("名稱"),
      k51: i18n.pick("登入帳號"),
      k52: i18n.pick("新密碼（不填就不改）"),
      k53: i18n.pick("留空＝維持原密碼"),
      k54: i18n.pick("等級"),
      k55: i18n.pick("儲存"),
      k56: i18n.pick("編輯"),
      k57: i18n.pick("重設密碼"),
      k58: i18n.pick("同等或更高權限，只能查看"),
      k59: i18n.pick("新增綁定"),
      k60: i18n.pick("家長帳號（先到使用者分頁把角色設為家長）"),
      k61: i18n.pick("學生學號，例如 3201201001"),
      k62: i18n.pick("綁定"),
      k63: i18n.pick("還沒有任何綁定"),
      k64: i18n.pick("上方填家長帳號與學生學號即可建立"),
      k65: i18n.pick("解除綁定"),
      k66: i18n.pick("沒有待處理檢舉"),
      k201: i18n.pick("開放組隊報名（隊長建隊拿 6 碼邀請碼）"),
      k67: i18n.pick("待處理"),
      k68: i18n.pick("成立並下架"),
      k69: i18n.pick("駁回"),
      k70: i18n.pick("使用者手機上的白屏、閃退會自動出現在這裡"),
      k71: i18n.pick("沒有紀錄"),
      k72: i18n.pick("複製名單"),
      k73: i18n.pick("這個活動還沒有人報名"),
      k74: i18n.pick("日期"),
      k75: i18n.pick("餐別"),
      k76: i18n.pick("菜名（逗號分隔）"),
      k77: i18n.pick("例：葡式焗雞飯, 番茄蛋炒飯"),
      k78: i18n.pick("排入菜單"),
      k79: i18n.pick("移除"),
      k80: i18n.pick("這週還沒排菜"),
      k81: i18n.pick("把 CSV 貼在這裡，或按下面「選擇 CSV 檔」從聊天記錄挑一個"),
      k82: i18n.pick("選擇 CSV 檔"),
      k83: i18n.pick("先檢查"),
      k84: i18n.pick("確認匯入"),
      // v0.48.0 後台統計首頁（W-39）：第一屏五張數字卡
      // 注意：這裡的 key 一定要用「本檔還沒用過」的號碼 —— 舊版沿用 k100~k102，
      // 和上面出席名單的「（未設定）／已簽到／未簽到」撞號，後面的定義會靜默蓋掉前面的，
      // 結果簽到名單顯示成「累計／點卡片跳到對應分頁」。新增 key 前先 grep 一次最大號。
      k157: i18n.pick("本週概況"),
      k158: i18n.pick("累計"),
      k159: i18n.pick("點卡片跳到對應分頁"),
      // W-41：登入失敗鎖定（帳號層級，與 IP 限流互補）
      k160: i18n.pick(" · 已鎖定"),
      k161: i18n.pick("解除鎖定"),
      k162: i18n.pick("已解除鎖定"),
      // W-53 第二階段：小程序內補登成績與出缺席（k163 起固定號，不要重跑遷移腳本）
      k163: i18n.pick("找學生"),
      k164: i18n.pick("輸入學號、姓名或班別"),
      k165: i18n.pick("查詢"),
      k167: i18n.pick("成績"),
      k168: i18n.pick("出缺席"),
      k169: i18n.pick("學年（例如 2026/2027）"),
      k170: i18n.pick("科目（例如 數學）"),
      k171: i18n.pick("測驗類型（例如 大測一）"),
      k172: i18n.pick("分數（可留空）"),
      k173: i18n.pick("補登成績"),
      k174: i18n.pick("補登出缺席"),
      k175: i18n.pick("這位學生還沒有成績資料"),
      k176: i18n.pick("這位學生還沒有出缺席紀錄"),
      k177: i18n.pick("先在上面找一位學生"),
      k178: i18n.pick("找不到符合的學生（只搜尋學生身分，試試完整學號）"),
      k179: i18n.pick("上午"),
      k180: i18n.pick("下午"),
      k181: i18n.pick("正常"),
      k182: i18n.pick("遲到"),
      k183: i18n.pick("缺席"),
      k184: i18n.pick("請假"),
      k185: i18n.pick("手動"),
      k186: i18n.pick("同步"),
      k187: i18n.pick("選擇日期"),
      k188: i18n.pick("學段"),
      k189: i18n.pick("備註（可留空）"),
      k202: i18n.pick("批次匯入"),
      k203: i18n.pick("收起"),
      k204: i18n.pick("一行一筆：科目,類型,日期,分數（說明可留空）。學年與學段用上面的設定"),
      k205: i18n.pick("貼上或從聊天記錄選 CSV"),
      k206: i18n.pick("填入範本"),
      k207: i18n.pick("先檢查"),
      k208: i18n.pick("確認匯入"),
      k209: i18n.pick("請先按「先檢查」"),
      k210: i18n.pick("先貼上要補的內容"),
      k211: i18n.pick("先填好學年與學段"),
      k212: i18n.pick("已補登 "),
      k213: i18n.pick(" 筆"),
      k214: i18n.pick("讀不到範本"),
      k215: i18n.pick("共 "),
      k216: i18n.pick(" 列：可寫入 "),
      k217: i18n.pick("｜有問題 "),
      k218: i18n.pick("第 "),
      k219: i18n.pick(" 列"),
      k220: i18n.pick("匯入失敗"),
      k221: i18n.pick("檢查完成"),
      k222: i18n.pick("批次補登成績"),
      k223: i18n.pick("先填好上面的學年與學段再貼"),
      // W-54 公告已讀統計／催讀
      k224: i18n.pick("已讀"),
      k225: i18n.pick("未讀名單"),
      k226: i18n.pick("催讀"),
      k227: i18n.pick("已看："),
      k228: i18n.pick("未看："),
      k229: i18n.pick("（只列前 30 位）"),
      k230: i18n.pick("（還沒有人看）"),
      k231: i18n.pick("（全部看過了）"),
      k232: i18n.pick("已催讀 "),
      k233: i18n.pick("，跳過最近催過的 "),
      k234: i18n.pick("讀不到已讀統計"),
      k235: i18n.pick("催讀公告"),
      k236: i18n.pick("：只會通知還沒看過的人，已經看過的不會再收到。"),
      k237: i18n.pick("發送"),
      k238: i18n.pick("催讀失敗"),
      // W-55 活動回饋統計
      k239: i18n.pick("還沒有人回饋"),
      k240: i18n.pick("回覆率 "),
      k241: i18n.pick("回覆率 —（還沒有人簽到）"),
      k242: i18n.pick("回饋 "),
      k243: i18n.pick(" 份 · 平均 "),
      k244: i18n.pick(" 星 · "),
      k245: i18n.pick("星等分佈 "),
      k246: i18n.pick("（只評分，沒留言）"),
      k247: i18n.pick("讀不到回饋統計"),
      // W-56 催填回饋
      k248: i18n.pick("提醒填回饋"),
      k249: i18n.pick("已提醒 "),
      k250: i18n.pick(" 人（跳過 "),
      k251: i18n.pick(" 人最近催過）"),
      // W-58 預約發佈
      k252: i18n.pick("發佈時間（留空＝立即發佈）"),
      k253: i18n.pick("立即發佈"),
      k254: i18n.pick("排程中"),
      k255: i18n.pick("選日期"),
      k256: i18n.pick("取消排程"),
      k257: i18n.pick("時間"),
      k258: i18n.pick("已排程"),
      k259: i18n.pick("已排程："),
      k260: i18n.pick("已立即發佈"),
      k261: i18n.pick("報名截止日（選填，格式 2026-10-30）"),
      k262: i18n.pick("報名截止要早於活動當天"),
      // ── W-66 圖書館分頁（k270 起，避免撞號）──
      k270: i18n.pick("館藏"),
      k271: i18n.pick("借閱紀錄"),
      k272: i18n.pick("新增館藏"),
      k273: i18n.pick("修改館藏"),
      k274: i18n.pick("書名"),
      k275: i18n.pick("書號 ISBN"),
      k276: i18n.pick("作者"),
      k277: i18n.pick("分類"),
      k278: i18n.pick("索書號"),
      k279: i18n.pick("館藏量"),
      k280: i18n.pick("借期（天）"),
      k281: i18n.pick("儲存"),
      k282: i18n.pick("掃書號"),
      k283: i18n.pick("取消"),
      k284: i18n.pick("編輯"),
      k285: i18n.pick("下架"),
      k286: i18n.pick("上架"),
      k287: i18n.pick("刪除"),
      k288: i18n.pick("還沒有館藏"),
      k289: i18n.pick("按上方「新增館藏」登記第一本書"),
      k290: i18n.pick("借閱中"),
      k291: i18n.pick("逾期"),
      k292: i18n.pick("全部"),
      k293: i18n.pick("代還"),
      k294: i18n.pick("催還"),
      k295: i18n.pick("已催還"),
      k296: i18n.pick("目前沒有借閱紀錄"),
      k297: i18n.pick("確定刪除這本書？"),
      k298: i18n.pick("已刪除"),
      k299: i18n.pick("已儲存"),
      k300: i18n.pick("待審批"),
      k301: i18n.pick("場地清單"),
      k302: i18n.pick("申請人"),
      k303: i18n.pick("批准"),
      k304: i18n.pick("駁回"),
      k305: i18n.pick("目前沒有待審批申請"),
      k306: i18n.pick("已處理"),
      k307: i18n.pick("新增場地／器材"),
      k308: i18n.pick("編輯場地／器材"),
      k309: i18n.pick("名稱"),
      k310: i18n.pick("位置"),
      k311: i18n.pick("開放時間"),
      k312: i18n.pick("最長時數"),
      k313: i18n.pick("需要老師批准"),
      k314: i18n.pick("下架"),
      k315: i18n.pick("目前沒有場地"),
      k316: i18n.pick("先新增一個場地或器材"),
      k317: i18n.pick("讀不到待審批申請："),
      k318: i18n.pick("讀不到場地清單："),
      k319: i18n.pick("請輸入名稱"),
      k320: i18n.pick("關閉時間要晚於開放時間"),
      k321: i18n.pick("駁回申請"),
      k322: i18n.pick("寫一句原因（會通知申請人）"),
      k323: i18n.pick("已駁回"),
      k324: i18n.pick("已批准"),
      k325: i18n.pick("確定下架這個場地？"),
      k326: i18n.pick("場地"),
      k327: i18n.pick("器材"),
      k328: i18n.pick("用途"),
      k329: i18n.pick("免審批"),
      // ── W-68 轉贈分頁（k330 起，接在最大值後面，不要回頭撞號）──
      k330: i18n.pick("可上架"),
      k331: i18n.pick("下架"),
      k332: i18n.pick("重新上架"),
      k333: i18n.pick("目前沒有轉贈貼文"),
      k334: i18n.pick("待回覆申請"),
      k335: i18n.pick("已贈出"),
      // ── W-72 請假分頁（k336 起）──
      k336: i18n.pick("假單"),
      k337: i18n.pick("目前沒有待審批的假單"),
      k338: i18n.pick("學生與家長送出的假單會出現在這裡"),
      k339: i18n.pick("讀不到假單："),
      k340: i18n.pick("批准請假"),
      k341: i18n.pick("駁回假單"),
      k342: i18n.pick("寫一句原因（會通知家長與學生）"),
      k343: i18n.pick("已批准請假"),
      k344: i18n.pick("已駁回"),
      k345: i18n.pick("天"),
      k346: i18n.pick("家長代送"),
      // ── W-73 課表分頁（k347 起）──
      k347: i18n.pick("班級課表"),
      k348: i18n.pick("貼上 CSV：班級,星期,節次,科目,老師,課室"),
      k349: i18n.pick("先檢查"),
      k350: i18n.pick("確認匯入"),
      k351: i18n.pick("匯入中…"),
      k352: i18n.pick("讀不到課表："),
      k353: i18n.pick("目前還沒有任何班級的課表"),
      k354: i18n.pick("貼上 CSV 後按「先檢查」，確認沒問題再匯入"),
      k355: i18n.pick("這一格已經有課，不覆蓋"),
      k356: i18n.pick("同一份裡重複"),
      k357: i18n.pick("刪除"),
      // ── W-77 功課分頁（k358 起）──
      k358: i18n.pick("收回"),
      k359: i18n.pick("收回這項功課？"),
      k360: i18n.pick("收回後學生就看不到了，紀錄會留在垃圾桶"),
      k361: i18n.pick("已收回"),
      k362: i18n.pick("讀不到功課："),
      k363: i18n.pick("還沒有任何功課"),
      k364: i18n.pick("老師出功課後，這裡會列出每一班的派發情況"),
      k366: i18n.pick("還沒有人交"),
      k367: i18n.pick("完成率"),
      k368: i18n.pick("班"),
      k369: i18n.pick("項功課"),
      k370: i18n.pick("讀取未交名單…"),
      k371: i18n.pick("還沒交"),
      k373: i18n.pick("位學生"),
      k374: i18n.pick("已過期"),
      k375: i18n.pick("全部班級"),
      k376: i18n.pick("項已過期"),
      k377: i18n.pick("各班完成率"),
      // ── W-81 示範資料 ──
      k380: i18n.pick("示範資料"),
      k381: i18n.pick("示範資料一鍵匯入"),
      k382: i18n.pick("匯入的是真實資料，只是多一個「示範」標記；清除時只刪這一批，真資料一筆不動。"),
      k383: i18n.pick("場地與器材"),
      k384: i18n.pick("館藏圖書"),
      k385: i18n.pick("班級課表"),
      k386: i18n.pick("課表班級（留空用你自己的班級）"),
      k387: i18n.pick("匯入示範資料"),
      k388: i18n.pick("清除示範資料"),
      k389: i18n.pick("確定要清除示範資料？只會刪掉示範那批，真實資料不會動。"),
      k390: i18n.pick("匯入完成"),
      k391: i18n.pick("已清除示範資料"),
      k392: i18n.pick("格"),
      k393: i18n.pick("還沒有匯入任何示範資料"),
      k394: i18n.pick("匯入時遇到同名的真實資料會跳過，不會覆蓋"),
      k395: i18n.pick("項"),
      // ── W-84 功課完成率趨勢 ──
      k396: i18n.pick("最近 7 天還沒有派出的功課"),
      k397: i18n.pick("平均"),
      k398: i18n.pick("最近 7 天完成率"),
      k399: i18n.pick("按「派功課那天」分組；柱子越高代表當天派出的功課交得越齊"),
    };
  },

  data: {
    themeClass: appearance.themeClass(),
    theme,
    // ── W-81 示範資料（只有最高權限看得到）──
    demoBusy: false,
    demoCounts: { venues: 0, books: 0, timetableSlots: 0 },
    demoClasses: [],
    demoClassText: '',
    demoClass: '',
    demoHint: '',
    demoTotals: [],
    tabs: TABS,
    tab: 'stats',
    // ── W-66 圖書館分頁 ──
    libMode: 'books',
    libModes: [
      { key: 'books', label: i18n.pick('館藏') },
      { key: 'loans', label: i18n.pick('借閱紀錄') },
    ],
    libBooks: [],
    libLoans: [],
    libSummary: { active: 0, overdue: 0 },
    libStatus: 'active',
    libStatuses: [
      { key: 'active', label: i18n.pick('借閱中') },
      { key: 'overdue', label: i18n.pick('逾期') },
      { key: 'all', label: i18n.pick('全部') },
    ],
    libForm: { id: '', title: '', isbn: '', author: '', category: '', callNumber: '', totalCopies: '1', loanDays: '14' },
    libSaving: false,
    // ── 場地／器材（W-67）：待審批＋資源管理兩個子模式 ──
    venMode: 'pending',
    venModes: [
      { key: 'pending', label: i18n.pick('待審批') },
      { key: 'resources', label: i18n.pick('場地清單') },
    ],
    venPending: [],
    venHandled: [],
    venResources: [],
    venKindLabels: [i18n.pick('場地'), i18n.pick('器材')],
    venForm: { id: '', kind: 'VENUE', name: '', location: '', openFrom: '08:00', openTo: '18:00', maxHours: '4', needsApproval: true },
    venSaving: false,
    // ── 轉贈（W-68）：一個清單＋四張統計卡，操作只有下架／重新上架 ──
    gvStatus: 'all',
    gvStatuses: [
      { key: 'all', label: i18n.pick('全部') },
      { key: 'AVAILABLE', label: i18n.pick('可申請') },
      { key: 'GIVEN', label: i18n.pick('已贈出') },
      { key: 'CLOSED', label: i18n.pick('已下架') },
    ],
    gvItems: [],
    gvStats: { available: 0, given: 0, closed: 0, pendingRequests: 0 },
    // ── 請假（W-72）：待審優先；一手批／駁，駁回要寫原因（會通知家長與學生）──
    leaveStatus: 'PENDING',
    leaveStatuses: [
      { key: 'PENDING', label: i18n.pick('待審批') },
      { key: 'APPROVED', label: i18n.pick('已批准') },
      { key: 'REJECTED', label: i18n.pick('已駁回') },
      { key: 'ALL', label: i18n.pick('全部') },
    ],
    leaveItems: [],
    leaveCounts: { PENDING: 0, APPROVED: 0, REJECTED: 0, CANCELLED: 0 },
    // ── 課表（W-73）：匯入 CSV 先檢查再寫入；下面列出每個班幾格 ──
    ttCsv: '',
    ttBusy: false,
    ttClasses: [],
    ttRows: [],
    ttErrors: [],
    ttSummary: '',
    // ── 功課（W-77）：跨班一覽；點一項展開「誰還沒交」；收回＝軟刪除（回收桶看得到）──
    hwScope: 'all',
    hwScopes: [
      { key: 'all', label: i18n.pick('全部') },
      { key: 'open', label: i18n.pick('未到期') },
      { key: 'overdue', label: i18n.pick('已過期') },
    ],
    hwClass: '',
    hwClassNames: [],
    hwClasses: [],
    hwItems: [],
    hwCounts: { classes: 0, items: 0, overdue: 0 },
    hwSummary: '',
    hwOpenId: '',
    hwPending: [],
    hwPendingCount: 0,
    hwPendingTotal: 0,
    hwPendingNames: '',
    hwPendingHint: '',
    // ── W-84 完成率趨勢：最近 7 天「派出去的有多少人交」（CSS 柱狀，不引圖表庫）──
    hwTrend: [],
    hwTrendAvg: null,
    hwTrendText: '',
    hwTrendFrom: '',
    role: '',
    stats: { users: 0, items: { open: 0, claimed: 0, added7d: 0 }, claimsPending: 0, signups: { confirmed: 0, waitlist: 0 }, noticesActive: 0, ratings: { count: 0, avg: 0 } },
    // 第一屏五張數字卡：值與標籤在 loadStats 一起備好（WXML 不做運算）
    ovCards: [],
    ovPressed: -1,
    claims: [],
    items: [],
    itemStatus: 'OPEN',
    statusFilters: [
      { key: 'OPEN', label: i18n.pick('待認領') },
      { key: 'MATCHED', label: i18n.pick('已匹配') },
      { key: 'CLAIMED', label: i18n.pick('已認領') },
      { key: '', label: i18n.pick('全部') },
    ],
    // W-40 資源回收桶：公告與失物都是軟刪除，這裡看得到、可以還原
    trashType: 'all',
    trashFilters: [
      { key: 'all', label: i18n.pick('全部') },
      { key: 'notice', label: i18n.pick('公告') },
      { key: 'item', label: i18n.pick('失物') },
    ],
    trashRows: [],
    trashCounts: { notice: 0, item: 0, all: 0 },
    // W-58 預約發佈：日期選擇器的下限（今天），避免選到過去的日子
    today: '',
    events: [],
    ci: null, // 現場簽到面板（老師／管理員）
    attendance: null,
    ciSending: false,
    evStats: null,
    // W-55：活動回饋統計（與 evStats 同一張卡，不另開一張）
    fbStats: null,
    fbLine: '',
    fbDistLine: '',
    fbRecent: [],
    fbFailed: false,
    // W-56：催填回饋的結果提示（空白＝還沒按過）
    fbRemindText: '',
    fbReminding: false,
    fbCanRemind: false,
    eventId: '',
    signups: [],
    notice: { title: '', content: '', kind: 'NORMAL', isPinned: false, publishDate: '', publishTime: '' },
    kinds: [
      { key: 'NORMAL', label: i18n.pick('一般') },
      { key: 'CALENDAR', label: i18n.pick('校曆') },
      { key: 'URGENT', label: i18n.pick('緊急') },
    ],
    meals: [
      { key: 'LUNCH', label: i18n.pick('午餐') },
      { key: 'SNACK', label: i18n.pick('小賣部') },
    ],
    menu: { date: '', mealType: 'LUNCH', names: '' },
    menuWeekStart: '',
    menuEntries: [],
    eventForm: { title: '', date: '', capacity: '20', location: '', groups: '', signupEnd: '' },
    teamsEnabled: false,
    creatingEvent: false,
    users: [],
    parents: [],
    relations: [
      { key: 'guardian', label: i18n.pick('監護人') },
      { key: 'father', label: i18n.pick('父親') },
      { key: 'mother', label: i18n.pick('母親') },
    ],
    parentForm: { parentAccount: '', studentAccount: '', relation: 'guardian' },
    creatingParent: false,
    // W-53 第二階段：小程序內補登成績與出缺席（老師／校內職員）
    scQuery: '',
    scHits: [],
    scPressed: -1,
    scPicked: null,
    scBusy: false,
    scSaving: false,
    scMode: 'grade',
    scModes: [
      { key: 'grade', label: i18n.pick('成績') },
      { key: 'attend', label: i18n.pick('出缺席') },
    ],
    scGrades: [],
    scAttend: [],
    scSummaryText: '',
    // W-53 最後一段：批次匯入成績（一次貼多筆，先檢查再匯入）
    gBatchOpen: false,
    gBatchText: '',
    gBatchResult: null,
    gBatchChecked: false,
    gBatchBusy: false,
    // 學年／學段沿用最近一筆；term 用 chips（後端 TERMS 三值）
    gForm: { yearTerm: '', term: '', courseName: '', testType: '', testDate: '', score: '' },
    aForm: { amStatus: 'normal', pmStatus: 'normal', remark: '' },
    termOptions: TERM_KEYS.map((t) => ({ key: t, label: t })),
    attStatuses: [
      { key: 'normal', label: i18n.pick('正常') },
      { key: 'late', label: i18n.pick('遲到') },
      { key: 'absent', label: i18n.pick('缺席') },
      { key: 'leave', label: i18n.pick('請假') },
    ],
    roles: ROLES,
    userQuery: { q: '', role: '' },
    meLevel: 0,
    userForm: { account: '', password: '', nickname: '', role: 'STUDENT' },
    creatingUser: false,
    editingId: '',
    editForm: { nickname: '', account: '', password: '', role: 'STUDENT' },
    reports: [],
    errors: [],
    errStatus: 'OPEN',
    errKind: '',
    errFilters: [
      { key: 'OPEN', label: i18n.pick('待處理') },
      { key: 'RESOLVED', label: i18n.pick('已解決') },
    ],
    // 來源篩選（W-43）：使用者自己回報的問題跟程式拋的錯混在一起時，修的人分不出輕重
    errKindFilters: [
      { key: '', label: i18n.pick('全部') },
      { key: 'USER_REPORT', label: i18n.pick('使用者回報') },
      { key: 'CLIENT_ERROR', label: i18n.pick('自動上報') },
    ],
    errSummary: { open: 0, total: 0, kinds: 0, last24h: 0, userReports: 0 },
    // 推送紀錄（W-37）
    pushLogs: [],
    pushOk: 'all',
    pushChannel: '',
    pushFilters: [
      { key: 'all', label: i18n.pick('全部') },
      { key: 'failed', label: i18n.pick('只看失敗') },
    ],
    pushSummary: { total: 0, ok: 0, failed: 0, last24h: 0 },
    pushTplHint: '',
    audit: [],
    noticeList: [],
    // W-54：展開中的公告已讀統計（null＝沒展開），只放一則避免大表格
    noticeStats: null,
    showPerms: false,
    abilities: [],
    sending: false,
    hint: '',
    // 批次匯入（W-19）：同一塊面板依目前分頁決定匯入活動或菜單
    importType: '',
    importCsv: '',
    importHint: '',
    importResult: null,
    importChecked: false,
    importBusy: false,
    tabLoading: false,
    failed: false,
    errorText: '',
  },

  onLoad() {
    this.setData({ L: this.labels(), themeClass: appearance.themeClass() });
    let user = {};
    try {
      user = wx.getStorageSync(config.STORAGE_KEYS.user) || {};
    } catch (e) {
      user = {};
    }
    const role = user.role || '';
    // 後台入口＝這個角色至少有一個分頁（TEACHER / STAFF / ADMIN / SUPER_ADMIN）；其他一律踢回登入頁
    const allowed = ROLE_TABS[role] || [];
    if (!allowed.length) {
      wx.redirectTo({ url: '/pages/admin/login/index' });
      return;
    }
    this.setData({ role: role, 'menu.date': dateKey(), today: dateKey() });

    // 依能力決定看得到哪些分頁（真正的權限仍在後端）
    const tabs = TABS.filter((t) => allowed.indexOf(t.key) !== -1);
    this.setData({ tabs: tabs, tab: tabs[0].key });
    this.loadTab();
  },

  logout() {
    request.setToken('');
    wx.removeStorageSync(config.STORAGE_KEYS.user);
    wx.showToast({ title: i18n.pick('已登出'), icon: 'none' });
    setTimeout(() => wx.navigateBack(), 400);
  },

  switchTab(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ tab: key, hint: '' });
    this.loadTab();
  },

  loadTab() {
    const t = this.data.tab;
    this.setData({ tabLoading: true, failed: false, errorText: '' });

    let p = null;
    if (t === 'stats') p = this.loadStats();
    else if (t === 'claims') p = this.loadClaims();
    else if (t === 'items') p = this.loadItems();
    else if (t === 'trash') p = this.loadTrash();
    else if (t === 'export') p = this.loadEventsForExport();
    else if (t === 'events') p = this.loadEventsAdmin();
    else if (t === 'users') p = this.loadUsers();
    else if (t === 'parents') p = this.loadParents();
    else if (t === 'school') p = this.loadSchool();
    else if (t === 'reports') p = this.loadReports();
    else if (t === 'errors') p = this.loadErrors();
    else if (t === 'push') p = this.loadPushLogs();
    else if (t === 'audit') p = this.loadAudit();
    else if (t === 'notice') p = this.loadNoticeList();
    else if (t === 'menu') p = this.loadMenuWeek();
    else if (t === 'library') p = this.loadLibrary();
    else if (t === 'venues') p = this.loadVenues();
    else if (t === 'giveaways') p = this.loadGiveaways();
    else if (t === 'leaves') p = this.loadLeaves();
    else if (t === 'timetable') p = this.loadTimetable();
    else if (t === 'homework') p = this.loadHomework();
    else if (t === 'demo') p = this.loadDemo();

    if (!p || typeof p.then !== 'function') {
      this.setData({ tabLoading: false });
      return p;
    }
    // 讀取類的 catch 一律寫成 hint「讀不到…」；這裡統一翻成失敗畫面（含重試），
    // 不要讓「後端掛掉」在畫面上長得像「後台沒有資料」。
    return p.then(() => {
      const hint = this.data.hint || '';
      const failed = hint.indexOf(i18n.pick('讀不到')) === 0;
      this.setData({ tabLoading: false, failed: failed, errorText: failed ? hint : '' });
    });
  },

  reloadTab() {
    this.loadTab();
  },

  async loadStats() {
    try {
      // 累計報表與「本週五張卡」一起打。第二支失敗不讓整頁變失敗畫面：
      // 卡片是加值資訊，累計數字才是後台原本就有的內容。
      const [stats, ov] = await Promise.all([admin.stats(), admin.statsOverview().catch(() => null)]);
      this.setData({ stats: stats, ovCards: this.buildOvCards(ov) });
    } catch (e) {
      this.setData({ hint: i18n.pick('讀不到數據：') + (e.message || e.code) });
    }
  },

  /**
   * 五張卡的值、標籤與跳轉目標一起算好。
   * 標籤不寫在 WXML 是因為它要跟著介面語言變；target 放這裡讓 WXML 只負責顯示，
   * 之後要改「點卡片去哪一頁」只改這一處。
   */
  buildOvCards(ov) {
    const o = ov || {};
    const n = (v) => (typeof v === 'number' ? v : 0);
    return [
      { key: 'usersNew7d', label: i18n.pick('本週新使用者'), value: n(o.usersNew7d), target: 'users' },
      { key: 'signups7d', label: i18n.pick('本週報名'), value: n(o.signups7d), target: 'export' },
      { key: 'claimsPending', label: i18n.pick('待審認領'), value: n(o.claimsPending), target: 'claims' },
      { key: 'errorsOpen', label: i18n.pick('未解決錯誤'), value: n(o.errorsOpen), target: 'errors' },
      { key: 'itemsOpen', label: i18n.pick('未認領失物'), value: n(o.itemsOpen), target: 'items' },
    ];
  },

  // 按壓回饋（Skyline 下 hover-class 不可靠）：按下 60ms、放開 180ms
  ovDown(e) {
    this.setData({ ovPressed: Number(e.currentTarget.dataset.i) });
  },
  ovUp() {
    if (this.data.ovPressed !== -1) this.setData({ ovPressed: -1 });
  },

  async loadClaims() {
    try {
      const res = await admin.claims('PENDING');
      this.setData({ claims: res.items || [] });
    } catch (e) {
      this.setData({ hint: i18n.pick('讀不到申請：') + (e.message || e.code) });
    }
  },

  async loadItems() {
    try {
      const res = await admin.items(this.data.itemStatus);
      this.setData({ items: res.items || [] });
    } catch (e) {
      this.setData({ hint: i18n.pick('讀不到失物：') + (e.message || e.code) });
    }
  },

  async loadEventsForExport() {
    try {
      const res = await admin.events();
      const events = res.items || [];
      this.setData({ events: events });
      if (events.length && !this.data.eventId) {
        this.pickEventById(events[0].id);
      }
    } catch (e) {
      this.setData({ hint: i18n.pick('讀不到活動：') + (e.message || e.code) });
    }
  },

  filterItems(e) {
    this.setData({ itemStatus: e.currentTarget.dataset.key });
    this.loadItems();
  },

  // W-28：列印版（A4 黑白）——失物清單帶目前篩選、活動名單帶該場活動
  openPrint(e) {
    const { kind, id } = e.currentTarget.dataset;
    if (kind === 'event') {
      wx.navigateTo({ url: '/pages/print/event/index?id=' + id });
      return;
    }
    // 後台的 MATCHED 是內部狀態，公開清單只認 OPEN／CLAIMED／CLOSED，其餘一律印全部
    const printable = ['OPEN', 'CLAIMED', 'CLOSED'];
    const status = printable.indexOf(this.data.itemStatus) >= 0 ? this.data.itemStatus : '';
    wx.navigateTo({ url: '/pages/print/items/index?status=' + status });
  },

  async review(e) {
    const { id, ok } = e.currentTarget.dataset;
    try {
      await admin.reviewClaim(id, ok === '1');
      wx.showToast({ title: ok === '1' ? i18n.pick('已通過') : i18n.pick('已拒絕'), icon: 'success' });
      this.loadClaims();
    } catch (err) {
      wx.showToast({ title: err.message || i18n.pick('操作失敗'), icon: 'none' });
    }
  },

  async moderate(e) {
    const { id, act } = e.currentTarget.dataset;
    try {
      await admin.moderateItem(id, act);
      wx.showToast({ title: act === 'REMOVE' ? i18n.pick('已下架') : i18n.pick('已恢復'), icon: 'success' });
      this.loadItems();
    } catch (err) {
      wx.showToast({ title: err.message || i18n.pick('操作失敗'), icon: 'none' });
    }
  },

  onNoticeTitle(e) {
    this.setData({ 'notice.title': e.detail.value });
  },
  onNoticeContent(e) {
    this.setData({ 'notice.content': e.detail.value });
  },
  pickKind(e) {
    this.setData({ 'notice.kind': e.currentTarget.dataset.key });
  },
  onPinned(e) {
    this.setData({ 'notice.isPinned': e.detail.value });
  },

  // ───────── W-58 預約發佈 ─────────
  /**
   * 選了日期就代表「排程」，所以順手補一個預設時間（早上 8 點，校內公告最常見的時段）。
   * 不讓時間留空：留空的話「當天幾點上線」會變成程式裡的隱藏規則，老師猜不到。
   */
  onPublishDate(e) {
    const date = e.detail.value;
    this.setData({
      'notice.publishDate': date,
      'notice.publishTime': this.data.notice.publishTime || '08:00',
    });
  },

  onPublishTime(e) {
    this.setData({ 'notice.publishTime': e.detail.value });
  },

  clearSchedule() {
    this.setData({ 'notice.publishDate': '', 'notice.publishTime': '' });
  },

  /**
   * 把「日期＋時間」組成 UTC 時間字串。
   * 明確寫 `+08:00`：澳門全年 UTC+8、沒有日光節約，直接固定偏移，
   * 不要用裝置時區推（老師手機若設成別的時區，排程就會提早／延後一小時上線）。
   * 回空字串＝立即發佈。
   */
  publishAtISO() {
    const n = this.data.notice;
    if (!n.publishDate) return '';
    const time = n.publishTime || '08:00';
    const d = new Date(n.publishDate + 'T' + time + ':00+08:00');
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString();
  },

  async publish() {
    if (this.data.sending) return;
    const n = this.data.notice;
    if (!n.title.trim() || !n.content.trim()) {
      wx.showToast({ title: i18n.pick('標題與內容都要填'), icon: 'none' });
      return;
    }
    // 排程時間一定要在未來：選到今天已過去的時段，後端會當成「立即發佈」，
    // 但畫面上寫「排程中」，老師會以為明早才出現 —— 直接擋在這裡。
    const publishAt = this.publishAtISO();
    if (n.publishDate && (!publishAt || new Date(publishAt).getTime() <= Date.now())) {
      wx.showToast({ title: i18n.pick('排程時間已過，請改選未來時間或按立即發佈'), icon: 'none' });
      return;
    }
    this.setData({ sending: true });
    try {
      const payload = {
        title: n.title.trim(),
        content: n.content.trim(),
        kind: n.kind,
        isPinned: n.isPinned,
      };
      if (publishAt) payload.publishedAt = publishAt;
      const res = await admin.createNotice(payload);
      this.setData({
        'notice.title': '',
        'notice.content': '',
        'notice.publishDate': '',
        'notice.publishTime': '',
        hint: res.scheduled
          ? this.data.L.k259 + res.title
          : i18n.pick('已發布：') + res.title + (res.pushed ? i18n.pick('，已推播 ') + res.pushed + i18n.pick(' 人') : ''),
      });
      wx.showToast({ title: res.scheduled ? this.data.L.k258 : i18n.pick('已發布'), icon: 'success' });
      if (res.scheduled) this.loadNoticeList();
    } catch (e) {
      wx.showToast({ title: e.message || i18n.pick('發布失敗'), icon: 'none' });
    } finally {
      this.setData({ sending: false });
    }
  },

  /** 排程中的公告可以提前上線（老師臨時決定「現在就讓大家知道」） */
  async publishNoticeNow(e) {
    const { id, version } = e.currentTarget.dataset;
    try {
      await admin.updateNotice(id, { publishedAt: new Date().toISOString(), version: Number(version) });
      wx.showToast({ title: this.data.L.k260, icon: 'success' });
      this.loadNoticeList();
    } catch (err) {
      onWriteError(err, () => this.loadNoticeList());
    }
  },

  pickEvent(e) {
    this.pickEventById(e.currentTarget.dataset.id);
  },

  async pickEventById(id) {
    this.setData({ eventId: id });
    try {
      const res = await admin.signups(id);
      this.setData({ signups: res.items || [] });
    } catch (e) {
      this.setData({ signups: [], hint: i18n.pick('讀不到名單：') + (e.message || e.code) });
    }
  },

  copySignups() {
    const lines = this.data.signups.map((s, i) =>
      `${i + 1}. ${s.nickname || i18n.pick('（未設定）')} ${s.grade || ''}${s.className || ''} — ${s.status === 'CONFIRMED' ? i18n.pick('正取') : i18n.pick('候補') + s.waitlistPos}`,
    );
    wx.setClipboardData({
      data: lines.join('\n'),
      success: () => wx.showToast({ title: i18n.pick('名單已複製'), icon: 'none' }),
    });
  },

  onMenuDate(e) {
    this.setData({ 'menu.date': e.detail.value });
  },
  pickMeal(e) {
    this.setData({ 'menu.mealType': e.currentTarget.dataset.key });
  },
  onMenuNames(e) {
    this.setData({ 'menu.names': e.detail.value });
  },

  async saveMenu() {
    if (this.data.sending) return;
    const m = this.data.menu;
    const names = (m.names || '').split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    if (!m.date || !names.length) {
      wx.showToast({ title: i18n.pick('日期與菜名都要填'), icon: 'none' });
      return;
    }
    this.setData({ sending: true });
    try {
      const ids = [];
      for (const name of names) {
        const dish = await admin.createDish(name, m.mealType);
        ids.push(dish.id);
      }
      const res = await admin.scheduleMenu(m.date, m.mealType, ids);
      this.setData({ hint: `${res.date} 已排入 ${res.count} 道菜`, 'menu.names': '' });
      wx.showToast({ title: i18n.pick('已排入'), icon: 'success' });
    } catch (e) {
      wx.showToast({ title: e.message || i18n.pick('排菜單失敗'), icon: 'none' });
    } finally {
      this.setData({ sending: false });
    }
  },

  // ───────── 活動管理 ─────────
  /**
   * W-55：把回饋統計整理成畫面要用的三行。
   * 一律在這裡算好（WXML 不做運算）；0 份回饋顯示「還沒有人回饋」而不是「0 星」，
   * 沒人簽到時回覆率顯示「—」而不是 0%（否則看起來像「大家都沒填」）。
   */
  fbView(s) {
    const L = this.data.L || {};
    if (!s || !s.count) {
      return { fbLine: L.k239 || '', fbDistLine: '', fbRecent: [], fbFailed: false };
    }
    const rateText =
      s.rate === null || s.rate === undefined ? L.k241 || '' : (L.k240 || '') + s.rate + '%';
    const dist = (s.distribution || [])
      .slice()
      .sort((a, b) => b.stars - a.stars)
      .map((d) => d.stars + '★ ' + d.count)
      .join('　');
    const recent = (s.recent || []).slice(0, 3).map((r, i) => ({
      id: 'fb' + i,
      stars: '★★★★★'.slice(0, r.rating || 0),
      text: (r.nickname ? r.nickname + '：' : '') + (r.comment || L.k246 || ''),
    }));
    return {
      fbLine:
        (L.k242 || '') +
        s.count +
        (L.k243 || '') +
        Number(s.avgRating || 0).toFixed(1) +
        (L.k244 || '') +
        rateText,
      fbDistLine: (L.k245 || '') + dist,
      fbRecent: recent,
      fbFailed: false,
    };
  },

  async loadEventStats(e) {
    const id = e.currentTarget.dataset.id;
    try {
      const [s, fb] = await Promise.all([
        admin.eventStats(id),
        // 回饋統計失敗不該把整張統計卡打成錯誤：報名數字照樣要看得到
        admin.feedbackStats(id).catch(() => null),
      ]);
      const view = this.fbView(fb);
      this.setData({
        evStats: s,
        eventId: id,
        fbStats: fb,
        fbLine: view.fbLine,
        fbDistLine: view.fbDistLine,
        fbRecent: view.fbRecent,
        fbFailed: !fb,
        // 催填只在「有人出席、且還沒全部填完」時才有意義（回覆率 100% 或沒人出席都 disabled）
        fbCanRemind: !!fb && (fb.attended || 0) > 0 && fb.rate !== 100,
        fbRemindText: '',
      });
    } catch (err) {
      wx.showToast({ title: err.message || i18n.pick('讀不到統計'), icon: 'none' });
    }
  },

  closeEventStats() {
    this.setData({
      evStats: null,
      eventId: '',
      fbStats: null,
      fbLine: '',
      fbDistLine: '',
      fbRecent: [],
      fbFailed: false,
      fbCanRemind: false,
      fbRemindText: '',
      fbReminding: false,
    });
  },

  /**
   * W-56 催填回饋：一次按鈕打完「站內通知＋有訂閱的人再加微信」。
   * 按完就地更新提示（不重開卡片），並且重抓回饋統計 —— 催的時候可能剛好有人填了，
   * 回覆率沒跟著變，老師會以為「按了沒反應」。
   */
  async remindFeedback() {
    const id = this.data.eventId;
    if (!id || this.data.fbReminding) return;
    const L = this.data.L || {};
    this.setData({ fbReminding: true });
    try {
      const res = await admin.remindFeedback(id);
      this.setData({
        fbReminding: false,
        fbRemindText:
          (L.k249 || '') + (res.reminded || 0) + (L.k250 || '') + (res.skipped || 0) + (L.k251 || ''),
      });
      const fb = await admin.feedbackStats(id).catch(() => null);
      if (fb) {
        const view = this.fbView(fb);
        this.setData({
          fbStats: fb,
          fbLine: view.fbLine,
          fbDistLine: view.fbDistLine,
          fbRecent: view.fbRecent,
          fbFailed: false,
          fbCanRemind: (fb.attended || 0) > 0 && fb.rate !== 100,
        });
      }
    } catch (err) {
      this.setData({ fbReminding: false });
      wx.showToast({ title: err.message || i18n.pick('操作失敗'), icon: 'none' });
    }
  },

  async promoteAll() {
    const id = this.data.eventId;
    if (!id) return;
    try {
      const res = await admin.batchSignups(id, 'PROMOTE_ALL');
      wx.showToast({ title: i18n.pick('已轉正 ') + res.affected + i18n.pick(' 人'), icon: 'none' });
      this.loadEventStats({ currentTarget: { dataset: { id: id } } });
    } catch (err) {
      wx.showToast({ title: err.message || i18n.pick('操作失敗'), icon: 'none' });
    }
  },

  // ───────── 現場簽到（QR） ─────────
  async loadEventCheckin(e) {
    const id = e.currentTarget.dataset.id;
    try {
      this.setData({ ci: await admin.eventCheckin(id), attendance: null });
      this.loadAttendance();
    } catch (err) {
      wx.showToast({ title: err.message || i18n.pick('讀不到簽到狀態'), icon: 'none' });
    }
  },

  async loadAttendance() {
    const ci = this.data.ci;
    if (!ci) return;
    try {
      this.setData({ attendance: await admin.attendance(ci.eventId) });
    } catch (err) {
      wx.showToast({ title: err.message || i18n.pick('讀不到出席名單'), icon: 'none' });
    }
  },

  async openCheckin() {
    const ci = this.data.ci;
    if (!ci || this.data.ciSending) return;
    this.setData({ ciSending: true });
    try {
      this.setData({ ci: await admin.openEventCheckin(ci.eventId) });
      wx.showToast({ title: i18n.pick('已開放簽到'), icon: 'success' });
      this.loadAttendance();
    } catch (err) {
      wx.showToast({ title: err.message || i18n.pick('開不到簽到'), icon: 'none' });
    } finally {
      this.setData({ ciSending: false });
    }
  },

  async closeCheckin() {
    const ci = this.data.ci;
    if (!ci || this.data.ciSending) return;
    this.setData({ ciSending: true });
    try {
      this.setData({ ci: await admin.closeEventCheckin(ci.eventId) });
      wx.showToast({ title: i18n.pick('已結束簽到'), icon: 'none' });
    } catch (err) {
      wx.showToast({ title: err.message || i18n.pick('關不到簽到'), icon: 'none' });
    } finally {
      this.setData({ ciSending: false });
    }
  },

  async toggleAttendance(e) {
    const { id, on } = e.currentTarget.dataset;
    const ci = this.data.ci;
    if (!ci) return;
    try {
      const res = await admin.batchSignups(ci.eventId, on === '1' ? 'CHECK_IN' : 'CHECK_OUT', [id]);
      const rate = res.signed ? Math.round((res.checkedIn / res.signed) * 1000) / 10 : null;
      this.setData({ 'ci.checkedIn': res.checkedIn, 'ci.signed': res.signed, 'ci.rate': rate });
      wx.showToast({ title: on === '1' ? i18n.pick('已代簽') : i18n.pick('已撤銷代簽'), icon: 'none' });
      this.loadAttendance();
    } catch (err) {
      wx.showToast({ title: err.message || i18n.pick('操作失敗'), icon: 'none' });
    }
  },

  closeCheckinPanel() {
    this.setData({ ci: null, attendance: null });
  },

  // ───────── 批次匯入（CSV）─────────
  openImport(e) {
    const type = e && e.currentTarget && e.currentTarget.dataset.type === 'menu' ? 'menu' : 'events';
    const hint =
      type === 'events'
        ? i18n.pick('欄名：標題,開始時間,結束時間,地點,名額,組別,說明,狀態。時間寫成 2026-11-05 09:00；組別用逗號分隔時整格要加引號，例如 "甲組,乙組"。')
        : i18n.pick('欄名：日期,餐別,菜色。日期寫成 2026-11-05；餐別填 午餐 或 小食；同一餐多道菜用 | 分隔。');
    this.setData({ importType: type, importCsv: '', importResult: null, importChecked: false, importHint: hint });
  },

  closeImport() {
    this.setData({ importType: '', importCsv: '', importResult: null, importChecked: false });
  },

  onImportText(e) {
    this.setData({ importCsv: e.detail.value, importChecked: false });
  },

  /** 從微信聊天記錄選一個 CSV，讀成文字後貼進同一個輸入框（兩條入口共用一套驗證） */
  pickCsvFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['csv'],
      success: (res) => {
        const file = (res.tempFiles || [])[0];
        if (!file) return;
        try {
          const text = wx.getFileSystemManager().readFileSync(file.path, 'utf8');
          this.setData({ importCsv: String(text || ''), importResult: null, importChecked: false });
          wx.showToast({ title: i18n.pick('已讀入 ') + (file.name || 'CSV'), icon: 'none' });
        } catch (err) {
          wx.showToast({ title: i18n.pick('讀不到這個檔案'), icon: 'none' });
        }
      },
      fail: () => {
        // 使用者取消選擇不算錯誤
      },
    });
  },

  checkImport() {
    return this.runImport(true);
  },

  confirmImport() {
    if (!this.data.importChecked) {
      wx.showToast({ title: i18n.pick('請先按「先檢查」'), icon: 'none' });
      return Promise.resolve();
    }
    return this.runImport(false);
  },

  async runImport(dryRun) {
    if (this.data.importBusy) return;
    const csv = (this.data.importCsv || '').trim();
    if (!csv) {
      wx.showToast({ title: i18n.pick('先貼上或選 CSV'), icon: 'none' });
      return;
    }
    this.setData({ importBusy: true });
    try {
      const res =
        this.data.importType === 'menu' ? await admin.importMenu(csv, dryRun) : await admin.importEvents(csv, dryRun);
      // 只有「檢查過而且至少有一列寫得進去」才放行確認匯入
      this.setData({ importResult: res, importChecked: dryRun && res.success > 0 });
      wx.showToast({ title: dryRun ? i18n.pick('檢查完成') : i18n.pick('已匯入 ') + res.success + i18n.pick(' 筆'), icon: 'none' });
      if (!dryRun) this.reloadTab();
    } catch (e) {
      wx.showToast({ title: (e && e.message) || i18n.pick('匯入失敗'), icon: 'none' });
    } finally {
      this.setData({ importBusy: false });
    }
  },

  async loadEventsAdmin() {
    try {
      const res = await admin.events();
      this.setData({ events: res.items || [] });
    } catch (e) {
      this.setData({ hint: i18n.pick('讀不到活動：') + (e.message || e.code) });
    }
  },

  toggleEvTeams() {
    this.setData({ teamsEnabled: !this.data.teamsEnabled });
  },

  onEventField(e) {
    const field = e.currentTarget.dataset.field;
    const patch = {};
    patch['eventForm.' + field] = e.detail.value;
    this.setData(patch);
  },

  async createEvent() {
    if (this.data.creatingEvent) return;
    const f = this.data.eventForm;
    if (!f.title.trim() || !f.date) {
      wx.showToast({ title: i18n.pick('標題與日期必填'), icon: 'none' });
      return;
    }
    this.setData({ creatingEvent: true });
    try {
      const groups = (f.groups || '')
        .split(/[,，、]/)
        .map((x) => x.trim())
        .filter(Boolean);
      const startAt = new Date(f.date + 'T09:00:00').toISOString();
      // W-64：截止日選填；選了就設成當天 23:59:59，且一定要早於活動當天
      let signupEndAt;
      if (f.signupEnd) {
        const end = new Date(f.signupEnd + 'T23:59:59');
        if (isNaN(end.getTime()) || end.getTime() >= new Date(startAt).getTime()) {
          wx.showToast({ title: i18n.pick('報名截止要早於活動當天'), icon: 'none' });
          this.setData({ creatingEvent: false });
          return;
        }
        signupEndAt = end.toISOString();
      }
      await admin.createEvent({
        title: f.title.trim(),
        location: f.location.trim() || undefined,
        startAt: startAt,
        signupEndAt: signupEndAt,
        capacity: Number(f.capacity) || 0,
        status: 'PUBLISHED',
        groups: groups.length ? groups : undefined,
        teamsEnabled: this.data.teamsEnabled || undefined,
      });
      this.setData({ 'eventForm.title': '', 'eventForm.location': '', 'eventForm.groups': '', 'eventForm.signupEnd': '', hint: i18n.pick('活動已建立') });
      wx.showToast({ title: i18n.pick('已建立'), icon: 'success' });
      this.loadEventsAdmin();
    } catch (e) {
      wx.showToast({ title: e.message || i18n.pick('建立失敗'), icon: 'none' });
    } finally {
      this.setData({ creatingEvent: false });
    }
  },

  async toggleEventStatus(e) {
    const { id, status } = e.currentTarget.dataset;
    const next = status === 'CANCELLED' ? 'PUBLISHED' : 'CANCELLED';
    try {
      // W-42：帶上清單讀到的 version（取消會通知報名者，更不能蓋掉別人的改動）
      await admin.updateEvent(id, { status: next, ...versionPatch(e.currentTarget.dataset) });
      wx.showToast({ title: next === 'CANCELLED' ? i18n.pick('已取消') : i18n.pick('已恢復'), icon: 'success' });
      this.loadEventsAdmin();
    } catch (err) {
      onWriteError(err, () => this.loadEventsAdmin());
    }
  },

  // ───────── 家長綁定（P2）─────────
  async loadParents() {
    try {
      const res = await admin.parents({});
      this.setData({ parents: res.items || [], relations: res.relations || this.data.relations });
    } catch (e) {
      this.setData({ hint: i18n.pick('讀不到家長綁定：') + (e.message || e.code) });
    }
  },

  onParentField(e) {
    const patch = {};
    patch['parentForm.' + e.currentTarget.dataset.field] = e.detail.value;
    this.setData(patch);
  },

  pickRelation(e) {
    this.setData({ 'parentForm.relation': e.currentTarget.dataset.key });
  },

  async bindParent() {
    if (this.data.creatingParent) return;
    const f = this.data.parentForm;
    if (!f.parentAccount.trim() || !f.studentAccount.trim()) {
      wx.showToast({ title: i18n.pick('家長帳號與學生學號都要填'), icon: 'none' });
      return;
    }
    this.setData({ creatingParent: true });
    try {
      const res = await admin.linkParent(f.parentAccount.trim(), f.studentAccount.trim(), f.relation);
      this.setData({
        'parentForm.parentAccount': '',
        'parentForm.studentAccount': '',
        hint: i18n.pick('已綁定：') + res.parent.account + ' → ' + res.student.account,
      });
      wx.showToast({ title: i18n.pick('已綁定'), icon: 'success' });
      this.loadParents();
    } catch (e) {
      wx.showToast({ title: e.message || i18n.pick('綁定失敗'), icon: 'none' });
    } finally {
      this.setData({ creatingParent: false });
    }
  },

  unbindParent(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name || i18n.pick('這位學生');
    wx.showModal({
      title: i18n.pick('解除綁定'),
      content: i18n.pick('確定要解除與 ') + name + i18n.pick(' 的綁定？解除後家長就看不到這個孩子的資料。'),
      confirmText: i18n.pick('解除'),
      success: async (r) => {
        if (!r.confirm) return;
        try {
          await admin.unlinkParent(id);
          wx.showToast({ title: i18n.pick('已解除'), icon: 'success' });
          this.loadParents();
        } catch (err) {
          wx.showToast({ title: err.message || i18n.pick('解除失敗'), icon: 'none' });
        }
      },
    });
  },

  // ───────── W-53 第二階段：補登成績與出缺席 ─────────
  // 老師／校內職員在小程序內就能補一筆，不必回電腦的網頁後台。
  // 規則全部在後端：同步來的資料（source=SYNC）不能覆蓋、不能刪，前端只負責把錯誤訊息顯示出來。
  loadSchool() {
    const today = dateKey();
    const patch = {};
    if (!this.data.gForm.testDate) patch['gForm.testDate'] = today;
    if (!this.data.aForm.date) patch['aForm.date'] = today;
    if (Object.keys(patch).length) this.setData(patch);
    if (this.data.scPicked) return this.loadSchoolData();
    // 還沒選學生：先列出最近 20 位，老師可以直接點，不必先打字
    return this.loadSchoolStudents('', true);
  },

  onSchoolQuery(e) {
    this.setData({ scQuery: e.detail.value });
  },

  pressHit(e) {
    this.setData({ scPressed: Number(e.currentTarget.dataset.index) });
  },

  releaseHit() {
    this.setData({ scPressed: -1 });
  },

  findSchoolStudents() {
    return this.loadSchoolStudents((this.data.scQuery || '').trim(), false);
  },

  async loadSchoolStudents(q, quiet) {
    if (this.data.scBusy) return;
    this.setData({ scBusy: true });
    try {
      const res = await admin.schoolStudents(q);
      const items = (res.items || []).map((s) => {
        const cls = (s.grade || '') + (s.className || '');
        return {
          id: s.id,
          account: s.account,
          title: s.nickname || s.account,
          meta: cls ? i18n.pick('班別') + ' ' + cls : i18n.pick('沒有班別資料'),
        };
      });
      this.setData({
        scHits: items,
        hint: items.length || quiet ? '' : i18n.pick('找不到符合的學生（只搜尋學生身分，試試完整學號）'),
      });
    } catch (e) {
      this.setData({ scHits: [], hint: i18n.pick('讀不到學生名單：') + (e.message || e.code) });
    } finally {
      this.setData({ scBusy: false });
    }
  },

  pickSchoolStudent(e) {
    const id = e.currentTarget.dataset.id;
    const hit = (this.data.scHits || []).filter((s) => s.id === id)[0];
    if (!hit) return;
    this.setData({
      scPicked: hit,
      scHits: [],
      scGrades: [],
      scAttend: [],
      scSummaryText: '',
      scPressed: -1,
      hint: '',
    });
    return this.loadSchoolData();
  },

  pickSchoolMode(e) {
    this.setData({ scMode: e.currentTarget.dataset.key, hint: '' });
  },

  async loadSchoolData() {
    const p = this.data.scPicked;
    if (!p) {
      this.setData({ hint: i18n.pick('先在上面找一位學生') });
      return;
    }
    try {
      const res = await admin.schoolGrades(p.id);
      const raw = res.items || [];
      const grades = raw.map((g) => ({
        id: g.id,
        manual: !!g.manual,
        title: g.courseName + ' · ' + g.testType,
        scoreText: g.score === null || g.score === undefined ? '—' : String(g.score),
        meta: String(g.testDate).slice(0, 10) + ' · ' + g.yearTerm + ' ' + g.term,
      }));
      const patch = { scGrades: grades };
      // 學年／學段沿用最近一筆，補下一科不用重打
      if (raw.length && !this.data.gForm.yearTerm) patch['gForm.yearTerm'] = raw[0].yearTerm || '';
      if (raw.length && !this.data.gForm.term) patch['gForm.term'] = raw[0].term || '';
      this.setData(patch);
    } catch (e) {
      this.setData({ scGrades: [], hint: i18n.pick('讀不到成績：') + (e.message || e.code) });
    }
    try {
      const res = await admin.schoolAttendance(p.id);
      const rows = (res.items || []).map((a) => ({
        id: a.id,
        manual: !!a.manual,
        dateText: String(a.date).slice(0, 10),
        amText: this.attText(a.amStatus),
        pmText: this.attText(a.pmStatus),
        remark: a.remark || '',
      }));
      const sum = res.summary || { total: 0, late: 0, absent: 0 };
      this.setData({
        scAttend: rows,
        scSummaryText:
          i18n.pick('共 ') + sum.total + i18n.pick(' 天，遲到 ') + sum.late + i18n.pick(' 次，未正常出席 ') + sum.absent + i18n.pick(' 次'),
      });
    } catch (e) {
      this.setData({ scAttend: [], scSummaryText: '', hint: i18n.pick('讀不到出缺席：') + (e.message || e.code) });
    }
  },

  attText(key) {
    const hit = (this.data.attStatuses || []).filter((s) => s.key === key)[0];
    return hit ? hit.label : key;
  },

  onGradeField(e) {
    const patch = {};
    patch['gForm.' + e.currentTarget.dataset.field] = e.detail.value;
    this.setData(patch);
  },

  pickGradeTerm(e) {
    this.setData({ 'gForm.term': e.currentTarget.dataset.key });
  },

  onGradeDate(e) {
    this.setData({ 'gForm.testDate': e.detail.value });
  },

  async submitGrade() {
    if (this.data.scSaving) return;
    const p = this.data.scPicked;
    if (!p) {
      wx.showToast({ title: i18n.pick('先在上面找一位學生'), icon: 'none' });
      return;
    }
    const f = this.data.gForm;
    const yearTerm = (f.yearTerm || '').trim();
    const courseName = (f.courseName || '').trim();
    const testType = (f.testType || '').trim();
    if (!yearTerm || !f.term || !courseName || !testType || !f.testDate) {
      wx.showToast({ title: i18n.pick('學年、學段、科目、類型、日期都要填'), icon: 'none' });
      return;
    }
    const raw = String(f.score === null || f.score === undefined ? '' : f.score).trim();
    const score = raw === '' ? null : Number(raw);
    if (score !== null && (!Number.isFinite(score) || score < 0)) {
      wx.showToast({ title: i18n.pick('分數要填 0 或以上的數字'), icon: 'none' });
      return;
    }
    this.setData({ scSaving: true });
    try {
      await admin.schoolGradeCreate({
        studentId: p.id,
        yearTerm: yearTerm,
        term: f.term,
        courseName: courseName,
        testType: testType,
        testDate: f.testDate,
        score: score,
      });
      wx.showToast({ title: i18n.pick('已補登'), icon: 'success' });
      this.setData({ 'gForm.courseName': '', 'gForm.testType': '', 'gForm.score': '' });
      this.loadSchoolData();
    } catch (e) {
      // 「這筆是家校通同步的資料」會走這條 —— 原文照顯示，老師才知道要改同步而不是重打
      wx.showToast({ title: (e && e.message) || i18n.pick('補登失敗'), icon: 'none' });
    } finally {
      this.setData({ scSaving: false });
    }
  },

  /* ── 批次匯入成績（一次貼多筆：科目,類型,日期,分數）── */

  toggleGradeBatch() {
    this.setData({ gBatchOpen: !this.data.gBatchOpen, gBatchResult: null, gBatchChecked: false });
  },

  onGradeBatchText(e) {
    // 改了內容就要重新檢查，不能拿舊的預覽直接匯入
    this.setData({ gBatchText: e.detail.value, gBatchChecked: false });
  },

  async fillGradeBatchTemplate() {
    try {
      const res = await admin.schoolGradeTemplate();
      this.setData({ gBatchText: (res && res.text) || '', gBatchResult: null, gBatchChecked: false });
    } catch (e) {
      wx.showToast({ title: (e && e.message) || i18n.pick('讀不到範本'), icon: 'none' });
    }
  },

  checkGradeBatch() {
    return this.runGradeBatch(true);
  },

  confirmGradeBatch() {
    if (!this.data.gBatchChecked) {
      wx.showToast({ title: i18n.pick('請先按「先檢查」'), icon: 'none' });
      return Promise.resolve();
    }
    return this.runGradeBatch(false);
  },

  async runGradeBatch(dryRun) {
    const p = this.data.scPicked;
    if (!p) {
      wx.showToast({ title: i18n.pick('先在上面找一位學生'), icon: 'none' });
      return;
    }
    const text = (this.data.gBatchText || '').trim();
    if (!text) {
      wx.showToast({ title: i18n.pick('先貼上要補的內容'), icon: 'none' });
      return;
    }
    const yearTerm = (this.data.gForm.yearTerm || '').trim();
    const term = this.data.gForm.term;
    if (!yearTerm || !term) {
      wx.showToast({ title: i18n.pick('先填好學年與學段'), icon: 'none' });
      return;
    }
    if (this.data.gBatchBusy) return;
    this.setData({ gBatchBusy: true });
    try {
      const res = await admin.schoolGradeBatch({
        studentId: p.id,
        yearTerm: yearTerm,
        term: term,
        text: text,
        dryRun: !!dryRun,
      });
      const rows = (res.rows || []).map((r) => ({
        line: r.line,
        ok: !!r.ok,
        label: r.label || '',
        message: r.message || '',
      }));
      this.setData({
        gBatchResult: {
          total: res.total,
          success: res.success,
          failed: res.failed,
          rows: rows,
        },
        // 只有「檢查過而且至少有一列寫得進去」才放行確認匯入
        gBatchChecked: !!dryRun && res.success > 0,
      });
      wx.showToast({
        title: dryRun
          ? i18n.pick('檢查完成')
          : i18n.pick('已補登 ') + res.success + i18n.pick(' 筆'),
        icon: 'none',
      });
      if (!dryRun) this.loadSchoolData();
    } catch (e) {
      wx.showToast({ title: (e && e.message) || i18n.pick('匯入失敗'), icon: 'none' });
    } finally {
      this.setData({ gBatchBusy: false });
    }
  },

  deleteGrade(e) {
    const id = e.currentTarget.dataset.id;
    const title = e.currentTarget.dataset.title || i18n.pick('這筆成績');
    wx.showModal({
      title: i18n.pick('刪除補登'),
      content: i18n.pick('確定刪掉「') + title + i18n.pick('」嗎？刪掉學生就看不到了。'),
      confirmText: i18n.pick('刪除'),
      success: async (r) => {
        if (!r.confirm) return;
        try {
          await admin.schoolGradeDelete(id);
          wx.showToast({ title: i18n.pick('已刪除'), icon: 'success' });
          this.loadSchoolData();
        } catch (err) {
          wx.showToast({ title: (err && err.message) || i18n.pick('刪除失敗'), icon: 'none' });
        }
      },
    });
  },

  onAttendDate(e) {
    this.setData({ 'aForm.date': e.detail.value });
  },

  onAttendRemark(e) {
    this.setData({ 'aForm.remark': e.detail.value });
  },

  pickAttendStatus(e) {
    const patch = {};
    patch[e.currentTarget.dataset.field === 'pm' ? 'aForm.pmStatus' : 'aForm.amStatus'] = e.currentTarget.dataset.key;
    this.setData(patch);
  },

  async submitAttend() {
    if (this.data.scSaving) return;
    const p = this.data.scPicked;
    if (!p) {
      wx.showToast({ title: i18n.pick('先在上面找一位學生'), icon: 'none' });
      return;
    }
    const f = this.data.aForm;
    const yearTerm = (this.data.gForm.yearTerm || '').trim();
    if (!f.date) {
      wx.showToast({ title: i18n.pick('要選日期'), icon: 'none' });
      return;
    }
    if (!yearTerm || !this.data.gForm.term) {
      wx.showToast({ title: i18n.pick('先在成績那邊填學年與學段（出缺席沿用同一組）'), icon: 'none' });
      return;
    }
    this.setData({ scSaving: true });
    try {
      await admin.schoolAttendCreate({
        studentId: p.id,
        date: f.date,
        yearTerm: yearTerm,
        term: this.data.gForm.term,
        amStatus: f.amStatus,
        pmStatus: f.pmStatus,
        remark: (f.remark || '').trim() || undefined,
      });
      wx.showToast({ title: i18n.pick('已補登'), icon: 'success' });
      this.setData({ 'aForm.remark': '' });
      this.loadSchoolData();
    } catch (e) {
      wx.showToast({ title: (e && e.message) || i18n.pick('補登失敗'), icon: 'none' });
    } finally {
      this.setData({ scSaving: false });
    }
  },

  deleteAttend(e) {
    const id = e.currentTarget.dataset.id;
    const day = e.currentTarget.dataset.day || '';
    wx.showModal({
      title: i18n.pick('刪除補登'),
      content: i18n.pick('確定刪掉 ') + day + i18n.pick(' 這筆出缺席嗎？'),
      confirmText: i18n.pick('刪除'),
      success: async (r) => {
        if (!r.confirm) return;
        try {
          await admin.schoolAttendDelete(id);
          wx.showToast({ title: i18n.pick('已刪除'), icon: 'success' });
          this.loadSchoolData();
        } catch (err) {
          wx.showToast({ title: (err && err.message) || i18n.pick('刪除失敗'), icon: 'none' });
        }
      },
    });
  },

  // ───────── 使用者管理 ─────────
  async loadUsers() {
    try {
      const q = this.data.userQuery;
      const res = await admin.users({ q: q.q || undefined, role: q.role || undefined });
      // roles 用後端回來的（帶 level 與 label，單一來源）；離線或舊後端才退回本地 ROLES
      const roles = (res.roles && res.roles.length) ? res.roles : ROLES;
      // W-41：最後登入時間換成本地時區、加上鎖定旗標（locked 由後端算，前端不比時間）
      const users = (res.items || []).map((u) => ({
        ...u,
        locked: Boolean(u.locked),
        lastLoginText: u.lastLoginAt ? dateTimeText(u.lastLoginAt) : '',
      }));
      this.setData({ users: users, meLevel: (res.me || {}).level || 0, roles: roles });
    } catch (e) {
      this.setData({ hint: i18n.pick('讀不到使用者：') + (e.message || e.code) });
    }
  },

  onUserQuery(e) {
    this.setData({ 'userQuery.q': e.detail.value });
  },

  applyUserQuery() {
    this.loadUsers();
  },

  filterUsers(e) {
    const role = e.currentTarget.dataset.role;
    this.setData({ 'userQuery.role': this.data.userQuery.role === role ? '' : role });
    this.loadUsers();
  },

  onUserField(e) {
    const field = e.currentTarget.dataset.field;
    const patch = {};
    patch['userForm.' + field] = e.detail.value;
    this.setData(patch);
  },

  pickNewUserRole(e) {
    this.setData({ 'userForm.role': e.currentTarget.dataset.role });
  },

  async createUser() {
    if (this.data.creatingUser) return;
    const f = this.data.userForm;
    if (!f.account.trim() || !f.password) {
      wx.showToast({ title: i18n.pick('帳號與密碼必填'), icon: 'none' });
      return;
    }
    this.setData({ creatingUser: true });
    try {
      await admin.createUser({
        account: f.account.trim(),
        password: f.password,
        nickname: f.nickname.trim() || undefined,
        role: f.role,
      });
      this.setData({ 'userForm.account': '', 'userForm.password': '', 'userForm.nickname': '', hint: i18n.pick('帳號已建立') });
      wx.showToast({ title: i18n.pick('已建立'), icon: 'success' });
      this.loadUsers();
    } catch (e) {
      wx.showToast({ title: e.message || i18n.pick('建立失敗'), icon: 'none' });
    } finally {
      this.setData({ creatingUser: false });
    }
  },

  startEdit(e) {
    const { id } = e.currentTarget.dataset;
    const row = (this.data.users || []).filter((u) => u.id === id)[0];
    if (!row) return;
    this.setData({
      editingId: id,
      editForm: { nickname: row.nickname || '', account: row.openid, password: '', role: row.role },
    });
  },

  cancelEdit() {
    this.setData({ editingId: '', editForm: { nickname: '', account: '', password: '', role: 'STUDENT' } });
  },

  onEditField(e) {
    const field = e.currentTarget.dataset.field;
    const patch = {};
    patch['editForm.' + field] = e.detail.value;
    this.setData(patch);
  },

  pickEditRole(e) {
    this.setData({ 'editForm.role': e.currentTarget.dataset.role });
  },

  async saveEdit() {
    const f = this.data.editForm;
    if (!f.nickname.trim() || !f.account.trim()) {
      wx.showToast({ title: i18n.pick('名稱與帳號都要填'), icon: 'none' });
      return;
    }
    const payload = { nickname: f.nickname.trim(), account: f.account.trim(), role: f.role };
    if (f.password) {
      if (f.password.length < 8) {
        wx.showToast({ title: i18n.pick('密碼至少 8 位'), icon: 'none' });
        return;
      }
      payload.password = f.password;
    }
    try {
      await admin.updateUser(this.data.editingId, payload);
      wx.showToast({ title: i18n.pick('已更新'), icon: 'success' });
      this.cancelEdit();
      this.loadUsers();
    } catch (e) {
      wx.showToast({ title: e.message || i18n.pick('更新失敗'), icon: 'none' });
    }
  },

  async resetPassword(e) {
    const id = e.currentTarget.dataset.id;
    const self = this;
    wx.showModal({
      title: i18n.pick('重設密碼'),
      editable: true,
      placeholderText: i18n.pick('輸入新密碼（至少 8 位）'),
      success(res) {
        if (!res.confirm || !res.content) return;
        if (res.content.length < 8) {
          wx.showToast({ title: i18n.pick('密碼至少 8 位'), icon: 'none' });
          return;
        }
        admin
          .resetPassword(id, res.content)
          .then(() => wx.showToast({ title: i18n.pick('已重設'), icon: 'success' }))
          .catch((err) => wx.showToast({ title: err.message || i18n.pick('重設失敗'), icon: 'none' }));
        void self;
      },
    });
  },

  async deleteUser(e) {
    const id = e.currentTarget.dataset.id;
    const account = e.currentTarget.dataset.account;
    const self = this;
    wx.showModal({
      title: i18n.pick('刪除帳號'),
      content: i18n.pick('刪除 ') + account + i18n.pick('？相關的認領／報名紀錄會一併清除。'),
      success(res) {
        if (!res.confirm) return;
        admin
          .deleteUser(id)
          .then(() => {
            wx.showToast({ title: i18n.pick('已刪除'), icon: 'success' });
            self.loadUsers();
          })
          .catch((err) => wx.showToast({ title: err.message || i18n.pick('刪除失敗'), icon: 'none' }));
      },
    });
  },

  async setRole(e) {
    const { id, role } = e.currentTarget.dataset;
    try {
      await admin.setRole(id, role);
      wx.showToast({ title: i18n.pick('已設為 ') + role, icon: 'success' });
      this.loadUsers();
    } catch (err) {
      wx.showToast({ title: err.message || i18n.pick('權限不足'), icon: 'none' });
    }
  },

  async toggleBan(e) {
    const { id, banned } = e.currentTarget.dataset;
    try {
      await admin.setBanned(id, banned !== '1');
      wx.showToast({ title: banned === '1' ? i18n.pick('已恢復') : i18n.pick('已停用'), icon: 'success' });
      this.loadUsers();
    } catch (err) {
      wx.showToast({ title: err.message || i18n.pick('操作失敗'), icon: 'none' });
    }
  },

  /** W-41：解除登入失敗鎖定（密碼錯太多次會鎖 15 分鐘） */
  async unlockUser(e) {
    const { id } = e.currentTarget.dataset;
    try {
      await admin.unlockUser(id);
      wx.showToast({ title: i18n.pick('已解除鎖定'), icon: 'success' });
      this.loadUsers();
    } catch (err) {
      wx.showToast({ title: err.message || i18n.pick('操作失敗'), icon: 'none' });
    }
  },

  // ───────── 檢舉 ─────────
  async loadReports() {
    try {
      const res = await admin.reports('PENDING');
      this.setData({ reports: res.items || [] });
    } catch (e) {
      this.setData({ hint: i18n.pick('讀不到檢舉：') + (e.message || e.code) });
    }
  },

  // ───────── 錯誤日誌（用戶端上報）─────────
  async loadErrors() {
    try {
      const res = await admin.errors(this.data.errStatus, this.data.errKind);
      const summary = res.summary || {};
      this.setData({
        errors: (res.items || []).map((e) =>
          Object.assign({}, e, {
            seenText: fromNow(e.lastSeenAt),
            firstSeenText: fromNow(e.firstSeenAt),
            isUserReport: e.kind === 'USER_REPORT',
            kindText: e.kind === 'USER_REPORT' ? i18n.pick('使用者回報') : i18n.pick('自動上報'),
            // 使用者回報沒有堆疊，機型與系統就是唯一的重現線索
            deviceText: [e.model, e.system].filter(Boolean).join(' · '),
            // 「同類」＝同一句話（不限頁面）。指紋含頁面，所以同一支 API 在不同頁出錯會拆成好幾列
            similarText: e.similar > 1 ? i18n.pick('同類 ') + e.similar + i18n.pick(' 筆') : '',
          }),
        ),
        errSummary: summary,
      });
    } catch (e) {
      this.setData({ hint: i18n.pick('讀不到錯誤日誌：') + (e.message || e.code) });
    }
  },

  // ───────── 推送紀錄（W-37）─────────
  // 家長說「沒收到通知」時，這裡看得到是沒有同意過、沒有帳號，還是微信回了錯誤碼。
  async loadPushLogs() {
    try {
      const res = await admin.pushLogs(this.data.pushOk, this.data.pushChannel, 50);
      const t = res.templates || {};
      // 模板未設定＝這個場景根本不會發微信消息（不是發了失敗），要明講，不然會被誤判成 bug
      const missing = ['claim', 'event', 'notice'].filter((k) => !t[k]);
      const NAMES = { claim: i18n.pick('認領通過'), event: i18n.pick('活動提醒'), notice: i18n.pick('緊急公告') };
      const SCENES = {
        EVENT: i18n.pick('活動'),
        CLAIM: i18n.pick('認領'),
        NOTICE: i18n.pick('公告'),
        SYSTEM: i18n.pick('系統'),
        claim: i18n.pick('認領通過'),
        event: i18n.pick('活動提醒'),
        notice: i18n.pick('緊急公告'),
      };
      this.setData({
        pushLogs: (res.items || []).map((x) =>
          Object.assign({}, x, {
            timeText: fromNow(x.createdAt),
            nameText: x.nickname || i18n.pick('（已刪除的使用者）'),
            roleText: x.role ? role.label(x.role) : '',
            titleText: x.title || i18n.pick('（無標題）'),
            sceneText: SCENES[x.scene] || '',
            channelText: x.channel === 'WX' ? i18n.pick('微信') : i18n.pick('站內'),
            resultText: x.ok ? i18n.pick('已送出') : i18n.pick('失敗'),
            errorText: x.error || i18n.pick('未知原因'),
          }),
        ),
        pushSummary: res.summary || { total: 0, ok: 0, failed: 0, last24h: 0 },
        pushTplHint: missing.length
          ? i18n.pick('微信模板未設定：') + missing.map((k) => NAMES[k]).join(i18n.pick('、')) + i18n.pick('（這幾個場景不會發微信消息）')
          : i18n.pick('微信模板三個場景都已設定'),
      });
    } catch (e) {
      this.setData({ hint: i18n.pick('讀不到推送紀錄：') + (e.message || e.code) });
    }
  },

  pickPushOk(e) {
    this.setData({ pushOk: e.currentTarget.dataset.key });
    this.loadPushLogs();
  },

  pickPushChannel(e) {
    this.setData({ pushChannel: e.currentTarget.dataset.key });
    this.loadPushLogs();
  },

  // ── W-40 資源回收桶 ──
  /** 讀取被刪的公告／失物清單。deletedByName 後端已算好（公告讀 deletedBy、失物回推審計） */
  async loadTrash() {
    try {
      const res = await admin.trash(this.data.trashType);
      const TYPE = { notice: i18n.pick('公告'), item: i18n.pick('失物') };
      const KIND = {
        NORMAL: i18n.pick('一般公告'),
        URGENT: i18n.pick('緊急公告'),
        CALENDAR: i18n.pick('校曆'),
      };
      const ITEM_KIND = { LOST: i18n.pick('遺失'), FOUND: i18n.pick('拾獲') };
      this.setData({
        trashRows: (res.items || []).map((x) => {
          const sub =
            x.type === 'notice'
              ? KIND[x.subtitle] || ''
              : (ITEM_KIND[x.itemType] || '') + (x.subtitle ? ' · ' + x.subtitle : '');
          return {
            id: x.id,
            type: x.type,
            title: x.title,
            typeText: TYPE[x.type] || x.type,
            subText: sub,
            timeText: fromNow(x.deletedAt),
            deleterText: x.deletedByName || i18n.pick('（未記錄）'),
          };
        }),
        trashCounts: res.counts || { notice: 0, item: 0, all: 0 },
      });
    } catch (e) {
      this.setData({ hint: i18n.pick('讀不到垃圾桶：') + (e.message || e.code) });
    }
  },

  pickTrashType(e) {
    this.setData({ trashType: e.currentTarget.dataset.key });
    this.loadTab();
  },

  /** 還原：二次確認後才送出 —— 還原公告等於把它重新公開給全校 */
  restoreTrash(e) {
    const id = e.currentTarget.dataset.id;
    const type = e.currentTarget.dataset.type;
    const title = e.currentTarget.dataset.title || '';
    const self = this;
    wx.showModal({
      title: i18n.pick('還原這筆內容'),
      content: title ? title + i18n.pick('」會立刻恢復顯示，確定嗎？') : i18n.pick('還原後會立刻恢復顯示，確定嗎？'),
      success(res) {
        if (!res.confirm) return;
        admin
          .restoreTrash(type, id)
          .then(() => {
            wx.showToast({ title: i18n.pick('已還原'), icon: 'none' });
            self.loadTab();
          })
          .catch((err) => wx.showToast({ title: (err && err.message) || i18n.pick('還原失敗'), icon: 'none' }));
      },
    });
  },

  // 同類一次解決：把同一句話在「所有頁面」的錯誤一起標成已解決
  resolveSimilarErr(e) {
    const message = e.currentTarget.dataset.message;
    const self = this;
    wx.showModal({
      title: i18n.pick('同類一次解決'),
      content: i18n.pick('同一句話在不同頁面出現的錯誤會一起標記為已解決，確定嗎？'),
      success(res) {
        if (!res.confirm) return;
        admin
          .resolveSimilarErrors(message, '')
          .then((r) => {
            wx.showToast({ title: i18n.pick('已解決 ') + r.resolved + i18n.pick(' 筆'), icon: 'none' });
            self.loadErrors();
          })
          .catch((err) => wx.showToast({ title: err.message || i18n.pick('操作失敗'), icon: 'none' }));
      },
    });
  },

  // 清理舊紀錄：只刪「已解決」的，未解決的不動（刪待辦事項等於把 bug 藏起來）
  cleanupErrors() {
    const self = this;
    const days = [30, 90, 180];
    wx.showActionSheet({
      itemList: days.map((d) => d + i18n.pick(' 天前')),
      success(res) {
        const picked = days[res.tapIndex];
        if (!picked) return;
        wx.showModal({
          title: i18n.pick('清理舊紀錄'),
          content: i18n.pick('只會刪除 ') + picked + i18n.pick(' 天前已解決的紀錄，未解決的不會動。'),
          success(m) {
            if (!m.confirm) return;
            admin
              .cleanupErrors(picked, false)
              .then((r) => {
                const tail = r.kept ? i18n.pick('，保留 ') + r.kept + i18n.pick(' 筆未解決') : '';
                wx.showToast({ title: i18n.pick('已清理 ') + r.deleted + i18n.pick(' 筆') + tail, icon: 'none' });
                self.loadErrors();
              })
              .catch((err) => wx.showToast({ title: err.message || i18n.pick('操作失敗'), icon: 'none' }));
          },
        });
      },
    });
  },

  pickErrStatus(e) {
    this.setData({ errStatus: e.currentTarget.dataset.key });
    this.loadErrors();
  },

  pickErrKind(e) {
    this.setData({ errKind: e.currentTarget.dataset.key });
    this.loadErrors();
  },

  async toggleErrStatus(e) {
    const { id, action } = e.currentTarget.dataset;
    try {
      await admin.setErrorStatus(id, action);
      wx.showToast({ title: action === 'RESOLVE' ? i18n.pick('已標記解決') : i18n.pick('已重新打開'), icon: 'none' });
      this.loadErrors();
    } catch (err) {
      wx.showToast({ title: err.message || i18n.pick('操作失敗'), icon: 'none' });
    }
  },

  async handleReport(e) {
    const { id, action } = e.currentTarget.dataset;
    try {
      const remove = action === 'RESOLVE';
      const res = await admin.handleReport(id, action, remove);
      wx.showToast({ title: action === 'RESOLVE' ? (res.removed ? i18n.pick('已成立並下架') : i18n.pick('已成立')) : i18n.pick('已駁回'), icon: 'none' });
      this.loadReports();
    } catch (err) {
      wx.showToast({ title: err.message || i18n.pick('操作失敗'), icon: 'none' });
    }
  },

  // ───────── 審計 ─────────
  async togglePerms() {
    const next = !this.data.showPerms;
    this.setData({ showPerms: next });
    if (next && !this.data.abilities.length) {
      try {
        const res = await admin.permissions();
        const labels = { STUDENT: i18n.pick('學生'), TEACHER: i18n.pick('老師'), ADMIN: i18n.pick('資訊管理員'), SUPER_ADMIN: i18n.pick('最高權限') };
        this.setData({ abilities: (res.abilities || []).map((a) => Object.assign({}, a, { allowedText: a.allowed.map((r) => labels[r] || r).join('、') })) });
      } catch (e) {
        this.setData({ hint: i18n.pick('讀不到權限表：') + (e.message || e.code) });
      }
    }
  },

  async loadAudit() {
    try {
      const res = await admin.audit(50);
      this.setData({ audit: res.items || [] });
    } catch (e) {
      this.setData({ hint: i18n.pick('讀不到審計紀錄：') + (e.message || e.code) });
    }
  },

  // ───────── 公告列表／刪除 ─────────
  async loadNoticeList() {
    try {
      const res = await admin.notices();
      // W-58：排程中的公告要看得見「幾號幾點會上線」，否則老師只能靠記憶
      const items = (res.items || []).map((n) => Object.assign({}, n, { publishText: dateTimeText(n.publishedAt) }));
      this.setData({ noticeList: items });
    } catch (e) {
      this.setData({ hint: i18n.pick('讀不到公告：') + (e.message || e.code) });
    }
  },

  // ───────── W-54 已讀統計／催讀 ─────────
  /** 取一則公告的已讀／未讀名單；名單在畫面上只放得下前 30 位，多的用旗標提示 */
  async loadNoticeStats(id) {
    try {
      const s = await admin.noticeReadStats(id);
      const names = (list) => (list || []).map((u) => u.nickname || i18n.pick('匿名')).join('、').slice(0, 160);
      this.setData({
        noticeStats: {
          id,
          read: s.read,
          total: s.total,
          rate: s.rate,
          readText: s.read + ' / ' + s.total + '（' + s.rate + '%）',
          readerText: names(s.readers) || this.data.L.k230,
          unreadText: names(s.unreadUsers) || this.data.L.k231,
          moreText: s.truncated && (s.truncated.readers || s.truncated.unread) ? this.data.L.k229 : '',
        },
      });
    } catch (err) {
      wx.showToast({ title: (err && err.message) || this.data.L.k234, icon: 'none' });
    }
  },

  /** 點同一則＝收起，點別則＝換那一則（只展開一份，避免整頁變成一大張表） */
  async openNoticeStats(e) {
    const id = e.currentTarget.dataset.id;
    if (this.data.noticeStats && this.data.noticeStats.id === id) {
      this.setData({ noticeStats: null });
      return;
    }
    await this.loadNoticeStats(id);
  },

  remindNotice(e) {
    const { id, title } = e.currentTarget.dataset;
    const self = this;
    wx.showModal({
      title: self.data.L.k235,
      content: (title || '') + self.data.L.k236,
      confirmText: self.data.L.k237,
      success(res) {
        if (!res.confirm) return;
        admin
          .remindNotice(id)
          .then((r) => {
            const more = r.skipped ? self.data.L.k233 + r.skipped + i18n.pick(' 人') : '';
            wx.showToast({ title: self.data.L.k232 + (r.inApp || 0) + i18n.pick(' 人') + more, icon: 'none' });
            self.loadNoticeList();
            if (self.data.noticeStats && self.data.noticeStats.id === id) self.loadNoticeStats(id);
          })
          .catch((err) => wx.showToast({ title: (err && err.message) || self.data.L.k238, icon: 'none' }));
      },
    });
  },

  async removeItem(e) {
    const { id, title } = e.currentTarget.dataset;
    const key = 'it-' + id;
    if (this._pendingDelete !== key) {
      this._pendingDelete = key;
      wx.showToast({ title: i18n.pick('再按一次刪除「') + (title || '') + i18n.pick('」'), icon: 'none', duration: 2500 });
      setTimeout(() => { if (this._pendingDelete === key) this._pendingDelete = ''; }, 4000);
      return;
    }
    this._pendingDelete = '';
    try {
      await admin.deleteItem(id);
      wx.showToast({ title: i18n.pick('已移到垃圾桶'), icon: 'success' });
      this.loadItems();
      this.loadTrash();
    } catch (err) {
      wx.showToast({ title: (err && err.message) || i18n.pick('刪除失敗'), icon: 'none' });
    }
  },

  async removeEvent(e) {
    const id = e.currentTarget.dataset.id;
    const title = e.currentTarget.dataset.title || '';
    const self = this;
    wx.showModal({
      title: i18n.pick('刪除活動'),
      content: title + i18n.pick('會移到垃圾桶，可以再還原。'),
      confirmText: i18n.pick('刪除'),
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await admin.deleteEvent(id);
          wx.showToast({ title: i18n.pick('已刪除'), icon: 'success' });
          self.refresh && self.refresh();
        } catch (err) {
          wx.showToast({ title: (err && err.message) || i18n.pick('刪除失敗'), icon: 'none' });
        }
      },
    });
  },

  async deleteNotice(e) {
    const id = e.currentTarget.dataset.id;
    const self = this;
    wx.showModal({
      title: i18n.pick('刪除公告'),
      content: i18n.pick('刪除後無法復原，確定嗎？'),
      success(res) {
        if (!res.confirm) return;
        admin
          .deleteNotice(id)
          .then(() => {
            wx.showToast({ title: i18n.pick('已刪除'), icon: 'success' });
            self.loadNoticeList();
          })
          .catch((err) => wx.showToast({ title: err.message || i18n.pick('刪除失敗'), icon: 'none' }));
      },
    });
  },

  async togglePin(e) {
    const { id, pinned } = e.currentTarget.dataset;
    try {
      // W-42：帶上清單讀到的 version；別人先改過就回 409（不再靜默覆蓋）
      await admin.updateNotice(id, { isPinned: pinned !== '1', ...versionPatch(e.currentTarget.dataset) });
      this.loadNoticeList();
    } catch (err) {
      onWriteError(err, () => this.loadNoticeList());
    }
  },

  // ───────── 菜單整週 ─────────
  async loadMenuWeek() {
    try {
      const res = await admin.menuWeek(this.data.menuWeekStart || undefined);
      this.setData({ menuWeekStart: res.weekStart, menuEntries: res.items || [] });
    } catch (e) {
      this.setData({ hint: i18n.pick('讀不到菜單：') + (e.message || e.code) });
    }
  },

  async deleteMenuEntry(e) {
    const id = e.currentTarget.dataset.id;
    try {
      await admin.deleteMenuEntry(id);
      wx.showToast({ title: i18n.pick('已移除'), icon: 'success' });
      this.loadMenuWeek();
    } catch (err) {
      wx.showToast({ title: err.message || i18n.pick('移除失敗'), icon: 'none' });
    }
  },

  // ───────── 圖書館（W-66） ─────────
  // 館藏管理與借閱紀錄在同一個分頁的兩個子模式：圖書館職員日常只做兩件事 ——
  // 「登記／改書」與「看誰還沒還」，把它們放在一起比開兩個分頁好找。
  async loadLibrary() {
    if (this.data.libMode === 'loans') {
      try {
        const res = await admin.libraryLoans({ status: this.data.libStatus });
        this.setData({ libLoans: (res.items || []).map(decorateLoan), libSummary: res.summary || { active: 0, overdue: 0 } });
      } catch (e) {
        this.setData({ hint: i18n.pick('讀不到借閱紀錄：') + (e.message || e.code) });
      }
      return;
    }
    try {
      const res = await admin.libraryBooks({ limit: 50 });
      this.setData({ libBooks: (res.items || []).map(decorateBook) });
    } catch (e) {
      this.setData({ hint: i18n.pick('讀不到館藏：') + (e.message || e.code) });
    }
  },

  switchLibMode(e) {
    this.setData({ libMode: e.currentTarget.dataset.key }, () => this.loadLibrary());
  },

  pickLibStatus(e) {
    this.setData({ libStatus: e.currentTarget.dataset.key }, () => this.loadLibrary());
  },

  onLibField(e) {
    const field = e.currentTarget.dataset.field;
    if (!field) return;
    this.setData({ ['libForm.' + field]: e.detail.value });
  },

  libScan() {
    wx.scanCode({
      scanType: ['barCode'],
      success: (res) => {
        const isbn = String(res.result || '').replace(/[^0-9Xx]/g, '');
        if (isbn) this.setData({ 'libForm.isbn': isbn });
      },
      fail: () => {},
    });
  },

  libResetForm() {
    this.setData({
      libForm: { id: '', title: '', isbn: '', author: '', category: '', callNumber: '', totalCopies: '1', loanDays: '14' },
    });
  },

  /** 編輯：直接從清單那一列帶資料進來（不另外打一次詳情端點） */
  libEdit(e) {
    const id = e.currentTarget.dataset.id;
    const book = this.data.libBooks.filter((b) => b.id === id)[0];
    if (!book) return;
    this.setData({
      libForm: {
        id: book.id,
        title: book.title || '',
        isbn: book.isbn || '',
        author: book.author || '',
        category: book.category || '',
        callNumber: book.callNumber || '',
        totalCopies: String(book.totalCopies || 1),
        loanDays: String(book.loanDays || 14),
        version: book.version,
      },
    });
  },

  async libSave() {
    if (this.data.libSaving) return;
    const f = this.data.libForm;
    const title = String(f.title || '').trim();
    if (!title) {
      wx.showToast({ title: i18n.pick('請輸入書名'), icon: 'none' });
      return;
    }
    const payload = {
      title: title,
      isbn: f.isbn || undefined,
      author: f.author || undefined,
      category: f.category || undefined,
      callNumber: f.callNumber || undefined,
      totalCopies: Number(f.totalCopies) || 1,
      loanDays: Number(f.loanDays) || 14,
    };

    this.setData({ libSaving: true });
    try {
      if (f.id) {
        // 帶 version：兩人先後存同一筆時後者會拿到 409，而不是靜默覆蓋
        await admin.libraryBookUpdate(f.id, Object.assign({}, payload, { version: f.version }));
      } else {
        await admin.libraryBookCreate(payload);
      }
      this.setData({ libSaving: false });
      wx.showToast({ title: i18n.pick('已儲存'), icon: 'success' });
      this.libResetForm();
      this.loadLibrary();
    } catch (err) {
      this.setData({ libSaving: false });
      wx.showToast({ title: err.message || i18n.pick('儲存失敗'), icon: 'none' });
    }
  },

  libArchive(e) {
    const id = e.currentTarget.dataset.id;
    const archived = e.currentTarget.dataset.archived === true || e.currentTarget.dataset.archived === 'true';
    admin
      .libraryBookArchive(id, archived)
      .then(() => {
        wx.showToast({ title: archived ? i18n.pick('已下架') : i18n.pick('已上架'), icon: 'success' });
        this.loadLibrary();
      })
      .catch((err) => wx.showToast({ title: err.message || i18n.pick('操作失敗'), icon: 'none' }));
  },

  /** 刪除一律用原生確認框（自製兩段式在 Skyline 下第二次點不到） */
  libDelete(e) {
    const id = e.currentTarget.dataset.id;
    const title = e.currentTarget.dataset.title || '';
    wx.showModal({
      title: i18n.pick('確定刪除這本書？'),
      content: title,
      confirmText: i18n.pick('刪除'),
      cancelText: i18n.pick('取消'),
      success: (r) => {
        if (!r.confirm) return;
        admin
          .libraryBookDelete(id)
          .then(() => {
            wx.showToast({ title: i18n.pick('已刪除'), icon: 'success' });
            this.loadLibrary();
          })
          .catch((err) => wx.showToast({ title: err.message || i18n.pick('刪除失敗'), icon: 'none' }));
      },
    });
  },

  /** 代還：學生忘了帶書來也行，職員在系統上收回 */
  libReturn(e) {
    const id = e.currentTarget.dataset.id;
    admin
      .libraryReturn(id)
      .then(() => {
        wx.showToast({ title: i18n.pick('已歸還'), icon: 'success' });
        this.loadLibrary();
      })
      .catch((err) => wx.showToast({ title: err.message || i18n.pick('操作失敗'), icon: 'none' }));
  },

  libRemind() {
    admin
      .libraryRemind()
      .then((res) => {
        wx.showToast({ title: i18n.pick('已催還') + ' ' + ((res && res.checked) || 0), icon: 'none' });
        this.loadLibrary();
      })
      .catch((err) => wx.showToast({ title: err.message || i18n.pick('操作失敗'), icon: 'none' }));
  },

  // ── 轉贈（W-68）：校內職員日常只做一件事 —— 把不合適的貼文下架，之後可以再上架 ──
  async loadGiveaways() {
    try {
      const res = await admin.giveaways(this.data.gvStatus);
      this.setData({
        gvItems: (res.items || []).map((item) => giveawayUtil.decorateItem(item)),
        gvStats: res.stats || { available: 0, given: 0, closed: 0, pendingRequests: 0 },
      });
    } catch (e) {
      this.setData({ hint: i18n.pick('讀不到轉贈清單：') + (e.message || e.code) });
    }
  },

  switchGvStatus(e) {
    this.setData({ gvStatus: e.currentTarget.dataset.key || 'all' }, () => this.loadGiveaways());
  },

  gvToggle(e) {
    const id = e.currentTarget.dataset.id;
    const next = e.currentTarget.dataset.next;
    const title = e.currentTarget.dataset.title || '';
    if (!id || !next) return;
    wx.showModal({
      title: next === 'CLOSED' ? i18n.pick('下架這筆轉贈？') : i18n.pick('重新上架？'),
      content: title,
      confirmText: next === 'CLOSED' ? i18n.pick('下架') : i18n.pick('重新上架'),
      cancelText: i18n.pick('再想想'),
      success: (r) => {
        if (!r.confirm) return;
        admin
          .setGiveawayStatus(id, next)
          .then(() => {
            wx.showToast({ title: next === 'CLOSED' ? i18n.pick('已下架') : i18n.pick('已上架'), icon: 'success' });
            this.loadGiveaways();
          })
          .catch((err) => wx.showToast({ title: err.message || i18n.pick('操作失敗'), icon: 'none' }));
      },
    });
  },

  // ───────── 場地／器材（W-67） ─────────
  // 同一頁兩個子模式：老師日常只做「批／駁」，總務才需要「登記場地」。
  async loadVenues() {
    if (this.data.venMode === 'resources') {
      try {
        const res = await admin.resourcesAll();
        this.setData({ venResources: (res.items || []).map((item) => venueUtil.shapeResource(item, Date.now())) });
      } catch (e) {
        this.setData({ hint: i18n.pick('讀不到場地清單：') + (e.message || e.code) });
      }
      return;
    }
    try {
      const res = await admin.resourcePending();
      const now = Date.now();
      this.setData({
        venPending: (res.pending || []).map((b) => venueUtil.shapeBooking(b, now)),
        venHandled: (res.handled || []).map((b) => venueUtil.shapeBooking(b, now)),
      });
    } catch (e) {
      this.setData({ hint: i18n.pick('讀不到待審批申請：') + (e.message || e.code) });
    }
  },

  switchVenMode(e) {
    this.setData({ venMode: e.currentTarget.dataset.key }, () => this.loadVenues());
  },

  venApprove(e) {
    const id = e.currentTarget.dataset.id;
    admin
      .resourceReview(id, { action: 'APPROVE' })
      .then(() => {
        wx.showToast({ title: i18n.pick('已批准'), icon: 'success' });
        this.loadVenues();
      })
      .catch((err) => wx.showToast({ title: err.message || i18n.pick('操作失敗'), icon: 'none' }));
  },

  /** 駁回一定要寫原因：學生看到「未通過」卻不知道為什麼，只會再送一次一樣的申請 */
  venReject(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: i18n.pick('駁回申請'),
      editable: true,
      placeholderText: i18n.pick('寫一句原因（會通知申請人）'),
      confirmText: i18n.pick('駁回'),
      cancelText: i18n.pick('取消'),
      success: (r) => {
        if (!r.confirm) return;
        admin
          .resourceReview(id, { action: 'REJECT', reason: r.content || '' })
          .then(() => {
            wx.showToast({ title: i18n.pick('已駁回'), icon: 'success' });
            this.loadVenues();
          })
          .catch((err) => wx.showToast({ title: err.message || i18n.pick('操作失敗'), icon: 'none' }));
      },
    });
  },

  // ───────── 請假（W-72）─────────
  // 老師與校務處都批得了（能力 leave:review）；名單依狀態篩，預設只看待審批。
  async loadLeaves() {
    try {
      const res = await admin.leaves(this.data.leaveStatus);
      const tone = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger', CANCELLED: 'neutral' };
      this.setData({
        leaveItems: (res.items || []).map((row) => Object.assign({}, row, { statusTone: tone[row.status] || 'neutral' })),
        leaveCounts: res.counts || this.data.leaveCounts,
      });
    } catch (e) {
      this.setData({ hint: i18n.pick('讀不到假單：') + (e.message || e.code) });
    }
  },

  switchLeaveStatus(e) {
    this.setData({ leaveStatus: e.currentTarget.dataset.key }, () => this.loadLeaves());
  },

  leaveApprove(e) {
    const id = e.currentTarget.dataset.id;
    admin
      .reviewLeave(id, { action: 'APPROVE' })
      .then(() => {
        wx.showToast({ title: this.data.L.k343, icon: 'success' });
        this.loadLeaves();
      })
      .catch((err) => wx.showToast({ title: err.message || i18n.pick('操作失敗'), icon: 'none' }));
  },

  /** 駁回一定要寫原因：家長看到「未通過」卻不知道為什麼，只會再送一次一樣的假單 */
  leaveReject(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: this.data.L.k341,
      editable: true,
      placeholderText: this.data.L.k342,
      confirmText: i18n.pick('駁回'),
      cancelText: i18n.pick('取消'),
      success: (r) => {
        if (!r.confirm) return;
        admin
          .reviewLeave(id, { action: 'REJECT', reason: r.content || '' })
          .then(() => {
            wx.showToast({ title: this.data.L.k344, icon: 'success' });
            this.loadLeaves();
          })
          .catch((err) => wx.showToast({ title: err.message || i18n.pick('操作失敗'), icon: 'none' }));
      },
    });
  },

  // ───────── 課表（W-73）─────────
  async loadTimetable() {
    try {
      const res = await admin.timetableAll();
      this.setData({ ttClasses: res.classes || [], ttRows: [], ttErrors: [], ttSummary: '' });
    } catch (e) {
      this.setData({ hint: i18n.pick('讀不到課表：') + (e.message || e.code) });
    }
  },

  onTtCsv(e) {
    this.setData({ ttCsv: e.detail.value });
  },

  async ttRun(e) {
    if (this.data.ttBusy) return;
    const dryRun = e.currentTarget.dataset.dry !== '0';
    if (!String(this.data.ttCsv || '').trim()) {
      wx.showToast({ title: this.data.L.k354, icon: 'none' });
      return;
    }
    this.setData({ ttBusy: true });
    try {
      const res = await admin.importTimetable({ csv: this.data.ttCsv, dryRun: dryRun });
      const rows = (res.rows || []).map((row) =>
        Object.assign({}, row, {
          statusText: row.status === 'EXISTS' ? this.data.L.k355 : row.status === 'DUPLICATE' ? this.data.L.k356 : '',
        }),
      );
      this.setData({
        ttBusy: false,
        ttRows: rows,
        ttErrors: res.errors || [],
        ttSummary: (res.dryRun ? this.data.L.k349 : this.data.L.k350) + '：' + res.ok + '/' + res.total + (res.created ? ' → ' + res.created : ''),
      });
      if (!dryRun) this.loadTimetable();
    } catch (err) {
      this.setData({ ttBusy: false });
      wx.showToast({ title: err.message || i18n.pick('操作失敗'), icon: 'none' });
    }
  },

  ttDelete(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: this.data.L.k357,
      content: i18n.pick('刪除這一格課表？'),
      confirmText: this.data.L.k357,
      cancelText: i18n.pick('取消'),
      success: (r) => {
        if (!r.confirm) return;
        admin
          .deleteTimetableSlot(id)
          .then(() => {
            wx.showToast({ title: i18n.pick('已刪除'), icon: 'success' });
            this.loadTimetable();
          })
          .catch((err) => wx.showToast({ title: err.message || i18n.pick('操作失敗'), icon: 'none' }));
      },
    });
  },

  onVenField(e) {
    const field = e.currentTarget.dataset.field;
    if (!field) return;
    this.setData({ ['venForm.' + field]: e.detail.value });
  },

  venSetApproval(e) {
    this.setData({ 'venForm.needsApproval': e.currentTarget.dataset.v === '1' });
  },

  venKindChange(e) {
    const kinds = ['VENUE', 'EQUIPMENT'];
    this.setData({ 'venForm.kind': kinds[Number(e.detail.value) || 0] });
  },

  venResetForm() {
    this.setData({
      venForm: { id: '', kind: 'VENUE', name: '', location: '', openFrom: '08:00', openTo: '18:00', maxHours: '4', needsApproval: true },
    });
  },

  venEdit(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.venResources.filter((r) => r.id === id)[0];
    if (!item) return;
    this.setData({
      venForm: {
        id: item.id,
        kind: item.kind,
        name: item.name || '',
        location: item.location || '',
        openFrom: item.openFrom || '08:00',
        openTo: item.openTo || '18:00',
        maxHours: String(item.maxHours || 4),
        needsApproval: item.needsApproval !== false,
        version: item.version,
      },
    });
  },

  async venSave() {
    if (this.data.venSaving) return;
    const f = this.data.venForm;
    const name = String(f.name || '').trim();
    if (!name) {
      wx.showToast({ title: i18n.pick('請輸入名稱'), icon: 'none' });
      return;
    }
    if (String(f.openFrom) >= String(f.openTo)) {
      wx.showToast({ title: i18n.pick('關閉時間要晚於開放時間'), icon: 'none' });
      return;
    }
    const payload = {
      kind: f.kind || 'VENUE',
      name: name,
      location: f.location || undefined,
      openFrom: f.openFrom,
      openTo: f.openTo,
      maxHours: Number(f.maxHours) || 4,
      needsApproval: !!f.needsApproval,
    };
    this.setData({ venSaving: true });
    try {
      if (f.id) {
        await admin.resourceUpdate(f.id, Object.assign({}, payload, { version: f.version }));
      } else {
        await admin.resourceCreate(payload);
      }
      this.setData({ venSaving: false });
      wx.showToast({ title: i18n.pick('已儲存'), icon: 'success' });
      this.venResetForm();
      this.loadVenues();
    } catch (err) {
      this.setData({ venSaving: false });
      wx.showToast({ title: err.message || i18n.pick('儲存失敗'), icon: 'none' });
    }
  },

  venArchive(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name || '';
    wx.showModal({
      title: i18n.pick('確定下架這個場地？'),
      content: name,
      confirmText: i18n.pick('下架'),
      cancelText: i18n.pick('取消'),
      success: (r) => {
        if (!r.confirm) return;
        admin
          .resourceArchive(id)
          .then(() => {
            wx.showToast({ title: i18n.pick('已下架'), icon: 'success' });
            this.loadVenues();
          })
          .catch((err) => wx.showToast({ title: err.message || i18n.pick('操作失敗'), icon: 'none' }));
      },
    });
  },

  // ───────── 功課後台（W-77）─────────
  /**
   * 跨班一覽：老師只出自己班的功課（`/homework`），這一頁是校務處／資訊管理員視角 ——
   * 哪一班派了幾項、哪一項全班沒人交、派錯的當場收回。
   *
   * 完成率在這裡是「這一班交了幾個 / 全班幾個」，點一項才去查未交名單：
   * 一頁幾十項功課都帶全班姓名，手機端會卡在 setData。
   */
  async loadHomework() {
    const L = this.data.L;
    try {
      const res = await admin.homeworkAll({ className: this.data.hwClass, scope: this.data.hwScope });
      const counts = res.counts || { classes: 0, items: 0, overdue: 0 };
      const classes = (res.classes || []).map((c) =>
        Object.assign({}, c, {
          metaText:
            c.items +
            ' ' +
            L.k369 +
            ' · ' +
            c.students +
            ' ' +
            L.k373 +
            ' · ' +
            (c.rate === null ? L.k366 : L.k367 + ' ' + c.rate + '%'),
        }),
      );
      const items = (res.items || []).map((i) =>
        Object.assign({}, i, {
          dueText: dateTimeText(i.dueAt),
          progressText: i.total > 0 ? i.done + '/' + i.total + ' · ' + (i.rate === null ? L.k366 : i.rate + '%') : L.k366,
        }),
      );
      // 趨勢：rate 換成柱高（0–120rpx）。沒有資料的那天給 4rpx 的底線，不要留一個洞
      const trend = res.trend || { days: 7, items: [], average: null, local: { from: '', to: '' } };
      const trendBars = (trend.items || []).map((d) =>
        Object.assign({}, d, {
          barH: d.rate === null ? 4 : Math.max(8, Math.round((d.rate / 100) * 120)),
          rateText: d.rate === null ? '' : d.rate + '%',
          itemsText: d.items > 0 ? d.items + ' ' + L.k369 : '',
        }),
      );
      this.setData({
        hwClasses: classes,
        hwItems: items,
        hwClassNames: res.classNames || [],
        hwCounts: counts,
        hwTrend: trendBars,
        hwTrendAvg: trend.average === null || trend.average === undefined ? null : trend.average,
        hwTrendText:
          trend.average === null || trend.average === undefined
            ? L.k396
            : L.k397 + ' ' + trend.average + '%',
        hwTrendFrom: trend.local && trend.local.from && trend.local.to ? trend.local.from + ' – ' + trend.local.to : '',
        hwSummary: counts.items
          ? counts.classes + ' ' + L.k368 + ' · ' + counts.items + ' ' + L.k369 + ' · ' + counts.overdue + ' ' + L.k376
          : '',
        hwOpenId: '',
        hwPending: [],
        hwPendingCount: 0,
        hwPendingTotal: 0,
        hwPendingNames: '',
        hwPendingHint: '',
      });
    } catch (e) {
      this.setData({ hint: L.k362 + (e.message || e.code) });
    }
  },

  switchHwScope(e) {
    this.setData({ hwScope: e.currentTarget.dataset.key }, () => this.loadHomework());
  },

  switchHwClass(e) {
    this.setData({ hwClass: e.currentTarget.dataset.key || '' }, () => this.loadHomework());
  },

  /** 點一項功課：展開「誰還沒交」，再點一次收起（不另開頁，免得老師看完名單還要按返回） */
  hwToggle(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    if (this.data.hwOpenId === id) {
      this.setData({ hwOpenId: '', hwPending: [], hwPendingCount: 0, hwPendingTotal: 0, hwPendingNames: '', hwPendingHint: '' });
      return;
    }
    this.setData({ hwOpenId: id, hwPendingCount: 0, hwPendingTotal: 0, hwPendingNames: '', hwPendingHint: this.data.L.k370 });
    admin
      .homeworkPending(id)
      .then((res) => {
        // 使用者可能在等待時點了別項，回來就不要蓋掉新的那一項
        if (this.data.hwOpenId !== id) return;
        const pending = res.pending || [];
        this.setData({
          hwPendingCount: pending.length,
          hwPendingTotal: res.total || 0,
          hwPendingNames: pending
            .slice(0, 40)
            .map((p) => p.nickname)
            .join('、'),
          hwPendingHint: '',
        });
      })
      .catch((err) => {
        if (this.data.hwOpenId !== id) return;
        this.setData({ hwPendingHint: (err.message || err.code || '') + '' });
      });
  },

  hwDelete(e) {
    const id = e.currentTarget.dataset.id;
    const title = e.currentTarget.dataset.title || '';
    wx.showModal({
      title: this.data.L.k359,
      content: title + (title ? '　' : '') + this.data.L.k360,
      confirmText: this.data.L.k358,
      cancelText: i18n.pick('取消'),
      success: (r) => {
        if (!r.confirm) return;
        admin
          .deleteHomework(id)
          .then(() => {
            wx.showToast({ title: this.data.L.k361, icon: 'success' });
            this.loadHomework();
          })
          .catch((err) => wx.showToast({ title: err.message || i18n.pick('操作失敗'), icon: 'none' }));
      },
    });
  },

  // ── W-81 示範資料（最高權限）：按一下寫進資料庫、再按一下只清掉這一批 ──
  /**
   * 按鈕旁的摘要：場地／館藏／課表各有幾筆示範資料。
   * 數字一定要來自後端（`GET /admin/demo-data`），不要在前端用「我剛按了幾次」推 ——
   * 換一台手機登入就會對不上。
   */
  async loadDemo() {
    try {
      const res = await admin.demoSummary();
      const counts = res.counts || {};
      this.setData({
        demoCounts: {
          venues: counts.venues || 0,
          books: counts.books || 0,
          timetableSlots: counts.timetableSlots || 0,
        },
        demoClasses: res.classes || [],
        // WXML 不能呼叫方法（demoClasses.join），班級文字在這裡算好
        demoClassText: (res.classes || []).join('、'),
        demoHint: '',
      });
    } catch (err) {
      this.setData({ hint: i18n.pick('讀不到示範資料數量：') + (err.message || err.code) });
    }
  },

  onDemoClass(e) {
    this.setData({ demoClass: e.detail.value });
  },

  demoSeed() {
    if (this.data.demoBusy) return;
    this.runDemo('SEED');
  },

  demoClear() {
    if (this.data.demoBusy) return;
    // 確認一律用原生 wx.showModal（自製兩段式在 Skyline 下第二次點擊會落空）
    wx.showModal({
      title: this.data.L.k388,
      content: this.data.L.k389,
      confirmText: this.data.L.k388,
      cancelText: i18n.pick('取消'),
      success: (r) => {
        if (!r.confirm) return;
        this.runDemo('CLEAR');
      },
    });
  },

  async runDemo(action) {
    this.setData({ demoBusy: true, demoHint: '' });
    try {
      const res = await admin.demoData('all', action, this.data.demoClass || '');
      const n = action === 'SEED' ? res.seeded || {} : res.cleared || {};
      const parts = [
        this.data.L.k383 + ' ' + (n.venues || 0),
        this.data.L.k384 + ' ' + (n.books || 0),
        this.data.L.k385 + ' ' + (n.timetableSlots || 0) + ' ' + this.data.L.k392,
      ];
      const skipped = res.skipped || {};
      const skippedTotal = (skipped.venues || 0) + (skipped.books || 0) + (skipped.timetableSlots || 0);
      const head = action === 'SEED' ? this.data.L.k390 : this.data.L.k391;
      this.setData({
        demoBusy: false,
        demoHint: head + '：' + parts.join(' · ') + (skippedTotal ? '（' + skippedTotal + this.data.L.k395 + this.data.L.k394 + '）' : ''),
      });
      wx.showToast({ title: head, icon: 'success' });
      this.loadDemo();
    } catch (err) {
      this.setData({ demoBusy: false });
      wx.showToast({ title: err.message || i18n.pick('操作失敗'), icon: 'none' });
    }
  },
});