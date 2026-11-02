/* ==============================================================================================
 * PARTICLE LIFE — particles.js
 * ==============================================================================================
 *
 * Particles of K kinds on a torus (the unit square, its sides glued). Each kind feels each other
 * kind by a rule a in [−1, 1] of the K × K matrix (not symmetric: red may chase blue while blue
 * flees red): within the reach, pushed apart when very near (the first 30% of it, whatever a),
 * then drawn (a > 0) or pushed (a < 0) by a tent peaking at the middle of the rest (Tom Mohr's
 * Particle Life). Velocities slowed by friction (halved every `friction` seconds of the world).
 * Every particle feels every other one, on the GPU: a fragment shader a particle, state in two
 * float textures (x, y, vx, vy) swapped each step; drawn as points, each its kind's colour.
 * particlesCheck() in the console: one GPU step against the same step on the CPU.
 */

/* ---- 1.1 Setting ----------------------------------------------------------------------------- */

const KINDS = [3, 4, 5, 6, 7, 8], COUNTS = [1024, 2048, 4096, 8192], BETA = 0.3, DT = 0.02, TEX = 128;
const COLOURS = [[1, 0.35, 0.35], [0.35, 0.85, 0.4], [0.4, 0.6, 1], [1, 0.85, 0.3], [0.85, 0.45, 1], [0.3, 0.9, 0.95], [1, 0.6, 0.25], [0.9, 0.9, 0.9]];
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
// The setting from the link: #k=6&n=4096&seed=7&reach=0.1&friction=0.04 and, once a rule is changed, m= its K² rules
const hash = Object.fromEntries(new URLSearchParams(location.hash.slice(1)));
const set = { k: KINDS.includes(+hash.k) ? +hash.k : 6, n: COUNTS.includes(+hash.n) ? +hash.n : 4096, seed: +hash.seed || 1, reach: +hash.reach || 0.1, friction: +hash.friction || 0.04, m: hash.m ? hash.m.split(',').map(Number) : null };
const rules = () => set.m ?? (() => { const r = mulberry32(set.seed * 7919); return Array.from({ length: set.k * set.k }, () => Math.round((r() * 2 - 1) * 4) / 4); })();
let M = rules();
const keep = () => { const h = { k: set.k, n: set.n, seed: set.seed, reach: set.reach, friction: set.friction }; if (set.m) h.m = set.m.join(','); history.replaceState(null, '', '#' + new URLSearchParams(h)); };

/* ---- 1.2 GPU --------------------------------------------------------------------------------- */

