// The whole make journey on the built CLI: config, BYOKit's opencode-go plan key route
// against a local stand-in for the provider, and the mock files. No paid call is made.
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

const CLI = new URL('../src/cli.mjs', import.meta.url).pathname;
// These journeys test the engine loop with bare pages; the render check has its own test (render-check.test.mjs).
process.env.FIRST_DRAFT_CHROME = '/nonexistent';
const PAGE = '<!doctype html><html><body><h1>Sign in to your notes</h1><img alt="Notes" src=https://example.com/image.png><img alt="Notes" srcset="//cdn.example.com/a.png 1x, https://cdn.example.com/b.png 2x"><form action="https://example.com/submit"><input placeholder="Email"></form></body></html>';

const ev = (o) => `event: ${o.type}\ndata: ${JSON.stringify(o)}\n\n`;
// The engine's own first steps on a fresh workspace: a plan (set_todos), then the DESIGN.md its done requires, here the engine's own starter one.
const DESIGN = readFileSync(new URL('../vendor/open-codesign/apps/desktop/resources/templates/scaffolds/design-systems/DESIGN.md', import.meta.url), 'utf8');
const PLAN = { type: 'function_call', id: 'fc-plan', call_id: 'c-plan', name: 'set_todos', arguments: JSON.stringify({ items: [{ text: 'Write the page', checked: false }] }) };
const START = [{ type: 'function_call', id: 'fc-design', call_id: 'c-design', name: 'str_replace_based_edit_tool', arguments: JSON.stringify({ command: 'create', path: 'DESIGN.md', file_text: DESIGN }) }];
const fresh = (body) => !body.includes('function_call_output'); // the conversation's first turn: the engine asks for a plan before any edit
const plan = (res) => { res.writeHead(200, { 'content-type': 'text/event-stream' }); res.end(ev({ type: 'response.output_item.added', output_index: 0, item: PLAN }) + ev({ type: 'response.output_item.done', output_index: 0, item: PLAN }) + ev({ type: 'response.completed', response: { id: 'r-plan', status: 'completed', usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 } } })); };

// A local provider drives the actual upstream edit -> done -> final tool loop.
function standIn(seen, edit, doneFirst = true, donePath = 'index.html', page = PAGE, extra = null, pre = null) {
  const full = 'The design is ready.';
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      if (fresh(body)) return plan(res);
      seen.push({ url: req.url, auth: req.headers.authorization, session: req.headers['x-opencode-session'], body: JSON.parse(body) });
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      // make's follow-up after a run that ended with done not passing: call done again, then finish.
      if (body.includes('as you left them') && !body.includes('c-again')) {
        const again = { type: 'function_call', id: 'fc-again', call_id: 'c-again', name: 'done', arguments: JSON.stringify({ path: donePath }) };
        return res.end(ev({ type: 'response.output_item.added', output_index: 0, item: again }) + ev({ type: 'response.output_item.done', output_index: 0, item: again })
          + ev({ type: 'response.completed', response: { id: 'r-again', status: 'completed', usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 } } }));
      }
      const step = body.includes('as you left them') ? 2 : (seen.length - 1) % 3;
      if (step < 2) {
        const html = typeof page === 'function' ? page() : page;
        const content = body.includes('script fixture') ? html.replace('</body>', '<script>alert(1)</script></body>') : html;
        const item = { type: 'function_call', id: `fc${seen.length}`, call_id: `c${seen.length}`, name: step === 0 ? 'str_replace_based_edit_tool' : 'done',
          arguments: JSON.stringify(step === 0 ? { command: body.includes('view fixture') ? 'view' : 'create', path: 'index.html', file_text: content } : { path: donePath }) };
        const mutation = { type: 'function_call', id: 'fc-edit', call_id: 'c-edit', name: 'str_replace_based_edit_tool', arguments: JSON.stringify({ path: 'index.html', ...edit }) };
        const items = step !== 1 ? [...START, item] : edit ? (doneFirst ? [item, mutation] : [mutation, item]) : [...(pre ?? []), item, ...(extra ?? [])];
        res.end(items.map((item, output_index) => ev({ type: 'response.output_item.added', output_index, item }) + ev({ type: 'response.output_item.done', output_index, item })).join('')
          + ev({ type: 'response.completed', response: { id: `r${seen.length}`, status: 'completed', usage: { input_tokens: 11, output_tokens: 22, total_tokens: 33 } } }));
        return;
      }
      res.end(ev({ type: 'response.created', response: { id: 'r1' } })
        + ev({ type: 'response.output_item.added', output_index: 0, item: { type: 'message', id: 'm1' } })
        + ev({ type: 'response.output_text.delta', output_index: 0, item_id: 'm1', content_index: 0, delta: full })
        + ev({ type: 'response.output_item.done', output_index: 0, item: { type: 'message', id: 'm1', status: 'completed', content: [{ type: 'output_text', text: full, annotations: [] }] } })
        + ev({ type: 'response.completed', response: { id: 'r1', status: 'completed', usage: { input_tokens: 11, output_tokens: 22, total_tokens: 33 } } }));
    });
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

