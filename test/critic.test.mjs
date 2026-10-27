// Real CLI + Chrome + published BYOKit adapters, with task-local provider/installed-CLI stand-ins. No external network or model.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';
import { MAX_TILES, TILE, findBrowser, renderCheck, tilesOf } from '../src/render-check.mjs';
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
  const env = { ...process.env, FD_JUDGE_SCORES: JSON.stringify(scores), CI: 'true', PATH: `${dir}:${process.env.PATH}`, HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir, OPENCODE_API_KEY: 'synthetic', FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}` };
  const run = async (...args) => {
    try { return JSON.parse((await promisify(execFile)(process.execPath, [CLI, ...args], { env, cwd: dir })).stdout); }
    catch (e) { e.message += `\n${e.stdout ?? ''}\n${e.stderr ?? ''}`; throw e; }
  };
  await run('init', '--agent', 'byokit:opencode-go', '--model', 'muse-spark-1.3-contributor');
  return { dir, seen, env, run };
}

test('make requires an independent engine, scores once, keeps low options flagged, and rejects --no-critic', async (t) => {
  if (!findBrowser()) return t.skip('no Chrome or Chromium');
  const { dir, seen, run } = await lab(t, [[6, 7], [9, 7], [9, 7]]);
  for (const engine of [true, false]) {
    const out = join(dir, engine ? 'engine.html' : 'page.html');
    const { made, help } = await run('make', 'A notes app for Umer', '--out', out, '--options', '1', ...(engine ? ['--engine'] : []));
    const c = made.files[0].critique;
    assert.deepEqual([c.score, c.passed, c.rounds, c.scores], engine ? [6, false, 1, [6]] : [9, true, 1, [9]]);
    assert.match(readFileSync(out, 'utf8'), /Notes, version 1/);
    assert.match(c.judge, /independent:.*byokit:codex/s);
    assert.ok(!help.join('\n').includes('self-assessment'));
    assert.equal(help.some(h => h.includes('below the bar')), engine);
    assert.equal(readFileSync(made.critic.plain, 'utf8'), PLAIN);
    // the capture set is on the judge's JSON, and the review names what it judged in every design view
    assert.equal(c.capture.mode, 'full-page-both-themes');
    assert.equal(c.capture.images, 16);
    assert.deepEqual([...new Set(c.capture.set.map(i => `${i.side}-${i.width}-${i.theme}`))].sort(), ['design-1280-dark', 'design-1280-light', 'design-390-dark', 'design-390-light', 'plain-1280-dark', 'plain-1280-light', 'plain-390-dark', 'plain-390-light']);
    assert.ok(c.capture.set.every(i => i.tiles === 2 && i.page_height === 2500 && i.covered === 2500));
    assert.deepEqual(c.views.map(v => v.view).sort(), c.capture.set.filter(i => i.side === 'design').map(i => i.id).sort());
  }
  const asked = readFileSync(join(dir, 'judge-calls.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(asked.length, 2);
  assert.ok(asked.every(b => b.images === 16));
  assert.match(asked[0].input, /capture_notes.*tile 2 of 2 = rows 1250-2500/s);
  assert.match(asked[0].system, /Judge every view, the lower page and the dark theme/);
  assert.ok(!seen.some(b => b.includes('"review_designs"')), 'generator never assesses itself');
  // --first-view is the cheap look: light only, the top of the page at 1280 and 390, four images in all
  const first = await run('make', 'A notes app for Umer', '--out', join(dir, 'first.html'), '--options', '1', '--first-view');
  const fc = first.made.files[0].critique;
  assert.deepEqual([fc.capture.mode, fc.capture.images, fc.capture.set.map(i => `${i.side}-${i.width}-${i.theme}`)], ['first-viewport', 4, ['design-1280-light', 'design-390-light', 'plain-1280-light', 'plain-390-light']]);
  const native = JSON.parse(readFileSync(join(dir, 'judge-calls.jsonl'), 'utf8').trim().split('\n').at(-1));
  assert.equal(native.images, 4);
  assert.match(native.system, /first-viewport assessment/);
  const out = join(dir, 'off.html'), before = seen.length;
  await assert.rejects(run('make', 'A notes app for Umer', '--out', out, '--options', '1', '--no-critic'), e => /Unknown option/.test(e.stdout));
  assert.equal(existsSync(out), false);
  assert.equal(existsSync(join(dir, 'off.critic')), false);
  assert.equal(seen.length, before);
});

test('refs pull -> independent subscription judge -> refusal, never self-assessment, through the public CLI', async (t) => {
  if (!findBrowser()) return t.skip('no Chrome or Chromium');
  const { dir, seen, env, run } = await lab(t, Array(8).fill([6, 7]));
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
  assert.equal(native.images, 18, 'sixteen capture-set views (two tiles each) and the two references');
  assert.equal(made.files[0].critique.capture.mode, 'full-page-both-themes');
  assert.match(native.input, /Umer notes, desktop 1280, light.*Umer notes, phone 390, light/s);
  const baseline = made.critic.plain, original = readFileSync(out, 'utf8'), before = seen.length;
  const judged = await run('judge', out, 'A notes app for Umer', '--plain', baseline);
  assert.equal(judged.critique.score, 6);
  assert.equal(seen.length, before, 'retained judging generates neither design nor baseline');
  assert.equal(readFileSync(out, 'utf8'), original);
  for (const [name, value, why] of [['FD_JUDGE_AUTH', 'out', /No independent AI judge/], ['FD_JUDGE_FAILURE', '1', /Codex|model could not answer/]]) {
    env[name] = value;
    await assert.rejects(run('judge', out, 'A notes app for Umer', '--plain', baseline), e => why.test(e.stdout));
    assert.equal(readFileSync(out, 'utf8'), original);
    delete env[name];
  }
  const config = join(dir, 'config.json'), saved = JSON.parse(readFileSync(config, 'utf8'));
  for (const judge of [{ agent: 'byokit:opencode-go', model: 'other' }, { agent: 'byokit:codex', model: saved.agent_config[saved.agent].model }, { agent: 'byokit:codex' }]) {
    writeFileSync(config, JSON.stringify({ ...saved, judge }));
    await assert.rejects(run('judge', out, 'A notes app for Umer', '--plain', baseline), e => /Invalid independent judge configuration/.test(e.stdout));
  }
  writeFileSync(config, JSON.stringify(saved));
  const otherKind = await run('judge', out, 'An analytics dashboard', '--plain', baseline);
  assert.equal(otherKind.judge.agent, 'byokit:codex');
  assert.match(otherKind.critique.judge, /independent/);
  writeFileSync(join(dir, 'refs-library/umer-notes/desktop-light.png'), 'changed');
  await assert.rejects(run('judge', out, 'A notes app for Umer', '--plain', baseline), e => /changed since it was captured/.test(e.stdout));
});

test('landing AI-side and nine-point hero checks survive in the required independent critic', async (t) => {
  if (!findBrowser()) return t.skip('no Chrome or Chromium');
  const { dir, seen, env, run } = await lab(t, [[8, 5], [9, 5]]);
  const brief = 'a landing page for a small accounting software company for teams';
  const makeLanding = async name => (await run('make', brief, '--out', join(dir, name+'.html'), '--options', '1')).made;
  const low = await makeLanding('low'), c = low.files[0].critique;
  assert.deepEqual([c.score, c.passed, c.rounds, c.ai_side.reads_as_ai, c.hero.met, c.hero.of, c.hero.points.length], [8, false, 1, true, 5, 9, 9]);
  const high = await makeLanding('high');
  assert.deepEqual([high.files[0].critique.passed, high.files[0].critique.ai_side.reads_as_ai, high.files[0].critique.hero.met], [true, false, 9]);
  const native = readFileSync(join(dir, 'judge-calls.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(native.length, 2, 'one independent review each');
  assert.match(native[0].system, /AI-side tells are: soft pastel on everything.*nine points in order/s);
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

test('the judge captures the whole page in both themes at both widths, tiled and capped by height, and short pages are not tiled', async (t) => {
  assert.deepEqual(tilesOf(900).tiles, [{ y: 0, height: 900, scale: 1 }]);
  for (const height of [TILE, 4000, 7000, 20000]) {
    const { tiles, covered } = tilesOf(height);
    assert.ok(tiles.length <= MAX_TILES, `${height}px page: ${tiles.length} tiles`);
    assert.ok(tiles.every(x => x.height * x.scale <= TILE), 'each tile image stays under the long edge a model reads without shrinking');
    assert.equal(tiles.reduce((n, x) => n + x.height, 0), covered, 'tiles are contiguous and cover the page');
  }
  assert.equal(tilesOf(7000).covered, 7000);
  assert.ok(tilesOf(20000).covered < 20000, 'a page past the cap is cut, and says so');
  if (!findBrowser()) return t.skip('no Chrome or Chromium');
  const page = (h) => `<!doctype html><html><head><style>:root{--bg:#fff}@media(prefers-color-scheme:dark){:root{--bg:#000}}body{margin:0;height:${h}px;background:var(--bg)}</style></head><body>x</body></html>`;
  const render = renderCheck();
  t.after(() => render.close());
  const tall = await render.views(page(7000)), short = await render.views(page(900));
  assert.deepEqual([...new Set(tall.map(s => `${s.width}-${s.theme}`))], ['1280-light', '1280-dark', '390-light', '390-dark']);
  assert.equal(tall.length, 4 * 3, 'a 7000px page is three tiles in each of the four views');
  assert.ok(tall.every(s => s.page_height === 7000 && s.mime === 'image/jpeg'));
  assert.equal(short.length, 4, 'a short page is one image per view, not tiled');
  assert.ok(short.every(s => s.tiles === 1 && !/tile/.test(s.id)));
  const dark = (s) => Buffer.from(s.dataUrl.split(',')[1], 'base64'), a = tall.find(s => s.id === 'desktop-1280-light-tile-1'), b = tall.find(s => s.id === 'desktop-1280-dark-tile-1');
  assert.notDeepEqual(dark(a), dark(b), 'the dark theme is a different picture');
  assert.equal((await render.views(page(7000), ['light'])).length, 6, 'one theme is half the views');
});

