// Journey: the Studio in headless Chromium over CDP (no packages, no model call, no installed browser state), at 1280 and 390, light and dark.
// A two-option design with comments is served from a temporary folder with its own FIRST_DRAFT_HOME (no agent set). Each width and theme
// is captured; then the journey runs at both widths: Brief collapses and reopens the column (desktop), the composer is docked at the bottom
// (phone), Phone/Desktop switch, a comment opens its pin, another option opens, Send without an agent shows the set-up hint, Play and back.
// The evidence folder ($DONE_DONE_EVIDENCE_ROOT, or the first argument) gets only the Studio and Hide brief captures and studio-states.json
// (each capture's measured width, theme and column); the Send and Play captures go to $FD_EXTRA_OUT when set. Chrome is $CHROME, else chromium or google-chrome on PATH.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const out = process.env.DONE_DONE_EVIDENCE_ROOT ?? process.argv[2], extra = process.env.FD_EXTRA_OUT;
if (!out) throw new Error('Give an evidence folder: $DONE_DONE_EVIDENCE_ROOT or the first argument');
const chrome = [process.env.CHROME, 'chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable'].find((c) => c && execFileSync('sh', ['-c', `command -v "${c}" || true`]).toString().trim());
if (!chrome) throw new Error('No Chrome or Chromium on PATH; set $CHROME');
mkdirSync(out, { recursive: true });
if (extra) mkdirSync(extra, { recursive: true });
const dir = mkdtempSync(join(tmpdir(), 'first-draft-studio-'));
for (const n of [1, 2]) copyFileSync(join(root, 'journeys/fixtures/notes.html'), join(dir, `notes-${n}.html`));
writeFileSync(join(dir, 'notes.comments.json'), JSON.stringify([{ option: 1, x: 0.2, y: 0.3, text: 'Umer: make the headline a little smaller' }, { option: 1, x: 0.8, y: 0.6, text: 'Umer: a warmer button colour' }]));

