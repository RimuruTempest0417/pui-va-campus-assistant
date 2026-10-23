const data = require('../../../services/data');
const { dateTimeText } = require('../../../utils/date');

Page({
  data: {
    code: '',
    scanning: false,
    submitting: false,
    result: null,
    error: '',
  },

  onLoad(query) {
    // 允許從其他地方帶碼進來（例如老師把碼貼在群組）
    if (query && query.code) this.submitCode(query.code);
  },

  onInput(e) {
    const digits = String(e.detail.value || '').replace(/\D/g, '').slice(0, 6);
    this.setData({ code: digits, error: '' });
  },

  scan() {
    if (this.data.scanning) return;
    this.setData({ scanning: true, error: '' });
    wx.scanCode({
      scanType: ['qrCode'],
      success: (res) => {
        this.setData({ scanning: false });
        this.submitCode(res.result);
      },
      fail: (err) => {
        this.setData({ scanning: false });
        const msg = String((err && err.errMsg) || '');
        // 使用者自己按取消不是錯誤，不要在他眼前報紅
        if (msg.indexOf('cancel') === -1) {
          this.setData({ error: '開不到相機，請改用手動輸入 6 位簽到碼' });
        }
      },
    });
  },

  submit() {
    this.submitCode(this.data.code);
  },

  async submitCode(raw) {
    const code = String(raw || '').trim();
    if (!code || this.data.submitting) return;
    this.setData({ submitting: true, error: '' });
    try {
      const res = await data.checkin(code);
      this.setData({
        submitting: false,
        code: '',
        result: {
          title: res.title || '活動',
          eventId: res.eventId,
          already: !!res.already,
          whenText: dateTimeText(res.checkedInAt || Date.now()),
        },
      });
      wx.showToast({ title: res.already ? '已簽到過' : '簽到成功', icon: 'success' });
    } catch (e) {
      const msg = data.messageOf(e);
      this.setData({ submitting: false, error: msg });
      wx.showToast({ title: msg, icon: 'none' });
    }
  },

  goDetail() {
    const r = this.data.result;
    if (!r || !r.eventId) return;
    wx.navigateTo({ url: '/pages/events/detail/index?id=' + r.eventId });
  },

  again() {
    this.setData({ result: null, error: '' });
  },
});
