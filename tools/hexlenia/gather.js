// The movers found so far, in one list: deno run --allow-read --allow-write gather.js
// Every out/*.json's results with cells kept, moving (speed > 0.02), one piece, steady mass; one a family (its kernel
// β, Chan's species or none, R to the half): the smallest, then the fastest; the smallest first. Out: out/creatures.json (for index.html and view.html)
const dir = new URL('./out/', import.meta.url), seen = new Map();
for (const f of Deno.readDirSync(dir)) {
  if (!f.name.endsWith('.json') || f.name === 'creatures.json') continue;
  for (const o of JSON.parse(Deno.readTextFileSync(new URL(f.name, dir)))) {
    if (!o.cells || !(o.speed > 0.02) || o.pieces !== 1 || o.cv >= 0.05) continue;
    const key = [o.name, o.beta, Math.round(o.R * 2) / 2].join('|'), b = seen.get(key);
    if (!b || o.live < b.live || (o.live === b.live && o.speed > b.speed)) seen.set(key, { ...o, from: f.name });
  }
}
const list = [...seen.values()].sort((a, b) => a.live - b.live);
Deno.writeTextFileSync(new URL('creatures.json', dir), JSON.stringify(list));
for (const [i, o] of list.entries()) console.log(i, (o.name ?? '').padEnd(18), `R ${o.R} β ${o.beta} μ ${o.mu} σ ${o.sigma} dt ${o.dt} · live ${o.live} speed ${o.speed} · ${o.from}`);