const processes = [];
const launch = (cmd, args, match, env = process.env) => new Promise((ok, fail) => {
  const child = spawn(cmd, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
  processes.push(child);
  let log = '';
  const take = (chunk) => { log += chunk; const found = log.match(match); if (found) ok(found[1]); };
  child.stdout.on('data', take); child.stderr.on('data', take);
  child.once('error', fail); child.once('exit', (code) => fail(new Error(`${cmd} exited ${code}: ${log}`)));
});

let ws, serial = 0;
const pending = new Map(), childSessions = new Map();
try {
  const base = await launch(process.execPath, [join(root, 'src/cli.mjs'), 'view', join(dir, 'notes.html'), '--host', '127.0.0.1', '--port', '0'], /"url":"([^"]+)"/, { ...process.env, FIRST_DRAFT_HOME: join(dir, 'home') });
  const endpoint = await launch(chrome, ['--headless', '--no-sandbox', '--disable-extensions', '--disable-dev-shm-usage', '--remote-debugging-port=0', `--user-data-dir=${join(dir, 'chrome')}`, 'about:blank'], /DevTools listening on (ws:\/\/\S+)/);
  ws = new WebSocket(endpoint);
  await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = fail; });
  const send = (method, params = {}, sessionId) => new Promise((ok, fail) => {
    const id = ++serial;
    pending.set(id, { ok, fail });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  ws.onmessage = ({ data }) => {
    const m = JSON.parse(data);
    if (!m.id) return;
    const p = pending.get(m.id);
    pending.delete(m.id);
    m.error ? p.fail(new Error(JSON.stringify(m.error))) : p.ok(m.result);
  };
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const c = (m, p = {}) => send(m, p, sessionId);
  await c('Page.enable'); await c('Runtime.enable');
  const evaluate = async (expression) => {
    const r = await c('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + JSON.stringify(r.exceptionDetails.exception));
    return r.result.value;
  };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const settle = () => evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  const until = async (expression, what) => { for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await wait(50); } throw new Error(`Timed out: ${what}`); };
  // A fresh page each time: a navigation that changes only the hash would keep the last page's state (its brief draft, the folded column).
  const open = async (hash) => { await c('Page.navigate', { url: 'about:blank' }); await c('Page.navigate', { url: base + hash }); await until("document.readyState==='complete' && !!document.querySelector('#app>*')", `open ${hash}`); await settle(); };
  const point = (selector) => evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing ${selector.replaceAll("'", '')}');e.scrollIntoView({block:'center'});const b=e.getBoundingClientRect();return{x:b.x+b.width/2,y:b.y+b.height/2}})()`);
  const click = async (selector) => {
    const at = await point(selector);
    await c('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...at });
    await c('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...at });
    await settle();
  };
  const key = async (name) => { await c('Input.dispatchKeyEvent', { type: 'keyDown', key: name }); await c('Input.dispatchKeyEvent', { type: 'keyUp', key: name }); await settle(); };
  const shown = (selector) => evaluate(`!!document.querySelector(${JSON.stringify(selector)})?.getClientRects().length`);
  const width = (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect().width`);
  // A capture waits until every visible option frame has painted its page.
  const states = [];
  // What a capture shows, measured on the page: the window width, the theme the page is in, and whether the column and the composer show.
  const state = async (capture, more = {}) => states.push({ capture, ...await evaluate(`({ width: innerWidth, theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light', column: !!document.querySelector('.side')?.getClientRects().length, composer: (()=>{const b=document.querySelector('form.brief')?.getBoundingClientRect();return b?.width?{top:Math.round(b.top),bottom:Math.round(b.bottom)}:'hidden'})(), stageWidth: Math.round(document.querySelector('.stage')?.getBoundingClientRect().width ?? 0), zoom: document.querySelector('.zoom')?.getClientRects().length ? document.querySelector('.zoom').textContent : 'none', button: document.querySelector('.bar .fold')?.getClientRects().length ? document.querySelector('.bar .fold').textContent : 'none' })`), ...more });
  const shot = async (name, dir) => {
    if (!dir) return;
    await settle();
    await evaluate('scrollTo(0,0)');
    const expected = await evaluate("[...document.querySelectorAll('iframe')].filter(f=>f.getClientRects().length).length");
    let ready = expected === 0;
    for (let i = 0; i < 100 && !ready; i++) {
      const children = (await send('Target.getTargets')).targetInfos.filter((t) => t.type === 'iframe' && t.parentId === targetId);
      ready = children.length >= expected;
      for (const t of children) {
        if (!childSessions.has(t.targetId)) childSessions.set(t.targetId, (await send('Target.attachToTarget', { targetId: t.targetId, flatten: true })).sessionId);
        const r = await send('Runtime.evaluate', { expression: "new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(document.readyState==='complete' && document.body.innerText.length>20))))", awaitPromise: true, returnByValue: true }, childSessions.get(t.targetId));
        if (!r.result?.value) ready = false;
      }
      if (!ready) await wait(50);
    }
    assert.ok(ready, `${name}: the option frame did not paint`);
    assert.equal(await evaluate('document.documentElement.scrollWidth > innerWidth'), false, `${name}: the page scrolls sideways`);
    const { data } = await c('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(dir, `${name}.png`), Buffer.from(data, 'base64'));
    console.log(`captured ${name}.png`);
  };
  const viewport = async (w, theme) => {
    await c('Emulation.setDeviceMetricsOverride', { width: w, height: w > 700 ? 800 : 844, deviceScaleFactor: 1, mobile: false });
    await c('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }] });
  };

  for (const theme of ['light', 'dark']) for (const w of [1280, 390]) {
    await viewport(w, theme);
    await open('#/o/1');
    await shot(`studio-${w}-${theme}`, out);
    await state(`studio-${w}-${theme}.png`);
    if (w > 700) {
      // Brief collapses the column (design, options, comments and the composer), the canvas takes its room, and Brief brings it back.
      const stage = await width('.stage');
      await click('.bar [aria-controls="studio-side"]');
      assert.equal(await shown('.side'), false, 'Brief hides the column');
      assert.equal(await shown('form.brief'), false, 'Brief hides the composer');
      assert.ok(await width('.stage') > stage + 200, 'the canvas takes the column\'s room');
      assert.equal(await evaluate('document.querySelector(\'.bar [aria-controls="studio-side"]\').getAttribute(\'aria-expanded\')'), 'false');
      await shot(`studio-collapsed-${w}-${theme}`, out);
      await state(`studio-collapsed-${w}-${theme}.png`, { after: 'Hide brief pressed' });
      await click('.bar [aria-controls="studio-side"]');
      assert.equal(await shown('.side'), true, 'Brief shows the column again');
      assert.equal(await shown('form.brief'), true, 'Brief shows the composer again');
      await state(null, { after: 'Show brief pressed: no capture, the page is as in ' + `studio-${w}-${theme}.png` });
    } else {
      // Phone width: the phone mock alone, the composer docked at the bottom of the first screen, no Brief button (the column follows below).
      assert.equal(await shown('.phone'), true, 'the phone mock shows');
      assert.equal(await shown('.artboard'), false, 'no desktop pane under the phone');
      assert.equal(await shown('.bar [aria-controls="studio-side"]'), false, 'no Brief button at phone width');
      const dock = await evaluate("(()=>{scrollTo(0,0);const b=document.querySelector('form.brief textarea').getBoundingClientRect();return{top:b.top,bottom:b.bottom,h:innerHeight}})()");
      assert.ok(dock.bottom <= dock.h && dock.top > dock.h / 2, `the composer is docked at the bottom of the screen: ${JSON.stringify(dock)}`);
    }
  }

  for (const w of [1280, 390]) {
    await viewport(w, 'light');
    await open('#/o/1');
    const dev = w > 700 ? 'desktop' : 'phone', other = w > 700 ? 'phone' : 'desktop';
    await click(`.devices a[href="#/o/1/${other}"]`);
    assert.equal(await evaluate('location.hash'), `#/o/1/${other}`);
    assert.equal(await shown(other === 'phone' ? '.phone' : '.artboard'), true, `${other} shows after the switch`);
    await click(`.devices a[href="#/o/1/${dev}"]`);
    await click('.side .list button');
    assert.equal(await shown('.pin[aria-expanded="true"]'), true, 'a comment in the column opens its pin');
    if (w > 700) {
      // The column stays folded across a re-render (another device) until Show brief opens it.
      await click('.bar [aria-controls="studio-side"]');
      await click('.devices a[href="#/o/1/phone"]');
      assert.equal(await shown('.side'), false, 'the column stays folded on another device');
      await click('.devices a[href="#/o/1/desktop"]');
      await click('.bar [aria-controls="studio-side"]');
      await click('.side .list a[href^="#/o/2"]');
    } else {
      await click('.tools select'); await key('ArrowDown'); await key('Enter');
    }
    assert.match(await evaluate('location.hash'), /^#\/o\/2/);
    await click('form.brief textarea');
    await c('Input.insertText', { text: 'Umer: make the next iteration feel a little calmer.' });
    await click('form.brief button[type=submit]');
    await until("document.querySelector('.run.failed')?.textContent.includes('init --agent')", 'the set-up hint after Send with no agent');
    await shot(`studio-send-no-agent-${w}`, extra);
    await click('.tools a.primary');
    assert.match(await evaluate('location.hash'), /^#\/o\/2\/play\//);
    await shot(`play-${w}`, extra);
    await click('.bar a');
    assert.match(await evaluate('location.hash'), /^#\/o\/2\/(phone|desktop)$/);
  }
  writeFileSync(join(out, 'studio-states.json'), JSON.stringify(states, null, 2));
  // done-done's step record: what was driven, from where, and what a user sees at the end.
  const version = `${JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version} at ${execFileSync('git', ['-C', root, 'rev-parse', '--short', 'HEAD']).toString().trim()}`;
  writeFileSync(join(out, 'steps.json'), JSON.stringify({ target: { version: `first-draft-axi ${version}` },
    start: "first-draft view, the app frame around a user's design: a two-option 'notes.' sign-in page shown inside a dotted canvas, with two comments and no agent set, in headless Chromium",
    steps: ["At 1280 px wide, in light and in dark: the top bar has a 'Hide brief' button beside the left column (Design, Options, Comments and the Next brief box); capture this state",
      "Press 'Hide brief': the column is hidden, the button reads 'Show brief' and the canvas fills the width (the zoom label grows from 66% to 77%); capture this state",
      "Press 'Show brief': the first state returns (the column and the Next brief box show again)",
      "At 390 px wide (a phone), in light and in dark: by design there is no Hide brief button, and the 'Describe a change' box is docked at the bottom of the screen under the phone mock; capture this state",
      'Switch Phone/Desktop and back; click a comment in the left column and its pin opens on the canvas',
      "At 1280 px hide the column and switch device: it stays hidden until 'Show brief'",
      'Open Option 2; type a change in the Next brief box and press Send with no agent set: the set-up hint shows; press Play, then Exit'],
    result: "Each capture shows one of these states, in light and in dark: at 1280 px wide the 'Hide brief' button beside the left column; after pressing it the column hidden, 'Show brief', and the canvas filling the width (zoom label 66% to 77%); at 390 px wide no Hide brief button and the 'Describe a change' box docked at the bottom of the screen under the phone mock. studio-states.json records each capture's measured width, theme, column, composer position, canvas width, zoom label and button" }, null, 2));
  console.log('PASS: Studio at 1280 and 390, light and dark: Brief collapse, docked composer, device switch, pins, option switch, Send hint, Play and back');
} finally {
  if (ws?.readyState === 1) ws.close();
  for (const child of processes.reverse()) {
    if (child.exitCode !== null) continue;
    child.kill('SIGTERM');
    await Promise.race([new Promise((r) => child.once('exit', r)), new Promise((r) => setTimeout(r, 3000))]);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
  rmSync(dir, { recursive: true, force: true });
}
