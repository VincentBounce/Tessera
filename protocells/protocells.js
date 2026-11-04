/* ==============================================================================================
 * PROTOCELLS — protocells.js
 * ==============================================================================================
 *
 * Zwicker, Seyboldt, Weber, Hyman and Jülicher's active emulsions ("Growth and division of active
 * droplets", Nature Physics 2017) made of particles: one liquid in a box (its height 1, its width
 * the screen's aspect, filled), moved as liquid/'s (Clavet, Beaudoin and Poulin's double density
 * relaxation, every particle at once), each particle of a species: food F, droplet D or waste W.
 * D and the others shun each other (a pair of D and F or W pushed from a lower rest density), so D
 * gathers into droplets. Each step each particle may change its own species, from its neighbours'
 * at the step's start (read only: no race between threads), by a hash of its id and the step (the
 * same on the CPU): F touching a droplet (a few D) turns D (the droplet grows at its surface), D turns W anywhere
 * (its core decays), W with no D near turns F (the fuel, which keeps the emulsion away from rest).
 * Nothing tells a droplet to divide: it grows till its supply, the food reaching its surface
 * through its own waste, can no longer feed its core; it stretches and splits, drifts to food,
 * and merges with another it touches.
 * The liquid as in liquid/ (see its banner): lengths in the push in reaches, a step the unit of
 * time, the stiffnesses small (Jacobi's gain), the walls mirrors, the pointer no faster than CFL;
 * no gravity here (a dish seen from above), every mass the same, and Heat a random kick each step.
 * WebGPU, a step in eight compute passes: the particles moved, counted into bins a reach wide, the
 * bins' starts summed, the particles sorted by bin, each one's densities (and its D neighbours),
 * each one pushed and its species changed, and the step's clock ticked. Drawn as metaballs, each
 * pixel the colour of the species strongest there, or as discs.
 * protocellsCheck() in the console: one GPU step against the CPU (every pair, the reactions too),
 * F + D + W = n, and a run from one droplet till it divides.
 */

/* ---- 1.1 Setting ----------------------------------------------------------------------------- */

const COUNTS = [4096, 16384, 65536, 262144], STEPS = [1, 2, 4, 8], TOOLS = ['drag', 'attract', 'repel', 'emit', 'delete'], VIEWS = ['liquid', 'particles'], STARTS = ['droplet', 'emulsion'];
const FOOD = 0, DROP = 1, WASTE = 2, DEAD = 3; // (a particle's species; DEAD once deleted)
const SPECIES = ['food', 'droplet', 'waste'], COLOURS = [[0.35, 0.78, 0.4], [0.95, 0.42, 0.7], [0.5, 0.4, 0.28]];
const EMIT = 3, BETA = 0.3, FILL = 1, REST = 4, THRESHOLD = 1, PULL = 0.004, CFL = 0.3; // (CFL: the fastest a step can
// move a particle, in reaches, and stay stable)
const MIN_DROPLET = 24, START_RADIUS = 0.1, EMULSION = 0.15, TOUCH = 3; // (a droplet's fewest particles; the one droplet's
// radius at the start, the share of D in an emulsion; the D neighbours an F needs to be at a droplet's surface: a stray D
// particle feeds nothing, else it turns the food round it, spreads everywhere and no droplet is left)
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
// The setting from the link: #n=16384&steps=8&seed=1&start=droplet&grow=0.01&decay=0.002&recycle=0.003&heat=0.01&…
const hash = Object.fromEntries(new URLSearchParams(location.hash.slice(1)));
const num = (v, d) => (v === undefined || v === '' || isNaN(+v) ? d : +v);
const set = { n: COUNTS.includes(+hash.n) ? +hash.n : 16384, steps: STEPS.includes(+hash.steps) ? +hash.steps : 8, seed: +hash.seed || 1, start: STARTS.includes(hash.start) ? hash.start : 'droplet', grow: num(hash.grow, 0.01), decay: num(hash.decay, 0.002), recycle: num(hash.recycle, 0.003), heat: num(hash.heat, 0.01), stiffness: num(hash.stiffness, 0.01), near: num(hash.near, 0.02), same: num(hash.same, REST), other: num(hash.other, 2.5), viscosity: num(hash.viscosity, 0.1), brush: num(hash.brush, 0.1), pour: [FOOD, DROP, WASTE].includes(+hash.pour) ? +hash.pour : FOOD, view: VIEWS.includes(hash.view) ? hash.view : 'liquid', tool: 'drag' };
const keep = () => { const { tool, ...h } = set; history.replaceState(null, '', '#' + new URLSearchParams(h)); };
// The box and its reach, fixed by a start: its width a (the screen's aspect then), the reach h such that n particles at
// the rest density fill FILL of it, the grid of bins (each a reach wide at least)
let world = null;
function box() {
  const a = Math.min(3, Math.max(0.5, view.clientWidth / Math.max(1, view.clientHeight)));
  const h = Math.sqrt((FILL * a) / set.n) * Math.sqrt((6 * REST) / Math.PI); // (ρ = (π/6) (h/s)² at a spacing s)
  const gx = Math.max(3, Math.floor(a / h)), gy = Math.max(3, Math.floor(1 / h));
  return { a, h, gx, gy, bins: gx * gy, s: Math.sqrt((FILL * a) / set.n) }; // (s: the particles' spacing at rest)
}
// A particle's random number in [0, 1) for a step (its clock) and a use (salt): PCG's hash of its id and the step's,
// 24 bits (a float's exactly), the same on the CPU (protocellsCheck)
const pcg = (v) => { const s = (Math.imul(v, 747796405) + 2891336453) >>> 0, w = Math.imul(((s >>> ((s >>> 28) + 4)) ^ s) >>> 0, 277803737) >>> 0; return ((w >>> 22) ^ w) >>> 0; };
const random = (i, clock, salt) => (pcg((i ^ pcg((Math.imul(clock, 4) + salt + Math.imul(set.seed, 0x9e3779b9)) >>> 0)) >>> 0) >>> 8) / 16777216;

