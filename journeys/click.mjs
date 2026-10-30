// Nonpaid real-CLI proof that a clickable option stays clickable: an inbox brief whose rows and filter are wired by an inline script ->
// make exports the option with its script, loading nothing -> the host presses one of its controls with a real mouse event in a headless
// browser and keeps a frame sequence across it, encoded into click-390.mp4 and click-1280.mp4 -> the independent judge is asked about
// behaviour and returns a verdict -> a control that
// changes nothing is judged and refused -> a drawn App.jsx option keeps its source readable beside it -> the view serves the clickable page
// in its sandy frame and a real click on what "Open live" opens still works. Local stand-ins answer the model and the judge, so scores are
// synthetic, never design quality.
import '../test/fixtures/provider-hooks.mjs';
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { renderCheck } from '../src/render-check.mjs';
import { standIn } from '../test/fixtures/critic-model.mjs';
import { installJudge } from '../test/fixtures/judge-cli.mjs';
const root = new URL('..', import.meta.url).pathname, out = process.env.DONE_DONE_EVIDENCE_ROOT ?? process.argv[2];
if (!out) throw Error('Give an evidence folder');
mkdirSync(out, { recursive: true });
const BRIEF = 'An inbox app: pick a message from the list to read it, and filter the list to unread';
const ffmpeg = (...args) => promisify(execFile)('ffmpeg', args, { maxBuffer: 32_000_000 });
// The press is a clip, not only two stills: the frame sequence across it (render-check's PRESS_AT) is encoded into a short mp4 per width.
// Refuse before any work when ffmpeg is not on PATH, rather than after the CLI has made the option.
try { await ffmpeg('-version'); } catch { throw Error('the click clips need ffmpeg: click-390.mp4 and click-1280.mp4 cannot be encoded without it. Install ffmpeg on PATH and run the journey again'); }
const encode = async (width, sequence) => {
  const dir = mkdtempSync(join(tmpdir(), `fd-click-seq-${width}-`)), list = join(dir, 'frames.txt');
  sequence.forEach(({ dataUrl }, i) => writeFileSync(join(dir, `f-${String(i).padStart(3, '0')}.jpg`), Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64')));
  // Each frame keeps the time it was really taken, so the clip plays the change at the pace a person saw it.
  writeFileSync(list, `${sequence.map(({ at_ms }, i) => `file 'f-${String(i).padStart(3, '0')}.jpg'\nduration ${((sequence[i + 1]?.at_ms ?? at_ms + 200) - at_ms) / 1000}`).join('\n')}\n`);
  const file = join(out, 'frames', `click-${width}.mp4`);
  try {
    await ffmpeg('-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-an', '-vf', "fps=15,scale='min(1280,iw)':-2", '-c:v', 'libx264', '-preset', 'slow', '-crf', '30', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file);
    return { file, bytes: statSync(file).size };
  } finally { rmSync(dir, { recursive: true, force: true }); }
};
// What the stand-in model writes: an inbox whose rows open their message and whose filter narrows the list, both wired by an inline script.
const inbox = (title, wired = true) => `<!doctype html><html><head><title>${title}</title><style>:root{--bg:#fff;--fg:#14161a;--line:#e3e6ea;--sel:#eef2ff}@media (prefers-color-scheme: dark){:root{--bg:#111418;--fg:#e9ecef;--line:#262b32;--sel:#1c2433}}
body{margin:0;font:15px/1.5 system-ui,sans-serif;background:var(--bg);color:var(--fg)}main{display:grid;grid-template-columns:minmax(0,320px) minmax(0,1fr);min-height:100vh}
@media (max-width:700px){main{grid-template-columns:1fr}}.list{border-right:1px solid var(--line);padding:16px}
.row{display:flex;gap:10px;align-items:baseline;padding:10px;border:0;border-bottom:1px solid var(--line);width:100%;text-align:left;font:inherit;color:inherit;background:none;cursor:pointer}
.row[hidden]{display:none}.row[aria-current="true"]{background:var(--sel)}.row .from{font-weight:600}.row .sub{opacity:.65;font-size:13px}.read{padding:24px}
.tab{border:1px solid var(--line);background:none;color:inherit;padding:6px 12px;border-radius:999px;cursor:pointer;font:inherit}
.tab[aria-pressed="true"]{border-color:currentColor;font-weight:600}</style></head>
<body><main><section class="list" aria-label="Messages"><p><button class="tab" data-filter="all" aria-pressed="true">All</button> <button class="tab" data-filter="unread" aria-pressed="false">Unread</button></p>
<button class="row" data-id="m1" aria-current="true"><span class="from">Maya Chen</span><span class="sub">Design review Thursday</span></button>
<button class="row" data-id="m2" aria-current="false"><span class="from">Sign-off</span><span class="sub">Three options are ready to pick</span></button>
<button class="row" data-id="m3" aria-current="false"><span class="from">Juggernaut</span><span class="sub">The release is published</span></button></section>
<section class="read" aria-live="polite"><h1 id="subject">Design review Thursday</h1><p id="body">Can we walk the board flows at 10:00?</p></section></main>
<script>const bodies={m1:['Design review Thursday','Can we walk the board flows at 10:00?'],m2:['Three options are ready to pick','Open live plays each one; the pick is yours.'],m3:['The release is published','Export keeps the option script.']};
const rows=[...document.querySelectorAll('.row')],tabs=[...document.querySelectorAll('.tab')];
if(${wired}){rows.forEach(r=>r.addEventListener('click',()=>{rows.forEach(x=>x.setAttribute('aria-current',String(x===r)));const[s,b]=bodies[r.dataset.id];document.getElementById('subject').textContent=s;document.getElementById('body').textContent=b;}));
tabs.forEach(t=>t.addEventListener('click',()=>{tabs.forEach(x=>x.setAttribute('aria-pressed',String(x===t)));rows.forEach(r=>{r.hidden=t.dataset.filter==='unread'&&r.dataset.id!=='m2';});}));}
</script></body></html>`;
// A page that looks clickable and is not: the script is there, the control is wired to nothing.
const dead = inbox('Inbox', false); // the same page with its filter wired to nothing
const dir = mkdtempSync(join(tmpdir(), 'fd-click-'));
installJudge(dir);
const seen = [], server = await standIn(seen, [[7, 6], [7, 6], [9, 6]], false, () => {}, () => inbox('Inbox'));
const drawnServer = await standIn(seen, [[7, 6]], true, () => {}, () => inbox('Inbox'));
let view;
try {
  const env = { ...process.env, PATH: `${dir}:${process.env.PATH}`, CI: 'true', HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir, OPENCODE_API_KEY: 'synthetic', FD_JUDGE_SCORES: '[[7,7],[9,7],[9,7]]',
    FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}` };
  const cli = (e) => async (...args) => JSON.parse((await promisify(execFile)(process.execPath, [join(root, 'src/cli.mjs'), ...args], { env: e, cwd: dir, maxBuffer: 64_000_000 })).stdout.trim().split('\n').at(-1));
  const run = cli(env), runDrawn = cli({ ...env, FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${drawnServer.address().port}` }); // the engine make talks to the stand-in that writes App.jsx
  await run('init', '--agent', 'byokit:opencode-go', '--model', 'muse-spark-1.3-contributor');

  // 1. The clickable brief in: the export keeps the option's own script and loads nothing, in a document that can run it.
  const { made } = await run('make', BRIEF, '--out', join(dir, 'inbox.html'), '--options', '1');
  const [file] = made.files, html = readFileSync(file.file, 'utf8');
  assert.match(html, /<script>const bodies=/, 'the option keeps its inline script, verbatim');
  assert.match(html, /script-src 'unsafe-inline'/);
  assert.match(html, /default-src 'none'/, 'and still loads nothing from the network');
  assert.deepEqual(made.files[0].critique.behaviour.widths.map((w) => w.clicked?.label), ['Unread', 'Unread'], 'the host pressed a real control at both widths');

  // 2. The independent judge read a real press: the frames of the page before and after it, and its verdict is the option's.
  const calls = readFileSync(join(dir, 'judge-calls.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.match(calls[0].input, /click-390-before.*click-390-after.*click-1280-before.*click-1280-after/, 'the judge got the page before and after the press');
  assert.match(calls[0].system, /also answer behaviour/);
  assert.equal(file.critique.behaviour.present, true);
  assert.equal(file.critique.behaviour.score, 7);
  assert.ok(file.critique.behaviour.defects.length, 'a behaviour under 9 names its defects');
  assert.equal(file.critique.passed, false, 'a click that only half works does not pass the bar of 9');

  // 3. A control that changes nothing is judged for what it does: the press is recorded, no frames are claimed, and the option is refused.
  writeFileSync(join(dir, 'dead.html'), dead);
  const refused = await run('judge', join(dir, 'dead.html'), BRIEF, '--plain', made.critic.plain);
  assert.deepEqual([refused.critique.behaviour.present, refused.critique.behaviour.clicked], [true, false]);
  assert.deepEqual(refused.critique.behaviour.widths.map((w) => [w.controls, w.clicked]), [[4, null], [4, null]]);
  assert.equal(refused.critique.passed, false);
  const deadCall = readFileSync(join(dir, 'judge-calls.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)).at(-1);
  assert.doesNotMatch(deadCall.input, /click-390-before/, 'no frames are sent for a press that changed nothing');

  // 4. A drawn App.jsx option keeps its source readable beside it (and its in-band comment for refine), and is not asked about a press.
  const app = await runDrawn('make', BRIEF, '--out', join(dir, 'app.html'), '--options', '1', '--engine');
  const drawnFile = app.made.files[0], sidecar = readFileSync(join(drawnFile.source_dir, 'App.jsx'), 'utf8');
  assert.match(sidecar, /function App\(\)/, 'the source that made the page is readable beside it');
  assert.doesNotMatch(sidecar, /[A-Za-z0-9+/]{200}=/, 'not a base64 blob');
  assert.match(readFileSync(drawnFile.file, 'utf8'), /<!--first-draft-source:/, 'the page still carries its source for refine');
  assert.equal(drawnFile.critique.behaviour.present, false, 'a drawn page has no script, so there is nothing to press');

  // 5. "Open live": the frame origin the board serves carries the option script under a sandbox that loads nothing, and a real click on it works.
  view = spawn(process.execPath, [join(root, 'src/cli.mjs'), 'view', file.file, '--host', '127.0.0.1', '--port', '0'], { env, cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] });
  const viewing = await new Promise((ok, fail) => { let log = ''; view.stdout.on('data', (c) => { log += c; const m = log.match(/^\{"viewing".*$/m); if (m) ok(JSON.parse(m[0]).viewing); }); view.once('exit', (code) => fail(new Error(`view exited ${code}: ${log}`))); });
  const framed = await fetch(`${viewing.frames}/o/1`), csp = framed.headers.get('content-security-policy'), played = await framed.text();
  assert.match(csp, /sandbox allow-scripts;/); assert.match(csp, /connect-src 'none'/); assert.match(csp, /script-src 'unsafe-inline'/);
  assert.match(played, /<script>const bodies=/, 'the page Open live opens is the clickable option');
  const render = renderCheck();
  const live = await render.clicks(played);
  render.close();
  assert.equal(live.clicked, true, 'a real click on the served page changes it');
  assert.match(live.widths[0].clicked.after, /Sign-off/, 'the Unread press leaves the unread message on screen');
  assert.doesNotMatch(live.widths[0].clicked.after, /Maya Chen/, 'and takes the read ones away, so the list really narrowed');

  const clean = (o) => JSON.stringify(o, null, 2).replaceAll(dir, '<run>');
  writeFileSync(join(out, 'make.json'), clean({ made }));
  writeFileSync(join(out, 'refused-dead-control.json'), clean({ refused }));
  writeFileSync(join(out, 'drawn-source-sidecar.json'), clean({ app }));
  mkdirSync(join(out, 'frames'), { recursive: true });
  for (const f of live.frames) writeFileSync(join(out, 'frames', `${f.id}.jpg`), Buffer.from(f.dataUrl.slice(f.dataUrl.indexOf(',') + 1), 'base64'));
  // The click itself as a clip per width, beside those stills: the board refuses a click proved only by stills.
  const clips = [];
  for (const { width, clicked } of live.widths) {
    assert.ok(clicked.sequence.length >= 10 && clicked.sequence.at(-1).at_ms >= 1000, `the ${width} sequence spans the press with its own timestamps`);
    const clip = await encode(width, clicked.sequence);
    assert.ok(clip.bytes > 2000, `click-${width}.mp4 is a real clip, not an empty file`);
    clips.push({ width, file: `frames/click-${width}.mp4`, bytes: clip.bytes, frames: clicked.sequence.length, over_ms: clicked.sequence.at(-1).at_ms });
  }
  const logged = ({ width, controls, idle, clicked }) => ({ width, controls, idle, clicked: clicked && { label: clicked.label, tag: clicked.tag, changed: clicked.changed, after: clicked.after, frames: clicked.sequence.map(({ at_ms }) => at_ms) } }); // the timestamps, never the frame bytes
  writeFileSync(join(out, 'click-log.json'), clean({ served: { options: 1, clicked: live.clicked, widths: live.widths.map(logged) }, judged: { behaviour: file.critique.behaviour, passed: file.critique.passed }, clips }));
  const head = (await promisify(execFile)('git', ['-C', root, 'rev-parse', 'HEAD'])).stdout.trim();
  writeFileSync(join(out, 'steps.json'), JSON.stringify({ target: { version: `first-draft-axi ${head}, source CLI and Chrome` }, start: 'Task-private HOME and local model and judge stand-ins; no owner state, network model or credentials.',
    steps: ['make a clickable inbox option from a brief that asks for a row to open and a filter to narrow', 'read the option, its critique.behaviour and the judge call', 'judge a page whose control is wired to nothing', 'make a drawn App.jsx option and read its .source sidecar', 'open the option in first-draft-axi view and press the served page', 'encode the frame sequence across each press into a short clip per width'],
    result: `The export kept the option's inline script under a policy that loads nothing; the host's real mouse press changed the page at 390 and 1280, the judge was sent the frames before and after it and returned behaviour ${file.critique.behaviour.score}/10 with ${file.critique.behaviour.defects.length} defect(s); a control wired to nothing was judged and refused; the drawn option's source sits readable in ${drawnFile.source_dir}; the framed page Open live serves still changes on a real click; the press is kept as click-390.mp4 and click-1280.mp4 beside its stills. Scores are synthetic.` }, null, 2));
  console.log('PASS: clickable option kept its script, a real press at 390 and 1280 was judged and kept as a clip, a dead control was refused, the drawn source is readable beside its option, and Open live serves the clickable page');
} finally { view?.kill(); server.close(); drawnServer.close(); rmSync(dir, { recursive: true, force: true }); }
