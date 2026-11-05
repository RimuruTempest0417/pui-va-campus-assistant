// 示範模式：資料存在本機 storage，不需要後端、不需要網路。
// 交付給老師時就是靠這一層，四個模組仍能完整操作。
const config = require('../config/config');

const KEY = config.STORAGE_KEYS.demo;

const SEED_VERSION = 13;

const weekUtil = require('../utils/week');
const venue = require('../utils/venue');

const DISH_LIBRARY = [
  { id: 'd1', name: '葡式焗雞飯', price: null, tags: ['招牌'], desc: '薯仔鋪底，雞肉焗到金黃。', base: { sum: 148, count: 32, likes: 18 } },
  { id: 'd2', name: '豉汁排骨飯', price: null, tags: ['經典'], desc: '排骨先炸後蒸，豉汁偏鹹香。', base: { sum: 105, count: 25, likes: 11 } },
  { id: 'd3', name: '咖喱牛腩飯', price: null, tags: ['辣', '人氣'], desc: '咖喱不辣到嗆，牛腩燉得軟。', base: { sum: 197, count: 41, likes: 30 } },
  { id: 'd4', name: '番茄蛋炒飯', price: null, tags: ['素'], desc: '偏清淡，適合不想吃太油的日子。', base: { sum: 47, count: 12, likes: 5 } },
  { id: 'd5', name: '海南雞飯', price: null, tags: ['人氣'], desc: '附薑蓉與辣椒醬。', base: { sum: 94, count: 20, likes: 15 } },
  { id: 'd6', name: '菠蘿包', price: 8, tags: ['小賣部'], desc: '出爐時間 10:30 與 15:00。', base: { sum: 62, count: 14, likes: 9 } },
  { id: 'd7', name: '魚蛋（串）', price: 10, tags: ['小賣部'], desc: '咖喱汁另加。', base: { sum: 55, count: 12, likes: 7 } },
  { id: 'd8', name: '奶茶', price: 12, tags: ['小賣部'], desc: '凍飲 +2。', base: { sum: 88, count: 19, likes: 14 } },
  { id: 'd9', name: '蛋撻', price: 9, tags: ['小賣部'], desc: '每日限量 60 個。', base: { sum: 70, count: 15, likes: 11 } },
];

/** 依週次生成菜單：每天 1–2 道午餐 + 1 道小賣部 */
function buildMenus() {
  const out = [];
  for (let offset = -1; offset <= 1; offset += 1) {
    const dates = weekUtil.weekDates(offset);
    dates.forEach((date, i) => {
      const lunchA = DISH_LIBRARY[(i + offset + 9) % 5];
      const lunchB = DISH_LIBRARY[(i + offset + 10) % 5];
      const snack = DISH_LIBRARY[5 + ((i + offset + 9) % 4)];
      out.push({
        date: date,
        weekOffset: offset,
        lunch: [lunchA.id, lunchB.id].filter((v, idx, arr) => arr.indexOf(v) === idx).map((id) => dishById(id)),
        snack: [dishById(snack.id)],
      });
    });
  }
  return out;
}

function dishById(id) {
  const d = DISH_LIBRARY.filter((x) => x.id === id)[0];
  return { id: d.id, name: d.name, price: d.price, tags: d.tags, description: d.desc };
}

function seedScores() {
  const out = {};
  DISH_LIBRARY.forEach((d) => {
    out[d.id] = Object.assign({}, d.base);
  });
  return out;
}

function seed() {
  const now = Date.now();
  const h = 3600 * 1000;
  return {
    seedVersion: SEED_VERSION,
    dishScores: seedScores(),
    myRatings: {},
    user: { id: 'demo-user', nickname: '示範學生', role: 'STUDENT', grade: '高二', className: '仁' },
    categories: [
      { key: 'card', name: '卡證', icon: '🪪' },
      { key: 'phone', name: '電子產品', icon: '📱' },
      { key: 'book', name: '書本／文具', icon: '📚' },
      { key: 'clothes', name: '衣物', icon: '🧥' },
      { key: 'daily', name: '日用品', icon: '🧴' },
      { key: 'other', name: '其他', icon: '📦' },
    ],
    items: [
      { id: 'i1', type: 'LOST', title: '藍色水壺', place: '圖書館三樓', status: 'OPEN', categoryKey: 'daily', categoryName: '日用品', happenedAt: now - 2 * h, description: '瓶身有貼紙，瓶蓋是白色的。', images: [], author: { nickname: '陳同學' }, contactType: 'inApp', viewCount: 12 },
      { id: 'i2', type: 'FOUND', title: '學生證（已遮姓名）', place: '二號操場', status: 'OPEN', categoryKey: 'card', categoryName: '卡證', happenedAt: now - 5 * h, description: '在跑道邊撿到，已交到教務處。', images: [], author: { nickname: '李同學' }, contactType: 'inApp', viewCount: 31 },
      { id: 'i3', type: 'LOST', title: '黑色耳機盒', place: '禮堂', status: 'CLAIMED', categoryKey: 'phone', categoryName: '電子產品', happenedAt: now - 26 * h, description: 'AirPods 盒子，上面有卡通貼紙。', images: [], author: { nickname: '黃同學' }, contactType: 'inApp', viewCount: 44 },
      { id: 'i4', type: 'FOUND', title: '數學課本（初二）', place: '二樓走廊', status: 'CLOSED', categoryKey: 'book', categoryName: '書本／文具', happenedAt: now - 50 * h, description: '封面有名字，已歸還。', images: [], author: { nickname: '周同學' }, contactType: 'inApp', viewCount: 9 },
      { id: 'i5', type: 'FOUND', title: '灰色外套', place: '體育館', status: 'OPEN', categoryKey: 'clothes', categoryName: '衣物', happenedAt: now - 8 * h, description: '尺寸 M，左袖有校徽。', images: [], author: { nickname: '吳同學' }, contactType: 'inApp', viewCount: 17 },
      { id: 'i7', type: 'FOUND', title: '藍色保溫瓶', place: '圖書館三樓', status: 'OPEN', categoryKey: 'daily', categoryName: '日用品', happenedAt: now - 3 * h, description: '瓶身有貼紙，瓶蓋是白色的。', images: [], author: { nickname: '何同學' }, contactType: 'inApp', viewCount: 6 },
      { id: 'i6', type: 'LOST', title: '計算機（Casio fx-991）', place: '三樓自習室', status: 'OPEN', categoryKey: 'phone', categoryName: '電子產品', happenedAt: now - 12 * h, description: '背面貼了姓名貼。', images: [], author: { nickname: '鄭同學' }, contactType: 'inApp', viewCount: 22 },
    ],
    // 示範層的認領申請：三種狀態各一筆，讓「我申請的」一打開就看得懂差別
    claims: [
      { id: 'c1', itemId: 'i2', status: 'PENDING', createdAt: now - 6 * h, handledAt: null, message: '卡套背面有我的學號' },
      { id: 'c2', itemId: 'i3', status: 'APPROVED', createdAt: now - 30 * h, handledAt: now - 24 * h, message: '耳機盒側邊有卡通貼紙' },
      { id: 'c3', itemId: 'i4', status: 'REJECTED', createdAt: now - 60 * h, handledAt: now - 55 * h, message: '不確定是不是我的' },
    ],
    events: [
      { id: 'e1', title: '校運會報名', club: '體育組', location: '二號操場', startAt: now + 24 * h, endAt: now + 27 * h,
        capacity: 40, signedCount: 37, status: 'PUBLISHED',
        description: '個人項目與接力，報名後請於賽前到體育組領取號碼布。' },
      { id: 'e2', title: '科學社 · 水質檢測工作坊', club: '科學社', location: '實驗室 B', startAt: now + 48 * h, endAt: now + 51 * h,
        capacity: 20, signedCount: 20, status: 'PUBLISHED',
        description: '帶一支學校附近收集的水樣，現場測 pH 與濁度。' },
      { id: 'e3', title: '英文歌唱比賽', club: '英文科', location: '禮堂', startAt: now + 72 * h, endAt: now + 75 * h,
        capacity: 0, signedCount: 12, status: 'PUBLISHED',
        description: '不限名額，歡迎個人或組隊參加。' },
      { id: 'e4', title: '班際籃球賽（示範只有 1 個名額）', club: '體育組', location: '體育館', startAt: now + 96 * h, endAt: now + 98 * h,
        capacity: 1, signedCount: 0, status: 'PUBLISHED',
        description: '用來驗證「第二個人報名會自動進候補」。' },
      { id: 'e5', title: '畢業旅行說明會', club: '訓導處', location: '禮堂', startAt: now + 240 * h, endAt: now + 242 * h,
        capacity: 200, signedCount: 85, status: 'PUBLISHED',
        description: '家長與同學都可參加，會後可現場提問。' },
      { id: 'e6', title: '上學期成果回顧展', club: '視藝科', location: '一樓展覽廳', startAt: now - 72 * h, endAt: now - 60 * h,
        capacity: 0, signedCount: 64, status: 'FINISHED',
        description: '已結束。' },
      {
        id: 'e7',
        title: '班際籃球賽（分甲乙組）',
        club: '體育組',
        location: '一號球場',
        startAt: now + 120 * h,
        endAt: now + 123 * h,
        capacity: 24,
        signedCount: 0,
        status: 'PUBLISHED',
        groups: ['甲組', '乙組'],
        teamsEnabled: true,
        description: '按班別分甲乙兩組，報名時請選組別；也可以組隊報名。',
      },
      // W-64 報名截止：示範資料留一筆「已截止」的活動，一打開就看得到差別
      {
        id: 'e8',
        title: '家長日（報名已截止）',
        club: '訓導處',
        location: '禮堂',
        startAt: now + 168 * h,
        endAt: now + 170 * h,
        capacity: 120,
        signedCount: 96,
        status: 'PUBLISHED',
        signupEndAt: now - 12 * h,
        description: '用來驗證「報名截止時間過了就不能再報名」。',
      },
    ],
    signups: [], // { id, eventId, userId, status: CONFIRMED|WAITLIST, waitlistPos, createdAt, checkedInAt }
    // W-38 活動附件（示範）：一份連結型、一份檔案型，讓兩種下載行為都看得到
    attachments: [
      { id: 'a1', eventId: 'e1', name: '校運會報名表（PDF）', url: 'https://www.puiva.edu.mo/', size: null, type: 'link', createdAt: now - 20 * h },
      { id: 'a2', eventId: 'e1', name: '二號操場位置圖', url: 'https://www.puiva.edu.mo/', size: 512000, type: 'pdf', createdAt: now - 18 * h },
    ],
    // 示範用的「老師已開簽到」狀態：e1 的碼固定在 246810，方便自檢腳本與手動演示
    checkin: { eventId: 'e1', code: '246810', active: true },
    // 家長示範資料：後端是 parent_links，這裡只放兩筆「已綁定的子女」，
    // 用來驗證「切換兩位子女 → 各自的報名互不干擾」。
    parent: {
      children: [
        { linkId: 'pl1', relation: 'mother', relationLabel: '母親', studentId: 'demo-child-1', nickname: '培華同學甲', grade: '初二', className: '忠' },
        { linkId: 'pl2', relation: 'father', relationLabel: '父親', studentId: 'demo-child-2', nickname: '培華同學乙', grade: '初三', className: '仁' },
      ],
    },
    // 菜單以「本週」為基準生成（offset -1 上週、0 本週、1 下週），永遠有資料可看
    menu: buildMenus(),
    notices: [
      { id: 'n1', title: '颱風期間停課安排', kind: 'URGENT', isPinned: true,
        publishedAt: now - 3 * h, expiresAt: now + 48 * h,
        content: '八號風球生效期間停課。停課期間所有課堂與活動取消。住宿生留在宿舍，由舍監統一照顧。復課安排將於風球除下後兩小時內公布。' },
      { id: 'n2', title: '期中考試時間表', kind: 'CALENDAR', isPinned: true,
        publishedAt: now - 30 * h, expiresAt: null,
        content: '11 月 3 日至 7 日為期中考試週。各科考試時間請見派發的時間表。考試期間圖書館延長開放至 19:00。' },
      { id: 'n3', title: '圖書館新增自習區', kind: 'NORMAL', isPinned: false,
        publishedAt: now - 60 * h, expiresAt: null,
        content: '圖書館三樓新增 40 個自習座位，附電源插座。開放時間與圖書館相同。' },
      { id: 'n4', title: '本週五校服日提醒', kind: 'NORMAL', isPinned: false,
        publishedAt: now - 5 * h, expiresAt: null,
        content: '本週五為校服日，請穿著整齊校服。' },
      { id: 'n5', title: '上學期繳費通知（已過期）', kind: 'NORMAL', isPinned: false,
        publishedAt: now - 30 * 24 * h, expiresAt: now - 10 * 24 * h,
        content: '此公告已於十日前過期，列表不應再顯示。' },
    ],
    noticeReads: [], // 已讀的公告 id
    // ── 圖書館（W-66）：示範層也要借得動，交付現場斷網時這個功能不能是死的 ──
    books: [
      { id: 'b1', isbn: '9789993700011', title: '澳門街巷誌', author: '陳志明', publisher: '澳門文化局', category: '歷史', callNumber: 'R 673.9/7523', totalCopies: 3, availableCopies: 1, loanDays: 14, status: 'ACTIVE', summary: '由半島到路環的街名掌故，附老照片。' },
      { id: 'b2', isbn: '9789993700028', title: '中葡對照詞典', author: '培華語文組', publisher: '校內出版', category: '參考書', callNumber: 'R 801/8442', totalCopies: 5, availableCopies: 5, loanDays: 21, status: 'ACTIVE', summary: '日常會話與公文常用詞，適合葡語組同學。' },
      { id: 'b3', isbn: '9787115428028', title: '演算法圖解', author: 'Aditya Bhargava', publisher: '人民郵電', category: '電腦', callNumber: 'T 312.9/4472', totalCopies: 2, availableCopies: 0, loanDays: 14, status: 'ACTIVE', summary: '用圖講二分搜尋、遞迴與動態規劃。' },
      { id: 'b4', isbn: '9789573334091', title: '解憂雜貨店', author: '東野圭吾', publisher: '皇冠', category: '文學', callNumber: '857.7/5064', totalCopies: 4, availableCopies: 2, loanDays: 14, status: 'ACTIVE', summary: '寫給煩惱的人的五個故事。' },
      { id: 'b5', isbn: '9789863209610', title: '物理之美', author: '徐立之', publisher: '天下文化', category: '科學', callNumber: 'T 330/2803', totalCopies: 2, availableCopies: 2, loanDays: 14, status: 'ACTIVE', summary: '從生活現象講力學與電學。' },
      { id: 'b6', isbn: '9780194420990', title: 'Oxford Advanced Learner\'s Dictionary', author: 'Oxford', publisher: 'OUP', category: '參考書', callNumber: 'R 805.1/2233', totalCopies: 6, availableCopies: 6, loanDays: 21, status: 'ACTIVE', summary: '英文作文常用的搭配詞都查得到。' },
      { id: 'b7', isbn: '9789888526907', title: '澳門土生葡人飲食誌', author: '黎若嵐', publisher: '澳門基金會', category: '歷史', callNumber: 'R 673.9/2742', totalCopies: 1, availableCopies: 0, loanDays: 14, status: 'ACTIVE', summary: '葡國雞、免治與豬扒包的由來。' },
      { id: 'b8', isbn: '9787536692930', title: '三體', author: '劉慈欣', publisher: '重慶出版社', category: '文學', callNumber: '857.7/7238', totalCopies: 3, availableCopies: 3, loanDays: 14, status: 'ACTIVE', summary: '科幻長篇，第一冊。' },
      { id: 'b9', isbn: '9789864796331', title: '氣候緊急時代來了', author: 'David Wallace-Wells', publisher: '天下', category: '科學', callNumber: 'T 328.8/4424', totalCopies: 1, availableCopies: 1, loanDays: 14, status: 'ARCHIVED', summary: '已下架（示範「下架後前台看不到」）。' },
    ],
    // 我的借閱：一本正常、一本已逾期，讓「我的借閱」一打開就看得到兩種狀態
    loans: [
      { id: 'l1', bookId: 'b1', userId: 'demo-user', borrowedAt: now - 3 * 24 * h, dueAt: now + 11 * 24 * h, returnedAt: null, renewals: 0 },
      { id: 'l2', bookId: 'b7', userId: 'demo-user', borrowedAt: now - 20 * 24 * h, dueAt: now - 6 * 24 * h, returnedAt: null, renewals: 1 },
      { id: 'l3', bookId: 'b3', userId: 'demo-other', borrowedAt: now - 5 * 24 * h, dueAt: now + 9 * 24 * h, returnedAt: null, renewals: 0 },
      { id: 'l4', bookId: 'b4', userId: 'demo-other', borrowedAt: now - 40 * 24 * h, dueAt: now - 26 * 24 * h, returnedAt: now - 25 * 24 * h, renewals: 0 },
    ],
    // 候補：b3 有人在排，用來驗「還書 → 最早候補被叫到」的示範
    reservations: [
      { id: 'rv1', bookId: 'b3', userId: 'demo-other', status: 'WAITING', position: 1, createdAt: now - 2 * 24 * h, readyAt: null },
    ],
    // ── 場地／器材（W-67）：示範層也要借得動、批得了，交付現場斷網時不能是死的 ──
    resources: [
      { id: 'r1', kind: 'VENUE', name: '物理實驗室', location: '三樓', description: '48 個座位，有投影機與實驗台。做完實驗請把器材歸位。', openFrom: '08:00', openTo: '18:00', maxHours: 4, needsApproval: true, status: 'ACTIVE', version: 0 },
      { id: 'r2', kind: 'VENUE', name: '籃球場', location: '地下操場', description: '全場；借半場請在用途註明。雨天不開放。', openFrom: '07:30', openTo: '19:00', maxHours: 3, needsApproval: true, status: 'ACTIVE', version: 0 },
      { id: 'r3', kind: 'VENUE', name: '多媒體室', location: '圖書館二樓', description: '24 部電腦，可借來做分組報告。', openFrom: '09:00', openTo: '17:00', maxHours: 2, needsApproval: true, status: 'ACTIVE', version: 0 },
      { id: 'r4', kind: 'EQUIPMENT', name: '投影機', location: '器材室 A', description: '含 HDMI 線與遙控器；用完請歸還器材室。', openFrom: '08:00', openTo: '17:30', maxHours: 8, needsApproval: false, status: 'ACTIVE', version: 0 },
      { id: 'r5', kind: 'EQUIPMENT', name: '流動音響', location: '器材室 B', description: '附無線麥克風兩支，需老師批准。', openFrom: '08:00', openTo: '18:00', maxHours: 6, needsApproval: true, status: 'ACTIVE', version: 0 },
      { id: 'r6', kind: 'EQUIPMENT', name: '舊投影機（已下架）', location: '器材室 A', description: '燈泡壞了，等報廢。', openFrom: '08:00', openTo: '17:00', maxHours: 4, needsApproval: false, status: 'ARCHIVED', version: 0 },
    ],
    resourceBookings: [
      { id: 'rb1', resourceId: 'r1', userId: 'demo-other', startAt: venue.slotIso(venue.dateOptions(3)[1].value, '10:00'), endAt: venue.slotIso(venue.dateOptions(3)[1].value, '12:00'), purpose: '化學科分組實驗', status: 'APPROVED', createdAt: now - 6 * h, rejectReason: null },
      { id: 'rb2', resourceId: 'r1', userId: 'demo-other', startAt: venue.slotIso(venue.dateOptions(3)[1].value, '14:00'), endAt: venue.slotIso(venue.dateOptions(3)[1].value, '16:00'), purpose: '物理科補課', status: 'PENDING', createdAt: now - 2 * h, rejectReason: null },
      { id: 'rb3', resourceId: 'r2', userId: 'demo-user', startAt: venue.slotIso(venue.dateOptions(3)[2].value, '15:00'), endAt: venue.slotIso(venue.dateOptions(3)[2].value, '16:30'), purpose: '班際籃球練習', status: 'PENDING', createdAt: now - 3 * h, rejectReason: null },
    ],
    // ── 二手書／校服轉贈（W-68）──
    // 示範資料刻意安排成：一筆是自己送的（不能申請自己的）、一筆有人向我申請（可練「給誰」）、
    // 一筆我已申請（可練取消）、一筆已贈出（驗「前台看不到、參與者看得到」）。
    giveaways: [
      { id: 'gv1', kind: 'BOOK', title: '高二化學課本（第八版）', body: '書角有一點摺，內頁沒有筆記。', condition: 'GOOD', detail: '高二', pickupPlace: '圖書館門口', ownerId: 'demo-other', ownerNickname: '陳同學', ownerClass: '高二 仁', contactName: '陳同學', contactValue: 'p3201301037', status: 'AVAILABLE', version: 0, createdAt: now - 3 * h, imageUrl: null },
      { id: 'gv2', kind: 'UNIFORM', title: '冬季校服外套', body: '只穿過一個冬天，拉鍊正常。', condition: 'LIKE_NEW', detail: 'M', pickupPlace: '校務處', ownerId: 'demo-user', ownerNickname: '示範學生', ownerClass: '高二 仁', contactName: '示範學生', contactValue: '3201201002', status: 'AVAILABLE', version: 0, createdAt: now - 8 * h, imageUrl: null },
      { id: 'gv3', kind: 'BOOK', title: '初二數學練習冊（未寫過）', body: '買錯版本，完全空白。', condition: 'LIKE_NEW', detail: '初二', pickupPlace: '教務處', ownerId: 'demo-other', ownerNickname: '李同學', ownerClass: '初二 孝', contactName: '李同學', contactValue: 'p3201402008', status: 'AVAILABLE', version: 0, createdAt: now - 26 * h, imageUrl: null },
      { id: 'gv4', kind: 'OTHER', title: '木結他（3/4 尺寸）', body: '琴頸沒有彎，附琴袋。家裡放不下才送出。', condition: 'FAIR', detail: '3/4', pickupPlace: '音樂室', ownerId: 'demo-other', ownerNickname: '黃同學', ownerClass: '高一 忠', contactName: '黃同學', contactValue: 'p3201103021', status: 'AVAILABLE', version: 0, createdAt: now - 50 * h, imageUrl: null },
      { id: 'gv5', kind: 'UNIFORM', title: '體育服（短袖）', body: '已送給學弟。', condition: 'GOOD', detail: 'S', pickupPlace: '操場', ownerId: 'demo-other', ownerNickname: '周同學', ownerClass: '高二 信', contactName: '周同學', contactValue: 'p3201301055', status: 'GIVEN', givenToId: 'demo-user', givenAt: now - 12 * h, version: 1, createdAt: now - 5 * 24 * h, imageUrl: null },
    ],
    giveawayRequests: [
      { id: 'gr1', itemId: 'gv2', userId: 'demo-other', message: '我今年要換 M 碼，可以留給我嗎？', status: 'PENDING', createdAt: now - 4 * h, decidedAt: null },
      { id: 'gr2', itemId: 'gv3', userId: 'demo-user', message: '我弟弟明年用得到，謝謝。', status: 'PENDING', createdAt: now - 20 * h, decidedAt: null },
      { id: 'gr3', itemId: 'gv5', userId: 'demo-user', message: '想要體育服', status: 'ACCEPTED', createdAt: now - 14 * h, decidedAt: now - 12 * h },
    ],
    // ── 請假申請（W-72）──
    // 一筆待審批（可練取消）、一筆已批准（看得到日期與天數）、一筆已駁回（看得到原因）
    leaves: [
      { id: 'lv1', studentId: 'demo-user', createdById: 'demo-user', kind: 'SICK', from: leaveDate(2), to: leaveDate(2), reason: '發燒，醫生建議在家休息一天。', status: 'PENDING', rejectReason: null, reviewedAt: null, createdAt: now - 3 * h },
      { id: 'lv2', studentId: 'demo-user', createdById: 'demo-user', kind: 'PERSONAL', from: leaveDate(-14), to: leaveDate(-13), reason: '家中事務，已先向班主任口頭報告。', status: 'APPROVED', rejectReason: null, reviewedAt: now - 300 * h, createdAt: now - 320 * h },
      { id: 'lv3', studentId: 'demo-user', createdById: 'demo-user', kind: 'OFFICIAL', from: leaveDate(-30), to: leaveDate(-30), reason: '代表學校參加校際辯論比賽。', status: 'REJECTED', rejectReason: '請附帶比賽通知截圖', reviewedAt: now - 700 * h, createdAt: now - 720 * h },
    ],
  };
}

