// The logo journey on the built CLI and the machine's Chrome, against a local stand-in for the provider (no paid call, no key):
// logo refuses to start without a browser; the stand-in explores six concepts (one with a sketch the allow-list refuses, one whose
// detail dies at 16 px, one the critic calls a smiley, one a cliche), the critic sees them drawn at 16 and 32 px with the person's
// --ref image, and the strongest of different kinds become the options. Each option's engine run first writes files the allow-list,
// the palette and the 16 px detail check refuse, reads done's findings and fixes them; the finished mark is critiqued again: one is
// redone with the critique, one is dropped for the next concept. Each option gets its brand sheet (idea and palette filled in by the
// host) and its .logo/ folder; refine, in the CLI and from the Studio's brief, starts from the option's logo files and writes a new folder.
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';
import { findBrowser } from '../src/render-check.mjs';

const CLI = new URL('../src/cli.mjs', import.meta.url).pathname;
const DESIGN = readFileSync(new URL('../vendor/open-codesign/apps/desktop/resources/templates/scaffolds/design-systems/DESIGN.md', import.meta.url), 'utf8');
const svg = (box, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}">${body}</svg>`;
const leaf = (c, d = 'M48 12C30 28 24 50 48 84C72 50 66 28 48 12Z') => `<path fill="${c}" d="${d}"/>`;
const word = (c, x = 0) => `<path fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round" d="M${x + 12} 12V44M${x + 28} 24V44M${x + 28} 32a10 10 0 0 1 20 0V44"/>`;
// Each concept has a palette of its own, chosen with its idea: [light primary, light accent, dark primary, dark accent].
const palette = (name, [lp, la, dp, da]) => [name, { reason: `${name}: colours that come from its idea and answer a calm, modern shop.`, light: { primary: lp, accent: la, neutral: '#2b2b28' }, dark: { primary: dp, accent: da, neutral: '#f2f1ee' } }];
const PALS = Object.fromEntries([
  ['Leaf cup', ['#2f6b3b', '#a0522d', '#9fd8a6', '#e8b07c']], ['U steam', ['#1f3b2d', '#7a5a3a', '#e9f0e6', '#e0b98f']], ['Smile leaf', ['#6b3f6f', '#a0522d', '#d9b3dd', '#e8b07c']],
  ['Hairline', ['#3d5a80', '#a0522d', '#a9c4e8', '#e8b07c']], ['Typed U', ['#8a2f2f', '#4a6b3a', '#f0b0b0', '#a9d08c']], ['Pebble', ['#5b5b52', '#a0522d', '#d6d6cc', '#e8b07c']],
  ['Pour', ['#1c4e5c', '#b8741a', '#8fd0e0', '#f0c070']], ['Lid', ['#6a3d1e', '#2f6b3b', '#e0b890', '#9fd8a6']], ['Bud', ['#2f6b3b', '#a0522d', '#9fd8a6', '#e8b07c']],
  ['Ring', ['#3d3d8a', '#a0522d', '#b8b8f0', '#e8b07c']], ['Fold', ['#8a2f6b', '#2f6b3b', '#f0b0d8', '#9fd8a6']], ['Dew', ['#1c7a6e', '#a0522d', '#8fe0d4', '#e8b07c']],
].map(([name, c]) => palette(name, c)));
// A concept's logo files in its palette, then variants the host refuses.
const kit = (full) => {
  const INK = full.light.primary, MILK = full.dark.primary;
  const CLEAN = Object.fromEntries([['', INK], ['-dark', MILK]].flatMap(([s, c]) => [
    [`mark${s}.svg`, svg('0 0 96 96', leaf(c))],
    [`wordmark${s}.svg`, svg('0 0 64 56', word(c))],
    [`lockup-horizontal${s}.svg`, svg('0 0 168 96', `${leaf(c)}${word(c, 100)}`)],
    [`lockup-stacked${s}.svg`, svg('0 0 96 160', `${leaf(c)}<g transform="translate(16 100)">${word(c)}</g>`)],
  ]).concat([['icon.svg', svg('0 0 96 96', `<rect width="96" height="96" fill="${INK}"/><g transform="translate(19.2 19.2) scale(.6)">${leaf(MILK)}</g>`)], ['palette.json', JSON.stringify(full)]]));
  // Refused: <text>, an <image> from outside, a non-square icon, and a palette.json the model changed (the host wrote it from the concept).
  const REFUSED = { ...CLEAN, 'mark.svg': svg('0 0 96 96', '<text x="10" y="50">U</text>'), 'wordmark.svg': svg('0 0 64 56', '<image href="https://example.com/w.png" width="64" height="56"/>'), 'icon.svg': CLEAN['icon.svg'].replace('0 0 96 96', '0 0 96 64'),
    'palette.json': JSON.stringify({ ...full, light: { ...full.light, accent: '#555555' } }) };
  // Two bars two units apart: two parts at 512 px, one blur at 16 px.
  const THIN = { ...CLEAN, 'icon.svg': svg('0 0 96 96', `<rect width="96" height="96" fill="${INK}"/><rect x="26" y="30" width="21" height="36" fill="${MILK}"/><rect x="49" y="30" width="21" height="36" fill="${MILK}"/>`) };
  return { CLEAN, REFUSED, THIN, pal: full };
};
for (const [name, c] of Object.entries(PALS)) PALS[`${name} again`] = c;
const KITS = Object.fromEntries(Object.entries(PALS).map(([name, pal]) => [name, kit(pal)]));
const CLEAN = KITS['U steam'].CLEAN, PALETTE = PALS['U steam'];
const SHEET = (slots = true) => `<!doctype html><html lang="en"><head><title>Umer's tea shop</title><style>:root{--bg:#f7f4ee;--fg:#1d1d1b;color-scheme:light dark}@media (prefers-color-scheme: dark){:root{--bg:#141513;--fg:#ecebe6}}
body{margin:0;padding:24px;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif}img{max-width:100%;height:auto}.tiles{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))}.tiles>*{min-width:0;padding:16px;background:#fff}.tiles>.night{background:#121212}</style></head>
<body><h1>Umer's tea shop</h1>${slots ? '<p data-logo="idea"></p>' : '<p>A leaf.</p>'}<img src="logo/mark.svg" alt="Mark" width="160">${slots ? '<div data-logo="palette"></div>' : ''}<div class="tiles">${['wordmark', 'lockup-horizontal', 'lockup-stacked'].map((n) => `<div><img src="logo/${n}.svg" alt="${n}"></div>`).join('')}
${['mark', 'wordmark', 'lockup-horizontal', 'lockup-stacked'].map((n) => `<div class="night"><img src="logo/${n}-dark.svg" alt="${n} on dark"></div>`).join('')}</div>
<p><img src="logo/icon.svg" alt="App icon" width="96"> <img src="logo/icon-16.png" width="16" height="16" alt="Icon at 16 px"> <img src="logo/icon-32.png" width="32" height="32" alt="Icon at 32 px"></p></body></html>`;
// The concepts the stand-in explores, and what its critic says of each sketch and, by name, of each finished mark in turn.
const sketch = (body) => svg('0 0 96 96', body);
const concept = (k) => ({ shape: 'A few shapes on the 96 grid.', avoid: 'A face.', ...k, palette: PALS[k.name] });
const CONCEPTS = [
  { kind: 'symbol', name: 'Leaf cup', idea: 'A cup with a leaf above it.', sketch: sketch(`<path fill="#2f6b3b" d="M16 48h64a32 32 0 0 1-64 0z"/>${leaf('#7a5a3a', 'M48 40C38 30 40 16 48 8C56 16 58 30 48 40Z')}`) },
  { kind: 'letter', name: 'U steam', idea: 'The U of Umer whose right stem rises as a curl of steam.', sketch: sketch(`<path fill="#1f3b2d" d="M20 16h16v40a12 12 0 0 0 24 0V16h16v40a28 28 0 0 1-56 0z"/>`) },
  { kind: 'negative-space', name: 'Smile leaf', idea: 'A leaf with a U cut out of it.', sketch: sketch(`<path fill="#6b3f6f" fill-rule="evenodd" d="M48 8C76 28 80 60 48 90C16 60 20 28 48 8ZM36 40V56A12 12 0 0 0 60 56V40H52V56A4 4 0 0 1 44 56V40Z"/>`) },
  { kind: 'abstract', name: 'Hairline', idea: 'Two leaves of a tea bud side by side, a hair apart.', sketch: sketch(`<rect x="16" y="16" width="31" height="64" fill="#3d5a80"/><rect x="49" y="16" width="31" height="64" fill="#3d5a80"/>`) },
  { kind: 'symbol+letter', name: 'Typed U', idea: 'A U set in type.', sketch: sketch('<text x="20" y="70">U</text>') },
  { kind: 'abstract', name: 'Pebble', idea: 'A smooth river pebble: calm, warm, held in the hand.', sketch: sketch(`<circle cx="48" cy="48" r="34" fill="#5b5b52"/>`) },
].map(concept);
const SAYS = { 'Leaf cup': { verdict: 'drop', score: 4, cliche: 'a cup with a leaf', fix: 'The stock tea image; nothing twists it.' }, 'U steam': { verdict: 'keep', score: 8 }, 'Smile leaf': { verdict: 'keep', score: 7, misreads: ['a smiley face'] },
  Hairline: { verdict: 'keep', score: 9 }, Pebble: { verdict: 'keep', score: 6 } };
