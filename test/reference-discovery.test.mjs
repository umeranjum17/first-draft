// Public CLI journey against a local provider stand-in; no brand-site or paid network calls.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

const CLI = new URL('../src/cli.mjs', import.meta.url).pathname;
const event = (o) => `event: ${o.type}\ndata: ${JSON.stringify(o)}\n\n`;

test('reference discovery: named-brand prompt, explicit override, no-reference and honest failures', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-discovery-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const seen = [];
  let candidate = { name: 'Vercel', url: 'https://vercel.com/' }, failure = false;
  const server = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    seen.push({ path: req.url, body: JSON.parse(body), auth: req.headers.authorization });
    if (failure) { res.writeHead(400); res.end('fixture rejected discovery'); return; }
    const call = { type: 'function_call', id: 'fc-ref', call_id: 'ref', name: 'identify_reference', arguments: JSON.stringify(candidate) };
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.end(event({ type: 'response.output_item.added', output_index: 0, item: call })
      + event({ type: 'response.output_item.done', output_index: 0, item: call })
      + event({ type: 'response.completed', response: { id: 'r-ref', status: 'completed', usage: { input_tokens: 7, output_tokens: 8, total_tokens: 15 } } }));
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  t.after(() => server.close());
  const env = { ...process.env, PATH: '', HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, XDG_STATE_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir,
    OPENAI_API_KEY: 'synthetic-fixture-key', FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}` };
  const run = (...args) => promisify(execFile)(process.execPath, [CLI, ...args], { env });
  const discover = async (...args) => JSON.parse((await run('references', ...args)).stdout).reference_discovery;
  assert.match((await run('--help')).stdout, /references.*--like/);
  await assert.rejects(run('references'), e => /USAGE/.test(e.stdout));
  await assert.rejects(run('references', '--like', ' '), e => /USAGE/.test(e.stdout));
  // A URL is an explicit, unverified candidate, not a fetch or a reason to ask for a model.
  const direct = await discover('--like', 'https://reference.invalid/design');
  assert.equal(direct.candidate.url, 'https://reference.invalid/design');
  assert.equal(direct.fetched, false);
  assert.equal(direct.tokens_in, 0);
  for (const url of ['http://reference.invalid', 'file:///etc/passwd', 'https://umer:secret@reference.invalid', 'https://']) {
    await assert.rejects(run('references', '--like', url), e => /REFERENCE_DISCOVERY_FAILED/.test(e.stdout));
  }
  assert.equal(seen.length, 0);
  await assert.rejects(run('references', 'make it like Vercel'), e => /NO_AGENT/.test(e.stdout));
  await run('init', '--agent', 'byokit:openai:key', '--model', 'gpt-5-mini');
  const result = await discover('make it like Vercel');
  assert.deepEqual(result.candidate, candidate);
  assert.equal(result.selection, 'prompt');
  assert.equal(result.fetched, false);
  assert.equal(result.model, 'gpt-5-mini');
  assert.match(result.notice, /No page fetched.*unverified/);
  assert.equal(result.tokens_in, 7);
  assert.equal(seen[0].auth, 'Bearer synthetic-fixture-key');
  assert.match(JSON.stringify(seen[0].body.input), /make it like Vercel/);
  assert.equal(seen[0].body.tools[0].name, 'identify_reference');
  candidate = { name: 'Linear', url: 'https://linear.app/' };
  assert.deepEqual((await discover('make it like Vercel', '--like', 'Linear')).candidate, candidate);
  assert.match(JSON.stringify(seen.at(-1).body.input), /Linear/);
  candidate = { name: null, url: null };
  assert.equal((await discover('a calm mobile notes app for Umer')).candidate, null);
  candidate = { name: 'Unfamiliar Brand', url: null };
  assert.deepEqual((await discover('--like', 'Unfamiliar Brand')).candidate, candidate);
  for (const invalid of [{ name: null, url: 'https://invented.invalid' }, { name: '', url: null }, { name: 'X' }, { name: 'X', url: 'javascript:alert(1)' }]) {
    candidate = invalid;
    await assert.rejects(run('references', 'make it like X'), e => /REFERENCE_DISCOVERY_FAILED/.test(e.stdout));
  }
  candidate = { name: null, url: null };
  await assert.rejects(run('references', '--like', 'X'), e => /valid reference candidate/.test(e.stdout));
  failure = true;
  await assert.rejects(run('references', 'make it like Vercel'), e => /REFERENCE_DISCOVERY_FAILED.*fixture rejected discovery/s.test(e.stdout));
  assert.ok(seen.every(r => r.path === '/responses'), 'only the local model provider is contacted');
});
