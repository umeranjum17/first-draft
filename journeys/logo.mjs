// Nonpaid recapture of a retained real `logo` run (FD_LOGO_SOURCE: the --out path given to logo, or its folder); no model call. Run through done-done.
// It checks each option's .logo/ folder (9 SVGs, the icon PNGs at the size their name says, favicon.ico with the 16/32/48 PNGs, logo.json),
// then captures the real viewer whole: the option picker and each option's Studio at 390 and 1280, light and dark (picker-<width>-<theme>.png,
// studio-<n>-<width>-<theme>.png), and, per option, the icon set with every PNG at its real size (icons-<n>.png) and every SVG file alone
// on the tile it is for, light files on white and -dark files on near-black (svgs-<n>.png). Source hashes, the evidence pages and measurements go to the sibling -support folder.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { SIZES, SVGS, logoDir } from '../src/logo.mjs';
import { designFiles } from '../src/view.mjs';
const root = new URL('..', import.meta.url).pathname, source = process.env.FD_LOGO_SOURCE, out = process.env.DONE_DONE_EVIDENCE_ROOT;
if (!source || !out) throw Error('Set FD_LOGO_SOURCE to a retained real logo output (the --out path or its folder); run through done-done');
const files = designFiles([source]);
assert.ok(files.length >= 2 && files.every((f) => existsSync(logoDir(f))), `${source} holds ${files.length} option(s); the journey needs two or more, each with its .logo folder`);
const dir = mkdtempSync('/var/tmp/fd-logo-view-'), support = resolve(out, '..', `${basename(out)}-support`);
mkdirSync(out, { recursive: true }); mkdirSync(support, { recursive: true });
const env = { ...process.env, FIRST_DRAFT_HOME: join(dir, 'config') };
for (const key of ['CHROME_DEVTOOLS_AXI_AUTO_CONNECT', 'CHROME_DEVTOOLS_AXI_BROWSER_URL', 'CHROME_DEVTOOLS_AXI_PORT']) delete env[key];
const run = (bin, args) => execFileSync(bin, args, { env, encoding: 'utf8', timeout: 90_000, maxBuffer: 10_000_000 });
const hash = (b) => createHash('sha256').update(b).digest('hex');
const size = (png) => [png.readUInt32BE(16), png.readUInt32BE(20)];

// The files as a user receives them, checked before anything is captured.
const options = files.map((file, i) => {
  const folder = logoDir(file), logo = JSON.parse(readFileSync(join(folder, 'logo.json'), 'utf8'));
  for (const name of SVGS) assert.match(readFileSync(join(folder, name), 'utf8'), /^\s*(?:<\?xml[^>]*>\s*)?<svg\b/, `${folder}/${name} is an SVG`);
  for (const n of SIZES) assert.deepEqual(size(readFileSync(join(folder, `icon-${n}.png`))), [n, n], `${folder}/icon-${n}.png is ${n} px`);
  const ico = readFileSync(join(folder, 'favicon.ico'));
  assert.deepEqual([ico.readUInt16LE(2), ico.readUInt16LE(4)], [1, 3], 'favicon.ico holds three icons');
  [16, 32, 48].forEach((n, k) => { const at = ico.readUInt32LE(18 + 16 * k), len = ico.readUInt32LE(14 + 16 * k); assert.deepEqual(ico.subarray(at, at + len), readFileSync(join(folder, `icon-${n}.png`))); });
  assert.equal(logo.checks.icon.full_bleed, true);
  return { n: i + 1, file, folder, logo, sha256: hash(readFileSync(file)) };
});
writeFileSync(join(support, 'source.json'), JSON.stringify({ source: resolve(source), retained: true, options: options.map(({ n, file, logo, sha256 }) => ({ n, file, sha256, model: logo.model, direction: logo.direction, checks: logo.checks })) }, null, 2));