// The second look at U steam says redo but scores 8 and names no serious flaw: that is a keep.
const FINAL = { 'U steam': [{ verdict: 'redo', score: 6, misreads: [], fix: 'Open the curl so the steam reads at 16 px.' }, { verdict: 'redo', score: 8, fix: 'Could be bolder.' }], Pebble: [{ verdict: 'drop', score: 3, cliche: '', reads_as: 'a dot', fix: 'At 16 px it is a dot: the idea cannot carry.' }],
  Hairline: [{ verdict: 'redo', score: 5, fix: 'Widen the gap.' }, { verdict: 'redo', score: 4, misreads: ['a pause button'], fix: 'Still a pause button.' }] };
// Round two: the critic dropped every drawn mark in round one, so the stand-in proposes six more concepts when it is shown the critic's advice.
const bud = (k) => concept({ shape: 'A few shapes on the 96 grid.', ...k, sketch: sketch(`<circle cx="48" cy="48" r="${k.r}" fill="${PALS[k.name].light.primary}"/>`) });
const ROUND1 = [['symbol', 'Bud', 'A tea bud held between two pinched leaves.', 34], ['letter', 'Lid', 'A U with a lid.', 33], ['abstract', 'Ring', 'A ring of still water.', 32], ['negative-space', 'Fold', 'A folded leaf.', 31], ['symbol', 'Dew', 'A drop on a leaf.', 30], ['abstract', 'Pour', 'One stroke that pours.', 29]]
  .map(([kind, name, idea, r]) => bud({ kind, name, idea, r }));
