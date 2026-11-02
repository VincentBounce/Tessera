// Around each mover, its neighbours in parameters: deno run --allow-read --allow-write local.js [tries] [workers]
// From out/creatures.json, each started from its own cells: R ± 0.5, μ × 0.9…1.1, σ × 0.8…1.25, dt 0.05 to 0.2, β kept;
// the movers found (smaller or faster ones the aim) into out/local.json, then gather.js again
import { mulberry32 } from './core.js';
const tries = Number(Deno.args[0] ?? 100), P = Number(Deno.args[1] ?? 9), rnd = mulberry32(7);
const base = JSON.parse(Deno.readTextFileSync(new URL('./out/creatures.json', import.meta.url))), jobs = [];
for (const c of base) for (let i = 0; i < tries; i++) {
  const N = Math.sqrt(c.cells.length), f = (lo, hi) => Math.exp(Math.log(lo) + rnd() * (Math.log(hi) - Math.log(lo)));
  jobs.push({ p: { R: +(c.R + (rnd() - 0.5)).toFixed(2), beta: c.beta, mu: +(c.mu * f(0.9, 1.1)).toFixed(4), sigma: +(c.sigma * f(0.8, 1.25)).toFixed(4), dt: [0.05, 0.1, 0.2][Math.floor(rnd() * 3)], name: c.name, keep: true }, N, T: 3000, cells: c.cells.map((v) => v / 255) });
}
const workers = Array.from({ length: P }, () => new Worker(new URL('./worker.js', import.meta.url).href, { type: 'module' }));
let next = 0;
const out = [], t0 = Date.now();
await Promise.all(workers.map((w) => new Promise((res) => { const go = () => { if (next >= jobs.length) return res(); const j = jobs[next++]; w.onmessage = ({ data }) => { const o = data.out; if (o.end === 'alive' && o.pieces === 1 && o.cv < 0.05 && o.speed > 0.02) out.push(o); go(); }; w.postMessage({ id: 0, ...j }); }; go(); })));
workers.forEach((w) => w.terminate());
const old = (() => { try { return JSON.parse(Deno.readTextFileSync(new URL('./out/local.json', import.meta.url))); } catch { return []; } })();
Deno.writeTextFileSync(new URL('./out/local.json', import.meta.url), JSON.stringify([...old, ...out]));
console.log(jobs.length, 'tries', Math.round((Date.now() - t0) / 1000) + 's', out.length, 'movers');
