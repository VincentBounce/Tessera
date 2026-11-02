// Two movers meeting on the hexagons: deno run --allow-read --allow-write collide.js [file] [indices] [workers]
// The hex creatures of a result file (out/creatures.json by default; Lenia or Flow Lenia; indices: e.g. 0,4,8; all by
// default), every pair of one rule (a world has one: a creature and itself, two of a rule found together): the second
// turned by sixths (exact on hexagons: (q, r) → (−r, q + r)) to head 60°, 120° or 180° off the first's way, as near as
// its own heading allows, set off so that both reach the same point at once, its path shifted aside by −½ to ½ of its
// size; played on through the meeting; what became of them: died, filled, one, two, or more pieces, their mass beside
// the first's. Out: out/collide-<file> (view.html#from=out/collide-<file>&i=K)
import { space, world, measure } from './core.js';
const FILE = Deno.args[0] ?? 'creatures.json', P = Number(Deno.args[2] ?? 9), all = JSON.parse(Deno.readTextFileSync(new URL(`./out/${FILE}`, import.meta.url)));
const picks = Deno.args[1] ? Deno.args[1].split(',').map(Number) : all.map((o, i) => i).filter((i) => (all[i].space ?? 'hex') === 'hex');
const rot = ([q, r], k) => { for (let i = 0; i < k; i++) [q, r] = [-r, q + r]; return [q, r]; };
const turn = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
// A creature: its setting, its cells as axial offsets from its centre, its mass, size, speed and heading (100 steps alone)
const creatures = picks.map((i) => {
  const { cells: _, ...c } = all[i], N0 = Math.sqrt(all[i].cells.length), S0 = space('hex', N0), W0 = world(S0, c);
  W0.A = Float32Array.from(all[i].cells, (v) => v / 255);
  const m = measure(W0), q0 = Math.round(m.u * N0), r0 = Math.round(m.v * N0), wrap = (d) => ((((d % N0) + N0 + N0 / 2) % N0) - N0 / 2);
  const body = [];
  for (let k = 0; k < W0.n; k++) if (W0.A[k] > 0.001) body.push([wrap((k % N0) - q0), wrap(Math.floor(k / N0) - r0), W0.A[k]]);
  for (let t = 0; t < 100; t++) W0.step();
  const m1 = measure(W0);
  const wd = ((((m1.u - m.u) % 1) + 1.5) % 1) - 0.5, vd = ((((m1.v - m.v) % 1) + 1.5) % 1) - 0.5, head = [wd * S0.pa[0] + vd * S0.pb[0], vd * S0.pb[1]];
  const len = Math.hypot(...head);
  return { i, c, body, m: m.m, dir: [head[0] / len, head[1] / len], size: 2 * m.rg + c.R };
});
const rule = (o) => JSON.stringify([o.c.R, o.c.beta, o.c.mu, o.c.sigma, o.c.kernels, o.c.dt, o.c.flow]);
const jobs = [];
for (const [x, A0] of creatures.entries()) for (const B0 of creatures.slice(x)) {
  if (rule(A0) !== rule(B0)) continue;
  const c = A0.c, size = Math.max(A0.size, B0.size), N = Math.max(64, Math.ceil(size * 4));
  const tm = Math.max(...[A0, B0].map((o) => (o.size * 1.2) / o.c.speed)), T = Math.round(tm) + 2000;
  for (const k of [1, 2, 3]) for (const b of [-0.5, -0.25, 0, 0.25, 0.5]) {
    // B turned by the sixths that bring its heading nearest k sixths off A's
    const want = Math.atan2(...turn(A0.dir, (k * Math.PI) / 3).reverse()), own = Math.atan2(B0.dir[1], B0.dir[0]);
    const kb = (((Math.round((want - own) / (Math.PI / 3)) % 6) + 6) % 6), dirB = turn(B0.dir, (kb * Math.PI) / 3);
    const X = [N * 0.75, N * 0.433], A = new Array(N * N).fill(0), LA = A0.c.speed * tm, LB = B0.c.speed * tm;
    // A world point → the nearest cell, a body laid there (turned by k sixths)
    const lay = (body, x, y, k) => {
      const r = Math.round(y / (Math.sqrt(3) / 2)), q = Math.round(x - r / 2);
      for (const [dq, dr, v] of body) { const [a, b] = rot([dq, dr], k), cq = (((q + a) % N) + N) % N, cr = (((r + b) % N) + N) % N; A[cr * N + cq] = Math.max(A[cr * N + cq], v); }
    };
    lay(A0.body, X[0] - LA * A0.dir[0], X[1] - LA * A0.dir[1], 0);
    lay(B0.body, X[0] - LB * dirB[0] - b * B0.size * dirB[1], X[1] - LB * dirB[1] + b * B0.size * dirB[0], kb);
    const who = A0 === B0 ? '' : ` × ${B0.c.name || 'Creature'} ${B0.c.live}`;
    jobs.push({ p: { ...c, keep: false, space: 'hex', N, name: `${c.name || 'Creature'} ${c.live}${who} × turned ${k * 60}° shifted ${b}`, from: A0.i, with: B0.i, turn: k * 60, shift: b, one: +A0.m.toFixed(2) }, N, T, cells: A });
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
out.sort((a, b) => a.from - b.from || a.with - b.with || a.turn - b.turn || a.shift - b.shift);
for (const o of out) o.name += ' → ' + verdict(o);
Deno.writeTextFileSync(new URL(`./out/collide-${FILE}`, import.meta.url), JSON.stringify(out));
out.forEach((o, i) => console.log(i, o.name));
console.log(Math.round((Date.now() - t0) / 1000) + 's');
