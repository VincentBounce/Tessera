/* ==============================================================================================
 * LIQUID — liquid.js
 * ==============================================================================================
 *
 * Four liquids of different weights in a box (its height 1, its width the screen's aspect), each
 * a crowd of particles moved by Clavet, Beaudoin and Poulin's double density relaxation (2005):
 * a step adds gravity to the speeds, moves each particle by its speed, then pushes each pair
 * closer than the reach h apart by the pressure of their density against the rest density, and
 * the speed is what the step did (the place now less the place before). Lengths in the push are
 * in reaches, a step the unit of time.
 * A particle's density: Σ (1 − q)² over its neighbours (q their distance in reaches), its near
 * density Σ (1 − q)³. A pair's push D = h ((k (ρ̄ − ρ₀) (1 − q) + kₙ ρ̄ₙ (1 − q)²), their densities
 * averaged, ρ₀ the rest density of the pair (one for two of a liquid, another, lower, for two
 * liquids: they shun each other, layers), plus Clavet's viscosity when they close in (σ u + β u²,
 * u their closing speed). Each takes the share of the other's mass: a heavy particle moves less
 * under the same pressure, and sinks.
 * The paper pushes the pairs one after another (each push seen by the next): a GPU pushes every
 * particle at once (Jacobi), each from the densities and places at the step's start, the pair's
 * push the same from both sides (the momentum kept). Small steps, a few a frame, keep it stable:
 * Jacobi's gain grows with the stiffness and the density, so the stiffnesses are small, gravity is the weight on
 * the bottom (the same squeeze whatever the count) and the pointer moves nothing faster than CFL reaches a step.
 * The walls are mirrors: a particle near one feels its own image beyond it (pushed only, never pulled), so it never
 * reaches it (a wall that only stopped particles gathered them in its corners, their density blowing the rest away).
 * WebGPU, a step in seven compute passes: the particles moved, counted into bins a reach wide
 * (the box's grid), the bins' starts summed, the particles sorted by bin (places and speeds
 * copied in that order), each one's densities, then each one pushed by those in the bins round
 * its own. Drawn as soft discs summed into a picture, the liquid where the sum passes a threshold
 * (metaballs), each pixel the colour of the liquids under it.
 * liquidCheck() in the console: one GPU step against the same step on the CPU (every pair, no
 * bins), and four layers settled from a scatter, the heaviest at the bottom.
 */

/* ---- 1.1 Setting ----------------------------------------------------------------------------- */

const COUNTS = [4096, 16384, 65536, 262144], STEPS = [1, 2, 4, 8], TOOLS = ['drag', 'attract', 'repel'];
const MASSES = [1, 1.6, 2.5, 4], COLOURS = [[1, 0.82, 0.3], [0.35, 0.85, 0.45], [0.35, 0.6, 1], [0.9, 0.35, 0.65]];
const BETA = 0.3, FILL = 0.5, REST = 4, THRESHOLD = 1, PULL = 0.004, CFL = 0.3; // (CFL: the fastest a step can move a
// particle, in reaches, and stay stable)
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
// The setting from the link: #n=65536&steps=4&seed=1&gravity=0.03&stiffness=0.01&near=0.02&same=4&other=3&viscosity=0.1&brush=0.1
const hash = Object.fromEntries(new URLSearchParams(location.hash.slice(1)));
const num = (v, d) => (v === undefined || v === '' || isNaN(+v) ? d : +v);
const set = { n: COUNTS.includes(+hash.n) ? +hash.n : 65536, steps: STEPS.includes(+hash.steps) ? +hash.steps : 4, seed: +hash.seed || 1, gravity: num(hash.gravity, 0.03), stiffness: num(hash.stiffness, 0.01), near: num(hash.near, 0.02), same: num(hash.same, REST), other: num(hash.other, 3), viscosity: num(hash.viscosity, 0.1), brush: num(hash.brush, 0.1), tool: 'drag' };
const keep = () => { const { tool, ...h } = set; history.replaceState(null, '', '#' + new URLSearchParams(h)); };
// The box and its reach, fixed by a scatter: its width a (the screen's aspect then), the reach h such that n particles at
// the rest density fill FILL of it, the grid of bins (each a reach wide at least)
let world = null;
function box() {
  const a = Math.min(3, Math.max(0.5, view.clientWidth / Math.max(1, view.clientHeight)));
  const h = Math.sqrt((FILL * a) / set.n) * Math.sqrt((6 * REST) / Math.PI); // (ρ = (π/6) (h/s)² at a spacing s)
  const gx = Math.max(3, Math.floor(a / h)), gy = Math.max(3, Math.floor(1 / h));
  return { a, h, gx, gy, bins: gx * gy };
}
// Gravity's pull on a particle in reaches a step²: the slider is the weight on the bottom (the pull times the box's
// height in reaches), the same whatever the count (a fixed pull would squeeze a taller column of reaches more, till
// the step blows up)
const pull = () => set.gravity * world.h;

