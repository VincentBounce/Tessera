# The self-reproducing loops (Langton, Byl, Chou-Reggia 1 and 2, Tempesti, SDSR, Evoloop, Sexyloop) as Golly has them: each
# rule's table and colours (Golly's Rules/*.rule) and its start (Golly's Patterns/Loops/*.rle), from Golly 5.0 as installed;
# Sexyloop's, not in Golly, from its Rule Table Repository (SexyLoop.zip, kept in tools/loops/): python3 tools/loops.py.
# Out: loops.js, LOOP_RULES, read by parseLoops in main.js
import json, os, re

GOLLY = '/Applications/golly-5.0-mac'
RULES, PATTERNS = GOLLY + '/Rules/{}.rule', GOLLY + '/Patterns/Loops/{}.rle'
OWN = os.path.join(os.path.dirname(__file__), 'loops', '{}')  # (Sexyloop's rule and start)
# the app's name of each, Golly's rule and pattern, its year and words (and its files' folder, if not Golly's)
LOOPS = [
    ('Langton', 'Langtons-Loops', 'Langtons-Loops', 1984, "Langton's loops: a loop whose signals turning round in it build a copy of it, every 151 generations, into a colony growing as a coral, its dead loops in the middle"),
    ('Byl', 'Byl-Loop', 'Byl-Loop', 1989, "Byl's loop: Langton's without its inner sheath, 12 cells copied every 25 generations"),
    ('Chou-Reggia', 'Chou-Reggia-1', 'Chou-Reggia-Loop-1', 1993, "Chou and Reggia's loop: no sheath at all, 5 cells copied every 15 generations"),
    ('Chou-Reggia 2', 'Chou-Reggia-2', 'Chou-Reggia-Loop-2', 1993, "Chou and Reggia's second loop: 5 cells too, copied every 15 generations too, by a table of 65 rules, not 174"),
    ('Tempesti', 'Tempesti', 'Tempesti-Loop', 1995, "Tempesti's loop: by its 8 neighbours, it builds its copy's skeleton first, then lets its program flow in, which opens a gate and writes LSL inside with an arm, the right way up (its table has no turns)"),
    ('SDSR', 'SDSR-Loop', 'SDSR-Loop', 1998, "Sayama's structurally dissolvable loop: Langton's, its dead loops dissolving, so the colony goes on growing and turning over"),
    ('Evoloop', 'Evoloop', 'Evoloop', 1999, "Sayama's evoloop: loops that meet change, the smaller ones copying faster and taking the room: natural selection"),
    ('Sexyloop', 'Sexyloop-M1', 'species13-M1', 2007, "Oros and Nehaniv's loop: the evoloop's, its loops passing part of their genes to those they meet (sex), its species mixing", 'own'),
]
get = lambda path: open(path).read()
out = {}
# a rule file's parts: its table's lines and its colours (state, red, green, blue; a name after them left out)
def parts(text):
    table, colours, part = [], [], None
    for line in text.split('\n'):
        if line.startswith('@'): part = line.split()[0]; continue
        line = line.split('#')[0].strip()
        if not line: continue
        if part == '@TABLE': table.append(line)
        if part == '@COLORS' and int(line.split()[0]) > 0: colours.append([int(v) for v in line.split()[:4]])
    return table, colours
for name, rule, pattern, year, words, *own in LOOPS:
    rules, patterns = (OWN + '.rule', OWN + '.rle') if own else (RULES, PATTERNS)
    table, colours = parts(get(rules.format(rule)))
    shared = rules.format(rule.rsplit('-', 1)[0] + '-shared')  # (none of its own: those of its family's, as Golly reads them)
    if not colours and os.path.exists(shared): colours = parts(get(shared))[1]
    rle = get(patterns.format(pattern))
    head = re.search(r'x = (\d+), y = (\d+)', rle)
    body = ''.join(l.strip() for l in rle.split('\n') if l and not l.startswith('#') and not l.startswith('x '))
    out[name] = {'golly': rule, 'year': year, 'words': words, 'table': '\n'.join(table), 'colours': colours,
                 'pattern': {'w': int(head[1]), 'h': int(head[2]), 'rle': body}}
    print(name, len(table), 'lines,', len(colours), 'colours, pattern', head[1], 'x', head[2])
open('loops.js', 'w').write('// The self-reproducing loops, as Golly has them (see tools/loops.py): each one\'s table of transitions, colours and start\n'
                            f'const LOOP_RULES = {json.dumps(out, ensure_ascii=False)};\n')
