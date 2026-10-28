// The real view serves options from a separate origin with a restrictive sandbox policy. No model call.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { designFiles, serve } from '../src/view.mjs';

const MOCK = `<!doctype html><html lang="en"><head>\n<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'" /><title>Notes</title></head><body><h1>Sign in to your notes</h1></body></html>`;
const temp = (t) => { const dir = mkdtempSync(join(tmpdir(), 'first-draft-view-')); t.after(() => rmSync(dir, { recursive: true, force: true })); return dir; };




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
