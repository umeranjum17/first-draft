// The logo journey on the built CLI and the machine's Chrome, against a local stand-in for the provider (no paid call, no key):
// logo refuses to start without a browser; the stand-in explores nine concepts in three territory calls at once (wordmark-led, abstract,
// symbol), each from the brief; one proposal builds a concept on a letter and is sent back. The critic sees each territory's sketches
// drawn at 16 and 32 px with the person's --ref image: one sketch the allow-list refuses, one whose detail dies at 16 px, one a smiley, an
// initial carved into a leaf (dropped: letter + object), and a strong keep whose base shape a chosen option holds. The options are a
// wordmark-led, an abstract and a symbol concept, three base shapes. Each option's engine run first writes files the allow-list, the
// palette and the 16 px detail check refuse, reads done's findings and fixes them; the finished mark is critiqued again: one is redone with
// the critique, one is dropped for a reserve of its kind, at most two engine runs an option. Each option gets its brand sheet (kind, idea
// and palette filled in by the host) and its .logo/ folder; refine, in the CLI and from the Studio's brief, starts from the option's logo
// files and writes a new folder.
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
  ['Level type', ['#1f3b2d', '#7a5a3a', '#e9f0e6', '#e0b98f']], ['Typed name', ['#8a2f2f', '#4a6b3a', '#f0b0b0', '#a9d08c']], ['Slow script', ['#6b3f6f', '#a0522d', '#d9b3dd', '#e8b07c']],
  ['Ripple', ['#1c4e5c', '#b8741a', '#8fd0e0', '#f0c070']], ['Hairline', ['#3d5a80', '#a0522d', '#a9c4e8', '#e8b07c']], ['Falling drop', ['#8a2f6b', '#2f6b3b', '#f0b0d8', '#9fd8a6']],
  ['Moon cup', ['#5b5b52', '#a0522d', '#d6d6cc', '#e8b07c']], ['Leaf U', ['#2f6b3b', '#a0522d', '#9fd8a6', '#e8b07c']], ['Last drop', ['#1c7a6e', '#a0522d', '#8fe0d4', '#e8b07c']],
  ['Calm type', ['#2f6b3b', '#a0522d', '#9fd8a6', '#e8b07c']], ['Slow ink', ['#8a2f2f', '#4a6b3a', '#f0b0b0', '#a9d08c']], ['Quiet caps', ['#3d3d8a', '#a0522d', '#b8b8f0', '#e8b07c']],
  ['Ring', ['#3d3d8a', '#a0522d', '#b8b8f0', '#e8b07c']], ['Pour', ['#1c4e5c', '#b8741a', '#8fd0e0', '#f0c070']], ['Fold', ['#8a2f6b', '#2f6b3b', '#f0b0d8', '#9fd8a6']],
  ['Bud', ['#2f6b3b', '#a0522d', '#9fd8a6', '#e8b07c']], ['Dew', ['#1c7a6e', '#a0522d', '#8fe0d4', '#e8b07c']], ['Lid', ['#6a3d1e', '#2f6b3b', '#e0b890', '#9fd8a6']],
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
const SHEET = (slots = true) => `<!doctype html><html lang="en"><head><title>Umer's tea shop</title><style>:root{--bg:#f7f4ee;--fg:#1d1d1b;color-scheme:light dark}@media (prefers-color-scheme: dark){:root{--bg:#141513;--fg:#ecebe6}}
body{margin:0;padding:24px;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif}img{max-width:100%;height:auto}.tiles{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))}.tiles>*{min-width:0;padding:16px;background:#fff}.tiles>.night{background:#121212}</style></head>
<body><h1>Umer's tea shop</h1>${slots ? '<p data-logo="idea"></p>' : '<p>A leaf.</p>'}<img src="logo/mark.svg" alt="Mark" width="160">${slots ? '<div data-logo="palette"></div>' : ''}<div class="tiles">${['wordmark', 'lockup-horizontal', 'lockup-stacked'].map((n) => `<div><img src="logo/${n}.svg" alt="${n}"></div>`).join('')}
${['mark', 'wordmark', 'lockup-horizontal', 'lockup-stacked'].map((n) => `<div class="night"><img src="logo/${n}-dark.svg" alt="${n} on dark"></div>`).join('')}</div>
<p><img src="logo/icon.svg" alt="App icon" width="96"> <img src="logo/icon-16.png" width="16" height="16" alt="Icon at 16 px"> <img src="logo/icon-32.png" width="32" height="32" alt="Icon at 32 px"></p></body></html>`;
// The concepts the stand-in explores, by territory (three calls at once), and what its critic says of each sketch and, by name, of each
// finished mark in turn. Every metaphor is from the brief; Leaf U is an initial carved into a leaf, which the critic must drop.
const sketch = (body) => svg('0 0 96 96', body);
const concept = (k) => ({ from_brief: 'calm: the still moment while the tea steeps', shape: 'A few shapes on the 96 grid.', avoid: 'A face.', ...k, palette: PALS[k.name] });
const W1 = {
  wordmark: [
    { kind: 'wordmark', base: 'letters', name: 'Level type', idea: 'The name in level, unhurried letters whose t crosses as one still waterline.', sketch: sketch(`<path fill="#1f3b2d" d="M20 16h16v40a12 12 0 0 0 24 0V16h16v40a28 28 0 0 1-56 0z"/>`) },
    { kind: 'wordmark', base: 'letters', name: 'Typed name', idea: 'The name set in type.', sketch: sketch('<text x="20" y="70">Umer</text>') },
    { kind: 'wordmark', base: 'letters', name: 'Slow script', idea: 'The name in one slow stroke, as a pour.', sketch: sketch(`<path fill="#6b3f6f" d="M12 40h72v16H12z"/>`) },
  ],
  abstract: [
    { kind: 'abstract', base: 'ring', name: 'Ripple', idea: 'One ring of still water spreading from a single drop.', sketch: sketch(`<circle cx="48" cy="48" r="34" fill="#1c4e5c"/>`) },
    { kind: 'abstract', base: 'line', name: 'Hairline', idea: 'Two leaves of a tea bud side by side, a hair apart.', sketch: sketch(`<rect x="16" y="16" width="31" height="64" fill="#3d5a80"/><rect x="49" y="16" width="31" height="64" fill="#3d5a80"/>`) },
    { kind: 'abstract', base: 'drop', name: 'Falling drop', idea: 'A drop falling into stillness.', sketch: sketch(`<circle cx="48" cy="56" r="26" fill="#8a2f6b"/>`) },
  ],
  symbol: [
    { kind: 'symbol', base: 'ring', name: 'Moon cup', idea: 'A full moon on the surface of the cup.', sketch: sketch(`<circle cx="48" cy="48" r="30" fill="#5b5b52"/>`) },
    { kind: 'negative-space', base: 'leaf', name: 'Leaf U', idea: 'A leaf with a U cut out of it.', sketch: sketch(`<path fill="#2f6b3b" fill-rule="evenodd" d="M48 8C76 28 80 60 48 90C16 60 20 28 48 8ZM36 40V56A12 12 0 0 0 60 56V40H52V56A4 4 0 0 1 44 56V40Z"/>`) },
    { kind: 'symbol', base: 'drop', name: 'Last drop', idea: 'The last drop of the pour, held still.', sketch: sketch(`<circle cx="48" cy="52" r="28" fill="#1c7a6e"/>`) },
  ],
};
for (const t of Object.values(W1)) t.forEach((k, i) => { t[i] = concept(k); });
const CONCEPTS = Object.values(W1).flat();
// The sketch critique: Slow script reads as a smiley (a keep becomes redo), Hairline's detail dies at 16 px (redo), Leaf U is an initial
// carved into a leaf (a keep becomes drop), Moon cup is a keep of 8, under the bar of 9 beside the best of its class (it goes back: redo),
// and its base shape, a ring, Ripple already holds.
const SAYS = { 'Level type': { verdict: 'keep', score: 9 }, 'Slow script': { verdict: 'keep', score: 6, misreads: ['a smiley face'] }, Ripple: { verdict: 'keep', score: 9 }, Hairline: { verdict: 'keep', score: 9 },
  'Falling drop': { verdict: 'keep', score: 9 }, 'Moon cup': { verdict: 'keep', score: 8, compared: 'Close to Raycast\'s calm, but a plainer silhouette.' }, 'Leaf U': { verdict: 'keep', score: 9, letter_object: true }, 'Last drop': { verdict: 'keep', score: 7 } };
