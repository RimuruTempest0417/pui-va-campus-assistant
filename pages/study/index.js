const data = require('../../services/data');
const request = require('../../utils/request');
const i18n = require('../../utils/i18n');
const study = require('../../utils/study');
const week = require('../../utils/week');
const appearance = require('../../utils/appearance');

/**
 * 測驗倒數與溫習計劃（W-69）。
 *
 * 倒數：校曆（活動／外部 ICS／公告文字裡的日期）→ utils/study.upcomingExams
 * 溫習：成績（學生讀自己、家長讀子女）→ utils/study.subjectStats + plan
 * 兩者都是既有端點，沒有新 API、沒有外部服務。
 *
 * 「本週已溫」只存在本機 storage（pv_study_done），每週一自動重新開始；
 * 不寫後端是因為它不是成績或出缺席那種需要老師看的資料。
 */

const DONE_KEY = 'pv_study_done';

/** 本週一到現在為止的 key（換週就自動重來，不必使用者手動清） */
function currentWeekKey() {
  try {
    return week.dateKey(week.mondayOf(0));
  } catch (e) {
    return '';
  }
}

function readDone() {
  try {
    const v = wx.getStorageSync(DONE_KEY) || null;
    if (!v || v.week !== currentWeekKey() || !(v.courses instanceof Array)) return [];
    return v.courses;
  } catch (e) {
    return [];
  }
}

function writeDone(courses) {
  try {
    wx.setStorageSync(DONE_KEY, { week: currentWeekKey(), courses: courses });
  } catch (e) {
    // storage 失敗只影響勾選記憶，不擋畫面
  }
}

