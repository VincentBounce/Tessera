#!/usr/bin/env python3
"""The turns' one writing (v0.4.555): a hexagon's or a pentagon's L1 R1 now L R, on every grid (L2 R2 kept). Converts a
Gallery export (its setups' rules, "r") or any text holding links (their r= words), into a new file beside it, "<name> L R<ext>":
the old one kept. An ant's entries dotted only where a command of two letters is left (1.L1.0 0.R1.0 → 1L0 0R0, as antText
writes them). Usage: python3 tools/lr.py <file>"""
import json, re, sys
from pathlib import Path
from urllib.parse import quote, unquote

def rule(r):
    r = re.sub(r'\bL1\b', 'L', re.sub(r'\bR1\b', 'R', r))
    entries = re.findall(r'\d+\.([A-Z]\d?)\.\d+', r)
    if entries and all(len(c) == 1 for c in entries):  # (no command of two letters left: compact, as antText writes it)
        r = re.sub(r'(\d+)\.([A-Z])\.(\d+)', r'\1\2\3', r)
    return r

def walk(x):
    if isinstance(x, dict): return {k: (rule(v) if k == 'r' and isinstance(v, str) else walk(v)) for k, v in x.items()}
    if isinstance(x, list): return [walk(v) for v in x]
    if isinstance(x, str): return re.sub(r'([#&]r=)([^&"\s)]*)', lambda m: m.group(1) + quote(rule(unquote(m.group(2))), safe='|'), x)
    return x

src = Path(sys.argv[1]); text = src.read_text()
try: out = json.dumps(walk(json.loads(text)), ensure_ascii=False, indent=1)
except json.JSONDecodeError: out = walk(text)
dst = src.with_name(f'{src.stem} L R{src.suffix}')
dst.write_text(out)
print(f'{dst}: {sum(1 for a, b in zip(text.splitlines(), out.splitlines()) if a != b)} lines changed')
