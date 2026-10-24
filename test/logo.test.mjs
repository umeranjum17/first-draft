// The logo journey on the built CLI and the machine's Chrome, against a local stand-in for the provider (no paid call, no key):
// logo refuses to start without a browser; the stand-in explores six concepts (one with a sketch the allow-list refuses, one whose
// detail dies at 16 px, one the critic calls a smiley, one a cliche), the critic sees them drawn at 16 and 32 px with the person's
// --ref image, and the strongest of different kinds become the options. Each option's engine run first writes files the allow-list,
// the palette and the 16 px detail check refuse, reads done's findings and fixes them; the finished mark is critiqued again: one is
// redone with the critique, one is dropped for the next concept. Each option gets its brand sheet (idea and palette filled in by the
// host) and its .logo/ folder; refine, in the CLI and from the Studio's brief, starts from the option's logo files and writes a new folder.
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';
import { findBrowser } from '../src/render-check.mjs';

const CLI = new URL('../src/cli.mjs', import.meta.url).pathname;
const DESIGN = readFileSync(new URL('../vendor/open-codesign/apps/desktop/resources/templates/scaffolds/design-systems/DESIGN.md', import.meta.url), 'utf8');
const INK = '#1f3b2d', MILK = '#e9f0e6';
const PALETTE = { reason: 'A deep tea green and a warm clay for calm; a charcoal ink keeps it modern.', light: { primary: INK, accent: '#7a5a3a', neutral: '#2b2b28' }, dark: { primary: MILK, accent: '#e0b98f', neutral: '#f2f1ee' } };
const svg = (box, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}">${body}</svg>`;
const leaf = (c, d = 'M48 12C30 28 24 50 48 84C72 50 66 28 48 12Z') => `<path fill="${c}" d="${d}"/>`;
const word = (c, x = 0) => `<path fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round" d="M${x + 12} 12V44M${x + 28} 24V44M${x + 28} 32a10 10 0 0 1 20 0V44"/>`;
const CLEAN = Object.fromEntries([['', INK], ['-dark', MILK]].flatMap(([s, c]) => [
  [`mark${s}.svg`, svg('0 0 96 96', leaf(c))],
  [`wordmark${s}.svg`, svg('0 0 64 56', word(c))],
  [`lockup-horizontal${s}.svg`, svg('0 0 168 96', `${leaf(c)}${word(c, 100)}`)],
  [`lockup-stacked${s}.svg`, svg('0 0 96 160', `${leaf(c)}<g transform="translate(16 100)">${word(c)}</g>`)],
]).concat([['icon.svg', svg('0 0 96 96', `<rect width="96" height="96" fill="${INK}"/><g transform="translate(19.2 19.2) scale(.6)">${leaf(MILK)}</g>`)], ['palette.json', JSON.stringify(PALETTE)]]));
const REFUSED = { ...CLEAN, 'mark.svg': svg('0 0 96 96', '<text x="10" y="50">U</text>'), 'wordmark.svg': svg('0 0 64 56', '<image href="https://example.com/w.png" width="64" height="56"/>'), 'icon.svg': CLEAN['icon.svg'].replace('0 0 96 96', '0 0 96 64'),
  'palette.json': JSON.stringify({ ...PALETTE, light: { ...PALETTE.light, accent: MILK } }) };
