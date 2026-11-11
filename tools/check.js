// Tessera's self-check, run in the page (it uses the app's own functions) before a commit:
//   await import(`/tools/check.js?${Date.now()}`); await tesseraCheck();   // the meshes, the sheets' rules (see checkSheets), a few links cold (see checkColdLinks), 35 to 50 s
//   await tesseraCheck({ crawl: true });                                   // and every tab, shape and tiling, a few minutes
//   await tesseraCheck({ clickAll: true, clickFrom: 0 });                  // and on each, every control clicked (a night's, ~25 minutes; from a look's number, localStorage.tesseraCrawlAt, after a crash)
//   await tesseraCheck({ hovers: true });                                  // and on each, every greyed control's first hover under 100 ms, there and at its surface's largest size (a night's)
//   await tesseraCheck({ fuzz: 400, seed: 7 });                            // 400 actions at random, menu to menu (transitions, smallest sizes)
//   await tesseraCheck({ fuzz: 100, cold: true });                          // and after each, its link loaded cold beside: the same menus offered
//   await tesseraCheck({ colours: true });                                 // every Life surface offers colours (more than Solo) at one of its sizes at least
//   await tesseraCheck({ battles: true });                                 // every walk on a surface: its battles' walkers each A's path moved, Land no collision kept apart, 5 minutes
//   await tesseraCheck({ parts: true });                                   // every count of colours offered, as many cells a colour: plane and solids, 7 minutes
//   await tesseraCheck({ deep: true });                                    // every grid's rules (yours too), How it works, colours, zones, smallest size: a night's
//   await tesseraCheck({ known: true });                                   // Life's known results, played on the graphics card: a minute
// Returns { ok, failures, checked }. The meshes: a torus straight and turned, its tiles' neighbours alike; a Möbius
// strip's cells away from its edges, as many neighbours as the torus of its tiles, a Klein bottle's all; each surface its cells as many as
// said; the grids that never repeat, their walls closed; every button shown its tooltip; those in a hexagon, their walls closed, turning onto themselves, as many cells as said. The crawl: no error, the link's mode the one shown, the size said its cells' count. Known:
// Life's oscillators' periods and methuselahs' loops (PATTERNS.md's), a hunt's best, reversible rules' returns to their start.

const neighbourCounts = (g, keep = () => true) => {
  // how many cells have k neighbours, as shares
  const { start } = cornerNeighbours(g),
    walls = new Set(g.walls ?? []),
    c = {};
  let n = 0;
  for (let t = 0; t < g.n; t++)
    if (!walls.has(t) && keep(t)) {
      const k = start[t + 1] - start[t];
      c[k] = (c[k] ?? 0) + 1;
      n++;
    }
  for (const k in c) c[k] /= n;
  return c;
};
const alike = (a, b) => Object.keys({ ...a, ...b }).every((k) => Math.abs((a[k] ?? 0) - (b[k] ?? 0)) < 0.02);
const within = (a, b) => Object.keys(a).every((k) => k in b); // (a's counts all among b's)
const show = (c) =>
  Object.entries(c)
    .map(([k, v]) => `${k}:${v.toFixed(2)}`)
    .join(' ');

// a strip's tiles and the torus of the same tiles
const STRIP_TORUS = {
  mobius: 'torus',
  mobiusHex: 'torusHex',
  mobiusTri: 'torusTri',
  mobiusHexTurned: 'torusHex',
  mobiusTriTurned: 'torusTri',
  mobiusCairo: 'torusCairo',
  mobiusKite: 'torusKite',
  mobiusKiteTurned: 'torusKite',
};
const torusOfStrip = (strip) => STRIP_TORUS[strip] ?? FOLDS.torus.of(MOBIUS_STRIPS[strip].kind);

