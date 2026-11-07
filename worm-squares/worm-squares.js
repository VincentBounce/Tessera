'use strict';
/* ==============================================================================================
 * WORMS ON SQUARES — a prototype, apart from main.js (to show, then maybe to join Tessera's Ant tab)
 * ==============================================================================================
 *
 * Paterson's worms (Beeler, Paterson, Gardner 1973) walk the triangle grid's edges; here, the square grid's: at each corner
 * the worm comes in by one edge and has three ways out, its left, straight on, its right. An edge walked is eaten: never
 * walked again. A situation is which of the three ways are free; with two or three, the rule decides which, the same each
 * time that situation comes back (a rule: a way for each of the four situations with a choice, 2 × 2 × 2 × 3 = 24); with one,
 * the worm takes it; with none, it dies. Each rule is played from the same start (the origin, heading east) up to MAX steps.
 */

/* ---- 1 The worm ------------------------------------------------------------------------------ */
const MAX = 200000;  // steps at most a worm is played (alive past it: still alive)
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];  // east, north, west, south (a turn left: +1)
const WAYS = ['L', 'S', 'R'], TURN = [1, 0, -1];  // its ways out, as turns from its heading
// the situations with a choice, by their free ways (bit 0 L, bit 1 S, bit 2 R): L S, L R, S R, L S R
const CHOICES = [0b011, 0b101, 0b110, 0b111];
const freeWays = (mask) => WAYS.map((_, i) => i).filter((i) => mask >> i & 1);
// every rule: for each situation with a choice, one of its free ways (index into freeWays)
const RULES = (() => {
  const out = [];
  for (const a of [0, 1]) for (const b of [0, 1]) for (const c of [0, 1]) for (const d of [0, 1, 2]) out.push([a, b, c, d]);
  return out;
})();
const ruleWord = (rule) => CHOICES.map((mask, k) => WAYS[freeWays(mask)[rule[k]]]).join('');  // (its ways, in the situations' order)
const ruleText = (rule) => CHOICES.map((mask, k) => `{${freeWays(mask).map((i) => WAYS[i]).join(' ')}} → ${WAYS[freeWays(mask)[rule[k]]]}`).join(' · ');
// its mirror: left and right swapped, the situations {L S} and {S R} too (the same worm, mirrored)
const mirror = (word) => [2, 1, 0, 3].map((k) => word[k]).join('').replace(/[LR]/g, (w) => (w === 'L' ? 'R' : 'L'));

// a worm played: its corners in turn (xs, ys), its steps, dead or alive at MAX
function play(rule) {
  const eaten = new Set(), key = (x, y, d) => { const nx = x + DIRS[d][0], ny = y + DIRS[d][1]; return x < nx || (x === nx && y < ny) ? `${x},${y},${nx},${ny}` : `${nx},${ny},${x},${y}`; };
  const xs = new Int32Array(MAX + 1), ys = new Int32Array(MAX + 1);
  let x = 0, y = 0, h = 0, n = 0, dead = false;
  eaten.add(key(x, y, h)); x += DIRS[h][0]; y += DIRS[h][1]; xs[1] = x; ys[1] = y; n = 1;  // (its first step: east)
  while (n < MAX) {
    let mask = 0;
    for (let i = 0; i < 3; i++) if (!eaten.has(key(x, y, (h + TURN[i] + 4) % 4))) mask |= 1 << i;
    if (!mask) { dead = true; break; }
    const free = freeWays(mask), k = CHOICES.indexOf(mask), way = k < 0 ? free[0] : free[rule[k]];
    h = (h + TURN[way] + 4) % 4;
    eaten.add(key(x, y, h)); x += DIRS[h][0]; y += DIRS[h][1];
    n++; xs[n] = x; ys[n] = y;
  }
  return { rule, word: ruleWord(rule), n, dead, xs, ys };
}

/* ---- 2 The page ------------------------------------------------------------------------------ */
const $ = (id) => document.getElementById(id);
// the worms by how long they live, those going straight on at a fresh corner last: a straight line forever (trivial)
const trivial = (w) => w.rule[3] === 1;  // ({L S R} → S)
const worms = RULES.map(play).sort((a, b) => trivial(a) - trivial(b) || (a.dead === b.dead ? b.n - a.n : a.dead ? 1 : -1));
let shown = worms[0], view = null, upTo = Infinity;

