// Journey: make's critic on the real CLI and the machine's Chrome, against a local stand-in model (no paid call, no key, no login).
// make "A notes app for Umer" writes one option; the stand-in writes the plain one-prompt page and scores the first version 6 against
// the plain page's 7, so the option goes back to the engine with the critic's gaps and fixes; its revision scores 9 and is the file.
// The evidence folder ($DONE_DONE_EVIDENCE_ROOT, or the first argument) gets make.json (the CLI's output), critic-board.png (the
// option and the plain page, each at 1280 and 390, with the score, the plain page's score, the model and the run time under each)
// and steps.json. The scores are the stand-in's: this proves the loop and the report, not a design's quality.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { promisify } from 'node:util';
import { renderCheck } from '../src/render-check.mjs';
import { standIn } from './fixtures/critic-model.mjs';

const root = new URL('..', import.meta.url).pathname;
const out = process.env.DONE_DONE_EVIDENCE_ROOT ?? process.argv[2];
if (!out) throw new Error('Give an evidence folder: $DONE_DONE_EVIDENCE_ROOT or the first argument');
mkdirSync(out, { recursive: true });
const dir = mkdtempSync(join(tmpdir(), 'first-draft-critic-journey-'));
const seen = [], server = await standIn(seen, [[6, 7], [9, 7]]);
const render = renderCheck();
try {
  const env = { ...process.env, CI: 'true', HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir, OPENCODE_API_KEY: 'test-key', FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}` };
  const run = (args) => promisify(execFile)(process.execPath, [join(root, 'src/cli.mjs'), ...args], { env, cwd: dir });
  await run(['init', '--agent', 'byokit:opencode-go', '--model', 'muse-spark-1.3-contributor']);
  const { stdout } = await run(['make', 'A notes app for Umer', '--out', join(dir, 'notes.html'), '--options', '1']);
  writeFileSync(join(out, 'make.json'), `${JSON.stringify(JSON.parse(stdout), null, 2).replaceAll(dir, '<run>')}\n`);
  const { made } = JSON.parse(stdout), [file] = made.files;
  assert.ok(made.critic?.plain, `the critic ran: ${JSON.stringify(made.critic)}`);
  assert.deepEqual([file.critique.scores, file.critique.passed, file.critique.plain_score], [[6, 9], true, 7]);
  assert.equal(seen.filter((b) => b.includes('"review_designs"')).length, 2);
  // The board: each page as the critic saw it, with what the report says under it.
  const column = async (title, html, caption) => {
    const [desktop, phone] = (await render.shoot(html, 1600)).toSorted((a, b) => b.width - a.width);
    return `<section><h2>${title}</h2><div class="pair"><figure><img src="${desktop.dataUrl}" width="640"><figcaption>desktop 1280</figcaption></figure><figure><img src="${phone.dataUrl}" width="195"><figcaption>phone 390</figcaption></figure></div><p>${caption}</p></section>`;
  };
  const under = `model ${made.model} (local stand-in) · run ${made.seconds} s`;
  const board = `<!doctype html><html><head><style>body{margin:0;padding:24px;font:15px/1.4 system-ui,sans-serif;background:#f4f2ee;color:#1d1d1b}section{margin-bottom:28px}h2{margin:0 0 10px;font-size:18px}.pair{display:flex;gap:16px;align-items:flex-start}figure{margin:0}img{display:block;border:1px solid #ccc;background:#fff}figcaption{font-size:13px;color:#555}p{margin:8px 0 0}</style></head><body>
${await column(`Option: ${basename(file.file)}`, readFileSync(file.file, 'utf8'), `critic score ${file.critique.score}/10 (rounds ${file.critique.scores.join(' → ')}, passed: ${file.critique.passed}) · ${under}`)}
${await column('Plain one-prompt page, same brief', readFileSync(made.critic.plain, 'utf8'), `critic score ${file.critique.plain_score}/10 · ${under}`)}
</body></html>`;
  const [shot] = (await render.shoot(board, 4000)).toSorted((a, b) => b.width - a.width);
  writeFileSync(join(out, 'critic-board.png'), Buffer.from(shot.dataUrl.slice(shot.dataUrl.indexOf(',') + 1), 'base64'));
  const version = `${JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version} at ${(await promisify(execFile)('git', ['-C', root, 'rev-parse', '--short', 'HEAD'])).stdout.trim()}`;
  writeFileSync(join(out, 'steps.json'), JSON.stringify({ target: { version: `first-draft-axi ${version} (source checkout), make with its critic, against a local stand-in model` },
    start: 'A throwaway FIRST_DRAFT_HOME set to byokit:opencode-go with a local stand-in for the provider, and the machine\'s Chrome',
    steps: ['Run first-draft-axi make "A notes app for Umer" --options 1: the engine writes version 1 of the option',
      'The critic gets a plain one-prompt page for the same brief, sees both at 1280 and 390 and scores 6 against the plain page\'s 7',
      'The option goes back to the engine with the critic\'s gaps and fixes; the revision scores 9 and is written as the option',
      'Draw the option and the plain page side by side at 1280 and 390 with each score, the model and the run time (critic-board.png)'],
    result: 'make.json reports the option\'s critique (scores 6 then 9, passed, plain page 7) and the plain page\'s file; critic-board.png shows the option (version 2) beside the plain page with their scores. The scores come from the stand-in model, so this proves the review loop and the report, not design quality' }, null, 2));
  console.log('PASS: the critic scored the option against the plain page, sent the 6 back, and kept the revision that scored 9');
} finally {
  render.close();
  server.close();
  rmSync(dir, { recursive: true, force: true });
}
