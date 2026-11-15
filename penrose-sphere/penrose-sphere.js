/* ==============================================================================================
 * PENROSE SPHERE — penrose-sphere.js
 * ==============================================================================================
 *
 * A prototype, apart from main.js: Twarock and Konevtsova's spherical Penrose tilings, as Hamish Todd
 * builds them (Bridges 2018, "A Class of Spherical Penrose-Like Tilings…"): a "wrapping paper pattern".
 * A Penrose rhombus tiling of the plane, five-fold round the origin (de Bruijn's pentagrid), is cut in a
 * regular pentagon round its middle, its corners P1 and P1 turned by 72° four times; the pentagon laid on
 * each of the dodecahedron's 12 faces, the same way round (the icosahedron's turns: its content five-fold
 * itself, any of a face's 5 turns lays the same); its points joined where they lie 1 apart along the
 * surface (two faces unfolded over their edge). The tiles are the faces of that graph. Not every P1 gives a
 * tiling (Todd's algorithm II: its candidates, the tiling's points and a few steps off them along the
 * decagon's ways); those whose every corner closes are listed, the size their pentagon's radius.
 *
 * How it fits together:
 *   PART 1 — The plane's tiling (pentagrid)
 *   PART 2 — The dodecahedron and the pentagon laid on its faces
 *   PART 3 — The graph: points, edges 1 apart, tiles
 *   PART 4 — The candidates for P1, those that close
 *   PART 5 — Drawing and the panel
 */

/* ==============================================================================================
 * PART 1 — THE PLANE'S TILING (PENTAGRID)
 * ==============================================================================================
 *
 * De Bruijn's pentagrid: five families of parallel lines x·e_i = n + γ, every γ 0.2 (their sum 1: a Penrose
 * tiling, five-fold round the origin, its grid's turn by 72° its own); each crossing of two lines a rhombus,
 * its corners Σ K_i e_i, K_i the strip the crossing lies in. Unit edges: thick rhombi (72°) and thin (36°).
 */
const PHI = (1 + Math.sqrt(5)) / 2;
const TAU = 2 * Math.PI;
const E = [0, 1, 2, 3, 4].map((i) => [Math.cos((TAU * i) / 5), Math.sin((TAU * i) / 5)]);
const GAMMA = 0.2;
const dot2 = (a, b) => a[0] * b[0] + a[1] * b[1];
const key2 = (p) => `${Math.round(p[0] * 1e6)},${Math.round(p[1] * 1e6)}`;

// the tiling's points within radius R of its middle
function penrosePoints(R) {
  const points = new Map(),
    N = Math.ceil((2 * R) / 5) + 3; // (a point Σ K_i e_i lies near 5/2 the crossing: the grid's lines as far)
  for (let j = 0; j < 5; j++)
    for (let k = j + 1; k < 5; k++) {
      const det = E[j][0] * E[k][1] - E[j][1] * E[k][0];
      for (let nj = -N; nj <= N; nj++)
        for (let nk = -N; nk <= N; nk++) {
          const a = nj + GAMMA,
            b = nk + GAMMA,
            p = [(a * E[k][1] - b * E[j][1]) / det, (b * E[j][0] - a * E[k][0]) / det]; // (the crossing: p·e_j = a, p·e_k = b)
          const K = E.map((e, i) => (i === j ? nj : i === k ? nk : Math.ceil(dot2(p, e) - GAMMA)));
          for (const [dj, dk] of [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
          ]) {
            const L = K.map((v, i) => v + (i === j ? dj : i === k ? dk : 0)),
              q = [0, 1].map((d) => L.reduce((s, v, i) => s + v * E[i][d], 0));
            if (Math.hypot(q[0], q[1]) <= R) points.set(key2(q), q);
          }
        }
    }
  return [...points.values()];
}

/* ==============================================================================================
 * PART 2 — THE DODECAHEDRON AND THE PENTAGON LAID ON ITS FACES
 * ==============================================================================================
 *
 * Its 12 faces round the icosahedron's corners (each face's 5 corners, the dodecahedron's nearest that way),
 * each one's corners in turn round its outward normal; scaled so that a face's middle to a corner is the
 * pentagon's radius: the plane's unit edges unit edges there. The plane's pentagon, its corner P1 on the
 * face's first corner, turning the same way (the faces all turned the same: one turn of the icosahedron's
 * apart, and the pentagon's content its own at 72°).
 */
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul3 = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len3 = (a) => Math.hypot(a[0], a[1], a[2]);
const unit3 = (a) => mul3(a, 1 / len3(a));