function renderRules() {
  $('rules').replaceChildren(...worms.map((w) => {
    const b = document.createElement('button'), twin = mirror(w.word);
    b.className = `btn${w === shown ? ' on' : ''}`;
    b.innerHTML = `<b>${w.word}</b><span>${trivial(w) ? 'straight on forever' : w.dead ? `dies at ${w.n.toLocaleString('en')}` : `alive at ${MAX.toLocaleString('en')}`}${twin !== w.word ? ` · mirror ${twin}` : ''}</span>`;
    b.title = ruleText(w.rule);
    b.onclick = () => { shown = w; view = null; upTo = Infinity; renderRules(); draw(); };
    return b;
  }));
  const w = shown;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i <= w.n; i++) { x0 = Math.min(x0, w.xs[i]); x1 = Math.max(x1, w.xs[i]); y0 = Math.min(y0, w.ys[i]); y1 = Math.max(y1, w.ys[i]); }
  $('info').textContent = `${ruleText(w.rule)}\n${w.dead ? `Dies at step ${w.n.toLocaleString('en')}: a corner with no way out` : `Still alive at step ${MAX.toLocaleString('en')}`}\n${x1 - x0} × ${y1 - y0} squares`;
}

// the worm drawn: its edges in the rainbow along its steps (16 bands), the grid under it when near; its start a dot
function draw() {
  const cv = $('view'), dpr = devicePixelRatio || 1, W = (cv.width = cv.clientWidth * dpr), H = (cv.height = cv.clientHeight * dpr), ctx = cv.getContext('2d'), w = shown;
  if (!view) {  // fitted
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i <= w.n; i++) { x0 = Math.min(x0, w.xs[i]); x1 = Math.max(x1, w.xs[i]); y0 = Math.min(y0, w.ys[i]); y1 = Math.max(y1, w.ys[i]); }
    const s = Math.min(W / (x1 - x0 + 4), H / (y1 - y0 + 4));
    view = { s, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  }
  const px = (x) => W / 2 + (x - view.cx) * view.s, py = (y) => H / 2 - (y - view.cy) * view.s, last = Math.min(w.n, upTo);
  ctx.fillStyle = '#0b0d12'; ctx.fillRect(0, 0, W, H);
  if (view.s > 6) {  // the grid, near
    ctx.strokeStyle = '#1b2030'; ctx.lineWidth = 1; ctx.beginPath();
    const xa = Math.floor(view.cx - W / 2 / view.s), xb = Math.ceil(view.cx + W / 2 / view.s), ya = Math.floor(view.cy - H / 2 / view.s), yb = Math.ceil(view.cy + H / 2 / view.s);
    for (let x = xa; x <= xb; x++) { ctx.moveTo(px(x), 0); ctx.lineTo(px(x), H); }
    for (let y = ya; y <= yb; y++) { ctx.moveTo(0, py(y)); ctx.lineTo(W, py(y)); }
    ctx.stroke();
  }
  ctx.lineWidth = Math.max(1, Math.min(view.s * 0.35, 6)); ctx.lineCap = 'round';
  const BANDS = 16;
  for (let b = 0; b < BANDS; b++) {
    const from = Math.floor((b * last) / BANDS), to = Math.floor(((b + 1) * last) / BANDS);
    ctx.strokeStyle = `hsl(${200 + (b * 160) / (BANDS - 1)}, 80%, 60%)`; ctx.beginPath(); ctx.moveTo(px(w.xs[from]), py(w.ys[from]));
    for (let i = from + 1; i <= to; i++) ctx.lineTo(px(w.xs[i]), py(w.ys[i]));
    ctx.stroke();
  }
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px(0), py(0), Math.max(3, ctx.lineWidth), 0, 2 * Math.PI); ctx.fill();
  if (w.dead && last >= w.n) { ctx.fillStyle = '#e5484d'; ctx.beginPath(); ctx.arc(px(w.xs[w.n]), py(w.ys[w.n]), Math.max(3, ctx.lineWidth), 0, 2 * Math.PI); ctx.fill(); }
}

// pan by a drag, zoom by the wheel round the mouse
let drag = null;
$('view').addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; e.target.setPointerCapture(e.pointerId); });
$('view').addEventListener('pointermove', (e) => { if (!drag || !view) return; const dpr = devicePixelRatio || 1; view.cx -= ((e.clientX - drag.x) * dpr) / view.s; view.cy += ((e.clientY - drag.y) * dpr) / view.s; drag = { x: e.clientX, y: e.clientY }; draw(); });
$('view').addEventListener('pointerup', () => { drag = null; });
$('view').addEventListener('wheel', (e) => { e.preventDefault(); if (!view) return; view.s *= Math.exp(-e.deltaY * 0.0015); draw(); }, { passive: false });
$('fit').onclick = () => { view = null; draw(); };
$('replay').onclick = () => { const t0 = performance.now(), dur = 4000; const tick = (t) => { upTo = Math.floor((shown.n * Math.min(1, (t - t0) / dur)) ** 1); draw(); if (t - t0 < dur) requestAnimationFrame(tick); else upTo = Infinity; }; requestAnimationFrame(tick); };
addEventListener('resize', draw);
renderRules(); draw();
