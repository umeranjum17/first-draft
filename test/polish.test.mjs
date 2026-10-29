import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { installJudge } from './fixtures/judge-cli.mjs';
import { standIn } from './fixtures/critic-model.mjs';
import { polishFeedback, polishState, roundCap, runPolish } from '../src/polish.mjs';
import { serve } from '../src/view.mjs';

const original = '<!doctype html><html><head><title>Chosen A</title></head><body><h1>Chosen A</h1></body></html>';
const lab = (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'fd-polish-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'a.html'); writeFileSync(file, original);
  return { file, outDir: join(dir, 'run'), brief: 'A notes app', dir };
};
const verdict = (score, feedback = [], extra = {}) => ({ score, gaps: score < 9 ? ['Phone title needs more breathing room'] : [], direction_kept: true, direction_reason: 'Same chosen identity', feedback: feedback.map((f) => ({ id: f.id, kept: true, reason: 'Visible' })), ...extra });

test('bounded loop keeps every version, feeds judge gaps and cumulative mid-round feedback, rejects direction and feedback regressions', async (t) => {
  const args = lab(t), seeds = [], prompts = [], feedbackSeen = [];
  let n = 0;
  const result = await runPolish({ ...args, maxRounds: 5, feedback: ['Keep the rust accent'],
    refine: async ({ seed, prompt }) => { seeds.push(seed); prompts.push(prompt); return { html: original.replace('Chosen A</h1>', `Chosen A v${seeds.length}</h1>`) }; },
    judge: async ({ feedback }) => {
      feedbackSeen.push(feedback.map((f) => f.text));
      const round = n++;
      if (round === 1) polishFeedback(args.outDir, 'Keep the heading readable on phone');
      if (round === 2) return verdict(9.5, feedback, { direction_kept: false });
      return verdict([7, 8, 9.5, 9.2][round], feedback);
    }
  });
  assert.deepEqual(result.rounds.map((r) => [r.score, r.accepted]), [[7, true], [8, true], [9.5, false], [9.2, true]]);
  assert.equal(result.stop_reason, 'target_reached');
  assert.equal(result.final.score, 9.2);
  assert.equal(result.rounds[1].feedback_pending, true);
  assert.equal(seeds[2], seeds[1], 'rejected versions never become the next seed');
  assert.notEqual(seeds[1], original, 'feedback arriving during judging does not discard useful progress');
  assert.match(prompts[1], /Phone title needs more breathing room/);
  assert.match(prompts[1], /Keep the rust accent/);
  assert.match(prompts[1], /Keep the heading readable on phone/);
  assert.equal(feedbackSeen[2].length, 2);
  assert.equal(readFileSync(args.file, 'utf8'), original);
  for (const r of result.rounds) assert.deepEqual(JSON.parse(readFileSync(join(args.outDir, `round-${r.round}.json`))), r);
  await assert.rejects(runPolish({ ...args, refine: () => {}, judge: () => {} }), /EEXIST/);
  assert.throws(() => polishFeedback(args.outDir, 'too late'), /stopped/);
});

test('target, cap, stalled scores, failed judge and feedback reversion have explicit outcomes', async (t) => {
  for (const [scores, maxRounds, reason] of [[[7, 8, 9], 5, 'target_reached'], [[7, 8], 1, 'round_cap'], [[7, 7, 7], 5, 'no_improvement_two_rounds'], [[9], 5, 'target_reached']]) {
    const args = lab(t); let n = 0;
    const result = await runPolish({ ...args, maxRounds, refine: async ({ seed }) => ({ html: seed + '\n' }), judge: async () => verdict(scores[n++]) });
    assert.equal(result.stop_reason, reason);
    assert.deepEqual(result.rounds.map((r) => r.score), scores);
  }
  const pending = lab(t); let pendingN = 0;
  const continued = await runPolish({ ...pending, maxRounds: 1, refine: async ({ seed }) => ({ html: seed + '\n' }), judge: async ({ feedback }) => {
    if (!pendingN++) polishFeedback(pending.outDir, 'Keep the footer');
    return verdict(9, feedback);
  } });
  assert.equal(continued.rounds.length, 2, 'nine cannot finish while feedback is unassessed');
  assert.deepEqual(continued.unmet_feedback, []);
  const args = lab(t); let n = 0;
  const result = await runPolish({ ...args, maxRounds: 2, feedback: ['Keep the label'], refine: async ({ seed }) => ({ html: seed + '\n' }), judge: async ({ feedback }) => {
    const r = verdict(n++ ? 10 : 7, feedback);
    if (n > 1) r.feedback[0].kept = false;
    return r;
  } });
  assert.equal(result.final.score, 7);
  assert.ok(result.rounds.slice(1).every((r) => !r.accepted));
  const fail = lab(t);
  await assert.rejects(runPolish({ ...fail, refine: () => {}, judge: async () => { throw new Error('judge offline'); } }), /judge offline/);
  assert.equal(polishState(fail.outDir).status, 'failed');
  assert.ok(existsSync(join(fail.outDir, 'round-0.html')));
  assert.equal(polishState(fail.outDir).final, null);
  assert.equal(polishState(fail.outDir).rounds[0].score, null);
  assert.equal(JSON.parse(readFileSync(join(fail.outDir, 'round-0.json'))).error, 'judge offline');
  for (const n of [0, -1, 1.5, NaN, Infinity, 51, 'no']) assert.throws(() => roundCap(n));
});

