/* ==============================================================================================
 * AGENTS — agents.js
 * ==============================================================================================
 *
 * Darwinian agents with no training (after Fraser Price's evolving dots): dots on a torus (the unit
 * square, its sides glued), each with a brain of its own, a small network (16 senses → 16 tanh →
 * 8 outputs, 5 used: thrust, turn, appetite, split, a memory fed back), its weights random at its
 * founder and only ever mutated. Beneath them a field of food, a grid of F × F cells (F = √slots,
 * so a cell a slot), each growing back towards its richness (smooth patches from the seed) and
 * spreading to its four neighbours. Every step costs energy: living, moving (by the thrust) and
 * eating (by the appetite); what an agent eats is its appetite's share of its cell's food (a cell
 * asked for more than it holds shares it out by appetite). With no energy left it dies; when it
 * wants to split and holds enough, it halves its energy with a child laid beside it, the brain
 * copied with a tenth of its weights moved by up to `mutate`. Nothing is rewarded but staying
 * alive long enough to split: foraging, avoiding crowds, timing a split come from selection alone.
 * A dot's colour comes from its brain (three fixed random projections of its weights): a child's a
 * shade off its parent's, a lineage one hue drifting; each founder's id carried by its children.
 * Slots, not agents: a fixed array of `cap` agents, each alive or not (no compaction); a dead slot
 * pushed on a free stack (an atomic counter, its top), a birth popping one. When fewer than a
 * sixteenth of the slots live, random agents are laid (64 a step).
 * Lengths in cells (1/F of the world): a neighbour sensed within REACH, the food at SENSOR ahead.
 * WebGPU, a step in nine compute passes: clear (the bins and appetites zeroed, the field's new
 * picture made current, the clock ticked), bin, scan and place (particles/'s bins: each live
 * agent counted into bins a reach wide, the starts summed, the agents copied in bin order), think
 * (each agent senses, runs its brain, moves and adds its appetite to its cell's, fixed-point, an
 * atomic sum: the same whatever the order), grow (each cell shares its food out and grows back),
 * eat (each agent's meal; the starved die), birth (the splits) and spawn. Drawn as the field and
 * a disc an agent, its brain's colour, brighter the more energy it holds.
 * agentsCheck() in the console: each pass on the GPU against the same pass on the CPU (from the
 * same buffers read back: atomics make a whole run's births land in other slots), then a run where
 * the population lives by itself and its lineages change.
 */

/* ---- 1.1 Setting ----------------------------------------------------------------------------- */

const SLOTS = [4096, 16384, 65536], STEPS = [1, 2, 4, 8];
// A brain: 16 senses, 16 hidden, 8 outputs (the last 3 kept for signals, sharing, fights: their weights drift, unread);
// its weights in one row, W1 (16 × 16), B1, W2 (8 × 16), B2
const IN = 16, HIDDEN = 16, OUT = 8, USED = 5, BRAIN = IN * HIDDEN + HIDDEN + OUT * HIDDEN + OUT;
const W1 = 0, B1 = IN * HIDDEN, W2 = B1 + HIDDEN, B2 = W2 + OUT * HIDDEN;
const E_MAX = 2, SPAWN_ENERGY = 0.5, SPLIT_MIN = 0.4, SPLIT_COST = 0.02, HARVEST = 0.05; // (energies; HARVEST the most an
// agent eats a step)
const ACCEL = 0.1, DRAG = 0.8, TURN = 0.5, SIDE = 0.6, SENSOR = 2, REACH = 3, BIRTH_GAP = 0.5, TOP_SPEED = 0.5; // (cells;
// TURN and SIDE radians: the most it turns a step, the side sensors' angle)
const AGE_SCALE = 1000, SCALE = 1048576, MUTATE_SHARE = 0.1, WMAX = 4, COLOUR = 2, SPAWNS = 64, START_SHARE = 4; // (an
// appetite in fixed point ×SCALE; a quarter of the slots live at the start)
const TAU = 2 * Math.PI, NONE = 0xffffffff;
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
// The setting from the link: #cap=65536&steps=2&seed=1&live=0.003&move=0.002&effort=0.001&regrow=0.01&diffuse=0.05&
// mutate=0.3&v=0.4.N (v: the version it was made with)
const hash = Object.fromEntries(new URLSearchParams(location.hash.slice(1)));
const num = (v, d) => (v === undefined || v === '' || isNaN(+v) ? d : +v);
const set = { cap: SLOTS.includes(+hash.cap) ? +hash.cap : 65536, steps: STEPS.includes(+hash.steps) ? +hash.steps : 2, seed: +hash.seed || 1, live: num(hash.live, 0.003), move: num(hash.move, 0.002), effort: num(hash.effort, 0.001), regrow: num(hash.regrow, 0.01), diffuse: num(hash.diffuse, 0.05), mutate: num(hash.mutate, 0.3) };
// The app's version: the cache key of Tessera's page (index.html's ?v=, written with VERSION by tools/ship.sh)
let version = '';
const keep = () => history.replaceState(null, '', '#' + new URLSearchParams({ ...set, ...(version && { v: version }) }));
// The world a start makes: its slots, field side F (a cell a slot), bins side G (each a reach wide at least), seed
let world = null;
const worldOf = () => { const F = Math.round(Math.sqrt(set.cap)); return { cap: set.cap, F, G: Math.floor(F / REACH), seed: set.seed >>> 0, cells: F * F, bins: Math.floor(F / REACH) ** 2 }; };
// An agent's random number in [0, 1) for a step (the clock) and a use (salt): PCG's hash of its id and the step's, 24 bits
// (a float's exactly), the same on the GPU; salts: think 0, birth 1 to 901, spawn 2048 on
const pcg = (v) => { const s = (Math.imul(v, 747796405) + 2891336453) >>> 0, w = Math.imul(((s >>> ((s >>> 28) + 4)) ^ s) >>> 0, 277803737) >>> 0; return ((w >>> 22) ^ w) >>> 0; };
const random = (i, clock, salt) => (pcg((i ^ pcg((Math.imul(clock, 4096) + salt + Math.imul(world.seed, 0x9e3779b9)) >>> 0)) >>> 0) >>> 8) / 16777216;
// A brain's colour: its weights projected on three fixed random ways (±1 each, by PCG), squashed (near brains, near colours)
const colourSign = (k, c) => ((pcg((k + 0x51ed27) >>> 0) >>> c) & 1) * 2 - 1;
const colourOf = (brain, at = 0) => [0, 1, 2].map((c) => { let s = 0; for (let k = 0; k < BRAIN; k++) s += brain[at + k] * colourSign(k, c); return 0.5 + 0.5 * Math.tanh(s * (COLOUR / Math.sqrt(BRAIN))); });
// The field's richness: six waves round the torus (whole numbers of turns each way), from the seed: rich and poor patches
function richness(F, seed) {
  const r = mulberry32(seed * 7919), waves = Array.from({ length: 6 }, () => [1 + Math.floor(r() * 4), Math.floor(r() * 7) - 3, r() * TAU]), out = new Float32Array(F * F);
  for (let y = 0; y < F; y++) for (let x = 0; x < F; x++) {
    let v = 0; for (const [a, b, p] of waves) v += Math.sin(TAU * ((a * x + b * y) / F) + p);
    out[y * F + x] = Math.min(1, Math.max(0, v * 0.3 + 0.35));
  }
  return out;
}
// A founder laid by spawn thread t at a clock (the GPU's spawn, and the start's agents: t their slot, clock 0): its
// brain (written at `brains[at]`) and its agent's 16 floats (founder: its lineage)
function founder(t, clock, founderId, brains, at) {
  for (let k = 0; k < BRAIN; k++) brains[at + k] = random(t, clock, 2051 + k) * 2 - 1;
  return [random(t, clock, 2048), random(t, clock, 2049), 0, 0, random(t, clock, 2050) * TAU, SPAWN_ENERGY, 0, 1, ...colourOf(brains, at), founderId, 0, 0, 0, -(t + 1)];
}

