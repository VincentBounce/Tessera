'use strict';
/* ==============================================================================================
 * LENIA WORLDS — lenia.js
 * ==============================================================================================
 *
 * Bert Chan's Lenia (continuous Life) on the GPU, in eight life channels (two layers of four) and
 * a wall texture.
 * How it fits together:
 *   PART 1 — GPU: programs, float textures, the FFT
 *   PART 2 — LAWS: kernels and growth from Chan's species, a law for each world
 *   PART 3 — THE WORLD: one step, creatures placed, walls drawn
 *   PART 4 — VIEW AND CONTROLS
 *
 * A step: each layer's four channels packed as two complex numbers per texel go through one FFT;
 * each kernel's spectrum times its source's spectrum, four kernels per inverse FFT, gives each
 * kernel's potential; the update turns potentials into growth (Chan's own formulas), then clips to
 * [0, 1] and kills what stands on a wall (as the walls of Hamon et al.'s sensorimotor Lenia do).
 */

const $ = (id) => document.getElementById(id);
const TAU = 2 * Math.PI;

/* ==============================================================================================
 * PART 1 — GPU: PROGRAMS, FLOAT TEXTURES, THE FFT
 * ==============================================================================================
 *
 * Every pass draws one triangle over its target. Textures are RGBA32F, N×N, NEAREST, read by
 * texelFetch. The FFT is Stockham's (natural order in and out), radix 4 with one radix-2 stage when
 * log2 N is odd: a pass per stage and axis, each reading and writing the whole texture, so half
 * the passes of radix 2 is nearly half the time.
 */

/* ---- 1.1 Context and passes ------------------------------------------------------------------ */

let N = 512;
const MAX_K = 32, GROUPS = MAX_K / 4;
const canvas = $('view');
const gl = canvas.getContext('webgl2', { antialias: false, alpha: false });
const floatOk = gl && gl.getExtension('EXT_color_buffer_float');
const linearOk = gl && gl.getExtension('OES_texture_float_linear');

const VS = `#version 300 es
in vec2 aPos; void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;
const HEAD = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D;
out vec4 o;
`;

function program(fs) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, HEAD + fs]]) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src);
    gl.attachShader(p, s);
  }
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  p.loc = {};
  return p;
}

function texture(w, h, data = null, internal = gl.RGBA32F, format = gl.RGBA, type = gl.FLOAT, filter = gl.NEAREST) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  for (const wrap of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, wrap, gl.REPEAT);
  t.w = w; t.h = h;
  return t;
}

// A uniform set by its value's shape: a number is a float, {i} an int, an array a vector,
// {f: [...]} / {iv: [...]} a float or int array, {m3} a matrix.
function setUniform(p, name, v) {
  const loc = p.loc[name] ??= gl.getUniformLocation(p, name);
  if (loc === null) return;
  if (typeof v === 'number') gl.uniform1f(loc, v);
  else if (v.i !== undefined) gl.uniform1i(loc, v.i);
  else if (v.f) gl.uniform1fv(loc, v.f);
  else if (v.iv) gl.uniform1iv(loc, v.iv);
  else if (v.v4) gl.uniform4fv(loc, v.v4);
  else if (v.v3) gl.uniform3fv(loc, v.v3);
  else if (v.m34) gl.uniformMatrix3x4fv(loc, false, v.m34);
  else [, , gl.uniform2fv, gl.uniform3fv, gl.uniform4fv][v.length].call(gl, loc, v);
}

const quad = gl && gl.createVertexArray();
if (gl) {
  gl.bindVertexArray(quad);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
}

// A texture's own framebuffer, bound (made the first time).
function bindTarget(t) {
  if (!t.fb) {
    t.fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
  } else gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
}

// One pass: program p drawn into texture out (null: the screen), its textures bound in order.
function pass(p, out, uniforms = {}, textures = {}) {
  if (out) {
    bindTarget(out);
    gl.viewport(0, 0, out.w, out.h);
  } else {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  gl.useProgram(p);
  let unit = 0;
  for (const [name, t] of Object.entries(textures)) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    setUniform(p, name, { i: unit++ });
  }
  for (const [name, v] of Object.entries(uniforms)) setUniform(p, name, v);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

/* ---- 1.2 FFT --------------------------------------------------------------------------------- */

// One stage of radix r (2 or 4) making subtransforms of size uSize from r of size uSize/r, read
// N/r apart: out[i] = Σk w^(k·(i mod uSize)) in[e + k·N/r], w = exp(±2πi/uSize). A texel holds two
// complex numbers (xy, zw), both transformed at once.
const FFT_FS = `
uniform sampler2D uSrc; uniform int uSize, uRadix, uHoriz, uStride; uniform float uSign;
vec2 cmul(vec2 a, vec2 b) { return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  int index = uHoriz == 1 ? p.x : p.y, q = uSize / uRadix;
  int e = (index / uSize) * q + index % q;
  float base = uSign * 6.283185307179586 * float(index % uSize) / float(uSize);
  vec4 sum = vec4(0.0);
  for (int k = 0; k < 4; k++) {
    if (k >= uRadix) break;
    ivec2 at = p;
    if (uHoriz == 1) at.x = e + k * uStride; else at.y = e + k * uStride;
    vec4 v = texelFetch(uSrc, at, 0);
    vec2 w = vec2(cos(base * float(k)), sin(base * float(k)));
    sum += vec4(cmul(w, v.xy), cmul(w, v.zw));
  }
  o = sum;
}`;

let fftProgram, scratch;

// The radices of one axis: a 2 first when log2 N is odd, then 4s.
const radices = () => { const b = Math.log2(N); return [...(b % 2 ? [2] : []), ...Array((b - (b % 2)) / 2).fill(4)]; };

// src transformed into dst (forward, or inverse unscaled); src is left as it was.
function fft(src, dst, inverse) {
  const rs = radices(), total = 2 * rs.length;
  let input = src, k = 0;
  for (const horiz of [1, 0]) {
    let size = 1;
    for (const r of rs) {
      size *= r;
      const out = k === total - 1 ? dst : scratch[(k + (src === scratch[0] ? 1 : 0)) % 2];
      pass(fftProgram, out, { uSize: { i: size }, uRadix: { i: r }, uHoriz: { i: horiz }, uStride: { i: N / r }, uSign: inverse ? 1 : -1 }, { uSrc: input });
      input = out; k++;
    }
  }
}

/* ==============================================================================================
 * PART 2 — LAWS: KERNELS AND GROWTH FROM CHAN'S SPECIES, A LAW FOR EACH WORLD
 * ==============================================================================================
 *
 * A kernel: a ring shell of radius R (Chan's kernel_shell: rings b, core kn, relative radius r),
 * read from a mix of life channels (w: a weight a channel), adding to one channel (dst):
 * kind 0 is Chan's growth (gn, m, s, weight h, averaged over the channel's growth kernels),
 * kind 1 a push away (−h × potential), from the other species.
 */

/* ---- 2.1 Species data ------------------------------------------------------------------------ */

// Chan's RLE: counts, '.' empty, 'A'–'X' 1–24, 'p'–'y' then 'A'–'X' 25–255, '$' row end, '!' end.
function decodeRLE(st) {
  const rows = []; let row = [], count = '', lead = '';
  for (const ch of st) {
    if (ch >= '0' && ch <= '9') count += ch;
    else if (ch === '$' || ch === '!') {
      rows.push(row); row = [];
      for (let i = 1; i < (+count || 1); i++) rows.push([]);
      count = '';
      if (ch === '!') break;
    } else if (ch >= 'p' && ch <= 'y') lead = ch;
    else {
      const v = ch === '.' || ch === 'b' ? 0 : ch === 'o' ? 255
        : lead ? (lead.charCodeAt(0) - 112) * 24 + (ch.charCodeAt(0) - 65 + 25) : ch.charCodeAt(0) - 64;
      for (let i = 0; i < (+count || 1); i++) row.push(v / 255);
      count = ''; lead = '';
    }
  }
  if (row.length) rows.push(row);
  return rows;
}

// A species' cells as one RGBA32F pattern (its channels in r, g, b), its size and thumbnail.
function pattern(sp) {
  const chans = sp.cells.map(decodeRLE);
  const h = Math.max(...chans.map((c) => c.length)), w = Math.max(...chans.map((c) => Math.max(...c.map((r) => r.length))));
  const data = new Float32Array(w * h * 4);
  chans.forEach((rows, c) => rows.forEach((r, y) => r.forEach((v, x) => { data[((h - 1 - y) * w + x) * 4 + c] = v; })));
  return { w, h, data };
}

const fracs = (b) => String(b).split(',').map((f) => { const [a, d] = f.split('/'); return d ? a / d : +a; });
const CORES = [
  (r) => (4 * r * (1 - r)) ** 4,
  (r) => Math.exp(4 - 1 / (r * (1 - r))),
  (r) => (r >= 0.25 && r <= 0.75 ? 1 : 0),
  (r) => (r >= 0.25 && r <= 0.75 ? 1 : r < 0.25 ? 0.5 : 0),
  () => 1,  // (a disc, for the meetings)
];

// A kernel's image on the torus, centred at 0, summing to 1/N² (the inverse FFT's scale folded in).
function kernelImage(k) {
  const img = new Float32Array(N * N), bs = fracs(k.b), B = bs.length, core = CORES[(k.kn || 1) - 1];
  let sum = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = x < N / 2 ? x : x - N, dy = y < N / 2 ? y : y - N;
    const D = Math.hypot(dx, dy) / k.R;
    if (D >= k.r) continue;
    const Br = B * D / k.r, v = core(Math.min(Br % 1, 1)) * bs[Math.min(Math.floor(Br), B - 1)];
    if (v > 0) { img[y * N + x] = v; sum += v; }
  }
  if (sum > 0) for (let i = 0; i < img.length; i++) img[i] /= sum * N * N;
  return img;
}

/* ---- 2.2 Laws -------------------------------------------------------------------------------- */

// Eight life channels, held four to a layer (an RGBA texture).
const CH = 8, LAYERS = CH / 4;
const unitW = (c) => Array.from({ length: CH }, (_, i) => (i === c ? 1 : 0));
const range = (a, n) => Array.from({ length: n }, (_, i) => a + i);

