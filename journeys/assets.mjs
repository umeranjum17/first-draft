// Paid real-product journey: the design agent decides which images to generate with the approved providers; preview first, no retry. Run through done-done.
// --capture-only with FD_ASSET_SOURCE recaptures a retained real output in the viewer without generating anything.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
const out = process.env.DONE_DONE_EVIDENCE_ROOT, source = process.env.FD_ASSET_SOURCE, providers = process.env.FD_ASSET_PROVIDERS ?? 'codex,higgsfield';
if ((process.argv.includes('--capture-only') && !source) || !out || (!source && !(process.env.FD_DESIGN_AGENT && process.env.FD_DESIGN_MODEL))) throw new Error('Need DONE_DONE_EVIDENCE_ROOT and an approved FD_DESIGN_AGENT and FD_DESIGN_MODEL (or FD_ASSET_SOURCE for nonpaid recapture)');
const root = new URL('..', import.meta.url).pathname, d = mkdtempSync(join(tmpdir(), 'fd-assets-'));
const env = { ...process.env, FIRST_DRAFT_HOME: join(d, 'home'), CHROME_DEVTOOLS_AXI_SESSION: `fd-assets-${process.pid}`, CHROME_DEVTOOLS_AXI_USER_DATA_DIR: join(d, 'browser') };
const run = (bin, args) => execFileSync(bin, args, { env, encoding: 'utf8', timeout: 1_800_000, maxBuffer: 8_000_000 });
const cli = (...args) => run(process.execPath, [join(root, 'src/cli.mjs'), ...args]);
mkdirSync(out, { recursive: true });
// Preflight, make JSON and source files are support, not screenshots claiming the final visible outcome.
const support = resolve(out, '..', `${basename(out)}-support`); mkdirSync(support, { recursive: true });
let view;
try {
  const file = source ? resolve(source) : join(support, 'shop.html');
  if (!source) {
    cli('init', '--agent', process.env.FD_DESIGN_AGENT, '--model', process.env.FD_DESIGN_MODEL);
    // What a user would ask for: the brief names the pictures, never a provider or a tool.
    const args = ['make', "A one-page site for Umer's small plant shop, Fern & Field: a hero with a real-looking photo of the shop's sunny window full of plants, a short About section with a hand-drawn style illustration of a monstera leaf, three best-selling plants with prices, and a Visit us block with the address 12 Canal Street. Generate the pictures. Light and dark themes.", '--out', file, '--options', '1', '--assets', providers];
    const preview = cli(...args); writeFileSync(join(support, 'preview.json'), preview); console.log(preview);
    const result = cli(...args, '--allow-asset-spend'); writeFileSync(join(support, 'make.json'), result); console.log(result);
    const made = JSON.parse(result).made;
    assert.equal(made.render_check, 'checked');
    assert.ok(made.files[0].images.length, 'the design agent generated no image');
  }
  const record = join(dirname(file), 'make.json'); // a recapture reads the agent's choices from the retained run's own record
  const made = existsSync(record) ? JSON.parse(readFileSync(record, 'utf8')).made : null;
  writeFileSync(join(support, 'source.json'), JSON.stringify({ file, sha256: createHash('sha256').update(readFileSync(file)).digest('hex'), generatedNow: !source }));
  assert.match(readFileSync(file, 'utf8'), /<img\b[^>]*src=["']data:image\/webp;base64,/i);
  const browser = (...args) => run('chrome-devtools-axi', args);
  // The images decode and show in the design itself, with no sideways scroll, at each width and theme.
  const metrics = [];
  for (const theme of ['light', 'dark']) for (const width of [390, 1280]) {
    browser('open', `file://${file}`);
    browser('emulate', '--viewport', `${width}x900x1`, '--color-scheme', theme);
    browser('open', `file://${file}`);
    metrics.push({ theme, width, measurement: browser('eval', 'async () => { await Promise.all([...document.images].map(i=>i.decode())); if(document.documentElement.scrollWidth>innerWidth || ![...document.images].some(i=>i.naturalWidth>0&&i.getBoundingClientRect().height>0))throw Error("Missing visible image or horizontal overflow"); return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,images:[...document.images].map(i=>({loaded:i.complete&&i.naturalWidth>0,visible:i.getBoundingClientRect().height>0,top:Math.round(i.getBoundingClientRect().top+scrollY),screen:i.closest("[data-oc-screen]")?.getAttribute("data-oc-screen")??null}))}; }') });
  }
  writeFileSync(join(support, 'metrics.json'), JSON.stringify(metrics, null, 2));
  // Each screen that holds a generated image is captured on its own, so every image is in frame.
  const screens = [...new Set([...readFileSync(file, 'utf8').matchAll(/<(\w+)\b[^>]*data-oc-screen=["']([^"']+)["'][^>]*>([\s\S]*?)<\/\1>/g)].filter((m) => /src=["']data:image\/webp/.test(m[3])).map((m) => m[2]))];
  // The captures are the real viewer: first-draft-axi view on a private port, the option's Studio at each width and theme.
  view = spawn(process.execPath, [join(root, 'src/cli.mjs'), 'view', file, '--host', '127.0.0.1', '--port', '0'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  const url = await new Promise((ok, fail) => { let log = ''; view.stdout.on('data', (c) => { log += c; const m = log.match(/"url":"([^"]+)"/); if (m) ok(m[1]); }); view.once('exit', (code) => fail(new Error(`view exited ${code}: ${log}`))); });
  for (const screen of screens.length ? screens : [null]) for (const theme of ['light', 'dark']) for (const width of [390, 1280]) {
    browser('emulate', '--viewport', `${width}x900x1`, '--color-scheme', theme);
    browser('open', `${url}${screen ? `?screen=${encodeURIComponent(screen)}` : ''}#/o/1`);
    browser('eval', '() => new Promise((r) => setTimeout(() => r(true), 2500))'); // the option frames load their embedded images
    browser('screenshot', join(out, `viewer-${screen ? `${screen}-` : ''}${width}-${theme}.png`));
  }
  const chosen = made?.files[0].images.map((i) => `${i.provider} (${i.purpose})`).join(' and ');
  writeFileSync(join(out, 'steps.json'), JSON.stringify({ target: { version: run('git', ['-C', root, 'rev-parse', 'HEAD']).trim() }, start: source ? 'Nonpaid recapture of a retained real make output whose images the design agent generated; no image or design generation this run' : 'Installed signed-in CLIs, fresh First Draft config, no image',
    steps: [...(source ? [] : [`Preview the per-image cost of ${providers} without generation`, 'Approve the asset spend and make the shop page; the design agent decides which pictures to generate and with which provider'] ), `Open the resulting design in first-draft-axi view at 390 and 1280, light and dark, and capture the Studio on each screen holding a generated picture${screens.length ? ` (${screens.join(', ')})` : ''}`],
    result: `The plant shop page shows its generated pictures inside the design in the first-draft viewer at phone 390 and desktop 1280, light and dark.${chosen ? ` The design agent chose ${chosen}.` : ''}` }, null, 2));
} finally {
  view?.kill();
  try { run('chrome-devtools-axi', ['stop']); } catch { /* No browser may have started when generation fails. */ }
  rmSync(d, { recursive: true, force: true });
}