function checkMeshes(fail) {
  let checked = 0;
  const size = () => 12; // (a size every torus takes)
  // the tori: their cells as many as said; a tiling's, straight and turned alike
  const tori = Object.keys(SPHERES).filter((k) => /torus/.test(k) && !/Turned$/.test(k));
  const ref = {};
  // each tile's sheet corners its corners, in the same order (unrolled, its grid's edges drawn from them, see gpuSurface)
  const sheetOff = (g) => {
    let bad = 0;
    for (let s = 0; s < g.n * g.sides; s++) {
      const v = g.poly[s],
        P = sheetPoint(g, g.uv[2 * s], g.uv[2 * s + 1], 1);
      bad += Math.hypot(P[0] - g.verts[3 * v], P[1] - g.verts[3 * v + 1], P[2] - g.verts[3 * v + 2]) > 1e-6;
    }
    return bad;
  };
  // a tiling's lattice: b a quarter turn clockwise from a on screen (see tools/tilings/build.js); its sheets alike, B from A:
  // the plane's tiles turned on its tori, not mirrored (see torusSheets)
  for (const [
    kind,
    {
      basis: [a, b],
    },
  ] of Object.entries(TILINGS)) {
    checked++;
    if (a[0] * b[1] - a[1] * b[0] <= 0) fail(`${kind}: its lattice listed the other way round`);
  }
  for (const kind of Object.keys(TILINGS))
    if (TILINGS[kind].torus)
      for (const [way, S] of Object.entries(torusSheets(kind)))
        if (Array.isArray(S)) {
          const [a, b] = TILINGS[kind].basis,
            W = ([u, v]) => [u * a[0] + v * b[0], u * a[1] + v * b[1]],
            A = W(S[0]),
            B = W(S[1]);
          checked++;
          if (A[0] * B[1] - A[1] * B[0] <= 0) fail(`${kind} ${way}: its torus the plane's mirror`);
        }
  for (const kind of tori) {
    const g = SPHERES[kind].mesh(size(kind)),
      c = neighbourCounts(g);
    ref[kind] = c;
    checked++;
    for (const [name, h] of [
      [kind, g],
      ...(TURNED[kind] && SPHERES[TURNED[kind]] ? [[TURNED[kind], SPHERES[TURNED[kind]].mesh(size(kind))]] : []),
    ])
      if (h.uv && !h.mobius) {
        const bad = sheetOff(h);
        if (bad) fail(`${name}: ${bad} sheet corners off their corners`);
      }
    if (SPHERES[kind].tiles(size(kind)) !== g.n) fail(`${kind}: ${g.n} cells, said ${SPHERES[kind].tiles(size(kind))}`);
    if (TURNED[kind] && SPHERES[TURNED[kind]]) {
      const h = neighbourCounts(SPHERES[TURNED[kind]].mesh(size(kind)));
      checked++;
      if (!alike(c, h)) fail(`${kind}: straight ${show(c)}, turned ${show(h)}`);
    }
  }
  // the strips: away from their edges (a lattice side and a half), as on the torus
  for (const kind of MOBIUS_KINDS) {
    const g = SPHERES[kind].mesh(6),
      torus = ref[torusOfStrip(kind)],
      far = g.tiling ? 1.5 * Math.max(...TILINGS[g.tiling].basis.map((v) => Math.hypot(...v))) : 2;
    const y = (t) => sheetMiddle(g, t)[1]; // (its middle across the strip)
    const inside = neighbourCounts(g, (t) => t < g.front && y(t) > far && y(t) < g.W - far);
    checked++;
    if (SPHERES[kind].tiles(6) !== g.n) fail(`${kind}: ${g.n} cells, said ${SPHERES[kind].tiles(6)}`);
    {
      const bad = sheetOff(g);
      if (bad) fail(`${kind}: ${bad} sheet corners off their corners`);
    } // (as the tori's)
    if (mobiusMiddle(g) !== g.L / 2) fail(`${kind}: its back facing the view, not its front`); // (its sheet laid east and south, as a torus's)
    if (!torus) fail(`${kind}: no torus of its tiles to compare with`);
    else if (!within(inside, torus)) fail(`${kind}: inside ${show(inside)}, its torus ${show(torus)}`);
  }
  // the Klein bottles: no edge, every cell as on the torus of its tiles (a tiling's, or the squares', hexagons', … own)
  for (const kind of Object.keys(SPHERES).filter((k) => /^klein/.test(k))) {
    const torus =
      ref[FOLDED[kind] ? FOLDS.torus.of(FOLDED[kind].kind) : kind.replace(/^klein/, 'torus').replace(/Turned$/, '')];
    if (!torus) continue; // (a fold with no torus of its own tiles)
    const c = neighbourCounts(SPHERES[kind].mesh(6));
    checked++;
    if (!alike(c, torus)) fail(`${kind}: ${show(c)}, its torus ${show(torus)}`);
  }
  // the grids that never repeat: their walls closed round them (a point just past each side of a cell, a hundredth of the
  // side out, in a cell or a wall; each tile in every square of 3 its box covers), sizes 16 to 64
  const sarea = (P) => P.reduce((t, p, i) => t + p[0] * P[(i + 1) % P.length][1] - P[(i + 1) % P.length][0] * p[1], 0);
  for (const kind of Object.keys(APERIODIC))
    for (const W of [16, 24, 32, 48, 64]) {
      const h = APERIODIC[kind](W),
        all = Array.from({ length: h.m }, (_, k) => h.poly(k)),
        grid = new Map();
      all.forEach((P, j) => {
        const xs = P.map((p) => Math.floor(p[0] / 3)),
          ys = P.map((p) => Math.floor(p[1] / 3));
        for (let x = Math.min(...xs); x <= Math.max(...xs); x++)
          for (let y = Math.min(...ys); y <= Math.max(...ys); y++)
            (grid.get(`${x},${y}`) ?? grid.set(`${x},${y}`, []).get(`${x},${y}`)).push(j);
      });
      const covered = (x, y) =>
        (grid.get(`${Math.floor(x / 3)},${Math.floor(y / 3)}`) ?? []).some((j) => insidePolygon(all[j], x, y));
      let gaps = 0;
      for (const P of all.slice(0, h.n)) {
        // (its cells, then its walls)
        const o = sarea(P) > 0 ? 1 : -1;
        for (let i = 0; i < P.length; i++) {
          const a = P[i],
            b = P[(i + 1) % P.length],
            len = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (
            len > 1e-6 &&
            !covered((a[0] + b[0]) / 2 + 0.01 * o * (b[1] - a[1]), (a[1] + b[1]) / 2 - 0.01 * o * (b[0] - a[0]))
          )
            gaps++;
        }
      }
      checked++;
      if (gaps) fail(`${kind} ${W}: its walls open (${gaps} sides)`);
    }
  // the six-fold grids with walls in a hexagon (see planeShape): their walls closed round the live cells, and the live
  // cells turning onto each other round its centre
  const saved = { torus: plane.torus, shape: plane.shape };
  for (const kind of ['hex', 'tri', 'kite', ...Object.keys(TILINGS), ...Object.keys(RECTS)]) {
    if ((!tilingOf(kind) && !TILES_PER_GRID_CELL[kind]) || !hexagonFits(kind)) continue; // (a rectangle's cells: built when first asked for, if any)
    Object.assign(plane, { torus: false, shape: 'hex' });
    const W = planeW(kind, 32),
      row = planeRow(kind, W),
      sh = planeShape(kind, W);
    if (!sh) continue; // (started on a page of blocks: no hexagon there)
    const live = Array.from({ length: planeGrid(kind, W).n }, (_, t) => cellPolys(kind, W)(t)),
      all = [...live, ...sh.walls.map(([x, y]) => planeCorners(kind, x, y))],
      grid = new Map(),
      cell = (x, y) => `${Math.floor(x / 3)},${Math.floor(y / 3)}`;
    const mid = (P) => [P.reduce((t, p) => t + p[0], 0) / P.length, P.reduce((t, p) => t + p[1], 0) / P.length];
    all.forEach((P, j) => {
      const c = cell(...mid(P));
      (grid.get(c) ?? grid.set(c, []).get(c)).push(j);
    });
    const covered = (x, y) => {
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          for (const j of grid.get(`${Math.floor(x / 3) + dx},${Math.floor(y / 3) + dy}`) ?? [])
            if (insidePolygon(all[j], x, y)) return true;
      return false;
    };
    let gaps = 0;
    for (const P of live) {
      const o = sarea(P) > 0 ? 1 : -1;
      for (let i = 0; i < P.length; i++) {
        const a = P[i],
          b = P[(i + 1) % P.length],
          len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (
          len > 1e-6 &&
          !covered(
            (a[0] + b[0]) / 2 + (0.03 * o * (b[1] - a[1])) / len,
            (a[1] + b[1]) / 2 - (0.03 * o * (b[0] - a[0])) / len,
          )
        )
          gaps++;
      }
    }
    // its symmetry: the live cells' middles turned by a turn of the grid round their mean, onto live ones
    const mids = live.map(mid),
      c = [0, 1].map((d) => mids.reduce((t, m) => t + m[d], 0) / mids.length),
      turn = (2 * Math.PI) / PATTERN_TURNS[baseOf(kind)];
    const sig = (P) => `${P.length}|${Math.round(Math.abs(sarea(P)) * 50)}`,
      keys = new Set(mids.map(([u, v], i) => `${Math.round(u * 100)},${Math.round(v * 100)}|${sig(live[i])}`)); // (a cell by its middle and its shape)
    const off = mids.filter(([u, v], i) => {
      const x = c[0] + (u - c[0]) * Math.cos(turn) - (v - c[1]) * Math.sin(turn),
        y = c[1] + (u - c[0]) * Math.sin(turn) + (v - c[1]) * Math.cos(turn);
      return ![-1, 0, 1].some((e) =>
        [-1, 0, 1].some((f) => keys.has(`${Math.round(x * 100) + e},${Math.round(y * 100) + f}|${sig(live[i])}`)),
      );
    }).length;
    checked++;
    const what = `${kind} hexagon ${W}`;
    if (gaps) fail(`${what}: its walls open (${gaps} sides)`);
    if (off) fail(`${what}: ${off} of its ${live.length} cells not turning onto others`);
    const W0 = sideW(kind, 32),
      want = (Math.PI / 4) * planeRow(kind, W0) * W0; // (as a disc of ⌀ 32's, see shapeW; a grid of few big lattice cells: by big steps)
    if (Math.abs(live.length / want - 1) > 0.3 + 4 / W)
      fail(`${what}: ${live.length} cells, ${Math.round(want)} wanted`);
  }
  // every grid that repeats, as a torus (its sides round: a rectangle's columns not its rows; its size as Life's, whatever the mode): each cell's neighbours
  // touching it, a few cells' width away at most the shortest way round (not glued to far ones, as v0.1.1305's to 1371's)
  for (const kind of ['square', 'hex', 'tri', 'cairo', 'kite', ...Object.keys(TILINGS), ...Object.keys(RECTS)]) {
    if ((!tilingOf(kind) && !TILES_PER_GRID_CELL[kind]) || APERIODIC[kind]) continue;
    Object.assign(plane, { torus: true });
    const W = colourW(kind, sideW(kind, 32)),
      row = planeRow(kind, W),
      { start, list } = planeNeighbours(kind, W, true),
      c0 = cellMiddle(kind, 0, 0);
    const P = [cellMiddle(kind, row, 0), cellMiddle(kind, 0, W)].map((c) => [c[0] - c0[0], c[1] - c0[1]]),
      mid = cellMids(kind, W),
      reach = 3 * cellWidth(kind);
    let far = 0;
    for (let t = 0; t < planeGrid(kind, W).n; t++)
      for (let q = start[t]; q < start[t + 1]; q++) {
        const a = mid(t),
          b = mid(list[q]);
        if (
          Math.min(
            ...[-1, 0, 1].flatMap((i) =>
              [-1, 0, 1].map((j) =>
                Math.hypot(b[0] + i * P[0][0] + j * P[1][0] - a[0], b[1] + i * P[0][1] + j * P[1][1] - a[1]),
              ),
            ),
          ) > reach
        )
          far++;
      }
    checked++;
    if (far) fail(`${kind} torus ${W}: ${far} neighbours far from their cell`);
  }
  Object.assign(plane, saved);
  return checked;
}

// after an action: no error, the link's mode the one shown, a surface's cells as many as said, more than one start (the crawl's, the fuzz's)
const wait = (ms) => new Promise((go) => setTimeout(go, ms));
// ok() true and nothing waited for (the app's waits, see waitBegin: digits, a build on its way, a battle's others), 10 s at most
const until = async (ok) => {
  for (let t = 0; t < 100 && !(ok() && !waits.size); t++) await wait(100);
};
const shown =
  (w, more = () => true) =>
  () =>
    $('mode').value === w && more(); // (mode w on the page, and more)
// a Life link opened and its own game built: a new one, of its mode and its setup (not the one before, still shown while the
// next is built: a wait's guess, 1.5 s, read the grid before's symmetries on a page busy after the other checks)
const openLife = async (link) => {
  const before = walk.life,
    w = link.match(/w=([^&]+)/)[1];
  location.hash = link;
  await until(shown(w, () => walk.life && walk.life !== before && walk.mode === w && isInUse(parseHash())));
};
// to generation g, its batches awaited (Life's on the card come back later, see lifeSettle)
const goTo = async (g) => {
  advanceTo(g);
  await lifeSettle();
};
// the buttons shown with no words of their own in their tooltip, or only their name (see tipOf; Size's − +, the words of
// their box, one control)
const untipped = () =>
  [...document.querySelectorAll('button, label')]
    .filter((b) => {
      const { el, tip } = tipOf(b),
        name = (b.querySelector('.mode-name') ?? b.querySelector('span') ?? b).textContent.trim();
      return (
        b.offsetParent !== null && !(tip && tip.replace(/^[^:]*:\s*/, '') !== name && (el === b || el.dataset.tipHtml))
      );
    })
    .map(
      (b) =>
        `${b.closest('[id]:not(button)')?.id ?? ''} › ${((b.querySelector('.mode-name') ?? b.querySelector('span') ?? b).textContent.trim() || b.id).slice(0, 24)}`,
    );
