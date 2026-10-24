#!/usr/bin/env node
/**
 * 掃出 WXML／JS 裡「寫死的中文」——W-20 逐頁遷到 i18n 的清單來源
 * 用法：node scripts/i18n-scan.mjs [--page pages/items/list] [--json]
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const only = args.includes('--page') ? args[args.indexOf('--page') + 1] : null;
const asJson = args.includes('--json');

const CJK = /[\u4e00-\u9fff]/;
const SKIP_PATTERNS = [
  /^[\d\s]+$/,            // 純數字
  /^[，。、：；！？（）「」『』·…—\s]+$/, // 純標點
];
const files = [];
const walk = (dir) => {
  for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const rel = dir ? join(dir, e.name) : e.name;
    if (e.isDirectory()) walk(rel);
    else if (e.name.endsWith('.wxml')) files.push(rel);
  }
};
walk('pages');

const report = {};
for (const rel of files) {
  if (only && !rel.startsWith(only)) continue;
  const src = readFileSync(join(root, rel), 'utf8');
  const hits = [];
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    // 只抓「不在 {{ }} 內」的中文字串：去掉 mustache 內容後再找
    const stripped = line.replace(/\{\{[\s\S]*?\}\}/g, '');
    // 文字節點 >中文<
    for (const m of stripped.matchAll(/>([^<>]*[\u4e00-\u9fff][^<>]*)</g)) {
      const t = m[1].trim();
      if (t && CJK.test(t) && !SKIP_PATTERNS.some((r) => r.test(t))) hits.push({ line: i + 1, kind: 'text', value: t });
    }
    // 屬性裡的固定字串（placeholder/title/desc/text 等）
    for (const m of stripped.matchAll(/(placeholder|title|desc|text|label|confirm-text|cancel-text)="([^"]*[\u4e00-\u9fff][^"]*)"/g)) {
      hits.push({ line: i + 1, kind: 'attr:' + m[1], value: m[2].trim() });
    }
  });
  if (hits.length) report[rel] = hits;
}

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  let total = 0;
  for (const [rel, hits] of Object.entries(report)) {
    console.log(`\n${rel}  (${hits.length})`);
    for (const h of hits) {
      total += 1;
      console.log(`  ${String(h.line).padStart(4)}  ${h.kind.padEnd(12)} ${h.value.slice(0, 70)}`);
    }
  }
  console.log(`\n合計 ${total} 條、${Object.keys(report).length} 個檔案`);
}