function db() {
  let data = wx.getStorageSync(KEY);
  // 版本不符就重生：改過 seed 之後，舊裝置上才不會一直看到舊的示範資料
  if (!data || !data.items || data.seedVersion !== SEED_VERSION) {
    data = seed();
    wx.setStorageSync(KEY, data);
  }
  return data;
}
function save(data) {
  wx.setStorageSync(KEY, data);
  return data;
}

let idSeq = 0;

/** 示範層的 id 產生器：同一個毫秒內連續建立兩筆時，只用 Date.now() 會撞號
 *  （症狀：批了第一筆之後，第二筆顯示「已經處理過了」） */
function nextId(prefix) {
  idSeq += 1;
  return prefix + Date.now() + '-' + idSeq;
}

/** 雙字母組相似度（0–1），與後端 pg_trgm 的概念一致但更輕量 */
function dice(a, b) {
  const s1 = String(a || '').toLowerCase().replace(/\s+/g, '');
  const s2 = String(b || '').toLowerCase().replace(/\s+/g, '');
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;
  const grams = (str) => {
    const out = [];
    for (let i = 0; i < str.length - 1; i += 1) out.push(str.slice(i, i + 2));
    return out;
  };
  const g1 = grams(s1);
  const g2 = grams(s2);
  if (!g1.length || !g2.length) return s1 === s2 ? 1 : 0;
  const pool = new Map();
  g2.forEach((g) => pool.set(g, (pool.get(g) || 0) + 1));
  let hit = 0;
  g1.forEach((g) => {
    const n = pool.get(g) || 0;
    if (n > 0) {
      hit += 1;
      pool.set(g, n - 1);
    }
  });
  return (2 * hit) / (g1.length + g2.length);
}

function decorateDish(data, dish) {
  const agg = (data.dishScores || {})[dish.id] || { sum: 0, count: 0, likes: 0 };
  const mine = (data.myRatings || {})[dish.id] || null;
  return Object.assign({}, dish, {
    avgScore: agg.count ? Math.round((agg.sum / agg.count) * 10) / 10 : 0,
    ratingCount: agg.count,
    likedCount: agg.likes,
    myScore: mine ? mine.score : 0,
    myLiked: mine ? !!mine.liked : false,
  });
}

function mineFor(data, eventId) {
  return data.signups.filter((x) => x.eventId === eventId && x.userId === data.user.id)[0] || null;
}

function waitlistCount(data, eventId) {
  return data.signups.filter((x) => x.eventId === eventId && x.status === 'WAITLIST').length;
}

/** 這位 studentId 是不是示範家長的子女（後端對應 parent_links 的一次查詢） */
function childOf(data, studentId) {
  const list = (data.parent && data.parent.children) || [];
  return list.filter((x) => x.studentId === studentId)[0] || null;
}

/** W-38 附件：只回這個活動的，並複製一份（呼叫端改到也不會污染示範資料） */
function attachmentsOf(data, eventId) {
  return (data.attachments || []).filter((a) => a.eventId === eventId).map((a) => Object.assign({}, a));
}

/** 誰看得到「新增／刪除附件」：與後端同一條規則（能開活動的才有），示範身分是學生就不給 */
function canManageAttachmentsFor(data) {
  const role = (data.user && data.user.role) || 'STUDENT';
  return ['TEACHER', 'ADMIN', 'SUPER_ADMIN'].indexOf(role) >= 0;
}

/**
 * 報名核心：userId 為 null 代表「自己」，否則代表「代這位子女」。
 * 自己報名與家長代報名共用同一份名額判斷，示範層才不會出現兩套結果。
 */