// A team: a species on a block of channels from `at`, as many as its cells have (a zoo species 1,
// an organism 2 or 3), its law moved there (a kernel from its channel i to j: from at + i to at + j).
// The zoo's teams, a battle's, or the organism alone at 0.
const width = (sp) => sp.cells.length;
const teamsOf = (w) => (w.kind === 'organism' ? [{ sp: w.organism, at: 0 }] : w.kind === 'battle' ? w.fighters : w.teams);
const teamChannels = ({ sp, at }) => range(at, width(sp));
const channelsOf = (w) => teamsOf(w).flatMap(teamChannels);
const layersOf = (w) => Math.floor(Math.max(0, ...channelsOf(w)) / 4) + 1;
// The first block of n free channels, or −1.
function freeBlock(w, n) {
  const used = channelsOf(w);
  for (let at = 0; at + n <= CH; at++) if (!range(at, n).some((c) => used.includes(c))) return at;
  return -1;
}

// How teams meet: through a disc of radius reach × R, each team's growth lowered by h × the other
// teams' life in it. Push and Fight feel from afar; Territory only at contact, but hard: borders.
const MEETINGS = { Ghosts: null, Push: { h: 0.6, reach: 1 }, Fight: { h: 2, reach: 1 }, Territory: { h: 6, reach: 0.35 } };

// The kernels and time steps of a world: each team's law on its channels, and the meetings.
function lawOf(world) {
  const kernels = [], dt = Array(CH).fill(0), teams = teamsOf(world), live = channelsOf(world), meet = MEETINGS[world.meet];
  for (const team of teams) {
    const { sp, at } = team, own = teamChannels(team);
    for (const k of sp.kernels) kernels.push({ ...k, R: world.R, kind: 0, dst: at + k.c[1], w: unitW(at + k.c[0]) });
    if (meet && teams.length > 1) for (const c of own) kernels.push({ R: world.R * meet.reach, r: 1, b: '1', kn: 5, kind: 1, dst: c, w: unitW(c).map((_, i) => (live.includes(i) && !own.includes(i) ? 1 : 0)), h: meet.h });
    for (const c of own) dt[c] = 1 / sp.T;
  }
  const sumH = dt.map((_, c) => kernels.filter((k) => k.kind === 0 && k.dst === c).reduce((a, k) => a + k.h, 0));
  return { kernels, dt, sumH, layers: layersOf(world) };
}

/* ==============================================================================================
 * PART 3 — THE WORLD: ONE STEP, CREATURES PLACED, WALLS DRAWN
 * ==============================================================================================
 *
 * The state: two layers of four life channels in [0, 1], each a pair of textures (now, next); the
 * walls apart (one byte a cell on the CPU, the one source of the GPU's wall texture). Passes that
 * touch life run once a layer in use.
 */

/* ---- 3.1 Shaders ----------------------------------------------------------------------------- */

// The layers' spectra unpacked (each: ch0 + i·ch1, ch2 + i·ch3), mixed by each kernel's weights
// (two vec4s, one a layer), times the kernel's real spectrum; four kernels packed back as two
// complex numbers for one inverse FFT.
const MUL_FS = `
uniform sampler2D uSpec0, uSpec1, uKer; uniform vec4 uW[8]; uniform int uN;
void unpack(sampler2D s, ivec2 k, ivec2 km, inout vec2 X[4]) {
  vec4 z = texelFetch(s, k, 0), zm = texelFetch(s, km, 0);
  vec2 d1 = (z.xy - vec2(zm.x, -zm.y)) * 0.5, d2 = (z.zw - vec2(zm.z, -zm.w)) * 0.5;
  X[0] = (z.xy + vec2(zm.x, -zm.y)) * 0.5; X[1] = vec2(d1.y, -d1.x);
  X[2] = (z.zw + vec2(zm.z, -zm.w)) * 0.5; X[3] = vec2(d2.y, -d2.x);
}
void main() {
  ivec2 k = ivec2(gl_FragCoord.xy), km = (uN - k) % uN;
  vec2 A[4], B[4];
  unpack(uSpec0, k, km, A); unpack(uSpec1, k, km, B);
  vec4 K = texelFetch(uKer, k, 0);
  vec2 P[4];
  for (int i = 0; i < 4; i++) {
    vec4 a = uW[2 * i], b = uW[2 * i + 1];
    P[i] = K[i] * (a.x * A[0] + a.y * A[1] + a.z * A[2] + a.w * A[3] + b.x * B[0] + b.y * B[1] + b.z * B[2] + b.w * B[3]);
  }
  o = vec4(P[0].x - P[1].y, P[0].y + P[1].x, P[2].x - P[3].y, P[2].y + P[3].x);
}`;

// Chan's update of one layer: A + dt·(Σ h·G(U) / Σ h), here minus dt·Σ h·U for the push-away
// kernels; nothing lives on a wall.
const STEP_FS = `
uniform sampler2D uState, uWalls, uPot0, uPot1, uPot2, uPot3, uPot4, uPot5, uPot6, uPot7;
uniform int uLayer, uK, uKind[${MAX_K}], uDst[${MAX_K}], uGn[${MAX_K}];
uniform float uM[${MAX_K}], uS[${MAX_K}], uH[${MAX_K}], uDt[8], uSumH[8];
float growth(int gn, float n, float m, float s) {
  float d = n - m;
  if (gn == 1) { float q = max(0.0, 1.0 - d * d / (9.0 * s * s)); q *= q; return q * q * 2.0 - 1.0; }
  if (gn == 3) return abs(d) <= s ? 1.0 : -1.0;
  return exp(-d * d / (2.0 * s * s)) * 2.0 - 1.0;
}
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 a = texelFetch(uState, p, 0), q[8];
  q[0] = texelFetch(uPot0, p, 0);
  if (uK > 4) q[1] = texelFetch(uPot1, p, 0);
  if (uK > 8) q[2] = texelFetch(uPot2, p, 0);
  if (uK > 12) q[3] = texelFetch(uPot3, p, 0);
  if (uK > 16) q[4] = texelFetch(uPot4, p, 0);
  if (uK > 20) q[5] = texelFetch(uPot5, p, 0);
  if (uK > 24) q[6] = texelFetch(uPot6, p, 0);
  if (uK > 28) q[7] = texelFetch(uPot7, p, 0);
  vec4 g = vec4(0.0), push = vec4(0.0);
  for (int i = 0; i < ${MAX_K}; i++) {
    if (i >= uK) break;
    if (uDst[i] / 4 != uLayer) continue;
    int c = uDst[i] % 4;
    float n = q[i / 4][i % 4];
    if (uKind[i] == 0) g[c] += uH[i] * growth(uGn[i], n, uM[i], uS[i]);
    else push[c] += uH[i] * max(n, 0.0);
  }
  int b = 4 * uLayer;
  vec4 dt = vec4(uDt[b], uDt[b + 1], uDt[b + 2], uDt[b + 3]), sumH = vec4(uSumH[b], uSumH[b + 1], uSumH[b + 2], uSumH[b + 3]);
  o = clamp(a + dt * (g / max(sumH, vec4(1e-9)) - push), 0.0, 1.0) * (1.0 - texelFetch(uWalls, p, 0).r);
}`;

// A pattern stamped at uCenter, turned and scaled; its channels routed (uRoute) into the layer's.
const STAMP_FS = `
uniform sampler2D uState, uPat, uWalls; uniform vec2 uCenter; uniform float uCos, uSin, uInv; uniform mat3x4 uRoute; uniform int uN;
vec3 at(ivec2 i) {
  ivec2 s = textureSize(uPat, 0);
  return i.x < 0 || i.y < 0 || i.x >= s.x || i.y >= s.y ? vec3(0.0) : texelFetch(uPat, i, 0).rgb;
}
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 a = texelFetch(uState, p, 0);
  vec2 d = vec2(p) + 0.5 - uCenter;
  d -= float(uN) * floor(d / float(uN) + 0.5);
  vec2 q = vec2(uCos * d.x + uSin * d.y, -uSin * d.x + uCos * d.y) * uInv + vec2(textureSize(uPat, 0)) * 0.5 - 0.5;
  ivec2 i = ivec2(floor(q)); vec2 f = fract(q);
  vec3 v = mix(mix(at(i), at(i + ivec2(1, 0)), f.x), mix(at(i + ivec2(0, 1)), at(i + ivec2(1, 1)), f.x), f.y);
  o = max(a, uRoute * v) * (1.0 - texelFetch(uWalls, p, 0).r);
}`;

// A layer's life kept (uKeep, a channel at a time) where there is no wall.
const KEEP_FS = `
uniform sampler2D uState, uWalls; uniform vec4 uKeep;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  o = texelFetch(uState, p, 0) * uKeep * (1.0 - texelFetch(uWalls, p, 0).r);
}`;

// Each B×B block's cells held by each team (its channels' life summed over 0.1): one texel of a
// (N/B)² census, a team a component (four at most). uTeam: a channel's team, or −1.
const TEAMS_FS = `
uniform sampler2D uL0, uL1; uniform int uB, uTeam[8];
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy) * uB;
  vec4 held = vec4(0.0);
  for (int y = 0; y < uB; y++) for (int x = 0; x < uB; x++) {
    vec4 a = texelFetch(uL0, p + ivec2(x, y), 0), b = texelFetch(uL1, p + ivec2(x, y), 0), team = vec4(0.0);
    for (int c = 0; c < 8; c++) if (uTeam[c] >= 0) team[uTeam[c]] += c < 4 ? a[c] : b[c - 4];
    held += step(0.1, team);
  }
  o = held;
}`;

// Each B×B block of a layer summed: one texel of a (N/B)² census.
const CENSUS_FS = `
uniform sampler2D uState; uniform int uB;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy) * uB;
  vec4 s = vec4(0.0);
  for (int y = 0; y < uB; y++) for (int x = 0; x < uB; x++) s += texelFetch(uState, p + ivec2(x, y), 0);
  o = s;
}`;

// The colour of life: each channel its colour, added.
const COLOUR_GLSL = `
uniform vec3 uCol[8];
vec3 colour(vec4 a, vec4 b) {
  return uCol[0] * a.x + uCol[1] * a.y + uCol[2] * a.z + uCol[3] * a.w + uCol[4] * b.x + uCol[5] * b.y + uCol[6] * b.z + uCol[7] * b.w;
}`;

