// Two movers meeting on the hexagons: deno run --allow-read --allow-write collide.js [file] [indices] [workers]
// The hex creatures of a result file (out/creatures.json by default; Lenia or Flow Lenia; indices: e.g. 0,4,8; all by
// default), every pair of one rule (a world has one: a creature and itself, two of a rule found together): the second
// turned by sixths (layBody) to head 60°, 120° or 180° off the first's way, as near as its own heading allows, set off
// so that both reach the same point at once, its path shifted aside by −½ to ½ of its size; played on through the meeting; what became of them: died, filled, one, two, or more pieces, their mass beside
// the first's. Out: out/collide-<file> (view.html#from=out/collide-<file>&i=K)
import { hexBody, layBody } from './core.js';
const FILE = Deno.args[0] ?? 'creatures.json', P = Number(Deno.args[2] ?? 9), all = JSON.parse(Deno.readTextFileSync(new URL(`./out/${FILE}`, import.meta.url)));
const picks = Deno.args[1] ? Deno.args[1].split(',').map(Number) : all.map((o, i) => i).filter((i) => (all[i].space ?? 'hex') === 'hex');
const turn = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
// A creature: its setting and body (hexBody: offsets, mass, size, heading)
const creatures = picks.map((i) => { const { cells: _, ...c } = all[i]; return { i, c, ...hexBody(all[i]) }; });
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
    layBody(A, N, A0.body, X[0] - LA * A0.dir[0], X[1] - LA * A0.dir[1], 0);
    layBody(A, N, B0.body, X[0] - LB * dirB[0] - b * B0.size * dirB[1], X[1] - LB * dirB[1] + b * B0.size * dirB[0], kb);
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
