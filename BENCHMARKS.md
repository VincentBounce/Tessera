# Benchmarks

How long each case takes to open, cold (a new page, its grid built, its walk ready: nothing computing), in the app's own
hidden browser (`tools/browser.js`, Chrome for Testing, headless). Measured by `node tools/bench.js`, which reads the cases
below, opens each in turn and adds a dated row to Runs. Run every two days among the away jobs (see CLAUDE.md, Away
audits): a case 20 % slower than its last row is a regression to find (`node tools/browser.js profile` on its link).

**Never at the small sizes' cost.** The large cases find what is slow; a fix for them must never slow the sizes used every
day (a grid's usual size, the page as it opens): the small cases (S1, S2…) are there to show it, each opened 5 times, its
median to a hundredth of a second (one opening alone is its noise, a tenth either way).

<p align="center"><br>* * *</p>

## Cases

Each one link, as it opens (its size written: the largest its surface has, unless said).

| Case | What | Link |
|---|---|---|
| C1 | Torus of squares 512 × 1,280 | [open](http://localhost:8321/#mode=life&shape=torus&tiling=squares&gridSize=512x1280+0&playRule=B3/S23&teams=1&popStart=random&popDraw=30.1&version=0.5.765) |
| C2 | Klein bottle of squares 384 | [open](http://localhost:8321/#mode=life&shape=kleinBottle&tiling=squares&gridSize=384&playRule=B3/S23&teams=1&popStart=random&popDraw=30.1&version=0.5.765) |
| C3 | Plane of squares 1,024, a rhombus torus, a seed | [open](http://localhost:8321/#mode=life&shape=squares&playRule=B3/S23&teams=1&gridSize=1024&gridWalls=0&gridOutline=rhombus&popStart=seed2&popDraw=41.358911508&version=0.5.765) |
| C4 | Plane kites, its largest | [open](http://localhost:8321/#mode=life&shape=kites&teams=1&gridSize=768&popStart=random&version=0.5.765) |
| C5 | Plane hats' disc, its largest | [open](http://localhost:8321/#mode=life&shape=hats&teams=1&gridSize=1024&popStart=random&version=0.5.765) |
| C6 | Plane flower 6, its largest | [open](http://localhost:8321/#mode=life&shape=flower6&teams=1&gridSize=1024&popStart=random&version=0.5.765) |
| C7 | Cube of squares, its largest | [open](http://localhost:8321/#mode=life&shape=cube&tiling=squares&teams=1&gridSize=384&popStart=random&version=0.5.765) |
| C8 | Pits cube, its largest | [open](http://localhost:8321/#mode=life&shape=cubePits&tiling=squares&teams=1&gridSize=192&popStart=random&version=0.5.765) |
| C9 | Torus of squares, its largest | [open](http://localhost:8321/#mode=life&shape=torus&tiling=squares&teams=1&gridSize=512&popStart=random&version=0.5.765) |
| C10 | Torus of Cairo pentagons, its largest | [open](http://localhost:8321/#mode=life&shape=torus&tiling=cairo&teams=1&gridSize=384&popStart=random&version=0.5.765) |
| C11 | Möbius strip of squares, its largest | [open](http://localhost:8321/#mode=life&shape=mobiusStrip&tiling=squares&teams=1&gridSize=256&popStart=random&version=0.5.765) |
| C12 | Möbius strip of Cairo pentagons, its largest | [open](http://localhost:8321/#mode=life&shape=mobiusStrip&tiling=cairo&teams=1&gridSize=192&popStart=random&version=0.5.765) |
| C13 | Klein bottle of squares, its largest | [open](http://localhost:8321/#mode=life&shape=kleinBottle&tiling=squares&teams=1&gridSize=512&popStart=random&version=0.5.765) |
| C14 | Klein bottle of Cairo pentagons, its largest | [open](http://localhost:8321/#mode=life&shape=kleinBottle&tiling=cairo&teams=1&gridSize=384&popStart=random&version=0.5.765) |
| C15 | Tetrahedron of triangles, its largest | [open](http://localhost:8321/#mode=life&shape=tetrahedron&tiling=triangles&teams=1&gridSize=512&popStart=random&version=0.5.765) |
| C16 | Hexagon sphere, its largest | [open](http://localhost:8321/#mode=life&shape=icosahedron&tiling=hex&teams=1&gridSize=256&popStart=random&version=0.5.765) |
| C17 | Twisted sphere, its largest | [open](http://localhost:8321/#mode=life&shape=icosahedron&tiling=twisted&teams=1&gridSize=168&popStart=random&version=0.5.765) |
| C18 | Penrose sphere, its largest | [open](http://localhost:8321/#mode=life&shape=dodecahedron&tiling=penrose&teams=1&gridSize=536670&popStart=random&version=0.5.765) |
| C19 | Kites and darts sphere, its largest | [open](http://localhost:8321/#mode=life&shape=dodecahedron&tiling=kitesDarts&teams=1&gridSize=331710&popStart=random&version=0.5.765) |
| C20 | Tetrahedron of kites, its largest | [open](http://localhost:8321/#mode=life&shape=tetrahedron&tiling=kites&teams=1&gridSize=256&popStart=random&version=0.5.765) |
| C21 | Globe, its largest | [open](http://localhost:8321/#mode=life&shape=globe&teams=1&gridSize=1536&popStart=random&version=0.5.765) |
| C22 | Boy's surface of squares, its largest | [open](http://localhost:8321/#mode=life&shape=boysSurface&tiling=squares&teams=1&gridSize=512&popStart=random&version=0.5.765) |
| C23 | Tetrakis cube, its largest | [open](http://localhost:8321/#mode=life&shape=cube&tiling=tetrakis&teams=1&gridSize=192&popStart=random&version=0.5.765) |
| C24 | Tetrahedron of hexagons, its largest | [open](http://localhost:8321/#mode=life&shape=tetrahedron&tiling=hex&teams=1&gridSize=512&popStart=random&version=0.5.765) |
| C25 | Cuboctahedron, its largest | [open](http://localhost:8321/#mode=life&shape=cuboctahedron&teams=1&gridSize=256&popStart=random&version=0.5.765) |
| C26 | Pinwheel cube, its largest | [open](http://localhost:8321/#mode=life&shape=cube&tiling=pinwheel&teams=1&gridSize=375000&popStart=random&version=0.5.765) |
| C27 | Pinwheel torus, its largest | [open](http://localhost:8321/#mode=life&shape=torus&tiling=pinwheel&teams=1&gridSize=781250&popStart=random&version=0.5.765) |
| C28 | Pinwheel Möbius strip, its largest | [open](http://localhost:8321/#mode=life&shape=mobiusStrip&tiling=pinwheel&teams=1&gridSize=937500&popStart=random&version=0.5.765) |
| C29 | Pinwheel Klein bottle, its largest | [open](http://localhost:8321/#mode=life&shape=kleinBottle&tiling=pinwheel&teams=1&gridSize=781250&popStart=random&version=0.5.765) |
| C30 | Rosette sphere flower 6, its largest | [open](http://localhost:8321/#mode=life&shape=rosettes&tiling=flower6&teams=1&gridSize=68&popStart=random&version=0.5.765) |
| S1 | The page as it opens, a walk | [open](http://localhost:8321/#mode=walk&shape=squares&walkKind=turtle&on=edges&walkNumberA=pi&maxSteps=20000&playRule=LNR&version=0.5.773) |
| S2 | Life squares, its usual size | [open](http://localhost:8321/#mode=life&shape=squares&playRule=B3/S23&teams=1&popStart=random&version=0.5.773) |
| S3 | Life hexagons, its usual size | [open](http://localhost:8321/#mode=life&shape=hex&playRule=B2op3m/S12mp3p4p5&teams=1&popStart=random&version=0.5.773) |
| S4 | Life hats, its usual size | [open](http://localhost:8321/#mode=life&shape=hats&teams=1&popStart=random&version=0.5.773) |
| S5 | Life pinwheel triangle, its usual size | [open](http://localhost:8321/#mode=life&shape=pinwheelTriangle&playRule=B37/S016&teams=1&popStart=random&version=0.5.773) |
| S6 | Torus of squares, its usual size | [open](http://localhost:8321/#mode=life&shape=torus&tiling=squares&playRule=B3/S23&teams=1&popStart=random&version=0.5.773) |
| S7 | Klein bottle of squares, its usual size | [open](http://localhost:8321/#mode=life&shape=kleinBottle&tiling=squares&playRule=B3/S23&teams=1&popStart=random&version=0.5.773) |
| S8 | Cube of squares, its usual size | [open](http://localhost:8321/#mode=life&shape=cube&tiling=squares&playRule=B3/S23&teams=1&popStart=random&version=0.5.773) |
| S9 | Globe, its usual size | [open](http://localhost:8321/#mode=life&shape=globe&playRule=B3/S23&teams=1&popStart=random&version=0.5.773) |
| S10 | Boy's surface of squares, its usual size | [open](http://localhost:8321/#mode=life&shape=boysSurface&tiling=squares&playRule=B3/S23&teams=1&popStart=random&version=0.5.773) |
| S11 | Dodecahedron of kites and darts, its usual size | [open](http://localhost:8321/#mode=life&shape=dodecahedron&tiling=kitesDarts&teams=1&popStart=random&version=0.5.773) |
| S12 | An ant on squares, its usual size | [open](http://localhost:8321/#mode=ant&shape=squares&on=cells&maxSteps=20000&playRule=1R0%200L0&version=0.5.773) |

<p align="center"><br>* * *</p>

## Runs

Seconds to open, a row a run (a dash: past 120 s, not waited for; S…: the median of 5).

| Date | Version | C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 | C9 | C10 | C11 | C12 | C13 | C14 | C15 | C16 | C17 | C18 | C19 | C20 | C21 | C22 | C23 | C24 | C25 | C26 | C27 | C28 | C29 | C30 | S1 | S2 | S3 | S4 | S5 | S6 | S7 | S8 | S9 | S10 | S11 | S12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-11-24 | 0.5.766 | 5.7 | 3.4 | 3.3 | 3.6 | 31.4 | 6.6 | 7.9 | 2.3 | 5.5 | 8.1 | 5.7 | 8.1 | 5.9 | 8.2 | 5.8 | 9.9 | 22.1 | 10.4 | 34.6 | 5.4 | 6.3 | 9.0 | 5.8 | 7.4 | 6.6 | 4.1 | 8.4 | 7.4 | 8.7 | 0.7 |
| 2026-11-24 | 0.5.769 | 5.5 | 3.3 | 3.2 | 3.3 | 18.3 | 5.7 | 7.4 | 2.2 | 5.6 | 7.8 | 5.5 | 7.6 | 5.9 | 8.0 | 5.4 | 9.3 | 21.5 | 10.0 | 31.9 | 5.3 | 6.5 | 9.0 | 5.7 | 7.5 | 6.6 | 4.3 | 8.7 | 7.7 | 9.0 | 0.7 |
| 2026-11-24 | 0.5.772 | 5.6 | 3.4 | 3.0 | 2.7 | 11.9 | 5.0 | 7.3 | 2.2 | 5.6 | 8.1 | 5.5 | 7.6 | 6.0 | 8.2 | 5.6 | 9.9 | 22.0 | 10.3 | 33.4 | 5.4 | 6.3 | 8.9 | 6.0 | 7.7 | 6.6 | 4.1 | 8.6 | 7.3 | 8.9 | 0.7 |
| 2026-11-24 | 0.5.773 | 5.7 | 3.3 | 3.0 | 2.7 | 11.8 | 4.9 | 7.3 | 2.2 | 5.4 | 7.9 | 5.6 | 7.8 | 5.9 | 8.2 | 5.5 | 9.4 | 22.0 | 10.4 | 34.6 | 5.4 | 6.3 | 9.0 | 5.8 | 7.4 | 6.8 | 4.3 | 8.9 | 7.5 | 8.9 | 0.7 | 0.42 | 0.44 | 0.50 | 0.51 | 0.48 | 0.47 | 0.48 | 0.49 | 0.75 | 0.69 | 0.85 | 0.38 |
