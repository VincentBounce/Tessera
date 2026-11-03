// Rules that grow slowly from small sprouts, in compact zones biting into each other: deno run --allow-read --allow-write
// grow.js [workers]. A Duel on a disc of W 36: two sprouts of about 43 cells each, red and blue (see grow-worker.js), played
// on. Stage 1, every rule of a search (see rules.js) on Flower 9, Mirror 8 and Hexa 9 (a family each: their neighbours
// alike), 300 generations: those whose sprouts grew half again at least without bursting on one of them; stage 2, those on
// the three, two starts, 2,000 generations, scored;
// stage 3, the 300 best on every rosette sphere's disc. Out: out/rosettes-grow.json, each sphere's best
import { searchRules } from './rules.js';
const N = Number(Deno.args[0] ?? 8), W = 36, t0 = Date.now(), at = () => `${Math.round((Date.now() - t0) / 1000)}s`;
const SPHERES = ['flower', 'flower7', 'flower8', 'flower9', 'flower10', 'flower11', 'flower12', 'mirror5', 'mirror6', 'mirror7', 'mirror8', 'mirror9', 'mirror10', 'mirror11', 'mirror12', 'hexa5', 'hexa6', 'hexa7', 'hexa8', 'hexa9', 'hexa10', 'hexa11', 'hexa12', 'ring12'];  // (main.js's ROSETTE_SPHERES)
const most = JSON.parse(Deno.readTextFileSync(new URL('./most.json', import.meta.url)));
const workers = Array.from({ length: N }, () => new Worker(new URL('./grow-worker.js', import.meta.url).href, { type: 'module' }));
// a list of rules on a disc, in parts shared by the workers
const play = (kind, rules, gens, seeds, size = 20) => {
  const out = []; let i = 0;
  return Promise.all(workers.map((w) => (async () => { while (i < rules.length) { const part = rules.slice(i, (i += size)); out.push(...(await new Promise((res) => { w.onmessage = (e) => res(e.data); w.postMessage({ kind, W, rules: part, gens, seeds }); }))); } })())).then(() => out);
};
// a run's score: none if it died, burst, grew less than 10 times or by more than 2 % of the disc a generation; else its
// compactness, times how slowly it came to half its end (a third of the run: 1), times 1 with dips (0.6 with none), 1 still
// moving in its second half (0.5 frozen), 1 with both colours alive then (0.3 one)
const score = (r, gens) => {
  if (r.dead || r.burst || r.pops.at(-1) < 10 * r.pop0 || r.gain > 0.02 || r.compact < 0.8) return 0;
  const end = r.pops.at(-1), half = 10 * r.pops.findIndex((p) => p >= end / 2), dips = r.pops.some((p, i) => i && p < 0.99 * r.pops[i - 1]);
  return r.compact * Math.min(1, half / (gens / 3)) * (dips ? 1 : 0.6) * (r.moving > 0.0005 ? 1 : 0.5) * (r.both ? 1 : 0.3);
};
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
// stage 1
const FAMILIES = ['flower9', 'mirror8', 'hexa9'], grew = new Set();
for (const kind of FAMILIES) {
  const all = searchRules(most[kind]);
  for (const { rule, runs: [r] } of await play(kind, all, 300, 1, 40)) if (!r.dead && !r.burst && r.pops.at(-1) >= 1.5 * r.pop0 && r.gain <= 0.02) grew.add(rule);
  console.log('stage 1', kind, all.length, 'rules,', grew.size, 'grow so far', at());
}
const s1 = [...grew];
// stage 2
const by = {};
for (const kind of FAMILIES) for (const { rule, runs } of await play(kind, s1, 2000, 2)) (by[rule] ??= []).push(...runs.map((r) => score(r, 2000)));
const s2 = Object.entries(by).map(([rule, xs]) => ({ rule, score: mean(xs) })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
console.log('stage 2', s2.length, 'scored', at(), s2.slice(0, 8).map((x) => `${x.rule} ${x.score.toFixed(3)}`).join(' · '));
// stage 3: each sphere's disc
const top = s2.slice(0, 300).map((x) => x.rule), out = {};
for (const kind of SPHERES) {
  const got = (await play(kind, top, 2000, 2)).map(({ rule, runs }) => ({ rule, score: +mean(runs.map((r) => score(r, 2000))).toFixed(3), runs: runs.map((r) => ({ pop0: r.pop0, end: r.pops.at(-1), compact: +(r.compact ?? 0).toFixed(2), dead: r.dead, burst: r.burst })) }));
  out[kind] = got.filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 10);
  console.log(kind.padEnd(9), at(), out[kind].slice(0, 3).map((x) => `${x.rule} ${x.score}`).join(' · ') || 'none');
  Deno.writeTextFileSync(new URL('./out/rosettes-grow.json', import.meta.url), JSON.stringify(out));
}
workers.forEach((w) => w.terminate());
