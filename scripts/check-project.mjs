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


// 7b) WXML 表達式守門：wx:if / wx:elif 內不得出現陣列或物件字面值（真的會編譯失敗）
{
  const { readdirSync, readFileSync } = await import('node:fs');
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.wxml')) {
        const rel = full.slice(root.length + 1);
        for (const [i, line] of readFileSync(full, 'utf8').split('\n').entries()) {
          const m = line.match(/wx:(?:if|elif)="\{\{([^}]*)\}\}"/);
          if (m && /\[\s*\]|\{\s*\}/.test(m[1])) {
            errors.push(`${rel}:${i + 1} wx:if 內含陣列／物件字面值（WXML 不支援，會編譯失敗）：${m[1].slice(0, 60)}`);
          }
        }
      }
    }
  };
  walk(root);
}

// 7c) 有 labels() 的頁面必須真的呼叫它（曾漏呼叫 → 校曆「今天」按鈕文字空白，只剩紫色方塊）
{
  const { readdirSync, readFileSync } = await import('node:fs');
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (!e.name.endsWith('.js')) continue;
      const src = readFileSync(full, 'utf8');
      if (!/\blabels\(\)\s*\{/.test(src)) continue;
      if (!/L:\s*this\.labels\(\)/.test(src)) {
        errors.push(`${full.slice(root.length + 1)} 定義了 labels() 但沒有 setData({ L: this.labels() })（介面文字會空白）`);
      }
    }
  };
  walk(root);
}

// 7d) W-20：WXML 用到的 L.xxx 必須真的存在於該頁的 labels()
{
  const { readdirSync, readFileSync } = await import('node:fs');
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (!e.name.endsWith('.wxml')) continue;
      const rel = full.slice(root.length + 1);
      const wxml = readFileSync(full, 'utf8');
      const used = new Set([...wxml.matchAll(/\bL\.([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]));
      if (!used.size) continue;
      const jsPath = full.replace(/\.wxml$/, '.js');
      const js = readFileSync(jsPath, 'utf8');
      for (const k of used) {
        // 允許：頁面 data 內直接宣告、或 labels() 內有同名 key
        const inLabels = new RegExp(`\\b${k}\\s*:`).test(js);
        if (!inLabels) errors.push(`${rel} 用到 {{L.${k}}}，但 ${jsPath.slice(root.length + 1)} 沒有任何地方提供這個 key（畫面會空白）`);
      }
    }
  };
  walk(root);
  // 註：labels() 的 key 一律由 i18n 提供，這裡只檢查「key 完全不存在」的情況
}

// 7e) W-21：深色模式必須覆寫所有「顏色」變數（漏一個就會深色底配白色卡片）
{
  const { readFileSync: rf } = await import('node:fs');
  const tok = rf(join(root, 'styles/tokens.wxss'), 'utf8');
  const grab = (sel) => {
    const i = tok.indexOf(sel + ' {');
    if (i < 0) return '';
    const start = tok.indexOf('{', i);
    let depth = 0;
    for (let p = start; p < tok.length; p += 1) {
      if (tok[p] === '{') depth += 1;
      else if (tok[p] === '}') {
        depth -= 1;
        if (depth === 0) return tok.slice(start, p);
      }
    }
    return '';
  };
  const light = grab('page');
  const dark = grab('.theme-dark');
  if (!dark) errors.push('styles/tokens.wxss 沒有 .theme-dark 區塊（深色模式無效）');
  const NON_COLOR = /^--pv-(fs|ls|sp|r$|r-|ease|dur|font|weight)/;
  const lightVars = [...light.matchAll(/(--pv-[a-z0-9-]+)\s*:/g)].map((m) => m[1]).filter((v) => !NON_COLOR.test(v));
  for (const v of lightVars) {
    if (!new RegExp(v + '\\s*:').test(dark)) errors.push(`styles/tokens.wxss 的 .theme-dark 沒有覆寫 ${v}（深色模式下會殘留淺色值）`);
  }
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

// 11) 顏色單一來源：wxss / wxml / js 不得寫死色值（唯一來源 styles/tokens.wxss）
//     例外：tokens.wxss 本身、style-guide 展示頁（它的工作就是把色值印出來）、utils/theme.js（第 13 條單獨比對）
{
  const { readdirSync, readFileSync } = await import('node:fs');
  const SKIP_DIRS = new Set(['node_modules', 'dist', 'minitest', 'docs', '.git', '.github', 'scripts', 'config']);
  const ALLOW = new Set([
    'styles/tokens.wxss',
    'pages/style-guide/index.js',
    'pages/style-guide/index.wxml',
    'pages/style-guide/index.wxss',
  ]);
  const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
  const RGBA = /\brgba?\(/g;
  const strip = (text) => text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\n)\s*\/\/[^\n]*/g, '$1');

  const scan = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) { scan(full); continue; }
      if (!/\.(wxss|wxml|js)$/.test(e.name)) continue;
      const rel = full.slice(root.length + 1);
      if (ALLOW.has(rel) || rel === 'utils/theme.js') continue;
      const text = strip(readFileSync(full, 'utf8'));
      text.split('\n').forEach((line, i) => {
        const m = line.match(HEX) || line.match(RGBA);
        if (m) errors.push(`${rel}:${i + 1} 寫死色值 ${m[0]}（顏色只能來自 var(--pv-*) 或 utils/theme.js）`);
      });
    }
  };
  for (const dir of ['pages', 'components', 'styles', 'utils', 'services']) {
    if (existsSync(join(root, dir))) scan(join(root, dir));
  }
}

