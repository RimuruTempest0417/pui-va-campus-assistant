const data = require('../../../services/data');
const request = require('../../../utils/request');
const i18n = require('../../../utils/i18n');
const appearance = require('../../../utils/appearance');
const venue = require('../../../utils/venue');

Page({
  labels() {
    return {
      k01: i18n.pick('場地資料'),
      k02: i18n.pick('開放時間'),
      k03: i18n.pick('位置'),
      k04: i18n.pick('一次最長'),
      k05: i18n.pick('說明'),
      k06: i18n.pick('預約時段'),
      k07: i18n.pick('日期'),
      k08: i18n.pick('開始'),
      k09: i18n.pick('結束'),
      k10: i18n.pick('用途'),
      k11: i18n.pick('例如：物理科分組實驗'),
      k12: i18n.pick('送出申請'),
      k13: i18n.pick('送出中…'),
      k14: i18n.pick('已送出，等老師批准'),
      k15: i18n.pick('借用成功'),
      k16: i18n.pick('已取消申請'),
      k17: i18n.pick('請先登入才能申請'),
      k18: i18n.pick('已有時段被預約'),
      k19: i18n.pick('目前沒有人預約'),
      k20: i18n.pick('載入失敗'),
      k21: i18n.pick('重試'),
      k22: i18n.pick('我的申請'),
      k23: i18n.pick('取消申請'),
      k24: i18n.pick('待審批'),
      k25: i18n.pick('已批准'),
      k26: i18n.pick('需老師批准'),
      k27: i18n.pick('免審批，送出即生效'),
      k28: i18n.pick('未通過原因'),
      k29: i18n.pick('這個時段會被佔用'),
      k30: i18n.pick('請選開始與結束時間'),
      k31: i18n.pick('結束要晚於開始'),
      k32: i18n.pick('超過最長借用時數'),
      k33: i18n.pick('請填寫用途'),
      k34: i18n.pick('小時'),
      k35: i18n.pick('最近 14 天'),
      k36: i18n.pick('不能預約已經過去的時段'),
      k37: i18n.pick('送出'),
      k38: i18n.pick('借用規則'),
      k39: i18n.pick('場'),
      k40: i18n.pick('器'),
    };
  },

  data: {
    themeClass: appearance.themeClass(),
    loading: true,
    failed: false,
    errorText: '',
    id: '',
    resource: null,
    bookings: [],
    mine: [],
    canBook: false,
    canApprove: false,
    canManage: false,
    dateValue: '',
    dateLabel: '',
    dateLabels: [],
    dateIndex: 0,
    startIndex: 0,
    endIndex: 1,
    startLabels: [],
    endLabels: [],
    startValue: '',
    endValue: '',
    purpose: '',
    durationText: '',
    submitting: false,
    formHint: '',
    L: {},
  },

  onLoad(q) {
    this.setData({ L: this.labels(), id: (q && q.id) || '' });
    this.load();
  },

  onShow() {
    this.setData({ L: this.labels(), themeClass: appearance.themeClass() });
    if (this._loadedOnce) this.load();
    this._loadedOnce = true;
  },

  async load() {
    if (!this.data.id) {
      this.setData({ loading: false, failed: true, errorText: i18n.pick('找不到這個場地或器材') });
      return;
    }
    try {
      const res = await data.getResource(this.data.id);
      const resource = venue.shapeResource(res.resource, Date.now());
      resource.kindMark = res.resource.kind === 'EQUIPMENT' ? this.data.L.k40 : this.data.L.k39;
      this.setData({
        loading: false,
        failed: false,
        errorText: '',
        resource: resource,
        bookings: (res.bookings || []).map((b) => venue.shapeBooking(b, Date.now())),
        mine: (res.mine || []).map((b) => venue.shapeBooking(b, Date.now())),
        canBook: !!res.canBook,
        canApprove: !!res.canApprove,
        canManage: !!res.canManage,
      });
      if (!this.data.dateValue) this.initForm(resource);
      else this.rebuildEnds();
    } catch (e) {
      this.setData({ loading: false, failed: !this.data.resource, errorText: data.messageOf(e) });
    }
  },

  /** 預設：明天、資源開放時間的整點開始、一小時後結束 */
  initForm(resource) {
    const options = venue.dateOptions(14);
    const day = options.length > 1 ? options[1] : options[0];
    const from = resource ? resource.openFrom : '08:00';
    const to = resource ? resource.openTo : '18:00';
    const slots = this.buildSlots(from, to);
    const startIdx = Math.max(0, slots.findIndex((s) => s >= from));
    const startValue = slots[startIdx] || from;
    const ends = this.buildEnds(slots, startValue, to);
    this.setData({
      dateValue: day.value,
      dateLabel: day.label,
      dateLabels: options.map((o) => o.label),
      dateIndex: options.length > 1 ? 1 : 0,
      startLabels: slots.slice(0, slots.length - 1),
      startIndex: startIdx,
      startValue: startValue,
      endLabels: ends.slice(0, Math.min(ends.length, (resource ? resource.maxHours : 4) * 2)),
      endIndex: Math.min(1, Math.max(0, ends.length - 1)),
      endValue: ends[Math.min(1, ends.length - 1)] || to,
    });
    this.syncDuration();
  },

  /** 30 分鐘步進的時刻表（HH:mm），含關閉時間本身 */
  buildSlots(from, to) {
    const toMin = (t) => {
      const p = String(t).split(':').map(Number);
      return p[0] * 60 + p[1];
    };
    const out = [];
    for (let m = toMin(from); m <= toMin(to); m += 30) out.push(venue.hhmm(m));
    return out;
  },

  /** 結束時間只能晚於開始，且不能超過關閉時間 */
  buildEnds(slots, startValue, to) {
    return slots.filter((t) => t > startValue && t <= to);
  },

  rebuildEnds() {
    const resource = this.data.resource;
    if (!resource) return;
    const slots = this.buildSlots(resource.openFrom, resource.openTo);
    const startValue = this.data.startValue || slots[0];
    const ends = this.buildEnds(slots, startValue, resource.openTo);
    const keep = ends.indexOf(this.data.endValue);
    const maxCount = resource.maxHours * 2;
    const labels = ends.slice(0, Math.min(ends.length, maxCount));
    const idx = keep >= 0 && keep < labels.length ? keep : Math.min(1, labels.length - 1);
    this.setData({
      startLabels: slots.slice(0, slots.length - 1),
      endLabels: labels,
      endIndex: Math.max(0, idx),
      endValue: labels[Math.max(0, idx)] || ends[0] || '',
    });
    this.syncDuration();
  },

  syncDuration() {
    const { startValue, endValue } = this.data;
    if (!startValue || !endValue) {
      this.setData({ durationText: '', formHint: this.data.L.k30 });
      return;
    }
    const toMin = (t) => {
      const p = String(t).split(':').map(Number);
      return p[0] * 60 + p[1];
    };
    const diff = toMin(endValue) - toMin(startValue);
    if (diff <= 0) {
      this.setData({ durationText: '', formHint: this.data.L.k31 });
      return;
    }
    const hours = Math.round((diff / 60) * 10) / 10;
    const max = this.data.resource ? this.data.resource.maxHours : 0;
    this.setData({
      durationText: hours + ' ' + this.data.L.k34,
      formHint: max && hours > max ? this.data.L.k32 : this.data.L.k29,
    });
  },

  onDateChange(e) {
    const options = venue.dateOptions(14);
    const idx = Number(e.detail.value) || 0;
    const day = options[idx] || options[0];
    this.setData({ dateValue: day.value, dateLabel: day.label, dateIndex: idx });
  },

  onStartChange(e) {
    const idx = Number(e.detail.value) || 0;
    this.setData({ startIndex: idx, startValue: this.data.startLabels[idx] });
    this.rebuildEnds();
  },

  onEndChange(e) {
    const idx = Number(e.detail.value) || 0;
    this.setData({ endIndex: idx, endValue: this.data.endLabels[idx] });
    this.syncDuration();
  },

  onPurposeInput(e) {
    this.setData({ purpose: e.detail.value });
  },

  async submit() {
    if (this.data.submitting) return;
    if (!request.getToken() && !data.isDemo()) {
      this.setData({ formHint: this.data.L.k17 });
      wx.showToast({ title: this.data.L.k17, icon: 'none' });
      return;
    }
    const { dateValue, startValue, endValue, purpose, resource } = this.data;
    if (!dateValue || !startValue || !endValue) {
      wx.showToast({ title: this.data.L.k30, icon: 'none' });
      return;
    }
    if (endValue <= startValue) {
      wx.showToast({ title: this.data.L.k31, icon: 'none' });
      return;
    }
    if (!purpose || purpose.trim().length < 2) {
      wx.showToast({ title: this.data.L.k33, icon: 'none' });
      return;
    }
    if (new Date(venue.slotIso(dateValue, startValue)).getTime() < Date.now() - 5 * 60000) {
      wx.showToast({ title: this.data.L.k36, icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      const res = await data.createResourceBooking(this.data.id, {
        startAt: venue.slotIso(dateValue, startValue),
        endAt: venue.slotIso(dateValue, endValue),
        purpose: purpose.trim(),
      });
      wx.showToast({ title: res.pending ? this.data.L.k14 : this.data.L.k15, icon: 'none' });
      this.setData({ purpose: '' });
      if (resource) this.initForm(resource);
      await this.load();
    } catch (e) {
      const msg = data.messageOf(e);
      wx.showModal({ title: i18n.pick('送不出去'), content: msg, showCancel: false });
    } finally {
      this.setData({ submitting: false });
    }
  },

  cancelBooking(e) {
    const id = e.currentTarget.dataset.id;
    const label = e.currentTarget.dataset.label || '';
    wx.showModal({
      title: this.data.L.k23,
      content: label,
      confirmText: i18n.pick('取消申請'),
      cancelText: i18n.pick('保留'),
      success: (res) => {
        if (!res.confirm) return;
        data
          .cancelResourceBooking(id)
          .then(() => {
            wx.showToast({ title: this.data.L.k16, icon: 'none' });
            this.load();
          })
          .catch((err) => wx.showModal({ title: i18n.pick('取消失敗'), content: data.messageOf(err), showCancel: false }));
      },
    });
  },

  retry() {
    this.load();
  },

  goMine() {
    wx.navigateTo({ url: '/pages/venues/mine/index' });
  },

  onShareAppMessage() {
    return {
      title: this.data.resource ? this.data.resource.name : i18n.pick('場地借用'),
      path: '/pages/venues/detail/index?id=' + this.data.id,
    };
  },
});
