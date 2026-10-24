#!/usr/bin/env python3
"""W-20c：把 WXML 的 {{}} 運算式裡的中文字面值抽成 L.kNN（只搬「顯示用」的字串）"""
import re, sys, json
from pathlib import Path
import opencc

root = Path(__file__).resolve().parent.parent
cc = opencc.OpenCC('t2s')
CJK = re.compile(r'[\u4e00-\u9fff]')

phrases_path = root / 'utils/i18n-phrases.js'
phrases = {}
if phrases_path.exists():
    for m in re.finditer(r'"([^"]+)":\s*"([^"]*)"', phrases_path.read_text(encoding='utf-8')):
        phrases[m.group(1)] = m.group(2)

total = 0
for wxml in sorted((root / 'pages').rglob('*.wxml')):
    rel = str(wxml.relative_to(root))
    src = wxml.read_text(encoding='utf-8')
    js = wxml.with_suffix('.js')
    if not js.exists():
        continue
    jstxt = js.read_text(encoding='utf-8')
    if 'labels() {' not in jstxt:
        continue

    # 已用到的最大 k 編號
    used = [int(x) for x in re.findall(r'\bk(\d+)\s*:', jstxt)]
    nxt = (max(used) + 1) if used else 1

    mapping = {}
    def key_for(text):
        if text not in mapping:
            mapping[text] = 'k%02d' % (nxt + len(mapping))
            phrases.setdefault(text, cc.convert(text))
        return mapping[text]

    changed = [0]
    def repl_mustache(m):
        expr = m.group(1)
        def repl_lit(lm):
            lit = lm.group(2)
            # 比較用的字串（=== 'x'）不要搬
            start = lm.start()
            prefix = expr[max(0, start - 6):start]
            if re.search(r'[!=]==?\s*$', prefix):
                return lm.group(0)
            if not CJK.search(lit) or lit.strip() == '':
                return lm.group(0)
            changed[0] += 1
            return 'L.' + key_for(lit)

        return '{{' + re.sub(r"(['\"])(.*?)\1", repl_lit, expr) + '}}'

    new = re.sub(r'\{\{(.*?)\}\}', repl_mustache, src, flags=re.S)
    if changed[0]:
        wxml.write_text(new, encoding='utf-8')
        body = '\n'.join('      %s: i18n.pick(%s),' % (k, json.dumps(t, ensure_ascii=False)) for t, k in sorted(mapping.items(), key=lambda kv: kv[1]))
        jstxt = re.sub(r'(labels\(\)\s*\{\s*\n\s*return \{)', r'\1\n' + body, jstxt, count=1)
        js.write_text(jstxt, encoding='utf-8')
        total += changed[0]
        print('  %-42s %2d 條' % (rel, changed[0]))

body = ',\n'.join('  %s: %s' % (json.dumps(k, ensure_ascii=False), json.dumps(v, ensure_ascii=False)) for k, v in sorted(phrases.items()))
phrases_path.write_text('// 自動產生：繁體→簡體對照（opencc t2s）。由 scripts/i18n-migrate*.py 維護。\nmodule.exports = {\n%s\n};\n' % body, encoding='utf-8')
print('合計 %d 條；對照表 %d 組' % (total, len(phrases)))
