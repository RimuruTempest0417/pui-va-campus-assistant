// 訂閱消息：先問使用者要不要收，只有按「允許」的才在後端有記錄
const config = require('../config/config');
const data = require('../services/data');

/**
 * scene: claim / event / notice
 * 模板 ID 沒填就直接跳過（不彈窗、不報錯），功能照常。
 */
function request(scene) {
  const templates = config.SUBSCRIBE_TEMPLATES || {};
  const id = templates[scene];
  if (!id) return Promise.resolve({ skipped: true });

  return new Promise((resolve) => {
    wx.requestSubscribeMessage({
      tmplIds: [id],
      success: (res) => resolve(res),
      fail: () => resolve({}),
    });
  }).then((res) => {
    if (!res || res[id] !== 'accept') return { accepted: false };
    return data.subscribe([id], scene).then(() => ({ accepted: true }));
  });
}

module.exports = { request };
