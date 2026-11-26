/* ==============================================================================================
 * TESSERA — debug.js
 * ==============================================================================================
 *
 * A panel to try settings by eye, over the view's top left corner, under its axes: numbers, each a slider, and colours to
 * pick from. Not a part of the app's menu: main.js calls it where a trial needs it (see cellsTuning), and debugPanel(null)
 * takes it away. Its numbers are an object's, changed in place; what they change is the caller's (its onChange).
 * Below it, Display › Cells' modes on trial (LED+, Tube, Debug), tried in it alone: see Cells on trial.
 *   debugPanel({
 *     key, title,                             what it shows (the same key: the panel left as it is), its name
 *     tabs,                                   the caller's tabs over its title (main.js's textTabs: Cells, Line)
 *     numbers, shown, shared, signed,         an object of numbers, those named in shown (all if none) each a slider (0
 *     firsts, onNumbers,                      to 3 times its first value, firsts' if given (a mode's default), else as it
 *                                             came first; those in signed as far below 0), those of them
 *                                             in shared apart under their own heading (numbers others read too), and
 *                                             what to do once one changed (the object's own values already set)
 *     colours, picked, onPick, note,          colours to pick from, the one picked, what a pick does (none: shown only),
 *                                             and a line under them
 *     more,                                   another object's numbers under them, past a line ({ title, numbers,
 *                                             onNumbers }: a figure's sizes), copied and reset with the others
 *     onClose,                                its cross clicked (How it works' cross, see tutTools)
 *     controls,                               the caller's own controls under its title (a switch: main.js's tile)
 *     showsDrawer,                            the code drawing what it tunes (drawnBy below), a greyed tab under its title
 *   })
 */

/* ---- Its look ---------------------------------------------------------------------------------- */
const DEBUG_STYLE = `
#debugPanel {
  position: absolute;
  left: calc(var(--view-left) + var(--view-gap));
  top: var(--view-gap);
  z-index: 5;
  width: 240px;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--box-background);
  color: var(--text-color);
  font-size: var(--label-text-size);
}
#debugPanel .text-tabs { margin: 0 40px 6px 0; } /* (beside its cross) */
#debugPanel h4 { min-height: 32px; margin: 0 0 6px; padding-right: 40px; font-size: var(--text-size); } /* (as high as its cross) */
#debugPanel .tut-tools { top: 4px; right: 4px; } /* (its cross, How it works' own, in its corner) */
#debugPanel h5 { margin: 8px 0 4px; font-size: var(--label-text-size); color: var(--muted-text-color); }
#debugPanel label { display: grid; grid-template-columns: 78px 1fr 34px; align-items: center; gap: 6px; }
#debugPanel input[type='range'] { width: 100%; }
#debugPanel output { font-family: var(--mono-font); text-align: right; }
#debugPanel .debug-colours { display: flex; flex-wrap: wrap; gap: var(--short-gap); margin-top: 8px; }
#debugPanel .debug-colours button {
  width: 20px; height: 20px; padding: 0; border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer;
}
#debugPanel .debug-colours button.picked { outline: 2px solid var(--accent-color); outline-offset: 1px; }
#debugPanel .debug-colours input { width: 24px; height: 22px; padding: 0; border: 0; background: none; }
#debugPanel p { margin: 6px 0 0; color: var(--muted-text-color); }
#debugPanel .debug-button { margin: 8px 6px 0 0; }
#debugPanel hr { margin: 10px 0 0; border: 0; border-top: 1px solid var(--border-color); }
`;

