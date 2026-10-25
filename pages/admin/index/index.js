const i18n = require('../../../utils/i18n');
const admin = require('../../../services/admin');
const request = require('../../../utils/request');
const config = require('../../../config/config');
const { dateKey, fromNow, dateTimeText } = require('../../../utils/date');
const role = require('../../../utils/role');
const theme = require('../../../utils/theme');

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
];

// 學段三個固定值（後端 TERMS）：key 必須送原文，簡體下字形相同所以直接用 pick 的結果當 key
const TERM_KEYS = [i18n.pick('第一段'), i18n.pick('第二段'), i18n.pick('第三段')];

const ROLE_TABS = {
  // 校內職員：排菜單＋匯出報名名單＋補登成績。沒有 event:create（不能開活動）、沒有 notice:create（不能發公告）
  STAFF: ['notice', 'claims', 'school', 'menu', 'export'],
  TEACHER: ['notice', 'school', 'events'],
  ADMIN: ['stats', 'claims', 'items', 'trash', 'events', 'notice', 'school', 'users', 'parents', 'reports', 'errors', 'push', 'export', 'menu'],
  SUPER_ADMIN: ['stats', 'claims', 'items', 'trash', 'events', 'notice', 'school', 'users', 'parents', 'reports', 'errors', 'push', 'audit', 'export', 'menu'],
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
    };
  },

  data: {
    themeClass: appearance.themeClass(),
    theme,
    tabs: TABS,
    tab: 'stats',
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
    eventForm: { title: '', date: '', capacity: '20', location: '', groups: '' },
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
      await admin.createEvent({
        title: f.title.trim(),
        location: f.location.trim() || undefined,
        startAt: new Date(f.date + 'T09:00:00').toISOString(),
        capacity: Number(f.capacity) || 0,
        status: 'PUBLISHED',
        groups: groups.length ? groups : undefined,
        teamsEnabled: this.data.teamsEnabled || undefined,
      });
      this.setData({ 'eventForm.title': '', 'eventForm.location': '', 'eventForm.groups': '', hint: i18n.pick('活動已建立') });
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
});