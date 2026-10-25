// Live benchmark of one flow brief: "mobile onboarding flow, 6 screens, mindfulness app called mellow" (the owner's mellow reference, 25 Oct
// 2026). make draws the flow with the one-shell contract and, through the Codex image route, one character style sheet and one scene per screen
// drawn from it; the Studio captures every screen at phone width, and the report puts them beside the reference, scored by the critic.
// --capture-only with FD_FLOW_SOURCE=<folder holding the option html and make.json> reruns the captures and the report without a model or an
// image call (the nonpaid recapture). No generated sample is a README or landing sample: this writes only into the evidence folder.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

const out = process.env.DONE_DONE_EVIDENCE_ROOT ?? process.argv[2], source = process.env.FD_FLOW_SOURCE, capture = process.argv.includes('--capture-only');
const root = new URL('..', import.meta.url).pathname, scan = process.env.FD_ONBOARDING_REF;
const BRIEF = 'mobile onboarding flow, 6 screens, mindfulness app called mellow: one little hand-drawn character (ink line and a soft watercolour wash) on every screen in its own pose, a warm cream ground with sage and a soft peach accent, a big friendly headline and one short supporting line, warm and calm';
if (capture ? !source : !(process.env.FD_DESIGN_AGENT && process.env.FD_DESIGN_MODEL)) throw new Error(capture ? '--capture-only needs FD_FLOW_SOURCE=<folder with the option html and make.json>' : 'Need DONE_DONE_EVIDENCE_ROOT and an approved FD_DESIGN_AGENT and FD_DESIGN_MODEL');
if (!capture && !scan) throw new Error('Set FD_ONBOARDING_REF to the owner reference image the flow is judged beside');
if (!out) throw new Error('Give an evidence folder: $DONE_DONE_EVIDENCE_ROOT or the first argument');
mkdirSync(out, { recursive: true });
const d = mkdtempSync(join(tmpdir(), 'fd-flow-')), support = resolve(out, '..', `${basename(out)}-support`);
mkdirSync(support, { recursive: true });
const env = { ...process.env, FIRST_DRAFT_HOME: join(d, 'home'), CHROME_DEVTOOLS_AXI_SESSION: `fd-flow-${process.pid}`, CHROME_DEVTOOLS_AXI_USER_DATA_DIR: join(d, 'browser') };
const run = (bin, args) => execFileSync(bin, args, { env, encoding: 'utf8', timeout: 3_600_000, maxBuffer: 8_000_000 });
const cli = (...args) => run(process.execPath, [join(root, 'src/cli.mjs'), ...args]);
let view;
try {
  let file, made;
  if (capture) {
    file = resolve(source, readdirSync(source).find((f) => /\.html?$/i.test(f)) ?? '');
    made = JSON.parse(readFileSync(join(source, 'make.json'), 'utf8')).made;
  } else {
    file = join(support, 'mellow.html');
    cli('init', '--agent', process.env.FD_DESIGN_AGENT, '--model', process.env.FD_DESIGN_MODEL);
    // What a person would ask for: the brief and their reference picture, never a provider, a tool or a model.
    const args = ['make', BRIEF, '--out', file, '--options', '1', '--ref', resolve(scan), '--assets', 'codex'];
    const preview = cli(...args); writeFileSync(join(support, 'preview.json'), preview);
    assert.ok(JSON.parse(preview).asset_preview.per_option >= 7, 'a 6-screen flow previews one style sheet and one picture per screen');
    const result = cli(...args, '--allow-asset-spend'); writeFileSync(join(support, 'make.json'), result);
    made = JSON.parse(result).made;
    assert.equal(made.render_check, 'checked');
  }
  assert.equal(made.files.length, 1, 'a flow is one file whose screens are sections');
  const html = readFileSync(file, 'utf8');
  const screens = [...html.matchAll(/<(\w+)\b[^>]*data-oc-screen=["']([^"']+)["']/g)].map((m) => m[2]);
  assert.equal(screens.length, 6, `the flow has six screens (${screens.join(', ')})`);
  const images = made.files[0].images ?? [];
  if (!capture) {
    assert.ok(images.some((i) => i.sheet), 'the first image is the character style sheet');
    assert.ok(images.filter((i) => i.style_sheet).length === screens.length, 'every later scene is drawn from the style sheet');
  }
  writeFileSync(join(support, 'source.json'), JSON.stringify({ file, sha256: createHash('sha256').update(html).digest('hex'), screens, generatedNow: !capture }, null, 2));
  // The real viewer: first-draft-axi view on a private port, every screen at phone width in the Studio.
  view = spawn(process.execPath, [join(root, 'src/cli.mjs'), 'view', file, '--host', '127.0.0.1', '--port', '0'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  const url = await new Promise((ok, fail) => { let log = ''; view.stdout.on('data', (c) => { log += c; const m = log.match(/"url":"([^"]+)"/); if (m) ok(m[1]); }); view.once('exit', (code) => fail(new Error(`view exited ${code}: ${log}`))); });
  const browser = (...args) => run('chrome-devtools-axi', args);
  const shot = (target, path) => { browser('open', target); browser('wait', '2500'); browser('screenshot', path); return `data:image/png;base64,${readFileSync(path).toString('base64')}`; };
  const frames = [];
  for (const [i, screen] of screens.entries()) {
    browser('emulate', '--viewport', '390x900x1', '--color-scheme', 'light');
    frames.push({ screen, light: shot(`${url}?screen=${encodeURIComponent(screen)}#/o/1`, join(out, `flow-${i + 1}-${screen}-390-light.png`)) });
  }
  // The same frames at desktop width and in dark, so the flow is proven at both sizes and themes as well as in the report.
  for (const screen of screens) {
    browser('emulate', '--viewport', '1280x900x1', '--color-scheme', 'light');
    shot(`${url}?screen=${encodeURIComponent(screen)}#/o/1`, join(out, `flow-${screen}-1280-light.png`));
    browser('emulate', '--viewport', '390x900x1', '--color-scheme', 'dark');
    shot(`${url}?screen=${encodeURIComponent(screen)}#/o/1`, join(out, `flow-${screen}-390-dark.png`));
    browser('emulate', '--viewport', '1280x900x1', '--color-scheme', 'dark');
    shot(`${url}?screen=${encodeURIComponent(screen)}#/o/1`, join(out, `flow-${screen}-1280-dark.png`));
  }
  // The plain one-prompt page the critic scored beside the flow, for the report's comparison.
  const plain = made.critic?.plain;
  let plainShot = null;
  if (plain && existsSync(plain)) { browser('emulate', '--viewport', '390x900x1', '--color-scheme', 'light'); plainShot = shot(`file://${plain}`, join(out, 'plain-390-light.png')); }
  const critique = made.files[0].critique;
  const ref = scan && existsSync(scan) ? `data:image/${resolve(scan).toLowerCase().endsWith('.png') ? 'png' : 'jpeg'};base64,${readFileSync(resolve(scan)).toString('base64')}` : null;
  const flow = critique.flow ? `shell ${critique.flow.shell.score}/10, character ${critique.flow.character.score}/10` : 'no flow score';
  const judge = critique.judge ?? '';
  const report = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>mellow onboarding flow: first-draft beside the reference</title>
<style>:root{color-scheme:light dark;--ink:#221f1c;--paper:#f6f1e8;--soft:#6b6259;--line:#ddd3c4;--sage:#8a9a7b;--peach:#e6b49a}@media(prefers-color-scheme:dark){:root{--ink:#f2ede4;--paper:#1a1816;--soft:#a49a8f;--line:#3a352f}}
body{margin:0;padding:32px clamp(16px,4vw,56px) 48px;background:var(--paper);color:var(--ink);font:16px/1.55 ui-serif,Georgia,serif}h1{font-size:clamp(22px,2.4vw,32px);margin:0 0 4px;max-width:22ch}h2{font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--soft);margin:0 0 12px;font-family:ui-sans-serif,system-ui,sans-serif}
.brief{color:var(--soft);max-width:70ch;margin:0 0 28px}
.row{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,2fr);gap:clamp(20px,3vw,44px);align-items:start}
.screens{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.screens img{border:1px solid var(--line);border-radius:12px;width:100%;height:auto;display:block;background:#fff}
.ref img{width:100%;height:auto;border:1px solid var(--line);border-radius:12px;display:block}
.score{font:700 clamp(40px,6vw,72px)/1 ui-serif,Georgia,serif;margin:16px 0 2px;letter-spacing:-.03em}
.score small{font-size:.36em;color:var(--soft);font-weight:400;letter-spacing:0}
.note{color:var(--soft);font:13px/1.5 ui-sans-serif,system-ui,sans-serif;margin:0;max-width:46ch}
.winner{margin:32px 0 0;padding:18px 22px;border-left:3px solid var(--sage);background:color-mix(in srgb,var(--peach) 14%,transparent);font-size:clamp(17px,1.7vw,22px);max-width:88ch}
.limits{color:var(--soft);font:13px/1.6 ui-sans-serif,system-ui,sans-serif;margin:24px 0 0;max-width:96ch}
figcaption{color:var(--soft);font:12px/1.4 ui-sans-serif,system-ui,sans-serif;margin-top:6px}
</style></head><body>
<h1>mellow onboarding flow, made by first-draft</h1>
<p class="brief">${BRIEF}</p>
<div class="row">
<section><h2>first-draft, six screens</h2><div class="screens">${frames.map((f) => `<figure style="margin:0"><img src="${f.light}" alt="${f.screen}"><figcaption>${f.screen}</figcaption></figure>`).join('')}</div>
<p class="score">${critique.score}<small>/10</small></p>
<p class="note">${made.model} (${made.agent}) · ${made.seconds}s · flow ${flow} · plain one-prompt page ${critique.plain_score}/10${plainShot ? '' : ' (not captured)'} · ${judge.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>
${plainShot ? `<p class="note">the plain page the critic scored beside it at 390:</p><img src="${plainShot}" alt="the plain one-prompt page" style="width:min(220px,100%);border:1px solid var(--line);border-radius:10px;display:block;margin-top:8px">` : ''}
</section>
<section class="ref"><h2>the reference</h2>${ref ? `<img src="${ref}" alt="the owner's mellow onboarding reference, six screens">` : '<p class="note">no reference image in this recapture</p>'}<p class="score">10<small>/10 · target</small></p><p class="note">the owner's mellow onboarding reference, 25 Oct 2026: one ink-line mascot with a soft wash on every screen, cream ground with sage and peach, one shared shell. Owner-defined target; model and creation time unknown.</p></section>
</div>
<p class="winner">${critique.score >= 10 ? 'Winner: tie with the reference target.' : 'Winner: the reference target.'} first-draft ${critique.score}/10 against ${critique.plain_score}/10 for the plain one-prompt page${critique.flow ? `, with its shell at ${critique.flow.shell.score} and its character at ${critique.flow.character.score}` : ''}: ${critique.passed ? 'it passes' : 'it does not pass'} beside the reference.</p>
<p class="limits">One live run of one brief: a single sample, not a benchmark average. Scores are the critic's: ${judge.startsWith('independent') ? 'an independent judge that did not make the design' : 'the generator scoring itself, because no independent judge on another model was available'}.${critique.fix ? ` What would bring it to 10: ${critique.fix.replace(/&/g, '&amp;').replace(/</g, '&lt;')}` : ''} The captures are the Studio at phone width 390 (and desktop 1280, dark, in the evidence folder), not a phone.</p>
</body></html>`;
  writeFileSync(join(out, 'report.html'), report);
  writeFileSync(join(out, 'steps.json'), JSON.stringify({ target: { version: run('git', ['-C', root, 'rev-parse', 'HEAD']).trim() },
    engine: { agent: made.agent ?? process.env.FD_DESIGN_AGENT, model: made.model ?? process.env.FD_DESIGN_MODEL },
    start: capture ? 'Nonpaid recapture of a retained real flow output; no design or image generation this run' : `Installed signed-in ${process.env.FD_DESIGN_AGENT} and the Codex image route, fresh First Draft config`,
    steps: [...(capture ? [] : [`Preview the per-image cost of the flow's ${screens.length + 1} images without generation`, 'Approve the asset spend and make the 6-screen onboarding flow from the brief and the owner reference; the design agent draws the character style sheet first, then each screen drawn from it']),
      `Open the flow in first-draft-axi view and capture each of the ${screens.length} screens in the Studio at phone 390 (light), at desktop 1280 (light) and at both widths in dark`,
      'Render the report: the six screens beside the reference, the critic score under each board, the model and seconds under it'],
    result: `The onboarding flow is one file of ${screens.length} screens (${screens.join(', ')}) on one shell, each screen showing the same character in its own scene; the critic scored it ${critique.score}/10 against the plain page's ${critique.plain_score}/10${critique.flow ? `, with the shell at ${critique.flow.shell.score} and the character at ${critique.flow.character.score}` : ''}.` }, null, 2));
  console.log(JSON.stringify({ flow: { file, screens, report: join(out, 'report.html'), captures: frames.length * 4 + (plainShot ? 1 : 0), score: critique.score, plain: critique.plain_score, passed: critique.passed, judge } }));
} finally {
  view?.kill();
  try { run('chrome-devtools-axi', ['stop']); } catch { /* No browser may have started when generation fails. */ }
  rmSync(d, { recursive: true, force: true });
}