/* ---- The panel ---------------------------------------------------------------------------------- */
// the function that drew the view last, its Cells mode with it, each writing its name as it draws (main.js's gpuPlane,
// gpuSurface, gpuLatticeWalk)
let drawnBy = '';
const debugFirst = new WeakMap(); // (each numbers object's values as it came first: its sliders' ranges, Reset's values)
function debugPanel(spec) {
  let panel = document.getElementById('debugPanel');
  if (!spec) {
    panel?.remove();
    return;
  }
  if (!document.getElementById('debugStyle')) {
    const style = document.createElement('style');
    style.id = 'debugStyle';
    style.textContent = DEBUG_STYLE;
    document.head.append(style);
  }
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'debugPanel';
    keepsItsPresses(panel); // (a slider dragged moves it, never the view: main.js's)
    document.getElementById('stage').append(panel);
  } else if (panel.dataset.key === `${spec.key}|${spec.showsDrawer && drawnBy}`) return; // (shown already: its sliders and picks as they are)
  panel.dataset.key = `${spec.key}|${spec.showsDrawer && drawnBy}`;
  const {
    tabs,
    title,
    numbers,
    shown = Object.keys(numbers),
    shared = [],
    signed = [],
    firsts,
    onNumbers,
    onClose,
    colours = [],
    picked,
    onPick,
    note,
    more,
    controls = [],
    showsDrawer,
  } = spec;
  const firstOf = (o) => (debugFirst.has(o) ? debugFirst.get(o) : debugFirst.set(o, { ...o }).get(o)),
    first = firsts ?? firstOf(numbers);
  panel.replaceChildren();
  if (tabs) panel.append(tabs);
  const head = document.createElement('h4');
  head.textContent = title;
  panel.append(head);
  if (onClose) panel.append(tutTools({ close: onClose })); // (main.js's)
  if (showsDrawer && drawnBy) {
    // (shown only: greyed, its words why in its tooltip)
    const by = document.createElement('button');
    by.type = 'button';
    by.textContent = drawnBy;
    by.title = 'The code drawing it here';
    by.disabled = true;
    by.dataset.greyed = 'Shown only: the function that drew the view last';
    panel.append(textTabs([by])); // (main.js's)
  }
  panel.append(...controls);
  // a slider a number of an object: its value set at once, the caller told once the drag pauses (a 3D view made again is slow)
  let wait = 0;
  const slider = (name, of = numbers, then = onNumbers) => {
    const row = document.createElement('label'),
      words = document.createElement('span'),
      input = document.createElement('input'),
      value = document.createElement('output'),
      at = (of === numbers ? first : firstOf(of))[name],
      reach = Math.max(signed.includes(name) ? 3 : 1, 3 * Math.abs(at)); // (a signed one from 0 at first: ±3)
    words.textContent = name;
    Object.assign(input, {
      type: 'range',
      min: signed.includes(name) ? -reach : 0,
      max: reach,
      step: 0.01,
      value: of[name],
    });
    input.title = `${name}: from ${input.min} to ${input.max}, ${at} at first`;
    value.textContent = of[name].toFixed(2);
    input.addEventListener('input', () => {
      of[name] = Number(input.value);
      value.textContent = of[name].toFixed(2);
      clearTimeout(wait);
      wait = setTimeout(then, 150);
    });
    row.append(words, input, value);
    panel.append(row);
  };
  const own = shown.filter((name) => !shared.includes(name)),
    others = shown.filter((name) => shared.includes(name));
  for (const name of [...own, ...others]) {
    if (name === others[0]) {
      const heading = document.createElement('h5'); // (these change the others too)
      heading.textContent = 'Every mode';
      panel.append(heading);
    }
    slider(name);
  }
  let pickedNow = picked; // (the colour picked, as Copy copies it)
  // its buttons under the sliders, a word each
  const button = (words, title, click) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'debug-button';
    b.textContent = words;
    b.title = title;
    b.addEventListener('click', click);
    panel.append(b);
  };
  button('Reset', 'Every number back to its first value', () => {
    Object.assign(numbers, first);
    onNumbers();
    if (more) {
      Object.assign(more.numbers, firstOf(more.numbers));
      more.onNumbers();
    }
    panel.dataset.key = '';
    debugPanel(spec);
  });
  button('Copy', 'The numbers shown and the colour picked, copied as JSON', () =>
    navigator.clipboard.writeText(
      JSON.stringify({
        [title]: { ...Object.fromEntries(shown.map((name) => [name, numbers[name]])), colour: pickedNow },
        ...(more && { [more.title]: { ...more.numbers } }),
      }),
    ),
  );
  if (colours.length) {
    const row = document.createElement('div');
    row.className = 'debug-colours';
    for (const c of colours) {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.style.background = c;
      swatch.title = c;
      if (c === picked) swatch.className = 'picked';
      if (onPick)
        swatch.addEventListener('click', () => {
          row.querySelector('.picked')?.classList.remove('picked');
          swatch.className = 'picked';
          pickedNow = c;
          onPick(c);
        });
      else {
        swatch.disabled = true;
        swatch.dataset.greyed = 'Shown only: in a battle, the teams’ colours';
      }
      row.append(swatch);
    }
    if (onPick) {
      const any = document.createElement('input'); // (any colour)
      any.type = 'color';
      any.title = 'Any colour';
      any.addEventListener('input', () => {
        pickedNow = any.value;
        onPick(any.value);
      });
      row.append(any);
    }
    panel.append(row);
  }
  if (note) {
    const line = document.createElement('p');
    line.textContent = note;
    panel.append(line);
  }
  if (more) {
    const heading = document.createElement('h5');
    heading.textContent = more.title;
    panel.append(document.createElement('hr'), heading);
    for (const name of Object.keys(more.numbers)) slider(name, more.numbers, more.onNumbers);
  }
}

