// Journey: the Studio in headless Chromium over CDP (no packages, no model call, no installed browser state), at 1280 and 390, light and dark.
// A two-option design with comments is served from a temporary folder with its own FIRST_DRAFT_HOME (no agent set): the notes fixture,
// or the HTML files of a real run's folder named by $FD_STUDIO_SOURCE (copied, never changed). Each width and theme is captured whole
// (studio-<width>-<theme>.png); then the journey runs at both widths: every kind of button shows a press state, each device fills the
// canvas at the largest scale that fits, the desktop and the phone show side by side at one scale (desktop), a comment added by tapping
// a point on the phone is saved to the comments file and shows as a pin clear of the frames, Hide brief collapses and reopens the panel
// (desktop), the composer is docked at the bottom one line high with the whole phone above it, the bar is the option switcher with
// Play and More above the device switch, Fullscreen is in the More menu (phone), Phone/Desktop switch, a comment opens its pin, the
// option switcher opens another option, Send without an agent shows the set-up hint, Fullscreen (phone, from More), Play and back.
// The evidence folder ($DONE_DONE_EVIDENCE_ROOT, or the first argument) gets one capture per claim and theme: canvas-both-1280.png (the
// desktop and the phone side by side, light and dark), add-comment-1280-<theme>.png (the comment box at the tapped point, then the saved
// pin), hide-brief-1280-<theme>.png (the 1280 Studio before and after Hide brief, side by side); at 390, add-comment-390.png (the same, light
// and dark), light and dark side by side in each: phone-row-390.png (the control
// row and the whole phone above the one-line brief), more-menu-390.png (More open), press-play-390.png (Play at rest and held) and
// composer-390.png (the brief at rest and tapped); and studio-states.json (each state's measured width, theme and column). The single
// captures (each width and theme, Send, Play, More, the tapped brief) go to $FD_EXTRA_OUT when set. Chrome is $CHROME, else chromium or google-chrome on PATH.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const out = process.env.DONE_DONE_EVIDENCE_ROOT ?? process.argv[2], extra = process.env.FD_EXTRA_OUT;
if (!out) throw new Error('Give an evidence folder: $DONE_DONE_EVIDENCE_ROOT or the first argument');
const chrome = [process.env.CHROME, 'chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable'].find((c) => c && execFileSync('sh', ['-c', `command -v "${c}" || true`]).toString().trim());
if (!chrome) throw new Error('No Chrome or Chromium on PATH; set $CHROME');
mkdirSync(out, { recursive: true });
if (extra) mkdirSync(extra, { recursive: true });
const dir = mkdtempSync(join(tmpdir(), 'first-draft-studio-'));
const source = process.env.FD_STUDIO_SOURCE;
const name = source ? basename(resolve(source)) : 'notes';
let design = join(dir, 'notes.html');
if (source) {
  const files = readdirSync(source).filter((f) => /\.html?$/i.test(f)).sort();
  if (files.length < 2) throw new Error(`${source} holds ${files.length} HTML option(s); the journey needs two`);
  design = join(dir, name);
  mkdirSync(design);
  for (const f of files.slice(0, 2)) copyFileSync(join(source, f), join(design, f));
} else for (const n of [1, 2]) copyFileSync(join(root, 'journeys/fixtures/notes.html'), join(dir, `notes-${n}.html`));
const commentsFile = join(dir, `${name}.comments.json`), seed = JSON.stringify([{ option: 1, x: 0.2, y: 0.3, text: 'Umer: make the headline a little smaller' }, { option: 1, x: 0.8, y: 0.6, text: 'Umer: a warmer button colour' }]);
writeFileSync(commentsFile, seed);

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
  const base = await launch(process.execPath, [join(root, 'src/cli.mjs'), 'view', design, '--host', '127.0.0.1', '--port', '0'], /"url":"([^"]+)"/, { ...process.env, FIRST_DRAFT_HOME: join(dir, 'home') });
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
  const until = async (expression, what, ms = 5000) => { for (const end = Date.now() + ms; Date.now() < end;) { if (await evaluate(expression)) return; await wait(50); } throw new Error(`Timed out after ${ms / 1000}s: ${what}`); };
  // A fresh page each time: a navigation that changes only the hash would keep the last page's state (its brief draft, the folded column).
  const open = async (hash) => { await c('Page.navigate', { url: 'about:blank' }); await c('Page.navigate', { url: base + hash }); await until("document.readyState==='complete' && !!document.querySelector('#app>*')", `open ${hash}`); await settle(); };
  const point = (selector) => evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing ${selector.replaceAll("'", '')}');e.scrollIntoView({block:'center'});const b=e.getBoundingClientRect();return{x:b.x+b.width/2,y:b.y+b.height/2}})()`);
  const click = async (selector) => {
    const at = await point(selector);
    await c('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...at });
    await c('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...at });
    await settle();
  };
  const key = async (name) => {
    const code = { Escape: 27 }[name]; // Escape needs its key code to reach the browser's own handling (a popover's light dismiss)
    await c('Input.dispatchKeyEvent', { type: 'keyDown', key: name, windowsVirtualKeyCode: code }); await c('Input.dispatchKeyEvent', { type: 'keyUp', key: name, windowsVirtualKeyCode: code }); await settle();
  };
  const shown = (selector) => evaluate(`!!document.querySelector(${JSON.stringify(selector)})?.getClientRects().length`);
  // A press state: the element's look changes while the mouse is held on it. The release happens off the element, so nothing is clicked.
  const press = async (selector, keep) => {
    const look = `(()=>{const s=getComputedStyle(document.querySelector(${JSON.stringify(selector)}));return[s.backgroundColor,s.color,s.translate,s.scale].join('|')})()`;
    const at = await point(selector), rest = await evaluate(look);
    await c('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...at });
    const held = await evaluate(look);
    const capture = keep && await shot(keep, extra);
    await c('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1 });
    await c('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, x: 1, y: 1 });
    await evaluate('document.activeElement?.blur()'); // a press focuses the button; leave the page as it was
    assert.notEqual(held, rest, `${selector} shows no press state`);
    return capture; // the page while it was held, when `keep` names it
  };
  const box = (selector) => evaluate(`(()=>{const b=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{top:b.top,bottom:b.bottom,height:b.height,left:b.left,right:b.right,width:b.width}})()`);
  // No pin covers a frame's screen: each sits in the margin beside it, level with its point.
  const pinsClear = () => evaluate("(()=>{const hit=(a,b)=>a.left<b.right-1&&b.left<a.right-1&&a.top<b.bottom-1&&b.top<a.bottom-1;const screens=[...document.querySelectorAll('.artboard,.phone-screen')].map(e=>e.getBoundingClientRect());return [...document.querySelectorAll('.pin')].filter(p=>p.getClientRects().length).every(p=>screens.every(s=>!hit(p.getBoundingClientRect(),s)))})()");
  // Fit to space: what the canvas shows (the frames and the comment pins beside them) sits inside it and covers at least 85% of the
  // canvas on its limiting side (the side it reaches first as it grows). Returns that cover.
  const fills = async (selector, what) => {
    const a = await evaluate(`(()=>{const r=[document.querySelector(${JSON.stringify(selector)}),...document.querySelectorAll('.pin')].filter(e=>e?.getClientRects().length).map(e=>e.getBoundingClientRect());
      const b={left:Math.min(...r.map(x=>x.left)),right:Math.max(...r.map(x=>x.right)),top:Math.min(...r.map(x=>x.top)),bottom:Math.max(...r.map(x=>x.bottom))};return{...b,width:b.right-b.left,height:b.bottom-b.top}})()`);
    const st = await box('.stage');
    assert.ok(a.left >= st.left - 1 && a.right <= st.right + 1 && a.top >= st.top - 1 && a.bottom <= st.bottom + 1, `${what} fits inside the canvas: ${JSON.stringify({ a, st })}`);
    const cover = Math.max(a.width / st.width, a.height / st.height);
    assert.ok(cover >= 0.85, `${what} covers ${Math.round(cover * 100)}% of the canvas's limiting side, under 85%: ${JSON.stringify({ a, st })}`);
    return cover;
  };
  const width = (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect().width`);
  // A capture waits until every visible option frame has painted its page.
  const states = [];
  // What a capture shows, measured on the page: the window width, the theme the page is in, and whether the column and the composer show.
  const state = async (capture, more = {}) => states.push({ capture, ...await evaluate(`({ width: innerWidth, theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light', column: !!document.querySelector('.side')?.getClientRects().length, composer: (()=>{const b=document.querySelector('form.brief')?.getBoundingClientRect();return b?.width?{top:Math.round(b.top),bottom:Math.round(b.bottom)}:'hidden'})(), stageWidth: Math.round(document.querySelector('.stage')?.getBoundingClientRect().width ?? 0), zoom: document.querySelector('.zoom')?.getClientRects().length ? document.querySelector('.zoom').textContent : 'none', button: document.querySelector('.bar .fold')?.getClientRects().length ? document.querySelector('.bar .fold').getAttribute('aria-label') : 'none' })`), ...more });
  // A capture of the page as the user sees it, saved to `dir` when given; it returns the PNG either way.
  const shot = async (name, dir) => {
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
    if (dir) { writeFileSync(join(dir, `${name}.png`), Buffer.from(data, 'base64')); console.log(`captured ${name}.png`); }
    return data;
  };
  // Captures side by side in one capture, each labelled with what it shows (before and after a press, or each theme), so the capture
  // shows its claim on its own. `panels` is [[label, png], ...] of captures w by h; `theme` sets the backdrop.
  const sideBySide = async (name, theme, panels, w = 1280, h = 800) => {
    await c('Page.navigate', { url: 'about:blank' });
    await c('Emulation.setDeviceMetricsOverride', { width: 40 + panels.length * (w + 40) - 40, height: h + (w > 700 ? 100 : 150), deviceScaleFactor: 1, mobile: false });
    await evaluate(`(()=>{const bg=${JSON.stringify(theme)}==='dark'?['#111','#eee']:['#ddd','#111'];document.body.style.cssText='margin:0;display:flex;gap:40px;padding:20px;background:'+bg[0]+';color:'+bg[1]+';font:600 ${w > 700 ? 30 : 20}px system-ui,sans-serif';
      for(const [label,data] of ${JSON.stringify(panels)}){const f=document.createElement('figure');f.style.cssText='margin:0;width:${w}px';const cap=document.createElement('figcaption');cap.textContent=label;cap.style.marginBottom='12px';const img=new Image();img.src='data:image/png;base64,'+data;img.width=${w};img.height=${h};f.append(cap,img);document.body.append(f);}
      return Promise.all([...document.images].map(i=>i.decode()))})()`);
    const { data } = await c('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(out, `${name}.png`), Buffer.from(data, 'base64'));
    console.log(`captured ${name}.png`);
  };
  const viewport = async (w, theme) => {
    await c('Emulation.setDeviceMetricsOverride', { width: w, height: w >= 1440 ? 900 : w > 700 ? 800 : 844, deviceScaleFactor: 1, mobile: false });
    await c('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }] });
  };

  // Comment mode (Comment at 1280, More > Add comment at 390), a tap on the phone's screen, a few words and Save: the comment is added
  // to the comments file with its device and point, and shows as an open pin in the margin and in the column. Returns the captures
  // with the box open and after Save.
  const addComment = async (w, theme, words) => {
    const count = await evaluate("document.querySelectorAll('.pin').length");
    if (w > 700) await click('.bar .comment-tool'); else { await click('.bar .more'); await click('#more-menu button'); }
    assert.equal(await shown('.comment-hint'), true, 'comment mode says to tap a spot');
    const screen = await box(w > 700 ? '.pair figure:nth-child(2) .catch' : '.catch'); // the phone's screen
    const hint = await box('.comment-hint'), phone = await box(w > 700 ? '.pair .phone' : '.phone');
    assert.ok(hint.bottom <= phone.top, `the hint sits above the phone, not over it: ${JSON.stringify({ hint, phone })}`);
    const at = { x: screen.left + screen.width * 0.5, y: screen.top + screen.height * 0.3 };
    await c('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...at });
    await c('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...at });
    await settle();
    const form = await box('.comment-box');
    assert.ok(form.top > at.y || form.bottom < at.y, `the comment box opens beside the tapped point, not over it: ${JSON.stringify({ at, form })}`);
    await c('Input.insertText', { text: words });
    const open = await shot(`add-comment-open-${w}-${theme}`, extra);
    await state(`add-comment-${w}${w > 700 ? `-${theme}` : ''}.png (${theme}, box open)`, { after: 'Comment on, the phone tapped, words typed' });
    await click('.comment-box [type=submit]');
    await until(`!document.querySelector('.comment-box') && document.querySelectorAll('.pin').length > ${count} && !!document.querySelector('.pin[aria-expanded="true"]')`, 'the saved comment as an open pin');
    const saved = JSON.parse(readFileSync(commentsFile, 'utf8')).at(-1);
    assert.deepEqual({ option: saved.option, device: saved.device, text: saved.text }, { option: 1, device: 'phone', text: words }, 'the comment is in the comments file');
    assert.ok(Math.abs(saved.x - 0.5) < 0.01 && Math.abs(saved.y - 0.3) < 0.01, `the comment keeps its point: ${JSON.stringify(saved)}`);
    assert.equal(await evaluate(`document.querySelector('.side').textContent.includes(${JSON.stringify(words)})`), true, 'the column lists the new comment');
    assert.equal(await shown('.comment-hint'), false, 'Save leaves comment mode');
    assert.equal(await pinsClear(), true, 'no pin covers a frame');
    const after = await shot(`add-comment-saved-${w}-${theme}`, extra);
    await state(`add-comment-${w}${w > 700 ? `-${theme}` : ''}.png (${theme}, saved)`, { after: 'Save pressed' });
    return { open, after };
  };

  const phones = { light: {}, dark: {} }; // the 390 captures of each theme, framed side by side after the loop
  const wides = { light: {}, dark: {} }; // and the 1280 ones
  for (const theme of ['light', 'dark']) for (const w of [1280, 390]) {
    writeFileSync(commentsFile, seed); // each run starts from the same two comments
    await viewport(w, theme);
    await open('#/o/1');
    const before = await shot(`studio-${w}-${theme}`, out);
    await state(w > 700 ? `hide-brief-${w}-${theme}.png (before)` : `studio-${w}-${theme}.png, phone-row-390.png (${theme}), press-play-390.png (${theme}, at rest), composer-390.png (${theme}, one line)`);
    // Every kind of button in the Studio shows a press state.
    const held = await press('.bar a.primary', w < 700 ? `press-play-390-${theme}` : undefined);
    if (w < 700) Object.assign(phones[theme], { rest: before, held });
    for (const selector of ['.devices a:not([aria-current]):not([href$="/both"])', '.bar .switch', '.side .list a', '.side .list button', 'form.brief [type=submit]', w > 700 ? '.bar .full-link' : '.bar .more', ...(w > 700 ? ['.bar .fold', 'form.brief .link', '.bar .comment-tool', '.pair .play-one', '.bar a.crumb'] : [])]) await press(selector);
    if (w > 700) {
      // Both, the default on a wide screen: the desktop and the phone side by side at one scale, each with its own Play, pins clear of both.
      const [desk, phone] = [await box('.pair .artboard'), await box('.pair .phone')];
      assert.ok(phone.left >= desk.right + 40, `the phone is beside the desktop: ${JSON.stringify({ desk, phone })}`);
      assert.ok(Math.abs(desk.width / 1280 - phone.width / 396) < 0.005, `one scale for both: ${desk.width / 1280} and ${phone.width / 396}`);
      assert.deepEqual(await evaluate("[...document.querySelectorAll('.pair .play-one')].map(a=>a.getAttribute('href'))"), ['#/o/1/play/desktop', '#/o/1/play/phone'], 'each device has its own Play');
      assert.equal(await evaluate("document.querySelector('.devices [aria-current]').textContent"), 'Both');
      assert.equal(await pinsClear(), true, 'no pin covers a frame');
      await fills('.pair', 'Both');
      wides[theme].rest = before;
      // Brief collapses the column (design, options, comments and the composer), the canvas takes its room, and Brief brings it back.
      const stage = await width('.stage');
      await click('.bar [aria-controls="studio-side"]');
      assert.equal(await shown('.side'), false, 'Brief hides the column');
      assert.equal(await shown('form.brief'), false, 'Brief hides the composer');
      assert.ok(await width('.stage') > stage + 200, 'the canvas takes the column\'s room');
      assert.equal(await evaluate('document.querySelector(\'.bar [aria-controls="studio-side"]\').getAttribute(\'aria-expanded\')'), 'false');
      const after = await shot(`studio-collapsed-${w}-${theme}`, extra);
      await state(`hide-brief-${w}-${theme}.png (after)`, { after: 'Hide brief pressed' });
      await click('.bar [aria-controls="studio-side"]');
      assert.equal(await shown('.side'), true, 'Brief shows the column again');
      assert.equal(await shown('form.brief'), true, 'Brief shows the composer again');
      await state(null, { after: 'Show brief pressed: no capture, the page is as before' });
      await sideBySide(`hide-brief-${w}-${theme}`, theme, [['Before: Hide brief not pressed', before], ['After pressing Hide brief', after]]);
      await viewport(w, theme); // the side-by-side capture left the page: open the Studio again
      await open('#/o/1');
      Object.assign(wides[theme], await addComment(w, theme, `Umer (${theme}): more room above the headline`));
    } else {
      // Phone width: the phone mock alone, the composer docked at the bottom of the first screen, no Brief button (the column follows below).
      assert.equal(await shown('.phone'), true, 'the phone mock shows');
      assert.equal(await shown('.artboard'), false, 'no desktop pane under the phone');
      assert.equal(await shown('.devices a[href$="/both"]'), false, 'no Both at phone width');
      assert.equal(await pinsClear(), true, 'no pin covers the phone');
      await fills('.stage > .scaled', 'the phone');
      assert.equal(await shown('.bar [aria-controls="studio-side"]'), false, 'no Brief button at phone width');
      const dock = await evaluate("(()=>{scrollTo(0,0);const b=document.querySelector('form.brief textarea').getBoundingClientRect();return{top:b.top,bottom:b.bottom,h:innerHeight}})()");
      assert.ok(dock.bottom <= dock.h && dock.top > dock.h / 2, `the composer is docked at the bottom of the screen: ${JSON.stringify(dock)}`);
      // The bar: the option switcher, Play and More on one line, Desktop/Phone under it; Play the one primary, Fullscreen in the More menu.
      assert.equal(await shown('.bar .full-link'), false, 'Fullscreen is not in the bar at phone width');
      assert.equal(await evaluate("[...document.querySelectorAll('.bar .primary')].filter(e=>e.getClientRects().length).length"), 1, 'Play is the one primary');
      const row = await Promise.all(['.bar .switch', '.bar .more', '.bar a.primary'].map((s) => box(s)));
      assert.ok(row.every((b) => Math.abs(b.top + b.height / 2 - (row[0].top + row[0].height / 2)) < 2), `the switcher, Play and More are one line: ${JSON.stringify(row)}`);
      assert.ok((await box('.bar .devices')).top >= row[0].bottom, 'the device switch is under them');
      // The composer is one line until used, and the whole phone shows above it.
      const [phone, form] = [await box('.phone'), await box('form.brief')];
      assert.ok(phone.bottom <= form.top, `the composer covers the phone: phone ends at ${phone.bottom}, composer starts at ${form.top}`);
      assert.ok(form.height < 64, `the composer is one line until used: ${form.height}px`);
      assert.equal(await shown('form.brief .link'), false, 'the terminal command link waits until the brief is used');
      await click('.bar .more');
      assert.equal(await shown('#more-menu a[href="#/o/1/full"]'), true, 'More opens a menu with Fullscreen');
      phones[theme].more = await shot(`studio-more-390-${theme}`, extra);
      await state(`more-menu-390.png (${theme})`, { after: 'More pressed' });
      await press('#more-menu a');
      await key('Escape');
      assert.equal(await shown('#more-menu'), false, 'Escape closes the More menu');
      await click('form.brief textarea');
      assert.equal(await shown('form.brief .link'), true, 'a focused brief shows the terminal command link');
      assert.ok((await box('form.brief')).height > form.height + 20, 'a focused brief opens up');
      phones[theme].focused = await shot(`studio-composer-focused-390-${theme}`, extra);
      await state(`composer-390.png (${theme}, tapped)`, { after: 'the brief box tapped' });
      await press('form.brief .link');
      await evaluate('document.activeElement?.blur()');
      Object.assign(phones[theme], await addComment(w, theme, `Umer (${theme}): a bigger sign-in button`));
    }
  }

  // One capture per claim, light and dark side by side (one capture per theme at 1280), each panel labelled with what it shows.
  await sideBySide('canvas-both-1280', 'light', [['1280 px, light: the desktop and the phone side by side on the canvas, each with its own Play', wides.light.rest], ['1280 px, dark: the desktop and the phone side by side on the canvas, each with its own Play', wides.dark.rest]]);
  for (const theme of ['light', 'dark']) await sideBySide(`add-comment-1280-${theme}`, theme, [[`1280 px, ${theme}: Comment on, the phone tapped: the box opens below the yellow mark`, wides[theme].open], [`1280 px, ${theme}: after Save the comment is pin 3, in the margin beside the phone and in the column`, wides[theme].after]]);
  const { light: l, dark: d } = phones;
  await sideBySide('add-comment-390', 'light', [['390 px, light: More > Add comment, the phone tapped: the box opens below the mark', l.open], ['390 px, light: after Save the comment is pin 3, beside the phone', l.after], ['390 px, dark: More > Add comment, the phone tapped', d.open], ['390 px, dark: after Save the comment is pin 3, beside the phone', d.after]], 390, 844);
  await sideBySide('phone-row-390', 'light', [['390 px, light: the option switcher, Play (the one filled button) and More (⋯) on one line, Desktop/Phone under them. The whole phone shows above the one-line brief box', l.rest], ['390 px, dark: the option switcher, Play (the one filled button) and More (⋯) on one line, Desktop/Phone under them. The whole phone shows above the one-line brief box', d.rest]], 390, 844);
  await sideBySide('more-menu-390', 'light', [['390 px, light: More (⋯) pressed. Its menu holds Fullscreen', l.more], ['390 px, dark: More (⋯) pressed. Its menu holds Fullscreen', d.more]], 390, 844);
  await sideBySide('press-play-390', 'light', [['390 px, light: Play at rest', l.rest], ['390 px, light: Play held down changes colour', l.held], ['390 px, dark: Play at rest', d.rest], ['390 px, dark: Play held down changes colour', d.held]], 390, 844);
  await sideBySide('composer-390', 'light', [['390 px, light: the brief box at rest is one line, below the whole phone', l.rest], ['390 px, light: the brief box tapped opens up, with Terminal command', l.focused], ['390 px, dark: the brief box at rest is one line, below the whole phone', d.rest], ['390 px, dark: the brief box tapped opens up, with Terminal command', d.focused]], 390, 844);

  // Fit to space at 1280 and 1440 wide, light and dark: Both, Desktop and Phone each cover 85% or more of the canvas's limiting
  // side, captured whole as fit-<device>-<width>-<theme>.png; fit.json records each zoom and cover.
  const fit = [];
  for (const w of [1280, 1440]) for (const theme of ['light', 'dark']) for (const d of ['both', 'desktop', 'phone']) {
    await viewport(w, theme);
    await open(`#/o/1/${d}`);
    const cover = await fills(d === 'both' ? '.pair' : '.stage > .scaled', `${d} at ${w} px, ${theme}`);
    await shot(`fit-${d}-${w}-${theme}`, out);
    fit.push({ capture: `fit-${d}-${w}-${theme}.png`, width: w, theme, device: d, zoom: await evaluate("document.querySelector('.zoom').textContent"), cover: `${Math.round(cover * 1000) / 10}%` });
  }
  writeFileSync(join(out, 'fit.json'), JSON.stringify(fit, null, 2));

  for (const w of [1280, 390]) {
    await viewport(w, 'light');
    await open('#/o/1');
    const dev = w > 700 ? 'desktop' : 'phone', other = w > 700 ? 'phone' : 'desktop';
    await click(`.devices a[href="#/o/1/${other}"]`);
    assert.equal(await evaluate('location.hash'), `#/o/1/${other}`);
    assert.equal(await shown(other === 'phone' ? '.phone' : '.artboard'), true, `${other} shows after the switch`);
    await fills('.stage > .scaled', other);
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
      await click('.bar .switch');
      assert.equal(await shown('#option-menu'), true, 'the option switcher opens its menu');
      await click('#option-menu a[href^="#/o/2"]');
    }
    assert.match(await evaluate('location.hash'), /^#\/o\/2/);
    await click('form.brief textarea');
    await c('Input.insertText', { text: 'Umer: make the next iteration feel a little calmer.' });
    await click('form.brief button[type=submit]');
    // The view first looks for the installed subscriptions to name in the hint: a few seconds, and up to about 30 on a loaded machine.
    await until("document.querySelector('.run.failed')?.textContent.includes('init --agent')", 'the set-up hint after Send with no agent', 90_000);
    await shot(`studio-send-no-agent-${w}`, extra);
    if (w < 700) {
      // Fullscreen from the More menu, and back.
      await click('.bar .more'); await click('#more-menu a');
      assert.match(await evaluate('location.hash'), /^#\/o\/2\/full$/);
      await press('a.exit'); await click('a.exit');
      assert.match(await evaluate('location.hash'), /^#\/o\/2$/);
    }
    await click('.bar a.primary');
    assert.match(await evaluate('location.hash'), /^#\/o\/2\/play\//);
    await fills('.stage > .scaled', 'Play');
    await shot(`play-${w}`, extra);
    await press('.bar a');
    await click('.bar a');
    assert.match(await evaluate('location.hash'), /^#\/o\/2(\/(phone|desktop))?$/); // Exit goes back to the Studio route Play was opened from
  }
  writeFileSync(join(out, 'studio-states.json'), JSON.stringify(states, null, 2));
  // done-done's step record: what was driven, from where, and what a user sees at the end.
  const version = `${JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version} at ${execFileSync('git', ['-C', root, 'rev-parse', '--short', 'HEAD']).toString().trim()}`;
  writeFileSync(join(out, 'steps.json'), JSON.stringify({ target: { version: `first-draft-axi ${version}` },
    start: `The Studio in first-draft view, the app frame around a user's design: the two-option '${name}' design (${source ? 'from a real run' : 'the notes sign-in fixture'}) with two comments and no agent set, in headless Chromium`,
    steps: ["At 1280 and 390 px wide, in light and in dark, the whole Studio is captured as it opens: studio-1280-light.png, studio-1280-dark.png, studio-390-light.png and studio-390-dark.png",
      "At 1280 px wide, in light and in dark: one top bar holds the panel toggle, the design's name and the option switcher, the Both/Desktop/Phone switch with the zoom, Comment, Fullscreen and Play; the canvas shows the desktop and the phone side by side at one scale, as large as the canvas fits, each captioned with its own Play; canvas-both-1280.png shows light and dark",
      "At 1280 px, press Comment, tap the phone's screen, type a comment and press Save: the box opens below the tapped point; after Save the comment is a numbered pin in the margin beside the phone (never over a frame), it is listed in the panel and it is the last entry of the comments file with device 'phone'; add-comment-1280-light.png and add-comment-1280-dark.png show the box and the saved pin",
      "At 1280 px, the panel with the options, the comments and the brief box shows, and the panel toggle is labelled 'Hide brief'",
      "Pressing 'Hide brief' removes the panel: it is gone, the toggle is labelled 'Show brief' and the design fills the canvas; hide-brief-1280-light.png and hide-brief-1280-dark.png show before and after side by side",
      "Press 'Show brief': the panel is shown again",
      "At 390 px wide, in light and in dark: the bar is the option switcher, Play (the one filled button) and More, with Desktop/Phone under them; the whole phone shows above a one-line brief box with its Send button; phone-row-390.png shows light and dark side by side",
      "At 390 px, holding Play down changes its colour; press-play-390.png shows Play at rest and held, light and dark. Every other kind of button also changes while held",
      "At 390 px, pressing More opens a menu with Fullscreen; more-menu-390.png shows it in light and dark; Escape closes it",
      "At 390 px, More > Add comment, tap the phone, type and Save: the comment is saved to the file and shows as a pin beside the phone; add-comment-390.png shows the box and the pin, light and dark",
      "At 390 px, tapping the brief box opens it up (a taller box and a 'Terminal command' button); composer-390.png shows it at rest and tapped, light and dark",
      'At 1280 and 1440 px wide, in light and in dark, open Both, Desktop and Phone: each is drawn at the largest scale that fits and covers at least 85% of the canvas on its limiting side (Both the width, Desktop the width, Phone the height); fit-<device>-<width>-<theme>.png captures each and fit.json records the zoom and cover',
      'Switch Phone/Desktop and back: each device fills the canvas; click a comment in the panel and its pin opens on the canvas',
      "At 1280 px hide the panel and switch device: it stays hidden until 'Show brief'",
      'Open Option 2 (from the panel at 1280, from the option switcher at 390); type a change in the brief box and press Send with no agent set: the set-up hint shows; at 390 open Fullscreen from More and Exit; press Play, then Exit'],
    result: "The Studio opens in one top bar with the option switcher beside the design's name and Play as its one filled button; at 1280 px it shows the desktop and the phone side by side as large as the canvas fits, each with its own Play (studio-1280-*.png, canvas-both-1280.png); at 390 px the switcher, Play and More sit above Desktop/Phone and the whole phone shows above a one-line brief box (studio-390-*.png, phone-row-390.png). A person adds a comment by tapping a point on the phone and it is saved to the comments file and shows as a pin beside the frame (add-comment-*.png); 'Hide brief' removes the panel and the design fills the canvas (hide-brief-*.png); More opens a menu with Fullscreen, Play changes colour while held, and the brief box opens up when tapped. studio-states.json records each state's measured width, theme, panel, composer position, canvas width, zoom label and toggle label" }, null, 2));
  console.log('PASS: Studio at 1280 and 390, light and dark: each device fills the canvas, desktop and phone side by side, add a comment on the canvas, pins clear of the frames, Brief collapse, docked one-line composer clear of the phone, the phone control row and its More menu, press states, device switch, pins, option switch, Send hint, Fullscreen, Play and back');
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
