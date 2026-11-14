#!/usr/bin/env python3
"""The Klein bottle's icon, drawn from the bottle itself: its profile in main.js (KLEIN_* and kleinProfile, kleinNeck),
seen from the side as the app shows it (its neck to the east): the body's outline, then the neck's two sides where they
lie outside the body. Written into main.js's ICONS (the line `const klein = svgPath('…')`), the constants read there:
run again after the bottle changes.

    python3 tools/klein_icon.py
"""
import math
import pathlib
import re

MAIN = pathlib.Path(__file__).resolve().parent.parent / 'main.js'
source = MAIN.read_text()


def constant(name):
    return float(re.search(rf'\b{name} = ([\d.]+)', source).group(1))


def table(name):
    return [float(v) for v in re.search(rf'const {name} = \[([^\]]+)\]', source).group(1).split(',')]


BOWL, WIDEST, BODY, PEAR, TUBE = (constant(n) for n in ('KLEIN_BOWL', 'KLEIN_WIDEST', 'KLEIN_BODY', 'KLEIN_PEAR', 'KLEIN_TUBE'))
NECK, SOFT = table('KLEIN_NECK'), table('KLEIN_SOFT')


# as main.js's kleinProfile: q along the body, the bowl [0, 1) then up [1, 2): its radius r and its height z
def profile(q):
    r = lambda c: TUBE + (WIDEST - TUBE) * c
    if q < 1:
        return r((1 - math.cos(math.pi * q)) / 2), -BOWL * math.sin(math.pi * q)
    return r((1 + math.cos(math.pi * (q - 1) ** PEAR)) / 2), BODY * (q - 1)


# as main.js's kleinLineOf and kleinNeck: the neck's line at t (x, z), the loop's then its rounded descent
def line_of(P, t):
    a, b, c, d, e, f, g = P
    w = t**3 * (1 - t) ** 3
    return w * (a + b * t + c * t * t), BODY * (1 - t) + t * (1 - t) * (d + e * t + f * t * t + g * t**3)


def neck(t):
    s = min(1, max(0, (t - 0.6) / 0.2))
    w = s**3 * (10 - 15 * s + 6 * s * s)
    p, q = line_of(NECK, t), line_of(SOFT, t)
    return p[0] + (q[0] - p[0]) * w, p[1] + (q[1] - p[1]) * w


# the body's outline, seen from the side: from its top down its west flank, across its lowest (q ½), up its east one to its
# top (open there: the neck goes on from it)
N = 24
flank = [profile(0.5 + 1.5 * i / N) for i in range(N + 1)]
body = [(-r, z) for r, z in reversed(flank)] + [(r, z) for r, z in flank]


def body_radius(z):  # (its outline's half width at height z, 0 beyond it)
    if z < -BOWL or z > BODY:
        return 0
    q = 1 - math.asin(min(1, -z / BOWL)) / math.pi if z < 0 else 1 + z / BODY
    return profile(q)[0]


# the neck's two sides, the tube's radius off its line (as kleinAt: its normal in the plane), cut where inside the body
sides = []
for e in (1, -1):
    run = []
    for i in range(81):
        t, h = i / 80, 1e-5
        A, B = neck(max(0, t - h)), neck(min(1, t + h))
        l = math.hypot(B[0] - A[0], B[1] - A[1])
        x, z = neck(t)
        p = (x + e * TUBE * (B[1] - A[1]) / l, z - e * TUBE * (B[0] - A[0]) / l)
        if abs(p[0]) < body_radius(p[1]) - 1e-9:
            if len(run) > 1:
                sides.append(run)
            run = []
        else:
            run.append(p)
    if len(run) > 1:
        sides.append(run)

# shown as the app shows it (x turned over: its neck east), y down, fitted into the icon's 24 square, 2 from its sides
points = body + [p for s in sides for p in s]
lo_x, hi_x = min(-x for x, _ in points), max(-x for x, _ in points)
lo_z, hi_z = min(z for _, z in points), max(z for _, z in points)
scale = 20 / max(hi_x - lo_x, hi_z - lo_z)
at = lambda x, z: f'{12 + (-x - (lo_x + hi_x) / 2) * scale:.1f} {12 - (z - (lo_z + hi_z) / 2) * scale:.1f}'
d = 'M' + 'L'.join(at(*p) for p in body) + ''.join('M' + 'L'.join(at(*p) for p in s) for s in sides)

line = f"const klein = svgPath(\n    '{d}',\n  ); // (made by tools/klein_icon.py from the bottle's profile: run it again as it changes)"
new, count = re.subn(r"const klein = svgPath\(\s*'[^']*',?\s*\);[^\n]*", line, source)  # (as Prettier lays it out)
assert count == 1, 'no `const klein = svgPath(…)` line in main.js'
MAIN.write_text(new)
print(f'klein icon: {len(body)} points of body, {len(sides)} pieces of neck, {len(d)} characters')