test('CLI option controls reach the real engine and reject bad values before calling it', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-controls-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const seen = [], server = await standIn(seen, null);
  t.after(() => server.close());
  const env = { ...process.env, HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir, OPENCODE_API_KEY: 'test-key', FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}` };
  const run = (...args) => promisify(execFile)(process.execPath, [CLI, ...args], { env, cwd: dir });
  await run('init', '--agent', 'byokit:opencode-go', '--model', 'configured-model');
  const config = readFileSync(join(dir, 'config.json'), 'utf8');
  writeFileSync(join(dir, 'brief.md'), 'A notes app for Umer');
  for (const n of [1, 3, 5, undefined]) {
    seen.length = 0;
    const count = n ?? 3, out = join(dir, `options-${n ?? 'default'}`);
    const { stdout } = await run('make', '--brief-file', 'brief.md', '--out-dir', out,
      ...(n === undefined ? [] : ['--options', String(n)]), '--screens', 'Sign in, Notes', '--style', 'editorial', '--model', 'muse-spark-1.3-contributor');
    const made = JSON.parse(stdout).made;
    assert.equal(made.files.length, count);
    assert.equal(seen.length, count * 3);
    for (let i = 0; i < count; i++) {
      assert.equal(made.files[i].file, join(out, `option-${i + 1}.html`));
      assert.match(readFileSync(made.files[i].file, 'utf8'), /Content-Security-Policy/);
      const sent = JSON.stringify(seen[i * 3].body);
      assert.match(sent, /A notes app for Umer/);
      assert.match(sent, /Required screens\/pages: Sign in, Notes/);
      assert.match(sent, /Design direction: Editorial/);
      assert.equal(seen[i * 3].body.model, 'muse-spark-1.3-contributor');
    }
  }
  assert.equal(readFileSync(join(dir, 'config.json'), 'utf8'), config, 'model override is not saved');
  const before = seen.length;
  writeFileSync(join(dir, 'empty.md'), '  ');
  writeFileSync(join(dir, 'binary.md'), Buffer.from([255]));
  writeFileSync(join(dir, 'large.md'), 'a'.repeat(100_001));
  for (const bad of [
    ...['0', '6', '-1', '1.5', 'NaN', '1e0', ''].map((n) => ['--options', n]),
    ['--count', '0'], ['--options', '1', '--count', '1'], ['--direction', 'x', '--style', 'y'],
    ['--out-dir', 'other'], ['--screens', 'A,,B'], ['--screens', Array(13).fill('A').join(',')],
    ['--screens', 'a'.repeat(101)], ['--screens', ' '], ['--model', 'bad model'], ['--model', ''],
    ['--direction', ' '], ['--style', ''], ['--brief-file', 'missing.md'], ['--brief-file', 'empty.md'],
    ['--brief-file', 'binary.md'], ['--brief-file', 'large.md'], ['--brief-file', '.'], ['--out', ''], ['--unknown', 'x'],
  ]) await assert.rejects(run('make', 'Notes', '--out', 'bad.html', ...bad), (e) => {
    assert.equal(e.code, 1);
    assert.equal(JSON.parse(e.stdout).error.code, 'USAGE');
    return true;
  });
  assert.equal(seen.length, before, 'invalid controls never call the provider');
  assert.equal(existsSync(join(dir, 'bad.html')), false);
  const help = (await run('make', '--help')).stdout;
  for (const flag of ['options', 'count', 'direction', 'style', 'screens', 'brief-file', 'model', 'out', 'out-dir']) assert.ok(help.includes(`--${flag}`));
});

test('make requires verification after every batched mutation', async (t) => {
  for (const edit of [
    { command: 'create', file_text: PAGE.replace('Sign in', 'revised') },
    { command: 'str_replace', old_str: 'Sign in', new_str: 'revised' },
    { command: 'insert', insert_line: 0, new_str: '<!-- revised -->' },
  ]) for (const doneFirst of [true, false]) await t.test(`${edit.command}, done ${doneFirst ? 'before' : 'after'} edit`, async (t) => {
    const dir = mkdtempSync(join(tmpdir(), 'first-draft-test-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const seen = [], server = await standIn(seen, edit, doneFirst);
    t.after(() => server.close());
    const env = { ...process.env, HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir, OPENCODE_API_KEY: 'test-key', FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}` };
    const run = (...args) => promisify(execFile)(process.execPath, [CLI, ...(args[0] === 'make' && !args.includes('--count') ? [...args, '--options', '1'] : args)], { env });
    const out = join(dir, 'mock.html');
    await run('init', '--agent', 'byokit:opencode-go', '--model', 'muse-spark-1.3-contributor');
    // An edit after done is never exported unchecked: make asks for done again and exports the version that passed.
    await run('make', 'a notes page', '--out', out);
    assert.match(readFileSync(out, 'utf8'), /revised/);
    assert.equal(seen.length, doneFirst ? 5 : 3);
    if (doneFirst) assert.match(JSON.stringify(seen[3].body), /has not passed yet/);
  });
});

test('make accepts a headless HTML5 document and injects the policy', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const seen = [], server = await standIn(seen, null, true, 'index.html', '<!doctype html><title>Notes</title><body><h1>Sign in to your notes</h1></body>');
  t.after(() => server.close());
  const env = { ...process.env, HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir, OPENCODE_API_KEY: 'test-key', FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}` };
  const run = (...args) => promisify(execFile)(process.execPath, [CLI, ...(args[0] === 'make' && !args.includes('--count') ? [...args, '--options', '1'] : args)], { env });
  await run('init', '--agent', 'byokit:opencode-go', '--model', 'muse-spark-1.3-contributor');
  const out = join(dir, 'headless.html');
  await run('make', 'a notes page', '--out', out);
  const html = readFileSync(out, 'utf8');
  assert.match(html, /^<!doctype html><head><meta http-equiv="Content-Security-Policy"/i);
  assert.match(html, /Sign in to your notes/);
});

test('a headless export with a page header still carries the policy inside head', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const seen = [], server = await standIn(seen, null, true, 'index.html', '<!doctype html><body><header><nav>Notes</nav></header><main><h1>Sign in to your notes</h1></main></body>');
  t.after(() => server.close());
  const env = { ...process.env, HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir, OPENCODE_API_KEY: 'test-key', FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}` };
  const run = (...args) => promisify(execFile)(process.execPath, [CLI, ...(args[0] === 'make' && !args.includes('--count') ? [...args, '--options', '1'] : args)], { env });
  await run('init', '--agent', 'byokit:opencode-go', '--model', 'muse-spark-1.3-contributor');
  const out = join(dir, 'headless-header.html');
  await run('make', 'a notes page', '--out', out);
  const html = readFileSync(out, 'utf8');
  const headStart = html.search(/<head[\s>]/i), headEnd = html.search(/<\/head>/i), policy = html.indexOf('Content-Security-Policy'), header = html.indexOf('<header>');
  assert.ok(headStart >= 0, html);
  assert.ok(policy > headStart && policy < headEnd, 'the policy is inside the head element');
  assert.ok(header > headEnd, 'the page header stays outside head');
});

