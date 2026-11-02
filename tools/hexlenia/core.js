// Lenia on any tiling's torus, small radii: each cell a value in [0, 1], the cells whose middles are within R units
// weighted by Chan's kernel (rings of a bell, beta their heights; per cell, summing to 1), then growth
// G(u) = 2·exp(−(u−μ)²/2σ²) − 1, A += dt·G. A space: its cells' middles (x, y, world units), their places on the torus
// (u, v in [0, 1)), its two periods, its unit (the spacing of hexagons as dense: R and sizes are counted in it), the cells touching
// (adj, for the pieces) and each cell's corners (for drawing). The hexagons: hexSpace; Tessera's periodic tilings
// (tools/tilings/tilings.json): tilingSpace. Shared by the searches (Deno) and view.html, index.html (the browser).
import { tilingGrid } from '../tilings/grid.js';

export const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

/* ---- Spaces ---------------------------------------------------------------------------------- */

// N × N hexagons in axial coordinates (q, r), cell r·N + q; middle x = q + r/2, y = r·√3/2 (1 apart)
export function hexSpace(N) {
  const n = N * N, x = new Float64Array(n), y = new Float64Array(n), u = new Float64Array(n), v = new Float64Array(n), start = new Int32Array(n + 1), list = [];
  const D = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];
  for (let r = 0; r < N; r++) for (let q = 0; q < N; q++) {
    const c = r * N + q;
    x[c] = q + r / 2; y[c] = (r * Math.sqrt(3)) / 2; u[c] = q / N; v[c] = r / N;
    start[c] = list.length;
    for (const [dq, dr] of D) list.push(((r + dr + N) % N) * N + ((q + dq + N) % N));
  }
  start[n] = list.length;
  const s = 1 / Math.sqrt(3);
  const shape = (c) => Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 6 + (i * Math.PI) / 3; return [x[c] + Math.cos(a) * s, y[c] + Math.sin(a) * s]; });
  return { name: 'hex', N, n, x, y, u, v, pa: [N, 0], pb: [N / 2, (N * Math.sqrt(3)) / 2], unit: 1, adj: { start, list: Int32Array.from(list) }, shape };
}

// A tiling of tilings.json on W × W lattice cells, as the app lays it (tools/tilings/grid.js); its unit the spacing of
// hexagons of a cell's mean area (hexagons 1 apart have √3/2 each)
export function tilingSpace(name, W) {
  const G = tilingGrid(name, W), n = G.n, x = new Float64Array(n), y = new Float64Array(n), u = new Float64Array(n), v = new Float64Array(n);
  const [a, b] = G.basis;
  for (let c = 0; c < n; c++) {
    const [p, q] = G.lat(c), fu = (((p / W) % 1) + 1) % 1, fv = (((q / W) % 1) + 1) % 1;
    u[c] = fu; v[c] = fv; x[c] = (fu * a[0] + fv * b[0]) * W; y[c] = (fu * a[1] + fv * b[1]) * W;
  }
  const area = Math.abs(a[0] * b[1] - a[1] * b[0]) / G.per;
  return { name, N: W, n, x, y, u, v, pa: [a[0] * W, a[1] * W], pb: [b[0] * W, b[1] * W], unit: Math.sqrt((area * 2) / Math.sqrt(3)), adj: { start: G.start, list: G.list }, shape: G.shape };
}

// N × N squares, cell r·N + q, its four sides' neighbours: Lenia's own grid (Chan's, Plantec's); unit as dense hexagons'
export function squareSpace(N) {
  const n = N * N, x = new Float64Array(n), y = new Float64Array(n), u = new Float64Array(n), v = new Float64Array(n), start = new Int32Array(n + 1), list = [];
  for (let r = 0; r < N; r++) for (let q = 0; q < N; q++) {
    const c = r * N + q;
    x[c] = q; y[c] = r; u[c] = q / N; v[c] = r / N;
    start[c] = list.length;
    for (const [dq, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) list.push(((r + dr + N) % N) * N + ((q + dq + N) % N));
  }
  start[n] = list.length;
  const shape = (c) => [[x[c] - 0.5, y[c] - 0.5], [x[c] + 0.5, y[c] - 0.5], [x[c] + 0.5, y[c] + 0.5], [x[c] - 0.5, y[c] + 0.5]];
  return { name: 'square', N, n, x, y, u, v, pa: [N, 0], pb: [0, N], unit: Math.sqrt(2 / Math.sqrt(3)), adj: { start, list: Int32Array.from(list) }, shape };
}

export const space = (name, N) => (name === 'hex' ? hexSpace(N) : name === 'square' ? squareSpace(N) : tilingSpace(name, N));

// The shortest way from cell i to a point (u, v) on the torus, world units (the 9 images of the nearest)
export const towards = (S, du, dv) => {
  du -= Math.round(du); dv -= Math.round(dv);
  let best = null;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const dx = (du + i) * S.pa[0] + (dv + j) * S.pb[0], dy = (du + i) * S.pa[1] + (dv + j) * S.pb[1];
    if (!best || dx * dx + dy * dy < best[0] * best[0] + best[1] * best[1]) best = [dx, dy];
  }
  return best;
};

