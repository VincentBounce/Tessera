# Tessera

**USER PRESENT: 2 MINUTES A CHANGE, NO CHECK.** While the user is at the screen: read the request clause by clause
(ambiguous: ask one short line first), code, esbuild, ONE look in the browser at the case they gave (their link), ship,
link. NO `tesseraCheck()`, no battles, fuzz, crawl or sweep, not even 20 s: every check not run goes in a "to check at the
next break" list, run when they leave. More than ~2 minutes: say so first, with its time. (2026-11-07: « tu es obstiné à me
faire glandouiller des demi-heures depuis des semaines pour faire 99 % de tests inutiles ».)

**NO RUSTINE, fix foundation only.** A fix that adds one more case to a list, a check or a reset by hand is a patch:
find the convention that let the bug happen and fix that, once (v0.4.384: a reset list by hand in `buildWalkOf`, one
field more, where each walk should start from one definition of its fields).

## Bundles
The user always makes the app's single-file versions with the script `_Make Tessera.html.command` in the folder
`Tessera resources` beside the repo (double-click). It runs `tools/bundle.py` twice and makes two HTML files there:
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

## Names
- Variables and functions named clearly, consistently and explicitly: what they hold or do, in words (`poleColours`,
  `shapeAndTiles`, not `pc`, `sat`), the same word for the same thing everywhere (one concept, one name).
- A name found unclear, misleading or inconsistent is renamed at its source, everywhere it is used (its comments, the
  tools' copies and the checks too), in its own commit, verified by `tesseraCheck()`; a name that would change a link's
  words (`w=`, `r=`…) is asked first.
- A new function or variable: its name grepped first (`grep -n "\bname\b" *.js tools/*.js`), never one already in use:
  a second `function` of the same name replaces the first with no word (`battleScore`, v0.4.247: a battle frozen at its
  first step); `checkNames` in `tesseraCheck()` catches a function declared twice.

## Tooltips
- One renderer, `tipOf` and its `mouseover` (main.js, by `updateHint`): the tooltip in the view's bottom right corner, the
  control's name in bold (a button's, a label's, a notch row's title: never written into its words), its words under it,
  its default on a grey line (`data-default`: "Plain by default"), why it is greyed (`data-greyed`).
- A `title` holds the words only; a default or a greyed state goes in its data attribute, never "· by default" in the text.
- Before adding or moving a tooltip, read that renderer and route through it; check what shows (the `#tip` box after a
  mouseover), not the attribute.

