// Public CLI refusal journeys run WITHOUT the explicit fixture loader in their child processes.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';
const CLI = new URL('../src/cli.mjs', import.meta.url).pathname;

test('no engine, stale unauthenticated configuration and OpenCode-only credentials refuse without output or fixture traffic', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'fd-engine-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const env = { HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, XDG_STATE_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir, PATH: dir, FIRST_DRAFT_TEST_BYOKIT_BASE: 'http://127.0.0.1:1', FIRST_DRAFT_TEST_REF_ORIGIN: 'http://127.0.0.1:1' };
  const run = (...args) => promisify(execFile)(process.execPath, [CLI, ...args], { env, cwd: dir });
  const out = join(dir, 'new.html'), seed = join(dir, 'seed.html');
  writeFileSync(seed, '<!doctype html><html><body>Umer notes</body></html>');
  const refuse = async (args, instruction = /Sign in to Claude: claude auth login/) => {
    await assert.rejects(run(...args), e => {
      const value = JSON.parse(e.stdout);
      assert.equal(e.code, 1); assert.equal(value.error.code, 'NO_ENGINE');
      assert.match(value.error.message, instruction); assert.equal(value.made, undefined);
      assert.equal((value.error.message.match(/Sign in to/g) ?? []).length, 1);
      return true;
    });
    assert.equal(existsSync(out), false); assert.equal(existsSync(join(dir, 'new.critic')), false);
  };
  await refuse(['make', 'Notes for Umer', '--out', out]);
  await refuse(['doctor']);
  await refuse(['benchmark', '--product', 'notes', '--screen', 'notes', '--out', out]);
  for (const flag of ['--no-judge', '--no-discovery']) {
    await assert.rejects(run('benchmark', '--product', 'notes', '--screen', 'notes', '--out', out, flag), e => {
      const value = JSON.parse(e.stdout); assert.equal(e.code, 1);
      assert.equal(value.error.code, 'BENCHMARK_FAILED'); assert.match(value.error.message, /test-only.*FIRST_DRAFT_TEST_BENCHMARK=1/); return true;
    });
    assert.equal(existsSync(out), false); assert.equal(existsSync(`${out}.json`), false);
  }
  await refuse(['logo', 'Umer notes', '--out', out]);
  await refuse(['redesign', dir, 'Clear notes for Umer', '--out', out]);
  await refuse(['refine', seed, 'Clear notes', '--out', out]);
  writeFileSync(join(dir, 'claude'), `#!${process.execPath}\nconsole.log('{"loggedIn":false}');\n`, { mode: 0o700 });
  writeFileSync(join(dir, 'config.json'), JSON.stringify({ agent: 'byokit:claude', agent_config: { 'byokit:claude': { model: 'claude-sonnet-5-5' } } }));
  await refuse(['make', 'Notes for Umer', '--out', out]);
  mkdirSync(join(dir, 'opencode')); writeFileSync(join(dir, 'opencode', 'auth.json'), '{"fixture":"not-a-real-login"}');
  await assert.rejects(run('make', 'Notes for Umer', '--out', out), e => /OpenCode login storage is present but is not usable by this build/.test(e.stdout) && /claude auth login/.test(e.stdout));
  assert.equal(existsSync(out), false);
  // A ready single engine is selected/named, but it cannot also serve as its own judge.
  writeFileSync(join(dir, 'claude'), `#!${process.execPath}\nconsole.log('{"loggedIn":true,"authMethod":"claude.ai","apiProvider":"firstParty"}');\n`, { mode: 0o700 });
  const doctor = JSON.parse((await run('doctor')).stdout);
  assert.deepEqual(doctor.engine, { agent: 'byokit:claude', model: 'claude-sonnet-5-5' });
  for (const args of [['make','Notes for Umer','--out',out], ['logo','Umer notes','--out',out], ['redesign',dir,'Clear notes','--out',out], ['benchmark','--product','notes','--screen','notes','--out',out]]) await refuse(args, /No independent AI judge.*Sign in to ChatGPT: codex login/);
  await assert.rejects(run('init', '--agent', 'byokit:claude', '--model', 'claude-sonnet-5-5', '--judge', 'byokit:claude', '--judge-model', 'claude-opus-5-5'), e => /BAD_JUDGE/.test(e.stdout));
  await assert.rejects(run('init', '--agent', 'byokit:openai:key', '--model', 'gpt-5-mini', '--judge', 'byokit:codex', '--judge-model', 'gpt-6.1-sol'), e => /BAD_JUDGE/.test(e.stdout));
  await assert.rejects(run('make', 'Notes', '--out', out, '--no-critic'), e => /USAGE/.test(e.stdout));
  assert.equal(readFileSync(seed, 'utf8'), '<!doctype html><html><body>Umer notes</body></html>');
});