// The second look at Level type says redo but scores 9 beside the best of its class and names no serious flaw: that is a keep.
const FINAL = { 'Level type': [{ verdict: 'redo', score: 6, misreads: [], fix: 'Open the waterline so it reads at 16 px.', compared: 'Behind Stripe: the waterline is lost at 16 px.' }, { verdict: 'redo', score: 9, fix: 'Could be bolder.' }], Ripple: [{ verdict: 'drop', score: 3, cliche: '', reads_as: 'a dot', fix: 'At 16 px it is a dot: the idea cannot carry.' }],
  Hairline: [{ verdict: 'redo', score: 5, fix: 'Widen the gap.' }], 'Last drop': [{ verdict: 'keep', score: 9 }] };
// Round two: the critic dropped every drawn mark in round one, so the stand-in proposes nine more concepts when it is shown the critic's advice.
const bud = ([kind, base, name, idea], r) => concept({ kind, base, name, idea, sketch: sketch(`<circle cx="48" cy="48" r="${r}" fill="${PALS[name].light.primary}"/>`) });
const ROUND1 = Object.fromEntries(Object.entries({
  wordmark: [['wordmark', 'letters', 'Calm type', 'Level letters.'], ['wordmark', 'letters', 'Slow ink', 'One slow stroke.'], ['wordmark', 'letters', 'Quiet caps', 'Small capitals, wide apart.']],
  abstract: [['abstract', 'ring', 'Ring', 'A ring of still water.'], ['abstract', 'wave', 'Pour', 'One stroke that pours.'], ['abstract', 'triangle', 'Fold', 'A folded leaf.']],
  symbol: [['symbol', 'leaf', 'Bud', 'A tea bud held between two pinched leaves.'], ['symbol', 'drop', 'Dew', 'A drop on a leaf.'], ['symbol', 'circle', 'Lid', 'A lid lifted off.']],
}).map(([t, list]) => [t, list.map((k, i) => bud(k, 34 - i))]));
const ROUND2 = Object.fromEntries(Object.entries(ROUND1).map(([t, list]) => [t, list.map((k) => ({ ...k, name: `${k.name} again`, palette: PALS[k.name] }))]));
const BASE_OF = Object.fromEntries([...CONCEPTS, ...Object.values(ROUND1).flat(), ...Object.values(ROUND2).flat()].map((k) => [k.name, k.base]));
const said = (m, s = {}) => ({ id: m.id, reads_as: s.reads_as ?? m.name.toLowerCase(), base: BASE_OF[m.name], intended: true, small: true, misreads: s.misreads ?? [], cliche: s.cliche ?? '', plain_letter: false, letter_object: s.letter_object ?? false, resembles_reference: '', score: s.score, compared: s.compared ?? 'Holds up beside the best of its class and the baseline.', verdict: s.verdict, fix: s.fix ?? '' });
const ADVICE = 'Look for one stroke that both pours and curls.';
const WORLD2 = { proposals: [ROUND1, ROUND2], says: Object.fromEntries([...Object.values(ROUND1).flat(), ...Object.values(ROUND2).flat()].map((k) => [k.name, k.name === 'Bud' || k.name === 'Pour again' ? { verdict: 'keep', score: 9 } : { verdict: 'drop', score: 3, cliche: 'a stock image', fix: 'Not this.' }])),
  finals: { Bud: [{ verdict: 'redo', score: 5, misreads: ['a horseshoe'], fix: ADVICE }, { verdict: 'drop', score: 3, misreads: ['a horseshoe'], fix: 'Still a horseshoe.' }], 'Pour again': [{ verdict: 'keep', score: 9 }] } };
