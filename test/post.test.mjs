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
  writeFileSync(join(dir, 'bin/sign-off-axi'), `#!/bin/sh\nprintf '%s\\n' "$@" > "${dir}/args"\n`);
  chmodSync(join(dir, 'bin/sign-off-axi'), 0o755);
  const port = await freePort();
  const env = { ...process.env, PATH: `${join(dir, 'bin')}:${process.env.PATH}`, FIRST_DRAFT_VIEW_HOST: '127.0.0.1', FIRST_DRAFT_VIEW_PORT: String(port) };
  const post = (extra = []) => run(['post', 'design/x.html', '--title', 'Pick one', '--recommend', '2', '--option', 'a=Calm', '--option', 'b=Bold', ...extra], { cwd: join(dir, 'proj'), env });

  const first = JSON.parse((await post()).stdout);
  if (first.posted.view.pid) pids.push(first.posted.view.pid);
  assert.equal(first.posted.view.started, true);
  assert.deepEqual(first.posted.options.map((o) => o.link), [1, 2].map((n) => `http://127.0.0.1:${port}/#/o/${n}/play`));
  assert.equal(readFileSync(join(dir, 'proj/.sign-off/mocks/x/option-2.html'), 'utf8'), MOCK('Option 2'));
  const args = readFileSync(join(dir, 'args'), 'utf8').split('\n');
  assert.deepEqual(args.slice(0, 1).concat(args.slice(2, 5)), ['post', '--type', 'design', '--title']);
  assert.ok(args.includes('b=mocks/x/option-2.html') && args.includes('b=Bold') && args.includes('b'), 'recommend 2 is option b');
  assert.ok(args.includes(`a=http://127.0.0.1:${port}/#/o/1/play`) && args.includes(`b=http://127.0.0.1:${port}/#/o/2/play`), 'each option gets its own --link');
  const tradeoff = args[args.indexOf('--tradeoff') + 1];
  assert.ok(tradeoff.includes(`Calm http://127.0.0.1:${port}/#/o/1/play`) && tradeoff.includes(`Bold http://127.0.0.1:${port}/#/o/2/play`));
  assert.match(await (await fetch(`http://127.0.0.1:${port}/`)).text(), /x-1/);

  const again = JSON.parse((await post(['--tradeoff', 'B is bolder.'])).stdout);
  assert.equal(again.posted.view.started, false);
  assert.ok(readFileSync(join(dir, 'args'), 'utf8').includes('B is bolder. Open in first-draft:'));

  writeFileSync(join(dir, 'proj/design/y-1.html'), MOCK('Other'));
  const other = await run(['post', 'design/y-1.html', '--title', 'Other', '--recommend', 'a'], { cwd: join(dir, 'proj'), env });
  assert.equal(JSON.parse(other.stdout || 'null')?.error.code, 'PORT_IN_USE', other.stderr);
});

test('post stops with a cause when the recommended option is not an option or there is no board', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-post-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'a.html'), MOCK('A'));
  const env = { ...process.env, FIRST_DRAFT_VIEW_HOST: '127.0.0.1' };
  const code = async (args) => JSON.parse((await run(['post', 'a.html', '--title', 'T', ...args], { cwd: dir, env })).stdout).error.code;
  assert.equal(await code(['--recommend', 'c']), 'USAGE');
  assert.equal(await code(['--recommend', 'a']), 'NO_BOARD');
});
