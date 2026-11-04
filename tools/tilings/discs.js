// A grid in a disc by its name (a flower, a ring, a Mirror, a Hexa, the grids that never repeat: the hats, Penrose's,
// the spectres, Ammann's, Rhombs 12 and 14, the pinwheel): its patch of W² tiles, once
// (see centred-worker.js, grow-worker.js)
import { ROSETTES } from './rosette.js';
import { PINWHEEL } from './pinwheel.js';
import { HOUSES } from './houses.js';
import { HEXAS } from './hexas.js';
import { AMMANN, RHOMBS12, RHOMBS14 } from './ammann.js';
import { PENROSE } from './penrose.js';
import { SPECTRE } from './spectre.js';
import { HAT } from '../kitesearch/hat.js';
const NEVER = { hat: HAT, penrose: PENROSE, spectre: SPECTRE, ammann: AMMANN, rhombs12: RHOMBS12, rhombs14: RHOMBS14, pinwheel: PINWHEEL };
const patches = {};
export const patchOf = (kind, W) => patches[`${kind}|${W}`] ??= (NEVER[kind] ? NEVER[kind](W) : kind.startsWith('mirror') ? HOUSES(Number(kind.slice(6)))(W) : kind.startsWith('hexa') ? HEXAS(Number(kind.slice(4)))(W) : ROSETTES[kind][1](W));
