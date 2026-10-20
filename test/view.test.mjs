// The first-draft view on the built bundles: which files make a design, the two origins and their policies,
// the canvas fit, and the CLI's host choice. No browser and no model call.
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { connect as netConnect } from 'node:net';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';
import { FRAMES, fitCanvas, fitPlay, pageFor, playDevice } from '../src/view/canvas.js';
import { designFiles, serve } from '../src/view.mjs';

const CLI = new URL('../src/cli.mjs', import.meta.url).pathname;
const MOCK = `<!doctype html><html lang="en"><head>\n<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'" /><title>Notes</title></head><body><h1>Sign in to your notes</h1></body></html>`;
const temp = (t) => { const dir = mkdtempSync(join(tmpdir(), 'first-draft-view-')); t.after(() => rmSync(dir, { recursive: true, force: true })); return dir; };

test('a design is a folder, the numbered --out path, or option files', (t) => {
  const dir = temp(t);
  mkdirSync(join(dir, 'mocks'));
  for (const f of ['x-1.html', 'x-2.html', 'x-10.html', 'x-a.html', 'notes.txt']) writeFileSync(join(dir, 'mocks', f), MOCK);
  const names = (args) => designFiles(args).map((f) => f.slice(dir.length + 1));
  assert.deepEqual(names([join(dir, 'mocks/x.html')]), ['mocks/x-1.html', 'mocks/x-2.html', 'mocks/x-10.html']);
  assert.deepEqual(names([join(dir, 'mocks')]), ['mocks/x-1.html', 'mocks/x-2.html', 'mocks/x-10.html', 'mocks/x-a.html']);
  assert.deepEqual(names([join(dir, 'mocks/x-2.html'), join(dir, 'mocks/x-a.html'), join(dir, 'mocks/x-2.html')]), ['mocks/x-2.html', 'mocks/x-a.html']);
  assert.deepEqual(names([join(dir, 'missing/y.html')]), []);
});

test('a path under a file is no design, not a crash', (t) => {
  const dir = temp(t);
  writeFileSync(join(dir, 'notes.txt'), MOCK);
  assert.deepEqual(designFiles([join(dir, 'notes.txt', 'x.html')]), []);
});

test('the canvas puts phone and desktop side by side at 1280 and stacks them at 390', () => {
  const wide = fitCanvas(1280);
  assert.equal(wide.stacked, false);
  assert.ok((FRAMES.phone.width + FRAMES.phone.bezel * 2 + FRAMES.desktop.width) * wide.desktop <= 1280 - 48);
  const narrow = fitCanvas(390);
  assert.equal(narrow.stacked, true);
  assert.ok((FRAMES.phone.width + FRAMES.phone.bezel * 2) * narrow.phone <= 390 - 48);
  assert.ok(FRAMES.desktop.width * narrow.desktop <= 390 - 48);
  assert.equal(fitCanvas(4000).desktop, 1);
  assert.deepEqual([FRAMES.phone.width, FRAMES.desktop.width], [390, 1280]);
});

test('Play fits one device to the stage without upscaling, and defaults to the device that fits the viewport', () => {
  assert.equal(fitPlay('desktop', 4000, 4000), 1);
  assert.ok(FRAMES.desktop.width * fitPlay('desktop', 1280, 900) <= 1280 - 48);
  assert.ok((FRAMES.phone.height + FRAMES.phone.bezel * 2) * fitPlay('phone', 1280, 700) <= 700 - 48);
  assert.ok((FRAMES.phone.width + FRAMES.phone.bezel * 2) * fitPlay('phone', 390, 900) <= 390 - 48);
  assert.deepEqual([playDevice(undefined, 390), playDevice(undefined, 1280), playDevice('phone', 1280)], ['phone', 'desktop', 'phone']);
});

test('an errored option opens its canvas, never the grid or a frame', () => {
  const errored = { n: 2, label: 'a-2', error: 'too big' };
  assert.equal(pageFor(undefined), 'grid');
  assert.equal(pageFor(errored), 'canvas');
  assert.equal(pageFor(errored, 'full'), 'canvas');
  assert.equal(pageFor(errored, 'play'), 'canvas');
  assert.equal(pageFor({ n: 1, label: 'a-1' }), 'canvas');
  assert.equal(pageFor({ n: 1, label: 'a-1' }, 'full'), 'full');
  assert.equal(pageFor({ n: 1, label: 'a-1' }, 'play'), 'play');
});

