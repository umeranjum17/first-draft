// The whole make journey on the built CLI: config, BYOKit's opencode-go plan key route
// against a local stand-in for the provider, and the mock files. No paid call is made.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

const CLI = new URL('../src/cli.mjs', import.meta.url).pathname;
const PAGE = '<!doctype html><html><body><h1>Sign in to your notes</h1><img alt="Notes" src=https://example.com/image.png><img alt="Notes" srcset="//cdn.example.com/a.png 1x, https://cdn.example.com/b.png 2x"><form action="https://example.com/submit"><input placeholder="Email"></form></body></html>';

const ev = (o) => `event: ${o.type}\ndata: ${JSON.stringify(o)}\n\n`;

// A local provider drives the actual upstream edit -> done -> final tool loop.
function standIn(seen, edit, doneFirst = true, donePath = 'index.html', page = PAGE, extra = null, pre = null) {
  const full = 'The design is ready.';
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      seen.push({ url: req.url, auth: req.headers.authorization, session: req.headers['x-opencode-session'], body: JSON.parse(body) });
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const step = (seen.length - 1) % 3;
      if (step < 2) {
        const content = body.includes('script fixture') ? page.replace('</body>', '<script>alert(1)</script></body>') : page;
        const item = { type: 'function_call', id: `fc${seen.length}`, call_id: `c${seen.length}`, name: step === 0 ? 'str_replace_based_edit_tool' : 'done',
          arguments: JSON.stringify(step === 0 ? { command: body.includes('view fixture') ? 'view' : 'create', path: 'index.html', file_text: content } : { path: donePath }) };
        const mutation = { type: 'function_call', id: 'fc-edit', call_id: 'c-edit', name: 'str_replace_based_edit_tool', arguments: JSON.stringify({ path: 'index.html', ...edit }) };
        const items = step !== 1 ? [item] : edit ? (doneFirst ? [item, mutation] : [mutation, item]) : [...(pre ?? []), item, ...(extra ?? [])];
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
    const run = (...args) => promisify(execFile)(process.execPath, [CLI, ...args], { env });
    const out = join(dir, 'mock.html');
    await run('init', '--agent', 'byokit:opencode-go', '--model', 'muse-spark-1.3-contributor');
    if (doneFirst) {
      await assert.rejects(run('make', 'a notes page', '--out', out), (e) => /engine did not verify index.html with done/.test(e.stdout));
      assert.equal(existsSync(out), false);
    } else {
      await run('make', 'a notes page', '--out', out);
      assert.match(readFileSync(out, 'utf8'), /revised/);
    }
    assert.equal(seen.length, 3);
  });
});

test('make accepts a headless HTML5 document and injects the policy', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const seen = [], server = await standIn(seen, null, true, 'index.html', '<!doctype html><title>Notes</title><body><h1>Sign in to your notes</h1></body>');
  t.after(() => server.close());
  const env = { ...process.env, HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir, OPENCODE_API_KEY: 'test-key', FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}` };
  const run = (...args) => promisify(execFile)(process.execPath, [CLI, ...args], { env });
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
  const run = (...args) => promisify(execFile)(process.execPath, [CLI, ...args], { env });
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
  const run = (...args) => promisify(execFile)(process.execPath, [CLI, ...args], { env });
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
  const run = (...args) => promisify(execFile)(process.execPath, [CLI, ...args], { env });
  await run('init', '--agent', 'byokit:opencode-go', '--model', 'muse-spark-1.3-contributor');
  const out = join(dir, 'kept-edit.html');
  await run('make', 'a notes page', '--out', out);
  assert.match(readFileSync(out, 'utf8'), /Sign in to your notes/);
  assert.equal(seen.length, 3);
});

test('a stray DESIGN.md does not block verifying a valid index.html', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const design = { type: 'function_call', id: 'fc-md', call_id: 'c-md', name: 'str_replace_based_edit_tool', arguments: JSON.stringify({ command: 'create', path: 'DESIGN.md', file_text: '# Design\n' }) };
  const seen = [], server = await standIn(seen, null, true, 'index.html', PAGE, null, [design]);
  t.after(() => server.close());
  const env = { ...process.env, HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir, OPENCODE_API_KEY: 'test-key', FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}` };
  const run = (...args) => promisify(execFile)(process.execPath, [CLI, ...args], { env });
  await run('init', '--agent', 'byokit:opencode-go', '--model', 'muse-spark-1.3-contributor');
  const out = join(dir, 'stray-design.html');
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
  const run = (...args) => promisify(execFile)(process.execPath, [CLI, ...args], { env });
  await run('init', '--agent', 'byokit:opencode-go', '--model', 'muse-spark-1.3-contributor');
  const out = join(dir, 'loose.html');
  await run('make', 'a notes page', '--out', out);
  assert.match(readFileSync(out, 'utf8'), /Sign in to your notes/);
});

