// Journey: the running version wherever first-draft shows it, in headless Chromium over CDP (no packages, no model call, no installed
// browser state). The CLI's --version, -v and help header are recorded (cli.txt); then, at phone 360, 390 and 445 and desktop 1280 and
// 1440, light and dark, the whole frame of: the option picker scrolled to its foot (version-picker-<width>-<theme>.png), the Studio with
// its panel's foot in view (version-studio-<width>-<theme>.png; on a phone the page scrolled to the end of the panel, above the docked
// brief), the More menu open (version-more-<width>-<theme>.png, phones only: More is a phone control) and the landing page scrolled to
// its footer (version-landing-<width>-<theme>.png). Each frame asserts the label reads what --version prints (the landing page:
// package.json's version, the released one) and that it sits inside the frame, uncovered. The notes fixture is served from a temporary
// folder with its own FIRST_DRAFT_HOME. The evidence folder ($DONE_DONE_EVIDENCE_ROOT, or the first argument) gets the frames,
// cli.txt, version-states.json and steps.json. Chrome is $CHROME, else chromium or google-chrome on PATH.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = new URL('..', import.meta.url).pathname;
const out = process.env.DONE_DONE_EVIDENCE_ROOT ?? process.argv[2];
if (!out) throw new Error('Give an evidence folder: $DONE_DONE_EVIDENCE_ROOT or the first argument');
const chrome = [process.env.CHROME, 'chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable'].find((c) => c && execFileSync('sh', ['-c', `command -v "${c}" || true`]).toString().trim());
if (!chrome) throw new Error('No Chrome or Chromium on PATH; set $CHROME');
mkdirSync(out, { recursive: true });
const dir = mkdtempSync(join(tmpdir(), 'first-draft-version-'));
for (const n of [1, 2]) copyFileSync(join(root, 'journeys/fixtures/notes.html'), join(dir, `notes-${n}.html`));
writeFileSync(join(dir, 'notes.comments.json'), JSON.stringify([{ option: 1, x: 0.2, y: 0.3, text: 'Umer: make the headline a little smaller' }]));

