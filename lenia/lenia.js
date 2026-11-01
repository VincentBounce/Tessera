'use strict';
/* ==============================================================================================
 * LENIA WORLDS — lenia.js
 * ==============================================================================================
 *
 * Bert Chan's Lenia (continuous Life) on the GPU, in three life channels and one wall channel.
 * How it fits together:
 *   PART 1 — GPU: programs, float textures, the FFT
 *   PART 2 — LAWS: kernels and growth from Chan's species, a law for each world
 *   PART 3 — THE WORLD: one step, creatures placed, walls drawn
 *   PART 4 — VIEW AND CONTROLS
 *
 * A step: the four channels (r, g, b, wall) packed as two complex numbers per texel go through one
 * FFT; each kernel's spectrum times its source's spectrum, four kernels per inverse FFT, gives each
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
 * texelFetch. The FFT is Stockham's radix 2 (natural order in and out), a pass per stage and axis.
 */

/* ---- 1.1 Context and passes ------------------------------------------------------------------ */

let N = 1024;
const MAX_K = 16, GROUPS = MAX_K / 4;
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
  else if (v.m3) gl.uniformMatrix3fv(loc, false, v.m3);
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

// A texel holds two complex numbers (xy, zw), both transformed at once.
const FFT_FS = `
uniform sampler2D uSrc; uniform int uSize, uHoriz, uHalfN; uniform float uSign;
vec2 cmul(vec2 a, vec2 b) { return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  int index = uHoriz == 1 ? p.x : p.y, half_ = uSize / 2;
  int e = (index / uSize) * half_ + index % half_;
  ivec2 pe = p, po = p;
  if (uHoriz == 1) { pe.x = e; po.x = e + uHalfN; } else { pe.y = e; po.y = e + uHalfN; }
  vec4 ev = texelFetch(uSrc, pe, 0), od = texelFetch(uSrc, po, 0);
  float a = uSign * 6.283185307179586 * float(index % uSize) / float(uSize);
  vec2 w = vec2(cos(a), sin(a));
  o = vec4(ev.xy + cmul(w, od.xy), ev.zw + cmul(w, od.zw));
}`;

let fftProgram, scratch;

// src transformed into dst (forward, or inverse unscaled); src is left as it was.
function fft(src, dst, inverse) {
  const stages = Math.log2(N), total = 2 * stages;
  let input = src, k = 0;
  for (const horiz of [1, 0]) for (let s = 1; s <= stages; s++, k++) {
    const out = k === total - 1 ? dst : scratch[(k + (src === scratch[0] ? 1 : 0)) % 2];
    pass(fftProgram, out, { uSize: { i: 1 << s }, uHoriz: { i: horiz }, uHalfN: { i: N / 2 }, uSign: inverse ? 1 : -1 }, { uSrc: input });
    input = out;
  }
}

/* ==============================================================================================
 * PART 2 — LAWS: KERNELS AND GROWTH FROM CHAN'S SPECIES, A LAW FOR EACH WORLD
 * ==============================================================================================
 *
 * A kernel: a ring shell of radius R (Chan's kernel_shell: rings b, core kn, relative radius r),
 * read from a mix of channels (w: weights over r, g, b, wall), adding to one channel (dst):
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

const LIFE = [0, 1, 2];
const unit = (c) => [0, 1, 2, 3].map((i) => (i === c ? 1 : 0));

// The kernels and time steps of a world: the zoo (one single-channel species a channel) or an
// organism (Chan's three-channel creature, one law for all three).
function lawOf(world) {
  const kernels = [], dt = [0, 0, 0];
  if (world.kind === 'zoo') {
    world.slots.forEach((sp, c) => {
      for (const k of sp.kernels) kernels.push({ ...k, R: world.R, kind: 0, dst: c, w: unit(c) });
      if (world.meet > 0) kernels.push({ ...sp.kernels[0], R: world.R, kind: 1, dst: c, w: LIFE.map((i) => (i === c ? 0 : 1)).concat(0), h: world.meet });
      dt[c] = 1 / sp.T;
    });
  } else {
    const sp = world.organism;
    for (const k of sp.kernels) kernels.push({ ...k, R: world.R, kind: 0, dst: k.c[1], w: unit(k.c[0]) });
    for (const c of LIFE) dt[c] = 1 / sp.T;
  }
  const sumH = LIFE.map((c) => kernels.filter((k) => k.kind === 0 && k.dst === c).reduce((a, k) => a + k.h, 0));
  return { kernels, dt, sumH };
}

/* ==============================================================================================
 * PART 3 — THE WORLD: ONE STEP, CREATURES PLACED, WALLS DRAWN
 * ==============================================================================================
 *
 * The state: r, g, b life in [0, 1], a = wall (0 or 1). Walls live on the CPU too (walls, one
 * byte a cell), the one source the GPU's wall channel is copied from.
 */