/* ---- 1.2 Shaders ----------------------------------------------------------------------------- */

const PARAMS = `
const FOOD = ${FOOD.toFixed(1)}; const DROP = ${DROP.toFixed(1)}; const WASTE = ${WASTE.toFixed(1)}; const DEAD = ${DEAD.toFixed(1)};
struct Params { a: vec4u, b: vec4u, f: vec4f, k: vec4f, v: vec4f, r: vec4f, p: vec4f, q: vec4f, s: vec4f, o: vec4f };
// a: n, the grid's columns and rows, bins; b: the pointer's tool (0 none, 1 drag, 2 attract, 3 repel, 4 emit: the
// CPU's, 5 delete), the seed; f: the reach h, a bin's width and height, the box's width; k: stiffness, near stiffness,
// rest density of a pair of one phase (D and D, or F and W), of two; v: heat, viscosity σ, β; r: the rates a step of
// growth (F to D), decay (D to W), recycling (W to F), the D neighbours touching a droplet takes; p: the pointer's
// place, its brush (radius), its pull; q: its speed (a step); s: pixels a unit of the box (zoomed), the canvas' width and height, the liquid's threshold; o: the
// box's corner (0, 0) in the canvas' pixels (y up), a particle's radius as drawn (the box's units)`;
const COMPUTE = PARAMS + `
@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read_write> state: array<vec4f>; // a particle i: place 2i (its species in z), speed 2i + 1
@group(0) @binding(2) var<storage, read_write> next: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> near: array<vec4f>;  // the places and speeds in the bins' order
@group(0) @binding(4) var<storage, read_write> count: array<atomic<u32>>; // the bins' counts, then the steps done (the clock)
@group(0) @binding(5) var<storage, read_write> start: array<u32>;
@group(0) @binding(6) var<storage, read_write> at: array<vec2u>;    // a particle's bin and place in it
@group(0) @binding(7) var<storage, read_write> sorted: array<u32>;
@group(0) @binding(8) var<storage, read_write> dens: array<vec4f>;  // in the bins' order: Σw², Σw³, Σw, D neighbours
fn cellOf(p: vec2f) -> vec2i { return clamp(vec2i(floor(p / P.f.yz)), vec2i(0), vec2i(P.a.yz) - 1); }
fn binOf(c: vec2i) -> u32 { return u32(c.y * i32(P.a.y) + c.x); }
fn inGrid(c: vec2i) -> bool { return all(c >= vec2i(0)) && all(c < vec2i(P.a.yz)); }
// A particle's random number in [0, 1) this step, for a use (salt): see random() on the CPU
fn pcg(v: u32) -> u32 { let s = v * 747796405u + 2891336453u; let w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
fn random(i: u32, salt: u32) -> f32 { return f32(pcg(i ^ pcg(atomicLoad(&count[P.a.w]) * 4u + salt + P.b.y * 0x9e3779b9u)) >> 8u) / 16777216.0; }
// One particle: the heat's kick and the pointer's tool on its speed, then moved by it
@compute @workgroup_size(256) fn advance(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x; if (i >= P.a.x) { return; }
  let x = state[2u * i]; var v = state[2u * i + 1u].xy; let h = P.f.x; if (x.z >= DEAD) { return; }
  let d = P.p.xy - x.xy; let l = length(d); let tool = P.b.x; let brushed = l < P.p.z; let w = 1.0 - l / P.p.z;
  if (brushed && tool == 5u) { state[2u * i] = vec4f(x.xy, DEAD, 0.0); return; } // (deleted: dead till the CPU packs them out)
  v += (vec2f(random(i, 1u), random(i, 2u)) - 0.5) * P.v.x * h;
  if (brushed && tool == 1u) { v = mix(v, P.q.xy, w * 0.3); }
  if (brushed && l > 0.0 && (tool == 2u || tool == 3u)) { v += d / l * w * P.p.w * h * select(1.0, -1.0, tool == 3u); }
  state[2u * i] = vec4f(x.xy + v, x.z, 0.0); state[2u * i + 1u] = vec4f(v, 0.0, 0.0);
}
@compute @workgroup_size(256) fn clear(@builtin(global_invocation_id) id: vec3u) {
  if (id.x < P.a.w) { atomicStore(&count[id.x], 0u); }
}
@compute @workgroup_size(256) fn tally(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x; if (i >= P.a.x) { return; }
  let p = state[2u * i]; let b = select(binOf(cellOf(p.xy)), P.a.w - 1u, p.z >= DEAD);
  at[i] = vec2u(b, atomicAdd(&count[b], 1u));
}
// The bins' starts: each of 256 threads sums its run of bins, the 256 sums scanned together, then each run written
var<workgroup> part: array<u32, 256>;
@compute @workgroup_size(256) fn scan(@builtin(local_invocation_id) lid: vec3u) {
  let t = lid.x; let B = P.a.w; let C = (B + 255u) / 256u; let lo = min(t * C, B); let hi = min(lo + C, B);
  var s = 0u;
  for (var b = lo; b < hi; b++) { s += atomicLoad(&count[b]); }
  part[t] = s;
  workgroupBarrier();
  for (var off = 1u; off < 256u; off *= 2u) {
    let v = select(0u, part[t - off], t >= off);
    workgroupBarrier();
    part[t] += v;
    workgroupBarrier();
  }
  var base = part[t] - s;
  for (var b = lo; b < hi; b++) { start[b] = base; base += atomicLoad(&count[b]); }
  if (t == 255u) { start[B] = part[255]; }
}
@compute @workgroup_size(256) fn place(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x; if (i >= P.a.x) { return; }
  let s = start[at[i].x] + at[i].y;
  sorted[s] = i; near[2u * s] = state[2u * i]; near[2u * s + 1u] = state[2u * i + 1u];
}
// The walls as mirrors: a particle within half a reach of one feels its own image beyond it (as a neighbour of its
// phase, its density, its speed mirrored), so it is pushed off before it reaches it; wall k (left, right, bottom, top):
// its gap to p and the way out through it
fn wallGap(p: vec2f, k: u32) -> f32 { var g = array(p.x, P.f.w - p.x, p.y, 1.0 - p.y); return g[k]; }
fn wallOut(k: u32) -> vec2f { var o = array(vec2f(-1.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, -1.0), vec2f(0.0, 1.0)); return o[k]; }
// One particle (in the bins' order): its density, near density and neighbours' weight from those in the bins round
// its own, and how many of them are D (the images not: a wall feeds nothing)
@compute @workgroup_size(128) fn density(@builtin(global_invocation_id) id: vec3u) {
  let s = id.x; if (s >= P.a.x) { return; }
  if (near[2u * s].z >= DEAD) { dens[s] = vec4f(0.0); return; }
  let p = near[2u * s].xy; let c = cellOf(p); var r = vec4f(0.0);
  for (var dy = -1; dy <= 1; dy++) { for (var dx = -1; dx <= 1; dx++) {
    let q = c + vec2i(dx, dy); if (!inGrid(q)) { continue; }
    let b = binOf(q);
    for (var t = start[b]; t < start[b + 1u]; t++) {
      if (t == s) { continue; }
      let d = length(near[2u * t].xy - p) / P.f.x;
      if (d < 1.0) { let w = 1.0 - d; r += vec4f(w * w, w * w * w, w, select(0.0, 1.0, near[2u * t].z == DROP)); }
    }
  } }
  for (var k = 0u; k < 4u; k++) { let d = 2.0 * wallGap(p, k) / P.f.x; if (d < 1.0) { let w = 1.0 - d; r += vec4f(w * w, w * w * w, w, 0.0); } }
  dens[s] = r;
}
// The way from particle i to particle j, e apart (l long); two at one place a way known by their names, opposite for
// each, never none (else they never part)
fn way(e: vec2f, l: f32, i: u32, j: u32) -> vec2f {
  if (l > 0.0) { return e / l; }
  let a = f32((min(i, j) * 2654435761u + max(i, j)) >> 8u) * (6.2831853 / 16777216.0);
  return vec2f(cos(a), sin(a)) * select(-1.0, 1.0, i < j);
}
// A particle's next species, from its own and its D neighbours' count at the step's start: F touching a droplet (TOUCH
// D neighbours) turns D, D turns W, W with no D near turns F, each at its rate (one random number, its own)
fn react(k: f32, drops: f32, u: f32) -> f32 {
  if (k == FOOD && drops >= P.r.w && u < P.r.x) { return DROP; }
  if (k == DROP && u < P.r.y) { return WASTE; }
  if (k == WASTE && drops == 0.0 && u < P.r.z) { return FOOD; }
  return k;
}
// One particle (in the bins' order): pushed by each pair's pressure and viscosity (half each: one mass for all), kept
// in the box, its speed what the step did; its species changed
@compute @workgroup_size(128) fn relax(@builtin(global_invocation_id) id: vec3u) {
  let s = id.x; if (s >= P.a.x) { return; }
  let me = near[2u * s]; let i = sorted[s];
  if (me.z >= DEAD) { next[2u * i] = me; next[2u * i + 1u] = vec4f(0.0); return; }
  let v = near[2u * s + 1u].xy; let ri = dens[s]; let h = P.f.x;
  let c = cellOf(me.xy); var dx = vec2f(0.0);
  for (var dy = -1; dy <= 1; dy++) { for (var ex = -1; ex <= 1; ex++) {
    let q = c + vec2i(ex, dy); if (!inGrid(q)) { continue; }
    let b = binOf(q);
    for (var t = start[b]; t < start[b + 1u]; t++) {
      if (t == s) { continue; }
      let o = near[2u * t]; let e = o.xy - me.xy; let l = length(e); let r = l / h;
      if (r < 1.0) {
        let u = way(e, l, i, sorted[t]); let w = 1.0 - r; let rj = dens[t];
        let pressure = P.k.x * ((ri.x + rj.x) * 0.5 - select(P.k.w, P.k.z, (o.z == DROP) == (me.z == DROP))) * w + P.k.y * (ri.y + rj.y) * 0.5 * w * w;
        let closing = dot(v - near[2u * t + 1u].xy, u) / h;
        let viscous = select(0.0, w * (P.v.y * closing + P.v.z * closing * closing) / max(ri.z, rj.z), closing > 0.0);
        dx -= u * h * (pressure + viscous) * 0.5;
      }
    }
  } }
  // (its image's push: the same, its share a half; never a pull: a wall pushes only)
  for (var k = 0u; k < 4u; k++) {
    let r = 2.0 * wallGap(me.xy, k) / h;
    if (r < 1.0) {
      let u = wallOut(k); let w = 1.0 - r;
      let pressure = max(0.0, P.k.x * (ri.x - P.k.z) * w + P.k.y * ri.y * w * w);
      let closing = 2.0 * dot(v, u) / h;
      let viscous = select(0.0, w * (P.v.y * closing + P.v.z * closing * closing) / ri.z, closing > 0.0);
      dx -= u * h * (pressure + viscous) * 0.5;
    }
  }
  let x = clamp(me.xy + dx, vec2f(0.0), vec2f(P.f.w, 1.0));
  next[2u * i] = vec4f(x, react(me.z, ri.w, random(i, 3u)), 0.0); next[2u * i + 1u] = vec4f(x - (me.xy - v), 0.0, 0.0);
}
// The step done: its clock ticked (one thread, after every other pass)
@compute @workgroup_size(1) fn tick() { atomicAdd(&count[P.a.w], 1u); }`;
// A particle drawn as a soft disc, its weight (1 − d²)² in its species' channel (r, g, b), summed into a picture; the
// box letterboxed in the canvas
const DRAW = PARAMS + `
@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read> s: array<vec4f>;
@group(0) @binding(2) var<uniform> colour: array<vec4f, 3>;
struct Out { @builtin(position) pos: vec4f, @location(0) uv: vec2f, @location(1) c: vec3f, @location(2) @interpolate(flat) k: u32 };
fn origin() -> vec2f { return P.o.xy; }
// A particle's quad, its size in the box's units round it
fn quad(vi: u32, ii: u32, size: f32) -> Out {
  var corners = array(vec2f(-1, -1), vec2f(1, -1), vec2f(-1, 1), vec2f(-1, 1), vec2f(1, -1), vec2f(1, 1));
  let p = s[2u * ii]; var o: Out; o.uv = corners[vi]; o.k = min(u32(p.z), 2u); o.c = colour[o.k].rgb;
  let px = origin() + (p.xy + o.uv * size) * P.s.x;
  o.pos = select(vec4f(px / P.s.yz * 2.0 - 1.0, 0.0, 1.0), vec4f(2.0, 2.0, 2.0, 1.0), p.z >= DEAD); // (a dead one: off the canvas)
  return o;
}
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> Out { return quad(vi, ii, P.f.x * 0.6); }
// The Particles view: each a disc of its species' colour ringed darker (its radius half the particles' spacing:
// neighbours at rest touch; a pixel at least) on the box's background
@vertex fn dotVs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> Out { return quad(vi, ii, max(P.o.z, 1.0 / P.s.x)); }
@fragment fn dotFs(i: Out) -> @location(0) vec4f { let d = dot(i.uv, i.uv); if (d > 1.0) { discard; } return vec4f(i.c * select(1.0, 0.5, d > 0.55), 1.0); }
@fragment fn fs(i: Out) -> @location(0) vec4f {
  let d = dot(i.uv, i.uv); if (d > 1.0) { discard; }
  var w = vec4f(0.0); w[i.k] = (1.0 - d) * (1.0 - d); return w;
}
@group(0) @binding(3) var picture: texture_2d<f32>;
@vertex fn full(@builtin(vertex_index) v: u32) -> @builtin(position) vec4f { return vec4f(f32(v & 1u) * 4.0 - 1.0, f32(v >> 1u) * 4.0 - 1.0, 0.0, 1.0); }
// The liquid where the species' summed weight passes the threshold, each pixel the colour of the strongest there; both
// edges (liquid and background, two species) a pixel wide whatever the particles' size (fwidth); the box's background,
// darker outside
@fragment fn show(@builtin(position) px: vec4f) -> @location(0) vec4f {
  let t = textureLoad(picture, vec2i(px.xy), 0); let at = (vec2f(px.x, P.s.z - px.y) - origin()) / P.s.x;
  var k = 0u; var j = 1u;
  for (var c = 1u; c < 3u; c++) { let up = t[c] > t[k]; j = select(select(j, c, t[c] > t[j] || j == k), k, up); k = select(k, c, up); }
  let sum = t.x + t.y + t.z; let lead = t[k] - t[j]; let es = fwidth(sum); let el = fwidth(lead);
  let inside = all(at >= vec2f(0.0)) && all(at <= vec2f(P.f.w, 1.0));
  let bg = select(vec3f(0.02, 0.022, 0.03), vec3f(0.05, 0.055, 0.075), inside);
  let T = P.s.w; let hue = mix(colour[j].rgb, colour[k].rgb, 0.5 + 0.5 * smoothstep(0.0, el, lead));
  return vec4f(select(mix(bg, hue, smoothstep(T - es, T + es, sum)), bg, sum < 1e-4), 1.0);
}`;
const PICTURE = 'rgba16float';