function signupCore(id, userId, groupKey) {
  const data = db();
  const who = userId || data.user.id;
  const e = data.events.filter((x) => x.id === id)[0];
  if (!e) return Promise.reject({ code: 'NOT_FOUND' });
  if (e.status !== 'PUBLISHED') return Promise.reject({ code: 'VALIDATION_FAILED', message: '這個活動目前沒有開放報名' });
  // W-64：報名截止後連候補都不收（與後端 lib/signup.ts 同一條規則）
  if (e.signupEndAt && Number(e.signupEndAt) < Date.now()) {
    return Promise.reject({ code: 'SIGNUP_CLOSED', message: '這個活動的報名已截止' });
  }

  // 分組：有設組別就一定要選，且必須在名單內（與後端同一規則）
  const groups = e.groups || [];
  let picked = null;
  if (groups.length) {
    if (!groupKey) return Promise.reject({ code: 'VALIDATION_FAILED', message: '這個活動需要先選組別' });
    if (groups.indexOf(groupKey) === -1) return Promise.reject({ code: 'VALIDATION_FAILED', message: '組別不存在' });
    picked = groupKey;
  }

  const me = data.signups.filter((x) => x.eventId === id && x.userId === who && x.status !== 'CANCELLED')[0];
  if (me) return Promise.reject({ code: 'ALREADY_SIGNED_UP' });

  const full = e.capacity > 0 && e.signedCount >= e.capacity;
  const rec = {
    id: 's' + Date.now() + Math.random().toString(16).slice(2, 6),
    eventId: id,
    userId: who,
    status: full ? 'WAITLIST' : 'CONFIRMED',
    waitlistPos: full ? waitlistCount(data, id) + 1 : null,
    groupKey: picked,
    createdAt: Date.now(),
  };
  if (!full) e.signedCount += 1;
  data.signups.push(rec);
  save(data);

  // 滿額不是「錯誤」而是「進候補」—— 用結果表達，不讓呼叫端把它當失敗吞掉
  return Promise.resolve(Object.assign({}, rec));
}

/** 取消核心：一樣用 userId 區分自己／代子女；有人補位時總數不變 */
function cancelCore(id, userId) {
  const data = db();
  const who = userId || data.user.id;
  const rec = data.signups.filter((x) => x.eventId === id && x.userId === who && x.status !== 'CANCELLED')[0];
  if (!rec) return Promise.reject({ code: 'VALIDATION_FAILED', message: '你沒有報名這個活動' });

  const wasConfirmed = rec.status === 'CONFIRMED';
  const e = data.events.filter((x) => x.id === id)[0];
  rec.status = 'CANCELLED';
  rec.waitlistPos = null;

  let promoted = null;
  if (wasConfirmed && e) {
    e.signedCount = Math.max(0, e.signedCount - 1);
    // 有人取消 → 最早排隊的人補位（補位後總數不變）
    const waiting = data.signups
      .filter((x) => x.eventId === id && x.status === 'WAITLIST')
      .sort((a, b) => a.createdAt - b.createdAt);
    if (waiting.length) {
      promoted = waiting[0];
      promoted.status = 'CONFIRMED';
      promoted.waitlistPos = null;
      e.signedCount += 1;
    }
  }
  // 重排候補序號，不留空號
  data.signups
    .filter((x) => x.eventId === id && x.status === 'WAITLIST')
    .sort((a, b) => a.createdAt - b.createdAt)
    .forEach((x, i) => { x.waitlistPos = i + 1; });
  save(data);
  return Promise.resolve({ cancelled: true, promoted: promoted ? promoted.id : null });
}

let schoolLinked = false;