const WORLD1 = { proposals: [W1], says: SAYS, finals: FINAL };

const ev = (o) => `event: ${o.type}\ndata: ${JSON.stringify(o)}\n\n`;
const create = (path, file_text) => ['str_replace_based_edit_tool', { command: 'create', path, file_text }];
const userMessages = (body) => JSON.parse(body).input.filter((m) => m.role === 'user').map((m) => typeof m.content === 'string' ? m.content : m.content.filter((p) => p.type === 'input_text').map((p) => p.text).join('\n'));
const userText = (body) => userMessages(body).join('\n');
const outputs = (body) => JSON.parse(body).input.filter((m) => m.type === 'function_call_output').map((m) => typeof m.output === 'string' ? m.output : JSON.stringify(m.output));
// A stand-in model: it answers the concept and critique calls by their tool, and runs one script per engine conversation (told apart by
// their first message, so options drawn in parallel do not mix). Level type's new logo plans, writes DESIGN.md, refused logo files and a sheet
// without its slots, runs done, fixes them but leaves an icon whose detail dies at 16 px, runs done, fixes the icon and runs done again;
// later new logos write clean files in their palette at once. A revise (a redo from the critique, or a refine) writes DESIGN.md (done needs
// it), views the mark (the editor needs it), makes the leaf rounder in the colour the view showed and runs done. Engine replies take 40 ms,
// so overlapping conversations interleave in `trace`.
function standIn(seen, world = WORLD1, trace = []) {
  const convo = new Map();
  let revises = 0;
  const finals = {};
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', async () => {
      seen.push(body);
      const user = userText(body);
      if ((world.failSecond && body.includes('"propose_concepts"') && user.includes('critic_advice')) || (world.failBaseline && !body.includes('"propose_concepts"') && !body.includes('"critique_marks"') && !userMessages(body)[0]?.includes('Concept') && !userMessages(body)[0]?.includes('Revise this logo option'))) { res.writeHead(400); res.end('fixture refused logo round'); return; }
      let calls, delay = 0;
      if (body.includes('"propose_concepts"')) {
        // Each territory is its own call (they overlap: `trace.peak` counts the most open at once). The first answer of the symbol territory
        // builds Leaf U on a letter and gives Last drop a pale accent on white; the re-ask names both and the second answer fits.
        const { territory } = JSON.parse(user.split('\n\nYour last')[0]), reasked = user.includes('was not usable');
        const list = world.proposals[user.includes('critic_advice') ? 1 : 0][territory].map((k) => world !== WORLD1 || reasked ? k
          : k.name === 'Leaf U' ? { ...k, base: 'letter' } : k.name === 'Last drop' ? { ...k, palette: { ...k.palette, light: { ...k.palette.light, accent: '#e9f0e6' } } } : k);
        // Each first call waits until three are open at once (or 2 s pass, as calls made one by one would), whatever the runner's speed.
        trace.open = (trace.open ?? 0) + 1; trace.peak = Math.max(trace.peak ?? 0, trace.open);
        for (const until = Date.now() + 2000; !reasked && trace.peak < 3 && Date.now() < until;) await new Promise((r) => setTimeout(r, 10));
        trace.open--;
        calls = [['propose_concepts', { concepts: list }]];
      } else if (body.includes('"critique_marks"')) {
        const { marks, of } = JSON.parse(user.slice(0, user.lastIndexOf('}') + 1));
        // The first look at the wordmark sketches overruns fix; the re-ask says exactly what is wrong and the second answer fits.
        const first = of === 'rough sketches' && !user.includes('was not usable');
        calls = [['critique_marks', { marks: of === 'rough sketches' ? marks.map((m) => said(m, { ...world.says[m.name], ...(first && world === WORLD1 && m.name === 'Slow script' && { fix: 'x'.repeat(900) }) })) : [said(marks[0], world.finals[marks[0].name][(finals[marks[0].name] = (finals[marks[0].name] ?? -1) + 1)])] }]];
      } else {
        delay = 40;
        const key = userMessages(body)[0];
        if (!body.includes('function_call_output')) {
          const revise = key.includes('Revise this logo option');
          if (revise) revises++;
          convo.set(key, { n: 0, script: revise ? 'revise' : key.includes(': Level type. Idea') ? 'make' : 'clean', name: key.match(/Concept \d+ of the \d+ explored[^,]*, [^:]+: ([^.]+)\./)?.[1], revise: revises });
        }
        const st = convo.get(key), n = st.n++;
        trace.push(key.slice(0, 80));
        const { CLEAN, REFUSED, THIN, pal } = KITS[st.name] ?? KITS['Level type'];
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
// A test folder is removed last, after the processes that write to it are stopped, and retried: a headless browser the host has just
// killed can still be writing its profile into TMPDIR, and a throwing after-hook would skip the ones after it and leave the view running.
const clear = (dir) => rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
const png = (file) => { const b = readFileSync(file); assert.equal(b.subarray(1, 4).toString(), 'PNG'); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('logo: concepts explored and critiqued at 16 and 32 px become options with their idea and palette; marks are redone or dropped; refine starts from the logo files', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-logo-'));
  const seen = [], trace = [], server = await standIn(seen, WORLD1, trace);
  let view;
  t.after(() => { view?.kill(); server.close(); clear(dir); });
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
  const result = JSON.parse((await run(['logo', brief, '--out', out, '--options', '3', '--ref', reference])).stdout), { made } = result;
  assert.equal(made.judge.agent, 'byokit:codex');
  assert.notEqual(made.judge.model, made.model);
  assert.equal(made.files.length, 3);
  assert.notEqual(result.concepts[0].palette, result.concepts[1].palette, 'each concept has its own colours');
  assert.deepEqual([result.rounds, result.exploration, result.timing.concurrency, result.timing.concept_calls], [1, { off: 'CI never generates images' }, 3, 3]);
  // Nine concepts explored in three territory calls at once (wordmark-led, abstract, symbol), each with the --ref image and the brief's
  // metaphors; each territory's clean sketches went to the critic on a board of their own beside it, and its verdicts were overruled
  // where the host found a flaw: a smiley is not a keep, nor a mark whose detail dies at 16 px, and an initial carved into a leaf is a drop.
  const proposals = seen.filter((b) => b.includes('"propose_concepts"')), reasked = proposals.filter((b) => userText(b).includes('not usable'));
  assert.deepEqual(proposals.map((b) => JSON.parse(userText(b).split('\n\nYour last')[0]).territory).sort(), ['abstract', 'symbol', 'symbol', 'wordmark']);
  assert.equal(trace.peak, 3, 'the three territory calls are open at once');
  for (const b of proposals) assert.match(b, /input_image/);
  assert.match(proposals[0], /never from the name's initials/);
  // A concept built on a letter the brief does not ask for, and a pale accent on white, send the proposal back once, naming both.
  assert.equal(reasked.length, 1);
  assert.match(userText(reasked[0]), /Your last propose_concepts call was not usable: concept 2 is built on a letter, and the brief does not ask for one: take the metaphor from the brief or the product's story, not from the name's initials; concept 3 palette "light"\."accent" #e9f0e6 is 1\.\d:1 on white; it needs 3:1 or more/);
  const critiques = seen.filter((b) => b.includes('"critique_marks"')), sketches = critiques.filter((b) => userText(b).includes('"of":"rough sketches"')), finalCritiques = critiques.filter((b) => !sketches.includes(b));
  const overrun = sketches.find((b) => JSON.parse(userText(b).split('\n\nYour last')[0]).marks.some((m) => m.name === 'Slow script') && !userText(b).includes('not usable'));
  assert.match(userText(sketches.find((b) => userText(b).includes('not usable'))), /Your last critique_marks call was not usable: mark 3 fix is 900 characters; keep it to 800 or less\./);
  assert.equal(sketches.length, 4, 'three territory boards and one re-ask');
  for (const b of sketches) assert.equal((b.match(/"type":"input_image"/g) ?? []).length, 2, 'the board and the --ref image');
  assert.deepEqual(JSON.parse(userText(overrun)).marks.map((m) => m.name), ['Level type', 'Slow script']);
  const status = Object.fromEntries(result.concepts.map((k) => [k.name, k]));
  assert.deepEqual(Object.fromEntries(result.concepts.map((k) => [k.name, k.status])), { 'Level type': 'chosen', 'Typed name': 'dropped', 'Slow script': 'reserve', Ripple: 'chosen', Hairline: 'reserve', 'Falling drop': 'reserve', 'Moon cup': 'reserve', 'Leaf U': 'dropped', 'Last drop': 'chosen' });
  assert.deepEqual(result.concepts.map((k) => k.territory), ['wordmark', 'wordmark', 'wordmark', 'abstract', 'abstract', 'abstract', 'symbol', 'symbol', 'symbol']);
  assert.equal(status['Level type'].from, 'calm: the still moment while the tea steeps');
  assert.equal(status['Slow script'].verdict, 'redo');
  assert.deepEqual(status['Slow script'].flaws, ['reads as a smiley face']);
  assert.match(status.Hairline.flaws.join(), /loses detail at 16 px: 2 distinct parts at 512 px but 1 at 16 px/);
  assert.match(status['Typed name'].flaws.join(), /the sketch is not clean SVG: <text> is not allowed/);
  // Letter + object is rejected: the critic scored Leaf U a keep of 9, and the host drops it.
  assert.deepEqual([status['Leaf U'].verdict, status['Leaf U'].flaws], ['drop', ['an initial dressed as an object, and the brief does not ask for the letter']]);
  // The owner's bar: Moon cup's keep of 8, with no flaw, is under 9 beside the best of its class, so it goes back (redo), with the reasons.
  assert.deepEqual([status['Moon cup'].verdict, status['Moon cup'].score, status['Moon cup'].flaws, status['Moon cup'].compared], ['redo', 8, [], 'Close to Raycast\'s calm, but a plainer silhouette.']);
  // No repeated base shape: Moon cup scores above Last drop's 7, but its ring is Ripple's base shape.
  assert.deepEqual([status['Moon cup'].base_seen, status.Ripple.base_seen], ['ring', 'ring']);
  // Option 1 refines Level type (wordmark-led): the critic sent it back once, the redo went to the engine as a revise, and the second look
  // kept it. Option 2 was Ripple (abstract), dropped by the critic as a dot at 16 px, so a reserve took its place: of its kind, and not
  // Falling drop, whose drop is option 3's base shape, but Hairline, drawn once (two engine runs an option): no attempt passed, so the
  // best-scored one is the option, flagged. Option 3, Last drop, passed at once. Every other attempt is kept for review.
  assert.deepEqual(made.files.map((f) => [f.concept.name, f.concept.kind, f.passed]), [['Level type', 'wordmark', true], ['Hairline', 'abstract', false], ['Last drop', 'symbol', true]]);
  assert.ok(seen.some((b) => b.includes('Revise this logo option: Independent critique of this logo at 16 and 32 px') && b.includes('Beside the best marks of its class it scores 6 of 10, under the 9 it needs: Behind Stripe') && b.includes('Open the waterline so it reads at 16 px.')));
  assert.deepEqual(result.dropped.map((d) => [d.name, d.critique.verdict, d.critique.score, d.option]), [['Ripple', 'drop', 3, undefined], ['Hairline', 'redo', 5, 'kept as the best attempt, flagged as not passing']]);
  assert.match(result.help[0], /1 option\(s\) did not pass the independent critique/);
  assert.equal(finalCritiques.length, 4 + 1, 'Level type twice, Ripple, Hairline and Last drop once each');
  assert.equal(new Set(trace).size, 6, 'five engine runs for three options (at most two an option) and the baseline');
  // The baseline, the plain output of the same model on the same brief, stands beside every finished mark the critic scores, and stays for review.
  for (const b of finalCritiques) assert.match(b, /The row labelled baseline is the plain output of muse-spark-1\.3-contributor on the same brief/);
  assert.deepEqual(result.baseline, { file: join(dir, 'tea.baseline', 'baseline.html'), logo_dir: join(dir, 'tea.baseline', 'baseline.logo') });
  assert.equal(JSON.parse(readFileSync(join(dir, 'tea.baseline', 'baseline.logo', 'logo.json'), 'utf8')).model, 'muse-spark-1.3-contributor');
  for (const [option, attempts] of [[1, ['concept-1-first']], [2, ['concept-4-first']]]) {
    assert.deepEqual(readdirSync(join(dir, `tea-${option}.dropped`)).sort(), attempts.flatMap((a) => [`${a}.html`, `${a}.logo`]).sort());
    for (const a of attempts) assert.equal(JSON.parse(readFileSync(join(dir, `tea-${option}.dropped`, `${a}.logo`, 'logo.json'), 'utf8')).dropped, true);
  }
  assert.ok(!existsSync(join(dir, 'tea-3.dropped')));
  assert.equal(made.files[1].dropped_attempts, join(dir, 'tea-2.dropped'));
  for (const b of finalCritiques) assert.match(b, /"input_image"[^]*"input_image"/, 'the finished mark board and the --ref image');
  const engine = seen.find((b) => b.includes('first-draft logo mode') && b.includes(': Level type. Idea'));
  assert.match(engine, /Logo direction: Concept 1 of the 9 explored, wordmark: Level type\. Idea: The name in level, unhurried letters[^]*It comes from the brief: calm: the still moment/);
  assert.match(engine, /The wordmark leads: draw the name in letters of its own first/);
  assert.match(engine, /Its palette is in logo\/palette\.json \(Level type: colours that come from its idea/);
  // The options were drawn at the same time: their engine conversations interleave.
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
    assert.equal(logo.explored.length, 9);
    assert.deepEqual(logo.critique.map((c) => [c.round, c.verdict, c.score]), [[['first', 'redo', 6], ['redo', 'keep', 9]], [['first', 'redo', 5]], [['first', 'keep', 9]]][i]);
    assert.deepEqual(f.critique, logo.critique.at(-1));
    assert.equal(logo.passed, i !== 1);
    assert.equal(logo.critic, 'independent: byokit:codex / gpt-6.1-sol; not trademark clearance');
    assert.deepEqual({ reason: logo.palette.reason, light: logo.palette.light, dark: logo.palette.dark }, pal);
    assert.deepEqual(logo.concept.palette, pal, 'the palette was chosen with the concept');
    assert.ok(Object.entries(logo.palette.contrast.light).every(([role, v]) => role === 'ground' || v >= 3), JSON.stringify(logo.palette.contrast));
    if (i === 0) assert.deepEqual(logo.palette.contrast.light, { ground: '#ffffff', primary: 12.2, accent: 6.3, neutral: 14.2 });
    assert.equal(logo.exploration, 'CI never generates images', 'no provider in CI: drawn from the idea alone');
    assert.equal(logo.baseline, join(dir, 'tea.baseline', 'baseline.html'));
    assert.ok(logo.critique.every((c) => c.compared.trim()), 'every score comes with its reasons');
    assert.ok(!existsSync(join(folder, 'exploration.webp')));
    assert.ok(logo.timing.concurrency === 3 && logo.timing.concept_calls === 3 && logo.timing.total_s >= logo.timing.concepts_s + logo.timing.drawing_s - 1 && Number.isInteger(logo.timing.option_s), JSON.stringify(logo.timing));
    assert.equal(logo.explored[0].palette, '#1f3b2d');
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
    // The kind of mark is a small label over the idea.
    assert.ok(sheet.includes(`<p data-logo="idea"><!--logo:idea--><small style="display:block;font-size:12px;letter-spacing:.06em;text-transform:uppercase;opacity:.75">${['Wordmark-led', 'Abstract mark', 'Symbol'][i]}</small>${logo.concept.idea}${i !== 1 ? '' : '<br><strong>Did not pass the self-critique.</strong> A stranger sees "hairline" (score 5 of 10). Shown as the best attempt.'}<!--/logo:idea--></p>`));
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
  assert.ok(readFileSync(join(dir, 'tea-round.html'), 'utf8').includes(`Abstract mark</small>${round.concept.idea}<!--/logo:idea-->`));
  assert.ok(!readFileSync(join(dir, 'tea-2.html'), 'utf8').includes(readFileSync(join(dir, 'tea-round.logo', 'mark.svg')).toString('base64')), 'the option it came from is untouched');

  // The Studio's brief runs the same refine: the new option joins the design with its own logo folder.
  view = spawn(process.execPath, [CLI, 'view', out, '--host', '127.0.0.1', '--port', '0'], { env });
  const url = JSON.parse(await new Promise((ok) => view.stdout.once('data', ok))).viewing.url;
  const sent = await fetch(`${url}refine`, { method: 'POST', headers: { 'content-type': 'application/json', origin: new URL(url).origin }, body: JSON.stringify({ option: 2, change: 'a rounder leaf' }) });
  assert.equal(sent.status, 200, await sent.clone().text());
  assert.deepEqual(await sent.json(), { option: { n: 4, label: 'tea-2-refined', file: 'tea-2-refined.html' }, engine: {agent:'byokit:opencode-go',model:'muse-spark-1.3-contributor'} });
  assert.notEqual(readFileSync(join(dir, 'tea-2-refined.logo', 'mark.svg'), 'utf8'), readFileSync(join(dir, 'tea-2.logo', 'mark.svg'), 'utf8'));
  assert.ok(existsSync(join(dir, 'tea-2-refined.logo', 'favicon.ico')));
});

test('logo: image-first exploration through the asset provider, and a second round from the critic\'s advice when it drops every drawn mark', async (t) => {
  if (!findBrowser()) return t.skip('no Chrome or Chromium on this machine');
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-logo-images-'));
  // A Higgsfield that is ready and makes one image (a real PNG that the host converts with ImageMagick), and a fetch that serves it.
  const bin = join(dir, 'bin'), log = join(dir, 'calls'), mark = join(dir, 'mark.png');
  mkdirSync(bin);
  await promisify(execFile)('convert', ['-size', '16x16', 'xc:#2f6b3b', mark]);
  writeFileSync(join(bin, 'higgsfield'), `#!${process.execPath}\nimport {appendFileSync} from 'node:fs';\nconst a=process.argv.slice(2);appendFileSync(${JSON.stringify(log)},JSON.stringify(a)+'\\n');\nif(a[0]==='account')console.log('{"credits":10}');else if(a[1]==='cost')console.log('{"credits":0.15}');else console.log('[{"status":"completed","job_type":"z_image","result_url":"https://fixture.invalid/mark.png"}]');`, { mode: 0o755 });
  writeFileSync(join(bin, 'magick'), '#!/bin/sh\nexec convert "$@"\n', { mode: 0o755 }); // ImageMagick 6 (a CI runner) has convert and no magick
  const hook = join(dir, 'fetch.mjs');
  writeFileSync(hook, `const real=globalThis.fetch;globalThis.fetch=(url,options)=>url==='https://fixture.invalid/mark.png'?Promise.resolve(new Response(Buffer.from('${readFileSync(mark).toString('base64')}','base64'))):real(url,options);`);
  const seen = [], server = await standIn(seen, WORLD2);
  t.after(() => { server.close(); clear(dir); });
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, CI: '', HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir, OPENCODE_API_KEY: 'test-key', FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}` };
  const run = (args) => promisify(execFile)(process.execPath, ['--import', hook, CLI, ...args], { env, cwd: dir });
  await run(['init', '--agent', 'byokit:opencode-go', '--model', 'muse-spark-1.3-contributor']);
  await assert.rejects(run(['logo', 'Umer\'s tea shop', '--out', join(dir, 'x.html'), '--explore', 'midjourney']), (e) => /Unknown asset provider: midjourney/.test(e.stdout));
  const result = JSON.parse((await run(['logo', 'Umer\'s tea shop, calm and modern', '--out', join(dir, 'tea.html'), '--options', '1', '--explore', 'higgsfield'])).stdout), [file] = result.made.files;

  // Round one's only drawn mark was dropped by the critic (a horseshoe), so the second round explored again from the critic's own words.
  const proposals = seen.filter((b) => b.includes('"propose_concepts"')), [first, second] = [proposals.filter((b) => !userText(b).includes('critic_advice')), proposals.filter((b) => userText(b).includes('critic_advice'))];
  assert.deepEqual([first.length, second.length], [3, 3], 'three territory calls a round');
  for (const advice of [ADVICE, 'a horseshoe', 'Ideas already tried \\(do not repeat them\\): Calm type, Slow ink', 'Sketches the critic dropped before anything was drawn']) assert.match(userText(second[0]), new RegExp(advice.replaceAll('.', '\\.')), advice);
  assert.match(second[0], /This is a second round/);
  assert.equal(result.rounds, 2);
  assert.deepEqual(result.second_round, { reason: 'the critic dropped every drawn mark in the first round; the second explored new concepts from its reasons and advice', passed: 1 });
  assert.deepEqual([file.concept.name, file.passed], ['Pour again', true]);
  assert.deepEqual(result.concepts.map((k) => [k.id, k.round]), Array.from({ length: 18 }, (_, i) => [i + 1, i < 9 ? 1 : 2]));
  assert.deepEqual(result.dropped.map((d) => [d.name, d.critique.verdict, d.option]), [['Bud', 'drop', 'kept as the best attempt, flagged as not passing']]);
  const folder = join(dir, 'tea.logo');
  assert.deepEqual(readdirSync(join(dir, 'tea.dropped')).sort(), ['concept-7-first.html', 'concept-7-first.logo', 'concept-7-redo.html', 'concept-7-redo.logo'], 'round one\'s attempts stay for review');
  const logo = JSON.parse(readFileSync(join(folder, 'logo.json'), 'utf8'));
  assert.equal(logo.explored.length, 18);
  assert.ok(existsSync(join(folder, 'concepts-round2.png')) && existsSync(join(folder, 'concepts.png')));
  assert.ok(Number.isInteger(logo.timing.second_round_s) && logo.timing.total_s >= logo.timing.second_round_s, JSON.stringify(logo.timing));
  assert.deepEqual(logo.palette.light, PALS['Pour'].light, 'the second round concept brought its own palette');

  // Image-first: each concept tried was shown to the provider and its raster went to the engine as a reference to redraw as SVG.
  const created = readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse).filter((a) => a[0] === 'generate' && a[1] === 'create');
  assert.equal(created.length, 2, 'one image for Bud, one for Pour again');
  assert.match(created[0].join(' '), /Concept "Bud": A tea bud held between two pinched leaves\./);
  const engines = seen.filter((b) => b.includes('first-draft logo mode') && /Logo direction|Revise this logo option/.test(userMessages(b)[0])); // not the baseline's
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

test('logo baseline and second-round provider failures refuse instead of returning earlier attempts', async t => {
  for (const [flag, world, expected] of [['failBaseline', WORLD1, /Logo baseline failed/], ['failSecond', WORLD2, /Independent logo review failed/]]) await t.test(flag, async t => {
    const dir = mkdtempSync(join(tmpdir(), 'fd-logo-refusal-'));
    const server = await standIn([], { ...world, [flag]: true });
    t.after(() => { server.close(); clear(dir); });
    const env = { ...process.env, CI:'true', HOME:dir, XDG_CONFIG_HOME:dir, XDG_DATA_HOME:dir, TMPDIR:dir, FIRST_DRAFT_HOME:dir, OPENCODE_API_KEY:'synthetic', FIRST_DRAFT_TEST_BYOKIT_BASE:`http://127.0.0.1:${server.address().port}` };
    const run = (...args) => promisify(execFile)(process.execPath, [CLI, ...args], { env, cwd:dir });
    await run('init','--agent','byokit:opencode-go','--model','muse-spark-1.3-contributor');
    const out = join(dir,'refused.html');
    await assert.rejects(run('logo',"Umer's tea shop",'--out',out,'--options','1','--explore','none'), e => expected.test(e.stdout));
    assert.equal(existsSync(out), false);
    assert.equal(existsSync(join(dir,'refused.baseline','baseline.html')), false);
  });
});
