// The render check on the real CLI: the page is rendered headless at 390px in light and in dark,
// and a page that overflows on a phone or has no dark theme fails done, so the model fixes it
// inside the loop. The browser is the one on this machine; with none the check is skipped.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

const CLI = new URL('../src/cli.mjs', import.meta.url).pathname;

const BROKEN = '<!doctype html><html><head><title>Notes</title><style>body{margin:0;font:16px/1.5 system-ui,sans-serif}.card{width:820px;padding:8px;background:#eee}</style></head><body><h1>Notes</h1><div class="card">A card far too wide for a phone.</div></body></html>';
const FIXED = '<!doctype html><html><head><title>Notes</title><style>:root{--bg:#fff;--fg:#111}@media (prefers-color-scheme: dark){:root{--bg:#101418;--fg:#e8eaed}}body{margin:0;font:16px/1.5 system-ui,sans-serif;background:var(--bg);color:var(--fg)}.card{max-width:100%;padding:8px;background:#eee}</style></head><body><h1>Notes</h1><div class="card">A card that fits the phone.</div></body></html>';

const DARK_ONLY = '<!doctype html><html><head><title>Notes</title><style>:root{color-scheme:dark}body{margin:0;font:16px/1.5 system-ui,sans-serif;background:#050505;color:#e8ffe8}.card{max-width:100%;padding:8px;background:#111}</style></head><body><h1>Notes</h1><div class="card">A dark page on a phone.</div></body></html>';

const ev = (o) => `event: ${o.type}\ndata: ${JSON.stringify(o)}\n\n`;
const DESIGN = readFileSync(new URL('../vendor/open-codesign/apps/desktop/resources/templates/scaffolds/design-systems/DESIGN.md', import.meta.url), 'utf8');

// A stand-in model that plans, writes the DESIGN.md the engine's done needs and the broken page, checks it, reads the failure and writes the fixed page.
function standIn(seen, [first, second] = [BROKEN, FIXED], path = 'index.html') {
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      seen.push(body);
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const n = seen.length - 1;
      const call = (name, args, i = 0) => ({ type: 'function_call', id: `fc${n}-${i}`, call_id: `c${n}-${i}`, name, arguments: JSON.stringify(args) });
      const items = n === 0 ? [call('set_todos', { items: [{ text: 'Write the page', checked: false }] })]
        : n === 1 ? [call('str_replace_based_edit_tool', { command: 'create', path: 'DESIGN.md', file_text: DESIGN }), call('str_replace_based_edit_tool', { command: 'create', path, file_text: first }, 1)]
        : n === 2 ? [call('done', { path })]
        : n === 3 ? [call('str_replace_based_edit_tool', { command: 'create', path, file_text: second })]
        : n === 4 ? [call('done', { path })]
        : [{ type: 'message', id: 'm1', status: 'completed', content: [{ type: 'output_text', text: 'The design is ready.' }] }];
      res.end(items.map((item, output_index) => ev({ type: 'response.output_item.added', output_index, item }) + ev({ type: 'response.output_item.done', output_index, item })).join('')
        + ev({ type: 'response.completed', response: { id: `r${n}`, status: 'completed', usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } } }));
    });
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

const home = (dir) => ({ ...process.env, HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir, OPENCODE_API_KEY: 'test-key' });

test('a page that overflows at 390 or has no dark theme fails done, and the model fixes it in the loop', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-render-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const seen = [], server = await standIn(seen);
  t.after(() => server.close());
  const env = { ...home(dir), FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}` };
  const run = (...args) => promisify(execFile)(process.execPath, [CLI, ...args], { env });
  await run('init', '--agent', 'byokit:opencode-go', '--model', 'muse-spark-1.3-contributor');
  const out = join(dir, 'notes.html');
  const { stdout } = await run('make', 'a notes page', '--out', out);
  const made = JSON.parse(stdout).made;
  if (made.render_check === 'skipped') return t.skip('no Chrome or Chromium on this machine');
  assert.equal(made.render_check, 'checked');
  // The failure reached the model: it names the widest offending element and the missing dark theme.
  const told = seen.slice(3).join('');
  assert.match(told, /has_errors/);
  assert.match(told, /px wide on a 390px phone/);
  assert.match(told, /<div class=\\+"card\\+">/); // the body is JSON, so its quotes are escaped
  assert.match(told, /no real light and dark themes/);
  // The model fixed both, so the run ended with a page that fits and has a dark theme.
  const html = readFileSync(out, 'utf8');
  assert.match(html, /A card that fits the phone/);
  assert.match(html, /prefers-color-scheme/);
});

test('with no browser on the machine the render check is skipped with one warning line', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-render-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const seen = [], server = await standIn(seen);
  t.after(() => server.close());
  const env = { ...home(dir), FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}`, FIRST_DRAFT_CHROME: join(dir, 'no-browser-here') };
  const run = (...args) => promisify(execFile)(process.execPath, [CLI, ...args], { env });
  await run('init', '--agent', 'byokit:opencode-go', '--model', 'muse-spark-1.3-contributor');
  const out = join(dir, 'notes.html');
  const { stdout, stderr } = await run('make', 'a notes page', '--out', out);
  assert.equal(JSON.parse(stdout).made.render_check, 'skipped');
  assert.equal(stderr.trim().split('\n').length, 1, 'one clear warning line');
  assert.match(stderr, /no Chrome or Chromium was found/);
  assert.equal(existsSync(out), true);
});