/** 示範資料用的「N 天後」日期字串（YYYY-MM-DD，本地時區；每次載入都以今天為基準，不會過期） */
function demoDay(offset) {
  const d = new Date();
  d.setDate(d.getDate() + (offset || 0));
  const pad = (n) => (n < 10 ? '0' + n : String(n));
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

/**
 * 家校通示範資料（模組層函式，不是 `this.xxx`）。
 * data.js 是把 mock 的方法拆出來呼叫的（`mock[name](...)`），`this` 會是 null ——
 * 所以「子女的成績」不能寫 `this.schoolGrades()`，只能共用同一支純函式。
 */
function demoSchoolGrades() {
  return {
    years: ['2026/2027', '2025/2026'],
    items: [
      { id: 'g1', yearTerm: '2026/2027', term: '第一段', courseName: '化學', content: '原子結構及元素周期表', testType: '大測一', testDate: '2026-10-09', score: 100.5 },
      { id: 'g2', yearTerm: '2026/2027', term: '第一段', courseName: '數學', content: '函數與圖像', testType: '大測一', testDate: '2026-10-10', score: 86 },
      { id: 'g3', yearTerm: '2026/2027', term: '第一段', courseName: '中文', content: '閱讀理解', testType: '小測', testDate: '2026-10-12', score: 78 },
    ],
  };
}

function demoSchoolAttendance() {
  const items = [
    { id: 'a1', date: '2026-10-23', amIn: '08:16:06', pmOut: '16:32:32', isAmLate: false, isPmLate: false, amStatus: 'normal', pmStatus: 'normal', remark: null },
    { id: 'a2', date: '2026-10-22', amIn: '08:32:10', pmOut: '16:30:02', isAmLate: true, isPmLate: false, amStatus: 'late', pmStatus: 'normal', remark: '交通延誤' },
    { id: 'a3', date: '2026-10-21', amIn: '', pmOut: '', isAmLate: false, isPmLate: false, amStatus: 'leave', pmStatus: 'leave', remark: '病假' },
  ];
  return { items, summary: { total: items.length, late: 1, absent: 1 } };
}

/** 示範層的轉贈物顯示欄位（與後端 shapeItem 同名同義；頁面兩種模式共用一份程式） */
function shapeGiveaway(data, item, extra) {
  const e = extra || {};
  const me = data.user || {};
  const rows = (data.giveawayRequests || []).filter((r) => r.itemId === item.id);
  const mine = rows.filter((r) => r.userId === me.id)[0] || null;
  const isOwner = item.ownerId === me.id;
  const manager = ['STAFF', 'ADMIN', 'SUPER_ADMIN'].indexOf(me.role) !== -1;
  const showContact = !!e.showContact || isOwner || manager || (mine && mine.status === 'ACCEPTED');
  return {
    id: item.id,
    kind: item.kind,
    kindLabel: { BOOK: '書籍', UNIFORM: '校服', OTHER: '其他' }[item.kind] || '其他',
    title: item.title,
    body: item.body || null,
    condition: item.condition || 'GOOD',
    conditionLabel: { LIKE_NEW: '幾乎全新', GOOD: '良好', FAIR: '可用' }[item.condition] || '良好',
    detail: item.detail || null,
    pickupPlace: item.pickupPlace || null,
    imageUrl: item.imageUrl || null,
    status: item.status || 'AVAILABLE',
    statusLabel: { AVAILABLE: '可申請', GIVEN: '已贈出', CLOSED: '已下架' }[item.status] || item.status,
    version: item.version || 0,
    ownerId: item.ownerId,
    ownerNickname: item.ownerNickname || '同學',
    ownerClass: item.ownerClass || null,
    contactName: showContact ? item.contactName || null : null,
    contactValue: showContact ? item.contactValue || null : null,
    requestCount: rows.length,
    pendingCount: rows.filter((r) => r.status === 'PENDING').length,
    myRequest: mine ? { id: mine.id, status: mine.status, createdAt: new Date(mine.createdAt).toISOString() } : null,
    givenAt: item.givenAt ? new Date(item.givenAt).toISOString() : null,
    closedAt: item.closedAt ? new Date(item.closedAt).toISOString() : null,
    createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : null,
  };
}

/** 示範層的請假日期：相對今天 ±N 天，寫成 `YYYY-MM-DD`（與後端 @db.Date 同一個字串形狀） */
function leaveDate(offsetDays) {
  const d = new Date(Date.now() + (offsetDays || 0) * 86400000);
  return d.toISOString().slice(0, 10);
}

const LEAVE_KIND_LABEL = { SICK: '病假', PERSONAL: '事假', OFFICIAL: '公假' };
const LEAVE_STATUS_LABEL = { PENDING: '待審批', APPROVED: '已批准', REJECTED: '已駁回', CANCELLED: '已取消' };

/** 假單的對外形狀與後端 lib/leaves.ts 的 shapeLeave 一致（前端兩條路徑不必分開寫） */
function shapeLeave(row, me) {
  const from = String(row.from || '');
  const to = String(row.to || '');
  const head = from.replace(/-/g, '/');
  const tail = to.replace(/-/g, '/');
  const dateText = head === tail ? head : from.slice(0, 4) === to.slice(0, 4) ? head + '–' + tail.slice(5) : head + '–' + tail;
  const days = Math.round((new Date(to + 'T00:00:00Z').getTime() - new Date(from + 'T00:00:00Z').getTime()) / 86400000) + 1;
  const isMine = me && me.id === row.studentId;
  return {
    id: row.id,
    studentId: row.studentId,
    student: isMine
      ? { id: me.id, nickname: me.nickname || '同學', grade: me.grade || null, className: me.className || null }
      : { id: row.studentId, nickname: row.studentName || '陳同學', grade: '高二', className: '仁' },
    createdById: row.createdById,
    createdBy: { id: row.createdById, nickname: isMine ? (me && me.nickname) || '同學' : '家長', role: null },
    kind: row.kind,
    kindText: LEAVE_KIND_LABEL[row.kind] || row.kind,
    from: from,
    to: to,
    dateText: dateText,
    days: Number.isNaN(days) ? 1 : days,
    reason: row.reason || '',
    attachmentUrl: row.attachmentUrl || null,
    status: row.status,
    statusText: LEAVE_STATUS_LABEL[row.status] || row.status,
    rejectReason: row.rejectReason || null,
    reviewedAt: row.reviewedAt ? new Date(row.reviewedAt).toISOString() : null,
    reviewedBy: row.reviewedBy || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    canCancel: row.status === 'PENDING',
  };
}

module.exports = {
  reset() {
    const fresh = seed();
    return save(fresh);
  },
  // ── 認證 ──
  login() {
    const data = db();
    return Promise.resolve({ token: 'demo-token', user: data.user });
  },
  me() {
    return Promise.resolve(db().user);
  },

  // ── 失物 ──
  listItems(query) {
    const q = query || {};
    let items = db().items.slice();
    if (q.type) items = items.filter((i) => i.type === q.type);
    if (q.status) items = items.filter((i) => i.status === q.status);
    if (q.categoryKey) items = items.filter((i) => i.categoryKey === q.categoryKey);
    if (q.q) {
      const kw = String(q.q);
      items = items.filter((i) => (i.title + i.place + (i.description || '')).indexOf(kw) !== -1);
    }
    items.sort((a, b) => b.happenedAt - a.happenedAt);

    const page = Number(q.page) || 1;
    const pageSize = Number(q.pageSize) || 10;
    const start = (page - 1) * pageSize;
    const slice = items.slice(start, start + pageSize);
    return Promise.resolve({
      items: slice,
      total: items.length,
      page: page,
      pageSize: pageSize,
      hasMore: start + slice.length < items.length,
    });
  },

  getItem(id) {
    const item = db().items.filter((i) => i.id === id)[0];
    if (!item) return Promise.reject({ code: 'NOT_FOUND' });
    item.viewCount = (item.viewCount || 0) + 1;
    save(db());
    return Promise.resolve(item);
  },

  myItems() {
    const data = db();
    const mine = data.items.filter((i) => (i.author && i.author.nickname === data.user.nickname) || i.isMine);
    return Promise.resolve({ items: mine });
  },

  updateItemStatus(id, status) {
    const data = db();
    const item = data.items.filter((i) => i.id === id)[0];
    if (!item) return Promise.reject({ code: 'NOT_FOUND' });
    const allowed = { OPEN: ['CLAIMED', 'CLOSED'], CLAIMED: ['CLOSED'], CLOSED: [] };
    if ((allowed[item.status] || []).indexOf(status) === -1) {
      return Promise.reject({ code: 'VALIDATION_FAILED', message: '狀態不可從 ' + item.status + ' 變成 ' + status });
    }
    item.status = status;
    save(data);
    return Promise.resolve(Object.assign({}, item));
  },

  categories() {
    return Promise.resolve({ items: db().categories });
  },
  createItem(payload) {
    const data = db();
    const item = Object.assign(
      {
        id: 'i' + Date.now(),
        status: 'OPEN',
        happenedAt: Date.now(),
        images: [],
        author: { nickname: data.user.nickname },
      },
      payload
    );
    item.place = payload.place;
    item.isMine = true;
    item.viewCount = 0;
    if (payload.categoryKey) {
      const c = (data.categories || []).filter((x) => x.key === payload.categoryKey)[0];
      item.categoryName = c ? c.name : '';
    }
    data.items.unshift(item);
    save(data);
    return Promise.resolve(item);
  },
  claimItem(id) {
    const data = db();
    const item = data.items.filter((i) => i.id === id)[0];
    if (!item) return Promise.reject({ code: 'NOT_FOUND' });
    // 與後端同一套規則：不能認領自己的、同一件只能申請一次、已結束的不能申請
    if ((item.author && item.author.nickname === data.user.nickname) || item.isMine) {
      return Promise.reject({ code: 'VALIDATION_FAILED', message: '不能認領自己發布的物品' });
    }
    const existed = (data.claims || []).filter((c) => c.itemId === id)[0];
    if (existed) return Promise.reject({ code: 'ALREADY_CLAIMED', message: '你已經申請過，請等待對方回應' });
    if (item.status === 'CLOSED') return Promise.reject({ code: 'VALIDATION_FAILED', message: '這件物品已結束' });
    if (item.status === 'CLAIMED') return Promise.reject({ code: 'ALREADY_CLAIMED', message: '這件物品已被認領' });

    const claim = { id: 'c-' + id + '-' + Date.now(), itemId: id, status: 'PENDING', createdAt: Date.now(), handledAt: null, message: '' };
    data.claims = (data.claims || []).concat([claim]);
    if (item.status === 'OPEN') item.status = 'MATCHED';
    save(data);
    return Promise.resolve(Object.assign({}, claim));
  },

  myClaims() {
    const data = db();
    const rows = (data.claims || [])
      .map((c) => {
        const item = data.items.filter((i) => i.id === c.itemId)[0];
        if (!item) return null; // 物品被刪掉就不再顯示（與後端一致）
        return Object.assign({}, c, {
          item: {
            id: item.id,
            title: item.title,
            type: item.type,
            status: item.status,
            place: item.place,
            happenedAt: item.happenedAt,
            categoryName: item.categoryName || null,
          },
        });
      })
      .filter((x) => x)
      .sort((a, b) => b.createdAt - a.createdAt);
    return Promise.resolve({ items: rows });
  },

  // ── 活動 ──
  listEvents(query) {
    const q = query || {};
    const data = db();
    const now = Date.now();
    let items = data.events.slice();

    if (q.scope === 'upcoming') items = items.filter((e) => e.status === 'PUBLISHED' && e.startAt >= now);
    if (q.scope === 'past') items = items.filter((e) => e.status === 'FINISHED' || e.startAt < now);

    items.sort((a, b) => a.startAt - b.startAt);
    return Promise.resolve({
      items: items.map((e) => Object.assign({}, e, { mySignup: mineFor(data, e.id) })),
    });
  },

  getEvent(id) {
    const data = db();
    const e = data.events.filter((x) => x.id === id)[0];
    if (!e) return Promise.reject({ code: 'NOT_FOUND' });
    return Promise.resolve(
      Object.assign({}, e, {
        mySignup: mineFor(data, id),
        attachments: attachmentsOf(data, id),
        canManageAttachments: canManageAttachmentsFor(data),
      }),
    );
  },

  /** W-38 新增附件（示範模式：寫進 storage，重開詳情頁還在） */
  addEventAttachment(eventId, payload) {
    const data = db();
    const p = payload || {};
    const name = String(p.name || '').trim();
    const url = String(p.url || '').trim();
    if (!name) return Promise.reject({ code: 'VALIDATION_FAILED', message: '請填寫附件名稱' });
    if (!/^https?:\/\/\S+$/i.test(url)) return Promise.reject({ code: 'VALIDATION_FAILED', message: '只接受 http(s) 連結' });
    const mine = (data.attachments || []).filter((a) => a.eventId === eventId);
    if (mine.length >= 10) return Promise.reject({ code: 'VALIDATION_FAILED', message: '一個活動最多 10 份附件，先刪掉舊的再加' });
    data.attachments = data.attachments || [];
    const row = {
      id: 'a' + (data.attachments.length + 1) + '-' + Date.now(),
      eventId,
      name,
      url,
      size: typeof p.size === 'number' ? p.size : null,
      type: p.type || 'link',
      createdAt: Date.now(),
    };
    data.attachments.push(row);
    save(data);
    return Promise.resolve(Object.assign({}, row));
  },

  deleteEventAttachment(eventId, attachmentId) {
    const data = db();
    const before = (data.attachments || []).length;
    data.attachments = (data.attachments || []).filter((a) => !(a.id === attachmentId && a.eventId === eventId));
    if (data.attachments.length === before) return Promise.reject({ code: 'NOT_FOUND' });
    save(data);
    return Promise.resolve({ ok: true });
  },

  /** 示範模式沒有物件存儲：照實拒絕，不要回一個假簽名 */
  signUpload() {
    return Promise.reject({ code: 'UPLOAD_NOT_CONFIGURED', message: '示範模式不支援檔案上傳，請改用「貼上連結」' });
  },

  signupEvent(id, groupKey) {
    return signupCore(id, null, groupKey || null);
  },

  cancelSignup(id) {
    return cancelCore(id, null);
  },

  // ── 家長（示範層）──
  // 與後端同一原則：先確認「這是我的孩子」，再走同一支報名核心（名額只算一次）。
  parentChildren() {
    const data = db();
    return Promise.resolve({ items: (data.parent && data.parent.children) || [] });
  },

  parentChild(studentId) {
    const data = db();
    const c = childOf(data, studentId);
    if (!c) return Promise.reject({ code: 'FORBIDDEN', message: '沒有綁定這位學生' });

    const signups = data.signups
      .filter((x) => x.userId === studentId && x.status !== 'CANCELLED')
      .map((rec) => {
        const e = data.events.filter((x) => x.id === rec.eventId)[0] || {};
        return {
          id: rec.id,
          status: rec.status,
          waitlistPos: rec.waitlistPos,
          event: { id: rec.eventId, title: e.title, startAt: e.startAt, location: e.location },
        };
      });

    return Promise.resolve({
      student: { id: studentId, nickname: c.nickname, grade: c.grade, className: c.className },
      relation: c.relation,
      relationLabel: c.relationLabel,
      signups: signups,
      claimCount: data.items.filter((i) => i.isMine).length,
      unreadNotices: Math.max(0, data.notices.length - (data.noticeReads || []).length),
    });
  },

  parentSignupEvent(studentId, eventId) {
    const data = db();
    if (!childOf(data, studentId)) {
      return Promise.reject({ code: 'FORBIDDEN', message: '沒有綁定這位學生' });
    }
    return signupCore(eventId, studentId);
  },

  parentCancelSignup(studentId, eventId) {
    const data = db();
    if (!childOf(data, studentId)) {
      return Promise.reject({ code: 'FORBIDDEN', message: '沒有綁定這位學生' });
    }
    return cancelCore(eventId, studentId);
  },

  /** 子女的成績（示範層）：與後端同形狀；未綁定一樣 403，不讓示範模式比真 API 寬鬆 */
  parentChildGrades(studentId) {
    const data = db();
    if (!childOf(data, studentId)) {
      return Promise.reject({ code: 'FORBIDDEN', message: '沒有綁定這位學生' });
    }
    return Promise.resolve(demoSchoolGrades());
  },

  /** 子女的出缺席（示範層） */
  parentChildAttendance(studentId) {
    const data = db();
    if (!childOf(data, studentId)) {
      return Promise.reject({ code: 'FORBIDDEN', message: '沒有綁定這位學生' });
    }
    return Promise.resolve(demoSchoolAttendance());
  },

  /** 家長同步子女（示範層）：真 API 會打家校通，這裡只回筆數；規則一樣要已綁定 */
  parentChildSync(studentId) {
    const data = db();
    if (!childOf(data, studentId)) {
      return Promise.reject({ code: 'FORBIDDEN', message: '沒有綁定這位學生' });
    }
    const g = demoSchoolGrades();
    const a = demoSchoolAttendance();
    return Promise.resolve({ ok: true, demo: true, grades: g.items.length, attendance: a.items.length, yearTerms: g.years.slice(0, 1) });
  },

  /**
   * 示範層的簽到：與後端同一組規則（碼要有效、只有正取、重複掃不重複計）。
   * 示範模式沒有老師端，所以碼寫在種子資料裡（e1 = 246810）。
   */
  checkin(rawCode) {
    const data = db();
    const code = String(rawCode || '').replace(/\D/g, '');
    const st = data.checkin || {};
    if (!st.active || st.code !== code) {
      return Promise.reject({ code: 'VALIDATION_FAILED', message: '簽到碼無效或已結束，請向老師確認' });
    }
    const rec = data.signups.filter(
      (x) => x.eventId === st.eventId && x.userId === data.user.id && x.status !== 'CANCELLED',
    )[0];
    if (!rec) return Promise.reject({ code: 'VALIDATION_FAILED', message: '你沒有報名這個活動，無法簽到' });
    if (rec.status === 'WAITLIST') {
      return Promise.reject({ code: 'VALIDATION_FAILED', message: '你在候補名單，轉為正取後才能簽到' });
    }
    const e = data.events.filter((x) => x.id === st.eventId)[0] || {};
    if (rec.checkedInAt) {
      return Promise.resolve({ ok: true, already: true, eventId: st.eventId, title: e.title, checkedInAt: rec.checkedInAt });
    }
    rec.checkedInAt = Date.now();
    save(data);
    return Promise.resolve({ ok: true, already: false, eventId: st.eventId, title: e.title, checkedInAt: rec.checkedInAt });
  },

  mySignups() {
    const data = db();
    const mine = data.signups.filter((x) => x.userId === data.user.id);
    const items = mine.map((rec) => {
      const e = data.events.filter((x) => x.id === rec.eventId)[0] || {};
      return {
        id: rec.id,
        eventId: rec.eventId,
        status: rec.status,
        waitlistPos: rec.waitlistPos,
        checkedInAt: rec.checkedInAt || null,
        title: e.title,
        location: e.location,
        startAt: e.startAt,
        capacity: e.capacity,
        signedCount: e.signedCount,
      };
    });
    return Promise.resolve({ items: items });
  },

  // 示範模式專用：切換身分（用來驗證「第二個人報名 → 候補」）
  switchDemoUser(nickname, id, role) {
    const data = db();
    data.user = Object.assign({}, data.user, { nickname: nickname, id: id || 'demo-' + nickname });
    // 第三個參數才改角色：示範模式要能演「老師審批場地」，不傳就維持原角色
    if (role) data.user.role = role;
    save(data);
    return Promise.resolve(data.user);
  },

  // ── 菜單 ──
  weekMenu(query) {
    const q = query || {};
    const offset = Number(q.offset) || 0;
    const data = db();
    const dates = weekUtil.weekDates(offset);
    const days = dates.map((date) => {
      const entry = (data.menu || []).filter((x) => x.date === date)[0];
      const lunch = entry ? entry.lunch.map((d) => decorateDish(data, d)) : [];
      const snack = entry ? entry.snack.map((d) => decorateDish(data, d)) : [];
      return { date: date, lunch: lunch, snack: snack };
    });
    return Promise.resolve({ offset: offset, dates: dates, days: days });
  },

  getDish(id) {
    const data = db();
    const dish = DISH_LIBRARY.filter((x) => x.id === id)[0];
    if (!dish) return Promise.reject({ code: 'NOT_FOUND' });
    return Promise.resolve(decorateDish(data, dishById(id)));
  },

  rateDish(id, payload) {
    const data = db();
    const p = payload || {};
    const score = Number(p.score);
    if (!(score >= 1 && score <= 5)) {
      return Promise.reject({ code: 'VALIDATION_FAILED', message: '評分必須是 1–5 星' });
    }
    data.dishScores = data.dishScores || seedScores();
    data.myRatings = data.myRatings || {};

    const agg = data.dishScores[id] || { sum: 0, count: 0, likes: 0 };
    const prev = data.myRatings[id];

    if (prev) {
      // 一人一評：改分時先把舊分扣掉，不會重複計算
      agg.sum = agg.sum - prev.score + score;
      if (prev.liked && !p.liked) agg.likes = Math.max(0, agg.likes - 1);
      if (!prev.liked && p.liked) agg.likes += 1;
    } else {
      agg.sum += score;
      agg.count += 1;
      if (p.liked) agg.likes += 1;
    }
    data.dishScores[id] = agg;
    data.myRatings[id] = { score: score, liked: !!p.liked };
    save(data);

    return Promise.resolve(decorateDish(db(), dishById(id)));
  },

  topDishes(query) {
    const q = query || {};
    const limit = Number(q.limit) || 5;
    const data = db();
    data.dishScores = data.dishScores || seedScores();
    const rows = DISH_LIBRARY.map((d) => decorateDish(data, dishById(d.id)))
      .filter((d) => d.ratingCount > 0)
      .sort((a, b) => b.avgScore - a.avgScore || b.ratingCount - a.ratingCount)
      .slice(0, limit);
    return Promise.resolve({ items: rows });
  },

  // ── 失物智能匹配（與後端 /items/:id/matches 同一套權重，示範模式才看得出效果）──
  matches(id) {
    const db0 = db();
    const base = (db0.items || []).filter((x) => x.id === id)[0];
    if (!base) return Promise.reject({ code: 'NOT_FOUND' });

    const sim = (a, b) => dice(String(a || ''), String(b || ''));
    const rows = (db0.items || [])
      .filter((x) => x.id !== base.id && x.type !== base.type && x.status !== 'CLOSED')
      .map((x) => {
        const sameCat = !!x.categoryKey && x.categoryKey === base.categoryKey;
        const placeSim = sim(x.place, base.place);
        const textSim = Math.max(sim(x.title, base.title), sim(x.description, base.description));
        const hoursApart = Math.abs(new Date(x.happenedAt) - new Date(base.happenedAt)) / 3600000;
        const score =
          (sameCat ? 0.35 : 0) +
          (placeSim > 0.4 ? 0.25 * placeSim : 0) +
          (hoursApart < 72 ? 0.15 : 0) +
          0.25 * textSim;
        return {
          id: x.id,
          type: x.type,
          title: x.title,
          place: x.place,
          status: x.status,
          happenedAt: x.happenedAt,
          score: Math.round(score * 100) / 100,
          gate: placeSim > 0.4 || textSim > 0.3,
          reasons: [
            sameCat ? '同分類' : null,
            placeSim > 0.4 ? '地點相近' : null,
            hoursApart < 72 ? Math.round(hoursApart) + ' 小時內' : null,
            textSim > 0.3 ? '描述相似' : null,
          ].filter(Boolean),
        };
      })
      .filter((r) => r.gate && r.score >= 0.45)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((r) => {
        delete r.gate;
        return r;
      });

    return Promise.resolve({ items: rows, minScore: 0.45 });
  },

  // ── 訂閱消息（示範模式只記錄，不真的發送）──
  subscribe(templateIds, scene) {
    const data = db();
    data.subscriptions = data.subscriptions || [];
    (templateIds || []).forEach((id) => {
      if (!data.subscriptions.some((x) => x.templateId === id && x.scene === scene)) {
        data.subscriptions.push({ templateId: id, scene: scene, createdAt: Date.now() });
      }
    });
    save(data);
    return Promise.resolve({ ok: true, scene: scene, count: data.subscriptions.filter((x) => x.scene === scene).length });
  },

  mySubscriptions() {
    const rows = db().subscriptions || [];
    return Promise.resolve({ items: rows });
  },

  // ── 公告 ──
  listNotices(query) {
    const q = query || {};
    const data = db();
    const now = Date.now();
    const reads = data.noticeReads || [];

    let items = (data.notices || []).filter((n) => !n.expiresAt || n.expiresAt > now);
    if (q.kind) items = items.filter((n) => n.kind === q.kind);

    // 置頂優先，其餘依發布時間新到舊
    items.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) || b.publishedAt - a.publishedAt);
    items = items.map((n) => Object.assign({}, n, { isRead: reads.indexOf(n.id) !== -1 }));

    return Promise.resolve({ items: items, unread: items.filter((n) => !n.isRead).length });
  },

  /**
   * W-59 全校搜尋（示範層）：規則要與後端 `/search` 一致 ——
   * 過期公告不算、失物類型與狀態照樣帶出、標題命中排前面、`%`／`_` 當普通字元。
   * 兩邊結論不一致時，交付現場（只跑示範資料）看到的就會跟線上不一樣。
   */
  search(query) {
    // 呼叫端有兩種寫法：頁面傳字串（data.search('圖書館')），自檢腳本傳物件（{ q, types, limit }）
    const opts = typeof query === 'string' ? { q: query } : (query || {});
    const q = String(opts.q || '').trim();
    const limit = opts.limit || 5;
    if (!q) return Promise.resolve({ q: '', total: 0, groups: [] });
    const low = q.toLowerCase();
    const data = db();
    const now = Date.now();
    const wanted = (opts.types || 'notice,event,item,giveaway,menu').split(',').map((s) => s.trim());
    const groups = [];

    const hitScore = (title) => (String(title || '').toLowerCase().indexOf(low) !== -1 ? 2 : 1);
    const snippet = (text, fallback) => {
      const body = String(text || '').replace(/\s+/g, ' ').trim();
      if (!body) return fallback || '';
      const at = body.toLowerCase().indexOf(low);
      const start = at <= 0 ? 0 : Math.max(0, at - 30);
      const piece = body.slice(start, start + 90);
      return (start > 0 ? '…' : '') + piece + (start + 90 < body.length ? '…' : '');
    };
    // 摘要要從「真的有命中的欄位」截：失物常是地點命中（圖書館三樓），
    // 截描述的話使用者看不出這筆為什麼被搜出來（與後端 bestSnippet 同一條規則）
    const bestSnippet = (fields) => {
      const hit = fields.filter((f) => String(f || '').toLowerCase().indexOf(low) !== -1)[0];
      const first = fields.filter((f) => String(f || '').trim())[0];
      return snippet(hit || first, '');
    };
    const byScore = (a, b) => b.score - a.score || String(b.date).localeCompare(String(a.date));

    if (wanted.indexOf('notice') !== -1) {
      const items = (data.notices || [])
        .filter((n) => !n.expiresAt || n.expiresAt > now)
        .filter((n) => String(n.title || '').toLowerCase().indexOf(low) !== -1 || String(n.content || '').toLowerCase().indexOf(low) !== -1)
        .map((n) => ({
          id: n.id, type: 'notice', title: n.title, snippet: bestSnippet([n.content]),
          badge: n.kind, date: new Date(n.publishedAt).toISOString(), score: hitScore(n.title),
        }))
        .sort(byScore)
        .slice(0, limit);
      groups.push({ type: 'notice', count: items.length, items: items });
    }

    if (wanted.indexOf('event') !== -1) {
      const items = (data.events || [])
        .filter((e) => !e.deletedAt && e.status !== 'DRAFT')
        .filter((e) => [e.title, e.description, e.location].some((v) => String(v || '').toLowerCase().indexOf(low) !== -1))
        .map((e) => ({
          id: e.id, type: 'event', title: e.title, snippet: bestSnippet([e.description, e.location]),
          badge: e.status, date: new Date(e.startAt).toISOString(), score: hitScore(e.title),
        }))
        .sort(byScore)
        .slice(0, limit);
      groups.push({ type: 'event', count: items.length, items: items });
    }

    if (wanted.indexOf('item') !== -1) {
      const items = (data.items || [])
        .filter((i) => !i.deletedAt)
        .filter((i) => [i.title, i.description, i.place].some((v) => String(v || '').toLowerCase().indexOf(low) !== -1))
        .map((i) => ({
          id: i.id, type: 'item', title: i.title, snippet: bestSnippet([i.description, i.place]),
          badge: i.type + ':' + i.status, date: new Date(i.happenedAt).toISOString(), score: hitScore(i.title),
        }))
        .sort(byScore)
        .slice(0, limit);
      groups.push({ type: 'item', count: items.length, items: items });
    }

    if (wanted.indexOf('giveaway') !== -1) {
      // W-71：只搜還拿得到的（AVAILABLE）；已贈出／已下架對搜尋的人是「按進去才發現沒有了」的假結果
      const items = (data.giveaways || [])
        .filter((g) => g.status === 'AVAILABLE')
        .filter((g) => [g.title, g.body, g.detail, g.pickupPlace].some((v) => String(v || '').toLowerCase().indexOf(low) !== -1))
        .map((g) => ({
          id: g.id, type: 'giveaway', title: g.title, snippet: bestSnippet([g.body, g.detail, g.pickupPlace]),
          badge: g.kind, date: new Date(g.createdAt).toISOString(), score: hitScore(g.title),
        }))
        .sort(byScore)
        .slice(0, limit);
      groups.push({ type: 'giveaway', count: items.length, items: items });
    }

    // W-74：菜單只搜「今天以後」—— 搜菜的用途是安排這一週吃什麼，翻上個月的菜色沒有意義
    if (wanted.indexOf('menu') !== -1) {
      const d0 = new Date();
      const p2 = (n) => (n < 10 ? '0' + n : '' + n);
      const todayKey = d0.getFullYear() + '-' + p2(d0.getMonth() + 1) + '-' + p2(d0.getDate());
      const items = [];
      (data.menu || [])
        .filter((m) => String(m.date || '') >= todayKey)
        .forEach((m) => {
          (m.lunch || []).forEach((d) => {
            if (![d.name, d.description].some((v) => String(v || '').toLowerCase().indexOf(low) !== -1)) return;
            items.push({
              id: d.id, type: 'menu', title: d.name, snippet: bestSnippet([d.description]),
              badge: 'LUNCH', date: new Date(m.date).toISOString(), score: hitScore(d.name),
            });
          });
          (m.snack || []).forEach((d) => {
            if (![d.name, d.description].some((v) => String(v || '').toLowerCase().indexOf(low) !== -1)) return;
            items.push({
              id: d.id, type: 'menu', title: d.name, snippet: bestSnippet([d.description]),
              badge: 'SNACK', date: new Date(m.date).toISOString(), score: hitScore(d.name),
            });
          });
        });
      const sorted = items
        .sort((a, b) => b.score - a.score || String(a.date).localeCompare(String(b.date)))
        .slice(0, limit);
      groups.push({ type: 'menu', count: sorted.length, items: sorted });
    }

    const kept = groups.filter((g) => g.count > 0);
    return Promise.resolve({ q: q, total: kept.reduce((s, g) => s + g.count, 0), groups: kept });
  },

  /** 外部校曆（示範模式）：給兩場測驗，讓「測驗倒數」在離線演示時也有資料 */
  externalCalendar() {
    // 示範層也要有測驗場次，否則「測驗倒數」在斷網演示時只會是空狀態
    // （真 API 模式下這份資料來自學校發布的 ICS；沒設定就是空的，頁面會說明）
    return Promise.resolve({
      configured: true,
      source: 'ics',
      updatedAt: new Date().toISOString(),
      items: [
        { id: 'ics-exam-1', title: '化學測驗（第二次）', date: demoDay(4), startTime: '09:00', location: '高二丙課室' },
        { id: 'ics-exam-2', title: '數學統測', date: demoDay(11), startTime: '09:00', location: '禮堂' },
      ],
    });
  },

  createReport(targetType, targetId, reason) {
    const data = db();
    data.reports = data.reports || [];
    const rec = {
      id: 'r' + Date.now(),
      targetType: targetType,
      targetId: targetId,
      reason: reason,
      status: 'PENDING',
      createdAt: Date.now(),
    };
    data.reports.push(rec);
    save(data);
    return Promise.resolve(rec);
  },

  /** 校曆：由既有示範資料組合（公告＋活動） */
  calendar() {
    const notices = (db().notices || []).filter((n) => !n.expiresAt || n.expiresAt > Date.now());
    const events = (db().events || []).filter((e) => e.status !== 'CANCELLED');
    return Promise.resolve({ notices: notices, events: events });
  },

  getNotice(id) {
    const data = db();
    const n = (data.notices || []).filter((x) => x.id === id)[0];
    if (!n) return Promise.reject({ code: 'NOT_FOUND' });

    data.noticeReads = data.noticeReads || [];
    if (data.noticeReads.indexOf(id) === -1) {
      data.noticeReads.push(id);
      save(data);
    }
    return Promise.resolve(Object.assign({}, n, { isRead: true }));
  },

  markAllNoticesRead() {
    const data = db();
    data.noticeReads = (data.notices || []).map((n) => n.id);
    save(data);
    return Promise.resolve({ ok: true });
  },

  // ── W-34 示範站內通知 ──
  notifications(unreadOnly) {
    const all = [
      // W-57：貼上失物／拾獲時的主動配對通知（真 API 模式由後端產生；示範模式沒有其他真實使用者，留一則讓你看到長相）
      { id: 'n4', kind: 'ITEM', title: '有人撿到像你的「黑色雨傘」', body: '疑似與你張貼的「黑色雨傘」相符（同分類、地點相近），地點：圖書館一樓', link: '/pages/items/detail/index?id=i2', readAt: null, createdAt: '2026-10-25T02:10:00.000Z' },
      { id: 'n1', kind: 'EVENT', title: '活動改期：班際籃球賽', body: '原定 11/10 09:00 → 11/17 09:00', link: '/pages/events/detail/index?id=e7', readAt: null, createdAt: '2026-10-24T09:12:00.000Z' },
      { id: 'n2', kind: 'CLAIM', title: '認領已通過', body: '你申請的「黑色雨傘」已審批通過，請到失物招領領取。', link: '/pages/items/detail/index?id=i1', readAt: null, createdAt: '2026-10-23T15:40:00.000Z' },
      { id: 'n3', kind: 'NOTICE', title: '新公告：期中考試安排', body: '教務處已發布期中考試時間表。', link: '/pages/notices/detail/index?id=nt1', readAt: '2026-10-22T08:00:00.000Z', createdAt: '2026-10-22T07:30:00.000Z' },
    ];
    return Promise.resolve({ items: unreadOnly ? all.filter((x) => !x.readAt) : all, unread: all.filter((x) => !x.readAt).length });
  },
  notificationsUnread() {
    return this.notifications(true).then((r) => ({ unread: r.unread }));
  },
  readNotifications() {
    return Promise.resolve({ ok: true, unread: 0 });
  },

  // ── W-31 示範回饋 ──
  eventFeedback(eventId) {
    const rows = (this.__feedback || []).filter((x) => x.eventId === eventId);
    const mine = rows.find((x) => x.mine) || null;
    return Promise.resolve({
      count: rows.length,
      avg: rows.length ? Math.round((rows.reduce((a, b) => a + b.rating, 0) / rows.length) * 10) / 10 : 0,
      mine: mine ? { rating: mine.rating, comment: mine.comment } : null,
      items: rows.filter((x) => x.comment).map((x) => ({ rating: x.rating, comment: x.comment, nickname: x.nickname || '同學', createdAt: x.createdAt })),
    });
  },
  submitFeedback(eventId, rating, comment) {
    this.__feedback = (this.__feedback || []).filter((x) => !(x.eventId === eventId && x.mine));
    this.__feedback.push({ eventId, rating, comment, mine: true, nickname: '我', createdAt: new Date().toISOString() });
    return Promise.resolve({ ok: true });
  },

  // ── W-30 示範組隊 ──
  eventTeams(eventId) {
    const rows = (this.__teams || []).filter((t) => t.eventId === eventId);
    return Promise.resolve({ teams: rows.map((t) => ({ id: t.id, name: t.name, members: t.members || 1, mine: !!t.mine, code: t.mine ? t.code : null })) });
  },
  createTeam(eventId, name) {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    this.__teams = this.__teams || [];
    this.__teams.push({ id: 't' + this.__teams.length, eventId, name, code, mine: true, members: 1 });
    return Promise.resolve({ id: 't', name, code });
  },

  // ── W-43 使用者回報（示範模式）：寫進本地，不假裝送到後端 ──
  // 回傳 demo: true，畫面才能老實說「示範模式沒有送出」，而不是彈一個假的「已送出」。
  reportIssue(payload) {
    const p = payload || {};
    const text = String(p.message || '').trim().slice(0, 300);
    if (text.length < 2) return Promise.reject({ code: 'VALIDATION_FAILED', message: '請簡短描述你遇到的問題' });
    this.__reports = this.__reports || [];
    this.__reports.push({ id: 'r' + this.__reports.length, message: text, route: p.route || '', at: new Date().toISOString() });
    return Promise.resolve({ ok: true, demo: true, id: 'r' + (this.__reports.length - 1), count: 1 });
  },

  // ── 家校通（示範資料）──
  // 注意：不能用 this.xxx 存狀態 —— data.js 是把方法拆出來呼叫的，this 會是 null
  // （2026-10-25 走查抓到：Cannot read properties of null (reading '__schoolLinked')）
  schoolStatus() {
    return Promise.resolve({ linked: schoolLinked, childrenCount: 0, studentNo: schoolLinked ? '3201301037' : null, className: '高二丙', lastSyncAt: schoolLinked ? new Date().toISOString() : null, lastError: null, cryptoReady: true });
  },
  schoolLink(account) {
    schoolLinked = true;
    // 學號只留數字（與後端 accountToStudentNo 一致），示範模式才不會顯示成 pv3201301037
    return Promise.resolve({ linked: true, studentNo: String(account || '').replace(/^pv|^s/i, '') });
  },
  schoolUnlink() { schoolLinked = false; return Promise.resolve({ linked: false }); },
  schoolSync() { return Promise.resolve({ ok: true, grades: 6, attendance: 35 }); },
  schoolGrades() {
    return Promise.resolve(demoSchoolGrades());
  },
  schoolAttendance() {
    return Promise.resolve(demoSchoolAttendance());
  },

  schoolManualGrade(body) { return Promise.resolve({ ...body, id: 'gm', source: 'MANUAL' }); },
  schoolManualAttendance(body) { return Promise.resolve({ ...body, id: 'am', source: 'MANUAL' }); },

  // ── W-66 圖書館（示範模式）──
  // 與後端同一套規則：可借量扣減、借不到排候補、還書叫最早候補、續借上限 1 次。
  // 狀態一律寫回 storage（data.books / data.loans / data.reservations），重新整理還在。
  listBooks(query) {
    const q = query || {};
    const data = db();
    const iso = (t) => (t ? new Date(t).toISOString() : null);
    const loansOf = (id) => data.loans.filter((l) => l.bookId === id).length;
    const holdsOf = (id) =>
      data.reservations.filter((r) => r.bookId === id && (r.status === 'WAITING' || r.status === 'READY')).length;

    let books = data.books.filter((b) => b.status !== 'ARCHIVED');
    if (q.category) books = books.filter((b) => b.category === q.category);
    if (q.available === '1') books = books.filter((b) => b.availableCopies > 0);
    if (q.q) {
      const kw = String(q.q);
      books = books.filter((b) => (b.title + (b.author || '') + (b.isbn || '') + (b.callNumber || '')).indexOf(kw) !== -1);
    }

    let out = books.map((b) =>
      Object.assign({}, b, {
        createdAt: iso(b.createdAt || Date.now()),
        updatedAt: iso(b.updatedAt || b.createdAt || Date.now()),
        waiting: holdsOf(b.id),
        borrowable: b.availableCopies > 0,
      }),
    );
    if (q.sort === 'title') out.sort((a, b) => String(a.title).localeCompare(String(b.title)));
    else if (q.sort === 'hot') out.sort((a, b) => loansOf(b.id) - loansOf(a.id) || String(a.title).localeCompare(String(b.title)));
    else out.sort((a, b) => String(a.id).localeCompare(String(b.id)));

    const page = Number(q.page) || 1;
    const limit = Number(q.limit) || Number(q.pageSize) || 20;
    const start = (page - 1) * limit;
    const slice = out.slice(start, start + limit);
    return Promise.resolve({ items: slice, total: out.length, page: page, limit: limit, hasMore: start + slice.length < out.length });
  },

  getBook(id) {
    const data = db();
    const b = data.books.filter((x) => x.id === id && x.status !== 'ARCHIVED')[0];
    if (!b) return Promise.reject({ code: 'NOT_FOUND', message: '找不到這本書' });
    const iso = (t) => (t ? new Date(t).toISOString() : null);
    const mine = data.loans.filter((l) => l.bookId === id && l.userId === 'demo-user' && !l.returnedAt)[0] || null;
    const rv = data.reservations.filter((r) => r.bookId === id && r.userId === 'demo-user' && (r.status === 'WAITING' || r.status === 'READY'))[0] || null;
    const waiting = data.reservations.filter((r) => r.bookId === id && r.status === 'WAITING').length;
    const ready = data.reservations.filter((r) => r.bookId === id && r.status === 'READY').length;
    const now = Date.now();
    return Promise.resolve({
      book: Object.assign({}, b, {
        createdAt: iso(b.createdAt || now),
        updatedAt: iso(b.updatedAt || now),
        waiting: waiting,
        loans90d: data.loans.filter((l) => l.bookId === id).length,
        borrowable: b.availableCopies > ready,
      }),
      myLoan: mine
        ? {
            id: mine.id,
            bookId: mine.bookId,
            borrowedAt: iso(mine.borrowedAt),
            dueAt: iso(mine.dueAt),
            returnedAt: null,
            renewals: mine.renewals || 0,
            overdueDays: Math.max(0, Math.floor((now - new Date(mine.dueAt).getTime()) / 86400000)),
          }
        : null,
      myReservation: rv
        ? { id: rv.id, status: rv.status, position: rv.position, readyAt: iso(rv.readyAt), holdHours: 48 }
        : null,
      totalLoans: data.loans.filter((l) => l.bookId === id).length,
    });
  },

  lookupIsbn(raw) {
    const isbn = String(raw || '').replace(/[^0-9Xx]/g, '').toUpperCase();
    if (isbn.length < 10) return Promise.reject({ code: 'VALIDATION_FAILED', message: '書號格式不正確' });
    const b = db().books.filter((x) => x.isbn === isbn && x.status !== 'ARCHIVED')[0];
    if (!b) return Promise.resolve({ found: false, isbn: isbn, book: null });
    return Promise.resolve({ found: true, isbn: isbn, book: Object.assign({}, b, { borrowable: b.availableCopies > 0 }) });
  },

  hotBooks() {
    const data = db();
    const counts = {};
    data.loans.forEach((l) => {
      counts[l.bookId] = (counts[l.bookId] || 0) + 1;
    });
    const items = Object.keys(counts)
      .map((id) => {
        const b = data.books.filter((x) => x.id === id && x.status !== 'ARCHIVED')[0];
        return b ? { id: b.id, title: b.title, author: b.author, category: b.category, isbn: b.isbn, loans: counts[id] } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.loans - a.loans)
      .slice(0, 5);
    return Promise.resolve({ items: items });
  },

  borrowBook(payload) {
    const p = payload || {};
    const data = db();
    const iso = (t) => (t ? new Date(t).toISOString() : null);
    const book = p.bookId
      ? data.books.filter((b) => b.id === p.bookId)[0]
      : data.books.filter((b) => b.isbn === String(p.isbn || '').replace(/[^0-9Xx]/g, '').toUpperCase())[0];
    if (!book || book.status === 'ARCHIVED') return Promise.reject({ code: 'NOT_FOUND', message: '找不到這本書' });

    if (data.loans.filter((l) => l.bookId === book.id && l.userId === 'demo-user' && !l.returnedAt).length) {
      return Promise.reject({ code: 'ALREADY_BORROWED', message: '你已經借了這本書，還沒歸還' });
    }

    const ready = data.reservations.filter((r) => r.bookId === book.id && r.status === 'READY');
    const mineR = data.reservations.filter((r) => r.bookId === book.id && r.userId === 'demo-user')[0] || null;
    const holdsReady = mineR && mineR.status === 'READY';
    const availableForMe = holdsReady || book.availableCopies > ready.length;

    if (!availableForMe) {
      if (mineR && mineR.status === 'WAITING') {
        return Promise.reject({ code: 'ALREADY_RESERVED', message: '你已经在候補名單（第 ' + mineR.position + ' 位）', details: { position: mineR.position } });
      }
      const pos = data.reservations.filter((r) => r.bookId === book.id && r.status === 'WAITING').length + 1;
      let saved;
      if (mineR) {
        mineR.status = 'WAITING';
        mineR.position = pos;
        mineR.readyAt = null;
        saved = mineR;
      } else {
        saved = { id: 'rv' + (data.reservations.length + 1), bookId: book.id, userId: 'demo-user', status: 'WAITING', position: pos, createdAt: Date.now(), readyAt: null };
        data.reservations.push(saved);
      }
      save(data);
      return Promise.resolve({
        ok: true,
        kind: 'reservation',
        message: '目前沒有可借的，已幫你排候補第 ' + pos + ' 位',
        reservation: { id: saved.id, bookId: book.id, status: 'WAITING', position: pos, readyAt: null },
        availableCopies: book.availableCopies,
        waiting: data.reservations.filter((r) => r.bookId === book.id && r.status === 'WAITING').length,
      });
    }

    const now = Date.now();
    book.availableCopies -= 1;
    const loan = { id: 'l' + (data.loans.length + 1), bookId: book.id, userId: 'demo-user', borrowedAt: now, dueAt: now + (book.loanDays || 14) * 86400000, returnedAt: null, renewals: 0 };
    data.loans.push(loan);
    if (mineR && mineR.status === 'READY') {
      mineR.status = 'FULFILLED';
      mineR.position = 0;
    }
    save(data);
    return Promise.resolve({
      ok: true,
      kind: 'loan',
      message: '借書成功',
      loan: { id: loan.id, bookId: book.id, borrowedAt: iso(loan.borrowedAt), dueAt: iso(loan.dueAt), renewals: 0 },
      availableCopies: book.availableCopies,
      waiting: data.reservations.filter((r) => r.bookId === book.id && r.status === 'WAITING').length,
    });
  },

  myLoans() {
    const data = db();
    const iso = (t) => (t ? new Date(t).toISOString() : null);
    const now = Date.now();
    const bookOf = (id) => data.books.filter((b) => b.id === id)[0] || null;
    const shape = (l) => {
      const b = bookOf(l.bookId);
      const overdueDays = l.returnedAt ? 0 : Math.max(0, Math.floor((now - new Date(l.dueAt).getTime()) / 86400000));
      return {
        id: l.id,
        bookId: l.bookId,
        book: b ? { id: b.id, title: b.title, author: b.author, isbn: b.isbn } : null,
        borrowedAt: iso(l.borrowedAt),
        dueAt: iso(l.dueAt),
        returnedAt: iso(l.returnedAt),
        renewals: l.renewals || 0,
        overdueDays: overdueDays,
        dueSoon: !l.returnedAt && overdueDays === 0 && new Date(l.dueAt).getTime() - now <= 3 * 86400000,
      };
    };
    const loans = data.loans.filter((l) => l.userId === 'demo-user').map(shape);
    const active = loans.filter((l) => !l.returnedAt);
    const reservations = data.reservations
      .filter((r) => r.userId === 'demo-user' && (r.status === 'WAITING' || r.status === 'READY'))
      .map((r) => {
        const b = bookOf(r.bookId);
        return {
          id: r.id,
          bookId: r.bookId,
          book: b ? { id: b.id, title: b.title, author: b.author, isbn: b.isbn } : null,
          status: r.status,
          position: r.position,
          readyAt: iso(r.readyAt),
          holdHours: 48,
        };
      });
    return Promise.resolve({
      activeCount: active.length,
      overdueCount: active.filter((l) => l.overdueDays > 0).length,
      loans: loans,
      reservations: reservations,
    });
  },

  returnLoan(id) {
    const data = db();
    const loan = data.loans.filter((l) => l.id === id)[0];
    if (!loan) return Promise.reject({ code: 'NOT_FOUND', message: '找不到這筆借閱紀錄' });
    if (loan.returnedAt) return Promise.reject({ code: 'ALREADY_RETURNED', message: '這本書已經歸還了' });
    const now = Date.now();
    loan.returnedAt = now;
    const book = data.books.filter((b) => b.id === loan.bookId)[0];
    if (book) book.availableCopies += 1;

    // 還書 → 最早候補被叫到（與後端同一條規則）
    const next = data.reservations
      .filter((r) => r.bookId === loan.bookId && r.status === 'WAITING')
      .sort((a, b) => a.position - b.position)[0];
    if (next) {
      next.status = 'READY';
      next.position = 0;
      next.readyAt = now;
    }
    data.reservations
      .filter((r) => r.bookId === loan.bookId && r.status === 'WAITING')
      .sort((a, b) => a.position - b.position)
      .forEach((r, i) => {
        r.position = i + 1;
      });
    save(data);
    return Promise.resolve({
      ok: true,
      returned: true,
      bookId: loan.bookId,
      overdueDays: Math.max(0, Math.floor((now - new Date(loan.dueAt).getTime()) / 86400000)),
      promotedUserId: next ? next.userId : null,
      availableCopies: book ? book.availableCopies : 0,
      waiting: data.reservations.filter((r) => r.bookId === loan.bookId && r.status === 'WAITING').length,
    });
  },

  renewLoan(id) {
    const data = db();
    const loan = data.loans.filter((l) => l.id === id)[0];
    if (!loan) return Promise.reject({ code: 'NOT_FOUND', message: '找不到這筆借閱紀錄' });
    if (loan.returnedAt) return Promise.reject({ code: 'VALIDATION_FAILED', message: '這本書已經歸還，不需要續借' });
    if ((loan.renewals || 0) >= 1) return Promise.reject({ code: 'RENEW_LIMIT', message: '每本書只能續借一次' });
    if (Date.now() > new Date(loan.dueAt).getTime()) return Promise.reject({ code: 'LOAN_OVERDUE', message: '已經逾期，請先還書' });
    if (data.reservations.filter((r) => r.bookId === loan.bookId && (r.status === 'WAITING' || r.status === 'READY')).length) {
      return Promise.reject({ code: 'LOAN_QUEUED', message: '有人在等這本書，請讓給下一位' });
    }
    const book = data.books.filter((b) => b.id === loan.bookId)[0];
    loan.dueAt = new Date(loan.dueAt).getTime() + ((book && book.loanDays) || 14) * 86400000;
    loan.renewals = 1;
    save(data);
    return Promise.resolve({ ok: true, dueAt: new Date(loan.dueAt).toISOString(), renewals: 1, loanDays: (book && book.loanDays) || 14 });
  },

  cancelReservation(id) {
    const data = db();
    const rv = data.reservations.filter((r) => r.id === id)[0];
    if (!rv) return Promise.reject({ code: 'NOT_FOUND', message: '找不到這筆預約' });
    if (rv.status !== 'WAITING' && rv.status !== 'READY') return Promise.reject({ code: 'VALIDATION_FAILED', message: '這筆預約已經結束了' });
    const wasReady = rv.status === 'READY';
    rv.status = 'CANCELLED';
    rv.position = 0;
    let promoted = null;
    if (wasReady) {
      promoted = data.reservations
        .filter((r) => r.bookId === rv.bookId && r.status === 'WAITING')
        .sort((a, b) => a.position - b.position)[0];
      if (promoted) {
        promoted.status = 'READY';
        promoted.position = 0;
        promoted.readyAt = Date.now();
      }
    }
    data.reservations
      .filter((r) => r.bookId === rv.bookId && r.status === 'WAITING')
      .sort((a, b) => a.position - b.position)
      .forEach((r, i) => {
        r.position = i + 1;
      });
    save(data);
    return Promise.resolve({ ok: true, cancelled: true, bookId: rv.bookId, promotedUserId: promoted ? promoted.userId : null });
  },

  // ── W-67 場地／器材借用 ──
  // 狀態一律寫回 storage，重新整理還在；方法內不用 this（data.js 是拆出來呼叫的）。
  listResources(query) {
    const q = query || {};
    const data = db();
    let list = data.resources.filter((r) => r.status !== 'ARCHIVED');
    if (q.kind) list = list.filter((r) => r.kind === q.kind);
    if (q.q) {
      const kw = String(q.q).toLowerCase();
      list = list.filter((r) => (r.name + (r.location || '') + (r.description || '')).toLowerCase().indexOf(kw) !== -1);
    }
    const now = Date.now();
    const items = list.map((r) =>
      venue.shapeResource(
        Object.assign({}, r, {
          upcoming: data.resourceBookings.filter(
            (b) => b.resourceId === r.id && (b.status === 'PENDING' || b.status === 'APPROVED') && new Date(b.endAt).getTime() >= now,
          ).length,
        }),
        now,
      ),
    );
    return Promise.resolve({ items: items, total: items.length, page: 1 });
  },

  getResource(id) {
    const data = db();
    const r = data.resources.filter((x) => x.id === id && x.status !== 'ARCHIVED')[0];
    if (!r) return Promise.reject({ code: 'NOT_FOUND', message: '找不到這個場地或器材' });
    const now = Date.now();
    const role = (data.user && data.user.role) || 'STUDENT';
    const mineId = (data.user && data.user.id) || 'demo-user';
    const live = data.resourceBookings.filter(
      (b) => b.resourceId === id && (b.status === 'PENDING' || b.status === 'APPROVED') && new Date(b.endAt).getTime() >= now,
    );
    const withUser = live.map((b) =>
      Object.assign({}, b, { user: { id: b.userId, nickname: b.userId === mineId ? (data.user.nickname || '我') : '其他同學' } }),
    );
    return Promise.resolve({
      resource: venue.shapeResource(r, now),
      bookings: withUser.sort((a, b) => new Date(a.startAt) - new Date(b.startAt)).map((b) => venue.shapeBooking(b, now)),
      mine: withUser.filter((b) => b.userId === mineId).map((b) => venue.shapeBooking(b, now)),
      canBook: role !== 'GUEST',
      canApprove: ['TEACHER', 'STAFF', 'ADMIN', 'SUPER_ADMIN'].indexOf(role) !== -1,
      canManage: ['STAFF', 'ADMIN', 'SUPER_ADMIN'].indexOf(role) !== -1,
    });
  },

  createResourceBooking(id, payload) {
    const body = payload || {};
    const data = db();
    const r = data.resources.filter((x) => x.id === id && x.status !== 'ARCHIVED')[0];
    if (!r) return Promise.reject({ code: 'NOT_FOUND', message: '找不到這個場地或器材' });

    const startMs = new Date(body.startAt).getTime();
    const endMs = new Date(body.endAt).getTime();
    if (!isFinite(startMs) || !isFinite(endMs) || endMs <= startMs) {
      return Promise.reject({ code: 'VALIDATION_FAILED', message: '結束時間要晚於開始時間' });
    }
    const minutes = (endMs - startMs) / 60000;
    if (minutes < 30) return Promise.reject({ code: 'VALIDATION_FAILED', message: '一次最少借 30 分鐘' });
    if (minutes > (r.maxHours || 4) * 60) {
      return Promise.reject({ code: 'VALIDATION_FAILED', message: '這個場地一次最多借 ' + (r.maxHours || 4) + ' 小時' });
    }
    if (startMs < Date.now() - 5 * 60000) {
      return Promise.reject({ code: 'VALIDATION_FAILED', message: '不能預約已經過去的時段' });
    }
    const s = venue.macauClock(startMs);
    const e = venue.macauClock(endMs);
    if (s.ymd !== e.ymd) return Promise.reject({ code: 'VALIDATION_FAILED', message: '借用不可以跨日，請分兩筆申請' });
    const toMin = (t) => {
      const p = String(t).split(':').map(Number);
      return p[0] * 60 + p[1];
    };
    if (s.minutes < toMin(r.openFrom) || e.minutes > toMin(r.openTo)) {
      return Promise.reject({
        code: 'VALIDATION_FAILED',
        message: '這個場地只在 ' + r.openFrom + '–' + r.openTo + ' 開放',
      });
    }
    const conflict = data.resourceBookings.filter(
      (b) =>
        b.resourceId === id &&
        (b.status === 'PENDING' || b.status === 'APPROVED') &&
        venue.overlaps(b.startAt, b.endAt, body.startAt, body.endAt),
    )[0];
    if (conflict) {
      const c = venue.macauClock(conflict.startAt);
      return Promise.reject({
        code: 'CONFLICT',
        message: '這個時段已被預約（' + venue.hhmm(c.minutes) + ' 起）',
      });
    }

    const needsApproval = r.needsApproval !== false;
    const booking = {
      id: nextId('rb'),
      resourceId: id,
      userId: (data.user && data.user.id) || 'demo-user',
      startAt: new Date(startMs).toISOString(),
      endAt: new Date(endMs).toISOString(),
      purpose: String(body.purpose || '').slice(0, 200),
      status: needsApproval ? 'PENDING' : 'APPROVED',
      createdAt: Date.now(),
      rejectReason: null,
    };
    data.resourceBookings.unshift(booking);
    save(data);
    return Promise.resolve({
      booking: venue.shapeBooking(Object.assign({}, booking, { resource: { id: r.id, name: r.name, kind: r.kind } }), Date.now()),
      pending: needsApproval,
    });
  },

  cancelResourceBooking(id) {
    const data = db();
    const mineId = (data.user && data.user.id) || 'demo-user';
    const booking = data.resourceBookings.filter((b) => b.id === id)[0];
    if (!booking || booking.userId !== mineId) return Promise.reject({ code: 'NOT_FOUND', message: '找不到這筆申請' });
    if (booking.status !== 'PENDING' && booking.status !== 'APPROVED') {
      return Promise.reject({ code: 'CONFLICT', message: '這筆申請已經結束，不能取消' });
    }
    booking.status = 'CANCELLED';
    save(data);
    return Promise.resolve({ ok: true, status: 'CANCELLED' });
  },

  myResourceBookings() {
    const data = db();
    const mineId = (data.user && data.user.id) || 'demo-user';
    const now = Date.now();
    const rows = data.resourceBookings
      .filter((b) => b.userId === mineId)
      .sort((a, b) => new Date(b.startAt) - new Date(a.startAt));
    const items = rows.map((b) => {
      const r = data.resources.filter((x) => x.id === b.resourceId)[0];
      return venue.shapeBooking(
        Object.assign({}, b, { resource: r ? { id: r.id, name: r.name, kind: r.kind, location: r.location } : null }),
        now,
      );
    });
    return Promise.resolve({
      items: items,
      pending: rows.filter((b) => b.status === 'PENDING' && new Date(b.endAt).getTime() >= now).length,
      upcoming: rows.filter((b) => b.status === 'APPROVED' && new Date(b.endAt).getTime() >= now).length,
    });
  },

  pendingResourceBookings() {
    const data = db();
    const role = (data.user && data.user.role) || 'STUDENT';
    if (['TEACHER', 'STAFF', 'ADMIN', 'SUPER_ADMIN'].indexOf(role) === -1) {
      return Promise.reject({ code: 'FORBIDDEN', message: '權限不足' });
    }
    const now = Date.now();
    const shape = (b) => {
      const r = data.resources.filter((x) => x.id === b.resourceId)[0];
      const nickname = b.userId === ((data.user && data.user.id) || 'demo-user') ? (data.user.nickname || '我') : '其他同學';
      return venue.shapeBooking(
        Object.assign({}, b, {
          resource: r ? { id: r.id, name: r.name, kind: r.kind, location: r.location } : null,
          user: { id: b.userId, nickname: nickname },
        }),
        now,
      );
    };
    return Promise.resolve({
      pending: data.resourceBookings
        .filter((b) => b.status === 'PENDING')
        .sort((a, b) => new Date(a.startAt) - new Date(b.startAt))
        .map(shape),
      handled: data.resourceBookings
        .filter((b) => b.status !== 'PENDING')
        .sort((a, b) => new Date(b.startAt) - new Date(a.startAt))
        .slice(0, 20)
        .map(shape),
    });
  },

  reviewResourceBooking(id, body) {
    const data = db();
    const role = (data.user && data.user.role) || 'STUDENT';
    if (['TEACHER', 'STAFF', 'ADMIN', 'SUPER_ADMIN'].indexOf(role) === -1) {
      return Promise.reject({ code: 'FORBIDDEN', message: '權限不足' });
    }
    const booking = data.resourceBookings.filter((b) => b.id === id)[0];
    if (!booking) return Promise.reject({ code: 'NOT_FOUND', message: '找不到這筆申請' });
    if (booking.status !== 'PENDING') return Promise.reject({ code: 'CONFLICT', message: '這筆申請已經處理過了' });
    const action = (body && body.action) || 'APPROVE';
    if (action === 'APPROVE') {
      const clash = data.resourceBookings.filter(
        (b) =>
          b.id !== booking.id &&
          b.resourceId === booking.resourceId &&
          (b.status === 'PENDING' || b.status === 'APPROVED') &&
          venue.overlaps(b.startAt, b.endAt, booking.startAt, booking.endAt),
      )[0];
      if (clash) return Promise.reject({ code: 'CONFLICT', message: '這個時段還有另一筆申請，請先處理那一筆' });
    }
    booking.status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    booking.rejectReason = action === 'REJECT' ? String((body && body.reason) || '').slice(0, 200) : null;
    booking.reviewedAt = Date.now();
    save(data);
    return Promise.resolve({
      booking: { id: booking.id, status: booking.status, userId: booking.userId, rejectReason: booking.rejectReason },
    });
  },

  allResources() {
    const data = db();
    const role = (data.user && data.user.role) || 'STUDENT';
    if (['STAFF', 'ADMIN', 'SUPER_ADMIN'].indexOf(role) === -1) {
      return Promise.reject({ code: 'FORBIDDEN', message: '權限不足' });
    }
    const now = Date.now();
    return Promise.resolve({
      items: data.resources.map((r) =>
        Object.assign(venue.shapeResource(r, now), {
          bookings: data.resourceBookings.filter((b) => b.resourceId === r.id).length,
        }),
      ),
    });
  },

  createResource(body) {
    const data = db();
    const role = (data.user && data.user.role) || 'STUDENT';
    if (['STAFF', 'ADMIN', 'SUPER_ADMIN'].indexOf(role) === -1) {
      return Promise.reject({ code: 'FORBIDDEN', message: '權限不足' });
    }
    const input = body || {};
    if (!input.name) return Promise.reject({ code: 'VALIDATION_FAILED', message: '請輸入名稱' });
    if ((input.openFrom || '08:00') >= (input.openTo || '18:00')) {
      return Promise.reject({ code: 'VALIDATION_FAILED', message: '關閉時間要晚於開放時間' });
    }
    const resource = {
      id: nextId('r'),
      kind: input.kind || 'VENUE',
      name: String(input.name).slice(0, 80),
      location: input.location || '',
      description: input.description || '',
      openFrom: input.openFrom || '08:00',
      openTo: input.openTo || '18:00',
      maxHours: Number(input.maxHours) || 4,
      needsApproval: input.needsApproval !== false,
      status: 'ACTIVE',
      version: 0,
    };
    data.resources.push(resource);
    save(data);
    return Promise.resolve({ resource: venue.shapeResource(resource, Date.now()) });
  },

  updateResource(id, body) {
    const data = db();
    const role = (data.user && data.user.role) || 'STUDENT';
    if (['STAFF', 'ADMIN', 'SUPER_ADMIN'].indexOf(role) === -1) {
      return Promise.reject({ code: 'FORBIDDEN', message: '權限不足' });
    }
    const resource = data.resources.filter((r) => r.id === id && r.status !== 'ARCHIVED')[0];
    if (!resource) return Promise.reject({ code: 'NOT_FOUND', message: '找不到這個場地或器材' });
    const input = body || {};
    if (input.version !== undefined && input.version !== resource.version) {
      return Promise.reject({ code: 'CONFLICT', message: '這筆資料剛被別人改過，請重新載入後再儲存' });
    }
    ['kind', 'name', 'location', 'description', 'openFrom', 'openTo', 'maxHours', 'needsApproval'].forEach((k) => {
      if (input[k] !== undefined) resource[k] = input[k];
    });
    if (resource.openFrom >= resource.openTo) {
      return Promise.reject({ code: 'VALIDATION_FAILED', message: '關閉時間要晚於開放時間' });
    }
    resource.version = (resource.version || 0) + 1;
    save(data);
    return Promise.resolve({ resource: venue.shapeResource(resource, Date.now()) });
  },

  archiveResource(id) {
    const data = db();
    const role = (data.user && data.user.role) || 'STUDENT';
    if (['STAFF', 'ADMIN', 'SUPER_ADMIN'].indexOf(role) === -1) {
      return Promise.reject({ code: 'FORBIDDEN', message: '權限不足' });
    }
    const resource = data.resources.filter((r) => r.id === id && r.status !== 'ARCHIVED')[0];
    if (!resource) return Promise.reject({ code: 'NOT_FOUND', message: '找不到這個場地或器材' });
    const live = data.resourceBookings.filter(
      (b) => b.resourceId === id && (b.status === 'PENDING' || b.status === 'APPROVED') && new Date(b.endAt).getTime() >= Date.now(),
    ).length;
    if (live) return Promise.reject({ code: 'CONFLICT', message: '還有 ' + live + ' 筆未結束的預約，請先處理或取消後再下架' });
    resource.status = 'ARCHIVED';
    resource.version = (resource.version || 0) + 1;
    save(data);
    return Promise.resolve({ ok: true });
  },

  // ── W-68 二手書／校服轉贈（示範層也寫得進，交付現場斷網時這個模組不能是死的）──
  listGiveaways(query) {
    const data = db();
    const q = query || {};
    const kw = String(q.q || '').trim();
    let list = (data.giveaways || []).filter((g) => g.status === 'AVAILABLE');
    if (q.kind) list = list.filter((g) => g.kind === q.kind);
    if (kw) {
      list = list.filter(
        (g) =>
          String(g.title || '').indexOf(kw) !== -1 ||
          String(g.body || '').indexOf(kw) !== -1 ||
          String(g.detail || '').indexOf(kw) !== -1 ||
          String(g.pickupPlace || '').indexOf(kw) !== -1,
      );
    }
    list = list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return Promise.resolve({ items: list.map((g) => shapeGiveaway(data, g)), total: list.length, page: 1 });
  },

  getGiveaway(id) {
    const data = db();
    const item = (data.giveaways || []).filter((g) => g.id === id)[0];
    if (!item) return Promise.reject({ code: 'NOT_FOUND', message: '找不到這件轉贈物品' });
    const me = data.user || {};
    const isOwner = item.ownerId === me.id;
    const manager = ['STAFF', 'ADMIN', 'SUPER_ADMIN'].indexOf(me.role) !== -1;
    const mine = (data.giveawayRequests || []).filter((r) => r.itemId === id && r.userId === me.id)[0] || null;
    if (item.status !== 'AVAILABLE' && !isOwner && !manager && !mine) {
      return Promise.reject({ code: 'NOT_FOUND', message: '找不到這件轉贈物品' });
    }
    const rows = isOwner || manager
      ? (data.giveawayRequests || []).filter((r) => r.itemId === id)
      : [];
    return Promise.resolve({
      item: shapeGiveaway(data, item),
      requests: rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        nickname: r.userId === me.id ? me.nickname : '陳同學',
        className: r.userId === me.id ? '高二 仁' : '高二 仁',
        message: r.message || null,
        status: r.status,
        createdAt: new Date(r.createdAt).toISOString(),
        decidedAt: r.decidedAt ? new Date(r.decidedAt).toISOString() : null,
      })),
      isOwner: isOwner,
      canRequest: !isOwner && item.status === 'AVAILABLE' && !mine,
      canManage: manager,
    });
  },

  myGiveaways() {
    const data = db();
    const me = data.user || {};
    const posted = (data.giveaways || [])
      .filter((g) => g.ownerId === me.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((g) => shapeGiveaway(data, g, { showContact: true }));
    const requests = (data.giveawayRequests || [])
      .filter((r) => r.userId === me.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((r) => {
        const item = (data.giveaways || []).filter((g) => g.id === r.itemId)[0] || {};
        return {
          id: r.id,
          status: r.status,
          message: r.message || null,
          createdAt: new Date(r.createdAt).toISOString(),
          decidedAt: r.decidedAt ? new Date(r.decidedAt).toISOString() : null,
          item: {
            id: item.id,
            kind: item.kind,
            kindLabel: { BOOK: '書籍', UNIFORM: '校服', OTHER: '其他' }[item.kind] || '其他',
            title: item.title || '',
            detail: item.detail || null,
            status: item.status || 'AVAILABLE',
            ownerNickname: item.ownerNickname || '同學',
          },
        };
      });
    return Promise.resolve({ posted: posted, requests: requests });
  },

  createGiveaway(input) {
    const data = db();
    const body = input || {};
    if (!body.title || String(body.title).trim().length < 2) {
      return Promise.reject({ code: 'VALIDATION_FAILED', message: '標題至少 2 個字' });
    }
    if (body.imageUrl && !/^https?:\/\//i.test(String(body.imageUrl))) {
      return Promise.reject({ code: 'VALIDATION_FAILED', message: '圖片要填 http(s) 開頭的網址' });
    }
    const me = data.user || {};
    const item = {
      id: nextId('gv'),
      kind: body.kind || 'OTHER',
      title: String(body.title).trim(),
      body: body.body || '',
      condition: body.condition || 'GOOD',
      detail: body.detail || '',
      pickupPlace: body.pickupPlace || '',
      imageUrl: body.imageUrl || null,
      contactName: body.contactName || me.nickname || '',
      contactValue: body.contactValue || '',
      status: 'AVAILABLE',
      version: 0,
      ownerId: me.id,
      ownerNickname: me.nickname || '我',
      ownerClass: [me.grade, me.className].filter(Boolean).join(' '),
      createdAt: Date.now(),
    };
    data.giveaways = data.giveaways || [];
    data.giveaways.unshift(item);
    save(data);
    return Promise.resolve({ item: shapeGiveaway(data, item, { showContact: true }) });
  },

  updateGiveaway(id, input) {
    const data = db();
    const item = (data.giveaways || []).filter((g) => g.id === id)[0];
    if (!item) return Promise.reject({ code: 'NOT_FOUND', message: '找不到這件轉贈物品' });
    const me = data.user || {};
    const manager = ['STAFF', 'ADMIN', 'SUPER_ADMIN'].indexOf(me.role) !== -1;
    if (item.ownerId !== me.id && !manager) {
      return Promise.reject({ code: 'FORBIDDEN', message: '只有物主可以修改這件轉贈' });
    }
    const patch = input || {};
    if (patch.version !== undefined && patch.version !== (item.version || 0)) {
      return Promise.reject({ code: 'CONFLICT', message: '這筆資料剛被別人改過，請重新載入後再儲存' });
    }
    ['kind', 'title', 'body', 'condition', 'detail', 'pickupPlace', 'imageUrl', 'contactName', 'contactValue'].forEach((k) => {
      if (patch[k] !== undefined) item[k] = patch[k];
    });
    item.version = (item.version || 0) + 1;
    save(data);
    return Promise.resolve({ item: shapeGiveaway(data, item, { showContact: true }) });
  },

  setGiveawayStatus(id, status) {
    const data = db();
    const item = (data.giveaways || []).filter((g) => g.id === id)[0];
    if (!item) return Promise.reject({ code: 'NOT_FOUND', message: '找不到這件轉贈物品' });
    const me = data.user || {};
    const manager = ['STAFF', 'ADMIN', 'SUPER_ADMIN'].indexOf(me.role) !== -1;
    if (item.ownerId !== me.id && !manager) {
      return Promise.reject({ code: 'FORBIDDEN', message: '只有物主可以下架這件轉贈' });
    }
    if (item.status === 'GIVEN') {
      return Promise.reject({ code: 'CONFLICT', message: '已贈出的物品不能再改狀態' });
    }
    item.status = status === 'CLOSED' ? 'CLOSED' : 'AVAILABLE';
    item.closedAt = item.status === 'CLOSED' ? Date.now() : null;
    item.version = (item.version || 0) + 1;
    save(data);
    return Promise.resolve({ ok: true, status: item.status });
  },

  requestGiveaway(id, message) {
    const data = db();
    const item = (data.giveaways || []).filter((g) => g.id === id)[0];
    if (!item) return Promise.reject({ code: 'NOT_FOUND', message: '找不到這件轉贈物品' });
    const me = data.user || {};
    if (item.ownerId === me.id) {
      return Promise.reject({ code: 'VALIDATION_FAILED', message: '這是你自己送出的物品' });
    }
    if (item.status !== 'AVAILABLE') {
      return Promise.reject({ code: 'CONFLICT', message: '這件物品已經有人領取或已下架' });
    }
    data.giveawayRequests = data.giveawayRequests || [];
    const existing = data.giveawayRequests.filter((r) => r.itemId === id && r.userId === me.id)[0];
    if (existing) {
      if (existing.status === 'PENDING') {
        return Promise.reject({ code: 'CONFLICT', message: '你已經申請過了，等物主回覆' });
      }
      if (existing.status === 'ACCEPTED') {
        return Promise.reject({ code: 'CONFLICT', message: '物主已經把這件物品留給你' });
      }
      existing.status = 'PENDING';
      existing.message = message || null;
      existing.decidedAt = null;
      existing.createdAt = Date.now();
      save(data);
      return Promise.resolve({ ok: true, requestId: existing.id });
    }
    const row = { id: nextId('gr'), itemId: id, userId: me.id, message: message || null, status: 'PENDING', createdAt: Date.now(), decidedAt: null };
    data.giveawayRequests.push(row);
    save(data);
    return Promise.resolve({ ok: true, requestId: row.id });
  },

  cancelGiveawayRequest(id) {
    const data = db();
    const row = (data.giveawayRequests || []).filter((r) => r.id === id)[0];
    if (!row) return Promise.reject({ code: 'NOT_FOUND', message: '找不到這筆申請' });
    const me = data.user || {};
    if (row.userId !== me.id) return Promise.reject({ code: 'FORBIDDEN', message: '只能取消自己的申請' });
    if (row.status !== 'PENDING') return Promise.reject({ code: 'CONFLICT', message: '這筆申請已經處理過了' });
    row.status = 'CANCELLED';
    row.decidedAt = Date.now();
    save(data);
    return Promise.resolve({ ok: true });
  },

  decideGiveawayRequest(id, action) {
    const data = db();
    const row = (data.giveawayRequests || []).filter((r) => r.id === id)[0];
    if (!row) return Promise.reject({ code: 'NOT_FOUND', message: '找不到這筆申請' });
    const item = (data.giveaways || []).filter((g) => g.id === row.itemId)[0];
    if (!item) return Promise.reject({ code: 'NOT_FOUND', message: '找不到這件轉贈物品' });
    const me = data.user || {};
    const manager = ['STAFF', 'ADMIN', 'SUPER_ADMIN'].indexOf(me.role) !== -1;
    if (item.ownerId !== me.id && !manager) {
      return Promise.reject({ code: 'FORBIDDEN', message: '只有物主可以決定要給誰' });
    }
    if (row.status !== 'PENDING') return Promise.reject({ code: 'CONFLICT', message: '這筆申請已經處理過了' });
    if (item.status !== 'AVAILABLE') return Promise.reject({ code: 'CONFLICT', message: '這件物品已經不是可申請的狀態' });
    const now = Date.now();
    if (action === 'REJECT') {
      row.status = 'REJECTED';
      row.decidedAt = now;
      save(data);
      return Promise.resolve({ ok: true, action: 'REJECT' });
    }
    row.status = 'ACCEPTED';
    row.decidedAt = now;
    (data.giveawayRequests || []).forEach((r) => {
      if (r.itemId === item.id && r.id !== id && r.status === 'PENDING') {
        r.status = 'REJECTED';
        r.decidedAt = now;
      }
    });
    item.status = 'GIVEN';
    item.givenToId = row.userId;
    item.givenAt = now;
    item.version = (item.version || 0) + 1;
    save(data);
    return Promise.resolve({ ok: true, action: 'ACCEPT' });
  },

  // ── W-72 請假申請（示範層也寫得進，斷網演示時這個模組不能是死的）──
  myLeaves() {
    const data = db();
    const me = data.user || {};
    const rows = (data.leaves || []).filter((row) => row.studentId === me.id || row.createdById === me.id);
    const items = rows
      .slice()
      .sort((a, b) => String(b.from).localeCompare(String(a.from)))
      .map((row) => shapeLeave(row, me));
    return Promise.resolve({
      items: items,
      pending: items.filter((row) => row.status === 'PENDING').length,
      approved: items.filter((row) => row.status === 'APPROVED').length,
      studentName: me.nickname || null,
    });
  },

  createLeave(input) {
    const data = db();
    const me = data.user || {};
    const body = input || {};
    const from = body.fromDate || '';
    const to = body.toDate || '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return Promise.reject({ code: 'VALIDATION_FAILED', message: '日期格式要是 2026-11-12' });
    }
    if (from > to) return Promise.reject({ code: 'VALIDATION_FAILED', message: '結束日期不能早於開始日期' });
    if (!String(body.reason || '').trim()) {
      return Promise.reject({ code: 'VALIDATION_FAILED', message: '請簡單寫一下原因' });
    }
    const clash = (data.leaves || []).filter(
      (row) =>
        row.studentId === me.id &&
        (row.status === 'PENDING' || row.status === 'APPROVED') &&
        row.from <= to &&
        row.to >= from,
    )[0];
    if (clash) {
      return Promise.reject({ code: 'CONFLICT', message: '這段日期已經有一張假單了' });
    }
    const row = {
      id: 'lv' + Date.now(),
      studentId: me.id,
      createdById: me.id,
      kind: body.kind || 'SICK',
      from: from,
      to: to,
      reason: String(body.reason).trim(),
      attachmentUrl: body.attachmentUrl || null,
      status: 'PENDING',
      rejectReason: null,
      reviewedAt: null,
      createdAt: Date.now(),
    };
    data.leaves = (data.leaves || []).concat([row]);
    save(data);
    return Promise.resolve({ leave: shapeLeave(row, me) });
  },

  cancelLeave(id) {
    const data = db();
    const me = data.user || {};
    const row = (data.leaves || []).filter((x) => x.id === id)[0];
    if (!row) return Promise.reject({ code: 'NOT_FOUND', message: '找不到這張假單' });
    if (row.studentId !== me.id && row.createdById !== me.id) {
      return Promise.reject({ code: 'FORBIDDEN', message: '只能取消自己的假單' });
    }
    if (row.status !== 'PENDING') return Promise.reject({ code: 'CONFLICT', message: '這張假單已經處理過了' });
    row.status = 'CANCELLED';
    save(data);
    return Promise.resolve({ ok: true, status: 'CANCELLED' });
  },

  adminLeaves(query) {
    const data = db();
    const me = data.user || {};
    const manager = ['TEACHER', 'STAFF', 'ADMIN', 'SUPER_ADMIN'].indexOf(me.role) !== -1;
    if (!manager) return Promise.reject({ code: 'FORBIDDEN', message: '權限不足' });
    const q = query || {};
    const status = q.status || 'PENDING';
    const rows = (data.leaves || []).filter((row) => (status === 'ALL' ? true : row.status === status));
    const counts = { PENDING: 0, APPROVED: 0, REJECTED: 0, CANCELLED: 0 };
    (data.leaves || []).forEach((row) => {
      counts[row.status] = (counts[row.status] || 0) + 1;
    });
    const items = rows
      .slice()
      .sort((a, b) =>
        status === 'PENDING'
          ? String(a.from).localeCompare(String(b.from))
          : Number(b.reviewedAt || b.createdAt) - Number(a.reviewedAt || a.createdAt),
      )
      .map((row) => shapeLeave(row, me));
    return Promise.resolve({ items: items, total: items.length, page: 1, counts: counts });
  },

  reviewLeave(id, body) {
    const data = db();
    const me = data.user || {};
    const manager = ['TEACHER', 'STAFF', 'ADMIN', 'SUPER_ADMIN'].indexOf(me.role) !== -1;
    if (!manager) return Promise.reject({ code: 'FORBIDDEN', message: '權限不足' });
    const row = (data.leaves || []).filter((x) => x.id === id)[0];
    if (!row) return Promise.reject({ code: 'NOT_FOUND', message: '找不到這張假單' });
    if (row.status !== 'PENDING') return Promise.reject({ code: 'CONFLICT', message: '這張假單已經處理過了' });
    const action = (body && body.action) || 'APPROVE';
    const reason = String((body && body.reason) || '').trim();
    if (action === 'REJECT' && !reason) {
      return Promise.reject({ code: 'VALIDATION_FAILED', message: '駁回要寫原因，家長才知道怎麼補' });
    }
    row.status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    row.rejectReason = action === 'REJECT' ? reason : null;
    row.reviewedAt = Date.now();
    row.reviewedBy = { id: me.id, nickname: me.nickname || '老師' };
    save(data);
    return Promise.resolve({ leave: shapeLeave(row, me) });
  },
};
