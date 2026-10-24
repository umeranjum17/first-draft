#!/usr/bin/env node
// first-draft-axi: a prompt to design mocks. The agent is the person's own choice; first-draft picks none.
import { isUtf8 } from 'node:buffer';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { doctor as routeDoctor, imageSupport, modelRouteProblem, readySubscriptions, routeOf } from './byokit.mjs';
import { referenceDoctor, referenceFlags, referenceHelp, references } from './references.mjs';
import { discoverReference, discoveryHelp, explicitReferenceUrl } from './reference-discovery.mjs';
import { captureReference, optionReferenceImages, readOptionReferences, writeOptionReferences } from './reference-capture.mjs';
import { make, engineDoctor } from './make.mjs';
import { commentsPath, designFiles, serve, viewHost } from './view.mjs';
import { post } from './post.mjs';
import { STYLES } from './styles.mjs';
import { redesignSource } from './redesign.mjs';
import { makeRedesign } from './redesign-writer.mjs';
import { assetFlags, assetHelp, detectAssets, prepareAssets } from './assets.mjs';
import { LOGO_DIRECTIONS, logoDirection, readLogo, writeLogo } from './logo.mjs';
import { conceptSummary, drawLogos } from './logo-concepts.mjs';
import { exploreHelp, exploreImages } from './logo-images.mjs';
import { VERSION } from './version.mjs';

const DEFAULT_MODEL = { 'byokit:minimax:key': 'MiniMax-M3.1-Flash-Preview' };
const PICK = 'which BYOKit route and model to use (first-draft picks none), then run `first-draft-axi init --agent byokit:<route> --model <model>`';
const ASK = `Ask the user ${PICK}`;
const HOME = () => process.env.FIRST_DRAFT_HOME || join(homedir(), '.first-draft');
const CONFIG = () => join(HOME(), 'config.json');
// What each option takes when --options asks for several and the person names no direction: styles from different families, so options differ in kind.
const DIRECTIONS = ['editorial', 'oled-neon', 'bento', 'organic', 'neobrutalism'];

const read = () => {
  try {
    const c = JSON.parse(readFileSync(CONFIG(), 'utf8'));
    const t = c.agent_timeout ?? '10m';
    const timeout = /^\d+[smh]$/.test(t) ? t : '10m';
    return { agent: c.agent, model: c.agent && c.agent_config?.[c.agent]?.model, timeoutMs: Number(timeout.slice(0, -1)) * { s: 1e3, m: 6e4, h: 36e5 }[timeout.slice(-1)] };
  } catch (e) {
    if (e.code === 'ENOENT') return {};
    throw e;
  }
};
const save = ({ agent, model }) => {
  let c = {};
  try { c = JSON.parse(readFileSync(CONFIG(), 'utf8')); } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  c = { ...c, agent, agent_config: { ...c.agent_config, [agent]: { model } } };
  mkdirSync(HOME(), { recursive: true });
  writeFileSync(CONFIG(), `${JSON.stringify(c, null, 2)}\n`);
};