/* ---- 1.2 Shaders ----------------------------------------------------------------------------- */

const f = (x) => (Number.isInteger(x) ? x.toFixed(1) : String(x)); // (a WGSL float)
// The world's sizes and the buffers' layouts, baked into the shaders at each start
const COMMON = (w) => `
const CAP = ${w.cap}u; const F = ${w.F}u; const G = ${w.G}u; const SEED = ${w.seed}u; const CELLS = F * F; const BINS = G * G;
// tally (atomics): the bins' counts, the cells' appetites, then the counters
const DEMAND = BINS; const TOP = BINS + CELLS; const CLOCK = TOP + 1u; const FOUNDERS = TOP + 2u; const BIRTHS = TOP + 3u; const DEATHS = TOP + 4u; const SPAWNED = TOP + 5u;
// index: the bins' starts, the agents in bin order, each agent's bin and place in it, the free stack
const SORTED = BINS + 1u; const AT = SORTED + CAP; const FREE = AT + 2u * CAP;
// field: the food now, the food next, the richness, each cell's share given this step
const NOW = 0u; const NEXT = CELLS; const RICHNESS = 2u * CELLS; const SHARE = 3u * CELLS;
const BRAIN = ${BRAIN}u; const W1 = ${W1}u; const B1 = ${B1}u; const W2 = ${W2}u; const B2 = ${B2}u; const USED = ${USED}u;
const E_MAX = ${f(E_MAX)}; const SPAWN_ENERGY = ${f(SPAWN_ENERGY)}; const SPLIT_MIN = ${f(SPLIT_MIN)}; const SPLIT_COST = ${f(SPLIT_COST)}; const HARVEST = ${f(HARVEST)};
const ACCEL = ${f(ACCEL)}; const DRAG = ${f(DRAG)}; const TURN = ${f(TURN)}; const SIDE = ${f(SIDE)}; const SENSOR = ${f(SENSOR)}; const REACH = ${f(REACH)}; const BIRTH_GAP = ${f(BIRTH_GAP)}; const TOP_SPEED = ${f(TOP_SPEED)};
const AGE_SCALE = ${f(AGE_SCALE)}; const SCALE = ${f(SCALE)}; const MUTATE_SHARE = ${f(MUTATE_SHARE)}; const WMAX = ${f(WMAX)}; const COLOUR = ${f(COLOUR)};
const TAU = 6.2831853; const NONE = 0xffffffffu;
// An agent: a place and speed; heading, energy, age, alive (1 or 0); its colour and lineage (its founder's id); its
// memory, its appetite this step (after eating: its meal), its wish to split (1 or 0), its parent (−1 − t: spawned)
struct Agent { a: vec4f, b: vec4f, c: vec4f, d: vec4f };
// cost: living, moving, eating, mutation; grow: regrowth, diffusion; spawn: the fewest alive before spawning, spawns a
// step; view: x and y scales, a dot's half size x and y; look: zoom, the place in the middle, unused; canvas: width, height
struct Params { cost: vec4f, grow: vec4f, spawn: vec4u, view: vec4f, look: vec4f, canvas: vec4f };
fn cellOf(p: vec2f) -> u32 { let c = min(vec2u(floor(p * f32(F))), vec2u(F - 1u)); return c.y * F + c.x; }`;
const COMPUTE = (w) => COMMON(w) + `
@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read_write> agents: array<Agent>;
@group(0) @binding(2) var<storage, read_write> brains: array<f32>;
@group(0) @binding(3) var<storage, read_write> near: array<vec4f>;  // the live agents in bin order: place and energy, colour
@group(0) @binding(4) var<storage, read_write> tally: array<atomic<u32>>;
@group(0) @binding(5) var<storage, read_write> index: array<u32>;
@group(0) @binding(6) var<storage, read_write> field: array<f32>;
// (see random() and colourOf() on the CPU)
fn pcg(v: u32) -> u32 { let s = v * 747796405u + 2891336453u; let w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
fn random(i: u32, clock: u32, salt: u32) -> f32 { return f32(pcg(i ^ pcg(clock * 4096u + salt + SEED * 0x9e3779b9u)) >> 8u) / 16777216.0; }
fn squash(x: f32) -> f32 { return tanh(clamp(x, -10.0, 10.0)); } // (tanh, its overflow kept off)
fn colourOf(j: u32) -> vec3f {
  var s = vec3f(0.0);
  for (var k = 0u; k < BRAIN; k++) { let h = pcg(k + 0x51ed27u); s += brains[j * BRAIN + k] * (vec3f(f32(h & 1u), f32((h >> 1u) & 1u), f32((h >> 2u) & 1u)) * 2.0 - 1.0); }
  return 0.5 + 0.5 * tanh(s * (COLOUR / sqrt(f32(BRAIN))));
}
fn way(h: f32) -> vec2f { return vec2f(cos(h), sin(h)); }
fn binCell(p: vec2f) -> vec2u { return min(vec2u(floor(p * f32(G))), vec2u(G - 1u)); }
fn foodAt(p: vec2f) -> f32 { return field[NOW + cellOf(fract(p))]; }
// A free slot popped (NONE: none left; a pop that found the stack empty given back)
fn pop() -> u32 {
  let k = atomicSub(&tally[TOP], 1u);
  if (k == 0u || k > CAP) { atomicAdd(&tally[TOP], 1u); return NONE; }
  return index[FREE + k - 1u];
}
// The bins and appetites zeroed, the field's next picture made the one now, the clock ticked
@compute @workgroup_size(256) fn clear(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i < BINS) { atomicStore(&tally[i], 0u); }
  if (i < CELLS) { atomicStore(&tally[DEMAND + i], 0u); field[NOW + i] = field[NEXT + i]; }
  if (i == 0u) { atomicAdd(&tally[CLOCK], 1u); }
}
@compute @workgroup_size(256) fn bin(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x; if (i >= CAP || agents[i].b.w == 0.0) { return; }
  let c = binCell(agents[i].a.xy); let b = c.y * G + c.x;
  index[AT + 2u * i] = b; index[AT + 2u * i + 1u] = atomicAdd(&tally[b], 1u);
}
// The bins' starts (particles/'s): each of 256 threads sums its run of bins, the 256 sums scanned together, then each
// run written
var<workgroup> part: array<u32, 256>;
@compute @workgroup_size(256) fn scan(@builtin(local_invocation_id) lid: vec3u) {
  let t = lid.x; let C = (BINS + 255u) / 256u; let lo = min(t * C, BINS); let hi = min(lo + C, BINS);
  var s = 0u;
  for (var b = lo; b < hi; b++) { s += atomicLoad(&tally[b]); }
  part[t] = s;
  workgroupBarrier();
  for (var off = 1u; off < 256u; off *= 2u) {
    let v = select(0u, part[t - off], t >= off);
    workgroupBarrier();
    part[t] += v;
    workgroupBarrier();
  }
  var base = part[t] - s;
  for (var b = lo; b < hi; b++) { index[b] = base; base += atomicLoad(&tally[b]); }
  if (t == 255u) { index[BINS] = part[255]; }
}
@compute @workgroup_size(256) fn place(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x; if (i >= CAP) { return; } let me = agents[i]; if (me.b.w == 0.0) { return; }
  let s = index[index[AT + 2u * i]] + index[AT + 2u * i + 1u];
  index[SORTED + s] = i; near[2u * s] = vec4f(me.a.xy, me.b.y, 0.0); near[2u * s + 1u] = vec4f(me.c.xyz, 0.0);
}
// One agent: its senses (the food here and ahead, its nearest neighbour within the reach, the crowd), its brain, then
// its acts: turned, sped, moved; its appetite added to its new cell's; its costs paid
@compute @workgroup_size(64) fn think(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x; if (i >= CAP) { return; } let me = agents[i]; if (me.b.w == 0.0) { return; }
  let clock = atomicLoad(&tally[CLOCK]); let p = me.a.xy; let h = me.b.x; let cell = 1.0 / f32(F);
  var x: array<f32, 16>;
  x[0] = me.b.y / E_MAX; x[1] = foodAt(p);
  x[2] = foodAt(p + way(h) * (SENSOR * cell)); x[3] = foodAt(p + way(h + SIDE) * (SENSOR * cell)); x[4] = foodAt(p + way(h - SIDE) * (SENSOR * cell));
  let reach = REACH * cell; var best = reach; var nearest = NONE; var crowd = 0.0; let c = vec2i(binCell(p)); let g = i32(G);
  for (var dy = -1; dy <= 1; dy++) { for (var dx = -1; dx <= 1; dx++) {
    let q = (c + vec2i(dx, dy) + g) % g; let b = u32(q.y * g + q.x);
    for (var s = index[b]; s < index[b + 1u]; s++) {
      if (index[SORTED + s] == i) { continue; }
      var e = near[2u * s].xy - p; e -= round(e); let l = length(e);
      if (l < reach) { crowd += 1.0 - l / reach; if (l < best) { best = l; nearest = s; } }
    }
  } }
  if (nearest != NONE) {
    let o = near[2u * nearest]; var e = o.xy - p; e -= round(e); let a = atan2(e.y, e.x) - h;
    x[5] = 1.0 - best / reach; x[6] = sin(a); x[7] = cos(a);
    x[8] = 1.0 - length(near[2u * nearest + 1u].xyz - me.c.xyz) / sqrt(3.0); x[9] = o.z / E_MAX;
  }
  x[10] = crowd * 0.25; x[11] = length(me.a.zw) / (TOP_SPEED * cell); x[12] = min(1.0, me.b.z / AGE_SCALE);
  x[13] = me.d.x; x[14] = random(i, clock, 0u) * 2.0 - 1.0; x[15] = me.d.y / HARVEST;
  let base = i * BRAIN; var hidden: array<f32, 16>;
  for (var j = 0u; j < 16u; j++) { var s = brains[base + B1 + j]; for (var k = 0u; k < 16u; k++) { s += brains[base + W1 + j * 16u + k] * x[k]; } hidden[j] = squash(s); }
  var y: array<f32, USED>;
  for (var o = 0u; o < USED; o++) { var s = brains[base + B2 + o]; for (var j = 0u; j < 16u; j++) { s += brains[base + W2 + o * 16u + j] * hidden[j]; } y[o] = s; }
  let thrust = squash(y[0]); let appetite = 0.5 + 0.5 * squash(y[2]);
  var heading = h + squash(y[1]) * TURN; heading -= TAU * floor(heading / TAU);
  let v = me.a.zw * DRAG + way(heading) * (thrust * ACCEL * cell);
  let q = fract(p + v); let units = u32(round(appetite * HARVEST * SCALE));
  atomicAdd(&tally[DEMAND + cellOf(q)], units);
  let energy = me.b.y - P.cost.x - P.cost.y * abs(thrust) - P.cost.z * appetite;
  agents[i] = Agent(vec4f(q, v), vec4f(heading, energy, me.b.z + 1.0, 1.0), me.c, vec4f(squash(y[4]), f32(units) / SCALE, select(0.0, 1.0, y[3] > 0.0), me.d.w));
}
// The food a cell gives (all it holds when asked for less, else shared by appetite: its share of each appetite) and what
// it keeps, spread to and from its four neighbours by the diffusion, grown back towards its richness
fn appetiteAt(c: u32) -> f32 { return f32(atomicLoad(&tally[DEMAND + c])) / SCALE; }
fn leftAt(c: u32) -> f32 { return field[NOW + c] - min(field[NOW + c], appetiteAt(c)); }
@compute @workgroup_size(16, 16) fn grow(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= F || id.y >= F) { return; }
  let c = id.y * F + id.x; let D = appetiteAt(c);
  field[SHARE + c] = select(0.0, min(field[NOW + c], D) / D, D > 0.0);
  let l = (id.x + F - 1u) % F; let r = (id.x + 1u) % F; let u = (id.y + F - 1u) % F; let d = (id.y + 1u) % F;
  let left = leftAt(c); let mean = (leftAt(id.y * F + l) + leftAt(id.y * F + r) + leftAt(u * F + id.x) + leftAt(d * F + id.x)) * 0.25;
  let spread = left + P.grow.y * (mean - left);
  field[NEXT + c] = max(0.0, spread + P.grow.x * (field[RICHNESS + c] - spread));
}
// One agent's meal (its appetite times its cell's share); starved, it dies and its slot goes on the free stack
@compute @workgroup_size(64) fn eat(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x; if (i >= CAP) { return; } var me = agents[i]; if (me.b.w == 0.0) { return; }
  let meal = me.d.y * field[SHARE + cellOf(me.a.xy)];
  me.b.y = min(E_MAX, me.b.y + meal); me.d.y = meal;
  if (me.b.y <= 0.0) { me.b.w = 0.0; me.d.z = 0.0; index[FREE + atomicAdd(&tally[TOP], 1u)] = i; atomicAdd(&tally[DEATHS], 1u); }
  agents[i] = me;
}
// One agent's split: a free slot popped, the energy left after the cost halved with the child, laid BIRTH_GAP away,
// its brain the parent's with a tenth of the weights moved by up to the mutation (a dead slot's wish is 0: the slot
// being written never splits too)
@compute @workgroup_size(64) fn birth(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x; if (i >= CAP) { return; } var me = agents[i];
  if (me.b.w == 0.0 || me.d.z == 0.0 || me.b.y < SPLIT_MIN) { return; }
  let j = pop(); if (j == NONE) { return; }
  let clock = atomicLoad(&tally[CLOCK]); let e = (me.b.y - SPLIT_COST) * 0.5;
  for (var k = 0u; k < BRAIN; k++) {
    var w = brains[i * BRAIN + k];
    if (random(i, clock, 1u + 2u * k) < MUTATE_SHARE) { w = clamp(w + (random(i, clock, 2u + 2u * k) * 2.0 - 1.0) * P.cost.w, -WMAX, WMAX); }
    brains[j * BRAIN + k] = w;
  }
  let a = random(i, clock, 900u) * TAU; let h = random(i, clock, 901u) * TAU;
  me.b.y = e; me.d.z = 0.0; agents[i] = me;
  agents[j] = Agent(vec4f(fract(me.a.xy + way(a) * (BIRTH_GAP / f32(F))), 0.0, 0.0), vec4f(h, e, 0.0, 1.0), vec4f(colourOf(j), me.c.w), vec4f(0.0, 0.0, 0.0, f32(i)));
  atomicAdd(&tally[BIRTHS], 1u);
}
// Spawn thread t, while too few live: a founder at a random place, its brain random, a new lineage (see founder())
@compute @workgroup_size(64) fn spawn(@builtin(global_invocation_id) id: vec3u) {
  let t = id.x; if (t >= P.spawn.y || CAP - atomicLoad(&tally[TOP]) >= P.spawn.x) { return; }
  let j = pop(); if (j == NONE) { return; }
  let clock = atomicLoad(&tally[CLOCK]);
  for (var k = 0u; k < BRAIN; k++) { brains[j * BRAIN + k] = random(t, clock, 2051u + k) * 2.0 - 1.0; }
  let lineage = f32(atomicAdd(&tally[FOUNDERS], 1u) & 0xffffffu);
  agents[j] = Agent(vec4f(random(t, clock, 2048u), random(t, clock, 2049u), 0.0, 0.0), vec4f(random(t, clock, 2050u) * TAU, SPAWN_ENERGY, 0.0, 1.0), vec4f(colourOf(j), lineage), vec4f(0.0, 0.0, 0.0, -f32(t + 1u)));
  atomicAdd(&tally[SPAWNED], 1u);
}`;
// The field (dark, green with food, the richness faint beneath) and the agents as discs over it, both round the place
// in the middle, zoomed
const DRAW = (w) => COMMON(w) + `
@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read> agents: array<Agent>;
@group(0) @binding(2) var<storage, read> field: array<f32>;
@vertex fn full(@builtin(vertex_index) v: u32) -> @builtin(position) vec4f { return vec4f(f32(v & 1u) * 4.0 - 1.0, f32(v >> 1u) * 4.0 - 1.0, 0.0, 1.0); }
@fragment fn ground(@builtin(position) px: vec4f) -> @location(0) vec4f {
  let at = P.look.yz + (px.xy - P.canvas.xy * 0.5) / (P.look.x * min(P.canvas.x, P.canvas.y));
  let c = cellOf(fract(at));
  return vec4f(vec3f(0.03, 0.035, 0.05) + vec3f(0.05, 0.05, 0.07) * field[RICHNESS + c] + vec3f(0.06, 0.3, 0.12) * field[NEXT + c], 1.0);
}
struct Out { @builtin(position) pos: vec4f, @location(0) uv: vec2f, @location(1) c: vec3f };
@vertex fn disc(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> Out {
  var corners = array(vec2f(-1, -1), vec2f(1, -1), vec2f(-1, 1), vec2f(-1, 1), vec2f(1, -1), vec2f(1, 1));
  let a = agents[ii]; var o: Out; o.uv = corners[vi];
  if (a.b.w == 0.0) { o.pos = vec4f(2.0, 2.0, 0.0, 1.0); return o; } // (a dead slot: off screen)
  let centre = (fract(a.a.xy - P.look.yz + 0.5) - 0.5) * 2.0 * P.look.x * P.view.xy * vec2f(1.0, -1.0);
  o.pos = vec4f(centre + o.uv * P.view.zw, 0.0, 1.0); o.c = a.c.rgb * (0.45 + 0.55 * clamp(a.b.y / E_MAX, 0.0, 1.0));
  return o;
}
@fragment fn spot(i: Out) -> @location(0) vec4f { if (dot(i.uv, i.uv) > 1.0) { discard; } return vec4f(i.c, 1.0); }`;

