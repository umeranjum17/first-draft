// The Studio refine journey drives the real CLI and view against a local provider stand-in. No paid call is made.
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

import { landingPage, plainPage, theme } from './fixtures/plain-page.mjs';

const CLI = new URL('../src/cli.mjs', import.meta.url).pathname;
// These generator journeys now also run the required native independent critic.
const PAGE = theme('<!doctype html><html><body><h1>Sign in to your notes</h1><img alt="Notes" src=https://example.com/image.png><img alt="Notes" srcset="//cdn.example.com/a.png 1x, https://cdn.example.com/b.png 2x"><form action="https://example.com/submit"><input placeholder="Email"></form></body></html>').replace('<body>', '<body>\n');

const ev = (o) => `event: ${o.type}\ndata: ${JSON.stringify(o)}\n\n`;
// The engine's own first steps on a fresh workspace: a plan (set_todos), then the DESIGN.md its done requires, here the engine's own starter one.
const DESIGN = readFileSync(new URL('../vendor/open-codesign/apps/desktop/resources/templates/scaffolds/design-systems/DESIGN.md', import.meta.url), 'utf8');
const PLAN = { type: 'function_call', id: 'fc-plan', call_id: 'c-plan', name: 'set_todos', arguments: JSON.stringify({ items: [{ text: 'Write the page', checked: false }] }) };
const START = [{ type: 'function_call', id: 'fc-design', call_id: 'c-design', name: 'str_replace_based_edit_tool', arguments: JSON.stringify({ command: 'create', path: 'DESIGN.md', file_text: DESIGN }) }];
const fresh = (body) => !body.includes('function_call_output'); // the conversation's first turn: the engine asks for a plan before any edit
const plan = (res) => { res.writeHead(200, { 'content-type': 'text/event-stream' }); res.end(ev({ type: 'response.output_item.added', output_index: 0, item: PLAN }) + ev({ type: 'response.output_item.done', output_index: 0, item: PLAN }) + ev({ type: 'response.completed', response: { id: 'r-plan', status: 'completed', usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 } } })); };

