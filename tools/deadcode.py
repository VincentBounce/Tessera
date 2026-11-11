# Dead code: what the app declares and nothing alive reads (a night's audit, see CLAUDE.md), each with its file:line.
# python3 tools/deadcode.py [dir]   (dir: a copy of the app's files, the repo by default; exit 1 when it finds any)
#
# main.js read as the browser reads it (no comment, see uncomment.py) and cut into its top-level statements (a line at
# column 0 starts one, Prettier's way); a declaration's names (function, const, let, class, and the declarators after a
# comma) alive when something alive reads them; alive from the start: the statements that are no declaration (they run),
# the page, the checks (tools/check.js) and the functions run from the console (…Check). A name only a
# dead one reads is dead too: one run finds them all (a helper and the helper of its helper), no removal in between.
# Then the style's classes, ids and variables that nothing alive reads (a class made in a template, `tip-${…}`, by its
# prefix); and a key written twice in one object literal (the first dead: the second replaces it with no word, as ICONS'
# turtle till v0.4.840), as esbuild warns of it; and a comment's "see name" whose name is nowhere in the code, the page, the
# style or the checks any more (renamed or gone: see memoriesTable, till v0.4.841).
import os, re, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from uncomment import uncommented, uncommented_css, uncommented_html

root = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
repo = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
read = lambda *p: open(os.path.join(*p), encoding='utf-8').read()
main_src, css_src, html_src = (read(root, f) for f in ('main.js', 'style.css', 'index.html'))
others = uncommented(read(repo, 'tools/check.js'))  # (the generated data, emoji.js, punks.js…, read nothing of the app: their words not names)

WORD = re.compile(r'(?:(?<=\.\.\.)|(?<![\w$.]))([A-Za-z_$][\w$]*)')  # (a name, not a property: x.name; ...name is one)
DECL = re.compile(r'^(?:async )?(?:function\*? |const |let |var |class )([A-Za-z_$][\w$]*)')
CONSOLE = re.compile(r'Check$')  # (run from the console: tesseraCheck, gpuShownCheck…)

# main.js's top-level statements: [names it declares, its text]
statements, lines = [], uncommented(main_src).split('\n')
for line in lines:
    if line[:1] not in ' })]' or not statements:
        statements.append([[], line])
    else:
        statements[-1][1] += '\n' + line
    m = DECL.match(line) if line[:1] != ' ' else None
    if m:
        statements[-1][0].append(m[1])
    elif line.startswith('  ') and not line.startswith('   ') and DECL.match(statements[-1][1]):
        prev = statements[-1][1].split('\n')[-2] if '\n' in statements[-1][1] else ''
        d = re.match(r'^  ([A-Za-z_$][\w$]*) = ', line)
        if d and prev.rstrip().endswith(','):
            statements[-1][0].append(d[1])  # (a declarator after a comma: const a = …,\n  b = …)
names = lambda text: {m[1] for m in WORD.finditer(text)}
declared = {}
for decl, text in statements:
    for n in decl:
        declared.setdefault(n, []).append(text)
# alive: what runs, the page, the other scripts, the checks, the console's; then what they read, and so on
alive, todo = set(), []
def reads(text):
    for n in names(text):
        if n in declared and n not in alive:
            alive.add(n)
            todo.append(n)
for decl, text in statements:
    if not decl:
        reads(text)
reads(uncommented_html(html_src) + others)
for n in declared:
    if CONSOLE.search(n) and n not in alive:
        alive.add(n)
        todo.append(n)
while todo:
    for text in declared[todo.pop()]:
        reads(text)
dead_js = sorted(set(declared) - alive)

# the style's classes, ids (in its selectors, not a colour's #fff) and variables nothing alive reads
live_js = '\n'.join(text for decl, text in statements if not decl or any(n in alive for n in decl))
used = live_js + uncommented_html(html_src) + others
css = uncommented_css(css_src)
selectors = ' '.join(re.findall(r'(?:^|})([^{}]*){', css))
prefixes = set(re.findall(r'([\w-]+-)\$\{', live_js))  # (a class made in a template: tip-${…})
said = lambda word: re.search(r'(?<![\w-])' + re.escape(word) + r'(?![\w-])', used)
dead_classes = sorted(c for c in set(re.findall(r'\.([A-Za-z][\w-]*)', selectors)) if not said(c) and not any(c.startswith(p) for p in prefixes))
dead_ids = sorted(i for i in set(re.findall(r'#([A-Za-z][\w-]*)', selectors)) if not said(i))
defined = set(re.findall(r'(--[\w-]+)\s*:', css))
dead_vars = sorted(v for v in defined if not re.search(r'var\(\s*' + re.escape(v) + r'(?![\w-])', css + used) and not re.search(r"['\"`]" + re.escape(v) + r"['\"`]", live_js))

# each found at its line in the file as written
def at(src, pattern):
    for k, line in enumerate(src.split('\n'), 1):
        if re.search(pattern, line):
            return k
    return '?'
found = [f'main.js:{at(main_src, r"^(?:async )?(?:function\*? |const |let |var |class |  )" + re.escape(n) + r"\b")} {n}' for n in dead_js]
found += [f'style.css:{at(css_src, r"\." + re.escape(c) + r"(?![\w-])")} .{c}' for c in dead_classes]
found += [f'style.css:{at(css_src, "#" + re.escape(i) + r"(?![\w-])")} #{i}' for i in dead_ids]
found += [f'style.css:{at(css_src, re.escape(v) + r"\s*:")} {v}' for v in dead_vars]
# a comment's "see name" (a name of the code's own form, camelCase) that nothing but comments holds any more
code_words = set(re.findall(r'[A-Za-z_$][\w$-]*', uncommented(main_src) + css + uncommented_html(html_src) + others))
for k, line in enumerate(main_src.split('\n'), 1):
    for name in re.findall(r'\bsee ([a-z][a-z0-9]*[A-Z][\w$]*)', line):
        if name not in code_words:
            found.append(f'main.js:{k} see {name}: nowhere but comments')
# a key twice in one object literal, as esbuild finds it (its warnings: the key, then where the second is)
try:
    warned = subprocess.run(['esbuild', os.path.join(root, 'main.js'), '--log-level=warning'], capture_output=True, text=True).stderr
    for key, line in re.findall(r'Duplicate key "([^"]+)".*?main\.js:(\d+):', warned, re.S):
        found.append(f'main.js:{line} key {key} twice in its object')
except FileNotFoundError:
    print('(esbuild not found: keys written twice not looked for)')
print('\n'.join(found) or 'No dead code found.')
sys.exit(1 if found else 0)
