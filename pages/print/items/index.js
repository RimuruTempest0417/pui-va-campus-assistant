// 列印版 · 失物清單（A4 黑白）
// 用途：老師在教員室把「目前待認領的清單」印出來貼佈告欄。
// 版面刻意不用品牌色：白底、黑字、細灰線，影印後也看得清楚。
// 資料走 services/data.js（與失物列表同一支入口，示範模式也看得到）。
const data = require('../../../services/data');
const i18n = require('../../../utils/i18n');
const print = require('../../../utils/print');
const { TYPE_LABEL, STATUS_LABEL } = require('../../../utils/item');
const { dateKey } = require('../../../utils/date');

const STATUS_TABS = ['OPEN', 'CLAIMED', 'CLOSED', ''];

/** 毫秒數字與 ISO 字串都要吃得下（真 API 回 ISO，示範資料是數字） */
function dayOf(ts) {
  if (!ts) return '';
  const numeric = typeof ts === 'number' || /^\d+$/.test(String(ts));
  const d = new Date(numeric ? Number(ts) : ts);
  return isNaN(d.getTime()) ? '' : dateKey(d);
}

Page({
  labels() {
    return {
      title: i18n.pick('列印版 · 失物清單'),
      sheetTitle: i18n.pick('校園失物招領清單'),
      colNo: i18n.pick('編號'),
      colItem: i18n.pick('物品'),
      colType: i18n.pick('類別'),
      colPlace: i18n.pick('地點'),
      colDate: i18n.pick('日期'),
      colStatus: i18n.pick('狀態'),
      all: i18n.pick('全部'),
      preview: i18n.pick('列印預覽'),
      exitPreview: i18n.pick('退出預覽'),
      copy: i18n.pick('複製表格'),
      copied: i18n.pick('已複製，貼到 Word 或 Excel 就能列印'),
      failed: i18n.pick('載入失敗'),
      retry: i18n.pick('重試'),
      empty: i18n.pick('沒有符合的資料'),
      emptySub: i18n.pick('換一個狀態再試一次'),
      printedAt: i18n.pick('列印時間'),
      footNote: i18n.pick('培華校園助手 · 失物招領'),
      countUnit: i18n.pick(' 筆'),
      pageUnit: i18n.pick(' 頁'),
      total: i18n.pick('共'),
    };
  },

  data: {
    // 列印頁一律用淺色（紙永遠是白的）：不跟隨深色模式，否則印出來是黑底
    themeClass: 'theme-light',
    preview: false,
    loading: true,
    failed: false,
    errorText: '',
    status: 'OPEN',
    statusOptions: [],
    statusLabel: '',
    rows: [],
    pages: [],
    sheetH: 0,
    rowsPerPage: print.DEFAULT_ROWS,
    dateText: '',
  },

  onLoad(query) {
    const wanted = (query && query.status) || 'OPEN';
    const status = STATUS_TABS.indexOf(wanted) >= 0 ? wanted : 'OPEN';
    const L = this.labels();
    this.setData({
      L,
      status,
      statusOptions: STATUS_TABS.map((key) => ({
        key,
        label: key ? i18n.pick(STATUS_LABEL[key]) : L.all,
      })),
      dateText: dayOf(Date.now()),
    });
    this.load();
  },

  onShow() {
    this.setData({ L: this.labels() });
  },

  /** 印整份清單：超過一頁 API 上限（50）就連續抓，最多 200 筆（與後端 CSV 匯出同一個量級） */
  async fetchAll(status) {
    const out = [];
    for (let page = 1; page <= 4; page += 1) {
      const res = await data.listItems({
        status: status || undefined,
        page,
        pageSize: 50,
      });
      out.push.apply(out, res.items || []);
      if (!res.hasMore) break;
    }
    return out;
  },

  async load() {
    this.setData({ loading: true, failed: false, errorText: '' });
    try {
      const raw = await this.fetchAll(this.data.status);
      const L = this.labels();
      const rows = raw.map((it, i) => ({
        no: i + 1,
        title: it.title || '',
        type: i18n.pick(TYPE_LABEL[it.type] || ''),
        place: it.place || '',
        date: dayOf(it.happenedAt),
        status: i18n.pick(STATUS_LABEL[it.status] || '') || it.status || '',
      }));
      this.setData(
        {
          loading: false,
          rows,
          pages: print.paginate(rows, this.data.rowsPerPage),
          statusLabel: this.data.status ? i18n.pick(STATUS_LABEL[this.data.status]) : L.all,
        },
        () => this.scheduleMeasure(),
      );
    } catch (e) {
      this.setData({ loading: false, failed: true, errorText: data.messageOf(e), rows: [], pages: [] });
    }
  },

  retry() {
    return this.load();
  },

  pickStatus(e) {
    const key = e.currentTarget.dataset.key;
    if (key === this.data.status) return;
    this.setData({ status: key }, () => this.load());
  },

  togglePreview() {
    this.setData({ preview: !this.data.preview });
  },

  /**
   * 量紙張與列高：紙高由可用寬度乘 A4 比例推出來（不寫死 px，換機型才不會爆版），
   * 每頁列數再由紙高扣掉表頭／表尾算。量不到就維持預設列數，畫面照樣能看。
   */
  scheduleMeasure() {
    this.measure();
    // 第一次量測常拿到 null（setData 回呼比排版快）→ 沒量到紙高就再量一次
    if (!this.data.sheetH) setTimeout(() => this.measure(), 200);
  },

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
      this.setData({
        sheetH,
        rowsPerPage: per,
        pages: print.paginate(this.data.rows, per),
      });
    });
  },

  /** 手機沒有列印 API：複製成 Tab 分隔文字，貼進 Word／Excel 就是一張表 */
  copyTsv() {
    const L = this.labels();
    const header = [L.colNo, L.colItem, L.colType, L.colPlace, L.colDate, L.colStatus];
    const body = this.data.rows.map((r) => [r.no, r.title, r.type, r.place, r.date, r.status]);
    wx.setClipboardData({
      data: print.toTsv(header, body),
      success: () => wx.showToast({ title: L.copied, icon: 'none' }),
    });
  },
});
