// The design samples the README and the landing page show must be real, recent, judged work: each picture under docs/media has an
// entry in docs/media/samples.json naming the make or redesign run it shows (its model, route and time), the critic's score of that
// option (9 or more, no lower than the plain page of the same brief) and who reviewed it; the run is at most MAX_DAYS old, and the page
// that shows it names its model. A dark twin (name-dark.webp) shares its light picture's entry. Run in CI and before the Pages deploy:
// node scripts/check-samples.mjs [repo root]. With no picture under docs/media the check passes: no sample is shown.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MAX_DAYS = 30;
const root = process.argv[2] ?? new URL('..', import.meta.url).pathname;
const PAGES = ['README.md', 'docs/index.html'];
const PICTURE = /(?:docs\/)?media\/([\w.-]+?)(-dark)?\.(webp|png|jpe?g|gif|avif|mp4|webm)\b/g;
const manifest = join(root, 'docs/media/samples.json');
const shown = new Map(); // entry name -> the pages that show it
for (const page of PAGES) for (const [, name] of readFileSync(join(root, page), 'utf8').matchAll(PICTURE)) shown.set(name, new Set([...(shown.get(name) ?? []), page]));
const samples = existsSync(manifest) ? JSON.parse(readFileSync(manifest, 'utf8')) : {};
const problems = [];
const now = Date.now();
for (const [name, pages] of shown) {
  const s = samples[name], where = `media/${name} (${[...pages].join(', ')})`;
  if (!s) { problems.push(`${where}: no entry in docs/media/samples.json; a sample names the run it shows`); continue; }
  if (!['make', 'redesign'].includes(s.command)) problems.push(`${where}: made by ${JSON.stringify(s.command)}; a sample shows a make or redesign run (a refine proof, a fixture or a hand-made page is not one)`);
  if (!s.model?.trim() || !s.agent?.trim()) problems.push(`${where}: names no model and route`);
  const age = (now - Date.parse(s.made_at)) / 864e5;
  if (!(age >= 0)) problems.push(`${where}: made_at ${JSON.stringify(s.made_at)} is not a past ISO time`);
  else if (age > MAX_DAYS) problems.push(`${where}: its run is ${Math.floor(age)} days old (at most ${MAX_DAYS}); make it again on the current engine and judge it again`);
  const c = s.critique;
  if (!(Number.isInteger(c?.score) && c.passed === true && c.score >= 9 && c.score >= c.plain_score)) problems.push(`${where}: the critic's score is ${c?.score ?? 'missing'}${c?.plain_score === undefined ? '' : ` against the plain page's ${c.plain_score}`}; a sample passed the critic at 9 or more`);
  if (!s.reviewed_by?.trim()) problems.push(`${where}: reviewed_by is empty; a person reviews a sample before it is shown`);
  for (const page of pages) if (s.model && !readFileSync(join(root, page), 'utf8').includes(s.model)) problems.push(`${where}: ${page} does not name the model ${s.model}`);
}
for (const name of Object.keys(samples)) if (!shown.has(name)) problems.push(`docs/media/samples.json: ${name} is shown on no page; remove its entry`);
if (problems.length) {
  console.error(`check-samples: ${problems.length} problem(s)\n${problems.map((p) => `- ${p}`).join('\n')}`);
  process.exit(1);
}
console.log(`check-samples: ${shown.size} sample(s) shown, each from a judged ${MAX_DAYS}-day-fresh make or redesign run with its model named`);