const ROUND2 = ROUND1.map((k) => ({ ...k, name: `${k.name} again`, palette: PALS[k.name] }));
const said = (m, s = {}) => ({ id: m.id, reads_as: s.reads_as ?? m.name.toLowerCase(), intended: true, small: true, misreads: s.misreads ?? [], cliche: s.cliche ?? '', plain_letter: false, resembles_reference: '', score: s.score, verdict: s.verdict, fix: s.fix ?? '' });
const ADVICE = 'Look for one stroke that both pours and curls, forming a U.';
const WORLD2 = { proposals: [ROUND1, ROUND2], says: Object.fromEntries([...ROUND1, ...ROUND2].map((k) => [k.name, k.name === 'Bud' || k.name === 'Pour again' ? { verdict: 'keep', score: 8 } : { verdict: 'drop', score: 3, cliche: 'a stock image', fix: 'Not this.' }])),
  finals: { Bud: [{ verdict: 'redo', score: 5, misreads: ['a horseshoe'], fix: ADVICE }, { verdict: 'drop', score: 3, misreads: ['a horseshoe'], fix: 'Still a horseshoe.' }], 'Pour again': [{ verdict: 'keep', score: 8 }] } };
const WORLD1 = { proposals: [CONCEPTS], says: SAYS, finals: FINAL };

