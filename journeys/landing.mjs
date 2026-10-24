// Journey: the landing page (docs/index.html, served by GitHub Pages) in headless Chromium over CDP, at 1280 and 390, light and dark.
// Each width and theme: the page's own fonts load (Instrument Sans, Instrument Serif), every image loads and shows its theme's variant
// (light or -dark), nothing scrolls sideways, the footer names package.json's version, and the Get started link lands on the steps. The
// evidence folder ($DONE_DONE_EVIDENCE_ROOT, or the first argument) gets landing-<width>-<theme>.png (the first screen) and landing-<width>-<theme>-full.png (the whole page), and
// steps.json. Chrome is $CHROME, else chromium or google-chrome on PATH.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = new URL('..', import.meta.url).pathname;
const out = process.env.DONE_DONE_EVIDENCE_ROOT ?? process.argv[2];
if (!out) throw new Error('Give an evidence folder: $DONE_DONE_EVIDENCE_ROOT or the first argument');
const chrome = [process.env.CHROME, 'chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable'].find((c) => c && execFileSync('sh', ['-c', `command -v "${c}" || true`]).toString().trim());
if (!chrome) throw new Error('No Chrome or Chromium on PATH; set $CHROME');
mkdirSync(out, { recursive: true });
const dir = mkdtempSync(join(tmpdir(), 'first-draft-landing-'));
const page = pathToFileURL(join(root, 'docs/index.html')).href;

let child, ws, serial = 0;
const pending = new Map();
try {
  child = spawn(chrome, ['--headless', '--no-sandbox', '--disable-extensions', '--disable-dev-shm-usage', '--hide-scrollbars', '--remote-debugging-port=0', `--user-data-dir=${join(dir, 'chrome')}`, 'about:blank'], { stdio: ['ignore', 'pipe', 'pipe'] });
  const endpoint = await new Promise((ok, fail) => {
    let log = '';
    const take = (chunk) => { log += chunk; const m = log.match(/DevTools listening on (ws:\/\/\S+)/); if (m) ok(m[1]); };
    child.stdout.on('data', take); child.stderr.on('data', take);
    child.once('exit', (code) => fail(new Error(`${chrome} exited ${code}: ${log}`)));
  });
  ws = new WebSocket(endpoint);
  await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = fail; });
  ws.onmessage = ({ data }) => { const m = JSON.parse(data); const p = m.id && pending.get(m.id); if (!p) return; pending.delete(m.id); m.error ? p.fail(new Error(JSON.stringify(m.error))) : p.ok(m.result); };
  const send = (method, params = {}, sessionId) => new Promise((ok, fail) => { const id = ++serial; pending.set(id, { ok, fail }); ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const c = (m, p = {}) => send(m, p, sessionId);
  const evaluate = async (expression) => {
    const r = await c('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + JSON.stringify(r.exceptionDetails.exception));
    return r.result.value;
  };
  const capture = async (name, full) => {
    const params = { format: 'png' };
    if (full) { const h = await evaluate('document.documentElement.scrollHeight'), w = await evaluate('innerWidth'); Object.assign(params, { captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: h, scale: 1 } }); }
    const { data } = await c('Page.captureScreenshot', params);
    writeFileSync(join(out, `${name}.png`), Buffer.from(data, 'base64'));
    console.log(`captured ${name}.png`);
  };
  // The footer names package.json's version, stamped by the build and the Pages deploy (scripts/landing-version.mjs).
  const released = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
  const seen = [];
  for (const theme of ['light', 'dark']) for (const w of [1280, 390]) {
    await c('Emulation.setDeviceMetricsOverride', { width: w, height: w > 700 ? 800 : 844, deviceScaleFactor: 1, mobile: false });
    await c('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }] });
    await c('Page.navigate', { url: 'about:blank' });
    await c('Page.navigate', { url: page });
    // Every image now, not when scrolled to, then the fonts.
    const state = await evaluate(`new Promise(r=>{const go=async()=>{document.querySelectorAll('img[loading=lazy]').forEach(i=>{i.loading='eager'});
      await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));await document.fonts.ready;
      r({imgs:[...document.images].map(i=>({src:i.currentSrc.split('/').pop(),ok:i.complete&&i.naturalWidth>0})),
        ui:document.fonts.check('16px "Instrument Sans"'),display:getComputedStyle(document.querySelector('h1')).fontFamily,
        displayLoaded:document.fonts.check('40px "Instrument Serif"'),wide:document.documentElement.scrollWidth>innerWidth});};
      document.readyState==='complete'?go():addEventListener('load',go)})`);
    assert.ok(state.imgs.every((i) => i.ok), `${w} ${theme}: an image did not load: ${JSON.stringify(state.imgs)}`);
    const media = state.imgs.filter((i) => i.src.endsWith('.webp'));
    assert.ok(media.every((i) => i.src.endsWith('-dark.webp') === (theme === 'dark')), `${w} ${theme}: each screenshot shows the ${theme} variant: ${JSON.stringify(media)}`);
    assert.ok(state.ui && state.displayLoaded && /Instrument Serif/.test(state.display), `${w} ${theme}: the page's fonts load: ${JSON.stringify(state)}`);
    assert.equal(state.wide, false, `${w} ${theme}: the page scrolls sideways`);
    assert.equal(await evaluate("document.querySelector('footer .version').textContent"), released, `${w} ${theme}: the footer names the version`);
    await capture(`landing-${w}-${theme}`);
    await capture(`landing-${w}-${theme}-full`, true);
    await evaluate("document.querySelector('a[href=\"#start\"]').click()");
    assert.ok(await evaluate("Math.abs(document.getElementById('start').getBoundingClientRect().top) < 40"), `${w} ${theme}: Get started lands on the steps`);
    seen.push({ width: w, theme, screenshots: media.map((i) => i.src) });
  }
  writeFileSync(join(out, 'landing-states.json'), JSON.stringify(seen, null, 2));
  const version = `${JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version} at ${execFileSync('git', ['-C', root, 'rev-parse', '--short', 'HEAD']).toString().trim()}`;
  writeFileSync(join(out, 'steps.json'), JSON.stringify({ target: { version: `first-draft landing page (docs/index.html) in first-draft-axi ${version}` },
    start: 'The first-draft landing page, docs/index.html as GitHub Pages serves it, opened from the file in headless Chromium',
    steps: ['At 1280 and 390 px wide, in light and in dark, open the landing page: its fonts (Instrument Sans, Instrument Serif) and every image load, any screenshot shows its light or dark variant to match, and nothing scrolls sideways',
      'Capture the first screen (landing-<width>-<theme>.png) and the whole page (landing-<width>-<theme>-full.png)',
      "Click 'Get started': the page moves to the three steps",
      "The footer names the released version from package.json ('first-draft <version>'), seen at the foot of each whole-page capture"],
    result: "The landing page opens with the serif headline 'Explore designs. Then build.', the install command, then How it works (make, compare, refine, each as a terminal), the three steps, the open-at-every-width facts and the sign-off and agent cards, and a footer naming the version, in light and dark at 1280 and 390 (landing-*.png)" }, null, 2));
  console.log('PASS: landing page at 1280 and 390, light and dark: fonts, images in the matching theme, no sideways scroll, the footer version, Get started');
} finally {
  if (ws?.readyState === 1) ws.close();
  if (child && child.exitCode === null) { child.kill('SIGTERM'); await new Promise((r) => { child.once('exit', r); setTimeout(r, 3000); }); }
  rmSync(dir, { recursive: true, force: true });
}