test('an unrelated done call keeps the verified export', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const elsewhere = { type: 'function_call', id: 'fc-elsewhere', call_id: 'c-elsewhere', name: 'done', arguments: JSON.stringify({ path: 'App.jsx' }) };
  const seen = [], server = await standIn(seen, null, true, 'index.html', PAGE, [elsewhere]);
  t.after(() => server.close());
  const env = { ...process.env, HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir, OPENCODE_API_KEY: 'test-key', FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}` };
  const run = (...args) => promisify(execFile)(process.execPath, [CLI, ...(args[0] === 'make' && !args.includes('--count') ? [...args, '--options', '1'] : args)], { env });
  await run('init', '--agent', 'byokit:opencode-go', '--model', 'muse-spark-1.3-contributor');
  const out = join(dir, 'kept.html');
  await run('make', 'a notes page', '--out', out);
  assert.match(readFileSync(out, 'utf8'), /Content-Security-Policy/);
  assert.equal(seen.length, 3);
});

test('edits outside index.html keep the verified export', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const elsewhere = [
    { type: 'function_call', id: 'fc-md', call_id: 'c-md', name: 'str_replace_based_edit_tool', arguments: JSON.stringify({ command: 'create', path: 'DESIGN.md', file_text: '# Design\n' }) },
    { type: 'function_call', id: 'fc-jsx', call_id: 'c-jsx', name: 'str_replace_based_edit_tool', arguments: JSON.stringify({ command: 'create', path: 'App.jsx', file_text: 'export default () => null;\n' }) },
    { type: 'function_call', id: 'fc-miss', call_id: 'c-miss', name: 'str_replace_based_edit_tool', arguments: JSON.stringify({ command: 'str_replace', path: 'index.html', old_str: 'no such text', new_str: 'x' }) },
  ];
  const seen = [], server = await standIn(seen, null, true, 'index.html', PAGE, elsewhere);
  t.after(() => server.close());
  const env = { ...process.env, HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir, OPENCODE_API_KEY: 'test-key', FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}` };
  const run = (...args) => promisify(execFile)(process.execPath, [CLI, ...(args[0] === 'make' && !args.includes('--count') ? [...args, '--options', '1'] : args)], { env });
  await run('init', '--agent', 'byokit:opencode-go', '--model', 'muse-spark-1.3-contributor');
  const out = join(dir, 'kept-edit.html');
  await run('make', 'a notes page', '--out', out);
  assert.match(readFileSync(out, 'utf8'), /Sign in to your notes/);
  assert.equal(seen.length, 3);
});

test('make verifies an export path the model spells loosely', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const seen = [], server = await standIn(seen, null, true, './index.html');
  t.after(() => server.close());
  const env = { ...process.env, HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir, OPENCODE_API_KEY: 'test-key', FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}` };
  const run = (...args) => promisify(execFile)(process.execPath, [CLI, ...(args[0] === 'make' && !args.includes('--count') ? [...args, '--options', '1'] : args)], { env });
  await run('init', '--agent', 'byokit:opencode-go', '--model', 'muse-spark-1.3-contributor');
  const out = join(dir, 'loose.html');
  await run('make', 'a notes page', '--out', out);
  assert.match(readFileSync(out, 'utf8'), /Sign in to your notes/);
});

// A local provider that keeps guessing old_str, so the editor must escalate to create.
function guesser(seen, patching = false, page = PAGE) {
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      if (fresh(body)) return plan(res);
      seen.push(JSON.parse(body));
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const n = seen.length - 1;
      if (n < (patching ? 80 : 4)) {
        const item = { type: 'function_call', id: `fc${n}`, call_id: `c${n}`, name: 'str_replace_based_edit_tool',
          arguments: JSON.stringify(n === 0 ? { command: 'create', path: 'index.html', file_text: page } : { command: 'str_replace', path: 'index.html', ...(patching ? { old_str: `to your notes${'!'.repeat(n - 1)}`, new_str: `to your notes${'!'.repeat(n)}` } : { old_str: `guess ${n}`, new_str: 'x' }) }) };
        const items = n === 0 ? [...START, item] : [item];
        res.end(items.map((item, output_index) => ev({ type: 'response.output_item.added', output_index, item }) + ev({ type: 'response.output_item.done', output_index, item })).join('')
          + ev({ type: 'response.completed', response: { id: `r${n}`, status: 'completed', usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } } }));
        return;
      }
      res.end(ev({ type: 'response.output_item.added', output_index: 0, item: { type: 'message', id: 'm1' } })
        + ev({ type: 'response.output_text.delta', output_index: 0, item_id: 'm1', content_index: 0, delta: 'Stuck.' })
        + ev({ type: 'response.output_item.done', output_index: 0, item: { type: 'message', id: 'm1', status: 'completed', content: [{ type: 'output_text', text: 'Stuck.', annotations: [] }] } })
        + ev({ type: 'response.completed', response: { id: 'r9', status: 'completed', usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } } }));
    });
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

test('the editor escalates to create after three failed exact edits', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const seen = [], server = await guesser(seen);
  t.after(() => server.close());
  const env = { ...process.env, HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir, OPENCODE_API_KEY: 'test-key', FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}` };
  const run = (...args) => promisify(execFile)(process.execPath, [CLI, ...(args[0] === 'make' && !args.includes('--count') ? [...args, '--options', '1'] : args)], { env });
  await run('init', '--agent', 'byokit:opencode-go', '--model', 'muse-spark-1.3-contributor');
  const out = join(dir, 'guess.html');
  await assert.rejects(run('make', 'a notes page', '--out', out), (e) => /engine did not verify index.html with done/.test(e.stdout));
  assert.equal(existsSync(out), false);
  assert.match(JSON.stringify(seen[4].input), /Too many failed exact edits/);
});