/* ---- 3.1 Shaders ----------------------------------------------------------------------------- */

// The world's spectrum unpacked (r + i·g, b + i·wall), mixed by each kernel's weights, times the
// kernel's real spectrum; four kernels packed back as two complex numbers for one inverse FFT.
const MUL_FS = `
uniform sampler2D uSpec, uKer; uniform vec4 uW[4]; uniform int uN;
void main() {
  ivec2 k = ivec2(gl_FragCoord.xy), km = (uN - k) % uN;
  vec4 z = texelFetch(uSpec, k, 0), zm = texelFetch(uSpec, km, 0);
  vec2 a1 = (z.xy + vec2(zm.x, -zm.y)) * 0.5, d1 = (z.xy - vec2(zm.x, -zm.y)) * 0.5;
  vec2 a2 = (z.zw + vec2(zm.z, -zm.w)) * 0.5, d2 = (z.zw - vec2(zm.z, -zm.w)) * 0.5;
  vec2 X[4] = vec2[4](a1, vec2(d1.y, -d1.x), a2, vec2(d2.y, -d2.x));
  vec4 K = texelFetch(uKer, k, 0);
  vec2 P[4];
  for (int i = 0; i < 4; i++) P[i] = K[i] * (uW[i].x * X[0] + uW[i].y * X[1] + uW[i].z * X[2] + uW[i].w * X[3]);
  o = vec4(P[0].x - P[1].y, P[0].y + P[1].x, P[2].x - P[3].y, P[2].y + P[3].x);
}`;

// Chan's update: A + dt·(Σ h·G(U) / Σ h), here minus dt·Σ h·U for the push-away kernels.
const STEP_FS = `
uniform sampler2D uState, uPot0, uPot1, uPot2, uPot3;
uniform int uK, uKind[${MAX_K}], uDst[${MAX_K}], uGn[${MAX_K}];
uniform float uM[${MAX_K}], uS[${MAX_K}], uH[${MAX_K}];
uniform vec3 uDt, uSumH;
float growth(int gn, float n, float m, float s) {
  float d = n - m;
  if (gn == 1) { float q = max(0.0, 1.0 - d * d / (9.0 * s * s)); q *= q; return q * q * 2.0 - 1.0; }
  if (gn == 3) return abs(d) <= s ? 1.0 : -1.0;
  return exp(-d * d / (2.0 * s * s)) * 2.0 - 1.0;
}
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 a = texelFetch(uState, p, 0);
  vec4 q[4] = vec4[4](texelFetch(uPot0, p, 0), texelFetch(uPot1, p, 0), texelFetch(uPot2, p, 0), texelFetch(uPot3, p, 0));
  vec3 g = vec3(0.0), push = vec3(0.0);
  for (int i = 0; i < ${MAX_K}; i++) {
    if (i >= uK) break;
    float n = q[i / 4][i % 4];
    vec3 to = vec3(uDst[i] == 0, uDst[i] == 1, uDst[i] == 2);
    if (uKind[i] == 0) g += to * uH[i] * growth(uGn[i], n, uM[i], uS[i]);
    else push += to * uH[i] * max(n, 0.0);
  }
  vec3 grown = a.rgb + uDt * (g / max(uSumH, vec3(1e-9)) - push);
  o = vec4(clamp(grown, 0.0, 1.0) * (1.0 - a.a), a.a);
}`;

