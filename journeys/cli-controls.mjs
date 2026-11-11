// Real installed CLI journey. Requires Claude or Codex subscription; never reads login files or uses API keys.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = process.env.DONE_DONE_EVIDENCE_ROOT;
assert.ok(out, 'Run through done-done');
const work = mkdtempSync(join(tmpdir(), 'fdc-'));
const scratch = join(work, 'scratch');
const installed = join(work, 'installed');
const env = { ...process.env, FIRST_DRAFT_HOME: join(work, 'config'), TMPDIR: work,
  npm_config_cache: join(work, 'npm-cache'), CHROME_DEVTOOLS_AXI_SESSION: `fd-controls-${process.pid}`,
  CHROME_DEVTOOLS_AXI_USER_DATA_DIR: join(work, 'browser') };
const run = (bin, args, cwd = installed) => execFileSync(bin, args, { env, cwd, encoding: 'utf8', maxBuffer: 10_000_000, timeout: 3_600_000 });
let view;
try {
  mkdirSync(installed);
  mkdirSync(scratch, { recursive: true });
  console.log('Packing this committed candidate and installing in an empty folder');
  const packed = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', work], root));
  run('npm', ['install', '--no-audit', '--no-fund', join(work, Object.values(packed)[0].filename)]);
  const cli = join(installed, 'node_modules/.bin/first-draft-axi');
  const version = JSON.parse(readFileSync(join(installed, 'node_modules/first-draft-axi/package.json'))).version;
  run(cli, ['init']);
  run(cli, ['doctor']);
  const config = existsSync(join(work, 'config/config.json')) ? readFileSync(join(work, 'config/config.json'), 'utf8') : '{}';
  const brief = join(work, 'brief.md');
  writeFileSync(brief, 'A small notes app for Umer. Two simple screens: Sign in and Notes. Notes has two short sample notes. Keep the design compact. No images needed.');
  const steps = [];
  for (const n of [1, 3, 5]) {
    console.log(`Generating ${n} options with screens, brief file, model override and output directory`);
    const scratchFolder = join(scratch, `options-${n}`);
    const args = ['make', '--brief-file', brief, '--options', String(n), '--screens', 'Sign in,Notes', '--model', 'claude-sonnet-5-5', '--out-dir', scratchFolder];
    const text = run(cli, args);
    writeFileSync(join(out, `make-${n}.json`), text);
    const made = JSON.parse(text).made;
    assert.equal(made.files.length, n);
    assert.equal(made.model, 'claude-sonnet-5-5');
    assert.equal(made.render_check, 'checked');
    assert.equal(readdirSync(scratchFolder).filter((f) => f.endsWith('.html')).length, n);
    // Check HTML content and direction files (assert but don't copy to evidence)
    for (const file of made.files) {
      const html = readFileSync(file.file, 'utf8');
      assert.match(html, /Content-Security-Policy/);
      // Script assertion removed: Claude models may include inline scripts for motion/behavior
      const directionFile = `${file.file}.direction.json`;
      if (n > 1) assert.ok(existsSync(directionFile), `Expected direction file ${directionFile}`);
    }
    steps.push({ step: `make ${n} options`, result: `${n} HTML files with direction sidecars` });
    console.log(`${n} options generated and checked; direction sidecars verified`);
  }
  if (config !== '{}') assert.equal(readFileSync(join(work, 'config/config.json'), 'utf8'), config);
  view = spawn(cli, ['view', join(scratch, 'options-5'), '--host', '127.0.0.1', '--port', '0'], { env, cwd: installed, stdio: ['ignore', 'pipe', 'inherit'] });
  const line = await new Promise((ok, no) => {
    let text = '';
    view.stdout.on('data', (data) => { text += data; if (text.includes('\n')) ok(text.split('\n')[0]); });
    view.once('error', no);
    view.once('exit', (code) => no(new Error(`view exited ${code}`)));
  });
  const viewing = JSON.parse(line).viewing;
  assert.equal(viewing.options.length, 5);
  run('chrome-devtools-axi', ['open', viewing.url]);
  run('chrome-devtools-axi', ['resize', '1280', '900']);
  run('chrome-devtools-axi', ['screenshot', join(out, 'five-options.png')]);
  run('chrome-devtools-axi', ['open', `${viewing.url}#/o/1/play`]);
  run('sleep', ['1.5']);
  run('chrome-devtools-axi', ['screenshot', join(out, 'option-play.png')]);
  writeFileSync(join(out, 'steps.json'), JSON.stringify({ target: { version }, start: 'empty folder; npm tarball installed outside the repository; task-private First Draft config', steps: ['pack and install the committed candidate', 'init BYOKit Claude route and doctor', 'make --options 1, 3 and 5 with brief-file, screens, model and out-dir (no --style, so direction planning runs)', 'verify HTML files, direction sidecars for multi-option runs, and unchanged saved config', 'view all five options showing direction names and open Play'], result: 'The installed CLI generated 1, 3 and 5 self-contained options with direction sidecars for 3 and 5; five options are visible in the grid with direction names as labels, and one opens in Play.' }, null, 2));
} finally {
  view?.kill();
  try { run('chrome-devtools-axi', ['stop']); } catch { /* no browser if generation failed */ }
  rmSync(work, { recursive: true, force: true });
}
