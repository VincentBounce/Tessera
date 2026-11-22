// Golly against the app: each case's generation 0 as Save RLE writes it (lifeRle), played N generations by Golly
// (bgolly, the colour rules from this folder: see colours-rule.js) and by the app; both read back by the app's own reader
// (rleRead) and compared cell by cell, colour and state too, from their live cells' corner (bgolly writes no place). The
// plane's from a seed in the middle of a large one (Golly's plane has no edge: N short of the walls); a sheet's whole, on
// Golly's bounded grid (:T, :K).
//   BROWSER_PORT=9451 node tools/golly/check.js [N]       (the hidden browser started: tools/browser.js start)
const { execFileSync } = require('child_process'),
  fs = require('fs'),
  os = require('os'),
  path = require('path');
const N = Number(process.argv[2] ?? 100),
  BGOLLY = '/Applications/golly-5.0-mac/bgolly',
  ROOT = path.join(__dirname, '..', '..'),
  SITE = 'http://localhost:8321/',
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'golly-check-'));
const browser = (...args) =>
  execFileSync('node', [path.join(ROOT, 'tools', 'browser.js'), ...args], { encoding: 'utf8' }).trim();
// a seed for the plane: a random square of side 20, its density 40 %, in K colours, as a link's cells (popCells: from
// x0, y0, the plane's middle)
const seed = (K, s = 1) => {
  let r = s * 7919;
  const rnd = () => (r = (r * 1103515245 + 12345) % 2147483648) / 2147483648,
    rows = Array.from({ length: 20 }, () =>
      Array.from({ length: 20 }, () => (rnd() < 0.4 ? String.fromCharCode(65 + Math.floor(rnd() * K)) : '.')).join(''),
    );
  return `popStart=draw&popCells=100,100:${rows.join('$')}!`;
};
const CASES = [
  ['squares, Life', `mode=life&shape=squares&gridSize=224&playRule=B3/S23&${seed(1)}`],
  ['squares, Generations', `mode=life&shape=squares&gridSize=224&playRule=B2/S345/C4&${seed(1)}`],
  ['squares, Immigration', `mode=life&shape=squares&gridSize=224&playRule=B3/S23&teams=2&${seed(2)}`],
  ['squares, QuadLife', `mode=life&shape=squares&gridSize=224&playRule=B3/S23&teams=4&${seed(4)}`],
  ['hexagons, B2/S34', `mode=life&shape=hex&gridSize=224&playRule=B2/S34&${seed(1)}`],
  ['torus, Life', 'mode=life&shape=torus&tiling=squares&gridSize=24&playRule=B3/S23&popStart=random&popDraw=30.1'],
  [
    'torus, Immigration',
    'mode=life&shape=torus&tiling=squares&gridSize=24&playRule=B3/S23&teams=2&popStart=random&popDraw=30.3',
  ],
  [
    'torus, Generations',
    'mode=life&shape=torus&tiling=squares&gridSize=24&playRule=B2/S345/C4&popStart=random&popDraw=30.4',
  ],
  [
    'Klein bottle, Life',
    'mode=life&shape=kleinBottle&tiling=squares&gridSize=24&playRule=B3/S23&popStart=random&popDraw=30.5',
  ],
  [
    'Klein bottle, QuadLife',
    'mode=life&shape=kleinBottle&tiling=squares&gridSize=24&playRule=B3/S23&teams=4&popStart=random&popDraw=30.6',
  ],
];
// Golly's algorithm for a rule: a name, its RuleLoader's table; survival/birth/states, Generations; else QuickLife's
const algorithm = (rule) =>
  !rule.includes('/') ? 'RuleLoader' : rule.split('/').length === 3 ? 'Generations' : 'QuickLife';
// the page built (its walk the tab's, nothing computing)
const built = (tab) => {
  for (let i = 0; i < 120; i++) {
    if (browser('eval', tab, '!busy && walk.variant === tabVariant() && !!walk.life') === 'true') return;
    execFileSync('sleep', ['0.5']);
  }
  throw new Error('not built');
};
let failed = 0;
for (const [name, hash] of CASES) {
  const tab = browser('open', 'about:blank'); // (a tab of its own, the last opened: the one drawn, see browser.js)
  browser('go', tab, `${SITE}#${hash}`);
  built(tab);
  const first = JSON.parse(browser('eval', tab, '(seekTo(0), lifeRle())')),
    file = path.join(tmp, 'gen0.rle'),
    out = path.join(tmp, `gen${N}.rle`);
  fs.writeFileSync(file, first);
  try {
    const rule = first.match(/rule = ([^:\s]+)/)[1];
    execFileSync(BGOLLY, ['-q', '-q', '-a', algorithm(rule), '-s', `${__dirname}/`, '-m', String(N), '-o', out, file], {
      stdio: 'pipe',
    });
  } catch (e) {
    failed++;
    console.log(`✗ ${name}: Golly refused it (${`${e.stdout}${e.stderr}`.trim().split('\n').pop()})`);
    browser('eval', tab, 'window.close()');
    continue;
  }
  const golly = fs.readFileSync(out, 'utf8');
  const verdict = JSON.parse(
    browser(
      'eval',
      tab,
      `(async () => {
        seekTo(${N});
        for (let i = 0; i < 600 && stepShown !== ${N}; i++) await new Promise((r) => setTimeout(r, 50));
        const app = rleRead(lifeRle() ?? 'x = 0, y = 0\\n!'), them = rleRead(${JSON.stringify(golly)}),
          key = (f) => {
            if (!f) return [];
            const x0 = Math.min(...f.cells.map(([x]) => x)), y0 = Math.min(...f.cells.map(([, y]) => y)); // (Golly's written from its live cells' corner)
            return f.cells.map(([x, y, v]) => [x - x0, y - y0, v].join()).sort();
          },
          a = key(app), b = key(them), bs = new Set(b);
        return JSON.stringify({ step: stepShown, app: a.length, golly: b.length, same: a.length === b.length && a.every((c) => bs.has(c)) });
      })()`,
    ),
  );
  const v = JSON.parse(verdict);
  if (!v.same) failed++;
  console.log(`${v.same ? '✓' : '✗'} ${name}: generation ${v.step}, ${v.app} cells in the app, ${v.golly} in Golly`);
  browser('eval', tab, 'window.close()');
}
console.log(failed ? `${failed} of ${CASES.length} differ` : `all ${CASES.length} the same after ${N} generations`);