// A pattern stamped at uCenter, turned and scaled; its channels routed (uRoute) into the world's.
const STAMP_FS = `
uniform sampler2D uState, uPat; uniform vec2 uCenter; uniform float uCos, uSin, uInv; uniform mat3 uRoute; uniform int uN;
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
  o = vec4(max(a.rgb, uRoute * v) * (1.0 - a.a), a.a);
}`;

// The walls copied in from the CPU's bytes; life under them gone, and all life gone if uClear.
const WALLS_FS = `
uniform sampler2D uState, uWalls; uniform float uClear;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 a = texelFetch(uState, p, 0); float w = texelFetch(uWalls, p, 0).r;
  o = vec4(a.rgb * (1.0 - w) * (1.0 - uClear), w);
}`;

// Each B×B block of the world summed: one texel of a (N/B)² census.
const CENSUS_FS = `
uniform sampler2D uState; uniform int uB;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy) * uB;
  vec4 s = vec4(0.0);
  for (int y = 0; y < uB; y++) for (int x = 0; x < uB; x++) s += texelFetch(uState, p + ivec2(x, y), 0);
  o = s;
}`;

// The trails: each channel's life, kept as it fades (uFade a frame), shown dimmed under it.
const TRAIL_FS = `
uniform sampler2D uTrail, uState; uniform float uFade;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  o = vec4(max(texelFetch(uTrail, p, 0).rgb * uFade, texelFetch(uState, p, 0).rgb), 1.0);
}`;

// Life erased in a disc (the walls are erased on the CPU).
const ERASE_FS = `
uniform sampler2D uState; uniform vec2 uCenter; uniform float uRadius; uniform int uN;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 a = texelFetch(uState, p, 0);
  vec2 d = vec2(p) + 0.5 - uCenter;
  d -= float(uN) * floor(d / float(uN) + 0.5);
  o = length(d) < uRadius ? vec4(0.0, 0.0, 0.0, a.a) : a;
}`;

// The world on screen: each channel its colour, added and softly saturated; walls over it.
const SHOW_FS = `
uniform sampler2D uState, uTrail; uniform vec2 uOrigin; uniform float uScale, uTrails; uniform vec3 uCol[3], uBg, uWall; uniform int uN, uLinear;
vec4 at(sampler2D t, vec2 w) { return uLinear == 1 ? texture(t, w / float(uN)) : texelFetch(t, ivec2(w), 0); }
void main() {
  vec2 w = (gl_FragCoord.xy - uOrigin) * uScale;
  if (w.x < 0.0 || w.y < 0.0 || w.x >= float(uN) || w.y >= float(uN)) { o = vec4(uBg * 0.6, 1.0); return; }
  vec4 a = at(uState, w);
  vec3 tr = at(uTrail, w).rgb * uTrails;
  vec3 c = uCol[0] * (a.r + 0.28 * tr.r) + uCol[1] * (a.g + 0.28 * tr.g) + uCol[2] * (a.b + 0.28 * tr.b);
  c = uBg + (1.0 - uBg) * (1.0 - exp(-1.7 * c));
  o = vec4(mix(c, uWall, clamp(a.a, 0.0, 1.0)), 1.0);
}`;

/* ---- 3.2 State and step ---------------------------------------------------------------------- */

let P, state, spec, kernelSpecs, pots, wallsTex, census, trail, law, kernelCount = 0;
const BLOCK = 8;
let CENSUS, walls;

function setupGPU() {
  P = { fft: program(FFT_FS), mul: program(MUL_FS), step: program(STEP_FS), stamp: program(STAMP_FS), walls: program(WALLS_FS), erase: program(ERASE_FS), census: program(CENSUS_FS), trail: program(TRAIL_FS), show: program(SHOW_FS) };
  fftProgram = P.fft;
}

