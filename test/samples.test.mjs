// The sample check (scripts/check-samples.mjs, run in CI and before the Pages deploy) on throwaway copies of the README and landing
// page: the 2026-10-20 Fieldnotes picture as it shipped (a refine proof on MiniMax Flash, no critic score, no model named) is refused
// with each reason; a picture from a fresh make run that passed the critic, reviewed and with its model named on both pages passes; the
// same picture 40 days on is refused as stale; pages with no picture pass, and an entry no page shows is refused.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

const CHECK = new URL('../scripts/check-samples.mjs', import.meta.url).pathname;
const site = (dir, { readme, landing, samples }) => {
  mkdirSync(join(dir, 'docs/media'), { recursive: true });
  writeFileSync(join(dir, 'README.md'), readme);
  writeFileSync(join(dir, 'docs/index.html'), landing);
  if (samples) writeFileSync(join(dir, 'docs/media/samples.json'), JSON.stringify(samples));
  return promisify(execFile)(process.execPath, [CHECK, dir]).then(({ stdout }) => ({ ok: true, out: stdout }), (e) => ({ ok: false, out: e.stderr }));
};
const days = (n) => new Date(Date.now() - n * 864e5).toISOString();
const good = (at) => ({ studio: { command: 'make', agent: 'byokit:claude', model: 'claude-sonnet-5-5', made_at: at, option: 'notes-1.html', critique: { score: 9, passed: true, plain_score: 7 }, reviewed_by: 'Main' } });
const named = { readme: '<img src="docs/media/studio.webp"> Made by claude-sonnet-5-5.', landing: '<picture><source srcset="media/studio-dark.webp"><img src="media/studio.webp"></picture><p>claude-sonnet-5-5</p>' };

test('README and landing samples must come from a fresh, critic-passed, reviewed make run that names its model', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-samples-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const fieldnotes = await site(join(dir, 'fieldnotes'), { readme: '<img src="docs/media/studio.webp"> The screenshots show one real run, unedited.', landing: '<img src="media/studio.webp">',
    samples: { studio: { command: 'refine', agent: 'byokit:minimax:key', model: 'MiniMax-M3.1-Flash-Preview', made_at: '2026-10-20T10:00:00Z', option: 'compact-warm.html', reviewed_by: '' } } });
  assert.equal(fieldnotes.ok, false);
  for (const why of [/made by "refine"; a sample shows a make or redesign run/, /the critic's score is missing/, /reviewed_by is empty/, /README\.md does not name the model MiniMax-M3\.1-Flash-Preview/, /docs\/index\.html does not name the model/]) assert.match(fieldnotes.out, why);
  assert.match((await site(join(dir, 'unlisted'), { ...named })).out, /media\/studio \(README\.md, docs\/index\.html\): no entry in docs\/media\/samples\.json/);

  const fresh = await site(join(dir, 'fresh'), { ...named, samples: good(days(1)) });
  assert.equal(fresh.ok, true, fresh.out);
  assert.match(fresh.out, /1 sample\(s\) shown/);
  assert.match((await site(join(dir, 'stale'), { ...named, samples: good(days(40)) })).out, /its run is 40 days old \(at most 30\)/);
  assert.match((await site(join(dir, 'below'), { ...named, samples: { studio: { ...good(days(1)).studio, critique: { score: 9, passed: true, plain_score: 10 } } } })).out, /score is 9 against the plain page's 10/);

  assert.equal((await site(join(dir, 'none'), { readme: '# first-draft', landing: '<h1>first-draft</h1>' })).ok, true);
  assert.match((await site(join(dir, 'orphan'), { readme: '# first-draft', landing: '<h1>first-draft</h1>', samples: good(days(1)) })).out, /studio is shown on no page; remove its entry/);
});
