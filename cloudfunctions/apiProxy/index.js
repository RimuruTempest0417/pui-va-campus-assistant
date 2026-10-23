/**
 * 雲函數 apiProxy — 把小程序請求轉發到後端 API
 *
 * 為什麼要有它：微信正式版要求 request 域名完成 ICP 備案；走雲函數呼叫時，
 * 這一段是「伺服器對伺服器」，不受合法域名限制，所以不需要備案。
 *
 * 安全性：
 *   - 只轉發 /api/v1/ 開頭的路徑（白名單）
 *   - 只轉發 GET/POST/PATCH/DELETE
 *   - 後端仍然是唯一的權限判斷點（JWT + capability），這裡不做授權
 */
const https = require('https');
const { URL } = require('url');

const API_BASE = process.env.API_BASE || 'https://pui-va-campus-server.vercel.app';
const ALLOWED = ['GET', 'POST', 'PATCH', 'DELETE'];

function forward(path, method, data, token) {
  return new Promise((resolve) => {
    const target = new URL(path, API_BASE);
    const payload = method === 'GET' ? '' : JSON.stringify(data || {});
    const headers = { 'content-type': 'application/json' };
    if (token) headers.authorization = 'Bearer ' + token;
    if (payload) headers['content-length'] = Buffer.byteLength(payload);

    const req = https.request(
      {
        hostname: target.hostname,
        path: target.pathname + target.search,
        method: method,
        headers: headers,
        timeout: 15000,
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          let body = {};
          try {
            body = raw ? JSON.parse(raw) : {};
          } catch (e) {
            body = { error: { code: 'BAD_RESPONSE', message: raw.slice(0, 200) } };
          }
          resolve({ statusCode: res.statusCode || 500, body: body });
        });
      }
    );
    req.on('timeout', () => {
      req.destroy();
      resolve({ statusCode: 504, body: { error: { code: 'TIMEOUT', message: '後端逾時' } } });
    });
    req.on('error', (e) => {
      resolve({ statusCode: 502, body: { error: { code: 'NETWORK', message: String(e && e.message) } } });
    });
    if (payload) req.write(payload);
    req.end();
  });
}

exports.main = async (event) => {
  const path = String((event && event.path) || '');
  const method = String((event && event.method) || 'GET').toUpperCase();

  if (!path.startsWith('/api/v1/')) {
    return { statusCode: 400, body: { error: { code: 'BAD_PATH', message: '只接受 /api/v1/ 路徑' } } };
  }
  if (ALLOWED.indexOf(method) === -1) {
    return { statusCode: 405, body: { error: { code: 'BAD_METHOD', message: '不支援的方法' } } };
  }
  return forward(path, method, event.data, event.auth);
};
