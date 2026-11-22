// The Klein bottle's icon: the silhouette of the app's first Klein bottle shape (Basic) seen from the south, computed by the
// app itself in a tab of tools/browser.js's browser (kleinOnBottle: no copy of its equations here): on a fine grid of its
// sheet, the points where its surface turns from facing the view to facing away (its normal square to the view, the
// zero of its y part, by marching squares), kept where nothing lies in front (its triangles along its ray), chained
// into lines, simplified (Douglas–Peucker) and fitted in 24 × 24 (2 to 22).
// Written into main.js's ICONS (the line `const klein = svgPath('…')`): run again after the bottle changes.
//   BROWSER_PORT=9451 node tools/klein_icon.mjs <tab>      (a tab of the app open: its id, see tools/browser.js tabs)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)),
  tab = process.argv[2];
if (!tab) throw new Error('a tab of the app: node tools/klein_icon.mjs <tab>');

// in the page: the silhouette's lines, each a list of [x, z] (east, up), as the bottle is drawn
const inPage = `(() => {
  const was = ringShape.klein;
  ringShape.klein = 0;
  const NS = 600, NU = 240, h = 1e-4,
    P = (x, y) => kleinOnBottle(x, y, 1, 1, 0),
    normal = (x, y) => cross(sub(P(x + h, y), P(x - h, y)), sub(P(x, y + h), P(x, y - h)));
  const pts = [], f = [];
  for (let i = 0; i <= NS; i++) {
    pts.push([]); f.push([]);
    for (let j = 0; j <= NU; j++) {
      const p = P(i / NS, j / NU), n = normal(i / NS, j / NU);
      pts[i].push(p);
      f[i].push(n[1] / (Math.hypot(...n) || 1));
    }
  }
  // what lies in front of a point, seen from the south (y: the nearer, the less): its triangles bucketed by where they fall
  // on the view (x, z), each one met along the point's ray in front of it hiding it; none near it in space (its own sheet, a
  // silhouette's depth changing at once beside it)
  let lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
  for (const row of pts) for (const p of row) { lo = [Math.min(lo[0], p[0]), Math.min(lo[1], p[2])]; hi = [Math.max(hi[0], p[0]), Math.max(hi[1], p[2])]; }
  const G = 120, cell = Math.max(hi[0] - lo[0], hi[1] - lo[1]) / (G - 1),
    bucket = (x, z) => Math.floor((z - lo[1]) / cell) * G + Math.floor((x - lo[0]) / cell),
    buckets = Array.from({ length: G * G }, () => []),
    tris = [];
  for (let i = 0; i < NS; i++)
    for (let j = 0; j < NU; j++)
      for (const t of [[pts[i][j], pts[i + 1][j], pts[i + 1][j + 1]], [pts[i][j], pts[i + 1][j + 1], pts[i][j + 1]]]) {
        const k = tris.push(t) - 1,
          [x0, x1] = [Math.min(...t.map((p) => p[0])), Math.max(...t.map((p) => p[0]))],
          [z0, z1] = [Math.min(...t.map((p) => p[2])), Math.max(...t.map((p) => p[2]))];
        for (let z = z0; z <= z1 + cell; z += cell) for (let x = x0; x <= x1 + cell; x += cell) { const b = bucket(Math.min(x, x1), Math.min(z, z1)); if (buckets[b] && buckets[b].at(-1) !== k) buckets[b].push(k); }
      }
  const near = 0.06,
    seen = (p) => (buckets[bucket(p[0], p[2])] ?? []).every((k) => {
      const [a, b, c] = tris[k];
      if ([a, b, c].some((v) => Math.hypot(v[0] - p[0], v[1] - p[1], v[2] - p[2]) < near)) return true;
      const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
      if (!d) return true;
      const l1 = ((b[2] - c[2]) * (p[0] - c[0]) + (c[0] - b[0]) * (p[2] - c[2])) / d,
        l2 = ((c[2] - a[2]) * (p[0] - c[0]) + (a[0] - c[0]) * (p[2] - c[2])) / d,
        l3 = 1 - l1 - l2;
      return l1 < 0 || l2 < 0 || l3 < 0 || l1 * a[1] + l2 * b[1] + l3 * c[1] >= p[1];
    });
  // its contour: the zero of f on each cell's edges, a segment each cell crossed
  const cut = (i0, j0, i1, j1) => { const a = f[i0][j0], b = f[i1][j1], t = a / (a - b), p = pts[i0][j0], q = pts[i1][j1]; return p.map((v, d) => v + (q[d] - v) * t); };
  const segments = [];
  for (let i = 0; i < NS; i++)
    for (let j = 0; j < NU; j++) {
      const c = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]], hits = [];
      for (let e = 0; e < 4; e++) { const [p, q] = [c[e], c[(e + 1) % 4]]; if ((f[p[0]][p[1]] < 0) !== (f[q[0]][q[1]] < 0)) hits.push(cut(...p, ...q)); }
      for (let k = 0; k + 1 < hits.length; k += 2) {
        const [a, b] = [hits[k], hits[k + 1]], m = a.map((v, d) => (v + b[d]) / 2);
        if (seen(m)) segments.push([[a[0], a[2]], [b[0], b[2]]]);
      }
    }
  ringShape.klein = was;
  return segments.map((s) => s.flat().map((v) => v.toFixed(4)).join(',')).join(';'); // (one short line: a long JSON is cut)
})()`;
const out = execFileSync('node', [path.join(here, 'browser.js'), 'eval', tab, inPage], {
  env: process.env,
  maxBuffer: 1 << 28,
}).toString();
const segments = JSON.parse(out)
  .split(';')
  .map((s) => s.split(',').map(Number))
  .map(([a, b, c, d]) => [
    [a, b],
    [c, d],
  ]);