// Two bars two units apart: two parts at 512 px, one blur at 16 px.
const THIN = { ...CLEAN, 'icon.svg': svg('0 0 96 96', `<rect width="96" height="96" fill="${INK}"/><rect x="26" y="30" width="21" height="36" fill="${MILK}"/><rect x="49" y="30" width="21" height="36" fill="${MILK}"/>`) };
const SHEET = (slots = true) => `<!doctype html><html lang="en"><head><title>Umer's tea shop</title><style>:root{--bg:#f7f4ee;--fg:#1d1d1b;color-scheme:light dark}@media (prefers-color-scheme: dark){:root{--bg:#141513;--fg:#ecebe6}}
body{margin:0;padding:24px;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif}img{max-width:100%;height:auto}.tiles{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))}.tiles>*{min-width:0;padding:16px;background:#fff}.tiles>.night{background:#121212}</style></head>
<body><h1>Umer's tea shop</h1>${slots ? '<p data-logo="idea"></p>' : '<p>A leaf.</p>'}<img src="logo/mark.svg" alt="Mark" width="160">${slots ? '<div data-logo="palette"></div>' : ''}<div class="tiles">${['wordmark', 'lockup-horizontal', 'lockup-stacked'].map((n) => `<div><img src="logo/${n}.svg" alt="${n}"></div>`).join('')}
${['mark', 'wordmark', 'lockup-horizontal', 'lockup-stacked'].map((n) => `<div class="night"><img src="logo/${n}-dark.svg" alt="${n} on dark"></div>`).join('')}</div>
<p><img src="logo/icon.svg" alt="App icon" width="96"> <img src="logo/icon-16.png" width="16" height="16" alt="Icon at 16 px"> <img src="logo/icon-32.png" width="32" height="32" alt="Icon at 32 px"></p></body></html>`;
// The six concepts the stand-in explores, and what its critic says of each sketch and, by name, of each finished mark in turn.
const sketch = (body) => svg('0 0 96 96', body);
const CONCEPTS = [
  { kind: 'symbol', name: 'Leaf cup', idea: 'A cup with a leaf above it.', sketch: sketch(`<path fill="${INK}" d="M16 48h64a32 32 0 0 1-64 0z"/>${leaf('#7a5a3a', 'M48 40C38 30 40 16 48 8C56 16 58 30 48 40Z')}`) },
  { kind: 'letter', name: 'U steam', idea: 'The U of Umer whose right stem rises as a curl of steam.', sketch: sketch(`<path fill="${INK}" d="M20 16h16v40a12 12 0 0 0 24 0V16h16v40a28 28 0 0 1-56 0z"/>`) },
  { kind: 'negative-space', name: 'Smile leaf', idea: 'A leaf with a U cut out of it.', sketch: sketch(`<path fill="${INK}" fill-rule="evenodd" d="M48 8C76 28 80 60 48 90C16 60 20 28 48 8ZM36 40V56A12 12 0 0 0 60 56V40H52V56A4 4 0 0 1 44 56V40Z"/>`) },
  { kind: 'abstract', name: 'Hairline', idea: 'Two leaves of a tea bud side by side, a hair apart.', sketch: sketch(`<rect x="16" y="16" width="31" height="64" fill="${INK}"/><rect x="49" y="16" width="31" height="64" fill="${INK}"/>`) },
  { kind: 'symbol+letter', name: 'Typed U', idea: 'A U set in type.', sketch: sketch('<text x="20" y="70">U</text>') },
  { kind: 'abstract', name: 'Pebble', idea: 'A smooth river pebble: calm, warm, held in the hand.', sketch: sketch(`<circle cx="48" cy="48" r="34" fill="${INK}"/>`) },
].map((k) => ({ shape: 'A few shapes on the 96 grid.', avoid: 'A face.', ...k }));
const SAYS = { 'Leaf cup': { verdict: 'drop', score: 4, cliche: 'a cup with a leaf', fix: 'The stock tea image; nothing twists it.' }, 'U steam': { verdict: 'keep', score: 8 }, 'Smile leaf': { verdict: 'keep', score: 7, misreads: ['a smiley face'] },
  Hairline: { verdict: 'keep', score: 9 }, Pebble: { verdict: 'keep', score: 6 } };
// The second look at U steam says redo but scores 8 and names no serious flaw: that is a keep.
const FINAL = { 'U steam': [{ verdict: 'redo', score: 6, misreads: [], fix: 'Open the curl so the steam reads at 16 px.' }, { verdict: 'redo', score: 8, fix: 'Could be bolder.' }], Pebble: [{ verdict: 'drop', score: 3, cliche: '', reads_as: 'a dot', fix: 'At 16 px it is a dot: the idea cannot carry.' }],
  Hairline: [{ verdict: 'redo', score: 5, fix: 'Widen the gap.' }, { verdict: 'redo', score: 6, misreads: ['a pause button'], fix: 'Still a pause button.' }] };
const said = (m, s = {}) => ({ id: m.id, reads_as: s.reads_as ?? m.name.toLowerCase(), intended: true, small: true, misreads: s.misreads ?? [], cliche: s.cliche ?? '', plain_letter: false, resembles_reference: '', score: s.score, verdict: s.verdict, fix: s.fix ?? '' });

