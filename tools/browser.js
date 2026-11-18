// A browser of its own, driven from the terminal (no dependency: the DevTools protocol over Node's WebSocket): Chrome for
// Testing (Playwright's, an app apart: a hidden Brave or Chrome took over the user's own, its Dock icon opening nothing), its
// own profile, hidden, its timers never slowed, so that checks and night searches run without the app's browser pane.
//   node tools/browser.js start              started (port 9444: 9333 another session's Chrome), nothing shown
//   node tools/browser.js open <url>         a new tab at url: its id (a tab: its id or its id's start, never a number:
//   node tools/browser.js tabs               its tabs: id, url              listed by their last use)
//   node tools/browser.js eval <tab> <js>    js run in that tab (await allowed): its value, as JSON (10 minutes at most,
//                                            else BROWSER_TIMEOUT's)
//   node tools/browser.js go <tab> <url>     that tab to url
//   node tools/browser.js shot <tab> <file>  that tab's picture, a PNG
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

// one call of the protocol on a tab (its WebSocket opened for it, closed after)
async function call(tab, method, params = {}) {
  const t = (await pages()).find((p) => p.id.startsWith(tab));
  if (!t) throw new Error(`no tab ${tab}`);
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((ok, fail) => {
    ws.onopen = ok;
    ws.onerror = fail;
  });
  const answer = await new Promise((ok, fail) => {
    const minutes = Number(process.env.BROWSER_TIMEOUT ?? 10); // (a search's eval may be long: BROWSER_TIMEOUT=60, an hour)
    setTimeout(() => fail(new Error(`${method}: no answer in ${minutes} minutes`)), minutes * 60e3);
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id === 1) ok(m);
    };
    ws.send(JSON.stringify({ id: 1, method, params }));
  });
  ws.close();
  if (answer.error) throw new Error(answer.error.message);
  return answer.result;
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
    const r = await call(tab, 'Runtime.evaluate', {
      expression: `(async () => (${js}))()`,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return JSON.stringify(r.result.value, null, 1);
  },
  go: async (tab, url) => {
    await call(tab, 'Page.navigate', { url });
    await call(tab, 'Page.reload', { ignoreCache: true }); // (its scripts as they are now: their cache key, the version, changes only when shipped)
    return url;
  },
  shot: async (tab, file) => {
    const { data } = await call(tab, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
    return file;
  },
  stop: async () => {
    await call('', 'Browser.close').catch(() => {});
    return 'stopped';
  },
};

const [name, ...args] = process.argv.slice(2);
if (!commands[name]) {
  console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(0, 9).join('\n'));
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
