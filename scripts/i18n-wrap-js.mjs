#!/usr/bin/env node
/**
 * W-20b 遷移工具：把頁面 JS 裡「寫死的中文介面字串」包成 i18n.pick('…')。
 * 用法：
 *   node scripts/i18n-wrap-js.mjs --dry     # 只列出會改哪些（不寫檔）
 *   node scripts/i18n-wrap-js.mjs           # 實際改寫
 * 規則：
 *   - 只動 pages/**\/*.js
 *   - 跳過註解、已包 pick() 的字串、console.* 的開發訊息
 *   - 自動補 require('<深度>/utils/i18n')（沒有就加在檔頭 require 區）
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments, CJK } from './i18n-js-scan.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dry = process.argv.includes('--dry');

function walk(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'minitest'].includes(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith('.js')) acc.push(p);
  }
  return acc;
}

let files = 0;
let wrapped = 0;
for (const abs of walk(join(root, 'pages'))) {
  const original = readFileSync(abs, 'utf8');
  const code = stripComments(original);
  const edits = [];
  for (const m of code.matchAll(/'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"/g)) {
    const text = m[1] !== undefined ? m[1] : m[2];
    if (!CJK.test(text)) continue;
    const before = code.slice(Math.max(0, m.index - 20), m.index);
    if (/i18n\.pick\(\s*$/.test(before)) continue;
    const lineStart = code.lastIndexOf('\n', m.index) + 1;
    const line = code.slice(lineStart, m.index);
    if (/console\.(log|warn|error|info|debug)\(/.test(line)) continue;
    edits.push({ start: m.index, end: m.index + m[0].length, raw: m[0] });
  }
  if (!edits.length) continue;

  let out = original;
  for (const e of edits.reverse()) {
    out = out.slice(0, e.start) + 'i18n.pick(' + e.raw + ')' + out.slice(e.end);
  }
  // 補 require
  if (!/require\(['"][^'"]*utils\/i18n['"]\)/.test(out)) {
    const rel = relative(dirname(abs), join(root, 'utils', 'i18n')).split('\\').join('/');
    const req = `const i18n = require('${rel}');\n`;
    const lines = out.split('\n');
    let lastRequire = -1;
    lines.forEach((l, i) => {
      if (/^const .*= require\(/.test(l.trim())) lastRequire = i;
    });
    if (lastRequire >= 0) lines.splice(lastRequire + 1, 0, req.trimEnd());
    else lines.unshift(req.trimEnd());
    out = lines.join('\n');
  }
  files += 1;
  wrapped += edits.length;
  console.log(`${dry ? '[dry] ' : ''}${relative(root, abs).padEnd(42)} ${String(edits.length).padStart(4)} 條`);
  if (!dry) writeFileSync(abs, out);
}
console.log(`\n${dry ? '[dry] ' : ''}共 ${files} 個檔案、${wrapped} 條字串`);