const ev = (o) => `event: ${o.type}\ndata: ${JSON.stringify(o)}\n\n`;
const create = (path, file_text) => ['str_replace_based_edit_tool', { command: 'create', path, file_text }];
const userText = (body) => JSON.parse(body).input.filter((m) => m.role === 'user').flatMap((m) => typeof m.content === 'string' ? [m.content] : m.content.filter((p) => p.type === 'input_text').map((p) => p.text)).join('\n');
// A stand-in model: it answers the concept and critique calls by their tool, and runs one script per engine conversation. The first new
// logo plans, writes DESIGN.md, refused logo files and a sheet without its slots, runs done, fixes them but leaves an icon whose detail
// dies at 16 px, runs done, fixes the icon and runs done again; later new logos write clean files at once. A revise (a redo from the
// critique, or a refine) writes DESIGN.md (done needs it), views the mark (the editor needs it), makes the leaf rounder and runs done.
function standIn(seen) {
  let start = 0, script = 'make', makes = 0, revises = 0;
  const finals = {};
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      seen.push(body);
      const user = userText(body);
      let calls;
      if (body.includes('"propose_concepts"')) calls = [['propose_concepts', { concepts: CONCEPTS }]];
      else if (body.includes('"critique_marks"')) {
        const { marks } = JSON.parse(user.slice(0, user.lastIndexOf('}') + 1));
        // The first look at the sketches overruns fix; the re-ask says exactly what is wrong and the second answer fits.
        const first = marks.length > 1 && !user.includes('was not usable');
        calls = [['critique_marks', { marks: marks.length > 1 ? marks.map((m) => said(m, { ...SAYS[m.name], ...(first && m.name === 'Leaf cup' && { fix: 'x'.repeat(900) }) })) : [said(marks[0], FINAL[marks[0].name][(finals[marks[0].name] = (finals[marks[0].name] ?? -1) + 1)])] }]];
      } else {
        if (!body.includes('function_call_output')) { start = seen.length - 1; script = body.includes('Revise this logo option') ? 'revise' : makes++ ? 'clean' : 'make'; if (script === 'revise') revises++; }
        const n = seen.length - 1 - start;
        const write = (set, slots) => [...Object.entries(set).map(([f, t]) => create(`logo/${f}`, t)), ...(slots === undefined ? [] : [create('index.html', SHEET(slots))])];
        const round = `M48 ${12 + 2 * revises}C26 30 22 52 48 84C74 52 70 30 48 ${12 + 2 * revises}Z`;
        calls = {
          make: [[['set_todos', { items: [{ text: 'Draw the logo files and the sheet', checked: false }] }]], [create('DESIGN.md', DESIGN), ...write(REFUSED, false)], [['done', { path: 'index.html' }]], write(THIN, true), [['done', { path: 'index.html' }]], write({ 'icon.svg': CLEAN['icon.svg'] }), [['done', { path: 'index.html' }]]],
          clean: [[create('DESIGN.md', DESIGN), ...write(CLEAN, true)], [['done', { path: 'index.html' }]]],
          revise: [[['set_todos', { items: [{ text: 'Round the leaf', checked: false }] }]],
            [create('DESIGN.md', DESIGN), ['str_replace_based_edit_tool', { command: 'view', path: 'logo/mark.svg' }], create('logo/mark.svg', svg('0 0 96 96', leaf(INK, round)))],
            [['done', { path: 'index.html' }]]],
        }[script][n];
      }
      const items = calls ? calls.map(([name, args], i) => ({ type: 'function_call', id: `fc${seen.length}-${i}`, call_id: `c${seen.length}-${i}`, name, arguments: JSON.stringify(args) }))
        : [{ type: 'message', id: 'm1', status: 'completed', content: [{ type: 'output_text', text: 'The logo is ready.' }] }];
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
  const seen = [], server = await standIn(seen);
  t.after(() => server.close());
  const env = { ...process.env, HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir, OPENCODE_API_KEY: 'test-key', FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}` };
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
  // Six concepts explored with the --ref image; the critic saw the five clean sketches drawn on one board beside it, and its verdicts
  // were overruled where the host found a flaw: a smiley is not a keep, nor is a mark whose detail dies at 16 px.
  const proposeCall = seen.find((b) => b.includes('"propose_concepts"')), [overrun, conceptCritique, ...finalCritiques] = seen.filter((b) => b.includes('"critique_marks"'));
  assert.ok(!userText(overrun).includes('not usable'));
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
  // still read as a pause button, so no attempt passed and the best-scored one is the option, flagged. Every other attempt is kept for review.
  assert.deepEqual(made.files.map((f) => [f.concept.name, f.passed]), [['U steam', true], ['Hairline', false]]);
  assert.ok(seen.some((b) => b.includes('Revise this logo option: Self-critique of this logo at 16 and 32 px') && b.includes('Open the curl so the steam reads at 16 px.')));
  assert.deepEqual(result.dropped.map((d) => [d.name, d.critique.verdict, d.option]), [['Pebble', 'drop', undefined], ['Hairline', 'redo', 'kept as the best attempt, flagged as not passing']]);
  assert.match(result.help[0], /1 option\(s\) did not pass the self-critique/);
  assert.equal(finalCritiques.length, 5);
  for (const [option, attempts] of [[1, ['concept-2-first']], [2, ['concept-6-first', 'concept-4-first']]]) {
    assert.deepEqual(readdirSync(join(dir, `tea-${option}.dropped`)).sort(), attempts.flatMap((a) => [`${a}.html`, `${a}.logo`]).sort());
    for (const a of attempts) assert.equal(JSON.parse(readFileSync(join(dir, `tea-${option}.dropped`, `${a}.logo`, 'logo.json'), 'utf8')).dropped, true);
  }
  assert.equal(made.files[1].dropped_attempts, join(dir, 'tea-2.dropped'));
  for (const b of finalCritiques) assert.match(b, /"input_image"[^]*"input_image"/, 'the finished mark board and the --ref image');
  const engine = seen.find((b) => b.includes('first-draft logo mode'));
  assert.match(engine, /Logo direction: Concept 2 of the 6 explored, letter: U steam\. Idea: The U of Umer/);
  // done refused the first files and said why, file by file; the model fixed them in the loop.
  const findings = told(seen);
  assert.match(findings, /logo\/mark\.svg: <text> is not allowed: draw every letter as a path/);
  assert.match(findings, /logo\/wordmark\.svg: <image> is not allowed/);
  assert.match(findings, /logo\/wordmark\.svg: <image href=\\?"https:\/\/example\.com\/w\.png\\?"> links outside the file/);
  assert.match(findings, /logo\/icon\.svg: its viewBox is 96 by 64, not square/);
  assert.match(findings, /logo\/palette\.json: \\?"light\\?"\.\\?"accent\\?" #e9f0e6 is 1\.\d:1 on white; it needs 3:1 or more/);
  assert.match(findings, /the brand sheet needs exactly one empty <p data-logo=\\?"idea\\?"><\/p>/);
  assert.match(findings, /logo\/icon\.svg: loses its detail at 16 px: 2 distinct parts at 512 px but 1 at 16 px/);
  for (const [i, f] of made.files.entries()) {
    const folder = join(dir, `tea-${i + 1}.logo`);
    assert.equal(f.file, join(dir, `tea-${i + 1}.html`));
    assert.equal(f.logo_dir, folder);
    assert.deepEqual(readdirSync(folder).sort(), [...Object.keys(CLEAN), ...[16, 32, 48, 180, 192, 512, 1024].map((n) => `icon-${n}.png`), 'favicon.ico', 'logo.json', 'concepts.png', 'critique.png'].sort());
    for (const [name, text] of Object.entries(CLEAN)) if (name !== 'mark.svg') assert.equal(readFileSync(join(folder, name), 'utf8'), text, name);
    assert.match(readFileSync(join(folder, 'mark.svg'), 'utf8'), /C26 30 22 52 48 84/, 'the redo changed the mark');
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
    assert.deepEqual(logo.critique.map((c) => c.verdict), ['redo', i === 0 ? 'keep' : 'redo']);
    assert.equal(logo.passed, i === 0);
    assert.match(logo.critic, /same model/);
    assert.deepEqual({ reason: logo.palette.reason, light: logo.palette.light, dark: logo.palette.dark }, PALETTE);
    assert.deepEqual(logo.palette.contrast.light, { ground: '#ffffff', primary: 12.2, accent: 6.3, neutral: 14.2 });
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
    assert.ok(sheet.includes(`<p data-logo="idea"><!--logo:idea-->${logo.concept.idea}${i === 0 ? '' : '<br><strong>Did not pass the self-critique.</strong> A stranger sees "hairline"; reads as a pause button (score 6 of 10). Shown as the best attempt.'}<!--/logo:idea--></p>`));
    assert.match(sheet, /<div data-logo="palette"><!--logo:palette-->[^]*A deep tea green[^]*Primary #1f3b2d<br><small>12\.2:1 contrast, passes 3:1[^]*Dark, on #121212[^]*<!--\/logo:palette--><\/div>/);
  }

  // refine: the logo files and the sheet (with each file named by its path again, and its slots empty) seed the engine; only the mark changes.
  const before = seen.length;
  const refined = JSON.parse((await run(['refine', join(dir, 'tea-2.html'), 'a rounder leaf', '--out', join(dir, 'tea-round.html')])).stdout).refined;
  assert.match(seen[before], /Revise this logo option: a rounder leaf/);
  assert.match(seen[before], /data-logo=\\"idea\\"><\/p>/);
  assert.equal(refined.logo_dir, join(dir, 'tea-round.logo'));
  assert.notEqual(readFileSync(join(dir, 'tea-round.logo', 'mark.svg'), 'utf8'), readFileSync(join(dir, 'tea-2.logo', 'mark.svg'), 'utf8'));
  assert.equal(readFileSync(join(dir, 'tea-round.logo', 'wordmark.svg'), 'utf8'), CLEAN['wordmark.svg']);
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
