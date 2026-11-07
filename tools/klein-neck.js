// The Klein bottle's neck (main.js, KLEIN_NECK, KLEIN_SOFT): the loop's line fitted to a model's (Klein Bottle.STL), then that
// line widened (WIDEN: its x × it) and its descent below ZE replaced by a soft arrival into the mouth (a Hermite curve, SOFT
// its tangents' length), fitted again; the bottle blends the two (see kleinNeck). Run: deno run tools/klein-neck.js 1.111 8.5 1.3
const P = Math.PI;
const RHO = 1, RW = 4.66, D = 3.5, H = 10.1;  // the tube's radius, the body's widest, the bowl's depth, the body's height
// the neck's centreline target (x, z), from the body's top (0, H) going up, over to the west, down into the body, to the mouth (0, 0)
const WIDEN = Number(Deno.args[0] ?? 1);
const T0 = [[0, H], [0.04, 11.5], [-0.16, 12.1], [-0.36, 12.9], [-0.7, 13.5], [-1.36, 14], [-2.68, 14.3], [-4.1, 13.9], [-4.78, 13.3], [-5.24, 12.5], [-5.4, 11.5], [-5.38, 10.9], [-5.24, 10.1], [-5.02, 9.3], [-4.72, 8.5], [-4.34, 7.7], [-3.82, 6.7], [-3.36, 5.9], [-2.92, 5.3], [-2.64, 4.5], [-2.28, 3.9], [-1.8, 3.1], [-1.5, 2.3], [-0.98, 1.5], [-0.5, 0.7], [0, 0]];
const N0 = [-377.0041, 30.8525, 41.7229, 49.6112, -42.7536, -51.1395, 50.0963], F0 = [N0[0] * WIDEN, N0[1] * WIDEN, N0[2] * WIDEN, ...N0.slice(3)];
const ZE = Number(Deno.args[1] ?? 6.5), SOFT = Number(Deno.args[2] ?? 1);
const base = (t) => { const [a, b, c, d, e, f, g] = F0, w = t ** 3 * (1 - t) ** 3; return [w * (a + b * t + c * t * t), H * (1 - t) + t * (1 - t) * (d + e * t + f * t * t + g * t ** 3)]; };
let te = 0.99; for (let t = 0.5; t < 1; t += 1e-4) if (base(t)[1] < ZE) { te = t; break; }
const E = base(te), E2 = base(te + 1e-4), tan = [(E2[0] - E[0]) / 1e-4, (E2[1] - E[1]) / 1e-4], tl0 = Math.hypot(...tan), chord = Math.hypot(E[0], E[1]) * SOFT;
const U = [tan[0] / tl0 * chord, tan[1] / tl0 * chord], V = [0, -chord];  // (its tangent there, and upright into the mouth)
const herm = (s) => { const h00 = 2 * s ** 3 - 3 * s * s + 1, h10 = s ** 3 - 2 * s * s + s, h01 = -2 * s ** 3 + 3 * s * s, h11 = s ** 3 - s * s; return [h00 * E[0] + h10 * U[0] + h11 * V[0], h00 * E[1] + h10 * U[1] + h11 * V[1]]; };
const T = [...Array.from({ length: 40 }, (_, k) => base((te * k) / 40)), ...Array.from({ length: 13 }, (_, k) => herm(k / 12))];
const curve = (p, t) => { const [a, b, c, d, e, f, g] = p, w = t ** 3 * (1 - t) ** 3; return [w * (a + b * t + c * t * t), H * (1 - t) + t * (1 - t) * (d + e * t + f * t * t + g * t ** 3)]; };
function sampled(f, N = 3000) { const q = [], c = [0]; for (let i = 0; i <= N; i++) q.push(f(i / N)); for (let i = 1; i <= N; i++) c.push(c[i - 1] + Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1])); return { q, c, L: c[N] }; }
function curvMax(q) { let k = 0; for (let i = 1; i < q.length - 1; i++) { const ax = q[i][0] - q[i - 1][0], az = q[i][1] - q[i - 1][1], bx = q[i + 1][0] - q[i][0], bz = q[i + 1][1] - q[i][1]; k = Math.max(k, Math.abs(Math.atan2(ax * bz - az * bx, ax * bx + az * bz) / ((Math.hypot(ax, az) + Math.hypot(bx, bz)) / 2))); } return k; }
// the fit: each target at its share of the target polyline's length
const tl = [0]; for (let i = 1; i < T.length; i++) tl.push(tl[i - 1] + Math.hypot(T[i][0] - T[i - 1][0], T[i][1] - T[i - 1][1]));
function cost(p) { const S = sampled((t) => curve(p, t), 600); let e = 0; T.forEach((pt, k) => { const at = (S.L * tl[k]) / tl.at(-1); const i = Math.max(0, S.c.findIndex((c) => c >= at)); e += (S.q[i][0] - pt[0]) ** 2 + (S.q[i][1] - pt[1]) ** 2; }); return e + 200 * Math.max(0, curvMax(S.q) - 0.9) ** 2 + 2 * kRate(S.q) ** 2; }
function kRate(q) { const k = []; for (let i = 1; i < q.length - 1; i++) { const ax = q[i][0] - q[i - 1][0], az = q[i][1] - q[i - 1][1], bx = q[i + 1][0] - q[i][0], bz = q[i + 1][1] - q[i][1], ds = (Math.hypot(ax, az) + Math.hypot(bx, bz)) / 2; k.push([Math.atan2(ax * bz - az * bx, ax * bx + az * bz) / ds, ds]); } let m = 0; for (let i = 1; i < k.length; i++) m = Math.max(m, Math.abs(k[i][0] - k[i - 1][0]) / k[i][1]); return m; }
function nm(f, x0, step, it = 8000) { let s = [x0, ...x0.map((_, i) => x0.map((v, j) => v + (i === j ? step : 0)))].map((x) => [x, f(x)]);
  for (let k = 0; k < it; k++) { s.sort((a, b) => a[1] - b[1]); const n = x0.length, c = x0.map((_, j) => s.slice(0, n).reduce((a, p) => a + p[0][j], 0) / n), w = s[n][0];
    const r = c.map((v, j) => 2 * v - w[j]), fr = f(r);
    if (fr < s[0][1]) { const e = c.map((v, j) => 3 * v - 2 * w[j]), fe = f(e); s[n] = fe < fr ? [e, fe] : [r, fr]; } else if (fr < s[n - 1][1]) s[n] = [r, fr];
    else { const ct = c.map((v, j) => (v + w[j]) / 2), fc = f(ct); if (fc < s[n][1]) s[n] = [ct, fc]; else s = s.map((q, i) => (i ? [q[0].map((v, j) => (v + s[0][0][j]) / 2), f(q[0].map((v, j) => (v + s[0][0][j]) / 2))] : q)); } }
  s.sort((a, b) => a[1] - b[1]); return s[0]; }
let best = nm(cost, F0, 20); for (let r = 0; r < 6; r++) best = nm(cost, best[0], 5);
const p = best[0], S = sampled((t) => curve(p, t));
console.log('WIDEN', WIDEN, 'ZE', ZE, 'SOFT', SOFT, 'kRate', kRate(S.q).toFixed(3)); console.log('neck', JSON.stringify(p.map((v) => +v.toFixed(4))), 'fit', best[1].toFixed(3), 'kmax', curvMax(S.q).toFixed(3), 'len', S.L.toFixed(2));

