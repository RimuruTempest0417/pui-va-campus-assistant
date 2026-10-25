#!/usr/bin/env node
/**
 * 教育版一致性守門：exam/ 與 exam-edu/ 的同一批檔案內容必須相同。
 * 為什麼要有：上傳的是 exam-edu，它若落後，使用者在教育版看到的就是舊文件／舊程式。
 * 不同步就紅燈，修法：node scripts/sync-edu.mjs
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const edu = path.join(root, '..', 'exam-edu');
const SKIP_DIR = new Set(['.git', 'node_modules', 'minitest', 'dist']);
const SKIP_FILE = new Set(['project.config.json', 'project.private.config.json', '.DS_Store']);

if (!fs.existsSync(edu)) {
  console.error('❌ 找不到教育版資料夾 ../exam-edu');
  process.exitCode = 1;
} else {
  const md5 = (p) => crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex');
  const walk = (dir, base = '') => {
    const out = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.') || SKIP_DIR.has(e.name)) continue;
      const rel = path.join(base, e.name);
      if (e.isDirectory()) out.push(...walk(path.join(dir, e.name), rel));
      else if (!SKIP_FILE.has(e.name)) out.push(rel);
    }
    return out;
  };
  const files = walk(root);
  const missing = [];
  const differ = [];
  for (const rel of files) {
    const b = path.join(edu, rel);
    if (!fs.existsSync(b)) { missing.push(rel); continue; }
    if (md5(path.join(root, rel)) !== md5(b)) differ.push(rel);
  }
  const bad = missing.length + differ.length;
  if (bad) {
    console.error(`❌ 教育版沒有同步：缺少 ${missing.length} 個、內容不同 ${differ.length} 個`);
    [...missing.slice(0, 5).map((f) => '  缺 ' + f), ...differ.slice(0, 5).map((f) => '  異 ' + f)].forEach((l) => console.error(l));
    console.error('   修法：node scripts/sync-edu.mjs');
    process.exitCode = 1;
  } else {
    console.log(`✅ 教育版一致（${files.length} 個檔案逐一比對）`);
  }
}