function dodecahedron(radius) {
  const turns = (p) => [p, [p[2], p[0], p[1]], [p[1], p[2], p[0]]],
    signs = (p) =>
      p.reduce((all, v, d) => (v ? all.flatMap((q) => [q, q.map((w, e) => (e === d ? -w : w))]) : all), [p]);
  const corners = [...signs([1, 1, 1]), ...turns([0, 1 / PHI, PHI]).flatMap(signs)],
    normals = turns([0, PHI, 1]).flatMap(signs).map(unit3); // (the icosahedron's corners: the faces' ways)
  const faces = normals.map((n) => {
    const top = Math.max(...corners.map((c) => dot3(c, n))),
      own = corners.filter((c) => dot3(c, n) > top - 1e-9),
      mid = mul3(own.reduce(add3, [0, 0, 0]), 1 / own.length),
      u = unit3(sub3(own[0], mid)),
      w = cross3(n, u);
    own.sort(
      (a, b) =>
        Math.atan2(dot3(sub3(a, mid), w), dot3(sub3(a, mid), u)) -
        Math.atan2(dot3(sub3(b, mid), w), dot3(sub3(b, mid), u)),
    );
    return { n, mid, corners: own };
  });
  const s = radius / len3(sub3(faces[0].corners[0], faces[0].mid)); // (a face's middle to a corner: the pentagon's radius)
  for (const f of faces) {
    f.mid = mul3(f.mid, s);
    f.corners = f.corners.map((c) => mul3(c, s));
    f.u = unit3(sub3(f.corners[0], f.mid));
    f.w = cross3(f.n, f.u); // (its plane's x along its first corner, its y a quarter turn on, outward)
  }
  return faces;
}

/* ==============================================================================================
 * PART 3 — THE GRAPH: POINTS, EDGES 1 APART, TILES
 * ==============================================================================================
 *
 * Every point of the tiling in the pentagon (its edges included), on each face; the same point of two faces
 * (on their edge, at their corner) one. Two points 1 apart along the surface joined: on one face, straight;
 * on two faces sharing an edge, the second unfolded into the first's plane over it. Each point's neighbours
 * in turn round it (its way out from the middle its normal); each tile, a face of that graph, walked round.
 */
