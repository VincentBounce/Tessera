// A zoo, creatures of one rule thrown on a hex torus: deno run --allow-read --allow-write zoo.js picks [count] [N] [seed] [name]
// (picks: file:index of out/, e.g. flow-creatures.json:8,born-flow-creatures.json:7; all of one rule, as a world has one)
// `count` creatures (12), the picks in turn, each at a random place at least its size from the others, turned by a
// random sixth (layBody), on an N × N torus (80). Out: added to out/zoo.json, a scene of that name replaced
// (view.html#from=out/zoo.json&i=K, the gallery's Zoo tab)
import { mulberry32, hexBody, layBody } from './core.js';
const picks = Deno.args[0].split(',').map((s) => { const [f, i] = s.split(':'); return { f, ...JSON.parse(Deno.readTextFileSync(new URL(`./out/${f}`, import.meta.url)))[+i] }; });
const COUNT = Number(Deno.args[1] ?? 12), N = Number(Deno.args[2] ?? 80), SEED = Number(Deno.args[3] ?? 1), rnd = mulberry32(SEED);
const NAME = Deno.args[4] ?? `Zoo of ${picks.map((o) => o.live).join(' and ')} cells`;
const rule = (o) => JSON.stringify([o.R, o.beta, o.mu, o.sigma, o.kernels, o.dt, o.flow]);
if (picks.some((o) => rule(o) !== rule(picks[0]))) throw new Error('the picks are not of one rule');
const bodies = picks.map(hexBody), A = new Array(N * N).fill(0), at = [];
// Places on the torus' parallelogram (x = q + r/2, y = r·√3/2), apart by the larger size, nearest images counted
const far = (x, y, s) => at.every(([u, v, t]) => { let best = Infinity; for (const i of [-1, 0, 1]) for (const j of [-1, 0, 1]) best = Math.min(best, Math.hypot(x - u + i * N + (j * N) / 2, y - v + (j * N * Math.sqrt(3)) / 2)); return best > Math.max(s, t); });
for (let n = 0, tries = 0; n < COUNT && tries < 5000; tries++) {
  const b = bodies[n % bodies.length], q = rnd() * N, r = rnd() * N, x = q + r / 2, y = (r * Math.sqrt(3)) / 2;
  if (!far(x, y, b.size)) continue;
  layBody(A, N, b.body, x, y, Math.floor(rnd() * 6));
  at.push([x, y, b.size]); n++;
}
const { cells: _, f: __, at: ___, ...p } = picks[0];
const file = new URL('./out/zoo.json', import.meta.url), old = (() => { try { return JSON.parse(Deno.readTextFileSync(file)); } catch { return []; } })();
const scene = { ...p, name: NAME, N, space: 'hex', live: undefined, speed: undefined, count: at.length, picks: Deno.args[0], cells: A.map((v) => Math.round(v * 255)) };
Deno.writeTextFileSync(file, JSON.stringify([...old.filter((o) => o.name !== NAME), scene]));
console.log(NAME, at.length, 'creatures on', N, '×', N);
