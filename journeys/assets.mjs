// Paid real-product journey: one image, preview first; no retry. Run through done-done.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const provider = process.argv[2], out = process.env.DONE_DONE_EVIDENCE_ROOT;
if (!['codex', 'higgsfield'].includes(provider) || !out || !process.env.FD_DESIGN_MODEL) throw new Error('Need provider, DONE_DONE_EVIDENCE_ROOT and the approved FD_DESIGN_MODEL');
const root = new URL('..', import.meta.url).pathname, d = mkdtempSync(join(tmpdir(), 'fd-assets-'));
const env = { ...process.env, FIRST_DRAFT_HOME: join(d, 'home'), CHROME_DEVTOOLS_AXI_SESSION: `fd-assets-${process.pid}`, CHROME_DEVTOOLS_AXI_USER_DATA_DIR: join(d, 'browser') };
const run = (bin, args) => execFileSync(bin, args, { env, encoding: 'utf8', timeout: 1_200_000, maxBuffer: 8_000_000 });
const cli = (...args) => run(process.execPath, [join(root, 'src/cli.mjs'), ...args]);
mkdirSync(out, { recursive: true });
try {
  cli('init', '--agent', 'byokit:codex', '--model', process.env.FD_DESIGN_MODEL);
  const file = resolve(out, `${provider}.html`);
  const args = ['make', "One compact botanical shop screen for Umer, headline Green things, one generated green leaf illustration as the hero, one Shop plants link. No extra screens or sections. Fit the entire page in 800px at phone width. Place the supplied image visibly near the top. Light and dark themes.", '--out', file, '--assets', provider];
  const preview = cli(...args); writeFileSync(join(out, `${provider}-preview.json`), preview); console.log(preview);
  const result = cli(...args, '--allow-asset-spend'); writeFileSync(join(out, `${provider}-make.json`), result);
  assert.match(readFileSync(file, 'utf8'), /<img\b[^>]*src=["']data:image\/webp;base64,/i);
  assert.equal(JSON.parse(result).made.render_check, 'checked');
  const metrics = [];
  for (const theme of ['light', 'dark']) for (const width of [390, 1280]) {
    const browser = (...args) => run('chrome-devtools-axi', args);
    browser('open', `file://${file}`);
    browser('emulate', '--viewport', `${width}x900x1`, '--color-scheme', theme);
    browser('open', `file://${file}`);
    const measurement = browser('eval', 'async () => { await Promise.all([...document.images].map(i=>i.decode())); if(document.documentElement.scrollWidth>innerWidth || ![...document.images].some(i=>i.naturalWidth>0&&i.getBoundingClientRect().height>0))throw Error("Missing visible image or horizontal overflow"); return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,images:[...document.images].map(i=>({loaded:i.complete&&i.naturalWidth>0,visible:i.getBoundingClientRect().height>0})),scrollContainers:[...document.querySelectorAll("*")].filter(e=>/auto|scroll/.test(getComputedStyle(e).overflowY)&&e.scrollHeight>e.clientHeight).length}; }');
    metrics.push({ theme, width, measurement });
    browser('screenshot', join(out, `${provider}-${width}-${theme}.png`));
  }
  writeFileSync(join(out, 'metrics.json'), JSON.stringify(metrics, null, 2));
  writeFileSync(join(out, 'steps.json'), JSON.stringify({ target: { version: run('git', ['-C', root, 'rev-parse', 'HEAD']).trim() }, start: 'Installed signed-in CLIs, fresh First Draft config, no image', steps: [`Preview ${provider} cost without generation`, 'Explicitly approve one image, generate the real screen through BYOKit Codex, optimize WebP and embed in the screen', 'Open the resulting HTML at 390 and 1280, light and dark; decode images and capture the screen'], result: `The botanical shop screen contains an optimized generated ${provider} image, embedded offline rather than on a separate asset sheet.` }, null, 2));
} finally {
  try { run('chrome-devtools-axi', ['stop']); } catch { /* No browser may have started when generation fails. */ }
  rmSync(d, { recursive: true, force: true });
}
