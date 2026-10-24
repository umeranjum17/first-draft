// Nonpaid recapture of a retained real `logo` run (FD_LOGO_SOURCE: the --out path given to logo, or its folder); no model call. Run through done-done.
// It checks each option's .logo/ folder (9 SVGs, palette.json, the icon PNGs at the size their name says, favicon.ico with the 16/32/48 PNGs,
// the critic's boards, logo.json with the concept, the explored concepts, the critique and the palette) and that each sheet carries its idea and palette,
// then captures the real viewer whole: the option picker and each option's Studio at phone 360, 390 and 445 and desktop 1280 and 1440, light and dark (picker-<width>-<theme>.png,
// studio-<n>-<width>-<theme>.png), and, per option, the icon set with every PNG at its real size (icons-<n>.png) and every SVG file alone
// on the tile it is for, light files on white and -dark files on near-black (svgs-<n>.png); the explored concepts with the board the critic saw
// (explored.png), and per option its concept, palette and final critique with its board (critique-<n>.png). Source hashes, the evidence
// pages and measurements go to the sibling -support folder.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { basename, join, resolve } from 'node:path';
import { KIND_LABELS, SIZES, SVGS, logoDir } from '../src/logo.mjs';
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
// A port the OS says is free, for each browser session's bridge: the port chrome-devtools-axi derives from a session name can already be
// held by another lane's bridge on a shared host.
const freePort = () => new Promise((ok, no) => { const s = createServer().once('error', no).listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => ok(port)); }); });

// The files as a user receives them, checked before anything is captured.
const options = files.map((file, i) => {
  const folder = logoDir(file), logo = JSON.parse(readFileSync(join(folder, 'logo.json'), 'utf8'));
  for (const name of SVGS) assert.match(readFileSync(join(folder, name), 'utf8'), /^\s*(?:<\?xml[^>]*>\s*)?<svg\b/, `${folder}/${name} is an SVG`);
  for (const n of SIZES) assert.deepEqual(size(readFileSync(join(folder, `icon-${n}.png`))), [n, n], `${folder}/icon-${n}.png is ${n} px`);
  const ico = readFileSync(join(folder, 'favicon.ico'));
  assert.deepEqual([ico.readUInt16LE(2), ico.readUInt16LE(4)], [1, 3], 'favicon.ico holds three icons');
  [16, 32, 48].forEach((n, k) => { const at = ico.readUInt32LE(18 + 16 * k), len = ico.readUInt32LE(14 + 16 * k); assert.deepEqual(ico.subarray(at, at + len), readFileSync(join(folder, `icon-${n}.png`))); });
  assert.equal(logo.checks.icon.full_bleed, true);
  assert.ok(logo.concept?.idea && logo.explored?.length >= 6 && logo.critique?.length && typeof logo.passed === 'boolean' && logo.palette?.reason, `${folder}/logo.json has the concept, the explored concepts, the critique and the palette`);
  for (const name of ['palette.json', 'concepts.png', 'critique.png']) assert.ok(existsSync(join(folder, name)), `${folder}/${name}`);
  const sheet = readFileSync(file, 'utf8');
  assert.ok(sheet.includes('<!--logo:idea-->') && sheet.includes('<!--logo:palette-->'), `${file} shows its idea and palette`);
  assert.equal(sheet.includes('Did not pass the self-critique.'), !logo.passed, `${file} says whether its mark passed the self-critique`);
  // A run whose concepts come from territories (logo.json concept.territory) labels each sheet with its kind of mark over the idea.
  const labelled = !!logo.concept.territory;
  if (labelled) assert.match(sheet, new RegExp(`<!--logo:idea--><small[^>]*>${KIND_LABELS[logo.concept.kind]}</small>`), `${file} labels its kind of mark over the idea`);
  return { n: i + 1, file, folder, logo, labelled, sha256: hash(readFileSync(file)) };
});
writeFileSync(join(support, 'source.json'), JSON.stringify({ source: resolve(source), retained: true, options: options.map(({ n, file, logo, sha256 }) => ({ n, file, sha256, model: logo.model, concept: logo.concept?.name, idea: logo.concept?.idea, palette: logo.palette, critique: logo.critique, checks: logo.checks })) }, null, 2));

