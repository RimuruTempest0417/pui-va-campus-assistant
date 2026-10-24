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
            groups: ev.groups || [],
            pickedGroup: ev.myGroupKey || '',
          },
          this.barFor(ev),
        ),
      );
    } catch (e) {
      this.setData({
        loading: false,
        ev: null,
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
      return { barText: '選擇組別', barType: 'tinted', barHint: '這個活動需要先選組別', barDisabled: true };
    }
    if (ev.myStatus === 'CONFIRMED') {
      return { barText: '取消報名', barType: 'plain', barHint: '你已報名', barDisabled: false };
    }
    if (ev.myStatus === 'WAITLIST') {
      return { barText: '取消候補', barType: 'plain', barHint: '候補第 ' + ev.waitlistPos + ' 位', barDisabled: false };
    }
    if (ev.ended) return { barText: '已結束', barType: 'tinted', barHint: '', barDisabled: true };
    if (ev.full) return { barText: '排入候補', barType: 'tinted', barHint: '名額已滿', barDisabled: false };
    return { barText: '立即報名', barType: 'filled', barHint: '', barDisabled: false };
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
        wx.showToast({ title: '已取消', icon: 'success' });
      } else {
        await subscribe.request('event'); // 模板 ID 未填就自動跳過
        const rec = await data.signupEvent(ev.id, this.data.pickedGroup || null);
        if (rec.status === 'WAITLIST') {
          wx.showToast({ title: '已額滿，候補第 ' + rec.waitlistPos + ' 位', icon: 'none' });
        } else {
          wx.showToast({ title: '報名成功', icon: 'success' });
        }
      }
      await this.load();
    } catch (e) {
      wx.showToast({ title: data.messageOf(e), icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