// The trails: the colour of life, kept as it fades (uFade a frame), shown dimmed under it.
const TRAIL_FS = `
uniform sampler2D uTrail, uL0, uL1; uniform float uFade;
${COLOUR_GLSL}
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  o = vec4(max(texelFetch(uTrail, p, 0).rgb * uFade, colour(texelFetch(uL0, p, 0), texelFetch(uL1, p, 0))), 1.0);
}`;

// Life erased in a disc (the walls are erased on the CPU).
const ERASE_FS = `
uniform sampler2D uState; uniform vec2 uCenter; uniform float uRadius; uniform int uN;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec2 d = vec2(p) + 0.5 - uCenter;
  d -= float(uN) * floor(d / float(uN) + 0.5);
  o = length(d) < uRadius ? vec4(0.0) : texelFetch(uState, p, 0);
}`;

// The world on screen: the colour of life and of its trails, softly saturated; walls over it.
const SHOW_FS = `
uniform sampler2D uL0, uL1, uTrail, uWalls; uniform vec2 uOrigin; uniform float uScale, uTrails; uniform vec3 uBg, uWall; uniform int uN, uLinear;
${COLOUR_GLSL}
vec4 at(sampler2D t, vec2 w) { return uLinear == 1 ? texture(t, w / float(uN)) : texelFetch(t, ivec2(w), 0); }
void main() {
  vec2 w = (gl_FragCoord.xy - uOrigin) * uScale;
  if (w.x < 0.0 || w.y < 0.0 || w.x >= float(uN) || w.y >= float(uN)) { o = vec4(uBg * 0.6, 1.0); return; }
  vec3 c = colour(at(uL0, w), at(uL1, w)) + 0.28 * uTrails * at(uTrail, w).rgb;
  c = uBg + (1.0 - uBg) * (1.0 - exp(-1.7 * c));
  o = vec4(mix(c, uWall, texture(uWalls, w / float(uN)).r), 1.0);
}`;

/* ---- 3.2 State and step ---------------------------------------------------------------------- */

let P, state, spec, kernelSpecs, pots, wallsTex, census, teamCensus, trail, law, kernelCount = 0;
const BLOCK = 8;
let CENSUS, walls;

function setupGPU() {
  P = { fft: program(FFT_FS), mul: program(MUL_FS), step: program(STEP_FS), stamp: program(STAMP_FS), keep: program(KEEP_FS), erase: program(ERASE_FS), census: program(CENSUS_FS), teams: program(TEAMS_FS), trail: program(TRAIL_FS), show: program(SHOW_FS) };
  fftProgram = P.fft;
}

// The world's textures for an n×n torus (n a power of 2), the old ones let go.
function allocate(n) {
  for (const t of [state, scratch, spec, kernelSpecs, pots, wallsTex, census, teamCensus, trail].flat(2).filter(Boolean)) {
    if (t.fb) gl.deleteFramebuffer(t.fb);
    gl.deleteTexture(t);
  }
  for (const f of [censusFence, score.fence]) if (f) gl.deleteSync(f);
  censusFence = score.fence = null;
  N = n; CENSUS = N / BLOCK; walls = new Uint8Array(N * N);
  const lin = linearOk ? gl.LINEAR : gl.NEAREST, field = () => texture(N, N, null, gl.RGBA32F, gl.RGBA, gl.FLOAT, lin);
  state = Array.from({ length: LAYERS }, () => [field(), field()]);
  scratch = [texture(N, N), texture(N, N)];
  spec = Array.from({ length: LAYERS }, () => texture(N, N));
  kernelSpecs = Array.from({ length: GROUPS }, () => texture(N, N));
  pots = Array.from({ length: GROUPS }, () => texture(N, N));
  wallsTex = texture(N, N, walls, gl.R8, gl.RED, gl.UNSIGNED_BYTE, gl.LINEAR);
  census = Array.from({ length: LAYERS }, () => texture(CENSUS, CENSUS));
  teamCensus = texture(CENSUS, CENSUS);
  trail = [field(), field()];
}

const layerTextures = () => ({ uL0: state[0][0], uL1: state[1][0] });
function fadeTrails(fade) {
  pass(P.trail, trail[1], { uFade: fade, uCol: { v3: COLOURS.flat() } }, { uTrail: trail[0], ...layerTextures() });
  trail.reverse();
}

// The law's kernels made, four to a texture, and their spectra taken by the same FFT.
function setLaw(l) {
  law = l; kernelCount = l.kernels.length;
  if (kernelCount > MAX_K) throw new Error(`${kernelCount} kernels, ${MAX_K} at most`);
  for (let g = 0; g * 4 < kernelCount; g++) {
    const packed = new Float32Array(N * N * 4);
    l.kernels.slice(4 * g, 4 * g + 4).forEach((k, j) => { const img = kernelImage(k); for (let i = 0; i < N * N; i++) packed[i * 4 + j] = img[i]; });
    const t = texture(N, N, packed);
    fft(t, kernelSpecs[g], false);
    gl.deleteTexture(t);
  }
  const list = (f) => Array.from({ length: MAX_K }, (_, i) => (i < kernelCount ? f(l.kernels[i]) : 0));
  law.uniforms = {
    uK: { i: kernelCount }, uKind: { iv: list((k) => k.kind) }, uDst: { iv: list((k) => k.dst) }, uGn: { iv: list((k) => k.gn || 1) },
    uM: { f: list((k) => k.m || 0) }, uS: { f: list((k) => k.s || 1) }, uH: { f: list((k) => k.h ?? 1) }, uDt: { f: l.dt }, uSumH: { f: l.sumH },
  };
}

// A pass over each layer in use (all of them by default), each into its next texture, then swapped.
function apply(p, uniforms, textures = {}, layers = LAYERS) {
  for (let t = 0; t < layers; t++) {
    pass(p, state[t][1], typeof uniforms === 'function' ? uniforms(t) : uniforms, { uState: state[t][0], uWalls: wallsTex, ...textures });
    state[t].reverse();
  }
}

function step() {
  for (let t = 0; t < law.layers; t++) fft(state[t][0], spec[t], false);
  for (let g = 0; g * 4 < kernelCount; g++) {
    const w = [];
    for (let j = 0; j < 4; j++) { const kw = law.kernels[4 * g + j]?.w ?? Array(CH).fill(0); w.push(...kw.slice(0, 4), ...kw.slice(4, 8)); }
    pass(P.mul, scratch[1], { uW: { v4: w }, uN: { i: N } }, { uSpec0: spec[0], uSpec1: law.layers > 1 ? spec[1] : spec[0], uKer: kernelSpecs[g] });
    fft(scratch[1], pots[g], true);
  }
  const potTextures = Object.fromEntries(pots.map((t, g) => [`uPot${g}`, t]));
  apply(P.step, (t) => ({ ...law.uniforms, uLayer: { i: t } }), potTextures, law.layers);
  stepCount++;
}

/* ---- 3.3 Creatures --------------------------------------------------------------------------- */

// The world's chance: Math.random, or a seeded draw (mulberry32) while a battle is laid, so that
// its seed, in its link, lays the same walls and creatures again.
let chance = Math.random;
const mulberry = (a) => () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
function seeded(n, f) {
  const was = chance;
  chance = mulberry(n);
  try { f(); } finally { chance = was; }
}

const patterns = new Map();
function patternTex(sp) {
  if (!patterns.has(sp)) { const pt = pattern(sp); pt.tex = texture(pt.w, pt.h, pt.data); patterns.set(sp, pt); }
  return patterns.get(sp);
}

// Team i's creature placed at (x, y) in world cells, turned by angle: its pattern's channel j into
// the team's channel at + j (uRoute, a layer at a time: a pattern channel to a layer channel).
function place(i, x, y, angle = chance() * TAU) {
  const { sp, at } = teamsOf(world)[i], pt = patternTex(sp), s = world.R / sp.R;
  apply(P.stamp, (t) => {
    const route = new Float32Array(12);
    for (let j = 0; j < width(sp); j++) if (Math.floor((at + j) / 4) === t) route[j * 4 + (at + j) % 4] = 1;
    return { uCenter: [x, y], uCos: Math.cos(angle), uSin: Math.sin(angle), uInv: 1 / s, uRoute: { m34: route }, uN: { i: N } };
  }, { uPat: pt.tex });
}

const footprint = (sp) => { const pt = patternTex(sp); return Math.hypot(pt.w, pt.h) * 0.5 * world.R / sp.R; };
const wallAt = (x, y) => walls[(((y | 0) % N + N) % N) * N + (((x | 0) % N + N) % N)];

// A spot free for a creature of that radius: no wall within it, away from the spots already taken.
function spotFree(x, y, radius, taken) {
  if (wallAt(x, y) || !taken.every(([u, v, r]) => Math.hypot(u - x, v - y) > r + radius)) return false;
  for (let a = 0; a < 16; a++) for (const f of [0.3, 0.65, 1]) if (wallAt(x + Math.cos(a * TAU / 16) * radius * f, y + Math.sin(a * TAU / 16) * radius * f)) return false;
  return true;
}
// A free spot drawn anywhere, or null.
function freeSpot(radius, taken) {
  for (let tries = 0; tries < 400; tries++) {
    const x = chance() * N, y = chance() * N;
    if (spotFree(x, y, radius, taken)) return [x, y];
  }
  return null;
}

// A few of each team of the world (or of the teams given), on free spots (as many more as the world
// is larger, fewer as there are more teams); a battle laid by its own rule.
function seed(teams = teamsOf(world).map((_, i) => i)) {
  if (world.kind === 'battle') return layBattle();
  const each = Math.max(1, Math.round((world.kind === 'zoo' ? 12 / Math.max(3, teamsOf(world).length) : 5) * (N / 512) ** 2)), taken = [];
  for (let n = 0; n < each; n++) for (const i of teams) {
    const r = footprint(teamsOf(world)[i].sp), at = freeSpot(r, taken);
    if (at) { place(i, ...at); taken.push([...at, r]); }
  }
}