/* ---- 1.2 Shaders ----------------------------------------------------------------------------- */

const PARAMS = `
struct Params { a: vec4u, f: vec4f, k: vec4f, v: vec4f, p: vec4f, q: vec4f, m: vec4f, s: vec4f };
// a: n, the grid's columns and rows, bins; f: the reach h, a bin's width and height, the box's width; k: stiffness, near
// stiffness, rest density of one liquid, of two; v: gravity (reaches a step²), viscosity σ, β; p: the pointer's place,
// its brush (radius), its pull; q: its speed (a step), its tool (0 none, 1 drag, 2 attract, 3 repel); m: the four masses;
// s: pixels a unit of the box, the canvas' width and height, the liquid's threshold`;
const COMPUTE = PARAMS + `
@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read_write> state: array<vec4f>; // a particle i: place 2i (its liquid in z), speed 2i + 1
@group(0) @binding(2) var<storage, read_write> next: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> near: array<vec4f>;  // the places and speeds in the bins' order
@group(0) @binding(4) var<storage, read_write> count: array<atomic<u32>>;
@group(0) @binding(5) var<storage, read_write> start: array<u32>;
@group(0) @binding(6) var<storage, read_write> at: array<vec2u>;    // a particle's bin and place in it
@group(0) @binding(7) var<storage, read_write> sorted: array<u32>;
@group(0) @binding(8) var<storage, read_write> dens: array<vec2f>;  // the densities in the bins' order
fn cellOf(p: vec2f) -> vec2i { return clamp(vec2i(floor(p / P.f.yz)), vec2i(0), vec2i(P.a.yz) - 1); }
fn binOf(c: vec2i) -> u32 { return u32(c.y * i32(P.a.y) + c.x); }
fn inGrid(c: vec2i) -> bool { return all(c >= vec2i(0)) && all(c < vec2i(P.a.yz)); }
// One particle: gravity and the pointer's tool on its speed, then moved by it
@compute @workgroup_size(256) fn advance(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x; if (i >= P.a.x) { return; }
  let x = state[2u * i]; var v = state[2u * i + 1u].xy; let h = P.f.x;
  v.y -= P.v.x * h;
  let d = P.p.xy - x.xy; let l = length(d);
  if (P.q.z > 0.0 && l < P.p.z) {
    let w = 1.0 - l / P.p.z;
    if (P.q.z == 1.0) { v = mix(v, P.q.xy, w * 0.3); }
    else if (l > 0.0) { v += d / l * w * P.p.w * h * select(1.0, -1.0, P.q.z == 3.0); }
  }
  state[2u * i] = vec4f(x.xy + v, x.zw); state[2u * i + 1u] = vec4f(v, 0.0, 0.0);
}
@compute @workgroup_size(256) fn clear(@builtin(global_invocation_id) id: vec3u) {
  if (id.x < P.a.w) { atomicStore(&count[id.x], 0u); }
}
@compute @workgroup_size(256) fn tally(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x; if (i >= P.a.x) { return; }
  let b = binOf(cellOf(state[2u * i].xy));
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
// liquid, its density, its speed mirrored), so it is pushed off before it reaches it; wall k (left, right, bottom, top):
// its gap to p and the way out through it
fn wallGap(p: vec2f, k: u32) -> f32 { var g = array(p.x, P.f.w - p.x, p.y, 1.0 - p.y); return g[k]; }
fn wallOut(k: u32) -> vec2f { var o = array(vec2f(-1.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, -1.0), vec2f(0.0, 1.0)); return o[k]; }
// One particle (in the bins' order): its density and near density from those in the bins round its own
@compute @workgroup_size(128) fn density(@builtin(global_invocation_id) id: vec3u) {
  let s = id.x; if (s >= P.a.x) { return; }
  let p = near[2u * s].xy; let c = cellOf(p); var r = vec2f(0.0);
  for (var dy = -1; dy <= 1; dy++) { for (var dx = -1; dx <= 1; dx++) {
    let q = c + vec2i(dx, dy); if (!inGrid(q)) { continue; }
    let b = binOf(q);
    for (var t = start[b]; t < start[b + 1u]; t++) {
      if (t == s) { continue; }
      let d = length(near[2u * t].xy - p) / P.f.x;
      if (d < 1.0) { let w = 1.0 - d; r += vec2f(w * w, w * w * w); }
    }
  } }
  for (var k = 0u; k < 4u; k++) { let d = 2.0 * wallGap(p, k) / P.f.x; if (d < 1.0) { let w = 1.0 - d; r += vec2f(w * w, w * w * w); } }
  dens[s] = r;
}
// The way from particle i to particle j, e apart (l long); two at one place (the walls' corners gather them) a way
// known by their names, opposite for each, never none (else they never part, more pile on them, and their density
// blows their neighbours away)
fn way(e: vec2f, l: f32, i: u32, j: u32) -> vec2f {
  if (l > 0.0) { return e / l; }
  let a = f32((min(i, j) * 2654435761u + max(i, j)) >> 8u) * (6.2831853 / 16777216.0);
  return vec2f(cos(a), sin(a)) * select(-1.0, 1.0, i < j);
}
// One particle (in the bins' order): pushed by each pair's pressure and viscosity, its share by the masses, kept in the
// box; its speed what the step did
@compute @workgroup_size(128) fn relax(@builtin(global_invocation_id) id: vec3u) {
  let s = id.x; if (s >= P.a.x) { return; }
  let me = near[2u * s]; let v = near[2u * s + 1u].xy; let ri = dens[s]; let mi = P.m[u32(me.z)]; let h = P.f.x;
  let c = cellOf(me.xy); var dx = vec2f(0.0); let i = sorted[s];
  for (var dy = -1; dy <= 1; dy++) { for (var ex = -1; ex <= 1; ex++) {
    let q = c + vec2i(ex, dy); if (!inGrid(q)) { continue; }
    let b = binOf(q);
    for (var t = start[b]; t < start[b + 1u]; t++) {
      if (t == s) { continue; }
      let o = near[2u * t]; let e = o.xy - me.xy; let l = length(e); let r = l / h;
      if (r < 1.0) {
        let u = way(e, l, i, sorted[t]); let w = 1.0 - r; let rj = dens[t]; let mj = P.m[u32(o.z)];
        let pressure = P.k.x * ((ri.x + rj.x) * 0.5 - select(P.k.w, P.k.z, o.z == me.z)) * w + P.k.y * (ri.y + rj.y) * 0.5 * w * w;
        let closing = dot(v - near[2u * t + 1u].xy, u) / h;
        let viscous = select(0.0, w * (P.v.y * closing + P.v.z * closing * closing), closing > 0.0);
        dx -= u * h * (pressure + viscous) * mj / (mi + mj);
      }
    }
  } }
  // (its image's push: the same, its share a half: the image moving as much the other way; never a pull: a wall
  // pushes only, else an under-dense liquid sticks to it)
  for (var k = 0u; k < 4u; k++) {
    let r = 2.0 * wallGap(me.xy, k) / h;
    if (r < 1.0) {
      let u = wallOut(k); let w = 1.0 - r;
      let pressure = max(0.0, P.k.x * (ri.x - P.k.z) * w + P.k.y * ri.y * w * w);
      let closing = 2.0 * dot(v, u) / h;
      let viscous = select(0.0, w * (P.v.y * closing + P.v.z * closing * closing), closing > 0.0);
      dx -= u * h * (pressure + viscous) * 0.5;
    }
  }
  let x = clamp(me.xy + dx, vec2f(0.0), vec2f(P.f.w, 1.0));
  next[2u * i] = vec4f(x, me.zw); next[2u * i + 1u] = vec4f(x - (me.xy - v), 0.0, 0.0);
}`;
// A particle drawn as a soft disc (its weight (1 − d²)² in alpha, its liquid's colour times it), summed into a picture;
// the box letterboxed in the canvas
const DRAW = PARAMS + `
@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read> s: array<vec4f>;
@group(0) @binding(2) var<uniform> colour: array<vec4f, 4>;
struct Out { @builtin(position) pos: vec4f, @location(0) uv: vec2f, @location(1) c: vec3f };
fn origin() -> vec2f { return (P.s.yz - vec2f(P.f.w, 1.0) * P.s.x) * 0.5; }
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> Out {
  var corners = array(vec2f(-1, -1), vec2f(1, -1), vec2f(-1, 1), vec2f(-1, 1), vec2f(1, -1), vec2f(1, 1));
  let p = s[2u * ii]; var o: Out; o.uv = corners[vi]; o.c = colour[u32(p.z)].rgb;
  let px = origin() + (p.xy + o.uv * P.f.x * 0.6) * P.s.x;
  o.pos = vec4f(px / P.s.yz * 2.0 - 1.0, 0.0, 1.0);
  return o;
}
@fragment fn fs(i: Out) -> @location(0) vec4f {
  let d = dot(i.uv, i.uv); if (d > 1.0) { discard; }
  let w = (1.0 - d) * (1.0 - d); return vec4f(i.c * w, w);
}
@group(0) @binding(3) var picture: texture_2d<f32>;
@vertex fn full(@builtin(vertex_index) v: u32) -> @builtin(position) vec4f { return vec4f(f32(v & 1u) * 4.0 - 1.0, f32(v >> 1u) * 4.0 - 1.0, 0.0, 1.0); }
// The liquid where the summed weight passes the threshold (its edge smoothed), the mean colour under it, deeper where
// thicker; the box's background, darker outside
@fragment fn show(@builtin(position) px: vec4f) -> @location(0) vec4f {
  let t = textureLoad(picture, vec2i(px.xy), 0); let at = (vec2f(px.x, P.s.z - px.y) - origin()) / P.s.x;
  let inside = all(at >= vec2f(0.0)) && all(at <= vec2f(P.f.w, 1.0));
  let bg = select(vec3f(0.02, 0.022, 0.03), vec3f(0.05, 0.055, 0.075), inside);
  if (t.a < 1e-4) { return vec4f(bg, 1.0); }
  let T = P.s.w; let body = t.rgb / t.a * (0.65 + 0.35 * smoothstep(T, 3.0 * T, t.a));
  return vec4f(mix(bg, body, smoothstep(T * 0.85, T * 1.15, t.a)), 1.0);
}`;
const PICTURE = 'rgba16float';

