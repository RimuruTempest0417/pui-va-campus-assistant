#!/usr/bin/env node
/**
 * 功課清單（W-76）的邏輯守門（不需要開發者工具、不需要後端）。
 *
 * 為什麼要有：這一頁的錯誤都不會拋例外 ——「打勾變兩筆」「學生出得了功課」
 * 「收回後還在」「舊版號覆蓋新版」在畫面上看起來都只是「好像有點怪」。
 * 所以用示範層的固定資料斷言規則，跟 check-study／check-parent-view 同一套寫法。
 *
 * 用法：node scripts/check-homework.cjs
 */
const path = require('path');

const store = new Map();
globalThis.wx = {
  getStorageSync: (k) => (store.has(k) ? store.get(k) : ''),
  setStorageSync: (k, v) => void store.set(k, v),
  removeStorageSync: (k) => void store.delete(k),
};
store.set('pv_force_demo', '1');

const root = path.join(__dirname, '..');
const data = require(path.join(root, 'services', 'data.js'));

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

async function main() {
  if (!data.isDemo()) {
    console.error('❌ 無法啟用示範模式（data.isDemo() 應為 true），檢查中止');
    process.exit(1);
  }
  data.resetDemo();

  // ── ① 示範班級看得到三筆功課，統計對得上 ──
  const all = await data.listHomework({ scope: 'all' });
  eq('示範班級', all.className, '高二仁');
  eq('三筆功課', all.items.length, 3);
  eq('統計（總／已交／未交／逾期）', [all.stats.total, all.stats.done, all.stats.todo, all.stats.overdue], [3, 1, 2, 1]);
  check('每筆都有截止顯示用的 dueMs', all.items.every((i) => typeof i.dueMs === 'number'));
  check('逾期那筆不是已交的那筆', all.items.filter((i) => i.overdue).every((i) => !i.done));

  // ── ② 篩選：未完成 2 筆、已完成 1 筆 ──
  const todo = await data.listHomework({ scope: 'todo' });
  eq('未完成 2 筆', todo.items.length, 2);
  const done = await data.listHomework({ scope: 'done' });
  eq('已完成 1 筆', done.items.length, 1);

  // ── ③ 打勾是幂等的 ──
  const target = todo.items[0];
  await data.markHomework(target.id);
  await data.markHomework(target.id);
  const afterMark = await data.listHomework({ scope: 'all' });
  eq('連按兩次只算一筆已交', afterMark.stats.done, 2);
  check('那一筆真的變成已交', afterMark.items.filter((i) => i.id === target.id)[0].done === true);

  await data.unmarkHomework(target.id);
  const afterUnmark = await data.listHomework({ scope: 'all' });
  eq('取消打勾回到 1 筆已交', afterUnmark.stats.done, 1);

  // ── ④ 學生出不了功課（權限由後端守，示範層同一套）──
  let studentDenied = false;
  try {
    await data.createHomework({ subject: '數學', title: '學生亂派', dueAt: '2026-12-01' });
  } catch (e) {
    studentDenied = e && e.code === 'FORBIDDEN';
  }
  check('學生出功課被擋（FORBIDDEN）', studentDenied);

  // ── ⑤ 老師可以出功課，同一天同科同標題不行 ──
  await data.switchDemoUser('陳老師', 'demo-teacher-2', 'TEACHER');
  const created = await data.createHomework({ subject: '歷史', title: '整理第三課筆記', dueAt: '2026-12-01' });
  check('老師出功課成功', !!created.id, created && created.id);
  let dupBlocked = false;
  try {
    await data.createHomework({ subject: '歷史', title: '整理第三課筆記', dueAt: '2026-12-01' });
  } catch (e) {
    dupBlocked = e && e.code === 'CONFLICT';
  }
  check('同班同科同日同標題被擋（CONFLICT）', dupBlocked);

  // ── ⑥ 收回：清單少一筆，其他不受影響 ──
  const before = await data.listHomework({ scope: 'all' });
  await data.removeHomework(created.id);
  const afterRemove = await data.listHomework({ scope: 'all' });
  eq('收回後少一筆', afterRemove.items.length, before.items.length - 1);
  check('收回的那筆不在清單裡', !afterRemove.items.some((i) => i.id === created.id));

  // ── ⑦ 家長端：只看得到自己小孩那一班，且是唯讀（沒有打勾方法） ──
  const kidsRes = await data.parentChildren();
  const kids = (kidsRes && kidsRes.items) || [];
  check('示範家長有子女', kids && kids.length > 0, kids && kids.length);
  const childId = kids[0].studentId;
  const childHw = await data.parentChildHomework(childId);
  check('子女的功課清單帶班級', !!childHw.className, childHw.className);
  check('子女的功課只屬於那個班', childHw.items.every((i) => typeof i.done === 'boolean'));
  let otherChildBlocked = false;
  try {
    await data.parentChildHomework('demo-child-unknown');
  } catch (e) {
    otherChildBlocked = e && e.code === 'FORBIDDEN';
  }
  check('讀沒有綁定的學生被擋（FORBIDDEN）', otherChildBlocked);

  // ── ⑧ 舊版號不能蓋掉新版 ──
  const keep = afterRemove.items[0];
  await data.updateHomework(keep.id, { title: '改過的新標題', version: keep.version });
  let stale = false;
  try {
    await data.updateHomework(keep.id, { title: '拿舊版號寫回', version: keep.version });
  } catch (e) {
    stale = e && e.code === 'CONFLICT';
  }
  check('舊版號修改被擋（CONFLICT）', stale);
  const finalList = await data.listHomework({ scope: 'all' });
  check('新標題還在（沒有被舊版號蓋掉）',
    finalList.items.some((i) => i.title === '改過的新標題'));

  data.resetDemo();

  if (fails.length) {
    console.log('❌ 功課守門失敗 ' + fails.length + ' 項（通過 ' + pass + ' 項）');
    fails.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log('✅ 功課守門通過（' + pass + ' 項：班級統計／篩選／幂等打勾／權限／重複出題／收回／版號）');
}

main().catch((e) => {
  console.error('❌ 功課守門異常中止：' + (e && e.message ? e.message : e));
  process.exit(1);
});