// 12) CSS 變數必須先定義：用到未定義的 --pv-* 會靜默退回繼承色（畫面只像「顏色不對」）
{
  const { readdirSync, readFileSync } = await import('node:fs');
  const tokenText = readFileSync(join(root, 'styles/tokens.wxss'), 'utf8');
  const defined = new Set((tokenText.match(/^\s*(--pv-[a-z0-9-]+)\s*:/gm) || []).map((s) => s.trim().replace(/\s*:$/, '')));
  const walkVars = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) { walkVars(full); continue; }
      if (!e.name.endsWith('.wxss')) continue;
      const rel = full.slice(root.length + 1);
      if (rel === 'styles/tokens.wxss') continue;
      const text = readFileSync(full, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      const used = new Set((text.match(/var\(\s*(--pv-[a-z0-9-]+)/g) || []).map((s) => s.replace(/var\(\s*/, '')));
      for (const v of used) {
        if (!defined.has(v)) errors.push(`${rel} 用了未定義的 ${v}（tokens.wxss 沒有這個變數，會靜默退回繼承色）`);
      }
    }
  };
  for (const dir of ['pages', 'components', 'styles']) if (existsSync(join(root, dir))) walkVars(join(root, dir));
}

// 13) utils/theme.js（WXML 屬性用的字面色）必須與 tokens.wxss 一致
{
  const { readFileSync } = await import('node:fs');
  const tokenText = readFileSync(join(root, 'styles/tokens.wxss'), 'utf8');
  const themeText = readFileSync(join(root, 'utils/theme.js'), 'utf8');
  const pairs = [['tint', '--pv-tint'], ['brand', '--pv-brand'], ['danger', '--pv-danger'], ['onTint', '--pv-on-tint']];
  for (const [key, varName] of pairs) {
    const tm = tokenText.match(new RegExp(varName + '\\s*:\\s*(#[0-9a-fA-F]{3,8})'));
    const jm = themeText.match(new RegExp('\\b' + key + "\\s*:\\s*'(#[0-9a-fA-F]{3,8})'"));
    if (!tm) { errors.push('tokens.wxss 找不到 ' + varName); continue; }
    if (!jm) { errors.push('utils/theme.js 沒有 ' + key + '（應為 ' + tm[1] + '）'); continue; }
    if (tm[1].toLowerCase() !== jm[1].toLowerCase()) {
      errors.push('utils/theme.js 的 ' + key + '=' + jm[1] + ' 與 tokens.wxss 的 ' + varName + '=' + tm[1] + ' 不一致');
    }
  }
}

for (const w of warnings) console.warn(`⚠️  ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`❌ ${e}`);
  console.error(`\n檢查失敗：${errors.length} 個錯誤，${warnings.length} 個警告`);
  process.exit(1);
}
console.log(`✅ 專案結構檢查通過（${appJson.pages.length} 個頁面，${warnings.length} 個警告）`);