const fail = (code, message, help = []) => {
  console.log(JSON.stringify({ error: { code, message }, help }));
  process.exit(1);
};
const flags = (args, options) => {
  try {
    return parseArgs({ args, options, allowPositionals: true });
  } catch (e) { fail('USAGE', e.message, ['Run `first-draft-axi --help`']); }
};
const agentOrThrow = async (model) => {
  const c = read();
  if (model) c.model = model;
  // `shown` is what the view tells a person: no config path, and the set-up hint worded for them.
  const no = (code, message, shown = message) => Object.assign(new Error(message), { code, help: [ASK], shown: { error: shown, help: [`Choose ${PICK}`] } });
  if (!c.agent) {
    const help = (await readySubscriptions()).map((s) => `${s.label}: ${s.init}`);
    const error = no('NO_AGENT', 'No model source is set.');
    if (help.length) { error.help = help; error.shown.help = help; }
    throw error;
  }
  if (!routeOf(c.agent)) throw no('BAD_AGENT', `agent ${c.agent} is not byokit:<route>; this release runs BYOKit routes only`);
  const refusal = modelRouteProblem(routeOf(c.agent), c.model);
  if (refusal) throw no('SUBSCRIPTION_ONLY', refusal);
  if (!c.model) throw no('NO_MODEL', `no model is set for ${c.agent} in ${CONFIG()}`, `No model is set for ${c.agent} yet.`);
  return c;
};
const agentOrAsk = async (model) => {
  try { return await agentOrThrow(model); } catch (e) { fail(e.code ?? 'CONFIG', e.message, e.help); }
};
const readReferences = async (paths, modelOverride) => {
  try {
    const images = await references(paths);
    if (images.length) {
      const { agent, model } = await agentOrThrow(modelOverride);
      if (!await imageSupport(routeOf(agent), model)) throw new Error(`${agent} / ${model} does not support reference images; none were sent`);
    }
    return images;
  } catch (e) { fail('REFERENCE_FAILED', e.message, [referenceHelp]); }
};
// A deterministic comparison gate avoids model calls for unrelated briefs; the user's model, never a brand list, identifies the name.
const prepareReferences = async (values, prompt, c, images = [], inherited = null) => {
  if (values['no-references'] && values.like !== undefined) throw new Error('--like conflicts with --no-references');
  let metadata = !images.length ? inherited : null, added = optionReferenceImages(metadata), tokens_in = 0, tokens_out = 0;
  if (!values['no-references'] && (values.like !== undefined || /\b(?:like|inspired\s+by|style\s+of|similar\s+to)\b|\b[a-z\d]+-like\b/i.test(prompt))) {
    const discovery = await discoverReference({ prompt, like:values.like, ...c });
    tokens_in += discovery.tokens_in; tokens_out += discovery.tokens_out;
    if (discovery.candidate) {
      if (images.length > 4) throw new Error('Two public reference screenshots plus --ref must fit the six-image limit');
      if (!await imageSupport(routeOf(c.agent),c.model)) throw new Error(`${c.agent} / ${c.model} does not support reference images; no capture attempted`);
      const captured = await captureReference({ candidate:discovery.candidate,project:values.project,...c });
      metadata = captured.metadata; added = captured.images; tokens_in += captured.tokens_in; tokens_out += captured.tokens_out;
    }
  }
  images = [...images,...added];
  if (images.length > 6 || images.reduce((n,i)=>n+Buffer.from(i.dataUrl.slice(i.dataUrl.indexOf(',')+1),'base64').length,0)>10_000_000) throw new Error('Combined reference images exceed six images or 10 MB');
  if (images.length && !await imageSupport(routeOf(c.agent),c.model)) throw new Error(`${c.agent} / ${c.model} does not support reference images; none were sent`);
  return { images, metadata, tokens_in, tokens_out };
};
// The view's Next brief runs the same engine call as `refine`, on the agent the person set, read when the brief is sent.
// A logo option (a sheet with its .logo/ folder) is refined with its logo files, and the new option gets its own folder.
const refineHtml = async (seed, change, inherited, { from, to } = {}) => {
  const c = await agentOrThrow();
  try {
    const logo = from && readLogo(from, seed);
    if (logo) {
      const made = await make({ prompt:change,...c,seed:logo.seed,logo });
      writeLogo(to, made.logo, { brief:change, refined_from:from, concept:logo.concept, agent:c.agent, model:c.model });
      return { html:made.html, reference:null };
    }
    const refs = await prepareReferences({},change,c,[],inherited);
    return { html:(await make({ prompt:change,...c,seed,references:refs.images,referenceBrief:refs.metadata?.brief })).html, reference:refs.metadata };
  } catch (e) {
    const error = `${c.agent} (${c.model}) did not refine the design: ${e.message}`;
    throw Object.assign(new Error(error), { shown: { error, help: ['Run `first-draft-axi doctor` in a terminal to check the agent'] } });
  }
};