test('make runs on a BYOKit api-key route as well as a plan-key route', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const seen = [], server = await standIn(seen);
  t.after(() => server.close());
  const env = { ...process.env, HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir, OPENAI_API_KEY: 'test-key', FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}` };
  const run = (...args) => promisify(execFile)(process.execPath, [CLI, ...(args[0] === 'make' && !args.includes('--count') ? [...args, '--options', '1'] : args)], { env });
  await run('init', '--agent', 'byokit:openai:key', '--model', 'gpt-5-mini');
  assert.equal(JSON.parse((await run('doctor')).stdout).ready, true);
  assert.equal(seen.length, 0, 'doctor makes no paid call');
  const reference = join(dir, 'reference.png');
  await promisify(execFile)('convert', ['-size', '3x2', 'xc:purple', reference]);
  await run('make', 'a sign-in page', '--out', join(dir, 'k.html'), '--count', '1', '--ref', reference);
  assert.match(JSON.stringify(seen[0].body), /input_image.*data:image\/png;base64/);
  assert.equal(seen[0].auth, 'Bearer test-key');
  assert.match(readFileSync(join(dir, 'k.html'), 'utf8'), /Sign in to your notes/);
  await run('init', '--agent', 'byokit:openai:key', '--model', 'gpt-5-mini');
  await assert.rejects(promisify(execFile)(process.execPath, [CLI, 'doctor'], { env: { ...env, OPENAI_API_KEY: '' } }), (e) => /OPENAI_API_KEY is not set/.test(e.stdout) && !/test-key/.test(e.stdout + e.stderr));
  await run('init', '--agent', 'byokit:no-such:key', '--model', 'x').catch(() => {});
  await assert.rejects(run('doctor'), (e) => /plan or api key route/.test(e.stdout));
});

test('make writes self-contained mocks through the BYOKit Go route', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const seen = [];
  const server = await standIn(seen);
  t.after(() => server.close());
  const env = { ...process.env, HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir, OPENCODE_API_KEY: 'test-key', FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}` };
  const run = (...args) => promisify(execFile)(process.execPath, [CLI, ...(args[0] === 'make' && !args.includes('--count') ? [...args, '--options', '1'] : args)], { env });

  await assert.rejects(run('make', 'a sign-in page', '--out', join(dir, 'x.html')), (e) => /NO_AGENT/.test(e.stdout));
  await run('init', '--agent', 'byokit:opencode-go', '--model', 'muse-spark-1.3-contributor');
  const health = JSON.parse((await run('doctor')).stdout);
  assert.equal(health.ready, true);
  assert.ok(health.checks.some((c) => c.label === 'engine' && c.status === 'ok'));
  assert.equal(seen.length, 0, 'doctor makes no paid call');

  const { stdout } = await run('make', 'a sign-in page for a notes app', '--out', join(dir, 'sign-in.html'), '--count', '2');
  assert.match(stdout, /"tokens_out":132/);
  const blocked = JSON.parse(stdout).blocked_remote;
  assert.ok(blocked.includes('https://example.com/submit'));
  assert.ok(blocked.includes('https://example.com/image.png'));
  assert.ok(blocked.includes('//cdn.example.com/a.png'));
  assert.ok(blocked.includes('https://cdn.example.com/b.png'));

  assert.equal(seen.length, 6);
  assert.equal(seen[0].auth, 'Bearer test-key');
  assert.ok(seen[0].session, 'every Go call names its conversation');
  assert.equal(seen[0].body.model, 'muse-spark-1.3-contributor');
  assert.notDeepEqual(seen[0].body.input, seen[3].body.input, 'the two options vary');
  assert.ok(seen[0].body.tools.some((t) => t.name === 'str_replace_based_edit_tool'));
  assert.match(JSON.stringify(seen[1].body.input), /Created index.html/);
  assert.match(JSON.stringify(seen[2].body.input), /no syntactic or runtime issues/);
  assert.match(JSON.stringify(seen[0].body), /a remote image is blocked/); // the system's own rules ride along

  await run('make', 'a notes dashboard', '--out', join(dir, 'mocks/design'), '--count', '2');
  assert.ok(readFileSync(join(dir, 'mocks/design-1'), 'utf8').includes('default-src'));
  assert.ok(readFileSync(join(dir, 'mocks/design-2'), 'utf8').includes('default-src'));

  for (const n of [1, 2]) {
    const html = readFileSync(join(dir, `sign-in-${n}.html`), 'utf8');
    assert.match(html, /<head[^>]*>\s*<meta http-equiv="Content-Security-Policy"/i);
    assert.match(html, /default-src 'none'; form-action 'none'/);
    assert.match(html, /Sign in to your notes/);
    assert.doesNotMatch(html, /script-src[^;]*unsafe-inline|<script\b/i);
    assert.ok(Buffer.byteLength(html) < 5_000_000, 'sign-off takes mocks of 5 MB or less');
  }
  // Refine: the chosen option is the starting file, the follow-up prompt the change, the result a new option.
  const option = join(dir, 'sign-in-1.html'), original = readFileSync(option, 'utf8'), warm = [];
  const warmServer = await standIn(warm, null, true, 'index.html', PAGE.replace('Sign in to your notes', 'Welcome back, warm and cosy'));
  t.after(() => warmServer.close());
  const warmRun = (...args) => promisify(execFile)(process.execPath, [CLI, ...(args[0] === 'make' && !args.includes('--count') ? [...args, '--options', '1'] : args)], { env: { ...env, FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${warmServer.address().port}` } });
  const refined = JSON.parse((await warmRun('refine', option, 'warmer palette, add an empty state', '--out', join(dir, 'warm.html'))).stdout).refined;
  assert.equal(refined.from, option);
  assert.match(JSON.stringify(warm[0].body), /Revise this index\.html: warmer palette, add an empty state.*Current index\.html:.*Sign in to your notes/);
  assert.match(readFileSync(join(dir, 'warm.html'), 'utf8'), /Welcome back, warm and cosy/);
  assert.match(readFileSync(join(dir, 'warm.html'), 'utf8'), /default-src 'none'/);
  assert.equal(readFileSync(option, 'utf8'), original, 'the refined option is untouched');
  await assert.rejects(run('refine', option, 'no change', '--out', option), (e) => /USAGE/.test(e.stdout));
  await assert.rejects(run('refine', option, 'no change', '--out', join(dir, 'same.html')), (e) => /left the option unchanged/.test(e.stdout));
  await assert.rejects(run('make', 'script fixture', '--out', join(dir, 'script.html')), (e) => /only script-free HTML/.test(e.stdout));
  await run('init', '--agent', 'byokit:opencode-go', '--model', 'not-a-real-model');
  assert.doesNotMatch(await run('doctor').then((r) => r.stdout, (e) => e.stdout), /lists no model/); // the model id passes straight through to the provider

  // Installed-CLI journey, through the published BYOKit adapters, with a private native fixture.
  writeFileSync(join(dir, 'codex'), `#!${process.execPath}
import { appendFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
const args = process.argv.slice(2);
if (args[0] === 'app-server') {
  appendFileSync(process.env.FIRST_DRAFT_HOME + '/native-probes', 'probe\\n');
  createInterface({ input: process.stdin }).on('line', (line) => { const m = JSON.parse(line); console.log(JSON.stringify({ id: m.id, result: m.id === 1 ? {} : { account: { type: 'chatgpt', email: 'umer@example.test', planType: 'plus' } } })); });
} else if (args[0] === 'login') { console.log('Logged in using ChatGPT'); }
else {
  appendFileSync(process.env.FIRST_DRAFT_HOME + '/native-calls', args[args.indexOf('--model') + 1] + '\\n');
  let input = ''; for await (const c of process.stdin) input += c;
  if (input.includes('failure fixture')) process.exit(1);
  const { messages } = JSON.parse(input), results = messages.filter((m) => m.role === 'toolResult');
  const calls = results.length === 0 ? [${JSON.stringify({ name: PLAN.name, arguments: PLAN.arguments })}] : results.length === 1 ? [${JSON.stringify(START.map(({ name, arguments: a }) => ({ name, arguments: a })))}, { name: 'str_replace_based_edit_tool', arguments: JSON.stringify({ command: 'create', path: 'index.html', file_text: ${JSON.stringify(PAGE)} }) }].flat() : results.length === 3 ? [{ name: 'done', arguments: JSON.stringify({ path: 'index.html' }) }] : [];
  console.log(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: JSON.stringify({ text: calls.length ? '' : 'Ready', calls }) } }));
  console.log(JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 7, output_tokens: 8 } }));
}
`, { mode: 0o700 });
  env.PATH = `${dir}:${process.env.PATH}`;
  await run('init', '--agent', 'byokit:codex', '--model', 'openai-codex/gpt-6-luna');
  assert.equal(JSON.parse((await run('doctor')).stdout).ready, true);
  assert.equal(seen.length, 24, 'CLI doctor does not use the plan-key provider'); // 18, and the script fixture's three follow-ups (done, then a reply, each)
  const probes = () => readFileSync(join(dir, 'native-probes'), 'utf8').trim().split('\n').length;
  const before = probes();
  await run('make', 'a sign-in page for Umer', '--out', join(dir, 'native.html'));
  assert.match(readFileSync(join(dir, 'native.html'), 'utf8'), /Content-Security-Policy/);
  assert.equal(probes() - before, 1, 'one CLI status probe per engine run, not per turn');
  assert.deepEqual(readFileSync(join(dir, 'native-calls'), 'utf8').trim().split('\n'), Array(4).fill('gpt-6-luna'));
  await assert.rejects(run('make', 'failure fixture', '--out', join(dir, 'fail.html')), (e) => /model could not answer/.test(e.stdout));
  assert.equal(readFileSync(join(dir, 'native-calls'), 'utf8').trim().split('\n').length, 5, 'failed boundary call is not retried');
});

test('the engine prompt carries the export contract and the brand rule', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const seen = [], server = await standIn(seen, null);
  t.after(() => server.close());
  const env = { ...process.env, HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir, OPENCODE_API_KEY: 'test-key', FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}` };
  const run = (...args) => promisify(execFile)(process.execPath, [CLI, ...(args[0] === 'make' && !args.includes('--count') ? [...args, '--options', '1'] : args)], { env });
  await run('init', '--agent', 'byokit:opencode-go', '--model', 'muse-spark-1.3-contributor');
  await run('make', 'a notes page', '--out', join(dir, 'tools.html'));
  const sent = JSON.stringify(seen[0].body);
  assert.match(sent, /Host export contract/);
  assert.match(sent, /data-oc-screen/); // the screen-link contract: hash links between screens, no script
  assert.match(sent, /in-page hash links/);
  assert.match(sent, /refused if any tag is a <script> element.*on\* event-handler attribute.*javascript: URL/); // with no browser to draw JSX, the guard's exact refusals are stated
  assert.match(sent, /frontend-design-anti-slop/); // the engine's index of its method skills, design starters and scaffolds rides along
  assert.match(sent, /interaction-motion: Press, hover, focus and entrance motion/); // first-draft's own motion and press-state skill sits in that index
  assert.match(sent, /iphone-16-pro-frame|saas-sidebar/);
  assert.doesNotMatch(sent, /Design bar|system font stack|at most two weights|one accent|Only two tools exist|no remote URL of any kind/); // no house style and no cut-down tool list on top of the engine
  for (const tool of ['set_title', 'set_todos', 'skill', 'scaffold', 'str_replace_based_edit_tool', 'done', 'tweaks']) assert.ok(seen[0].body.tools.some((t) => t.name === tool), `the engine's ${tool} tool is there`);
  assert.match(JSON.stringify(seen[0].body.input), /skills\/heroes\.jsx|frames\//, 'the design starters are in the workspace'); 
  assert.match(sent, /Brand values are data, not memory/);
});

