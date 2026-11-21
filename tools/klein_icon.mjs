// The Klein bottle's icon, drawn from the glass bottle's equations (main.js's glassBottleAt, Shadertoy's 4ltSW8) as Thin
// shows it: its lip at its foot, its handle on top (X = −x, Z = −h). Its body's two sides and its neck's, each one cubic
// (Hermite: its ends and their slopes, read from the equations), its foot's rim an ellipse (seen a little from below), its
// handle's two arcs exact (half a torus: ring 1, tube 0.25); its neck from where it leaves the foot, no stroke inside it.
// Written into main.js's ICONS (the line `const klein = svgPath('…')`): run again after the bottle changes.
//   node tools/klein_icon.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const share = (h) => Math.sin(((1 - h) / 3) * (Math.PI / 2)) ** 2,
  body = (h) => 1.5 - 1.25 * share(h), // (the body's radius at height h)
  neckAxis = (h) => -(1 - Math.cos(((1 - h) / 3) * Math.PI)),
  neck = (h) => 0.5 - 0.25 * share(h); // (the neck's radius)
const S = 4.3, // (its extent, X −1.5 to 2.25 and Z −1.5 to 3.25, centred in 24)
  at = (X, Z) => [12 + (X - 0.375) * S, 12 - (Z - 0.875) * S].map((v) => +v.toFixed(2)),
  words = (p) => p.join(' ');
// a side X(Z), Z from a to b: one cubic, its ends and slopes the curve's
const side = (X, a, b) => {
  const d = 1e-4,
    slope = (z) => (X(z + d) - X(z - d)) / (2 * d),
    third = (b - a) / 3;
  return `M${words(at(X(a), a))}C${words(at(X(a) + slope(a) * third, a + third))} ${words(at(X(b) - slope(b) * third, b - third))} ${words(at(X(b), b))}`;
};
const arc = (r, to) => `A${+(r * S).toFixed(2)} ${+(r * S).toFixed(2)} 0 0 1 ${words(at(...to))}`;
const [x0, y0] = at(-1.5, -1),
  [x1] = at(1.5, -1),
  rim = `M${x0} ${y0}A${+(1.5 * S).toFixed(2)} ${+(0.35 * S).toFixed(2)} 0 1 0 ${x1} ${y0}A${+(1.5 * S).toFixed(2)} ${+(0.35 * S).toFixed(2)} 0 1 0 ${x0} ${y0}`;
const icon = [
  side((Z) => body(-Z), -1, 2),
  side((Z) => -body(-Z), -1, 2),
  side((Z) => -neckAxis(-Z) + neck(-Z), 0.2, 2),
  side((Z) => -neckAxis(-Z) - neck(-Z), 0.2, 2),
  rim,
  `M${words(at(-0.25, 2))}${arc(1.25, [2.25, 2])}M${words(at(0.25, 2))}${arc(0.75, [1.75, 2])}`,
].join('');
const main = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'main.js'),
  source = fs.readFileSync(main, 'utf8'),
  line = /const klein = svgPath\(\s*'[^']*',?\s*\);/;
if (!line.test(source)) throw new Error("main.js: no `const klein = svgPath('…')`");
fs.writeFileSync(main, source.replace(line, `const klein = svgPath(\n    '${icon}',\n  );`)); // (as Prettier leaves it)
console.log(icon.length, 'characters');
