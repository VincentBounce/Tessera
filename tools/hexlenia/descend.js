// A hex creature walked down in radius: deno run --allow-read --allow-write descend.js file index [step] [workers]
// From a creature a result file kept (moving), R' = R − step each time: its cells resampled smaller (sampleRows, then
// placeRows), μ × 0.85…1.15, σ × 0.7…1.4 and dt × 0.5, 1 (7 × 7 × 2); kept: one piece, steady mass, moving, the
// nearest to the last; on from its cells. Stops when none moves. Out: out/descend-<name>.json, a creature a radius
import { space, world, measure, sampleRows, placeRows } from './core.js';
const [file, idx, step = '0.5', P = '9'] = Deno.args;
let cur = JSON.parse(Deno.readTextFileSync(file))[+idx];
const N = 64, MU = [0.85, 0.9, 0.95, 1, 1.05, 1.1, 1.15], SIG = [0.7, 0.8, 0.9, 1, 1.12, 1.25, 1.4], DT = [1, 0.5];
const workers = Array.from({ length: +P }, () => new Worker(new URL('./worker.js', import.meta.url).href, { type: 'module' }));
const runAll = (jobs) => { let next = 0; const out = []; return Promise.all(workers.map((w) => new Promise((res) => { const go = () => { if (next >= jobs.length) return res(); const j = jobs[next++]; w.onmessage = ({ data }) => { out.push(data.out); go(); }; w.postMessage({ id: 0, ...j }); }; go(); }))).then(() => out); };
const chain = [cur];
while (cur.R - +step >= 1) {
  const R = +(cur.R - +step).toFixed(2), W0 = world(space(cur.space ?? 'hex', cur.N ?? Math.sqrt(cur.cells.length)), { ...cur, R: 1 });
  W0.A = Float32Array.from(cur.cells, (v) => v / 255);
  const s = measure(W0), W = world(space(cur.space ?? 'hex', N), { ...cur, R: 1 });
  placeRows(W, sampleRows(W0, s.u, s.v, Math.ceil(cur.R * 16), 0.25), (0.25 * R) / cur.R);
  const cells = Array.from(W.A), jobs = [];
  for (const a of MU) for (const b of SIG) for (const c of DT) jobs.push({ p: { R, beta: cur.beta, mu: +(cur.mu * a).toFixed(4), sigma: +(cur.sigma * b).toFixed(4), dt: +(cur.dt * c).toFixed(3), name: cur.name, off: Math.abs(Math.log(a)) + Math.abs(Math.log(b)) + Math.abs(Math.log(c)), keep: true }, N, T: 3000, cells });
  const ok = (await runAll(jobs)).filter((o) => o.end === 'alive' && o.pieces === 1 && o.cv < 0.05 && o.speed > 0.02).sort((a, b) => a.off - b.off);
  console.log(`R ${R}: ${ok.length} movers` + (ok[0] ? ` · μ ${ok[0].mu} σ ${ok[0].sigma} dt ${ok[0].dt} live ${ok[0].live} mass ${ok[0].mass} speed ${ok[0].speed}` : ''));
  if (!ok.length) break;
  cur = ok[0]; chain.push(cur);
}
workers.forEach((w) => w.terminate());
Deno.writeTextFileSync(new URL(`./out/descend-${cur.name.split(' ')[0].toLowerCase()}.json`, import.meta.url), JSON.stringify(chain));