/* ---- 1.3 GPU --------------------------------------------------------------------------------- */

const view = document.getElementById('view');
const fail = (text) => { const f = document.getElementById('fail'); f.style.display = 'flex'; f.textContent = text; throw new Error(text); };
let device, context, format, pipes, drawPipe, showPipe, params, colourBuf, states = [], bins = {}, groups = [], drawGroups = [], picture = null, showGroup, flip = 0;
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
  pipes = Object.fromEntries(['advance', 'clear', 'tally', 'scan', 'place', 'density', 'relax'].map((e) => [e, device.createComputePipeline({ layout: pl, compute: { module: cm, entryPoint: e } })]));
  pipes.layout = layout;
  const add = { srcFactor: 'one', dstFactor: 'one' };
  drawPipe = device.createRenderPipeline({ layout: 'auto', vertex: { module: dm, entryPoint: 'vs' }, fragment: { module: dm, entryPoint: 'fs', targets: [{ format: PICTURE, blend: { color: add, alpha: add } }] }, primitive: { topology: 'triangle-list' } });
  showPipe = device.createRenderPipeline({ layout: 'auto', vertex: { module: dm, entryPoint: 'full' }, fragment: { module: dm, entryPoint: 'show', targets: [{ format }] } });
  params = device.createBuffer({ size: 128, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  colourBuf = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(colourBuf, 0, Float32Array.from(COLOURS.flatMap((c) => [...c, 1])));
}
const buffer = (bytes) => device.createBuffer({ size: Math.max(16, bytes), usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
// A fresh box: n particles at random places over it (the seed's), at rest, the liquids in turn; its bins and bind groups
function scatter() {
  world = box();
  const r = mulberry32(set.seed), s = new Float32Array(set.n * 8);
  for (let i = 0; i < set.n; i++) s.set([r() * world.a, r(), i % 4, 0], i * 8);
  for (const b of [...states, ...Object.values(bins)]) b.destroy();
  states = [0, 1].map(() => buffer(s.byteLength)); device.queue.writeBuffer(states[0], 0, s);
  bins = { near: buffer(set.n * 32), count: buffer(world.bins * 4), start: buffer((world.bins + 1) * 4), at: buffer(set.n * 8), sorted: buffer(set.n * 4), dens: buffer(set.n * 8) };
  groups = [0, 1].map((f) => device.createBindGroup({ layout: pipes.layout, entries: [params, states[f], states[1 - f], bins.near, bins.count, bins.start, bins.at, bins.sorted, bins.dens].map((buffer, binding) => ({ binding, resource: { buffer } })) }));
  drawGroups = [];
  flip = 0;
}
// The parameters for a step and a drawing
function write() {
  const w = view.width, h = view.height, buf = new ArrayBuffer(128), u = new Uint32Array(buf), f = new Float32Array(buf);
  u.set([set.n, world.gx, world.gy, world.bins]);
  f.set([world.h, world.a / world.gx, 1 / world.gy, world.a, set.stiffness, set.near, set.same, set.other, pull(), set.viscosity, BETA, 0], 4);
  f.set([pointer.x, pointer.y, set.brush, PULL, pointer.vx, pointer.vy, pointer.down ? TOOLS.indexOf(set.tool) + 1 : 0, 0, ...MASSES, Math.min(w / world.a, h), w, h, THRESHOLD], 16);
  device.queue.writeBuffer(params, 0, buf);
}
// `count` steps in one submission: each seven passes
function steps(count) {
  const enc = device.createCommandEncoder(), n = Math.ceil(set.n / 256), m = Math.ceil(set.n / 128);
  for (let s = 0; s < count; s++) {
    const pass = enc.beginComputePass();
    pass.setBindGroup(0, groups[flip]);
    pass.setPipeline(pipes.advance); pass.dispatchWorkgroups(n);
    pass.setPipeline(pipes.clear); pass.dispatchWorkgroups(Math.ceil(world.bins / 256));
    pass.setPipeline(pipes.tally); pass.dispatchWorkgroups(n);
    pass.setPipeline(pipes.scan); pass.dispatchWorkgroups(1);
    pass.setPipeline(pipes.place); pass.dispatchWorkgroups(n);
    pass.setPipeline(pipes.density); pass.dispatchWorkgroups(m);
    pass.setPipeline(pipes.relax); pass.dispatchWorkgroups(m);
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
    showGroup = device.createBindGroup({ layout: showPipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: params } }, { binding: 3, resource: picture.createView() }] });
  }
  if (!drawGroups.length) drawGroups = [0, 1].map((f) => device.createBindGroup({ layout: drawPipe.getBindGroupLayout(0), entries: [params, states[f], colourBuf].map((buffer, binding) => ({ binding, resource: { buffer } })) }));
  const enc = device.createCommandEncoder();
  const pass = enc.beginRenderPass({ colorAttachments: [{ view: picture.createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 0 } }] });
  pass.setPipeline(drawPipe); pass.setBindGroup(0, drawGroups[flip]); pass.draw(6, set.n); pass.end();
  const out = enc.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }] });
  out.setPipeline(showPipe); out.setBindGroup(0, showGroup); out.draw(3); out.end();
  device.queue.submit([enc.finish()]);
}

