// Real CLI, adapters, Chrome and Studio transport; only provider edges are synthetic.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { test } from 'node:test';
import { installJudge } from './fixtures/judge-cli.mjs';
import { standIn } from './fixtures/critic-model.mjs';
import { polishFeedback } from '../src/polish.mjs';
import { parseToolArguments } from '../src/byokit.mjs';
test('synthetic raw newline, tab and null fixture guards attempt-3 nested arguments failure at 9952', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/raw-control-arguments.json', import.meta.url), 'utf8'));
  assert.equal(fixture.synthetic, true); assert.throws(() => JSON.parse(fixture.calls[0].arguments), SyntaxError);
  const calls = fixture.calls.map((c) => ({ name: c.name, arguments: parseToolArguments(c.arguments, c.name) }));
  assert.deepEqual(calls.map((c) => c.name), ['str_replace_based_edit_tool', 'done']); assert.equal(calls[0].arguments.new_str, '\n\t\0'); assert.equal(calls[1].arguments.path, 'App.jsx');
  for (const c of ['\n', '\t', '\0']) { const raw = `{"new_str":"${c}"}`; assert.throws(() => JSON.parse(raw)); assert.equal(parseToolArguments(raw).new_str, c); }
  const tricky = String.raw`{"new_str":"a\"b\\` + '\n' + 'c"}'; assert.equal(parseToolArguments(tricky).new_str, 'a"b\\\nc');
  assert.throws(() => parseToolArguments('{"x":1}\0'), (e) => e.code === 'bad_json' && /position 7.*U\+0000.*snippet/.test(e.message) && e.message.length < 600);
  assert.throws(() => parseToolArguments('{bad:"\n"}'), (e) => e.code === 'bad_json' && /position 1.*U\+0062/.test(e.message));
});
test('chosen drawn source survives three independently judged refine rounds; Studio admits cumulative feedback', async (t) => {
  let inject = () => {}, added = false;
  const dir = mkdtempSync(join(tmpdir(), 'fd-polish-')), seen = [], server = await standIn(seen, [], true, (body) => inject(body));
  t.after(() => { server.close(); rmSync(dir, { recursive: true, force: true }); });
  installJudge(dir);
  writeFileSync(join(dir, 'config.json'), JSON.stringify({ agent: 'byokit:opencode-go', agent_config: { 'byokit:opencode-go': { model: 'muse-spark-1.3-contributor' } } }));
  const env = { ...process.env, CI: 'true', PATH: `${dir}:${process.env.PATH}`, HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir, OPENCODE_API_KEY: 'synthetic', FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}`, FD_JUDGE_SCORES: '[[7,6]]', FD_POLISH_SCORES: '[7,8,8.5,9,7,9]' };
  const cli = new URL('../src/cli.mjs', import.meta.url).pathname;
  const run = async (...args) => (await promisify(execFile)(process.execPath, [cli, ...args], { env, cwd: dir, maxBuffer: 5_000_000 })).stdout.trim().split('\n').map(JSON.parse);
  const file = join(dir, 'a.html'), out = join(dir, 'run');
  await run('make', 'A notes app', '--engine', '--options', '1', '--out', file);
  const original = readFileSync(file, 'utf8'), source = (html) => JSON.parse(Buffer.from(html.match(/<!--first-draft-source:([^>]+)-->/)[1], 'base64'));
  assert.equal(source(original).main, 'App.jsx');
  const tampered = join(dir, 'tampered.html'); writeFileSync(tampered, original.replace('Notes, version 1', 'Changed outside the verified source')); await assert.rejects(run('refine', tampered, 'Adjust spacing', '--out', join(dir, 'bad.html')), (e) => e.stdout.includes('no longer matches this page'));
  inject = async (body) => { if (!added && body.includes('Revise this')) { added = true; await run('polish-feedback', out, 'Keep the sample disclosure'); } };
  const lines = await run('polish', file, 'A notes app', '--out-dir', out, '--feedback', 'Keep the notes', '--max-rounds', '3');
  assert.deepEqual(lines.slice(0, -1).map((l) => l.polish_round.score), [7, 8, 8.5, 9]);
  const result = JSON.parse(readFileSync(join(out, 'run.json'), 'utf8')); assert.equal(result.stop_reason, 'target_reached');
  for (const r of result.rounds) { const s = source(readFileSync(r.file, 'utf8')); assert.equal(s.main, 'App.jsx'); assert.ok(s.files.some(([p]) => p === 'DESIGN.md')); assert.equal(r.critique.feedback[0].kept, true); }
  const inputs = seen.filter((s) => s.includes('Revise this'));
  assert.ok(inputs.every((s) => s.includes('Revise this App.jsx') && s.includes('Current App.jsx:')));
  assert.equal(readFileSync(file, 'utf8'), original);
  const calls = readFileSync(join(dir, 'polish-calls.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.ok(calls.every((c) => c.model === 'gpt-6.1-sol' && c.images >= 8 && c.system.includes('virtual host-side actions')));
  assert.equal(result.rounds.at(-1).round, 3); assert.equal(result.rounds[1].feedback_pending, true);
  assert.ok(result.rounds.slice(2).every((r) => r.feedback.length === 2 && r.critique.feedback.every((f) => f.kept)));
  assert.throws(() => polishFeedback(out, 'late'), /stopped/);
  const viewer = execFile(process.execPath, [cli, 'view', file, '--host', '127.0.0.1', '--port', '0'], { env, cwd: dir }); t.after(() => viewer.kill());
  const v = await new Promise((ok, fail) => { let data = ''; viewer.once('error', fail); viewer.stdout.on('data', (s) => { data += s; if (data.includes('\n')) ok(JSON.parse(data.split('\n')[0]).viewing); }); });
  const post = (path, body, origin = new URL(v.url).origin) => fetch(v.url + path, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await post('polish', { option: 1, brief: 'A notes app' }, 'https://foreign.invalid')).status, 403);
  assert.equal((await post('polish', { option: 1, brief: 'A notes app' })).status, 202);
  for (let i = 0; !existsSync(join(dir, 'a-polish/run.json')) && i < 200; i++) await new Promise((r) => setTimeout(r, 10));
  assert.equal((await post('polish-feedback', { id: 1, text: 'Keep the title' })).status, 200);
  let state; for (let i = 0; i < 200; i++) { state = (await (await fetch(v.url + 'polish')).json()).runs[0]; if (state.status !== 'running') break; await new Promise((r) => setTimeout(r, 100)); }
  assert.equal(state.state.stop_reason, 'target_reached'); assert.equal(state.state.rounds[1].feedback[0].text, 'Keep the title');
  assert.equal((await fetch(`${v.frames}/o/${state.versions[1].option.n}`)).status, 200);
});