const HELP = `first-draft-axi ${VERSION}
usage: first-draft-axi <command> [flags]
commands[11]:
  redesign <https-url|html-folder> "<intent>" --out <folder> [--ref <image>] [--max-pages 1-12]   discover linked pages and redesign them (anonymous, scripts disabled; default 6 pages, 1 option)
    --used-screen-attempts <0-2> --used-plan-attempts <0-1>   account for earlier attempts in a bounded repair (never raises caps)
  references "<prompt>" [--like <brand-or-https-url>] [--capture] [--project <folder>]   discover a candidate; optionally check policy, capture and cache
  assets                              detect installed asset providers without spending
  make "<prompt>" (--out <file.html> | --out-dir <folder>) [flags]   make self-contained HTML design options (one engine run each)
    --options <n>      1-5 options (default 3); --count is an alias; cannot combine them
    --direction <look> named style or free-text direction for all options; --style is an alias; otherwise options vary
    --screens <names>  comma-separated screen/page names to cover (1-12); default: infer from brief
    --brief-file <file> append a nonempty UTF-8 brief (up to 100 KB); prompt may be omitted
    --model <id>       override the configured model for this run only (same BYOKit route)
    --out <file.html>  output file; multiple options add -1, -2, etc.; {i} is replaced by the option number
    --out-dir <folder> alternative to --out; writes option-1.html, option-2.html, etc.
  logo "<brief>" (--out <file.html> | --out-dir <folder>) [--options 1-5] [--direction <kind>] [--ref <image>] [--explore auto|none|codex|higgsfield] [--model <id>]   explore 6-8 rough concepts, each with a palette of its own, critique them at 16 and 32 px and refine the best into logo options (drawn in parallel, three at a time; image-first when an image provider is ready; one more round from the critic's advice if it drops every mark): each is a brand sheet (file.html) with its one-line idea and palette, and a file.logo/ folder with mark, wordmark and two lockups as SVG, each with a -dark twin, icon.svg, palette.json, the app icon as PNG at 16, 32, 48, 180, 192, 512 and 1024 px, favicon.ico and logo.json; each finished mark is critiqued again and redone or dropped; --ref images are the critic's only references (no site is fetched); needs Chrome or Chromium and a model that takes images
  styles [--logo]                     list the named design styles that make --direction <id> takes (or write your own direction in words); --logo lists the logo kinds logo --direction takes
  refine <option.html> "<change>" --out <file.html>   apply a follow-up prompt to one existing option: writes a new option file, the original is untouched
  view <design> [--host H] [--port P]   serve a design's options as a grid, a phone or desktop canvas and fullscreen, until stopped
  post <design> --title "<question>" --recommend <a|1> | --evidence --media <shot>... [--option a=<label>]... [--tradeoff T] [--key K] [--board B] [--host H] [--port P]   post a design card to a sign-off board with each option's Play url as a tappable link under it
  doctor                              show whether the configured agent is ready, with no paid call
  init --agent byokit:<route> --model <model>   save the user's agent and model to the config
The agent is the person's own choice: first-draft never picks one. Use a BYOKit plan key or api key route, or byokit:codex / byokit:claude for the installed subscription CLI (Claude example: init --agent byokit:claude --model claude-opus-5-5).
Journeys, tests and demos post with --evidence --media <shot>... (an Evidence card: options and Play links, no pick asked), never --recommend: that files a Decide card for the owner.
A design is the --out path given to make (x.html finds x-1.html ... x-N.html), a folder of options, or option files.
view binds the tailnet address from \`tailscale ip -4\` (or --host / $FIRST_DRAFT_VIEW_HOST) on port 4430 (or --port / $FIRST_DRAFT_VIEW_PORT); options render from the next port.
post copies the options into the board's mocks folder (the nearest .sign-off/, or --board), starts the view if it is not up, then runs sign-off-axi post with each option's Play url (<view>#/o/<n>/play) as that option's --link (a tappable Open under its mock; needs sign-off-axi 0.5.0+) and in the card's --tradeoff text as the fallback: the card's sandbox blocks a link inside the mock.
${assetHelp}
${exploreHelp}
${referenceHelp}
${discoveryHelp}
Config: $FIRST_DRAFT_HOME/config.json (default ~/.first-draft).`;

const [command, ...rest] = process.argv.slice(2);
if (!command || command === '--help' || command === '-h' || rest.includes('--help') || rest.includes('-h')) { console.log(HELP); process.exit(0); }
if (command === '--version' || command === '-v') { console.log(VERSION); process.exit(0); }