/* ---- 1.4 Panel ------------------------------------------------------------------------------- */

// One choice among several: a tab group (Lenia Worlds' .tabs)
const tabs = (el, values, get, pick, name = (v) => v) => {
  el.innerHTML = '';
  for (const v of values) { const b = document.createElement('button'); b.className = 'btn'; b.textContent = name(v); b.onclick = () => pick(v); el.append(b); }
  const mark = () => [...el.children].forEach((b, i) => b.classList.toggle('on', values[i] === get()));
  mark(); return mark;
};
// The pointer in the box's units, its speed a step (the frame's move shared by its steps), its tool on while pressed
const pointer = { x: 0, y: 0, vx: 0, vy: 0, down: false, moved: [0, 0] };
const toBox = (e) => { const r = view.getBoundingClientRect(), sc = Math.min(r.width / world.a, r.height); return [(e.clientX - r.left - (r.width - world.a * sc) / 2) / sc, (r.bottom - e.clientY - (r.height - sc) / 2) / sc]; };
let on = true;
function panel() {
  const markCounts = tabs(document.getElementById('counts'), COUNTS, () => set.n, (v) => { set.n = v; markCounts(); keep(); scatter(); }, (v) => v / 1024 + 'k');
  const markSteps = tabs(document.getElementById('steps'), STEPS, () => set.steps, (v) => { set.steps = v; markSteps(); keep(); });
  const markTools = tabs(document.getElementById('tools'), TOOLS, () => set.tool, (v) => { set.tool = v; markTools(); }, (v) => v[0].toUpperCase() + v.slice(1));
  document.getElementById('scatter').onclick = () => scatter();
  document.getElementById('play').onclick = (e) => { on = !on; e.target.textContent = on ? 'Pause' : 'Play'; };
  for (const id of ['brush', 'gravity', 'stiffness', 'near', 'same', 'other', 'viscosity']) {
    const input = document.getElementById(id), out = input.nextElementSibling;
    input.value = set[id]; out.textContent = set[id];
    input.oninput = () => { set[id] = +input.value; out.textContent = input.value; keep(); };
  }
  view.onpointerdown = (e) => { [pointer.x, pointer.y] = toBox(e); pointer.moved = [0, 0]; pointer.down = true; view.setPointerCapture(e.pointerId); };
  view.onpointermove = (e) => { const [x, y] = toBox(e); pointer.moved[0] += x - pointer.x; pointer.moved[1] += y - pointer.y; pointer.x = x; pointer.y = y; };
  view.onpointerup = view.onpointercancel = () => { pointer.down = false; };
}

