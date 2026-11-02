/* ==============================================================================================
 * ARTIFICIAL CHEMISTRY — chemistry.js
 * ==============================================================================================
 *
 * Tim Hutton's artificial chemistry (Squirm3, 2002) on a torus of hexagons. Atoms of six types
 * (a to f), each with a state (a number) and bonds to other atoms; one atom a cell. Each step every
 * atom tries to move to a free cell beside it, never leaving a partner further than two cells
 * (bonds stretch, a chain can crawl); then every two atoms side by side may react: a rule turns
 * their states and makes or breaks their bond ("e8 + e0 → e4e3": an e in state 8 meeting a free e
 * in state 0 bonds to it, the two now in states 4 and 3; x and y stand for any type, the same
 * letter the same type). Types never change; with Hutton's eight rules, a chain e8–…–f1 in a
 * soup of free atoms copies itself, and its copies again; a flaw of rule 4 he noted makes
 * mutants, the shorter ones copied faster (ef wins, as in his paper).
 * chemistryCheck() in the console: atoms and bonds kept right, and the chain copied.
 */

/* ---- 1.1 Rules ------------------------------------------------------------------------------- */

const TYPES = 'abcdef', COLOURS = ['#ff6464', '#5fd96b', '#6699ff', '#ffd84d', '#d873ff', '#4de6f2'];
// Hutton's eight reactions for self-replication (2002): "+" not bonded, side by side bonded
const HUTTON = ['e8 + e0 → e4e3', 'x4y1 → x2y5', 'x5 + x0 → x7x6', 'x3 + y6 → x2y3', 'x7y3 → x4y3', 'f4f3 → f8 + f8', 'x2y8 → x9y1', 'x9y9 → x8 + y8'];
// A rule as data: its two atoms (a type or a variable, a state) bonded or not, before and after
const parseSide = (s) => { const m = s.replace(/\s/g, '').match(/^([a-fxy])(\d+)(\+?)([a-fxy])(\d+)$/); return { t: [m[1], m[4]], s: [+m[2], +m[5]], bond: !m[3] }; };
const RULES = HUTTON.map((text) => { const [l, r] = text.split('→'); return { text, before: parseSide(l), after: parseSide(r) }; });
// Atoms i and j (types ti, tj, states si, sj, bonded or not) against a rule, in its order: the variables bound, or null
function matches(rule, ti, si, tj, sj, bonded) {
  const b = rule.before;
  if (b.bond !== bonded || b.s[0] !== si || b.s[1] !== sj) return false;
  const vars = {};
  for (const [want, got] of [[b.t[0], ti], [b.t[1], tj]]) {
    if (want === 'x' || want === 'y') { if (vars[want] !== undefined && vars[want] !== got) return false; vars[want] = got; }
    else if (want !== got) return false;
  }
  return true;
}

/* ---- 1.2 World ------------------------------------------------------------------------------- */

