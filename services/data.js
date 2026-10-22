// 資料入口：頁面只 require 這支，不直接碰 api.js / mock.js
// 自動模式：有 API_BASE_URL 就先用真的；遇到網路類錯誤才落回示範資料，並在頁面上標示。
const config = require('../config/config');
const api = require('./api');
const mock = require('./mock');
const { codeOf, isNetworkish, messageOf } = require('../utils/errors');

let demoActive = false;

function isDemo() {
  if (config.DEMO_MODE === 'on') return true;
  if (config.DEMO_MODE === 'off') return false;
  if (!config.API_BASE_URL) return true;
  return demoActive;
}

async function call(name, args) {
  if (isDemo()) return mock[name].apply(null, args || []);
  try {
    return await api[name].apply(null, args || []);
  } catch (err) {
    if (config.DEMO_MODE === 'auto' && isNetworkish(err) && codeOf(err) !== 'UNAUTHORIZED') {
      demoActive = true;
      console.warn('[data] 後端不可用，已切換示範模式：' + codeOf(err));
      return mock[name].apply(null, args || []);
    }
    throw err;
  }
}

module.exports = {
  isDemo: isDemo,
  messageOf: messageOf,
  resetDemo: () => mock.reset(),
  login: (...a) => call('login', a),
  me: (...a) => call('me', a),
  listItems: (...a) => call('listItems', a),
  createItem: (...a) => call('createItem', a),
  getItem: (...a) => call('getItem', a),
  myItems: (...a) => call('myItems', a),
  updateItemStatus: (...a) => call('updateItemStatus', a),
  categories: (...a) => call('categories', a),
  claimItem: (...a) => call('claimItem', a),
  listEvents: (...a) => call('listEvents', a),
  signup: (...a) => call('signup', a),
  weekMenu: (...a) => call('weekMenu', a),
  rateDish: (...a) => call('rateDish', a),
  listNotices: (...a) => call('listNotices', a),
};
