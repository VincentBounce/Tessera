// A browser of its own, driven from the terminal (no dependency: the DevTools protocol over Node's WebSocket): Chrome for
// Testing (Playwright's, an app apart: a hidden Brave or Chrome took over the user's own, its Dock icon opening nothing), its
// own profile, hidden, its timers never slowed, so that checks and night searches run without the app's browser pane.
//   node tools/browser.js start              started (port 9444: 9333 another session's Chrome), nothing shown
//   node tools/browser.js open <url>         a new tab at url: its id (a tab: its id or its id's start, never a number:
//   node tools/browser.js tabs               its tabs: id, url              listed by their last use)
//   node tools/browser.js eval <tab> <js>    js run in that tab (await allowed): its value, as JSON (10 minutes at most,
//                                            else BROWSER_TIMEOUT's)
//   node tools/browser.js go <tab> <url>     that tab to url
//   node tools/browser.js click <tab> <x> <y> a click there, as a hand's (its events trusted)
//   node tools/browser.js shot <tab> <file>  that tab's picture, a PNG
//   node tools/browser.js profile <tab> <url> <seconds> [file]  that tab to url, its CPU profile for so many seconds: the
//                                            functions by their own time, the 30 longest (file: the profile, as Chrome's)
//   node tools/browser.js coverage <tab> <url> <js> [file]  that tab to url, then js run (a check, the night's clickAll),
//                                            V8's precise coverage on all along: main.js's functions never run, outermost
//                                            only, by size (file: every one and its blocks never run, as JSON)
//   node tools/browser.js stop               closed
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const BROWSER = path.join(
    os.homedir(),
    'Library/Caches/ms-playwright/chromium-1254/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  ),
  PORT = Number(process.env.BROWSER_PORT ?? 9444), // (another, BROWSER_PORT=9445: a browser of its own, its own profile, beside a session's)
  PROFILE = path.join(os.homedir(), `Library/Caches/tessera-browser${PORT === 9444 ? '' : `-${PORT}`}`),
  HTTP = `http://127.0.0.1:${PORT}`;
// (hidden: a window, WebGPU's, never drawn on the screen; its timers and drawing at full speed while hidden)
const FLAGS = [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`,
  '--headless=new',
  '--enable-unsafe-webgpu',
  '--enable-features=Vulkan',
  '--use-angle=metal',
  '--window-size=1600,1000',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--no-first-run',
  '--no-default-browser-check',
];

const pages = async () => (await (await fetch(`${HTTP}/json/list`)).json()).filter((t) => t.type === 'page');

// a session of the protocol on a tab, kept open while its calls need it (a profile, a coverage: they last as long as it):
// send(method, params) its answer, close() when done
async function session(tab) {
  const t = (await pages()).find((p) => p.id.startsWith(tab));
  if (!t) throw new Error(`no tab ${tab}`);
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((ok, fail) => {
    ws.onopen = ok;
    ws.onerror = fail;
  });
  let id = 0;
  const waiting = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    waiting.get(m.id)?.(m);
  };
  const minutes = Number(process.env.BROWSER_TIMEOUT ?? 10); // (a search's eval may be long: BROWSER_TIMEOUT=60, an hour)
  const send = (method, params = {}) =>
    new Promise((ok, fail) => {
      setTimeout(() => fail(new Error(`${method}: no answer in ${minutes} minutes`)), minutes * 60e3);
      waiting.set(++id, (m) => (m.error ? fail(new Error(m.error.message)) : ok(m.result)));
      ws.send(JSON.stringify({ id, method, params }));
    });
  return { send, close: () => ws.close() };
}
// one call of the protocol on a tab (its session opened for it, closed after)
async function call(tab, method, params = {}) {
  const { send, close } = await session(tab);
  try {
    return await send(method, params);
  } finally {
    close();
  }
}
// js run in a session: its value
async function evaluate(send, js) {
  const r = await send('Runtime.evaluate', {
    expression: `(async () => (${js}))()`,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
}

const commands = {
  start: async () => {
    try {
      await pages();
      return 'already running';
    } catch {}
    spawn(BROWSER, [...FLAGS, 'about:blank'], { detached: true, stdio: 'ignore' }).unref();
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 200));
      try {
        await pages();
        return `started on port ${PORT}`;
      } catch {}
    }
    throw new Error('the browser did not start');
  },
  open: async (url) => {
    return (await (await fetch(`${HTTP}/json/new?${encodeURI(url)}`, { method: 'PUT' })).json()).id;
  },
  tabs: async () => (await pages()).map((t) => `${t.id.slice(0, 8)} ${t.url}`).join('\n'),
  eval: async (tab, js) => {
    const { send, close } = await session(tab);
    try {
      return JSON.stringify(await evaluate(send, js), null, 1);
    } finally {
      close();
    }
  },
  go: async (tab, url) => {
    await call(tab, 'Page.navigate', { url });
    await call(tab, 'Page.reload', { ignoreCache: true }); // (its scripts as they are now: their cache key, the version, changes only when shipped)
    return url;
  },
  click: async (tab, x, y) => {
    for (const type of ['mousePressed', 'mouseReleased'])
      await call(tab, 'Input.dispatchMouseEvent', { type, x: Number(x), y: Number(y), button: 'left', clickCount: 1 });
    return `clicked ${x},${y}`;
  }, // (a click as a hand's: its events trusted, see the page's handChanged)
  shot: async (tab, file) => {
    const { data } = await call(tab, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
    return file;
  },
  profile: async (tab, url, seconds = 10, file = '') => {
    const { send, close } = await session(tab); // (one session for it all: a profile lasts while it does)
    await send('Profiler.enable');
    await send('Profiler.setSamplingInterval', { interval: 200 });
    await send('Profiler.start');
    await send('Page.navigate', { url });
    await new Promise((r) => setTimeout(r, Number(seconds) * 1000));
    const { profile } = await send('Profiler.stop');
    close();
    if (file) fs.writeFileSync(file, JSON.stringify(profile));
    // (each sample's time to its function, its own: the sampled node's)
    const byId = new Map(profile.nodes.map((n) => [n.id, n])),
      own = new Map();
    profile.samples.forEach((s, i) => {
      const f = byId.get(s).callFrame,
        key = `${f.functionName || '(anonymous)'} ${f.url.split('/').pop().split('?')[0]}:${f.lineNumber + 1}`;
      own.set(key, (own.get(key) ?? 0) + (profile.timeDeltas[i + 1] ?? 0) / 1000);
    });
    const total = [...own.values()].reduce((a, b) => a + b, 0);
    return [
      `${Math.round(total)} ms sampled`,
      ...[...own]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30)
        .map(([k, ms]) => `${String(Math.round(ms)).padStart(6)} ms  ${k}`),
    ].join('\n');
  },
  coverage: async (tab, url, js, file = '') => {
    const { send, close } = await session(tab); // (one session for it all: a coverage lasts while it does)
    await send('Profiler.enable');
    await send('Runtime.enable');
    await send('Profiler.startPreciseCoverage', { callCount: true, detailed: true }); // (before the page: its load counted too)
    await send('Network.enable');
    await send('Network.setCacheDisabled', { cacheDisabled: true }); // (its scripts as they are now, as go's reload)
    await send('Page.navigate', { url });
    await new Promise((r) => setTimeout(r, 8000)); // (opened, its first walk built)
    const value = await evaluate(send, js);
    const { result } = await send('Profiler.takePreciseCoverage');
    close();
    const script = result.find((s) => /\/main\.js(\?|$)/.test(s.url));
    if (!script) throw new Error('main.js not covered');
    const source = await (await fetch(script.url)).text(),
      lineOf = (offset) => source.slice(0, offset).split('\n').length;
    // each function's first range its whole body (its count: its calls); the others its blocks never run (count 0)
    const never = script.functions
        .filter((f) => f.ranges[0].count === 0 && f.functionName !== '')
        .map((f) => ({ name: f.functionName, start: f.ranges[0].startOffset, end: f.ranges[0].endOffset }))
        .sort((a, b) => a.start - b.start)
        .filter((f, i, all) => !all.some((g) => g !== f && g.start <= f.start && f.end <= g.end)), // (outermost only: one inside it never ran either)
      blocks = script.functions
        .filter((f) => f.ranges[0].count > 0)
        .flatMap((f) =>
          f.ranges
            .slice(1)
            .filter((r) => r.count === 0)
            .map((r) => ({ in: f.functionName, ...r })),
        );
    const at = (r) => ({
      ...r,
      line: lineOf(r.start ?? r.startOffset),
      lines: lineOf(r.end ?? r.endOffset) - lineOf(r.start ?? r.startOffset) + 1,
    });
    if (file) fs.writeFileSync(file, JSON.stringify({ value, never: never.map(at), blocks: blocks.map(at) }, null, 1));
    return [
      `${never.length} functions never run, ${blocks.length} blocks never run in functions that ran (js: ${JSON.stringify(value)?.slice(0, 200)})`,
      ...never
        .map(at)
        .sort((a, b) => b.lines - a.lines)
        .slice(0, 60)
        .map((f) => `${String(f.lines).padStart(5)} lines  main.js:${f.line} ${f.name}`),
    ].join('\n');
  },
  stop: async () => {
    await call('', 'Browser.close').catch(() => {});
    return 'stopped';
  },
};

const [name, ...args] = process.argv.slice(2);
if (!commands[name]) {
  console.log(fs.readFileSync(__filename, 'utf8').match(/^(\/\/.*\n)+/)[0]); // (its usage: the comment it opens with)
  process.exit(1);
}
commands[name](...args).then(
  (out) => {
    console.log(out);
    process.exit(0); // (the browser left running: its child)
  },
  (e) => {
    console.error(e.message);
    process.exit(1);
  },
);