/* ---- 1.3 GPU --------------------------------------------------------------------------------- */

const view = document.getElementById('view');
const fail = (text) => { const e = document.getElementById('fail'); e.style.display = 'flex'; e.textContent = text; throw new Error(text); };
const PASSES = ['clear', 'bin', 'scan', 'place', 'think', 'grow', 'eat', 'birth', 'spawn'];
let device, context, format, params, pipes = {}, groundPipe, discPipe, group, drawGroup, bufs = {};
let forceSpawn = false; // (agentsCheck: spawn whatever the population, to check the pass)
async function gpu() {
  const adapter = navigator.gpu && (await navigator.gpu.requestAdapter());
  if (!adapter) fail('This page needs WebGPU (Chrome, Edge, or a recent Safari).');
  device = await adapter.requestDevice({ requiredLimits: { maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize, maxBufferSize: adapter.limits.maxBufferSize } });
  context = view.getContext('webgpu'); format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'opaque' });
  params = device.createBuffer({ size: 96, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
}
const buffer = (bytes) => device.createBuffer({ size: Math.max(16, bytes), usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
// The workgroups each pass dispatches
const workgroups = (name) => { const w = world; return { clear: [Math.ceil(Math.max(w.bins, w.cells) / 256)], bin: [w.cap / 256], scan: [1], place: [w.cap / 256], think: [w.cap / 64], grow: [Math.ceil(w.F / 16), Math.ceil(w.F / 16)], eat: [w.cap / 64], birth: [w.cap / 64], spawn: [1] }[name]; };
// A fresh world: the pipelines for its sizes, its buffers, a quarter of its slots founders (founder(): t its slot, clock
// 0), the others on the free stack, the field full at its richness
function start() {
  world = worldOf();
  const { cap, F, cells, bins } = world, S = GPUShaderStage;
  const cm = device.createShaderModule({ code: COMPUTE(world) }), dm = device.createShaderModule({ code: DRAW(world) });
  const storage = (b) => ({ binding: b, visibility: S.COMPUTE, buffer: { type: 'storage' } });
  const layout = device.createBindGroupLayout({ entries: [{ binding: 0, visibility: S.COMPUTE, buffer: {} }, ...[1, 2, 3, 4, 5, 6].map(storage)] });
  const pl = device.createPipelineLayout({ bindGroupLayouts: [layout] });
  pipes = Object.fromEntries(PASSES.map((e) => [e, device.createComputePipeline({ layout: pl, compute: { module: cm, entryPoint: e } })]));
  groundPipe = device.createRenderPipeline({ layout: 'auto', vertex: { module: dm, entryPoint: 'full' }, fragment: { module: dm, entryPoint: 'ground', targets: [{ format }] } });
  discPipe = device.createRenderPipeline({ layout: 'auto', vertex: { module: dm, entryPoint: 'disc' }, fragment: { module: dm, entryPoint: 'spot', targets: [{ format }] } });
  for (const b of Object.values(bufs)) b.destroy();
  bufs = { agents: buffer(cap * 64), brains: buffer(cap * BRAIN * 4), near: buffer(cap * 32), tally: buffer((bins + cells + 8) * 4), index: buffer((bins + 1 + 4 * cap) * 4), field: buffer(cells * 16) };
  const n0 = cap / START_SHARE, agents = new Float32Array(cap * 16), brains = new Float32Array(cap * BRAIN);
  for (let t = 0; t < n0; t++) agents.set(founder(t, 0, t, brains, t * BRAIN), t * 16);
  const index = new Uint32Array(bins + 1 + 4 * cap), tally = new Uint32Array(bins + cells + 8), FREE = bins + 1 + 3 * cap;
  for (let k = 0; k < cap - n0; k++) index[FREE + k] = cap - 1 - k;
  tally[bins + cells] = cap - n0; tally[bins + cells + 2] = n0; // (the stack's top, the next founder's id)
  const rich = richness(F, world.seed), field = new Float32Array(cells * 4);
  field.set(rich, 0); field.set(rich, cells); field.set(rich, 2 * cells);
  const q = device.queue;
  q.writeBuffer(bufs.agents, 0, agents); q.writeBuffer(bufs.brains, 0, brains); q.writeBuffer(bufs.index, 0, index); q.writeBuffer(bufs.tally, 0, tally); q.writeBuffer(bufs.field, 0, field);
  group = device.createBindGroup({ layout, entries: [params, bufs.agents, bufs.brains, bufs.near, bufs.tally, bufs.index, bufs.field].map((buffer, binding) => ({ binding, resource: { buffer } })) });
  // (each drawing's layout holds the bindings it reads only: the ground the field, the discs the agents)
  drawGroup = [[groundPipe, 2, bufs.field], [discPipe, 1, bufs.agents]].map(([p, binding, buffer]) => device.createBindGroup({ layout: p.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: params } }, { binding, resource: { buffer } }] }));
}
// The parameters for the steps and the drawing
function write() {
  const w = view.width, h = view.height, m = Math.min(w, h), dot = Math.max(1, ((m * look.zoom) / world.F) * 0.42);
  const buf = new ArrayBuffer(96), u = new Uint32Array(buf), fl = new Float32Array(buf);
  fl.set([set.live, set.move, set.effort, set.mutate, set.regrow, set.diffuse, 0, 0]);
  u.set([forceSpawn ? world.cap : world.cap / 16, SPAWNS, 0, 0], 8);
  fl.set([m / w, m / h, (dot * 2) / w, (dot * 2) / h, look.zoom, look.x, look.y, 0, w, h, 0, 0], 12);
  device.queue.writeBuffer(params, 0, buf);
}
// `count` steps (or the passes named) in one submission
function steps(count, names = PASSES) {
  const enc = device.createCommandEncoder();
  for (let s = 0; s < count; s++) {
    const pass = enc.beginComputePass();
    pass.setBindGroup(0, group);
    for (const name of names) { pass.setPipeline(pipes[name]); pass.dispatchWorkgroups(...workgroups(name)); }
    pass.end();
  }
  device.queue.submit([enc.finish()]);
}
function draw() {
  const enc = device.createCommandEncoder(), out = enc.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }] });
  out.setPipeline(groundPipe); out.setBindGroup(0, drawGroup[0]); out.draw(3);
  out.setPipeline(discPipe); out.setBindGroup(0, drawGroup[1]); out.draw(6, world.cap);
  out.end();
  device.queue.submit([enc.finish()]);
}
// A buffer read back (its first `bytes`)
async function read(b, bytes = b.size) {
  const t = device.createBuffer({ size: bytes, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST }), e = device.createCommandEncoder();
  e.copyBufferToBuffer(b, 0, t, 0, bytes); device.queue.submit([e.finish()]);
  await t.mapAsync(GPUMapMode.READ); const a = t.getMappedRange().slice(0); t.destroy(); return a;
}
// The counters: the free stack's top (so the live, cap − top), the clock, the founders laid, births, deaths, spawns
async function counters() {
  const { bins, cells } = world, c = new Uint32Array(await read(bufs.tally, (bins + cells + 8) * 4)).slice(bins + cells);
  return { live: world.cap - c[0], clock: c[1], founders: c[2], births: c[3], deaths: c[4], spawned: c[5] };
}
// The lineages alive: each founder's id with its live agents and their mean colour, the largest first
async function lineages() {
  const A = new Float32Array(await read(bufs.agents)), by = new Map();
  for (let i = 0; i < world.cap; i++) {
    if (!A[i * 16 + 7]) continue;
    const id = A[i * 16 + 11], l = by.get(id) ?? { id, n: 0, c: [0, 0, 0] };
    l.n++; for (let c = 0; c < 3; c++) l.c[c] += A[i * 16 + 8 + c]; by.set(id, l);
  }
  return [...by.values()].sort((a, b) => b.n - a.n);
}
// The place in the middle and the zoom (the wheel), moved by drags
const look = { zoom: 1, x: 0.5, y: 0.5 };

