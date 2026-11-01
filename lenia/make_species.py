"""Writes lenia/species.js from Bert Chan's published Lenia species (github.com/Chakazul/Lenia, Python/).

Usage: python3 lenia/make_species.py <folder holding Chan's animals.json and found/*.json>
The species keep Chan's own parameters and cells (his RLE strings), decoded by lenia.js; each pick
below was kept for living on, moving, and standing walls (see leniaCheck in lenia.js).
"""
import json, re, sys, os

# Zoo species: one channel each, each in a colour of its own: ('animals', code) or (found file, n-th
# entry), and how it lives. The found ones first: fast, and standing walls.
SINGLE = [('212', 12, 'moves'), ('213', 72, 'moves'), ('213', 58, 'moves'), ('212', 13, 'moves'), ('213', 16, 'moves'),
          ('213', 0, 'moves'), ('213', 10, 'moves'), ('213', 15, 'moves'), ('213', 4, 'moves'), ('213', 63, 'moves'),
          ('animals', 'O2u', 'moves'), ('animals', 'S1s', 'moves'), ('animals', 'OG2g', 'turns'), ('animals', 'PG1c', 'turns')]
# Organisms: Chan's two- and three-channel creatures, one law over the colours (the movers merge
# into a growing tissue when two meet).
MULTI = [('232', 22, 'still'), ('232', 25, 'still'), ('232', 39, 'still'), ('232', 4, 'still'), ('232', 9, 'still'),
         ('232', 7, 'still'), ('221', 22, 'moves, meetings grow'), ('221', 11, 'moves, meetings grow'),
         ('221', 13, 'grows'), ('232', 33, 'grows')]


def entries(path):
    # Chan's "found" files hold JSON objects among notes: each one read where it starts.
    text, dec, out = open(path).read(), json.JSONDecoder(), []
    for m in re.finditer(r'\{"code"', text):
        try: out.append(dec.raw_decode(text, m.start())[0])
        except ValueError: pass
    return [a for a in out if isinstance(a.get('params'), (list, dict)) and a.get('cells')]


def species(a, label, life):
    ps = a['params'] if isinstance(a['params'], list) else [a['params']]
    R = ps[0].get('R', a.get('settings', {}).get('R'))
    T = ps[0].get('T', a.get('settings', {}).get('T'))
    kernels = [{'r': p.get('r', 1), 'b': p['b'], 'm': p['m'], 's': p['s'], 'h': p.get('h', 1), 'kn': p.get('kn', 1), 'gn': p.get('gn', 1), 'c': p.get('c', [0, 0])} for p in ps]
    cells = a['cells'] if isinstance(a['cells'], list) else [a['cells']]
    code = label if label[0].isdigit() else a['code']
    name = (a.get('name') or '').strip('*+- ')
    return {'code': code, 'name': name if name and not name.startswith('Found') else '', 'life': life, 'R': R, 'T': T, 'kernels': kernels, 'cells': cells}


def pick(folder, src, key, life):
    if src == 'animals':
        animals = [a for a in json.load(open(os.path.join(folder, 'animals.json'))) if 'params' in a]
        return species(next(a for a in animals if a['code'] == key), key, life)
    return species(entries(os.path.join(folder, 'found', src + '.json'))[key], f'{src}·{key}', life)


def main(folder):
    data = {'single': [pick(folder, *p) for p in SINGLE], 'multi': [pick(folder, *p) for p in MULTI]}
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'species.js')
    with open(out, 'w') as f:
        f.write("// Made by make_species.py from Bert Chan's Lenia species (github.com/Chakazul/Lenia, MIT licence).\n")
        f.write('const SPECIES = ' + json.dumps(data, separators=(',', ':')) + ';\n')
    print(out, os.path.getsize(out), 'bytes')


main(sys.argv[1])