// Every pair of cells within D units, its distance (in units): one table a space and reach, kept
const pairsKept = new Map();
function pairs(S, D) {
  const key = `${S.name}|${S.N}|${D}`;
  if (pairsKept.has(key)) return pairsKept.get(key);
  const start = new Int32Array(S.n + 1), list = [], dist = [], lim = D * S.unit;
  for (let i = 0; i < S.n; i++) {
    start[i] = list.length;
    for (let j = 0; j < S.n; j++) {
      if (i === j) continue;
      const [dx, dy] = towards(S, S.u[j] - S.u[i], S.v[j] - S.v[i]);
      if (Math.abs(dx) < lim && Math.abs(dy) < lim) { const d = Math.hypot(dx, dy); if (d < lim) { list.push(j); dist.push(d / S.unit); } }
    }
  }
  start[S.n] = list.length;
  const out = { start, list: Int32Array.from(list), dist: Float64Array.from(dist) };
  pairsKept.set(key, out);
  return out;
}

/* ---- Lenia ----------------------------------------------------------------------------------- */

// The kernels of a setting: p.kernels, each { r (its radius, a share of R), its shape, mu, sigma, h (its weight) }, or
// the one of p.R, p.beta, p.mu, p.sigma. A shape: Chan's rings (beta: their heights), or Plantec's bumps (a, b, w: three
// bells at a, heights b, widths w, faded out past r·R as his sigmoid does)
const kernelsOf = (p) => p.kernels ?? [{ r: 1, beta: p.beta, mu: p.mu, sigma: p.sigma, h: 1 }];

// A kernel's height at d (its distance over r·R)
const core = (r) => (r > 0 && r < 1 ? Math.exp(4 - 1 / (r * (1 - r))) : 0);
const shape = ({ beta, a, b, w }, d) => {
  if (a) return d < 1.5 ? (a.reduce((s, ai, i) => s + b[i] * Math.exp(-((d - ai) ** 2) / w[i]), 0)) / (1 + Math.exp((d - 1) * 10)) : 0;
  const B = beta.length, i = Math.min(B - 1, Math.floor(d * B));
  return d < 1 ? beta[i] * core(d * B - i) : 0;
};

// The kernels on a space: each cell's neighbours within their reach, and each kernel's weights over them (summing to 1)
function kernel(S, p) {
  const ks = kernelsOf(p), P = pairs(S, Math.ceil(p.R * (ks.some((k) => k.a) ? 1.5 : 1)));
  const start = new Int32Array(S.n + 1), nb = [], w = ks.map(() => []);
  for (let c = 0; c < S.n; c++) {
    start[c] = nb.length;
    const sum = ks.map(() => 0);
    for (let k = P.start[c]; k < P.start[c + 1]; k++) {
      const x = ks.map((q) => shape(q, P.dist[k] / (p.R * q.r)));
      if (Math.max(...x) <= 1e-6) continue;
      nb.push(P.list[k]); x.forEach((v, j) => { w[j].push(v); sum[j] += v; });
    }
    w.forEach((wj, j) => { for (let k = start[c]; k < wj.length; k++) wj[k] /= sum[j] || 1; });
  }
  start[S.n] = nb.length;
  return { start, NB: Int32Array.from(nb), Wt: w.map((wj) => Float32Array.from(wj)), ks };
}