const view = document.getElementById('view'), gl = view.getContext('webgl2', { antialias: false });
if (!gl || !gl.getExtension('EXT_color_buffer_float')) { const f = document.getElementById('fail'); f.style.display = 'flex'; f.textContent = 'This page needs WebGL 2 with float textures.'; throw new Error('no WebGL 2'); }
const shader = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
const program = (vs, fs) => { const p = gl.createProgram(); gl.attachShader(p, shader(gl.VERTEX_SHADER, vs)); gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; };
const FULL = `#version 300 es
void main() { gl_Position = vec4(vec2(gl_VertexID & 1, gl_VertexID >> 1) * 4.0 - 1.0, 0.0, 1.0); }`;
// One step for one particle: the force of every other one, then friction, velocity and place (wrapped)
const STEP = `#version 300 es
precision highp float; precision highp int;
uniform sampler2D state; uniform sampler2D kind; uniform float rule[64];
uniform int n, k; uniform float reach, damp, dt;
out vec4 o;
float force(float r, float a) { return r < ${BETA} ? r / ${BETA} - 1.0 : a * (1.0 - abs(2.0 * r - 1.0 - ${BETA}) / (1.0 - ${BETA})); }
void main() {
  ivec2 me = ivec2(gl_FragCoord.xy);
  int i = me.y * ${TEX} + me.x;
  if (i >= n) { o = vec4(0.0); return; }
  vec4 s = texelFetch(state, me, 0);
  int ki = int(texelFetch(kind, me, 0).r);
  vec2 f = vec2(0.0);
  for (int j = 0; j < n; j++) {
    if (j == i) continue;
    ivec2 at = ivec2(j % ${TEX}, j / ${TEX});
    vec2 d = texelFetch(state, at, 0).xy - s.xy;
    d -= round(d);
    float r = length(d);
    if (r > 0.0 && r < reach) f += d / r * force(r / reach, rule[ki * k + int(texelFetch(kind, at, 0).r)]);
  }
  vec2 v = s.zw * damp + f * reach * 10.0 * dt;
  o = vec4(fract(s.xy + v * dt), v);
}`;
// A particle drawn: its place on the square (the torus as it is), its kind's colour
const DRAW_V = `#version 300 es
precision highp float;
uniform sampler2D state; uniform sampler2D kind; uniform vec2 scale; uniform float size; uniform vec3 colour[8];
out vec3 c;
void main() {
  ivec2 at = ivec2(gl_VertexID % ${TEX}, gl_VertexID / ${TEX});
  gl_Position = vec4((texelFetch(state, at, 0).xy * 2.0 - 1.0) * scale * vec2(1.0, -1.0), 0.0, 1.0);
  gl_PointSize = size;
  c = colour[int(texelFetch(kind, at, 0).r)];
}`;
const DRAW_F = `#version 300 es
precision highp float;
in vec3 c; out vec4 o;
void main() { float d = length(gl_PointCoord - 0.5) * 2.0; o = vec4(c * (1.0 - d * d), 1.0); }`;
const stepProgram = program(FULL, STEP), drawProgram = program(DRAW_V, DRAW_F);
const texture = (data, format, inner) => {
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, inner, TEX, data.length / TEX / (format === gl.RGBA ? 4 : 1), 0, format, gl.FLOAT, data);
  for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, p, gl.NEAREST);
  return t;
};
let states, frames, kinds, flip = 0;
// A fresh world: n particles at random places (the seed's), at rest, their kinds in turn
function scatter() {
  const r = mulberry32(set.seed), s = new Float32Array(set.n * 4), kd = new Float32Array(set.n);
  for (let i = 0; i < set.n; i++) { s[i * 4] = r(); s[i * 4 + 1] = r(); kd[i] = i % set.k; }
  states?.forEach((t) => gl.deleteTexture(t)); frames?.forEach((f) => gl.deleteFramebuffer(f)); if (kinds) gl.deleteTexture(kinds);
  states = [texture(s, gl.RGBA, gl.RGBA32F), texture(new Float32Array(s), gl.RGBA, gl.RGBA32F)];
  kinds = texture(kd, gl.RED, gl.R32F);
  frames = states.map((t) => { const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return f; });
  flip = 0;
}
const uni = (p, name) => gl.getUniformLocation(p, name);
function step() {
  gl.useProgram(stepProgram);
  gl.bindFramebuffer(gl.FRAMEBUFFER, frames[1 - flip]); gl.viewport(0, 0, TEX, set.n / TEX);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, states[flip]); gl.uniform1i(uni(stepProgram, 'state'), 0);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, kinds); gl.uniform1i(uni(stepProgram, 'kind'), 1);
  gl.uniform1fv(uni(stepProgram, 'rule'), Float32Array.from({ length: 64 }, (_, i) => M[i] ?? 0));
  gl.uniform1i(uni(stepProgram, 'n'), set.n); gl.uniform1i(uni(stepProgram, 'k'), set.k);
  gl.uniform1f(uni(stepProgram, 'reach'), set.reach); gl.uniform1f(uni(stepProgram, 'damp'), Math.pow(0.5, DT / set.friction)); gl.uniform1f(uni(stepProgram, 'dt'), DT);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  flip = 1 - flip;
}
function draw() {
  const w = view.width, h = view.height, side = Math.min(w, h);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, w, h);
  gl.clearColor(0.03, 0.035, 0.05, 1); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(drawProgram);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, states[flip]); gl.uniform1i(uni(drawProgram, 'state'), 0);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, kinds); gl.uniform1i(uni(drawProgram, 'kind'), 1);
  gl.uniform2f(uni(drawProgram, 'scale'), side / w, side / h);
  gl.uniform1f(uni(drawProgram, 'size'), Math.max(2, side / Math.sqrt(set.n) / 2.2));
  gl.uniform3fv(uni(drawProgram, 'colour'), COLOURS.flat());
  gl.drawArrays(gl.POINTS, 0, set.n);
  gl.disable(gl.BLEND);
}

/* ---- 1.3 Panel ------------------------------------------------------------------------------- */