/* ---- 1.3 GPU --------------------------------------------------------------------------------- */

const view = document.getElementById('view');
const fail = (text) => { const f = document.getElementById('fail'); f.style.display = 'flex'; f.textContent = text; throw new Error(text); };
let device, context, format, pipes, drawPipe, showPipe, dotPipe, dotGroups = [], params, colourBuf, states = [], bins = {}, groups = [], drawGroups = [], picture = null, showGroup, flip = 0;
async function gpu() {
  const adapter = navigator.gpu && (await navigator.gpu.requestAdapter());
  if (!adapter) fail('This page needs WebGPU (Chrome, Edge, or a recent Safari).');
  device = await adapter.requestDevice();
  context = view.getContext('webgpu'); format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'opaque' });
  const cm = device.createShaderModule({ code: COMPUTE }), dm = device.createShaderModule({ code: DRAW });
  const S = GPUShaderStage, storage = (b) => ({ binding: b, visibility: S.COMPUTE, buffer: { type: 'storage' } });
  const layout = device.createBindGroupLayout({ entries: [{ binding: 0, visibility: S.COMPUTE, buffer: {} }, ...[1, 2, 3, 4, 5, 6, 7, 8].map(storage)] });
  const pl = device.createPipelineLayout({ bindGroupLayouts: [layout] });
  pipes = Object.fromEntries(['advance', 'clear', 'tally', 'scan', 'place', 'density', 'relax', 'tick'].map((e) => [e, device.createComputePipeline({ layout: pl, compute: { module: cm, entryPoint: e } })]));
  pipes.layout = layout;
  const add = { srcFactor: 'one', dstFactor: 'one' };
  drawPipe = device.createRenderPipeline({ layout: 'auto', vertex: { module: dm, entryPoint: 'vs' }, fragment: { module: dm, entryPoint: 'fs', targets: [{ format: PICTURE, blend: { color: add, alpha: add } }] }, primitive: { topology: 'triangle-list' } });
  dotPipe = device.createRenderPipeline({ layout: 'auto', vertex: { module: dm, entryPoint: 'dotVs' }, fragment: { module: dm, entryPoint: 'dotFs', targets: [{ format }] }, primitive: { topology: 'triangle-list' } });
  showPipe = device.createRenderPipeline({ layout: 'auto', vertex: { module: dm, entryPoint: 'full' }, fragment: { module: dm, entryPoint: 'show', targets: [{ format }] } });
  params = device.createBuffer({ size: 160, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  colourBuf = device.createBuffer({ size: 48, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(colourBuf, 0, Float32Array.from(COLOURS.flatMap((c) => [...c, 1])));
}
const buffer = (bytes) => device.createBuffer({ size: Math.max(16, bytes), usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
// A start: n particles at random places over the box (the seed's), at rest, all food but D in a disc in the middle
// (droplet) or a share of them at random (emulsion); room for twice as many (Emit's); its bins (one more, the dead's:
// deleted, packed out later, then the clock) and bind groups
let live = 0, cap = 0;
function restart() {
  world = box(); Object.assign(look, { zoom: 1, x: world.a / 2, y: 0.5 }); live = set.n; cap = 2 * set.n;
  const r = mulberry32(set.seed), s = new Float32Array(set.n * 8);
  for (let i = 0; i < set.n; i++) {
    const x = r() * world.a, y = r(), drop = set.start === 'droplet' ? Math.hypot(x - world.a / 2, y - 0.5) < START_RADIUS : r() < EMULSION;
    s.set([x, y, drop ? DROP : FOOD, 0], i * 8);
  }
  for (const b of [...states, ...Object.values(bins)]) b.destroy();
  states = [0, 1].map(() => buffer(cap * 32)); device.queue.writeBuffer(states[0], 0, s);
  bins = { near: buffer(cap * 32), count: buffer((world.bins + 2) * 4), start: buffer((world.bins + 2) * 4), at: buffer(cap * 8), sorted: buffer(cap * 4), dens: buffer(cap * 16) };
  groups = [0, 1].map((f) => device.createBindGroup({ layout: pipes.layout, entries: [params, states[f], states[1 - f], bins.near, bins.count, bins.start, bins.at, bins.sorted, bins.dens].map((buffer, binding) => ({ binding, resource: { buffer } })) }));
  drawGroups = []; census = null;
  flip = 0;
}
// The parameters for a step and a drawing
function write() {
  const w = view.width, h = view.height, frame = frameOf(w, h), buf = new ArrayBuffer(160), u = new Uint32Array(buf), f = new Float32Array(buf);
  u.set([live, world.gx, world.gy, world.bins + 1, pointer.down ? TOOLS.indexOf(set.tool) + 1 : 0, set.seed, 0, 0]);
  f.set([world.h, world.a / world.gx, 1 / world.gy, world.a, set.stiffness, set.near, set.same, set.other, set.heat, set.viscosity, BETA, 0, set.grow, set.decay, set.recycle, TOUCH], 8);
  f.set([pointer.x, pointer.y, set.brush, PULL, pointer.vx, pointer.vy, 0, 0, frame.sc, w, h, THRESHOLD, frame.ox, frame.oy, 0.5 * world.s, 0], 24);
  device.queue.writeBuffer(params, 0, buf);
}
// `count` steps in one submission: each eight passes (none while the dead are packed out: they would be lost)
function steps(count) {
  if (packing) return;
  const enc = device.createCommandEncoder(), n = Math.ceil(live / 256), m = Math.ceil(live / 128);
  for (let s = 0; s < count; s++) {
    const pass = enc.beginComputePass();
    pass.setBindGroup(0, groups[flip]);
    pass.setPipeline(pipes.advance); pass.dispatchWorkgroups(n);
    pass.setPipeline(pipes.clear); pass.dispatchWorkgroups(Math.ceil((world.bins + 1) / 256));
    pass.setPipeline(pipes.tally); pass.dispatchWorkgroups(n);
    pass.setPipeline(pipes.scan); pass.dispatchWorkgroups(1);
    pass.setPipeline(pipes.place); pass.dispatchWorkgroups(n);
    pass.setPipeline(pipes.density); pass.dispatchWorkgroups(m);
    pass.setPipeline(pipes.relax); pass.dispatchWorkgroups(m);
    pass.setPipeline(pipes.tick); pass.dispatchWorkgroups(1);
    pass.end();
    flip = 1 - flip;
  }
  device.queue.submit([enc.finish()]);
}
// The discs summed into the picture (made again at the canvas' size), then the liquid shown from it
function draw() {
  if (!picture || picture.width !== view.width || picture.height !== view.height) {
    picture?.destroy();
    picture = device.createTexture({ size: [view.width, view.height], format: PICTURE, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
    showGroup = device.createBindGroup({ layout: showPipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: params } }, { binding: 2, resource: { buffer: colourBuf } }, { binding: 3, resource: picture.createView() }] });
  }
  const groupsOf = (pipe) => [0, 1].map((f) => device.createBindGroup({ layout: pipe.getBindGroupLayout(0), entries: [params, states[f], colourBuf].map((buffer, binding) => ({ binding, resource: { buffer } })) }));
  if (!drawGroups.length) { drawGroups = groupsOf(drawPipe); dotGroups = groupsOf(dotPipe); }
  const enc = device.createCommandEncoder();
  const pass = enc.beginRenderPass({ colorAttachments: [{ view: picture.createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 0 } }] });
  if (set.view === 'liquid') { pass.setPipeline(drawPipe); pass.setBindGroup(0, drawGroups[flip]); pass.draw(6, live); } // (Particles: the picture empty, the background only)
  pass.end();
  const out = enc.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }] });
  out.setPipeline(showPipe); out.setBindGroup(0, showGroup); out.draw(3);
  if (set.view === 'particles') { out.setPipeline(dotPipe); out.setBindGroup(0, dotGroups[flip]); out.draw(6, live); }
  out.end();
  device.queue.submit([enc.finish()]);
}
// A GPU buffer's first bytes, read back (once the steps submitted are done)
async function readBack(buf, bytes) {
  await device.queue.onSubmittedWorkDone();
  const b = device.createBuffer({ size: bytes, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST }), e = device.createCommandEncoder();
  e.copyBufferToBuffer(buf, 0, b, 0, bytes); device.queue.submit([e.finish()]);
  await b.mapAsync(GPUMapMode.READ); const a = b.getMappedRange().slice(0); b.destroy(); return a;
}
// The particles' places (species in z) and speeds: 8 floats a particle; the steps done
const readState = async () => new Float32Array(await readBack(states[flip], live * 32));
const readClock = async () => new Uint32Array(await readBack(bins.count, (world.bins + 2) * 4))[world.bins + 1];

