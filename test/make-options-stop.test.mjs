// A multi-option make through the real CLI and the published Claude adapter, against an installed-Claude stand-in. No model calls.
// The stand-in fails one page the way the real CLI did on a large brief (2026-11-11): exit 1 with an error result, "response exceeded the 16384 output token maximum".
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

const CLI = new URL('../src/cli.mjs', import.meta.url).pathname;
const PAGE = '<!doctype html><html><head><style>:root{color-scheme:light dark}body{background:light-dark(#fff,#111);color:light-dark(#111,#eee)}</style></head><body><h1>Umer’s notes</h1></body></html>';

test('make with several options: one lost option stops the run with a clear reason and never reads as complete', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-stop-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'claude'), `#!${process.execPath}
import { appendFileSync, readFileSync } from 'node:fs';
const args = process.argv.slice(2), root = process.env.FIRST_DRAFT_HOME;
if (args.includes('auth')) { console.log(JSON.stringify({ loggedIn: true, authMethod: 'claude.ai', apiProvider: 'firstParty' })); process.exit(0); }
let input = ''; for await (const c of process.stdin) input += c;
const result = (o) => console.log(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, usage: { input_tokens: 1, output_tokens: 1 }, ...o }));
if (input.includes('Build one self-contained HTML page for this brief')) { result({ structured_output: { html: '<!doctype html><html><body><h1>Umer baseline</h1></body></html>' } }); process.exit(0); }
appendFileSync(root + '/draws', 'x');
if (process.env.FD_LOSE_DRAW && readFileSync(root + '/draws', 'utf8').length === Number(process.env.FD_LOSE_DRAW)) {
  result({ is_error: true, stop_reason: 'stop_sequence', api_error: 'max_output_tokens', result: "API Error: Claude's response exceeded the 16384 output token maximum." });
  process.exit(1);
}
result({ structured_output: { html: ${JSON.stringify(PAGE)} } });
`, { mode: 0o700 });
  writeFileSync(join(dir, 'codex'), `#!${process.execPath}\nimport ${JSON.stringify(new URL('./fixtures/judge-bridge.mjs', import.meta.url).href)};\n`, { mode: 0o700 });
  const env = { ...process.env, PATH: `${dir}:${process.env.PATH}`, HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, XDG_STATE_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir };
  const run = (...args) => promisify(execFile)(process.execPath, [CLI, ...args], { env, cwd: dir });
  await run('init', '--agent', 'byokit:claude', '--model', 'claude-sonnet-5-5');
  const out = join(dir, 'page.html'), record = join(dir, 'page.stopped.json');

  env.FD_LOSE_DRAW = '2'; // the second page the model is asked for cannot be answered
  const stopped = await run('make', 'Notes for Umer', '--direction', 'calm', '--options', '3', '--out', out).then(() => assert.fail('a run that lost an option must fail'), (e) => e);
  assert.equal(stopped.code, 1);
  const result = JSON.parse(stopped.stdout);
  assert.equal(result.error.code, 'OPTIONS_INCOMPLETE');
  const failedRun = JSON.parse((await run('status')).stdout);
  assert.equal(failedRun.state, 'options');
  assert.equal(failedRun.health, 'failed');
  assert.match(failedRun.error, /Only 2 of 3/);
  assert.match(result.error.message, /Only 2 of 3 options were made\. Option [123] \(page-[123]\.html\) MAKE_FAILED: .*did not make the design/);
  assert.equal(result.made.requested, 3);
  assert.equal(result.made.files.length, 2, 'the options after the lost one were still made');
  assert.equal(result.made.failed.length, 1);
  for (const f of result.made.files) assert.ok(existsSync(f.file), `${f.file} stays for review`);
  assert.ok(!existsSync(result.made.failed[0].file), 'the lost option has no file');
  const saved = JSON.parse(readFileSync(record, 'utf8'));
  assert.equal(saved.stopped, true);
  assert.equal(saved.requested, 3);
  assert.deepEqual(saved.made.sort(), result.made.files.map((f) => f.file).sort());
  assert.equal(saved.failed[0].option, result.made.failed[0].option);

  delete env.FD_LOSE_DRAW; // the same command with every option answered: a normal result, and the old stop record is gone
  const whole = JSON.parse((await run('make', 'Notes for Umer', '--direction', 'calm', '--options', '3', '--out', out)).stdout);
  assert.equal(whole.made.files.length, 3);
  assert.ok(!existsSync(record));
  const status = JSON.parse((await run('status')).stdout);
  assert.equal(status.state, 'critiqued');
  assert.equal(status.health, 'finished');
  assert.deepEqual(status.events.map((event) => event.state), ['gathering', 'options', 'critiqued', 'critiqued']);
  assert.equal(JSON.parse((await run('runs')).stdout).runs.length, 2);
  assert.equal(JSON.parse((await run('attach', status.id)).stdout).id, status.id);
  assert.deepEqual(JSON.parse((await run('logs', status.id)).stdout).events, status.events);
});