// the tiling's points, made once for the largest radius asked (a pentagon picks its own from them)
let planeMade = { R: 0, points: [] };
const planePoints = (R) => (R > planeMade.R ? (planeMade = { R, points: penrosePoints(R) }) : planeMade).points;
// The pentagon's content for corner P1: the tiling's points in it, P1 along x (the face's own frame), and its key, one of
// it and its mirror's: two P1 laying the same points lay the same tiling, or its mirror image
function faceContent(P1) {
  const rho = Math.hypot(P1[0], P1[1]),
    a = Math.atan2(P1[1], P1[0]),
    pentagon = [0, 1, 2, 3, 4].map((k) => [rho * Math.cos((TAU * k) / 5), rho * Math.sin((TAU * k) / 5)]);
  const inside = (p) =>
    pentagon.every((c, k) => {
      const d = pentagon[(k + 1) % 5];
      return (d[0] - c[0]) * (p[1] - c[1]) - (d[1] - c[1]) * (p[0] - c[0]) >= -1e-7;
    });
  const framed = planePoints(rho + 1)
      .map((p) => [p[0] * Math.cos(a) + p[1] * Math.sin(a), -p[0] * Math.sin(a) + p[1] * Math.cos(a)])
      .filter(inside),
    key = (flip) =>
      framed
        .map(([x, y]) => `${Math.round(x * 1e5)},${Math.round((flip ? -y : y) * 1e5)}`)
        .sort()
        .join(' ');
  return { rho, framed, content: [key(false), key(true)].sort()[0] };
}
function sphereTiling(P1, face = faceContent(P1)) {
  const { rho, framed, content } = face,
    faces = dodecahedron(rho),
    toFace = (f, [x, y]) => add3(f.mid, add3(mul3(f.u, x), mul3(f.w, y)));
  // the points, one each however many faces it lies on, and its faces
  const points = [],
    onFaces = [],
    at = new Map();
  faces.forEach((f, fi) => {
    for (const p of framed) {
      const q = toFace(f, p),
        k = q.map((v) => Math.round(v * 1e5)).join();
      let i = at.get(k);
      if (i === undefined) {
        i = points.length;
        at.set(k, i);
        points.push(q);
        onFaces.push([]);
      }
      if (!onFaces[i].includes(fi)) onFaces[i].push(fi);
    }
  });
  // (two faces' shared edge, by their shared corners: its ends)
  const edgeOf = (f, g) => {
    const shared = faces[f].corners.filter((c) => faces[g].corners.some((d) => len3(sub3(c, d)) < 1e-6));
    return shared.length === 2 ? shared : null;
  };
  // the distance along the surface: on a face both lie on, straight; else over the edge two of theirs share, the
  // second's point unfolded into the first's plane (its distance to the edge's line laid on the far side)
  const along = (i, j) => {
    const p = points[i],
      q = points[j];
    if (onFaces[i].some((f) => onFaces[j].includes(f))) return len3(sub3(p, q));
    let best = Infinity;
    for (const f of onFaces[i])
      for (const g of onFaces[j]) {
        const e = edgeOf(f, g);
        if (!e) continue;
        const t = unit3(sub3(e[1], e[0])),
          s = dot3(sub3(q, e[0]), t),
          h = len3(sub3(sub3(q, e[0]), mul3(t, s))),
          out0 = sub3(e[0], faces[f].mid),
          out = unit3(sub3(out0, mul3(t, dot3(out0, t)))),
          unfolded = add3(add3(e[0], mul3(t, s)), mul3(out, h));
        best = Math.min(best, len3(sub3(p, unfolded)));
      }
    return best;
  };
  // the edges: pairs 1 apart, found in a grid of unit cells
  const grid = new Map(),
    cell = (p) => p.map((v) => Math.floor(v)).join();
  points.forEach((p, i) => {
    const c = cell(p);
    if (!grid.has(c)) grid.set(c, []);
    grid.get(c).push(i);
  });
  const nbrs = points.map(() => []);
  points.forEach((p, i) => {
    const [x, y, z] = p.map((v) => Math.floor(v));
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++)
          for (const j of grid.get([x + dx, y + dy, z + dz].join()) ?? [])
            if (j > i && Math.abs(len3(sub3(p, points[j])) - 1) < 0.3 && Math.abs(along(i, j) - 1) < 1e-6) {
              nbrs[i].push(j);
              nbrs[j].push(i);
            }
  });
  // each point's neighbours in turn round its outward way
  nbrs.forEach((list, i) => {
    const n = unit3(points[i]),
      u = unit3(cross3(n, Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])),
      w = cross3(n, u),
      angle = (j) => {
        const d = sub3(points[j], points[i]);
        return Math.atan2(dot3(d, w), dot3(d, u));
      };
    list.sort((p, q) => angle(p) - angle(q));
  });
  // the tiles: each edge's way walked, turning at each point to the neighbour before the one it came from
  const done = new Set(),
    tiles = [];
  points.forEach((_, i) => {
    for (const j of nbrs[i]) {
      if (done.has(`${i}>${j}`)) continue;
      const ring = [];
      let u = i,
        v = j;
      while (!done.has(`${u}>${v}`) && ring.length < 64) {
        done.add(`${u}>${v}`);
        ring.push(u);
        const list = nbrs[v],
          k = list.indexOf(u),
          w = list[(k - 1 + list.length) % list.length];
        u = v;
        v = w;
      }
      tiles.push(ring);
    }
  });
  const edges = nbrs.reduce((s, l) => s + l.length, 0) / 2;
  return { points, nbrs, tiles, edges, faces, rho, content };
}