test('a named style is the whole direction of an option; several options take different styles; the styles are listed', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const seen = [], server = await standIn(seen, null);
  t.after(() => server.close());
  const env = { ...process.env, HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir, OPENCODE_API_KEY: 'test-key', FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}` };
  const run = (...args) => promisify(execFile)(process.execPath, [CLI, ...(args[0] === 'make' && !args.includes('--count') ? [...args, '--options', '1'] : args)], { env });
  await run('init', '--agent', 'byokit:opencode-go', '--model', 'muse-spark-1.3-contributor');
  assert.ok(JSON.parse((await run('styles')).stdout).styles.some((s) => s.id === 'editorial'));
  await run('make', 'a notes page', '--out', join(dir, 'a.html'), '--direction', 'editorial');
  assert.match(JSON.stringify(seen[0].body), /Design direction: Editorial \/ Magazine Layout.*Commit to this one style/);
  seen.length = 0;
  await run('make', 'a notes page', '--out', join(dir, 'b.html'), '--direction', 'warm and playful');
  assert.match(JSON.stringify(seen[0].body), /Design direction: warm and playful/);
  seen.length = 0;
  await run('make', 'a notes page', '--out', join(dir, 'c.html'), '--count', '2');
  const sent = seen.filter((c) => /Design direction/.test(JSON.stringify(c.body.input))).map((c) => JSON.stringify(c.body.input).match(/Design direction: ([^.]+)\./)[1]);
  assert.equal(new Set(sent).size, 2, 'each option takes a different style');
});

test('a prompt that asks for a landing page carries the landing-page brief, another prompt does not', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const seen = [], server = await standIn(seen, null);
  t.after(() => server.close());
  const env = { ...process.env, HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir, OPENCODE_API_KEY: 'test-key', FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}` };
  const run = (...args) => promisify(execFile)(process.execPath, [CLI, ...(args[0] === 'make' && !args.includes('--count') ? [...args, '--options', '1'] : args)], { env, cwd: dir }); // a folder with no screenshot
  await run('init', '--agent', 'byokit:opencode-go', '--model', 'muse-spark-1.3-contributor');
  await run('make', 'Make a landing page for my tool done-done. Its README is below.', '--out', join(dir, 'landing.html'));
  const sent = JSON.stringify(seen[0].body);
  assert.match(sent, /Landing page brief/);
  assert.match(sent, /a hero .*about three benefit blocks.*how it works in three steps.*one proof block.*install .*closing call to action/); // the shape of the page
  assert.match(sent, /about 6,000 px tall at 390/); // the length of the page
  assert.match(sent, /Do not mirror the source's headings/); // the source is summarised, not copied
  assert.match(sent, /doc paths, file names, maintainer commands, flags, config keys, release notes/);
  assert.match(sent, /One screen, not a multi-screen flow/);
  assert.match(sent, /every heading is followed by 16px or more before its text, and sections are 64px or more apart/); // a heading never sits on its text
  assert.match(sent, /:root holds the light palette.*prefers-color-scheme: dark.*Never write one dark palette for both/); // a real light theme
  assert.match(sent, /no screenshot or recording, so make the hero visual typeset.*Do not reference or invent any image file/); // this folder has none
  await run('make', 'a notes dashboard', '--out', join(dir, 'notes.html'));
  assert.doesNotMatch(JSON.stringify(seen[3].body), /Landing page brief/, 'a prompt with no landing page gets no landing brief');
});

