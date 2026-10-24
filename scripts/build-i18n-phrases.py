#!/usr/bin/env python3
"""
重建 utils/i18n-phrases.js：把所有 i18n.pick('…') 的字串收集起來，用 opencc t2s 產生繁→簡對照。
用法：python3 scripts/build-i18n-phrases.py [--check]
  --check：只檢查「有 pick 但表裡沒有」的漏網字串，不改檔（CI／守門用）
"""
import json
import re
import subprocess
import sys
from pathlib import Path

try:
    import opencc
except ImportError:
    print('需要 opencc：python3 -m pip install --user opencc', file=sys.stderr)
    raise SystemExit(2)

root = Path(__file__).resolve().parents[1]
check_only = '--check' in sys.argv
# tw2sp＝台灣正體→簡體（含詞組轉換）：t2s 只換字，「登入／匯入」不會變成「登录／导入」
cc = opencc.OpenCC('tw2sp')
ph_path = root / 'utils' / 'i18n-phrases.js'

# 讀舊表：用 node 直接 require（正則解析遇到內含引號的文案會錯位，曾把檔案養成 60MB）
MAX_KEEP = 2_000_000  # 超過 2MB 視為壞檔，直接重建
existing = {}
if ph_path.exists():
    size = ph_path.stat().st_size
    if size > MAX_KEEP:
        print(f'舊對照表過大（{size} bytes，疑似損壞）→ 重建', file=sys.stderr)
    else:
        r = subprocess.run(
            ['node', '-e', 'process.stdout.write(JSON.stringify(require(process.argv[1])))', str(ph_path)],
            capture_output=True, text=True,
        )
        if r.returncode == 0 and r.stdout.strip():
            try:
                existing = json.loads(r.stdout)
            except json.JSONDecodeError:
                print('舊對照表解析失敗 → 重建', file=sys.stderr)
        else:
            print('舊對照表無法載入 → 重建', file=sys.stderr)

# 收集所有 i18n.pick('…')／i18n.pick("…") 的第一個參數（只收字面值）
UNESC = {'n': '\n', 't': '\t', '\\': '\\', "'": "'", '"': '"'}
PICK = re.compile(r"i18n\.pick\(\s*(?:'((?:\\.|[^'\\])*)'|\"((?:\\.|[^\"\\])*)\")")

found = {}
for sub in ('pages', 'components', 'services', 'utils'):
    for p in (root / sub).rglob('*.js'):
        for m in PICK.finditer(p.read_text(encoding='utf-8')):
            raw = m.group(1) if m.group(1) is not None else m.group(2)
            text = re.sub(r'\\(.)', lambda x: UNESC.get(x.group(1), x.group(1)), raw)
            found.setdefault(text, set()).add(str(p.relative_to(root)))

# utils/errors.js 的 TEXT 是「取用時才 pick()」的文案表，掃描器抓不到 pick( 呼叫，另外收
err_path = root / 'utils' / 'errors.js'
if err_path.exists():
    for m in re.finditer(r"\w+:\s*(?:'((?:\\.|[^'\\])*)'|\"((?:\\.|[^\"\\])*)\")", err_path.read_text(encoding='utf-8')):
        raw = m.group(1) if m.group(1) is not None else m.group(2)
        text = re.sub(r'\\(.)', lambda x: UNESC.get(x.group(1), x.group(1)), raw)
        if text:
            found.setdefault(text, set()).add('utils/errors.js')

missing = {k: v for k, v in found.items() if k not in existing}
if check_only:
    for k, where in sorted(missing.items()):
        print(f'  漏收：{json.dumps(k, ensure_ascii=False)}  ← {sorted(where)[0]}')
    print(f'\n對照表 {len(existing)} 組；pick() 共 {len(found)} 條；漏收 {len(missing)} 條')
    raise SystemExit(1 if missing else 0)

for k in found:
    existing[k] = cc.convert(k)

body = ',\n'.join(
    '  %s: %s' % (json.dumps(k, ensure_ascii=False), json.dumps(v, ensure_ascii=False))
    for k, v in sorted(existing.items())
)
ph_path.write_text(
    '// 自動產生：繁體→簡體對照（opencc t2s）。由 scripts/build-i18n-phrases.py 維護，不要手改。\n'
    'module.exports = {\n%s\n};\n' % body,
    encoding='utf-8',
)
print(f'對照表已更新：{len(existing)} 組（pick() {len(found)} 條）')
