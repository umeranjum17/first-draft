// The first-draft view on the built bundles: which files make a design, the two origins and their policies,
// the device fit, the Studio's viewport switch in headless Chrome, and the CLI's host choice. No model call.
import assert from 'node:assert/strict';
import { execFile, execFileSync, spawn } from 'node:child_process';
import { connect as netConnect } from 'node:net';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';
import { FRAMES, deviceFor, fitDevice, pageFor } from '../src/view/canvas.js';
import { commentsPath, designFiles, serve } from '../src/view.mjs';

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

// The real view page in headless Chrome (CI's runner has google-chrome): the DOM the page builds for a route.
const CHROME = [process.env.CHROME, 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].find((c) => c && execFileSync('sh', ['-c', `command -v "${c}" || true`]).toString().trim());
const dom = (dir, url) => promisify(execFile)(CHROME, ['--headless', '--no-sandbox', '--disable-gpu', `--user-data-dir=${join(dir, 'chrome')}`, '--virtual-time-budget=3000', '--dump-dom', url]).then((r) => r.stdout);

test('the Studio viewport switch shows the option on the picked device only, and Play opens on it', { skip: !CHROME && 'no Chrome on PATH' }, async (t) => {
  const dir = temp(t);
  writeFileSync(join(dir, 'a-1.html'), MOCK);
  const v = await serve({ files: designFiles([join(dir, 'a.html')]), name: 'a', host: '127.0.0.1', port: 0, framePort: 0 });
  t.after(v.close);
  const shows = (html) => ({ phone: /class="phone"/.test(html), desktop: /class="artboard"/.test(html), current: html.match(/<a href="#\/o\/1\/(phone|desktop)" aria-current="true">/)?.[1],
    other: html.match(/<a href="#\/o\/1\/(phone|desktop)">/)?.[1], play: html.match(/href="#\/o\/1\/play\/(phone|desktop)"/)?.[1] });
  assert.deepEqual(shows(await dom(dir, `${v.url}#/o/1/phone`)), { phone: true, desktop: false, current: 'phone', other: 'desktop', play: 'phone' }); // never a desktop pane under the phone
  assert.deepEqual(shows(await dom(dir, `${v.url}#/o/1/desktop`)), { phone: false, desktop: true, current: 'desktop', other: 'phone', play: 'desktop' });
});

test('the canvas and Play fit one device to the stage without upscaling, and defaults to the device that fits the viewport', () => {
  assert.equal(fitDevice('desktop', 4000, 4000), 1);
  assert.ok(FRAMES.desktop.width * fitDevice('desktop', 1280, 900) <= 1280 - 48);
  assert.ok((FRAMES.phone.height + FRAMES.phone.bezel * 2) * fitDevice('phone', 1280, 700) <= 700 - 48);
  assert.ok((FRAMES.phone.width + FRAMES.phone.bezel * 2) * fitDevice('phone', 390, 900) <= 390 - 48);
  assert.deepEqual([deviceFor(undefined, 390), deviceFor(undefined, 1280), deviceFor('phone', 1280)], ['phone', 'desktop', 'phone']);
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
  assert.equal((await fetch(`${view}/favicon.svg`)).headers.get('content-type'), 'image/svg+xml');

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

test('comment pins load read-only from <design>.comments.json; no file means none, a bad file says why', async (t) => {
  const dir = temp(t);
  writeFileSync(join(dir, 'a-1.html'), MOCK);
  const open = async () => {
    const v = await serve({ files: designFiles([join(dir, 'a.html')]), name: 'a', host: '127.0.0.1', port: 0, framePort: 0, comments: commentsPath(join(dir, 'a.html')) });
    t.after(v.close);
    return JSON.parse((await (await fetch(v.url)).text()).match(/<script type="application\/json" id="design">(.*?)<\/script>/)[1]);
  };
  assert.equal(commentsPath(join(dir, 'a.html')), join(dir, 'a.comments.json'));
  assert.deepEqual([(await open()).pins, (await open()).pinsError], [[], undefined]);

  writeFileSync(join(dir, 'a.comments.json'), JSON.stringify([{ option: 1, x: 0.25, y: 0.5, text: 'Make this bigger', extra: 1 }, { option: 1, x: 2, y: 0, text: 'off the frame' }, { option: 1, x: 0, y: 0 }, null]));
  const ok = await open();
  assert.deepEqual(ok.pins, [{ option: 1, x: 0.25, y: 0.5, text: 'Make this bigger' }]);
  assert.equal(ok.pinsError, undefined);

  writeFileSync(join(dir, 'a.comments.json'), '{"nope"');
  assert.match((await open()).pinsError, /a\.comments\.json is not valid comments/);
  writeFileSync(join(dir, 'a.comments.json'), '{}');
  assert.match((await open()).pinsError, /expected an array/);

  // the frame gains nothing: pins are drawn by the view page, so the option's policy and body are the same with or without them
  writeFileSync(join(dir, 'a.comments.json'), JSON.stringify([{ option: 1, x: 0.5, y: 0.5, text: 'Make this bigger' }]));
  const v = await serve({ files: designFiles([join(dir, 'a.html')]), name: 'a', host: '127.0.0.1', port: 0, framePort: 0, comments: join(dir, 'a.comments.json') });
  t.after(v.close);
  assert.doesNotMatch(await (await fetch(`${v.frames}/o/1`)).text(), /Make this bigger/);
});
