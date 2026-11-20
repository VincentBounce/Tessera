/* ==============================================================================================
 * TESSERA — debug.js
 * ==============================================================================================
 *
 * A panel to try settings by eye, over the view's top left corner, under its axes: numbers, each a slider, and colours to
 * pick from. Not a part of the app's menu: main.js calls it where a trial needs it (see cellsTuning), and debugPanel(null)
 * takes it away. Its numbers are an object's, changed in place; what they change is the caller's (its onChange).
 *   debugPanel({
 *     key, title,                             what it shows (the same key: the panel left as it is), its name
 *     numbers, shown, shared, signed,         an object of numbers, those named in shown (all if none) each a slider (0
 *     onNumbers,                              to 3 times its first value; those in signed as far below 0), those of them
 *                                             in shared apart under their own heading (numbers others read too), and
 *                                             what to do once one changed (the object's own values already set)
 *     colours, picked, onPick, note,          colours to pick from, the one picked, what a pick does (none: shown only),
 *                                             and a line under them
 *     onClose,                                its cross clicked (How it works' cross, see tutTools)
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
#debugPanel h4 { min-height: 32px; margin: 0 0 6px; padding-right: 40px; font-size: var(--text-size); } /* (as high as its cross) */
#debugPanel .tut-tools { top: 4px; right: 4px; } /* (its cross, How it works' own, in its corner) */
#debugPanel h5 { margin: 8px 0 4px; font-size: var(--label-text-size); color: var(--muted-text-color); }
#debugPanel label { display: grid; grid-template-columns: 78px 1fr 34px; align-items: center; gap: 6px; }
#debugPanel input[type='range'] { width: 100%; }
#debugPanel output { font-family: var(--mono-font); text-align: right; }
#debugPanel .debug-colours { display: flex; flex-wrap: wrap; gap: var(--tile-gap); margin-top: 8px; }
#debugPanel .debug-colours button {
  width: 20px; height: 20px; padding: 0; border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer;
}
#debugPanel .debug-colours button.picked { outline: 2px solid var(--accent-color); outline-offset: 1px; }
#debugPanel .debug-colours input { width: 24px; height: 22px; padding: 0; border: 0; background: none; }
#debugPanel p { margin: 6px 0 0; color: var(--muted-text-color); }
#debugPanel .debug-button { margin: 8px 6px 0 0; }
`;

/* ---- The panel ---------------------------------------------------------------------------------- */
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
  } else if (panel.dataset.key === spec.key) return; // (shown already: its sliders and picks as they are)
  panel.dataset.key = spec.key;
  const {
    title,
    numbers,
    shown = Object.keys(numbers),
    shared = [],
    signed = [],
    onNumbers,
    onClose,
    colours = [],
    picked,
    onPick,
    note,
  } = spec;
  if (!debugFirst.has(numbers)) debugFirst.set(numbers, { ...numbers });
  const first = debugFirst.get(numbers);
  panel.replaceChildren();
  const head = document.createElement('h4');
  head.textContent = title;
  panel.append(head);
  if (onClose) panel.append(tutTools({ close: onClose })); // (main.js's)
  // a slider a number: its value set at once, the caller told once the drag pauses (a 3D view made again is slow)
  let wait = 0;
  const changed = () => {
    clearTimeout(wait);
    wait = setTimeout(onNumbers, 150);
  };
  const own = shown.filter((name) => !shared.includes(name)),
    others = shown.filter((name) => shared.includes(name));
  for (const name of [...own, ...others]) {
    if (name === others[0]) {
      const heading = document.createElement('h5'); // (these change the others too)
      heading.textContent = 'Every mode';
      panel.append(heading);
    }
    const row = document.createElement('label'),
      words = document.createElement('span'),
      slider = document.createElement('input'),
      value = document.createElement('output');
    words.textContent = name;
    const reach = Math.max(signed.includes(name) ? 3 : 1, 3 * Math.abs(first[name])); // (a signed one from 0 at first: ±3)
    Object.assign(slider, {
      type: 'range',
      min: signed.includes(name) ? -reach : 0,
      max: reach,
      step: 0.01,
      value: numbers[name],
    });
    slider.title = `${name}: from ${slider.min} to ${slider.max}, ${first[name]} at first`;
    value.textContent = numbers[name].toFixed(2);
    slider.addEventListener('input', () => {
      numbers[name] = Number(slider.value);
      value.textContent = numbers[name].toFixed(2);
      changed();
    });
    row.append(words, slider, value);
    panel.append(row);
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
    panel.dataset.key = '';
    debugPanel(spec);
  });
  button('Copy', 'The numbers shown and the colour picked, copied as JSON', () =>
    navigator.clipboard.writeText(
      JSON.stringify({
        [title]: { ...Object.fromEntries(shown.map((name) => [name, numbers[name]])), colour: pickedNow },
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
}
