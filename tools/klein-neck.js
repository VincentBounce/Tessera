// The Klein bottle's neck (main.js, KLEIN_NECK): its line fitted to a glass bottle's silhouette, its curvature kept under
// 0.52 and its change gentle (no tile much longer than its neighbour). Run: deno run --allow-write tools/klein-neck.js
const P = Math.PI;
const RHO = 1, RW = 4, D = 3, H = 9.5;  // the tube's radius, the body's widest, the bowl's depth, the body's height
// the neck's centreline target (x, z), from the body's top (0, H) going up, over to the west, down into the body, to the mouth (0, 0)
const T = [[0, H], [0, 10.5], [-0.15, 12], [-0.8, 14.4], [-2.1, 15.5], [-3.4, 15], [-4.15, 13.4], [-4.3, 11.5], [-4, 9.5], [-3.3, 7.4], [-2.4, 5.5], [-1.3, 3.8], [-0.4, 2.2], [-0.05, 1], [0, 0]];
const curve = (p, t) => { const [a, b, c, d, e, f, g] = p, w = t ** 3 * (1 - t) ** 3; return [w * (a + b * t + c * t * t), H * (1 - t) + t * (1 - t) * (d + e * t + f * t * t + g * t ** 3)]; };
function sampled(f, N = 3000) { const q = [], c = [0]; for (let i = 0; i <= N; i++) q.push(f(i / N)); for (let i = 1; i <= N; i++) c.push(c[i - 1] + Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1])); return { q, c, L: c[N] }; }
function curvMax(q) { let k = 0; for (let i = 1; i < q.length - 1; i++) { const ax = q[i][0] - q[i - 1][0], az = q[i][1] - q[i - 1][1], bx = q[i + 1][0] - q[i][0], bz = q[i + 1][1] - q[i][1]; k = Math.max(k, Math.abs(Math.atan2(ax * bz - az * bx, ax * bx + az * bz) / ((Math.hypot(ax, az) + Math.hypot(bx, bz)) / 2))); } return k; }
// the fit: each target at its share of the target polyline's length
const tl = [0]; for (let i = 1; i < T.length; i++) tl.push(tl[i - 1] + Math.hypot(T[i][0] - T[i - 1][0], T[i][1] - T[i - 1][1]));
function cost(p) { const S = sampled((t) => curve(p, t), 600); let e = 0; T.forEach((pt, k) => { const at = (S.L * tl[k]) / tl.at(-1); const i = Math.max(0, S.c.findIndex((c) => c >= at)); e += (S.q[i][0] - pt[0]) ** 2 + (S.q[i][1] - pt[1]) ** 2; }); return e + 200 * Math.max(0, curvMax(S.q) - 0.5) ** 2 + 2 * kRate(S.q) ** 2; }
function kRate(q) { const k = []; for (let i = 1; i < q.length - 1; i++) { const ax = q[i][0] - q[i - 1][0], az = q[i][1] - q[i - 1][1], bx = q[i + 1][0] - q[i][0], bz = q[i + 1][1] - q[i][1], ds = (Math.hypot(ax, az) + Math.hypot(bx, bz)) / 2; k.push([Math.atan2(ax * bz - az * bx, ax * bx + az * bz) / ds, ds]); } let m = 0; for (let i = 1; i < k.length; i++) m = Math.max(m, Math.abs(k[i][0] - k[i - 1][0]) / k[i][1]); return m; }
function nm(f, x0, step, it = 8000) { let s = [x0, ...x0.map((_, i) => x0.map((v, j) => v + (i === j ? step : 0)))].map((x) => [x, f(x)]);
  for (let k = 0; k < it; k++) { s.sort((a, b) => a[1] - b[1]); const n = x0.length, c = x0.map((_, j) => s.slice(0, n).reduce((a, p) => a + p[0][j], 0) / n), w = s[n][0];
    const r = c.map((v, j) => 2 * v - w[j]), fr = f(r);
    if (fr < s[0][1]) { const e = c.map((v, j) => 3 * v - 2 * w[j]), fe = f(e); s[n] = fe < fr ? [e, fe] : [r, fr]; } else if (fr < s[n - 1][1]) s[n] = [r, fr];
    else { const ct = c.map((v, j) => (v + w[j]) / 2), fc = f(ct); if (fc < s[n][1]) s[n] = [ct, fc]; else s = s.map((q, i) => (i ? [q[0].map((v, j) => (v + s[0][0][j]) / 2), f(q[0].map((v, j) => (v + s[0][0][j]) / 2))] : q)); } }
  s.sort((a, b) => a[1] - b[1]); return s[0]; }
let best = nm(cost, [-300, 0, 0, 30, 0, 0, 0], 60); for (let r = 0; r < 4; r++) best = nm(cost, best[0], 10);
const p = best[0], S = sampled((t) => curve(p, t));
console.log('kRate', kRate(S.q).toFixed(3)); console.log('neck', JSON.stringify(p.map((v) => +v.toFixed(4))), 'fit', best[1].toFixed(3), 'kmax', curvMax(S.q).toFixed(3), 'len', S.L.toFixed(2));