// Several options with no direction: make first asks for one planned direction per option.
const directions = (res, body) => {
  const count = Number(body.match(/Plan (\d) directions/)[1]);
  const item = { type: 'function_call', id: 'fc-dirs', call_id: 'c-dirs', name: 'plan_directions', arguments: JSON.stringify({ directions: Array.from({ length: count }, (_, i) => ({ name: `Direction ${i + 1}`, learn_from: 'Bear, Notion', layout: `Layout ${i + 1}.`, type: 'Inter 15/24.', palette: '#fafafa, #111.', signature: `Detail ${i + 1}.` })) }) };
  res.writeHead(200, { 'content-type': 'text/event-stream' });
  res.end(ev({ type: 'response.output_item.added', output_index: 0, item }) + ev({ type: 'response.output_item.done', output_index: 0, item }) + ev({ type: 'response.completed', response: { id: 'r-dirs', status: 'completed', usage: { input_tokens: 5, output_tokens: 6, total_tokens: 11 } } }));
};
// A local provider drives the actual upstream edit -> done -> final tool loop.
function standIn(seen, edit, doneFirst = true, donePath = 'index.html', page = PAGE, extra = null, pre = null) {
  const full = 'The design is ready.';
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      if (plainPage(res, body)) return;
      if (body.includes('"plan_directions"')) return directions(res, body);
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
        const html = theme(typeof page === 'function' ? page() : page === PAGE && body.includes('Landing page brief') ? landingPage() : page);
        const user = JSON.parse(body).input.find(m => m.role === 'user')?.content;
      const text = typeof user === 'string' ? user : user?.filter(p => p.type === 'input_text').map(p => p.text).join('\n');
      const content = body.includes('no change') ? text.split('Current index.html:\n')[1] : body.includes('script fixture') ? html.replace('</body>', '<script>alert(1)</script></body>') : html;
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

// The CLI names the version it runs: package.json's from an installed package, -dev from a source checkout until HEAD carries the
// release tag, and a pre-release as it is. A copy of the package (src and package.json; its dependencies linked) stands in for each.








// A local provider that keeps guessing old_str, so the editor must escalate to create.
function guesser(seen, patching = false, page = PAGE) {
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      if (plainPage(res, body)) return;
      if (body.includes('"plan_directions"')) return directions(res, body);
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



// The default make: one page from one call with the frontend-design guidance, the facts rule and the page contract (draft.mjs).

// The host measures what the critic should not have to find; the model gets one call to fix exactly that (draft.mjs, restraint.mjs, render-check.mjs).



// The package a user installs carries every one of first-draft's own method skills where the engine's skill tool reads them.









test('the view sends the Next brief to the person\'s agent and the refined option joins the design', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const seen = [], server = await standIn(seen, null, true, 'index.html', PAGE.replace('Sign in to your notes', 'Welcome back, warm and cosy'));
  t.after(() => server.close());
  const env = { ...process.env, HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir, OPENCODE_API_KEY: 'test-key', FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}` };
  const option = join(dir, 'a-1.html');
  writeFileSync(option, '<!doctype html><html><head><title>Notes</title></head><body><h1>Sign in to your notes</h1></body></html>');
  let view = spawn(process.execPath, [CLI, 'view', option, '--host', '127.0.0.1', '--port', '0'], { env: { ...env, OPENCODE_API_KEY: '', NODE_OPTIONS: '', PATH: '/usr/bin:/bin' } });
  t.after(() => view.kill());
  let url = JSON.parse(await new Promise((ok) => view.stdout.once('data', ok))).viewing.url;
  const send = (body, headers = {}) => fetch(`${url}refine`, { method: 'POST', headers: { 'content-type': 'application/json', origin: new URL(url).origin, ...headers }, body: JSON.stringify(body) });
  const options = async () => JSON.parse((await (await fetch(url)).text()).match(/id="design">(.*?)<\/script>/)[1]).options.map((o) => o.file);

  const none = await send({ option: 1, change: 'warmer palette' });
  assert.equal(none.status, 500);
  assert.match((await none.json()).error, /No usable AI engine.*claude auth login/);
  assert.equal(seen.length, 0);
  await new Promise(ok => { view.once('exit', ok); view.kill(); });
  view = spawn(process.execPath, [CLI, 'view', option, '--host', '127.0.0.1', '--port', '0'], { env });
  url = JSON.parse(await new Promise(ok => view.stdout.once('data', ok))).viewing.url;

  await promisify(execFile)(process.execPath, [CLI, 'init', '--agent', 'byokit:opencode-go', '--model', 'muse-spark-1.3-contributor'], { env });
  assert.equal((await send({ option: 1, change: 'warmer palette' }, { origin: 'http://evil.example' })).status, 403);
  assert.equal((await send({ option: 9, change: 'warmer palette' })).status, 400);
  assert.equal((await send({ option: 1, change: '  ' })).status, 400);
  assert.equal(seen.length, 0, 'a refused request makes no model call');

  const sent = await send({ option: 1, change: 'warmer palette, add an empty state' });
  assert.equal(sent.status, 200);
  assert.deepEqual(await sent.json(), { option: { n: 2, label: 'a-1-refined', file: 'a-1-refined.html' }, engine: { agent: 'byokit:opencode-go', model: 'muse-spark-1.3-contributor' } });
  assert.match(JSON.stringify(seen[0].body), /Revise this index\.html: warmer palette, add an empty state/);
  assert.match(readFileSync(join(dir, 'a-1-refined.html'), 'utf8'), /Welcome back, warm and cosy/);
  assert.match(readFileSync(option, 'utf8'), /Sign in to your notes/, 'the option it came from is untouched');
  assert.deepEqual(await options(), ['a-1.html', 'a-1-refined.html']);

  assert.equal((await send({ option: 1, change: 'again' })).status, 200); // a second send never overwrites the first
  assert.deepEqual(await options(), ['a-1.html', 'a-1-refined.html', 'a-1-refined-2.html']);
});
