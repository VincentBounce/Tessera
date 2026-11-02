// Hex Lenia's parameters searched at random: deno run --allow-read --allow-write search.js count [workers] [seed] [Rs] [space] [flow]
// (Rs: the radii to try, e.g. 2.5,3,3.5; space: hex or a tiling of tilings.json, about 2,300 cells; flow: Flow Lenia, its
// σ wider, 0.1 to 0.6 of μ; out/search-<space>-<seed>.json, out/search-flow-<space>-<seed>.json)
// Each try a radius R (3 to 6), a kernel of 1 to 3 rings (beta), μ (0.1 to 0.4), σ (0.08 to 0.25 of μ, Lenia's
// creatures' range), dt and a random disc tilted (see seedDisc); kept when it neither dies
// nor fills the world in 2,000 steps. Out: out/search.json, the lasting ones, the compact single pieces first
// (a creature: one piece, small spread, steady mass), the moving ones first among those.
import { mulberry32 } from './core.js';
import { tilingCells } from '../tilings/grid.js';
const count = Number(Deno.args[0] ?? 200), P = Number(Deno.args[1] ?? 9), SEED = Number(Deno.args[2] ?? 1), rnd = mulberry32(SEED);
const RS = (Deno.args[3] ?? '3,3.5,4,4.5,5,5.5,6').split(',').map(Number), SPACE = Deno.args[4] ?? 'hex', N = SPACE === 'hex' ? 48 : Math.round(Math.sqrt(2304 / tilingCells(SPACE))), FLOW = Deno.args[5] === 'flow';
const workers = Array.from({ length: P }, () => new Worker(new URL('./worker.js', import.meta.url).href, { type: 'module' }));
const pick = (a) => a[Math.floor(rnd() * a.length)], round = (x, k) => +x.toFixed(k);
const BETAS = [[1], [1], [1, 0.5], [0.5, 1], [1, 0.25], [1, 1], [1, 0.5, 0.25], [0.5, 1, 0.5]];
const tries = Array.from({ length: count }, (_, i) => {
  const R = pick(RS), mu = round(0.1 + rnd() * 0.3, 3);
  return { R, beta: pick(BETAS), mu, sigma: round(mu * (FLOW ? 0.1 + rnd() * 0.5 : 0.08 + rnd() * 0.17), 4), dt: pick([0.05, 0.1, 0.2]), ...(FLOW ? { flow: true } : {}), r0: round(R * (0.8 + rnd() * 1.2), 1), seed: i + 1, tilt: true, keep: true, ...(SPACE === 'hex' ? {} : { space: SPACE, N }) };
});
// (not a disc full at 1; Flow Lenia's mass never changes, a creature there: gathered, in one or two pieces)
const creature = (o) => (FLOW ? o.pieces <= 2 && o.rg < 6 : o.pieces === 1 && o.rg < 8 && o.cv < 0.1 && o.mass < o.live * 0.9);
const t0 = Date.now(), out = [], ends = {};
let next = 0, done = 0;
await Promise.all(workers.map((w) => new Promise((res) => {
  const go = () => {
    if (next >= tries.length) return res();
    const p = tries[next++];
    w.onmessage = ({ data }) => {
      const o = data.out; ends[o.end] = (ends[o.end] ?? 0) + 1;
      if (o.end === 'alive') out.push(creature(o) ? o : { ...o, cells: undefined });
      if (++done % 200 === 0) console.log(done, Math.round((Date.now() - t0) / 1000) + 's', JSON.stringify(ends));
      go();
    };
    w.postMessage({ id: 0, p, N, T: 2000 });
  };
  go();
})));
workers.forEach((w) => w.terminate());
out.sort((a, b) => creature(b) - creature(a) || (creature(a) ? b.speed - a.speed : a.rg - b.rg));
Deno.mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
Deno.writeTextFileSync(new URL(`./out/search-${FLOW ? 'flow-' : ''}${SPACE}-${SEED}.json`, import.meta.url), JSON.stringify(out));
console.log(count, 'tries', Math.round((Date.now() - t0) / 1000) + 's', JSON.stringify(ends), 'creatures', out.filter(creature).length);
