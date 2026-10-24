const data = require('../../../services/data');
const { codeOf } = require('../../../utils/errors');
const { decorate } = require('../../../utils/event');
const subscribe = require('../../../utils/subscribe');

const reportSheet = require('../../../utils/reportSheet');

Page({
  ...reportSheet.methods('EVENT', function () { return this.data.ev && this.data.ev.id; }),

  data: {
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
