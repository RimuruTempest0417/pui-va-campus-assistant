#!/usr/bin/env python3
"""W-20：把 WXML 裡寫死的中文抽成 i18n 條目（自動產生 key、自動 t2s 簡體對照）

用法：python3 scripts/i18n-migrate.py [--page pages/items/list] [--dry]
產出：
  - WXML：字面中文 → {{L.kNN}}；屬性 title="中文" → title="{{L.kNN}}"
  - 頁面 JS：labels() 內加 kNN: i18n.pick('中文')，並確保 onLoad/onShow 有 L: this.labels()
  - utils/i18n-phrases.js：繁→簡對照表（opencc t2s 產生）
"""
import re, sys, json, subprocess
from pathlib import Path
import opencc

root = Path(__file__).resolve().parent.parent
cc = opencc.OpenCC('t2s')
only = None
if '--page' in sys.argv:
    only = sys.argv[sys.argv.index('--page') + 1]
dry = '--dry' in sys.argv

CJK = re.compile(r'[\u4e00-\u9fff]')
PUNCT_ONLY = re.compile(r'^[，。、：；！？（）「」『』·…—\s]+$')
ATTRS = ('placeholder', 'title', 'desc', 'text', 'label', 'confirm-text', 'cancel-text')

phrases = {}          # 繁 → 簡（全項目共用）
report = []

def page_prefix(rel):
    # pages/items/list/index.wxml → items.list
    parts = rel.split('/')
    return parts[1] + '.' + parts[2] if len(parts) >= 4 else parts[1]

def migrate(rel):
    wxml_path = root / rel
    js_path = wxml_path.with_suffix('.js')
    src = wxml_path.read_text(encoding='utf-8')
    lines = src.split('\n')
    mapping = {}      # hant → key
    order = []

    def key_for(hant):
        if hant not in mapping:
            mapping[hant] = 'k%02d' % (len(mapping) + 1)
            order.append(hant)
            phrases[hant] = cc.convert(hant)
        return mapping[hant]

    for i, line in enumerate(lines):
        new = line
        # 1) 文字節點 >中文<
        for m in list(re.finditer(r'>([^<>{}]*[\u4e00-\u9fff][^<>{}]*)<', line)):
            raw = m.group(1)
            text = raw.strip()
            if not text or PUNCT_ONLY.match(text) or '{{' in raw:
                continue
            k = key_for(text)
            new = new.replace('>' + raw + '<', '>' + raw.replace(text, '{{L.%s}}' % k) + '<', 1)
        # 2) 屬性
        for attr in ATTRS:
            for m in list(re.finditer(attr + r'="([^"{]*[\u4e00-\u9fff][^"]*)"', new)):
                val = m.group(1).strip()
                if not val:
                    continue
                k = key_for(val)
                new = new.replace(m.group(0), '%s="{{L.%s}}"' % (attr, k), 1)
        lines[i] = new

    if not mapping:
        return None

    if not dry:
        wxml_path.write_text('\n'.join(lines), encoding='utf-8')

    # ── 頁面 JS：labels() ──
    body = '\n'.join("      %s: i18n.pick(%s)," % (mapping[h], json.dumps(h, ensure_ascii=False)) for h in order)
    if js_path.exists():
        js = js_path.read_text(encoding='utf-8')
        if 'function labels(' in js or 'labels() {' in js:
            js = re.sub(r'(labels\(\)\s*\{\s*\n\s*return \{)', r'\1\n' + body, js, count=1)
        else:
            block = "\n  labels() {\n    return {\n%s\n    };\n  },\n" % body
            js = js.replace('Page({', 'Page({' + block, 1)
        # 確保有 require i18n
        if "require('../../utils/i18n')" not in js and "require('../../../utils/i18n')" not in js:
            depth = '../' * (rel.count('/') - 1)
            js = js.replace('Page({', "const i18n = require('%sutils/i18n');\n\nPage({" % depth, 1)
        # 確保 L 有被 setData（onLoad 或 onShow）
        if not re.search(r'L:\s*this\.labels\(\)', js):
            if re.search(r'onShow\(\)\s*\{', js):
                js = re.sub(r'onShow\(\)\s*\{', 'onShow() {\n    this.setData({ L: this.labels() });', js, count=1)
            elif re.search(r'onLoad\([^)]*\)\s*\{', js):
                js = re.sub(r'onLoad\(([^)]*)\)\s*\{', r'onLoad(\1) {\n    this.setData({ L: this.labels() });', js, count=1)
        if not dry:
            js_path.write_text(js, encoding='utf-8')

    report.append((rel, len(mapping)))
    return len(mapping)

files = sorted(p for p in (root / 'pages').rglob('*.wxml'))
for wxml in files:
    rel = str(wxml.relative_to(root))
    if only and not rel.startswith(only):
        continue
    migrate(rel)

# ── 對照表寫檔 ──
ph_path = root / 'utils/i18n-phrases.js'
existing = {}
if ph_path.exists():
    txt = ph_path.read_text(encoding='utf-8')
    for m in re.finditer(r'"([^"]+)":\s*"([^"]*)"', txt):
        existing[m.group(1)] = m.group(2)
existing.update(phrases)
body = ',\n'.join('  %s: %s' % (json.dumps(k, ensure_ascii=False), json.dumps(v, ensure_ascii=False)) for k, v in sorted(existing.items()))
if not dry:
    ph_path.write_text('// 自動產生：繁體→簡體對照（opencc t2s）。由 scripts/i18n-migrate.py 維護。\nmodule.exports = {\n%s\n};\n' % body, encoding='utf-8')

for rel, n in report:
    print('  %-40s %2d 條' % (rel, n))
print('合計 %d 條、%d 個頁面；對照表 %d 組' % (sum(n for _, n in report), len(report), len(existing)))
