# Tessera

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

## Line balance
`python3 tools/lines.py [from] [to]` (from: HEAD; to: the files now, or a commit) gives each changed code file's lines
of code only (no comment, no blank line, see `tools/uncomment.py`): before, and +y or −y, nothing else: the « solde » of each
delivery, e.g. `python3 tools/lines.py HEAD~1 HEAD` after a commit.
Written with the version it brings first: « Solde v0.2.180 : main.js 12,143 +7 » (the app's files only, not tools/*).
No code line gained or lost: the count and +0 all the same (« main.js 12,531 +0 »), never a sentence instead; a file
touched shows (+0 if its code lines are as many).

## Versions
- `const VERSION = '0.3.N'` (main.js, line 40) is the only source; every commit's message ends with it, `(v0.3.N)`.
- The last number goes up by 1 with every commit. The middle one only when the user decides, for a step they name
  (0.2: links that carry their version; 0.3: the name Tessera, Walking Pi before); the last one then starts again at 0. 1.0 would mean links that keep working.
- Every link ends with `v=` and the version it was made with, kept in Treasures and their JSON files (see `setupFrom`).
  A link that fails: `git log --grep "(v0.3.N)" -F`, its bundle in `Tessera resources`, or `tools/at.sh 0.3.N`, which
  serves that version on port 8322 beside this one.

## Removed features
A feature taken out gets a row in `REMOVED.md` (in English) at once: its last version, date, commit, a raw.githack link
that opens it as it was, and why it left.

## Lenia prototype (lenia/)
A separate page (`lenia/index.html`, `lenia.js`, `species.js`), not part of main.js: Bert Chan's Lenia on the GPU (FFT),
eight life channels (two layers of four) and a wall texture; a species is a team on a block of 1 to 3 channels, its law moved there. `species.js` is made by `lenia/make_species.py` from Chan's repo
(Chakazul/Lenia, `Python/animals.json` and `found/*.json`), each pick tested for moving and standing walls;
`leniaCheck()` in its console: the FFT's round trip and an impulse, each species alive alone, a team the same on any channels.

## Particle Life prototype (particles/)
A separate page (`particles/index.html`, `particles.js`), not part of main.js: Particle Life (Tom Mohr's) on the GPU,
particles of 3 to 8 kinds on a torus or a sphere (of area 1, the same crowd), each kind drawn to or pushed from each
other kind by a K × K rule matrix (clicked to change), every pair felt (a fragment shader a particle; one geometry
function a space: the way and distance, along the surface on the sphere); the link keeps space, kinds, count, seed and
changed rules. `particlesCheck('both')` in its console: one GPU step against the same step on the CPU, each space.

## Artificial chemistry prototype (chemistry/)
A separate page (`chemistry/index.html`, `chemistry.js`), not part of main.js: Tim Hutton's Squirm3 (2002) on a torus
of hexagons, on the CPU: atoms of types a to f with a state and bonds, moving at random (a partner never further than
two cells), reacting with the six beside them by his eight rules (shown with how often each fired); the chain e8–a1–b1–
c1–f1 copies itself, and his rule 4's flaw makes shorter mutants that win. `chemistryCheck()` in its console: types,
bonds and cells kept right over 10,000 steps, and the chain copied.
