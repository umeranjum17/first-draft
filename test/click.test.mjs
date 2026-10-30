// The parts of a clicked option that need no browser: the judge's behaviour verdict is held to its schema, and a drawn option's source is
// written readable beside it. The real press at 390 and 1280 is journeys/click.mjs (Chrome).
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { behaviourProblems } from '../src/judge.mjs';
import { sourceDir, writeSource } from '../src/source.mjs';

test('a behaviour verdict is held to its schema', () => {
  assert.deepEqual(behaviourProblems({ score: 9, reason: 'The filter narrows the list at both widths', defects: [] }), []);
  assert.deepEqual(behaviourProblems({ score: 7, reason: 'The filter narrows the list', defects: ['click-390-after: the reading pane still shows a hidden row'] }), []);
  assert.match(behaviourProblems({})[0], /whole-number score/);
  assert.match(behaviourProblems({ score: 11, reason: 'x', defects: [] })[0], /whole-number score/);
  assert.match(behaviourProblems({ score: 7, reason: 'x', defects: 'none' })[0], /list of text/);
  assert.match(behaviourProblems({ score: 7, reason: 'x', defects: [] })[0], /name its defects/); // under the bar of 9, so it must say why
});

test('a drawn option writes its source readable beside it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fd-source-'));
  try {
    const option = join(dir, 'inbox.html'), stale = join(sourceDir(option), 'old.jsx');
    mkdirSync(sourceDir(option), { recursive: true });
    writeFileSync(stale, 'stale');
    assert.equal(writeSource(option, [['App.jsx', 'function App(){return null}'], ['lib/row.jsx', 'export const row = 1']]), sourceDir(option));
    assert.equal(sourceDir(option), join(dir, 'inbox.source'));
    assert.equal(readFileSync(join(dir, 'inbox.source', 'App.jsx'), 'utf8'), 'function App(){return null}');
    assert.equal(readFileSync(join(dir, 'inbox.source', 'lib', 'row.jsx'), 'utf8'), 'export const row = 1');
    assert.throws(() => readFileSync(stale), /ENOENT/); // a re-run replaces the folder instead of mixing two runs' source
    assert.throws(() => writeSource(option, [['../escape.jsx', 'x']]), /outside the option's source folder/);
    assert.throws(() => writeSource(option, [['/etc/passwd', 'x']]), /outside the option's source folder/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