// The CLI first: the version every other surface must match.
const cli = (...args) => execFileSync(process.execPath, [join(root, 'src/cli.mjs'), ...args], { encoding: 'utf8' });
const version = cli('--version').trim(), released = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
assert.equal(cli('-v').trim(), version, '-v prints what --version prints');
assert.equal(cli('--help').split('\n')[0], `first-draft-axi ${version}`, 'the help header names the version');
assert.ok(version === released || version === `${released}-dev`, `--version is package.json's version, or -dev from a source checkout: ${version}`);
writeFileSync(join(out, 'cli.txt'), `$ first-draft-axi --version\n${version}\n$ first-draft-axi -v\n${version}\n$ first-draft-axi --help | head -2\n${cli('--help').split('\n').slice(0, 2).join('\n')}\n`);

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
const pending = new Map();
try {
  const base = await launch(process.execPath, [join(root, 'src/cli.mjs'), 'view', join(dir, 'notes.html'), '--host', '127.0.0.1', '--port', '0'], /"url":"([^"]+)"/, { ...process.env, FIRST_DRAFT_HOME: join(dir, 'home') });
  const endpoint = await launch(chrome, ['--headless', '--no-sandbox', '--disable-extensions', '--disable-dev-shm-usage', '--hide-scrollbars', '--remote-debugging-port=0', `--user-data-dir=${join(dir, 'chrome')}`, 'about:blank'], /DevTools listening on (ws:\/\/\S+)/);
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
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (expression, what, ms = 15000) => { for (const end = Date.now() + ms; Date.now() < end;) { if (await evaluate(expression)) return; await wait(100); } throw new Error(`Timed out after ${ms / 1000}s: ${what}`); };
  const open = async (url) => { await c('Page.navigate', { url: 'about:blank' }); await c('Page.navigate', { url }); await until("document.readyState==='complete' && !!document.body.firstElementChild", `open ${url}`); };
  // Every option frame in the window has drawn its page (its skeleton goes on load), and the fonts are in.
  const painted = () => until("(()=>{const inView=e=>{const b=e.getBoundingClientRect();return b.width&&b.bottom>0&&b.top<innerHeight};return document.fonts.status==='loaded'&&![...document.querySelectorAll('.skeleton')].some(inView)})()", 'the option frames in view to paint');
  // The label is whole inside the frame, the element at its centre is the label itself (nothing covers it), and the page does not scroll sideways.
  const seen = (selector) => evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return{missing:true};const b=e.getBoundingClientRect(),top=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);
    return{text:e.textContent,inFrame:b.top>=0&&b.bottom<=innerHeight&&b.left>=0&&b.right<=innerWidth,uncovered:e===top||e.contains(top),wide:document.documentElement.scrollWidth>innerWidth}})()`);
  const states = [];
  const frame = async (name, selector, expected) => {
    await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
    const s = await seen(selector);
    assert.equal(s.text, expected, `${name}: the label`);
    assert.ok(s.inFrame && s.uncovered && !s.wide, `${name}: the label shows whole and uncovered, no sideways scroll: ${JSON.stringify(s)}`);
    const { data } = await c('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(out, `${name}.png`), Buffer.from(data, 'base64'));
    states.push({ capture: `${name}.png`, label: s.text, width: await evaluate('innerWidth'), theme: await evaluate("matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'") });
    console.log(`captured ${name}.png`);
  };
  const landing = pathToFileURL(join(root, 'docs/index.html')).href, toEnd = 'scrollTo(0,document.documentElement.scrollHeight)';
  for (const theme of ['light', 'dark']) for (const w of [360, 390, 445, 1280, 1440]) {
    const phone = w < 860;
    await c('Emulation.setDeviceMetricsOverride', { width: w, height: w >= 1440 ? 900 : phone ? 844 : 800, deviceScaleFactor: 1, mobile: false });
    await c('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }] });
    await open(`${base}#/`);
    await evaluate(toEnd);
    await painted();
    await frame(`version-picker-${w}-${theme}`, '.picker > .version', `first-draft ${version}`);
    await open(`${base}#/o/1`);
    if (phone) await evaluate(toEnd);
    await painted();
    await frame(`version-studio-${w}-${theme}`, '.side > .version', `first-draft ${version}`);
    if (phone) {
      await evaluate("scrollTo(0,0);document.querySelector('.bar .more').click()");
      await until("!!document.querySelector('#more-menu:popover-open')", 'More to open');
      await painted();
      await frame(`version-more-${w}-${theme}`, '#more-menu .version', `first-draft ${version}`);
    }
    await open(landing);
    await evaluate("Promise.all([...document.images].map(i=>{i.loading='eager';return i.decode().catch(()=>{})})).then(()=>document.fonts.ready)");
    await evaluate(toEnd);
    await frame(`version-landing-${w}-${theme}`, 'footer .version', released);
  }
  writeFileSync(join(out, 'version-states.json'), JSON.stringify(states, null, 2));
  const head = execFileSync('git', ['-C', root, 'rev-parse', '--short', 'HEAD']).toString().trim();
  writeFileSync(join(out, 'steps.json'), JSON.stringify({ target: { version: `first-draft-axi ${version} at ${head}` },
    start: "first-draft from this checkout: the CLI, its view serving the two-option 'notes' fixture with no agent set, and the landing page (docs/index.html), in headless Chromium",
    steps: [`Run first-draft-axi --version and -v: each prints ${version}; the first line of --help is 'first-draft-axi ${version}' (cli.txt)`,
      'At 360, 390, 445, 1280 and 1440 px wide, in light and in dark, open the view root and scroll to its foot: under the grid the picker reads the version (version-picker-<width>-<theme>.png)',
      'Open Option 1 in the Studio: the foot of its panel reads the version, under the brief box at 1280 and 1440 and, on a phone, at the end of the panel above the docked brief box (version-studio-<width>-<theme>.png)',
      'At 360, 390 and 445, press More: under a rule at the foot of the menu it reads the version (version-more-<width>-<theme>.png)',
      `Open the landing page and scroll to its footer: it reads 'first-draft ${released}', package.json's version (version-landing-<width>-<theme>.png)`],
    result: `The CLI prints ${version}; the picker's foot, the Studio panel's foot and the phone More menu read 'first-draft ${version}', whole and uncovered at 360, 390, 445, 1280 and 1440 px in light and dark (version-picker-*, version-studio-*, version-more-*); the landing footer reads 'first-draft ${released}' at each width and theme (version-landing-*). version-states.json records each frame's label, width and theme` }, null, 2));
  console.log(`PASS: the version (${version}) in the CLI, the picker, the Studio panel and More at 360/390/445/1280/1440, light and dark; the landing footer reads ${released}`);
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
