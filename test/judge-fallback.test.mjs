// The critic never ends a make by itself failing: one more try on the same engine, then the next signed-in judge, every failure on record.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { judgeWithFallback, fallbackNote } from '../src/judge-fallback.mjs';

const codex = { agent: 'byokit:codex', model: 'gpt-6.1-sol' };
const opus = { agent: 'byokit:claude', model: 'claude-opus-5-5' };
const chainOf = (...js) => js.map((j) => ({ ...j, open: async () => j }));
const failing = (failures) => async (c) => {
  const f = failures[`${c.agent}`]?.shift();
  if (f) throw f;
  return { verdict: `by ${c.model}` };
};
const generator = { agent: 'byokit:claude', model: 'claude-opus-5-5' };

test('a judge that works is used with no fallback note', async () => {
  const r = await judgeWithFallback(chainOf(codex, opus), failing({}));
  assert.deepEqual([r.by, r.failures, await fallbackNote(codex, generator, r)], [codex, [], undefined]);
});

test('the primary engine throws once: it is retried, and the verdict is still its own', async () => {
  const r = await judgeWithFallback(chainOf(codex, opus), failing({ 'byokit:codex': [new Error('spawn codex ENOENT')] }));
  assert.deepEqual(r.by, codex);
  assert.deepEqual(r.failures.map((f) => [f.model, f.attempt, f.error]), [['gpt-6.1-sol', 1, 'spawn codex ENOENT']]);
  const note = await fallbackNote(codex, generator, r);
  assert.equal(note.used, false);
  assert.match(note.summary, /gpt-6.1-sol \(byokit:codex\) gave the verdict after a retry.*spawn codex ENOENT/);
});

test('the primary engine cancels twice: the Opus fallback gives the verdict, and the output names both', async () => {
  const cancelled = () => Object.assign(new Error('The answer was cancelled.'), { code: 'aborted' });
  const calls = [];
  const r = await judgeWithFallback(chainOf(codex, opus), async (c) => { calls.push(c.model); return failing({ 'byokit:codex': [cancelled(), cancelled()] })(c); });
  assert.deepEqual(calls, ['gpt-6.1-sol', 'gpt-6.1-sol', 'claude-opus-5-5']);
  assert.deepEqual(r.by, opus);
  const note = await fallbackNote(codex, generator, r);
  assert.deepEqual([note.used, note.verdict_by, note.configured, note.independent_of_generator], [true, opus, codex, false]);
  assert.match(note.summary, /claude-opus-5-5 \(byokit:claude\) gave the verdict because the configured judge failed.*gpt-6.1-sol \(byokit:codex\) try 2: The answer was cancelled\./);
  assert.match(note.summary, /not independent/);
});

test('the primary engine returns invalid JSON: that is a failure to fall back from, never a pass', async () => {
  const bad = () => new Error('byokit:codex (gpt-6.1-sol) gave no usable judge_designs answer in 3 attempts, so nothing was scored: 1: invalid JSON: Unexpected end of JSON input');
  const r = await judgeWithFallback(chainOf(codex, opus), failing({ 'byokit:codex': [bad(), bad()] }));
  assert.equal(r.value.verdict, 'by claude-opus-5-5');
  assert.equal(r.failures.length, 2);
  assert.ok(r.failures.every((f) => f.model === 'gpt-6.1-sol' && /invalid JSON/.test(f.error)));
});

test('a fallback that is not signed in is recorded and the next judge is tried', async () => {
  const chain = [{ ...codex, open: async () => { throw new Error('codex is not signed in'); } }, { ...opus, open: async () => { throw new Error('Claude must be signed in with a Claude subscription'); } }, { agent: 'byokit:codex', model: 'gpt-6.2', open: async () => ({ agent: 'byokit:codex', model: 'gpt-6.2' }) }];
  const r = await judgeWithFallback(chain, async (c) => ({ verdict: c.model }));
  assert.equal(r.value.verdict, 'gpt-6.2');
  assert.deepEqual(r.failures.map((f) => f.error), ['codex is not signed in', 'codex is not signed in', 'Claude must be signed in with a Claude subscription']);
});

test('every judge fails: a typed error names each engine\'s error, and nothing is scored', async () => {
  await assert.rejects(judgeWithFallback(chainOf(codex, opus, { agent: 'byokit:claude', model: 'claude-sonnet-5-5' }), async (c) => { throw new Error(`${c.model} down`); }), (e) => {
    assert.equal(e.code, 'JUDGE_ALL_FAILED');
    assert.match(e.message, /every judge failed, so nothing was scored/);
    assert.match(e.message, /gpt-6.1-sol \(byokit:codex\): gpt-6.1-sol down \| gpt-6.1-sol down; claude-opus-5-5 \(byokit:claude\): claude-opus-5-5 down; claude-sonnet-5-5 \(byokit:claude\): claude-sonnet-5-5 down/);
    assert.equal(e.failures.length, 4);
    return true;
  });
});
