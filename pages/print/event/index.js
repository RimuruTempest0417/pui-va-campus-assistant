// 列印版 · 活動報名名單（A4 黑白）
// 用途：活動當天在教員室印出席名單，現場點名用。
// 名單只能由教職員取得（後端 /admin/events/:id/signups 有 event:export 能力守衛），
// 所以這一頁一定會遇到「未登入／權限不足」，要各自給清楚的出口，不要只說「載入失敗」。
const data = require('../../../services/data');
const admin = require('../../../services/admin');
const i18n = require('../../../utils/i18n');
const print = require('../../../utils/print');
const { decorate } = require('../../../utils/event');
const { dateKey } = require('../../../utils/date');
const { codeOf } = require('../../../utils/errors');

const COLUMN_KEYS = ['colNo', 'colName', 'colGrade', 'colClass', 'colStatus', 'colTime'];

function dayOf(ts) {
  if (!ts) return '';
  const numeric = typeof ts === 'number' || /^\d+$/.test(String(ts));
  const d = new Date(numeric ? Number(ts) : ts);
  return isNaN(d.getTime()) ? '' : dateKey(d);
}

Page({
  labels() {
    return {
      title: i18n.pick('列印版 · 活動名單'),
      colNo: i18n.pick('序號'),
      colName: i18n.pick('姓名'),
      colGrade: i18n.pick('年級'),
      colClass: i18n.pick('班別'),
      colStatus: i18n.pick('狀態'),
      colTime: i18n.pick('報名時間'),
      confirmed: i18n.pick('正取'),
      waitlist: i18n.pick('候補'),
      unknownName: i18n.pick('未命名'),
      loginFirst: i18n.pick('請先登入教職員帳號'),
      loginSub: i18n.pick('活動名單只有教職員看得到'),
      goLogin: i18n.pick('去登入'),
      denied: i18n.pick('沒有權限'),
      deniedSub: i18n.pick('這個帳號沒有匯出報名名單的能力'),
      demoHint: i18n.pick('示範模式沒有後台名單，請用真 API 模式'),
      notFound: i18n.pick('找不到這個活動'),
      timeLabel: i18n.pick('時間'),
      placeLabel: i18n.pick('地點'),
      quotaLabel: i18n.pick('名額'),
      preview: i18n.pick('列印預覽'),
      exitPreview: i18n.pick('退出預覽'),
      copy: i18n.pick('複製表格'),
      copied: i18n.pick('已複製，貼到 Word 或 Excel 就能列印'),
      failed: i18n.pick('載入失敗'),
      retry: i18n.pick('重試'),
      empty: i18n.pick('還沒有人報名'),
      emptySub: i18n.pick('學生報名後這裡會出現名單'),
      printedAt: i18n.pick('列印時間'),
      footNote: i18n.pick('培華校園助手 · 活動名單'),
      countUnit: i18n.pick(' 人'),
      pageUnit: i18n.pick(' 頁'),
      total: i18n.pick('共'),
    };
  },

  data: {
    themeClass: 'theme-light', // 紙永遠是白的：列印頁不跟隨深色模式
    id: '',
    preview: false,
    loading: true,
    failed: false,
    state: '', // '' | 'guest' | 'denied' | 'demo' | 'notfound'
    errorText: '',
    eventTitle: '',
    eventMeta: '',
    rows: [],
    pages: [],
    sheetH: 0,
    rowsPerPage: print.DEFAULT_ROWS,
    dateText: '',
  },

  onLoad(query) {
    const id = (query && query.id) || '';
    this.setData({ L: this.labels(), id, dateText: dayOf(Date.now()) });
    if (!id) {
      this.setData({ loading: false, failed: true, state: 'notfound', errorText: this.labels().notFound });
      return;
    }
    this.load();
  },

  onShow() {
    this.setData({ L: this.labels() });
  },

  setState(state, errorText) {
    // guest／denied／demo 是「這頁不屬於你」或「示範模式」，不是載入失敗：
    // 讓畫面上的「重試」只出現在真的壞掉時（走查腳本也才不會把它算成 failed）
    const soft = state === 'guest' || state === 'denied' || state === 'demo';
    this.setData({ loading: false, failed: !soft, state, errorText: errorText || '' });
  },

  async load() {
    this.setData({ loading: true, failed: false, state: '', errorText: '' });
    if (data.isDemo()) {
      this.setState('demo', this.labels().demoHint);
      return;
    }
    try {
      const ev = await data.getEvent(this.data.id);
      const res = await admin.signups(this.data.id);
      const d = decorate(ev) || {};
      const L = this.labels();
      const rows = (res.items || []).map((r, i) => ({
        no: i + 1,
        name: r.nickname || L.unknownName,
        grade: r.grade || '',
        klass: r.className || '',
        status: r.status === 'CONFIRMED' ? L.confirmed : L.waitlist + (r.waitlistPos ? ' ' + r.waitlistPos : ''),
        time: dayOf(r.createdAt),
      }));
      const meta = [];
      if (d.timeText) meta.push(L.timeLabel + ' ' + d.timeText);
      if (d.location) meta.push(L.placeLabel + ' ' + d.location);
      if (d.capacityText) meta.push(L.quotaLabel + ' ' + d.capacityText);
      this.setData(
        {
          loading: false,
          eventTitle: d.title || '',
          eventMeta: meta.join('　'),
          rows,
          pages: print.paginate(rows, this.data.rowsPerPage),
        },
        () => this.scheduleMeasure(),
      );
    } catch (e) {
      const code = codeOf(e);
      if (code === 'UNAUTHORIZED' || code === 'UNAUTHENTICATED') this.setState('guest');
      else if (code === 'FORBIDDEN') this.setState('denied');
      else if (code === 'NOT_FOUND') this.setState('notfound', this.labels().notFound);
      else this.setState('', data.messageOf(e));
    }
  },

  retry() {
    return this.load();
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/admin/login/index' });
  },

  togglePreview() {
    this.setData({ preview: !this.data.preview });
  },

  scheduleMeasure() {
    this.measure();
    // 第一次量測常拿到 null（setData 回呼比排版快）→ 沒量到紙高就再量一次
    if (!this.data.sheetH) setTimeout(() => this.measure(), 200);
  },

  /**
   * 紙高由可用寬度乘 A4 比例推（不寫死 px），每頁列數再扣掉表頭／表尾算。
   * 量不到就維持預設列數——寧可列數多一點，也不要空白。
   */
  measure() {
    if (!this.data.rows.length) return;
    const q = wx.createSelectorQuery();
    // 用「紙」自己的寬度量（容器寬度含內距，會讓紙比 A4 高約 7%）
    q.select('.sheet').boundingClientRect();
    q.select('.sheet__head').boundingClientRect();
    q.select('.sheet__foot').boundingClientRect();
    q.select('.trow').boundingClientRect();
    q.exec((res) => {
      const paper = res && res[0];
      const head = res && res[1];
      const foot = res && res[2];
      const row = res && res[3];
      // 紙還沒排版好（量不到寬度）就不要動資料：亂改只會把已算好的列數打回預設
      if (!paper || !paper.width) return;
      const sheetH = print.sheetHeight(paper && paper.width);
      const per = print.rowsPerPage({
        sheetHeight: sheetH,
        headHeight: head && head.height,
        footHeight: foot && foot.height,
        rowHeight: row && row.height,
      });
      if (sheetH === this.data.sheetH && per === this.data.rowsPerPage) return;
      this.setData({ sheetH, rowsPerPage: per, pages: print.paginate(this.data.rows, per) });
    });
  },

  /** 手機沒有列印 API：複製成 Tab 分隔文字，貼進 Word／Excel 就是一張表 */
  copyTsv() {
    const L = this.labels();
    const header = COLUMN_KEYS.map((k) => L[k]);
    const body = this.data.rows.map((r) => [r.no, r.name, r.grade, r.klass, r.status, r.time]);
    wx.setClipboardData({
      data: print.toTsv(header, body),
      success: () => wx.showToast({ title: L.copied, icon: 'none' }),
    });
  },
});