// chained into lines by their ends (rounded), then fitted in 24 × 24 and simplified
const key = ([x, z]) => `${Math.round(x * 1e4)},${Math.round(z * 1e4)}`,
  ends = new Map();
segments.forEach((s, i) => s.forEach((p) => ends.set(key(p), [...(ends.get(key(p)) ?? []), i])));
const used = new Set(),
  lines = [];
for (let i = 0; i < segments.length; i++) {
  if (used.has(i)) continue;
  used.add(i);
  const line = [...segments[i]];
  // (grown from its last end, then from its first, while an unused segment meets it there)
  for (const [tip, add] of [
    [() => line[line.length - 1], (p) => line.push(p)],
    [() => line[0], (p) => line.unshift(p)],
  ])
    for (;;) {
      const end = tip(),
        next = (ends.get(key(end)) ?? []).find((k) => !used.has(k));
      if (next === undefined) break;
      used.add(next);
      const [a, b] = segments[next];
      add(key(a) === key(end) ? b : a);
    }
  lines.push(line);
}
const all = lines.flat(),
  [x0, x1] = [Math.min(...all.map((p) => p[0])), Math.max(...all.map((p) => p[0]))],
  [z0, z1] = [Math.min(...all.map((p) => p[1])), Math.max(...all.map((p) => p[1]))],
  S = 20 / Math.max(x1 - x0, z1 - z0),
  at = ([x, z]) => [12 + (x - (x0 + x1) / 2) * S, 12 - (z - (z0 + z1) / 2) * S];
const simplify = (P, tol) => {
  if (P.length < 3) return P;
  const [a, b] = [P[0], P[P.length - 1]],
    len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  let far = 0,
    at = 0;
  for (let i = 1; i < P.length - 1; i++) {
    const d = Math.abs((b[0] - a[0]) * (a[1] - P[i][1]) - (a[0] - P[i][0]) * (b[1] - a[1])) / len;
    if (d > far) [far, at] = [d, i];
  }
  return far > tol ? [...simplify(P.slice(0, at + 1), tol).slice(0, -1), ...simplify(P.slice(at), tol)] : [a, b];
};
const icon = lines
  .map((l) => simplify(l.map(at), 0.04))
  .filter((l) => l.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - l[i][0], p[1] - l[i][1]), 0) > 0.5) // (crumbs left out)
  .map((l) => `M${l.map((p) => p.map((v) => +v.toFixed(2)).join(' ')).join('L')}`)
  .join('');
const main = path.join(here, '..', 'main.js'),
  source = fs.readFileSync(main, 'utf8'),
  line = /const klein = svgPath\(\s*'[^']*',?\s*\);/;
if (!line.test(source)) throw new Error("main.js: no `const klein = svgPath('…')`");
fs.writeFileSync(main, source.replace(line, `const klein = svgPath(\n    '${icon}',\n  );`)); // (as Prettier leaves it)
console.log(lines.length, 'lines,', icon.length, 'characters');
