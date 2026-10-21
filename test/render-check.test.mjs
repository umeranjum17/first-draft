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

const ev = (o) => `event: ${o.type}\ndata: ${JSON.stringify(o)}\n\n`;

// A stand-in model that writes the broken page, checks it, reads the failure and writes the fixed page.
function standIn(seen) {
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      seen.push(body);
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const n = seen.length - 1;
      const call = (name, args) => ({ type: 'function_call', id: `fc${n}`, call_id: `c${n}`, name, arguments: JSON.stringify(args) });
      const item = n === 0 ? call('str_replace_based_edit_tool', { command: 'create', path: 'index.html', file_text: BROKEN })
        : n === 1 ? call('done', { path: 'index.html' })
        : n === 2 ? call('str_replace_based_edit_tool', { command: 'create', path: 'index.html', file_text: FIXED })
        : n === 3 ? call('done', { path: 'index.html' })
        : { type: 'message', id: 'm1', status: 'completed', content: [{ type: 'output_text', text: 'The design is ready.' }] };
      res.end(ev({ type: 'response.output_item.added', output_index: 0, item }) + ev({ type: 'response.output_item.done', output_index: 0, item })
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
  const told = seen.slice(2).join('');
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