// A battle laid from its seed: Sides gives each team the same spots and turns, the first team's
// drawn in its sector (an angle 2π/K wide about the centre) and turned by 2πk/K for team k, a spot
// kept only if free for every team; Mixed draws each creature anywhere. Each team `each` creatures
// (as many more as the world is larger).
function layBattle() {
  const K = world.fighters.length, each = world.each * (N / 512) ** 2, taken = [], c = N / 2;
  const r = Math.max(...world.fighters.map(({ sp }) => footprint(sp)));
  seeded(world.seed + 1, () => {
    for (let n = 0; n < each; n++) {
      if (world.layout === 'Mixed') {
        for (let k = 0; k < K; k++) { const at = freeSpot(r, taken); if (at) { place(k, ...at); taken.push([...at, r]); } }
        continue;
      }
      for (let tries = 0; tries < 400; tries++) {
        const a = (chance() - 0.5) * TAU / K, d = N * (0.12 + 0.3 * chance()), turn = chance() * TAU;
        const spots = range(0, K).map((k) => [c + d * Math.cos(a + k * TAU / K), c + d * Math.sin(a + k * TAU / K)]);
        if (!spots.every(([x, y], k) => spotFree(x, y, r, [...taken, ...spots.slice(0, k).map((q) => [...q, r])]))) continue;
        spots.forEach(([x, y], k) => { place(k, x, y, turn + k * TAU / K); taken.push([x, y, r]); });
        break;
      }
    }
  });
}

// Keep alive: a team whose whole mass fell under half a creature's gets one more, on a spot
// free of walls and of life (read from the census of 8×8 blocks). The census is read back without
// waiting: into a buffer, taken once its fence is passed (a plain readPixels stalled a busy GPU
// for a second on ANGLE Metal).
const creatureMass = (sp) => { const pt = patternTex(sp); let m = 0; for (let i = 0; i < pt.w * pt.h; i++) m += pt.data[i * 4] + pt.data[i * 4 + 1] + pt.data[i * 4 + 2]; return m * (world.R / sp.R) ** 2; };
let censusBuffer = null, censusFence = null;
function keepAlive() {
  const cells = CENSUS * CENSUS;
  if (!censusFence) {
    censusBuffer ??= gl.createBuffer();
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, censusBuffer);
    gl.bufferData(gl.PIXEL_PACK_BUFFER, LAYERS * cells * 16, gl.STREAM_READ);
    for (let t = 0; t < LAYERS; t++) {
      pass(P.census, census[t], { uB: { i: BLOCK } }, { uState: state[t][0] });
      gl.readPixels(0, 0, CENSUS, CENSUS, gl.RGBA, gl.FLOAT, t * cells * 16);
    }
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    censusFence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    return;
  }
  if (gl.getSyncParameter(censusFence, gl.SYNC_STATUS) !== gl.SIGNALED) return;
  gl.deleteSync(censusFence); censusFence = null;
  const buf = new Float32Array(LAYERS * cells * 4);
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, censusBuffer);
  gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, buf);
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
  const total = Array(CH).fill(0), taken = [];
  for (let i = 0; i < cells; i++) {
    let m = 0;
    for (let c = 0; c < CH; c++) { const v = buf[(Math.floor(c / 4) * cells + i) * 4 + (c % 4)]; total[c] += v; m += v; }
    if (m > 0.5) taken.push([(i % CENSUS + 0.5) * BLOCK, (Math.floor(i / CENSUS) + 0.5) * BLOCK, BLOCK]);
  }
  for (const [i, team] of teamsOf(world).entries()) {
    const sp = team.sp, mass = teamChannels(team).reduce((a, c) => a + total[c], 0);
    if (mass >= 0.5 * creatureMass(sp)) continue;
    const at = freeSpot(footprint(sp), taken);
    if (at) { place(i, ...at); taken.push([...at, footprint(sp)]); }
  }
}

// All life gone, or some channels' (a team taken out of the zoo).
function clearLife(channels = range(0, CH)) {
  apply(P.keep, (t) => ({ uKeep: [0, 1, 2, 3].map((k) => (channels.includes(4 * t + k) ? 0 : 1)) }));
  if (channels.length === CH) fadeTrails(0);
}

/* ---- 3.3b Battle score ------------------------------------------------------------------------ */

// A battle's score, from the team census read back without waiting (as Keep alive's): each team's
// cells held, its individuals (its blocks held by a quarter or more, joined side by side on the
// torus) and its territory (below), a reading a time in the history; the winner, once 500 steps
// are played: the last team alive, or one whose territory is two thirds of the free cells, or the
// leader in territory at the limit (20,000 steps; a tournament's own); a draw if all are gone.
const score = { start: 0, history: [], winner: null, fence: null, buffer: null, limit: 20000 };
function resetScore() { Object.assign(score, { start: stepCount, history: [], winner: null }); }

function teamGroups(held, k) {
  const C = CENSUS, seen = new Uint8Array(C * C), on = (i) => held[i * 4 + k] >= BLOCK * BLOCK / 4;
  let groups = 0;
  for (let i = 0; i < C * C; i++) {
    if (seen[i] || !on(i)) continue;
    groups++;
    const todo = [i]; seen[i] = 1;
    while (todo.length) {
      const j = todo.pop(), x = j % C, y = (j - x) / C;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = ((y + dy + C) % C) * C + (x + dx + C) % C;
        if (!seen[n] && on(n)) { seen[n] = 1; todo.push(n); }
      }
    }
  }
  return groups;
}

// Territory: the free cells nearer a team's life than any other's, within two kernel radii of it,
// by 8×8 blocks: a block with life goes to the team holding most of it; then, a ring of blocks a
// time on the torus, a block reached by one team only is its, by two or more at once nobody's;
// walls (a block with no free cell) stop it. Each team's free cells in its blocks.
function territories(held) {
  const C = CENSUS, K = world.fighters.length, owner = new Int8Array(C * C).fill(-1), reach = Math.ceil(2 * world.R / BLOCK);
  let ring = [];
  for (let i = 0; i < C * C; i++) {
    let best = -1, most = 0;
    for (let k = 0; k < K; k++) if (held[i * 4 + k] > most) { most = held[i * 4 + k]; best = k; }
    if (best >= 0 && freeInBlock[i]) { owner[i] = best; ring.push(i); }
  }
  for (let d = 0; d < reach && ring.length; d++) {
    const claims = new Map();
    for (const j of ring) {
      const x = j % C, y = (j - x) / C;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = ((y + dy + C) % C) * C + (x + dx + C) % C;
        if (owner[n] !== -1 || !freeInBlock[n]) continue;
        const was = claims.get(n);
        claims.set(n, was === undefined || was === owner[j] ? owner[j] : -2);
      }
    }
    ring = [];
    for (const [n, k] of claims) { owner[n] = k; if (k >= 0) ring.push(n); }
  }
  const land = Array(K).fill(0);
  for (let i = 0; i < C * C; i++) if (owner[i] >= 0) land[owner[i]] += freeInBlock[i];
  return land;
}

// Asks the GPU for a census, or reads the one asked for once it is ready: true when a reading came.
function battleCensus() {
  const cells = CENSUS * CENSUS, teams = world.fighters;
  if (!score.fence) {
    const owner = Array(CH).fill(-1);
    teams.forEach((t, k) => { for (const c of teamChannels(t)) owner[c] = k; });
    pass(P.teams, teamCensus, { uB: { i: BLOCK }, uTeam: { iv: owner } }, layerTextures());
    score.buffer ??= gl.createBuffer();
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, score.buffer);
    gl.bufferData(gl.PIXEL_PACK_BUFFER, cells * 16, gl.STREAM_READ);
    gl.readPixels(0, 0, CENSUS, CENSUS, gl.RGBA, gl.FLOAT, 0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    score.fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    score.asked = stepCount;
    return false;
  }
  if (gl.getSyncParameter(score.fence, gl.SYNC_STATUS) !== gl.SIGNALED) return false;
  gl.deleteSync(score.fence); score.fence = null;
  const held = new Float32Array(cells * 4);
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, score.buffer);
  gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, held);
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
  const area = teams.map((_, k) => { let a = 0; for (let i = 0; i < cells; i++) a += held[i * 4 + k]; return a; });
  const reading = { step: score.asked - score.start, area, land: territories(held), groups: teams.map((_, k) => teamGroups(held, k)) };
  score.history.push(reading);
  if (score.history.length > 4000) score.history = score.history.filter((_, i) => i % 2 === 0);
  judge(reading);
  return true;
}

function judge({ step, area, land }) {
  if (score.winner || step < 500) return;
  const alive = area.flatMap((a, k) => (a > 0 ? [k] : [])), lead = land.indexOf(Math.max(...land));
  if (!alive.length) score.winner = { team: -1, step, why: 'all gone: a draw' };
  else if (alive.length === 1) score.winner = { team: alive[0], step, why: 'the last alive' };
  else if (land[lead] >= freeCells * 2 / 3) score.winner = { team: lead, step, why: 'two thirds of the world' };
  else if (step >= score.limit) score.winner = { team: lead, step, why: `the leader in territory at ${score.limit.toLocaleString('en')} steps` };
}

/* ---- 3.3c Tournament ------------------------------------------------------------------------- */

// A tournament: every pair of a pool's species, two seeds a pair, each match a battle of the
// page's decor, meeting, start and creatures a team, played off the frame loop (the world shown
// now and then) until its verdict, at the tournament's limit at most. Each match its link; each
// species its wins, draws, losses, mean territory at the end and Elo (32 a match, from 1,500).
const tour = { on: false, matches: [], played: [], table: [] };
// A turn of the event loop (fences and the census only move between tasks), through one channel
// kept (not timers, slowed in a hidden page).
const turnChannel = new MessageChannel(), turnWaiting = [];
turnChannel.port1.onmessage = () => turnWaiting.shift()?.();
const yieldTask = () => new Promise((r) => { turnWaiting.push(r); turnChannel.port2.postMessage(0); });
// Steps sent 50 at a time, each lot waited for on the GPU (a long queue of work froze, then crashed the page).
async function stepsWaited(n) {
  for (let done = 0; done < n; done += 50) {
    for (let k = 0; k < Math.min(50, n - done); k++) step();
    const f = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    while (gl.getSyncParameter(f, gl.SYNC_STATUS) !== gl.SIGNALED) await yieldTask();
    gl.deleteSync(f);
  }
}

