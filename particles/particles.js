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
 * Each particle also has a shade h in [0, 1], used two ways. Battle: the kinds' creatures in two
 * sides, red (0) and blue (1); across the sides a creature is drawn more (or less) by its side's own
 * say (red to blue, blue to red, by |Δh|: one chasing while the other flees makes them meet), and
 * a shade turns towards the side most of its neighbours hold (contagion; `tip` the share of blue it
 * takes to go blue; a share right at it changes nothing): fronts, conquests; even sides win by luck. (Two shades alone, without kinds, only make still drops.)
 * Wheel: no kinds, a rainbow (h round a circle): each shade drawn to the shade `chase` ahead and
 * pushed from the one opposite (a = cos 2π(Δh − chase)): endless chases, spirals.
 * Evolve: up to 16 species, each its own rule matrix and virulence, a particle's shade its
 * species (s/15); starting with four, one a quarter of the world. A particle feels by its species'
 * matrix, and is caught by the species touching it (within the push, the first 30% of the reach):
 * each other species presses by its virulence, more the nearer, and the strongest takes it by
 * chance (contagion × dt × its press). (A vote of the neighbours, tried first, froze the borders:
 * nothing moved a particle into another's land.) Every `mutate` seconds a mutant: a particle's
 * species copied, each rule and the virulence moved by up to `change`, into a species gone (or the
 * rarest), laid on that species' particles within two reaches of it: hunters spread.
 * A particle's w: its kind + its shade × 0.999 (the kind the whole part).
 * Physarum (Jeff Jones' slime mould, 2010), the torus only: no forces, agents of 1 to 4 species on
 * a trail map (a square of 2√n cells a side, a channel a species). Each agent smells three points
 * ahead (straight, `angle` left and right, `sensor` cells away; its own species' trail, less `repel`
 * of the others'), turns `turn` towards the strongest (at random when both sides beat the front),
 * steps `speed` cells and lays its trail; the map then spreads (a 3 × 3 mean) and fades (`decay`).
 * Veins form, branch and merge; species keep to their own networks. The map is drawn, not the agents.
 * Swirl, in every mode: a push across the way to each neighbour (to its left), turning creatures.
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
 * dim; the torus moved over by a drag), into a picture of its own that keeps `trails` of itself
 * each frame (faded by that much; 0: none), then shown over the background.
 * particlesCheck('all') in the console: one GPU step against the same step on the CPU (every
 * pair, no bins), each mode and space.
 */

/* ---- 1.1 Setting ----------------------------------------------------------------------------- */

const MODES = ['kinds', 'battle', 'wheel', 'evolve', 'physarum'], SPECIES = 16, KINDS = [3, 4, 5, 6, 7, 8], COUNTS = [4096, 16384, 65536, 262144, 1048576], SPACES = ['torus', 'sphere'], STEPS = [1, 2, 4, 8];
const BETA = 0.3, DT = 0.02, BASE = 4096;
const RHO = 1 / Math.sqrt(4 * Math.PI); // the sphere's radius: its area 1, as the torus'
const COLOURS = [[1, 0.35, 0.35], [0.35, 0.85, 0.4], [0.4, 0.6, 1], [1, 0.85, 0.3], [0.85, 0.45, 1], [0.3, 0.9, 0.95], [1, 0.6, 0.25], [0.9, 0.9, 0.9]];
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
// The setting from the link: #mode=battle&space=sphere&k=6&n=65536&seed=7&reach=0.1&friction=0.04&steps=2&swirl=0&
// contagion=1&tip=0.5&chase=0.15&mutate=3&change=0.3 and, once a rule is changed, m= its K² rules
const hash = Object.fromEntries(new URLSearchParams(location.hash.slice(1)));
const num = (v, d) => (v === undefined || v === '' || isNaN(+v) ? d : +v);
const set = { species: [1, 2, 3, 4].includes(+hash.species) ? +hash.species : 3, angle: num(hash.angle, 45), sensor: num(hash.sensor, 9), turn: num(hash.turn, 45), speed: num(hash.speed, 1), decay: num(hash.decay, 0.9), repel: num(hash.repel, 1), trails: num(hash.trails, 0), mutate: num(hash.mutate, 3), change: num(hash.change, 0.3), redBlue: num(hash.redBlue, 0.3), blueRed: num(hash.blueRed, 0.3), mode: MODES.includes(hash.mode) ? hash.mode : 'kinds', swirl: num(hash.swirl, 0), contagion: num(hash.contagion, 1), tip: num(hash.tip, 0.5), chase: num(hash.chase, 0.15), space: SPACES.includes(hash.space) ? hash.space : 'torus', k: KINDS.includes(+hash.k) ? +hash.k : 6, n: COUNTS.includes(+hash.n) ? +hash.n : 65536, seed: +hash.seed || 1, reach: +hash.reach || 0.1, friction: +hash.friction || 0.04, steps: STEPS.includes(+hash.steps) ? +hash.steps : 1, m: hash.m ? hash.m.split(',').map(Number) : null };
const rules = () => set.m ?? (() => { const r = mulberry32(set.seed * 7919); return Array.from({ length: set.k * set.k }, () => Math.round((r() * 2 - 1) * 4) / 4); })();
let M = rules();
// Evolve's species: each a K × K matrix (species 0 the rules shown in Kinds) and a virulence (0.5 at first); four at
// first (the others' rules drawn from the seed)
let genomes = [];
const firstGenomes = () => { genomes = Array.from({ length: SPECIES }, (_, s) => (s >= 4 ? null : { rules: s === 0 ? M.slice() : (() => { const r = mulberry32(set.seed * 7919 + s * 104729); return Array.from({ length: set.k * set.k }, () => Math.round((r() * 2 - 1) * 4) / 4); })(), virulence: 0.5 })); };
// A species' colour (as the shader draws it: hues a golden turn apart)
const speciesColour = (sp) => { const h = (sp * 0.618034) % 1, c = [0, 2 / 3, 1 / 3].map((o) => Math.min(1, Math.max(0, Math.abs(((h + o) % 1) * 6 - 3) - 1)) * 0.75 + 0.2); return `rgb(${c.map((x) => Math.round(x * 255)).join(',')})`; };
// A mutation under way (laid during one frame's steps), or null
let mutation = null, lastMutation = 0;
// Every species laid for the GPU: 16 of 72, its 64 rules (a row 8 wide whatever K) then its virulence; Kinds and Battle
// use species 0
const ruleTable = () => {
  const t = new Float32Array(SPECIES * 72);
  (set.mode === 'evolve' ? genomes : [{ rules: M, virulence: 0 }]).forEach((g, s) => { if (!g) return; for (let i = 0; i < set.k; i++) for (let j = 0; j < set.k; j++) t[s * 72 + i * 8 + j] = g.rules[i * set.k + j]; t[s * 72 + 64] = g.virulence; });
  return t;
};
const keep = () => { const h = { species: set.species, angle: set.angle, sensor: set.sensor, turn: set.turn, speed: set.speed, decay: set.decay, repel: set.repel, trails: set.trails, mutate: set.mutate, change: set.change, redBlue: set.redBlue, blueRed: set.blueRed, mode: set.mode, swirl: set.swirl, contagion: set.contagion, tip: set.tip, chase: set.chase, space: set.space, k: set.k, n: set.n, seed: set.seed, reach: set.reach, friction: set.friction, steps: set.steps }; if (set.m) h.m = set.m.join(','); history.replaceState(null, '', '#' + new URLSearchParams(h)); };
// The reach in the world: the slider's, for 4,096, shrunk with the count
const reach = () => set.reach * Math.sqrt(BASE / set.n);

/* ---- 1.2 Shaders ----------------------------------------------------------------------------- */

// A chance in [0, 1) for particle i at place p (its bits differ each step: PCG of both)
const CHANCE = `
fn chance(i: u32, p: vec3f) -> f32 {
  var x = i * 747796405u + (bitcast<u32>(p.x) ^ (bitcast<u32>(p.y) * 2891336453u) ^ (bitcast<u32>(p.z) * 1181783497u));
  x = ((x >> ((x >> 28u) + 4u)) ^ x) * 277803737u; x = (x >> 22u) ^ x; return f32(x) / 4294967296.0;
}`;
const PARAMS = `
struct Params { a: vec4u, g: vec4u, f: vec4f, v: vec4f, t0: vec4f, t1: vec4f, t2: vec4f, h: vec4f, e: vec4f, m: vec4u, u: vec4f, q: vec4f, r: vec4f, s: vec4f };
// a: n, k, sphere, bins; g: the grid's size, the mode (0 kinds, 1 battle, 2 wheel, 3 evolve); f: reach, damp, dt, a bin's side;
// v: scale x, y, a dot's half size x, y; h: contagion, tip, chase, swirl; e: red to blue, blue to red (Battle), a dot's
// gain (√(1 − trails): a still one, kept frame after frame, not burnt);
// m: a mutation's parent and mutant species, 1 while it happens; u: its centre and radius; Physarum's q: angle, turn
// (radians), sensor, speed (cells); r: decay, the trail laid a step, repel, the map's side; s: the canvas' width, height;
// t0..t2: the sphere's turn (columns), their w the zoom and, on the torus, the place shown in the middle
const RHO = ${RHO}; const BETA = ${BETA};`;
const COMPUTE = PARAMS + `
@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<uniform> R: array<vec4f, 288>;   // 16 species of 72: 64 rules (rows 8 wide), its virulence
@group(0) @binding(2) var<storage, read_write> sIn: array<vec4f>;   // a particle i: place 2i (its kind and shade in w), speed 2i + 1
@group(0) @binding(3) var<storage, read_write> sOut: array<vec4f>;
@group(0) @binding(4) var<storage, read_write> near: array<vec4f>;  // the places (and kinds) in the bins' order
@group(0) @binding(5) var<storage, read_write> count: array<atomic<u32>>;
@group(0) @binding(6) var<storage, read_write> start: array<u32>;
@group(0) @binding(7) var<storage, read_write> at: array<vec2u>;    // a particle's bin and place in it
@group(0) @binding(8) var<storage, read_write> sorted: array<u32>;
fn rule(s: u32, ki: u32, kj: u32) -> f32 { let i = s * 72u + ki * 8u + kj; return R[i / 4u][i % 4u]; }
fn virulence(s: u32) -> f32 { return R[s * 18u + 16u].x; }
// A particle's w: its kind (the whole part) and shade
fn kindOf(w: f32) -> u32 { return u32(floor(w)); }
fn shadeOf(w: f32) -> f32 { return fract(w) / 0.999; }
fn speciesOf(w: f32) -> u32 { return u32(round(shadeOf(w) * 15.0)); }
${CHANCE}
// How much a particle (its w, wi) is drawn to another (wj): the rule matrix, plus across Battle's sides its side's say;
// on the Wheel by their shades
fn affinity(wi: f32, wj: f32) -> f32 {
  if (P.g.w == 2u) { let d = fract(shadeOf(wj) - shadeOf(wi) + 0.5) - 0.5; return cos(6.2831853 * (d - P.h.z)); }
  let a = rule(select(0u, speciesOf(wi), P.g.w == 3u), kindOf(wi), kindOf(wj));
  if (P.g.w == 1u) { let hi = shadeOf(wi); return a + abs(shadeOf(wj) - hi) * mix(P.e.x, P.e.y, hi); }
  return a;
}
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
// The way across: to the left of the way u (on the sphere, in the surface at p)
fn across(p: vec3f, u: vec3f) -> vec3f { if (P.a.z == 1u) { return cross(p / RHO, u); } return vec3f(-u.y, u.x, 0.0); }
// One particle: the force of those in the bins round its own (wrapped on the torus; read in the bins' order, side by
// side in memory) and their swirl, then friction, speed and place; in Battle its shade turned towards its neighbours' side
@compute @workgroup_size(128) fn feel(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x; if (i >= P.a.x) { return; }
  let sphere = P.a.z == 1u; let g = vec3i(P.g.xyz); let reach = P.f.x;
  let me = sIn[2u * i]; var p = me.xyz; var v = sIn[2u * i + 1u].xyz; var f = vec3f(0.0);
  let c = cellOf(p); let zr = select(0, 1, sphere); var held = 0.0; var blue = 0.0;
  let mine = speciesOf(me.w); var press: array<f32, 16>;
  for (var dz = -zr; dz <= zr; dz++) { for (var dy = -1; dy <= 1; dy++) { for (var dx = -1; dx <= 1; dx++) {
    var q = c + vec3i(dx, dy, dz);
    if (sphere) { if (any(q < vec3i(0)) || any(q >= g)) { continue; } }
    else { q = vec3i((q.x + g.x) % g.x, (q.y + g.y) % g.y, 0); }
    let b = binOf(q);
    for (var s = start[b]; s < start[b + 1u]; s++) {
      if (sorted[s] == i) { continue; }
      let o = near[s]; let w = towards(p, o.xyz);
      if (w.w > 0.0 && w.w < reach) {
        let r = w.w / reach;
        f += w.xyz * force(r, affinity(me.w, o.w)) + across(p, w.xyz) * P.h.w * (1.0 - r);
        held += 1.0 - r; blue += (1.0 - r) * shadeOf(o.w);
        let so = speciesOf(o.w); if (r < BETA && so != mine) { press[so] += virulence(so) * (1.0 - r / BETA); }
      }
    }
  } } }
  v = v * P.f.y + f * reach * 10.0 * P.f.z;
  if (sphere) { p = normalize(p + v * P.f.z) * RHO; v -= p * dot(p, v) / (RHO * RHO); }
  else { p = vec3f(fract(p.xy + v.xy * P.f.z), 0.0); }
  var h = shadeOf(me.w);
  if (P.g.w == 1u && held > 0.0 && blue / held != P.h.y) { h = clamp(h + P.h.x * P.f.z * (select(0.0, 1.0, blue / held > P.h.y) - h), 0.0, 1.0); }
  if (P.g.w == 3u) {
    var s = mine; var best = 0u;
    for (var t = 1u; t < 16u; t++) { if (press[t] > press[best]) { best = t; } }
    if (press[best] > 0.0 && chance(i, me.xyz) < P.h.x * P.f.z * press[best]) { s = best; }
    if (P.m.z == 1u && s == P.m.x && towards(P.u.xyz, me.xyz).w < P.u.w) { s = P.m.y; }
    h = f32(s) / 15.0;
  }
  sOut[2u * i] = vec4f(p, f32(kindOf(me.w)) + h * 0.999); sOut[2u * i + 1u] = vec4f(v, 0.0);
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
  let p = s[2u * ii].xyz; let w = s[2u * ii].w; let k = floor(w); let h = fract(w) / 0.999; var o: Out; o.uv = corners[vi];
  if (P.g.w == 1u) { o.c = mix(vec3f(1.0, 0.25, 0.25), vec3f(0.3, 0.5, 1.0), h) * mix(0.55, 1.25, k / max(1.0, f32(P.a.y) - 1.0)); }
  else if (P.g.w == 2u) { o.c = clamp(abs(fract(h + vec3f(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0) - 1.0, vec3f(0.0), vec3f(1.0)) * 0.8 + 0.15; }
  else if (P.g.w == 3u) { let hue = fract(round(h * 15.0) * 0.618034); o.c = (clamp(abs(fract(hue + vec3f(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0) - 1.0, vec3f(0.0), vec3f(1.0)) * 0.75 + 0.2) * mix(0.6, 1.2, k / max(1.0, f32(P.a.y) - 1.0)); }
  else { o.c = colour[u32(k)].rgb; }
  var centre: vec2f; var size = P.t0.w; var z = 0.0;
  if (P.a.z == 1u) {
    let q = mat3x3f(P.t0.xyz, P.t1.xyz, P.t2.xyz) * p / RHO;
    centre = q.xy * P.v.xy * 0.92 * P.t0.w; z = 0.5 - q.z * 0.5;
    if (q.z > 0.0) { size *= 0.6 + 0.4 * q.z; } else { size *= 0.6; o.c *= 0.22; }
  } else { centre = (fract(p.xy - vec2f(P.t1.w, P.t2.w) + 0.5) - 0.5) * 2.0 * P.t0.w * P.v.xy * vec2f(1.0, -1.0); }
  o.pos = vec4f(centre + o.uv * P.v.zw * size, z, 1.0); o.c *= P.e.z;
  return o;
}
@fragment fn fs(i: Out) -> @location(0) vec4f {
  let d = dot(i.uv, i.uv); if (d > 1.0) { discard; }
  return vec4f(i.c * (1.0 - d), 1.0);
}`;
// The trails' picture: faded (a full-screen triangle drawn with nothing, the picture kept by the blend constant), and
// shown (its pixels over the background, their brightest softened: 1 − e^(−1.6 x))
const PICTURE = `
@group(0) @binding(0) var picture: texture_2d<f32>;
@vertex fn full(@builtin(vertex_index) v: u32) -> @builtin(position) vec4f { return vec4f(f32(v & 1u) * 4.0 - 1.0, f32(v >> 1u) * 4.0 - 1.0, 0.0, 1.0); }
@fragment fn fade() -> @location(0) vec4f { return vec4f(0.0); }
@fragment fn show(@builtin(position) p: vec4f) -> @location(0) vec4f { return vec4f(1.0 - exp(-textureLoad(picture, vec2i(p.xy), 0).rgb * 1.6) + vec3f(0.03, 0.035, 0.05), 1.0); }`;
const TRAIL = 'rgba16float';
// Physarum: the map's cell at a place (wrapped), shared by the step and the drawing
const MAPCELL = `
fn side() -> i32 { return i32(P.r.w); }
fn cell(p: vec2f) -> u32 { let w = side(); let c = min(vec2i(floor(fract(p) * f32(w))), vec2i(w - 1)); return u32(c.y * w + c.x); }`;
const PHYSARUM = PARAMS + CHANCE + `
@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read_write> aIn: array<vec4f>;   // an agent i: place 2i (its species in w), heading 2i + 1 (x)
@group(0) @binding(2) var<storage, read_write> aOut: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> tIn: array<vec4f>;   // the trail map, a channel a species
@group(0) @binding(4) var<storage, read_write> tOut: array<vec4f>;
@group(0) @binding(5) var<storage, read_write> laid: array<atomic<u32>>; // this step's trail, 4 a cell, fixed point (× 256)
` + MAPCELL + `
// What species s smells at p: its own trail, less repel times the others'
fn smell(p: vec2f, s: u32) -> f32 { let t = tIn[cell(p)]; var own = vec4f(0.0); own[s] = 1.0 + P.r.z; return dot(t, own - vec4f(P.r.z)); }
fn way(h: f32) -> vec2f { return vec2f(cos(h), sin(h)); }
// One agent: smell ahead, turn, step, lay
@compute @workgroup_size(256) fn crawl(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x; if (i >= P.a.x) { return; }
  let a = aIn[2u * i]; let s = u32(a.w); var h = aIn[2u * i + 1u].x; let far = P.q.z / f32(side());
  let F = smell(a.xy + way(h) * far, s); let L = smell(a.xy + way(h + P.q.x) * far, s); let R = smell(a.xy + way(h - P.q.x) * far, s);
  if (F < L && F < R) { h += select(-P.q.y, P.q.y, chance(i, a.xyz) < 0.5); }
  else if (!(F > L && F > R)) { if (L > R) { h += P.q.y; } else if (R > L) { h -= P.q.y; } }
  h = h - 6.2831853 * floor(h / 6.2831853);
  let p = fract(a.xy + way(h) * P.q.w / f32(side()));
  atomicAdd(&laid[cell(p) * 4u + s], u32(P.r.y * 256.0));
  aOut[2u * i] = vec4f(p, 0.0, a.w); aOut[2u * i + 1u] = vec4f(h, 0.0, 0.0, 0.0);
}
// One cell: the mean of its 3 × 3 and this step's trail, faded; the step's trail cleared
@compute @workgroup_size(16, 16) fn spread(@builtin(global_invocation_id) id: vec3u) {
  let w = side(); let x = i32(id.x); let y = i32(id.y); if (x >= w || y >= w) { return; }
  var sum = vec4f(0.0);
  for (var dy = -1; dy <= 1; dy++) { for (var dx = -1; dx <= 1; dx++) { sum += tIn[((y + dy + w) % w) * w + (x + dx + w) % w]; } }
  let c = u32(y * w + x); var d = vec4f(0.0);
  for (var k = 0u; k < 4u; k++) { d[k] = f32(atomicExchange(&laid[c * 4u + k], 0u)) / 256.0; }
  tOut[c] = (sum / 9.0 + d) * P.r.x;
}`;
// The map drawn: each pixel the cell under it (zoomed, moved over), the species' colours summed, softened
const MAP = PARAMS + `
@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read> t: array<vec4f>;
@group(0) @binding(2) var<uniform> colour: array<vec4f, 8>;
` + MAPCELL + `
@vertex fn full(@builtin(vertex_index) v: u32) -> @builtin(position) vec4f { return vec4f(f32(v & 1u) * 4.0 - 1.0, f32(v >> 1u) * 4.0 - 1.0, 0.0, 1.0); }
@fragment fn map(@builtin(position) px: vec4f) -> @location(0) vec4f {
  let at = vec2f(P.t1.w, P.t2.w) + (px.xy - P.s.xy * 0.5) / (P.t0.w * min(P.s.x, P.s.y));
  let v = t[cell(at)] * 0.04; let c = v.x * colour[0].rgb + v.y * colour[1].rgb + v.z * colour[2].rgb + v.w * colour[3].rgb;
  return vec4f(1.0 - exp(-c) + vec3f(0.03, 0.035, 0.05), 1.0);
}`;

/* ---- 1.3 GPU --------------------------------------------------------------------------------- */

const view = document.getElementById('view');
const fail = (text) => { const f = document.getElementById('fail'); f.style.display = 'flex'; f.textContent = text; throw new Error(text); };
let device, context, format, pipes, drawPipe, phys, mapPipe, mapSide = 0, maps = [], laid = null, physGroups = [], mapGroups = [], fadePipe, showPipe, trail = null, showGroup, params, ruleBuf, colourBuf, states = [], bins = {}, binCount = 0, groups = [], drawGroups = [], flip = 0;
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
  drawPipe = device.createRenderPipeline({ layout: 'auto', vertex: { module: dm, entryPoint: 'vs' }, fragment: { module: dm, entryPoint: 'fs', targets: [{ format: TRAIL, blend: { color: { srcFactor: 'one', dstFactor: 'one' }, alpha: { srcFactor: 'one', dstFactor: 'one' } } }] }, primitive: { topology: 'triangle-list' } });
  const pm = device.createShaderModule({ code: PICTURE }), keepBlend = { srcFactor: 'zero', dstFactor: 'constant' };
  fadePipe = device.createRenderPipeline({ layout: 'auto', vertex: { module: pm, entryPoint: 'full' }, fragment: { module: pm, entryPoint: 'fade', targets: [{ format: TRAIL, blend: { color: keepBlend, alpha: keepBlend } }] } });
  showPipe = device.createRenderPipeline({ layout: 'auto', vertex: { module: pm, entryPoint: 'full' }, fragment: { module: pm, entryPoint: 'show', targets: [{ format }] } });
  const ph = device.createShaderModule({ code: PHYSARUM }), mp = device.createShaderModule({ code: MAP });
  const physLayout = device.createBindGroupLayout({ entries: [{ binding: 0, visibility: S.COMPUTE, buffer: {} }, ...[1, 2, 3, 4, 5].map(storage)] });
  const ppl = device.createPipelineLayout({ bindGroupLayouts: [physLayout] });
  phys = { layout: physLayout, crawl: device.createComputePipeline({ layout: ppl, compute: { module: ph, entryPoint: 'crawl' } }), spread: device.createComputePipeline({ layout: ppl, compute: { module: ph, entryPoint: 'spread' } }) };
  mapPipe = device.createRenderPipeline({ layout: 'auto', vertex: { module: mp, entryPoint: 'full' }, fragment: { module: mp, entryPoint: 'map', targets: [{ format }] } });
  params = device.createBuffer({ size: 224, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  ruleBuf = device.createBuffer({ size: SPECIES * 288, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
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
// A fresh world: n particles at random places (the seed's; on the sphere, evenly over it), at rest, each in its place's w
// its kind (in turn) and shade: Battle, red on one half (the torus' left, the sphere's south) and blue on the other;
// Wheel, kind 0 and any shade; Evolve, four species, one a quarter (the torus' quarters, the sphere's by x and y);
// Physarum, its species in turn, any heading (in the speed's x), an empty map
function scatter() {
  const r = mulberry32(set.seed), s = new Float32Array(set.n * 8);
  if (set.mode === 'physarum') for (let i = 0; i < set.n; i++) s.set([r(), r(), 0, i % set.species, r() * 2 * Math.PI], i * 8);
  else for (let i = 0; i < set.n; i++) {
    if (set.space === 'sphere') { const z = r() * 2 - 1, a = r() * 2 * Math.PI, q = Math.sqrt(1 - z * z); s.set([q * Math.cos(a) * RHO, q * Math.sin(a) * RHO, z * RHO], i * 8); }
    else s.set([r(), r(), 0], i * 8);
    const quarter = set.space === 'sphere' ? 2 * +(s[i * 8 + 1] > 0) + +(s[i * 8] > 0) : 2 * +(s[i * 8 + 1] > 0.5) + +(s[i * 8] > 0.5);
    s[i * 8 + 3] = set.mode === 'wheel' ? r() * 0.999 : (i % set.k) + (set.mode === 'battle' && (set.space === 'sphere' ? s[i * 8 + 2] : s[i * 8] - 0.5) > 0 ? 0.999 : set.mode === 'evolve' ? (0.999 * quarter) / 15 : 0);
  }
  for (const b of states) b.destroy();
  states = [0, 1].map(() => buffer(s.byteLength)); device.queue.writeBuffer(states[0], 0, s);
  remap();
  rebin();
}
// Physarum's map (2√n cells a side, zero), its step's trail, and the bind groups of both ways
function remap() {
  for (const b of [...maps, laid]) b?.destroy();
  mapSide = 2 * Math.round(Math.sqrt(set.n));
  maps = [0, 1].map(() => buffer(mapSide * mapSide * 16)); laid = buffer(mapSide * mapSide * 16);
  physGroups = [0, 1].map((f) => device.createBindGroup({ layout: phys.layout, entries: [params, states[f], states[1 - f], maps[f], maps[1 - f], laid].map((buffer, binding) => ({ binding, resource: { buffer } })) }));
  mapGroups = [0, 1].map((f) => device.createBindGroup({ layout: mapPipe.getBindGroupLayout(0), entries: [params, maps[f], colourBuf].map((buffer, binding) => ({ binding, resource: { buffer } })) }));
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
  const buf = new ArrayBuffer(224), u = new Uint32Array(buf), f = new Float32Array(buf);
  u.set([set.n, set.k, sphere ? 1 : 0, binCount, ...g, MODES.indexOf(set.mode)]);
  f.set([reach(), Math.pow(0.5, DT / set.friction), DT, side, m / w, m / h, (dot * 2) / w, (dot * 2) / h, turn[0], turn[1], turn[2], look.zoom, turn[3], turn[4], turn[5], look.x, turn[6], turn[7], turn[8], look.y, set.contagion, set.tip, set.chase, set.swirl, set.redBlue, set.blueRed, Math.sqrt(1 - set.trails), 0], 8);
  u.set([mutation?.parent ?? 0, mutation?.mutant ?? 0, mutation ? 1 : 0, 0], 36);
  f.set(mutation ? [...mutation.at, mutation.radius] : [0, 0, 0, 0], 40);
  const rad = Math.PI / 180;
  f.set([set.angle * rad, set.turn * rad, set.sensor, set.speed, set.decay, 5, set.repel, mapSide, w, h, 0, 0], 44);
  device.queue.writeBuffer(params, 0, buf);
  device.queue.writeBuffer(ruleBuf, 0, ruleTable());
}
// `count` steps in one submission: each five passes (Physarum: two, crawl and spread)
function steps(count) {
  const enc = device.createCommandEncoder(), n = Math.ceil(set.n / 256);
  if (set.mode === 'physarum') {
    for (let s = 0; s < count; s++) {
      const pass = enc.beginComputePass();
      pass.setBindGroup(0, physGroups[flip]);
      pass.setPipeline(phys.crawl); pass.dispatchWorkgroups(n);
      pass.setPipeline(phys.spread); pass.dispatchWorkgroups(Math.ceil(mapSide / 16), Math.ceil(mapSide / 16));
      pass.end();
      flip = 1 - flip;
    }
    return device.queue.submit([enc.finish()]);
  }
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
// The particles drawn into the trails' picture (kept `trails` of itself, or cleared), then the picture shown; Physarum's
// map drawn instead
function draw() {
  if (set.mode === 'physarum') {
    const enc = device.createCommandEncoder(), out = enc.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }] });
    out.setPipeline(mapPipe); out.setBindGroup(0, mapGroups[flip]); out.draw(3); out.end();
    return device.queue.submit([enc.finish()]);
  }
  if (!trail || trail.width !== view.width || trail.height !== view.height) {
    trail?.destroy();
    trail = device.createTexture({ size: [view.width, view.height], format: TRAIL, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
    showGroup = device.createBindGroup({ layout: showPipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: trail.createView() }] });
  }
  const enc = device.createCommandEncoder(), keep = set.trails > 0;
  const pass = enc.beginRenderPass({ colorAttachments: [{ view: trail.createView(), loadOp: keep ? 'load' : 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 0 } }] });
  if (keep) { pass.setPipeline(fadePipe); pass.setBlendConstant([set.trails, set.trails, set.trails, set.trails]); pass.draw(3); }
  pass.setPipeline(drawPipe); pass.setBindGroup(0, drawGroups[flip]); pass.draw(6, set.n);
  pass.end();
  const out = enc.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }] });
  out.setPipeline(showPipe); out.setBindGroup(0, showGroup); out.draw(3);
  out.end();
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
let markModes, markSpaces, markKinds, markCounts, markSteps, markSpecies;
// The rules as a K × K picture: rows the kind that feels, columns the kind felt (their colours on the edges)
const mat = document.getElementById('matrix'), mg = mat.getContext('2d'), CELL = 26;
let shown = 0; // the species whose rules are drawn (Evolve: the commonest)
function drawMatrix() {
  const k = set.k, G = set.mode === 'evolve' ? genomes[shown]?.rules ?? M : M; mat.width = mat.height = (k + 1) * CELL; mat.style.width = mat.style.height = (k + 1) * CELL + 'px';
  mg.clearRect(0, 0, mat.width, mat.height);
  for (let i = 0; i < k; i++) {
    const c = `rgb(${COLOURS[i].map((x) => x * 255).join(',')})`;
    mg.fillStyle = c; mg.beginPath(); mg.arc(CELL / 2, (i + 1.5) * CELL, 6, 0, 7); mg.fill(); mg.beginPath(); mg.arc((i + 1.5) * CELL, CELL / 2, 6, 0, 7); mg.fill();
    for (let j = 0; j < k; j++) {
      const a = G[i * k + j];
      mg.fillStyle = a >= 0 ? `rgb(${40 - a * 20},${60 + a * 160},${50})` : `rgb(${60 - a * 170},${40},${45})`;
      mg.fillRect((j + 1) * CELL + 1, (i + 1) * CELL + 1, CELL - 2, CELL - 2);
    }
  }
}
mat.onclick = (e) => {
  const r = mat.getBoundingClientRect(), j = Math.floor((e.clientX - r.left) / CELL) - 1, i = Math.floor((e.clientY - r.top) / CELL) - 1;
  if (i < 0 || j < 0 || i >= set.k || j >= set.k || set.mode === 'evolve') return;
  M[i * set.k + j] = Math.max(-1, Math.min(1, M[i * set.k + j] + (e.shiftKey ? -0.5 : 0.5)));
  set.m = M.slice(); keep(); drawMatrix();
};
let on = true, spin = true;
const spinButton = document.getElementById('spin');
function panel() {
  markModes = tabs(document.getElementById('modes'), MODES, () => set.mode, (v) => { set.mode = v; fresh(); }, (v) => v[0].toUpperCase() + v.slice(1));
  markSpaces = tabs(document.getElementById('spaces'), SPACES, () => set.space, (v) => { set.space = v; fresh(); }, (v) => v[0].toUpperCase() + v.slice(1));
  markSpecies = tabs(document.getElementById('species'), [1, 2, 3, 4], () => set.species, (v) => { set.species = v; fresh(); });
  markKinds = tabs(document.getElementById('kinds'), KINDS, () => set.k, (v) => { set.k = v; set.m = null; M = rules(); fresh(); });
  markCounts = tabs(document.getElementById('counts'), COUNTS, () => set.n, (v) => { set.n = v; fresh(); }, (v) => (v >= 1048576 ? v / 1048576 + 'M' : v / 1024 + 'k'));
  markSteps = tabs(document.getElementById('steps'), STEPS, () => set.steps, (v) => { set.steps = v; markSteps(); keep(); });
  document.getElementById('newRules').onclick = () => { set.seed = 1 + Math.floor(Math.random() * 99999); set.m = null; M = rules(); fresh(); };
  document.getElementById('scatter').onclick = () => scatter();
  document.getElementById('play').onclick = (e) => { on = !on; e.target.textContent = on ? 'Pause' : 'Play'; };
  // Spin: a switch (its name never changes, .on its state), the sphere turning slowly by itself
  spinButton.classList.toggle('on', spin);
  spinButton.onclick = () => { spin = !spin; spinButton.classList.toggle('on', spin); };
  for (const id of ['reach', 'friction', 'swirl', 'contagion', 'tip', 'chase', 'redBlue', 'blueRed', 'mutate', 'change', 'trails', 'angle', 'sensor', 'turn', 'speed', 'decay', 'repel']) {
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
  if (set.mode === 'physarum') set.space = 'torus';
  document.body.className = set.mode; shares = ''; msStep = 0; shown = 0; mutation = null; lastMutation = performance.now(); firstGenomes();
  markModes(); markSpaces(); markKinds(); markCounts(); markSteps(); markSpecies();
  const sphereTab = document.getElementById('spaces').children[1];
  sphereTab.disabled = set.mode === 'physarum'; sphereTab.title = set.mode === 'physarum' ? 'Physarum runs on the torus only: its trail map is a square' : ''; spinButton.disabled = set.space !== 'sphere'; spinButton.title = set.space === 'sphere' ? '' : 'The torus does not turn';
  document.getElementById('seed').textContent = 'seed ' + set.seed; drawMatrix(); scatter(); keep();
}

/* ---- 1.5 Loop -------------------------------------------------------------------------------- */

const fit = () => { const r = view.getBoundingClientRect(), d = devicePixelRatio || 1; view.width = Math.max(1, Math.round(r.width * d)); view.height = Math.max(1, Math.round(r.height * d)); };
addEventListener('resize', fit);
// A step's time, measured now and then: a batch of steps submitted alone, waited for; in Battle, each side's share read
// back then too
let msStep = 0, frames = 0, last = performance.now(), fps = 0, shares = '';
async function measure() {
  write(); await device.queue.onSubmittedWorkDone();
  const t0 = performance.now(); steps(8); await device.queue.onSubmittedWorkDone(); msStep = (performance.now() - t0) / 8;
  if (set.mode === 'evolve') return census();
  if (set.mode !== 'battle') { shares = ''; return; }
  const S = await readState(), n = set.n;
  let red = 0;
  for (let i = 0; i < n; i++) if ((S[i * 8 + 3] % 1) / 0.999 < 0.5) red++;
  shares = `\nred ${((100 * red) / n).toFixed(1)}% · blue ${((100 * (n - red)) / n).toFixed(1)}%`;
}
// Evolve's census (each species' share and virulence; the commonest's rules drawn) and, every `mutate` seconds, a
// mutation: a random particle's species copied, each rule and the virulence moved by up to ±`change`, into a species gone
// (or the rarest), laid on the particles of that species within two reaches of it
async function census() {
  const S = await readState(), n = set.n, count = new Array(SPECIES).fill(0), sp = (i) => Math.round((((S[i * 8 + 3] % 1) + 1) % 1 / 0.999) * 15);
  for (let i = 0; i < n; i++) count[sp(i)]++;
  shown = count.indexOf(Math.max(...count)); drawMatrix();
  const live = count.map((c, s) => [s, c]).filter(([, c]) => c).sort((a, b) => b[1] - a[1]);
  shares = '\n' + live.slice(0, 5).map(([s, c]) => `s${s} ${((100 * c) / n).toFixed(0)}%`).join(' · ') + ` · ${live.length} species`;
  document.getElementById('census').innerHTML = live.map(([s, c]) => `<span style="color:${speciesColour(s)}">■ s${s} ${((100 * c) / n).toFixed(1)}% v${genomes[s].virulence.toFixed(2)}</span>`).join('<br>');
  if (!set.mutate || performance.now() - lastMutation < set.mutate * 1000) return;
  lastMutation = performance.now();
  const i = Math.floor(Math.random() * n), parent = sp(i), gone = count.findIndex((c, s) => !c && s !== parent);
  const mutant = gone >= 0 ? gone : count.indexOf(Math.min(...count.map((c, s) => (s === parent ? Infinity : c))));
  const moved = (a, lo) => Math.max(lo, Math.min(1, a + (Math.random() * 2 - 1) * set.change));
  genomes[mutant] = { rules: genomes[parent].rules.map((a) => moved(a, -1)), virulence: moved(genomes[parent].virulence, 0) };
  mutation = { parent, mutant, at: [S[i * 8], S[i * 8 + 1], S[i * 8 + 2]], radius: 2 * reach() };
}
// The particles' places (shade in w) and speeds, read back: 8 floats a particle
async function readState() {
  await device.queue.onSubmittedWorkDone();
  const b = device.createBuffer({ size: set.n * 32, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST }), e = device.createCommandEncoder();
  e.copyBufferToBuffer(states[flip], 0, b, 0, set.n * 32); device.queue.submit([e.finish()]);
  await b.mapAsync(GPUMapMode.READ); const a = new Float32Array(b.getMappedRange().slice(0)); b.destroy(); return a;
}
function frame(t) {
  if (set.space === 'sphere' && spin && !view.dragging()) rotate(0, 0.002);
  write();
  if (on) { steps(set.steps); mutation = null; }
  draw();
  fps = fps * 0.95 + 50 / Math.max(1, t - last); last = t;
  if (++frames % 120 === 1 && on) measure();
  document.getElementById('stats').textContent = `${set.n.toLocaleString('en')} particles · ${set.mode === 'kinds' ? set.k + ' kinds' : set.mode} · ${set.mode === 'physarum' ? `${mapSide} × ${mapSide} map` : `${grid().g.join(' × ')} bins`}\n${msStep ? msStep.toFixed(2) : '…'} ms a step · ${fps.toFixed(0)} frames a second${shares}`;
  requestAnimationFrame(frame);
}
(async () => { await gpu(); panel(); fit(); fresh(); requestAnimationFrame(frame); })();

/* ---- 1.6 Check ------------------------------------------------------------------------------- */

// One GPU step (bins) against the same step on the CPU (every pair, no bins), places, shades and speeds read back: the
// largest difference; at 4,096 particles at most (the CPU's every pair); particlesCheck('all') checks each mode on each
// space (with some swirl), coming back to the setting shown
window.particlesCheck = async (which) => {
  const playing = on;
  on = false; // (the loop stepping meanwhile would change what is read)
  try { return await checkStep(which); } finally { on = playing; }
};
async function checkStep(which) {
  if (which === 'all') {
    const was = { ...set }, ok = [];
    for (const mode of MODES) for (const s of mode === 'physarum' ? ['torus'] : SPACES) { Object.assign(set, { mode, space: s, n: 4096, swirl: 0.3 }); fresh(); for (let i = 0; i < 200; i++) { write(); steps(1); } ok.push(await checkStep()); }
    Object.assign(set, was); fresh(); return ok.every(Boolean);
  }
  write();
  if (set.mode === 'physarum') return checkPhysarum();
  const S = await readState(), k = set.k, sphere = set.space === 'sphere', rr = Math.fround(reach()), damp = Math.fround(Math.pow(0.5, DT / set.friction)), want = new Float32Array(S.length);
  const force = (r, a) => (r < BETA ? r / BETA - 1 : a * (1 - Math.abs(2 * r - 1 - BETA) / (1 - BETA)));
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = (a) => Math.hypot(...a), at = (i, o = 0) => [S[i * 8 + o], S[i * 8 + o + 1], S[i * 8 + o + 2]];
  const kindOf = (w) => Math.floor(w), shadeOf = (w) => (w - Math.floor(w)) / 0.999, speciesOf = (w) => Math.round(Math.fround(shadeOf(w)) * 15);
  const bits = new Uint32Array(S.buffer);
  const chance = (i) => { let x = (Math.imul(i, 747796405) + (bits[i * 8] ^ Math.imul(bits[i * 8 + 1], 2891336453) ^ Math.imul(bits[i * 8 + 2], 1181783497))) >>> 0; x = Math.imul(((x >>> ((x >>> 28) + 4)) ^ x) >>> 0, 277803737) >>> 0; x = ((x >>> 22) ^ x) >>> 0; return x / 4294967296; };
  const G = ruleTable();
  const affinity = (wi, wj) => {
    if (set.mode === 'wheel') return Math.cos(2 * Math.PI * ((((shadeOf(wj) - shadeOf(wi) + 0.5) % 1) + 1) % 1 - 0.5 - set.chase));
    const a = G[(set.mode === 'evolve' ? speciesOf(wi) : 0) * 72 + kindOf(wi) * 8 + kindOf(wj)], hi = shadeOf(wi);
    return set.mode === 'battle' ? a + Math.abs(shadeOf(wj) - hi) * (set.redBlue + (set.blueRed - set.redBlue) * hi) : a;
  };
  const across = (p, u) => (sphere ? [p[1] * u[2] - p[2] * u[1], p[2] * u[0] - p[0] * u[2], p[0] * u[1] - p[1] * u[0]].map((x) => x / RHO) : [-u[1], u[0], 0]);
  const towards = (p, q) => {
    if (sphere) { const d = dot(p, q), t = q.map((x, c) => x - (p[c] * d) / (RHO * RHO)), l = len(t), cr = [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]]; return [l > 0 ? t.map((x) => x / l) : [0, 0, 0], RHO * Math.atan2(len(cr), d)]; }
    const d = [q[0] - p[0], q[1] - p[1]].map((x) => x - Math.round(x)), l = Math.hypot(...d); return [l > 0 ? [d[0] / l, d[1] / l, 0] : [0, 0, 0], l];
  };
  for (let i = 0; i < set.n; i++) {
    const p = at(i), f = [0, 0, 0], hi = S[i * 8 + 3];
    let held = 0, blue = 0;
    const mine = speciesOf(hi), press = new Float32Array(SPECIES);
    for (let j = 0; j < set.n; j++) {
      if (j === i) continue;
      const [u, d] = towards(p, at(j));
      if (d > 0 && d < rr) {
        const r = d / rr, g = force(r, affinity(hi, S[j * 8 + 3])), x = across(p, u);
        for (let c = 0; c < 3; c++) f[c] += u[c] * g + x[c] * set.swirl * (1 - r);
        held += 1 - r; blue += (1 - r) * shadeOf(S[j * 8 + 3]);
        const so = speciesOf(S[j * 8 + 3]); if (r < BETA && so !== mine) press[so] += G[so * 72 + 64] * (1 - r / BETA);
      }
    }
    let hs = shadeOf(hi);
    if (set.mode === 'battle' && held > 0 && Math.fround(blue / held) !== Math.fround(set.tip)) hs = Math.min(1, Math.max(0, hs + set.contagion * DT * (+(blue / held > set.tip) - hs)));
    if (set.mode === 'evolve') {
      let best = 0; for (let t = 1; t < SPECIES; t++) if (press[t] > press[best]) best = t;
      hs = (press[best] > 0 && chance(i) < Math.fround(set.contagion * DT) * press[best] ? best : mine) / 15;
    }
    const h = kindOf(hi) + 0.999 * hs;
    let v = at(i, 4).map((x, c) => x * damp + f[c] * rr * 10 * DT), q;
    if (sphere) { const m = p.map((x, c) => x + v[c] * DT), l = len(m); q = m.map((x) => (x / l) * RHO); const d = dot(q, v) / (RHO * RHO); v = v.map((x, c) => x - q[c] * d); }
    else q = [((p[0] + v[0] * DT) % 1 + 1) % 1, ((p[1] + v[1] * DT) % 1 + 1) % 1, 0];
    want.set([...q, h, ...v, 0], i * 8);
  }
  steps(1);
  const got = await readState();
  let worst = 0;
  let other = 0; // (Evolve: a species taken otherwise, a press summed in another order a hair across the chance)
  for (let i = 0; i < got.length; i++) {
    let d = Math.abs(got[i] - want[i]); if (!sphere && i % 8 < 2) d = Math.min(d, 1 - d);
    if (i % 8 === 3 && set.mode === 'evolve' && d > 1e-3) { other++; continue; }
    worst = Math.max(worst, d);
  }
  const ok = worst < 1e-4 && other <= set.n * 0.002;
  console.log(`particlesCheck: one step of ${set.n} particles, ${set.mode} on the ${set.space}, GPU (bins) against CPU (every pair), largest difference ${worst.toExponential(2)}${set.mode === 'evolve' ? `, species taken otherwise ${other}` : ''}: ${ok ? 'ok' : 'FAILED'}`);
  return ok;
}

