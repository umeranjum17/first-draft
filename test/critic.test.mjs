// Real CLI + Chrome + published BYOKit adapters, with task-local provider/installed-CLI stand-ins. No external network or model.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';
import { findBrowser } from '../src/render-check.mjs';
import { PLAIN, images, standIn } from '../journeys/fixtures/critic-model.mjs';
import { installJudge, referenceStandIn } from '../journeys/fixtures/judge-cli.mjs';
const CLI = new URL('../src/cli.mjs', import.meta.url).pathname;

async function lab(t, scores) {
  const dir = mkdtempSync(join(tmpdir(), 'fd-judge-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  installJudge(dir);
  writeFileSync(join(dir, 'google-chrome-stable'), 'not executable', { mode: 0o600 });
  mkdirSync(join(dir, 'google-chrome')); // X_OK alone accepts a directory: the real CLI must skip it too.
  const seen = [], server = await standIn(seen, scores);
  t.after(() => server.close());
  const env = { ...process.env, CI: 'true', PATH: `${dir}:${process.env.PATH}`, HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir, OPENCODE_API_KEY: 'synthetic', FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}` };
  const run = async (...args) => {
    try { return JSON.parse((await promisify(execFile)(process.execPath, [CLI, ...args], { env, cwd: dir })).stdout); }
    catch (e) { e.message += `\n${e.stdout ?? ''}\n${e.stderr ?? ''}`; throw e; }
  };
  await run('init', '--agent', 'byokit:opencode-go', '--model', 'muse-spark-1.3-contributor');
  return { dir, seen, env, run };
}

test('make scores once, keeps a low option flagged without revising, and --no-critic scores nothing', async (t) => {
  if (!findBrowser()) return t.skip('no Chrome or Chromium');
  const { dir, seen, run } = await lab(t, [[6, 7], [9, 7]]);
  for (const engine of [true, false]) {
    const out = join(dir, engine ? 'engine.html' : 'page.html');
    const { made, help } = await run('make', 'A notes app for Umer', '--out', out, '--options', '1', ...(engine ? ['--engine'] : []));
    const c = made.files[0].critique;
    assert.deepEqual([c.score, c.passed, c.rounds, c.scores], engine ? [6, false, 1, [6]] : [9, true, 1, [9]]);
    assert.match(readFileSync(out, 'utf8'), /Notes, version 1/);
    assert.match(c.judge, /same model.*no references are pulled/s);
    assert.match(help.join('\n'), /self-assessment/);
    assert.equal(help.some(h => h.includes('below the bar')), engine);
    assert.equal(readFileSync(made.critic.plain, 'utf8'), PLAIN);
  }
  const asked = seen.filter(b => b.includes('"review_designs"'));
  assert.equal(asked.length, 2);
  assert.ok(asked.every(b => images(b) === 4));
  const out = join(dir, 'off.html'), before = seen.length;
  const off = await run('make', 'A notes app for Umer', '--out', out, '--options', '1', '--no-critic');
  assert.equal(off.made.files[0].critique, undefined);
  assert.match(off.made.critic.off, /--no-critic/);
  assert.equal(existsSync(join(dir, 'off.critic')), false);
  assert.ok(seen.slice(before).every(b => !b.includes('"review_designs"') && !b.includes('"write_page"')));
});

test('refs pull -> independent subscription judge -> explicit fallbacks, through the public CLI', async (t) => {
  if (!findBrowser()) return t.skip('no Chrome or Chromium');
  const { dir, seen, env, run } = await lab(t, Array(8).fill([7, 6]));
  const refs = await referenceStandIn(dir);
  t.after(() => refs.server.close());
  env.FIRST_DRAFT_TEST_REF_ORIGIN = refs.origin;
  const pulled = await run('refs', 'pull', '--library', refs.library);
  assert.equal(pulled.refs_pulled.captured[0].shots, 4);
  assert.equal(pulled.refs_pulled.not_captured.length, 2);
  assert.match(pulled.refs_pulled.not_captured.find(r => r.id === 'robots-blocked').why, /robots.txt disallows/);
  assert.ok(!refs.seen.includes('/never-fetch') && !refs.seen.includes('/blocked'));
  assert.match((await run('refs', 'list', '--library', refs.library)).refs[0].here, /captured/);
  await run('init', '--agent', 'byokit:opencode-go', '--model', 'muse-spark-1.3-contributor', '--judge', 'byokit:codex', '--judge-model', 'gpt-6.1-sol');
  const out = join(dir, 'notes.html');
  const made = (await run('make', 'A notes app for Umer', '--out', out, '--options', '1')).made;
  assert.equal(made.critic.judge.model, 'gpt-6.1-sol');
  assert.equal(made.critic.judge.agent, 'byokit:codex');
  assert.equal(made.files[0].critique.score, 6);
  assert.equal(made.files[0].critique.rounds, 1);
  assert.equal(Object.keys(made.files[0].critique.axes).length, 7);
  assert.ok(!seen.some(b => b.includes('"review_designs"')), 'generator never judges when the independent route works');
  const native = JSON.parse(readFileSync(join(dir, 'judge-calls.jsonl'), 'utf8').trim());
  assert.equal(native.model, 'gpt-6.1-sol');
  assert.equal(native.images, 6);
  assert.match(native.input, /Umer notes, desktop 1280, light.*Umer notes, phone 390, light/s);
  const baseline = made.critic.plain, original = readFileSync(out, 'utf8'), before = seen.length;
  const judged = await run('judge', out, 'A notes app for Umer', '--plain', baseline);
  assert.equal(judged.critique.score, 6);
  assert.equal(seen.length, before, 'retained judging generates neither design nor baseline');
  assert.equal(readFileSync(out, 'utf8'), original);
  for (const [name, value, why] of [['FD_JUDGE_AUTH', 'out', /not ready/], ['FD_JUDGE_FAILURE', '1', /independent judge failed/]]) {
    env[name] = value;
    const fallback = await run('judge', out, 'A notes app for Umer', '--plain', baseline);
    assert.match(fallback.judge.off, why);
    assert.match(fallback.critique.judge, /same model/);
    assert.equal(fallback.critique.axes, undefined);
    delete env[name];
  }
  const config = join(dir, 'config.json'), saved = JSON.parse(readFileSync(config, 'utf8'));
  for (const judge of [{ agent: 'byokit:opencode-go', model: 'other' }, { agent: 'byokit:codex', model: saved.agent_config[saved.agent].model }, { agent: 'byokit:codex' }]) {
    writeFileSync(config, JSON.stringify({ ...saved, judge }));
    const fallback = await run('judge', out, 'A notes app for Umer', '--plain', baseline);
    assert.match(fallback.judge.off, /subscription|model that made|invalid judge configuration/);
  }
  writeFileSync(config, JSON.stringify(saved));
  const otherKind = await run('judge', out, 'An analytics dashboard', '--plain', baseline);
  assert.match(otherKind.judge.off, /no reference of a dashboard/);
  writeFileSync(join(dir, 'refs-library/umer-notes/desktop-light.png'), 'changed');
  assert.match((await run('judge', out, 'A notes app for Umer', '--plain', baseline)).judge.off, /changed since it was captured/);
});

test('landing AI-side and nine-point hero checks survive in both critics, without another design pass', async (t) => {
  if (!findBrowser()) return t.skip('no Chrome or Chromium');
  const { dir, seen, env, run } = await lab(t, [[8, 5], [9, 5]]);
  const brief = 'a landing page for a small accounting software company for teams';
  const makeLanding = async name => (await run('make', brief, '--out', join(dir, name+'.html'), '--options', '1')).made;
  const low = await makeLanding('low'), c = low.files[0].critique;
  assert.deepEqual([c.score, c.passed, c.rounds, c.ai_side.reads_as_ai, c.hero.met, c.hero.of, c.hero.points.length], [8, false, 1, true, 5, 9, 9]);
  const high = await makeLanding('high');
  assert.deepEqual([high.files[0].critique.passed, high.files[0].critique.ai_side.reads_as_ai, high.files[0].critique.hero.met], [true, false, 9]);
  assert.equal(seen.filter(b => b.includes('"review_designs"')).length, 2, 'one review each, no critic revision');
  assert.match(seen.find(b => b.includes('"review_designs"')), /AI-side tells are: soft pastel on everything.*nine points in order/s);
  assert.ok(seen.some(b => !b.includes('"review_designs"') && b.includes('# Human side, not AI side')));
  const refs = await referenceStandIn(dir); t.after(() => refs.server.close());
  const lib = JSON.parse(readFileSync(refs.library, 'utf8'));
  lib.entries.forEach(e => { e.kind = 'landing'; });
  writeFileSync(refs.library, JSON.stringify(lib));
  env.FIRST_DRAFT_TEST_REF_ORIGIN = refs.origin;
  await run('refs', 'pull', '--library', refs.library);
  env.FD_JUDGE_AI = '1';
  const judged = await run('judge', high.files[0].file, brief, '--plain', high.critic.plain);
  assert.equal(judged.judge.model, 'gpt-6.1-sol');
  assert.deepEqual([judged.critique.score, judged.critique.passed, judged.critique.ai_side.reads_as_ai, judged.critique.hero.points.length], [9, false, true, 9]);
  assert.equal(Object.keys(judged.critique.axes).length, 7);
});
