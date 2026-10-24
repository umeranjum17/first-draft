// Journey: the human-side taste on the real CLI and the machine's Chrome, against a local stand-in model (no paid call, no key, no login).
// 1. The host checks (src/human-side.mjs) run on two fixture pages of one product, one on the AI side and one on the human side.
// 2. make "a landing page for ..." runs with the critic: the landing review also says which side the page reads as and how many of the
//    nine hero points it meets; the first version reads as the AI side and goes back with the tells, the revision passes.
// The evidence folder ($DONE_DONE_EVIDENCE_ROOT, or the first argument) gets make.json, findings.json, human-side-board.png (both fixture
// pages at 1280 and 390 with the host's findings under each) and steps.json. The critic's answers are the stand-in's: this proves the
// checks, the rubric in the prompt and the report, not a design's quality (the live run is data/fd-human-side-taste/report.html).
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { renderCheck } from '../src/render-check.mjs';
import { standIn, userText } from './fixtures/critic-model.mjs';
import { AI_PAGE, page } from './fixtures/human-side-pages.mjs';

const root = new URL('..', import.meta.url).pathname;
const out = process.env.DONE_DONE_EVIDENCE_ROOT ?? process.argv[2];
if (!out) throw new Error('Give an evidence folder: $DONE_DONE_EVIDENCE_ROOT or the first argument');
mkdirSync(out, { recursive: true });
const dir = mkdtempSync(join(tmpdir(), 'first-draft-human-side-journey-'));
const BRIEF = 'a landing page for a small accounting software company for teams';
const seen = [], server = await standIn(seen, [[8, 5], [9, 5]]);
const render = renderCheck(() => {}, { humanSide: true }), shooter = renderCheck();
try {
  const check = async (html) => (await render.verify(html)).filter((e) => e.source === 'human-side').map((e) => e.message.replace(/^human side, the page at \d+x\d+: /, ''));
  const human = page(), findings = { ai_side_page: await check(AI_PAGE), human_side_page: await check(human) };
  assert.ok(findings.ai_side_page.length >= 5, `the AI-side page fails the checks: ${findings.ai_side_page.join(' | ')}`);
  assert.deepEqual(findings.human_side_page, []);
  writeFileSync(join(out, 'findings.json'), `${JSON.stringify(findings, null, 2)}\n`);

  const env = { ...process.env, CI: 'true', HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir, OPENCODE_API_KEY: 'test-key', FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}` };
  const run = (args) => promisify(execFile)(process.execPath, [join(root, 'src/cli.mjs'), ...args], { env, cwd: dir });
  await run(['init', '--agent', 'byokit:opencode-go', '--model', 'muse-spark-1.3-contributor']);
  const { stdout } = await run(['make', BRIEF, '--out', join(dir, 'landing.html'), '--options', '1']);
  writeFileSync(join(out, 'make.json'), `${JSON.stringify(JSON.parse(stdout), null, 2).replaceAll(dir, '<run>')}\n`);
  const { made } = JSON.parse(stdout), [file] = made.files, c = file.critique;
  assert.deepEqual([c.scores, c.passed, c.ai_side.reads_as_ai, c.hero.met], [[8, 9], true, false, 9]);
  const reviews = seen.filter((b) => b.includes('"review_designs"'));
  assert.equal(reviews.length, 2, 'one critic call a version');
  assert.match(reviews[0], /AI-side tells are: soft pastel on everything.*nine points in order/s);
  const revision = seen.find((b) => !b.includes('"review_designs"') && userText(b)[0]?.includes('The critic scored this design 8/10'));
  assert.match(userText(revision)[0], /reads as the AI side of an AI-versus-human comparison.*Hero points not met: 6\./s);
  assert.match(revision, /# Human side, not AI side/, 'the revision carries the human-side guidance');

  const column = async (title, html, list) => {
    const [desktop, phone] = (await shooter.shoot(html, 1600)).toSorted((a, b) => b.width - a.width);
    return `<section><h2>${title}</h2><div class="pair"><figure><img src="${desktop.dataUrl}" width="440"><figcaption>desktop 1280</figcaption></figure><figure><img src="${phone.dataUrl}" width="140"><figcaption>phone 390</figcaption></figure></div>${list.length ? `<ul>${list.map((f) => `<li>${f.replace(/</g, '&lt;')}</li>`).join('')}</ul>` : '<p>No finding: every host check passes.</p>'}</section>`;
  };
  const board = `<!doctype html><html><head><style>body{margin:0;padding:24px;font:14px/1.4 system-ui,sans-serif;background:#f4f2ee;color:#1d1d1b;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;width:1232px}h2{margin:0 0 10px;font-size:18px}.pair{display:flex;gap:16px;align-items:flex-start}figure{margin:0}img{display:block;border:1px solid #ccc;background:#fff}figcaption{font-size:13px;color:#555}ul{margin:10px 0 0;padding-left:18px}</style></head><body>
${await column('AI side: the same product, tinted and generic', AI_PAGE, findings.ai_side_page)}${await column('Human side: brand colour, pill, one primary, the product as data', human, findings.human_side_page)}</body></html>`;
  const [shot] = (await shooter.shoot(board, 4000)).toSorted((a, b) => b.width - a.width);
  writeFileSync(join(out, 'human-side-board.png'), Buffer.from(shot.dataUrl.slice(shot.dataUrl.indexOf(',') + 1), 'base64'));
  const version = `${JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version} at ${(await promisify(execFile)('git', ['-C', root, 'rev-parse', '--short', 'HEAD'])).stdout.trim()}`;
  writeFileSync(join(out, 'steps.json'), JSON.stringify({ target: { version: `first-draft-axi ${version} (source checkout), the human-side checks and the landing critic, against a local stand-in model` },
    start: 'A throwaway FIRST_DRAFT_HOME set to byokit:opencode-go with a local stand-in for the provider, and the machine\'s Chrome',
    steps: ['Draw two fixture pages of one accounting product in Chrome and run the host\'s human-side checks on each: the AI-side page fails at least five, the human-side page none',
      `Run first-draft-axi make "${BRIEF}" --options 1: the page call carries the human-side guidance`,
      'The critic reviews the version once: it reads as the AI side with five of nine hero points met, so it goes back with the tells and the unmet points',
      'The revision reads as the human side with nine of nine and is written as the option',
      'Draw both fixture pages at 1280 and 390 with the host\'s findings under each (human-side-board.png)'],
    result: 'findings.json lists the AI-side page\'s findings and none for the human-side page; make.json reports the critique with ai_side and hero (scores 8 then 9, passed); human-side-board.png shows the two pages and their findings. The critic\'s answers come from the stand-in model, so this proves the checks and the report, not design quality' }, null, 2));
  console.log(`PASS: the host flagged ${findings.ai_side_page.length} human-side findings on the AI-side page and none on the human-side page; the critic sent the AI-side version back with its tells`);
} finally {
  render.close(); shooter.close();
  server.close();
  rmSync(dir, { recursive: true, force: true });
}
