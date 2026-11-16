// The Explore grids whose cells go in 3 colours, found soon by the search (see TILES_IN_THREE and paletteColours in
// main.js): in the page's console, after loading this file,
//   tilesSearch()  → the table, as main.js has it (each variant's grids that do, by their cells' count)
// Every Explore variant, every size its Size offers (a surface's sizes, the plane's sides), built as the app builds it;
// its cells side by side coloured in 3 by the search, given STEPS steps a cell at most: those it colours within them are
// listed (soon: as many steps as a few a cell, whatever its size).
// A grid that needs 4 (a Hexa rosette of 5, the colours turning round its middle) or that the search would take too long
// on is left out: DSatur's there.
const STEPS = 4;
window.tilesSearch = async (only = null) => {
  const built = (w, old) => walk.life && walk.variant === w && walk.life !== old; // (a new one: its own grid)
  const wait = async (w, old = null) => {
    for (let i = 0; i < 600 && !built(w, old); i++) await new Promise((r) => setTimeout(r, 50));
    return built(w, old);
  };
  const table = {},
    ws = Object.keys(VARIANTS).filter((w) => VARIANTS[w].explore && (!only || only.includes(w)));
  exploreLook.rule = 'tiles';
  for (const w of ws) {
    $('variant').value = w;
    $('variant').dispatchEvent(new Event('change'));
    if (!(await wait(w))) {
      console.log(w, 'not built');
      continue;
    }
    const v = VARIANTS[w],
      sizes = v.plane
        ? planeSides(planeKind(v.plane)).map((f) => () => (picked = planeCells(f)))
        : [...$('gridSizeField').options].map((o) => () => {
            $('gridSizeField').value = o.value;
            $('gridSizeField').dispatchEvent(new Event('change'));
          });
    for (const size of sizes) {
      const before = walk.life;
      size();
      if (v.plane) compute();
      if (!(await wait(w, before))) continue;
      const L = walk.life,
        n = L.seed.length,
        side = sideOf(L.nbr),
        bySide = (t, put) => {
          for (let q = L.nbr.start[t]; q < L.nbr.start[t + 1]; q++) if (side[q]) put(L.nbr.list[q]);
        };
      const colours = paletteColours(n, bySide, 3, STEPS * n); // (past 3 when 3 cannot do: none of ours)
      if (colours && colours.every((k) => k <= 3)) (table[w] ??= []).includes(n) || table[w].push(n);
    }
    console.log(w, table[w]?.length ?? 0, 'of', sizes.length);
  }
  const text = `const TILES_IN_THREE = {\n${Object.entries(table)
    .map(([w, ns]) => `  ${w}: [${ns.sort((a, b) => a - b).join(', ')}],`)
    .join('\n')}\n};`;
  console.log(text);
  return text;
};