test('options render from a second origin, sandboxed to scripts only', async (t) => {
  const dir = temp(t);
  writeFileSync(join(dir, 'a-1.html'), MOCK);
  writeFileSync(join(dir, 'a-2.html'), `<!doctype html><body>${'x'.repeat(5_000_001)}</body>`);
  const v = await serve({ files: designFiles([join(dir, 'a.html')]), name: 'a', host: '127.0.0.1', port: 0, framePort: 0 });
  t.after(v.close);
  const view = new URL(v.url).origin;
  assert.notEqual(view, v.frames);

  const page = await fetch(v.url);
  assert.equal(page.status, 200);
  const policy = page.headers.get('content-security-policy');
  assert.match(policy, /default-src 'none'/);
  assert.match(policy, new RegExp(`frame-src ${v.frames}(;|$)`));
  const data = JSON.parse((await page.text()).match(/<script type="application\/json" id="design">(.*?)<\/script>/)[1]);
  assert.equal(data.frames, v.frames);
  assert.deepEqual(data.options.map((o) => [o.n, o.label, Boolean(o.error)]), [[1, 'a-1', false], [2, 'a-2', true]]);
  assert.equal((await fetch(`${view}/view.js`)).status, 200);

  const option = await fetch(`${v.frames}/o/1`);
  assert.equal(option.status, 200);
  const sandbox = option.headers.get('content-security-policy');
  for (const rule of ['sandbox allow-scripts;', "default-src 'none'", "script-src 'unsafe-inline'", "connect-src 'none'", "form-action 'none'", `frame-ancestors ${view}`]) assert.ok(sandbox.includes(rule), rule);
  assert.match(await option.text(), /Sign in to your notes/);

  assert.equal((await fetch(`${v.frames}/o/2`)).status, 413);
  assert.equal((await fetch(`${v.frames}/o/3`)).status, 404);
  assert.equal((await fetch(`${v.frames}/`)).status, 404);
  assert.equal((await fetch(`${view}/o/1`)).status, 404);
  assert.equal((await fetch(`${v.frames}/o/1`, { method: 'POST' })).status, 405);
});

const SCREENS = `<!doctype html><html><head><title>Notes</title></head><body><section id="signin" data-oc-screen><a href="#home">Sign in</a></section><section id="home" data-oc-screen><a href="#signin">Back</a></section></body></html>`;

test('Play serves the screen bridge inside the same sandbox, and only when asked', async (t) => {
  const dir = temp(t);
  writeFileSync(join(dir, 'a-1.html'), SCREENS);
  writeFileSync(join(dir, 'a-2.html'), '<!doctype html><title>One</title><h1>One screen</h1>');
  const v = await serve({ files: designFiles([join(dir, 'a.html')]), name: 'a', host: '127.0.0.1', port: 0, framePort: 0 });
  t.after(v.close);
  const plain = await (await fetch(`${v.frames}/o/1`)).text();
  assert.doesNotMatch(plain, /__firstDraft/);
  assert.match(plain, /data-oc-screen/); // the screens are the page's own; upstream's overlay switches them
  const play = await fetch(`${v.frames}/o/1?play`);
  const html = await play.text();
  assert.match(html, /__firstDraft/);
  assert.ok(html.lastIndexOf('__firstDraft') < html.lastIndexOf('</body>'));
  assert.equal(play.headers.get('content-security-policy'), (await fetch(`${v.frames}/o/1`)).headers.get('content-security-policy'));
  assert.match(await (await fetch(`${v.frames}/o/2?play`)).text(), /One screen[\s\S]*__firstDraft/); // no screens: Play still opens it
});

test('an option that is a directory answers with an error and the view keeps serving', async (t) => {
  const dir = temp(t);
  writeFileSync(join(dir, 'a-1.html'), MOCK);
  mkdirSync(join(dir, 'a-2.html'));
  const v = await serve({ files: designFiles([join(dir, 'a.html')]), name: 'a', host: '127.0.0.1', port: 0, framePort: 0 });
  t.after(v.close);
  assert.equal((await fetch(`${v.frames}/o/2`)).status, 404);
  assert.equal((await fetch(`${v.frames}/o/1`)).status, 200);
});

