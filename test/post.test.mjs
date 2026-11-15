// `post` end to end: real CLI, real view server, a recording stand-in for sign-off-axi (the board is not part of this repo).
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

const CLI = new URL('../src/cli.mjs', import.meta.url).pathname;
const MOCK = (t) => `<!doctype html><html lang="en"><head><title>${t}</title></head><body><h1>${t}</h1></body></html>`;
const freePort = () => new Promise((ok) => { const s = createServer().listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => ok(port)); }); });
const run = (args, opts) => promisify(execFile)(process.execPath, [CLI, ...args], opts).catch((e) => e);

test('post copies the options to the board, links each to its Play route in a view it starts, and reuses that view', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-post-'));
  const pids = [];
  t.after(() => { pids.forEach((p) => { try { process.kill(p); } catch {} }); rmSync(dir, { recursive: true, force: true }); });
  mkdirSync(join(dir, 'bin'));
  mkdirSync(join(dir, 'proj/.sign-off/mocks'), { recursive: true });
  mkdirSync(join(dir, 'proj/design'));
  for (const n of [1, 2]) writeFileSync(join(dir, `proj/design/x-${n}.html`), MOCK(`Option ${n}`));
  writeFileSync(join(dir, 'bin/sign-off-axi'), `#!/bin/sh\nprintf '%s\\n' "$@" > "${dir}/args"\nprintf '{"items":[{"key":"pick-one","title":"Pick one","type":"design"}]}' > "$2"\n`);
  chmodSync(join(dir, 'bin/sign-off-axi'), 0o755);
  const port = await freePort();
  const env = { ...process.env, PATH: `${join(dir, 'bin')}:${process.env.PATH}`, FIRST_DRAFT_VIEW_HOST: '127.0.0.1', FIRST_DRAFT_VIEW_PORT: String(port) };
  const post = (extra = []) => run(['post', 'design/x.html', '--title', 'Pick one', '--recommend', '2', '--option', 'a=Calm', '--option', 'b=Bold', ...extra], { cwd: join(dir, 'proj'), env });

  const first = JSON.parse((await post()).stdout);
  if (first.posted.view.pid) pids.push(first.posted.view.pid);
  assert.equal(first.posted.view.started, true);
  assert.deepEqual(first.posted.options.map((o) => o.link), [1, 2].map((n) => `http://127.0.0.1:${port}/#/o/${n}/play`));
  assert.equal(readFileSync(join(dir, 'proj/.sign-off/mocks/x/option-2.html'), 'utf8'), MOCK('Option 2'));
  assert.equal(first.posted.options[0].desktop, `http://127.0.0.1:${port}/#/o/1/play/desktop`);
  assert.equal(first.posted.options[0].phone, `http://127.0.0.1:${port}/#/o/1/play/phone`);
  const args = readFileSync(join(dir, 'args'), 'utf8').split('\n');
  assert.deepEqual(args.slice(0, 1).concat(args.slice(2, 5)), ['post', '--type', 'design', '--title']);
  assert.ok(args.includes('b=mocks/x/option-2.html') && args.includes('b=Bold') && args.includes('b'), 'recommend 2 is option b');
  assert.ok(args.includes(`a=http://127.0.0.1:${port}/#/o/1/play`) && args.includes(`b=http://127.0.0.1:${port}/#/o/2/play`), 'each option gets its own --link');
  const tradeoff = args[args.indexOf('--tradeoff') + 1];
  assert.ok(tradeoff.includes(`Calm http://127.0.0.1:${port}/#/o/1 `) && tradeoff.endsWith(`Bold http://127.0.0.1:${port}/#/o/2`), 'the card text names each option\'s side-by-side canvas');
  assert.equal(first.posted.options[0].canvas, `http://127.0.0.1:${port}/#/o/1`);
  assert.match(await (await fetch(`http://127.0.0.1:${port}/`)).text(), /x-1/);

  const again = JSON.parse((await post(['--tradeoff', 'B is bolder.'])).stdout);
  assert.equal(again.posted.view.started, false);
  assert.ok(readFileSync(join(dir, 'args'), 'utf8').includes('B is bolder. Phone and desktop side by side:'));

  writeFileSync(join(dir, 'proj/design/y-1.html'), MOCK('Other'));
  const other = await run(['post', 'design/y-1.html', '--title', 'Other', '--recommend', 'a'], { cwd: join(dir, 'proj'), env });
  assert.equal(JSON.parse(other.stdout || 'null')?.error.code, 'PORT_IN_USE', other.stderr);

  // --evidence (journeys, tests, demos): an Evidence card with the Play links and no decision fields, in the view that is already up.
  writeFileSync(join(dir, 'proj/shot.png'), 'png');
  const ev = (extra) => run(['post', 'design/x.html', '--title', 'What it made', '--evidence', ...extra], { cwd: join(dir, 'proj'), env });
  assert.equal(JSON.parse((await ev([])).stdout).error.code, 'USAGE', 'evidence without media is refused');
  assert.equal(JSON.parse((await ev(['--media', 'shot.png', '--recommend', 'a'])).stdout).error.code, 'USAGE', 'evidence asks no pick');
  assert.equal(JSON.parse((await ev(['--media', 'shot.png'])).stdout).posted.options.length, 2);
  const evArgs = readFileSync(join(dir, 'args'), 'utf8').split('\n');
  assert.deepEqual(evArgs.slice(0, 4), ['post', evArgs[1], '--type', 'evidence']);
  assert.ok(evArgs.includes('shot.png') && evArgs[evArgs.indexOf('--about') + 1].includes(`Option 2 http://127.0.0.1:${port}/#/o/2`));
  for (const f of ['--recommend', '--option', '--mock', '--link', '--tradeoff', '--default']) assert.ok(!evArgs.includes(f), `no ${f} on an evidence card`);
  assert.equal(JSON.parse((await run(['post', 'design/x.html', '--title', 'T'], { cwd: join(dir, 'proj'), env })).stdout).error.code, 'USAGE', 'a Decide post still needs --recommend');
});

