#!/usr/bin/env node
/**
 * 測驗倒數與溫習計劃（W-69）的邏輯守門（不需要開發者工具）。
 *
 * 為什麼要有：這頁的答案不是「有沒有資料」而是「算得對不對」——
 * 倒數天數、抓日期的規則、每科平均與趨勢、溫習排序，任何一項錯了畫面都不會報錯，
 * 只會給出一個看起來很合理的錯誤答案。所以用固定輸入斷言輸出。
 *
 * 用法：node scripts/check-study.cjs
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const study = require(path.join(root, 'utils', 'study.js'));

let pass = 0;
const fails = [];

function check(name, ok, detail) {
  if (ok) pass += 1;
  else fails.push(name + (detail ? '：' + detail : ''));
}

function eq(name, got, want) {
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  check(name, a === b, '得到 ' + a + '，應為 ' + b);
}

const today = new Date(2026, 10, 6); // 2026-11-06（週五）

// ── ① 認不認得出「這是一場測驗」 ──
check('標題含「大測」算測驗', study.isExamTitle('化學大測'));
check('標題含「考試」算測驗', study.isExamTitle('期中考試時間表'));
check('簡體「测验」也算', study.isExamTitle('化学测验'));
check('校運會不算測驗', !study.isExamTitle('校運會報名'));
check('英文 contest／latest 不算（不做寬鬆比對）', !study.isExamTitle('contest latest news'));
check('空標題不算', !study.isExamTitle(''));

// ── ② 從文字抓日期 ──
eq('「11 月 3 日至 7 日」只抓 3 日（後面的 7 日沒有月份，不猜）',
  study.extractDates('11 月 3 日至 7 日為期中考試週。', today).map(study.dateKey),
  ['2026-11-03']);
eq('完整日期 2026-11-20 抓得到',
  study.extractDates('考試日期：2026-11-20', today).map(study.dateKey),
  ['2026-11-20']);
eq('2026/11/20 不會被斜線規則重複抓一次',
  study.extractDates('2026/11/20 化學測驗', today).map(study.dateKey),
  ['2026-11-20']);
eq('沒有年份、已過去的日期自動算下一年（1 月 5 日 → 2027）',
  study.extractDates('1 月 5 日補考', today).map(study.dateKey),
  ['2027-01-05']);
eq('不存在的日期（2 月 31 日）不抓',
  study.extractDates('2 月 31 日', today).map(study.dateKey),
  []);

// ── ③ 倒數清單 ──
const exams = study.upcomingExams(
  {
    events: [
      { id: 'e9', title: '化學測驗（第二次）', startAt: new Date(2026, 10, 10, 9, 0), location: '高二丙課室' },
      { id: 'e10', title: '校運會', startAt: new Date(2026, 10, 12, 8, 0) },
      { id: 'e11', title: '數學統測（已過去）', startAt: new Date(2026, 9, 20, 9, 0) },
    ],
    external: [{ id: 'x1', title: '英文測驗', date: '2026-11-07' }],
    notices: [
      { id: 'n2', title: '期中考試時間表', content: '11 月 20 日至 24 日為期中考試週' },
      { id: 'n3', title: '繳費通知', content: '11 月 20 日或之前繳費' },
    ],
  },
  today
);
eq('倒數依日期由近到遠、排除非測驗與已過去', exams.map((e) => e.date + ' ' + e.title), [
  '2026-11-07 英文測驗',
  '2026-11-10 化學測驗（第二次）',
  '2026-11-20 期中考試時間表',
]);
eq('天數算法：明天＝1、下週二＝4', exams.map((e) => e.daysLeft), [1, 4, 14]);
eq('活動場次帶得出時間', exams[1].time, '09:00');
eq('來源標記正確', exams.map((e) => e.source), ['school', 'event', 'notice']);

const dup = study.upcomingExams(
  {
    notices: [
      { id: 'n2', title: '期中考試時間表', content: '11 月 20 日開始' },
      { id: 'n4', title: '期中考試時間表（更正）', content: '11 月 20 日開始' },
    ],
  },
  today
);
check('同一天同一標題只算一次（兩則公告都提同一天時）', dup.length === 2, '得到 ' + dup.length + ' 筆');

const todayExam = study.upcomingExams({ external: [{ id: 'x2', title: '小測', date: '2026-11-06' }] }, today);
eq('今天的測驗天數是 0，不會被當成已過去', todayExam.map((e) => e.daysLeft), [0]);

const farExam = study.upcomingExams({ external: [{ id: 'x3', title: '模擬考', date: '2027-06-01' }] }, today);
eq('預設只列 4 個月內（更遠的不列，畫面上也不會出現）', farExam.length, 0);

// ── ④ 每科統計 ──
const stats = study.subjectStats([
  { courseName: '數學', score: 86, testDate: '2026-10-10', content: '函數與圖像' },
  { courseName: '數學', score: 74, testDate: '2026-10-20' },
  { courseName: '化學', score: 100.5, testDate: '2026-10-09', content: '原子結構' },
  { courseName: '中文', score: 78.5, testDate: '2026-10-12' },
  { courseName: '物理', score: null, testDate: '2026-10-12' },
  { courseName: '', score: 60, testDate: '2026-10-12' },
]);
eq('沒有分數／沒有科目的紀錄不算一科', stats.map((s) => s.course).sort(), ['中文', '化學', '數學']);
const math = stats.filter((s) => s.course === '數學')[0];
eq('數學平均 80（(86+74)/2）', math.average, 80);
eq('數學最近一次 74、與上次差 −12、趨勢 down', [math.latest, math.delta, math.trend], [74, -12, 'down']);
eq('數學最高／最低', [math.best, math.worst], [86, 74]);
const chem = stats.filter((s) => s.course === '化學')[0];
eq('只有一次成績時趨勢是 none（不是 flat）', [chem.count, chem.trend, chem.delta], [1, 'none', null]);
eq('保留上次考的範圍（溫習時要知道讀哪一章）', chem.latestContent, '原子結構');

// ── ⑤ 科目對應與溫習排序 ──
eq('標題裡的科目：取最長的相符科目名', study.matchCourse('高等數學統測', ['數學', '高等數學']), '高等數學');
eq('標題沒有科目名就回空字串', study.matchCourse('期中考試時間表', ['數學']), '');

const plan = study.plan(stats, []);
eq('沒有臨近測驗時，最近明顯下滑的科目排前（數學）', plan.map((p) => p.course)[0], '數學');
check('每列都有 why 陣列（畫面要說得出為什麼）', plan.every((p) => Array.isArray(p.why)));
check('數學標記下滑', plan.filter((p) => p.course === '數學')[0].why.indexOf('down') !== -1);
const plan2 = study.plan(stats, [
  { title: '化學測驗（第二次）', daysLeft: 2, date: '2026-11-08', source: 'event', id: 'e9' },
]);
eq('兩天後考化學時，化學排到最前（考期比平均分重要）', plan2[0].course, '化學');
eq('該列帶得出「幾天後考」', plan2[0].examInDays, 2);
const noExam = study.plan(study.subjectStats([{ courseName: '歷史', score: 55, testDate: '2026-10-01' }]), []);
check('沒有測驗也能排序（低分科目有 why=low）', noExam[0].why.indexOf('low') !== -1);

// ── ⑥ 頁面與資料層真的有接上（端點存在 ≠ 功能可用）──
{
  const pageJs = fs.readFileSync(path.join(root, 'pages', 'study', 'index.js'), 'utf8');
  const wxml = fs.readFileSync(path.join(root, 'pages', 'study', 'index.wxml'), 'utf8');
  const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
  const homeJs = fs.readFileSync(path.join(root, 'pages', 'index', 'index.js'), 'utf8');

  check('頁面已登記到 app.json', appJson.pages.indexOf('pages/study/index') !== -1);
  check('頁面用既有校曆端點（data.calendar）', pageJs.indexOf('data.calendar()') !== -1);
  check('頁面用既有外部校曆端點（data.externalCalendar）', pageJs.indexOf('externalCalendar(') !== -1);
  check('頁面讀自己的成績（data.schoolGrades）', pageJs.indexOf('data.schoolGrades()') !== -1);
  check('頁面讀子女成績（data.parentChildGrades）', pageJs.indexOf('data.parentChildGrades(') !== -1);
  check('WXML 有倒數與溫習兩段', wxml.indexOf('exams') !== -1 && wxml.indexOf('subjects') !== -1);
  check('首頁有入口（goStudy）', homeJs.indexOf("url: '/pages/study/index'") !== -1);
  check('首頁副標用同一支推算（不另寫一套）', homeJs.indexOf('study.upcomingExams(') !== -1);
}

if (fails.length) {
  console.log('❌ 測驗倒數／溫習計劃：' + fails.length + ' 項失敗（通過 ' + pass + ' 項）');
  fails.forEach((f) => console.log('  ✗ ' + f));
  process.exit(1);
}
console.log('✅ 測驗倒數與溫習計劃：' + pass + ' 項全部通過');
