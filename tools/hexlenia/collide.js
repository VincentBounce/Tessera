// Two movers meeting on the hexagons: deno run --allow-read --allow-write collide.js [file] [indices] [workers]
// Each hex creature of a result file (out/creatures.json by default; Lenia or Flow Lenia; indices: e.g. 0,4,8; all by
// default) and a copy of it turned by 60°, 120° or
// 180° (exact on hexagons: (q, r) → (−r, q + r)), set off so that both reach the same point at once, the copy's path
// shifted aside by −½ to ½ of the creature's size; played on through the meeting; what became of them: died, filled,
// one, two, or more pieces, their mass beside one creature's. Out: out/collide-<file> (view.html#from=out/collide-<file>&i=K)
import { space, world, measure } from './core.js';
const FILE = Deno.args[0] ?? 'creatures.json', P = Number(Deno.args[2] ?? 9), all = JSON.parse(Deno.readTextFileSync(new URL(`./out/${FILE}`, import.meta.url)));
const picks = Deno.args[1] ? Deno.args[1].split(',').map(Number) : all.map((o, i) => i).filter((i) => (all[i].space ?? 'hex') === 'hex');
const rot = ([q, r], k) => { for (let i = 0; i < k; i++) [q, r] = [-r, q + r]; return [q, r]; };
const jobs = [];
for (const i of picks) {
  const { cells: _, ...c } = all[i], N0 = Math.sqrt(all[i].cells.length), S0 = space('hex', N0), W0 = world(S0, c);
  W0.A = Float32Array.from(all[i].cells, (v) => v / 255);
  // Its cells as axial offsets from its centre, its mass, size and heading (100 steps alone)
  const m = measure(W0), q0 = Math.round(m.u * N0), r0 = Math.round(m.v * N0), wrap = (d) => ((((d % N0) + N0 + N0 / 2) % N0) - N0 / 2);
  const body = [];
  for (let k = 0; k < W0.n; k++) if (W0.A[k] > 0.001) body.push([wrap((k % N0) - q0), wrap(Math.floor(k / N0) - r0), W0.A[k]]);
  for (let t = 0; t < 100; t++) W0.step();
  const m1 = measure(W0);
  const wd = ((((m1.u - m.u) % 1) + 1.5) % 1) - 0.5, vd = ((((m1.v - m.v) % 1) + 1.5) % 1) - 0.5, head = [wd * S0.pa[0] + vd * S0.pb[0], vd * S0.pb[1]];
  const len = Math.hypot(...head), dir = [head[0] / len, head[1] / len], size = 2 * m.rg + c.R;
  const N = Math.max(64, Math.ceil(size * 4)), L = size * 1.2, T = Math.round(L / c.speed) + 2000;
  for (const k of [1, 2, 3]) for (const b of [-0.5, -0.25, 0, 0.25, 0.5]) {
    const a = (k * Math.PI) / 3, dirB = [dir[0] * Math.cos(a) - dir[1] * Math.sin(a), dir[0] * Math.sin(a) + dir[1] * Math.cos(a)];
    const X = [N * 0.75, N * 0.433], A = new Array(N * N).fill(0);
    // A world point → the nearest cell, the body laid there (turned by k sixths)
    const lay = (x, y, k) => {
      const r = Math.round(y / (Math.sqrt(3) / 2)), q = Math.round(x - r / 2);
      for (const [dq, dr, v] of body) { const [a, b] = rot([dq, dr], k), cq = (((q + a) % N) + N) % N, cr = (((r + b) % N) + N) % N; A[cr * N + cq] = Math.max(A[cr * N + cq], v); }
    };
    lay(X[0] - L * dir[0], X[1] - L * dir[1], 0);
    lay(X[0] - L * dirB[0] - b * size * dirB[1], X[1] - L * dirB[1] + b * size * dirB[0], k);
    jobs.push({ p: { ...c, keep: false, space: 'hex', N, name: `${c.name || 'Creature'} ${c.live} × turned ${k * 60}° shifted ${b}`, from: i, turn: k * 60, shift: b, one: +m.m.toFixed(2) }, N, T, cells: A });
  }
}
console.log(jobs.length, 'meetings');
const workers = Array.from({ length: P }, () => new Worker(new URL('./worker.js', import.meta.url).href, { type: 'module' }));
let next = 0;
const out = [], t0 = Date.now();
await Promise.all(workers.map((w) => new Promise((res) => { const go = () => { if (next >= jobs.length) return res(); const j = jobs[next++]; w.onmessage = ({ data }) => { const o = data.out; o.cells = j.cells.map((v) => Math.round(v * 255)); o.ratio = o.mass ? +(o.mass / o.one).toFixed(2) : 0; out.push(o); go(); }; w.postMessage({ id: 0, ...j }); }; go(); })));
workers.forEach((w) => w.terminate());
// What became of them: died, filled, or so many pieces, their mass in creatures
const verdict = (o) => (o.end !== 'alive' ? o.end : `${o.pieces} piece${o.pieces > 1 ? 's' : ''}, mass ×${o.ratio}${o.speed > 0.02 ? ' moving' : ' still'}`);
out.sort((a, b) => a.from - b.from || a.turn - b.turn || a.shift - b.shift);
for (const o of out) o.name += ' → ' + verdict(o);
Deno.writeTextFileSync(new URL(`./out/collide-${FILE}`, import.meta.url), JSON.stringify(out));
out.forEach((o, i) => console.log(i, o.name));
console.log(Math.round((Date.now() - t0) / 1000) + 's');
