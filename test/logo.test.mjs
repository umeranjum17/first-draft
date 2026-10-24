// The logo journey on the built CLI and the machine's Chrome, against a local stand-in for the provider (no paid call):
// logo refuses to start without a browser; the stand-in first writes logo files the allow-list refuses, reads done's findings and
// writes clean ones; each option gets its brand sheet and its .logo/ folder (9 SVGs, the icon PNGs at their real sizes, favicon.ico,
// logo.json); refine, in the CLI and from the Studio's brief, starts from the option's logo files and writes a new folder.
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
const svg = (box, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}">${body}</svg>`;
const leaf = (c, d = 'M48 12C30 28 24 50 48 84C72 50 66 28 48 12Z') => `<path fill="${c}" d="${d}"/>`;
const word = (c, x = 0) => `<path fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round" d="M${x + 12} 12V44M${x + 28} 24V44M${x + 28} 32a10 10 0 0 1 20 0V44"/>`;
const CLEAN = Object.fromEntries([['', INK], ['-dark', MILK]].flatMap(([s, c]) => [
  [`mark${s}.svg`, svg('0 0 96 96', leaf(c))],
  [`wordmark${s}.svg`, svg('0 0 64 56', word(c))],
  [`lockup-horizontal${s}.svg`, svg('0 0 168 96', `${leaf(c)}${word(c, 100)}`)],
  [`lockup-stacked${s}.svg`, svg('0 0 96 160', `${leaf(c)}<g transform="translate(16 100)">${word(c)}</g>`)],
]).concat([['icon.svg', svg('0 0 96 96', `<rect width="96" height="96" fill="${INK}"/><g transform="translate(19.2 19.2) scale(.6)">${leaf(MILK)}</g>`)]]));
const REFUSED = { ...CLEAN, 'mark.svg': svg('0 0 96 96', '<text x="10" y="50">U</text>'), 'wordmark.svg': svg('0 0 64 56', '<image href="https://example.com/w.png" width="64" height="56"/>'), 'icon.svg': CLEAN['icon.svg'].replace('0 0 96 96', '0 0 96 64') };
const SHEET = `<!doctype html><html lang="en"><head><title>Umer's tea shop</title><style>:root{--bg:#f7f4ee;--fg:#1d1d1b;color-scheme:light dark}@media (prefers-color-scheme: dark){:root{--bg:#141513;--fg:#ecebe6}}
body{margin:0;padding:24px;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif}img{max-width:100%;height:auto}.tiles{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))}.tiles>*{min-width:0;padding:16px;background:#fff}.tiles>.night{background:#121212}</style></head>
<body><h1>Umer's tea shop</h1><p>A leaf that is also a cup.</p><img src="logo/mark.svg" alt="Mark" width="160"><div class="tiles">${['wordmark', 'lockup-horizontal', 'lockup-stacked'].map((n) => `<div><img src="logo/${n}.svg" alt="${n}"></div>`).join('')}
${['mark', 'wordmark', 'lockup-horizontal', 'lockup-stacked'].map((n) => `<div class="night"><img src="logo/${n}-dark.svg" alt="${n} on dark"></div>`).join('')}</div>
<p><img src="logo/icon.svg" alt="App icon" width="96"> <img src="logo/icon-16.png" width="16" height="16" alt="Icon at 16 px"> <img src="logo/icon-32.png" width="32" height="32" alt="Icon at 32 px"></p></body></html>`;

