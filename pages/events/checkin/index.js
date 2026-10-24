const data = require('../../../services/data');
const { dateTimeText } = require('../../../utils/date');

const i18n = require('../../utils/i18n');

const appearance = require('../../utils/appearance');

Page({
  labels() {
    return {
      k01: i18n.pick("現場簽到"),
      k02: i18n.pick("再簽一個"),
      k03: i18n.pick("查看活動"),
      k04: i18n.pick("掃描老師的簽到碼"),
      k05: i18n.pick("對準現場大屏或白板上的 QR，掃到就自動簽到。"),
      k06: i18n.pick("掃描簽到碼"),
      k07: i18n.pick("或手動輸入"),
      k08: i18n.pick("6 位簽到碼"),
      k09: i18n.pick("簽到"),
      k10: i18n.pick("只有「正取」可以簽到；候補請等轉正後再試。"),
    };
  },

  data: {
    themeClass: appearance.themeClass(),
    code: '',
    scanning: false,
    submitting: false,
    result: null,
    error: '',
  },

  onLoad(query) {
    this.setData({ L: this.labels(), themeClass: appearance.themeClass() });
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
