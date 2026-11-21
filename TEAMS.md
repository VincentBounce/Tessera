# Teams on the volumes

Which counts of colours (Life's teams) each 3D volume can take with its parts alike, found again from the base: the volumes'
symmetries, measured on their meshes (2026-11-19, v0.5.401). Research only: no code changed yet.

<p align="center"><br>* * *</p>

## The spec the code already holds

Every rule below binds the new one as much as its parts alike:

- **The counts:** 1 to 10, and 12 (`TEAM_COUNTS`): no 11.
- **The states:** K × (the rule's states − 1) at most 255 (`teamsStatesFit`); a reversible rule (Margolus) in Trio only
  (`ringColours`).
- **A colour's block square, never stretched** (`ringLength`): every ring's length is the one that makes each colour's
  block as long round as across, when that is 20 % shorter to 60 % longer than its usual, else its usual; then a whole
  count of its tiling's copies, as its twist allows.
  - Torus: blocks a × b as square as can be on the torus as seen (12: 6 × 2, not 4 × 3), b dividing its rows first
    (`torusBlocks`).
  - Möbius strip: its K stretches of its loop (2L) each W long (`stripSteps`); its width `MOBIUS_WIDTH` = 1.05 ≈ 4π / 12,
    so that Dozen's 12 stretches are square unstretched; a reversible rule's length even.
  - Klein bottle: its K slices along, each square (`kleinLength`).
- **Globe:** each band a multiple of K, at least K × ⌈12 / K⌉ columns, no cell narrower than 1 / √2 of its height
  (`globeBands`).
- **Size:** the nearest that fits a battle, f, f − 1 or f + 1 (`walkersSize`); a closed solid's never changed for it.
- **Plane:** K divides its grid's turns n, or K = 2n where it mirrors; a torus's blocks `TEAM_GRID`; walls, 2 and 4 in
  blocks (`widthForColours`); a grid with no turn (hat, spectre, pinwheel) in slices of as many cells; 8, 10, 12 from their
  halves and 9 from 3 on a grid that repeats only (`teamsFair`).

So the new rule's parts are **gathered, never long**: a ring's blocks square by its length, a solid's orbit point picked so
its parts are round (not lunes; to check on each solid), a sphere's lunes out (see below).

<p align="center"><br>* * *</p>

## The rule

**K colours have parts alike when a group of K symmetries of the volume carries each part onto another.** A symmetry is a
map of the cells onto the cells that keeps who neighbours whom (a turn in space, a shift along a ring, a mirror where the
tiling has one). A cell a symmetry leaves where it is (on its axis, on its mirror) can be in no part alone: it is no one's,
as the globe's poles are today.

**One construction gives the parts, on every volume:** a point anywhere, its K images by the group, each cell to the nearest
image. The group carries image onto image, so it carries part onto part: the parts are alike by construction, never
balanced afterwards. Measured on the meshes:

| volume | K | cells | each part | no one's |
|---|---|---|---|---|
| Tetra | 12 | 576 | 48 | 0 |
| Tetra | 2 | 576 | 288 | 0 |
| Dodeca | 5 | 960 | 192 | 0 |
| Dodeca | 10 | 960 | 96 | 0 |
| Icosa | 5 | 500 | 100 | 0 |
| RhDode | 2, 3, 4, 8 | 432 | 216, 144, 108, 54 | 0 |
| Cube | 8 | 864 | 108 | 0 |
| Penrose sphere | 5 | 210 | 42 | 0 |
| Hexsphere | 5 | 642 | 128 | 2 (on its axis) |

**What may be stretched to let a count in:** a ring's length, a ring's rows round its tube, a globe's bands (by a row or
two). Never a closed solid's size (its faces' subdivision): its counts are its group's.

<p align="center"><br>* * *</p>

## Closed solids

**K is the order of a group of the solid's turns that keep its tiling** (with its mirrors too where the tiling is not
chiral: then the cells on a mirror are no one's).

