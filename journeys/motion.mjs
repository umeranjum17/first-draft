// Nonpaid real-CLI proof that an animated option keeps its motion: a brief that asks for a typing terminal -> make keeps the option's inline
// script -> the frame series at 390 and 1280 sits beside it -> the independent judge is asked about motion and returns a verdict -> the view
// plays the option in its sandboxed frame and lists the frames -> a still page gets no motion score -> one polish round with owner feedback
// still moves. Local stand-ins answer the model and the judge, so scores are synthetic, never design quality.
import '../test/fixtures/provider-hooks.mjs';
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { renderCheck } from '../src/render-check.mjs';
import { PLAIN, standIn } from '../test/fixtures/critic-model.mjs';
import { installJudge } from '../test/fixtures/judge-cli.mjs';
const root = new URL('..', import.meta.url).pathname, out = process.env.DONE_DONE_EVIDENCE_ROOT ?? process.argv[2];
if (!out) throw Error('Give an evidence folder');
mkdirSync(out, { recursive: true });
const BRIEF = 'A home screen for a developer tool, with a terminal that types out the install command (a typing animation)';
// What the stand-in model writes: a terminal that types its lines in an inline script, with a cursor that blinks three times.
const terminal = (title) => `<!doctype html><html><head><title>${title}</title><style>:root{color-scheme:light dark;--bg:#fff;--fg:#111;--term:#eef0f2}@media (prefers-color-scheme: dark){:root{--bg:#101418;--fg:#e8eaed;--term:#000}}
body{margin:0;font:16px/1.5 system-ui,sans-serif;background:var(--bg);color:var(--fg)}main{padding:24px;max-width:720px}pre{margin:0;background:var(--term);padding:16px;min-height:140px;white-space:pre-wrap;font:15px/1.5 ui-monospace,monospace}
.cursor{animation:blink 1s steps(1) 3}@keyframes blink{50%{opacity:0}}@media (prefers-reduced-motion: reduce){.cursor{animation:none}}</style></head>
<body><main><h1>${title}</h1><p>Install first-draft in one line.</p><pre id="term" aria-label="Terminal"></pre><span class="cursor" aria-hidden="true">_</span></main>
<script>const lines=['$ npm install -g first-draft-axi','added 1 package in 2s','$ first-draft-axi make "a notes app"'],t=document.getElementById('term');let i=0,j=0;
const step=()=>{if(i>=lines.length)return;if(j<lines[i].length)t.textContent+=lines[i][j++];else{t.textContent+='\\n';i++;j=0}setTimeout(step,40)};
matchMedia('(prefers-reduced-motion: reduce)').matches?t.textContent=lines.join('\\n'):step();</script></body></html>`;
const dir = mkdtempSync(join(tmpdir(), 'fd-motion-'));
installJudge(dir);
let draws = 0; // each page the stand-in writes is its own, so a polish round is a changed option
const seen = [], server = await standIn(seen, [], false, () => {}, (title) => terminal(`${title}, draw ${++draws}`)), render = renderCheck();
let view;
try {
  const env = { ...process.env, PATH: `${dir}:${process.env.PATH}`, CI: 'true', HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir, OPENCODE_API_KEY: 'synthetic', FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}`, FD_POLISH_SCORES: '[7,8]' };
  const run = async (...args) => JSON.parse((await promisify(execFile)(process.execPath, [join(root, 'src/cli.mjs'), ...args], { env, cwd: dir, maxBuffer: 64_000_000 })).stdout.trim().split('\n').at(-1));
  await run('init', '--agent', 'byokit:opencode-go', '--model', 'muse-spark-1.3-contributor');

  // 1. The animated brief in: the option keeps its script under a policy that runs inline script and loads nothing.
  const { made } = await run('make', BRIEF, '--out', join(dir, 'terminal.html'), '--options', '1');
  const [file] = made.files, html = readFileSync(file.file, 'utf8');
  assert.match(html, /<script>const lines=/, 'the option keeps its inline script');
  assert.match(html, /script-src 'unsafe-inline'/);
  assert.match(html, /default-src 'none'/, 'and still loads nothing from the network');

  // 2. The frame series beside it: at least three frames at 390 and at 1280, and they differ.
  const motion = JSON.parse(readFileSync(join(file.motion.dir, 'motion.json'), 'utf8'));
  for (const width of [390, 1280]) assert.ok(motion.frames.filter((f) => f.width === width).length >= 3, `three frames or more at ${width}`);
  assert.equal(motion.moves, true);
  for (const f of motion.frames) assert.ok(existsSync(join(file.motion.dir, f.file)));

  // 3. The judge was asked about motion, with the frames, and its verdict is the option's.
  const calls = readFileSync(join(dir, 'judge-calls.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.match(calls[0].input, /Images, in attachment order: .*motion-390-1.*motion-1280-4/);
  assert.match(calls[0].system, /also answer motion/);
  assert.deepEqual([file.critique.motion.present, file.critique.motion.score], [true, 7]);
  assert.ok(file.critique.motion.defects.length, 'a motion under 9 names its defects');

  // 4. A page that does not move is not scored as if it did: no motion score, no frames for the judge, and a defect because motion was asked for.
  writeFileSync(join(dir, 'still.html'), PLAIN);
  const judged = await run('judge', join(dir, 'still.html'), BRIEF, '--plain', made.critic.plain);
  assert.deepEqual([judged.critique.motion.present, judged.critique.motion.score, judged.critique.passed], [false, null, false]);
  assert.match(judged.critique.motion.defects[0], /asks for motion/);
  const still = readFileSync(join(dir, 'judge-calls.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)).at(-1);
  assert.doesNotMatch(still.input, /motion-390/);
  assert.doesNotMatch(still.system, /also answer motion/);

  // 5. The view plays it in the sandboxed frame origin, with script and no network, and lists the frames where the option is reviewed.
  view = spawn(process.execPath, [join(root, 'src/cli.mjs'), 'view', file.file, '--host', '127.0.0.1', '--port', '0'], { env, cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] });
  const viewing = await new Promise((ok, fail) => { let log = ''; view.stdout.on('data', (c) => { log += c; const m = log.match(/^\{"viewing".*$/m); if (m) ok(JSON.parse(m[0]).viewing); }); view.once('exit', (code) => fail(new Error(`view exited ${code}: ${log}`))); });
  const framed = await fetch(`${viewing.frames}/o/1`), csp = framed.headers.get('content-security-policy'), played = await framed.text();
  assert.match(csp, /sandbox allow-scripts;/); assert.match(csp, /connect-src 'none'/); assert.match(csp, /script-src 'unsafe-inline'/);
  assert.match(played, /<script>const lines=/, 'the frame the board shows carries the option script');
  const board = await (await fetch(viewing.url)).text(), data = JSON.parse(board.match(/<script type="application\/json" id="design">([\s\S]*?)<\/script>/)[1]);
  assert.equal(data.options[0].motion.frames.length, motion.frames.length);
  const jpeg = await fetch(new URL(data.options[0].motion.frames[0].src, viewing.url));
  assert.equal(jpeg.headers.get('content-type'), 'image/jpeg');
  const live = await render.motion(played.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/i, ''));
  assert.equal(live.moves, true, 'the page the board serves moves in a browser');

  // 6. One polish round with one sentence of owner feedback: the new round keeps the script and still moves, and its judge saw the frames.
  const { polished } = await run('polish', file.file, BRIEF, '--out-dir', join(dir, 'polish'), '--max-rounds', '1', '--feedback', 'Make the terminal type a little slower so the command can be read.');
  const round = polished.rounds.at(-1);
  assert.equal(round.round, 1);
  assert.match(readFileSync(round.file, 'utf8'), /<script>const lines=/);
  const again = JSON.parse(readFileSync(round.file.replace(/\.html$/, '.motion/motion.json'), 'utf8'));
  assert.equal(again.moves, true, 'the polished round still moves');
  assert.equal(round.accepted, true);
  assert.equal(round.critique.motion.present, true);
  const asked = readFileSync(join(dir, 'polish-calls.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)).at(-1);
  assert.equal(asked.q.feedback[0].text, 'Make the terminal type a little slower so the command can be read.');
  assert.ok(asked.q.image_order.filter((i) => i.side === 'MOTION').length >= 6);

  const clean = (o) => JSON.stringify(o, null, 2).replaceAll(dir, '<run>');
  writeFileSync(join(out, 'make.json'), clean({ made }));
  writeFileSync(join(out, 'still-judge.json'), clean(judged));
  writeFileSync(join(out, 'polish.json'), clean({ polished }));
  mkdirSync(join(out, 'frames'), { recursive: true });
  for (const f of readdirSync(file.motion.dir)) copyFileSync(join(file.motion.dir, f), join(out, 'frames', f));
  const head = (await promisify(execFile)('git', ['-C', root, 'rev-parse', 'HEAD'])).stdout.trim();
  writeFileSync(join(out, 'steps.json'), JSON.stringify({ target: { version: `first-draft-axi ${head}, source CLI and Chrome` }, start: 'Task-private HOME and local model and judge stand-ins; no owner state, network model or credentials.',
    steps: ['make an option from a brief that asks for a typing terminal; the stand-in writes it with an inline script', 'read the option, its .motion folder and the judge call', 'judge a page that does not move against the same brief', 'open the option in first-draft-axi view: the frame origin and the board data', 'polish the option for one round with one sentence of owner feedback'],
    result: `The option kept its inline script; ${motion.frames.length} frames at 390 and 1280 were captured and differ; the judge was sent them and returned motion ${file.critique.motion.score}/10 with ${file.critique.motion.defects.length} defect(s); a still page got no motion score; the view serves the script in its sandbox and lists the frames; the polished round still moves. Scores are synthetic.` }, null, 2));
  console.log('PASS: animated option keeps its script, frame series at 390 and 1280, motion verdict from the judge, still page unscored, view plays it, polish keeps motion');
} finally { view?.kill(); render.close(); server.close(); rmSync(dir, { recursive: true, force: true }); }
