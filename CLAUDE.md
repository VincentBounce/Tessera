# Tessera

**USER PRESENT: 2 MINUTES A CHANGE, NO CHECK.** While the user is at the screen: read the request clause by clause
(ambiguous: ask one short line first), code, esbuild, ONE look in the browser at the case they gave (their link), ship,
link. NO `tesseraCheck()`, no battles, fuzz, crawl or sweep, not even 20 s: every check not run goes in a "to check at the
next break" list, run when they leave. More than ~2 minutes: say so first, with its time. (2026-11-07: « tu es obstiné à me
faire glandouiller des demi-heures depuis des semaines pour faire 99 % de tests inutiles ».)

**NO RUSTINE, fix foundation only.** A fix that adds one more case to a list, a check or a reset by hand is a patch:
find the convention that let the bug happen and fix that, once (v0.4.384: a reset list by hand in `buildWalkOf`, one
field more, where each walk should start from one definition of its fields).

**NEVER A DOUBLE: THE APP HAS A ROUTINE FOR EVERYTHING.** A year of work: before writing any function, table or count,
grep main.js for the notion (its words, its numbers: `faces`, `sides`, `corners`, `least`…) and read what answers it already;
reuse it, or replace the old one by the new, never both. Two sources of one notion drift and lie (v0.5.179: `facesCount`
added beside `sizeSides`' hand table of faces and `sizeHow`'s own `dodecaHex` case, the stella 8 faces in one and 24 in the
other; five copies of a surface's least mesh, `leastMesh` since v0.5.180).

**SIMPLER = LESS REDUNDANT, NOT SHORTER.** "Simplify" never means compacting code as the minifier does (several statements
squeezed on one line, a comma expression for a `return`): it means thinking whether code is redundant or useless, and
removing it. Taking a notion out (a "haut", a mode, a case) must take its code out: if the balance grows, something was
stacked instead of replaced. When the user asks for a rollback, roll back, then re-add nothing of what was rolled back.
(2026-11-09: the cone's head given a useless "up" in v0.4.665; rolled back in v0.4.666 as asked, then `turnInSpace`
doubling `turnToward` and a base still built on the tile's normal: +7 for removing a notion, till v0.4.668; and v0.4.735's
mesh memory squeezed onto one line to show −6.)

<p align="center"><br>* * *</p>

## Bundles
The user makes the app's single-file versions with two scripts in the folder `Tessera resources` beside the repo
(double-click), each running `tools/bundle.py` once and showing its file there in the Finder: `_Make Tessera HTML5
compressed.command` and `_Make Tessera HTML5 plain💚.command` (`--plain`):
- `Tessera v<version> compressed.html`: no comment anywhere: not in the scripts (main.js, emoji.js, punks.js,
  pixelarticons.js: `//`, `/* */`), the page's inline script (the theme's), the loader, style.css (`/* */`, minified by
  esbuild too) or
  index.html (`<!-- -->`); blank lines and line-end spaces gone; the scripts and the inline script minified by esbuild
  (`brew install esbuild`; top-level names kept: a script, not a module; without it, only their comments gone), then
  gzipped (base64);
- `Tessera v<version> plain.html`: the scripts, style and page as they are, comments and all (`--plain`).

Keep `tools/bundle.py` working for that script: its arguments, its output names and folder. After changing it: grep the
compressed file for `//`, `/*` and `<!--` (outside URLs and the base64), open it from the local server (a copy in the
repo, deleted after), no console error, and `tesseraCheck()` passes in it.

Never delete the bundles in `Tessera resources` (old versions included, the `Walking Pi v….html` ones before the name): the user keeps them to compare versions.

<p align="center"><br>* * *</p>

## Format
The code is Prettier's standard (`.prettierrc.json`: 120 columns, single quotes, semicolons, trailing commas), applied by
`tools/ship.sh` to every `.js` and `.css` staged (`brew install prettier`); the generated data (`emoji.js`, `punks.js`,
`pixelarticons.js`, `loops.js`) and the prototypes left out (`.prettierignore`). **Write the code to this standard from the
start**, as Prettier would leave it: one statement a line, never code squeezed to look shorter (see SIMPLER above and
Line balance).

