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

## Judder in Chrome on an external screen (2026-11-03)
Turning the 96 cube by hand, blind tests (pages A to E at random, WebGL's bundle v0.3.107 against WebGPU's):
- Asus external screen, Chrome: WebGL found smoother in 4 tests of 5 (5/5 in the first; in the dark theme, none);
  three WebGPU variants just as jerky: presented as an ImageBitmap, without 4x antialiasing, the 2D sky copied into the
  same picture. The same at 60, 120 and 144 Hz.
- MacBook Pro M1 Max built-in screen, Chrome: the smooth one picked was WebGPU.
- Asus, Safari: WebGPU clearly smoother than WebGL.
- In the page, nothing differs: frame intervals (144 or 120 a second, none missed, a 250 Hz drag too), key to picture
  (Event Timing: 19 ms against 21), allocations (327 KB a frame both: Life's look table made again each frame;
  kept since v0.4.1, 40 KB a frame, no GC in 4 s of drag), flicker (WebGPU's fewer big pixel jumps). So: how Chrome sends a WebGPU canvas to an external screen on macOS.

## Not checked yet
- `{ deep }` (every grid's rules, a night's).
- Speeds at very large grids while playing (one batch in flight a frame: its latency a frame).
- Firefox. (Checked since: a visible pane, play at its speed again in v0.3.107's branch; the bundles, plain and
  compressed; Safari, see above.)
