#!/usr/bin/env node
// 小程序專案結構檢查：CI 與提交前都能跑，不需要微信開發者工具。
// 檢查項目：JSON 可解析、app.json 頁面四件套齊全、usingComponents 目標存在。

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const root = process.cwd();
const errors = [];
const warnings = [];

function readJson(rel) {
  const abs = join(root, rel);
  if (!existsSync(abs)) {
    errors.push(`缺少檔案：${rel}`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(abs, 'utf8'));
  } catch (e) {
    errors.push(`${rel} JSON 解析失敗：${e.message}`);
    return null;
  }
}

// 1) 全域必要檔案
for (const f of ['app.js', 'app.json', 'app.wxss', 'project.config.json', 'sitemap.json']) {
  if (!existsSync(join(root, f))) errors.push(`缺少必要檔案：${f}`);
}

// 2) 所有 JSON 都要能解析
const appJson = readJson('app.json');
readJson('project.config.json');
readJson('sitemap.json');

// 3) app.json 的每個頁面都要有 .js / .json / .wxml / .wxss
if (appJson?.pages?.length) {
  for (const page of appJson.pages) {
    for (const ext of ['js', 'json', 'wxml', 'wxss']) {
      if (!existsSync(join(root, `${page}.${ext}`))) errors.push(`頁面缺檔：${page}.${ext}`);
    }
    const pageJson = readJson(`${page}.json`);
    const using = pageJson?.usingComponents ?? {};
    for (const [name, path] of Object.entries(using)) {
      const target = path.startsWith('/') ? join(root, path.slice(1)) : join(root, dirname(page), path);
      for (const ext of ['js', 'json', 'wxml']) {
        if (!existsSync(`${target}.${ext}`)) errors.push(`頁面 ${page} 的組件 ${name} 缺 ${path}.${ext}`);
      }
    }
  }
} else {
  errors.push('app.json 沒有 pages 陣列');
}

// 4) 自建組件：json 需宣告 component: true
const compDir = join(root, 'components');
if (existsSync(compDir)) {
  const { readdirSync } = await import('node:fs');
  for (const entry of readdirSync(compDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    // 兩種慣例都接受：components/pv-x/pv-x.json 或 components/pv-x/index.json
    const candidates = [`components/${entry.name}/${entry.name}.json`, `components/${entry.name}/index.json`];
    const rel = candidates.find((c) => existsSync(join(root, c)));
    if (!rel) {
      warnings.push(`組件 ${entry.name} 找不到 .json（試過 ${candidates.join('、')}）`);
      continue;
    }
    const json = readJson(rel);
    if (json && json.component !== true) warnings.push(`${rel} 未宣告 "component": true`);
  }
}

// 5) docs 是否被排除打包（避免文件進代碼包）
const project = JSON.parse(readFileSync(join(root, 'project.config.json'), 'utf8'));
const ignored = project?.packOptions?.ignore ?? [];
if (!ignored.some((i) => i.value === 'docs')) warnings.push('project.config.json 的 packOptions.ignore 沒有排除 docs/');
if (!ignored.some((i) => i.value === 'README.md')) warnings.push('project.config.json 的 packOptions.ignore 沒有排除 README.md');


// 6) WXSS：@import 路徑必須存在；不得使用萬用選擇器（WXSS 編譯器會整檔失敗）
{
  const { readdirSync, readFileSync } = await import('node:fs');
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.wxss')) {
        const rel = full.slice(root.length + 1);
        for (const line of readFileSync(full, 'utf8').split('\n')) {
          const m = line.match(/^\s*@import\s+['"]([^'"]+)['"]/);
          if (m) {
            const target = join(full, '..', m[1]);
            if (!existsSync(target)) errors.push(`${rel} 的 @import 找不到檔案：${m[1]}`);
          }
          if (/^\s*\*\s*\{/.test(line)) {
            errors.push(`${rel} 使用了萬用選擇器 *（WXSS 不支援，會導致整個 wxss 編譯失敗）`);
          }
        }
      }
    }
  };
  walk(root);
}

for (const w of warnings) console.warn(`⚠️  ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`❌ ${e}`);
  console.error(`\n檢查失敗：${errors.length} 個錯誤，${warnings.length} 個警告`);
  process.exit(1);
}
console.log(`✅ 專案結構檢查通過（${appJson.pages.length} 個頁面，${warnings.length} 個警告）`);
