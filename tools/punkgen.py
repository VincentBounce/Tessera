# Punks, generated: the CC0 sprite sheet of openpunkart/punkart.spritesheet (spritesheet.png and .csv, 24 x 24 sprites in 25
# columns) as the app's Punk starts, each sprite drawn in black and white alone (its outline known by construction: a pixel
# beside the background, a near black one, the darker side of a contrast over 15 %), the sprites drawn alike as one drawing,
# sorted by head (a man's, l; a woman's, s): its archetypes, then each category's attributes that fit it.
#   python3 tools/punkgen.py <spritesheet.png> <spritesheet.csv>
# Out: punkgen.js, PUNK_DRAWINGS (each drawing 72 bytes of lines then 72 of its own pixels, base64) and PUNK_HEADS (per head
# its archetypes' drawings and each category's, as a punk's number reads them: see punkLayers in main.js)
import base64, re, struct, sys, textwrap, zlib

def read_png(path):  # an 8-bit RGBA PNG, not interlaced: its rows of bytes
    data, pos, idat = open(path, 'rb').read(), 8, b''
    while pos < len(data):
        n, kind = struct.unpack('>I4s', data[pos:pos + 8])
        body = data[pos + 8:pos + 8 + n]
        if kind == b'IHDR': w, h, depth, ctype = struct.unpack('>IIBB', body[:10]); assert depth == 8 and ctype == 6
        if kind == b'IDAT': idat += body
        pos += 12 + n
    raw, stride, rows, prev = zlib.decompress(idat), w * 4, [], bytearray(w * 4)
    for y in range(h):
        f, line = raw[y * (stride + 1)], bytearray(raw[y * (stride + 1) + 1:(y + 1) * (stride + 1)])
        for i in range(stride):
            a, b, c = line[i - 4] if i >= 4 else 0, prev[i], prev[i - 4] if i >= 4 else 0
            if f == 1: line[i] = (line[i] + a) & 255
            elif f == 2: line[i] = (line[i] + b) & 255
            elif f == 3: line[i] = (line[i] + (a + b) // 2) & 255
            elif f == 4:
                p = a + b - c; pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[i] = (line[i] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        rows.append(line); prev = line
    return rows

SIZE, COLUMNS, APART = 24, 25, 0.15
# the archetypes each head takes, and the categories in the order they are laid (the later over the earlier)
ARCHETYPES = {
    'l': ['Human 1', 'Human 2', 'Human 3', 'Human 4', 'Zombie', 'Ape', 'Alien'],
    's': ['Human Female 1', 'Human Female 2', 'Human Female 3', 'Human Female 4', 'Zombie Female', 'Ape Female', 'Alien Female'],
}
CATEGORIES = [
    ('skin', r'^(Mole|Spots|Rosy Cheeks)'),
    ('beard', r'Beard|Mustache|Goat|Chinstrap|Muttonchops|Handlebars|Stubble'),
    ('lips', r'Lipstick'),
    ('eye makeup', r'Eye Shadow|Clown Eyes'),
    ('neck', r'Choker|Chain'),
    ('ears', r'Earring'),
    ('head', r'Hair|Afro|Bob|Buzz Cut|Cap|Hat|Beanie|Bandana|Hood|Headband|Mohawk|Tiara|Crown|Fedora|Do-rag|Pigtails|Beret|Horns'
             r'|Half Shaved|Short|Straight|Stringy|Tassle|Peak|Frumpy|Crazy|Wild|Messy|Bow'),
    ('eyes', r'Glasses|Shades|Eye Mask|Eye Patch|^VR|Laser Eyes'),
    ('nose', r'Clown Nose'),
    ('mouth', r'Cigarette|Cigar|Pipe|Vape|Medical Mask|Bubble Gum|Buck Teeth'),
]
CLASSIC = re.compile(r'B&W|\(Natural\)|Flipped|°|^(Eyebrows|Eyes|Mouth|Nose|Smile|Frown)')  # (none of the sheet's variants nor its face parts)

rows = read_png(sys.argv[1])
sprites = []
for line in open(sys.argv[2], encoding='utf-8').read().strip().split('\n')[1:]:
    f = [x.strip() for x in line.split(',')]
    sprites.append({'id': int(f[0]), 'name': f[1], 'gender': f[2], 'size': f[3].split(' ')[0], 'type': f[4]})

def pixels(s):  # a sprite's 24 x 24 RGBA
    x0, y0 = (s['id'] % COLUMNS) * SIZE, (s['id'] // COLUMNS) * SIZE
    return [[tuple(rows[y0 + y][(x0 + x) * 4:(x0 + x) * 4 + 4]) for x in range(SIZE)] for y in range(SIZE)]

lum = lambda p: (0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]) / 255
diff = lambda p, q: (abs(p[0] - q[0]) + abs(p[1] - q[1]) + abs(p[2] - q[2])) / 765
SIDES = ((1, 0), (-1, 0), (0, 1), (0, -1))

def drawing(s):  # a sprite's lines and its own pixels, 72 bytes each, row by row
    px = pixels(s)
    at = lambda x, y: px[y][x] if 0 <= x < SIZE and 0 <= y < SIZE else (0, 0, 0, 0)
    lines, own = bytearray(72), bytearray(72)
    for y in range(SIZE):
        for x in range(SIZE):
            p = px[y][x]
            if not p[3]: continue
            bit = 128 >> (x & 7)
            own[(SIZE * y + x) >> 3] |= bit
            near = [at(x + dx, y + dy) for dx, dy in SIDES]
            if any(not q[3] for q in near) or lum(p) < 0.18 or any(q[3] and diff(p, q) > APART and lum(p) <= lum(q) for q in near):
                lines[(SIZE * y + x) >> 3] |= bit
    return bytes(lines + own)

drawings, drawingOf = [], {}
def drawingId(s):  # its drawing's number: sprites drawn alike, one
    d = drawing(s)
    if d not in drawingOf: drawingOf[d] = len(drawings); drawings.append(d)
    return drawingOf[d]

heads, count = {}, 0
for head in ('l', 's'):
    gender = 'm' if head == 'l' else 'f'
    archetypes = sorted({drawingId(next(s for s in sprites if s['type'].startswith('Archetype') and s['name'] == n)) for n in ARCHETYPES[head]})
    fits = [s for s in sprites if s['type'] == 'Attribute' and not CLASSIC.search(s['name'])
            and s['size'] in (head, 'u') and s['gender'] in ('u', gender)]
    cats, taken = [], set()  # (a drawing in one category only, the first that takes it: a punk's layers one way only)
    for _, names in CATEGORIES:
        cats.append(sorted({drawingId(s) for s in fits if re.search(names, s['name'])} - taken))
        taken |= set(cats[-1])
    heads[head] = {'archetypes': archetypes, 'categories': cats}
    n = len(archetypes)
    for c in cats: n *= len(c) + 1  # (each category: one of its drawings, or none)
    count += n
assert count < 2 ** 53, count  # (a punk's number exact in a double)

with open('punkgen.js', 'w') as o:
    head = (f"Punks generated from the CC0 sprite sheet of openpunkart/punkart.spritesheet (see tools/punkgen.py): each sprite's "
            "black and white drawing (72 bytes of lines, 72 of its own pixels, base64), the sprites drawn alike as one; per head (l a man's, s a woman's) its archetypes' drawings and each category's ("
            + ', '.join(c for c, _ in CATEGORIES) + f"); {count:,} punks")
    o.write(''.join('// ' + line + '\n' for line in textwrap.wrap(head, 117)))
    o.write('const PUNK_DRAWINGS = "' + ' '.join(base64.b64encode(d).decode() for d in drawings) + '".split(" ");\n')
    o.write('const PUNK_HEADS = ' + str([heads['l'], heads['s']]).replace("'", '"').replace(' ', '') + ';\n')
print(len(drawings), 'drawings,', f'{count:,}', 'punks')