// A local provider that keeps guessing old_str, so the editor must escalate to create.
function guesser(seen) {
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      seen.push(JSON.parse(body));
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const n = seen.length - 1;
      if (n < 4) {
        const item = { type: 'function_call', id: `fc${n}`, call_id: `c${n}`, name: 'str_replace_based_edit_tool',
          arguments: JSON.stringify(n === 0 ? { command: 'create', path: 'index.html', file_text: PAGE } : { command: 'str_replace', path: 'index.html', old_str: `guess ${n}`, new_str: 'x' }) };
        res.end(ev({ type: 'response.output_item.added', output_index: 0, item }) + ev({ type: 'response.output_item.done', output_index: 0, item })
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
  const run = (...args) => promisify(execFile)(process.execPath, [CLI, ...args], { env });
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
  const run = (...args) => promisify(execFile)(process.execPath, [CLI, ...args], { env });
  await run('init', '--agent', 'byokit:openai:key', '--model', 'gpt-5-mini');
  assert.equal(JSON.parse((await run('doctor')).stdout).ready, true);
  assert.equal(seen.length, 0, 'doctor makes no paid call');
  await run('make', 'a sign-in page', '--out', join(dir, 'k.html'), '--count', '1');
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
  const run = (...args) => promisify(execFile)(process.execPath, [CLI, ...args], { env });

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
  assert.match(JSON.stringify(seen[2].body.input), /no syntactic issues/);
  assert.match(JSON.stringify(seen[0].body), /no remote URL/); // the system's own rules ride along

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
  const warmRun = (...args) => promisify(execFile)(process.execPath, [CLI, ...args], { env: { ...env, FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${warmServer.address().port}` } });
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
  const call = results.length === 0 ? { name: 'str_replace_based_edit_tool', arguments: JSON.stringify({ command: 'create', path: 'index.html', file_text: ${JSON.stringify(PAGE)} }) } : results.length === 1 ? { name: 'done', arguments: JSON.stringify({ path: 'index.html' }) } : null;
  console.log(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: JSON.stringify({ text: call ? '' : 'Ready', calls: call ? [call] : [] }) } }));
  console.log(JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 7, output_tokens: 8 } }));
}
`, { mode: 0o700 });
  env.PATH = `${dir}:${process.env.PATH}`;
  await run('init', '--agent', 'byokit:codex', '--model', 'openai-codex/gpt-6-luna');
  assert.equal(JSON.parse((await run('doctor')).stdout).ready, true);
  assert.equal(seen.length, 18, 'CLI doctor does not use the plan-key provider');
  const probes = () => readFileSync(join(dir, 'native-probes'), 'utf8').trim().split('\n').length;
  const before = probes();
  await run('make', 'a sign-in page for Umer', '--out', join(dir, 'native.html'));
  assert.match(readFileSync(join(dir, 'native.html'), 'utf8'), /Content-Security-Policy/);
  assert.equal(probes() - before, 1, 'one CLI status probe per engine run, not per turn');
  assert.deepEqual(readFileSync(join(dir, 'native-calls'), 'utf8').trim().split('\n'), Array(3).fill('gpt-6-luna'));
  await assert.rejects(run('make', 'failure fixture', '--out', join(dir, 'fail.html')), (e) => /model could not answer/.test(e.stdout));
  assert.equal(readFileSync(join(dir, 'native-calls'), 'utf8').trim().split('\n').length, 4, 'failed boundary call is not retried');
});

test('the engine prompt carries the export contract and the brand rule', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const seen = [], server = await standIn(seen, null);
  t.after(() => server.close());
  const env = { ...process.env, HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir, OPENCODE_API_KEY: 'test-key', FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}` };
  const run = (...args) => promisify(execFile)(process.execPath, [CLI, ...args], { env });
  await run('init', '--agent', 'byokit:opencode-go', '--model', 'muse-spark-1.3-contributor');
  await run('make', 'a notes page', '--out', join(dir, 'tools.html'));
  const sent = JSON.stringify(seen[0].body);
  assert.match(sent, /Host export contract/);
  assert.match(sent, /Only two tools exist/);
  assert.match(sent, /data-oc-screen/); // the screen-link contract: hash links between screens, no script
  assert.match(sent, /in-page hash links/);
  assert.match(sent, /Hard rule, first and above all: .*<script> element.*on\* event-handler attribute.*javascript: URL.*hash links.*Host export contract/); // the guard's exact refusals, stated up front
  assert.match(sent, /Design bar: Apple\/Linear-grade.*8px scale.*real, specific copy.*never lorem/);
  assert.deepEqual(seen[0].body.tools.map((t) => t.name), ['str_replace_based_edit_tool', 'done']);
  assert.match(sent, /Brand values are data, not memory/);
});

test('script-free prose is exported, not mistaken for script', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const prose = '<!doctype html><html><head><title>JavaScript: The Good Parts</title><style nonce="n0nce">p{color:red}</style></head><body><h1 title="JavaScript: The Good Parts">JavaScript: The Good Parts</h1><p>Shop online = save 20%</p></body></html>';
  const seen = [], server = await standIn(seen, null, true, 'index.html', prose);
  t.after(() => server.close());
  const env = { ...process.env, HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir, OPENCODE_API_KEY: 'test-key', FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}` };
  const run = (...args) => promisify(execFile)(process.execPath, [CLI, ...args], { env });
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
  const run = (...args) => promisify(execFile)(process.execPath, [CLI, ...args], { env });
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
