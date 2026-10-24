// The critic journey on the built CLI and the machine's Chrome, against a local stand-in for the provider (no paid call, no key):
// make writes an option, the stand-in writes a plain one-prompt page for the same brief, and the critic sees both at 1280 and 390
// and scores them. An option under 9, or under the plain page, goes back to the engine with the critic's gaps and fixes; the
// best-scored version is the option and its score is reported. With no pass after two revisions the best version is kept,
// flagged below the bar; --no-critic and a machine with no browser say that no option was scored.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';
import { findBrowser } from '../src/render-check.mjs';
import { PLAIN, images, standIn, userText } from '../journeys/fixtures/critic-model.mjs';

const CLI = new URL('../src/cli.mjs', import.meta.url).pathname;
const make = async (t, dir, scores, ...more) => {
  const brief = typeof more[0] === 'string' && !more[0].startsWith('--') ? more.shift() : 'A notes app for Umer';
  const seen = [], server = await standIn(seen, scores);
  t.after(() => server.close());
  const env = { ...process.env, CI: 'true', HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir, OPENCODE_API_KEY: 'test-key', FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}` };
  const run = (args) => promisify(execFile)(process.execPath, [CLI, ...args], { env, cwd: dir });
  await run(['init', '--agent', 'byokit:opencode-go', '--model', 'muse-spark-1.3-contributor']);
  const out = join(dir, `notes-${scores.length}.html`);
  return { out, seen, result: JSON.parse((await run(['make', brief, '--out', out, '--options', '1', ...more])).stdout) };
};

test('the critic scores each option against real products and a plain page, and an option under 9 goes back for another round', async (t) => {
  if (!findBrowser()) return t.skip('no Chrome or Chromium on this machine');
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-critic-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  // 6 against the plain page's 7: back to the engine with the critic's reasons; the revision scores 9 and passes.
  const { out, seen, result: { made, help } } = await make(t, dir, [[6, 7], [9, 7]], '--engine');
  const [file] = made.files;
  assert.deepEqual([file.critique.score, file.critique.passed, file.critique.plain_score, file.critique.rounds, file.critique.scores], [9, true, 7, 2, [6, 9]]);
  assert.match(file.critique.judge, /same model/);
  assert.match(readFileSync(out, 'utf8'), /Notes, version 2/, 'the revision that passed is the option');
  assert.equal(made.critic.pass, 9);
  assert.equal(readFileSync(made.critic.plain, 'utf8'), PLAIN, 'the plain page is kept beside the options for comparison');
  assert.match(made.critic.plain, /notes-2\.critic\/plain\.html$/);
  const asked = seen.filter((b) => b.includes('"review_designs"'));
  assert.equal(asked.length, 2);
  assert.equal(images(asked[0]), 4, 'the critic saw the option and the plain page at 1280 and 390');
  assert.match(asked[0], /Linear, Stripe, Vercel, Notion and Raycast/);
  assert.equal(seen.filter((b) => b.includes('"write_page"')).length, 1, 'one plain page per make');
  const revision = seen.find((b) => !b.includes('"review_designs"') && userText(b)[0]?.includes('The critic scored this design 6/10'));
  assert.ok(revision, 'the engine was sent the critic\'s score');
  assert.match(userText(revision)[0], /plain one-prompt page for the same brief scored 7.*version 1: the hero has no picture.*Give version 1 a real hero picture/s);
  assert.ok(!help.some((h) => /below the bar/.test(h)));

  // Never 9: two revisions, then the best version (the second, 8) is the option, flagged below the bar.
  const low = await make(t, dir, [[5, 7], [8, 7], [7, 7]], '--engine');
  const flagged = low.result.made.files[0];
  assert.deepEqual([flagged.critique.score, flagged.critique.passed, flagged.critique.rounds, flagged.critique.scores], [8, false, 3, [5, 8, 7]]);
  assert.match(readFileSync(low.out, 'utf8'), /Notes, version 2/, 'the best-scored version is kept');
  assert.match(low.result.help.find((h) => /below the bar/.test(h)), /notes-3\.html scored 8\/10 \(plain page 7; 9 needed\) after 3 review\(s\).*never show one as finished/);

  // --no-critic: no plain page, no review, and the output says nothing was scored.
  const off = await make(t, dir, [[1, 1], [1, 1], [1, 1], [1, 1]], '--no-critic', '--engine');
  assert.equal(off.seen.filter((b) => b.includes('"review_designs"') || b.includes('"write_page"')).length, 0);
  assert.equal(off.result.made.files[0].critique, undefined);
  assert.match(off.result.made.critic.off, /--no-critic/);
  assert.match(off.result.help.find((h) => /critic was off/.test(h)), /no option was scored against the references/);
  assert.equal(existsSync(join(dir, 'notes-4.critic')), false);
});

// The default make writes the page from one call, so the critic's revision is the same call with the version it scored.
test('the critic revises the default one-call page from a seed: the scored version goes back with its gaps and the revision is the option', async (t) => {
  if (!findBrowser()) return t.skip('no Chrome or Chromium on this machine');
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-critic-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const { out, seen, result: { made } } = await make(t, dir, [[6, 7], [9, 7]]);
  const [file] = made.files;
  assert.deepEqual([file.critique.score, file.critique.passed, file.critique.scores], [9, true, [6, 9]]);
  assert.match(readFileSync(out, 'utf8'), /Notes, version 2/);
  assert.equal(file.turns, 1, 'one call per version, not an engine loop');
  const revision = seen.find((b) => !b.includes('"review_designs"') && userText(b)[0]?.includes('The critic scored this design 6/10'));
  assert.ok(revision, 'the page call was sent the critic\'s score');
  assert.match(userText(revision)[0], /Notes, version 1/, 'with the version it scored');
  assert.equal(JSON.parse(revision).tools, undefined);
});

// A company, product or landing page is also asked which side it reads as and how its hero meets the nine points, in the same review.
test('the critic asks a landing page which side it reads as and for its nine hero points; one that reads as the AI side goes back with the tells', async (t) => {
  if (!findBrowser()) return t.skip('no Chrome or Chromium on this machine');
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-critic-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const { seen, result: { made } } = await make(t, dir, [[8, 5], [9, 5]], 'a landing page for a small accounting software company for teams');
  const [file] = made.files;
  assert.deepEqual([file.critique.score, file.critique.passed, file.critique.scores], [9, true, [8, 9]]);
  assert.deepEqual([file.critique.ai_side.reads_as_ai, file.critique.hero.met, file.critique.hero.of, file.critique.hero.points.length], [false, 9, 9, 9], 'the kept version is the human side with every point met');
  const asked = seen.filter((b) => b.includes('"review_designs"'));
  assert.equal(asked.length, 2, 'one critic call per version, no second pass');
  assert.match(asked[0], /AI-side tells are: soft pastel on everything.*nine points in order.*a small indicator pill above the title/s);
  const revision = seen.find((b) => !b.includes('"review_designs"') && userText(b)[0]?.includes('The critic scored this design 8/10'));
  assert.ok(revision, 'the page call was sent the critic\'s score');
  assert.match(userText(revision)[0], /reads as the AI side of an AI-versus-human comparison: version 1: soft pastel on every section and a card grid after a card grid.*Hero points not met: 6\. subtext naming the main features and the audience: version 1: point 6 is missing/s);
  // The human-side guidance rides in the page call's system prompt for a landing page, the revision included, and for no other brief.
  const system = (b) => b; // the request body holds the system prompt
  assert.match(system(revision), /# Human side, not AI side[\s\S]*nine-point hero/);
  assert.match(system(revision), /one bold brand colour and one accent/);
  const notes = await make(t, dir, [[9, 7]]);
  assert.equal(notes.result.made.files[0].critique.ai_side, undefined, 'a notes app is not asked');
  assert.doesNotMatch(notes.seen.map(system).join('\n'), /Human side, not AI side/);
  assert.doesNotMatch(notes.seen.filter((b) => b.includes('"review_designs"')).join('\n'), /ai_side/);
});

// Even at 10, a page that says it reads as the AI side does not pass.
test('a landing page the critic says reads as the AI side does not pass at 9', async (t) => {
  if (!findBrowser()) return t.skip('no Chrome or Chromium on this machine');
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-critic-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const { result: { made } } = await make(t, dir, [[8, 5], [8, 5], [8, 5]], 'a landing page for a small accounting software company for teams');
  const [file] = made.files;
  assert.deepEqual([file.critique.passed, file.critique.ai_side.reads_as_ai, file.critique.rounds], [false, true, 3]);
});
