/* ==============================================================================================
 * PARTICLE LIFE — particles.js
 * ==============================================================================================
 *
 * Particles of K kinds on a torus (the unit square, its sides glued) or a sphere (of area 1, as
 * the torus). Each kind feels each other kind by a rule a in [−1, 1] of the K × K matrix (not
 * symmetric: red may chase blue while blue flees red): within the reach, pushed apart when very
 * near (the first 30% of it, whatever a), then drawn (a > 0) or pushed (a < 0) by a tent peaking
 * at the middle of the rest (Tom Mohr's Particle Life). Velocities slowed by friction (halved
 * every `friction` seconds of the world).
 * The reach is set for 4,096 particles and shrinks with more (by √(4096/n)): each creature keeps
 * its particles, a larger crowd is a larger world, more creatures.
 * One geometry function a space: the way and distance from one particle to another (the torus:
 * the nearest image; the sphere: along the surface, the great circle's arc), and a move (the
 * torus: wrapped; the sphere: back onto it, the speed kept along it).
 * WebGPU, a step in five compute passes: the particles counted into bins a reach wide (the
 * torus: a square grid; the sphere: a cube's, round it), the bins' starts summed, the particles
 * sorted by bin (their places copied in that order, side by side in memory: a million 3 times
 * faster), then each particle feels those in the bins round its own only, and moves. Drawn as
 * quads, each its kind's colour, zoomed by the wheel (the sphere turned by a drag, its far side
 * dim; the torus moved over by a drag).
 * particlesCheck('both') in the console: one GPU step against the same step on the CPU (every
 * pair, no bins), each space.
 */

/* ---- 1.1 Setting ----------------------------------------------------------------------------- */

const KINDS = [3, 4, 5, 6, 7, 8], COUNTS = [4096, 16384, 65536, 262144, 1048576], SPACES = ['torus', 'sphere'], STEPS = [1, 2, 4, 8];
const BETA = 0.3, DT = 0.02, BASE = 4096;
const RHO = 1 / Math.sqrt(4 * Math.PI); // the sphere's radius: its area 1, as the torus'
const COLOURS = [[1, 0.35, 0.35], [0.35, 0.85, 0.4], [0.4, 0.6, 1], [1, 0.85, 0.3], [0.85, 0.45, 1], [0.3, 0.9, 0.95], [1, 0.6, 0.25], [0.9, 0.9, 0.9]];
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
// The setting from the link: #space=sphere&k=6&n=65536&seed=7&reach=0.1&friction=0.04&steps=2 and, once a rule is
// changed, m= its K² rules
const hash = Object.fromEntries(new URLSearchParams(location.hash.slice(1)));
const set = { space: SPACES.includes(hash.space) ? hash.space : 'torus', k: KINDS.includes(+hash.k) ? +hash.k : 6, n: COUNTS.includes(+hash.n) ? +hash.n : 65536, seed: +hash.seed || 1, reach: +hash.reach || 0.1, friction: +hash.friction || 0.04, steps: STEPS.includes(+hash.steps) ? +hash.steps : 1, m: hash.m ? hash.m.split(',').map(Number) : null };
const rules = () => set.m ?? (() => { const r = mulberry32(set.seed * 7919); return Array.from({ length: set.k * set.k }, () => Math.round((r() * 2 - 1) * 4) / 4); })();
let M = rules();
const keep = () => { const h = { space: set.space, k: set.k, n: set.n, seed: set.seed, reach: set.reach, friction: set.friction, steps: set.steps }; if (set.m) h.m = set.m.join(','); history.replaceState(null, '', '#' + new URLSearchParams(h)); };
// The reach in the world: the slider's, for 4,096, shrunk with the count
const reach = () => set.reach * Math.sqrt(BASE / set.n);

/* ---- 1.2 Shaders ----------------------------------------------------------------------------- */

