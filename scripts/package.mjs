// 產出「交給老師」的乾淨 zip：不含 .git / node_modules / docs / CI 設定
// 用法：node scripts/package.mjs
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const rootDir = dirname(here);
const distDir = join(rootDir, 'dist');

// 版本號取最新一份 release note 的檔名
// 注意：字串排序會把 v0.10.0 排到 v0.9.0 前面，必須按數字比大小
const parseVer = (f) => f.replace('.md', '').replace('v', '').split('.').map(Number);
const releases = readdirSync(join(rootDir, 'docs/releases'))
  .filter((f) => /^v\d+\.\d+\.\d+\.md$/.test(f))
  .sort((a, b) => {
    const [x, y] = [parseVer(a), parseVer(b)];
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
  });
const version = (releases[releases.length - 1] || 'v0.0.0').replace('.md', '');
const name = `pui-va-campus-assistant-${version}`;

const EXCLUDE_DIRS = new Set(['.git', 'node_modules', 'dist', 'docs', '.github']);
const EXCLUDE_FILES = new Set(['project.private.config.json', '.DS_Store', '.gitignore']);

function copy(src, dest) {
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.gitignore') {
      if (EXCLUDE_DIRS.has(entry.name) || EXCLUDE_FILES.has(entry.name)) continue;
    }
    const from = join(src, entry.name);
    const to = join(dest, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      mkdirSync(to, { recursive: true });
      copy(from, to);
    } else {
      if (EXCLUDE_FILES.has(entry.name)) continue;
      cpSync(from, to);
    }
  }
}

if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true });
// 清掉上一次展開的目錄，避免 dist/ 越積越多
for (const entry of readdirSync(distDir)) {
  if (/^pui-va-campus-assistant-v[\d.]+$/.test(entry)) rmSync(join(distDir, entry), { recursive: true, force: true });
}
const stage = join(distDir, name);
rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });

copy(rootDir, stage);

// 把「交付給老師」的說明放在包根目錄，老師打開就看得到
const guide = join(rootDir, 'docs/交付給老師.md');
if (existsSync(guide)) {
  cpSync(guide, join(stage, '使用說明.md'));
}

const zipPath = join(distDir, `${name}.zip`);
rmSync(zipPath, { force: true });
execFileSync('zip', ['-qr', `${name}.zip`, name], { cwd: distDir });

// 統計
let files = 0;
let bytes = 0;
const walk = (d) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p);
    else {
      files += 1;
      bytes += readFileSync(p).length;
    }
  }
};
walk(stage);

// 打包後檢查：四個模組的頁面一定要在
const must = [
  'app.json',
  'pages/index/index.js',
  'pages/items/list/index.js',
  'pages/events/list/index.js',
  'pages/menu/index/index.js',
  'pages/notices/list/index.js',
  '使用說明.md',
];
const missing = must.filter((m) => !existsSync(join(stage, m)));

console.log(`打包完成：dist/${name}.zip`);
console.log(`  版本 ${version}｜檔案 ${files} 個｜原始大小 ${(bytes / 1024).toFixed(0)} KB`);
console.log(`  zip 大小 ${(readFileSync(zipPath).length / 1024).toFixed(0)} KB`);
if (missing.length) {
  console.error('缺少必要檔案：' + missing.join(', '));
  process.exit(1);
}
console.log('  四個模組頁面與使用說明都在包內 ✅');

// 只留 zip，展開目錄清掉（真的要展開給老師看時再手動解壓）
rmSync(stage, { recursive: true, force: true });
