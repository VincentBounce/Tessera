// grow.js's worker: one disc, a list of rules, each a Duel from two sprouts followed (see grow.js)
import { parse, duelStep } from '../kitesearch/engine.js';
import { patchGrid } from './patch.js';
import { patchOf } from './discs.js';
const grids = {};
// the disc (its walls none of the sprouts'), each cell's middle from the disc's middle
const gridOf = (kind, W) => grids[`${kind}|${W}`] ??= (() => {
  const h = patchOf(kind, W), G = patchGrid(h, W), o = (W - 1) / 2, dead = new Set(h.dead);
  const mid = h.polys.map((p) => [p.reduce((s, q) => s + q[0], 0) / p.length - o, p.reduce((s, q) => s + q[1], 0) / p.length - o]);
  const open = [...Array(G.n).keys()].filter((t) => !dead.has(t) && G.start[t] < G.start[t + 1]);
  return { G, mid, open, W };
})();
// a run: two sprouts (the cells within 5.5 of a point a fifth of the disc's width left and right of its middle, 45 % alive,
// red and blue) played gens generations; sampled every 10: each colour's count, the share of a live cell's live neighbours
// of its own colour (compactness), the cells changed
function run({ G, mid, open, W }, B, S, C, seedv, gens) {
  const n = G.n, live = (v) => v === 1 || v === 2;
  let s = seedv * 7919 + 13; const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  let a = new Uint8Array(n), b = new Uint8Array(n);
  for (const t of open) for (const [k, x] of [[1, -W / 5], [2, W / 5]]) if (Math.hypot(mid[t][0] - x, mid[t][1]) < 5.5 && rnd() < 0.45) a[t] = k;
  const pop0 = a.reduce((x, v) => x + (live(v) ? 1 : 0), 0), pops = [pop0], compact = [];
  let gain = 0, late = 0, prev = pop0, both = true;
  for (let g = 1; g <= gens; g++) {
    const [p1, p2] = duelStep(a, b, G, B, S, C);
    let changed = 0;
    if (g > gens / 2) for (let t = 0; t < n; t++) if (a[t] !== b[t]) changed++;
    [a, b] = [b, a];
    const pop = p1 + p2;
    gain = Math.max(gain, (pop - prev) / n);
    prev = pop;
    late += changed;
    if (g > gens / 2 && (!p1 || !p2)) both = false;
    if (!pop) return { pop0, pops, dead: g };
    if (pop > 0.98 * open.length && g < 100) return { pop0, pops, burst: g };  // (filled at once: no slow growth)
    if (g % 10 === 0) {
      pops.push(pop);
      if (g >= 200) {
        let same = 0, nb = 0;
        for (let t = 0; t < n; t++) if (live(a[t])) for (let q = G.start[t]; q < G.start[t + 1]; q++) { const u = a[G.list[q]]; if (live(u)) { nb++; if (u === a[t]) same++; } }
        compact.push(nb ? same / nb : 0);
      }
    }
  }
  return { pop0, pops, gain, compact: compact.length ? compact.reduce((x, y) => x + y, 0) / compact.length : 0, moving: late / (gens / 2) / n, both };
}
self.onmessage = ({ data: { kind, W, rules, gens, seeds } }) => {
  const D = gridOf(kind, W), out = [];
  for (const rule of rules) {
    const { B, S, C } = parse(rule);
    out.push({ rule, runs: Array.from({ length: seeds }, (_, k) => run(D, B, S, C, k + 1, gens)) });
  }
  self.postMessage(out);
};
