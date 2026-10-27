// Capture an actual benchmark CLI output, without repeating discovery or spending judge quota.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const sheet = resolve(process.env.FD_BENCHMARK_SHEET ?? ''), out = process.env.DONE_DONE_EVIDENCE_ROOT;
assert.ok(process.env.FD_BENCHMARK_SHEET && out, 'Set FD_BENCHMARK_SHEET and DONE_DONE_EVIDENCE_ROOT');
const report = JSON.parse(readFileSync(`${sheet}.json`, 'utf8')), bytes = readFileSync(sheet);
assert.ok(report.captures.length && report.captures.every((c) => c.image.dataUrl.startsWith('data:image/png;base64,')));
const work = mkdtempSync(join(tmpdir(), 'fdb-view-')), env = { ...process.env, CHROME_DEVTOOLS_AXI_SESSION: `fd-benchmark-${process.pid}`, CHROME_DEVTOOLS_AXI_USER_DATA_DIR: join(work, 'browser') };
for (const key of ['CHROME_DEVTOOLS_AXI_AUTO_CONNECT', 'CHROME_DEVTOOLS_AXI_BROWSER_URL', 'CHROME_DEVTOOLS_AXI_PORT']) delete env[key];
const browser = async (...args) => (await promisify(execFile)('chrome-devtools-axi', args, { env, encoding: 'utf8', timeout: 60_000 })).stdout;
const server = createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(bytes); });
try {
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  await browser('open', `http://127.0.0.1:${server.address().port}`);
  for (const width of [390, 1280]) {
    await browser('emulate', '--viewport', `${width}x1000x1`, '--color-scheme', report.theme);
    const state = await browser('eval', 'async () => { await Promise.all([...document.images].map(i => i.decode())); return {images:document.images.length, widths:[...document.images].map(i=>i.width)}; }');
    writeFileSync(join(out, `sheet-${width}-${report.theme}.json`), state);
    await browser('screenshot', join(out, `sheet-${width}-${report.theme}.png`));
    if (width === 390) for (let i = 0; i < report.captures.length; i++) {
      await browser('eval', `() => { document.querySelectorAll('article')[${i}].scrollIntoView({block:'start',inline:'start'}); return document.images[${i}].complete; }`);
      await browser('screenshot', join(out, `image-${i + 1}-${report.theme}.png`));
    }
    await browser('eval', "() => { window.scrollTo(0,0); document.querySelector('.captures').scrollLeft=0; return true; }");
  }
  if (report.scores.length) {
    await browser('eval', '() => { document.querySelector("section").scrollIntoView(); return document.querySelectorAll("tbody tr").length; }');
    await browser('screenshot', join(out, `scores-${report.theme}.png`));
  }
  writeFileSync(join(out, `benchmark-capture-${report.theme}.json`), JSON.stringify({ product: report.product, screen: report.screen, width: report.width, theme: report.theme, captures: report.captures.length, scored: report.scores.length, judge: report.judge, note: 'Capture only of retained benchmark output; model scores are not independently re-certified.' }, null, 2));
} finally {
  server.closeAllConnections(); server.close();
  try { await browser('stop'); } finally { rmSync(work, { recursive: true, force: true }); }
}