test('Studio starts asynchronously, admits feedback while judging, exposes scores/versions and protects POST origin', async (t) => {
  const args = lab(t);
  let release, judged;
  const waiting = new Promise((r) => { judged = r; });
  const gate = new Promise((r) => { release = r; });
  let n = 0;
  const v = await serve({ files: [args.file], name: 'Chosen', host: '127.0.0.1', port: 0, framePort: 0,
    polish: (options) => runPolish({ ...options, feedback: options.feedback(), refine: async ({ seed }) => ({ html: seed + '\n' }), judge: async ({ feedback }) => { if (!n) { judged(); await gate; } return verdict(n++ ? 9 : 7, feedback); } }) });
  t.after(v.close);
  const post = (path, body, origin = new URL(v.url).origin) => fetch(v.url + path, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await post('polish', { option: 1, brief: args.brief }, 'https://untrusted.invalid')).status, 403);
  assert.equal((await post('polish', { option: 1, brief: args.brief, maxRounds: 0 })).status, 400);
  assert.equal((await post('polish', { option: 1, brief: args.brief })).status, 202);
  await waiting;
  assert.equal((await post('polish', { option: 1, brief: args.brief })).status, 409);
  assert.equal((await post('polish-feedback', { id: 1, text: 'Keep the title' })).status, 200);
  release();
  let run;
  for (let i = 0; i < 100; i++) {
    run = (await (await fetch(v.url + 'polish')).json()).runs[0];
    if (run.status !== 'running') break;
    await new Promise((r) => setTimeout(r, 10));
  }
  assert.equal(run.state.stop_reason, 'target_reached');
  assert.deepEqual(run.versions.map((r) => r.score), [7, 9]);
  assert.equal(run.state.rounds[1].feedback[0].text, 'Keep the title');
  assert.equal((await fetch(`${v.frames}/o/${run.versions[1].option.n}`)).status, 200);
  assert.equal((await post('polish-feedback', { id: 1, text: 'too late' })).status, 409);
});

test('public CLI uses the actual generator adapter, independent native judge and whole-page captures', async (t) => {
  const args = lab(t), seen = [], server = await standIn(seen, []);
  t.after(() => server.close());
  installJudge(args.dir);
  writeFileSync(join(args.dir, 'config.json'), JSON.stringify({ agent: 'byokit:opencode-go', agent_config: { 'byokit:opencode-go': { model: 'muse-spark-1.3-contributor' } }, judge: { agent: 'byokit:codex', model: 'gpt-6.1-sol' } }));
  const env = { ...process.env, CI: 'true', PATH: `${args.dir}:${process.env.PATH}`, HOME: args.dir, XDG_CONFIG_HOME: args.dir, XDG_DATA_HOME: args.dir, TMPDIR: args.dir, FIRST_DRAFT_HOME: args.dir, OPENCODE_API_KEY: 'synthetic', FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}` };
  const cli = new URL('../src/cli.mjs', import.meta.url).pathname;
  const { stdout } = await promisify(execFile)(process.execPath, [cli, 'polish', args.file, args.brief, '--out-dir', args.outDir, '--feedback', 'Keep the title'], { env, cwd: args.dir, maxBuffer: 5_000_000 });
  const lines = stdout.trim().split('\n').map(JSON.parse), result = lines.at(-1).polished;
  assert.deepEqual(lines.slice(0, -1).map((l) => l.polish_round.score), [7, 8, 9]);
  assert.equal(result.stop_reason, 'target_reached');
  assert.equal(readFileSync(args.file, 'utf8'), original);
  assert.ok(seen.some((s) => s.includes('Phone title') || s.includes('phone title')));
  assert.ok(seen.every((s) => !s.includes('"judge_polish"')), 'generator never assesses itself');
  const calls = readFileSync(join(args.dir, 'polish-calls.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(calls.length, 3);
  assert.ok(calls.every((c) => c.model === 'gpt-6.1-sol'));
  assert.deepEqual([...new Set(calls[0].q.image_order.filter((s) => s.side === 'CURRENT').map((s) => `${s.width}-${s.theme}`))].sort(), ['1280-dark', '1280-light', '390-dark', '390-light']);
  assert.equal(polishState(args.outDir).final.score, 9);
});
