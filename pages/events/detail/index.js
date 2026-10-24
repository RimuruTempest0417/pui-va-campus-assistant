const data = require('../../../services/data');
const { codeOf } = require('../../../utils/errors');
const { decorate } = require('../../../utils/event');
const subscribe = require('../../../utils/subscribe');

const reportSheet = require('../../../utils/reportSheet');

const i18n = require('../../../utils/i18n');

const appearance = require('../../../utils/appearance');

Page({
  labels() {
    return {
      k16: i18n.pick("已結束"),
      k17: i18n.pick("已滿"),
      k18: i18n.pick("報名中"),
      k19: i18n.pick("剩 "),
      k20: i18n.pick(" 個名額"),
      k21: i18n.pick("已額滿，報名將自動排入候補"),
      k22: i18n.pick("主辦方沒有填寫說明"),
      k23: i18n.pick("已簽到"),
      k24: i18n.pick("未簽到"),
      k25: i18n.pick("出席紀錄已送出"),
      k26: i18n.pick("到現場掃老師的簽到碼"),
      k61: i18n.pick('組隊報名'),
      k62: i18n.pick('還沒有人建隊，你可以當第一個'),
      k63: i18n.pick('建立隊伍'),
      k64: i18n.pick('用邀請碼加入'),
      k65: i18n.pick('已選隊伍，邀請碼：'),
      k56: i18n.pick('活動回饋'),
      k57: i18n.pick('目前還沒有人評分，你可以當第一個'),
      k58: i18n.pick('想跟主辦說的話（可不填）'),
      k59: i18n.pick('送出回饋'),
      k60: i18n.pick('產生分享卡（存到相簿）'),
      k53: i18n.pick('這個活動已取消，名額與報名紀錄不再更新。'),
      k54: i18n.pick('活動改期：原定 '),
      k55: i18n.pick('，請留意新時間。'),
      k01: i18n.pick("活動詳情"),
      k02: i18n.pick("載入失敗"),
      k03: i18n.pick("重試"),
      k04: i18n.pick("找不到這個活動"),
      k05: i18n.pick("可能已取消或刪除"),
      k06: i18n.pick("時間"),
      k07: i18n.pick("地點"),
      k08: i18n.pick("名額"),
      k09: i18n.pick("活動說明"),
      k10: i18n.pick("組別"),
      k11: i18n.pick("報名前請先選一個組別"),
      k12: i18n.pick("你已報名成功，記得準時出席。"),
      k13: i18n.pick("去簽到"),
      k14: i18n.pick("檢舉"),
      k15: i18n.pick("檢舉這則內容"),
    };
  },

  ...reportSheet.methods('EVENT', function () { return this.data.ev && this.data.ev.id; }),

  data: {
    themeClass: appearance.themeClass(),
    ...reportSheet.data(),
    loading: true,
    submitting: false,
    ev: null,
    fb: { count: 0, avg: 0, items: [], mine: null },
    fbDraft: 5,
    fbComment: '',
    canFeedback: false,
    teams: [],
    pickedTeamCode: '',
    failed: false,
    errorText: '',
    barText: '',
    barType: 'filled',
    barHint: '',
    barDisabled: false,
    groups: [],
    pickedGroup: '',
  },

  onLoad(query) {
    this.setData({ L: this.labels(), themeClass: appearance.themeClass() });
    this.id = query.id;
    this.load();
  },

  async load() {
    try {
      const raw = await data.getEvent(this.id);
      const ev = decorate(raw);
      this.setData(
        Object.assign(
          {
            loading: false,
            failed: false,
            errorText: '',
            ev: ev,
            canFeedback: !!(ev.ended && (ev.myStatus === 'CONFIRMED' || (ev.mySignup && ev.mySignup.status === 'CONFIRMED'))),
            groups: ev.groups || [],
            pickedGroup: ev.myGroupKey || '',
          },
          this.barFor(ev),
        ),
      );
      if (ev.ended) this.loadFeedback();
      if (ev.teamsEnabled) this.loadTeams();
    } catch (e) {
      this.setData({
        loading: false,
        ev: null,
    fb: { count: 0, avg: 0, items: [], mine: null },
    fbDraft: 5,
    fbComment: '',
    canFeedback: false,
    teams: [],
    pickedTeamCode: '',
        pickedGroup: '',
        failed: codeOf(e) !== 'NOT_FOUND',
        errorText: data.messageOf(e),
      });
    }
  },

  retry() {
    this.setData({ loading: true, failed: false, errorText: '' });
    return this.load();
  },

  chooseGroup(e) {
    const picked = e.currentTarget.dataset.group;
    this.setData({ pickedGroup: picked });
    // 選了組別就要立刻重算底部按鈕（否則會一直是「選擇組別」且不可按）
    if (this.data.ev) this.setData(this.barFor(this.data.ev));
  },

  barFor(ev) {
    if (!ev.mySignup && (ev.groups || []).length && !this.data.pickedGroup) {
      return { barText: i18n.pick('選擇組別'), barType: 'tinted', barHint: i18n.pick('這個活動需要先選組別'), barDisabled: true };
    }
    if (ev.myStatus === 'CONFIRMED') {
      return { barText: i18n.pick('取消報名'), barType: 'plain', barHint: i18n.pick('你已報名'), barDisabled: false };
    }
    if (ev.myStatus === 'WAITLIST') {
      return { barText: i18n.pick('取消候補'), barType: 'plain', barHint: i18n.pick('候補第 ') + ev.waitlistPos + i18n.pick(' 位'), barDisabled: false };
    }
    if (ev.ended) return { barText: i18n.pick('已結束'), barType: 'tinted', barHint: '', barDisabled: true };
    if (ev.full) return { barText: i18n.pick('排入候補'), barType: 'tinted', barHint: i18n.pick('名額已滿'), barDisabled: false };
    return { barText: i18n.pick('立即報名'), barType: 'filled', barHint: '', barDisabled: false };
  },

  goCheckin() {
    wx.navigateTo({ url: '/pages/events/checkin/index' });
  },

  async onPrimary() {
    if (this.data.submitting) return;
    const ev = this.data.ev;
    this.setData({ submitting: true });

    try {
      if (ev.mySignup) {
        await data.cancelSignup(ev.id);
        wx.showToast({ title: i18n.pick('已取消'), icon: 'success' });
      } else {
        await subscribe.request('event'); // 模板 ID 未填就自動跳過
        const rec = await data.signupEvent(ev.id, this.data.pickedGroup || null, this.data.pickedTeamCode || null);
        if (rec.status === 'WAITLIST') {
          wx.showToast({ title: i18n.pick('已額滿，候補第 ') + rec.waitlistPos + i18n.pick(' 位'), icon: 'none' });
        } else {
          wx.showToast({ title: i18n.pick('報名成功'), icon: 'success' });
        }
      }
      await this.load();
    } catch (e) {
      wx.showToast({ title: data.messageOf(e), icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  loadFeedback() {
    data
      .eventFeedback(this.id)
      .then((fb) => this.setData({ fb, fbDraft: (fb.mine && fb.mine.rating) || 5, fbComment: (fb.mine && fb.mine.comment) || '', canFeedback: (this.data.canFeedback || !!fb.mine) && this.data.canFeedback ? true : this.data.canFeedback }))
      .catch(() => {});
  },

  pickStar(e) {
    this.setData({ fbDraft: Number(e.currentTarget.dataset.v) });
  },

  onFbInput(e) {
    this.setData({ fbComment: e.detail.value });
  },

  async submitFeedback() {
    try {
      await data.submitFeedback(this.id, this.data.fbDraft, this.data.fbComment.trim() || undefined);
      wx.showToast({ title: i18n.pick('已送出，謝謝你'), icon: 'success' });
      this.loadFeedback();
    } catch (e) {
      wx.showToast({ title: data.messageOf(e), icon: 'none' });
    }
  },

  /** W-32 分享卡：畫一張 600×800 的圖存到相簿 */
  makeShareCard() {
    const ev = this.data.ev;
    if (!ev) return;
    wx.createSelectorQuery()
      .select('#shareCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvas = res && res[0] && res[0].node;
        if (!canvas) return wx.showToast({ title: i18n.pick('這台裝置不支援'), icon: 'none' });
        const ctx = canvas.getContext('2d');
        const dpr = wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : 2;
        canvas.width = 600 * dpr;
        canvas.height = 800 * dpr;
        ctx.scale(dpr, dpr);

        ctx.fillStyle = theme.tint;
        ctx.fillRect(0, 0, 600, 800);
        ctx.fillStyle = theme.onTint;
        ctx.font = 'bold 34px sans-serif';
        ctx.fillText(i18n.pick('培華校園助手'), 48, 80);
        ctx.font = '20px sans-serif';
        ctx.fillStyle = theme.onTintSoft;
        ctx.fillText(ev.club || i18n.pick('校園活動'), 48, 116);

        ctx.fillStyle = theme.onTint;
        ctx.font = 'bold 42px sans-serif';
        const title = String(ev.title || '');
        const line1 = title.slice(0, 10);
        const line2 = title.slice(10, 20);
        ctx.fillText(line1, 48, 220);
        if (line2) ctx.fillText(line2, 48, 274);

        ctx.font = '24px sans-serif';
        ctx.fillStyle = theme.onTintSoft;
        ctx.fillText(i18n.pick('時間：') + (ev.timeText || ''), 48, 380);
        ctx.fillText(i18n.pick('地點：') + (ev.location || ''), 48, 424);
        ctx.fillText(i18n.pick('名額：') + (ev.capacityText || ''), 48, 468);

        ctx.font = '18px sans-serif';
        ctx.fillStyle = theme.onTintSoft;
        ctx.fillText(i18n.pick('用手機在小程序內報名 · ') + new Date().toLocaleDateString('zh-TW'), 48, 740);

        wx.canvasToTempFilePath({
          canvas,
          success: (r) => {
            wx.saveImageToPhotosAlbum({
              filePath: r.tempFilePath,
              success: () => wx.showToast({ title: i18n.pick('已存到相簿'), icon: 'success' }),
              fail: () => wx.showModal({ title: i18n.pick('需要相簿權限'), content: i18n.pick('請在設定開啟「儲存到相簿」後再試一次'), showCancel: false }),
            });
          },
          fail: () => wx.showToast({ title: i18n.pick('產生失敗'), icon: 'none' }),
        });
      });
  },

  loadTeams() {
    data
      .eventTeams(this.id)
      .then((r) => this.setData({ teams: (r && r.teams) || [] }))
      .catch(() => {});
  },

  /** 點自己隊伍的邀請碼 → 直接用這組碼報名 */
  useTeamCode(e) {
    const code = e.currentTarget.dataset.code;
    if (code) this.setData({ pickedTeamCode: code });
  },

  createTeam() {
    wx.showModal({
      title: i18n.pick('建立隊伍'),
      editable: true,
      placeholderText: i18n.pick('隊名，例如：3A 火箭隊'),
      success: async (r) => {
        if (!r.confirm || !r.content) return;
        try {
          const team = await data.createTeam(this.id, r.content.trim());
          this.setData({ pickedTeamCode: team.code });
          wx.showModal({ title: i18n.pick('隊伍已建立'), content: i18n.pick('邀請碼：') + team.code + i18n.pick('，可以按下方按鈕報名'), showCancel: false });
          this.loadTeams();
        } catch (err) {
          wx.showToast({ title: data.messageOf(err), icon: 'none' });
        }
      },
    });
  },

  joinByCode() {
    wx.showModal({
      title: i18n.pick('輸入邀請碼'),
      editable: true,
      placeholderText: 'ABC123',
      success: (r) => {
        if (!r.confirm || !r.content) return;
        this.setData({ pickedTeamCode: r.content.trim().toUpperCase() });
        wx.showToast({ title: i18n.pick('已選隊伍，接著按報名'), icon: 'none' });
      },
    });
  },
});
