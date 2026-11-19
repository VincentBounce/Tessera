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
  - Round the tube, the half turn: it lays the tiling on itself when half the rows are a whole period across: an even
    count of rows (Pent 15, Tetrakis), a multiple of 4 (Rhombille, Kite, Trihex, Dual 314). A row or two more lets it in.
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

## One rule for the code (to decide)

One source for the walks and Life alike: **a volume's team counts are the orders of its symmetry groups** (a solid's
turns, with its mirrors where its tiling has them; a ring's shifts, its length and rows stretched for them; a sphere's
turns round its axis and its half turn), and **a count's parts are the nearest-image regions of a point's orbit under its
group**, its point picked so they are gathered, and a ring's length made so its blocks are square (the spec above, kept
whole). It would replace `solidCounts` and its colourings, `teamsFairOwn`'s cases, `rosetteParts`' lunes and the Klein
bottle's slices along only.