const PARAMS = `
struct Params { a: vec4u, g: vec4u, f: vec4f, v: vec4f, t0: vec4f, t1: vec4f, t2: vec4f };
// a: n, k, sphere, bins; g: the grid's size; f: reach, damp, dt, a bin's side; v: scale x, y, a dot's half size x, y;
// t0..t2: the sphere's turn (columns), their w the zoom and, on the torus, the place shown in the middle
const RHO = ${RHO}; const BETA = ${BETA};`;
const COMPUTE = PARAMS + `
@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<uniform> R: array<vec4f, 16>;
@group(0) @binding(2) var<storage, read_write> sIn: array<vec4f>;   // a particle i: place 2i (its kind in w), speed 2i + 1
@group(0) @binding(3) var<storage, read_write> sOut: array<vec4f>;
@group(0) @binding(4) var<storage, read_write> near: array<vec4f>;  // the places (and kinds) in the bins' order
@group(0) @binding(5) var<storage, read_write> count: array<atomic<u32>>;
@group(0) @binding(6) var<storage, read_write> start: array<u32>;
@group(0) @binding(7) var<storage, read_write> at: array<vec2u>;    // a particle's bin and place in it
@group(0) @binding(8) var<storage, read_write> sorted: array<u32>;
fn rule(i: u32) -> f32 { return R[i / 4u][i % 4u]; }
fn force(r: f32, a: f32) -> f32 { if (r < BETA) { return r / BETA - 1.0; } return a * (1.0 - abs(2.0 * r - 1.0 - BETA) / (1.0 - BETA)); }
// The way from p to q (a unit vector, along the surface) in xyz and the distance in w
fn towards(p: vec3f, q: vec3f) -> vec4f {
  if (P.a.z == 1u) { let t = q - p * dot(p, q) / (RHO * RHO); let l = length(t); return vec4f(select(vec3f(0.0), t / l, l > 0.0), RHO * atan2(length(cross(p, q)), dot(p, q))); }
  var d = q.xy - p.xy; d -= round(d); let l = length(d); return vec4f(select(vec2f(0.0), d / l, l > 0.0), 0.0, l);
}
// A place's bin: the torus' square grid, the sphere's cube round it
fn cellOf(p: vec3f) -> vec3i {
  let g = vec3i(P.g.xyz);
  if (P.a.z == 1u) { return clamp(vec3i(floor((p + RHO) / P.f.w)), vec3i(0), g - 1); }
  return vec3i(clamp(vec2i(floor(p.xy / P.f.w)), vec2i(0), g.xy - 1), 0);
}
fn binOf(c: vec3i) -> u32 { return u32((c.z * i32(P.g.y) + c.y) * i32(P.g.x) + c.x); }
@compute @workgroup_size(256) fn clear(@builtin(global_invocation_id) id: vec3u) {
  if (id.x < P.a.w) { atomicStore(&count[id.x], 0u); }
}
@compute @workgroup_size(256) fn tally(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x; if (i >= P.a.x) { return; }
  let b = binOf(cellOf(sIn[2u * i].xyz));
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
  sorted[s] = i; near[s] = sIn[2u * i];
}
// One particle: the force of those in the bins round its own (wrapped on the torus; read in the bins' order, side by
// side in memory), then friction, speed and place
@compute @workgroup_size(128) fn feel(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x; if (i >= P.a.x) { return; }
  let sphere = P.a.z == 1u; let g = vec3i(P.g.xyz); let reach = P.f.x;
  let me = sIn[2u * i]; var p = me.xyz; var v = sIn[2u * i + 1u].xyz; var f = vec3f(0.0);
  let ki = u32(me.w) * P.a.y; let c = cellOf(p); let zr = select(0, 1, sphere);
  for (var dz = -zr; dz <= zr; dz++) { for (var dy = -1; dy <= 1; dy++) { for (var dx = -1; dx <= 1; dx++) {
    var q = c + vec3i(dx, dy, dz);
    if (sphere) { if (any(q < vec3i(0)) || any(q >= g)) { continue; } }
    else { q = vec3i((q.x + g.x) % g.x, (q.y + g.y) % g.y, 0); }
    let b = binOf(q);
    for (var s = start[b]; s < start[b + 1u]; s++) {
      if (sorted[s] == i) { continue; }
      let o = near[s]; let w = towards(p, o.xyz);
      if (w.w > 0.0 && w.w < reach) { f += w.xyz * force(w.w / reach, rule(ki + u32(o.w))); }
    }
  } } }
  v = v * P.f.y + f * reach * 10.0 * P.f.z;
  if (sphere) { p = normalize(p + v * P.f.z) * RHO; v -= p * dot(p, v) / (RHO * RHO); }
  else { p = vec3f(fract(p.xy + v.xy * P.f.z), 0.0); }
  sOut[2u * i] = vec4f(p, me.w); sOut[2u * i + 1u] = vec4f(v, 0.0);
}`;
// A particle drawn as a quad: the torus as its square round the place in the middle, wrapped; the sphere turned, its near
// side bright, its far side dim and small; both zoomed
const DRAW = PARAMS + `
@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read> s: array<vec4f>;
@group(0) @binding(2) var<uniform> colour: array<vec4f, 8>;
struct Out { @builtin(position) pos: vec4f, @location(0) uv: vec2f, @location(1) c: vec3f };
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> Out {
  var corners = array(vec2f(-1, -1), vec2f(1, -1), vec2f(-1, 1), vec2f(-1, 1), vec2f(1, -1), vec2f(1, 1));
  let p = s[2u * ii].xyz; var o: Out; o.uv = corners[vi]; o.c = colour[u32(s[2u * ii].w)].rgb;
  var centre: vec2f; var size = P.t0.w; var z = 0.0;
  if (P.a.z == 1u) {
    let q = mat3x3f(P.t0.xyz, P.t1.xyz, P.t2.xyz) * p / RHO;
    centre = q.xy * P.v.xy * 0.92 * P.t0.w; z = 0.5 - q.z * 0.5;
    if (q.z > 0.0) { size *= 0.6 + 0.4 * q.z; } else { size *= 0.6; o.c *= 0.22; }
  } else { centre = (fract(p.xy - vec2f(P.t1.w, P.t2.w) + 0.5) - 0.5) * 2.0 * P.t0.w * P.v.xy * vec2f(1.0, -1.0); }
  o.pos = vec4f(centre + o.uv * P.v.zw * size, z, 1.0);
  return o;
}
@fragment fn fs(i: Out) -> @location(0) vec4f {
  let d = dot(i.uv, i.uv); if (d > 1.0) { discard; }
  return vec4f(i.c * (1.0 - d), 1.0);
}`;