/* ---- 1.4 Droplets ---------------------------------------------------------------------------- */

// The particles of each species, and the droplets: the D particles linked within a reach (union-find over the bins),
// a droplet a group of MIN_DROPLET at least; their sizes, the largest first
function censusOf(S, n) {
  const species = [0, 0, 0], { h, gx, gy } = world, cw = world.a / gx, ch = 1 / gy;
  const head = new Int32Array(gx * gy).fill(-1), link = new Int32Array(n).fill(-1), up = new Int32Array(n), binOf = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const k = S[i * 8 + 2]; if (k >= DEAD) continue;
    species[k]++; up[i] = i;
    if (k !== DROP) continue;
    const b = Math.min(gy - 1, Math.floor(S[i * 8 + 1] / ch)) * gx + Math.min(gx - 1, Math.floor(S[i * 8] / cw));
    binOf[i] = b; link[i] = head[b]; head[b] = i;
  }
  const root = (i) => { while (up[i] !== i) i = up[i] = up[up[i]]; return i; };
  for (let b = 0; b < gx * gy; b++) for (let i = head[b]; i >= 0; i = link[i]) {
    const cx = b % gx, cy = (b - cx) / gx;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= gx || y >= gy) continue;
      for (let j = head[y * gx + x]; j >= 0; j = link[j]) if (j > i && Math.hypot(S[j * 8] - S[i * 8], S[j * 8 + 1] - S[i * 8 + 1]) < h) up[root(j)] = root(i);
    }
  }
  const size = new Map();
  for (let b = 0; b < gx * gy; b++) for (let i = head[b]; i >= 0; i = link[i]) { const r = root(i); size.set(r, (size.get(r) || 0) + 1); }
  return { species, droplets: [...size.values()].filter((s) => s >= MIN_DROPLET).sort((a, b) => b - a) };
}
// The census shown, taken now and then from a read back (one at a time)
let census = null, counting = false;
async function takeCensus() {
  if (counting || packing) return;
  counting = true;
  const n = live, S = await readState(); if (n === live) census = censusOf(S, n);
  counting = false;
}

