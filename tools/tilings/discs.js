// A grid in a disc by its name (a flower, a ring, a Mirror, a Hexa, the pinwheel, Rhombs 14): its patch of W² tiles, once
// (see centred-worker.js, grow-worker.js)
import { ROSETTES } from './rosette.js';
import { PINWHEEL } from './pinwheel.js';
import { HOUSES } from './houses.js';
import { HEXAS } from './hexas.js';
import { RHOMBS14 } from './ammann.js';
const patches = {};
export const patchOf = (kind, W) => patches[`${kind}|${W}`] ??= (kind === 'pinwheel' ? PINWHEEL(W) : kind.startsWith('mirror') ? HOUSES(Number(kind.slice(6)))(W) : kind.startsWith('hexa') ? HEXAS(Number(kind.slice(4)))(W) : kind === 'rhombs14' ? RHOMBS14(W) : ROSETTES[kind][1](W));