/* ---- 1.3 GPU --------------------------------------------------------------------------------- */

const view = document.getElementById('view');
const fail = (text) => { const f = document.getElementById('fail'); f.style.display = 'flex'; f.textContent = text; throw new Error(text); };
let device, context, format, pipes, drawPipe, params, ruleBuf, colourBuf, states = [], bins = {}, binCount = 0, groups = [], drawGroups = [], flip = 0;
async function gpu() {
  const adapter = navigator.gpu && (await navigator.gpu.requestAdapter());
  if (!adapter) fail('This page needs WebGPU (Chrome, Edge, or a recent Safari).');
  device = await adapter.requestDevice({ requiredLimits: { maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize, maxBufferSize: adapter.limits.maxBufferSize } });
  context = view.getContext('webgpu'); format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'opaque' });
  const cm = device.createShaderModule({ code: COMPUTE }), dm = device.createShaderModule({ code: DRAW });
  const S = GPUShaderStage, storage = (b) => ({ binding: b, visibility: S.COMPUTE, buffer: { type: 'storage' } });
  const layout = device.createBindGroupLayout({ entries: [{ binding: 0, visibility: S.COMPUTE, buffer: {} }, { binding: 1, visibility: S.COMPUTE, buffer: {} }, ...[2, 3, 4, 5, 6, 7, 8].map(storage)] });
  const pl = device.createPipelineLayout({ bindGroupLayouts: [layout] });
  pipes = Object.fromEntries(['clear', 'tally', 'scan', 'place', 'feel'].map((e) => [e, device.createComputePipeline({ layout: pl, compute: { module: cm, entryPoint: e } })]));
  pipes.layout = layout;
  drawPipe = device.createRenderPipeline({ layout: 'auto', vertex: { module: dm, entryPoint: 'vs' }, fragment: { module: dm, entryPoint: 'fs', targets: [{ format, blend: { color: { srcFactor: 'one', dstFactor: 'one' }, alpha: { srcFactor: 'one', dstFactor: 'one' } } }] }, primitive: { topology: 'triangle-list' } });
  params = device.createBuffer({ size: 112, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  ruleBuf = device.createBuffer({ size: 256, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  colourBuf = device.createBuffer({ size: 128, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(colourBuf, 0, Float32Array.from(COLOURS.flatMap((c) => [...c, 1])));
}
const buffer = (bytes, extra = 0) => device.createBuffer({ size: Math.max(16, bytes), usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC | extra });
// The grid of bins for the space and reach: each a reach wide at least
function grid() {
  const r = reach();
  if (set.space === 'sphere') { const G = Math.max(1, Math.floor((2 * RHO) / r)); return { g: [G, G, G], side: (2 * RHO) / G }; }
  const G = Math.max(3, Math.floor(1 / r)); return { g: [G, G, 1], side: 1 / G };
}
// A fresh world: n particles at random places (the seed's; on the sphere, evenly over it), at rest, their kinds in turn
// (each in its place's w)
function scatter() {
  const r = mulberry32(set.seed), s = new Float32Array(set.n * 8);
  for (let i = 0; i < set.n; i++) {
    if (set.space === 'sphere') { const z = r() * 2 - 1, a = r() * 2 * Math.PI, q = Math.sqrt(1 - z * z); s.set([q * Math.cos(a) * RHO, q * Math.sin(a) * RHO, z * RHO], i * 8); }
    else s.set([r(), r(), 0], i * 8);
    s[i * 8 + 3] = i % set.k;
  }
  for (const b of states) b.destroy();
  states = [0, 1].map(() => buffer(s.byteLength)); device.queue.writeBuffer(states[0], 0, s);
  rebin();
}
// The bins for the grid now (again when the reach or space changes), and the bind groups of both ways
function rebin() {
  const { g } = grid(), B = g[0] * g[1] * g[2];
  for (const b of Object.values(bins)) b.destroy();
  bins = { near: buffer(set.n * 16), count: buffer(B * 4), start: buffer((B + 1) * 4), at: buffer(set.n * 8), sorted: buffer(set.n * 4) };
  binCount = B;
  groups = [0, 1].map((f) => device.createBindGroup({ layout: pipes.layout, entries: [params, ruleBuf, states[f], states[1 - f], bins.near, bins.count, bins.start, bins.at, bins.sorted].map((buffer, binding) => ({ binding, resource: { buffer } })) }));
  drawGroups = [0, 1].map((f) => device.createBindGroup({ layout: drawPipe.getBindGroupLayout(0), entries: [params, states[f], colourBuf].map((buffer, binding) => ({ binding, resource: { buffer } })) }));
  flip = 0;
}
// The parameters for a step and a drawing
function write() {
  const { g, side } = grid(), w = view.width, h = view.height, m = Math.min(w, h), sphere = set.space === 'sphere';
  if (binCount !== g[0] * g[1] * g[2]) rebin();
  const dot = Math.max(1.5, (m * (sphere ? 0.92 * Math.sqrt(Math.PI) : 1)) / Math.sqrt(set.n) / 2.2) / 2;
  const buf = new ArrayBuffer(112), u = new Uint32Array(buf), f = new Float32Array(buf);
  u.set([set.n, set.k, sphere ? 1 : 0, binCount, ...g, 0]);
  f.set([reach(), Math.pow(0.5, DT / set.friction), DT, side, m / w, m / h, (dot * 2) / w, (dot * 2) / h, turn[0], turn[1], turn[2], look.zoom, turn[3], turn[4], turn[5], look.x, turn[6], turn[7], turn[8], look.y], 8);
  device.queue.writeBuffer(params, 0, buf);
  device.queue.writeBuffer(ruleBuf, 0, Float32Array.from({ length: 64 }, (_, i) => M[i] ?? 0));
}
// `count` steps, each its five passes, in one submission
function steps(count) {
  const enc = device.createCommandEncoder(), n = Math.ceil(set.n / 256);
  for (let s = 0; s < count; s++) {
    const pass = enc.beginComputePass();
    pass.setBindGroup(0, groups[flip]);
    pass.setPipeline(pipes.clear); pass.dispatchWorkgroups(Math.ceil(binCount / 256));
    pass.setPipeline(pipes.tally); pass.dispatchWorkgroups(n);
    pass.setPipeline(pipes.scan); pass.dispatchWorkgroups(1);
    pass.setPipeline(pipes.place); pass.dispatchWorkgroups(n);
    pass.setPipeline(pipes.feel); pass.dispatchWorkgroups(Math.ceil(set.n / 128));
    pass.end();
    flip = 1 - flip;
  }
  device.queue.submit([enc.finish()]);
}
function draw() {
  const enc = device.createCommandEncoder();
  const pass = enc.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0.03, g: 0.035, b: 0.05, a: 1 } }] });
  pass.setPipeline(drawPipe); pass.setBindGroup(0, drawGroups[flip]); pass.draw(6, set.n);
  pass.end();
  device.queue.submit([enc.finish()]);
}
// The sphere's turn: a rotation matrix (columns), changed by drags and the spin; the zoom (the wheel) and, on the torus,
// the place shown in the middle (moved by drags)
let turn = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const look = { zoom: 1, x: 0.5, y: 0.5 };
const rotate = (ax, ay) => {
  const cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay), X = [1, 0, 0, 0, cx, sx, 0, -sx, cx], Y = [cy, 0, -sy, 0, 1, 0, sy, 0, cy];
  const mul = (a, b) => Array.from({ length: 9 }, (_, i) => { const c = Math.floor(i / 3), r = i % 3; return a[r] * b[c * 3] + a[3 + r] * b[c * 3 + 1] + a[6 + r] * b[c * 3 + 2]; });
  turn = mul(Y, mul(X, turn));
};