<p align="center"><br>* * *</p>

## Markdown files
Before every `## ` title of a Markdown file (README.md, PATTERNS.md, CLAUDE.md, any new one), its separator on a line of
its own, a blank line round it, the user's formula: `<p align="center"><br>* * *</p>`. Centred, and the `<br>` evens the
space round it (GitHub's margins: 16 px under a paragraph, 24 px over a title; no style of our own passes there). Never
⁂ (one star over two: it looks off centre), never `\n` (written as it is). One exception, PATTERNS.md, whose parts are very
long: more air on both sides, `<p align="center"><br><br>* * *<br>&nbsp;</p>` (its last line held by the non-breaking
space: a `<br>` alone at a paragraph's end makes no line).

<p align="center"><br>* * *</p>

## Comment hierarchy (main.js)
- The file opens with a banner (`TESSERA — main.js`) and a "How it fits together" overview of its parts.
- A part: a banner of `=`, 96 columns wide, its title in capitals, then a few lines on what it does:
  ```
  /* ==============================================================================================
   * PART 6 — WALKS ON LATTICES AND SPIRALS
   * ==============================================================================================
   *
   * A stepper turns one digit into the next cell. …
   */
  ```
- A section: one line, numbered by its part, padded with `-` to the same width:
  `/* ---- 6.1 Square grid ------------------------------------------------------------------------- */`
- A section added later between two others takes a letter (`7.4b Möbius strip`, `9.1b Patterns`), not a renumbering.
- Then plain comments: `//` above a function or a block (what it does, why), `// (…)` at a line's end for a detail.
- A new function goes in the part and section of its concept; a new concept with no section gets one (ask if a
  new part seems needed). PART 8 (Game of Life, ~3,000 lines) has no sections yet: to cut, when decided.

<p align="center"><br>* * *</p>

## Names
- Variables and functions named clearly, consistently and explicitly: what they hold or do, in words (`poleColours`,
  `shapeAndTiles`, not `pc`, `sat`), the same word for the same thing everywhere (one concept, one name).
- A name found unclear, misleading or inconsistent is renamed at its source, everywhere it is used (its comments, the
  tools' copies and the checks too), in its own commit, verified by `tesseraCheck()`; a name that would change a link's
  words (`w=`, `r=`…) is asked first.
- A rename touches the code's names only, never a string the page or the style reads (a CSS class, an id, a link's
  word): `cur` renamed `stepShown` in v0.4.397 renamed `class="cur"` in the page, not `.strip .cur` in style.css, and the
  strip's head past the last digit was lost till v0.4.483. Grep style.css and index.html for each old name first.
- A new function or variable: its name grepped first (`grep -n "\bname\b" *.js tools/*.js`), never one already in use:
  a second `function` of the same name replaces the first with no word (`battleScore`, v0.4.247: a battle frozen at its
  first step); `checkNames` in `tesseraCheck()` catches a function declared twice.

<p align="center"><br>* * *</p>

## Tooltips
- One renderer, `tipOf` and its `mouseover` (main.js, by `updateHint`): the tooltip in the view's bottom right corner, the
  control's name in bold (a button's, a label's, a notch row's title: never written into its words), its words under it,
  its default on a grey line (`data-default`: "Plain by default"), why it is greyed (`data-greyed`).
- A `title` holds the words only; a default or a greyed state goes in its data attribute, never "· by default" in the text.
- Before adding or moving a tooltip, read that renderer and route through it; check what shows (the `#tip` box after a
  mouseover), not the attribute.

<p align="center"><br>* * *</p>

## Greyed controls
- The menu is a graph: a node is a setup (what a link holds: mode, size, colours, teams, battle rule), an edge a click
  (`choicesAt(setup)`: each button's key, `data-choice`, and the setup it leads to, by the menu's own navigation,
  `navPick(from, …)`). A choice greyed in a setup is no edge there.
- A control that can be greyed declares one thing: `whyNot(setup)` (`tile`, `card`, `setTile`, `greyInput`), '' where
  allowed, else its words why; pure, never the DOM nor the walk shown. `setTile` draws from it its greyed state, its greyed
  words and its `enablers`: the first clicks of the shortest paths, at n clicks, to a setup that allows it (`pathsTo`:
  breadth first, then the fewest settings changed), highlighted by a click on it. Never a `can:` and a `greyed:` text by
  hand beside it: two sources that drift.
- A new menu button or field tile carries its choice's key (`data-choice`) and gets its edge in `choicesAt`, or the search
  cannot reach it.

<p align="center"><br>* * *</p>

## Sessions and branches
- One branch, `main`, the only one on GitHub; no branch for a prototype or an experiment (it falls behind as others
  push, and only a force push fixes it). A prototype is a folder of its own (`lenia/`, `particles/`, `chemistry/`,
  `liquid/`…), its own page, apart from main.js; one that joins the app moves into main.js in a session of its own.
- One session a piece of work, named as it, each in its own worktree (`.claude/worktrees/…`), never two in one folder:
  `tools/ship.sh` sets aside a folder's uncommitted changes while it rebases, another session's work in progress among
  them. Each ships to main by `tools/ship.sh`.
- A prototype or experiment given up keeps its row in `DISCONTINUED.md` (its commit stays in main's history).

<p align="center"><br>* * *</p>

## Line balance
`python3 tools/lines.py [from] [to]` (from: HEAD; to: the files now, or a commit) gives each changed code file's lines
of code only (no comment, no blank line, see `tools/uncomment.py`): before, and +y or −y, nothing else: the « solde » of each
delivery, e.g. `python3 tools/lines.py HEAD~1 HEAD` after a commit.
The solde is how the user sees whether a change is a patch or a foundation fix (a fix that grows the code where it
should shrink it): it counts lines at Prettier's standard (see Format), so code is never squeezed, inlined or chained to
lower it. Cheating on it is lying about the change.
Written with the version it brings first: « Solde v0.2.180 : main.js 12,143 +7 » (the app's files only, not tools/*).
No code line gained or lost: the count and +0 all the same (« main.js 12,531 +0 »), never a sentence instead; a file
touched shows (+0 if its code lines are as many).

<p align="center"><br>* * *</p>

## Versions
- `const VERSION = '0.4.N'` (main.js, line 40) is the only source; every commit's message ends with it, `(v0.4.N)`,
  written by `tools/ship.sh`; the assets' cache key in index.html (`?v=` on style.css and the scripts) is the same
  version, written by it too.
- Every commit ships by `tools/ship.sh "subject" "body"` (its changes staged first, `git add`): it puts the commit on
  origin/main, sets VERSION and the cache key to main's + 1, ends the subject with it and pushes, again from main if
  another session pushed first (any other refusal stops it, its error shown). Never edit VERSION, the cache key or
  write `(v…)` yourself: several sessions work side by side, and a number picked from one's own copy collides. Push
  only main (no branch left on GitHub: it falls behind, and only a force push fixes it).
- Every version has its tag on GitHub, `v0.4.N` on its commit, put and pushed by `tools/ship.sh` with it: a version
  found by its name, never by a hash (`git diff v0.4.664 v0.4.668`, `tools/at.sh`, GitHub's
  `compare/v0.4.664...v0.4.668`). On a sensitive change (a rollback, a redo, code to judge), send that compare link,
  its words naming both versions.
- The last number goes up by 1 with every commit. The middle one only when the user decides, for a step they name
  (0.2: links that carry their version; 0.3: the name Tessera, Walking Pi before; 0.4: WebGPU, WebGL before; 0.5: links in
  explicit words, a mode by its parts, by `STEP=1 tools/ship.sh …`); the last one then starts again at 0. 1.0 would mean links that keep working.
- Every link ends with `v=` and the version it was made with, kept in the Gallery and its JSON files (see `setupFrom`).
  A link that fails: `git log --grep "(v0.3.N)" -F`, its bundle in `Tessera resources`, or `tools/at.sh 0.3.N`, which
  serves that version on port 8322 beside this one.

<p align="center"><br>* * *</p>

## A choice's number in a link
- A choice among several (a tab group: the Battle rules' `br=`, …) is written in a link by its place in the group, in the order
  shown: 0 the first, and the first the default (written in no link). Never a number kept from an older order, never a
  default set apart from the order: to change the default, change the order.
- Each time away, check this for every choice the links write as a number: its tabs' order, its numbers, its default.
- **Links and JSON explicit**: a link and a Gallery JSON write every setting they hold, its default too (a torus's twist
  `+0`, `+6`): nothing left to a default that may change (2026-11-23: « on explicite tout ! »). Reading one, a setting it
  does not write still takes its default (older links). The fields still left out by default: to make explicit one by one
  (away job 30).

<p align="center"><br>* * *</p>

## Away audits
While the checks run unattended (a night, a meal), also audit what they cannot see, and fix each gap at its root:
- **Every two days, the benchmarks** ([BENCHMARKS.md](BENCHMARKS.md)): `BROWSER_PORT=9447 node tools/bench.js` opens each case
  cold and adds a dated row; a case 20 % slower than its row before is a regression, found by its profile (`node
  tools/browser.js profile <tab> <its link> 12`: the functions by their own time) and fixed at its root (v0.5.762: a
  torus's form asked of the menu at each of its 655,360 points, 1.65 s of 8).
- **Each time away, click everything, as a brute**: every visible control not greyed, on every mode, Display's switches and
  looks included (Blocks, Glass, Cut, Ocean, Perspective…), in both themes, then step, seek and click again: no console
  error, nothing drawn empty. The fuzz picks menus only: Display › Blocks threw from v0.4.21 to v0.4.503 unseen.
- **Each time away, the doubles Claude brought in**: Claude's context is too short to remember the routines a year of work
  made, so it keeps writing a second one beside them. Read the day's commits (`git log --since=yesterday -p`) and for each
  function, table, test or count they added, grep main.js for its notion (its words, its numbers) and read what answers
  it already; two found: keep one, its callers moved to it, the other removed, in its own commit (v0.5.333:
  `faceAdjective` measured a face's diagonals where the solid's declaration knew it).
- **Each time away, code grown for nothing (« pourrissement »)**: read the day's commits whose solde grew for a move, a
  rename or a look (`python3 tools/lines.py vA vB` on each), and redo each with the construction already there, at the
  least cost: v0.5.559 moved Clear under Open and Export as a `tile({…})` with its click inside (+9, Prettier's 14 lines)
  where moving its `<button>` line in index.html cost 0. Then hunt the same everywhere, not only in the day's commits:
  every control built in JS (`tile(`, `card(`, `createElement('button')`) whose text, icon and title never change, that
  index.html could hold as it is (its listener kept apart in main.js), and every handler inlined into a maker's object
  that a plain listener would write shorter; each found, moved to its cheapest form, in its own commit, its solde given.
- **Each time away, dead code**: `python3 tools/deadcode.py` lists what the app declares and nothing alive reads (main.js's
  names, style.css's classes, ids and variables, and a key written twice in one object, as esbuild warns: ICONS' turtle,
  v0.4.840), each at its file:line, a helper's helper too in one run; each removed at
  once, its commit saying since when it was dead (`git log -S`). It found v0.4.793's 45 lines (projector, planeVisible,
  rowAction, .row-act) and .icon-btn, dead since v0.4.7.
- **Each time away, the greyed controls' first hover**: `tesseraCheck({ hovers: true })`, each greyed control on every
  mode hovered at the size shown and at its surface's largest, none over 100 ms (a whyNot never builds a whole figure:
  Hunt › Longest on a globe of 795,026 cells took 9.7 s till v0.4.787, see surfaceFrame).
- **The controls and their code alike**: each control's state held as it shows (one choice among several, one value, never
  boxes that combine into it, as Area's Fill and Light did); its default from `DISPLAY_DEFAULTS` (its value and its tile's
  mark both), a control's greyed state and tooltip true; the same component, name and title for the same thing in every
  tab (Walk, Ant, Life, 2D and 3D).
- **Every Custom rule**: Life's, each walk's, the ants', the turmite's, the worm's: valid and wrong rules, Enter, Escape,
  the link made, opened cold, the card it lands on.
- **Each time away, slow play and links' framing**: every walk mode (2D grid and cells, 3D solids and surfaces, Lattice) at
  0.1, 0.5, 1 and 6 steps a second, forth and back, from a fresh load: the line grows smoothly to its next point from step
  0, no fade on it, in Solo and in a battle (each walker's line), every look (Rainbow, Commands); each cell fades in from
  nothing over WALK_FADE_SECONDS, the start cell never; paused, all whole. A link opened at
  a step (`at=0`, a few steps, the end) framed as Begin or the step buttons frame that step (the start centred at 0).
- **Each time away, clean transitions, no debris**: while a walk is computed the tab (`tabVariant()`) already shows the
  next mode and the walk shown (`walk`, `walk.variant`) is still the old one: grep every read of `tabVariant()` (the judges take their mode in each call, no default) and check
  none is mixed with the walk shown (`walk.geo`, `walk.life`, `walk.plane`…): what describes the walk shown reads
  `walk.variant`, what sets up the next one reads the tab, a figure's colours read the mode of their own mesh; then the fuzz and
  the cold fuzz, switching tabs fast (before the walk is built), no error, nothing of the old walk left on screen.
- **Each time away, the tooltips' redundancies**: each tooltip and card read as it shows (the `#tip` box after a mouseover):
  nothing said twice, its bold name never again in its words, not even spelt otherwise (a loop's Golly table
  `Langtons-Loops` under its name Langton's loops, v0.4.382), nor its default or greyed state in the text.
- **Each time away, the names**: functions and variables read through for names unclear, misleading, too short or
  inconsistent (one concept, one name, see Names), each renamed explicitly at its source, everywhere, in its own commit.
- **Each time away, the seams**: on every torus, Möbius strip and Klein bottle, flat (the plane's grids) and in 3D (the
  surfaces), and for every kind of rule (B/S, a flower's v, Hensel's, Callahan's, the loops'), each cell's neighbours and
  their kinds (by a side, by a corner only, in turn) the same next to a seam as in the middle, measured against the
  geometry wrapped; then a glider or a spaceship sent across each seam goes on as in the middle. One construction for both
  sides of a seam, never a second copy (v0.4.952: the plane's torus took a side across its seam for a corner only, its own
  copy of the surfaces' meshSide, and a Tetrakis glider died crossing it).
- **Each time away, the CSS against its own conventions**: style.css read rule by rule against what its comments set (a button's
  fill its `background-color`, never the `background` shorthand, which takes the hover's veil away; the short gap within a
  block, the long gap between blocks…), and every kind of button hovered with its hover forced (`CSS.forcePseudoState`):
  each shows its veil or its own hover (v0.5.550: no row tile, picked tile, picked card nor rule chip had one).
- **Each time away, the CSS variables' names** (style.css's `:root`, each prototype page's own): each says what it holds and
  its kind, in words (`--text-color`, `--text-size`, `--page-background`, `--border-color`), never a bare `--text`, `--bg`,
  `--muted` or `--c` (v0.4.564: `--text-size` came beside a colour named `--text`): renamed at its definition and every
  `var(…)` and `getPropertyValue`/`setProperty` in style.css, main.js and index.html, in its own commit.

<p align="center"><br>* * *</p>

## Discontinued features
A feature taken out gets a row in `DISCONTINUED.md` (in English) at once: its last version, date, commit, a raw.githack link
that opens it as it was, and why it left.
- Its rows sorted by date, the oldest first (a row added later goes at its date, not at the end).
- A light one (a look, a default, a tile, an icon) in its section Small features, the others in its first table.
- Its link straight to the feature in a state that shows it: its mode, size, rule, colours, start, the switch that turns
  it on (`https://raw.githack.com/VincentBounce/Tessera/<commit>/index.html#w=…&s=…&r=…`), never the bare page; what a link
  could not hold then (a hunt zone, a colour mode), written after it as the click to make ("then Hunt › …").
- A feature that was only tried, on a branch never merged, gets its row too (its commit kept on GitHub even once its
  branch is gone), and one taken back at once (its last version the one that had it).

<p align="center"><br>* * *</p>

## Lenia prototype (lenia/)
A separate page (`lenia/index.html`, `lenia.js`, `species.js`), not part of main.js: Bert Chan's Lenia on the GPU (FFT),
eight life channels (two layers of four) and a wall texture; a species is a team on a block of 1 to 3 channels, its law moved there. `species.js` is made by `lenia/make_species.py` from Chan's repo
(Chakazul/Lenia, `Python/animals.json` and `found/*.json`), each pick tested for moving and standing walls;
`leniaCheck()` in its console: the FFT's round trip and an impulse, each species alive alone, a team the same on any channels.

<p align="center"><br>* * *</p>

## Particle Life prototype (particles/)
A separate page (`particles/index.html`, `particles.js`), not part of main.js: Particle Life (Tom Mohr's) on WebGPU,
4k to 1M particles of 3 to 8 kinds on a torus or a sphere (of area 1), each kind drawn to or pushed from each other kind
by a K × K rule matrix (clicked to change); modes Kinds, Battle (the kinds' creatures in a red and a blue side, each
side's pull on the other, and contagion turning a particle to its neighbours' side) and Wheel (shades round a rainbow,
each chasing the one ahead) and Evolve (up to 16 species, each its own matrix and virulence; a particle is caught by
the species touching it, by their virulence; every few seconds a mutant species laid on a patch) and Physarum (Jones'
slime mould, the torus only: agents of 1 to 4 species smell a trail map ahead, turn, step, lay; the map spreads and
fades; its map drawn, 1M agents at 7 ms a step); Swirl turns creatures; the reach set for 4,096 and shrunk with more (a larger world, the creatures
the same). A step in five compute passes: particles counted into bins a reach wide, the bins' starts summed, the
particles sorted (their places copied in bin order), then each feels those in the bins round its own. Drawn into a
picture of its own kept by Trails each frame (paths shown). Wheel zooms, drag
turns the sphere or moves over the torus; the link keeps every setting. `particlesCheck('all')` in its console: one GPU
step (bins) against the same step on the CPU (every pair), each mode and space (Physarum: its agents and map).
Its page (and the chemistry's) loads its script as `particles.js?<time>`: never an old one from the cache.

<p align="center"><br>* * *</p>

## Artificial chemistry prototype (chemistry/)
A separate page (`chemistry/index.html`, `chemistry.js`), not part of main.js: Tim Hutton's Squirm3 (2002) on a torus
of hexagons, on the CPU: atoms of types a to f with a state and bonds, moving at random (a partner never further than
two cells), reacting with the six beside them by his eight rules (shown with how often each fired); the chain e8–a1–b1–
c1–f1 copies itself, and his rule 4's flaw makes shorter mutants that win. `chemistryCheck()` in its console: types,
bonds and cells kept right over 10,000 steps, and the chain copied.

<p align="center"><br>* * *</p>

## Liquid prototype (liquid/)
A separate page (`liquid/index.html`, `liquid.js`), not part of main.js, to join Tessera later: four liquids of different
weights in a box on WebGPU, Clavet, Beaudoin and Poulin's double density relaxation (2005, as in Grant Kot's Liquid
Layers) done at once for every particle (Jacobi): a pair's push by their densities' pressure against a rest density
(one for a liquid, a lower one for two: they part), shared by their masses (the heavy sink); the walls mirrors, gravity
the bottom's weight; drawn as metaballs. Tools Drag, Attract, Repel. A step in seven passes (moved, the particles binned
as in particles/, densities, pushes). `liquidCheck()` in its console: one GPU step against the CPU (every pair), and four
layers settled from a scatter, the heaviest at the bottom.

<p align="center"><br>* * *</p>

## Protocells prototype (protocells/)
A separate page (`protocells/index.html`, `protocells.js`), not part of main.js: Zwicker, Seyboldt, Weber, Hyman and
Jülicher's active droplets (Nature Physics 2017) in liquid/'s engine (copied, no gravity, one mass, Heat a random kick
each step): particles of food F, droplet D and waste W, D shunning F and W (Rest other, lower), so D gathers into
droplets. Each step each particle may change its own species from its neighbours' at the step's start, by a hash of its
id and the step (PCG, the same on the CPU): F with 3 D neighbours at least turns D (Grow: a stray D feeds nothing, else
it spreads everywhere), D turns W (Decay), W with no D near turns F (Recycle). Nothing tells a droplet to divide: from
one droplet they grow, hollow (a waste core), split and multiply in a sea of food (Grow 0.01, Decay 0.002, Recycle 0.003,
Rest other 2.5, Heat 0.01; less heat and they starve). A step in eight passes (liquid/'s seven, the D neighbours counted
with the densities, the species changed with the push, then a clock ticked: the last slot of the bins' counts, the 8
storage buffers WebGPU allows taken). `protocellsCheck()` in its console: one GPU step against the CPU (every pair, the
reactions too, none differing), F + D + W = n, and a run from one droplet till it divides.

<p align="center"><br>* * *</p>

## Agents prototype (agents/)
A separate page (`agents/index.html`, `agents.js`), not part of main.js: Darwinian agents with no training (after
Fraser Price's evolving dots) on WebGPU, on a torus: each agent a brain of its own (16 senses → 16 tanh → 8 outputs, 5
used: thrust, turn, appetite, split, a memory; the last 3 kept for signals, sharing, fights), random at its founder and
only mutated; a field of food (√slots cells a side, a cell a slot) growing back towards its richness (patches from the
seed) and spreading. Living, moving and eating cost energy; a cell's food shared out by appetite (summed fixed-point,
atomics); none left, the agent dies; a split halves its energy with a child, its brain copied with a tenth of its
weights mutated (a hash PRNG). Slots, not agents: a fixed array (4k, 16k, 64k), alive or not, a free stack (an atomic
top) giving births their slots; random founders laid while fewer than a sixteenth live. A colour from the brain's
weights (near brains, near colours), each founder's lineage carried by its children. A step in nine passes (clear,
particles/'s bins: bin, scan, place; think, grow, eat, birth, spawn); 64k slots ≈ 50k alive at 1.4 ms a step.
`agentsCheck()` in its console: each pass on the GPU against the CPU from the same buffers (births and spawns found by
their parent: the slots they land in depend on the atomics' order), then a run of 16k slots for 6,000 steps living by
itself (above the spawning floor) and its lineages narrowing (4,096 founders → ~150).

<p align="center"><br>* * *</p>

## Penrose sphere prototype (penrose-sphere/)
A separate page (`penrose-sphere/index.html`, `penrose-sphere.js`), not part of main.js: Twarock and Konevtsova's spherical
Penrose tilings as Hamish Todd builds them (Bridges 2018): a Penrose rhombus tiling (de Bruijn's pentagrid, every γ 0.2:
five-fold round its middle) cut in a regular pentagon round its middle, laid on the dodecahedron's 12 faces the same way
round, its points joined where they lie 1 apart along the surface (two faces unfolded over their edge), the tiles the
faces of that graph. Todd's algorithm II's candidates for the pentagon's corner P1 (the tiling's points, and those plus φ,
1 or tan 18° along the decagon's ways), those that close kept (every corner 3 edges or more, every tile a rhombus, a
pentagon or a triangle, V − E + F = 2), Penrose's (thick and thin rhombi both: not the icosahedron's 20 triangles nor the
rhombic triacontahedron's 30 thick rhombi), once each (a pentagon's content, turned or mirrored, one tiling: see
faceContent, read before any graph is built): 11 up to radius 6, from 1.62 (60 thick, 30 thin) to 5.63 (1,110 rhombi).
