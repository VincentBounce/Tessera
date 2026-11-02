// Lenia on a hexagonal grid, a small radius: each cell a value in [0, 1], its neighbours within R (centres 1 apart)
// weighted by Chan's kernel (rings of a bell, beta their heights), then growth G(u) = 2·exp(−(u−μ)²/2σ²) − 1, A += dt·G.
// The grid: N × N cells in axial coordinates (q, r), a torus by the translations (N, 0) and (0, N); centre x = q + r/2,
// y = r·√3/2. Shared by search.js (Deno) and view.html (the browser).

export const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// The kernel's offsets (dq, dr) and weights, summing to 1
export function kernel(R, beta) {
  const core = (r) => (r > 0 && r < 1 ? Math.exp(4 - 1 / (r * (1 - r))) : 0), B = beta.length, out = [];
  const m = Math.ceil(R) + 1;
  for (let dr = -2 * m; dr <= 2 * m; dr++) for (let dq = -2 * m; dq <= 2 * m; dq++) {
    const d = Math.hypot(dq + dr / 2, (dr * Math.sqrt(3)) / 2) / R;
    if (d <= 0 || d >= 1) continue;
    const i = Math.min(B - 1, Math.floor(d * B)), w = beta[i] * core(d * B - i);
    if (w > 1e-6) out.push([dq, dr, w]);
  }
  const sum = out.reduce((a, o) => a + o[2], 0);
  return out.map(([dq, dr, w]) => [dq, dr, w / sum]);
}

// A world: its cells, the neighbours' table, one step
export function world(N, p) {
  const K = kernel(p.R, p.beta), n = N * N, k = K.length, nb = new Int32Array(n * k), w = new Float32Array(K.map((o) => o[2]));
  for (let r = 0; r < N; r++) for (let q = 0; q < N; q++) K.forEach(([dq, dr], j) => { nb[(r * N + q) * k + j] = ((r + dr + N) % N) * N + ((q + dq + N) % N); });
  let A = new Float32Array(n), B = new Float32Array(n);
  const s2 = 2 * p.sigma * p.sigma;
  const step = () => {
    for (let c = 0; c < n; c++) {
      let u = 0;
      for (let j = 0, o = c * k; j < k; j++) u += w[j] * A[nb[o + j]];
      const g = 2 * Math.exp(-((u - p.mu) ** 2) / s2) - 1, v = A[c] + p.dt * g;
      B[c] = v < 0 ? 0 : v > 1 ? 1 : v;
    }
    [A, B] = [B, A];
  };
  return { N, n, k, get A() { return A; }, set A(x) { A = x; }, step };
}

// A start: a disc of radius r0 cells at the centre, random values (the seed's); tilted, rising from one side to the
// other (a push one way: a mover more likely)
export function seedDisc(W, r0, seed, density = 1, tilt = false) {
  const rnd = mulberry32(seed), N = W.N, A = new Float32Array(W.n), c = N / 2;
  for (let r = 0; r < N; r++) for (let q = 0; q < N; q++) {
    const x = q - c + (r - c) / 2, y = ((r - c) * Math.sqrt(3)) / 2;
    if (Math.hypot(x, y) < r0) { const v = rnd(); A[r * N + q] = v < density ? rnd() * (tilt ? (1 + x / r0) / 2 : 1) : 0; }
  }
  W.A = A;
}

// The mass, its centre (circular means in q and r) and spread (Euclidean, in cells), the live cells (> 0.1)
export function measure(W) {
  const { N, A } = W, t = (2 * Math.PI) / N;
  let m = 0, live = 0, cq = 0, sq = 0, cr = 0, sr = 0;
  for (let r = 0; r < N; r++) for (let q = 0; q < N; q++) {
    const a = A[r * N + q];
    if (!a) continue;
    m += a; if (a > 0.1) live++;
    cq += a * Math.cos(q * t); sq += a * Math.sin(q * t); cr += a * Math.cos(r * t); sr += a * Math.sin(r * t);
  }
  const wrap = (x) => ((x % N) + N) % N, Q = wrap(Math.atan2(sq, cq) / t), Rr = wrap(Math.atan2(sr, cr) / t), d = (a, b) => ((a - b + 1.5 * N) % N) - N / 2;
  let g = 0;
  if (m) for (let r = 0; r < N; r++) for (let q = 0; q < N; q++) {
    const a = A[r * N + q];
    if (!a) continue;
    const dq = d(q, Q), dr = d(r, Rr);
    g += a * ((dq + dr / 2) ** 2 + (dr * dr * 3) / 4);
  }
  return { m, live, q: Q, r: Rr, rg: m ? Math.sqrt(g / m) : 0 };
}