// every function declared once in each script: a second one of the same name replaces the first with no word (battleScore,
// v0.4.247: the hunt's score over a battle's stats, a battle frozen at its first step)
async function checkNames(fail) {
  let checked = 0;
  for (const file of ['main.js', 'emoji.js', 'punks.js', 'pixelarticons.js']) {
    const names = [
        ...(await (await fetch(`${file}?${Date.now()}`)).text()).matchAll(/^(?:async\s+)?function\*?\s+([\w$]+)/gm),
      ].map((m) => m[1]),
      seen = new Set();
    for (const n of names) {
      if (seen.has(n)) fail(`${file}: function ${n} declared twice, the second replacing the first`);
      seen.add(n);
    }
    checked++;
  }
  return checked;
}
function checkTips(fail) {
  const none = untipped();
  if (none.length) fail(`buttons with no tooltip: ${none.join(', ')}`);
  return 1;
}
function checker(fail) {
  const errors = [],
    onError = (e) =>
      errors.push(
        `${e.message} (${
          (e.error?.stack ?? '')
            .split('\n')[1]
            ?.trim()
            .replace(/\?v=[\w.]+/, '') ?? ''
        })`,
      ); // (where: its first frame, main.js:line)
  window.addEventListener('error', onError);
  const c = { checked: 0, stop: () => window.removeEventListener('error', onError) };
  c.look = async (what, ms = 450) => {
    await wait(ms);
    for (let t = 0; waits.size && t < 600; t++) await wait(100); // (its digits or its build still on their way: the link follows the walk once built, see buildWalk)
    c.checked++;
    const w = $('mode').value,
      hashW = (location.hash.match(/w=([^&]*)/) ?? [])[1],
      said = [
        ...$('sizeLabel')
          .innerText.split('\n')
          .at(-1)
          .matchAll(/([\d,]+)\s+[a-z]+/gi),
      ].reduce((sum, m) => sum + Number(m[1].replace(/,/g, '')), 0); // (its cells, its terms summed: 1,910 hexagons + 12 pentagons)
    const n = MODES[w].sphere && !MODES[w].plane ? walk.geo?.n : null;
    const nan = document.querySelectorAll('svg[viewBox*="NaN"], svg[viewBox*="Infinity"]').length; // (a picture with nothing to frame: no error thrown, drawn empty)
    const starts = $('startSection').hidden
      ? 2
      : [...$('lifeStartTabs').querySelectorAll('button')].filter((b) => !b.hidden).length; // (an automaton's starts: never Digits alone)
    const none = untipped();
    const bad = [
      errors.length && errors.splice(0).join(' / '),
      none.length && `no tooltip on ${none.join(', ')}`,
      hashW !== w && `the link says ${hashW}`,
      n && said && said !== n && `${n} cells, said ${said}`,
      nan && `${nan} pictures framed NaN`,
      starts < 2 && `${starts} start offered`,
    ].filter(Boolean);
    if (bad.length) fail(`${what} → ${w}: ${bad.join('; ')}`);
    return !bad.length;
  };
  return c;
}
// (each: on each mode reached, after its look: clickAll's; from: the look it starts at, each look's number kept in
// localStorage.tesseraCrawlAt: a pass that took the tab down, run again from there)
async function crawl(fail, each = null, from = 0) {
  let at = 0;
  const C = checker(fail),
    look = (what) =>
      C.look(what).then(async (r) => {
        localStorage.tesseraCrawlAt = at;
        if (each && at++ >= from) await each(what);
        return r;
      });
  const tabs = () =>
    [...document.querySelectorAll('#modeTabs [role=tab]')].filter((b) => !/Gallery/.test(b.textContent)); // (Life, Rewind, Ant, Walk)
  for (let ti = 0; ti < tabs().length; ti++) {
    tabs()[ti].click();
    await look(`tab ${tabs()[ti].textContent.trim()}`);
    const how = document.querySelector('#walkHeading .how-it-works'); // (its How it works open: it follows the grid and the rule)
    if (how && $('ruleTuto').hidden) {
      how.click();
      await look(`How it works ${tabs()[ti].textContent.trim()}`);
    }
    for (let si = 0; si < $('navSpace').children.length; si++) {
      $('navSpace').children[si].click();
      await look(`space ${$('navSpace').children[si]?.textContent}`);
      const shapeButtons = () => $('navShapes').querySelectorAll('button'); // (in 2D, among the groups' titles)
      for (let hi = 0; hi < shapeButtons().length; hi++) {
        const b = shapeButtons()[hi],
          name = b.textContent.trim();
        b.click();
        await look(`shape ${name}`);
        const rulesBox = $('navRules'); // its rules' cards (a walk's, an ant's creatures and rules)
        const rules = () => rulesBox.querySelectorAll(':scope > button'); // (not your own rule's field)
        if (!rulesBox.closest('[hidden]'))
          for (let r = 0; r < rules().length; r++) {
            const rb = rules()[r];
            if (rb.disabled || rb.classList.contains('active')) continue;
            rb.click();
            await look(`${name} rule ${rb.textContent.trim()}`);
          }
        if ($('torusTiles').hidden) continue;
        for (let k = 0; k < $('torusTiles').children.length; k++) {
          const tile = $('torusTiles').children[k],
            tn = tile.textContent.trim();
          tile.click();
          await look(`${name}/${tn}`);
          if (!tile.classList.contains('switch')) continue;
          tile.click(); // (turned)
          await look(`${name}/${tn} turned`);
          tile.click();
          await wait(300);
        }
      }
    }
  }
  C.stop();
  return C.checked;
}

// The fuzz: count actions at random, as a visitor would go from menu to menu (seeded: a failure comes back with its seed): a
// tab, 2D or 3D, a shape, a tiling, colours, a zone, a rule, a start, a look, the smallest size (often), a size up, a few
// steps, a short play, the link loaded again (not back in the history: it can leave the page); after each, the crawl's checks; a failure told with the
// actions that led to it
// what the menus offer (a choice: its name, greyed or not, picked or not), the size said: a link loaded cold offers the same
const offered = (w) => {
  const d = w.document,
    row = (sel, all = false) =>
      [...d.querySelectorAll(sel)]
        .filter((b) => (all ? !b.hidden : !b.closest('[hidden]')))
        .map(
          (b) =>
            `${b.textContent.trim().slice(0, 16)}${b.disabled ? '⊘' : ''}${b.classList.contains('active') ? '•' : ''}`,
        )
        .join(' ');
  return {
    size: d.getElementById('sizeLabel').closest('[hidden]') ? '' : d.getElementById('sizeLabel').innerText,
    plane: d.getElementById('planeLabel').closest('[hidden]') ? '' : d.getElementById('planeLabel').innerText,
    tiles: row('#torusTiles button'),
    colours: row('#colourBlocks button'),
    zones: row('#huntZones button'),
    rules: row('#navRules button'),
    ...panel(d),
  };
};
// the page as its link has it, its views closed while looked at, then open again: Draw open on a surface (a view of its
// rule's patterns, the start as it was, see surfaceDraw); Custom rule open (customOpen, Life's, a walk's or a creature's:
// a link opens it only on a rule no card has, a card's rule its card's)
const linked = () => {
  const draw = surfaceDraw,
    custom = customOpen,
    views = () => {
      renderPlaneRow();
      renderHunt();
      renderRuleSection();
      renderModePicker();
    };
  if (!draw && !custom) return offered(window);
  surfaceDraw = customOpen = false;
  views();
  try {
    return offered(window);
  } finally {
    surfaceDraw = draw;
    customOpen = custom;
    views();
  }
};
// the whole left panel, section by section (its sections' ids): each button shown, its name, greyed or not, picked or not
// (what a path through the menus left there, a link loaded cold must show the same)
const panel = (d) =>
  Object.fromEntries(
    [...d.querySelectorAll('#paramsPane > *')]
      .map((s, i) => [s, `#${s.id || i}`])
      .filter(([s]) => !s.hidden)
      .map(([s, k]) => [
        k,
        [...s.querySelectorAll('button')]
          .filter((b) => !b.closest('[hidden]') && getComputedStyle(b).display !== 'none')
          .map(
            (b) =>
              `${b.textContent.trim().slice(0, 16)}${b.disabled ? '⊘' : ''}${b.classList.contains('active') ? '•' : ''}`,
          )
          .join(' '),
      ]),
  );
// Links opened cold, each in a page of its own (an iframe): their walk built, its mode the link's, its battle or its symmetry
// as the link asks (v0.4.426: a strip's battle looped on its own size, opened cold; v0.4.423: a symmetry before any walk)
const COLD_LINKS = [
  ['x=pi&w=kleinHexGrid&d=3000&s=72&k=2&xb=e', { teams: 2 }],
  ['x=pi&w=mobiusHexWalk&d=3000&s=5&k=3&xb=sqrt(2)&xc=sqrt(3)&br=3', { teams: 3 }],
  ['x=pi&w=hexSphereGrid&d=3000&s=24&k=2&xb=e', { teams: 2 }],
  ['w=life2dHex&r=B3/S23&y=mirror', { symmetry: 'mirror' }],
];
async function checkColdLinks(fail) {
  for (const [link, want] of COLD_LINKS) {
    const f = document.createElement('iframe'),
      w = new URLSearchParams(link).get('w');
    f.style.cssText = 'position:fixed;left:0;top:0;width:1200px;height:900px;opacity:0;pointer-events:none';
    f.src = `${location.pathname}?cold=${Date.now()}#${link}&v=${VERSION}`;
    document.body.append(f);
    await new Promise((go) => f.addEventListener('load', go, { once: true }));
    for (let t = 0; t < 60 && f.contentWindow.eval('walk.mode') !== w; t++) await wait(100); // (built: its walk the link's mode, 6 s at most)
    let mode, teams, symmetry;
    try {
      [mode, teams, symmetry] = f.contentWindow.eval('[walk.mode, battleOn() ? walkTeams : 1, plane.sym]');
    } catch (e) {
      mode = `${e.name}: ${e.message}`;
    } // (its page broken: said, not thrown)
    f.remove();
    if (mode !== w) fail(`#${link} opened cold: no walk built (${mode})`);
    else if (want.teams && teams !== want.teams) fail(`#${link} opened cold: ${teams} teams, not ${want.teams}`);
    else if (want.symmetry && symmetry !== want.symmetry)
      fail(`#${link} opened cold: symmetry ${symmetry}, not ${want.symmetry}`);
  }
  return COLD_LINKS.length;
}
// Click everything, as a brute (a night's, clickAll): on each mode the crawl reaches, every control seen and not greyed (the
// panel's, Display's, the player's), clicked then clicked again (back as it was), then a step on, a step back and the start:
// no error thrown, its control named. Not the crawl's own (tabs, spaces, shapes, tilings, rules, sides), nor what downloads,
// copies, erases or plays a sound (Display › Blocks threw from v0.4.21 to v0.4.503: the fuzz picks menus only)
const CLICK_SKIP =
  '#modeTabs, #navSpace, #navShapes, #torusTiles, #navRules, #walkOn, #galleryPane, #exportPng, #copyRle, #copyNumber, [hidden]';