// Physarum's step on the CPU from the agents and map read back: each agent's smell, turn and step (in float32 as the GPU,
// but its cos and sin its own: an agent whose sensor falls a hair the other side of a cell's edge may turn otherwise, a
// few counted apart), then the map spread
// from the agents' new places as the GPU left them (so the map is checked on its own, exactly)
async function checkPhysarum() {
  const read = async (b, floats) => { await device.queue.onSubmittedWorkDone(); const t = device.createBuffer({ size: floats * 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST }), e = device.createCommandEncoder(); e.copyBufferToBuffer(b, 0, t, 0, floats * 4); device.queue.submit([e.finish()]); await t.mapAsync(GPUMapMode.READ); const a = new Float32Array(t.getMappedRange().slice(0)); t.destroy(); return a; };
  const n = set.n, W = mapSide, A = await read(states[flip], n * 8), T = await read(maps[flip], W * W * 4), bits = new Uint32Array(A.buffer), rad = Math.PI / 180;
  const fract = (x) => x - Math.floor(x), cell = (x, y) => Math.min(Math.floor(fract(x) * W), W - 1) + Math.min(Math.floor(fract(y) * W), W - 1) * W;
  const smell = (x, y, s) => { const c = cell(x, y) * 4; let v = 0; for (let k = 0; k < 4; k++) v += T[c + k] * (k === s ? 1 : -set.repel); return v; };
  const chance = (i) => { let x = (Math.imul(i, 747796405) + (bits[i * 8] ^ Math.imul(bits[i * 8 + 1], 2891336453) ^ Math.imul(bits[i * 8 + 2], 1181783497))) >>> 0; x = Math.imul(((x >>> ((x >>> 28) + 4)) ^ x) >>> 0, 277803737) >>> 0; x = ((x >>> 22) ^ x) >>> 0; return x / 4294967296; };
  const f32 = Math.fround, SA = f32(set.angle * rad), RA = f32(set.turn * rad), far = f32(f32(set.sensor) / W), want = new Float32Array(n * 8);
  const at = (x, h, c) => f32(x + f32(f32(c(h)) * far));
  for (let i = 0; i < n; i++) {
    const x = A[i * 8], y = A[i * 8 + 1], s = A[i * 8 + 3];
    let h = A[i * 8 + 4];
    const hl = f32(h + SA), hr = f32(h - SA);
    const F = smell(at(x, h, Math.cos), at(y, h, Math.sin), s), L = smell(at(x, hl, Math.cos), at(y, hl, Math.sin), s), R = smell(at(x, hr, Math.cos), at(y, hr, Math.sin), s);
    if (F < L && F < R) h = f32(h + (chance(i) < 0.5 ? RA : -RA));
    else if (!(F > L && F > R)) { if (L > R) h = f32(h + RA); else if (R > L) h = f32(h - RA); }
    h = f32(h - f32(6.2831853 * Math.floor(f32(h / f32(6.2831853)))));
    want.set([fract(x + (Math.cos(h) * set.speed) / W), fract(y + (Math.sin(h) * set.speed) / W), 0, s, h], i * 8);
  }
  steps(1);
  const got = await read(states[flip], n * 8), map = await read(maps[flip], W * W * 4);
  let apart = 0, worst = 0;
  const torus = (d) => Math.min(d, 1 - d), angle = (d) => Math.min(d, 2 * Math.PI - d);
  for (let i = 0; i < n; i++) {
    const d = Math.max(torus(Math.abs(got[i * 8] - want[i * 8])), torus(Math.abs(got[i * 8 + 1] - want[i * 8 + 1])), angle(Math.abs(got[i * 8 + 4] - want[i * 8 + 4])), Math.abs(got[i * 8 + 3] - want[i * 8 + 3]));
    if (d > 1e-3) apart++; else worst = Math.max(worst, d);
  }
  const laid = new Float32Array(W * W * 4);
  for (let i = 0; i < n; i++) laid[cell(got[i * 8], got[i * 8 + 1]) * 4 + got[i * 8 + 3]] += Math.floor(5 * 256) / 256;
  let mapWorst = 0;
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) for (let k = 0; k < 4; k++) {
    let sum = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sum += T[(((y + dy + W) % W) * W + ((x + dx + W) % W)) * 4 + k];
    const c = (y * W + x) * 4 + k, v = (sum / 9 + laid[c]) * set.decay;
    mapWorst = Math.max(mapWorst, Math.abs(map[c] - v) / Math.max(1, v));
  }
  const ok = worst < 1e-4 && apart <= n * 0.002 && mapWorst < 1e-4;
  console.log(`particlesCheck: one step of ${n} agents, physarum on the torus, GPU against CPU: agents ${worst.toExponential(2)} apart (${apart} turned otherwise), map ${mapWorst.toExponential(2)}: ${ok ? 'ok' : 'FAILED'}`);
  return ok;
}