// One match, from its own seed: its verdict (team −1 a draw) and each team's territory at the end.
async function playMatch(a, b, seed, limit) {
  world.fighters = packed([a, b]); world.seed = seed;
  setDecor(decor); setLaw(lawOf(world)); clearLife(); layBattle(); resetScore(); score.limit = limit;
  while (tour.on && !score.winner) {
    await stepsWaited(200);
    battleCensus();
    while (score.fence) { await yieldTask(); battleCensus(); }
    render();
  }
  const last = score.history.at(-1);
  return { a, b, seed, winner: score.winner, land: last ? last.land.map((v) => v / Math.max(1, freeCells)) : [0, 0], link: `?${battleParams()}` };
}

async function runTournament(pool, limit, onProgress) {
  const was = { fighters: world.fighters, seed: world.seed, running };
  tour.on = true; running = false; tour.played = [];
  tour.matches = pool.flatMap((a, i) => pool.slice(i + 1).flatMap((b) => (fits([a, b]) ? [[a, b, 1], [a, b, 2]] : [])));
  onProgress();
  for (const [a, b, n] of tour.matches) {
    if (!tour.on) break;
    tour.played.push(await playMatch(a, b, 1000 * n + tour.played.length, limit));
    tour.table = standings(pool, tour.played);
    onProgress();
  }
  tour.on = false; score.limit = 20000;
  Object.assign(world, { fighters: was.fighters, seed: was.seed }); running = was.running;
  startBattle(); onProgress();
}

function standings(pool, played) {
  const row = new Map(pool.map((sp) => [sp, { sp, w: 0, d: 0, l: 0, land: 0, n: 0, elo: 1500 }]));
  for (const m of played) {
    const [A, B] = [row.get(m.a), row.get(m.b)], s = m.winner.team === 0 ? 1 : m.winner.team === 1 ? 0 : 0.5;
    const e = 1 / (1 + 10 ** ((B.elo - A.elo) / 400));
    A.elo += 32 * (s - e); B.elo -= 32 * (s - e);
    if (s === 1) { A.w++; B.l++; } else if (s === 0) { B.w++; A.l++; } else { A.d++; B.d++; }
    A.land += m.land[0]; B.land += m.land[1]; A.n++; B.n++;
  }
  return [...row.values()].filter((r) => r.n).sort((u, v) => v.elo - u.elo);
}

/* ---- 3.4 Walls ------------------------------------------------------------------------------- */

// The CPU's walls sent to the GPU; the cells free of them counted, in all and by 8×8 blocks (a
// battle's shares are out of those).
let freeCells = 0, freeInBlock = new Int32Array(0);
function uploadWalls() {
  freeCells = walls.reduce((a, w) => a + (w ? 0 : 1), 0);
  freeInBlock = new Int32Array(CENSUS * CENSUS);
  for (let i = 0; i < N * N; i++) if (!walls[i]) freeInBlock[Math.floor(Math.floor(i / N) / BLOCK) * CENSUS + Math.floor((i % N) / BLOCK)]++;
  gl.bindTexture(gl.TEXTURE_2D, wallsTex);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, N, N, gl.RED, gl.UNSIGNED_BYTE, walls);
  apply(P.keep, { uKeep: [1, 1, 1, 1] });
}

function rect(x0, y0, w, h, v = 255) {
  for (let y = Math.floor(y0); y < y0 + h; y++) for (let x = Math.floor(x0); x < x0 + w; x++) walls[((y % N + N) % N) * N + ((x % N + N) % N)] = v;
}
function disc(cx, cy, r, v = 255) {
  for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++)
    if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) walls[((y % N + N) % N) * N + ((x % N + N) % N)] = v;
}

// A maze by random depth-first carving; corridors a few creatures wide, the world's edge closed.
function maze() {
  const n = Math.max(3, Math.round(N / (world.R * 7))), cell = N / n, t = Math.max(4, world.R * 0.45);
  const open = { };
  const seen = new Uint8Array(n * n), stack = [[0, 0]];
  seen[0] = 1;
  while (stack.length) {
    const [i, j] = stack[stack.length - 1];
    const next = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([di, dj]) => [i + di, j + dj]).filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n && !seen[b * n + a]);
    if (!next.length) { stack.pop(); continue; }
    const [a, b] = next[Math.floor(chance() * next.length)];
    open[[Math.min(i, a), Math.min(j, b), a !== i ? 'v' : 'h']] = true;
    seen[b * n + a] = 1; stack.push([a, b]);
  }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    if (!(i > 0 && open[[i - 1, j, 'v']])) rect(i * cell - t / 2, j * cell - t / 2, t, cell + t);
    if (!(j > 0 && open[[i, j - 1, 'h']])) rect(i * cell - t / 2, j * cell - t / 2, cell + t, t);
  }
}

// A closed arena with round pillars and a few bars; in a battle, pillars only, each drawn in an
// eighth of the square and laid by its eight symmetries (the same for every side).
function arena() {
  const t = Math.max(4, world.R * 0.45), c = N / 2;
  rect(-t / 2, 0, t, N); rect(0, -t / 2, N, t);
  if (world.kind === 'battle') {
    for (let k = 0; k < 3; k++) {
      const u = (0.1 + 0.3 * chance()) * N, v = chance() * u, r = world.R * (0.6 + chance());
      for (const [p, q] of [[u, v], [v, u]]) for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) disc(c + sx * p, c + sy * q, r);
    }
    return;
  }
  for (let k = 0; k < 14; k++) disc(t + chance() * (N - 2 * t), t + chance() * (N - 2 * t), world.R * (0.6 + chance() * 1.2));
  for (let k = 0; k < 4; k++) {
    const len = world.R * (4 + chance() * 5), x = chance() * N, y = chance() * N;
    chance() < 0.5 ? rect(x, y, len, t) : rect(x, y, t, len);
  }
}

const DECORS = { Empty: () => {}, Maze: maze, Arena: arena };
// The walls of a decor (a battle's from its seed).
function setDecor(name) {
  decor = name;
  walls.fill(0);
  if (world.kind === 'battle') seeded(world.seed, DECORS[name]); else DECORS[name]();
  uploadWalls();
}

/* ==============================================================================================
 * PART 4 — VIEW AND CONTROLS
 * ==============================================================================================
 *
 * The world fits the stage at zoom 1; the wheel zooms, a drag moves the view. A click places the
 * selected species (turned at random); Wall and Eraser draw along the drag.
 */

/* ---- 4.1 Settings ---------------------------------------------------------------------------- */

// A colour a channel: the first three also an organism's.
const COLOURS = [[1.0, 0.36, 0.18], [0.22, 1.0, 0.5], [0.32, 0.52, 1.0], [1.0, 0.85, 0.2], [1.0, 0.3, 0.85], [0.2, 0.9, 1.0], [0.65, 0.4, 1.0], [0.92, 0.92, 0.92]];
const GREY = [0.75, 0.75, 0.75];
const byCode = (list, code) => list.find((s) => s.code === code);
// The zoo at first: six of the species that move and stand walls, Orbium among them; two channels free.
const ZOO_START = ['212·12', '213·72', '213·58', '213·0', '213·10', 'O2u'].map((c, at) => ({ sp: byCode(SPECIES.single, c), at }));
// A species in a list: Chan's name if it has one, its code, how it lives (and its channels, if more than one).
const label = (s) => `${s.name ? `${s.name} · ` : ''}${s.code} — ${s.life}${width(s) > 1 ? ` · ${width(s)} ch` : ''}`;
const ALL = [...SPECIES.single, ...SPECIES.multi];
// A battle's teams packed on the channels in their order; the battle at first: Chan's colony 221·13
// against the replicator 213·76, a side each.
const packed = (sps) => { let at = 0; return sps.map((sp) => { const t = { sp, at }; at += width(sp); return t; }); };
const newSeed = () => 1 + Math.floor(Math.random() * 99999);
let world = { kind: 'zoo', teams: [...ZOO_START], organism: SPECIES.multi[0], R: 13, meet: 'Push',
  fighters: packed(['221·13', '213·76'].map((c) => byCode(ALL, c))), layout: 'Sides', each: 3, seed: newSeed() };
let decor = 'Maze', tool = 'Creature', selected = 0, speed = 2, running = true, alive = true, trails = true;

function rebuild(reseed = true) {
  setLaw(lawOf(world));
  if (reseed) { clearLife(); seed(); }
  render();
}

/* ---- 4.2 Components -------------------------------------------------------------------------- */

// The one button: text, tooltip, click; .on when active.
function button(text, title, click) {
  const b = document.createElement('button');
  b.className = 'btn'; b.textContent = text; b.title = title; b.onclick = click;
  return b;
}
// A switch: the same button, .on while its state is on.
function toggle(text, title, get, flip) {
  const b = button(text, title, () => { flip(); b.classList.toggle('on', get()); });
  b.classList.toggle('on', get());
  return b;
}
// Keep alive's switch: greyed in a battle (a team given creatures would not have won them).
function keepAliveSwitch() {
  const b = toggle('Keep alive', 'A species gone is given one more creature, on a free spot', () => alive && world.kind !== 'battle', () => { alive = !alive; });
  if (world.kind === 'battle') { b.disabled = true; b.title = 'Not in a battle: a team gone has lost'; }
  return b;
}
// One choice among several, joined: options [value, text, title]; the chosen one .on.
function tabs(el, options, get, set) {
  el.replaceChildren(...options.map(([v, text, title]) => {
    const b = button(text, title, () => { set(v); paintTabs(el, get); });
    b.dataset.v = v;
    return b;
  }));
  paintTabs(el, get);
}
function paintTabs(el, get) { for (const b of el.children) b.classList.toggle('on', b.dataset.v === String(get())); }