/* ---- 1.4 Panel ------------------------------------------------------------------------------- */

// One choice among several: a tab group (Lenia Worlds' .tabs)
const tabs = (el, values, get, pick, name = (v) => v) => {
  el.innerHTML = '';
  for (const v of values) { const b = document.createElement('button'); b.className = 'btn'; b.textContent = name(v); b.onclick = () => pick(v); el.append(b); }
  const mark = () => [...el.children].forEach((b, i) => b.classList.toggle('on', values[i] === get()));
  mark(); return mark;
};
let on = true, markSlots, markSteps;
function panel() {
  markSlots = tabs(document.getElementById('slots'), SLOTS, () => set.cap, (v) => { set.cap = v; fresh(); }, (v) => v / 1024 + 'k');
  markSteps = tabs(document.getElementById('steps'), STEPS, () => set.steps, (v) => { set.steps = v; markSteps(); keep(); });
  document.getElementById('restart').onclick = () => fresh();
  document.getElementById('newWorld').onclick = () => { set.seed = 1 + Math.floor(Math.random() * 99999); fresh(); };
  document.getElementById('play').onclick = (e) => { on = !on; e.target.textContent = on ? 'Pause' : 'Play'; };
  for (const id of ['live', 'move', 'effort', 'regrow', 'diffuse', 'mutate']) {
    const input = document.getElementById(id), out = input.nextElementSibling;
    input.value = set[id]; out.textContent = set[id];
    input.oninput = () => { set[id] = +input.value; out.textContent = input.value; keep(); };
  }
  // A drag moves over the torus; the wheel zooms (1 to 64 times)
  let drag = null;
  view.onpointerdown = (e) => { drag = [e.clientX, e.clientY]; view.setPointerCapture(e.pointerId); };
  view.onpointermove = (e) => {
    if (!drag) return;
    const m = Math.min(view.clientWidth, view.clientHeight);
    look.x -= (e.clientX - drag[0]) / m / look.zoom; look.y -= (e.clientY - drag[1]) / m / look.zoom; drag = [e.clientX, e.clientY];
  };
  view.onwheel = (e) => { e.preventDefault(); look.zoom = Math.min(64, Math.max(1, look.zoom * Math.exp(-e.deltaY * 0.002))); };
  view.onpointerup = () => { drag = null; };
}
function fresh() {
  markSlots(); markSteps(); msStep = 0; census = ''; lastCount = null;
  document.getElementById('seed').textContent = 'seed ' + set.seed; document.getElementById('census').innerHTML = '';
  start(); keep();
}