const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];
// A world: an N × N hex torus (axial q, r), atoms with type, state, bonds; `free` atoms scattered, the chain laid
function makeWorld(N, free, chain, seed) {
  const rnd = mulberry32(seed), cell = new Int32Array(N * N).fill(-1), atoms = [];
  const at = (q, r) => ((((r % N) + N) % N) * N) + ((((q % N) + N) % N));
  const put = (q, r, type, state) => { const a = { q: ((q % N) + N) % N, r: ((r % N) + N) % N, type, state, bonds: [] }; atoms.push(a); cell[at(q, r)] = atoms.length - 1; return atoms.length - 1; };
  // The chain in a row through the middle, each bonded to the next
  const c0 = Math.floor(N / 2) - Math.floor(chain.length / 2);
  chain.forEach(([type, state], i) => { const id = put(c0 + i, Math.floor(N / 2), type, state); if (i) bond(atoms, id - 1, id); });
  for (let n = 0; n < free; ) { const q = Math.floor(rnd() * N), r = Math.floor(rnd() * N); if (cell[at(q, r)] < 0) { put(q, r, Math.floor(rnd() * 6), 0); n++; } }
  return { N, cell, atoms, rnd, at, t: 0, fired: RULES.map(() => 0) };
}
const bond = (atoms, i, j) => { atoms[i].bonds.push(j); atoms[j].bonds.push(i); };
const unbond = (atoms, i, j) => { atoms[i].bonds = atoms[i].bonds.filter((k) => k !== j); atoms[j].bonds = atoms[j].bonds.filter((k) => k !== i); };
// Hex distance on the torus between two atoms
function dist(W, a, b) {
  const N = W.N;
  let best = Infinity;
  for (const i of [-1, 0, 1]) for (const j of [-1, 0, 1]) { const dq = b.q - a.q + i * N, dr = b.r - a.r + j * N; best = Math.min(best, (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2); }
  return best;
}
// One step: each atom in a random order tries one move (a random side, the cell free, its partners kept within 2), then
// every pair side by side tries the rules (each atom in one reaction a step)
function step(W) {
  const { atoms, cell, rnd, at, N } = W, order = atoms.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  for (const i of order) {
    const a = atoms[i], [dq, dr] = DIRS[Math.floor(rnd() * 6)], q = (a.q + dq + N) % N, r = (a.r + dr + N) % N;
    if (cell[at(q, r)] >= 0) continue;
    const moved = { q, r };
    if (a.bonds.some((k) => dist(W, moved, atoms[k]) > 2)) continue;
    cell[at(a.q, a.r)] = -1; a.q = q; a.r = r; cell[at(q, r)] = i;
  }
  const busy = new Uint8Array(atoms.length);
  for (const i of order) {
    if (busy[i]) continue;
    const a = atoms[i];
    for (const [dq, dr] of DIRS) {
      const j = cell[at(a.q + dq, a.r + dr)];
      if (j < 0 || busy[j]) continue;
      if (react(W, i, j)) { busy[i] = busy[j] = 1; break; }
    }
  }
  W.t++;
}
// The first rule that fits atoms i and j, in either order, applied: states, and the bond made or broken
function react(W, i, j) {
  const { atoms } = W, bonded = atoms[i].bonds.includes(j);
  for (const [k, rule] of RULES.entries()) for (const [p, q] of [[i, j], [j, i]]) {
    const A = atoms[p], B = atoms[q];
    if (!matches(rule, TYPES[A.type], A.state, TYPES[B.type], B.state, bonded)) continue;
    A.state = rule.after.s[0]; B.state = rule.after.s[1];
    if (rule.after.bond && !bonded) bond(atoms, p, q);
    if (!rule.after.bond && bonded) unbond(atoms, p, q);
    W.fired[k]++;
    return true;
  }
  return false;
}
// The molecules: atoms joined by bonds, each written by its chain from an end (its types), with their counts
function molecules(W) {
  const { atoms } = W, seen = new Uint8Array(atoms.length), out = new Map();
  for (let i = 0; i < atoms.length; i++) {
    if (seen[i] || !atoms[i].bonds.length) continue;
    const part = [], st = [i]; seen[i] = 1;
    while (st.length) { const x = st.pop(); part.push(x); for (const y of atoms[x].bonds) if (!seen[y]) { seen[y] = 1; st.push(y); } }
    const end = part.find((x) => atoms[x].bonds.length === 1);
    let name;
    if (end === undefined || part.some((x) => atoms[x].bonds.length > 2)) name = `cluster of ${part.length}`;
    else { const seq = []; let prev = -1, x = end; while (x !== undefined) { seq.push(TYPES[atoms[x].type]); const nx = atoms[x].bonds.find((y) => y !== prev); prev = x; x = nx; } name = seq.join(''); if ([...name].reverse().join('') < name) name = [...name].reverse().join(''); }
    out.set(name, (out.get(name) ?? 0) + 1);
  }
  return [...out].sort((a, b) => b[1] - a[1]);
}

/* ---- 1.3 Page -------------------------------------------------------------------------------- */

const TEMPLATE = [[4, 8], [0, 1], [1, 1], [2, 1], [5, 1]]; // e8 a1 b1 c1 f1, Hutton's
const hash = Object.fromEntries(new URLSearchParams(location.hash.slice(1)));
const set = { N: +hash.N || 48, free: +hash.free || 700, seed: +hash.seed || 1 };
let W = makeWorld(set.N, set.free, TEMPLATE, set.seed), on = true, speed = 16;
const view = document.getElementById('view'), g = view.getContext('2d');
const fit = () => { const r = view.getBoundingClientRect(), d = devicePixelRatio || 1; view.width = Math.max(1, r.width * d); view.height = Math.max(1, r.height * d); };
addEventListener('resize', fit);
// Each atom a hexagon of its type's colour, dim in state 0; bonds as lines (those across the torus' edge left out);
// the torus drawn as a rectangle, a row shifted half a cell more than the one above, wrapped
function draw() {
  const { N, atoms } = W, w = view.width, h = view.height, s = Math.min(w / (N + 1), h / ((N * Math.sqrt(3)) / 2 + 1)), x0 = (w - N * s) / 2, y0 = (h - ((N * Math.sqrt(3)) / 2) * s) / 2;
  const px = (a) => [x0 + (((a.q + a.r / 2) % N) + N) % N * s, y0 + a.r * (Math.sqrt(3) / 2) * s];
  g.fillStyle = '#0b0d12'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = Math.max(1, s / 6);
  g.beginPath();
  atoms.forEach((a, i) => { for (const j of a.bonds) if (j > i) { const [ax, ay] = px(a), [bx, by] = px(atoms[j]); if (Math.hypot(ax - bx, ay - by) < 3 * s) { g.moveTo(ax, ay); g.lineTo(bx, by); } } });
  g.stroke();
  for (const a of atoms) {
    const [x, y] = px(a);
    g.fillStyle = COLOURS[a.type]; g.globalAlpha = a.state ? 1 : 0.45;
    g.beginPath();
    for (let k = 0; k < 6; k++) { const t = Math.PI / 6 + (k * Math.PI) / 3; g[k ? 'lineTo' : 'moveTo'](x + Math.cos(t) * s * 0.55, y + Math.sin(t) * s * 0.55); }
    g.fill();
  }
  g.globalAlpha = 1;
  if (s >= 14) { g.fillStyle = '#000'; g.font = `${Math.round(s * 0.45)}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle'; for (const a of atoms) { const [x, y] = px(a); g.fillText(TYPES[a.type] + a.state, x, y); } }
}
const tabs = (el, values, get, pick) => {
  el.innerHTML = '';
  for (const v of values) { const b = document.createElement('button'); b.className = 'btn'; b.textContent = v; b.onclick = () => { pick(v); mark(); }; el.append(b); }
  const mark = () => [...el.children].forEach((b, i) => b.classList.toggle('on', values[i] === get()));
  mark();
};
tabs(document.getElementById('speeds'), [1, 4, 16, 64], () => speed, (v) => { speed = v; });
document.getElementById('play').onclick = (e) => { on = !on; e.target.textContent = on ? 'Pause' : 'Play'; };
document.getElementById('restart').onclick = () => { set.seed = 1 + Math.floor(Math.random() * 99999); history.replaceState(null, '', '#' + new URLSearchParams(set)); W = makeWorld(set.N, set.free, TEMPLATE, set.seed); };
function frame() {
  if (on) for (let i = 0; i < speed; i++) step(W);
  draw();
  const top = molecules(W).slice(0, 5).map(([m, n]) => `${m} ×${n}`).join(' · ');
  document.getElementById('rules').textContent = RULES.map((r, k) => `${r.text.padEnd(18)}${W.fired[k]}`).join('\n');
  document.getElementById('stats').textContent = `step ${W.t} · ${W.atoms.length} atoms\n${top}`;
  requestAnimationFrame(frame);
}
fit(); history.replaceState(null, '', '#' + new URLSearchParams(set)); requestAnimationFrame(frame);

/* ---- 1.4 Check ------------------------------------------------------------------------------- */

// A fresh world played `steps`: each type's count kept, bonds both ways and within 2 cells, cells and atoms agreeing,
// and the chain copied (more than one eabcf)
window.chemistryCheck = (steps = 10000, seed = 1) => {
  const T = makeWorld(48, 700, TEMPLATE, seed), count = () => TYPES.split('').map((_, k) => T.atoms.filter((a) => a.type === k).length).join(',');
  const before = count();
  for (let i = 0; i < steps; i++) step(T);
  const bondsOk = T.atoms.every((a, i) => a.bonds.every((j) => T.atoms[j].bonds.includes(i) && dist(T, a, T.atoms[j]) <= 2));
  const cellsOk = T.atoms.every((a, i) => T.cell[T.at(a.q, a.r)] === i) && T.cell.filter((c) => c >= 0).length === T.atoms.length;
  const copies = molecules(T).find(([m]) => m === 'abcef' || m === 'eabcf' || m === 'fcbae')?.[1] ?? 0;
  const ok = count() === before && bondsOk && cellsOk && copies > 1;
  console.log(`chemistryCheck: ${steps} steps; types kept ${count() === before}, bonds ${bondsOk}, cells ${cellsOk}, copies of the chain ${copies}: ${ok ? 'ok' : 'FAILED'}`, molecules(T).slice(0, 6));
  return ok;
};
