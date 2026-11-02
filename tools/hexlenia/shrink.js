// Chan's single-kernel species shrunk on the hexagons, μ and σ tuned again at each radius:
// deno run --allow-read --allow-write shrink.js [workers]. For each species and R' from 10 down to 2, its pattern laid
// at R' (from Chan's square cells), μ × 0.7…1.4 and σ × 0.5…2 (9 × 9), 3,000 steps on a 64 torus; kept: one piece,
// steady mass, moving (or turning for the gyrating ones), nearest to Chan's μ and σ. Out: out/shrink.json (cells kept)
import { space, world, decodeRLE, placeRows } from './core.js';
const P = Number(Deno.args[0] ?? 9), t = Deno.readTextFileSync(new URL('../../lenia/species.js', import.meta.url));
const zoo = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)).single.filter((s) => s.kernels.length === 1 && s.cells.length === 1);
const MU = [0.7, 0.8, 0.875, 0.95, 1, 1.05, 1.15, 1.25, 1.4], SIG = [0.5, 0.65, 0.8, 0.9, 1, 1.12, 1.3, 1.6, 2];
const jobs = [];
for (const s of zoo) for (const R of [10, 8, 7, 6, 5, 4, 3, 2]) {
  const k = s.kernels[0], W = world(space('hex', 64), { R, beta: [1], mu: 0, sigma: 1, dt: 0 });
  placeRows(W, decodeRLE(s.cells[0]), R / s.R);
  const cells = Array.from(W.A);
  for (const a of MU) for (const b of SIG) jobs.push({ p: { R, beta: k.b.split(',').map((x) => eval(x)), mu: +(k.m * a).toFixed(4), sigma: +(k.s * b).toFixed(4), dt: 1 / s.T, name: s.name || s.code, off: Math.abs(Math.log(a)) + Math.abs(Math.log(b)), keep: true }, cells });
}
console.log(jobs.length, 'runs');
const workers = Array.from({ length: P }, () => new Worker(new URL('./worker.js', import.meta.url).href, { type: 'module' }));
let next = 0;
const t0 = Date.now(), out = [];
await Promise.all(workers.map((w) => new Promise((res) => {
  const go = () => {
    if (next >= jobs.length) return res();
    const j = jobs[next++];
    w.onmessage = ({ data }) => { const o = data.out; if (o.end === 'alive' && o.pieces === 1 && o.cv < 0.05) out.push(o); if (next % 200 === 0) console.log(next, Math.round((Date.now() - t0) / 1000) + 's'); go(); };
    w.postMessage({ id: 0, p: j.p, N: 64, T: 3000, cells: j.cells });
  };
  go();
})));
workers.forEach((w) => w.terminate());
// The best a species and radius: moving first, then the nearest to Chan's
const best = {};
for (const o of out) { const key = `${o.name}|${o.R}`, b = best[key], mv = (x) => x.speed > 0.02; if (!b || mv(o) > mv(b) || (mv(o) === mv(b) && o.off < b.off)) best[key] = o; }
const list = Object.values(best).sort((a, b) => a.name.localeCompare(b.name) || b.R - a.R);
Deno.writeTextFileSync(new URL('./out/shrink.json', import.meta.url), JSON.stringify(list));
for (const [i, o] of list.entries()) console.log(i, o.name.padEnd(20), 'R', String(o.R).padStart(2), `μ ${o.mu} σ ${o.sigma} mass ${o.mass} live ${o.live} cv ${o.cv} rg ${o.rg} speed ${o.speed}`);
console.log(Math.round((Date.now() - t0) / 1000) + 's');