// Each kernel's sum at each cell, its growth 2·exp(−(u−μ)²/2σ²) − 1, their sum weighted by h into out
function growth(K, A, out) {
  const { start, NB, Wt, ks } = K, u = new Float64Array(ks.length);
  for (let c = 0; c < out.length; c++) {
    u.fill(0);
    for (let k = start[c], e = start[c + 1]; k < e; k++) { const a = A[NB[k]]; if (a) for (let j = 0; j < ks.length; j++) u[j] += Wt[j][k] * a; }
    let g = 0;
    for (let j = 0; j < ks.length; j++) { const { mu, sigma, h } = ks[j]; g += h * (2 * Math.exp(-((u[j] - mu) ** 2) / (2 * sigma * sigma)) - 1); }
    out[c] = g;
  }
}

// A world: its space, its cells' values, the kernels, one step (A += dt·G, G the growths' mean weighted by h, kept in
// [0, 1])
export function world(S, p) {
  if (p.flow) return flowWorld(S, p);
  const K = kernel(S, p), n = S.n, H = K.ks.reduce((a, k) => a + k.h, 0);
  let A = new Float32Array(n);
  const G = new Float64Array(n);
  const step = () => {
    growth(K, A, G);
    for (let c = 0; c < n; c++) { const v = A[c] + (p.dt * G[c]) / H; A[c] = v < 0 ? 0 : v > 1 ? 1 : v; }
  };
  return { S, n, get A() { return A; }, set A(x) { A = x; }, step };
}

/* ---- Flow Lenia ------------------------------------------------------------------------------ */

// Plantec et al.'s Flow Lenia (2022), as his code (erwanplantec/FlowLenia) does it: matter is never made or lost, only
// moved. G the growths' sum weighted by h; each cell's matter flows up G's slope, and down its own where it is crowded:
// F = (1 − α)·∇G − α·∇A, α = min(1, A²) (θ = 1); his slopes are Sobel's, 8 times the true one, kept so; it goes dt·F
// away (at most 4.35 units, his dd − s), spread over the cells within h units of where it lands (tent weights h − d,
// summing to 1: the mass kept exactly). h 1.13: matter that stays keeps 59% in its cell, the rest to its six, as his
// square of s = 0.65 does. Slopes by least squares over the cells touching (6 on hexagons), so any tiling works
function flowWorld(S, p) {
  const K = kernel(S, p), n = S.n, theta = p.theta ?? 1, h = p.spread ?? 1.13, far = p.reach ?? 4.35, near = pairs(S, Math.ceil(far + h)), at = (c, j) => towards(S, S.u[j] - S.u[c], S.v[j] - S.v[c]).map((t) => t / S.unit);
  // Slope weights: ∇f(c) = Σ_j g_j·(f_j − f_c), g_j = M⁻¹·d_j, M = Σ d·dᵀ over the cells touching
  const { start, list } = S.adj, gx = new Float32Array(list.length), gy = new Float32Array(list.length);
  for (let c = 0; c < n; c++) {
    let a = 0, b = 0, d = 0;
    const ds = [];
    for (let k = start[c]; k < start[c + 1]; k++) { const v = at(c, list[k]); ds.push(v); a += v[0] * v[0]; b += v[0] * v[1]; d += v[1] * v[1]; }
    const det = a * d - b * b;
    ds.forEach(([x, y], i) => { gx[start[c] + i] = (d * x - b * y) / det; gy[start[c] + i] = (a * y - b * x) / det; });
  }
  // Where matter may land: the cell itself and those within far + h units, their offsets
  const ns = new Int32Array(n + 1), nl = [], ox = [], oy = [];
  for (let c = 0; c < n; c++) {
    ns[c] = nl.length; nl.push(c); ox.push(0); oy.push(0);
    for (let k = near.start[c]; k < near.start[c + 1]; k++) { const j = near.list[k], [x, y] = at(c, j); nl.push(j); ox.push(x); oy.push(y); }
  }
  ns[n] = nl.length;
  const NL = Int32Array.from(nl), OX = Float32Array.from(ox), OY = Float32Array.from(oy), w = new Float32Array(Math.max(...Array.from({ length: n }, (_, c) => ns[c + 1] - ns[c])));
  let A = new Float32Array(n), A2 = new Float32Array(n);
  const G = new Float64Array(n), slope = (f, c) => { let x = 0, y = 0; for (let k = start[c]; k < start[c + 1]; k++) { const e = f[list[k]] - f[c]; x += gx[k] * e; y += gy[k] * e; } return [x, y]; };
  const step = () => {
    growth(K, A, G);
    A2.fill(0);
    for (let c = 0; c < n; c++) {
      const m = A[c];
      if (m < 1e-9) continue;
      const al = Math.min(1, (m / theta) ** 2), [ux, uy] = slope(G, c), [ax, ay] = slope(A, c);
      let dx = 8 * p.dt * ((1 - al) * ux - al * ax), dy = 8 * p.dt * ((1 - al) * uy - al * ay);
      const len = Math.hypot(dx, dy);
      if (len > far) { dx *= far / len; dy *= far / len; }
      let sum = 0;
      for (let k = ns[c], i = 0; k < ns[c + 1]; k++, i++) { const t = h - Math.hypot(OX[k] - dx, OY[k] - dy); w[i] = t > 0 ? t : 0; sum += w[i]; }
      for (let k = ns[c], i = 0; k < ns[c + 1]; k++, i++) if (w[i]) A2[NL[k]] += (m * w[i]) / sum;
    }
    [A, A2] = [A2, A];
  };
  return { S, n, get A() { return A; }, set A(x) { A = x; }, step };
}