// A species' thumbnail: its channels in their colours (a colour a channel, the first ones by default).
function thumbnail(cv, sp, colours = COLOURS) {
  const pt = patternTex(sp), side = 88;
  cv.width = cv.height = side;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(side, side), sc = Math.max(pt.w, pt.h) / side;
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
    const px = Math.floor(x * sc - (side * sc - pt.w) / 2), py = Math.floor((side - 1 - y) * sc - (side * sc - pt.h) / 2);
    const rgb = [0, 0, 0];
    if (px >= 0 && py >= 0 && px < pt.w && py < pt.h) for (let c = 0; c < 3; c++) {
      const v = pt.data[(py * pt.w + px) * 4 + c], col = colours[c] ?? GREY;
      for (let k = 0; k < 3; k++) rgb[k] += col[k] * v;
    }
    const i = (y * side + x) * 4;
    for (let k = 0; k < 3; k++) img.data[i + k] = 11 + 244 * (1 - Math.exp(-1.7 * rgb[k]));
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

/* ---- 4.3 Panel ------------------------------------------------------------------------------- */

const rgb = (c) => `rgb(${c.map((v) => Math.round(v * 255))})`;

// A zoo species' row: in the world (its team's colours), a click selects it for placing and ×
// takes it out; out of it, a click brings it in on the first free block of channels, greyed when
// none is free or its kernels would pass the engine's 32.
function speciesRow(sp) {
  const i = world.teams.findIndex((t) => t.sp === sp), team = world.teams[i], inWorld = i >= 0;
  const at = inWorld ? team.at : freeBlock(world, width(sp));
  const tooMany = !inWorld && at >= 0 && lawOf({ ...world, teams: [...world.teams, { sp, at }] }).kernels.length > MAX_K;
  const why = inWorld ? '' : at < 0 ? `No ${width(sp)} channel${width(sp) > 1 ? 's' : ''} free (eight in all): take a species out (×) first`
    : tooMany ? `Its ${sp.kernels.length} kernels would pass the engine's ${MAX_K}: take a species out (×) first` : '';
  const row = button('', inWorld ? 'In the world: a click selects it, then a click on the world places it'
    : why || 'A click brings it into the world, a few of it placed', () => {
    if (!inWorld) { world.teams.push({ sp, at }); selected = world.teams.length - 1; setLaw(lawOf(world)); seed([selected]); }
    else selected = i;
    tool = 'Creature'; buildPanel(); render();
  });
  row.disabled = Boolean(why);
  row.classList.add('slot');
  row.classList.toggle('on', inWorld && selected === i && tool === 'Creature');
  row.classList.toggle('out', !inWorld);
  const colours = inWorld ? teamChannels(team).map((c) => COLOURS[c]) : [GREY, GREY, GREY];
  const cv = document.createElement('canvas'); thumbnail(cv, sp, colours);
  const dot = document.createElement('span'); dot.className = 'dot';
  dot.style.background = inWorld ? `linear-gradient(90deg,${[...colours, colours[0]].map(rgb)})` : 'transparent';
  const name = document.createElement('span'); name.className = 'name'; name.textContent = label(sp);
  row.append(cv, dot, name);
  const line = document.createElement('div'); line.className = 'line';
  line.append(row);
  if (inWorld && world.teams.length > 1) line.append(button('×', 'Take it out of the world, its creatures with it', () => {
    world.teams.splice(i, 1); clearLife(teamChannels(team));
    selected = Math.min(selected > i ? selected - 1 : selected, world.teams.length - 1);
    setLaw(lawOf(world)); buildPanel(); render();
  }));
  return line;
}

// The organism's row: its thumbnail and the list to pick another (one law for the world).
function organismRow() {
  const row = button('', 'Click places it: select it, then click the world', () => { tool = 'Creature'; buildPanel(); });
  row.classList.add('slot');
  row.classList.toggle('on', tool === 'Creature');
  const cv = document.createElement('canvas'); thumbnail(cv, world.organism);
  const sel = document.createElement('select');
  for (const s of SPECIES.multi) sel.append(new Option(label(s), s.code, false, s === world.organism));
  sel.onclick = (e) => e.stopPropagation();
  sel.onchange = () => { world.organism = byCode(SPECIES.multi, sel.value); buildPanel(); rebuild(); };
  const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = `linear-gradient(90deg,${COLOURS.slice(0, 3).map(rgb)})`;
  row.append(cv, dot, sel);
  return row;
}

// Teams that fit together: their channels within the eight, their kernels within the engine's 32.
const fits = (sps) => sps.reduce((a, sp) => a + width(sp), 0) <= CH && lawOf({ ...world, kind: 'battle', fighters: packed(sps) }).kernels.length <= MAX_K;
const fighterSpecies = () => world.fighters.map((t) => t.sp);

// A battle laid again from its seed: its walls, its law, its creatures; its link in the address bar.
function startBattle() {
  setDecor(decor); rebuild(); updateLink(); resetScore(); showScore();
}

// A battle team's row: a click selects it for placing; its list changes its species (one that
// would not fit marked and refused); × takes it out (two teams at least).
function fighterRow(k) {
  const team = world.fighters[k], colours = teamChannels(team).map((c) => COLOURS[c]);
  const row = button('', 'A click selects this team, then a click on the world places one of it', () => { selected = k; tool = 'Creature'; buildPanel(); });
  row.classList.add('slot');
  row.classList.toggle('on', selected === k && tool === 'Creature');
  const cv = document.createElement('canvas'); thumbnail(cv, team.sp, colours);
  const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = `linear-gradient(90deg,${[...colours, colours[0]].map(rgb)})`;
  const sel = document.createElement('select');
  for (const sp of ALL) {
    const sps = fighterSpecies().map((q, j) => (j === k ? sp : q)), ok = sp === team.sp || fits(sps);
    sel.append(new Option(label(sp) + (ok ? '' : ' (no room)'), sp.code, false, sp === team.sp));
    sel.lastChild.disabled = !ok;
  }
  sel.onclick = (e) => e.stopPropagation();
  sel.onchange = () => { world.fighters = packed(fighterSpecies().map((q, j) => (j === k ? byCode(ALL, sel.value) : q))); buildPanel(); startBattle(); };
  row.append(cv, dot, sel);
  const line = document.createElement('div'); line.className = 'line';
  line.append(row);
  if (world.fighters.length > 2) line.append(button('×', 'Take this team out of the battle', () => {
    world.fighters = packed(fighterSpecies().filter((_, j) => j !== k)); selected = 0; buildPanel(); startBattle();
  }));
  return line;
}

// A battle's teams, one more (the first species that fits and is not in yet, a spreading one
// first), its layout, its creatures a team, its seed and link.
function battlePanel() {
  const more = [...ALL.filter((sp) => sp.life.includes('grow')), ...ALL].find((sp) => !fighterSpecies().includes(sp) && fits([...fighterSpecies(), sp]));
  const add = button('+ Team', world.fighters.length >= 4 ? 'Four teams at most' : more ? `One more team (${label(more)}); its species changed in its list`
    : 'No species fits beside these (eight channels, 32 kernels in all)', () => { world.fighters = packed([...fighterSpecies(), more]); buildPanel(); startBattle(); });
  add.disabled = world.fighters.length >= 4 || !more;
  const section = (title, el) => { const h = document.createElement('div'); h.className = 'sec'; h.textContent = title; return [h, el]; };
  const layout = document.createElement('div'); layout.className = 'tabs';
  tabs(layout, [['Sides', 'Sides', 'Each team the same spots and turns, turned about the centre: a fair start'], ['Mixed', 'Mixed', 'Each creature anywhere, at random (from the seed)']],
    () => world.layout, (v) => { world.layout = v; startBattle(); });
  const each = document.createElement('div'); each.className = 'tabs';
  tabs(each, [1, 3, 6].map((n) => [String(n), String(n), `${n} creature${n > 1 ? 's' : ''} a team at first (four times as many in a 1024² world)`]),
    () => String(world.each), (v) => { world.each = +v; startBattle(); });
  const seedRow = document.createElement('div'); seedRow.className = 'row';
  const shown = document.createElement('span'); shown.className = 'seed'; shown.textContent = `Seed ${world.seed}`;
  seedRow.append(shown,
    button('New seed', 'Another start: other spots, turns and walls', () => { world.seed = newSeed(); buildPanel(); startBattle(); }),
    button('Copy link', 'The link to this battle: the same teams, start and walls', () => { updateLink(); navigator.clipboard?.writeText(location.href); }));
  const board = document.createElement('div'); board.id = 'score';
  const cup = document.createElement('div'); cup.id = 'tournament';
  return [...world.fighters.map((_, k) => fighterRow(k)), add, ...section('Start', layout), ...section('Creatures a team', each), ...section('Seed', seedRow), ...section('Score', board), ...section('Tournament', cup)];
}

// The tournament's pools and lengths; the pool and length chosen.
const POOLS = { Spreaders: () => ALL.filter((sp) => sp.life.includes('grow')), Movers: () => ALL.filter((sp) => sp.life.startsWith('moves') && !sp.life.includes('grow')), All: () => ALL };
Object.assign(tour, { pool: 'Spreaders', limit: 6000 });

// The tournament under the score: its pool, length, Start or Stop and progress (the panel inert
// meanwhile), then its standings and each match's link.
function showTournament() {
  const box = $('tournament');
  if (!box) return;
  $('panel').classList.toggle('busy', tour.on);
  const pairs = (sps) => sps.flatMap((a, i) => sps.slice(i + 1).filter((b) => fits([a, b]))).length * 2;
  const pool = document.createElement('div'); pool.className = 'tabs';
  tabs(pool, Object.entries(POOLS).map(([k, f]) => [k, k, `${f().length} species, ${pairs(f())} matches (each pair twice, two seeds)`]), () => tour.pool, (v) => { tour.pool = v; showTournament(); });
  const length = document.createElement('div'); length.className = 'tabs';
  tabs(length, [3000, 6000, 20000].map((n) => [String(n), n.toLocaleString('en'), `A match ends at ${n.toLocaleString('en')} steps at most, its leader in territory the winner`]), () => String(tour.limit), (v) => { tour.limit = +v; showTournament(); });
  const n = pairs(POOLS[tour.pool]()), minutes = Math.ceil(n * tour.limit * (stepGpu || 3) / 60000);
  const go = button(tour.on ? 'Stop' : 'Start', tour.on ? 'Stop after this match: the standings so far kept'
    : `Play the ${n} matches, off screen (the world shown now and then): about ${minutes} min at most`, () => {
    if (tour.on) { tour.on = false; return; }
    runTournament(POOLS[tour.pool](), tour.limit, showTournament);
  });
  const progress = document.createElement('span'); progress.className = 'seed';
  progress.textContent = tour.on ? `Match ${tour.played.length + 1} of ${tour.matches.length}` : tour.played.length ? `${tour.played.length} matches played` : `${n} matches, ≤ ${minutes} min`;
  const row = document.createElement('div'); row.className = 'row'; row.append(go, progress);
  const table = tour.table.map((r, i) => {
    const line = document.createElement('div'); line.className = 'tally';
    const name = document.createElement('span'); name.className = 'name'; name.textContent = `${i + 1}. ${r.sp.name || r.sp.code}`; name.title = label(r.sp);
    const nums = document.createElement('span'); nums.className = 'nums';
    nums.textContent = `${r.w}-${r.d}-${r.l} · ${(100 * r.land / r.n).toFixed(0)}% · ${Math.round(r.elo)}`;
    nums.title = 'Wins-draws-losses, mean territory at the end, Elo';
    line.append(name, nums);
    return line;
  });
  const matches = tour.played.map((m) => {
    const a = document.createElement('a'); a.className = 'match'; a.href = m.link; a.target = '_blank';
    const who = m.winner.team < 0 ? 'draw' : `${[m.a, m.b][m.winner.team].code} wins`;
    a.textContent = `${m.a.code} vs ${m.b.code} · ${who} at ${m.winner.step}`; a.title = m.winner.why;
    return a;
  });
  box.replaceChildren(pool, length, row, ...table, ...matches);
}

// The score under the battle: the winner (or the step), each team's territory and life as shares
// of the free cells and its individuals, and the territories over time, a line a team in its colour.
function showScore() {
  const board = $('score');
  if (!board) return;
  const last = score.history.at(-1), colour = (k) => rgb(COLOURS[world.fighters[k].at]);
  const head = document.createElement('div'); head.className = 'verdict';
  head.textContent = score.winner ? (score.winner.team < 0 ? `Step ${score.winner.step}: ${score.winner.why}` : `${world.fighters[score.winner.team].sp.code} wins at step ${score.winner.step}: ${score.winner.why}`)
    : `Step ${last?.step ?? 0}`;
  const rows = world.fighters.map((t, k) => {
    const row = document.createElement('div'); row.className = 'tally';
    const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = colour(k);
    const name = document.createElement('span'); name.className = 'name'; name.textContent = t.sp.name || t.sp.code;
    const nums = document.createElement('span'); nums.className = 'nums';
    const pc = (v) => `${(100 * v / Math.max(1, freeCells)).toFixed(1)}%`;
    nums.textContent = last ? `${pc(last.land[k])} land · ${pc(last.area[k])} life · ${last.groups[k]} ind.` : '';
    nums.title = 'Territory (the free cells nearer its life than any other, within two kernel radii), its life\'s cells, its individuals';
    row.append(dot, name, nums);
    return row;
  });
  const cv = document.createElement('canvas'), w = 236, h = 80, dpr = devicePixelRatio || 1;
  cv.width = w * dpr; cv.height = h * dpr; cv.style.width = `${w}px`; cv.style.height = `${h}px`;
  const ctx = cv.getContext('2d'), H = score.history, top = Math.max(0.05, ...H.flatMap((r) => r.land.map((a) => a / Math.max(1, freeCells))));
  ctx.scale(dpr, dpr);
  world.fighters.forEach((_, k) => {
    ctx.strokeStyle = colour(k); ctx.lineWidth = 1.5; ctx.beginPath();
    H.forEach((r, i) => ctx[i ? 'lineTo' : 'moveTo'](w * i / Math.max(1, H.length - 1), h - 2 - (h - 4) * r.land[k] / Math.max(1, freeCells) / top));
    ctx.stroke();
  });
  board.replaceChildren(head, ...rows, cv);
}

function buildPanel() {
  tabs($('worldTabs'), [['zoo', 'Zoo', 'Up to eight species, each its own law and colours'], ['organism', 'Organisms', 'Chan\'s two- and three-channel creatures: one law over the colours'],
    ['battle', 'Battle', 'Two to four teams laid alike, to see which spreads: its seed and link give the same start']],
    () => world.kind, (v) => {
      world.kind = v; selected = 0; world.R = v === 'organism' ? 12 : 13;
      if (v === 'battle') world.meet = 'Territory';
      buildPanel(); if (v === 'battle') startBattle(); else { setDecor(decor); rebuild(); updateLink(); }
    });
  $('slots').replaceChildren(...(world.kind === 'zoo' ? ALL.map(speciesRow) : world.kind === 'battle' ? battlePanel() : [organismRow()]));
  tabs($('decorTabs'), Object.keys(DECORS).map((d) => [d, d, d === 'Empty' ? 'No walls (the world is a torus)' : `A new random ${d.toLowerCase()} at each click; the creatures placed again`]),
    () => decor, (v) => { setDecor(v); clearLife(); seed(); updateLink(); });
  tabs($('toolTabs'), [['Creature', 'Creature', 'A click places the selected species; a drag moves the view'], ['Wall', 'Wall', 'Draw walls by dragging'], ['Eraser', 'Eraser', 'Erase walls and life by dragging']],
    () => tool, (v) => { tool = v; buildPanel(); });
  $('othersBox').style.display = world.kind === 'organism' ? 'none' : '';
  tabs($('othersTabs'), [['Ghosts', 'Ghosts', 'The species do not feel each other: they cross'], ['Push', 'Push', 'Each species is pushed away by the others, felt from a kernel\'s radius'],
    ['Fight', 'Fight', 'Pushed hard from a kernel\'s radius: a meeting erodes both'], ['Territory', 'Territory', 'Felt only at contact, but hard: no species grows where another is, borders form']],
    () => world.meet, (v) => { world.meet = v; rebuild(false); updateLink(); });
  tabs($('sizeTabs'), [10, 13, 18, 24].map((r) => [String(r), `R ${r}`, `Kernel radius ${r} cells: the creatures' size; species and walls made again`]),
    () => String(world.R), (v) => { world.R = +v; setDecor(decor); rebuild(); updateLink(); });
  tabs($('spaceTabs'), [512, 1024].map((n) => [String(n), `${n}²`, `A world of ${n}×${n} cells${n > 512 ? ': room for more, four times the work' : ''}`]),
    () => String(N), (v) => { allocate(+v); view.centre = [N / 2, N / 2]; frameView(); setDecor(decor); rebuild(); updateLink(); });
  tabs($('speedTabs'), [1, 2, 4, 8].map((s) => [String(s), `×${s}`, `${s} step${s > 1 ? 's' : ''} a frame at most: fewer when the GPU cannot keep up (the steps a second under Run)`]), () => String(speed), (v) => { speed = +v; });
  $('runRow').replaceChildren(
    button(running ? 'Pause' : 'Play', 'Run or stop time', () => { running = !running; buildPanel(); }),
    toggle('Trails', 'Where the creatures went, fading', () => trails, () => { trails = !trails; render(); }),
    keepAliveSwitch(),
    button('Step', 'One step', () => { step(); render(); }),
    world.kind === 'battle' ? button('Restart', 'The battle laid again from its seed', startBattle)
      : button('Seed', 'Life cleared, a few of each species placed again', () => { clearLife(); seed(); }),
    button('Clear', 'All life cleared (the walls stay)', () => clearLife()));
  showScore(); showTournament();
}

/* ---- 4.4 Drawing and the pointer ------------------------------------------------------------- */

// The view: a zoom (1: the whole world fits) and the world cell at the stage's centre; scale
// (world cells a canvas pixel) and origin derived from them, the centre kept inside the world.
let view = { zoom: 1, centre: [N / 2, N / 2], scale: 1, origin: [0, 0] };
function frameView() {
  const side = Math.min(canvas.width, canvas.height), scale = N / (side * view.zoom);
  view.centre = view.centre.map((c, k) => {
    const half = [canvas.width, canvas.height][k] * scale / 2;
    return half >= N / 2 ? N / 2 : Math.min(Math.max(c, half), N - half);
  });
  view.scale = scale;
  view.origin = [canvas.width / 2 - view.centre[0] / scale, canvas.height / 2 - view.centre[1] / scale];
}
function resize() {
  const dpr = devicePixelRatio || 1, r = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(r.width * dpr)); canvas.height = Math.max(1, Math.round(r.height * dpr));
  frameView();
}