/* ---- 1.5 Panel ------------------------------------------------------------------------------- */

// One choice among several: a tab group (Lenia Worlds' .tabs)
const tabs = (el, values, get, pick, name = (v) => v) => {
  el.innerHTML = '';
  for (const v of values) { const b = document.createElement('button'); b.className = 'btn'; b.textContent = name(v); b.onclick = () => pick(v); el.append(b); }
  const mark = () => [...el.children].forEach((b, i) => b.classList.toggle('on', values[i] === get()));
  mark(); return mark;
};
const capital = (v) => v[0].toUpperCase() + v.slice(1);
// The pointer in the box's units, its speed a step (the frame's move shared by its steps), its tool on while pressed
const pointer = { x: 0, y: 0, vx: 0, vy: 0, down: false, moved: [0, 0] };
// The view: the box whole at zoom 1, zoom times nearer round the place look (in the box) at the middle; for a canvas
// w × h (its device or CSS pixels), its pixels a unit of the box and the box's corner (0, 0) in them (y up)
const look = { zoom: 1, x: 0.5, y: 0.5 };
const frameOf = (w, h) => { const sc = Math.min(w / world.a, h) * look.zoom; return { sc, ox: w / 2 - look.x * sc, oy: h / 2 - look.y * sc }; };
const toBox = (e) => { const r = view.getBoundingClientRect(), v = frameOf(r.width, r.height); return [(e.clientX - r.left - v.ox) / v.sc, (r.bottom - e.clientY - v.oy) / v.sc]; };
// The wheel zooms (1 to 32 times) round the place under the cursor, kept there; the place looked at kept in the box
const zoomAt = (e) => {
  const [x, y] = toBox(e), z = Math.min(32, Math.max(1, look.zoom * Math.exp(-e.deltaY * 0.002)));
  look.x = Math.min(world.a, Math.max(0, x - ((x - look.x) * look.zoom) / z)); look.y = Math.min(1, Math.max(0, y - ((y - look.y) * look.zoom) / z)); look.zoom = z;
  if (z === 1) Object.assign(look, { x: world.a / 2, y: 0.5 });
};
let on = true;
// A slider shown at its setting
const showSlider = (id) => { const input = document.getElementById(id); input.value = set[id]; input.nextElementSibling.textContent = set[id]; };
function panel() {
  const markCounts = tabs(document.getElementById('counts'), COUNTS, () => set.n, (v) => { set.n = v; markCounts(); keep(); restart(); }, (v) => v / 1024 + 'k');
  const markSteps = tabs(document.getElementById('steps'), STEPS, () => set.steps, (v) => { set.steps = v; markSteps(); keep(); });
  const markStarts = tabs(document.getElementById('starts'), STARTS, () => set.start, (v) => { set.start = v; markStarts(); keep(); restart(); }, capital);
  const markTools = tabs(document.getElementById('tools'), TOOLS, () => set.tool, (v) => { set.tool = v; markTools(); }, capital);
  // The species Emit pours
  const markPours = tabs(document.getElementById('pours'), [FOOD, DROP, WASTE], () => set.pour, (v) => { set.pour = v; markPours(); keep(); }, (v) => capital(SPECIES[v]));
  // The view: the liquid (metaballs) or its particles alone
  const markViews = tabs(document.getElementById('views'), VIEWS, () => set.view, (v) => { set.view = v; markViews(); keep(); }, capital);
  document.getElementById('restart').onclick = () => restart();
  document.getElementById('play').onclick = (e) => { on = !on; e.target.textContent = on ? 'Pause' : 'Play'; };
  for (const id of ['brush', 'grow', 'decay', 'recycle', 'heat', 'stiffness', 'near', 'same', 'other', 'viscosity']) {
    const input = document.getElementById(id);
    showSlider(id);
    input.oninput = () => { set[id] = +input.value; showSlider(id); keep(); };
  }
  view.onpointerdown = (e) => { [pointer.x, pointer.y] = toBox(e); pointer.moved = [0, 0]; pointer.down = true; view.setPointerCapture(e.pointerId); };
  view.onpointermove = (e) => { const [x, y] = toBox(e); pointer.moved[0] += x - pointer.x; pointer.moved[1] += y - pointer.y; pointer.x = x; pointer.y = y; };
  view.onpointerup = view.onpointercancel = () => { pointer.down = false; if (set.tool === 'delete') pack(); };
  view.onwheel = (e) => { e.preventDefault(); zoomAt(e); };
}