/* ---- 1.4 Panel ------------------------------------------------------------------------------- */

// One choice among several: a tab group (Lenia Worlds' .tabs)
const tabs = (el, values, get, pick, name = (v) => v) => {
  el.innerHTML = '';
  for (const v of values) { const b = document.createElement('button'); b.className = 'btn'; b.textContent = name(v); b.onclick = () => pick(v); el.append(b); }
  const mark = () => [...el.children].forEach((b, i) => b.classList.toggle('on', values[i] === get()));
  mark(); return mark;
};
let markSpaces, markKinds, markCounts, markSteps;
// The rules as a K × K picture: rows the kind that feels, columns the kind felt (their colours on the edges)
const mat = document.getElementById('matrix'), mg = mat.getContext('2d'), CELL = 26;
function drawMatrix() {
  const k = set.k; mat.width = mat.height = (k + 1) * CELL; mat.style.width = mat.style.height = (k + 1) * CELL + 'px';
  mg.clearRect(0, 0, mat.width, mat.height);
  for (let i = 0; i < k; i++) {
    const c = `rgb(${COLOURS[i].map((x) => x * 255).join(',')})`;
    mg.fillStyle = c; mg.beginPath(); mg.arc(CELL / 2, (i + 1.5) * CELL, 6, 0, 7); mg.fill(); mg.beginPath(); mg.arc((i + 1.5) * CELL, CELL / 2, 6, 0, 7); mg.fill();
    for (let j = 0; j < k; j++) {
      const a = M[i * k + j];
      mg.fillStyle = a >= 0 ? `rgb(${40 - a * 20},${60 + a * 160},${50})` : `rgb(${60 - a * 170},${40},${45})`;
      mg.fillRect((j + 1) * CELL + 1, (i + 1) * CELL + 1, CELL - 2, CELL - 2);
    }
  }
}
mat.onclick = (e) => {
  const r = mat.getBoundingClientRect(), j = Math.floor((e.clientX - r.left) / CELL) - 1, i = Math.floor((e.clientY - r.top) / CELL) - 1;
  if (i < 0 || j < 0 || i >= set.k || j >= set.k) return;
  M[i * set.k + j] = Math.max(-1, Math.min(1, M[i * set.k + j] + (e.shiftKey ? -0.5 : 0.5)));
  set.m = M.slice(); keep(); drawMatrix();
};
let on = true, spin = true;
const spinButton = document.getElementById('spin');
function panel() {
  markSpaces = tabs(document.getElementById('spaces'), SPACES, () => set.space, (v) => { set.space = v; fresh(); }, (v) => v[0].toUpperCase() + v.slice(1));
  markKinds = tabs(document.getElementById('kinds'), KINDS, () => set.k, (v) => { set.k = v; set.m = null; M = rules(); fresh(); });
  markCounts = tabs(document.getElementById('counts'), COUNTS, () => set.n, (v) => { set.n = v; fresh(); }, (v) => (v >= 1048576 ? v / 1048576 + 'M' : v / 1024 + 'k'));
  markSteps = tabs(document.getElementById('steps'), STEPS, () => set.steps, (v) => { set.steps = v; markSteps(); keep(); });
  document.getElementById('newRules').onclick = () => { set.seed = 1 + Math.floor(Math.random() * 99999); set.m = null; M = rules(); fresh(); };
  document.getElementById('scatter').onclick = () => scatter();
  document.getElementById('play').onclick = (e) => { on = !on; e.target.textContent = on ? 'Pause' : 'Play'; };
  // Spin: a switch (its name never changes, .on its state), the sphere turning slowly by itself
  spinButton.classList.toggle('on', spin);
  spinButton.onclick = () => { spin = !spin; spinButton.classList.toggle('on', spin); };
  for (const id of ['reach', 'friction']) {
    const input = document.getElementById(id), out = input.nextElementSibling;
    input.value = set[id]; out.textContent = set[id];
    input.oninput = () => { set[id] = +input.value; out.textContent = input.value; keep(); };
  }
  // A drag turns the sphere, or moves over the torus; the wheel zooms (1 to 64 times)
  let drag = null;
  view.onpointerdown = (e) => { drag = [e.clientX, e.clientY]; view.setPointerCapture(e.pointerId); };
  view.onpointermove = (e) => {
    if (!drag) return;
    const m = Math.min(view.clientWidth, view.clientHeight), dx = e.clientX - drag[0], dy = e.clientY - drag[1];
    if (set.space === 'sphere') rotate((dy * 3) / m / look.zoom, (dx * 3) / m / look.zoom);
    else { look.x -= dx / m / look.zoom; look.y -= dy / m / look.zoom; }
    drag = [e.clientX, e.clientY];
  };
  view.onwheel = (e) => { e.preventDefault(); look.zoom = Math.min(64, Math.max(1, look.zoom * Math.exp(-e.deltaY * 0.002))); };
  view.onpointerup = () => { drag = null; };
  view.dragging = () => drag;
}
function fresh() {
  markSpaces(); markKinds(); markCounts(); markSteps(); spinButton.disabled = set.space !== 'sphere'; spinButton.title = set.space === 'sphere' ? '' : 'The torus does not turn';
  document.getElementById('seed').textContent = 'seed ' + set.seed; drawMatrix(); scatter(); keep();
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
function frame(t) {
  if (set.space === 'sphere' && spin && !view.dragging()) rotate(0, 0.002);
  write();
  if (on) steps(set.steps);
  draw();
  fps = fps * 0.95 + 50 / Math.max(1, t - last); last = t;
  if (++frames % 120 === 1 && on) measure();
  document.getElementById('stats').textContent = `${set.n.toLocaleString('en')} particles · ${set.k} kinds · ${grid().g.join(' × ')} bins\n${msStep ? msStep.toFixed(2) : '…'} ms a step · ${fps.toFixed(0)} frames a second`;
  requestAnimationFrame(frame);
}
(async () => { await gpu(); panel(); fit(); fresh(); requestAnimationFrame(frame); })();

/* ---- 1.6 Check ------------------------------------------------------------------------------- */

// One GPU step (bins) against the same step on the CPU (every pair, no bins), places and speeds read back: the
// largest difference; at 4,096 particles at most (the CPU's every pair); particlesCheck('both') checks the torus and
// the sphere in turn, coming back to the space and count shown
window.particlesCheck = async (which) => {
  const playing = on;
  on = false; // (the loop stepping meanwhile would change what is read)
  try { return await checkStep(which); } finally { on = playing; }
};
async function checkStep(which) {
  if (which === 'both') {
    const was = [set.space, set.n], ok = [];
    for (const s of SPACES) { set.space = s; set.n = 4096; fresh(); for (let i = 0; i < 200; i++) { write(); steps(1); } ok.push(await checkStep()); }
    [set.space, set.n] = was; fresh(); return ok.every(Boolean);
  }
  const read = async () => { await device.queue.onSubmittedWorkDone(); const b = device.createBuffer({ size: set.n * 32, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST }), e = device.createCommandEncoder(); e.copyBufferToBuffer(states[flip], 0, b, 0, set.n * 32); device.queue.submit([e.finish()]); await b.mapAsync(GPUMapMode.READ); const a = new Float32Array(b.getMappedRange().slice(0)); b.destroy(); return a; };
  write();
  const S = await read(), k = set.k, sphere = set.space === 'sphere', rr = Math.fround(reach()), damp = Math.fround(Math.pow(0.5, DT / set.friction)), want = new Float32Array(S.length);
  const force = (r, a) => (r < BETA ? r / BETA - 1 : a * (1 - Math.abs(2 * r - 1 - BETA) / (1 - BETA)));
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = (a) => Math.hypot(...a), at = (i, o = 0) => [S[i * 8 + o], S[i * 8 + o + 1], S[i * 8 + o + 2]];
  const towards = (p, q) => {
    if (sphere) { const d = dot(p, q), t = q.map((x, c) => x - (p[c] * d) / (RHO * RHO)), l = len(t), cr = [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]]; return [l > 0 ? t.map((x) => x / l) : [0, 0, 0], RHO * Math.atan2(len(cr), d)]; }
    const d = [q[0] - p[0], q[1] - p[1]].map((x) => x - Math.round(x)), l = Math.hypot(...d); return [l > 0 ? [d[0] / l, d[1] / l, 0] : [0, 0, 0], l];
  };
  for (let i = 0; i < set.n; i++) {
    const p = at(i), f = [0, 0, 0];
    for (let j = 0; j < set.n; j++) {
      if (j === i) continue;
      const [u, r] = towards(p, at(j));
      if (r > 0 && r < rr) { const g = force(r / rr, M[S[i * 8 + 3] * k + S[j * 8 + 3]]); for (let c = 0; c < 3; c++) f[c] += u[c] * g; }
    }
    let v = at(i, 4).map((x, c) => x * damp + f[c] * rr * 10 * DT), q;
    if (sphere) { const m = p.map((x, c) => x + v[c] * DT), l = len(m); q = m.map((x) => (x / l) * RHO); const d = dot(q, v) / (RHO * RHO); v = v.map((x, c) => x - q[c] * d); }
    else q = [((p[0] + v[0] * DT) % 1 + 1) % 1, ((p[1] + v[1] * DT) % 1 + 1) % 1, 0];
    want.set([...q, S[i * 8 + 3], ...v, 0], i * 8);
  }
  steps(1);
  const got = await read();
  let worst = 0;
  for (let i = 0; i < got.length; i++) { let d = Math.abs(got[i] - want[i]); if (!sphere && i % 8 < 2) d = Math.min(d, 1 - d); worst = Math.max(worst, d); }
  const ok = worst < 1e-4;
  console.log(`particlesCheck: one step of ${set.n} particles on the ${set.space}, GPU (bins) against CPU (every pair), largest difference ${worst.toExponential(2)}: ${ok ? 'ok' : 'FAILED'}`);
  return ok;
}
