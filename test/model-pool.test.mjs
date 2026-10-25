// Pooled model calls through the real CLI, engine and BYOKit adapters: the optional account helper picks the account folder, a CLI
// limit rests that account and the next one answers, a dry Claude pool falls over to another installed route, and no credential value
// reaches output or a log. No model, key or network: every CLI is a local stand-in that records what it was handed.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

const CLI = new URL('../src/cli.mjs', import.meta.url).pathname;
const SECRET = 'synthetic-never-deliver';

const claude = `import { appendFileSync } from 'node:fs';
import { basename } from 'node:path';
const args = process.argv.slice(2), root = process.env.FIRST_DRAFT_HOME, quota = process.env.FD_QUOTA;
appendFileSync(root + '/claude.log', JSON.stringify({ account: process.env.CLAUDE_CONFIG_DIR ?? null, args }) + '\\n');
const answer = (structured_output) => console.log(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, structured_output, usage: { input_tokens: 5, output_tokens: 6 } }));
if (args.includes('auth')) {
  console.log(JSON.stringify({ loggedIn: true, authMethod: 'claude.ai', apiProvider: 'firstParty' }));
} else {
  for await (const line of process.stdin); // the prompt
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) throw Error('an API credential reached the child');
  const account = process.env.CLAUDE_CONFIG_DIR ? basename(process.env.CLAUDE_CONFIG_DIR) : 'the installed account';
  if (quota && process.env.CLAUDE_CONFIG_DIR === quota) { // this account is out of usage: the CLI says so and answers nothing
    console.log(JSON.stringify({ type: 'result', subtype: 'error_during_execution', is_error: true, result: 'Claude usage limit reached' }));
  } else if (args[args.indexOf('--json-schema') + 1].includes('"html"')) {
    answer({ html: '<!doctype html><html><body><h1>Notes from ' + account + '</h1></body></html>' });
  } else {
    answer({ text: '', calls: [{ name: 'done', arguments: '{"path":"index.html"}' }] });
  }
}`;

const codex = `import { appendFileSync } from 'node:fs';
const args = process.argv.slice(2), root = process.env.FIRST_DRAFT_HOME;
appendFileSync(root + '/codex.log', JSON.stringify(args) + '\\n');
if (args[0] === 'login') {
  console.log('Logged in using ChatGPT account umer@example.invalid');
  process.exit(0);
}
for await (const line of process.stdin); // the prompt
const model = args[args.indexOf('--model') + 1];
const text = JSON.stringify({ html: '<!doctype html><html><body><h1>Notes from ' + model + '</h1></body></html>' });
console.log(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text } }));
console.log(JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 4, output_tokens: 7 } }));`;

// The protocol the real helper speaks (v1 JSON in, one JSON answer out), with the fixture's answers.
const helper = `import { appendFileSync, readFileSync } from 'node:fs';
const verb = process.argv[2], request = JSON.parse(readFileSync(0, 'utf8')), root = process.env.FD_FIXTURE;
appendFileSync(root + '/pool.log', JSON.stringify({ verb, request }) + '\\n');
const account = (id, folder) => ({ ok: true, v: 1, id, selection_id: id, provider: 'claude', harness: 'claude', model: request.model, billing: 'plan',
  set: { CLAUDE_CONFIG_DIR: folder }, unset: [], floor: { eligibility: 15, launch_admission: 5 } });
const route = (id, provider, model) => ({ ok: true, v: 1, id, selection_id: id, provider, harness: provider, model, set: {}, unset: [], billing: 'plan' });
const dry = process.env.FD_POOL_LOW === '1'; // every Claude account is under its floor
if (verb === 'pick') console.log(JSON.stringify(dry ? route('route:cursor/auto', 'cursor', 'auto') : account('pa_umer_a', root + '/a')));
else if (verb === 'next') console.log(JSON.stringify(dry ? route('route:openai-codex/gpt-6.1-sol', 'codex', 'openai-codex/gpt-6.1-sol') : account('pa_umer_b', root + '/b')));
else { console.log(JSON.stringify({ ok: false, v: 1, reason: 'unknown verb' })); process.exit(1); }`;