// The world's textures for an n×n torus (n a power of 2), the old ones let go.
function allocate(n) {
  for (const t of [state, scratch, spec, kernelSpecs, pots, wallsTex, census, trail].flat().filter(Boolean)) {
    if (t.fb) gl.deleteFramebuffer(t.fb);
    gl.deleteTexture(t);
  }
  N = n; CENSUS = N / BLOCK; walls = new Uint8Array(N * N);
  const lin = linearOk ? gl.LINEAR : gl.NEAREST;
  state = [texture(N, N, null, gl.RGBA32F, gl.RGBA, gl.FLOAT, lin), texture(N, N, null, gl.RGBA32F, gl.RGBA, gl.FLOAT, lin)];
  scratch = [texture(N, N), texture(N, N)];
  spec = texture(N, N);
  kernelSpecs = Array.from({ length: GROUPS }, () => texture(N, N));
  pots = Array.from({ length: GROUPS }, () => texture(N, N));
  wallsTex = texture(N, N, walls, gl.R8, gl.RED, gl.UNSIGNED_BYTE);
  census = texture(CENSUS, CENSUS);
  trail = [texture(N, N, null, gl.RGBA32F, gl.RGBA, gl.FLOAT, lin), texture(N, N, null, gl.RGBA32F, gl.RGBA, gl.FLOAT, lin)];
}

function fadeTrails(fade) {
  pass(P.trail, trail[1], { uFade: fade }, { uTrail: trail[0], uState: state[0] });
  trail.reverse();
}

// The law's kernels made, four to a texture, and their spectra taken by the same FFT.
function setLaw(l) {
  law = l; kernelCount = l.kernels.length;
  if (kernelCount > MAX_K) throw new Error(`${kernelCount} kernels, ${MAX_K} at most`);
  for (let g = 0; g < GROUPS; g++) {
    const four = l.kernels.slice(4 * g, 4 * g + 4);
    if (!four.length) continue;
    const packed = new Float32Array(N * N * 4);
    four.forEach((k, j) => { const img = kernelImage(k); for (let i = 0; i < N * N; i++) packed[i * 4 + j] = img[i]; });
    const t = texture(N, N, packed);
    fft(t, kernelSpecs[g], false);
    gl.deleteTexture(t);
  }
  const list = (f) => Array.from({ length: MAX_K }, (_, i) => (i < kernelCount ? f(l.kernels[i]) : 0));
  law.uniforms = {
    uK: { i: kernelCount }, uKind: { iv: list((k) => k.kind) }, uDst: { iv: list((k) => k.dst) }, uGn: { iv: list((k) => k.gn || 1) },
    uM: { f: list((k) => k.m || 0) }, uS: { f: list((k) => k.s || 1) }, uH: { f: list((k) => k.h ?? 1) }, uDt: l.dt, uSumH: l.sumH,
  };
}

function step() {
  fft(state[0], spec, false);
  for (let g = 0; g * 4 < kernelCount; g++) {
    const w = [];
    for (let j = 0; j < 4; j++) w.push(...(law.kernels[4 * g + j]?.w ?? [0, 0, 0, 0]));
    pass(P.mul, scratch[1], { uW: { v4: w }, uN: { i: N } }, { uSpec: spec, uKer: kernelSpecs[g] });
    fft(scratch[1], pots[g], true);
  }
  pass(P.step, state[1], law.uniforms, { uState: state[0], uPot0: pots[0], uPot1: pots[1], uPot2: pots[2], uPot3: pots[3] });
  state.reverse();
  generation++;
}

function apply(p, uniforms, textures = {}) {
  pass(p, state[1], uniforms, { uState: state[0], ...textures });
  state.reverse();
}

/* ---- 3.3 Creatures --------------------------------------------------------------------------- */

const patterns = new Map();
function patternTex(sp) {
  if (!patterns.has(sp)) { const pt = pattern(sp); pt.tex = texture(pt.w, pt.h, pt.data); patterns.set(sp, pt); }
  return patterns.get(sp);
}