const ev = (o) => `event: ${o.type}\ndata: ${JSON.stringify(o)}\n\n`;
const create = (path, file_text) => ['str_replace_based_edit_tool', { command: 'create', path, file_text }];
// A stand-in model, one script per conversation: a new logo plans, writes DESIGN.md, refused logo files and the sheet, runs done, reads its
// findings, writes clean files and runs done again; a refine writes DESIGN.md (done needs it), views the mark (the editor needs it), makes the leaf rounder and runs done.
function standIn(seen) {
  let start = 0, refine = false;
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      seen.push(body);
      if (!body.includes('function_call_output')) { start = seen.length - 1; refine = body.includes('Revise this logo option'); }
      const n = seen.length - 1 - start;
      const make = [
        [['set_todos', { items: [{ text: 'Draw the logo files and the sheet', checked: false }] }]],
        [create('DESIGN.md', DESIGN), ...Object.entries(REFUSED).map(([f, t]) => create(`logo/${f}`, t)), create('index.html', SHEET)],
        [['done', { path: 'index.html' }]],
        Object.entries(CLEAN).map(([f, t]) => create(`logo/${f}`, t)),
        [['done', { path: 'index.html' }]],
      ];
      const round = 'M48 14C26 30 22 52 48 84C74 52 70 30 48 14Z';
      const revise = [
        [['set_todos', { items: [{ text: 'Round the leaf', checked: false }] }]],
        [create('DESIGN.md', DESIGN), ['str_replace_based_edit_tool', { command: 'view', path: 'logo/mark.svg' }], ['str_replace_based_edit_tool', { command: 'str_replace', path: 'logo/mark.svg', old_str: 'M48 12C30 28 24 50 48 84C72 50 66 28 48 12Z', new_str: round }]],
        [['done', { path: 'index.html' }]],
      ];
      const calls = (refine ? revise : make)[n];
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

test('logo: options as brand sheets with checked SVG files and the app icon set; refine starts from the logo files', async (t) => {
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
  for (const bad of [['--ref', 'a.png'], ['--options', '6'], ['--assets', 'codex']]) await assert.rejects(run(['logo', brief, '--out', out, ...bad]), (e) => JSON.parse(e.stdout).error.code === 'USAGE');
  if (!findBrowser()) return t.skip('no Chrome or Chromium on this machine');
  assert.equal(JSON.parse((await run(['styles', '--logo'])).stdout).logo_directions[0].id, 'geometric-symbol');

  const made = JSON.parse((await run(['logo', brief, '--out', out, '--options', '2'])).stdout).made;
  assert.equal(made.files.length, 2);
  const firsts = seen.filter((s) => !s.includes('function_call_output'));
  assert.match(firsts[0], /first-draft logo mode/);
  assert.match(firsts[0], /Logo direction: Geometric symbol/);
  assert.match(firsts[1], /Logo direction: Lettermark/);
  // done refused the first files and said why, file by file; the model fixed them in the loop.
  const findings = told(seen);
  assert.match(findings, /logo\/mark\.svg: <text> is not allowed: draw every letter as a path/);
  assert.match(findings, /logo\/wordmark\.svg: <image> is not allowed/);
  assert.match(findings, /logo\/wordmark\.svg: <image href=\\?"https:\/\/example\.com\/w\.png\\?"> links outside the file/);
  assert.match(findings, /logo\/icon\.svg: its viewBox is 96 by 64, not square/);
  for (const [i, f] of made.files.entries()) {
    const folder = join(dir, `tea-${i + 1}.logo`);
    assert.equal(f.file, join(dir, `tea-${i + 1}.html`));
    assert.equal(f.logo_dir, folder);
    assert.deepEqual(readdirSync(folder).sort(), [...Object.keys(CLEAN), ...[16, 32, 48, 180, 192, 512, 1024].map((n) => `icon-${n}.png`), 'favicon.ico', 'logo.json'].sort());
    for (const [name, text] of Object.entries(CLEAN)) assert.equal(readFileSync(join(folder, name), 'utf8'), text);
    for (const n of [16, 32, 48, 180, 192, 512, 1024]) assert.deepEqual(png(join(folder, `icon-${n}.png`)), [n, n], `icon-${n}.png is ${n} px`);
    const ico = readFileSync(join(folder, 'favicon.ico'));
    assert.deepEqual([ico.readUInt16LE(2), ico.readUInt16LE(4)], [1, 3]);
    for (const [k, n] of [16, 32, 48].entries()) {
      const at = ico.readUInt32LE(6 + 16 * k + 12), size = ico.readUInt32LE(6 + 16 * k + 8);
      assert.equal(ico.readUInt8(6 + 16 * k), n);
      assert.deepEqual(ico.subarray(at, at + size), readFileSync(join(folder, `icon-${n}.png`)), `favicon.ico holds icon-${n}.png`);
    }
    const logo = JSON.parse(readFileSync(join(folder, 'logo.json'), 'utf8'));
    assert.equal(logo.brief, brief);
    assert.deepEqual(logo.palette, [INK, MILK]);
    assert.equal(logo.checks.icon.full_bleed, true);
    assert.equal(logo.checks.icon.outside_safe_zone, 0);
    assert.ok(logo.checks.icon.ink_16 >= 0.06 && logo.checks.icon.contrast_16 >= 3, JSON.stringify(logo.checks.icon));
    assert.ok(Object.values(logo.checks.tiles).every((x) => x.contrast >= 3), JSON.stringify(logo.checks.tiles));
    assert.deepEqual(f.checks, logo.checks);
    // The sheet is one self-contained page: every logo file embedded as itself, nothing left to load.
    const sheet = readFileSync(f.file, 'utf8');
    assert.match(sheet, /Content-Security-Policy/);
    for (const [name, text] of Object.entries(CLEAN)) assert.ok(sheet.includes(`data:image/svg+xml;base64,${Buffer.from(text).toString('base64')}`), `the sheet shows ${name}`);
    assert.ok(sheet.includes(`data:image/png;base64,${readFileSync(join(folder, 'icon-16.png')).toString('base64')}`), 'the sheet shows the 16 px icon');
    assert.doesNotMatch(sheet, /src="logo\//);
  }

  // refine: the logo files and the sheet (with each file named by its path again) seed the engine; only the mark changes.
  const before = seen.length;
  const refined = JSON.parse((await run(['refine', join(dir, 'tea-1.html'), 'a rounder leaf', '--out', join(dir, 'tea-round.html')])).stdout).refined;
  assert.match(seen[before], /Revise this logo option: a rounder leaf/);
  assert.equal(refined.logo_dir, join(dir, 'tea-round.logo'));
  assert.match(readFileSync(join(dir, 'tea-round.logo', 'mark.svg'), 'utf8'), /M48 14C26 30/);
  assert.equal(readFileSync(join(dir, 'tea-round.logo', 'wordmark.svg'), 'utf8'), CLEAN['wordmark.svg']);
  assert.equal(JSON.parse(readFileSync(join(dir, 'tea-round.logo', 'logo.json'), 'utf8')).refined_from, join(dir, 'tea-1.html'));
  assert.equal(readFileSync(join(dir, 'tea-1.logo', 'mark.svg'), 'utf8'), CLEAN['mark.svg'], 'the option it came from is untouched');

  // The Studio's brief runs the same refine: the new option joins the design with its own logo folder.
  const view = spawn(process.execPath, [CLI, 'view', out, '--host', '127.0.0.1', '--port', '0'], { env });
  t.after(() => view.kill());
  const url = JSON.parse(await new Promise((ok) => view.stdout.once('data', ok))).viewing.url;
  const sent = await fetch(`${url}refine`, { method: 'POST', headers: { 'content-type': 'application/json', origin: new URL(url).origin }, body: JSON.stringify({ option: 1, change: 'a rounder leaf' }) });
  assert.equal(sent.status, 200, await sent.clone().text());
  assert.deepEqual(await sent.json(), { option: { n: 3, label: 'tea-1-refined', file: 'tea-1-refined.html' } });
  assert.match(readFileSync(join(dir, 'tea-1-refined.logo', 'mark.svg'), 'utf8'), /M48 14C26 30/);
  assert.ok(existsSync(join(dir, 'tea-1-refined.logo', 'favicon.ico')));
});