// The pieces: cells > 0.1 joined by the 6 neighbours
export function pieces(W) {
  const { N, A } = W, seen = new Uint8Array(W.n), D = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];
  let n = 0;
  for (let c = 0; c < W.n; c++) {
    if (seen[c] || A[c] <= 0.1) continue;
    n++; seen[c] = 1;
    const st = [c];
    while (st.length) {
      const x = st.pop(), q = x % N, r = (x / N) | 0;
      for (const [dq, dr] of D) { const y = ((r + dr + N) % N) * N + ((q + dq + N) % N); if (!seen[y] && A[y] > 0.1) { seen[y] = 1; st.push(y); } }
    }
  }
  return n;
}

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

// A square grid's pattern laid on the hexagons at the centre, scaled by k (hex cells a square cell), bilinear
export function placeSquare(W, rows, k) {
  const N = W.N, A = new Float32Array(W.n), H = rows.length, Wd = Math.max(...rows.map((r) => r.length)), c = N / 2;
  const at = (x, y) => rows[y]?.[x] ?? 0;
  for (let r = 0; r < N; r++) for (let q = 0; q < N; q++) {
    const x = (q - c + (r - c) / 2) / k + Wd / 2, y = (((r - c) * Math.sqrt(3)) / 2) / k + H / 2, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    A[r * N + q] = at(x0, y0) * (1 - fx) * (1 - fy) + at(x0 + 1, y0) * fx * (1 - fy) + at(x0, y0 + 1) * (1 - fx) * fy + at(x0 + 1, y0 + 1) * fx * fy;
  }
  W.A = A;
}

// A creature's hexagons sampled on a square raster (1 unit = 1 hex cell apart), around its centre (q, r), side S:
// each pixel the hexagon it falls in (axial rounding); laid again by placeSquare at another scale
export function hexRows(cells, N, Q, Rr, S) {
  const rows = [];
  for (let j = 0; j < S; j++) {
    const row = [];
    for (let i = 0; i < S; i++) {
      const x = i - S / 2, y = j - S / 2, fr = y / (Math.sqrt(3) / 2), fq = x - fr / 2;
      let rq = Math.round(fq), rr = Math.round(fr), rs = Math.round(-fq - fr);
      const dq = Math.abs(rq - fq), dr = Math.abs(rr - fr), ds = Math.abs(rs + fq + fr);
      if (dq > dr && dq > ds) rq = -rr - rs; else if (dr > ds) rr = -rq - rs;
      const q = (((Math.round(Q) + rq) % N) + N) % N, r = (((Math.round(Rr) + rr) % N) + N) % N;
      row.push(cells[r * N + q]);
    }
    rows.push(row);
  }
  return rows;
}

// One run: a disc started (or the cells given), T steps; what it became. Stops early when it dies or fills the world
export function run(p, N = 48, T = 2000, cells = null) {
  const W = world(N, p);
  if (cells) W.A = Float32Array.from(cells); else seedDisc(W, p.r0, p.seed, 1, p.tilt);
  const masses = [];
  let last = measure(W), x = 0, y = 0, x0 = 0, y0 = 0, end = 'alive';
  const d = (a, b) => ((a - b + 1.5 * N) % N) - N / 2;
  for (let t = 1; t <= T; t++) {
    W.step();
    if (t % 10) continue;
    const s = measure(W);
    if (s.m < 0.5) { end = 'died'; last = s; return { ...p, end, t }; }
    if (s.live > W.n * 0.3) { end = 'filled'; return { ...p, end, t }; }
    const dq = d(s.q, last.q), dr = d(s.r, last.r);
    x += dq + dr / 2; y += (dr * Math.sqrt(3)) / 2;
    if (t === T / 2) { x0 = x; y0 = y; }
    if (t > T / 2) masses.push(s.m);
    last = s;
  }
  const mean = masses.reduce((a, b) => a + b, 0) / masses.length, cv = Math.sqrt(masses.reduce((a, b) => a + (b - mean) ** 2, 0) / masses.length) / mean;
  return { ...p, end, t: T, mass: +mean.toFixed(2), cv: +cv.toFixed(3), live: last.live, rg: +last.rg.toFixed(2), pieces: pieces(W), speed: +(Math.hypot(x - x0, y - y0) / (T / 2)).toFixed(4), ...(p.keep ? { cells: Array.from(W.A, (v) => Math.round(v * 255)) } : {}) };
}
