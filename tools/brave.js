// A Brave of its own, driven from the terminal (no dependency: the DevTools protocol over Node's WebSocket): its own
// profile, hidden, its timers never slowed, so that checks and night searches run without the app's browser pane.
//   node tools/brave.js start              Brave started (port 9444: 9333 another session's Chrome), nothing shown
//   node tools/brave.js open <url>         a new tab at url: its number
//   node tools/brave.js tabs               its tabs: number, url
//   node tools/brave.js eval <tab> <js>    js run in that tab (await allowed): its value, as JSON
//   node tools/brave.js go <tab> <url>     that tab to url
//   node tools/brave.js shot <tab> <file>  that tab's picture, a PNG
//   node tools/brave.js stop               Brave closed
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const BRAVE = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  PORT = 9444,
  PROFILE = path.join(os.homedir(), 'Library/Caches/tessera-brave'),
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
  const t = (await pages())[tab];
  if (!t) throw new Error(`no tab ${tab}`);
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((ok, fail) => {
    ws.onopen = ok;
    ws.onerror = fail;
  });
  const answer = await new Promise((ok, fail) => {
    setTimeout(() => fail(new Error(`${method}: no answer in 10 minutes`)), 600e3); // (a search's eval may be long)
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
    spawn(BRAVE, [...FLAGS, 'about:blank'], { detached: true, stdio: 'ignore' }).unref();
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 200));
      try {
        await pages();
        return `started on port ${PORT}`;
      } catch {}
    }
    throw new Error('Brave did not start');
  },
  open: async (url) => {
    await fetch(`${HTTP}/json/new?${encodeURI(url)}`, { method: 'PUT' });
    return (await pages()).findIndex((t) => t.url === url || t.url.startsWith(url.split('#')[0]));
  },
  tabs: async () => (await pages()).map((t, i) => `${i} ${t.url}`).join('\n'),
  eval: async (tab, js) => {
    const r = await call(Number(tab), 'Runtime.evaluate', {
      expression: `(async () => (${js}))()`,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return JSON.stringify(r.result.value, null, 1);
  },
  go: async (tab, url) => {
    await call(Number(tab), 'Page.navigate', { url });
    return url;
  },
  shot: async (tab, file) => {
    const { data } = await call(Number(tab), 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
    return file;
  },
  stop: async () => {
    await call(0, 'Browser.close').catch(() => {});
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
    process.exit(0); // (Brave left running: its child)
  },
  (e) => {
    console.error(e.message);
    process.exit(1);
  },
);
