#!/usr/bin/env node
// 小程序專案結構檢查：CI 與提交前都能跑，不需要微信開發者工具。
// 檢查項目：JSON 可解析、app.json 頁面四件套齊全、usingComponents 目標存在、
// WXSS 風險選擇器、白屏守門、組件註冊一致、未登記頁面、tabBar/entryPagePath。

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
        const text = readFileSync(full, 'utf8');
        const stripped = text.replace(/\/\*[\s\S]*?\*\//g, ''); // 先整檔去註解（註解裡的 * 不算）

        for (const line of text.split('\n')) {
          const m = line.match(/^\s*@import\s+['"]([^'"]+)['"]/);
          if (m) {
            const target = join(full, '..', m[1]);
            if (!existsSync(target)) errors.push(`${rel} 的 @import 找不到檔案：${m[1]}`);
          }
          const risky = line.match(/:(empty|root|not)\(?|::?(before|after)/);
          if (risky) warnings.push(`${rel} 使用了可能在 WXSS 不支援的選擇器：${risky[0]}`);
        }

        // 萬用選擇器：`* {`、`> *`、`, *` 全部不行（WXSS 會整檔編譯失敗）
        if (stripped.includes('*')) {
          const where = stripped.split('\n').findIndex((l) => l.includes('*'));
          errors.push(`${rel} 第 ${where + 1} 行附近使用了萬用選擇器 *（WXSS 不支援，會導致整個 wxss 編譯失敗）`);
        }
      }
    }
  };
  walk(root);
}


// 7) 白屏守門：wxml 內用了 .page-scroll，根節點必須帶 page-root（否則 flex 高度塌成 0）
{
  const { readdirSync, readFileSync } = await import('node:fs');
  const walkWxml = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) walkWxml(full);
      else if (e.name.endsWith('.wxml')) {
        const rel = full.slice(root.length + 1);
        const text = readFileSync(full, 'utf8');
        if (!text.includes('page-scroll')) continue;
        const firstTag = text.slice(text.indexOf('<'), text.indexOf('>') + 1);
        if (!firstTag.includes('page-root')) {
          errors.push(`${rel} 用了 .page-scroll 但根節點沒有 page-root（高度會塌成 0 → 白屏）`);
        }
      }
    }
  };
  walkWxml(root);
}


// 8) W-13：頁面 JS 必須有 Page( / Component(、json 必須有標題、wxml 用到的自訂組件必須註冊
{
  const { readFileSync } = await import('node:fs');
  for (const page of appJson.pages) {
    const js = readFileSync(join(root, `${page}.js`), 'utf8');
    if (!/\bPage\s*\(/.test(js) && !/\bComponent\s*\(/.test(js)) {
      errors.push(`${page}.js 沒有 Page( 或 Component(，這個頁面不會被註冊`);
    }

    const pageJson = readJson(`${page}.json`) || {};
    if (!pageJson.navigationBarTitleText) {
      warnings.push(`${page}.json 缺少 navigationBarTitleText（導航列會沒有標題）`);
    }

    const using = Object.keys(pageJson.usingComponents || {});
    const wxml = readFileSync(join(root, `${page}.wxml`), 'utf8');
    const used = Array.from(new Set((wxml.match(/<(pv-[a-z0-9-]+)/g) || []).map((t) => t.slice(1))));

    for (const tag of used) {
      if (!using.includes(tag)) {
        errors.push(`${page}.wxml 用了 <${tag}> 但 ${page}.json 沒有註冊這個組件`);
      }
    }
    for (const name of using) {
      if (name.startsWith('pv-') && !used.includes(name)) {
        warnings.push(`${page}.json 註冊了 ${name} 但 ${page}.wxml 沒用到`);
      }
    }
  }
}

// 9) W-13：pages/ 底下有檔案但沒被 app.json 收錄（漏註冊的頁面）
{
  const { readdirSync } = await import('node:fs');
  const walkPages = (dir, acc = []) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.')) continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) walkPages(full, acc);
      else if (e.name.endsWith('.wxml')) acc.push(full.slice(root.length + 1).replace(/\.wxml$/, ''));
    }
    return acc;
  };
  if (existsSync(join(root, 'pages'))) {
    for (const rel of walkPages(join(root, 'pages'))) {
      if (!appJson.pages.includes(rel)) warnings.push(`${rel} 存在但沒有登記在 app.json 的 pages`);
    }
  }
}

// 10) W-13：tabBar 與 entryPagePath 指到的頁面必須存在
{
  const tb = appJson.tabBar;
  if (tb && Array.isArray(tb.list)) {
    for (const item of tb.list) {
      if (item.pagePath && !appJson.pages.includes(item.pagePath)) {
        errors.push(`tabBar 指到不存在的頁面：${item.pagePath}`);
      }
    }
  }
  if (appJson.entryPagePath && !appJson.pages.includes(appJson.entryPagePath)) {
    errors.push(`entryPagePath 指到不存在的頁面：${appJson.entryPagePath}`);
  }
}

for (const w of warnings) console.warn(`⚠️  ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`❌ ${e}`);
  console.error(`\n檢查失敗：${errors.length} 個錯誤，${warnings.length} 個警告`);
  process.exit(1);
}
console.log(`✅ 專案結構檢查通過（${appJson.pages.length} 個頁面，${warnings.length} 個警告）`);