// A start: a disc of radius r0 units at the torus' middle, random values (the seed's); tilted, rising from one side to
// the other (a push one way: a mover more likely)
export function seedDisc(W, r0, seed, density = 1, tilt = false) {
  const rnd = mulberry32(seed), S = W.S, A = new Float32Array(W.n);
  for (let c = 0; c < W.n; c++) {
    const [x, y] = towards(S, S.u[c] - 0.5, S.v[c] - 0.5).map((t) => t / S.unit);
    if (Math.hypot(x, y) < r0) { const v = rnd(); A[c] = v < density ? rnd() * (tilt ? (1 + x / r0) / 2 : 1) : 0; }
  }
  W.A = A;
}

// The mass, its centre (circular means of u and v) and spread (units), the live cells (> 0.1)
export function measure(W) {
  const { S, A } = W, t = 2 * Math.PI;
  let m = 0, live = 0, cu = 0, su = 0, cv = 0, sv = 0;
  for (let c = 0; c < W.n; c++) {
    const a = A[c];
    if (!a) continue;
    m += a; if (a > 0.1) live++;
    cu += a * Math.cos(S.u[c] * t); su += a * Math.sin(S.u[c] * t); cv += a * Math.cos(S.v[c] * t); sv += a * Math.sin(S.v[c] * t);
  }
  const U = (((Math.atan2(su, cu) / t) % 1) + 1) % 1, V = (((Math.atan2(sv, cv) / t) % 1) + 1) % 1;
  let g = 0;
  if (m) for (let c = 0; c < W.n; c++) { const a = A[c]; if (a) { const [dx, dy] = towards(S, S.u[c] - U, S.v[c] - V); g += a * (dx * dx + dy * dy); } }
  return { m, live, u: U, v: V, rg: m ? Math.sqrt(g / m) / S.unit : 0 };
}

// The pieces: cells > 0.1 joined by the cells touching
export function pieces(W) {
  const { A } = W, { start, list } = W.S.adj, seen = new Uint8Array(W.n);
  let n = 0;
  for (let c = 0; c < W.n; c++) {
    if (seen[c] || A[c] <= 0.1) continue;
    n++; seen[c] = 1;
    const st = [c];
    while (st.length) { const x = st.pop(); for (let k = start[x]; k < start[x + 1]; k++) { const y = list[k]; if (!seen[y] && A[y] > 0.1) { seen[y] = 1; st.push(y); } } }
  }
  return n;
}

/* ---- Patterns -------------------------------------------------------------------------------- */