// One choice among several: a tab group (Lenia Worlds' .tabs)
const tabs = (el, values, get, pick) => {
  el.innerHTML = '';
  for (const v of values) { const b = document.createElement('button'); b.className = 'btn'; b.textContent = v >= 1024 ? v / 1024 + 'k' : v; b.onclick = () => pick(v); el.append(b); }
  const mark = () => [...el.children].forEach((b, i) => b.classList.toggle('on', values[i] === get()));
  mark(); return mark;
};
const markKinds = tabs(document.getElementById('kinds'), KINDS, () => set.k, (v) => { set.k = v; set.m = null; M = rules(); fresh(); });
const markCounts = tabs(document.getElementById('counts'), COUNTS, () => set.n, (v) => { set.n = v; fresh(); });
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
document.getElementById('newRules').onclick = () => { set.seed = 1 + Math.floor(Math.random() * 99999); set.m = null; M = rules(); fresh(); };
document.getElementById('scatter').onclick = () => { scatter(); };
let on = true;
document.getElementById('play').onclick = (e) => { on = !on; e.target.textContent = on ? 'Pause' : 'Play'; };
for (const id of ['reach', 'friction']) {
  const input = document.getElementById(id), out = input.nextElementSibling;
  input.value = set[id]; out.textContent = set[id];
  input.oninput = () => { set[id] = +input.value; out.textContent = input.value; keep(); };
}
function fresh() { markKinds(); markCounts(); document.getElementById('seed').textContent = 'seed ' + set.seed; drawMatrix(); scatter(); keep(); }

/* ---- 1.4 Loop -------------------------------------------------------------------------------- */

const fit = () => { const r = view.getBoundingClientRect(), d = devicePixelRatio || 1; view.width = Math.max(1, r.width * d); view.height = Math.max(1, r.height * d); };
addEventListener('resize', fit);
let last = performance.now(), fps = 0;
function frame(t) {
  if (on) step();
  draw();
  fps = fps * 0.95 + 50 / Math.max(1, t - last); last = t;
  document.getElementById('stats').textContent = `${set.n} particles · ${set.k} kinds · ${fps.toFixed(0)} frames a second`;
  requestAnimationFrame(frame);
}
fit(); fresh(); requestAnimationFrame(frame);

/* ---- 1.5 Check ------------------------------------------------------------------------------- */

// One GPU step against the same step on the CPU (Float32 places and speeds read back): the largest difference
window.particlesCheck = () => {
  const read = () => { gl.bindFramebuffer(gl.FRAMEBUFFER, frames[flip]); const a = new Float32Array(set.n * 4); gl.readPixels(0, 0, TEX, set.n / TEX, gl.RGBA, gl.FLOAT, a); return a; };
  const s = read(), k = set.k, damp = Math.fround(Math.pow(0.5, DT / set.friction)), want = new Float32Array(s.length);
  const force = (r, a) => (r < BETA ? r / BETA - 1 : a * (1 - Math.abs(2 * r - 1 - BETA) / (1 - BETA)));
  for (let i = 0; i < set.n; i++) {
    let fx = 0, fy = 0;
    for (let j = 0; j < set.n; j++) {
      if (j === i) continue;
      let dx = s[j * 4] - s[i * 4], dy = s[j * 4 + 1] - s[i * 4 + 1];
      dx -= Math.round(dx); dy -= Math.round(dy);
      const r = Math.hypot(dx, dy);
      if (r > 0 && r < set.reach) { const f = force(r / set.reach, M[(i % k) * k + (j % k)]); fx += (dx / r) * f; fy += (dy / r) * f; }
    }
    const vx = s[i * 4 + 2] * damp + fx * set.reach * 10 * DT, vy = s[i * 4 + 3] * damp + fy * set.reach * 10 * DT;
    want.set([(((s[i * 4] + vx * DT) % 1) + 1) % 1, (((s[i * 4 + 1] + vy * DT) % 1) + 1) % 1, vx, vy], i * 4);
  }
  step();
  const got = read();
  let worst = 0;
  for (let i = 0; i < got.length; i++) { let d = Math.abs(got[i] - want[i]); if (i % 4 < 2) d = Math.min(d, 1 - d); worst = Math.max(worst, d); }
  const ok = worst < 1e-4;
  console.log(`particlesCheck: one step of ${set.n} particles, GPU against CPU, largest difference ${worst.toExponential(2)}: ${ok ? 'ok' : 'FAILED'}`);
  return ok;
};
