# WebGPU port (branch `webgpu`)

The last WebGL 2 version: tag `webgl-v0.3.107`, its bundles in `Tessera resources`.

## Where it stands (2026-11-03, night)
WebGL is gone from main.js: everything runs on WebGPU (11.4b shared pieces, 11.4c Life's engine, 11.4d drawing).
- **Life's engine**: compute passes on storage buffers (rule, block rule, counts, sums by atomics, look). Checked bit
  for bit against WebGL's before it left: every sum and state alike, 48 generations on 15 grids (colours,
  Generations, rings, flowers, Penrose, torus, Möbius, Klein, cube, globe, block rules, loops).
  **2.8 times faster**: 0.67 ms a generation at 2^20 cells, WebGL's 1.88 ms (its states read back with its sums).
- **The one real change, readback is asynchronous**: `lifeStepGPU` starts a batch and gives `null` until it is back;
  `lifeTo` stops there, `lifeGoal` keeps where it was going and `tick` asks again; `lifeSettle()` awaits it (checks,
  Space-time). A batch's cells come back with its sums: `L.alive` a plain array, the generation's; the cells shown
  (`E.shown`) copied when a batch is adopted, so the picture is the generation shown while the next batch runs
  (`gpuShownCheck()`: 0 cells apart at 0, 37, 500, playing).
- **Hunt**: its runs on one engine, each slice awaited; results played again end as found (T, P).
- **Space-time**: its layers made generation by generation, awaited (454 layers in 0.5 s).
- **Drawing**: surfaces (shadows, grid, path, Glass, Cut), flat walks, cubes, Life on the plane and on surfaces: the
  same pictures as WebGL's side by side (sphere, torus, Glass, Cut, cubes, a 2D walk).
- **Checks**: tesseraCheck 855, known 908, crawl 955, fuzz 400 (seed 7) 1,099, parts 1,608, colours 990: all pass.
- **The compressed bundle**: opened from the local server, Life on the cube at gen 200, the picture the game's, no error.
- **Step back's replay**: 1.26 ns a cell and 0.05 ms a generation (WebGL's 2.6 ns, 0.53 ms): its limit set again for the
  same 0.7 s (LIFE_PASSES 2^15, LIFE_REPLAY_MOST 2^29: 15,000 generations at 48 a side, 500 at 2^20 cells; before 1,000
  and 200).

## Not checked yet
- `{ deep }` (every grid's rules, a night's).
- A visible pane: requestAnimationFrame stops while the browser pane is hidden; play was checked by calling tick by
  hand (and once visible: 90 generations in 3 s).
- Speeds at very large grids while playing (one batch in flight a frame: its latency a frame).
- The bundles (tools/bundle.py) with WebGPU.
- Firefox / Safari.
