// Real installed CLI journey. Requires the approved MiniMax key in the environment; never reads login files.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = process.env.DONE_DONE_EVIDENCE_ROOT;
assert.ok(out, 'Run through done-done');
assert.ok(process.env.MINIMAX_API_KEY, 'MINIMAX_API_KEY must be supplied by the approved wrapper');
const work = mkdtempSync(join(tmpdir(), 'fdc-'));
const installed = join(work, 'installed');
const env = { ...process.env, FIRST_DRAFT_HOME: join(work, 'config'), TMPDIR: work,
  npm_config_cache: join(work, 'npm-cache'), CHROME_DEVTOOLS_AXI_SESSION: `fd-controls-${process.pid}`,
  CHROME_DEVTOOLS_AXI_USER_DATA_DIR: join(work, 'browser') };
const run = (bin, args, cwd = installed) => execFileSync(bin, args, { env, cwd, encoding: 'utf8', maxBuffer: 10_000_000, timeout: 3_600_000 });
let view;
try {
  mkdirSync(installed);
  console.log('Packing this committed candidate and installing in an empty folder');
  const packed = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', work], root));
  writeFileSync(join(out, 'install.log'), run('npm', ['install', '--no-audit', '--no-fund', join(work, packed[0].filename)]));
  const cli = join(installed, 'node_modules/.bin/first-draft-axi');
  const version = JSON.parse(readFileSync(join(installed, 'node_modules/first-draft-axi/package.json'))).version;
  writeFileSync(join(out, 'help.txt'), run(cli, ['make', '--help']));
  run(cli, ['init', '--agent', 'byokit:minimax:key']);
  writeFileSync(join(out, 'doctor.json'), run(cli, ['doctor']));
  const config = readFileSync(join(work, 'config/config.json'), 'utf8');
  const brief = join(work, 'brief.md');
  writeFileSync(brief, 'A small notes app for Umer. Two simple screens: Sign in and Notes. Notes has two short sample notes. Keep the design compact. No images needed.');
  const inventory = [];
  for (const n of [1, 3, 5]) {
    console.log(`Generating ${n} options with screens, style, brief file, model override and output directory`);
    const folder = join(out, `options-${n}`);
    const args = ['make', '--brief-file', brief, '--options', String(n), '--screens', 'Sign in,Notes', '--style', 'editorial', '--model', 'MiniMax-M3.1-Flash-Preview', '--out-dir', folder];
    const text = run(cli, args);
    writeFileSync(join(out, `make-${n}.json`), text);
    const made = JSON.parse(text).made;
    assert.equal(made.files.length, n);
    assert.equal(made.model, 'MiniMax-M3.1-Flash-Preview');
    assert.equal(made.render_check, 'checked');
    assert.equal(readdirSync(folder).filter((f) => f.endsWith('.html')).length, n);
    for (const file of made.files) {
      const html = readFileSync(file.file, 'utf8');
      assert.match(html, /Content-Security-Policy/);
      assert.doesNotMatch(html, /<script\b|\sonclick=/i);
    }
    inventory.push({ options: n, files: made.files.map((f) => ({ ...f, file: `options-${n}/${f.file.split('/').at(-1)}` })), render_check: made.render_check });
    console.log(`${n} options generated and checked`);
  }
  assert.equal(readFileSync(join(work, 'config/config.json'), 'utf8'), config);
  writeFileSync(join(out, 'inventory.json'), JSON.stringify({ version, installedOutsideRepository: true, inventory }, null, 2));
  view = spawn(cli, ['view', join(out, 'options-5'), '--host', '127.0.0.1', '--port', '0'], { env, cwd: installed, stdio: ['ignore', 'pipe', 'pipe'] });
  view.stderr.pipe(createWriteStream(join(out, 'view.stderr')));
  const line = await new Promise((ok, no) => {
    let text = '';
    view.stdout.on('data', (data) => { text += data; if (text.includes('\n')) ok(text.split('\n')[0]); });
    view.once('error', no);
    view.once('exit', (code) => no(new Error(`view exited ${code}`)));
  });
  const viewing = JSON.parse(line).viewing;
  assert.equal(viewing.options.length, 5);
  writeFileSync(join(out, 'view.json'), line);
  run('chrome-devtools-axi', ['open', viewing.url]);
  run('chrome-devtools-axi', ['resize', '1280', '900']);
  run('chrome-devtools-axi', ['screenshot', join(out, 'five-options.png')]);
  run('chrome-devtools-axi', ['open', `${viewing.url}#/o/1/play`]);
  run('chrome-devtools-axi', ['wait', '1500']);
  run('chrome-devtools-axi', ['screenshot', join(out, 'option-play.png')]);
  writeFileSync(join(out, 'steps.json'), JSON.stringify({ target: { version }, start: 'empty folder; npm tarball installed outside the repository; task-private First Draft config', steps: ['pack and install the committed candidate', 'init BYOKit MiniMax route and doctor', 'make --options 1, 3 and 5 with brief-file, screens, style, model and out-dir', 'check generated HTML inventory and unchanged saved config', 'view all five options and open Play'], result: 'The installed CLI generated 1, 3 and 5 self-contained options; five options are visible in the grid and one opens in Play.' }, null, 2));
} finally {
  view?.kill();
  try { run('chrome-devtools-axi', ['stop']); } catch { /* no browser if generation failed */ }
  rmSync(work, { recursive: true, force: true });
}