if (command === 'references') {
  const { values, positionals } = flags(rest, { like: { type: 'string' }, capture: { type: 'boolean' }, project: { type: 'string' } });
  const prompt = positionals.join(' ').trim();
  if ((!prompt && values.like === undefined) || values.like?.trim() === '') fail('USAGE', 'references needs a prompt or --like <brand-or-https-url>', [discoveryHelp]);
  try {
    const c = !values.capture && explicitReferenceUrl(values.like) ? {} : await agentOrThrow();
    const discovery = await discoverReference({ prompt, like: values.like, ...c });
    const captured = values.capture ? await captureReference({ candidate: discovery.candidate, project: values.project, ...c }) : null;
    console.log(JSON.stringify({ reference_discovery: discovery, ...(captured && { reference_capture: { fetched:true, cache:captured.cache,cached:captured.cached,name:captured.metadata.name,url:captured.metadata.url,brief:captured.metadata.brief,licence_note:captured.metadata.licence_note,fetched_at:captured.metadata.fetched_at,screenshots:2 } }) }));
  } catch (e) { fail(e.help ? e.code : values.capture ? 'REFERENCE_CAPTURE_FAILED' : 'REFERENCE_DISCOVERY_FAILED', e.message, e.help ?? [discoveryHelp]); }
} else if (command === 'assets') {
  console.log(JSON.stringify({ providers: await detectAssets(), help: [assetHelp] }));
} else if (command === 'styles' && rest.includes('--logo')) {
  console.log(JSON.stringify({ logo_directions: LOGO_DIRECTIONS, help: ['Run `first-draft-axi logo "<brief>" --out <file.html> --direction <id>`, or write your own direction in words'] }));
} else if (command === 'styles') {
  console.log(JSON.stringify({ styles: STYLES.map((s) => ({ id: s.id, name: s.name, family: s.family, vibe: s.vibe })), help: ['Run `first-draft-axi make "<prompt>" --out <file.html> --direction <id>`'] }));
} else if (command === 'make' || command === 'redesign' || command === 'logo') {
  const redesign = command === 'redesign', logo = command === 'logo';
  const { values, positionals } = flags(rest, logo ? { ref: referenceFlags.ref, ...Object.fromEntries(['out', 'out-dir', 'options', 'direction', 'model', 'explore'].map((name) => [name, { type: 'string' }])) }
    : { ...referenceFlags, ...assetFlags, ...Object.fromEntries(['out', 'out-dir', 'options', 'count', 'direction', 'style', 'screens', 'brief-file', 'model', ...(redesign ? ['max-pages','used-screen-attempts','used-plan-attempts'] : [])].map((name) => [name, { type: 'string' }])) });
  const source = redesign ? positionals.shift() : null;
  if (redesign && (!source || !values.out || values['out-dir'] || values.screens || values['brief-file'])) fail('USAGE', 'redesign needs a source, intent and --out <folder>; screens come from discovery, not --screens or --brief-file');
  if (redesign && values['max-pages'] !== undefined && !/^(?:[1-9]|1[0-2])$/.test(values['max-pages'])) fail('USAGE', '--max-pages must be 1-12');
  if (redesign && (values['used-screen-attempts'] !== undefined && !/^[0-2]$/.test(values['used-screen-attempts']) || values['used-plan-attempts'] !== undefined && !/^[01]$/.test(values['used-plan-attempts']))) fail('USAGE', 'Used attempts must be screen 0-2 and plan 0-1; budgets cannot be increased');
  for (const [name, value] of Object.entries(values)) if (typeof value === 'string' && !value.trim()) fail('USAGE', `--${name} must not be empty`);
  for (const [a, b] of [['options', 'count'], ['direction', 'style'], ['out', 'out-dir']]) {
    if (values[a] !== undefined && values[b] !== undefined) fail('USAGE', `use --${a} or --${b}, not both`);
  }
  const amount = values.options ?? values.count ?? (redesign ? '1' : '3'), count = Number(amount);
  if (!/^[1-5]$/.test(amount)) fail('USAGE', '--options / --count must be an integer from 1 to 5 (default 3)');
  let prompt = positionals.join(' ').trim();
  if (values['brief-file']) {
    let brief;
    try {
      const info = statSync(values['brief-file']);
      if (!info.isFile() || info.size > 100_000) fail('USAGE', '--brief-file must be a regular file at most 100 KB');
      brief = readFileSync(values['brief-file']);
    } catch (e) { fail('USAGE', `cannot read --brief-file: ${e.message}`); }
    if (!brief.length || brief.length > 100_000 || !brief.toString('utf8').trim() || !isUtf8(brief)) fail('USAGE', '--brief-file must be nonempty UTF-8 text, at most 100 KB');
    prompt = [prompt, brief.toString('utf8')].filter(Boolean).join('\n\n');
  }
  if (!prompt || !(values.out || values['out-dir'])) fail('USAGE', `${logo ? 'logo needs a brief' : 'make needs a prompt or --brief-file'}, and --out <file.html> or --out-dir <folder>`);
  let screens = values.screens?.split(',').map((s) => s.trim());
  if (screens && (screens.length > 12 || screens.some((s) => !s || s.length > 100))) fail('USAGE', '--screens needs 1-12 comma-separated names, each 1-100 characters');
  if (values.model && !/^[\w][\w./:@+-]*$/.test(values.model)) fail('USAGE', '--model must be a model id without whitespace');
  const outPath = redesign ? join(values.out, 'option-{i}.html') : values.out ?? join(values['out-dir'], 'option-{i}.html');
  const images = await readReferences(values.ref, values.model);
  let assetSession;
  if (redesign && (values.assets || values['allow-asset-spend'])) fail('USAGE', 'redesign does not generate images; use make --assets', [assetHelp]);
  try { assetSession = await prepareAssets(values, count); } catch (e) { fail('ASSETS_FAILED', e.message, [assetHelp]); }
  if (assetSession) {
    if (!assetSession.preview.approved) { console.log(JSON.stringify({ asset_preview: assetSession.preview, help: ['No image or design model call made. Repeat with --allow-asset-spend to approve this asset budget.'] })); process.exit(0); }
    process.stderr.write(`${JSON.stringify({ asset_preview: assetSession.preview })}\n`);
  }
  const c = await agentOrAsk(values.model);
  const started = Date.now();
  let refs;
  try { refs = logo ? { images, tokens_in:0, tokens_out:0 } : await prepareReferences(values,prompt,c,images); } catch(e) { fail('REFERENCE_FAILED',e.message,[referenceHelp]); }
  let inventory;
  if (redesign) {
    try {
      const captured = await redesignSource({ source, out: values.out, maxPages: Number(values['max-pages'] ?? 6) });
      inventory = captured.inventory;
      prompt = `${prompt}\n\n${captured.brief}`;
      screens = inventory.pages.map(p => p.id);
    } catch (e) { fail('REDESIGN_SOURCE_FAILED', e.message); }
  }
  const files = [];
  let tokens_in = refs.tokens_in, tokens_out = refs.tokens_out;
  const blocked = new Set(), cut = [];
  let render_check = 'checked';
  // A logo explores concepts first (an image of each when a provider is ready), draws its options in parallel and critiques each one,
  // redone or dropped, and explores once more when the critic dropped every mark (logo-concepts.mjs).
  let drawn, exploration;
  if (logo) {
    try { exploration = await exploreImages({ spec: values.explore, count, brief: prompt, dir: resolve(outPath).replace(/[-_]?\{i\}/, '').replace(/\.html?$/i, '') + '.explore' }); }
    catch (e) { fail('ASSETS_FAILED', e.message, [exploreHelp]); }
    if (exploration.provider) process.stderr.write(`${JSON.stringify({ exploration: { provider: exploration.provider, preview: exploration.preview } })}\n`);
    try { drawn = await drawLogos({ brief: prompt, direction: values.direction && logoDirection(values.direction), count, references: refs.images, explore: exploration.picture, make, ...c }); }
    catch (e) { fail('MAKE_FAILED', `${c.agent} (${c.model}) did not make the logo: ${e.message}`, ['Run `first-draft-axi doctor`']); }
    tokens_in += drawn.tokens_in; tokens_out += drawn.tokens_out;
  }
  const png = (url) => Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
  for (let i = 0; i < count; i++) {
    const n = files.length + 1, numbered = outPath.includes('{i}') ? outPath.replaceAll('{i}', String(n)) : count > 1 ? outPath.slice(0, -extname(outPath).length || undefined) + `-${n}` + extname(outPath) : outPath;
    let made, written, option;
    const direction = logo ? values.direction ?? null : values.direction ?? values.style ?? (!refs.metadata && count > 1 ? DIRECTIONS[i % DIRECTIONS.length] : undefined);
    try {
      const assets = assetSession && { ...assetSession, generate: (request) => assetSession.generate(request, numbered) };
      if (logo) {
        option = drawn.options[i];
        if (!option.made) continue; // no concept was left to try for this option; concepts says why
      }
      made = option?.made ?? await (redesign ? makeRedesign : make)({ prompt, ...c, screens, assets, redesignPages: inventory?.pages, screenAttemptsUsed:Number(values['used-screen-attempts']??0), planAttemptsUsed:Number(values['used-plan-attempts']??0), references:refs.images, referenceBrief:refs.metadata?.brief, diagnostics:join(dirname(resolve(numbered)),'writer-'+basename(numbered,'.html')), direction });
    } catch (e) { fail('MAKE_FAILED', `${c.agent} (${c.model}) did not make the ${logo ? 'logo' : 'design'}: ${e.message}`, ['Run `first-draft-axi doctor`']); }
    const out = resolve(numbered);
    try {
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, made.html);
      writeOptionReferences(out,refs.metadata);
      const conceptOf = ({ id, round, kind, name, idea, shape, avoid, palette, sketch }) => ({ id, round, kind, name, idea, shape, avoid, palette, sketch });
      const picture = (p) => p?.error ? { provider: p.provider, error: p.error, seconds: p.seconds } : p && { provider: p.provider, prompt: p.prompt, image: 'exploration.webp', seconds: p.seconds };
      // Every attempt the critique did not keep as this option stays for review in <option>.dropped/, outside the options the view lists.
      if (logo) for (const a of option.others) {
        const file = join(`${out.replace(/\.html?$/i, '')}.dropped`, `concept-${a.concept.id}-${a.verdict.round}.html`);
        mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, a.made.html);
        writeLogo(file, a.made.logo, { brief: prompt, dropped: true, concept: conceptOf(a.concept), critique: [a.verdict], exploration: picture(a.picture) ?? exploration.off, agent: c.agent, model: c.model }, { 'critique.png': png(a.board), ...(a.picture?.webp && { 'exploration.webp': a.picture.webp }) });
      }
      if (logo) written = writeLogo(out, made.logo, { brief: prompt, direction, concept: conceptOf(option.concept), passed: option.passed,
        critique: option.critiques, explored: conceptSummary(drawn), exploration: picture(option.picture) ?? exploration.off, timing: { ...drawn.timing, option_s: option.seconds },
        ...(drawn.second_round && { second_round: drawn.second_round }), critic: 'the same model, against written principles and the person\'s --ref images; not an independent judgement or trademark clearance', agent: c.agent, model: c.model },
      { 'concepts.png': png(drawn.boards[0]), ...(drawn.boards[1] && { 'concepts-round2.png': png(drawn.boards[1]) }), 'critique.png': png(option.board), ...(option.picture?.webp && { 'exploration.webp': option.picture.webp }) });
    } catch (e) { fail('OUTPUT_FAILED', `cannot write ${out}: ${e.message}`); }
    files.push({ file: out, bytes: Buffer.byteLength(made.html), source: made.source, turns: made.turns, tools: made.tools, ...(written && { logo_dir: written.dir, concept: { kind: option.concept.kind, name: option.concept.name, idea: option.concept.idea }, passed: option.passed, palette: written.logo.palette, critique: option.critiques.at(-1), ...(option.others.length && { dropped_attempts: `${out.replace(/\.html?$/i, '')}.dropped` }), checks: written.logo.checks }), ...(made.images && { images: made.images }), ...(made.images_refused && { images_refused: made.images_refused }), ...(made.redesign_check && {self_check:made.redesign_check}) });
    if (!logo) { tokens_in += made.tokens_in; tokens_out += made.tokens_out; }
    made.remote.forEach((r) => blocked.add(r));
    if (made.render_check === 'skipped') render_check = 'skipped';
    if (made.truncated) cut.push(numbered);
  }
  if (logo && !files.length) fail('MAKE_FAILED', `the concept critique left no concept to draw: ${drawn.concepts.map((k) => `${k.name} (${k.verdict}; ${(k.flaws ?? []).join('; ')})`).join(', ')}`, ['Run logo again, or name a --direction in your own words']);
  console.log(JSON.stringify({ made: { files, agent: c.agent, model: c.model, seconds: Math.round((Date.now() - started) / 1000), tokens_in, tokens_out, render_check },
    ...(drawn && { concepts: conceptSummary(drawn), ...(drawn.dropped.length && { dropped: drawn.dropped }), rounds: drawn.rounds, ...(drawn.second_round && { second_round: drawn.second_round }),
      exploration: exploration.provider ? { provider: exploration.provider, images: drawn.options.filter((o) => o.made).map((o) => o.picture?.error ? { error: o.picture.error } : o.picture && { concept: o.concept.name, seconds: o.picture.seconds }) } : { off: exploration.off }, timing: drawn.timing }),
    ...(inventory && { redesign: { sources: resolve(values.out, 'sources', 'sources.json'), screens: inventory.pages.map(p=>({id:p.id,title:p.title})), pending: inventory.pending, limitations: inventory.limitations } }),
    ...(refs.metadata && { references:{name:refs.metadata.name,url:refs.metadata.url,fetched_at:refs.metadata.fetched_at} }),
    ...(blocked.size && { blocked_remote: [...blocked] }),
    ...(cut.length && { truncated: cut }),
    help: [...(logo && files.some((f) => !f.passed) ? [`${files.filter((f) => !f.passed).length} option(s) did not pass the self-critique: each is its best attempt, flagged in its sheet and logo.json (passed: false)`] : []), ...(logo && files.length < count ? [`${files.length} of ${count} options were made: the concept critique kept ${drawn.concepts.filter((k) => k.status !== 'dropped').length} concept(s) to draw; concepts says why`] : []), ...(cut.length ? [`${cut.length} design(s) ran out of the engine's turns before finishing: each holds the last version that passed done, so a screen may be missing or unpolished`] : []), blocked.size ? 'The designs name remote files; the pages load none of them, so those parts show empty' : 'The pages load nothing from the network',
      `See them on the tailnet: first-draft-axi view ${outPath.includes('{i}') ? files.map((f) => f.file).join(' ') : outPath}`,
      `Post them for review: first-draft-axi post ${outPath.includes('{i}') ? files.map((f) => f.file).join(' ') : outPath} --title "<question>" --recommend a`] }));} else if (command === 'post') {
  const { values, positionals } = flags(rest, { title: { type: 'string' }, recommend: { type: 'string' }, evidence: { type: 'boolean' }, media: { type: 'string', multiple: true }, option: { type: 'string', multiple: true }, tradeoff: { type: 'string' }, key: { type: 'string' }, board: { type: 'string' }, host: { type: 'string' }, port: { type: 'string' } });
  const files = designFiles(positionals);
  if (!positionals.length || !values.title || !(values.recommend || values.evidence)) fail('USAGE', 'post needs a design, --title and --recommend (or --evidence)', ['Run `first-draft-axi post <design> --title "<question>" --recommend a`', 'Journeys, tests and demos pick nothing: add --evidence --media <screenshot> instead of --recommend']);
  if (!files.length) fail('NO_OPTIONS', `no HTML options found for ${positionals.join(' ')}`, ['Pass the --out path given to make, a folder of .html options, or the option files']);
  const port = Number(values.port ?? process.env.FIRST_DRAFT_VIEW_PORT ?? 4430);
  if (!Number.isInteger(port) || port < 1 || port > 65534) fail('USAGE', '--port is 1-65534 (options render from the next port)', ['Run `first-draft-axi post <design> --port 4430 ...`']);
  const labels = (values.option ?? []).map((o) => o.replace(/^[a-f]=/, ''));
  try {
    const p = await post({ files, name: basename(positionals[0], extname(positionals[0])), title: values.title, labels, tradeoff: values.tradeoff, key: values.key, recommend: values.recommend, evidence: values.evidence, media: values.media, board: values.board, host: values.host, port });
    console.log(JSON.stringify({ posted: { board: p.board, view: p.view, options: p.options }, sign_off: p.sign_off, help: ['Each option card links to its Play route in the first-draft view; the view serves until it is stopped'] }));
  } catch (e) {
    if (!e.code) throw e;
    fail(e.code, e.message, e.help);
  }
} else if (command === 'refine') {
  const { values, positionals } = flags(rest, { out: { type: 'string' }, ...referenceFlags });
  const [file, ...words] = positionals, change = words.join(' ').trim();
  if (!file || !change || !values.out) fail('USAGE', 'refine needs an option file, a change and --out <file.html>', ['Run `first-draft-axi refine <option.html> "<change>" --out <file.html>`']);
  if (resolve(values.out) === resolve(file)) fail('USAGE', '--out must be a new file, not the option being refined', ['Pass a different --out path']);
  let seed;
  try { seed = readFileSync(file, 'utf8'); } catch (e) { fail('NO_OPTIONS', `cannot read ${file}: ${e.message}`, ['Pass one option file made by `first-draft-axi make`']); }
  const c = await agentOrAsk();
  const started = Date.now();
  let made;
  const images = await readReferences(values.ref);
  let refs, logo;
  try { logo = readLogo(resolve(file), seed); } catch (e) { fail('NO_OPTIONS', `cannot read the logo files of ${file}: ${e.message}`, ['Pass a logo option file made by `first-draft-axi logo`, with its .logo folder beside it']); }
  try { refs = logo ? { images, tokens_in:0, tokens_out:0 } : await prepareReferences(values,change,c,images,readOptionReferences(file)); } catch(e) { fail('REFERENCE_FAILED',e.message,[referenceHelp]); }
  try { made = await make({ prompt:change,...c,seed:logo?.seed ?? seed,logo,references:refs.images,referenceBrief:refs.metadata?.brief }); } catch (e) { fail('MAKE_FAILED', `${c.agent} (${c.model}) did not refine the design: ${e.message}`, ['Run `first-draft-axi doctor`']); }
  const out = resolve(values.out);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, made.html);
  writeOptionReferences(out,refs.metadata);
  const written = logo && writeLogo(out, made.logo, { brief: change, refined_from: resolve(file), concept: logo.concept, agent: c.agent, model: c.model });
  console.log(JSON.stringify({ refined: { from: resolve(file), file: out, bytes: Buffer.byteLength(made.html), agent: c.agent, model: c.model, seconds: Math.round((Date.now() - started) / 1000), tokens_in: made.tokens_in + refs.tokens_in, tokens_out: made.tokens_out + refs.tokens_out, ...(written && { logo_dir: written.dir, checks: written.logo.checks }) },
    ...(made.remote.length && { blocked_remote: made.remote }),
    help: [`See both: first-draft-axi view ${resolve(file)} ${out}`] }));
} else if (command === 'doctor') {
  const rows = [{ status: 'ok', label: 'node', detail: process.version }, await engineDoctor(), referenceDoctor()];
  let c;
  try { c = read(); } catch (e) { fail('CONFIG', e.message, [`Fix ${CONFIG()}, then run \`first-draft-axi doctor\``]); }
  const subscriptions = await readySubscriptions();
  const setup = subscriptions.map((s) => `${s.label}: ${s.init}`);
  const unready = (check) => { console.log(JSON.stringify({ subscriptions, ready: false, checks: [...rows, check], help: setup.length ? setup : [ASK] })); process.exit(1); };
  if (!c.agent) unready({ status: 'fail', label: 'agent', detail: 'No model source is set.', fix: setup[0] ?? ASK });
  if (!routeOf(c.agent)) unready({ status: 'fail', label: 'agent', detail: `${c.agent} is not byokit:<route>`, fix: ASK });
  rows.push(c.model ? { status: 'ok', label: 'model', detail: c.model } : { status: 'fail', label: 'model', detail: `no model is set for ${c.agent}`, fix: ASK });
  rows.push(await routeDoctor(routeOf(c.agent), c.model));
  const ready = rows.every((r) => r.status !== 'fail');
  console.log(JSON.stringify({ subscriptions, ready, checks: rows, help: [ready ? 'Run `first-draft-axi make "<prompt>" --out <file.html>`' : 'Fix the failing checks, then run `first-draft-axi doctor` again'] }));
  if (!ready) process.exit(1);
} else if (command === 'init') {
  const { values } = flags(rest, { agent: { type: 'string' }, model: { type: 'string' } });
  values.model ??= DEFAULT_MODEL[values.agent]; // only the routes named here have a shipped default
  if (!values.agent || !values.model) {
    const setup = (await readySubscriptions()).map((s) => `${s.label}: ${s.init}`);
    fail('USAGE', 'Choose a model source and model.', setup.length ? setup : [ASK]);
  }
  if (!routeOf(values.agent)) fail('BAD_AGENT', `agent ${values.agent} is not byokit:<route>`, [ASK]);
  const refusal = modelRouteProblem(routeOf(values.agent), values.model);
  if (refusal) fail('SUBSCRIPTION_ONLY', refusal);
  save(values);
  console.log(JSON.stringify({ subscriptions: await readySubscriptions(), saved: { config: CONFIG(), agent: values.agent, model: values.model } }));
} else if (command === 'view') {
  const { values, positionals } = flags(rest, { host: { type: 'string' }, port: { type: 'string' } });
  if (!positionals.length) fail('USAGE', 'view needs a design', ['Run `first-draft-axi view <file.html|folder>`']);
  const files = designFiles(positionals);
  if (!files.length) fail('NO_OPTIONS', `no HTML options found for ${positionals.join(' ')}`, ['Pass the --out path given to make, a folder of .html options, or the option files']);
  const port = Number(values.port ?? process.env.FIRST_DRAFT_VIEW_PORT ?? 4430);
  if (!Number.isInteger(port) || port < 0 || port > 65534) fail('USAGE', '--port is 0-65534 (options render from the next port)', ['Run `first-draft-axi view <design> --port 4430`']);
  const { given, host, advertise, tailnet, wildcard } = await viewHost(values.host);
  if (wildcard && !tailnet) fail('NO_TAILNET', 'a wildcard --host listens on every address, but tailscale ip -4 found no tailnet address to show', ['Pass --host <tailnet address>']);
  let v;
  try {
    v = await serve({ files, name: basename(positionals[0], extname(positionals[0])), host, advertise, port, framePort: port && port + 1, comments: commentsPath(positionals[0]), refine: refineHtml });
  } catch (e) { fail(e.code === 'EADDRINUSE' ? 'PORT_IN_USE' : 'VIEW_FAILED', `cannot serve on ${advertise}:${port}: ${e.message}`, ['Stop the other `first-draft-axi view`, or pass --port <port>']); }
  console.log(JSON.stringify({ viewing: { url: v.url, frames: v.frames, options: v.options.map((o) => ({ option: o.n, file: o.file, url: `${v.url}#/o/${o.n}` })) },
    help: [/^(127\.|::1$|localhost$)/.test(advertise) ? `${given ? 'This host' : 'tailscale ip -4 found no tailnet address, so this url'} opens on this machine only; pass --host <tailnet address>` : 'Open the url on any device that can reach this host; it serves until this process stops',
      'Each option opens at <url>#/o/<n>; add /full for fullscreen'] }));
} else {
  fail('USAGE', `unknown command ${command}`, ['Run `first-draft-axi --help`']);
}
