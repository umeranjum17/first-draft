#!/usr/bin/env node
// A paired comparison for docs/wrapper-allowlist.json: the same brief, the same model, rendered at 1280 and 390 side by side.
//   node scripts/compare.mjs "<brief>" --out <folder> [--model <id>]     writes plain.html (the model's one plain call) and
//        make.html (this checkout's default make, one option), renders both and prints where the side-by-side page is
//   node scripts/compare.mjs "<brief>" --out <folder> --pages name=a.html name=b.html   renders pages you already have (no model call):
//        for a branch against main, or the plain model against a pull request's page
// The model is the one `first-draft-axi init` configured (or --model on that route). Score the two renders yourself, beside each other,
// then put the scores in the allow-list entry (CONTRIBUTING.md). A single pair is not enough: repeat on at least two briefs.
import { execFile } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { promisify } from 'node:util';
import { writePage } from '../src/byokit.mjs';
import { renderCheck } from '../src/render-check.mjs';

const { values, positionals } = parseArgs({ allowPositionals: true, options: { out: { type: 'string' }, model: { type: 'string' }, pages: { type: 'boolean' } } });
const fail = (message) => { console.log(JSON.stringify({ error: { code: 'USAGE', message } })); process.exit(1); };
if (!values.out || !positionals.length) fail('usage: compare.mjs "<brief>" --out <folder> [--model <id>] | --pages name=file.html name=file.html');
const out = resolve(values.out), [brief, ...rest] = positionals;
mkdirSync(out, { recursive: true });

const variants = [];
if (values.pages) {
  if (rest.length < 2 || rest.some((p) => !/^[\w-]+=.+/.test(p))) fail('--pages takes two or more name=file.html');
  for (const spec of rest) { const [name, file] = [spec.slice(0, spec.indexOf('=')), spec.slice(spec.indexOf('=') + 1)]; variants.push({ name, html: readFileSync(resolve(file), 'utf8') }); }
} else {
  const home = process.env.FIRST_DRAFT_HOME || join(homedir(), '.first-draft');
  let config;
  try { config = JSON.parse(readFileSync(join(home, 'config.json'), 'utf8')); } catch { fail(`no ${join(home, 'config.json')}: run first-draft-axi init --agent byokit:<route> --model <model> first`); }
  const route = config.agent?.match(/^byokit:(.+)/)?.[1], model = values.model ?? config.agent_config?.[config.agent]?.model;
  if (!route || !model) fail('compare needs a byokit route and a model: run first-draft-axi init, or pass --model');
  const timeoutMs = 10 * 60_000;
  // The plain side: the brief and nothing else, the model's own defaults.
  let since = Date.now();
  const plain = await writePage({ route, model, system: 'You are a helpful assistant.', prompt: `Build one self-contained HTML page for this brief: ${brief}. Reply with only the complete HTML document, nothing else.`, timeoutMs, signal: AbortSignal.timeout(timeoutMs) });
  variants.push({ name: 'plain', html: plain.html, seconds: Math.round((Date.now() - since) / 1000), tokens_out: plain.tokens_out });
  since = Date.now();
  const file = join(out, 'make.html');
  const { stdout } = await promisify(execFile)(process.execPath, [new URL('../src/cli.mjs', import.meta.url).pathname, 'make', brief, '--out', file, '--options', '1', '--model', model], { maxBuffer: 64 << 20, timeout: 3 * timeoutMs });
  const made = JSON.parse(stdout).made;
  variants.push({ name: 'make', html: readFileSync(file, 'utf8'), seconds: Math.round((Date.now() - since) / 1000), tokens_out: made.tokens_out, critic_score: made.files[0].critique?.score, timing: made.timing });
}

const render = renderCheck();
try {
  for (const v of variants) {
    writeFileSync(join(out, `${v.name}.html`), v.html);
    for (const shot of await render.shoot(v.html, 1700)) {
      const file = join(out, `${v.name}-${shot.width}.png`);
      writeFileSync(file, Buffer.from(shot.dataUrl.slice(shot.dataUrl.indexOf(',') + 1), 'base64'));
      v[shot.width >= 1000 ? 'desktop' : 'phone'] = file;
    }
  }
} finally { render.close(); }
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const facts = (v) => [v.seconds !== undefined && `${v.seconds} s`, v.tokens_out && `${v.tokens_out} tokens out`, v.critic_score !== undefined && `critic ${v.critic_score}/10`].filter(Boolean).join(' · ');
const side = join(out, 'compare.html');
writeFileSync(side, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Paired comparison</title>
<style>body{margin:0;padding:24px;font:15px/1.5 system-ui,sans-serif;background:#f6f6f4;color:#1b1b1a}h1{font-size:20px;margin:0 0 4px}.cols{display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start;margin-top:16px}section{background:#fff;border:1px solid #ddd;border-radius:10px;padding:12px}h2{font-size:16px;margin:0}.pair{display:flex;gap:12px;align-items:flex-start;margin-top:8px}img{display:block;border:1px solid #ccc}.d{width:560px}.p{width:170px}p{margin:2px 0 0;color:#555;font-size:13px}</style></head><body>
<h1>${esc(brief)}</h1><p>Same brief and model for every column. Desktop 1280 and phone 390, light, the top of each page. Score each, then write it in docs/wrapper-allowlist.json.</p>
<div class="cols">${variants.map((v) => `<section><h2>${esc(v.name)}</h2><p>${esc(facts(v))}</p><div class="pair"><img class="d" src="${esc(`${v.name}-1280.png`)}" alt="${esc(v.name)} at 1280px"><img class="p" src="${esc(`${v.name}-390.png`)}" alt="${esc(v.name)} at 390px"></div></section>`).join('')}</div></body></html>\n`);
console.log(JSON.stringify({ brief, side_by_side: side, variants: variants.map(({ html, ...v }) => v), help: [`Open ${side}, score each column, and record the pair in docs/wrapper-allowlist.json (CONTRIBUTING.md)`] }));
