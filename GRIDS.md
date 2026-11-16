# Grids and modes

A grid on its own, a mode a way of going on it: the plan, and its step 0, the inventory of the variants as they are
(v0.5.72, measured in the page from `VARIANTS` and `NAV`).

<p align="center"><br>* * *</p>

## The plan

- **`GRIDS`**: one entry a grid: its geometry (a plane, a surface, a 3D lattice), its sizes, its family, its menu's
  names, what it offers (edges, cells and their neighbours, blocks).
- **`MODES`**: one entry a mode, what it asks of a grid: a walk along the edges, edges; a walk on cells, an ant, Life,
  cells and their neighbours; Rewind, blocks; Replicators, squares the same way round; Elementary, the squares; Explore,
  nothing.
- **`modeGoes(mode, grid)`**: a mode goes on a grid that offers what it asks; the variants, the menu (`NAV`), the
  families (`FAMILIES`) and the page's options all made from it, no list a mode.
- **Links unchanged**: their words (`mode`, `shape`, `tiling`, `walkKind`, `on`) already say a grid and a mode apart,
  the variants' keys already made from them (`variantName`): the Gallery and its files as they are.

Steps, each shipped and checked on its own:

0. **Inventory** (this file).
1. **`GRIDS`** drawn from the variants as they are; the variants' fingerprint the same.
2. **`MODES` and `modeGoes`**; the 584 pairs it gives against today's, each difference decided (see below).
3. **Everything made from them**: the 16 places that make variants and the page's 174 options gone; the fingerprint
   the same.
4. **One flag, one meaning**: `life` means "plays Life"; Explore no longer carries it, its "but Explore" gone
   (`plays` in `sectionsOf`, the hunt's stop, the wall, the Outline, `startLife`'s Explore branch).
5. **A night**: `tesseraCheck()`, the Gallery's cards opened cold, the fuzz.

<p align="center"><br>* * *</p>

## What the variants hold

- **584 variants** on **237 grids**: Life 229, Explore 229, Walk 65, Ant 36, Rewind 16, Replicators 8, Elementary 1;
  234 grids declared in more than one mode.
- **Every field is the grid's or the mode's, none mixed**: on each grid, each field the same in all its modes (the
  grid's), or the same for each mode and its own choices (Turtle or Spiral, Edges or Cells) there (the mode's).
  - The grid's: `lattice`, `surface`, `plane`.
  - The mode's (on so many grids where its modes differ): `explore` (229), `where` (44), `net` (33), `rule` (33),
    `arrows` (33), `cells` (32), `antOf` (31), `fill` (30), `base` (28), `twin` (27), `tail` (27), `life` (27),
    `edges` (22), `turns` (22), `margolus` (16), `blocks` (11), `initial` (9), `loops` (8), `ant` (6), `worm` (5),
    `skipZeros` (4), `north` (2), `lines`, `shape`, `elementary` (1).
- **`lattice` on the infinite plane is the side's, not the grid's**: a walk along a hexagon grid's edges goes on the
  triangle lattice (`walkHexTurtleEdges`: `tri`), on its cells on the hexagon one (`walkHexTurtleCells`: `hex`); so the
  6 grids "2D" it makes are 4 (Squares, Cairo, Hexagons, Triangles), the lattice walked made from the grid and the side.

<p align="center"><br>* * *</p>

## Where each mode goes

