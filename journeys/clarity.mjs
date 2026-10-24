// Nonpaid recapture of two retained real runs of one landing brief, made without (FD_CLARITY_BEFORE) and with (FD_CLARITY_AFTER) the
// clarity rubric and checks; no model call. Run through done-done. The page of each is run through the product's own clarity checks
// (src/clarity.mjs through src/render-check.mjs; the after page must pass them all, the before page's findings are recorded), then drawn
// whole, in headless Chromium over CDP, at phone 360, 390 and 445 and desktop 1280 and 1440, light and dark: before-<width>-<theme>.png and
// after-<width>-<theme>.png. FD_CLARITY_EXAMPLE (the saved example of a clear page) joins them on a board per theme at 390 and 1280
// (board-<width>-<theme>.png: example, before, after). The evidence folder ($DONE_DONE_EVIDENCE_ROOT) also gets clarity-checks.json and steps.json.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { findBrowser, renderCheck } from '../src/render-check.mjs';

const root = new URL('..', import.meta.url).pathname, out = process.env.DONE_DONE_EVIDENCE_ROOT;
const [before, after] = [process.env.FD_CLARITY_BEFORE, process.env.FD_CLARITY_AFTER].map((p) => p && resolve(p));
if (!out || !before || !after) throw Error('Set FD_CLARITY_BEFORE and FD_CLARITY_AFTER to the two retained pages (the --out path of each make); run through done-done');
for (const p of [before, after]) assert.ok(existsSync(p), `${p} is not there`);
const example = process.env.FD_CLARITY_EXAMPLE && resolve(process.env.FD_CLARITY_EXAMPLE);
const chrome = findBrowser();
if (!chrome) throw Error('No Chrome or Chromium on this machine');
mkdirSync(out, { recursive: true });
const dir = mkdtempSync(join(tmpdir(), 'first-draft-clarity-'));

// The product's own checks, on each page.
const findings = {};
for (const [name, file] of [['before', before], ['after', after]]) {
  const render = renderCheck(() => {}, { clarity: { flash: false } });
  try { findings[name] = (await render.verify(readFileSync(file, 'utf8'))).filter((e) => e.source === 'clarity').map((e) => e.message); } finally { render.close(); }
}
writeFileSync(join(out, 'clarity-checks.json'), JSON.stringify({ before: { page: before, findings: findings.before }, after: { page: after, findings: findings.after } }, null, 2));
assert.deepEqual(findings.after, [], 'the after page passes every clarity check');
console.log(`clarity checks: before ${findings.before.length} finding(s), after 0`);