const ev = (o) => `event: ${o.type}\ndata: ${JSON.stringify(o)}\n\n`;
const create = (path, file_text) => ['str_replace_based_edit_tool', { command: 'create', path, file_text }];
const userMessages = (body) => JSON.parse(body).input.filter((m) => m.role === 'user').map((m) => typeof m.content === 'string' ? m.content : m.content.filter((p) => p.type === 'input_text').map((p) => p.text).join('\n'));
const userText = (body) => userMessages(body).join('\n');
const outputs = (body) => JSON.parse(body).input.filter((m) => m.type === 'function_call_output').map((m) => typeof m.output === 'string' ? m.output : JSON.stringify(m.output));
// A stand-in model: it answers the concept and critique calls by their tool, and runs one script per engine conversation (told apart by
// their first message, so options drawn in parallel do not mix). U steam's new logo plans, writes DESIGN.md, refused logo files and a sheet
// without its slots, runs done, fixes them but leaves an icon whose detail dies at 16 px, runs done, fixes the icon and runs done again;
// later new logos write clean files in their palette at once. A revise (a redo from the critique, or a refine) writes DESIGN.md (done needs
// it), views the mark (the editor needs it), makes the leaf rounder in the colour the view showed and runs done. Engine replies take 40 ms,
// so overlapping conversations interleave in `trace`.
function standIn(seen, world = WORLD1, trace = []) {
  const convo = new Map();
  let revises = 0, proposals = 0;
  const finals = {};
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', async () => {
      seen.push(body);
      const user = userText(body);
      let calls, delay = 0;
      if (body.includes('"propose_concepts"')) {
        // The first answer of a world overruns a palette: its reason is fine but one accent is a pale colour on white; the re-ask names it.
        const list = world.proposals[user.includes('critic_advice') ? 1 : 0].map((k, i) => i === 5 && !user.includes('was not usable') && !user.includes('critic_advice') && world === WORLD1 ? { ...k, palette: { ...k.palette, light: { ...k.palette.light, accent: '#e9f0e6' } } } : k);
        calls = [['propose_concepts', { concepts: list }]];
      } else if (body.includes('"critique_marks"')) {
        const { marks } = JSON.parse(user.slice(0, user.lastIndexOf('}') + 1));
        // The first look at the sketches overruns fix; the re-ask says exactly what is wrong and the second answer fits.
        const first = marks.length > 1 && !user.includes('was not usable');
        calls = [['critique_marks', { marks: marks.length > 1 ? marks.map((m) => said(m, { ...world.says[m.name], ...(first && world === WORLD1 && m.name === 'Leaf cup' && { fix: 'x'.repeat(900) }) })) : [said(marks[0], world.finals[marks[0].name][(finals[marks[0].name] = (finals[marks[0].name] ?? -1) + 1)])] }]];
      } else {
        delay = 40;
        const key = userMessages(body)[0];
        if (!body.includes('function_call_output')) {
          const revise = key.includes('Revise this logo option');
          if (revise) revises++;
          convo.set(key, { n: 0, script: revise ? 'revise' : key.includes(': U steam. Idea') ? 'make' : 'clean', name: key.match(/Concept \d+ of the \d+ explored[^,]*, [^:]+: ([^.]+)\./)?.[1], revise: revises });
        }
        const st = convo.get(key), n = st.n++;
        trace.push(key.slice(0, 80));
        const { CLEAN, REFUSED, THIN, pal } = KITS[st.name] ?? KITS['U steam'];
        const write = (set, slots) => [...Object.entries(set).map(([f, t]) => create(`logo/${f}`, t)), ...(slots === undefined ? [] : [create('index.html', SHEET(slots))])];
        const color = outputs(body).at(-1)?.match(/fill=\\?"(#[0-9a-f]{6})\\?"/i)?.[1] ?? pal.light.primary;
        const round = `M48 ${12 + 2 * st.revise}C26 30 22 52 48 84C74 52 70 30 48 ${12 + 2 * st.revise}Z`;
        calls = {
          make: [[['set_todos', { items: [{ text: 'Draw the logo files and the sheet', checked: false }] }]], [create('DESIGN.md', DESIGN), ...write(REFUSED, false)], [['done', { path: 'index.html' }]], write(THIN, true), [['done', { path: 'index.html' }]], write({ 'icon.svg': CLEAN['icon.svg'] }), [['done', { path: 'index.html' }]]],
          clean: [[create('DESIGN.md', DESIGN), ...write(CLEAN, true)], [['done', { path: 'index.html' }]]],
          revise: [[['set_todos', { items: [{ text: 'Round the leaf', checked: false }] }]],
            [create('DESIGN.md', DESIGN), ['str_replace_based_edit_tool', { command: 'view', path: 'logo/mark.svg' }]],
            [create('logo/mark.svg', svg('0 0 96 96', leaf(color, round)))],
            [['done', { path: 'index.html' }]]],
        }[st.script][n];
      }
      const items = calls ? calls.map(([name, args], i) => ({ type: 'function_call', id: `fc${seen.length}-${i}`, call_id: `c${seen.length}-${i}`, name, arguments: JSON.stringify(args) }))
        : [{ type: 'message', id: 'm1', status: 'completed', content: [{ type: 'output_text', text: 'The logo is ready.' }] }];
      if (delay) await new Promise((r) => setTimeout(r, delay));
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.end(items.map((item, output_index) => ev({ type: 'response.output_item.added', output_index, item }) + ev({ type: 'response.output_item.done', output_index, item })).join('')
        + ev({ type: 'response.completed', response: { id: `r${seen.length}`, status: 'completed', usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } } }));
    });
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}
const told = (bodies) => bodies.flatMap((s) => JSON.parse(s).input ?? []).filter((m) => m.type === 'function_call_output').map((m) => typeof m.output === 'string' ? m.output : JSON.stringify(m.output)).join('\n');
const png = (file) => { const b = readFileSync(file); assert.equal(b.subarray(1, 4).toString(), 'PNG'); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('logo: concepts explored and critiqued at 16 and 32 px become options with their idea and palette; marks are redone or dropped; refine starts from the logo files', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-logo-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const seen = [], trace = [], server = await standIn(seen, WORLD1, trace);
  t.after(() => server.close());
  const env = { ...process.env, CI: 'true', HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir, OPENCODE_API_KEY: 'test-key', FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}` };
  const run = (args, more = {}) => promisify(execFile)(process.execPath, [CLI, ...args], { env: { ...env, ...more }, cwd: dir });
  await run(['init', '--agent', 'byokit:opencode-go', '--model', 'muse-spark-1.3-contributor']);
  const brief = "Umer's tea shop, calm and modern", out = join(dir, 'tea.html');

  await assert.rejects(run(['logo', brief, '--out', out], { FIRST_DRAFT_CHROME: join(dir, 'no-browser') }), (e) => {
    assert.equal(JSON.parse(e.stdout).error.code, 'MAKE_FAILED');
    assert.match(JSON.parse(e.stdout).error.message, /logo needs Chrome or Chromium/);
    return true;
  });
  assert.equal(seen.length, 0, 'no browser, no model call');
  for (const bad of [['--like', 'https://logosystem.co/'], ['--options', '6'], ['--assets', 'codex']]) await assert.rejects(run(['logo', brief, '--out', out, ...bad]), (e) => JSON.parse(e.stdout).error.code === 'USAGE');
  if (!findBrowser()) return t.skip('no Chrome or Chromium on this machine');
  assert.equal(JSON.parse((await run(['styles', '--logo'])).stdout).logo_directions[0].id, 'geometric-symbol');

  const reference = join(dir, 'reference.png');
  await promisify(execFile)('convert', ['-size', '3x2', 'xc:purple', reference]);
  const result = JSON.parse((await run(['logo', brief, '--out', out, '--options', '2', '--ref', reference])).stdout), { made } = result;
  assert.equal(made.files.length, 2);
  assert.notEqual(result.concepts[0].palette, result.concepts[1].palette, 'each concept has its own colours');
  assert.deepEqual([result.rounds, result.exploration, result.timing.concurrency], [1, { off: 'CI never generates images' }, 3]);
  // Six concepts explored with the --ref image; the critic saw the five clean sketches drawn on one board beside it, and its verdicts
  // were overruled where the host found a flaw: a smiley is not a keep, nor is a mark whose detail dies at 16 px.
  const [proposeCall, reasked] = seen.filter((b) => b.includes('"propose_concepts"')), [overrun, conceptCritique, ...finalCritiques] = seen.filter((b) => b.includes('"critique_marks"'));
  assert.ok(!userText(overrun).includes('not usable'));
  // Every concept brings a palette of its own, checked as a palette file is: a pale accent on white sends the proposal back once, naming it.
  assert.match(userText(reasked), /Your last propose_concepts call was not usable: concept 6 palette "light"\."accent" #e9f0e6 is 1\.\d:1 on white; it needs 3:1 or more/);
  assert.match(userText(conceptCritique), /Your last critique_marks call was not usable: mark 1 fix is 900 characters; keep it to 800 or less\./);
  assert.match(proposeCall, /input_image/);
  assert.equal((conceptCritique.match(/"type":"input_image"/g) ?? []).length, 2, 'the board and the --ref image');
  assert.deepEqual(JSON.parse(userText(overrun)).marks.map((m) => m.name), ['Leaf cup', 'U steam', 'Smile leaf', 'Hairline', 'Pebble']);
  const status = Object.fromEntries(result.concepts.map((k) => [k.name, k]));
  assert.deepEqual(Object.fromEntries(result.concepts.map((k) => [k.name, k.status])), { 'Leaf cup': 'dropped', 'U steam': 'chosen', 'Smile leaf': 'reserve', Hairline: 'reserve', 'Typed U': 'dropped', Pebble: 'chosen' });
  assert.equal(status['Smile leaf'].verdict, 'redo');
  assert.deepEqual(status['Smile leaf'].flaws, ['reads as a smiley face']);
  assert.match(status.Hairline.flaws.join(), /loses detail at 16 px: 2 distinct parts at 512 px but 1 at 16 px/);
  assert.match(status['Typed U'].flaws.join(), /the sketch is not clean SVG: <text> is not allowed/);
  // Option 1 refines U steam: the critic sent it back once, the redo went to the engine as a revise, and the second look kept it.
  // Option 2 was Pebble, dropped by the critic as a dot at 16 px, so the next concept of the queue, Hairline, took its place; its redo
  // read as a pause button and scored lower, so no attempt passed and the best-scored one, Hairline's first, is the option, flagged, with
  // the critique of that attempt only. Every other attempt is kept for review.
  assert.deepEqual(made.files.map((f) => [f.concept.name, f.passed]), [['U steam', true], ['Hairline', false]]);
  assert.ok(seen.some((b) => b.includes('Revise this logo option: Self-critique of this logo at 16 and 32 px') && b.includes('Open the curl so the steam reads at 16 px.')));
  assert.deepEqual(result.dropped.map((d) => [d.name, d.critique.verdict, d.critique.score, d.option]), [['Pebble', 'drop', 3, undefined], ['Hairline', 'redo', 4, 'kept as the best attempt, flagged as not passing']]);
  assert.match(result.help[0], /1 option\(s\) did not pass the self-critique/);
  assert.equal(finalCritiques.length, 5);
  for (const [option, attempts] of [[1, ['concept-2-first']], [2, ['concept-6-first', 'concept-4-redo']]]) {
    assert.deepEqual(readdirSync(join(dir, `tea-${option}.dropped`)).sort(), attempts.flatMap((a) => [`${a}.html`, `${a}.logo`]).sort());
    for (const a of attempts) assert.equal(JSON.parse(readFileSync(join(dir, `tea-${option}.dropped`, `${a}.logo`, 'logo.json'), 'utf8')).dropped, true);
  }
  assert.equal(made.files[1].dropped_attempts, join(dir, 'tea-2.dropped'));
  for (const b of finalCritiques) assert.match(b, /"input_image"[^]*"input_image"/, 'the finished mark board and the --ref image');
  const engine = seen.find((b) => b.includes('first-draft logo mode') && b.includes('U steam'));
  assert.match(engine, /Logo direction: Concept 2 of the 6 explored, letter: U steam\. Idea: The U of Umer/);
  assert.match(engine, /Its palette is in logo\/palette\.json \(U steam: colours that come from its idea/);
  // The two options were drawn at the same time: their engine conversations interleave.
  assert.ok(trace.some((a, i) => trace.slice(i + 1).some((b, j) => b !== a && trace.slice(i + j + 2).includes(a))), `engine conversations overlap: ${JSON.stringify(trace.map((x) => x.slice(40, 70)))}`);
  // done refused the first files and said why, file by file; the model fixed them in the loop.
  const findings = told(seen);
  assert.match(findings, /logo\/mark\.svg: <text> is not allowed: draw every letter as a path/);
  assert.match(findings, /logo\/wordmark\.svg: <image> is not allowed/);
  assert.match(findings, /logo\/wordmark\.svg: <image href=\\?"https:\/\/example\.com\/w\.png\\?"> links outside the file/);
  assert.match(findings, /logo\/icon\.svg: its viewBox is 96 by 64, not square/);
  assert.match(findings, /logo\/palette\.json: is not this concept's palette; the host wrote it from the idea and it must stay exactly/);
  assert.match(findings, /the brand sheet needs exactly one empty <p data-logo=\\?"idea\\?"><\/p>/);
  assert.match(findings, /logo\/icon\.svg: loses its detail at 16 px: 2 distinct parts at 512 px but 1 at 16 px/);
  for (const [i, f] of made.files.entries()) {
    const folder = join(dir, `tea-${i + 1}.logo`);
    assert.equal(f.file, join(dir, `tea-${i + 1}.html`));
    assert.equal(f.logo_dir, folder);
    const { CLEAN, pal } = KITS[f.concept.name];
    assert.deepEqual(readdirSync(folder).sort(), [...Object.keys(CLEAN), ...[16, 32, 48, 180, 192, 512, 1024].map((n) => `icon-${n}.png`), 'favicon.ico', 'logo.json', 'concepts.png', 'critique.png'].sort());
    for (const [name, text] of Object.entries(CLEAN)) if (name !== 'mark.svg' && name !== 'palette.json') assert.equal(readFileSync(join(folder, name), 'utf8'), text, name);
    assert.deepEqual(JSON.parse(readFileSync(join(folder, 'palette.json'), 'utf8')), pal, 'palette.json is the concept\'s palette');
    if (i === 0) assert.match(readFileSync(join(folder, 'mark.svg'), 'utf8'), /fill="#1f3b2d" d="M48 1\dC26 30 22 52 48 84/, 'the redo changed the mark, in the concept\'s colour');
    else assert.equal(readFileSync(join(folder, 'mark.svg'), 'utf8'), CLEAN['mark.svg'], 'the first attempt is the one shown');
    for (const n of [16, 32, 48, 180, 192, 512, 1024]) assert.deepEqual(png(join(folder, `icon-${n}.png`)), [n, n], `icon-${n}.png is ${n} px`);
    for (const board of ['concepts.png', 'critique.png']) png(join(folder, board));
    const ico = readFileSync(join(folder, 'favicon.ico'));
    assert.deepEqual([ico.readUInt16LE(2), ico.readUInt16LE(4)], [1, 3]);
    for (const [k, n] of [16, 32, 48].entries()) {
      const at = ico.readUInt32LE(6 + 16 * k + 12), size = ico.readUInt32LE(6 + 16 * k + 8);
      assert.equal(ico.readUInt8(6 + 16 * k), n);
      assert.deepEqual(ico.subarray(at, at + size), readFileSync(join(folder, `icon-${n}.png`)), `favicon.ico holds icon-${n}.png`);
    }
    const logo = JSON.parse(readFileSync(join(folder, 'logo.json'), 'utf8'));
    assert.equal(logo.brief, brief);
    assert.equal(logo.concept.name, f.concept.name);
    assert.equal(logo.concept.idea, CONCEPTS.find((k) => k.name === f.concept.name).idea);
    assert.equal(logo.explored.length, 6);
    assert.deepEqual(logo.critique.map((c) => [c.round, c.verdict, c.score]), i === 0 ? [['first', 'redo', 6], ['redo', 'keep', 8]] : [['first', 'redo', 5]]);
    assert.deepEqual(f.critique, logo.critique.at(-1));
    assert.equal(logo.passed, i === 0);
    assert.match(logo.critic, /same model/);
    assert.deepEqual({ reason: logo.palette.reason, light: logo.palette.light, dark: logo.palette.dark }, pal);
    assert.deepEqual(logo.concept.palette, pal, 'the palette was chosen with the concept');
    assert.ok(Object.entries(logo.palette.contrast.light).every(([role, v]) => role === 'ground' || v >= 3), JSON.stringify(logo.palette.contrast));
    if (i === 0) assert.deepEqual(logo.palette.contrast.light, { ground: '#ffffff', primary: 12.2, accent: 6.3, neutral: 14.2 });
    assert.equal(logo.exploration, 'CI never generates images', 'no provider in CI: drawn from the idea alone');
    assert.ok(!existsSync(join(folder, 'exploration.webp')));
    assert.ok(logo.timing.concurrency === 3 && logo.timing.total_s >= logo.timing.drawing_s && Number.isInteger(logo.timing.option_s), JSON.stringify(logo.timing));
    assert.equal(logo.explored[1].palette, '#1f3b2d');
    assert.equal(logo.checks.icon.full_bleed, true);
    assert.equal(logo.checks.icon.outside_safe_zone, 0);
    assert.ok(logo.checks.icon.ink_16 >= 0.06 && logo.checks.icon.contrast_16 >= 3, JSON.stringify(logo.checks.icon));
    assert.deepEqual([logo.checks.detail_16['icon.svg'].parts_512, logo.checks.detail_16['icon.svg'].thin_features], [1, 0]);
    assert.ok(Object.values(logo.checks.tiles).every((x) => x.contrast >= 3), JSON.stringify(logo.checks.tiles));
    assert.deepEqual(f.checks, logo.checks);
    // The sheet is one self-contained page: every logo file embedded as itself, the idea and the palette written in by the host.
    const sheet = readFileSync(f.file, 'utf8');
    assert.match(sheet, /Content-Security-Policy/);
    for (const name of Object.keys(CLEAN)) if (name !== 'palette.json') assert.ok(sheet.includes(`data:image/svg+xml;base64,${readFileSync(join(folder, name)).toString('base64')}`), `the sheet shows ${name}`);
    assert.ok(sheet.includes(`data:image/png;base64,${readFileSync(join(folder, 'icon-16.png')).toString('base64')}`), 'the sheet shows the 16 px icon');
    assert.doesNotMatch(sheet, /src="logo\//);
    assert.ok(sheet.includes(`<p data-logo="idea"><!--logo:idea-->${logo.concept.idea}${i === 0 ? '' : '<br><strong>Did not pass the self-critique.</strong> A stranger sees "hairline" (score 5 of 10). Shown as the best attempt.'}<!--/logo:idea--></p>`));
    assert.ok(new RegExp(`<div data-logo="palette"><!--logo:palette-->[^]*${f.concept.name}: colours that come from its idea[^]*Primary ${pal.light.primary}<br><small>\\d+\\.\\d:1 contrast, passes 3:1[^]*Dark, on #121212[^]*<!--/logo:palette--></div>`).test(sheet));
  }

  // refine: the logo files and the sheet (with each file named by its path again, and its slots empty) seed the engine; only the mark changes.
  const before = seen.length;
  const refined = JSON.parse((await run(['refine', join(dir, 'tea-2.html'), 'a rounder leaf', '--out', join(dir, 'tea-round.html')])).stdout).refined;
  assert.match(seen[before], /Revise this logo option: a rounder leaf/);
  assert.match(seen[before], /data-logo=\\"idea\\"><\/p>/);
  assert.equal(refined.logo_dir, join(dir, 'tea-round.logo'));
  assert.notEqual(readFileSync(join(dir, 'tea-round.logo', 'mark.svg'), 'utf8'), readFileSync(join(dir, 'tea-2.logo', 'mark.svg'), 'utf8'));
  assert.equal(readFileSync(join(dir, 'tea-round.logo', 'wordmark.svg'), 'utf8'), KITS.Hairline.CLEAN['wordmark.svg']);
  const round = JSON.parse(readFileSync(join(dir, 'tea-round.logo', 'logo.json'), 'utf8'));
  assert.equal(round.refined_from, join(dir, 'tea-2.html'));
  assert.equal(round.concept.name, 'Hairline');
  assert.ok(readFileSync(join(dir, 'tea-round.html'), 'utf8').includes(`<!--logo:idea-->${round.concept.idea}<!--/logo:idea-->`));
  assert.ok(!readFileSync(join(dir, 'tea-2.html'), 'utf8').includes(readFileSync(join(dir, 'tea-round.logo', 'mark.svg')).toString('base64')), 'the option it came from is untouched');

  // The Studio's brief runs the same refine: the new option joins the design with its own logo folder.
  const view = spawn(process.execPath, [CLI, 'view', out, '--host', '127.0.0.1', '--port', '0'], { env });
  t.after(() => view.kill());
  const url = JSON.parse(await new Promise((ok) => view.stdout.once('data', ok))).viewing.url;
  const sent = await fetch(`${url}refine`, { method: 'POST', headers: { 'content-type': 'application/json', origin: new URL(url).origin }, body: JSON.stringify({ option: 2, change: 'a rounder leaf' }) });
  assert.equal(sent.status, 200, await sent.clone().text());
  assert.deepEqual(await sent.json(), { option: { n: 3, label: 'tea-2-refined', file: 'tea-2-refined.html' } });
  assert.notEqual(readFileSync(join(dir, 'tea-2-refined.logo', 'mark.svg'), 'utf8'), readFileSync(join(dir, 'tea-2.logo', 'mark.svg'), 'utf8'));
  assert.ok(existsSync(join(dir, 'tea-2-refined.logo', 'favicon.ico')));
});