/* ---- 1.6 Loop -------------------------------------------------------------------------------- */

const fit = () => { const r = view.getBoundingClientRect(), d = devicePixelRatio || 1; view.width = Math.max(1, Math.round(r.width * d)); view.height = Math.max(1, Math.round(r.height * d)); };
addEventListener('resize', fit);
// A step's time, measured now and then: a batch of steps submitted alone, waited for
let msStep = 0, frames = 0, last = performance.now(), fps = 0;
async function measure() {
  write(); await device.queue.onSubmittedWorkDone();
  const t0 = performance.now(); steps(8); await device.queue.onSubmittedWorkDone(); msStep = (performance.now() - t0) / 8;
}
// Emit: a few particles a step of the species poured, at random in a small disc at the pointer (about as wide as they
// need), its speed theirs; written after the live ones, up to the room
function emit() {
  const k = Math.min(EMIT * set.steps, cap - live); if (k <= 0) return;
  const s = new Float32Array(k * 8), R = world.s * Math.sqrt(k);
  for (let i = 0; i < k; i++) { const a = Math.random() * 2 * Math.PI, r = R * Math.sqrt(Math.random()); s.set([Math.min(world.a, Math.max(0, pointer.x + r * Math.cos(a))), Math.min(1, Math.max(0, pointer.y + r * Math.sin(a))), set.pour, 0, pointer.vx, pointer.vy], i * 8); }
  device.queue.writeBuffer(states[flip], live * 32, s); live += k;
}
// The deleted packed out: the particles read back (no step meanwhile), the live ones written again side by side
let packing = false;
async function pack() {
  if (packing) return;
  packing = true;
  const S = await readState(), kept = [];
  for (let i = 0; i < live; i++) if (S[i * 8 + 2] < DEAD) kept.push(S.subarray(i * 8, i * 8 + 8));
  const out = new Float32Array(kept.length * 8); kept.forEach((p, i) => out.set(p, i * 8));
  device.queue.writeBuffer(states[flip], 0, out); live = kept.length; packing = false;
}
function frame(t) {
  // (the pointer's speed a step, no faster than the step can take)
  const [mx, my] = pointer.moved.map((d) => d / set.steps), fast = Math.max(1, Math.hypot(mx, my) / (CFL * world.h));
  [pointer.vx, pointer.vy] = [mx / fast, my / fast]; pointer.moved = [0, 0];
  if (pointer.down && set.tool === 'emit' && on) emit();
  if (pointer.down && set.tool === 'delete' && frames % 30 === 0) pack();
  write();
  if (on) steps(set.steps);
  draw();
  fps = fps * 0.95 + 50 / Math.max(1, t - last); last = t;
  if (++frames % 120 === 1 && on) measure();
  if (frames % 20 === 0) takeCensus();
  const c = census, sizes = c ? c.droplets.slice(0, 6).map((s) => s.toLocaleString('en')).join(', ') + (c.droplets.length > 6 ? ', …' : '') : '';
  document.getElementById('stats').textContent = `${live.toLocaleString('en')} particles${live >= cap ? ' (full)' : ''} · ${world.gx} × ${world.gy} bins · zoom ×${look.zoom.toFixed(1)}\n` + (c ? `food ${c.species[FOOD].toLocaleString('en')} · droplet ${c.species[DROP].toLocaleString('en')} · waste ${c.species[WASTE].toLocaleString('en')}\n${c.droplets.length} droplet${c.droplets.length === 1 ? '' : 's'}${sizes ? ` (${sizes})` : ''}\n` : '…\n') + `${msStep ? msStep.toFixed(2) : '…'} ms a step · ${fps.toFixed(0)} frames a second`;
  requestAnimationFrame(frame);
}
(async () => { await gpu(); fit(); panel(); restart(); requestAnimationFrame(frame); })();