test('pooled model calls: a limit re-picks the account, a dry pool falls over, no credential leaks', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-pool-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, 'bin')); mkdirSync(join(dir, 'a')); mkdirSync(join(dir, 'b')); mkdirSync(join(dir, 'pool'));
  const stand = (name, body) => writeFileSync(join(dir, 'bin', name), `#!${process.execPath}\n${body}\n`, { mode: 0o700 });
  stand('claude', claude); stand('codex', codex); stand('fm-model-pool', helper);
  writeFileSync(join(dir, 'account-pool'), `# the pool the person pointed first-draft at\nstate=${join(dir, 'pool')}\n`);
  const env = { ...process.env, PATH: `${join(dir, 'bin')}:${process.env.PATH}`, HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir,
    XDG_STATE_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir, FIRST_DRAFT_CHROME: '/nonexistent', FD_FIXTURE: dir, FD_QUOTA: join(dir, 'a'),
    FIRST_DRAFT_ACCOUNT_POOL: join(dir, 'account-pool'), FIRST_DRAFT_MODEL_POOL: 'fm-model-pool',
    ANTHROPIC_API_KEY: SECRET, ANTHROPIC_AUTH_TOKEN: SECRET };
  const run = (...args) => promisify(execFile)(process.execPath, [CLI, ...args], { env, maxBuffer: 100_000_000 });
  const text = (file) => readFileSync(join(dir, file), 'utf8');
  const log = (file) => text(file).trim().split('\n').map(JSON.parse);
  const seen = [];
  const note = (r) => { seen.push(r.stdout, r.stderr); return r; };

  note(await run('init', '--agent', 'byokit:claude', '--model', 'claude-opus-5-5'));

  // One page: the picked account is out of usage, so the helper rests it and the next account answers.
  const page = join(dir, 'pooled.html');
  note(await run('make', 'Notes for Umer', '--out', page, '--options', '1', '--no-critic'));
  assert.match(readFileSync(page, 'utf8'), /Notes from b/, 'the second account answered after the first hit its limit');
  assert.deepEqual(log('claude.log').filter((c) => c.args.includes('-p')).map((c) => c.account), [join(dir, 'a'), join(dir, 'b')]);
  const pool = log('pool.log');
  assert.deepEqual(pool.map((p) => p.verb), ['pick', 'next'], 'one pick, then one re-pick after the limit');
  assert.equal(pool[0].request.pool_config, env.FIRST_DRAFT_ACCOUNT_POOL, 'the pool is the path the person gave, not a Firstmate path');
  assert.equal(pool[1].request.cause, 'quota', 'the limit is reported as the cause');
  assert.equal(pool[1].request.selection.selection_id, 'pa_umer_a', 'the limited account is the one left behind');
  assert.deepEqual(pool[1].request.attempted, ['pa_umer_a'], 'the limited account is not asked again');

  // The engine's own path (respond, used by the critic, the logo and the redesign calls) re-picks the same way.
  const engine = await promisify(execFile)(process.execPath, ['--input-type=module', '-e', `
    import { respond } from ${JSON.stringify(new URL('../src/byokit.mjs', import.meta.url).href)};
    const message = await respond({ route: 'claude', model: 'claude-opus-5-5', maxTokens: 100, timeoutMs: 60_000,
      context: { systemPrompt: 'Notes', messages: [{ role: 'user', content: 'Notes for Umer', timestamp: Date.now() }], tools: [{ name: 'done', parameters: { type: 'object' } }] } });
    console.log(JSON.stringify(message.content));`], { env });
  note(engine);
  assert.match(engine.stdout, /"name":"done"/);
  assert.deepEqual(log('pool.log').map((p) => p.verb), ['pick', 'next', 'pick', 'next'], 'the engine call picked and re-picked too');

  // Every Claude account under its floor: the helper offers a route this computer cannot run, then one it can.
  env.FD_POOL_LOW = '1';
  const fallen = join(dir, 'fallen-over.html');
  note(await run('make', 'Notes for Umer', '--out', fallen, '--options', '1', '--no-critic'));
  assert.match(readFileSync(fallen, 'utf8'), /Notes from gpt-6\.1-sol/, 'the page came from the route the pool fell over to');
  assert.ok(log('codex.log').some((args) => args.includes('--model') && args[args.indexOf('--model') + 1] === 'gpt-6.1-sol'));
  assert.equal(log('pool.log').at(-1).request.cause, 'unavailable', 'a route this computer cannot run is skipped, not retried');

  // Without the helper: the plain BYOKit route answers, unchanged, and the pool is never consulted.
  delete env.FIRST_DRAFT_ACCOUNT_POOL;
  const before = log('pool.log').length;
  const plain = join(dir, 'plain.html');
  note(await run('make', 'Notes for Umer', '--out', plain, '--options', '1', '--no-critic'));
  assert.match(readFileSync(plain, 'utf8'), /Notes from the installed account/);
  assert.equal(log('pool.log').length, before, 'no helper, no pool call');

  // No credential value reaches output, a log or a page.
  for (const written of [...seen, readFileSync(page, 'utf8'), readFileSync(fallen, 'utf8'), readFileSync(plain, 'utf8'), text('claude.log'), text('codex.log'), text('pool.log')])
    assert.doesNotMatch(written, new RegExp(SECRET), 'a credential value reached output or a log');
});