## Greyed controls
- A control that can be greyed declares one thing: `whyNot(setup)` (`tile`, `card`, `setTile`), '' where allowed, else
  its words why; `setup` is `{ w, size }` (a mode, at a size or the one it opens at: `pickedFigure`, `figureSize`), pure,
  never the DOM nor the walk shown. `setTile` draws from it its greyed state, its greyed words and its `enablers` (a click
  on it highlights the menu's nearest buttons allowing it, `enablersFor`: sizes, sides, tilings, shapes, spaces, each
  button's subtree `under`). Never a `can:` and a `greyed:` text by hand beside it: two sources that drift.
- A new menu button carries `under` (its modes, `modesUnder`), or the search cannot reach it.

## Sessions and branches
- One branch, `main`, the only one on GitHub; no branch for a prototype or an experiment (it falls behind as others
  push, and only a force push fixes it). A prototype is a folder of its own (`lenia/`, `particles/`, `chemistry/`,
  `liquid/`…), its own page, apart from main.js; one that joins the app moves into main.js in a session of its own.
- One session a piece of work, named as it, each in its own worktree (`.claude/worktrees/…`), never two in one folder:
  `tools/ship.sh` sets aside a folder's uncommitted changes while it rebases, another session's work in progress among
  them. Each ships to main by `tools/ship.sh`.
- A prototype or experiment given up keeps its row in `REMOVED.md` (its commit stays in main's history).

## Line balance
`python3 tools/lines.py [from] [to]` (from: HEAD; to: the files now, or a commit) gives each changed code file's lines
of code only (no comment, no blank line, see `tools/uncomment.py`): before, and +y or −y, nothing else: the « solde » of each
delivery, e.g. `python3 tools/lines.py HEAD~1 HEAD` after a commit.
Written with the version it brings first: « Solde v0.2.180 : main.js 12,143 +7 » (the app's files only, not tools/*).
No code line gained or lost: the count and +0 all the same (« main.js 12,531 +0 »), never a sentence instead; a file
touched shows (+0 if its code lines are as many).

## Versions
- `const VERSION = '0.4.N'` (main.js, line 40) is the only source; every commit's message ends with it, `(v0.4.N)`,
  written by `tools/ship.sh`; the assets' cache key in index.html (`?v=` on style.css and the scripts) is the same
  version, written by it too.
- Every commit ships by `tools/ship.sh "subject" "body"` (its changes staged first, `git add`): it puts the commit on
  origin/main, sets VERSION and the cache key to main's + 1, ends the subject with it and pushes, again from main if
  another session pushed first (any other refusal stops it, its error shown). Never edit VERSION, the cache key or
  write `(v…)` yourself: several sessions work side by side, and a number picked from one's own copy collides. Push
  only main (no branch left on GitHub: it falls behind, and only a force push fixes it).
- The last number goes up by 1 with every commit. The middle one only when the user decides, for a step they name
  (0.2: links that carry their version; 0.3: the name Tessera, Walking Pi before; 0.4: WebGPU, WebGL before); the last one then starts again at 0. 1.0 would mean links that keep working.
- Every link ends with `v=` and the version it was made with, kept in the Gallery and its JSON files (see `setupFrom`).
  A link that fails: `git log --grep "(v0.3.N)" -F`, its bundle in `Tessera resources`, or `tools/at.sh 0.3.N`, which
  serves that version on port 8322 beside this one.

## A choice's number in a link
- A choice among several (a tab group: Penetration's `pe=`, …) is written in a link by its place in the group, in the order
  shown: 0 the first, and the first the default (written in no link). Never a number kept from an older order, never a
  default set apart from the order: to change the default, change the order.
- Every night, check this for every choice the links write as a number: its tabs' order, its numbers, its default.

## Night audits
While the checks run unattended (a night, a meal), also audit what they cannot see, and fix each gap at its root:
- **The controls and their code alike**: each control's state held as it shows (one choice among several, one value, never
  boxes that combine into it, as Area's Fill and Light did); its default from `DISPLAY_DEFAULTS` (its value and its tile's
  mark both), a control's greyed state and tooltip true; the same component, name and title for the same thing in every
  tab (Walk, Ant, Life, 2D and 3D).
- **Every Custom rule**: Life's, each walk's, the ants', the turmite's, the worm's: valid and wrong rules, Enter, Escape,
  the link made, opened cold, the card it lands on.
- **Every night, clean transitions, no debris**: while a walk is computed the tab (`$('mode').value`) already shows the
  next mode and the walk shown (`walk`, `walk.mode`) is still the old one: grep every read of `$('mode').value` and check
  none is mixed with the walk shown (`walk.geo`, `walk.life`, `walk.plane`…): what describes the walk shown reads
  `walk.mode`, what sets up the next one reads the tab, a figure's colours read the mode of their own mesh; then the fuzz and
  the cold fuzz, switching tabs fast (before the walk is built), no error, nothing of the old walk left on screen.
- **Every night, the tooltips' redundancies**: each tooltip and card read as it shows (the `#tip` box after a mouseover):
  nothing said twice, its bold name never again in its words, not even spelt otherwise (a loop's Golly table
  `Langtons-Loops` under its name Langton's loops, v0.4.382), nor its default or greyed state in the text.
- **Every night, the names**: functions and variables read through for names unclear, misleading, too short or
  inconsistent (one concept, one name, see Names), each renamed explicitly at its source, everywhere, in its own commit.

## Removed features
A feature taken out gets a row in `REMOVED.md` (in English) at once: its last version, date, commit, a raw.githack link
that opens it as it was, and why it left.
- Its rows sorted by date, the oldest first (a row added later goes at its date, not at the end).
- Its link straight to the feature in a state that shows it: its mode, size, rule, colours, start, the switch that turns
  it on (`https://raw.githack.com/VincentBounce/Tessera/<commit>/index.html#w=…&s=…&r=…`), never the bare page; what a link
  could not hold then (a hunt zone, a colour mode), written after it as the click to make ("then Hunt › …").
- A feature that was only tried, on a branch never merged, gets its row too (its commit kept on GitHub even once its
  branch is gone), and one taken back at once (its last version the one that had it).

## Lenia prototype (lenia/)
A separate page (`lenia/index.html`, `lenia.js`, `species.js`), not part of main.js: Bert Chan's Lenia on the GPU (FFT),
eight life channels (two layers of four) and a wall texture; a species is a team on a block of 1 to 3 channels, its law moved there. `species.js` is made by `lenia/make_species.py` from Chan's repo
(Chakazul/Lenia, `Python/animals.json` and `found/*.json`), each pick tested for moving and standing walls;
`leniaCheck()` in its console: the FFT's round trip and an impulse, each species alive alone, a team the same on any channels.

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

## Artificial chemistry prototype (chemistry/)
A separate page (`chemistry/index.html`, `chemistry.js`), not part of main.js: Tim Hutton's Squirm3 (2002) on a torus
of hexagons, on the CPU: atoms of types a to f with a state and bonds, moving at random (a partner never further than
two cells), reacting with the six beside them by his eight rules (shown with how often each fired); the chain e8–a1–b1–
c1–f1 copies itself, and his rule 4's flaw makes shorter mutants that win. `chemistryCheck()` in its console: types,
bonds and cells kept right over 10,000 steps, and the chain copied.

## Liquid prototype (liquid/)
A separate page (`liquid/index.html`, `liquid.js`), not part of main.js, to join Tessera later: four liquids of different
weights in a box on WebGPU, Clavet, Beaudoin and Poulin's double density relaxation (2005, as in Grant Kot's Liquid
Layers) done at once for every particle (Jacobi): a pair's push by their densities' pressure against a rest density
(one for a liquid, a lower one for two: they part), shared by their masses (the heavy sink); the walls mirrors, gravity
the bottom's weight; drawn as metaballs. Tools Drag, Attract, Repel. A step in seven passes (moved, the particles binned
as in particles/, densities, pushes). `liquidCheck()` in its console: one GPU step against the CPU (every pair), and four
layers settled from a scatter, the heaviest at the bottom.

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