test('a board answer moves a posted run to picked, shown by status, runs, logs and attach', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-pick-'));
  let pid;
  t.after(() => { try { process.kill(pid); } catch {} rmSync(dir, { recursive: true, force: true }); });
  const proj = join(dir, 'proj');
  mkdirSync(join(dir, 'bin'));
  mkdirSync(join(proj, 'design'), { recursive: true });
  mkdirSync(join(proj, '.first-draft/runs'), { recursive: true });
  mkdirSync(join(proj, '.sign-off'));
  for (const n of [1, 2]) writeFileSync(join(proj, `design/x-${n}.html`), MOCK(`Option ${n}`));
  // The stand-in for sign-off-axi: `post` files the card; `answers --json` prints what the board saved ({} until the user answers).
  writeFileSync(join(dir, 'bin/sign-off-axi'), `#!${process.execPath}\nimport fs from 'node:fs';\nconst [cmd, board] = process.argv.slice(2), saved = board.replace(/[^/]*$/, 'answers.json');\nif (cmd === 'post') fs.writeFileSync(board, JSON.stringify({ schema: 2, items: [{ key: 'pick-one', title: process.argv[process.argv.indexOf('--title') + 1], type: 'design' }] }));\nelse console.log(fs.existsSync(saved) ? fs.readFileSync(saved, 'utf8') : '{}');\n`);
  chmodSync(join(dir, 'bin/sign-off-axi'), 0o755);
  // A make run that has finished and passed its critique, as `make` leaves it.
  const id = '11111111-2222-3333-4444-555555555555', at = '2026-11-12T10:00:00.000Z';
  writeFileSync(join(proj, `.first-draft/runs/${id}.json`), JSON.stringify({ id, state: 'critiqued', health: 'finished', pid: 1, started_at: at, brief: 'Notes', files: [join(proj, 'design/x-1.html'), join(proj, 'design/x-2.html')], events: [{ at, state: 'critiqued', health: 'finished' }] }));
  const port = await freePort();
  const env = { ...process.env, PATH: `${join(dir, 'bin')}:${process.env.PATH}`, FIRST_DRAFT_VIEW_HOST: '127.0.0.1', FIRST_DRAFT_VIEW_PORT: String(port) };
  const cli = async (...args) => JSON.parse((await run(args, { cwd: proj, env })).stdout);

  const posted = await cli('post', 'design/x-1.html', 'design/x-2.html', '--title', 'Pick one', '--recommend', 'a', '--board', '.sign-off/decisions.json', '--option', 'a=Calm', '--option', 'b=Bold');
  pid = posted.posted.view.pid;
  const waiting = await cli('status', id);
  assert.equal(waiting.state, 'posted');
  assert.equal(waiting.posted.key, 'pick-one');
  assert.equal((await cli('runs')).runs[0].state, 'posted', 'no answer yet: the run keeps waiting');

  writeFileSync(join(proj, '.sign-off/answers.json'), JSON.stringify({ 'pick-one': { answer: 'b', label: 'Bold', close: 'done', at: '2026-11-12T12:00:00.000Z', note: 'Bolder.' } }));
  const picked = await cli('status', id);
  assert.equal(picked.state, 'picked');
  assert.deepEqual(picked.pick, { option: 'b', label: 'Bold', at: '2026-11-12T12:00:00.000Z', note: 'Bolder.' });
  assert.equal((await cli('runs')).runs[0].pick.option, 'b');
  assert.deepEqual((await cli('logs', id)).events.map((e) => e.state), ['critiqued', 'posted', 'picked']);
  assert.equal((await cli('attach', id)).state, 'picked');

  writeFileSync(join(proj, '.sign-off/answers.json'), JSON.stringify({ 'pick-one': { answer: 'z', label: 'Z', close: 'done', at } }));
  assert.equal((await cli('status', id)).state, 'picked', 'a picked run is final: a later answer does not move it');
});
