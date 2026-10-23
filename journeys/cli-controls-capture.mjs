// Capture-only recovery, explicitly reusing approved retained generation outputs (never regenerates).
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const out = process.env.DONE_DONE_EVIDENCE_ROOT, retained = process.env.FD_CONTROLS_RETAINED;
assert.ok(out && retained, 'Set FD_CONTROLS_RETAINED to the approved retained cli-controls run and use done-done');
const root = resolve(import.meta.dirname, '..'), work = mkdtempSync(join(tmpdir(), 'fdc-shot-'));
const env = { ...process.env, FIRST_DRAFT_HOME: join(work, 'config'), CHROME_DEVTOOLS_AXI_SESSION: `fd-controls-recapture-${process.pid}`, CHROME_DEVTOOLS_AXI_USER_DATA_DIR: join(work, 'browser') };
const run = (bin, args) => execFileSync(bin, args, { env, encoding: 'utf8', timeout: 60_000 });
let view;
try {
  const provenance = [];
  for (const n of [1, 3, 5]) {
    const result = JSON.parse(readFileSync(join(retained, `make-${n}.json`)));
    assert.equal(result.made.files.length, n);
    assert.equal(result.made.render_check, 'checked');
    for (const file of result.made.files) {
      const bytes = readFileSync(file.file);
      assert.equal(bytes.length, file.bytes);
      provenance.push({ options: n, file: `options-${n}/${file.file.split('/').at(-1)}`, sha256: createHash('sha256').update(bytes).digest('hex'), source: file.source, turns: file.turns });
    }
  }
  writeFileSync(join(out, 'retained-generation.json'), JSON.stringify({ retainedRun: retained.split('/').at(-1), regenerated: false, note: 'Approved capture-only recovery; the original installed-CLI run completed all three make commands before chrome-devtools-axi wait failed.', files: provenance }, null, 2));
  view = spawn(process.execPath, [join(root, 'src/cli.mjs'), 'view', join(retained, 'options-5'), '--host', '127.0.0.1', '--port', '0'], { env, stdio: ['ignore', 'pipe', 'inherit'] });
  const line = await new Promise((ok, no) => {
    let text = '';
    view.stdout.on('data', (data) => { text += data; if (text.includes('\n')) ok(text.split('\n')[0]); });
    view.once('error', no); view.once('exit', (code) => no(new Error(`view exited ${code}`)));
  });
  const viewing = JSON.parse(line).viewing;
  assert.equal(viewing.options.length, 5);
  run('chrome-devtools-axi', ['open', viewing.url]);
  run('chrome-devtools-axi', ['resize', '1280', '900']);
  run('sleep', ['1.5']);
  run('chrome-devtools-axi', ['screenshot', join(out, 'five-options.png')]);
  run('chrome-devtools-axi', ['open', `${viewing.url}#/o/1/play`]);
  run('sleep', ['1.5']);
  run('chrome-devtools-axi', ['screenshot', join(out, 'option-play.png')]);
  writeFileSync(join(out, 'steps.json'), JSON.stringify({ target: { version: JSON.parse(readFileSync(join(root, 'package.json'))).version }, start: 'Nine retained real MiniMax outputs from the approved installed-CLI run; no regeneration', steps: ['verify 1/3/5 output counts, byte lengths and render-check results', 'hash retained source files and record their original run id', 'start the real viewer on five retained outputs', 'open the grid, then Play; take fresh screenshots after plain sleep'], result: 'Five generated options are visible in the current viewer; an option opens in Play. Earlier generation and clean-install evidence are retained, not relabeled as new runs.' }, null, 2));
} finally {
  view?.kill();
  try { run('chrome-devtools-axi', ['stop']); } catch { /* no browser if startup failed */ }
  rmSync(work, { recursive: true, force: true });
}