| Mode | Grids | Its rule today |
|---|---|---|
| Explore | 229 | Life's, every one (copied) |
| Life | 229 | every grid of cells |
| Walk | 35 | 8 of its own (2D infinite, 3D lattices), 27 surfaces by hand |
| Ant | 32 | the walk's grids on cells (`antOf`): already a rule |
| Rewind | 16 | the grids with blocks (`REVERSIBLE_SHEETS`, the plane's 5) |
| Replicators | 8 | squares the same way round, by hand |
| Elementary | 1 | the plane of squares |

Grids found by one mode only: Walk's 2D infinite (4) and its 3D lattices, [Cubes](http://localhost:8321/#mode=walk&shape=cubes&walkKind=turtle&on=edges) and
[Diamond](http://localhost:8321/#mode=walk&shape=diamond&walkKind=polymer&on=edges); Life's 2D squares and 2D circles
(none walked).

<p align="center"><br>* * *</p>

## To decide: the walk's surfaces

The walk goes on 27 surfaces: [Torus · Squares](http://localhost:8321/#mode=walk&shape=torus&tiling=squares&walkKind=turtle&on=edges), [Torus · Hexagons](http://localhost:8321/#mode=walk&shape=torus&tiling=hex&walkKind=turtle&on=edges), [Torus · Triangles](http://localhost:8321/#mode=walk&shape=torus&tiling=triangles&walkKind=turtle&on=edges), [Torus · Cairo](http://localhost:8321/#mode=walk&shape=torus&tiling=cairo&walkKind=turtle&on=cells), [Möbius strip · Squares](http://localhost:8321/#mode=walk&shape=mobiusStrip&tiling=squares&walkKind=turtle&on=edges), [Möbius strip · Hexagons](http://localhost:8321/#mode=walk&shape=mobiusStrip&tiling=hex&walkKind=turtle&on=edges), [Möbius strip · Triangles](http://localhost:8321/#mode=walk&shape=mobiusStrip&tiling=triangles&walkKind=turtle&on=edges), [Möbius strip · Cairo](http://localhost:8321/#mode=walk&shape=mobiusStrip&tiling=cairo&walkKind=turtle&on=cells), [Klein bottle · Squares](http://localhost:8321/#mode=walk&shape=kleinBottle&tiling=squares&walkKind=turtle&on=cells), [Klein bottle · Hexagons](http://localhost:8321/#mode=walk&shape=kleinBottle&tiling=hex&walkKind=turtle&on=cells), [Klein bottle · Triangles](http://localhost:8321/#mode=walk&shape=kleinBottle&tiling=triangles&walkKind=turtle&on=cells), [Klein bottle · Cairo](http://localhost:8321/#mode=walk&shape=kleinBottle&tiling=cairo&walkKind=turtle&on=cells), [Tetrahedron · Triangles](http://localhost:8321/#mode=walk&shape=tetrahedron&tiling=triangles&walkKind=turtle&on=edges), [Tetrahedron · Hexagons](http://localhost:8321/#mode=walk&shape=tetrahedron&tiling=hex&walkKind=turtle&on=edges), [Cube · Squares](http://localhost:8321/#mode=walk&shape=cube&tiling=squares&walkKind=turtle&on=edges), [Octahedron · Triangles](http://localhost:8321/#mode=walk&shape=octahedron&tiling=triangles&walkKind=turtle&on=edges), [Octahedron · Hexagons](http://localhost:8321/#mode=walk&shape=octahedron&tiling=hex&walkKind=turtle&on=edges), [Dodecahedron · Triangles](http://localhost:8321/#mode=walk&shape=dodecahedron&tiling=triangles&walkKind=turtle&on=edges), [Dodecahedron · Hexagons](http://localhost:8321/#mode=walk&shape=dodecahedron&tiling=hex&walkKind=turtle&on=edges), [Rhombic dodecahedron · Squares](http://localhost:8321/#mode=walk&shape=rhombicDodecahedron&tiling=squares&walkKind=turtle&on=edges), [Rhombic triacontahedron · Squares](http://localhost:8321/#mode=walk&shape=rhombicTriacontahedron&tiling=squares&walkKind=turtle&on=edges), [Sphere · Hexagons](http://localhost:8321/#mode=walk&shape=icosahedron&tiling=hex&walkKind=turtle&on=edges), [Sphere · Triangles](http://localhost:8321/#mode=walk&shape=icosahedron&tiling=triangles&walkKind=turtle&on=edges), [Sphere · Kites](http://localhost:8321/#mode=walk&shape=icosahedron&tiling=kites&walkKind=turtle&on=cells), [Sphere · Penrose](http://localhost:8321/#mode=walk&shape=icosahedron&tiling=penrose&walkKind=turtle&on=cells), [Stella octangula · Triangles](http://localhost:8321/#mode=walk&shape=stellaOctangula&tiling=triangles&walkKind=turtle&on=edges), [Stella octangula · Hexagons](http://localhost:8321/#mode=walk&shape=stellaOctangula&tiling=hex&walkKind=turtle&on=edges).

Its apparent rule: every cell the same polygon (squares, triangles, hexagons with the sphere's pentagons, Cairo's
pentagons). But it has exceptions by hand, the cases to decide (each link: the grid in Explore):

- **Kites**: on the sphere yes, on [the tetrahedron](http://localhost:8321/#mode=explore&shape=tetrahedron&tiling=kites),
  [the octahedron](http://localhost:8321/#mode=explore&shape=octahedron&tiling=kites),
  [the dodecahedron](http://localhost:8321/#mode=explore&shape=dodecahedron&tiling=kites),
  [the stella](http://localhost:8321/#mode=explore&shape=stellaOctangula&tiling=kites) and
  [the torus](http://localhost:8321/#mode=explore&shape=torus&tiling=kites) no.
- **Tetrakis** (triangles all alike): on none, [the cube](http://localhost:8321/#mode=explore&shape=cube&tiling=tetrakis),
  [the torus](http://localhost:8321/#mode=explore&shape=torus&tiling=tetrakis) included.
- **Triangles on the rhombic solids**: [rhombic dodecahedron](http://localhost:8321/#mode=explore&shape=rhombicDodecahedron&tiling=triangles),
  [rhombic triacontahedron](http://localhost:8321/#mode=explore&shape=rhombicTriacontahedron&tiling=triangles) no.
- **Penrose's sphere yes (two rhombi), [Twisted](http://localhost:8321/#mode=explore&shape=icosahedron&tiling=twisted) no.**
- **Walk's sizes at first**: 48 on its surfaces, 32 on the Cairo torus (`initial`), Life's its own: a mode's, the Cairo
  torus's a pair's.

Life's other surfaces, no walk (125):

- **Pits** : [Squares](http://localhost:8321/#mode=explore&shape=cubePits&tiling=squares), [Tetrakis](http://localhost:8321/#mode=explore&shape=cubePits&tiling=tetrakis)
- **Bumps** : [Squares](http://localhost:8321/#mode=explore&shape=cubeBumps&tiling=squares), [Tetrakis](http://localhost:8321/#mode=explore&shape=cubeBumps&tiling=tetrakis)
- **Frame** : [Squares](http://localhost:8321/#mode=explore&shape=cubeFrame&tiling=squares), [Tetrakis](http://localhost:8321/#mode=explore&shape=cubeFrame&tiling=tetrakis)
- **Sponge** : [Squares](http://localhost:8321/#mode=explore&shape=cubeMengerSponge&tiling=squares), [Tetrakis](http://localhost:8321/#mode=explore&shape=cubeMengerSponge&tiling=tetrakis)
- **Johnson and Archimedean solids** : [Square pyramid](http://localhost:8321/#mode=explore&shape=squarePyramid), [Cuboctahedron](http://localhost:8321/#mode=explore&shape=cuboctahedron), [Square orthobicupola](http://localhost:8321/#mode=explore&shape=squareOrthobicupola), [Rhombicuboctahedron](http://localhost:8321/#mode=explore&shape=rhombicuboctahedron)
- **Torus** : [Kites](http://localhost:8321/#mode=explore&shape=torus&tiling=kites), [Rhombille](http://localhost:8321/#mode=explore&shape=torus&tiling=rhombille), [Rhombitri](http://localhost:8321/#mode=explore&shape=torus&tiling=rhombitri), [Florets](http://localhost:8321/#mode=explore&shape=torus&tiling=florets), [Snub](http://localhost:8321/#mode=explore&shape=torus&tiling=snub), [Tetrakis](http://localhost:8321/#mode=explore&shape=torus&tiling=tetrakis), [Pythagoras](http://localhost:8321/#mode=explore&shape=torus&tiling=pythagoras), [Elongated](http://localhost:8321/#mode=explore&shape=torus&tiling=elongated), [Prismatic](http://localhost:8321/#mode=explore&shape=torus&tiling=prismatic), [Kis checker](http://localhost:8321/#mode=explore&shape=torus&tiling=kisChecker), [Kisrhombille](http://localhost:8321/#mode=explore&shape=torus&tiling=kisrhombille), [Type 9](http://localhost:8321/#mode=explore&shape=torus&tiling=type9), [Type 10](http://localhost:8321/#mode=explore&shape=torus&tiling=type10), [Type 11](http://localhost:8321/#mode=explore&shape=torus&tiling=type11), [Type 13](http://localhost:8321/#mode=explore&shape=torus&tiling=type13), [Type 14](http://localhost:8321/#mode=explore&shape=torus&tiling=type14), [Type 15](http://localhost:8321/#mode=explore&shape=torus&tiling=type15), [Trihex](http://localhost:8321/#mode=explore&shape=torus&tiling=trihex), [Twisted](http://localhost:8321/#mode=explore&shape=torus&tiling=twisted), [Octagons](http://localhost:8321/#mode=explore&shape=torus&tiling=octagons), [Snub square](http://localhost:8321/#mode=explore&shape=torus&tiling=snubSquare), [Dodecagons](http://localhost:8321/#mode=explore&shape=torus&tiling=dodecagons), [Big rhombitri](http://localhost:8321/#mode=explore&shape=torus&tiling=bigRhombitri), [Dual 16](http://localhost:8321/#mode=explore&shape=torus&tiling=dual16), [Dual 56](http://localhost:8321/#mode=explore&shape=torus&tiling=dual56), [Dual 314](http://localhost:8321/#mode=explore&shape=torus&tiling=dual314), [Demi 2](http://localhost:8321/#mode=explore&shape=torus&tiling=demi2), [Demi 10](http://localhost:8321/#mode=explore&shape=torus&tiling=demi10), [Demi 13](http://localhost:8321/#mode=explore&shape=torus&tiling=demi13), [Demi 20](http://localhost:8321/#mode=explore&shape=torus&tiling=demi20)
- **Möbius strip** and **Klein bottle** : the torus's tilings (but Florets, Snub, Pythagoras, Type 14, Twisted, Demi 20), e.g. [Möbius · Rhombitri](http://localhost:8321/#mode=explore&shape=mobiusStrip&tiling=rhombitri), [Klein · Octagons](http://localhost:8321/#mode=explore&shape=kleinBottle&tiling=octagons)
- **The polyhedra's other tiles** : Kites on [the tetrahedron](http://localhost:8321/#mode=explore&shape=tetrahedron&tiling=kites), [the octahedron](http://localhost:8321/#mode=explore&shape=octahedron&tiling=kites), [the dodecahedron](http://localhost:8321/#mode=explore&shape=dodecahedron&tiling=kites), [the stella](http://localhost:8321/#mode=explore&shape=stellaOctangula&tiling=kites); Tetrakis on [the cube](http://localhost:8321/#mode=explore&shape=cube&tiling=tetrakis), [the rhombic dodecahedron](http://localhost:8321/#mode=explore&shape=rhombicDodecahedron&tiling=tetrakis), [the rhombic triacontahedron](http://localhost:8321/#mode=explore&shape=rhombicTriacontahedron&tiling=tetrakis); Triangles on the rhombic solids
- **Sphere** : [Twisted](http://localhost:8321/#mode=explore&shape=icosahedron&tiling=twisted); **Globe** : [Globe](http://localhost:8321/#mode=explore&shape=globe)
- **Rosettes** : Flower 6 to 12, Mirror 5 to 12, Hexa 5 to 12, Ring 12, e.g. [Flower 6](http://localhost:8321/#mode=explore&shape=rosettes&tiling=flower6), [Mirror 7](http://localhost:8321/#mode=explore&shape=rosettes&tiling=mirror7), [Hexa 5](http://localhost:8321/#mode=explore&shape=rosettes&tiling=hexa5)