| family | turns | K up to 12 by turns | with mirrors (tiling not chiral) |
|---|---|---|---|
| Tetra | 12 | 2, 3, 4, 12 | + 6, 8 |
| Cube, Octa, RhDode, Stella, Cubocta… | 24 | 2, 3, 4, 6, 8, 12 | (the same up to 12) |
| Dodeca, Icosa, RhTria, Hexsphere… | 60 | 2, 3, 4, 5, 6, 10, 12 | + 8 |
| Penrose, Kites & darts spheres (chiral) | 60 | 2, 3, 4, 5, 6, 10, 12 | none: no mirror keeps them |

**Two functions, one rule** (2026-11-20): K alike things are |G| / |H|, G a group of the solid's symmetries and H the
part's own. Life's colours (`solidCounts`, `colourGroups`): G its turns and mirrors, H any (a part a region). A battle's
walkers (`solidTeamCounts`, `rotationGroups`): a walker a point, H the identity alone, G turns only (a mirror turns a
walker's tiles the other way). Kept apart, each its own conditions.

The walks already judge their battles this way (`solidTeamCounts`, the groups of turns); Life does not (`solidCounts`, its
faces' colourings), and the two disagree on 30 solids of 38:

- **Life greys counts the solid allows:**
  [Tetra in 12](http://localhost:8321/#mode=life&shape=tetrahedron&tiling=triangles&teams=12),
  [Dodeca in 5](http://localhost:8321/#mode=life&shape=dodecahedron&tiling=triangles&teams=5) (and 10),
  [RhDode in 2](http://localhost:8321/#mode=life&shape=rhombicDodecahedron&tiling=squares&teams=2) (and 3, 4, 8: Life
  offers it 6 and 12 only).
- **Life offers counts whose parts are not alike:**
  [Penrose sphere in 8](http://localhost:8321/#mode=life&shape=dodecahedron&tiling=penrose&teams=8) (chiral: no mirror,
  its 8 parts 24 to 27 cells), Kites & darts sphere in 8, the Square pyramid in 5 (its turns: 4); and the 38 unequal parts
  of the night of 2026-11-18 (Icosa Hex in 2: 2,761 to 3,001 cells), its parts drawn from colourings, not from a group.
- [Icosa in 8](http://localhost:8321/#mode=life&shape=icosahedron&tiling=triangles&teams=8) is right, but only with mirrors:
  three half turns and the turn through its centre, 55 cells a part, 60 of 500 on the mirrors no one's.

**Which parts: whole faces first** (decided 2026-11-20, v0.5.454). Where a count lets each part be whole faces (its
spots the faces' middles), that colouring is kept before any other, then the fewest cells no one's, faces cut, pieces
(see `colouring`). A solid's parts then the same on every tiling: the
[tetrahedron of triangles](http://localhost:8321/#mode=life&shape=tetrahedron&tiling=triangles&teams=4) and the
[tetrahedron of hexagons](http://localhost:8321/#mode=life&shape=tetrahedron&tiling=hex&gridSize=48&teams=4) in 4,
each a face (the hexagons' before: its corners, 6 cells no one's against its faces' 70). Its price: on a solid of
hexagons, kites or rhombi, the cells folded over an edge are as near both faces, no one's, a seam a cell wide between
its parts (45 colourings of 213 changed, all their parts still alike; the Kites & darts sphere in 3 alike since, 21 / 18
before).

<p align="center"><br>* * *</p>

## Rings: torus, Möbius strip, Klein bottle

**K is a product of shifts of the tiling's lattice:** along the ring by L / K (its length stretched to whole copies of the
tiling, as `ringColours` makes it today) and round its tube by a whole period across (its rows stretched to a multiple).

- **Torus:** any K, blocks a × b (along × round).
- **Möbius strip:** any K, stretches of its double loop, 2L / K whole copies.
- **Klein bottle:** along by any count its twist allows, round its tube by its **half turn only** (a quarter turn round
  it is not a symmetry: the bottle's turning over makes it three quarters). So **K = along × 1 or 2.**
  - Along, measured on the 53 bottles, stretching their length freely: **41 take every K offered; 12 take the odd K
    only** (3, 5, 7, 9), their twist asking an odd length: Pent 9, 11, 13, 15 (turned or not), Kischecker, Snubsquare,
    Trihex and Dual 16 (not turned).
  - Round the tube, the half turn: a shift by half the tube (v → v + nv / 2), the only shift round it the gluing keeps
    (turned over, a shift by s comes back as −s: s = −s, so 0 or nv / 2). It is the torus's blocks round the tube, b = 2.
  - **One condition for every size changed: a shift is a symmetry only as whole copies of the tiling.** Along, each
    slice whole copies (`ringLength` makes the length so, as the twist allows: the 12 odd bottles' twist asks an odd
    count, which no stretch makes even). Round the tube, nv / 2 a whole period across: an even count of rows where the
    period is one row (Pent 15, Tetrakis), a multiple of 4 where it is two (Rhombille, Kite, Trihex, Dual 314); the
    rows then the nearest that are (f, f ± 1, f ± 2), as `walkersSize` picks a battle's. Parity is never asked for
    itself: it follows from the copies.
    On [Klein Type 15 at 64](http://localhost:8321/#mode=life&shape=kleinBottle&tiling=type15&gridSize=64&teams=2): two
    halves, top and bottom, of 17,856 cells each, the half turn carrying every cell of one onto the other.
  - **The walks take the half turn only, rightly:** a walker turns by its tiles' order, and a shift along carries the
    tiles past the seam turned over (`placeMap` refuses it, measured: Triangles and Squares bottles, a shift of one copy,
    a half or a third of the length all refused, the half turn kept): a walker there would walk as A's mirror. Life's
    cells have no order (a rule counts its neighbours, its letters mirrored alike), so Life takes the shifts along too.
    The walks' groups keep the tiles' order (turns), Life's keep only who neighbours whom (turns and mirrors): one rule,
    each its own kind of symmetry.
  - So **the 12 odd bottles take 2, 3, 5, 6, 7, 9, 10** (an odd K along, twice one with the half turn), never 4, 8 or
    12; **the 41 others every K**.
  - With the half turn, a part is K / 2 slices along by 2 round the tube: its length made for K / 2 square blocks of half
    the tube (as `ringLength`'s), gathered as a torus's are, not K long slices. Since v0.5.406 Life takes them on the 12
    too. Their Duel (K = 2, one slice along) is two halves round the tube, each the bottle's whole length, about 5 times
    longer than wide: squaring them would ask a bottle 5 times shorter, past the length's stretch. **Kept so, an
    exception to the square blocks** (decided 2026-11-20).

<p align="center"><br>* * *</p>

## Globe and rosette spheres

- **Globe:** turns round its axis, each band a multiple of K (stretched so, as today): any K, its two caps no one's.
- **Rosette spheres** (a disc of n petals on each half): turns round the axis by a divisor of n, and the half turn about
  the equator swapping the two discs: **K divides n, or twice a divisor** (Flower 6: 2, 3, 6 measured, and 4, 12 with the half turn, to measure). Today every K is
  offered by lunes dealt out as many cells each:
  [Flower 6 sphere in 5](http://localhost:8321/#mode=life&shape=rosettes&tiling=flower6&teams=5), lunes of 93 and 94
  cells, alike in number only, and long: Dozen's 12 lunes, pole to pole, are thin as threads.

<p align="center"><br>* * *</p>

## Life 2D: the plane

The same rule, the plane's groups:

- **A torus** (a grid that repeats, its walls off): its shifts. A group of K shifts is a lattice of index K in the
  tiling's, so **any K**, its side a multiple made for it (as `widthForColours` does).
- **A walled figure** (a rectangle, a six-fold grid's hexagon, a disc that never repeats, a rosette): its turns and
  mirrors round its middle, C_n or D_n. The grids that repeat have n = 1, 2, 3, 4 or 6; the discs have 5 (Penrose,
  Kites & darts), 8 (Ammann), 12 and 14 (Rhombs), and the rosettes their n. **K = d or, where the figure mirrors, 2d,
  for d dividing n.** The cell on the middle, and the cells on a mirror between two parts, are no one's.
- **A rectangle keeps D2 only** (its half turn and its two mirrors, where the grid has them), whatever its grid's turns.
  A square of squares keeps D4.

Today (`teamsFairOwn`, `teamsFair`, `planeSlices`, `TEAM_GRID`): on a torus, blocks `TEAM_GRID` (cols × rows); with walls,
halves and quarters in blocks (2 and 4), else slices round the middle, K dividing the grid's n or K = 2n where it
mirrors, then 8, 10 and 12 from their halves. Measured in the app (2026-11-19, v0.5.403):

- **Torus, blocks stretched.** `TEAM_GRID` sets 2, 3, 5 and 7 as 1 row, 10 as 5 × 2:
  [Squares in 7](http://localhost:8321/#mode=life&shape=squares&teams=7) are 7 strips of 49 × 7 cells (343 each), 7 times
  as long as wide. Alike, but against the square blocks. A lattice of index K gives gathered parts for every K
  (5 on squares by (2, 1) and (−1, 2), tilted squares; 3 on hexagons by the √3 lattice, hexagons), its side a multiple
  of K.
- **Offered, not alike:**
  - [Hexagons in a rectangle, Trio](http://localhost:8321/#mode=life&shape=hex&gridWalls=1&gridOutline=square&teams=3),
    3 slices of 780 cells (Sextet too): the rectangle has no third turn, so they are alike in number only.
  - [Florets walled, Dozen](http://localhost:8321/#mode=life&shape=florets&gridWalls=1&teams=12), 12 slices of 135
    cells, and Snub tri, Twist tri and Demi 20 the same: chiral, no mirror, so no group of 12; 12 comes from 6 by the
    halving of `teamsFair`, each half the mirror of the next.
  - [Pythagoras walled, Octet](http://localhost:8321/#mode=life&shape=pythagoras&gridWalls=1&teams=8), 281 to 282 cells,
    and Snub square and Dual 16 the same: chiral, C4, 8 from 4 by that halving.
  - [Hats in 5](http://localhost:8321/#mode=life&shape=hats&teams=5) (370 and 369 cells), and every K on Spectre,
    Pinwheel and Tübingen: no turn at all, so Solo only by the rule; dealt out as many cells. **Kept as the one admitted
    exception** (decided 2026-11-19): a grid with no turn takes any K, its parts slices of as many cells round its
    middle.
- **Greyed, though possible** (2d by a mirror, d < n):
  - [Hexagon walled, Quartet](http://localhost:8321/#mode=life&shape=hex&gridWalls=1&teams=4): D2, two mirrors
    across the middle, a quarter between them (the six-fold mirrored grids alike).
  - [Penrose, Duel](http://localhost:8321/#mode=life&shape=penrose&teams=2) (and Kites & darts): one mirror, its two
    halves.
  - [Rhombs 12, Octet](http://localhost:8321/#mode=life&shape=rhombs12&teams=8): D4 in its D12.
- **Never possible on a walled grid that repeats: 9** (no turn of order 9 nor 3 × 3): never offered there, right.

The parts of a walled figure are slices from the middle to the wall: the gathered shape for its turns. Dozen's are long,
30° each, as any group of 12 turns makes them.

<p align="center"><br>* * *</p>

## One rule for the code (to decide)

One source for the walks and Life alike: **a volume's team counts are the orders of its symmetry groups** (a solid's
turns, with its mirrors where its tiling has them; a ring's shifts, its length and rows stretched for them; a sphere's
turns round its axis and its half turn; a flat torus's lattices of index K; a walled figure's C_n and D_n round its
middle), and **a count's parts are the nearest-image regions of a point's orbit under its
group**, its point picked so they are gathered, and a ring's length made so its blocks are square (the spec above, kept
whole). It would replace `solidCounts` and its colourings, `teamsFairOwn`'s cases, `rosetteParts`' lunes and the Klein
bottle's slices along only.

<p align="center"><br>* * *</p>

## The plan (the user's spec, 2026-11-19)

**The rule, widened (measured on the dodecahedron):** K colours have parts alike when a group of symmetries carries
any part onto any other; the group may be larger than K, a part kept by some of its symmetries (K = the group's order /
a part's own: an opposite pair of the dodecahedron's faces is kept by 10 of its 60 turns, so 6 colours). Its 12 faces in
6 pairs:

| a colour's two faces | pairings | of them alike | the most symmetric kept by |
|---|---|---|---|
| side by side | 125, 5 up to symmetry | 3 | 12 turns |
| apart (2 faces away) | 125, 5 up to symmetry | 3 | 12 turns |
| opposite | 1 | 1 | all 60 turns |

What is to come, each its own delivery, **one construction for 2D and 3D alike**: a figure (a solid, a ring, a
sphere, a flat torus, a walled figure on the plane) has its group; a colour's part is one piece or several, the group
carrying any part onto any other; a start (a seed, Famous, Wild) is laid on a part and, where it has several pieces, on
each.

1. **A colour's pieces: Together · Apart · Opposite**, one choice among three (a tab group, in Teams), wherever a colour
   has several pieces: a solid's faces; a flat torus's blocks (Apart: a colour's blocks as a checkerboard's, Together:
   in one block); a walled figure's slices (Apart: every other slice, Opposite: a slice and the one across the middle,
   its half turn). Together: one piece; Apart: none touching another of its own, as far apart as can be; Opposite:
   carried onto each other by the half turn through the middle (a solid's centre, a walled figure's middle, a ring's
   half shift). For each, the partition alike that the most symmetries keep, made from the group (no table by hand:
   `FACE_GROUPS` and `tools/faceparts.js` replaced); greyed where none, with its reason (a colour of one piece, the
   tetrahedron's Opposite).
2. **A Duel cut either way:** on a sphere in lunes (the globe, the rosette spheres), Up / Down by its equator besides its
   lunes; on the plane, a walled figure's halves, left and right or up and down, where both are alike. The same choice:
   the two subgroups of order 2 that the figure has.
3. **Seeds: one tile, its diameter a slider** (2, 3, …), on the plane and the surfaces alike (the zones are one code
   already), the eight tiles Spark to Jungle replaced (their link words zone1 to zone8 to ask before changing).
4. **Mirror, a switch** over any start (a seed, Famous, Wild), 2D and 3D: each colour's start laid on one piece and
   carried by the group onto its others (on Opposite, mirrored on the one across); greyed where a colour has one piece.
   The zone Opposite goes (today a solid's only: greyed on the plane and the tori).
5. **Famous: the switch Mirror and the pieces' choice (1) alike**, each colour's pattern on each of its pieces, on the
   plane as on a solid.
6. **Seeds and Wild: one count for every fighter**, drawn at random once: each colour exactly as many live cells, laid
   at random in its part, 2D and 3D.

And the counts' fixes found above: Life's solids by their groups (`solidCounts` replaced, the walks' already right),
the flat torus's lattices of index K, a walled figure's greyed and missing counts, the rosette spheres' counts, a Klein
bottle's rows made for its half turn.

**Done:** one count for every fighter (v0.5.410); Life's solids by their groups of turns (v0.5.411: `colouring` made from
G and H, the hand tables `FACE_GROUPS`, `SPOT_PAIRS`, `SOLID_SPOTS` and `tools/faceparts.js` gone; every count of the 33
solids measured alike). Their mirrors too (v0.5.412, `surfaceSymmetries`: a mirror between two corners, or the centre's inversion, then the
turns after it; Life only, the walks' turns alone): Tetra, Icosa and Dodeca in 8, the Pyramid in 8. The flat torus by a
lattice of index K (v0.5.413, `torusLattice`); the walled figures by C_n and D_n (v0.5.414, `wallTurns`; Penrose's and
Kites & darts' discs measured not quite mirrored: no 2, no 10); the rosette spheres by their turns and halves (v0.5.415,
`rosetteHalves`). The hull solids' parts their colourings' whole (v0.5.520: a colour's two opposite faces both, its part
two pieces, as the rule has it; its first face only before, Formula's parts 25 to 63 cells on the rhombic dodecahedron in
6). Left: a Klein bottle's least sizes, whose rows do not take its half turn (greyed there, as a count is at a size).

The plan's items, done: 3, Seed one tile, its radius a slider (v0.5.417, `pop=seed4`); 4, Opposite a tab of Symmetry on a
solid, over any start (v0.5.418: the plane's Symmetry row's, rather than a switch of its own; the zone Opposite gone), then
a start's place (v0.5.522–527: Symmetry the plane's grids' only; on a solid, every start's place one choice of four,
**Side by side · Face to face · Doubled · Whole part**, the link's startPlace 0 to 3: each colour's spot, alike by a group
of K of its colours' own (`fairSpots`), side by side (no two across the centre: the cube in 3 a corner) or face to face
(each across the centre from another colour's: the cube in 2, ±z; in 4, ±y ±z; never an odd count); Doubled any start
copied through the centre; Whole part the starts that fill a part, Wild and Formula, laid on their first copies only. The
one in effect the one picked where allowed, else the first allowed); 5,
Famous with it (v0.5.419); 2, a Duel cut Up / Down or Left / Right (v0.5.420, `duelCut`); 1, a colour's pieces Together or
Apart (v0.5.421, `teamsApart`: a solid's colouring apart, a flat torus's 2K blocks; Opposite is Symmetry's, not a third tab).
A walled figure's slices apart are left: a colour's two slices would be its opposite ones (Opposite on the plane, Half
turn).

<p align="center"><br>* * *</p>

## Placements: each start on each figure

Each cell names the code that places it (v0.5.422), for 1 colour, a Duel (2), and 3 to 12. Two steps everywhere: the
**parts** (each colour's cells: `partPlaces`, by figure) and the **spots** (each colour's middle: `middleCells` by
`patternFrame`'s centre); a start then fills a part (Wild, Formula, Anywhere) or lays at a spot (Seed, Icon, Famous).
Wild and Seed give every colour as many live cells (`soupInParts`); Symmetry copies any start (`symmetricStart`: the
plane's turns and mirrors, a solid's Opposite).

**Parts, by figure** (what Wild, Formula and Anywhere fill):

| figure | 1 | 2 (Duel) | 3 to 12 |
|---|---|---|---|
| Life › 2D squares › any repeating tile (Squares, Triangles…) › Square or Rhombus (a torus) | whole grid | `torusLattice` (Apart: `spread`) | `torusLattice` (Apart: `spread`) |
| Life › 2D squares › any repeating tile › Walls (a rectangle walled; R. walls: a rhombus, its half turn only) | whole grid | `planeFrame.block`, `teamGrid`: Up / Down 1 × 2, Left / Right 2 × 1 | 4: blocks 2 × 2; 8 on squares: `planeSlices` as many cells; 3, 6, 12 greyed (`wallTurns`) |
| Life › 2D squares › Rectangle torus · Walled hexagon › Triangles, Hexagons… › Hex | whole grid | `planeSlices` rings (Left / Right: upright, by angles) | `planeSlices`: rings for 3, 6, 12; angles for 4 (its mirrors' cells no one's) |
| Life › 2D circles › Never repeating, Flowers, Mirrors, Hexas, Rings › Penrose, Hats, Flower 6… | whole disc | `planeSlices` from a corner (`CORNER_DISCS`) | `planeSlices` by angles; no turn (Hats, Spectre…): as many cells each |
| Life › 3D solids › Regular polyhedra (Tetra, Cube, Octa, Dode sph, Ico sph, Stella) and Sponge, Frame, Pits, Bumps › its tiles | whole solid | `colouring` → `spotColours` | `colouring` (G, H, a point), Opposite: its mirror, Apart: its pieces apart |
| Life › 3D solids › RhDode, RhTria, Pyramid, Cubocta, Bicupola, Rhombi (hull solids) | whole solid | `hullColourings` where it has K, else `colouring` | the same |
| Life › 3D solids › Surfaces › Torus, Klein › its tiles | whole | `torusBlocks` (Klein: `kleinLength`'s blocks, its half turn) | the same |
| Life › 3D solids › Surfaces › Möbius › its tiles | whole | stretches 2L / K along its loop (`partPlaces`) | the same |
| Life › 3D solids › Surfaces › Globe | whole, its caps | hemispheres (Left / Right: two lunes) | lunes between meridians, its caps no one's |
| Life › 3D solids › Surfaces › Rosettes › Flower 6, Mirror 5… | whole | its two discs (`poleColours`; Left / Right: two lunes) | `rosetteParts`: lunes, or halves × lunes (`rosetteHalves`) |

**Spots, by figure** (where Seed, Icon and Famous lay, each colour's: `patternFrame(i, K).centre`):

| figure | 1 | 2 to 12 |
|---|---|---|
| 2D squares › a tile › Square or Rhombus | the grid's middle | `planeFrame.lattice(K).middles` |
| 2D squares › a tile › Walls or R. walls | the grid's middle | `planeFrame.middle` (its blocks') or `planeSlices` spots |
| 2D squares › … › Hex; 2D circles › a tile | its centre of turns | `planeSlices(K).spots` |
| 3D solids › a solid (Regular, Irregular polyhedra) | the face in front (`frontCell`) | `patchSpots` (the colouring's patch items), a face's middle where they are |
| 3D solids › Surfaces › Torus, Klein, Möbius | the sheet's middle | its blocks' or stretches' middles (`middleCells`) |
| 3D solids › Surfaces › Globe | — | — (no frame to lay on: Seed, Icon, Famous greyed) |
| 3D solids › Surfaces › Rosettes | its pole | its lune's middle (`lune`), a disc's pole in a Duel |

**Starts, by how they use them:**

| start | 1 | 2 to 12 |
|---|---|---|
| Wild | a soup over all (`soupState`) | each part a soup, one count for all (`soupInParts`); on a solid, Wild › Face: each colour's face only (`faceParts`) |
| Seed | `lifePatch(r)` at the spot, radius `plane.seedRadius` | the same at each colour's spot, one count for all; near rules (`NEAR_RULES`): patches touching round the middle |
| Icon, Punk, Emoji | `iconLay` at the spot | `iconLay` at each colour's spot |
| Famous | `laidChoices` at the spot (discs: `centredChoices`) | the same at each colour's spot |
| Anywhere | `laidChoices` anywhere | each colour's pattern anywhere in its part |
| Formula | `numberSeed`: the digits a cell in turn (`digitsOn`) | the same, each live cell its part's colour (`paintOwn`) |

**In the code, as a table? Recommended.** The parts and the spots are each a chain of branches by figure today
(`partPlaces`: plane, Möbius, torus, globe, rosette, hull, solid; `patternFrame`'s centre, `middleCells`), and each memo
keys itself by hand (`partMemo`, `choicesMemo`, `middleMemo`, `iconMemo`: Symmetry, Apart and a Duel's cut each added
where they were met, `iconMemo` still without them). One table, a figure a row, `{ parts(K), spot(i, K) }`, picked once by
the figure built, and one key of what a placement depends on (its figure, K, Symmetry, Apart, the Duel's cut) would make
each start figure-blind (Wild: the parts and a soup; Seed: a patch at the spot) and each cell above one entry to read or to
change. About 2 to 3 hours, the checks after; nothing would look different.