test('logo: image-first exploration through the asset provider, and a second round from the critic\'s advice when it drops every drawn mark', async (t) => {
  if (!findBrowser()) return t.skip('no Chrome or Chromium on this machine');
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-logo-images-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  // A Higgsfield that is ready and makes one image (a real PNG that the host converts with ImageMagick), and a fetch that serves it.
  const bin = join(dir, 'bin'), log = join(dir, 'calls'), mark = join(dir, 'mark.png');
  mkdirSync(bin);
  await promisify(execFile)('convert', ['-size', '16x16', 'xc:#2f6b3b', mark]);
  writeFileSync(join(bin, 'higgsfield'), `#!${process.execPath}\nimport {appendFileSync} from 'node:fs';\nconst a=process.argv.slice(2);appendFileSync(${JSON.stringify(log)},JSON.stringify(a)+'\\n');\nif(a[0]==='account')console.log('{"credits":10}');else if(a[1]==='cost')console.log('{"credits":0.15}');else console.log('[{"status":"completed","job_type":"z_image","result_url":"https://fixture.invalid/mark.png"}]');`, { mode: 0o755 });
  writeFileSync(join(bin, 'magick'), '#!/bin/sh\nexec convert "$@"\n', { mode: 0o755 }); // ImageMagick 6 (a CI runner) has convert and no magick
  const hook = join(dir, 'fetch.mjs');
  writeFileSync(hook, `const real=globalThis.fetch;globalThis.fetch=(url,options)=>url==='https://fixture.invalid/mark.png'?Promise.resolve(new Response(Buffer.from('${readFileSync(mark).toString('base64')}','base64'))):real(url,options);`);
  const seen = [], server = await standIn(seen, WORLD2);
  t.after(() => server.close());
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, CI: '', HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir, OPENCODE_API_KEY: 'test-key', FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}` };
  const run = (args) => promisify(execFile)(process.execPath, ['--import', hook, CLI, ...args], { env, cwd: dir });
  await run(['init', '--agent', 'byokit:opencode-go', '--model', 'muse-spark-1.3-contributor']);
  await assert.rejects(run(['logo', 'Umer\'s tea shop', '--out', join(dir, 'x.html'), '--explore', 'midjourney']), (e) => /Unknown asset provider: midjourney/.test(e.stdout));
  const result = JSON.parse((await run(['logo', 'Umer\'s tea shop, calm and modern', '--out', join(dir, 'tea.html'), '--options', '1', '--explore', 'higgsfield'])).stdout), [file] = result.made.files;

  // Round one's only drawn mark was dropped by the critic (a horseshoe), so the second round explored again from the critic's own words.
  const [first, second] = seen.filter((b) => b.includes('"propose_concepts"')).map(userText);
  assert.doesNotMatch(first, /critic_advice/);
  assert.match(second, /critic_advice/);
  for (const advice of [ADVICE, 'a horseshoe', 'Ideas already tried \\(do not repeat them\\): Bud, Lid', 'Sketches the critic dropped before anything was drawn']) assert.match(second, new RegExp(advice.replaceAll('.', '\\.')), advice);
  assert.match(seen.filter((b) => b.includes('"propose_concepts"')).at(1), /This is a second round/);
  assert.equal(result.rounds, 2);
  assert.deepEqual(result.second_round, { reason: 'the critic dropped every drawn mark in the first round; the second explored new concepts from its reasons and advice', passed: 1 });
  assert.deepEqual([file.concept.name, file.passed], ['Pour again', true]);
  assert.deepEqual(result.concepts.map((k) => [k.id, k.round]), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((id) => [id, id > 6 ? 2 : 1]));
  assert.deepEqual(result.dropped.map((d) => [d.name, d.critique.verdict, d.option]), [['Bud', 'drop', 'kept as the best attempt, flagged as not passing']]);
  const folder = join(dir, 'tea.logo');
  assert.deepEqual(readdirSync(join(dir, 'tea.dropped')).sort(), ['concept-1-first.html', 'concept-1-first.logo', 'concept-1-redo.html', 'concept-1-redo.logo'], 'round one\'s attempts stay for review');
  const logo = JSON.parse(readFileSync(join(folder, 'logo.json'), 'utf8'));
  assert.equal(logo.explored.length, 12);
  assert.ok(existsSync(join(folder, 'concepts-round2.png')) && existsSync(join(folder, 'concepts.png')));
  assert.ok(Number.isInteger(logo.timing.second_round_s) && logo.timing.total_s >= logo.timing.second_round_s, JSON.stringify(logo.timing));
  assert.deepEqual(logo.palette.light, PALS['Pour'].light, 'the second round concept brought its own palette');

  // Image-first: each concept tried was shown to the provider and its raster went to the engine as a reference to redraw as SVG.
  const created = readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse).filter((a) => a[0] === 'generate' && a[1] === 'create');
  assert.equal(created.length, 2, 'one image for Bud, one for Pour again');
  assert.match(created[0].join(' '), /Concept "Bud": A tea bud held between two pinched leaves\./);
  const engines = seen.filter((b) => b.includes('first-draft logo mode'));
  assert.ok(engines.length >= 3 && engines.every((b) => b.includes('"type":"input_image"')), 'every engine turn carries the exploration image');
  assert.match(engines[0], /The last attached image is a raster exploration of this concept by an image model/);
  assert.deepEqual(result.exploration, { provider: 'higgsfield', images: [{ concept: 'Pour again', seconds: result.exploration.images[0].seconds }] });
  assert.deepEqual([logo.exploration.provider, logo.exploration.image], ['higgsfield', 'exploration.webp']);
  assert.equal(readFileSync(join(folder, 'exploration.webp')).subarray(8, 12).toString(), 'WEBP');
  assert.equal(readdirSync(join(dir, 'tea.explore')).length, 2, 'the generated files are kept');

  // No provider ready (or CI, or --explore none): the logo is drawn from the idea alone, as before, and says why.
  const { exploreImages } = await import('../src/logo-images.mjs');
  const path = process.env.PATH, ci = process.env.CI;
  try {
    process.env.PATH = join(dir, 'empty'); process.env.CI = '';
    assert.match((await exploreImages({ spec: 'auto', count: 1, brief: 'x', dir })).off, /^no image provider is ready/);
    assert.equal((await exploreImages({ spec: 'none', count: 1, brief: 'x', dir })).off, 'switched off with --explore none');
    process.env.CI = 'true';
    assert.equal((await exploreImages({ spec: 'auto', count: 1, brief: 'x', dir })).off, 'CI never generates images');
  } finally { process.env.PATH = path; process.env.CI = ci; }
});
