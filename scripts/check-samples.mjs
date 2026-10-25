// The design samples the README and the landing page show must be real, recent, judged work: each picture under docs/media has an
// entry in docs/media/samples.json naming the make or redesign run it shows (its model, route and time), the critic's score of that
// option (9 or more, no lower than the plain page of the same brief) and who reviewed it; the run is at most MAX_DAYS old, and the page
// that shows it names its model. A dark twin (name-dark.webp) shares its light picture's entry. Run in CI and before the Pages deploy:
// node scripts/check-samples.mjs [repo root]. With no picture under docs/media the check passes: no sample is shown.
//
// Two retained stripped-engine options that self-score 8 and 7 are shown as the README hero: a reviewed sample, not a critic pass. The
// reviewer, review date and note, and every source identity, are pinned HERE and not in samples.json, so editing the manifest alone can
// never admit a below-9 picture; any other picture still needs a critic pass at 9 or more. See the README hero section in docs/quality.md.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MAX_DAYS = 30;
const REVIEWED = {
  reviewed_by: 'Main',
  reviewed_at: '2026-10-25',
  review_note: 'reviewed sample, Sonnet 5.5, 24 Oct 2026, score 8/10',
  sources: [
    { name: 'Parley Books', run: 'strip-landing', sha256: '0d426a173f11b1d74fab665de5a211ec12382c26dfcc5638d2c089ff2a970c56', score: 8, seconds: 176 },
    { name: 'Margin', run: 'strip2-notes', sha256: '20eb800aaddc9b5af584e62aa841c11dfca6175560123fb2a36d80cad56cf36e', score: 7, seconds: 278 },
  ],
};
const REVIEWED_KEYS = new Set(['reviewed-pair', 'reviewed-pair-phone']);

const root = process.argv[2] ?? new URL('..', import.meta.url).pathname;
const PAGES = ['README.md', 'docs/index.html'];
const PICTURE = /(?:docs\/)?media\/([\w.-]+?)(-dark)?\.(webp|png|jpe?g|gif|avif|mp4|webm)\b/g;
const manifest = join(root, 'docs/media/samples.json');
const shown = new Map(); // entry name -> the pages that show it
for (const page of PAGES) for (const [, name] of readFileSync(join(root, page), 'utf8').matchAll(PICTURE)) shown.set(name, new Set([...(shown.get(name) ?? []), page]));
const samples = existsSync(manifest) ? JSON.parse(readFileSync(manifest, 'utf8')) : {};
const problems = [];
const now = Date.now();

// A below-9 picture is admissible only for the reviewed keys, and only when its manifest entry repeats the pinned review and sources exactly.
const reviewedProblems = (s, where) => {
  const found = [];
  if (s.reviewed_by !== REVIEWED.reviewed_by) found.push(`${where}: reviewed_by must be ${REVIEWED.reviewed_by} for this reviewed sample, not ${JSON.stringify(s.reviewed_by)}`);
  if (s.reviewed_at !== REVIEWED.reviewed_at || s.review_note !== REVIEWED.review_note) found.push(`${where}: the review must repeat the recorded reviewer, date and note exactly; it names ${JSON.stringify(s.reviewed_at)} with ${JSON.stringify(s.review_note)}`);
  const sources = s.sources;
  if (!Array.isArray(sources) || sources.length !== REVIEWED.sources.length) { found.push(`${where}: the reviewed hero shows exactly ${REVIEWED.sources.length} source runs`); return found; }
  for (const want of REVIEWED.sources) {
    const got = sources.find((x) => x?.name === want.name);
    if (!got) { found.push(`${where}: the reviewed source ${want.name} is missing; only the reviewed two may be shown`); continue; }
    for (const [field, value] of [['run', want.run], ['sha256', want.sha256], ['seconds', want.seconds]]) if (got[field] !== value) found.push(`${where}: ${want.name} ${field} is ${JSON.stringify(got[field])}, not the recorded ${JSON.stringify(value)}`);
    const c = got.critique ?? {};
    if (c.score !== want.score || c.passed !== false) found.push(`${where}: ${want.name} critic score must stay ${want.score} and unpassed, not ${JSON.stringify(c.score)}/${JSON.stringify(c.passed)}`);
    if (c.plain_score !== null) found.push(`${where}: ${want.name} has no numeric plain-prompt baseline in its run; plain_score must be null, not ${JSON.stringify(c.plain_score)}`);
    if (got.model !== s.model) found.push(`${where}: ${want.name} model ${JSON.stringify(got.model)} is not the entry's ${JSON.stringify(s.model)}`);
  }
  for (const got of sources) if (!REVIEWED.sources.some((want) => want.name === got?.name)) found.push(`${where}: ${JSON.stringify(got?.name)} is not one of the reviewed sources`);
  return found;
};

for (const [name, pages] of shown) {
  const s = samples[name], where = `media/${name} (${[...pages].join(', ')})`;
  if (!s) { problems.push(`${where}: no entry in docs/media/samples.json; a sample names the run it shows`); continue; }
  if (!['make', 'redesign'].includes(s.command)) problems.push(`${where}: made by ${JSON.stringify(s.command)}; a sample shows a make or redesign run (a refine proof, a fixture or a hand-made page is not one)`);
  if (!s.model?.trim() || !s.agent?.trim()) problems.push(`${where}: names no model and route`);
  const age = (now - Date.parse(s.made_at)) / 864e5;
  if (!(age >= 0)) problems.push(`${where}: made_at ${JSON.stringify(s.made_at)} is not a past ISO time`);
  else if (age > MAX_DAYS) problems.push(`${where}: its run is ${Math.floor(age)} days old (at most ${MAX_DAYS}); make it again on the current engine and judge it again`);
  if (REVIEWED_KEYS.has(name)) {
    problems.push(...reviewedProblems(s, where));
  } else {
    const c = s.critique;
    if (!(Number.isInteger(c?.score) && c.passed === true && c.score >= 9 && c.score >= c.plain_score)) problems.push(`${where}: the critic's score is ${c?.score ?? 'missing'}${c?.plain_score === undefined ? '' : ` against the plain page's ${c.plain_score}`}; a sample passed the critic at 9 or more (the reviewed README hero is the only one shown below it)`);
    if (!s.reviewed_by?.trim()) problems.push(`${where}: reviewed_by is empty; a person reviews a sample before it is shown`);
  }
  for (const page of pages) if (s.model && !readFileSync(join(root, page), 'utf8').includes(s.model)) problems.push(`${where}: ${page} does not name the model ${s.model}`);
}
for (const name of Object.keys(samples)) if (!shown.has(name)) problems.push(`docs/media/samples.json: ${name} is shown on no page; remove its entry`);
if (problems.length) {
  console.error(`check-samples: ${problems.length} problem(s)\n${problems.map((p) => `- ${p}`).join('\n')}`);
  process.exit(1);
}
console.log(`check-samples: ${shown.size} sample(s) shown, each from a judged ${MAX_DAYS}-day-fresh make or redesign run with its model named`);