let child, ws, serial = 0;
const pending = new Map();
try {
  child = spawn(chrome, ['--headless=new', '--no-sandbox', '--disable-extensions', '--disable-dev-shm-usage', '--hide-scrollbars', '--remote-debugging-port=0', `--user-data-dir=${join(dir, 'chrome')}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const endpoint = await new Promise((ok, no) => { let log = ''; child.stderr.on('data', (b) => { log += b; const m = log.match(/DevTools listening on (ws:\/\/\S+)/); if (m) ok(m[1]); }); child.once('exit', (c) => no(Error(`chrome exited ${c}: ${log}`))); });
  ws = new WebSocket(endpoint);
  await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
  ws.onmessage = ({ data }) => { const m = JSON.parse(data), p = m.id && pending.get(m.id); if (!p) return; pending.delete(m.id); m.error ? p.no(Error(JSON.stringify(m.error))) : p.ok(m.result); };
  const send = (method, params = {}, sessionId) => new Promise((ok, no) => { const id = ++serial; pending.set(id, { ok, no }); ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const c = (m, p = {}) => send(m, p, sessionId);
  const evaluate = async (expression) => {
    const r = await c('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw Error(r.exceptionDetails.text + JSON.stringify(r.exceptionDetails.exception));
    return r.result.value;
  };
  // The whole page at this width: opened, drawn, and captured to its full height.
  const capture = async (url, name, width, theme) => {
    await c('Emulation.setDeviceMetricsOverride', { width, height: width >= 1280 ? 800 : 844, deviceScaleFactor: 1, mobile: false });
    await c('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }] });
    await c('Page.navigate', { url: 'about:blank' });
    await c('Page.navigate', { url });
    for (const end = Date.now() + 20000; !(await evaluate("document.readyState==='complete'")); ) { if (Date.now() > end) throw Error(`${url} never finished loading`); await new Promise((r) => setTimeout(r, 100)); }
    await evaluate("Promise.all([...document.images].map((i) => i.decode().catch(() => {}))).then(() => document.fonts.ready).then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))");
    const { scrollWidth, scrollHeight } = await evaluate('({scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight})');
    assert.ok(scrollWidth <= width, `${name}: the page is ${scrollWidth}px wide at ${width}`);
    const { data } = await c('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: scrollHeight, scale: 1 } });
    writeFileSync(join(out, name), Buffer.from(data, 'base64'));
    console.log(`captured ${name} (${width}x${scrollHeight})`);
    return scrollHeight;
  };
  const heights = [];
  const exampleName = example && `example${extname(example)}`;
  if (example) copyFileSync(example, join(out, exampleName));
  for (const theme of ['light', 'dark']) for (const width of [360, 390, 445, 1280, 1440]) {
    const row = { width, theme };
    for (const [name, file] of [['before', before], ['after', after]]) row[name] = await capture(pathToFileURL(file).href, `${name}-${width}-${theme}.png`, width, theme);
    heights.push(row);
  }
  if (example) for (const theme of ['light', 'dark']) for (const width of [390, 1280]) {
    const board = join(dir, `board-${width}-${theme}.html`), cell = (title, src) => `<figure><figcaption>${title}</figcaption><img src="${pathToFileURL(join(out, src)).href}"></figure>`;
    writeFileSync(board, `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;padding:24px;background:${theme === 'dark' ? '#1b1a18' : '#e9e6e0'};color:${theme === 'dark' ? '#eee' : '#222'};font:16px system-ui,sans-serif}.row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;align-items:start}figure{margin:0}figcaption{font-weight:600;margin:0 0 8px}img{display:block;width:100%;height:auto;border:1px solid #8884}</style></head><body><div class="row">${cell('The saved example of a clear page', exampleName)}${cell(`Before: the same brief without the rubric (${width} px, ${theme})`, `before-${width}-${theme}.png`)}${cell(`After: with the rubric and checks (${width} px, ${theme})`, `after-${width}-${theme}.png`)}</div></body></html>`);
    await capture(pathToFileURL(board).href, `board-${width}-${theme}.png`, width === 390 ? 1500 : 2000, theme);
  }
  writeFileSync(join(out, 'frame-heights.json'), JSON.stringify(heights, null, 2));
  const head = execFileSync('git', ['-C', root, 'rev-parse', '--short', 'HEAD']).toString().trim();
  writeFileSync(join(out, 'steps.json'), JSON.stringify({ target: { version: `first-draft-axi at ${head}` },
    start: 'Two retained real runs of one brief (a landing page for a small accounting software company for teams) on one subscription model: the before page made on main, the after page made on this checkout; no model call during this run.',
    steps: ['Run the product\'s own clarity checks (the eight host checks of the clarity-over-flash skill, through the render check at 390x844 and 1280x800, light and dark) on each page (clarity-checks.json).',
      'Open each page in headless Chromium at phone 360, 390 and 445 and desktop 1280 and 1440 px, in light and in dark, and capture it whole (before-<width>-<theme>.png, after-<width>-<theme>.png).',
      ...(example ? ['Lay the saved example of a clear page beside the before and after frames at 390 and 1280, light and dark (board-<width>-<theme>.png).'] : [])],
    result: `The after page passes all eight host checks (the before page has ${findings.before.length} finding(s)); both are drawn whole at 360, 390, 445, 1280 and 1440 px in light and dark with no sideways scroll.` }, null, 2));
  console.log(`PASS: after page passes the clarity checks (before: ${findings.before.length} finding(s)); frames at 360/390/445/1280/1440, light and dark`);
} finally {
  if (ws?.readyState === 1) ws.close();
  if (child && child.exitCode === null) { child.kill('SIGTERM'); await Promise.race([new Promise((r) => child.once('exit', r)), new Promise((r) => setTimeout(r, 3000))]); if (child.exitCode === null) child.kill('SIGKILL'); }
  rmSync(dir, { recursive: true, force: true });
}
