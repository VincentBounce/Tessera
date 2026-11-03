# WebGPU port (branch `webgpu`)

The last WebGL 2 version: tag `webgl-v0.3.107`, its bundles in `Tessera resources`.

## What WebGL does today (main.js 11.4b, ~1,350 lines, 22 shaders, ~700 calls)
- **Life engine** (lifeEngine, lifePass, lifeRulePass, blockPass, lifeTally, lifeRead, lifeLookGPU): states and counts
  in textures, a generation as fragment passes (lifeRule or blockRule, lifeBook, lifeCount, lifePart, lifeSum), sums
  read back **synchronously** (readPixels) every batch of LIFE_H generations; the states read back on demand by the
  `L.alive` getter (lifeFromGPU). The hunt (huntRuns) runs up to 2,048 starts side by side the same way.
- **Rendering**: surfaces (tile, edge, ribbon, shadows: depth + ids, glass: weighted blended OIT on two 4x MSAA
  targets then glassMix, cut), flat walks (flatPath, flatTiles), 3D walks' cubes (cube), Life on the plane
  (planeCells, planeLines).

## The one real change: readback is asynchronous in WebGPU
`mapAsync` never answers at once. So:
- a batch's sums **and its states** come back together (one copy, one map): `L.alive` a plain array again, current
  once its batch is back, no getter reading the card;
- the game's play (lifeTo), Step back and seekTo wait for their batch (one in flight at a time);
- the hunt's slice awaits its read (it is a setTimeout loop already);
- start-up awaits the device once (requestAdapter / requestDevice), everything after it is sync but the reads.

## Stages, each checked before the next
1. Life engine in WebGPU compute (storage buffers: one of the grid's numbers, one of the cells' fields now and next,
   one of the sums with atomics, params by dynamic offsets), beside WebGL: `gpuLifeCheck()` plays the same grids
   on both and compares every sum and state.
2. Rendering in WebGPU: same pictures (screenshots side by side), lifeLook writing the tiles' colours straight
   into the renderer's buffer.
3. The async flow (play, back, seek, hunt, checks), then WebGL removed.