/* ---- 1.5 Loop -------------------------------------------------------------------------------- */

const fit = () => { const r = view.getBoundingClientRect(), d = devicePixelRatio || 1; view.width = Math.max(1, Math.round(r.width * d)); view.height = Math.max(1, Math.round(r.height * d)); };
addEventListener('resize', fit);
// A step's time, measured now and then (a batch of steps submitted alone, waited for), with the counters (births and
// deaths a step since the last time) and the lineages
let msStep = 0, frames = 0, last = performance.now(), fps = 0, census = '', lastCount = null;
async function measure() {
  write(); await device.queue.onSubmittedWorkDone();
  const t0 = performance.now(); steps(8); await device.queue.onSubmittedWorkDone(); msStep = (performance.now() - t0) / 8;
  const c = await counters(), L = await lineages(), was = lastCount ?? c, dt = Math.max(1, c.clock - was.clock);
  lastCount = c;
  const colour = (l) => `rgb(${l.c.map((x) => Math.round((x / l.n) * 255)).join(',')})`;
  document.getElementById('census').innerHTML = L.slice(0, 6).map((l) => `<span style="color:${colour(l)}">■ #${l.id} ${((100 * l.n) / c.live).toFixed(1)}%</span>`).join('<br>');
  census = `\n${L.length.toLocaleString('en')} lineages · ${((c.births - was.births) / dt).toFixed(1)} births, ${((c.deaths - was.deaths) / dt).toFixed(1)} deaths a step · step ${c.clock.toLocaleString('en')}${c.spawned ? ` · ${c.spawned.toLocaleString('en')} spawned` : ''}\n${c.live.toLocaleString('en')} alive`;
}
function frame(t) {
  write();
  if (on) steps(set.steps);
  draw();
  fps = fps * 0.95 + 50 / Math.max(1, t - last); last = t;
  if (++frames % 60 === 1 && on) measure();
  document.getElementById('stats').textContent = `${world.cap.toLocaleString('en')} slots · ${world.F} × ${world.F} field · ${world.G} × ${world.G} bins\n${msStep ? msStep.toFixed(2) : '…'} ms a step · ${fps.toFixed(0)} frames a second${census}`;
  requestAnimationFrame(frame);
}
(async () => {
  version = await fetch('../index.html').then((r) => r.text()).then((t) => t.match(/main\.js\?v=([\d.]+)/)?.[1] ?? '').catch(() => '');
  await gpu(); panel(); fit(); fresh(); requestAnimationFrame(frame);
})();