// The species of slot i (the zoo's channel i, or the organism).
const speciesOf = (i) => (world.kind === 'zoo' ? world.slots[i] : world.organism);

// Slot i's species placed at (x, y) in world cells, turned by angle; a zoo species into its own channel.
function place(i, x, y, angle = Math.random() * TAU) {
  const sp = speciesOf(i), pt = patternTex(sp), s = world.R / sp.R;
  const route = new Float32Array(9);
  if (world.kind === 'zoo') route[i] = 1;
  else route[0] = route[4] = route[8] = 1;
  apply(P.stamp, { uCenter: [x, y], uCos: Math.cos(angle), uSin: Math.sin(angle), uInv: 1 / s, uRoute: { m3: route }, uN: { i: N } }, { uPat: pt.tex });
}

const footprint = (sp) => { const pt = patternTex(sp); return Math.hypot(pt.w, pt.h) * 0.5 * world.R / sp.R; };
const wallAt = (x, y) => walls[(((y | 0) % N + N) % N) * N + (((x | 0) % N + N) % N)];

// A free spot: no wall within the creature's footprint, away from the spots already taken.
function freeSpot(radius, taken) {
  for (let tries = 0; tries < 400; tries++) {
    const x = Math.random() * N, y = Math.random() * N;
    let ok = taken.every(([u, v, r]) => Math.hypot(u - x, v - y) > r + radius);
    for (let a = 0; ok && a < 16; a++) for (const f of [0.3, 0.65, 1]) if (wallAt(x + Math.cos(a * TAU / 16) * radius * f, y + Math.sin(a * TAU / 16) * radius * f)) ok = false;
    if (ok && !wallAt(x, y)) return [x, y];
  }
  return null;
}

// A few of each species of the world, on free spots (as many more as the world is larger).
function seed() {
  const slots = world.kind === 'zoo' ? [0, 1, 2] : [0];
  const each = (world.kind === 'zoo' ? 3 : 5) * (N / 512) ** 2, taken = [];
  for (let n = 0; n < each; n++) for (const i of slots) {
    const r = footprint(speciesOf(i)), at = freeSpot(r, taken);
    if (at) { place(i, ...at); taken.push([...at, r]); }
  }
}

// Keep alive: a species whose whole mass fell under half a creature's gets one more, on a spot
// free of walls and of life (read from the census of 8×8 blocks).
const creatureMass = (sp) => { const pt = patternTex(sp); let m = 0; for (let i = 0; i < pt.w * pt.h; i++) m += pt.data[i * 4] + pt.data[i * 4 + 1] + pt.data[i * 4 + 2]; return m * (world.R / sp.R) ** 2; };
function keepAlive() {
  pass(P.census, census, { uB: { i: BLOCK } }, { uState: state[0] });
  const buf = new Float32Array(CENSUS * CENSUS * 4);
  gl.readPixels(0, 0, CENSUS, CENSUS, gl.RGBA, gl.FLOAT, buf);
  const total = [0, 0, 0], taken = [];
  for (let i = 0; i < CENSUS * CENSUS; i++) {
    const m = buf[i * 4] + buf[i * 4 + 1] + buf[i * 4 + 2];
    for (const c of LIFE) total[c] += buf[i * 4 + c];
    if (m > 0.5) taken.push([(i % CENSUS + 0.5) * BLOCK, (Math.floor(i / CENSUS) + 0.5) * BLOCK, BLOCK]);
  }
  const slots = world.kind === 'zoo' ? [0, 1, 2] : [0];
  for (const i of slots) {
    const sp = speciesOf(i), mass = world.kind === 'zoo' ? total[i] : total[0] + total[1] + total[2];
    if (mass >= 0.5 * creatureMass(sp)) continue;
    const at = freeSpot(footprint(sp), taken);
    if (at) { place(i, ...at); taken.push([...at, footprint(sp)]); }
  }
}

