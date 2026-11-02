// The gathered movers played on: deno run --allow-read --allow-write confirm.js [steps] [workers]
// Each creature of out/creatures.json run again from its kept cells (10,000 steps by default); kept when still one
// piece, steady and moving, its cells then the ones kept. Rewrites out/creatures.json (gather.js first)
const T = Number(Deno.args[0] ?? 10000), P = Number(Deno.args[1] ?? 9), file = new URL('./out/creatures.json', import.meta.url);
const list = JSON.parse(Deno.readTextFileSync(file));
const workers = Array.from({ length: P }, () => new Worker(new URL('./worker.js', import.meta.url).href, { type: 'module' }));
let next = 0;
const out = [];
await Promise.all(workers.map((w) => new Promise((res) => { const go = () => { if (next >= list.length) return res(); const i = next++, o = list[i]; w.onmessage = ({ data }) => { const r = data.out; console.log(i, o.space ?? 'hex', o.name ?? '', 'R', o.R, r.end, r.t, r.pieces, r.cv, r.speed); if (r.end === 'alive' && r.pieces === 1 && r.cv < 0.05 && r.speed > 0.02) out.push({ ...r, from: o.from, i }); go(); }; w.postMessage({ id: 0, p: { ...o, cells: undefined, keep: true }, N: o.N ?? Math.sqrt(o.cells.length), T, cells: o.cells.map((v) => v / 255) }); }; go(); })));
workers.forEach((w) => w.terminate());
out.sort((a, b) => a.i - b.i);
Deno.writeTextFileSync(file, JSON.stringify(out.map(({ i, ...o }) => o)));
console.log(list.length, '→', out.length, 'confirmed');
