// Sugimoto's rosette of equilateral hexagons as main.js builds it (a copy: HEXAS; discPatch in ./patch.js), and its grid for
// the searches
import { discPatch, patchGrid } from './patch.js';
/* Sugimoto's rosette of equilateral hexagons (arXiv 2005.10639, its Figures 1, 6 and 16 to 19): a hexagon of sides 1, its
 * tips A and D 360°/n, its other corners 180° − 180°/n, in 2n cones round the middle, each a staircase of translates
 * (rows of 1, 2, 3… across it, a row a step (1 + cos 180°/n, ± sin 180°/n) along it): the n along the axes k · 360°/n their
 * first tile's tip at the middle, the n between theirs 1 further out. As the rosettes: its W² tiles nearest its middle,
 * each a square unit */
const HEXAS = function HEXAS(n) {
  const t = Math.PI / n, c = Math.cos(t), s = Math.sin(t), U = 1 / Math.sqrt(2 * s * (c + 1));  // (a tile a square unit)
  const hexa = [[0, 0], [c, s], [c + 1, s], [2 * c + 1, 0], [c + 1, -s], [c, -s]];  // (A to F, its tip A at 0, along +x)
  const cache = {};
  return (W) => cache[W] ??= (() => {
    const J = Math.ceil((0.525 * W * Math.SQRT2 + 5) / U / (c + 1)) + 2, items = [];  // (rows enough round the W² tiles' square)
    for (let k = 0; k < 2 * n; k++) {
      const co = Math.cos(k * t), si = Math.sin(k * t), o = k % 2 ? [co, si] : [0, 0];
      for (let i = 0; i < J; i++) for (let j = 0; j <= i; j++) {
        const p = hexa.map(([x, y]) => [x + i * (c + 1), y + (i - 2 * j) * s]).map(([x, y]) => [(o[0] + co * x - si * y) * U, (o[1] + si * x + co * y) * U]);
        items.push({ p, m: [0, 1].map((d) => p.reduce((sum, q) => sum + q[d], 0) / p.length) });
      }
    }
    return discPatch(items, W, (it) => it.p, [0, 0]);
  })();
};
export const hexasGrid = (n, W) => patchGrid(HEXAS(n)(W), W);  // (n: its turns, Hexa n)
export { HEXAS };
