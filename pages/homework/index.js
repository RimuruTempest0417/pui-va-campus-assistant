const data = require('../../services/data');
const i18n = require('../../utils/i18n');
const appearance = require('../../utils/appearance');
const reporter = require('../../utils/reporter');

/**
 * 功課（W-76）
 *
 * 一頁做完學生每天要做的兩件事：看今天有什麼要交、交了就打勾。
 * 老師在同一頁多一顆「出功課」（後端能力 homework:create），
 * 不另開老師版頁面 —— 兩份清單一定會有一份忘記更新。
 *
 * 打勾是每人一列（後端 unique 鍵），所以連點兩下不會變成兩筆；
 * 逾期由後端算好（手機時間不準也不會標錯）。
 */

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

Page({
  labels() {
    return {
      k01: i18n.pick('功課'),
      k02: i18n.pick('未完成'),
      k03: i18n.pick('已完成'),
      k04: i18n.pick('全部'),
      k05: i18n.pick('未交'),
      k06: i18n.pick('逾期'),
      k07: i18n.pick('已交'),
      k08: i18n.pick('今天'),
      k09: i18n.pick('明天'),
      k10: i18n.pick('已逾期'),
      k11: i18n.pick('載入失敗'),
      k12: i18n.pick('重試'),
      k13: i18n.pick('載入中…'),
      k14: i18n.pick('沒有未完成的功課'),
      k15: i18n.pick('今天可以早點休息。'),
      k16: i18n.pick('還沒有打勾的功課'),
      k17: i18n.pick('打勾之後會出現在這裡。'),
      k18: i18n.pick('這一班還沒有功課'),
      k19: i18n.pick('老師派了功課就會出現在這裡。'),
      k20: i18n.pick('還沒有班級資料'),
      k21: i18n.pick('請找校務處在後台設定你的班級。'),
      k22: i18n.pick('請先登入'),
      k23: i18n.pick('登入後才看得到自己班上的功課。'),
      k24: i18n.pick('出功課'),
      k25: i18n.pick('科目'),
      k26: i18n.pick('要做什麼'),
      k27: i18n.pick('截止日期'),
      k28: i18n.pick('送出'),
      k29: i18n.pick('取消'),
      k30: i18n.pick('收回'),
      k31: i18n.pick('已收回這項功課'),
      k32: i18n.pick('請填科目與內容'),
      k33: i18n.pick('截止'),
      k34: i18n.pick('例：習作 4.2 第 1–10 題'),
      k35: i18n.pick('例：數學'),
      k36: i18n.pick('送出失敗'),
      k37: i18n.pick('班'),
      k38: i18n.pick(' 人交了'),
      k39: i18n.pick('未交'),
      // ── W-84 附件連結 ──
      k40: i18n.pick('附件連結（選填）'),
      k41: i18n.pick('一行一條，只收 http(s) 連結'),
      k42: i18n.pick('已複製連結'),
      k43: i18n.pick('附件'),
      k44: i18n.pick('連結要 http:// 或 https:// 開頭'),
      k45: i18n.pick('最多 5 條連結'),
    };
  },

  data: {
    themeClass: appearance.themeClass(),
    loading: true,
    needLogin: false,
    failed: false,
    errorText: '',
    className: '',
    needsClass: false,
    canCreate: false,
    scope: 'todo',
    items: [],
    stats: { total: 0, done: 0, todo: 0, overdue: 0 },
    pressedId: '',
    pendingId: '',
    pendingNames: '',
    formOpen: false,
    formSubject: '',
    formTitle: '',
    formDetail: '',
    formDue: '',
    formDueText: '',
    formLinks: '',
    saving: false,
    L: {},
  },

  onLoad() {
    this.setData({ L: this.labels(), formDue: this.tomorrow() });
    this.load();
  },

  onShow() {
    this.setData({ L: this.labels(), themeClass: appearance.themeClass() });
  },

  tomorrow() {
    const d = new Date(Date.now() + 24 * 3600 * 1000);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  },

  /** 截止時間顯示：今天／明天用相對說法，其餘寫月日 */
  dueText(iso, done) {
    const L = this.data.L;
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const hm = pad(d.getHours()) + ':' + pad(d.getMinutes());
    let dayText = d.getMonth() + 1 + '/' + d.getDate();
    if (day === today) dayText = L.k08 || '';
    else if (day === today + 24 * 3600 * 1000) dayText = L.k09 || '';
    return (done ? '' : (L.k33 || '') + ' ') + dayText + ' ' + hm;
  },

  async load() {
    this.setData({ loading: true, failed: false });
    try {
      const res = await data.listHomework({ scope: this.data.scope });
      // 老師：順便拿「幾個人交了」（一支端點回全部，不逐項打）
      const stats = res.canCreate ? await data.homeworkStats().catch(() => null) : null;
      const countById = {};
      if (stats && stats.items) stats.items.forEach((s) => { countById[s.id] = s; });
      const items = (res.items || []).map((item) => {
        const s = countById[item.id];
        const links = (item.links || []).map((l, i) => ({
          url: l.url,
          // 沒填名稱就給「附件 1／附件 2」，不要讓一整排網址在畫面上亂換行
          text: (l.name || '').trim() || (this.data.L.k43 || '') + ' ' + (i + 1),
        }));
        return Object.assign({}, item, {
          dueText: this.dueText(item.dueAt, item.done),
          dueBadge: item.overdue ? (this.data.L.k10 || '') : '',
          countText: s && stats.total ? s.done + '/' + stats.total : '',
          links: links,
        });
      });
      this.setData({
        loading: false,
        needLogin: false,
        className: res.className || '',
        needsClass: !!res.needsClass,
        canCreate: !!res.canCreate,
        items: items,
        stats: res.stats || { total: 0, done: 0, todo: 0, overdue: 0 },
      });
    } catch (e) {
      const code = (e && e.code) || '';
      if (code === 'UNAUTHORIZED' || code === 'NO_TOKEN') {
        this.setData({ loading: false, needLogin: true });
        return;
      }
      const msg = data.messageOf(e);
      reporter.reportError('[homework.load] ' + code + ' ' + msg);
      this.setData({ loading: false, failed: true, errorText: msg });
    }
  },

  switchScope(e) {
    const scope = e.currentTarget.dataset.key;
    if (scope === this.data.scope) return;
    this.setData({ scope: scope });
    this.load();
  },

  press(e) {
    this.setData({ pressedId: e.currentTarget.dataset.id });
  },

  release() {
    this.setData({ pressedId: '' });
  },

  /** 打勾／取消打勾：先動畫面（立刻有回饋），失敗再還原 */
  async toggle(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.items.filter((x) => x.id === id)[0];
    if (!item) return;
    const next = !item.done;
    const items = this.data.items.map((x) =>
      x.id === id
        ? Object.assign({}, x, {
          done: next,
          overdue: next ? false : x.overdue,
          dueText: this.dueText(x.dueAt, next),
          dueBadge: next ? '' : x.dueBadge,
        })
        : x,
    );
    const stats = Object.assign({}, this.data.stats, {
      done: this.data.stats.done + (next ? 1 : -1),
      todo: this.data.stats.todo + (next ? -1 : 1),
      overdue: this.data.stats.overdue + (!next && item.overdue ? 1 : 0) - (next && item.overdue ? 1 : 0),
    });
    this.setData({ items: items, stats: stats, pressedId: '' });
    try {
      if (next) await data.markHomework(id);
      else await data.unmarkHomework(id);
      wx.vibrateShort({ type: 'light' });
      if (this.data.scope !== 'all') this.load();
    } catch (err) {
      this.setData({ items: this.data.items, errorText: data.messageOf(err) });
      wx.showToast({ title: data.messageOf(err), icon: 'none' });
      this.load();
    }
  },

  openForm() {
    this.setData({ formOpen: true, formSubject: '', formTitle: '', formDetail: '', formLinks: '', formDue: this.tomorrow() });
  },

  closeForm() {
    this.setData({ formOpen: false });
  },

  onSubject(e) {
    this.setData({ formSubject: e.detail.value });
  },

  onTitle(e) {
    this.setData({ formTitle: e.detail.value });
  },

  onDetail(e) {
    this.setData({ formDetail: e.detail.value });
  },

  onDue(e) {
    this.setData({ formDue: e.detail.value });
  },

  onLinks(e) {
    this.setData({ formLinks: e.detail.value });
  },

  /**
   * 表單的「一行一條」→ `[{ url }]`。
   * 前端先擋一次是為了讓老師在彈層裡就看到原因；後端仍會再驗一次（前端不是閘門）。
   */
  parseLinks() {
    const L = this.data.L;
    const raw = String(this.data.formLinks || '')
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (raw.length > 5) return { error: L.k45 || '' };
    for (const url of raw) {
      if (!/^https?:\/\/[^\s]+$/i.test(url)) return { error: L.k44 || '' };
    }
    const seen = {};
    const links = [];
    for (const url of raw) {
      if (seen[url]) continue;
      seen[url] = true;
      links.push({ name: '', url: url });
    }
    return { links: links };
  },

  async submit() {
    const L = this.data.L;
    const subject = String(this.data.formSubject || '').trim();
    const title = String(this.data.formTitle || '').trim();
    if (!subject || !title) {
      wx.showToast({ title: L.k32 || '', icon: 'none' });
      return;
    }
    if (this.data.saving) return;
    const parsed = this.parseLinks();
    if (parsed.error) {
      wx.showToast({ title: parsed.error, icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    try {
      await data.createHomework({
        subject: subject,
        title: title,
        detail: this.data.formDetail,
        dueAt: this.data.formDue,
        links: parsed.links,
      });
      this.setData({ saving: false, formOpen: false });
      this.load();
    } catch (e) {
      this.setData({ saving: false });
      wx.showToast({ title: data.messageOf(e) || (L.k36 || ''), icon: 'none' });
    }
  },

  async remove(e) {
    const id = e.currentTarget.dataset.id;
    const L = this.data.L;
    wx.showModal({
      title: L.k30 || '',
      content: (e.currentTarget.dataset.title || '') ,
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await data.removeHomework(id);
          wx.showToast({ title: L.k31 || '', icon: 'success' });
          this.load();
        } catch (err) {
          wx.showToast({ title: data.messageOf(err), icon: 'none' });
        }
      },
    });
  },

  retry() {
    this.load();
  },

  /** 老師點「N/M 人交了」→ 展開未交名單（再點一次收起） */
  async openPending(e) {
    const id = e.currentTarget.dataset.id;
    if (this.data.pendingId === id) {
      this.setData({ pendingId: '', pendingNames: '' });
      return;
    }
    try {
      const res = await data.homeworkPending(id);
      const names = (res.pending || []).map((p) => p.nickname).join('、');
      this.setData({ pendingId: id, pendingNames: names });
    } catch (err) {
      wx.showToast({ title: data.messageOf(err), icon: 'none' });
    }
  },

  /** 附件連結：小程序沒有瀏覽器，一律複製讓他自己貼（與活動附件同一套做法） */
  copyLink(e) {
    const url = e.currentTarget.dataset.url || '';
    if (!url) return;
    wx.setClipboardData({
      data: url,
      success: () => wx.showToast({ title: this.data.L.k42 || '', icon: 'none' }),
    });
  },

  /** 彈層背景不讓內容跟著滾 */
  noop() {},

  goLogin() {
    wx.navigateTo({ url: '/pages/admin/login/index' });
  },
});