/* ---- 1.5 Loop -------------------------------------------------------------------------------- */

const fit = () => { const r = view.getBoundingClientRect(), d = devicePixelRatio || 1; view.width = Math.max(1, Math.round(r.width * d)); view.height = Math.max(1, Math.round(r.height * d)); };
addEventListener('resize', fit);
// A step's time, measured now and then: a batch of steps submitted alone, waited for
let msStep = 0, frames = 0, last = performance.now(), fps = 0;
async function measure() {
  write(); await device.queue.onSubmittedWorkDone();
  const t0 = performance.now(); steps(8); await device.queue.onSubmittedWorkDone(); msStep = (performance.now() - t0) / 8;
}
// The particles' places (liquid in z) and speeds, read back: 8 floats a particle
async function readState() {
  await device.queue.onSubmittedWorkDone();
  const b = device.createBuffer({ size: set.n * 32, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST }), e = device.createCommandEncoder();
  e.copyBufferToBuffer(states[flip], 0, b, 0, set.n * 32); device.queue.submit([e.finish()]);
  await b.mapAsync(GPUMapMode.READ); const a = new Float32Array(b.getMappedRange().slice(0)); b.destroy(); return a;
}
function frame(t) {
  // (the pointer's speed a step, no faster than the step can take)
  const [mx, my] = pointer.moved.map((d) => d / set.steps), fast = Math.max(1, Math.hypot(mx, my) / (CFL * world.h));
  [pointer.vx, pointer.vy] = [mx / fast, my / fast]; pointer.moved = [0, 0];
  write();
  if (on) steps(set.steps);
  draw();
  fps = fps * 0.95 + 50 / Math.max(1, t - last); last = t;
  if (++frames % 120 === 1 && on) measure();
  document.getElementById('stats').textContent = `${set.n.toLocaleString('en')} particles · ${world.gx} × ${world.gy} bins\n${msStep ? msStep.toFixed(2) : '…'} ms a step · ${fps.toFixed(0)} frames a second`;
  requestAnimationFrame(frame);
}
(async () => { await gpu(); fit(); panel(); scatter(); requestAnimationFrame(frame); })();

