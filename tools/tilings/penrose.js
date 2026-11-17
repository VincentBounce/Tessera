// Penrose's tilings as main.js builds them (a copy: PENROSE_RULES, penroseTiles; discPatch in ./patch.js), and their grids
// for the searches: the rhombi, the kites and darts, the Tübingen triangles
import { discPatch, patchGrid, pointKey } from './patch.js';
/* A wheel of 10 Robinson triangles cut again and again (each time φ smaller; about φ² as many), each rule its cut, its
 * wheel (its triangles' hands) and how two halves make a tile (shared: the edge they share; none: each triangle a tile).
 * As the hats' (see discPatch); each tile about a square unit */
const PENROSE_RULES = {
  // the rhombi (P3): a thin triangle in 2, a thick one in 3, two sharing their base B C a rhombus (thick: 72°, thin: 36°)
  rhombi: {
    wheel: '+-+-+-+-+-',
    side: 1.11,
    cut: (c, A, B, C, lerp, phi) => {
      if (c === 0) {
        const P = lerp(A, B, 1 / phi);
        return [
          [0, C, P, B],
          [1, P, C, A],
        ];
      }
      const Q = lerp(B, A, 1 / phi),
        S = lerp(B, C, 1 / phi);
      return [
        [1, S, C, A],
        [1, Q, S, B],
        [0, S, Q, A],
      ];
    },
    shared: (A, B, C) => [B, C],
    tile: ([A, B, C], [other]) => [A, B, other, C],
  },
  // the kites and darts (P2): two halves sharing their axis A B a kite or a dart
  kitesDarts: {
    wheel: '+-+-+-+-+-',
    side: 1.41,
    cut: (c, A, B, C, lerp, phi) => {
      const dart = (A, B, C) => {
        const Q = lerp(B, C, 1 / phi);
        return [
          [0, B, A, Q],
          [1, Q, C, A],
        ];
      };
      if (c === 1) return dart(A, B, C);
      const P = lerp(B, A, 1 / phi ** 2);
      return [[0, C, P, B], ...dart(P, C, A)];
    },
    shared: (A, B) => [A, B],
    tile: ([A, B, C], [, , other]) => [A, C, B, other],
  },
  // the Tübingen triangles: Robinson's triangles as tiles, its wheel the only one its substitution makes
  tubingen: {
    wheel: '++-++--+--',
    side: 2,
    cut: (c, A, B, C, lerp, phi) => {
      if (c === 1) {
        const P = lerp(B, C, 1 / phi ** 2);
        return [
          [1, P, A, B],
          [0, C, A, P],
        ];
      }
      const X = lerp(A, B, 1 / phi),
        Y = lerp(A, C, 1 / phi);
      return [
        [0, A, Y, X],
        [1, X, Y, B],
        [0, B, C, Y],
      ];
    },
    shared: null,
  },
};
const penroseOf = (rule) => {
  const phi = (1 + Math.sqrt(5)) / 2,
    cache = {},
    lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  return (W) =>
    (cache[W] ??= (() => {
      let n = 0;
      while (10 * phi ** (2 * n) < 14 * W * W) n++; // (about 6 W² tiles, 2 triangles each or fewer)
      while (n % 4 !== 1) n++; // (n one more than a multiple of 4 at every size: the wheel's middle comes back every 4 cuts,
      // its patterns found there at 43, n 9, see CENTRED; other n, another middle, none of them laid at 21 or 85 before)
      const R = rule.side * phi ** n; // (the tiles' sides rule.side: their mean area about 1)
      let tris = Array.from({ length: 10 }, (_, i) => {
        const B = [R * Math.cos(((2 * i - 1) * Math.PI) / 10), R * Math.sin(((2 * i - 1) * Math.PI) / 10)],
          C = [R * Math.cos(((2 * i + 1) * Math.PI) / 10), R * Math.sin(((2 * i + 1) * Math.PI) / 10)];
        return rule.wheel[i] === '+' ? [0, [0, 0], B, C] : [0, [0, 0], C, B];
      });
      for (let k = 0; k < n; k++) tris = tris.flatMap(([c, A, B, C]) => rule.cut(c, A, B, C, lerp, phi));
      const items = [];
      if (!rule.shared)
        for (const [, A, B, C] of tris)
          items.push({ p: [A, B, C], m: [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3] });
      else {
        const key = (p) => pointKey(p, 1e4),
          half = new Map();
        for (const [c, A, B, C] of tris) {
          const [p, q] = rule.shared(A, B, C),
            k = `${c}|${[key(p), key(q)].sort().join('|')}`,
            other = half.get(k);
          if (!other) {
            half.set(k, [A, B, C]);
            continue;
          }
          items.push({ p: rule.tile([A, B, C], other), m: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2] });
        }
      }
      return discPatch(items, W, (h) => h.p, [0, 0]); // (round the wheel's middle)
    })());
};
const PENROSE = penroseOf(PENROSE_RULES.rhombi),
  KITES_DARTS = penroseOf(PENROSE_RULES.kitesDarts),
  TUBINGEN = penroseOf(PENROSE_RULES.tubingen);
export const penroseGrid = (W) => patchGrid(PENROSE(W), W);
export const kitesDartsGrid = (W) => patchGrid(KITES_DARTS(W), W);
export const tubingenGrid = (W) => patchGrid(TUBINGEN(W), W);
export { PENROSE, KITES_DARTS, TUBINGEN };