test('a landing page is told about the project\'s screenshot and gets it embedded as the hero visual, only when the brief is about that project', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, 'docs', 'media'), { recursive: true });
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  writeFileSync(join(dir, 'docs', 'media', 'canvas.png'), png);
  writeFileSync(join(dir, 'docs', 'logo.png'), png); // a logo is a mark of the project, not a view of it
  writeFileSync(join(dir, 'README.md'), '# first-draft\n\nTurns a prompt into design mocks.\n'); // the project in this folder
  const page = '<!doctype html><html><head><title>T</title></head><body><h1>First draft</h1><img alt="The canvas" src="docs/media/canvas.png"><img alt="Nope" src="docs/missing.png"></body></html>';
  const seen = [], server = await standIn(seen, null, true, 'index.html', page);
  t.after(() => server.close());
  const env = { ...process.env, HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir, OPENCODE_API_KEY: 'test-key', FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}` };
  const run = (...args) => promisify(execFile)(process.execPath, [CLI, ...(args[0] === 'make' && !args.includes('--count') ? [...args, '--options', '1'] : args)], { env, cwd: dir });
  await run('init', '--agent', 'byokit:opencode-go', '--model', 'muse-spark-1.3-contributor');
  const out = join(dir, 'landing.html');
  await run('make', 'Make a landing page for my tool first-draft.', '--out', out);
  const sent = JSON.stringify(seen[0].body);
  assert.match(sent, /Hero visual: this project has real product screenshots.*docs\/media\/canvas\.png\./);
  assert.doesNotMatch(sent, /logo\.png/);
  const html = readFileSync(out, 'utf8');
  assert.match(html, new RegExp(`src="data:image/png;base64,${png.toString('base64').replace(/[+/=]/g, '\\$&')}"`)); // the listed path is the file itself
  assert.match(html, /src="docs\/missing\.png"/); // a path the host never listed is left alone
  // The folder you run in is not the product the prompt describes: a landing page for another product never gets this project's screenshots, whatever this folder holds.
  const other = join(dir, 'fieldnotes.html'), before = seen.length;
  await run('make', 'A landing page for Fieldnotes, an offline-first note-taking app for field biologists.', '--out', other);
  const sentOther = JSON.stringify(seen[before].body);
  assert.doesNotMatch(sentOther, /docs\/media\/canvas\.png/);
  assert.match(sentOther, /no screenshot or recording, so make the hero visual typeset/);
  assert.doesNotMatch(readFileSync(other, 'utf8'), /data:image\/png/); // nothing of this project's is embedded in it
});

test('script-free prose is exported, not mistaken for script', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const prose = '<!doctype html><html><head><title>JavaScript: The Good Parts</title><style nonce="n0nce">p{color:red}</style></head><body><h1 title="JavaScript: The Good Parts">JavaScript: The Good Parts</h1><p>Shop online = save 20%</p></body></html>';
  const seen = [], server = await standIn(seen, null, true, 'index.html', prose);
  t.after(() => server.close());
  const env = { ...process.env, HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir, OPENCODE_API_KEY: 'test-key', FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}` };
  const run = (...args) => promisify(execFile)(process.execPath, [CLI, ...(args[0] === 'make' && !args.includes('--count') ? [...args, '--options', '1'] : args)], { env });
  await run('init', '--agent', 'byokit:opencode-go', '--model', 'muse-spark-1.3-contributor');
  const out = join(dir, 'prose.html');
  await run('make', 'a JavaScript guide page', '--out', out);
  const html = readFileSync(out, 'utf8');
  assert.match(html, /Shop online = save 20%/);
  assert.match(html, /Content-Security-Policy/);
});