Page({
  labels() {
    return {
      k01: i18n.pick('測驗倒數'),
      k02: i18n.pick('接下來的測驗'),
      k03: i18n.pick('校曆裡還沒有測驗'),
      k04: i18n.pick('老師在校曆加入標題含「測驗」或「考試」的活動、或把考試日期寫進公告，這裡就會自動倒數。'),
      k05: i18n.pick('快到了'),
      k06: i18n.pick('溫習建議'),
      k07: i18n.pick('還沒有成績資料'),
      k08: i18n.pick('先到「成績與出缺席」按一次同步，這裡就會依你的成績排溫習順序。'),
      k09: i18n.pick('排序只用你自己的成績與校曆推算，不接任何外部服務。'),
      k10: i18n.pick('載入失敗'),
      k11: i18n.pick('重試'),
      k12: i18n.pick('請先登入'),
      k13: i18n.pick('溫習建議要用你自己的成績，所以要先登入。'),
      k14: i18n.pick('去登入'),
      k15: i18n.pick('今天'),
      k16: i18n.pick('明天'),
      k17: i18n.pick(' 天後'),
      k18: i18n.pick('先溫'),
      k19: i18n.pick('點一下標記已溫完'),
      k20: i18n.pick(' 月 '),
      k21: i18n.pick(' 日'),
      k22: i18n.pick('來自校曆'),
      k23: i18n.pick('來自活動'),
      k24: i18n.pick('來自公告'),
      k25: i18n.pick('已溫完 '),
      k26: i18n.pick(' 科'),
      k27: i18n.pick('平均 '),
      k28: i18n.pick(' 分'),
      k29: i18n.pick('最近一次進步 '),
      k30: i18n.pick('最近一次跌 '),
      k31: i18n.pick('最近一次與上次接近'),
      k32: i18n.pick('只有 1 次成績'),
      k33: i18n.pick('上次考：'),
      k34: i18n.pick(' 天後有這一科的測驗'),
      k35: i18n.pick('成績偏低'),
      k36: i18n.pick('很好，保持'),
      k37: i18n.pick('子女：'),
      k39: i18n.pick('這頁顯示最近 4 個月的測驗；更遠的考試不會列出來。'),
      k40: i18n.pick(' 次成績'),
    };
  },

  data: {
    themeClass: appearance.themeClass(),
    loading: true,
    refreshing: false,
    failed: false,
    errorText: '',
    needLogin: false,
    exams: [],
    subjects: [],
    doneCount: 0,
    totalCount: 0,
    childName: '',
    pressedKey: '',
  },

  onLoad() {
    this.setData({ L: this.labels() });
    this.load();
  },

  onShow() {
    this.setData({ L: this.labels(), themeClass: appearance.themeClass() });
    // 在成績頁同步完再回來，分數變了排序也要跟著變
    if (this._loadedOnce) this.load();
    this._loadedOnce = true;
  },

  async load() {
    this.setData({ loading: true, failed: false, errorText: '' });
    const today = new Date();
    try {
      const me = await data.me().catch(() => null);
      const role = (me && me.role) || '';
      const signedIn = !!(me || request.getToken());

      // 家校通同步與家長綁定都是既有端點：學生讀自己、家長讀第一位子女（家校通一個家長帳號只對應一位）
      let grades = null;
      let childName = '';
      if (role === 'PARENT') {
        const kids = await data.parentChildren().catch(() => ({ items: [] }));
        const kid = (kids.items || [])[0] || null;
        if (kid) {
          childName = kid.nickname || '';
          grades = await data.parentChildGrades(kid.studentId).catch(() => null);
        }
      } else if (signedIn) {
        grades = await data.schoolGrades().catch(() => null);
      }

      const year = today.getFullYear();
      const [cal, ext] = await Promise.all([
        data.calendar().catch(() => ({ notices: [], events: [] })),
        data
          .externalCalendar({ from: year - 1 + '-01-01', to: year + 1 + '-12-31' })
          .catch(() => ({ items: [] })),
      ]);

      const exams = study.upcomingExams(
        {
          events: (cal && cal.events) || [],
          notices: (cal && cal.notices) || [],
          external: (ext && ext.items) || [],
        },
        today
      );
      const subjects = study.subjectStats((grades && grades.items) || []);
      const plan = study.plan(subjects, exams);
      const done = readDone();
      this._plan = plan;

      this.setData({
        loading: false,
        failed: false,
        needLogin: !signedIn,
        childName: childName,
        exams: this.decorateExams(exams),
        subjects: this.decoratePlan(plan, done),
        doneCount: plan.filter((s) => done.indexOf(s.course) !== -1).length,
        totalCount: plan.length,
      });
    } catch (e) {
      console.error('[study] 載入失敗', e);
      this.setData({
        loading: false,
        failed: true,
        errorText: (data.messageOf && data.messageOf(e)) || this.data.L.k10,
      });
    }
  },

  /** 倒數列：用「今天／明天／N 天後」而不是冷冰冰的日期差 */
  decorateExams(exams) {
    const L = this.data.L || this.labels();
    return (exams || []).map((e) => {
      const d = e.date ? new Date(e.date + 'T00:00:00') : null;
      const ok = d && !isNaN(d.getTime());
      const when =
        e.daysLeft === 0 ? L.k15 : e.daysLeft === 1 ? L.k16 : e.daysLeft + L.k17;
      const dateText = ok ? d.getMonth() + 1 + L.k20 + d.getDate() + L.k21 : '';
      const sourceText =
        e.source === 'event' ? L.k23 : e.source === 'school' ? L.k22 : L.k24;
      const meta = [dateText, e.time || '', sourceText].filter((x) => !!x).join(' · ');
      return {
        id: e.source + '-' + e.date + '-' + e.title,
        title: e.title,
        daysLeft: e.daysLeft,
        whenText: when,
        metaText: meta,
        soon: e.daysLeft <= 3,
      };
    });
  },

  /** 溫習列：把排序理由寫成人看得懂的一句話（理由與趨勢分開，避免同一行重複兩次） */
  decoratePlan(plan, done) {
    const L = this.data.L || this.labels();
    return (plan || []).map((s, i) => {
      const trend =
        s.trend === 'up'
          ? L.k29 + Math.abs(s.delta) + L.k28
          : s.trend === 'down'
            ? L.k30 + Math.abs(s.delta) + L.k28
            : s.count > 1
              ? L.k31
              : L.k32;
      const reason =
        s.why.indexOf('exam') !== -1
          ? s.examInDays + L.k34
          : s.why.indexOf('low') !== -1
            ? L.k35
            : s.why.indexOf('solid') !== -1
              ? L.k36
              : '';
      return {
        course: s.course,
        order: i + 1,
        first: i === 0,
        done: done.indexOf(s.course) !== -1,
        avgText: L.k27 + s.average + L.k28,
        trendText: trend,
        reasonText: reason,
        lastText: s.latestContent ? L.k33 + s.latestContent : '',
        countText: s.count + L.k40,
      };
    });
  },

  retry() {
    this.load();
  },

  onRefresh() {
    this.setData({ refreshing: true });
    this.load().then(() => this.setData({ refreshing: false }));
  },

  // 按壓回饋用 touch 事件（Skyline 下 hover-class 不可靠）
  onTouchStart(e) {
    this.setData({ pressedKey: e.currentTarget.dataset.course || '' });
  },

  onTouchEnd() {
    if (this.data.pressedKey) this.setData({ pressedKey: '' });
  },

  /** 登入／登出都在設定頁（首頁右上角頭像也是它），這裡只負責帶過去 */
  goLogin() {
    wx.navigateTo({ url: '/pages/settings/index' });
  },

  onToggle(e) {
    const course = e.currentTarget.dataset.course;
    if (!course) return;
    const done = readDone();
    const idx = done.indexOf(course);
    if (idx === -1) done.push(course);
    else done.splice(idx, 1);
    writeDone(done);
    const plan = this._plan || [];
    this.setData({
      subjects: this.decoratePlan(plan, done),
      doneCount: plan.filter((s) => done.indexOf(s.course) !== -1).length,
      totalCount: plan.length,
    });
  },
});