// a tile's kind: a thick rhombus (72°), a thin one (36°), a pentagon, a triangle, else its sides (a hole: no tiling)
function tileKind(t, points) {
  const n = t.length;
  if (n === 4) {
    const [p, q, r] = [points[t[0]], points[t[1]], points[t[3]]],
      cos = dot3(unit3(sub3(q, p)), unit3(sub3(r, p))),
      deg = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI,
      small = Math.min(deg, 180 - deg);
    return small < 54 ? 'thin' : 'thick';
  }
  return n === 3 ? 'triangle' : n === 5 ? 'pentagon' : `${n}-gon`;
}

/* ==============================================================================================
 * PART 4 — THE CANDIDATES FOR P1, THOSE THAT CLOSE
 * ==============================================================================================
 *
 * Todd's algorithm II: P1 lands on a three-fold point of the sphere (a corner of the dodecahedron), so it is a
 * point of the tiling or the middle of a three-fold shape round one: the tiling's points v, and v + λ d for d
 * one of the decagon's 10 ways, λ in {φ, 1, tan 18°}, by the pentagon's radius. A candidate closes where every
 * point has 3 neighbours or more and every tile is a rhombus, a pentagon or a triangle (no hole), and Euler's
 * V − E + F = 2 holds; kept if its tiles are Penrose's, thick and thin rhombi both (not the icosahedron's 20
 * triangles, nor the rhombic triacontahedron's 30 thick rhombi alone), once each: one tiling of each face's
 * content, turned or mirrored (see faceContent).
 */
function candidates(R) {
  const out = new Map(),
    lambdas = [0, PHI, 1, Math.tan(Math.PI / 10)];
  for (const v of penrosePoints(R))
    for (const l of lambdas)
      for (let d = 0; d < (l ? 10 : 1); d++) {
        const p = [v[0] + l * Math.cos((Math.PI * d) / 5), v[1] + l * Math.sin((Math.PI * d) / 5)],
          rho = Math.hypot(p[0], p[1]);
        if (rho < 0.5 || rho > R) continue;
        const k = `${p[0].toFixed(5)},${p[1].toFixed(5)}`;
        if (!out.has(k)) out.set(k, p);
      }
  return [...out.values()].sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]));
}
const penroseKinds = (T) => ['thick', 'thin'].every((k) => T.tiles.some((t) => tileKind(t, T.points) === k));
const closes = (T) =>
  T.nbrs.every((l) => l.length >= 3) &&
  T.tiles.every((t) => ['thick', 'thin', 'pentagon', 'triangle'].includes(tileKind(t, T.points))) &&
  T.points.length - T.edges + T.tiles.length === 2;

/* ==============================================================================================
 * PART 5 — DRAWING AND THE PANEL
 * ==============================================================================================
 *
 * The tiles drawn on a canvas, their corners on the sphere (or on the dodecahedron as built), the view turned
 * by a drag, the far side hidden, the nearest drawn last; a tile's colour its kind's.
 */
const $ = (id) => document.getElementById(id);
const COLOURS = { thick: '#f2b84b', thin: '#3b3b98', pentagon: '#e5484d', triangle: '#2fbdb7', hole: '#ffffff' };
const view = $('view'),
  ctx = view.getContext('2d');
let turn = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
  shape = 'sphere',
  tiling = null,
  good = [],
  shown = 0;

function draw() {
  const W = (view.width = view.clientWidth * devicePixelRatio),
    H = (view.height = view.clientHeight * devicePixelRatio);
  ctx.fillStyle = '#0b0d12';
  ctx.fillRect(0, 0, W, H);
  if (!tiling) return;
  const R = 0.42 * Math.min(W, H),
    scale = shape === 'sphere' ? 1 : 1 / (tiling.rho * 1.3),
    place = (p) => {
      const q = shape === 'sphere' ? unit3(p) : mul3(p, scale);
      return turn.map((row) => dot3(row, q));
    };
  const shownTiles = tiling.tiles
    .map((t) => {
      const ps = t.map((i) => place(tiling.points[i])),
        mid = ps.reduce(add3, [0, 0, 0]).map((v) => v / ps.length);
      return { t, ps, z: mid[2] };
    })
    .filter((s) => s.z > -0.05)
    .sort((a, b) => a.z - b.z);
  for (const { t, ps, z } of shownTiles) {
    const kind = tileKind(t, tiling.points),
      light = 0.55 + 0.45 * Math.max(0, z);
    ctx.beginPath();
    ps.forEach((p, k) => (k ? ctx.lineTo : ctx.moveTo).call(ctx, W / 2 + R * p[0], H / 2 - R * p[1]));
    ctx.closePath();
    ctx.globalAlpha = light;
    ctx.fillStyle = COLOURS[kind] ?? COLOURS.hole;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#0b0d12';
    ctx.lineWidth = devicePixelRatio;
    ctx.stroke();
  }
}

