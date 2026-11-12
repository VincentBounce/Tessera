// Famous and Anywhere starts written by their patterns (v0.4.924: pop=famous.Glider:3.Diehard), no longer by a seed
// (pop=famous.30.8): an old link converted, run in the page (it uses the app's own functions):
//   await import(`/tools/famous-convert.js?${Date.now()}`);
//   await famousLinkNow('#w=life2d&k=2&s=96&pop=famous.30.8');   // the link as it is now: its patterns
//   await famousGalleryNow();                                     // the Gallery's (this browser's) converted in place
// Each old link opened, its grid built, its seed played as the draw did then (seededRandom, a colour's choice after the
// other, see drawChoice), its patterns written; a link of another start given back as it was.

const OLD_FAMOUS = /(?:^|&)pop=(famous|anywhere)\.(\d+)\.(\d+)(?=&|$)/;

// a link opened and built: through a walk first (another mode: built again, never the grid before read), then its mode's game
const openBuilt = async (hash) => {
  const built = async (w, life) => {
    for (let t = 0; t < 300 && (waits.size || walk.mode !== w || !walk.life !== !life); t++)
      await new Promise((ok) => setTimeout(ok, 100));
    await new Promise((ok) => setTimeout(ok, 300));
  };
  location.hash = '#x=pi&w=turtle';
  await built('turtle', false);
  location.hash = hash;
  await built(new URLSearchParams(hash.slice(1)).get('w'), true);
};

window.famousLinkNow = async (hash) => {
  const m = hash.match(OLD_FAMOUS);
  if (!m) return hash;
  await openBuilt(hash);
  if (!famousZone(hunt.zone)) return `#${toHash(getSetup())}`; // (no pattern here: a soup laid instead, as then)
  const choices = patternChoices(hunt.zone === 'centred'),
    next = seededRandom(Number(m[3])),
    random = () => next() / 4294967296,
    pick = choices.map((list) => drawChoice(list, random)),
    seed = new Uint8Array(walk.life.seed.length);
  pick.forEach((c, i) => {
    const f = choices[i][c] ?? [];
    for (let q = 0; q < f.length; q += 2) seed[f[q]] = f[q + 1];
  });
  seed.pick = pick;
  setLifeSeed(seed, { zone: hunt.zone });
  return `#${toHash(getSetup())}`;
};

window.famousGalleryNow = async () => {
  const list = readGallery(),
    changed = [];
  for (const x of list) {
    const was = `#${toHash(x.setup)}`;
    if (!OLD_FAMOUS.test(was)) continue;
    const now = await famousLinkNow(was);
    x.setup = getSetup(); // (the setup now in view: the old one, its patterns written)
    changed.push([x.name, was, now]);
  }
  writeGallery(list);
  fillGalleryList();
  return changed;
};