function render() {
  pass(P.show, null, { uOrigin: view.origin, uScale: view.scale, uTrails: trails ? 1 : 0, uCol: { v3: COLOURS.flat() }, uBg: [0.043, 0.051, 0.071], uWall: [0.23, 0.25, 0.3], uN: { i: N }, uLinear: { i: linearOk ? 1 : 0 } }, { ...layerTextures(), uTrail: trail[0], uWalls: wallsTex });
}

// A pointer's place in canvas pixels, and in world cells (the world's y goes up, the page's down).
function canvasAt(e) {
  const r = canvas.getBoundingClientRect(), dpr = canvas.width / r.width;
  return [(e.clientX - r.left) * dpr, canvas.height - (e.clientY - r.top) * dpr];
}
function worldAt(e) {
  const [x, y] = canvasAt(e);
  return [(x - view.origin[0]) * view.scale, (y - view.origin[1]) * view.scale];
}

let last = null;
function brush([x, y]) {
  if (tool === 'Wall') disc(x, y, Math.max(3, world.R * 0.35));
  else { disc(x, y, world.R * 1.2, 0); apply(P.erase, { uCenter: [x, y], uRadius: world.R * 1.2, uN: { i: N } }); }
}
function stroke(to) {
  const from = last ?? to, d = Math.hypot(to[0] - from[0], to[1] - from[1]), n = Math.max(1, Math.ceil(d / 2));
  for (let k = 1; k <= n; k++) brush([from[0] + (to[0] - from[0]) * k / n, from[1] + (to[1] - from[1]) * k / n]);
  uploadWalls();
  last = to;
}
// Creature: a click places the species, a drag moves the view. Wall and Eraser draw along the drag.
let grab = null;
const inWorld = ([x, y]) => x >= 0 && y >= 0 && x < N && y < N;
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  if (tool === 'Creature') { grab = { at: canvasAt(e), centre: [...view.centre], moved: false }; return; }
  if (inWorld(worldAt(e))) { last = null; stroke(worldAt(e)); }
});
canvas.addEventListener('pointermove', (e) => {
  if (last) stroke(worldAt(e));
  if (!grab) return;
  const [x, y] = canvasAt(e), d = [x - grab.at[0], y - grab.at[1]];
  if (Math.hypot(...d) > 5) grab.moved = true;
  if (grab.moved) { view.centre = grab.centre.map((c, k) => c - d[k] * view.scale); frameView(); render(); }
});
canvas.addEventListener('pointerup', (e) => {
  if (grab && !grab.moved && inWorld(worldAt(e)) && teamsOf(world)[selected]) { place(selected, ...worldAt(e)); render(); }
  grab = null; last = null;
});
// The wheel zooms about the pointer, 1 to 8 times.
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const before = worldAt(e), [x, y] = canvasAt(e);
  view.zoom = Math.min(8, Math.max(1, view.zoom * Math.exp(-e.deltaY * 0.0015)));
  const scale = N / (Math.min(canvas.width, canvas.height) * view.zoom);
  view.centre = [before[0] - (x - canvas.width / 2) * scale, before[1] - (y - canvas.height / 2) * scale];
  frameView(); render();
}, { passive: false });

