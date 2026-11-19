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
  - So **the 12 odd bottles take 2, 3, 5, 6, 7, 9, 10** (an odd K along, twice one with the half turn), never 4, 8 or
    12; **the 41 others every K**.
  - With the half turn, a part is K / 2 slices along by 2 round the tube: its length made for K / 2 square blocks of half
    the tube (as `ringLength`'s), gathered as a torus's are, not K long slices. Today Duel, Sextet and Decet are greyed on the 12: the half turn round the tube is
    the walks' Duel already (`ringGroup`), never Life's.

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