function clickEverything(fail) {
  let errors = [],
    at = '';
  window.addEventListener('error', (e) => errors.push(`${e.message} (${at})`));
  return async (where) => {
    const roots = [document.querySelector('aside.panel'), $('viewTools'), $('animBar')];
    const list = () =>
      roots
        .flatMap((r) => [...r.querySelectorAll('button, label.check')])
        .filter((b) => b.offsetParent && !b.disabled && !b.closest(CLICK_SKIP) && b !== soundButton);
    const name = (b) => (b.querySelector('.mode-name') ?? b).textContent.trim().slice(0, 30) || b.id || b.className;
    const done = new Set();
    for (let i = 0; i < 400; i++) {
      // (re-read each time: a click may draw the panel again)
      const b = list().find((x) => !done.has(name(x)));
      if (!b) break;
      done.add(name(b));
      at = `${where} › ${name(b)}`;
      b.click();
      await wait(120);
      const again = list().find((x) => name(x) === name(b));
      if (again && !again.disabled) {
        again.click();
        await wait(120);
      }
      for (let t = 0; waits.size && t < 300; t++) await wait(100); // (a walk built again: its digits, its build)
    }
    at = `${where} › step, back, start`;
    for (const id of ['step', 'back', 'restart'])
      if ($(id) && !$(id).disabled) {
        $(id).click();
        await wait(150);
      }
    if (errors.length) {
      fail(`clickAll: ${errors.splice(0).slice(0, 3).join(' / ')}`);
    }
  };
}
// Each greyed control hovered, as a visitor would (its tooltip's why and its Allowed on, see setTile's pathsTo), at the size
// shown and, on a surface, at its largest: none slower than HOVER_BUDGET at its first hover (Hunt › Longest on a globe of
// 795,026 cells, 9.7 s till v0.4.787: each surface next to it built whole to judge its teams, see surfaceFrame)
const HOVER_BUDGET = 100;
function hoverGreyed(fail) {
  const name = (b) => (b.querySelector('.mode-name') ?? b).textContent.trim().slice(0, 30) || b.id;
  const hoverAll = (where) => {
    for (const b of document.querySelectorAll('aside.panel button, #viewTools button, #animBar button'))
      if (b.disabled && b.offsetParent) {
        const t = performance.now();
        b.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        const ms = performance.now() - t;
        if (ms > HOVER_BUDGET) fail(`${where} › ${name(b)}: its first hover ${Math.round(ms)} ms`);
      }
  };
  const resize = async (value) => {
    $('sphereF').value = value;
    $('sphereF').dispatchEvent(new Event('change'));
    await wait(200);
    await until(() => true);
  };
  return async (where) => {
    hoverAll(where);
    const F = $('sphereF'),
      largest = F.options[F.options.length - 1]?.value;
    if (MODES[tabMode()].plane || !largest || F.value === largest) return;
    const was = F.value;
    await resize(largest);
    hoverAll(`${where} at ${largest}`);
    await resize(was);
  };
}
async function coldLike(fail, what) {
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;left:0;top:0;width:1200px;height:900px;opacity:0;pointer-events:none';
  f.src = `${location.pathname}?cold=${Date.now()}${location.hash}`;
  document.body.append(f);
  await new Promise((go) => f.addEventListener('load', go, { once: true }));
  await wait(1500);
  for (let t = 0; f.contentWindow.eval('waits.size') && t < 600; t++) await wait(100); // (its digits or its build still on their way: as the page's own look waits, see checker)
  const a = linked(),
    b = offered(f.contentWindow);
  f.remove();
  // (what a link cannot hold, left out: a reversible one's return found by playing it; Draw's tools after a generation played)
  const unheld = new Set([
    ...(walk.life?.margolus && walk.life.stable ? ['#returnSection'] : []),
    ...(drawing && stepShown > 0 ? ['#startSection'] : []),
  ]);
  const diff = [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .filter((k) => a[k] !== b[k] && !unheld.has(k))
    .map((k) => `${k}: «${a[k]}» here, «${b[k]}» cold`);
  if (diff.length) fail(`${what} ${location.hash}: ${diff.join('; ')}`);
}
async function fuzz(fail, count, seedv, cold = false) {
  const C = checker(fail);
  let sd = seedv >>> 0 || 1;
  const rnd = () => (sd = (Math.imul(sd, 1103515245) + 12345) >>> 0) / 4294967296,
    pick = (a) => a[Math.floor(rnd() * a.length)];
  const shown = (sel) =>
    [...document.querySelectorAll(sel)].filter((b) => !b.disabled && b.offsetParent !== null && !b.closest('[hidden]'));
  const clickIn = (sel) => () => {
    const b = pick(shown(sel));
    if (!b) return null;
    b.click();
    return `${sel.split(' ')[0]} ${b.textContent.trim().slice(0, 24)}`;
  };
  const actions = [
    [3, clickIn('#modeTabs [role=tab]')],
    [2, clickIn('#navSpace button')],
    [4, clickIn('#navShapes button')],
    [2, clickIn('#torusTiles button')],
    [2, clickIn('#navRules > button')],
    [2, clickIn('#colourBlocks button')],
    [2, clickIn('#huntZones button')],
    [2, clickIn('#ruleCards button')],
    [1, clickIn('#lifeStartTabs button, #antStartTabs button')],
    [1, clickIn('#cellModes button, #colourButtons button, #areaModes button, #symmetryTiles button')],
    [
      3,
      () => {
        const down = shown('#sizeDown, #planeDown')[0];
        if (!down) return null;
        for (let k = 0; k < 14 && !down.disabled; k++) down.click();
        return 'smallest';
      },
    ],
    [
      1,
      () => {
        const up = shown('#sizeUp, #planeUp')[0];
        if (!up) return null;
        up.click();
        return 'size up';
      },
    ],
    [
      2,
      () => {
        const b = shown('#step')[0];
        if (!b) return null;
        for (let k = 0; k < 3; k++) b.click();
        return '3 steps';
      },
    ],
    [
      1,
      async () => {
        const b = shown('#play')[0];
        if (!b) return null;
        b.click();
        await wait(400);
        if (shown('#play')[0]) shown('#play')[0].click();
        return 'play';
      },
    ],
    [
      1,
      () => {
        const h = location.hash;
        location.hash = '';
        location.hash = h;
        return 'link again';
      },
    ],
  ];
  const total = actions.reduce((s, a) => s + a[0], 0),
    trail = [];
  for (let i = 0; i < count; i++) {
    let r = rnd() * total,
      act = actions[0][1];
    for (const [w, f] of actions) {
      if ((r -= w) < 0) {
        act = f;
        break;
      }
    }
    const what = await act();
    if (!what) continue;
    trail.push(what);
    if (trail.length > 8) trail.shift();
    if (!(await C.look(`fuzz #${i} (seed ${seedv}) ${trail.join(' › ')}`, 300))) trail.length = 0;
    else if (cold) await coldLike(fail, `fuzz #${i} (seed ${seedv}) ${trail.join(' › ')}`);
  }
  C.stop();
  return C.checked;
}

// The deep crawl (a night's): every grid of Life and Rewind from its link, then on each: every rule of its menu and one of
// your own (B36/S23; blocks: their menu's), each with How it works (and its Letters page); every colour (and Mixed); every zone of
// Hunt; its smallest size; 30 generations played. No error anywhere (a click's included), the link's mode the one shown.
// only: those grids alone; from: the grid it starts at (after a crash: localStorage.tesseraDeep holds the one it was on, and its failures so far)
async function deep(fail, from, only) {
  const wait = (ms) => new Promise((go) => setTimeout(go, ms)),
    errors = [];
  const onError = (e) => errors.push(e.message);
  window.addEventListener('error', onError);
  let checked = 0;
  const look = async (what, ms = 350) => {
    await wait(ms);
    checked++;
    if (errors.length) fail(`${what}: ${errors.splice(0).join(' / ')}`);
  };
  const play = async (what) => {
    try {
      await goTo(stepShown + 30);
    } catch (e) {
      fail(`${what}: playing: ${e.message}`);
    }
  };
  const how = async (what) => {
    // its How it works, then its Letters, closed again
    $('watchRule').click();
    await look(`${what} How it works`);
    const letters = document.querySelector('.tut-letters');
    if (letters) {
      letters.click();
      await look(`${what} Letters`);
      document.querySelector('.tut-letters')?.click();
      await wait(100);
    }
    if (!$('ruleTuto').hidden) $('ruleTuto').querySelector('.tut-close')?.click();
  };
  const all = (only ?? Object.keys(MODES)).filter(
    (m) => MODES[m].life && [...$('mode').options].some((o) => o.value === m),
  );
  for (const w of all.slice(Math.max(0, all.indexOf(from)))) {
    localStorage.tesseraDeep = `${w} ${Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1e6)} MB`; // (the page's memory too)
    location.hash = `w=${w}`;
    await look(`${w} from its link`, 900);
    if ($('mode').value !== w) fail(`${w}: the link opened ${$('mode').value}`);
    for (let i = 0; i < $('ruleCards').children.length; i++) {
      const b = $('ruleCards').children[i],
        name = b.querySelector('.mode-name')?.textContent ?? '';
      if (/Custom/.test(name)) continue;
      b.click();
      await look(`${w} rule ${name}`, 500);
      await play(`${w} rule ${name}`);
      if (i < 2) await how(`${w} rule ${name}`); // (How it works: the first two, and your own)
    }
    if (!MODES[w].margolus) {
      // (blocks: their rules tables of their own size, all in the menu)
      $('lifeRule').value = 'B36/S23';
      $('lifeRule').dispatchEvent(new Event('change'));
      await look(`${w} a rule of your own`, 500);
      await play(`${w} a rule of your own`);
      await how(`${w} a rule of your own`);
    }
    for (const b of [...$('colourBlocks').children].filter((x) => !x.disabled)) {
      b.click();
      await look(`${w} colours ${b.textContent.trim()}`);
    }
    if (!$('huntRow').hidden)
      for (const b of [...$('huntZones').children].filter((x) => !x.disabled && !x.hidden)) {
        b.click();
        await look(`${w} zone ${b.textContent.trim()}`);
      }
    const down = MODES[w].plane ? $('planeDown') : $('sizeDown');
    for (let k = 0; k < 12 && !down.disabled; k++) {
      down.click();
      await wait(250);
    }
    await look(`${w} smallest`, 500);
    await play(`${w} smallest`);
  }
  window.removeEventListener('error', onError);
  return checked;
}

// Colours offered: every Life surface, its sizes from the least up till one offers a count of colours past Solo (none at
// any: its colours never fair there, as Klein Trihex's were, its length always half a period off)
async function coloursOffered(fail) {
  let checked = 0;
  for (const w of Object.keys(MODES).filter(
    (m) => MODES[m].life && MODES[m].sphere && [...$('mode').options].some((o) => o.value === m),
  )) {
    const kind = surfaceOf(MODES[w]),
      sizes = SPHERES[kind]?.sizes ?? [];
    let some = false;
    for (const s of sizes) {
      location.hash = `#w=${w}&s=${s}`;
      await until(shown(w, () => String(sphereSize()) === String(s)));
      if (TEAM_COUNTS.some((K) => K > 1 && teamsFit(K))) {
        some = true;
        break;
      }
    }
    checked++;
    if (!some) fail(`${w}: Solo only at every size (${sizes.join(', ')})`);
  }
  return checked;
}

// A solid's start 1 the same kind of point at every size (the turns of the solid leaving it in place as many): what lets
// battleFits judge it on the solid's least mesh (see battleFits), every walk on a closed solid whose team counts depend on
// the start, its sizes to 30,000 cells
function checkFirstStarts(fail) {
  let checked = 0;
  for (const w of Object.keys(MODES).filter(battleMode)) {
    const mode = MODES[w],
      kind = surfaceOf(mode),
      S = SPHERES[kind];
    if (S.columns) continue;
    const counts = solidTeamCounts(kind, mode);
    if (counts.some.every((K) => counts.any.includes(K))) continue; // (any start: none depends on it)
    const kindOfStart = (size) => {
      const g = S.mesh(size),
        P = mode.grid ? g.verts : g.cen,
        v = walkStart(g, mode, 1)[0],
        p = [P[3 * v], P[3 * v + 1], P[3 * v + 2]];
      return solidRotations(solidCorners(g)).filter((M) => pointsApart([p, matTimesPoint(M, p)]) < 1e-7).length;
    };
    const sizes = sizesOf(kind, mode).filter((size) => S.tiles(size) <= 30000),
      first = kindOfStart(sizes[0]);
    for (const size of sizes.slice(1)) {
      checked++;
      if (kindOfStart(size) !== first)
        fail(
          `${w} at ${size}: start 1 another kind of point than at ${sizes[0]} (battleFits judges it on the least mesh)`,
        );
    }
  }
  return checked;
}

// Battles fair: every walk on a surface (see battleMode), at its size, offers a count of walkers past Solo, and in each
// count offered every walker, its digits A's, walks A's path moved by its map (see battleMaps, placeMap), step for step,
// till one dies: none its mirror. A night's (4 minutes)
async function battlesFair(fail) {
  let checked = 0;
  for (const w of Object.keys(MODES).filter(battleMode)) {
    location.hash = `#x=pi&w=${w}`;
    await until(shown(w, () => !walk.battle && walk.geo));
    const counts = battleCounts(w),
      grid = !!MODES[w].grid;
    const built = (K, stops) =>
      $('mode').value === w && walk.battle?.player?.K === K && walk.battle.player.stops === stops; // (this link's battle, not the one before it)
    checked++;
    if (!counts.length) fail(`${w}: no battle at size ${sphereSize()}`);
    for (const K of counts) {
      location.hash = `#x=pi&w=${w}&d=3000&k=${K}&${'bcdefghijkl'
        .slice(0, K - 1)
        .split('')
        .map((c) => `x${c}=pi`)
        .join('&')}`;
      for (let t = 0; t < 30 && !built(K, false); t++) await wait(300);
      const P = walk.battle?.player,
        g = walk.geo;
      checked++;
      if (P?.K !== K) {
        fail(`${w} ${K} walkers: no battle (${walkSaid})`);
        continue;
      }
      P.to(Infinity);
      const start = walkStart(g, MODES[w]),
        spread = startSpread(g, grid, start),
        G = battleGroups(g, K).reduce((a, b) => (spread(b) > spread(a) + 1e-9 ? b : a));
      const end = Math.min(...P.dead.map((d) => (d < 0 ? P.n : d)));
      let off = 0;
      for (let s = 1; s < K; s++)
        for (let i = 0; i < end; i++) if (P.places[s][i] !== G[s](P.places[0][i], grid)) off++;
      if (off) fail(`${w} ${K} walkers: ${off} steps off A's path moved (#x=pi&w=${w}&k=${K})`);
    }
    // Land no collision, its fewest walkers: no walker's step along another's (a line's edge along the grid, a tile
    // on cells), and none moving once stopped
    const stop = BATTLE_RULES.findIndex((p) => p[0] === 'landStop'),
      K = counts[0],
      link = `#x=pi&w=${w}&d=3000&k=${K}&br=${stop}&${'bcdefghijkl'
        .slice(0, K - 1)
        .split('')
        .map((c, j) => `x${c}=sqrt(${j + 2})`)
        .join('&')}&v=${VERSION}`; // (its version: a link without one is read as an old one, pe= in its order then, see PE_BEFORE)
    if (!K) continue;
    location.hash = link;
    for (let t = 0; t < 30 && !built(K, true); t++) await wait(300);
    const P = walk.battle?.player;
    checked++;
    if (!P?.stops) {
      fail(`${w} Land no collision: no battle (${link})`);
      continue;
    }
    P.to(Infinity);
    const mine = new Map();
    let shared = 0,
      moved = 0;
    for (let s = 0; s < K; s++) {
      const Q = P.places[s],
        end = P.dead[s] < 0 ? P.n : P.dead[s];
      for (let i = grid ? 1 : 0; i <= end; i++) {
        if (grid && Q[i] === Q[i - 1]) continue;
        const key = grid ? `${Math.min(Q[i], Q[i - 1])},${Math.max(Q[i], Q[i - 1])}` : Q[i],
          o = mine.get(key);
        if (o !== undefined && o !== s) shared++;
        mine.set(key, s);
      }
      for (let i = end + 1; i <= P.n; i++) if (Q[i] !== Q[end]) moved++;
    }
    if (shared || moved)
      fail(
        `${w} Land no collision: ${shared} ${grid ? 'edges' : 'tiles'} shared, ${moved} steps once stopped (${link})`,
      );
    // Snake cells (on cells), its fewest walkers: a snake grows a cell a step at most (an even step till a tenth of the
    // surface, an odd one by what it has eaten), and none past a tenth before the first bite (no cells eaten yet)
    const snake = BATTLE_RULES.findIndex((p) => p[0] === 'snakeCells');
    if (grid || snake < 0) continue;
    const slink = link.replace(`&br=${stop}&`, `&br=${snake}&`);
    location.hash = slink;
    for (
      let t = 0;
      t < 30 && !(walk.battle?.player?.K === K && $('mode').value === w && location.hash.includes(`br=${snake}`));
      t++
    )
      await wait(300);
    const S = walk.battle?.player;
    checked++;
    if (S?.K !== K) {
      fail(`${w} Snake cells: no battle (${slink})`);
      continue;
    }
    const cap = Math.floor(walk.geo.n / 10),
      before = Array(K).fill(0);
    let fast = 0,
      over = 0,
      bitten = false;
    S.to(0);
    for (let i = 1; i <= S.n; i++) {
      S.to(i);
      for (let s = 0; s < K; s++) {
        if (S.size[s] > before[s] + 1) fast++;
        if (S.size[s] < before[s] - 1) bitten = true; // (a bite: cells eaten from then on)
        if (!bitten && S.size[s] > cap) over++;
        before[s] = S.size[s];
      }
    }
    if (fast || over)
      fail(
        `${w} Snake cells: ${fast} steps a snake grew more than a cell, ${over} past a tenth before any bite (${slink})`,
      );
  }
  return checked;
}

// a grid that never repeats, round (by its own measure: Ammann's an octagon): in each of 72 ways from its middle, its cells as far out as the median less 3 at most (a
// disc of its patch, never cut by the patch's edge: the pinwheel's big triangle's, v0.1.1386's), its sizes up to 128
function checkDiscs(fail) {
  let checked = 0;
  for (const kind of Object.keys(APERIODIC))
    for (const side of planeSides(kind).filter((f) => f <= 128)) {
      const W = planeW(kind, side),
        o = (W - 1) / 2,
        far = new Array(72).fill(0),
        { poly, norm, n } = APERIODIC[kind](W);
      for (let t = 0; t < n; t++) {
        const p = poly(t),
          [u, v] = [0, 1].map((d) => p.reduce((sum, q) => sum + q[d], 0) / p.length - o),
          k = Math.floor(((Math.atan2(v, u) + Math.PI) / (2 * Math.PI)) * 72) % 72;
        far[k] = Math.max(far[k], norm(u, v));
      }
      const sorted = [...far].sort((a, b) => a - b);
      checked++;
      if (sorted[36] - sorted[0] > 3)
        fail(
          `${kind} at ${side}: its disc cut, ${(sorted[36] - sorted[0]).toFixed(1)} cells short ${far.indexOf(sorted[0]) * 5 - 180}° from its middle`,
        );
    }
  return checked;
}

// a torus of blocks: whether its sets go round, as a side of the same remainder mod 6 does (see blocksWrap)
function checkBlockWraps(fail) {
  let checked = 0;
  for (const k0 of new Set(
    Object.values(MODES)
      .filter((m) => m.margolus && m.plane)
      .map((m) => m.plane),
  )) {
    const kind = STRAIGHT_RECTS.has(k0) ? `${k0}Rect` : k0; // (a torus of a slanted grid: its rectangle's)
    for (let W = 25; W <= 30; W++) {
      checked++;
      if (planeBlocks(kind, W, true).wraps !== blocksWrap(kind, W))
        fail(`${kind}: blocks at side ${W} wrap otherwise than at ${18 + (W % 6)}`);
    }
  }
  return checked;
}

// Life's known results (its only engine the graphics card's: none here to compare with): a link's start played till it
// repeats, from generation T with period P (null: not checked); PATTERNS.md's records, and reversible rules' returns to their
// start (from a seeded start: played, and Find its return's); a hunt's 8 best of all a zone's starts (the processor's
// worker's, v0.1.1394)
const KNOWN = [
  ['#w=life2d&r=B3678/S34678&s=64&pop=draw&p=32,32:.A$.A$2A$A!', null, 16],
  ['#w=life2d&r=B3678/S34678&s=64&pop=draw&p=32,32:2.A$2A2.A$2A2.A$A.2A$2A.2A!', 219, null],
  ['#w=life2d&r=B36/S23&s=64&pop=draw&p=32,32:5.A2.A$2A2.A3.A$2A2.2A.2A!', null, 10],
  ['#w=life2d&r=B2/S/C3&s=64&pop=draw&p=32,32:3.2A$A$.4A$4.A$3A.A!', 2595, null],
  ['#w=life2d&r=B36/S23&s=64&pop=draw&p=32,32:A.2A$3.2A$2A$3.2A$3A!', 2652, 2],
  ['#w=life2d&r=B3/S12345&s=64&pop=draw&p=32,32:A3.A$2.A$2A$5A!', 430, 1],
  ['#w=life2dHex&r=B2/S34&s=64&pop=draw&p=58,16:A$2A.A$.A.A!', 0, 48],
  ['#w=life2dHex&r=B2/S34&s=64&pop=draw&p=54,16:4.A2.A$.A.3A.A$A.A.A!', 254, 20],
  ['#w=life2dHex&r=B2o/S2m34&s=64&pop=draw&p=53,16:6.A$A.5A.A.A.A$.A2.A2.A2.A!', 0, 30],
  ['#w=life2dTri&r=B3/S23&s=64&pop=draw&p=80,12:A3.2A.A!', 430, 8],
  ['#w=blocks2d&r=M15,1,2,3,4,5,6,7,8,9,10,11,12,13,14,0&s=6&g=2000&pop=random.30.6', 0, 70],
  ['#w=blocks2d&r=Q2R&s=6&g=2000&pop=random.30.6', 0, 116],
  ['#w=blocks2dTetrakis&r=M0,4,8,12,1,10,9,13,2,6,5,14,3,7,11,15*&s=8&g=2000&pop=random.30.8', 0, 84],
];
async function checkKnown(fail) {
  let checked = 0;
  for (const [link, T, P] of KNOWN) {
    await openLife(link);
    const L = walk.life;
    lifeReset();
    stepShown = 0;
    for (let far = (T ?? 600) + (P ?? 600), was = -1; !L.stable && stepShown < far && stepShown !== was;) {
      was = stepShown;
      await goTo(Math.min(far, stepShown + LIFE_BATCH));
    } // (none going on: stopped, not spun)
    checked++;
    if ((T !== null && L.stable?.T !== T) || (P !== null && L.stable?.P !== P))
      fail(`${link}: repeats from ${L.stable?.T} with period ${L.stable?.P}, known ${T} and ${P}`);
  }
  // Find its return, past the generations played (Swirl on hexagons, 6 cells of 90: 48,924, found by the graphics card too)
  location.hash = '#w=blocks2dHex&r=M0,2,4,5,1,6,3,7&s=6&pop=random.10.6';
  for (
    let i = 0;
    i < 100 && !($('mode').value === 'blocks2dHex' && walk.life?.margolus && walk.life.seedAlive === 6 && !waits.size);
    i++
  )
    await wait(100); // (built, not a wait's guess)
  lifeReset();
  stepShown = 0;
  searchBack(true);
  for (let i = 0; i < 300 && backSearch.life; i++) await wait(50);
  checked++;
  if (backSearch.found !== 48924) fail(`Swirl on hexagons: its return found at ${backSearch.found}, known 48,924`);
  searchBack(false);
  // a run played back and round its loop: a Game of Life's back (no rule backwards: round its loop forth, else again from its
  // start, see advanceTo) the very state played to (a pentadecathlon, a domino dying: from 1, period 15; v0.2.52); a jump across
  // a reversible one's return to its end, not its start (v0.2.50)
  location.hash = '#w=life2d&r=B3/S23&s=32&e=1&p=10,10:2A7$2.A4.A$2A.4A.2A$2.A4.A!&pop=draw';
  await until(shown('life2d', () => plane.side === 32 && !plane.torus));
  restart();
  const at = [],
    cells = () => Uint8Array.from(walk.life.alive, (v) => +(v > 0));
  for (let g = 0; g <= 16; g++) {
    if (g) await goTo(g);
    at.push(cells());
  }
  checked++;
  if (walk.life.stable?.T !== 1 || walk.life.stable?.P !== 15)
    fail(
      `a pentadecathlon and a domino: repeats from ${walk.life.stable?.T} with period ${walk.life.stable?.P}, known 1 and 15`,
    );
  for (const [from, to] of [
    [15, 1],
    [12, 3],
    [15, 0],
  ]) {
    await goTo(from);
    await goTo(to);
    checked++;
    if (stepShown !== to || !cells().every((v, t) => v === at[to][t]))
      fail(
        `a Game of Life back from ${from} to ${to}: at ${stepShown}, ${stepShown === to ? 'not the state played to' : ''}`,
      );
  }
  await openLife('#x=1/28&w=blocks2d&d=200&r=M15,1,2,3,4,5,6,7,8,9,10,11,12,13,14,0&s=16&e=1&pop=digits');
  restart();
  await goTo(30);
  checked++;
  if (stepShown !== 6)
    fail(
      `1/28's blocks, a jump to 30 across its return (12): at ${stepShown}, not round its loop (6, as a Game of Life)`,
    );
  // a start's symmetry (see symmetricStart): its shape the same on every copy; in colours, a start by parts each colour as many
  // (v0.2.79, v0.2.82); a text in colours laid at all (v0.2.78)
  for (const link of [
    '#w=life2d&r=B3/S23&k=4&s=48&e=1&y=rotate&pop=random.30.5',
    '#w=life2d&r=B3/S23&k=4&s=144&e=1&y=rotate&pop=text.Walking%0Api&tf=hand',
    '#w=life2d&r=B3/S23&k=4&s=144&e=1&pop=text.Walking%0Api&tf=mono',
    '#x=pi&w=life2d&r=B3/S23&s=48&e=1&y=kaleido&pop=digits',
  ]) {
    await openLife(link);
    const { kind, W } = walk.plane,
      seed = walk.life.seed,
      by = [...walk.life.seedByColour].slice(1);
    let bad = 0;
    for (let t = 0; t < seed.length; t++)
      for (const c of cellCopies(kind, W, t)) if (seed[c] > 0 !== seed[t] > 0) bad++;
    checked++;
    if (!walk.life.seedAlive) fail(`${link}: nothing laid`);
    else if (bad) fail(`${link}: its start not symmetric (${bad} cells unlike their copies)`);
    else if (by.length > 1 && new Set(by).size > 1) fail(`${link}: its colours unequal (${by.join(', ')})`);
  }
  // each symmetry a grid offers kept 60 generations on (a grid in a hexagon: about its own middle, v0.2.89): squares and the
  // grids in a hexagon all four, Florets no mirror (its tiles have none), hexagons' blocks none (their blocks not onto blocks)
  for (const [w, offers] of [
    ['life2d', 'half rotate mirror kaleido'],
    ['blocks2d', 'half rotate mirror kaleido'],
    ['life2dHex', 'half rotate mirror kaleido'],
    ['life2dTri', 'half rotate mirror kaleido'],
    ['life2dDual56', 'half rotate mirror kaleido'],
    ['life2dFloret', 'half rotate'],
    ['blocks2dHex', ''],
  ]) {
    await openLife(`#w=${w}&s=32&e=1&pop=random.30.1`);
    const { kind, W } = walk.plane,
      has = symmetriesHere(kind, W)
        .filter((y) => y !== 'none')
        .join(' ');
    checked++;
    if (has !== offers) fail(`${w}: symmetries ${has || 'none'}, known ${offers || 'none'}`);
    for (const y of has ? has.split(' ') : []) {
      plane.sym = y;
      lifeReseed();
      await wait(600);
      restart();
      await goTo(60);
      const a = walk.life.alive;
      let bad = 0;
      for (let t = 0; t < a.length; t++) for (const c of cellCopies(kind, W, t)) if (a[c] > 0 !== a[t] > 0) bad++;
      checked++;
      if (bad) fail(`${w} ${y}: at gen ${stepShown}, ${bad} cells unlike their copies`);
    }
    plane.sym = 'none';
  }
  // a hunt: of the 2^14 starts of 14 cells (radius 2's first), the 8 longest
  location.hash = '#w=life2d&r=B3/S23&s=48&pop=random.49.5';
  await until(shown('life2d', () => plane.side === 48 && plane.torus));
  hunt.zone = 'radius2';
  const plan = { cells: huntPlan().cells.slice(0, 14), copies: [], all: 2 ** 14 };
  const top = await new Promise((done) => {
    const h = huntRuns(walk.life, plan, 50000, 'longest', (best, n, end) => {
      if (best) h.best = best;
      if (end) {
        h.stop();
        done(h.best);
      }
    });
  });
  checked++;
  const lives = top.map((r) => `${r.T}/${r.P}`).join(' ');
  if (lives !== '2401/2 2400/2 1942/2 1758/2 1757/2 1756/2 1755/2 1754/2') fail(`a hunt's 8 longest: ${lives}`);
  return checked;
}

// each tiling's mark (its rules' options begin with it, see lifeMark) its own: shared only with its torus, strip and bottle,
// and the solids made of its cells
function checkMarks(fail) {
  for (const [kind, t] of Object.entries(TILINGS)) {
    const others = Object.keys(MODES).filter(
      (w) =>
        MODES[w].life &&
        !MODES[w].margolus &&
        !MODES[w].loops &&
        !MODES[w].elementary &&
        lifeMark(MODES[w]) === t.mark &&
        MODES[w].plane !== kind &&
        FOLDED[MODES[w].sphere]?.kind !== kind &&
        !(kind === 'tetrakis' && MODES[w].sphere?.endsWith('Tetrakis')) &&
        SPHERES[MODES[w].sphere]?.tiling !== kind,
    ); // (a surface of its cells: see SPHERES' tiling)  // (the solids of squares cut as tetrakis: its triangles, see TETRAKIS_SOLIDS)
    if (others.length) fail(`${t.name}'s mark ${t.mark} also ${others.join(', ')}'s: their rules shown on it`);
  }
  return 1;
}

// The sheets (tori, Möbius strips, Klein bottles), each rule as the app means it, so that a change of one never breaks another
// (v0.3.73 made the motif's lattice cell the colours' unit too: a slanted cell across a torus's seam, its tiles in the other colour):
//  - a tiling's torus: each brick (the motif) one lattice cell, its tiles all there; each colour unit (its sheet's cell) side by
//    side as laid, within 1.5 sheet cells (not across the seam, drawn at both ends once unrolled);
//  - a tiling's Klein bottle in Duel and Quartet, from 24 rows: its colours' slices square, 0.85 to 1.15 (by the shape asked,
//    not its rounding: before v0.3.83, one size in two its usual length);
//  - the globe: its parallels a unit apart, its cells 0.70 to 1.42 as wide as high, each band a multiple of its colours, at every size of every count (see globeBands);
//  - the colours offered the same whatever is picked (a bottle's length its count's: before v0.3.80, Prismatic's 3 in Trio, 8 in
//    Nonet), each offered count as many cells a colour once taken
async function checkSheets(fail) {
  const keepPicked = picked;
  picked = null; // (each surface at its own first size, whatever was picked by hand: a picked one of 350,000 cells, a build longer than the waits, the surface before measured)
  let checked = 0;
  const sizeOne = (S) => S.sizes?.[1] ?? S.sizes?.[0];
  for (const name of foldedIn('torus')) {
    const S = SPHERES[name],
      g = S.mesh(sizeOne(S)),
      m = TILINGS[g.tiling].polys.length;
    const bricks = Map.groupBy([...Array(g.n).keys()], (t) => g.latticeCells[t]),
      odd = [...bricks.values()].filter((ts) => ts.length !== m);
    if (odd.length) fail(`${name}: ${odd.length} bricks not one lattice cell (${m} tiles): ${odd[0].length}`);
    const place = colourUnitPlaces(g),
      units = Map.groupBy([...Array(g.n).keys()], (t) => `${place[2 * t].toFixed(4)},${place[2 * t + 1].toFixed(4)}`);
    const spread = (ts, d) => {
      const x = ts.map((t) => g.uvMid[2 * t + d]);
      return Math.max(...x) - Math.min(...x);
    };
    const apart = [...units.values()].filter((ts) => spread(ts, 0) > 1.5 || spread(ts, 1) > 1.5);
    if (apart.length)
      fail(
        `${name}: ${apart.length} colour units across its seam (${spread(apart[0], 0).toFixed(1)} sheet cells along)`,
      );
    checked += 2;
  }
  for (const name of foldedIn('klein'))
    for (const K of [2, 4]) {
      const off = SPHERES[name].sizes
        .filter((s) => Number(s) >= 24)
        .map((s) => {
          const L = kleinLength(name, s, K);
          return [s, (L.n * L.step) / K / L.W];
        })
        .filter(([, r]) => r < 0.85 || r > 1.15);
      if (off.length)
        fail(
          `${name} in ${K} colours: its slices not square at ${off.map(([s, r]) => `${s} (${r.toFixed(2)})`).join(', ')}`,
        );
      checked++;
    }
  // the globe, made for its colours (see globeBands): its parallels a unit apart, every band's cells 0.70 to 1.42 as wide as high, at
  // every size of every count
  for (const K of TEAM_COUNTS) {
    for (const E of SPHERES.globe.ownSizes(K)) {
      // (K's own sizes, not those offered for the mode and colours in use)
      const { N, lines } = globeBands(E, K),
        off = N.slice(1, -1)
          .map((n, j) => (2 * Math.PI * Math.cos((lines[j] + lines[j + 1]) / 2)) / n / (lines[j + 1] - lines[j]))
          .filter((r) => r < 0.7 || r > 1.42),
        uneven = lines.slice(1).some((l, j) => Math.abs(l - lines[j] - (2 * Math.PI) / E) > 1e-9);
      if (off.length || uneven || N.slice(1, -1).some((n) => n % K))
        fail(
          `the globe at ${E} in ${K} colours: ${off.length} bands past 0.70 to 1.42${uneven ? ', its parallels not a unit apart' : ''}${N.some((n) => n % K) ? ', a band not a multiple of its colours' : ''}`,
        );
    }
    checked++;
  }
  for (const w of ['lifeKleinPrismatic', 'lifeKleinPent15', 'lifeTorusRhombitri', 'lifeMobiusPent10', 'lifeGlobe']) {
    const offered = [];
    for (const K of [1, 3]) {
      lifeTeams = K;
      location.hash = `#w=${w}&k=${K}`;
      await until(shown(w, () => lifeTeams === K));
      offered.push(TEAM_COUNTS.filter((k) => teamsFit(k)).join(','));
    }
    if (offered[0] !== offered[1]) fail(`${w}: colours offered ${offered[0]} in Solo, ${offered[1]} in Trio`);
    if (w === 'lifeKleinPent15' && offered[0].split(',').some((k) => k % 2 === 0))
      fail(`${w}: an even count of colours offered (${offered[0]}), its twist asking an odd length`); // (v0.3.88 to 0.3.93: g.period left by the rename, every count offered)
    for (const K of [2, 3, 5].filter((k) => offered[0].split(',').includes(`${k}`))) {
      location.hash = `#w=${w}&k=${K}`;
      await until(shown(w, () => lifeTeams === K && walk.life?.colours === K));
      const sizes = huntParts(null, K).map((p) => p.length);
      if (lifeTeams !== K) fail(`${w}: ${K} colours offered, ${lifeTeams} taken`);
      else if (new Set(sizes).size > 1) fail(`${w} in ${K} colours: its parts ${sizes.join(' / ')}`);
    }
    checked += 2;
  }
  picked = keepPicked; // (the size picked by hand, back)
  return checked;
}

// Every count of colours offered, as many cells a colour once taken: each Life grid of the plane, walled and on a torus (one cell
// apart at most: a slice's cells whole), each solid (none apart), at its first size (before v0.3.90: the rosettes' halves and
// Penrose's mirror halves, 2 to 9 cells apart; the bicupola's 5 and 10, the rhombicuboctahedron's 9, up to 97)
async function partsEqual(fail) {
  const keepPicked = picked;
  picked = null; // (each grid at its own first size, whatever was picked by hand: a picked one of 350,000 cells, a build longer than the waits)
  let checked = 0;
  const lifeModes = Object.keys(MODES).filter(
    (w) =>
      MODES[w].life &&
      !MODES[w].margolus &&
      !MODES[w].elementary &&
      !MODES[w].loops &&
      [...$('mode').options].some((o) => o.value === w),
  );
  const runs = [
    ...lifeModes
      .filter((w) => MODES[w].plane)
      .flatMap((w) => [
        [w, '', 1],
        [w, '&e=1', 1],
      ]),
    ...lifeModes
      .filter((w) => MODES[w].sphere && !TORI.includes(surfaceOf(MODES[w])))
      .map((w) => [w, '', SPHERES[MODES[w].sphere]?.disc ? 1 : 0]),
  ]; // (a rosette sphere: its discs' lunes, cells whole, one apart as the plane's)
  for (const [w, walls, slack] of runs) {
    location.hash = `#w=${w}${walls}&k=1`;
    await until(shown(w, () => lifeTeams === 1));
    for (const K of TEAM_COUNTS.filter((k) => k > 1 && teamsFit(k))) {
      location.hash = `#w=${w}${walls}&k=${K}`;
      await until(shown(w, () => lifeTeams === K && walk.life?.colours === K));
      const sizes = huntParts(null, K).map((p) => p.length);
      if (lifeTeams !== K) fail(`${w}${walls}: ${K} colours offered, ${lifeTeams} taken`);
      else if (Math.max(...sizes) - Math.min(...sizes) > slack)
        fail(`${w}${walls} in ${K} colours: ${Math.min(...sizes)} to ${Math.max(...sizes)} cells a colour`);
      checked++;
    }
  }
  picked = keepPicked; // (the size picked by hand, back)
  return checked;
}

// The rosette spheres' sizes (ROSETTE_SPHERES in main.js): each rosette's discs, W from 4 to most, whose rims pair teeth to
// notches within ROSETTE_BITE of a tile (see rosetteSeam), one W a disc (two Ws the same tiles: the first), as many cells as the
// others (CELLS); in the console, its line for main.js
window.rosetteSphereSizes = (most = 100) => {
  const out = {};
  for (const k of Object.keys(ROSETTES)) {
    const Ws = [],
      seen = new Set();
    for (let W = 4; W <= most; W++) {
      const F = APERIODIC[k](W);
      if (seen.has(F.m) || 2 * F.m < CELLS.least || 2 * F.m > CELLS.most) continue;
      seen.add(F.m);
      if (rosetteSeam(F).best[1] < ROSETTE_BITE) Ws.push(W);
    }
    if (Ws.length) out[k] = Ws;
  }
  return `const ROSETTE_SPHERES = { ${Object.entries(out)
    .map(([k, Ws]) => `${k}: [${Ws.join(', ')}]`)
    .join(', ')} };`;
};
// the discs that never repeat each one tiling cut to their sizes: every cell of a small disc in a large one, at its place
// round the middle (Penrose's wheel cut n ≡ 1 mod 4 times; the hats', spectres' and pinwheel's built for the largest, see
// DISC_TOP): their famous patterns laid at every size
function checkDiscCuts(fail) {
  const keyOf = (P, o) =>
    P.map(([x, y]) => pointKey(x - o, y - o, 1e3))
      .sort()
      .join('|');
  let checked = 0;
  for (const kind of ['penrose', 'ammann', 'rhombs12', 'rhombs14', 'hat', 'spectre', 'pinwheel']) {
    const big = APERIODIC[kind](113),
      inBig = new Set();
    for (let t = 0; t < big.n; t++) inBig.add(keyOf(big.poly(t), 56));
    for (const W of [21, 28, 43, 57]) {
      const A = APERIODIC[kind](W);
      let found = 0;
      for (let t = 0; t < A.n; t++) found += inBig.has(keyOf(A.poly(t), (W - 1) / 2));
      if (found !== A.n) fail(`${kind}'s disc of ${W}: ${found} of its ${A.n} cells in the disc of 113`);
      checked++;
    }
  }
  return checked;
}
// the twisted sphere at a few sizes: its cells as many as said (3F − 4), each corner of three of them (two cells and a triangle:
// closed, no gap), a hexagon 12 neighbours, a pentagon 10, a triangle 3 (Twisted's, see twistedSphereMesh)
function checkTwistedSphere(fail) {
  let checked = 0;
  for (const f of [2, 5, 16]) {
    const g = SPHERES.twistedsphere.mesh(f),
      k = g.sides,
      corners = (t) => [...new Set(g.poly.subarray(k * t, k * t + k))],
      at = new Map();
    if (g.n !== SPHERES.twistedsphere.tiles(f))
      fail(`twisted sphere ${f}: ${g.n} cells, ${SPHERES.twistedsphere.tiles(f)} said`);
    for (let t = 0; t < g.n; t++) for (const v of corners(t)) (at.get(v) ?? at.set(v, []).get(v)).push(t);
    if ([...at.values()].some((ts) => ts.length !== 3)) fail(`twisted sphere ${f}: a corner not of three cells`);
    const kinds = {}; // (by its corners: its neighbours, those sharing one)
    for (let t = 0; t < g.n; t++) {
      const c = corners(t),
        nb = new Set(c.flatMap((v) => at.get(v))).size - 1,
        key = `${c.length}:${nb}`;
      kinds[key] = (kinds[key] ?? 0) + 1;
    }
    const want = { '12:12': 10 * f * f - 10, '10:10': 12, '3:3': 20 * f * f };
    if (Object.keys(kinds).length !== 3 || JSON.stringify(kinds, Object.keys(want)) !== JSON.stringify(want))
      fail(
        `twisted sphere ${f}: cells (corners:neighbours) ${JSON.stringify(kinds)}, ${JSON.stringify(want)} by construction`,
      );
    checked++;
  }
  return checked;
}
// each rosette sphere at its smallest and largest size: its rims paired within ROSETTE_BITE, closed (each side two tiles'),
// its cells as many as said
function checkRosetteSpheres(fail) {
  let checked = 0;
  for (const [k, Ws] of Object.entries(ROSETTE_SPHERES))
    for (const W of [Ws[0], Ws.at(-1)]) {
      const rough = rosetteSeam(APERIODIC[k](W)).best[1],
        g = SPHERES[`${k}Sphere`].mesh(W),
        uses = new Map();
      for (let t = 0; t < g.n; t++)
        for (let q = 0; q < g.sides; q++) {
          const a = g.poly[g.sides * t + q],
            b = g.poly[g.sides * t + ((q + 1) % g.sides)],
            e = `${Math.min(a, b)},${Math.max(a, b)}`;
          if (a !== b) uses.set(e, (uses.get(e) ?? 0) + 1);
        }
      const open = [...uses.values()].filter((c) => c !== 2).length;
      checked++;
      if (!(rough < ROSETTE_BITE)) fail(`${k} sphere W${W}: its rims ${rough.toFixed(3)} of a tile apart`);
      if (open) fail(`${k} sphere W${W}: ${open} sides not shared by two tiles`);
      if (g.n !== SPHERES[`${k}Sphere`].tiles(W))
        fail(`${k} sphere W${W}: ${g.n} cells, said ${SPHERES[`${k}Sphere`].tiles(W)}`);
      // its north disc seen from outside as the plane draws it (the plane's y down, the sphere's y up seen from its north: not
      // mirrored), its cells the plane's (its start laid as there, see flatGrid)
      const F = APERIODIC[k](W),
        o = (W - 1) / 2;
      let xx = 0,
        yy = 0;
      for (let t = 0; t < g.disc.n; t++) {
        const P = F.poly(t),
          X = P.reduce((s, p) => s + p[0], 0) / P.length - o,
          Y = P.reduce((s, p) => s + p[1], 0) / P.length - o;
        xx += X * g.cen[3 * t];
        yy += Y * g.cen[3 * t + 1];
      }
      if (!(xx > 0 && yy < 0)) fail(`${k} sphere W${W}: its north disc mirrored, seen from outside`);
      if (g.disc.n !== F.n) fail(`${k} sphere W${W}: its disc ${g.disc.n} cells, the plane's ${F.n}`);
    }
  return checked;
}

window.tesseraCheck = async ({
  parts = false,
  known = false,
  crawl: andCrawl = false,
  clickAll = false,
  clickFrom = 0,
  hovers = false,
  deep: andDeep = false,
  fuzz: actions = 0,
  cold = false,
  colours = false,
  battles = false,
  seed = Date.now() % 1e6,
  from,
  only,
} = {}) => {
  const failures = [],
    fail = (s) => {
      failures.push(s);
      localStorage.tesseraDeepFailures = JSON.stringify(failures);
    };
  let checked =
    checkMeshes(fail) +
    checkBlockWraps(fail) +
    checkDiscs(fail) +
    checkTips(fail) +
    checkMarks(fail) +
    checkRosetteSpheres(fail) +
    checkTwistedSphere(fail) +
    checkDiscCuts(fail) +
    checkFirstStarts(fail) +
    (await checkSheets(fail)) +
    (await checkNames(fail)) +
    (await checkColdLinks(fail));
  if (known) checked += await checkKnown(fail);
  if (andCrawl) checked += await crawl(fail);
  if (clickAll) checked += await crawl(fail, clickEverything(fail), clickFrom);
  if (hovers) checked += await crawl(fail, hoverGreyed(fail));
  if (actions) checked += await fuzz(fail, actions, seed, cold);
  if (colours) checked += await coloursOffered(fail);
  if (battles) checked += await battlesFair(fail);
  if (parts) checked += await partsEqual(fail);
  if (andDeep) checked += await deep(fail, from, only);
  return { ok: !failures.length, failures, checked };
};
