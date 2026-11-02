// Chan's single-kernel species laid on the hexagons, smaller and smaller: deno run --allow-read transfer.js [workers]
// Each scaled from its R to R' (hex cells), its μ, σ and T kept; run 3,000 steps on a 64 torus: does it live, move?
import { world, decodeRLE, placeSquare } from './core.js';
const P = Number(Deno.args[0] ?? 9), t = Deno.readTextFileSync(new URL('../../lenia/species.js', import.meta.url));
const zoo = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)).single.filter((s) => s.kernels.length === 1 && s.cells.length === 1);
const jobs = [];
for (const s of zoo) for (const R of [13, 10, 8, 7, 6, 5, 4, 3]) {
  const k = s.kernels[0], p = { R, beta: k.b.split(',').map((x) => eval(x)), mu: k.m, sigma: k.s, dt: 1 / s.T, name: s.name || s.code };
  const W = world(64, p);
  placeSquare(W, decodeRLE(s.cells[0]), R / s.R);
  jobs.push({ p, cells: Array.from(W.A) });
}
const workers = Array.from({ length: P }, () => new Worker(new URL('./worker.js', import.meta.url).href, { type: 'module' }));
let next = 0;
const out = [];
await Promise.all(workers.map((w) => new Promise((res) => {
  const go = () => {
    if (next >= jobs.length) return res();
    const j = jobs[next++];
    w.onmessage = ({ data }) => { out.push(data.out); go(); };
    w.postMessage({ id: 0, p: j.p, N: 64, T: 3000, cells: j.cells });
  };
  go();
})));
workers.forEach((w) => w.terminate());
out.sort((a, b) => a.name.localeCompare(b.name) || b.R - a.R);
for (const o of out) console.log(o.name.padEnd(20), 'R', String(o.R).padStart(2), o.end.padEnd(6), o.end === 'alive' ? `mass ${o.mass} cv ${o.cv} pieces ${o.pieces} rg ${o.rg} speed ${o.speed}` : `at ${o.t}`);