/* ---- 4.4b Battle links ------------------------------------------------------------------------ */

// A battle's link: its teams, meeting, layout, creatures a team, decor, seed, R and world size,
// in the address bar while a battle is shown (the page's bare address otherwise).
function battleParams() {
  return new URLSearchParams({ battle: fighterSpecies().map((sp) => sp.code).join(','), meet: world.meet, layout: world.layout, each: world.each, decor, seed: world.seed, R: world.R, N });
}
function updateLink() { history.replaceState(null, '', world.kind === 'battle' ? `?${battleParams()}` : location.pathname); }
// A battle link read at start-up: each value kept only if it is one the page offers.
function readLink() {
  const q = new URLSearchParams(location.search), sps = (q.get('battle') ?? '').split(',').map((c) => byCode(ALL, c)).filter(Boolean);
  if (sps.length < 2 || sps.length > 4 || !fits(sps)) return;
  const pick = (key, allowed, to) => { const v = q.get(key); if (allowed.map(String).includes(v)) to(v); };
  world.kind = 'battle'; world.fighters = packed(sps); world.meet = 'Territory';
  pick('meet', Object.keys(MEETINGS), (v) => { world.meet = v; });
  pick('layout', ['Sides', 'Mixed'], (v) => { world.layout = v; });
  pick('each', [1, 3, 6], (v) => { world.each = +v; });
  pick('decor', Object.keys(DECORS), (v) => { decor = v; });
  pick('R', [10, 13, 18, 24], (v) => { world.R = +v; });
  pick('N', [512, 1024], (v) => { N = +v; });
  const n = Number(q.get('seed'));
  if (Number.isInteger(n) && n > 0) world.seed = n;
}

/* ---- 4.5 Loop and check ---------------------------------------------------------------------- */

// The steps of a frame: the speed asked, as many as fit in 60% of a frame of GPU time (each step
// timed on the GPU, where the browser can), run only once the GPU has done the last ones (a fence),
// a frame skipped so leaving its steps to the next (credit). A speed out of reach so neither
// queues up (the queue grew, then stalled everything for a second) nor runs the GPU flat out; the
// stats give the steps a second.
const timer = gl && gl.getExtension('EXT_disjoint_timer_query_webgl2');
let frames = 0, fpsAt = performance.now(), fps = 0, aliveTick = 0, fence = null, stepCount = 0, stepsAt = 0;
let stepGpu = 0, frameMs = 1000 / 60, lastFrame = performance.now(), query = null, timed = 0, credit = 0;
function stepsPerFrame() {
  if (query && gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) {
    if (!gl.getParameter(timer.GPU_DISJOINT_EXT)) stepGpu = gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6 / timed;
    gl.deleteQuery(query); query = null;
  }
  if (!timer) return speed;
  return stepGpu > 0 ? Math.min(speed, 0.6 * frameMs / stepGpu) : 1;
}
function frame() {
  const now0 = performance.now();
  frameMs = 0.9 * frameMs + 0.1 * Math.min(now0 - lastFrame, 50); lastFrame = now0;
  const perFrame = stepsPerFrame();
  if (running && !tour.on) credit = Math.min(credit + perFrame, 3 * Math.max(1, perFrame));
  const gpuDone = !fence || gl.getSyncParameter(fence, gl.SYNC_STATUS) === gl.SIGNALED;
  if (running && !tour.on && gpuDone && credit >= 1) {
    if (fence) gl.deleteSync(fence);
    const n = Math.floor(credit), timing = timer && !query;
    credit -= n;
    if (timing) { timed = n; query = gl.createQuery(); gl.beginQuery(timer.TIME_ELAPSED_EXT, query); }
    for (let k = 0; k < n; k++) step();
    if (timing) gl.endQuery(timer.TIME_ELAPSED_EXT);
    fadeTrails(0.985);
    fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  }
  if (running && alive && world.kind !== 'battle' && (censusFence || ++aliveTick % 30 === 0)) keepAlive();
  if (world.kind === 'battle' && !tour.on && (score.fence || (running && ++aliveTick % 10 === 0)) && battleCensus()) showScore();
  render();
  frames++;
  const now = performance.now();
  if (now - fpsAt > 500) {
    const perSecond = 1000 / (now - fpsAt);
    fps = frames * perSecond; frames = 0; fpsAt = now;
    $('stats').textContent = `${fps.toFixed(0)} fps · ${((stepCount - stepsAt) * perSecond).toFixed(0)} steps/s · ${N}² · ${kernelCount} kernels`;
    stepsAt = stepCount;
  }
  requestAnimationFrame(frame);
}

// The state read back: per channel its mass and centre (on the torus, by angles).
// Each channel's whole mass, read back (checks only: it waits for the GPU), and whether a NaN came.
function masses() {
  const buf = new Float32Array(N * N * 4), m = Array(CH).fill(0);
  let nan = false;
  for (let t = 0; t < LAYERS; t++) {
    bindTarget(state[t][0]);
    gl.readPixels(0, 0, N, N, gl.RGBA, gl.FLOAT, buf);
    nan ||= buf.some(Number.isNaN);
    for (let i = 0; i < N * N; i++) for (let k = 0; k < 4; k++) m[4 * t + k] += buf[i * 4 + k];
  }
  return { m, nan };
}

// leniaCheck(): the FFT's round trip, then each species alone in an empty world for a while:
// alive (its mass kept within a band, a species that grows only kept) and no NaN; in a 512² world
// (quick), the world as it was after.
window.leniaCheck = function (steps = 400) {
  const was = { world, decor, running, N };
  running = false;
  allocate(512);
  const out = [];
  const buf = new Float32Array(N * N * 4).map(() => Math.random());
  const t = texture(N, N, buf);
  fft(t, spec[0], false); fft(spec[0], scratch[1], true);
  const back = new Float32Array(N * N * 4);
  bindTarget(scratch[1]); gl.readPixels(0, 0, N, N, gl.RGBA, gl.FLOAT, back);
  let err = 0; for (let i = 0; i < buf.length; i++) err = Math.max(err, Math.abs(back[i] / (N * N) - buf[i]));
  out.push({ test: 'fft round trip', ok: err < 1e-4, err });
  // An impulse at (1, 2) transforms to exp(−2πi(kx + 2ky)/N): checks the order, not only the inverse.
  const imp = new Float32Array(N * N * 4); imp[(2 * N + 1) * 4] = 1;
  const ti = texture(N, N, imp); fft(ti, spec[0], false); gl.deleteTexture(ti);
  bindTarget(spec[0]); gl.readPixels(0, 0, N, N, gl.RGBA, gl.FLOAT, back);
  let errI = 0;
  for (let i = 0; i < N * N; i += 97) { const a = -TAU * ((i % N) + 2 * Math.floor(i / N)) / N; errI = Math.max(errI, Math.abs(back[i * 4] - Math.cos(a)), Math.abs(back[i * 4 + 1] - Math.sin(a))); }
  out.push({ test: 'fft of an impulse', ok: errI < 1e-3, err: errI });
  walls.fill(0); decor = 'Empty'; uploadWalls();
  // A species alone as the zoo's team at channel `at` (an organism alone at 0): its mass ratio after
  // the steps, the same wherever its team stands (a team across the two layers too).
  const ratio = (kind, sp, at) => {
    world = kind === 'zoo' ? { ...world, kind, teams: [{ sp, at }] } : { ...world, kind, organism: sp };
    world.R = kind === 'zoo' ? 13 : 12;
    world.meet = 'Ghosts';
    setLaw(lawOf(world)); clearLife(); place(0, N / 2, N / 2, 0);
    const mass = () => { const { m, nan } = masses(); return { m: teamChannels(teamsOf(world)[0]).reduce((s, c) => s + m[c], 0), nan }; };
    const a = mass();
    for (let k = 0; k < steps; k++) step();
    const b = mass();
    return { r: b.m / a.m, nan: b.nan };
  };
  for (const [kind, sp] of [...SPECIES.single.map((sp) => ['zoo', sp]), ...SPECIES.multi.map((sp) => ['organism', sp])]) {
    const { r, nan } = ratio(kind, sp, 0);
    out.push({ test: `${kind} ${label(sp)}`, ok: !nan && r > 0.4 && (sp.life === 'grows' || r < 2.5), ratio: +r.toFixed(3) });
  }
  for (const [code, at] of [['221·22', 3], ['232·22', 2], ['232·22', 5]]) {
    const sp = byCode(SPECIES.multi, code), r0 = ratio('zoo', sp, 0).r, r1 = ratio('zoo', sp, at).r;
    out.push({ test: `team ${code} at channel ${at} as at 0`, ok: Math.abs(r1 - r0) < 1e-3 * r0, ratio: +r1.toFixed(4), at0: +r0.toFixed(4) });
  }
  console.table(out);
  ({ world, running } = was);
  allocate(was.N); frameView(); setDecor(was.decor); buildPanel(); rebuild();
  return { ok: out.every((r) => r.ok), out };
};

/* ---- 4.6 Start-up ---------------------------------------------------------------------------- */

if (!floatOk) $('fail').style.display = 'flex';
else {
  setupGPU();
  readLink();
  allocate(N);
  view.centre = [N / 2, N / 2];
  resize();
  addEventListener('resize', () => { resize(); render(); });
  buildPanel();
  setDecor(decor);
  rebuild();
  updateLink();
  requestAnimationFrame(frame);
}
