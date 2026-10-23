const data = require('../../../services/data');
const { decorate } = require('../../../utils/event');
const subscribe = require('../../../utils/subscribe');

Page({
  data: {
    loading: true,
    submitting: false,
    ev: null,
    barText: '',
    barType: 'filled',
    barHint: '',
    barDisabled: false,
  },

  onLoad(query) {
    this.id = query.id;
    this.load();
  },

  async load() {
    try {
      const raw = await data.getEvent(this.id);
      const ev = decorate(raw);
      this.setData(Object.assign({ loading: false, ev: ev }, this.barFor(ev)));
    } catch (e) {
      this.setData({ loading: false, ev: null });
    }
  },

  barFor(ev) {
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
        const rec = await data.signupEvent(ev.id);
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