/* ---- Cells on trial ---------------------------------------------------------------------------- */
// Display › Cells' modes tried in the panel's Cells (main.js's cellsTuning), out of the menu: their names and words (main.js's
// CELLS_FINISHES ends with them), their numbers (its CELLS_LIGHT's, and in Solo on a light page in 3D, its
// CELLS_LIGHT_SOLO_3D's) and their lamps (its LAMPS', see there: ledLight, vec3Of main.js's)
const CELLS_TRIED = [
  [
    'LED+',
    'Each tile painted a frosted slab lit from under it: brightest over its middle, dark at its joint, the sky still glinting on it, its light spilling a little round it',
  ],
  ['Tube', 'Each tile painted a neon tube along its edge, its middle dark, its light spilling far round it'],
  ['Debug', 'Each tile painted a lamp, every number of its light to try in the debug panel'],
];
const CELLS_TRIED_LIGHT = {
  tubePeak: 1.6, // (Tube: its light, strongest at tubeAt)
  tubeAt: 0.14, // (its tube's middle, its share of the way from its edge to its middle)
  tubeWidth: 0.07, // (its tube's width, the same share)
  tubeFloor: 0.06, // (its light off the tube: its middle, and between its edge and its tube)
  ledPlusEdge: 0.35, // (LED+: its light at its edge)
  ledPlusMiddle: 0.9, // (and added over its middle, where its lamp is)
  ledPlusJoint: 0.12, // (its dark joint, its share of the way from its edge to its middle)
  ledPlusGloss: 0.6, // (the sky's glint on it, its grey)
  debugEdge: 0.85, // (Debug: its light at its edge)
  debugMiddle: 0, // (and added in its middle: below 0, dark there, LED inside out)
  debugSpot: 1, // (its middle's width: wider the higher)
  debugWhite: 0, // (its light turned white where strongest, its share: a white core)
  debugFrame: 0, // (its frame, its share of the way from its edge to its middle: none)
  debugFrameLight: 0, // (the frame's light)
  debugFrameFade: 0.7, // (where its frame starts fading into its light, its share of the frame)
  debugGloss: 0, // (the sky's glint on it, its grey)
  debugAngle: 0, // (its light weaker seen aslant, its share)
  debugCeiling: 1, // (the tiles none painted, darkened: none)
  debugColour: null, // (its light's colour; none: its ink's)
  debugCast: false, // (its halo cast on the tiles round it, else added)
  debugReach: 2, // (its halo's blurs, 1 to 4: wider)
  tubeHalo: 1.6,
  ledPlusHalo: 0.8,
  debugHalo: 1.6,
};
const CELLS_TRIED_SOLO_3D = {
  debugEdge: 1,
  debugCeiling: 0.67,
  debugColour: '#fff68f',
  debugCast: true,
  debugReach: 3,
  debugHalo: 0.84,
};
const LAMPS_TRIED = {
  'LED+': {
    light: (L) =>
      `return col * (${L.ledPlusEdge} + ${L.ledPlusMiddle} * l * l) * smoothstep(0.0, ${L.ledPlusJoint}, w);`, // (a slab over its lamp: brightest over it, dark at its joint)
    gloss: (L) => L.ledPlusGloss, // (the sky glinting on its slab)
    halo: (L) => ({ share: L.ledPlusHalo, steps: [1] }),
  },
  Tube: {
    light: (L) =>
      `let t = (w - ${L.tubeAt}) / ${Math.max(L.tubeWidth, 0.01)}; return col * (${L.tubeFloor} + ${L.tubePeak} * exp(-t * t));`,
    halo: (L) => ({ share: L.tubeHalo, steps: [1, 2, 4, 8] }),
  },
  Debug: {
    // (every number of a lamp: its middle, a white core, a frame, weaker aslant; its light debugColour's, if any; debugMiddle
    // below 0: never a light below none)
    light: (L) => `let peak = pow(l, 2.0 / ${Math.max(L.debugSpot, 0.05)});
    let lit = mix(${L.debugColour ? vec3Of(L.debugColour) : 'col'}, vec3f(1.0), ${L.debugWhite} * peak) * (${L.debugEdge} + ${L.debugMiddle} * peak);
    let framed = lit * mix(${L.debugFrameLight}, 1.0, smoothstep(${L.debugFrame} * ${L.debugFrameFade}, ${Math.max(L.debugFrame, 1e-4)}, w));
    return max(framed * mix(1.0, max(dot(n, u.V), 0.0), ${L.debugAngle}), vec3f(0.0));`,
    gloss: (L) => L.debugGloss,
    ceiling: (L) => L.debugCeiling,
    halo: (L) => ({
      share: L.debugHalo,
      steps: [1, 2, 4, 8].slice(0, Math.min(4, Math.max(1, Math.round(L.debugReach)))),
      cast: L.debugCast,
    }),
  },
};
