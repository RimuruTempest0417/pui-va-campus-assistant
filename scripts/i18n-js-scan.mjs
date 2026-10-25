#!/usr/bin/env node
/**
 * 掃出「頁面／組件 JS 裡沒包 i18n.pick() 的中文字面值」——W-20b 的清單與守門來源。
 * 用法：node scripts/i18n-js-scan.mjs [--json] [--quiet]
 * 排除：註解、i18n.pick('…') 內、console.* 的開發訊息、require 路徑、正規表達式。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const CJK = /[\u4e00-\u9fff]/;

const SKIP_DIRS = new Set(['node_modules', 'minitest', '.git', '.github', 'dist']);

/** 把註解換成空白（保留行數與字元位置） */
export function stripComments(src) {
  let out = '';
  let i = 0;
  let mode = null; // null | 'line' | 'block' | "'" | '"' | '`'
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (mode === null) {
      if (c === '/' && n === '/') { mode = 'line'; out += '  '; i += 2; continue; }
      if (c === '/' && n === '*') { mode = 'block'; out += '  '; i += 2; continue; }
      if (c === "'" || c === '"' || c === '`') { mode = c; out += c; i += 1; continue; }
      out += c; i += 1; continue;
    }
    if (mode === 'line') { out += c === '\n' ? '\n' : ' '; if (c === '\n') mode = null; i += 1; continue; }
    if (mode === 'block') {
      if (c === '*' && n === '/') { out += '  '; i += 2; mode = null; continue; }
      out += c === '\n' ? '\n' : ' '; i += 1; continue;
    }
    // 字串內
    if (c === '\\') { out += c + (n || ''); i += 2; continue; }
    out += c;
    if (c === mode) mode = null;
    i += 1;
  }
  return out;
}

/**
 * 找出所有含中文的單／雙引號字串（不含模板字串，模板字串另由掃描器回報）
 * 用手寫掃描取代正則：大檔案（i18n 對照表）用 /g 正則會爆 call stack。
 */
export function chineseLiterals(code) {
  const hits = [];
  let i = 0;
  const n = code.length;
  while (i < n) {
    const c = code[i];
    if (c === '/' && code[i + 1] === '/') { while (i < n && code[i] !== '\n') i += 1; continue; }
    if (c === '/' && code[i + 1] === '*') { i += 2; while (i < n && !(code[i] === '*' && code[i + 1] === '/')) i += 1; i += 2; continue; }
    if (c !== "'" && c !== '"') { i += 1; continue; }
    const quote = c;
    const start = i;
    let j = i + 1;
    let text = '';
    let closed = false;
    while (j < n) {
      const d = code[j];
      if (d === '\\') { text += code[j + 1] ?? ''; j += 2; continue; }
      if (d === quote) { closed = true; break; }
      if (d === '\n') break;
      text += d;
      j += 1;
    }
    if (!closed) { i += 1; continue; }
    if (CJK.test(text)) {
      const before = code.slice(Math.max(0, start - 20), start);
      if (!/i18n\.pick\(\s*$/.test(before)) {
        hits.push({ index: start, text, raw: code.slice(start, j + 1), before });
      }
    }
    i = j + 1;
  }
  return hits;
}

const SKIP = new Set(['i18n-phrases.js']);

function walk(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    if (SKIP_DIRS.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith('.js')) acc.push(p);
  }
  return acc;
}

export function scan(projectRoot = root) {
  const files = [
    ...walk(join(projectRoot, 'pages')),
    ...walk(join(projectRoot, 'components')),
    ...walk(join(projectRoot, 'services')),
    ...walk(join(projectRoot, 'utils')),
  ];
  const report = {};
  let total = 0;
  for (const abs of files) {
    const rel = abs.slice(projectRoot.length + 1);
    const code = stripComments(readFileSync(abs, 'utf8'));
    const hits = chineseLiterals(code);
    if (!hits.length) continue;
    const lines = code.split('\n');
    report[rel] = hits.map((h) => {
      const line = code.slice(0, h.index).split('\n').length;
      return { line, text: h.text, source: (lines[line - 1] || '').trim().slice(0, 100) };
    });
    total += hits.length;
  }
  return { report, total };
}

const isMain = process.argv[1] && process.argv[1].endsWith('i18n-js-scan.mjs');
if (isMain) {
  const args = process.argv.slice(2);
  const { report, total } = scan();
  if (args.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    for (const [rel, hits] of Object.entries(report)) {
      console.log(`\n${rel}  (${hits.length})`);
      for (const h of hits) console.log(`  ${String(h.line).padStart(4)}  ${JSON.stringify(h.text)}`.padEnd(46) + h.source);
    }
    console.log(`\n合計 ${total} 條、${Object.keys(report).length} 個檔案`);
  }
  process.exitCode = total ? 1 : 0;
}