/* ---- 1.7 Check ------------------------------------------------------------------------------- */

// One GPU step (bins) against the same step on the CPU (every pair, no bins, the reactions with rates high enough to
// fire often), the largest difference in places and speeds and the species that differ, F + D + W = n; then a run of
// 16,384 particles from one droplet, its census every 500 steps (F + D + W = n each time) till the droplets are two or
// more (a division), 40,000 steps at most; back to the setting shown
window.protocellsCheck = async () => {
  const playing = on, was = { ...set };
  on = false; // (the loop stepping meanwhile would change what is read)
  try {
    Object.assign(set, { n: 4096, start: 'droplet', heat: 0.02 }); restart();
    for (let i = 0; i < 200; i++) { write(); steps(1); }
    Object.assign(set, { grow: 0.5, decay: 0.2, recycle: 0.5 });
    const step = await checkStep();
    Object.assign(set, was, { n: 16384, start: 'droplet' }); restart(); write();
    let division = false, kept = true, line = [];
    for (let s = 500; s <= 40000 && !division; s += 500) {
      steps(500);
      const c = censusOf(await readState(), live), sum = c.species[FOOD] + c.species[DROP] + c.species[WASTE];
      kept &&= sum === live; line.push(c.droplets.length);
      if (c.droplets.length >= 2) { division = true; console.log(`protocellsCheck: ${s} steps from one droplet of ${live} particles: ${c.droplets.length} droplets (${c.droplets.join(', ')} particles), food ${c.species[FOOD]}, droplet ${c.species[DROP]}, waste ${c.species[WASTE]}`); }
    }
    console.log(`protocellsCheck: droplets every 500 steps ${line.join(' ')}; F + D + W = n each time: ${kept ? 'ok' : 'FAILED'}; a division: ${division ? 'ok' : 'FAILED'}`);
    return step && kept && division;
  } finally { Object.assign(set, was); restart(); on = playing; }
};
async function checkStep() {
  pointer.down = false; write();
  const S = await readState(), clock = await readClock(), n = live, f = Math.fround, { h, a } = world, want = new Float32Array(S.length);
  const M = S.slice();
  for (let i = 0; i < n; i++) {
    const kick = (salt) => f(f(f(random(i, clock, salt) - 0.5) * f(set.heat)) * f(h));
    const vx = f(S[i * 8 + 4] + kick(1)), vy = f(S[i * 8 + 5] + kick(2)); M[i * 8 + 4] = vx; M[i * 8 + 5] = vy; M[i * 8] = f(S[i * 8] + vx); M[i * 8 + 1] = f(S[i * 8 + 1] + vy);
  }
  const way = (ex, ey, l, i, j) => { if (l > 0) return [ex / l, ey / l]; const a = ((Math.imul(Math.min(i, j), 2654435761) + Math.max(i, j)) >>> 8) * ((2 * Math.PI) / 16777216), s = i < j ? 1 : -1; return [Math.cos(a) * s, Math.sin(a) * s]; };
  const D = new Float64Array(n * 4);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (j === i) continue;
    const d = Math.hypot(M[j * 8] - M[i * 8], M[j * 8 + 1] - M[i * 8 + 1]) / h;
    if (d < 1) { const w = 1 - d; D[i * 4] += w * w; D[i * 4 + 1] += w * w * w; D[i * 4 + 2] += w; D[i * 4 + 3] += M[j * 8 + 2] === DROP ? 1 : 0; }
  }
  const gaps = (i) => [M[i * 8], f(a) - M[i * 8], M[i * 8 + 1], 1 - M[i * 8 + 1]], OUT = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (let i = 0; i < n; i++) for (const g of gaps(i)) { const d = (2 * g) / h; if (d < 1) { const w = 1 - d; D[i * 4] += w * w; D[i * 4 + 1] += w * w * w; D[i * 4 + 2] += w; } }
  const rates = [set.grow, set.decay, set.recycle].map(f), fired = [0, 0, 0];
  const react = (k, drops, u) => (k === FOOD && drops >= TOUCH && u < rates[0] ? DROP : k === DROP && u < rates[1] ? WASTE : k === WASTE && drops === 0 && u < rates[2] ? FOOD : k);
  for (let i = 0; i < n; i++) {
    const xi = M[i * 8], yi = M[i * 8 + 1], vx = M[i * 8 + 4], vy = M[i * 8 + 5], ki = M[i * 8 + 2];
    let dx = 0, dy = 0;
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const ex = M[j * 8] - xi, ey = M[j * 8 + 1] - yi, l = Math.hypot(ex, ey), r = l / h;
      if (r < 1) {
        const [ux, uy] = way(ex, ey, l, i, j), w = 1 - r;
        const pressure = set.stiffness * ((D[i * 4] + D[j * 4]) / 2 - ((M[j * 8 + 2] === DROP) === (ki === DROP) ? set.same : set.other)) * w + set.near * ((D[i * 4 + 1] + D[j * 4 + 1]) / 2) * w * w;
        const closing = ((vx - M[j * 8 + 4]) * ux + (vy - M[j * 8 + 5]) * uy) / h;
        const viscous = closing > 0 ? (w * (set.viscosity * closing + BETA * closing * closing)) / Math.max(D[i * 4 + 2], D[j * 4 + 2]) : 0, k = h * (pressure + viscous) * 0.5;
        dx -= ux * k; dy -= uy * k;
      }
    }
    gaps(i).forEach((g, k) => {
      const r = (2 * g) / h;
      if (r < 1) {
        const [ux, uy] = OUT[k], w = 1 - r, pressure = Math.max(0, set.stiffness * (D[i * 4] - set.same) * w + set.near * D[i * 4 + 1] * w * w);
        const closing = (2 * (vx * ux + vy * uy)) / h, viscous = closing > 0 ? (w * (set.viscosity * closing + BETA * closing * closing)) / D[i * 4 + 2] : 0;
        dx -= ux * h * (pressure + viscous) * 0.5; dy -= uy * h * (pressure + viscous) * 0.5;
      }
    });
    const x = Math.min(a, Math.max(0, xi + dx)), y = Math.min(1, Math.max(0, yi + dy)), k = react(ki, D[i * 4 + 3], random(i, clock, 3));
    if (k !== ki) fired[ki]++;
    want.set([x, y, k, 0, x - (xi - vx), y - (yi - vy), 0, 0], i * 8);
  }
  write(); steps(1);
  const got = await readState(), census = censusOf(got, n);
  let worst = 0, species = 0;
  for (let i = 0; i < n; i++) for (let c = 0; c < 8; c++) { if (c === 2) species += got[i * 8 + 2] !== want[i * 8 + 2]; else worst = Math.max(worst, Math.abs(got[i * 8 + c] - want[i * 8 + c])); }
  const sum = census.species[FOOD] + census.species[DROP] + census.species[WASTE], ok = worst < 1e-5 && species === 0 && sum === n && fired.every((c) => c > 0);
  console.log(`protocellsCheck: one step of ${n} particles, GPU (bins) against CPU (every pair), largest difference ${worst.toExponential(2)} (the reach ${h.toExponential(2)}), ${species} species differing (F to D ${fired[FOOD]}, D to W ${fired[DROP]}, W to F ${fired[WASTE]} on the CPU); F ${census.species[FOOD]} + D ${census.species[DROP]} + W ${census.species[WASTE]} = ${sum} (n ${n}): ${ok ? 'ok' : 'FAILED'}`);
  return ok;
}