/* ---- 1.6 Check ------------------------------------------------------------------------------- */

// One GPU step (bins) against the same step on the CPU (every pair, no bins), the largest difference in places and
// speeds (at 4,096 particles, the CPU's every pair); then a fresh scatter of 4,096 run 3,000 steps: every particle in
// the box, and the liquids' mean heights in the order of their weights (the lightest on top); back to the setting shown
window.liquidCheck = async () => {
  const playing = on, was = set.n;
  on = false; // (the loop stepping meanwhile would change what is read)
  try {
    set.n = 4096; scatter();
    for (let i = 0; i < 300; i++) { write(); steps(1); }
    const step = await checkStep();
    scatter(); write(); steps(3000);
    const S = await readState(), y = [0, 0, 0, 0], c = [0, 0, 0, 0];
    let out = 0;
    for (let i = 0; i < set.n; i++) { const x = S[i * 8], h = S[i * 8 + 1]; if (!(x >= 0 && x <= world.a && h >= 0 && h <= 1)) out++; y[S[i * 8 + 2]] += h; c[S[i * 8 + 2]]++; }
    const mean = y.map((v, k) => v / c[k]), layered = mean.every((v, k) => !k || v < mean[k - 1]);
    console.log(`liquidCheck: 3,000 steps of ${set.n} particles from a scatter: ${out} out of the box, mean heights ${mean.map((v) => v.toFixed(3)).join(' > ')} (lightest to heaviest): ${!out && layered ? 'ok' : 'FAILED'}`);
    return step && !out && layered;
  } finally { set.n = was; scatter(); on = playing; }
};
async function checkStep() {
  pointer.down = false; write();
  const S = await readState(), n = set.n, f = Math.fround, { h, a } = world, want = new Float32Array(S.length);
  const M = S.slice();
  for (let i = 0; i < n; i++) { const vy = f(S[i * 8 + 5] - f(f(pull()) * f(h))); M[i * 8 + 5] = vy; M[i * 8] = f(S[i * 8] + S[i * 8 + 4]); M[i * 8 + 1] = f(S[i * 8 + 1] + vy); }
  const way = (ex, ey, l, i, j) => { if (l > 0) return [ex / l, ey / l]; const a = ((Math.imul(Math.min(i, j), 2654435761) + Math.max(i, j)) >>> 8) * ((2 * Math.PI) / 16777216), s = i < j ? 1 : -1; return [Math.cos(a) * s, Math.sin(a) * s]; };
  const D = new Float64Array(n * 2);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (j === i) continue;
    const d = Math.hypot(M[j * 8] - M[i * 8], M[j * 8 + 1] - M[i * 8 + 1]) / h;
    if (d < 1) { const w = 1 - d; D[i * 2] += w * w; D[i * 2 + 1] += w * w * w; }
  }
  const gaps = (i) => [M[i * 8], f(a) - M[i * 8], M[i * 8 + 1], 1 - M[i * 8 + 1]], OUT = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (let i = 0; i < n; i++) for (const g of gaps(i)) { const d = (2 * g) / h; if (d < 1) { const w = 1 - d; D[i * 2] += w * w; D[i * 2 + 1] += w * w * w; } }
  for (let i = 0; i < n; i++) {
    const xi = M[i * 8], yi = M[i * 8 + 1], vx = M[i * 8 + 4], vy = M[i * 8 + 5], mi = MASSES[M[i * 8 + 2]];
    let dx = 0, dy = 0;
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const ex = M[j * 8] - xi, ey = M[j * 8 + 1] - yi, l = Math.hypot(ex, ey), r = l / h;
      if (r < 1) {
        const [ux, uy] = way(ex, ey, l, i, j), w = 1 - r, mj = MASSES[M[j * 8 + 2]];
        const pressure = set.stiffness * ((D[i * 2] + D[j * 2]) / 2 - (M[j * 8 + 2] === M[i * 8 + 2] ? set.same : set.other)) * w + set.near * ((D[i * 2 + 1] + D[j * 2 + 1]) / 2) * w * w;
        const closing = ((vx - M[j * 8 + 4]) * ux + (vy - M[j * 8 + 5]) * uy) / h;
        const viscous = closing > 0 ? w * (set.viscosity * closing + BETA * closing * closing) : 0, k = (h * (pressure + viscous) * mj) / (mi + mj);
        dx -= ux * k; dy -= uy * k;
      }
    }
    gaps(i).forEach((g, k) => {
      const r = (2 * g) / h;
      if (r < 1) {
        const [ux, uy] = OUT[k], w = 1 - r, pressure = Math.max(0, set.stiffness * (D[i * 2] - set.same) * w + set.near * D[i * 2 + 1] * w * w);
        const closing = (2 * (vx * ux + vy * uy)) / h, viscous = closing > 0 ? w * (set.viscosity * closing + BETA * closing * closing) : 0;
        dx -= ux * h * (pressure + viscous) * 0.5; dy -= uy * h * (pressure + viscous) * 0.5;
      }
    });
    const x = Math.min(a, Math.max(0, xi + dx)), y = Math.min(1, Math.max(0, yi + dy));
    want.set([x, y, M[i * 8 + 2], 0, x - (xi - vx), y - (yi - vy), 0, 0], i * 8);
  }
  steps(1);
  const got = await readState();
  let worst = 0;
  for (let i = 0; i < got.length; i++) worst = Math.max(worst, Math.abs(got[i] - want[i]));
  const ok = worst < 1e-5;
  console.log(`liquidCheck: one step of ${n} particles, GPU (bins) against CPU (every pair), largest difference ${worst.toExponential(2)} (the reach ${h.toExponential(2)}): ${ok ? 'ok' : 'FAILED'}`);
  return ok;
}