const page = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><style>body{margin:0;padding:24px;background:#f2f1ee;color:#1b1b1a;font:15px/1.4 system-ui,sans-serif}h1{font-size:20px;margin:0 0 4px}p{margin:0 0 20px;color:#55554f}
.row{display:flex;flex-wrap:wrap;gap:24px;align-items:flex-end}figure{margin:0}figcaption{margin-top:6px;font-size:13px;color:#55554f}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.tile{box-sizing:border-box;height:160px;padding:20px;border:1px solid #d9d7d0}.tile img{display:block;width:100%;height:100%;object-fit:contain}.white{background:#fff}.black{background:#121212;border-color:#121212}</style></head><body>${body}</body></html>`;
const label = (o) => `Option ${o.n}${o.logo.direction ? `: ${o.logo.direction.split(':')[0]}` : ''}`;
let view;
try {
  for (const o of options) {
    writeFileSync(join(support, `icons-${o.n}.html`), page(`${label(o)} icon set`, `<h1>${label(o)}: the app icon set</h1><p>Every PNG from ${basename(o.folder)}/ at its real size, drawn by Chrome from icon.svg; favicon.ico holds the 16, 32 and 48 px files.</p>
<div class="row">${SIZES.map((n) => `<figure><img src="file://${o.folder}/icon-${n}.png" width="${n}" height="${n}" alt="${n} px"><figcaption>icon-${n}.png, ${n} px</figcaption></figure>`).join('')}</div>`));
    writeFileSync(join(support, `svgs-${o.n}.html`), page(`${label(o)} SVG files`, `<h1>${label(o)}: the SVG files</h1><p>Each file from ${basename(o.folder)}/ alone: the light files on white, the -dark files on near-black, the icon on both.</p>
<div class="grid">${SVGS.flatMap((name) => (name === 'icon.svg' ? ['white', 'black'] : [name.endsWith('-dark.svg') ? 'black' : 'white']).map((tile) => `<figure><div class="tile ${tile}"><img src="file://${o.folder}/${name}" alt="${name}"></div><figcaption>${name} on ${tile === 'white' ? 'white' : 'near-black'}</figcaption></figure>`)).join('')}</div>`));
  }
  view = spawn(process.execPath, [join(root, 'src/cli.mjs'), 'view', resolve(source), '--host', '127.0.0.1', '--port', '0'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  const url = await new Promise((ok, no) => { let text = ''; const timer = setTimeout(() => no(Error('View startup deadline')), 15_000); view.stdout.on('data', (b) => { text += b; if (text.includes('\n')) { clearTimeout(timer); const r = JSON.parse(text); r.viewing ? ok(r.viewing.url) : no(Error(r.error?.message || text)); } }); view.once('exit', (code) => { clearTimeout(timer); no(Error(`View exited ${code}`)); }); view.once('error', no); });
  const metrics = [];
  // One owned browser per width and theme, as a person opens the view on a phone or a desktop.
  const session = (name, width, height, theme, shots) => {
    env.CHROME_DEVTOOLS_AXI_SESSION = `fd-logo-${process.pid}-${name}`;
    env.CHROME_DEVTOOLS_AXI_USER_DATA_DIR = join(dir, name);
    const browser = (...args) => run('chrome-devtools-axi', args);
    try {
      const id = browser('pages').match(/^\s*(\d+),about:blank,/m)?.[1]; assert.ok(id, 'Fresh owned browser must expose its blank page');
      browser('selectpage', id);
      browser('emulate', '--viewport', `${width}x${height}x1`, '--color-scheme', theme);
      browser('resize', String(width), String(height));
      for (const [shot, target, full] of shots) {
        browser('open', target);
        const metric = browser('eval', `async()=>{await new Promise(r=>setTimeout(r,2500));await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const broken=[...document.images].filter(i=>!i.naturalWidth).length;if(innerWidth!==${width}||document.documentElement.scrollWidth>innerWidth||broken)throw Error('The page did not settle at ${width}px with every image loaded: '+broken+' broken');return{width:innerWidth,theme:matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light',frames:document.querySelectorAll('iframe').length,images:document.images.length}}`);
        browser('screenshot', join(out, shot), ...(full ? ['--full-page'] : []));
        metrics.push({ shot, target: target.replace(/^file:\/\/.*\//, ''), metric });
        console.log(`captured ${shot}`);
      }
    } finally { browser('stop'); }
  };
  for (const theme of ['light', 'dark']) for (const width of [390, 1280]) {
    session(`${theme}-${width}`, width, width === 390 ? 844 : 800, theme, [[`picker-${width}-${theme}.png`, `${url}#/`], ...options.map((o) => [`studio-${o.n}-${width}-${theme}.png`, `${url}#/o/${o.n}`])]);
  }
  session('sheets', 1280, 800, 'light', options.flatMap((o) => [[`icons-${o.n}.png`, `file://${join(support, `icons-${o.n}.html`)}`, true], [`svgs-${o.n}.png`, `file://${join(support, `svgs-${o.n}.html`)}`, true]]));
  writeFileSync(join(support, 'metrics.json'), JSON.stringify(metrics, null, 2));
  writeFileSync(join(out, 'steps.json'), JSON.stringify({ target: { version: run('git', ['-C', root, 'rev-parse', 'HEAD']).trim() },
    start: `Retained real logo run: ${options.length} options made by ${options[0].logo.agent} / ${options[0].logo.model}; no model call during this run.`,
    steps: ['Check each option\'s .logo folder: the 9 SVG files, the icon PNGs at the size each name says, favicon.ico holding the 16, 32 and 48 px PNGs, and logo.json.',
      'Start the real CLI viewer on a private loopback port with an isolated configuration.',
      'Open the option picker and each option\'s Studio in owned browsers at phone 390 and desktop 1280, each in light and dark, and capture each whole viewport.',
      'Open every icon PNG at its real size and every SVG file alone on the tile it is for (light files on white, -dark files on near-black, the icon on both), and capture each page whole.'],
    result: `The first-draft viewer shows ${options.length} logo options in the picker and each option's brand sheet in the Studio at phone 390 and desktop 1280, light and dark; each option's icon set renders at 16 to 1024 px and each of its 9 SVG files reads alone on the tile it is for.` }, null, 2));
} finally { view?.kill(); rmSync(dir, { recursive: true, force: true }); }