// Chan's RLE (as lenia.js reads it): counts, '.' empty, 'A'–'X' 1–24, 'p'–'y' then 'A'–'X' 25–255, '$' row end
export function decodeRLE(st) {
  const rows = []; let row = [], count = '', lead = '';
  for (const ch of st) {
    if (ch >= '0' && ch <= '9') count += ch;
    else if (ch === '$' || ch === '!') {
      rows.push(row); row = [];
      for (let i = 1; i < (+count || 1); i++) rows.push([]);
      count = '';
      if (ch === '!') break;
    } else if (ch >= 'p' && ch <= 'y') lead = ch;
    else {
      const v = ch === '.' || ch === 'b' ? 0 : ch === 'o' ? 255 : lead ? (lead.charCodeAt(0) - 112) * 24 + (ch.charCodeAt(0) - 65 + 25) : ch.charCodeAt(0) - 64;
      for (let i = 0; i < (+count || 1); i++) row.push(v / 255);
      count = ''; lead = '';
    }
  }
  if (row.length) rows.push(row);
  return rows;
}

// A square raster laid at the torus' middle, scaled by k (units a pixel), bilinear
export function placeRows(W, rows, k) {
  const S = W.S, A = new Float32Array(W.n), H = rows.length, Wd = Math.max(...rows.map((r) => r.length)), at = (x, y) => rows[y]?.[x] ?? 0;
  for (let c = 0; c < W.n; c++) {
    const [dx, dy] = towards(S, S.u[c] - 0.5, S.v[c] - 0.5), x = dx / S.unit / k + Wd / 2, y = dy / S.unit / k + H / 2, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    A[c] = at(x0, y0) * (1 - fx) * (1 - fy) + at(x0 + 1, y0) * fx * (1 - fy) + at(x0, y0 + 1) * (1 - fx) * fy + at(x0 + 1, y0 + 1) * fx * fy;
  }
  W.A = A;
}

// A world's cells sampled on a square raster around (u, v), side pixels of px units: each pixel the nearest cell's
// value; laid again by placeRows (k = px, or more to enlarge) on this space or another
export function sampleRows(W, U, V, side, px = 1) {
  const S = W.S, near = [];
  for (let c = 0; c < W.n; c++) { const [dx, dy] = towards(S, S.u[c] - U, S.v[c] - V); if (Math.hypot(dx, dy) < side * px * S.unit) near.push([dx / S.unit / px, dy / S.unit / px, W.A[c]]); }
  const rows = [];
  for (let j = 0; j < side; j++) {
    const row = [];
    for (let i = 0; i < side; i++) {
      const x = i - side / 2, y = j - side / 2;
      let best = 0, bd = Infinity;
      for (const [cx, cy, a] of near) { const d = (cx - x) ** 2 + (cy - y) ** 2; if (d < bd) { bd = d; best = a; } }
      row.push(best);
    }
    rows.push(row);
  }
  return rows;
}

/* ---- Runs ------------------------------------------------------------------------------------ */

// One run on a space (p.space, its size p.N; hexagons 48 by default): a disc started (or the cells given), T steps;
// what it became. Stops early when it dies or fills the world
export function run(p, N, T = 2000, cells = null) {
  const S = space(p.space ?? 'hex', p.N ?? N ?? 48), W = world(S, p);
  if (cells) W.A = Float32Array.from(cells); else seedDisc(W, p.r0, p.seed, 1, p.tilt);
  const masses = [];
  let last = measure(W), x = 0, y = 0, x0 = 0, y0 = 0, end = 'alive';
  for (let t = 1; t <= T; t++) {
    W.step();
    if (t % 10) continue;
    const s = measure(W);
    if (s.m < 0.5) return { ...p, end: 'died', t };
    if (s.live > W.n * 0.3) return { ...p, end: 'filled', t };
    const [dx, dy] = towards(S, s.u - last.u, s.v - last.v);
    x += dx / S.unit; y += dy / S.unit;
    if (t === T / 2) { x0 = x; y0 = y; }
    if (t > T / 2) masses.push(s.m);
    last = s;
  }
  const mean = masses.reduce((a, b) => a + b, 0) / masses.length, cv = Math.sqrt(masses.reduce((a, b) => a + (b - mean) ** 2, 0) / masses.length) / mean;
  return { ...p, end, t: T, mass: +mean.toFixed(2), cv: +cv.toFixed(3), live: last.live, rg: +last.rg.toFixed(2), pieces: pieces(W), speed: +(Math.hypot(x - x0, y - y0) / (T / 2)).toFixed(4), ...(p.keep ? { cells: Array.from(W.A, (v) => Math.round(v * 255)) } : {}) };
}
