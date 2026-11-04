// Kites (each triangle cut in 3) on a W × W torus of rhombi, as the app's plane: cell t = y * 6W + x
export const kitesOf = (c) => {
  const m = [0, 1].map((d) => (c[0][d] + c[1][d] + c[2][d]) / 3), half = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  return [0, 1, 2].map((k) => [c[k], half(c[k], c[(k + 1) % 3]), m, half(c[(k + 2) % 3], c[k])]);
};
export const kiteCorners = (x, y) => { const t = Math.floor(x / 3), i = t >> 1; return kitesOf(t & 1 ? [[i + 1, y], [i + 1, y + 1], [i, y + 1]] : [[i, y], [i + 1, y], [i, y + 1]])[((x % 3) + 3) % 3]; };
// a grid of cells by their corners (in lattice units, see latticeAt), per a rhombus of the lattice, on a W × W torus of
// rhombi, as the app's plane: cell t = y * per·W + x; neighbours the cells sharing a corner, each by a side (two corners
// shared, 1) or a corner only (0): the letters; mid(t), its middle in world units (main.js's latticeAt)
function cornersGrid(W, per, cornersOf) {
  const row = per * W, n = row * W, byCorner = new Map(), M = 6 * W;
  const key = (u, v) => ((Math.round(u * 6) % M) + M) % M * 100000 + ((Math.round(v * 6) % M) + M) % M;
  for (let y = 0; y < W; y++) for (let x = 0; x < row; x++) for (const [u, v] of cornersOf(x, y)) {
    const k = key(u, v);
    (byCorner.get(k) ?? byCorner.set(k, []).get(k)).push(y * row + x);
  }
  const start = new Int32Array(n + 1), list = [], side = [];
  for (let y = 0; y < W; y++) for (let x = 0; x < row; x++) {
    const t = y * row + x, around = new Map();
    for (const [u, v] of cornersOf(x, y)) for (const c of byCorner.get(key(u, v))) if (c !== t) around.set(c, (around.get(c) ?? 0) + 1);
    start[t] = list.length;
    for (const [c, shared] of [...around].sort((p, q) => p[0] - q[0])) { list.push(c); side.push(shared >= 2 ? 1 : 0); }
  }
  start[n] = list.length;
  const mid = (t) => { const c = cornersOf(t % row, Math.floor(t / row)), u = c.reduce((s, p) => s + p[0], 0) / c.length, v = c.reduce((s, p) => s + p[1], 0) / c.length; return [u + v / 2, (v * Math.sqrt(3)) / 2]; };
  return { W, row, n, per, start, list: Int32Array.from(list), side: Uint8Array.from(side), mid };
}
export const grid = (W) => cornersGrid(W, 6, kiteCorners);
// the triangles, two a rhombus, as main.js's planeCorners has them
export const triCorners = (x, y) => { const i = x >> 1; return x & 1 ? [[i + 1, y], [i + 1, y + 1], [i, y + 1]] : [[i, y], [i + 1, y], [i, y + 1]]; };
export const triGrid = (W) => cornersGrid(W, 2, triCorners);
// Squares (8 neighbours) on an N × N torus, for Life as the reference
export function squareGrid(N) {
  const n = N * N, start = new Int32Array(n + 1), list = [];
  for (let t = 0; t < n; t++) {
    const x = t % N, y = Math.floor(t / N);
    start[t] = list.length;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) list.push(((y + dy + N) % N) * N + ((x + dx + N) % N));
  }
  start[n] = list.length;
  return { W: N, row: N, n, per: 1, start, list: Int32Array.from(list), mid: (t) => [t % N, Math.floor(t / N)] };
}
