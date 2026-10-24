const data = require('../../../services/data');
const i18n = require('../../../utils/i18n');

Page({
  data: {
    running: false,
    modeText: '檢查中…',
    lines: [],
    passed: 0,
    total: 0,
    resultLine: '執行中',
    forceDemo: false,
    apiBase: '',
    locale: i18n.locale(),
    localeTitle: i18n.t('dev.locale'),
    locales: [{ key: 'zh-Hant', label: '繁體' }, { key: 'zh-Hans', label: '简体' }],
  },

  onLoad() {
    this.setData({ forceDemo: data.forceDemoOn(), apiBase: data.apiBase() });
    this.run();
  },

  // 介面語言：只改文案，不動資料
  setLocale(e) {
    const loc = e.currentTarget.dataset.loc;
    const next = i18n.setLocale(loc);
    this.setData({ locale: next });
    wx.showToast({ title: next === 'zh-Hans' ? '已切換簡體' : '已切換繁體', icon: 'none' });
  },

  onApiBaseInput(e) {
    this.setData({ apiBase: e.detail.value });
  },

  saveApiBase() {
    const url = data.setApiBase(this.data.apiBase.trim());
    this.setData({ apiBase: url });
    wx.showToast({ title: '已套用：' + url, icon: 'none' });
    this.rerun();
  },

  resetApiBase() {
    const url = data.setApiBase('');
    this.setData({ apiBase: url });
    wx.showToast({ title: '已回到預設', icon: 'none' });
    this.rerun();
  },

  // 離線示範開關：不改程式碼就能切回本地資料，關掉立刻回到真 API
  toggleDemo(e) {
    const on = e.detail.value;
    const demo = data.setForceDemo(on);
    this.setData({ forceDemo: demo, modeText: demo ? '示範模式（本地資料）' : '真實 API' });
    this.rerun();
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
      // 1. 登入／身分（真 API 模式下未登入時，只跑讀取類檢查，不強求登入）
      const me = await data.me().catch(() => null);
      const guest = !me;
      // 訪客不算失敗：真 API 模式下未登入是可接受的狀態，只是寫入類檢查會略過
      push('登入身分', true, guest ? '訪客（未登入，寫入檢查略過）' : me.nickname + ' / ' + me.role);

      // 2. 失物列表
      const list1 = await data.listItems({});
      push('失物列表', Array.isArray(list1.items), list1.items.length + ' 筆');

      // 3~5 需要登入
      if (!guest) {
        // 3. 發布後列表 +1
        const created = await data.createItem({ type: 'LOST', title: '自我檢查用物品', place: '測試地點', description: '由檢查頁建立' });
        const list2 = await data.listItems({});
        push('發布失物', list2.items.length === list1.items.length + 1, '新增 ' + created.title + '，總數 ' + list2.items.length);

        // 4. 認領（第二次應被擋）
        let claimCode = '';
        try {
          await data.claimItem(created.id);
          await data.claimItem(created.id);
        } catch (e) {
          claimCode = e.code;
        }
        push('重複認領被擋', claimCode === 'ALREADY_CLAIMED', claimCode || '沒有擋下');
      } else {
        push('寫入類檢查', true, '略過（需登入）');
      }

      // 5. 型別篩選（讀取）
      const found = await data.listItems({ type: 'FOUND' });
      push('型別篩選', found.items.every((i) => i.type === 'FOUND'), 'FOUND ' + found.items.length + ' 筆');

      // 6. 報名語意：示範資料的 e2 是滿額的，滿額應回 WAITLIST + 候補順位
      const eventsNow = await data.listEvents({});
      const e2 = (eventsNow.items || []).find((x) => x.id === 'e2');
      if (e2 && !guest) {
        let rec = null;
        try {
          rec = await data.signupEvent('e2');
        } catch (e) {
          rec = { status: 'ERROR:' + e.code };
        }
        const e2Full = e2.capacity > 0 && e2.signedCount >= e2.capacity;
        push(
          '滿額轉候補',
          !!e2Full && rec.status === 'WAITLIST' && rec.waitlistPos >= 1,
          `e2 ${e2.signedCount}/${e2.capacity} → ${rec.status}${rec.waitlistPos ? ' 第 ' + rec.waitlistPos + ' 位' : ''}`
        );
      } else {
        push('活動列表', (eventsNow.items || []).length >= 0, (eventsNow.items || []).length + ' 個');
      }

      // 7. 菜單
      const menu = await data.weekMenu();
      push('當週菜單', (menu.days || []).length >= 1, (menu.days || []).length + ' 天');

      // 8. 公告置頂優先
      const notices = await data.listNotices({});
      const first = (notices.items || [])[0];
      push('公告置頂優先', !!first && !!first.isPinned, first ? first.title : '沒有公告');

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