function show(k) {
  shown = Math.max(0, Math.min(good.length - 1, k));
  const P1 = good[shown];
  tiling = sphereTiling(P1);
  const count = {};
  for (const t of tiling.tiles) {
    const kind = tileKind(t, tiling.points);
    count[kind] = (count[kind] ?? 0) + 1;
  }
  $('sizeLabel').textContent = ` ${shown + 1} of ${good.length} · radius ${tiling.rho.toFixed(3)} `;
  $('stats').textContent =
    `${tiling.tiles.length} tiles, ${tiling.points.length} corners, ${tiling.edges} edges\n` +
    Object.entries(count)
      .map(([k, n]) => `${k} ${n}`)
      .join(' · ');
  $('prev').disabled = shown === 0;
  $('next').disabled = shown === good.length - 1;
  for (const b of $('list').children) b.classList.toggle('on', Number(b.dataset.k) === shown);
  draw();
}

// the candidates up to a radius, those that close kept (Todd's algorithm II, judged by the tiling it makes)
function search(R) {
  const t0 = performance.now();
  const seen = new Set();
  good = candidates(R).filter((P1) => {
    const face = faceContent(P1);
    if (seen.has(face.content)) return false; // (a tiling met already: its graph not built again)
    seen.add(face.content);
    const T = sphereTiling(P1, face);
    return closes(T) && penroseKinds(T);
  });
  console.log(
    `penrose-sphere: ${good.length} sizes close up to radius ${R}, in ${Math.round(performance.now() - t0)} ms`,
  );
  $('list').replaceChildren(
    ...good.map((P1, k) => {
      const b = document.createElement('button');
      b.className = 'btn';
      b.dataset.k = k;
      b.textContent = Math.hypot(P1[0], P1[1]).toFixed(2);
      b.title = `P1 (${P1[0].toFixed(3)}, ${P1[1].toFixed(3)})`;
      b.addEventListener('click', () => show(k));
      return b;
    }),
  );
}

$('key').innerHTML = Object.entries({
  thick: 'Thick rhombus',
  thin: 'Thin rhombus',
  pentagon: 'Pentagon',
  triangle: 'Triangle',
})
  .map(([k, name]) => `<div><span style="background:${COLOURS[k]}"></span>${name}</div>`)
  .join('');
$('prev').addEventListener('click', () => show(shown - 1));
$('next').addEventListener('click', () => show(shown + 1));
for (const b of $('shapeTabs').children)
  b.addEventListener('click', () => {
    shape = b.dataset.shape;
    for (const c of $('shapeTabs').children) c.classList.toggle('on', c === b);
    draw();
  });
// a drag turns the view round its screen axes
let drag = null;
view.addEventListener('pointerdown', (e) => {
  drag = [e.clientX, e.clientY];
  view.setPointerCapture(e.pointerId);
});
view.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = (e.clientX - drag[0]) / 200,
    dy = (e.clientY - drag[1]) / 200;
  drag = [e.clientX, e.clientY];
  const rx = [
      [1, 0, 0],
      [0, Math.cos(dy), -Math.sin(dy)],
      [0, Math.sin(dy), Math.cos(dy)],
    ],
    ry = [
      [Math.cos(dx), 0, Math.sin(dx)],
      [0, 1, 0],
      [-Math.sin(dx), 0, Math.cos(dx)],
    ],
    mul = (A, B) => A.map((r) => [0, 1, 2].map((j) => r.reduce((s, v, k) => s + v * B[k][j], 0)));
  turn = mul(mul(ry, rx), turn);
  draw();
});
view.addEventListener('pointerup', () => (drag = null));
addEventListener('resize', draw);
search(6);
show(good.length ? Math.min(3, good.length - 1) : 0);