test('view binds the tailnet address from tailscale, or the given host', async (t) => {
  const dir = temp(t);
  writeFileSync(join(dir, 'a-1.html'), MOCK);
  mkdirSync(join(dir, 'bin'));
  writeFileSync(join(dir, 'bin/tailscale'), '#!/bin/sh\necho 192.0.2.7\n');
  chmodSync(join(dir, 'bin/tailscale'), 0o755);
  const env = { ...process.env, PATH: `${join(dir, 'bin')}:${process.env.PATH}`, FIRST_DRAFT_VIEW_HOST: '' };
  // 192.0.2.7 is a documentation address this machine does not have, so binding it fails and names it.
  await assert.rejects(promisify(execFile)(process.execPath, [CLI, 'view', join(dir, 'a.html'), '--port', '0'], { env }),
    (e) => JSON.parse(e.stdout).error.code === 'VIEW_FAILED' && e.stdout.includes('192.0.2.7'));

  const child = spawn(process.execPath, [CLI, 'view', join(dir, 'a.html'), '--port', '0'], { env: { ...env, FIRST_DRAFT_VIEW_HOST: '127.0.0.1' } });
  t.after(() => child.kill());
  const line = await new Promise((ok, fail) => { child.stdout.once('data', (d) => ok(String(d))); child.once('exit', fail); });
  const out = JSON.parse(line);
  assert.match(out.viewing.url, /^http:\/\/127\.0\.0\.1:\d+\/$/);
  assert.equal(out.viewing.options[0].url, `${out.viewing.url}#/o/1`);
  assert.match(out.help[0], /this machine only/);
  assert.equal((await fetch(out.viewing.options[0].url)).status, 200);

  await assert.rejects(promisify(execFile)(process.execPath, [CLI, 'view', join(dir, 'none.html')], { env }), (e) => JSON.parse(e.stdout).error.code === 'NO_OPTIONS');
});

test('a wildcard host listens everywhere but advertises the tailnet address, or fails without one', async (t) => {
  const dir = temp(t);
  writeFileSync(join(dir, 'a-1.html'), MOCK);
  mkdirSync(join(dir, 'bin'));
  writeFileSync(join(dir, 'bin/tailscale'), '#!/bin/sh\necho 192.0.2.7\n');
  chmodSync(join(dir, 'bin/tailscale'), 0o755);
  const env = { ...process.env, PATH: `${join(dir, 'bin')}:${process.env.PATH}`, FIRST_DRAFT_VIEW_HOST: '' };
  const child = spawn(process.execPath, [CLI, 'view', join(dir, 'a.html'), '--host', '0.0.0.0', '--port', '0'], { env });
  t.after(() => child.kill());
  const line = await new Promise((ok, fail) => { child.stdout.once('data', (d) => ok(String(d))); child.once('exit', fail); });
  const out = JSON.parse(line);
  assert.match(out.viewing.url, /^http:\/\/192\.0\.2\.7:\d+\/$/);
  assert.equal(out.viewing.options[0].url, `${out.viewing.url}#/o/1`);
  assert.equal((await fetch(`http://127.0.0.1:${new URL(out.viewing.url).port}/`)).status, 200);

  mkdirSync(join(dir, 'empty'));
  await assert.rejects(promisify(execFile)(process.execPath, [CLI, 'view', join(dir, 'a.html'), '--host', '::', '--port', '0'], { env: { ...env, PATH: join(dir, 'empty') } }),
    (e) => JSON.parse(e.stdout).error.code === 'NO_TAILNET' && !e.stdout.includes('::'));
});

test('a malformed request target gets an answer and the view keeps serving', async (t) => {
  const dir = temp(t);
  writeFileSync(join(dir, 'a-1.html'), MOCK);
  const v = await serve({ files: designFiles([join(dir, 'a.html')]), name: 'a', host: '127.0.0.1', port: 0, framePort: 0 });
  t.after(v.close);
  const raw = (port, target) => new Promise((ok, fail) => {
    const s = netConnect({ host: '127.0.0.1', port }, () => s.write(`GET ${target} HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n`));
    let data = '';
    s.on('data', (c) => { data += c; });
    s.on('end', () => ok(data));
    s.on('error', fail);
  });
  assert.match(await raw(Number(new URL(v.frames).port), '//['), /^HTTP\/1\.1 404 /);
  assert.match(await raw(Number(new URL(v.url).port), '//['), /^HTTP\/1\.1 404 /);
  assert.equal((await fetch(`${v.frames}/o/1`)).status, 200);
  assert.equal((await fetch(v.url)).status, 200);
});
