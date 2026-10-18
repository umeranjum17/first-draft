// The whole make journey on the built CLI: config, BYOKit's opencode-go plan key route
// against a local stand-in for the provider, and the mock files. No paid call is made.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

const CLI = new URL('../src/cli.mjs', import.meta.url).pathname;
const PAGE = '<!doctype html><html><body><h1>Sign in to your notes</h1><img src=https://example.com/image.png><img srcset="//cdn.example.com/a.png 1x, https://cdn.example.com/b.png 2x"><form action="https://example.com/submit"><input placeholder="Email"></form></body></html>';

// An OpenAI Responses stand-in answering every request with PAGE in an html block, streamed.
function standIn(seen) {
  const full = `Here it is.\n\`\`\`html\n${PAGE}\n\`\`\``;
  const ev = (o) => `event: ${o.type}\ndata: ${JSON.stringify(o)}\n\n`;
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      seen.push({ url: req.url, auth: req.headers.authorization, session: req.headers['x-opencode-session'], body: JSON.parse(body) });
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.end(ev({ type: 'response.created', response: { id: 'r1' } })
        + ev({ type: 'response.output_item.added', output_index: 0, item: { type: 'message', id: 'm1' } })
        + ev({ type: 'response.output_text.delta', output_index: 0, item_id: 'm1', content_index: 0, delta: full })
        + ev({ type: 'response.output_item.done', output_index: 0, item: { type: 'message', id: 'm1', status: 'completed', content: [{ type: 'output_text', text: full, annotations: [] }] } })
        + ev({ type: 'response.completed', response: { id: 'r1', status: 'completed', usage: { input_tokens: 11, output_tokens: 22, total_tokens: 33 } } }));
    });
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

test('make writes self-contained mocks through the BYOKit Go route', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const seen = [];
  const server = await standIn(seen);
  t.after(() => server.close());
  const env = { ...process.env, FIRST_DRAFT_HOME: dir, OPENCODE_API_KEY: 'test-key', FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}` };
  const run = (...args) => promisify(execFile)(process.execPath, [CLI, ...args], { env });

  await assert.rejects(run('make', 'a sign-in page', '--out', join(dir, 'x.html')), (e) => /NO_AGENT/.test(e.stdout));
  await run('init', '--agent', 'byokit:opencode-go', '--model', 'muse-spark-1.3-contributor');
  assert.match((await run('doctor')).stdout, /"ready":true/);

  const { stdout } = await run('make', 'a sign-in page for a notes app', '--out', join(dir, 'sign-in.html'), '--count', '2');
  assert.match(stdout, /"tokens_out":44/);
  const blocked = JSON.parse(stdout).blocked_remote;
  assert.ok(blocked.includes('https://example.com/submit'));
  assert.ok(blocked.includes('https://example.com/image.png'));
  assert.ok(blocked.includes('//cdn.example.com/a.png'));
  assert.ok(blocked.includes('https://cdn.example.com/b.png'));

  assert.equal(seen.length, 2);
  assert.equal(seen[0].auth, 'Bearer test-key');
  assert.ok(seen[0].session, 'every Go call names its conversation');
  assert.equal(seen[0].body.model, 'muse-spark-1.3-contributor');
  assert.notEqual(seen[0].body.input, seen[1].body.input, 'the two options vary');
  assert.match(JSON.stringify(seen[0].body), /no remote URL/); // the system's own rules ride along

  await run('make', 'a notes dashboard', '--out', join(dir, 'mocks/design'), '--count', '2');
  assert.ok(readFileSync(join(dir, 'mocks/design-1'), 'utf8').includes('default-src'));
  assert.ok(readFileSync(join(dir, 'mocks/design-2'), 'utf8').includes('default-src'));

  for (const n of [1, 2]) {
    const html = readFileSync(join(dir, `sign-in-${n}.html`), 'utf8');
    assert.match(html, /<head[^>]*>\s*<meta http-equiv="Content-Security-Policy"/i);
    assert.match(html, /default-src 'none'; form-action 'none'/);
    assert.match(html, /Sign in to your notes/);
    assert.doesNotMatch(html, /script-src[^;]*unsafe-inline/);
    assert.ok(Buffer.byteLength(html) < 5_000_000, 'sign-off takes mocks of 5 MB or less');
  }
});
