// The movers carried onto other spaces: deno run --allow-read --allow-write port.js spaces [count] [workers]
// The `count` smallest movers of out/creatures.json on the hexagons, each sampled round its centre (sampleRows, pixels
// of a quarter unit) and laid on each space (spaces: e.g. cairo,demi10; about 4,000 cells) at the same R; μ × 0.85…1.15, σ × 0.7…1.4,
// dt × 0.5, 1 (7 × 7 × 2); kept: one piece, steady mass, moving. Out: out/port.json (added to), then gather.js
import { space, world, measure, sampleRows, placeRows } from './core.js';
import { tilingCells } from '../tilings/grid.js';
const spaces = Deno.args[0].split(','), count = Number(Deno.args[1] ?? 8), P = Number(Deno.args[2] ?? 9);
const base = JSON.parse(Deno.readTextFileSync(new URL('./out/creatures.json', import.meta.url))).filter((o) => (o.space ?? 'hex') === 'hex').slice(0, count);
const MU = [0.85, 0.9, 0.95, 1, 1.05, 1.1, 1.15], SIG = [0.7, 0.8, 0.9, 1, 1.12, 1.25, 1.4], DT = [1, 0.5], jobs = [];
for (const sp of spaces) {
  const N = Math.round(Math.sqrt(4096 / tilingCells(sp))), S = space(sp, N);
  for (const c of base) {
    const W0 = world(space('hex', Math.sqrt(c.cells.length)), { ...c, R: 1 });
    W0.A = Float32Array.from(c.cells, (v) => v / 255);
    const m = measure(W0), W = world(S, { ...c, R: 1 });
    placeRows(W, sampleRows(W0, m.u, m.v, Math.ceil(c.R * 16), 0.25), 0.25);
    const cells = Array.from(W.A);
    for (const a of MU) for (const b of SIG) for (const d of DT) jobs.push({ p: { R: c.R, beta: c.beta, mu: +(c.mu * a).toFixed(4), sigma: +(c.sigma * b).toFixed(4), dt: +(c.dt * d).toFixed(3), name: c.name, space: sp, N, keep: true }, N, T: 3000, cells });
  }
}
console.log(jobs.length, 'runs');
const workers = Array.from({ length: P }, () => new Worker(new URL('./worker.js', import.meta.url).href, { type: 'module' }));
let next = 0;
const out = [], t0 = Date.now();
await Promise.all(workers.map((w) => new Promise((res) => { const go = () => { if (next >= jobs.length) return res(); const j = jobs[next++]; w.onmessage = ({ data }) => { const o = data.out; if (o.end === 'alive' && o.pieces === 1 && o.cv < 0.05 && o.speed > 0.02) out.push(o); go(); }; w.postMessage({ id: 0, ...j }); }; go(); })));
workers.forEach((w) => w.terminate());
const file = new URL('./out/port.json', import.meta.url), old = (() => { try { return JSON.parse(Deno.readTextFileSync(file)); } catch { return []; } })();
Deno.writeTextFileSync(file, JSON.stringify([...old, ...out]));
for (const sp of spaces) console.log(sp, out.filter((o) => o.space === sp).length, 'movers', out.filter((o) => o.space === sp).sort((a, b) => a.live - b.live).slice(0, 3).map((o) => `R ${o.R} live ${o.live} speed ${o.speed}`).join(' · '));
console.log(Math.round((Date.now() - t0) / 1000) + 's');