test('a judge that breaks its JSON is asked again up to three times, records each retry, and otherwise refuses without a score', async (t) => {
  if (!findBrowser()) return t.skip('no Chrome or Chromium');
  const { dir, env, run } = await lab(t, []);
  env.FD_JUDGE_BAD = '2'; // the first two answers are cut off mid-JSON, the third is whole
  const out = join(dir, 'retry.html');
  const { made } = await run('make', 'A notes app for Umer', '--out', out, '--options', '1');
  const c = made.files[0].critique;
  assert.equal(c.score, 6);
  assert.deepEqual(c.judge_retries.map(r => r.attempt), [1, 2]);
  assert.ok(c.judge_retries.every(r => /^invalid JSON: /.test(r.error)));
  assert.equal(readFileSync(join(dir, 'judge-calls.jsonl'), 'utf8').trim().split('\n').length, 3);

  env.FD_JUDGE_BAD = '6'; // the three calls so far are counted: the next three answers are broken: JUDGE_FAILED, nothing written
  const judged = join(dir, 'refused.html');
  await assert.rejects(run('make', 'A notes app for Umer', '--out', judged, '--options', '1'), e => {
    const { error } = JSON.parse(e.stdout);
    assert.equal(error.code, 'JUDGE_FAILED');
    assert.match(error.message, /byokit:codex \(gpt-6\.1-sol\) gave no usable judge_designs answer in 3 attempts, so nothing was scored: 1: invalid JSON.*\| 2: .*\| 3: .*cut off.*Re-run the command.*codex login/s);
    return true;
  });
  assert.equal(existsSync(judged), false);
  assert.equal(existsSync(join(dir, 'refused-1.html')), false);
  assert.equal(existsSync(join(dir, 'refused.critic')), false);
});
