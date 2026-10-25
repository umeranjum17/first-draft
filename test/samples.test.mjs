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

// The one approved exception: the owner allowed exactly two retained stripped-engine options (self-scored 8 and 7) as the README hero
// on 2026-10-25. The identities are pinned in scripts/check-samples.mjs, so a copied exception label or a third source cannot admit
// anything else below 9, and the ordinary freshness and model-on-page checks still apply.
const parley = { name: 'Parley Books', run: 'strip-landing', option: 'strip-landing/page.html', sha256: '0d426a173f11b1d74fab665de5a211ec12382c26dfcc5638d2c089ff2a970c56', model: 'claude-sonnet-5-5', seconds: 176, exit: 0, head: 'b36f4d3', critique: { score: 8, passed: false, plain_score: null } };
const margin = { name: 'Margin', run: 'strip2-notes', option: 'strip2-notes/page.html', sha256: '20eb800aaddc9b5af584e62aa841c11dfca6175560123fb2a36d80cad56cf36e', model: 'claude-sonnet-5-5', seconds: 278, exit: 0, head: '85f773f', critique: { score: 7, passed: false, plain_score: null } };
const approved = (at) => ({
  command: 'make', agent: 'byokit:claude', model: 'claude-sonnet-5-5', made_at: at, reviewed_by: 'the owner',
  exception: { approved_by: 'the owner', approved_at: '2026-10-25', reason: 'owner-approved README hero: two real retained options shown as-is, below the 9/10 bar, self-scored and labelled' },
  sources: [{ ...parley, critique: { ...parley.critique } }, { ...margin, critique: { ...margin.critique } }],
});
const pairPages = { readme: '<img src="docs/media/reviewed-pair.gif"> Made by claude-sonnet-5-5.', landing: '<picture><img src="media/reviewed-pair-phone-dark.gif"></picture><p>claude-sonnet-5-5</p>' };
const pair = (at, edit = (s) => s) => ({ 'reviewed-pair': edit(approved(at)), 'reviewed-pair-phone': approved(at) });

test('only the pinned two-source hero exception may sit below 9, and every altered identity is refused', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-approved-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const at = days(1);

  const ok = await site(join(dir, 'ok'), { ...pairPages, samples: pair(at) });
  assert.equal(ok.ok, true, ok.out);
  assert.match(ok.out, /2 sample\(s\) shown/);

  const third = await site(join(dir, 'third'), { ...pairPages, samples: pair(at, (s) => ({ ...s, sources: [...s.sources, { ...parley, name: 'Tallyroom', sha256: 'ffff' }] })) });
  assert.equal(third.ok, false);
  assert.match(third.out, /"Tallyroom" is not one of the approved sources|the approved hero shows exactly 2 source runs/);

  const swapped = await site(join(dir, 'swapped'), { ...pairPages, samples: pair(at, (s) => ({ ...s, sources: [{ ...s.sources[0], sha256: 'ffff' }, s.sources[1]] })) });
  assert.match(swapped.out, /Parley Books sha256 is "ffff", not the approved/);

  const rescored = await site(join(dir, 'rescored'), { ...pairPages, samples: pair(at, (s) => ({ ...s, sources: [{ ...s.sources[0], critique: { score: 9, passed: true, plain_score: null } }, s.sources[1]] })) });
  assert.match(rescored.out, /Parley Books critic score must stay 8 and unpassed, not 9\/true/);

  const invented = await site(join(dir, 'invented'), { ...pairPages, samples: pair(at, (s) => ({ ...s, sources: [{ ...s.sources[0], critique: { score: 8, passed: false, plain_score: 5 } }, s.sources[1]] })) });
  assert.match(invented.out, /Parley Books has no numeric plain-prompt baseline in its run; plain_score must be null, not 5/);

  const fake = await site(join(dir, 'fake'), { ...pairPages, samples: { 'reviewed-pair': { ...approved(at), reviewed_by: 'README author' }, 'reviewed-pair-phone': approved(at) } });
  assert.match(fake.out, /reviewed_by must be the owner for the approved exception, not "README author"/);

  const relabelled = await site(join(dir, 'relabelled'), { ...pairPages, samples: { 'reviewed-pair': { ...approved(at), exception: { ...approved(at).exception, reason: 'self-approved' } }, 'reviewed-pair-phone': approved(at) } });
  assert.match(relabelled.out, /the exception must repeat the approved reviewer, date and reason exactly/);

  const ordinary = await site(join(dir, 'ordinary'), { ...named, samples: { studio: { ...approved(at), sources: undefined, critique: { score: 8, passed: false, plain_score: 5 } } } });
  assert.match(ordinary.out, /a sample passed the critic at 9 or more \(the approved README hero is the only exception\)/);

  const stale = await site(join(dir, 'stale'), { ...pairPages, samples: pair(days(40)) });
  assert.match(stale.out, /its run is 40 days old \(at most 30\)/);
});