test('a view call that carries file_text is made as a create, one with old_str as a str_replace', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const seen = [], server = await standIn(seen, { command: 'view', old_str: 'Sign in', new_str: 'revised' }, false);
  t.after(() => server.close());
  const env = { ...process.env, HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir, OPENCODE_API_KEY: 'test-key', FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}` };
  const run = (...args) => promisify(execFile)(process.execPath, [CLI, ...(args[0] === 'make' && !args.includes('--count') ? [...args, '--options', '1'] : args)], { env });
  await run('init', '--agent', 'byokit:opencode-go', '--model', 'muse-spark-1.3-contributor');
  const out = join(dir, 'view.html');
  await run('make', 'view fixture page', '--out', out);
  assert.match(readFileSync(out, 'utf8'), /revised to your notes/);
});

test('init with only the minimax key route saves its shipped default model', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const env = { ...process.env, HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir };
  const { stdout } = await promisify(execFile)(process.execPath, [CLI, 'init', '--agent', 'byokit:minimax:key'], { env });
  assert.equal(JSON.parse(stdout).saved.model, 'MiniMax-M3.1-Flash-Preview');
});

test('a model that keeps patching past the turn cap still gives the page it wrote', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const seen = [], server = await guesser(seen, true);
  t.after(() => server.close());
  const env = { ...process.env, HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir, OPENCODE_API_KEY: 'test-key', FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}` };
  const run = (...args) => promisify(execFile)(process.execPath, [CLI, ...(args[0] === 'make' && !args.includes('--count') ? [...args, '--options', '1'] : args)], { env });
  await run('init', '--agent', 'byokit:opencode-go', '--model', 'muse-spark-1.3-contributor');
  const out = join(dir, 'capped.html');
  const { stdout } = await run('make', 'a notes page', '--out', out);
  assert.equal(seen.length, 59, 'the engine is stopped at its 60th model turn, the plan turn being the first');
  assert.match(readFileSync(out, 'utf8'), /to your notes!{58}</, 'the patches made before the cap are kept');
  const made = JSON.parse(stdout);
  assert.deepEqual(made.truncated, [out]);
  assert.equal(made.made.files[0].turns, 60);
  assert.match(made.help[0], /ran out of the engine's turns/);
});

test('a call that times out, one whose connection closes and one whose stream is cut are asked again, then the page is made', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const seen = [], server = await standIn(seen, null);
  t.after(() => server.close());
  const [serve] = server.listeners('request');
  server.removeAllListeners('request');
  let calls = 0;
  server.on('request', (req, res) => {
    if (calls++ === 0) return;
    if (calls === 3) return req.socket.destroy();
    if (calls === 5) { res.writeHead(200, { 'content-type': 'text/event-stream' }); res.write('event: response.created\n'); return setTimeout(() => req.socket.destroy(), 50); }
    serve(req, res);
  }); // turn 1's first call never answers; turn 2's first call drops; turn 3's first call is cut mid-stream after HTTP 200
  const env = { ...process.env, HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir, OPENCODE_API_KEY: 'test-key', FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}` };
  const run = (...args) => promisify(execFile)(process.execPath, [CLI, ...(args[0] === 'make' && !args.includes('--count') ? [...args, '--options', '1'] : args)], { env });
  await run('init', '--agent', 'byokit:opencode-go', '--model', 'muse-spark-1.3-contributor');
  writeFileSync(join(dir, 'config.json'), JSON.stringify({ ...JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8')), agent_timeout: '1s' }));
  const out = join(dir, 'retried.html');
  await run('make', 'a notes page', '--out', out);
  assert.match(readFileSync(out, 'utf8'), /Sign in to your notes/);
  assert.equal(calls, 7); // 3 failed + 4 turns (the plan, the page, done, the summary)
});

test('the view sends the Next brief to the person\'s agent and the refined option joins the design', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const seen = [], server = await standIn(seen, null, true, 'index.html', PAGE.replace('Sign in to your notes', 'Welcome back, warm and cosy'));
  t.after(() => server.close());
  const env = { ...process.env, HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir, OPENCODE_API_KEY: 'test-key', FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}` };
  const option = join(dir, 'a-1.html');
  writeFileSync(option, '<!doctype html><html><head><title>Notes</title></head><body><h1>Sign in to your notes</h1></body></html>');
  const view = spawn(process.execPath, [CLI, 'view', option, '--host', '127.0.0.1', '--port', '0'], { env });
  t.after(() => view.kill());
  const url = JSON.parse(await new Promise((ok) => view.stdout.once('data', ok))).viewing.url;
  const send = (body, headers = {}) => fetch(`${url}refine`, { method: 'POST', headers: { 'content-type': 'application/json', origin: new URL(url).origin, ...headers }, body: JSON.stringify(body) });
  const options = async () => JSON.parse((await (await fetch(url)).text()).match(/id="design">(.*?)<\/script>/)[1]).options.map((o) => o.file);

  const none = await send({ option: 1, change: 'warmer palette' });
  assert.equal(none.status, 500);
  const { error, help } = await none.json();
  assert.equal(error, 'No model source is set.');
  assert.match(help[0], /^Choose which BYOKit route and model.*first-draft-axi init --agent byokit:/); // the set-up hint, and no model is called
  assert.equal(seen.length, 0);

  await promisify(execFile)(process.execPath, [CLI, 'init', '--agent', 'byokit:opencode-go', '--model', 'muse-spark-1.3-contributor'], { env });
  assert.equal((await send({ option: 1, change: 'warmer palette' }, { origin: 'http://evil.example' })).status, 403);
  assert.equal((await send({ option: 9, change: 'warmer palette' })).status, 400);
  assert.equal((await send({ option: 1, change: '  ' })).status, 400);
  assert.equal(seen.length, 0, 'a refused request makes no model call');

  const sent = await send({ option: 1, change: 'warmer palette, add an empty state' });
  assert.equal(sent.status, 200);
  assert.deepEqual(await sent.json(), { option: { n: 2, label: 'a-1-refined', file: 'a-1-refined.html' } });
  assert.match(JSON.stringify(seen[0].body), /Revise this index\.html: warmer palette, add an empty state/);
  assert.match(readFileSync(join(dir, 'a-1-refined.html'), 'utf8'), /Welcome back, warm and cosy/);
  assert.match(readFileSync(option, 'utf8'), /Sign in to your notes/, 'the option it came from is untouched');
  assert.deepEqual(await options(), ['a-1.html', 'a-1-refined.html']);

  assert.equal((await send({ option: 1, change: 'again' })).status, 200); // a second send never overwrites the first
  assert.deepEqual(await options(), ['a-1.html', 'a-1-refined.html', 'a-1-refined-2.html']);
});