function clearLife() { apply(P.walls, { uClear: 1 }, { uWalls: wallsTex }); fadeTrails(0); }

/* ---- 3.4 Walls ------------------------------------------------------------------------------- */

// The CPU's walls sent to the GPU.
function uploadWalls() {
  gl.bindTexture(gl.TEXTURE_2D, wallsTex);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, N, N, gl.RED, gl.UNSIGNED_BYTE, walls);
  apply(P.walls, { uClear: 0 }, { uWalls: wallsTex });
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
    const [a, b] = next[Math.floor(Math.random() * next.length)];
    open[[Math.min(i, a), Math.min(j, b), a !== i ? 'v' : 'h']] = true;
    seen[b * n + a] = 1; stack.push([a, b]);
  }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    if (!(i > 0 && open[[i - 1, j, 'v']])) rect(i * cell - t / 2, j * cell - t / 2, t, cell + t);
    if (!(j > 0 && open[[i, j - 1, 'h']])) rect(i * cell - t / 2, j * cell - t / 2, cell + t, t);
  }
}

// A closed arena with round pillars and a few bars.
function arena() {
  const t = Math.max(4, world.R * 0.45);
  rect(-t / 2, 0, t, N); rect(0, -t / 2, N, t);
  for (let k = 0; k < 14; k++) disc(t + Math.random() * (N - 2 * t), t + Math.random() * (N - 2 * t), world.R * (0.6 + Math.random() * 1.2));
  for (let k = 0; k < 4; k++) {
    const len = world.R * (4 + Math.random() * 5), x = Math.random() * N, y = Math.random() * N;
    Math.random() < 0.5 ? rect(x, y, len, t) : rect(x, y, t, len);
  }
}