/* ---- 1.6 Check ------------------------------------------------------------------------------- */

// Each pass on the GPU against the same pass on the CPU, from the buffers read back before it (a world of 4,096 slots,
// 300 steps in), then a run of 16,384 slots: its population living by itself and its lineages changing; back to the
// setting shown
window.agentsCheck = async () => {
  const playing = on, was = { ...set };
  on = false; // (the loop stepping meanwhile would change what is read)
  try {
    Object.assign(set, { cap: 4096, seed: 1, live: 0.003, move: 0.002, effort: 0.001, regrow: 0.01, diffuse: 0.05, mutate: 0.3 }); fresh();
    write(); steps(300);
    const ok = [await checkPasses(), await checkRun()];
    return ok.every(Boolean);
  } finally { Object.assign(set, was); fresh(); on = playing; }
};
const say = (ok, text) => { console.log(`agentsCheck: ${text}: ${ok ? 'ok' : 'FAILED'}`); return ok; };
// Every buffer read back, with views of each layout's parts
async function snapshot() {
  await device.queue.onSubmittedWorkDone();
  const { bins, cells, cap } = world, T = new Uint32Array(await read(bufs.tally)), I = new Uint32Array(await read(bufs.index));
  return { A: new Float32Array(await read(bufs.agents)), W: new Float32Array(await read(bufs.brains)), N: new Float32Array(await read(bufs.near)), T, I, Fd: new Float32Array(await read(bufs.field)), top: T[bins + cells], clock: T[bins + cells + 1], founders: T[bins + cells + 2], FREE: bins + 1 + 3 * cap };
}
const fr = Math.fround, wrap = (d) => Math.min(Math.abs(d), 1 - Math.abs(d)), angle = (d) => Math.min(Math.abs(d), TAU - Math.abs(d));
const cellOf = (x, y) => Math.min(Math.floor(x * world.F), world.F - 1) + Math.min(Math.floor(y * world.F), world.F - 1) * world.F;
const squash = (x) => Math.tanh(Math.max(-10, Math.min(10, x)));
// Two agents' 16 floats apart: the largest difference (places on the torus, headings round the circle)
const apartBy = (a, b) => Math.max(...Array.from({ length: 16 }, (_, k) => (k < 2 ? wrap(a[k] - b[k]) : k === 4 ? angle(a[k] - b[k]) : Math.abs(a[k] - b[k]))));
async function checkPasses() {
  const { cap, F, G, bins, cells } = world, ok = [];
  // Binning: each live agent once, in its own bin, its copy right; the field's next picture made the one now
  const S0 = await snapshot();
  steps(1, ['clear', 'bin', 'scan', 'place']);
  const S1 = await snapshot();
  let live = 0, wrong = 0; const seen = new Uint8Array(cap);
  for (let i = 0; i < cap; i++) live += S1.A[i * 16 + 7] ? 1 : 0;
  for (let b = 0; b < bins; b++) for (let s = S1.I[b]; s < S1.I[b + 1]; s++) {
    const i = S1.I[bins + 1 + s], x = S1.A[i * 16], y = S1.A[i * 16 + 1];
    if (seen[i]++ || Math.min(Math.floor(x * G), G - 1) + Math.min(Math.floor(y * G), G - 1) * G !== b || S1.N[s * 8] !== x || S1.N[s * 8 + 1] !== y || S1.N[s * 8 + 2] !== S1.A[i * 16 + 5]) wrong++;
  }
  let fieldMoved = 0; for (let c = 0; c < cells; c++) fieldMoved = Math.max(fieldMoved, Math.abs(S1.Fd[c] - S0.Fd[cells + c]));
  ok.push(say(S1.I[bins] === live && !wrong && fieldMoved === 0 && S1.clock === S0.clock + 1, `binning ${live} live agents in ${bins} bins, ${wrong} misplaced`));
  // Think: every pair within the reach (no bins), the brain, the acts, the cells' appetites
  steps(1, ['think']);
  const S2 = await snapshot(), want = new Float32Array(S1.A), demand = new Float64Array(cells), cell = 1 / F, reach = REACH * cell;
  const alive = []; for (let i = 0; i < cap; i++) if (S1.A[i * 16 + 7]) alive.push(i);
  const foodAt = (x, y) => S1.Fd[cellOf(x - Math.floor(x), y - Math.floor(y))];
  for (const i of alive) {
    const a = S1.A.subarray(i * 16, i * 16 + 16), x = new Float64Array(16), h = a[4], px = a[0], py = a[1], sc = SENSOR * cell;
    x[0] = a[5] / E_MAX; x[1] = foodAt(px, py);
    x[2] = foodAt(px + Math.cos(h) * sc, py + Math.sin(h) * sc); x[3] = foodAt(px + Math.cos(h + SIDE) * sc, py + Math.sin(h + SIDE) * sc); x[4] = foodAt(px + Math.cos(h - SIDE) * sc, py + Math.sin(h - SIDE) * sc);
    let best = reach, nearest = -1, crowd = 0;
    for (const j of alive) {
      if (j === i) continue;
      let ex = S1.A[j * 16] - px, ey = S1.A[j * 16 + 1] - py; ex -= Math.round(ex); ey -= Math.round(ey);
      const l = Math.hypot(ex, ey); if (l < reach) { crowd += 1 - l / reach; if (l < best) { best = l; nearest = j; } }
    }
    if (nearest >= 0) {
      const o = S1.A.subarray(nearest * 16, nearest * 16 + 16); let ex = o[0] - px, ey = o[1] - py; ex -= Math.round(ex); ey -= Math.round(ey); const t = Math.atan2(ey, ex) - h;
      x[5] = 1 - best / reach; x[6] = Math.sin(t); x[7] = Math.cos(t); x[8] = 1 - Math.hypot(o[8] - a[8], o[9] - a[9], o[10] - a[10]) / Math.sqrt(3); x[9] = o[5] / E_MAX;
    }
    x[10] = crowd * 0.25; x[11] = Math.hypot(a[2], a[3]) / (TOP_SPEED * cell); x[12] = Math.min(1, a[6] / AGE_SCALE); x[13] = a[12]; x[14] = random(i, S1.clock, 0) * 2 - 1; x[15] = a[13] / HARVEST;
    const W = S1.W, base = i * BRAIN, hidden = new Float64Array(HIDDEN), y = new Float64Array(USED);
    for (let j = 0; j < HIDDEN; j++) { let s = W[base + B1 + j]; for (let k = 0; k < IN; k++) s += W[base + W1 + j * IN + k] * x[k]; hidden[j] = squash(s); }
    for (let o = 0; o < USED; o++) { let s = W[base + B2 + o]; for (let j = 0; j < HIDDEN; j++) s += W[base + W2 + o * HIDDEN + j] * hidden[j]; y[o] = s; }
    const thrust = squash(y[0]), appetite = 0.5 + 0.5 * squash(y[2]);
    let heading = h + squash(y[1]) * TURN; heading -= TAU * Math.floor(heading / TAU);
    const vx = a[2] * DRAG + Math.cos(heading) * thrust * ACCEL * cell, vy = a[3] * DRAG + Math.sin(heading) * thrust * ACCEL * cell;
    const qx = px + vx - Math.floor(px + vx), qy = py + vy - Math.floor(py + vy), units = Math.round(appetite * HARVEST * SCALE);
    demand[cellOf(qx, qy)] += units;
    want.set([qx, qy, vx, vy, heading, a[5] - set.live - set.move * Math.abs(thrust) - set.effort * appetite, a[6] + 1, 1, a[8], a[9], a[10], a[11], squash(y[4]), units / SCALE, y[3] > 0 ? 1 : 0, a[15]], i * 16);
  }
  let worst = 0, flipped = 0, demandWorst = 0;
  for (const i of alive) { const d = apartBy(S2.A.subarray(i * 16, i * 16 + 16), want.subarray(i * 16, i * 16 + 16)); if (d > 1e-3) flipped++; else worst = Math.max(worst, d); }
  for (let c = 0; c < cells; c++) demandWorst = Math.max(demandWorst, Math.abs(S2.T[bins + c] - demand[c]));
  ok.push(say(worst < 1e-4 && flipped <= alive.length * 0.002 && demandWorst <= 8, `think, ${alive.length} agents: largest difference ${worst.toExponential(2)}, ${flipped} split wishes flipped (a brain's output a hair from 0), appetites ${demandWorst} units apart at most`));
  // Grow: each cell's share and next food from the food now and the appetites (the GPU's)
  steps(1, ['grow']);
  const S3 = await snapshot(); let growWorst = 0;
  const appetiteAt = (c) => S2.T[bins + c] / SCALE, leftAt = (c) => S2.Fd[c] - Math.min(S2.Fd[c], appetiteAt(c));
  for (let y = 0; y < F; y++) for (let x = 0; x < F; x++) {
    const c = y * F + x, D = appetiteAt(c), share = D > 0 ? Math.min(S2.Fd[c], D) / D : 0, left = leftAt(c);
    const mean = (leftAt(y * F + (x + F - 1) % F) + leftAt(y * F + (x + 1) % F) + leftAt(((y + F - 1) % F) * F + x) + leftAt(((y + 1) % F) * F + x)) * 0.25;
    const spread = left + set.diffuse * (mean - left), next = Math.max(0, spread + set.regrow * (S2.Fd[2 * cells + c] - spread));
    growWorst = Math.max(growWorst, Math.abs(S3.Fd[3 * cells + c] - share), Math.abs(S3.Fd[cells + c] - next));
  }
  ok.push(say(growWorst < 1e-5, `grow, ${cells} cells: largest difference ${growWorst.toExponential(2)}`));
  // Eat: each meal, the starved dead, their slots on the free stack (in any order)
  steps(1, ['eat']);
  const S4 = await snapshot(), fed = new Float32Array(S3.A), died = new Set();
  let eatWorst = 0;
  for (const i of alive) {
    const a = fed.subarray(i * 16, i * 16 + 16), meal = fr(a[13] * S3.Fd[3 * cells + cellOf(a[0], a[1])]);
    a[5] = Math.min(E_MAX, fr(a[5] + meal)); a[13] = meal;
    if (a[5] <= 0) { a[7] = 0; a[14] = 0; died.add(i); }
    eatWorst = Math.max(eatWorst, apartBy(S4.A.subarray(i * 16, i * 16 + 16), a));
  }
  const pushed = new Set(S4.I.subarray(S4.FREE + S3.top, S4.FREE + S4.top));
  ok.push(say(eatWorst < 1e-6 && S4.top === S3.top + died.size && [...died].every((i) => pushed.has(i)), `eat: largest difference ${eatWorst.toExponential(2)}, ${died.size} died, their slots pushed`));
  // Birth: the parents' energy, each child (found by its parent) in a slot popped, its brain mutated as on the CPU
  steps(1, ['birth']);
  const S5 = await snapshot(), parents = alive.filter((i) => S4.A[i * 16 + 7] && S4.A[i * 16 + 14] && S4.A[i * 16 + 5] >= SPLIT_MIN);
  const popped = new Set(S4.I.subarray(S4.FREE + S4.top - Math.min(parents.length, S4.top), S4.FREE + S4.top)), childOf = new Map();
  for (const j of popped) childOf.set(S5.A[j * 16 + 15], j);
  let birthWorst = 0, missing = 0;
  if (parents.length <= S4.top) for (const i of parents) {
    const j = childOf.get(i), a = S4.A.subarray(i * 16, i * 16 + 16), e = fr((a[5] - SPLIT_COST) * 0.5);
    if (j === undefined) { missing++; continue; }
    const brain = new Float32Array(BRAIN);
    for (let k = 0; k < BRAIN; k++) { let w = S4.W[i * BRAIN + k]; if (random(i, S4.clock, 1 + 2 * k) < MUTATE_SHARE) w = Math.min(WMAX, Math.max(-WMAX, w + (random(i, S4.clock, 2 + 2 * k) * 2 - 1) * set.mutate)); brain[k] = w; }
    const t = random(i, S4.clock, 900) * TAU, gap = BIRTH_GAP / F, cx = a[0] + Math.cos(t) * gap, cy = a[1] + Math.sin(t) * gap;
    const child = [cx - Math.floor(cx), cy - Math.floor(cy), 0, 0, random(i, S4.clock, 901) * TAU, e, 0, 1, ...colourOf(brain), a[11], 0, 0, 0, i];
    let brainWorst = 0; for (let k = 0; k < BRAIN; k++) brainWorst = Math.max(brainWorst, Math.abs(S5.W[j * BRAIN + k] - brain[k]));
    birthWorst = Math.max(birthWorst, brainWorst, apartBy(S5.A.subarray(j * 16, j * 16 + 16), child), Math.abs(S5.A[i * 16 + 5] - e));
  }
  const births = Math.min(parents.length, S4.top);
  ok.push(say(birthWorst < 1e-4 && !missing && S5.top === S4.top - births && childOf.size === births, `birth: ${births} children${parents.length > S4.top ? ` (${parents.length} wished, the slots too few: counted only)` : ''}, largest difference ${birthWorst.toExponential(2)}, ${missing} missing`));
  // Spawn (forced): SPAWNS founders in slots popped, each as founder() makes it, new lineages
  forceSpawn = true; write(); steps(1, ['spawn']); forceSpawn = false; write();
  const S6 = await snapshot(), spawns = Math.min(SPAWNS, S5.top);
  let spawnWorst = 0, found = 0; const ids = new Set();
  for (const j of S5.I.subarray(S5.FREE + S5.top - spawns, S5.FREE + S5.top)) {
    const t = -S6.A[j * 16 + 15] - 1, brain = new Float32Array(BRAIN); if (!(t >= 0 && t < SPAWNS)) continue;
    found++; ids.add(S6.A[j * 16 + 11]);
    const want = founder(t, S5.clock, S6.A[j * 16 + 11], brain, 0);
    for (let k = 0; k < BRAIN; k++) spawnWorst = Math.max(spawnWorst, Math.abs(S6.W[j * BRAIN + k] - brain[k]));
    spawnWorst = Math.max(spawnWorst, apartBy(S6.A.subarray(j * 16, j * 16 + 16), want));
  }
  const newIds = [...ids].every((id) => id >= S5.founders && id < S5.founders + spawns);
  ok.push(say(spawnWorst < 1e-4 && found === spawns && ids.size === spawns && newIds && S6.top === S5.top - spawns, `spawn: ${found} founders, largest difference ${spawnWorst.toExponential(2)}, their lineages new`));
  return ok.every(Boolean);
}
// A run of 16,384 slots for 6,000 steps: alive at the end above the spawning floor (living by itself), many generations
// born, and its lineages changed (most founders' gone, the largest grown)
async function checkRun() {
  Object.assign(set, { cap: 16384 }); fresh(); write();
  const first = (await lineages()).length;
  for (let s = 0; s < 6000; s += 200) { steps(200); await device.queue.onSubmittedWorkDone(); }
  const c = await counters(), L = await lineages(), share = L[0].n / c.live;
  return say(c.live > world.cap / 16 && c.births > 4 * first && L.length < first / 2 && share > 0.01, `run of ${c.clock} steps: ${c.live} alive of ${world.cap} slots, ${c.births} births, ${c.deaths} deaths, ${c.spawned} spawned, lineages ${first} → ${L.length} (the largest ${(100 * share).toFixed(1)}%)`);
}
