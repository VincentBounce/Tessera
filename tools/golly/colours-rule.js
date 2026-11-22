// Golly's rule for a Life-like rule played in colours as Tessera plays it (main.js, parseRule and the generation's
// comment): K colours, states 1 … K; a live cell survives by S keeping its colour; a dead cell born by B takes the
// colour most of its live neighbours have, on a tie the one colour missing if just one is, else none. Squares,
// Moore's 8 neighbours, as a RuleLoader table (permute: a multiset of neighbours a line).
//   node tools/golly/colours-rule.js <name> <B> <S> <K>      e.g. Immigration 3 23 2, QuadLife 3 23 4
// writes tools/golly/<name>.rule: put it in Golly's rules folder (Preferences › Control › Your Rules)
const fs = require('fs');
const [name, B, S, K] = [process.argv[2], process.argv[3], process.argv[4], Number(process.argv[5])];
const born = new Set([...B].map(Number)),
  stays = new Set([...S].map(Number));
// the multisets of n colours among 1 … K (each sorted)
const multisets = (n, from = 1) =>
  n === 0
    ? [[]]
    : Array.from({ length: K - from + 1 }, (_, i) => from + i).flatMap((c) =>
        multisets(n - 1, c).map((m) => [c, ...m]),
      );
// the newborn's colour of these live neighbours (0: none), as the app's
function newborn(m) {
  const count = Array(K + 1).fill(0);
  for (const c of m) count[c]++;
  const most = Math.max(...count.slice(1)),
    top = count.flatMap((n, c) => (c && n === most ? [c] : []));
  if (top.length === 1) return top[0];
  const missing = count.flatMap((n, c) => (c && !n ? [c] : []));
  return missing.length === 1 ? missing[0] : 0;
}
const vars = Array.from({ length: 8 }, (_, i) => `var x${i + 1}={${Array.from({ length: K }, (_, c) => c + 1)}}`),
  lines = [];
for (const b of born)
  for (const m of multisets(b)) {
    const c = newborn(m);
    if (c) lines.push([0, ...m, ...Array(8 - b).fill(0), c].join(','));
  } // (births; any other dead cell stays dead)
for (let a = 0; a <= 8; a++)
  if (!stays.has(a))
    lines.push(['c', ...Array.from({ length: a }, (_, i) => `x${i + 1}`), ...Array(8 - a).fill(0), 0].join(','));
// (deaths: a live cell of any colour with a live neighbours, any colours; a survivor keeps its state, unlisted)
fs.writeFileSync(
  `${__dirname}/${name}.rule`,
  [
    `@RULE ${name}`,
    '',
    `B${B}/S${S} in ${K} colours, as Tessera plays it: a newborn takes the colour most of its live neighbours have; on a`,
    'tie, the one colour missing if just one is, else none (written by tools/golly/colours-rule.js)',
    '',
    '@TABLE',
    `n_states:${K + 1}`,
    'neighborhood:Moore',
    'symmetries:permute',
    `var c={${Array.from({ length: K }, (_, c) => c + 1)}}`,
    ...vars,
    ...lines,
    '',
  ].join('\n'),
);
console.log(`${name}.rule: ${lines.length} transitions`);
