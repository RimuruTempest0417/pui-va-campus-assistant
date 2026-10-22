const data = require('../../../services/data');

Page({
  data: {
    running: false,
    modeText: '檢查中…',
    lines: [],
    passed: 0,
    total: 0,
    resultLine: '執行中',
  },

  onLoad() {
    this.run();
  },

  rerun() {
    this.setData({ lines: [], passed: 0, total: 0, resultLine: '執行中' });
    this.run();
  },

  resetDemo() {
    data.resetDemo();
    this.utility = null;
    this.rerun();
  },

  async run() {
    // 併發鎖：連點會讓兩個檢查互相重置示範資料，導致「發布失物」「滿額轉候補」隨機失敗
    if (this.data.running) return;
    this.setData({ running: true });

    // 每次檢查都從乾淨的示範資料開始，避免「發布失物」把測試資料累積進交付狀態
    data.resetDemo();
    const lines = [];
    const push = (name, ok, value) => lines.push({ name: name, ok: ok, value: value });

    try {
      // 1. 登入／身分
      const me = await data.me();
      push('登入身分', !!me && !!me.nickname, me.nickname + ' / ' + me.role);

      // 2. 失物列表（示範資料應有 4 筆）
      const list1 = await data.listItems({});
      push('失物列表', list1.items.length >= 4, list1.items.length + ' 筆');

      // 3. 發布後列表 +1
      const created = await data.createItem({ type: 'LOST', title: '自我檢查用物品', place: '測試地點', description: '由檢查頁建立' });
      const list2 = await data.listItems({});
      push('發布失物', list2.items.length === list1.items.length + 1, '新增 ' + created.title + '，總數 ' + list2.items.length);

      // 4. 篩選：只看 FOUND
      const found = await data.listItems({ type: 'FOUND' });
      push('型別篩選', found.items.every((i) => i.type === 'FOUND'), 'FOUND ' + found.items.length + ' 筆');

      // 5. 認領（第二次應被擋，ALREADY_CLAIMED）
      await data.claimItem(created.id);
      let errorCode = '';
      try {
        await data.claimItem(created.id);
      } catch (e) {
        errorCode = e.code;
      }
      push('重複認領被擋', errorCode === 'ALREADY_CLAIMED', errorCode || '沒有擋下');

      // 6. 名額已滿 → 候補：先確認 e2 真的是滿的，再試報名
      const eventsNow = await data.listEvents({});
      const e2 = (eventsNow.items || []).find((x) => x.id === 'e2');
      const e2Full = e2 && e2.capacity > 0 && e2.signedCount >= e2.capacity;
      let full = '';
      try {
        await data.signup('e2');
      } catch (e) {
        full = e.code;
      }
      push('滿額轉候補', e2Full && full === 'EVENT_FULL', `e2 ${e2 ? e2.signedCount + '/' + e2.capacity : '不存在'} → ${full || '沒有擋下'}`);

      // 7. 菜單
      const menu = await data.weekMenu();
      push('當週菜單', menu.days.length >= 1, menu.days.length + ' 天');

      // 8. 公告置頂優先
      const notices = await data.listNotices();
      push('公告置頂優先', !!notices.items[0].isPinned, notices.items[0].title);

      // 9. 錯誤碼轉文案
      const msg = data.messageOf({ code: 'EVENT_FULL' });
      push('錯誤碼轉文案', msg.indexOf('候補') !== -1, msg);

      const passed = lines.filter((l) => l.ok).length;
      this.setData({
        lines: lines,
        passed: passed,
        total: lines.length,
        modeText: data.isDemo() ? '示範模式（本地資料）' : '真實 API',
        resultLine: passed === lines.length ? 'ALL PASS ' + passed + '/' + lines.length : 'FAIL ' + passed + '/' + lines.length,
      });
      // 檢查完把示範資料還原，交付狀態永遠是乾淨的 4 筆
      data.resetDemo();
    } catch (e) {
      this.setData({
        lines: lines,
        passed: 0,
        total: lines.length,
        resultLine: 'EXCEPTION ' + (e && (e.code || e.message)),
      });
    } finally {
      this.setData({ running: false });
    }
  },
});
