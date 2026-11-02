import { run } from './core.js';
self.onmessage = ({ data }) => self.postMessage({ id: data.id, out: run(data.p, data.N, data.T, data.cells) });