const page = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><style>body{margin:0;padding:24px;background:#f2f1ee;color:#1b1b1a;font:15px/1.4 system-ui,sans-serif}h1{font-size:20px;margin:0 0 4px}p{margin:0 0 20px;color:#55554f}
.row{display:flex;flex-wrap:wrap;gap:24px;align-items:flex-end}figure{margin:0}figcaption{margin-top:6px;font-size:13px;color:#55554f}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.tile{box-sizing:border-box;height:160px;padding:20px;border:1px solid #d9d7d0}.tile img{display:block;width:100%;height:100%;object-fit:contain}.white{background:#fff}.black{background:#121212;border-color:#121212}</style></head><body>${body}</body></html>`;
const label = (o) => `Option ${o.n}: ${o.logo.concept.name}`;
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
let view;
try {
  const explored = options[0].logo.explored;
  writeFileSync(join(support, 'explored.html'), page('Explored concepts', `<h1>${explored.length} concepts explored for "${esc(options[0].logo.brief)}"</h1><p>Each concept's one-line idea, kind, where in the brief it comes from, its base shape, the critic's reading at 32 and 16 px, its verdict and what the selection did with it; below, the board the critic saw (${basename(options[0].folder)}/concepts.png).</p>
<table style="border-collapse:collapse;width:100%;font-size:13px;margin-bottom:20px">${['#', 'Round', 'Concept', 'Kind', 'From the brief', 'Idea', 'Base shape', 'Palette', 'Critic sees', 'Verdict', 'Flaws', 'Status'].map((h) => `<th style="text-align:left;border-bottom:2px solid #999;padding:4px">${h}</th>`).join('')}${explored.map((k) => `<tr>${[k.id, k.round ?? 1, k.name, k.kind, k.from ?? '', k.idea, k.base ? `${k.base}${k.base_seen && k.base_seen !== k.base ? ` (critic: ${k.base_seen})` : ''}` : '', k.palette, k.reads_as, k.verdict && `${k.verdict} ${k.score ?? ''}`, (k.flaws ?? []).join('; '), k.status].map((v) => `<td style="vertical-align:top;border-bottom:1px solid #ccc;padding:4px">${esc(v)}</td>`).join('')}</tr>`).join('')}</table>
<img src="file://${options[0].folder}/concepts.png" alt="The concept sketches as the critic saw them" style="max-width:100%">${existsSync(join(options[0].folder, 'concepts-round2.png')) ? `<p>Second round (${esc(options[0].logo.second_round?.reason)}):</p><img src="file://${options[0].folder}/concepts-round2.png" alt="The second round's sketches as the critic saw them" style="max-width:100%">` : ''}`));
  for (const o of options) {
    const swatches = (set) => ['primary', 'accent', 'neutral'].map((role) => `<span style="display:inline-block;width:22px;height:22px;border-radius:4px;vertical-align:middle;background:${o.logo.palette[set][role]}"></span> ${role} ${o.logo.palette[set][role]} (${o.logo.palette.contrast[set][role]}:1)`).join(' &nbsp; ');
    writeFileSync(join(support, `critique-${o.n}.html`), page(`${label(o)} critique`, `<h1>${esc(label(o))} (${esc(o.logo.concept.kind)})</h1><p>${esc(o.logo.concept.idea)}</p><p><b>${o.logo.passed ? 'Passed the self-critique.' : 'Did not pass the self-critique: shown as the best attempt.'}</b></p>
<p><b>Palette:</b> ${esc(o.logo.palette.reason)}<br>light: ${swatches('light')}<br>dark: ${swatches('dark')}</p>
<ol>${o.logo.critique.map((c) => `<li>${esc(c.round)} look: <b>${esc(c.verdict)}</b> (score ${c.score} of 10 beside the best of its class${o.logo.baseline && typeof o.logo.baseline === 'string' ? ' and the baseline' : ''}${c.compared ? `: ${esc(c.compared)}` : ''}); a stranger sees "${esc(c.reads_as)}"${c.flaws.length ? `; ${esc(c.flaws.join('; '))}` : ''}${c.fix ? `. ${esc(c.fix)}` : ''}</li>`).join('')}</ol>
<p><b>Image first:</b> ${o.logo.exploration?.image ? `${esc(o.logo.exploration.provider)} made this raster of the concept (${o.logo.exploration.seconds} s), which the engine redrew as SVG: <br><img src="file://${o.folder}/exploration.webp" alt="The image model's exploration of the concept" style="max-width:240px"><br>${esc(o.logo.exploration.prompt)}` : esc(o.logo.exploration?.error ?? o.logo.exploration ?? 'no image (this run is from before image-first exploration)')}</p>
<p><b>Time:</b> ${esc(JSON.stringify(o.logo.timing ?? {}))}${o.logo.second_round ? `<br><b>Second round:</b> ${esc(JSON.stringify(o.logo.second_round))}` : ''}</p>
<p>16 px detail of icon.svg: ${JSON.stringify(o.logo.checks.detail_16['icon.svg'])}</p>
<img src="file://${o.folder}/critique.png" alt="The finished mark and icon as the critic saw them" style="max-width:100%">`));
    writeFileSync(join(support, `icons-${o.n}.html`), page(`${label(o)} icon set`, `<h1>${label(o)}: the app icon set</h1><p>Every PNG from ${basename(o.folder)}/ at its real size, drawn by Chrome from icon.svg; favicon.ico holds the 16, 32 and 48 px files.</p>
<div class="row">${SIZES.map((n) => `<figure><img src="file://${o.folder}/icon-${n}.png" width="${n}" height="${n}" alt="${n} px"><figcaption>icon-${n}.png, ${n} px</figcaption></figure>`).join('')}</div>`));
    writeFileSync(join(support, `svgs-${o.n}.html`), page(`${label(o)} SVG files`, `<h1>${label(o)}: the SVG files</h1><p>Each file from ${basename(o.folder)}/ alone: the light files on white, the -dark files on near-black, the icon on both.</p>
<div class="grid">${SVGS.flatMap((name) => (name === 'icon.svg' ? ['white', 'black'] : [name.endsWith('-dark.svg') ? 'black' : 'white']).map((tile) => `<figure><div class="tile ${tile}"><img src="file://${o.folder}/${name}" alt="${name}"></div><figcaption>${name} on ${tile === 'white' ? 'white' : 'near-black'}</figcaption></figure>`)).join('')}</div>`));
  }
  view = spawn(process.execPath, [join(root, 'src/cli.mjs'), 'view', resolve(source), '--host', '127.0.0.1', '--port', '0'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  const url = await new Promise((ok, no) => { let text = ''; const timer = setTimeout(() => no(Error('View startup deadline')), 15_000); view.stdout.on('data', (b) => { text += b; if (text.includes('\n')) { clearTimeout(timer); const r = JSON.parse(text); r.viewing ? ok(r.viewing.url) : no(Error(r.error?.message || text)); } }); view.once('exit', (code) => { clearTimeout(timer); no(Error(`View exited ${code}`)); }); view.once('error', no); });
  const metrics = [];
  // One owned browser per width and theme, as a person opens the view on a phone or a desktop.
  const session = async (name, width, height, theme, shots) => {
    env.CHROME_DEVTOOLS_AXI_SESSION = `fd-logo-${process.pid}-${name}`;
    env.CHROME_DEVTOOLS_AXI_PORT = String(await freePort());
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
  // Phone and desktop frames a person meets: 360x800, 390x844, 445x965, 1280x800 and 1440x900.
  for (const theme of ['light', 'dark']) for (const [width, height] of [[360, 800], [390, 844], [445, 965], [1280, 800], [1440, 900]]) {
    await session(`${theme}-${width}`, width, height, theme, [[`picker-${width}-${theme}.png`, `${url}#/`], ...options.map((o) => [`studio-${o.n}-${width}-${theme}.png`, `${url}#/o/${o.n}`])]);
  }
  await session('sheets', 1280, 800, 'light', [['explored.png', `file://${join(support, 'explored.html')}`, true], ...options.flatMap((o) => [[`critique-${o.n}.png`, `file://${join(support, `critique-${o.n}.html`)}`, true], [`icons-${o.n}.png`, `file://${join(support, `icons-${o.n}.html`)}`, true], [`svgs-${o.n}.png`, `file://${join(support, `svgs-${o.n}.html`)}`, true]])]);
  writeFileSync(join(support, 'metrics.json'), JSON.stringify(metrics, null, 2));
  writeFileSync(join(out, 'steps.json'), JSON.stringify({ target: { version: run('git', ['-C', root, 'rev-parse', 'HEAD']).trim() },
    start: `Retained real logo run: ${options.length} options made by ${options[0].logo.agent} / ${options[0].logo.model}; no model call during this run.`,
    steps: [`Check each option's .logo folder: the 9 SVG files, palette.json, the icon PNGs at the size each name says, favicon.ico holding the 16, 32 and 48 px PNGs, the critic's boards, and logo.json with the concept, the explored concepts, a kept critique and the palette; and that each sheet carries its idea and palette${options.every((o) => o.labelled) ? ', with its kind label over the idea' : ''}.`,
      'Start the real CLI viewer on a private loopback port with an isolated configuration.',
      'Open the option picker and each option\'s Studio in owned browsers at phone 360, 390 and 445 and desktop 1280 and 1440, each in light and dark, and capture each whole viewport.',
      'Open the explored concepts with the board the critic saw, and per option its concept, palette and critique with its board, and capture each page whole.',
      'Open every icon PNG at its real size and every SVG file alone on the tile it is for (light files on white, -dark files on near-black, the icon on both), and capture each page whole.'],
    result: `${explored.length} concepts were explored and critiqued; the first-draft viewer shows ${options.length} logo options in the picker and each option's brand sheet, with its ${options.every((o) => o.labelled) ? 'kind label, ' : ''}idea and palette, in the Studio at phone 360, 390 and 445 and desktop 1280 and 1440, light and dark; each option's icon set renders at 16 to 1024 px and each of its 9 SVG files reads alone on the tile it is for.` }, null, 2));
} finally { view?.kill(); rmSync(dir, { recursive: true, force: true }); }
