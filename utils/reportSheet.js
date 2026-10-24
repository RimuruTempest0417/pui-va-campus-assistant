/**
 * 檢舉彈層：多個詳情頁共用（失物／公告／活動）
 * 用法：
 *   Page({ data: { ...reportSheet.data() }, ...reportSheet.methods('NOTICE', function () { return this.data.notice && this.data.notice.id; }), ... })
 */
const data = require('../services/data');
const request = require('./request');
const i18n = require('./i18n');

const REASONS = ['內容不實', '廣告或推銷', '不當或冒犯內容', '與校園無關'];

function data_() {
  return { reportOpen: false, reporting: false, reportReasons: REASONS.map((r) => i18n.pick(r)) };
}

function methods(targetType, idOf) {
  return {
    openReport() {
      if (!data.isDemo() && !request.getToken()) {
        wx.showToast({ title: i18n.pick('請先登入再檢舉'), icon: 'none' });
        return;
      }
      if (!idOf.call(this)) return;
      this.setData({ reportOpen: true });
    },

    closeReport() {
      this.setData({ reportOpen: false });
    },

    async pickReason(e) {
      const reason = e.currentTarget.dataset.reason;
      const id = idOf.call(this);
      if (!id || this.data.reporting) return;
      this.setData({ reporting: true });
      try {
        await data.createReport(targetType, id, reason);
        this.setData({ reportOpen: false });
        wx.showToast({ title: i18n.pick('已收到檢舉，謝謝'), icon: 'success' });
      } catch (err) {
        wx.showToast({ title: data.messageOf(err), icon: 'none' });
      } finally {
        this.setData({ reporting: false });
      }
    },
  };
}

module.exports = { data: data_, methods };
