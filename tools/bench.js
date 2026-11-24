// The benchmarks (BENCHMARKS.md): each case's link opened cold in the hidden browser (tools/browser.js: a new page, its
// cache key the version), timed till its walk is the link's and nothing computes; a dated row added to its Runs table,
// each case's seconds (a dash past the cap). Its cases read from BENCHMARKS.md's own table (C1, C2…: its links), the one
// list. Run every two days among the away jobs; a case 20 % slower than the row before it is printed as such.
// SITE: the server timed (another version served frozen by tools/at.sh on 8322, the code worked on meanwhile left alone).
//   BROWSER_PORT=9447 [SITE=http://localhost:8322/] node tools/bench.js [cap seconds = 120] [C3,C7 …: those only, no row]
const { execFileSync } = require('child_process'),
  fs = require('fs'),
  path = require('path');
const ROOT = path.join(__dirname, '..'),
  FILE = path.join(ROOT, 'BENCHMARKS.md'),
  CAP = Number(process.argv[2] ?? 120),
  SITE = process.env.SITE ?? 'http://localhost:8321/',
  ONLY = process.argv[3]?.split(','),
  browser = (...args) =>
    execFileSync('node', [path.join(ROOT, 'tools', 'browser.js'), ...args], { encoding: 'utf8' }).trim();
const text = fs.readFileSync(FILE, 'utf8'),
  cases = [...text.matchAll(/^\| (C\d+) \| [^|]* \| \[open\]\((http:\/\/localhost:8321\/#[^)]*)\) \|$/gm)].map((m) => [
    m[1],
    m[2].replace(/&version=[^&]*$/, '').replace('http://localhost:8321/', SITE), // (opened by the code served, as it is)
  ]);
const times = {};
let version = '';
for (const [id, link] of cases) {
  if (ONLY && !ONLY.includes(id)) continue;
  // (a browser of its own each: cold, its memory its own, a tab that dies the case's only)
  browser('start');
  const tab = browser('open', 'about:blank').split('\n').pop().trim();
  let t = null;
  try {
    browser('go', tab, link.replace('/#', `/?bench${Date.now()}#`));
  } catch {}
  for (let tries = 0; tries < 3 && t === null; tries++)
    try {
      t = browser(
        'eval',
        tab,
        `(async () => { for (let i = 0; i < ${CAP * 20}; i++) { await new Promise((r) => setTimeout(r, 50)); if (typeof walk !== 'undefined' && walk.variant && walk.variant === setupVariant(parseHash(location.hash)) && !busy && !waits.size) return performance.now(); } return null; })()`,
      );
    } catch {
      execFileSync('sleep', ['1']); // (the page still loading, its context new: asked again)
    }
  times[id] = t === null || t === 'null' ? null : Number(t) / 1000;
  try {
    version ||= browser('eval', tab, 'VERSION').replace(/"/g, '');
  } catch {}
  browser('stop');
  execFileSync('sleep', ['1']); // (closed before the next one starts)
  console.log(`${id} ${times[id] === null ? `past ${CAP} s, or its page lost` : `${times[id].toFixed(1)} s`}`);
}
if (ONLY) process.exit(0);
// the row: today's date, the version, each case's seconds; and what grew 20 % since the row before
const rows = text.split('\n').filter((l) => /^\| \d{4}-\d\d-\d\d \|/.test(l)),
  last = rows
    .at(-1)
    ?.split('|')
    .slice(3, -1)
    .map((x) => Number(x.trim())),
  row = `| ${new Date().toISOString().slice(0, 10)} | ${version} | ${cases
    .map(([id]) => (times[id] === null ? '—' : times[id].toFixed(1)))
    .join(' | ')} |`;
fs.writeFileSync(FILE, `${text.replace(/\n*$/, '')}\n${row}\n`);
cases.forEach(([id], i) => {
  if (last?.[i] > 0 && times[id] > 1.2 * last[i]) console.log(`slower: ${id} ${last[i]} s → ${times[id].toFixed(1)} s`);
});
console.log(row);