test('a named dark style must render a dark page: a light page fails done, one dark in light and in dark passes; a page with no style still needs a light and a dark theme', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-render-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const run = async (seen, pages, ...args) => {
    const server = await standIn(seen, pages);
    t.after(() => server.close());
    const env = { ...home(dir), FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}` };
    return promisify(execFile)(process.execPath, [CLI, ...args], { env });
  };
  await run([], [BROKEN, FIXED], 'init', '--agent', 'byokit:opencode-go', '--model', 'muse-spark-1.3-contributor');
  // oled-neon is dark-first: the model first writes a page with a light default (FIXED), is told so, and writes a dark one.
  const seen = [], out = join(dir, 'neon.html');
  const { stdout } = await run(seen, [FIXED, DARK_ONLY], 'make', 'a notes page', '--out', out, '--direction', 'oled-neon');
  if (JSON.parse(stdout).made.render_check === 'skipped') return t.skip('no Chrome or Chromium on this machine');
  assert.match(seen[0], /dark-first, so the page is dark by default/);
  assert.doesNotMatch(seen[0], /Never write one dark palette for both/);
  assert.match(seen.slice(3).join(''), /the style is dark-first but the page paints a light background in light/);
  const html = readFileSync(out, 'utf8');
  assert.match(html, /A dark page on a phone/);
  assert.doesNotMatch(html, /prefers-color-scheme/);
  // With no style the same dark-only page is still refused: the page needs a real light theme and a real dark one.
  const plain = [], outPlain = join(dir, 'plain.html');
  await run(plain, [DARK_ONLY, FIXED], 'make', 'a notes page', '--out', outPlain);
  assert.match(plain[0], /Never write one dark palette for both/);
  assert.match(plain.slice(3).join(''), /no real light and dark themes/);
  assert.match(readFileSync(outPlain, 'utf8'), /A card that fits the phone/);
});

// The engine's own source: App.jsx on its runtime (React state, a handler, screens), first with a syntax error the model is told about, then fixed.
const APP_BROKEN = 'function App() { return <main><h1>Runs this week</h1></main> ';
const APP = `function App() {
  const [streak] = React.useState(4);
  return (
    <main>
      <style>{':root{--bg:#fff;--fg:#111}@media (prefers-color-scheme: dark){:root{--bg:#101418;--fg:#e8eaed}}body{background:var(--bg);color:var(--fg)}'}</style>
      <section id="home" data-oc-screen="home"><h1>Runs this week</h1><p>{streak}-day streak</p><a href="#race">Next race</a><button onClick={() => alert('hi')}>Start run</button></section>
      <section id="race" data-oc-screen="race"><h2>Harbour 10K</h2><a href="#home">Back</a></section>
    </main>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);`;

test('the engine writes App.jsx; the model is told its runtime error and fixes it, and the board gets the page it draws as static HTML', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-render-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const seen = [], server = await standIn(seen, [APP_BROKEN, APP], 'App.jsx');
  t.after(() => server.close());
  const env = { ...home(dir), FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}` };
  const run = (...args) => promisify(execFile)(process.execPath, [CLI, ...args], { env });
  await run('init', '--agent', 'byokit:opencode-go', '--model', 'muse-spark-1.3-contributor');
  const out = join(dir, 'runs.html');
  const { stdout } = await run('make', 'the home screen of a running app', '--out', out);
  const made = JSON.parse(stdout).made;
  if (made.render_check === 'skipped') return t.skip('no Chrome or Chromium on this machine');
  assert.match(seen[0], /the host renders it once in a headless browser/); // the engine is told how its source becomes the board page
  assert.equal(made.files[0].source, 'App.jsx');
  assert.equal(made.files[0].tools.set_todos, 1);
  assert.match(seen.slice(3).join(''), /has_errors.*SyntaxError/); // the source's own runtime error reached the model
  const html = readFileSync(out, 'utf8');
  assert.match(html, /<h1>Runs this week<\/h1><p>4-day streak<\/p>/); // what React drew, state included
  assert.match(html, /id="race" data-oc-screen="race"/); // screens stay, for Play
  assert.match(html, /Content-Security-Policy/);
  assert.doesNotMatch(html, /<script\b|onclick|alert\(|ReactDOM|Babel/i); // no runtime, no handler: a static page
});
