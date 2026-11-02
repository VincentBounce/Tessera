// Each piece of a result alone: deno run --allow-read --allow-write isolate.js files [speed] [workers] [pieces] [out]
// (files: e.g. search-flow-hex-7.json,search-plantec-hex-3.json in out/). On Flow Lenia matter often parts into several
// creatures going their ways, their common centre hardly moving: the results whose centre moved at all (speed above
// `speed`, 0.005) and in `pieces` pieces or more (1), their last cells cut into pieces (cells > 0.01 touching, mass above
// 5), each piece played alone 1,500 steps on the hexagons; kept: still one piece, moving, with the result it came from
// (from: its file, at: its place there). A meeting's file (collide-…) keeps its start: played to its end first.
// Out: out/<out> (flow-creatures.json; view.html#from=…&i=K)
import { space } from './core.js';
const files = Deno.args[0].split(','), MIN = Number(Deno.args[1] ?? 0.005), P = Number(Deno.args[2] ?? 9), PIECES = Number(Deno.args[3] ?? 1), OUT = Deno.args[4] ?? 'flow-creatures.json';
const workers = Array.from({ length: P }, () => new Worker(new URL('./worker.js', import.meta.url).href, { type: 'module' }));
// Runs on the workers, each job's result in its place
const pool = async (jobs) => {
  const done = new Array(jobs.length);
  let next = 0;
  await Promise.all(workers.map((w) => new Promise((res) => { const go = () => { if (next >= jobs.length) return res(); const k = next++; w.onmessage = ({ data }) => { done[k] = data.out; go(); }; w.postMessage({ id: 0, ...jobs[k] }); }; go(); })));
  return done;
};
const t0 = Date.now(), picked = [];
for (const f of files) JSON.parse(Deno.readTextFileSync(new URL(`./out/${f}`, import.meta.url))).forEach((o, at) => {
  if (o.cells && o.speed > MIN && o.pieces >= PIECES && (o.space ?? 'hex') === 'hex') picked.push({ o, f, at });
});
// A meeting's last cells: played again from its start
const replay = picked.filter(({ f }) => f.startsWith('collide-'));
(await pool(replay.map(({ o }) => ({ p: { ...o, cells: undefined, keep: true }, N: o.N, T: o.t, cells: o.cells.map((v) => v / 255) })))).forEach((e, k) => { replay[k].last = e.cells; });
const jobs = [];
picked.forEach(({ o, f, at, last }) => {
  const cells0 = last ?? o.cells;
  const N = Math.sqrt(cells0.length), S = space('hex', N), A = cells0.map((v) => v / 255), seen = new Uint8Array(S.n), { start, list } = S.adj;
  for (let c = 0; c < S.n; c++) {
    if (seen[c] || A[c] <= 0.01) continue;
    const piece = [c], st = [c];
    seen[c] = 1;
    while (st.length) { const x = st.pop(); for (let k = start[x]; k < start[x + 1]; k++) { const y = list[k]; if (!seen[y] && A[y] > 0.01) { seen[y] = 1; st.push(y); piece.push(y); } } }
    if (piece.reduce((s, x) => s + A[x], 0) < 5) continue;
    const cells = new Array(S.n).fill(0);
    for (const x of piece) cells[x] = A[x];
    const { cells: _, ...p } = o;
    jobs.push({ p: { ...p, keep: true, N, from: f, at }, N, T: 1500, cells });
  }
});
console.log(picked.length, 'results', jobs.length, 'pieces');
const out = (await pool(jobs)).filter((o) => o.pieces === 1 && o.speed > 0.02);
workers.forEach((w) => w.terminate());
out.sort((a, b) => a.live - b.live);
Deno.writeTextFileSync(new URL(`./out/${OUT}`, import.meta.url), JSON.stringify(out));
out.forEach((o, i) => console.log(i, o.from, o.at, 'live', o.live, 'mass', o.mass, 'rg', o.rg, 'speed', o.speed));
console.log(out.length, 'creatures', Math.round((Date.now() - t0) / 1000) + 's');