test('asset CLI previews without spending, then embeds one optimized image per provider', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-assets-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const webp = 'UklGRjgAAABXRUJQVlA4ICwAAADQAQCdASoCAAIAAgA0JaACdLoB+AADsAD+8Oj3/yC5YXXI1/5sCua5+agAAA==';
  const bin = join(dir, 'bin'); mkdirSync(bin);
  const log = join(dir, 'calls');
  const script = `#!${process.execPath}\nimport {appendFileSync,mkdirSync,writeFileSync} from 'node:fs'; import {join,basename} from 'node:path';
    const args=process.argv.slice(2), name=basename(process.argv[1]);
    appendFileSync(${JSON.stringify(log)},JSON.stringify([name,...args])+'\\n');
    if(name==='magick'){if(args[0]!=='-version')writeFileSync(args.at(-1),Buffer.from('${webp}','base64'));}
    else if(name==='codex'){if(args[0]==='app-server'){const {createInterface}=await import('node:readline');createInterface({input:process.stdin}).on('line',line=>{const q=JSON.parse(line);if(q.id)console.log(JSON.stringify({id:q.id,result:q.method==='account/read'?{account:{type:'chatgpt',email:'umer@example.invalid',planType:'plus'}}:{}}));});}else if(args[0]==='login')console.error('Logged in using ChatGPT');else if(args[0]==='exec'){await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(Error('stdin did not reach EOF')),200);process.stdin.resume();process.stdin.on('end',()=>{clearTimeout(timer);ok();});});const thread='01a16724-50d5-76f1-af27-1ad159aec924',folder=join(process.env.HOME,'.codex/generated_images',thread);mkdirSync(folder,{recursive:true});writeFileSync(join(folder,'exec-c1b7f477-aeb6-4f2a-8bcc-7e81473b0401.png'),Buffer.from('${webp}','base64'));console.log(JSON.stringify({type:'thread.started',thread_id:thread}));}else console.log('codex-cli 0.159.2');}
    else if(args[0]==='account')console.log('{"credits":10}');
    else if(args[1]==='cost')console.log('{"credits":0.15}');
    else console.log('[{"status":"completed","job_type":"z_image","result_url":"https://fixture.invalid/asset.png"}]');`;
  for (const name of ['codex', 'higgsfield', 'magick']) writeFileSync(join(bin, name), script, { mode: 0o755 });
  const hook = join(dir, 'fetch.mjs');
  writeFileSync(hook, `const fetchReal=globalThis.fetch;globalThis.fetch=(url,options)=>url==='https://fixture.invalid/asset.png'?Promise.resolve(new Response(Buffer.from('${webp}','base64'))):fetchReal(url,options);`);
  let provider;
  const seen = [], server = await standIn(seen, null, true, 'index.html', () => {
    const folder = readdirSync(dir).find((p) => p.startsWith(provider + '.assets-'));
    return `<!doctype html><html><body><h1>Umer's botanical shop</h1><img alt="Leaf illustration" src="${join(dir, folder, 'image.webp')}"></body></html>`;
  });
  t.after(() => server.close());
  const env = { ...process.env, PATH: bin, CI: '', HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir, OPENCODE_API_KEY: 'test-key', FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}` };
  const run = (...args) => promisify(execFile)(process.execPath, ['--import', hook, CLI, ...args, ...(args[0] === 'make' ? ['--options', '1'] : [])], { env });
  await run('init', '--agent', 'byokit:opencode-go', '--model', 'muse-spark-1.3-contributor');
  for (provider of ['codex', 'higgsfield']) {
    const out = join(dir, provider + '.html');
    const args = ['make', 'Botanical shop with a leaf illustration', '--out', out, '--assets', provider];
    const preview = JSON.parse((await run(...args)).stdout).asset_preview;
    assert.equal(preview.images, 1); assert.equal(preview.approved, false);
    assert.equal(preview.amount, provider === 'codex' ? null : 0.15);
    assert.equal(existsSync(out), false); assert.equal(seen.length, provider === 'codex' ? 0 : 3);
    assert.doesNotMatch(readFileSync(log, 'utf8'), provider === 'codex' ? /"exec"/ : /"create"/);
    await run(...args, '--allow-asset-spend');
    const html = readFileSync(out, 'utf8');
    assert.match(html, /<img alt="Leaf illustration" src="data:image\/webp;base64,/);
    assert.doesNotMatch(html, /src="\//);
    assert.match(readFileSync(log, 'utf8'), /"-strip","-resize","1024x1024>","-quality","80"/);
    assert.equal(readdirSync(dir).filter((p) => p.startsWith(provider + '.assets-')).length, 1);
  }
  assert.ok(existsSync(join(dir, '.codex/generated_images/01a16724-50d5-76f1-af27-1ad159aec924/exec-c1b7f477-aeb6-4f2a-8bcc-7e81473b0401.png')), 'import never deletes the native CLI image');
  const calls = readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(calls.filter(([name, action]) => name === 'codex' && action === 'exec').length, 1);
  assert.equal(calls.filter(([name, action, verb]) => name === 'higgsfield' && action === 'generate' && verb === 'create').length, 1);
  await run('make', 'Shop without generation', '--out', join(dir, 'disabled.html'), '--no-assets');
  assert.equal(readFileSync(log, 'utf8').trim().split('\n').length, calls.length);
  await assert.rejects(run('make', 'Shop', '--out', join(dir, 'auto.html'), '--assets', 'auto'), (e) => /2 ready asset providers/.test(e.stdout));
  await assert.rejects(run('make', 'Shop', '--out', join(dir, 'bad.html'), '--no-assets', '--assets', 'codex'), (e) => /conflicts/.test(e.stdout));
  await assert.rejects(promisify(execFile)(process.execPath, [CLI, 'make', 'Shop', '--out', join(dir, 'ci.html'), '--assets', 'higgsfield', '--allow-asset-spend'], { env: { ...env, CI: 'true' } }), (e) => /disabled in CI/.test(e.stdout));
});
