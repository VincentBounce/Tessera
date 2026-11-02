// Each piece of a result alone: deno run --allow-read --allow-write isolate.js files [speed] [workers]
// (files: e.g. search-flow-hex-7.json,search-plantec-hex-3.json in out/). On Flow Lenia matter often parts into several
// creatures going their ways, their common centre hardly moving: the results whose centre moved at all (speed above
// `speed`, 0.005), their last cells cut into pieces (cells > 0.01 touching, mass above 5), each piece played alone
// 1,500 steps on the hexagons; kept: still one piece, moving. Out: out/flow-creatures.json (view.html#from=…&i=K)
import { space } from './core.js';
const files = Deno.args[0].split(','), MIN = Number(Deno.args[1] ?? 0.005), P = Number(Deno.args[2] ?? 9), jobs = [];
for (const f of files) for (const o of JSON.parse(Deno.readTextFileSync(new URL(`./out/${f}`, import.meta.url)))) {
  if (!o.cells || !(o.speed > MIN) || (o.space ?? 'hex') !== 'hex') continue;
  const N = Math.sqrt(o.cells.length), S = space('hex', N), A = o.cells.map((v) => v / 255), seen = new Uint8Array(S.n), { start, list } = S.adj;
  for (let c = 0; c < S.n; c++) {
    if (seen[c] || A[c] <= 0.01) continue;
    const piece = [c], st = [c];
    seen[c] = 1;
    while (st.length) { const x = st.pop(); for (let k = start[x]; k < start[x + 1]; k++) { const y = list[k]; if (!seen[y] && A[y] > 0.01) { seen[y] = 1; st.push(y); piece.push(y); } } }
    if (piece.reduce((s, x) => s + A[x], 0) < 5) continue;
    const cells = new Array(S.n).fill(0);
    for (const x of piece) cells[x] = A[x];
    const { cells: _, ...p } = o;
    jobs.push({ p: { ...p, keep: true, from: f }, N, T: 1500, cells });
  }
}
console.log(jobs.length, 'pieces');
const workers = Array.from({ length: P }, () => new Worker(new URL('./worker.js', import.meta.url).href, { type: 'module' }));
let next = 0;
const out = [], t0 = Date.now();
await Promise.all(workers.map((w) => new Promise((res) => { const go = () => { if (next >= jobs.length) return res(); const j = jobs[next++]; w.onmessage = ({ data }) => { const o = data.out; if (o.pieces === 1 && o.speed > 0.02) out.push(o); go(); }; w.postMessage({ id: 0, ...j }); }; go(); })));
workers.forEach((w) => w.terminate());
out.sort((a, b) => a.live - b.live);
Deno.writeTextFileSync(new URL('./out/flow-creatures.json', import.meta.url), JSON.stringify(out));
out.forEach((o, i) => console.log(i, o.from, 'live', o.live, 'mass', o.mass, 'rg', o.rg, 'speed', o.speed));
console.log(out.length, 'creatures', Math.round((Date.now() - t0) / 1000) + 's');