const DECORS = { Empty: () => {}, Maze: maze, Arena: arena };
function setDecor(name) {
  decor = name;
  walls.fill(0);
  DECORS[name]();
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

const COLOURS = [[1.0, 0.36, 0.18], [0.22, 1.0, 0.5], [0.32, 0.52, 1.0]];
const byCode = (list, code) => list.find((s) => s.code === code);
const ZOO_START = SPECIES.single.slice(0, 3);
// A species in a list: Chan's name if it has one, its code, how it lives.
const label = (s) => `${s.name ? `${s.name} · ` : ''}${s.code} — ${s.life}`;
let world = { kind: 'zoo', slots: [...ZOO_START], organism: SPECIES.multi[0], R: 13, meet: 0.6 };
let decor = 'Maze', tool = 'Creature', selected = 0, speed = 2, running = true, alive = true, trails = true, generation = 0;

function rebuild(reseed = true) {
  setLaw(lawOf(world));
  if (reseed) { clearLife(); seed(); }
  generation = 0;
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

// A species' thumbnail: its channels in their colours.
function thumbnail(cv, sp, slot) {
  const pt = pattern(sp), side = 88;
  cv.width = cv.height = side;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(side, side), sc = Math.max(pt.w, pt.h) / side;
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
    const px = Math.floor(x * sc - (side * sc - pt.w) / 2), py = Math.floor((side - 1 - y) * sc - (side * sc - pt.h) / 2);
    const rgb = [0, 0, 0];
    if (px >= 0 && py >= 0 && px < pt.w && py < pt.h) for (let c = 0; c < 3; c++) {
      const v = pt.data[(py * pt.w + px) * 4 + c], col = COLOURS[slot ?? c];
      for (let k = 0; k < 3; k++) rgb[k] += col[k] * v;
    }
    const i = (y * side + x) * 4;
    for (let k = 0; k < 3; k++) img.data[i + k] = 11 + 244 * (1 - Math.exp(-1.7 * rgb[k]));
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

/* ---- 4.3 Panel ------------------------------------------------------------------------------- */

function slotRow(i, sp, list, onPick) {
  const row = button('', 'Click places it: select it, then click the world', () => { selected = i; tool = 'Creature'; buildPanel(); });
  row.classList.add('slot');
  row.classList.toggle('on', selected === i && tool === 'Creature');
  const cv = document.createElement('canvas'); thumbnail(cv, sp, world.kind === 'zoo' ? i : undefined);
  const sel = document.createElement('select');
  for (const s of list) sel.append(new Option(label(s), s.code, false, s === sp));
  sel.onclick = (e) => e.stopPropagation();
  sel.onchange = () => onPick(byCode(list, sel.value));
  const dot = document.createElement('span'); dot.className = 'dot';
  dot.style.background = world.kind === 'zoo' ? `rgb(${COLOURS[i].map((v) => v * 255)})` : 'linear-gradient(90deg,#ff5c2e,#38ff80,#5285ff)';
  row.append(cv, dot, sel);
  return row;
}

function buildPanel() {
  tabs($('worldTabs'), [['zoo', 'Zoo', 'Three species of one channel each, each its own law and colour'], ['organism', 'Organisms', 'Chan\'s two- and three-channel creatures: one law over the colours']],
    () => world.kind, (v) => { world.kind = v; selected = 0; world.R = v === 'zoo' ? 13 : 12; buildPanel(); rebuild(); });
  const slots = world.kind === 'zoo'
    ? world.slots.map((sp, i) => slotRow(i, sp, SPECIES.single, (s) => { world.slots[i] = s; selected = i; buildPanel(); rebuild(); }))
    : [slotRow(0, world.organism, SPECIES.multi, (s) => { world.organism = s; buildPanel(); rebuild(); })];
  $('slots').replaceChildren(...slots);
  tabs($('decorTabs'), Object.keys(DECORS).map((d) => [d, d, d === 'Empty' ? 'No walls (the world is a torus)' : `A new random ${d.toLowerCase()} at each click; the creatures placed again`]),
    () => decor, (v) => { setDecor(v); clearLife(); seed(); });
  tabs($('toolTabs'), [['Creature', 'Creature', 'A click places the selected species; a drag moves the view'], ['Wall', 'Wall', 'Draw walls by dragging'], ['Eraser', 'Eraser', 'Erase walls and life by dragging']],
    () => tool, (v) => { tool = v; buildPanel(); });
  $('othersBox').style.display = world.kind === 'zoo' ? '' : 'none';
  tabs($('othersTabs'), [['0', 'Ghosts', 'The species do not feel each other: they cross'], ['0.6', 'Push', 'Each species is pushed away by the others, through its own kernel'], ['2', 'Fight', 'Pushed hard: a meeting erodes both']],
    () => String(world.meet), (v) => { world.meet = +v; rebuild(false); });
  tabs($('sizeTabs'), [10, 13, 18, 24].map((r) => [String(r), `R ${r}`, `Kernel radius ${r} cells: the creatures' size; species and walls made again`]),
    () => String(world.R), (v) => { world.R = +v; setDecor(decor); rebuild(); });
  tabs($('spaceTabs'), [512, 1024].map((n) => [String(n), `${n}²`, `A world of ${n}×${n} cells${n > 512 ? ': room for more, four times the work' : ''}`]),
    () => String(N), (v) => { allocate(+v); view.centre = [N / 2, N / 2]; frameView(); setDecor(decor); rebuild(); });
  tabs($('speedTabs'), [1, 2, 4, 8].map((s) => [String(s), `×${s}`, `${s} step${s > 1 ? 's' : ''} a frame`]), () => String(speed), (v) => { speed = +v; });
  $('runRow').replaceChildren(
    button(running ? 'Pause' : 'Play', 'Run or stop time', () => { running = !running; buildPanel(); }),
    toggle('Trails', 'Where the creatures went, fading', () => trails, () => { trails = !trails; render(); }),
    toggle('Keep alive', 'A species gone is given one more creature, on a free spot', () => alive, () => { alive = !alive; }),
    button('Step', 'One step', () => { step(); render(); }),
    button('Seed', 'Life cleared, a few of each species placed again', () => { clearLife(); seed(); generation = 0; }),
    button('Clear', 'All life cleared (the walls stay)', () => { clearLife(); generation = 0; }));
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
  pass(P.show, null, { uOrigin: view.origin, uScale: view.scale, uTrails: trails ? 1 : 0, uCol: { v3: COLOURS.flat() }, uBg: [0.043, 0.051, 0.071], uWall: [0.23, 0.25, 0.3], uN: { i: N }, uLinear: { i: linearOk ? 1 : 0 } }, { uState: state[0], uTrail: trail[0] });
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
  if (grab && !grab.moved && inWorld(worldAt(e))) { place(selected, ...worldAt(e)); render(); }
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

/* ---- 4.5 Loop and check ---------------------------------------------------------------------- */

let frames = 0, fpsAt = performance.now(), fps = 0, aliveTick = 0;
function frame() {
  if (running) { for (let k = 0; k < speed; k++) step(); fadeTrails(0.985); }
  if (running && alive && ++aliveTick % 30 === 0) keepAlive();
  render();
  frames++;
  const now = performance.now();
  if (now - fpsAt > 500) {
    fps = frames * 1000 / (now - fpsAt); frames = 0; fpsAt = now;
    $('stats').textContent = `${fps.toFixed(0)} fps · ${N}×${N} · ${kernelCount} kernels · step ${generation}`;
  }
  requestAnimationFrame(frame);
}

// The state read back: per channel its mass and centre (on the torus, by angles).
function readState() {
  const buf = new Float32Array(N * N * 4);
  bindTarget(state[0]);
  gl.readPixels(0, 0, N, N, gl.RGBA, gl.FLOAT, buf);
  return buf;
}
function masses(buf) {
  const m = [0, 0, 0], nan = buf.some(Number.isNaN);
  for (let i = 0; i < N * N; i++) for (let c = 0; c < 3; c++) m[c] += buf[i * 4 + c];
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
  fft(t, spec, false); fft(spec, scratch[1], true);
  const back = new Float32Array(N * N * 4);
  bindTarget(scratch[1]); gl.readPixels(0, 0, N, N, gl.RGBA, gl.FLOAT, back);
  let err = 0; for (let i = 0; i < buf.length; i++) err = Math.max(err, Math.abs(back[i] / (N * N) - buf[i]));
  out.push({ test: 'fft round trip', ok: err < 1e-4, err });
  walls.fill(0); decor = 'Empty'; uploadWalls();
  const trial = (kind, sp) => {
    world = kind === 'zoo' ? { ...world, kind, slots: [sp, ZOO_START[1], ZOO_START[2]] } : { ...world, kind, organism: sp };
    world.R = kind === 'zoo' ? 13 : 12;
    world.meet = 0;
    setLaw(lawOf(world)); clearLife(); place(0, N / 2, N / 2, 0);
    const m0 = masses(readState());
    for (let k = 0; k < steps; k++) step();
    const m1 = masses(readState());
    const a = kind === 'zoo' ? m0.m[0] : m0.m[0] + m0.m[1] + m0.m[2], b = kind === 'zoo' ? m1.m[0] : m1.m[0] + m1.m[1] + m1.m[2];
    out.push({ test: `${kind} ${label(sp)}`, ok: !m1.nan && b > a * 0.4 && (sp.life === 'grows' || b < a * 2.5), ratio: +(b / a).toFixed(3) });
  };
  for (const sp of SPECIES.single) trial('zoo', sp);
  for (const sp of SPECIES.multi) trial('organism', sp);
  console.table(out);
  ({ world, running } = was);
  allocate(was.N); frameView(); setDecor(was.decor); buildPanel(); rebuild();
  return { ok: out.every((r) => r.ok), out };
};

/* ---- 4.6 Start-up ---------------------------------------------------------------------------- */

if (!floatOk) $('fail').style.display = 'flex';
else {
  setupGPU();
  allocate(N);
  resize();
  addEventListener('resize', () => { resize(); render(); });
  buildPanel();
  setDecor(decor);
  rebuild();
  requestAnimationFrame(frame);
}
