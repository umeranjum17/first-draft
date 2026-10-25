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
import { KINDS, libraryCache, pullLibrary, readLibrary } from './reference-library.mjs';
import { judgeRouteProblem } from './judge.mjs';
import { captureCompetitors, discoverCompetitors, readCompetitors, writeCompetitors } from './reference-competitors.mjs';
import { appHelp, captureApp } from './reference-apps.mjs';
import { appEntry, captureSources, readSources, writeSources } from './reference-sources.mjs';
import { searchQueries, searchReferences } from './reference-search.mjs';
import { ReferenceNetwork } from './reference-network.mjs';
import { captureReference, optionReferenceImages, readOptionReferences, writeOptionReferences } from './reference-capture.mjs';
import { make, engineDoctor } from './make.mjs';
import { planDirections } from './direct.mjs';
import { OPTIONS_AT_ONCE, draft } from './draft.mjs';
import { commentsPath, designFiles, serve, viewHost } from './view.mjs';
import { post } from './post.mjs';
import { HARNESSES, InitError, initProject } from './init.mjs';
import { STYLES } from './styles.mjs';
import { redesignSource } from './redesign.mjs';
import { makeRedesign } from './redesign-writer.mjs';
import { assetFlags, assetHelp, detectAssets, prepareAssets } from './assets.mjs';
import { flowOf } from './flow.mjs';
import { LOGO_DIRECTIONS, logoDirection, readLogo, writeLogo } from './logo.mjs';
import { conceptSummary, drawLogos, pool } from './logo-concepts.mjs';
import { PASS, openCritic } from './critic.mjs';
import { exploreHelp, exploreImages } from './logo-images.mjs';
import { VERSION } from './version.mjs';

const DEFAULT_MODEL = { 'byokit:minimax:key': 'MiniMax-M3.1-Flash-Preview' };
const PICK = 'which BYOKit route and model to use (first-draft picks none), then run `first-draft-axi init --agent byokit:<route> --model <model>`';
const ASK = `Ask the user ${PICK}`;
const HOME = () => process.env.FIRST_DRAFT_HOME || join(homedir(), '.first-draft');
const CONFIG = () => join(HOME(), 'config.json');

const read = () => {
  try {
    const c = JSON.parse(readFileSync(CONFIG(), 'utf8'));
    const t = c.agent_timeout ?? '10m';
    const timeout = /^\d+[smh]$/.test(t) ? t : '10m';
    return { agent: c.agent, model: c.agent && c.agent_config?.[c.agent]?.model, ...(c.judge && { judge: c.judge }), timeoutMs: Number(timeout.slice(0, -1)) * { s: 1e3, m: 6e4, h: 36e5 }[timeout.slice(-1)] };
  } catch (e) {
    if (e.code === 'ENOENT') return {};
    throw e;
  }
};
const save = ({ agent, model, judge }) => {
  let c = {};
  try { c = JSON.parse(readFileSync(CONFIG(), 'utf8')); } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  c = { ...c, agent, agent_config: { ...c.agent_config, [agent]: { model } }, ...(judge && { judge }) };
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
  if (values['no-references'] && (values.like !== undefined || values.competitors || values.inspiration)) throw new Error(values.competitors ? '--competitors conflicts with --no-references' : values.inspiration ? '--inspiration conflicts with --no-references' : '--like conflicts with --no-references');
  if (values.app && !values.inspiration) throw new Error('--app captures a mobile competitor for a brief: run it with --inspiration, which searches and lists the sources it belongs to');
  let metadata = !images.length ? inherited : null, added = optionReferenceImages(metadata), tokens_in = 0, tokens_out = 0, competitors = null, sources = null;
  if (values.competitors) {
    // Market context comes from the brief alone: --like names one reference instead, so the two are not mixed.
    if (values.like !== undefined) throw new Error('--competitors searches the market for the brief; use --like to compare with one named product instead');
    const found = await discoverCompetitors({ prompt, ...c });
    tokens_in += found.tokens_in; tokens_out += found.tokens_out;
    const captured = await captureCompetitors({ products: found.products, project: values.project, ...c });
    tokens_in += captured.tokens_in; tokens_out += captured.tokens_out;
    competitors = { version: captured.version, checked_at: captured.checked_at, competitors: captured.competitors, refused: captured.refused };
  }
  if (values.inspiration) {
    // Search first: the free open web and the designer threads, then only the pages whose own terms allow a capture, then a mobile
    // brief's real competitor app on an emulator. A refusal anywhere is a link with its written description, never a placeholder.
    const planned = await searchQueries({ prompt, ...c });
    tokens_in += planned.tokens_in; tokens_out += planned.tokens_out;
    const network = new ReferenceNetwork({ requests: 14, bytes: 4_000_000, queries: true });
    let found;
    try { found = await searchReferences({ product_type: planned.product_type, queries: planned.queries, network }); }
    finally { network.close(); }
    const captured = await captureSources({ candidates: found.candidates, queries: found.queries, searches: found.searches, product_type: found.product_type, project: values.project, ...c });
    tokens_in += captured.tokens_in; tokens_out += captured.tokens_out;
    sources = { version: 1, searched_at: captured.searched_at, product_type: captured.product_type, queries: captured.queries, searches: captured.searches, sources: captured.sources };
    for (const target of values.app ?? []) {
      try {
        const shot = await captureApp({ target, project: values.project, serial: values.device });
        sources.sources.push(appEntry({ name: shot.package, packageName: shot.package, device: shot.device, apk: shot.apk, shots: shot.shots }));
      } catch (e) {
        sources.sources.push({ name: target.trim().split(/[\\/]/).at(-1), package: target.trim(), url: null, found_via: 'emulator', found_at: 'adb devices',
          description: `Individual screens of ${target.trim().split(/[\\/]/).at(-1)}, for internal mobile reference only`, status: 'link-only', why: `not captured: ${e.message}` });
      }
    }
  }
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
  return { images, metadata, competitors, sources, tokens_in, tokens_out };
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
commands[13]:
  redesign <https-url|html-folder> "<intent>" --out <folder> [--ref <image>] [--max-pages 1-12]   discover linked pages and redesign them (anonymous, scripts disabled; default 6 pages, 1 option)
    --used-screen-attempts <0-2> --used-plan-attempts <0-1>   account for earlier attempts in a bounded repair (never raises caps)
  references "<prompt>" [--like <brand-or-https-url>] [--capture] [--project <folder>]   discover a candidate; optionally check policy, capture and cache
  assets                              detect installed asset providers without spending
  make "<prompt>" (--out <file.html> | --out-dir <folder>) [flags]   make self-contained HTML design options (one model call each, then the critic)
    --options <n>      1-5 options (default 3); --count is an alias; cannot combine them
    --direction <look> named style or free-text direction for all options; --style is an alias; otherwise the model plans one direction per option for this brief
    --engine           make each option with the Open CoDesign engine's multi-turn tool loop instead of one page from one call (--assets always does)
    --screens <names>  comma-separated screen/page names to cover (1-12); default: infer from brief
    --brief-file <file> append a nonempty UTF-8 brief (up to 100 KB); prompt may be omitted
    --model <id>       override the configured model for this run only (same BYOKit route)
    --out <file.html>  output file; multiple options add -1, -2, etc.; {i} is replaced by the option number
    --out-dir <folder> alternative to --out; writes option-1.html, option-2.html, etc.
    --no-critic        skip the single critic pass (1-10 beside a plain page at 1280/390); refs pull enables an independent subscription judge, otherwise labelled self-assessment; low scores stay flagged, not revised
    --competitors      find 3-5 real competitors of this brief from the prompt alone and capture their public pages through the same robots/terms review; the view shows them beside the options with their sources, and every refusal with its reason
    --inspiration      search the free open web, Hacker News and the designer subreddits (r/UI_Design, r/UXDesign, r/web_design) for references of this brief's product type, capture only the pages whose own terms permit it, and keep every refusal as a link with a written description; the view shows the sources list beside the options
    --app <apk|package> (repeatable, with --inspiration) install that app on an attached Android emulator and capture its own screens for internal mobile reference; --device <serial> picks the emulator; without one the step refuses with its reason and the run continues
  logo "<brief>" (--out <file.html> | --out-dir <folder>) [--options 1-5] [--direction <kind>] [--ref <image>] [--explore auto|none|codex|higgsfield] [--model <id>]   explore 9 rough concepts from the brief's metaphors (wordmark-led, abstract and symbol, three calls at once), each with a palette and a base shape of its own, critique them at 16 and 32 px (an initial dressed as an object is dropped unless the brief asks for a letter) and refine the best into logo options (a wordmark-led and an abstract one among them, never two of one base shape; drawn in parallel, three at a time, at most two engine runs each; image-first when an image provider is ready; one more round from the critic's advice if it drops every mark): each is a brand sheet (file.html) with its one-line idea and palette, and a file.logo/ folder with mark, wordmark and two lockups as SVG, each with a -dark twin, icon.svg, palette.json, the app icon as PNG at 16, 32, 48, 180, 192, 512 and 1024 px, favicon.ico and logo.json; each finished mark is critiqued again and redone or dropped; --ref images are the critic's only references (no site is fetched); needs Chrome or Chromium and a model that takes images
  styles [--logo]                     list the named design styles that make --direction <id> takes (or write your own direction in words); --logo lists the logo kinds logo --direction takes
  refine <option.html> "<change>" --out <file.html>   apply a follow-up prompt to one existing option: writes a new option file, the original is untouched
  view <design> [--host H] [--port P]   serve a design's options as a grid, a phone or desktop canvas and fullscreen, until stopped
  post <design> --title "<question>" --recommend <a|1> | --evidence --media <shot>... [--option a=<label>]... [--tradeoff T] [--key K] [--board B|$FIRST_DRAFT_BOARD] [--host H] [--port P]   post a design card to a sign-off board with each option's Play url as a tappable link under it
  doctor                              show whether the configured agent is ready, with no paid call
  init [--harness claude,codex,pi] [--global]   set this repo up: the .first-draft/ work folder and the first-draft-axi skill for claude, codex and pi (safe to re-run; --global links the skill from the home folder)
  init --agent byokit:<route> --model <model> [--judge byokit:codex|byokit:claude --judge-model <model>]   save generator and optional independent subscription judge (default byokit:codex / gpt-6.1-sol)
  refs pull [--kind ${KINDS.join('|')}] [--library <file.json>]   capture only explicitly licensed public references into the local cache, never the package; unpermitted products remain notes and links
  refs list [--library <file.json>]   show source links and capture status
  judge <option.html> "<brief>" --plain <baseline.html>   score retained output without generating or changing either page
The agent is the person's own choice: first-draft never picks one. Use a BYOKit plan key or api key route, or byokit:codex / byokit:claude for the installed subscription CLI (Claude example: init --agent byokit:claude --model claude-opus-5-5).
Journeys, tests and demos post with --evidence --media <shot>... (an Evidence card: options and Play links, no pick asked), never --recommend: that files a Decide card for the owner.
Agent quick start (the first-draft-axi skill has the same): \`init\` once per repo (installs the skill for claude, codex and pi); redesign a live page: \`redesign https://example.com/pricing "Clearer plans" --out .first-draft/designs/pricing --model claude-sonnet-5-5\`; from a screenshot only: \`make "Redesign this screen: <what to change>" --ref shot.png --out .first-draft/designs/screen.html --model claude-sonnet-5-5\`; then \`view\` and \`post\`. --model names the model for one run on the configured BYOKit route (the fleet uses byokit:claude, the signed-in claude CLI: no key or token is ever needed or printed).
A design is the --out path given to make (x.html finds x-1.html ... x-N.html), a folder of options, or option files.
view binds the tailnet address from \`tailscale ip -4\` (or --host / $FIRST_DRAFT_VIEW_HOST) on port 4430 (or --port / $FIRST_DRAFT_VIEW_PORT); options render from the next port.
post copies the options into the board's mocks folder (the nearest .sign-off/, or --board, or $FIRST_DRAFT_BOARD: a board file or its .sign-off folder, so it works from any repo), starts the view if it is not up, then runs sign-off-axi post with each option's Play url (<view>#/o/<n>/play) as that option's --link (a tappable Open under its mock; needs sign-off-axi 0.5.0+) and in the card's --tradeoff text as the fallback: the card's sandbox blocks a link inside the mock.
${assetHelp}
${exploreHelp}
${referenceHelp}
${discoveryHelp}
Config: $FIRST_DRAFT_HOME/config.json (default ~/.first-draft).`;

const [command, ...rest] = process.argv.slice(2);
if (!command || command === '--help' || command === '-h' || rest.includes('--help') || rest.includes('-h')) { console.log(HELP); process.exit(0); }
if (command === '--version' || command === '-v') { console.log(VERSION); process.exit(0); }

if (command === 'refs') {
  const [action, ...more] = rest;
  const { values } = flags(more, { kind: { type: 'string' }, library: { type: 'string' } });
  if (!['pull', 'list'].includes(action) || (values.kind && !KINDS.includes(values.kind)) || (action === 'list' && values.kind)) fail('USAGE', `refs pull [--kind ${KINDS.join('|')}] [--library <file.json>] or refs list`, ['Run `first-draft-axi refs pull`']);
  try {
    if (action === 'list') {
      let here = [];
      try { here = JSON.parse(readFileSync(join(libraryCache(HOME()), 'library.json'), 'utf8')).entries; } catch (e) { if (e.code !== 'ENOENT') throw e; }
      const lib = readLibrary(values.library && resolve(values.library));
      console.log(JSON.stringify({ refs: lib.entries.map((e) => { const h = here.find((r) => r.id === e.id); return { id: e.id, kind: e.kind, name: e.name, url: e.url, capture: e.permission ? `permitted (${e.permission.licence})` : 'notes and link only', here: h?.captured ? `captured ${h.captured_at}` : h ? h.why : 'not pulled' }; }), policy: lib.policy, help: ['Run `first-draft-axi refs pull` to capture the permitted ones on this machine'] }));
    } else {
      const pulled = await pullLibrary({ home: HOME(), library: values.library, kind: values.kind });
      console.log(JSON.stringify({ refs_pulled: { cache: pulled.cache, captured: pulled.entries.filter((e) => e.captured).map((e) => ({ id: e.id, kind: e.kind, name: e.name, licence: e.licence.licence, shots: e.shots.length })),
        not_captured: pulled.entries.filter((e) => !e.captured).map((e) => ({ id: e.id, kind: e.kind, name: e.name, url: e.url, why: e.why })) },
        help: ['The critic\'s independent judge now compares each make option with the captured products of its kind', 'The not-captured products are kept as notes and links; the judge reads the notes as words only'] }));
    }
  } catch (e) { fail('REFS_FAILED', e.message, ['Run `first-draft-axi refs list`']); }
} else if (command === 'judge') {
  const { values, positionals } = flags(rest, { plain: { type: 'string' } });
  const file = positionals.shift(), brief = positionals.join(' ').trim();
  if (!file || !brief || !values.plain) fail('USAGE', 'judge <option.html> "<brief>" --plain <baseline.html>');
  const c = await agentOrAsk(), critic = await openCritic({ c, brief, home: HOME(), judgeSet: c.judge, plainSource: values.plain });
  try {
    if (critic.off) throw new Error(critic.off);
    const { critique } = await critic.judge({ html: readFileSync(file, 'utf8') });
    console.log(JSON.stringify({ file: resolve(file), generator: { agent: c.agent, model: c.model }, critique, judge: critic.judged, ...critic.used }));
  } catch (e) { console.log(JSON.stringify({ error: { code: 'JUDGE_FAILED', message: e.message } })); process.exitCode = 1; } finally { critic.close?.(); }
} else if (command === 'references') {
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
    : { ...referenceFlags, ...assetFlags, ...(command === 'make' && { competitors: { type: 'boolean' }, inspiration: { type: 'boolean' }, app: { type: 'string', multiple: true }, device: { type: 'string' } }), ...(!redesign && { engine: { type: 'boolean' }, 'no-critic': { type: 'boolean' } }), ...Object.fromEntries(['out', 'out-dir', 'options', 'count', 'direction', 'style', 'screens', 'brief-file', 'model', ...(redesign ? ['max-pages','used-screen-attempts','used-plan-attempts'] : [])].map((name) => [name, { type: 'string' }])) });
  const source = redesign ? positionals.shift() : null;
  if (redesign && (!source || !positionals.join(' ').trim() || !values.out || values['out-dir'] || values.screens || values['brief-file'])) fail('USAGE', 'redesign needs a source, intent and --out <folder>; screens come from discovery, not --screens or --brief-file',
    ['Run `first-draft-axi redesign https://example.com/pricing "Clearer plans" --out .first-draft/designs/pricing --model claude-sonnet-5-5`', 'Only have a screenshot? Run `first-draft-axi make "Redesign this screen: <what to change>" --ref shot.png --out .first-draft/designs/screen.html`']);
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
  // A flow needs one style sheet and one picture per screen: its illustration set is as big as its screens.
  const flow = flowOf(prompt, screens);
  try { assetSession = await prepareAssets(values, count, flow ? (flow.screens.length || flow.count) + 1 : undefined); } catch (e) { fail('ASSETS_FAILED', e.message, [assetHelp]); }
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
    // The baseline the critic compared every finished mark with stays beside the options (not one of them) for review.
    if (drawn.baseline.made) {
      const file = join(resolve(outPath).replace(/[-_]?\{i\}/, '').replace(/\.html?$/i, '') + '.baseline', 'baseline.html');
      try { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, drawn.baseline.made.html); drawn.baseline = { file, logo_dir: writeLogo(file, drawn.baseline.made.logo, { brief: prompt, baseline: 'the plain output of the same model on the same brief, without the concept step; the critic compared every finished mark with it', agent: c.agent, model: c.model }).dir }; }
      catch (e) { fail('OUTPUT_FAILED', `cannot write ${file}: ${e.message}`); }
    }
  }
  const png = (url) => Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
  const numberedOf = (n) => outPath.includes('{i}') ? outPath.replaceAll('{i}', String(n)) : count > 1 ? outPath.slice(0, -extname(outPath).length || undefined) + `-${n}` + extname(outPath) : outPath;
  // Several options with no direction named: the model plans one direction per option for this brief (direct.mjs), not a style from a fixed list.
  let planned;
  if (!logo && !redesign && count > 1 && !values.direction && !values.style && !refs.metadata) {
    try { planned = await planDirections({ brief: prompt, count, ...c }); } catch (e) { fail('MAKE_FAILED', `${c.agent} (${c.model}) did not plan the directions: ${e.message}`, ['Run `first-draft-axi doctor`, or name one with --direction']); }
    tokens_in += planned.tokens_in; tokens_out += planned.tokens_out;
  }
  const directionOf = (i) => logo ? values.direction ?? null : values.direction ?? values.style ?? planned?.directions[i].text;
  // A new option is one page from one call (draft.mjs); generated images and --engine use the multi-turn engine.
  const engine = assetSession || values.engine;
  const build = (i, numbered) => (redesign ? makeRedesign : engine ? make : draft)({ prompt, ...c, screens, assets: assetSession && { ...assetSession, generate: (request) => assetSession.generate(request, numbered) }, redesignPages: inventory?.pages, screenAttemptsUsed:Number(values['used-screen-attempts']??0), planAttemptsUsed:Number(values['used-plan-attempts']??0), references:refs.images, referenceBrief:refs.metadata?.brief, diagnostics:join(dirname(resolve(numbered)),'writer-'+basename(numbered,'.html')), direction: directionOf(i) });
  // make's critic: every option scored against real products and a plain page of the same brief (kept in <out>.critic/, outside the
  // options the view lists), once; low scores stay flagged (critic.mjs).
  const critic = logo || redesign ? null : values['no-critic'] ? { off: '--no-critic: no option was scored' }
    : await openCritic({ c, brief: prompt, references: refs.images, home: HOME(), judgeSet: c.judge, plainOut: resolve(outPath).replace(/[-_]?\{i\}/, '').replace(/\.html?$/i, '') + '.critic/plain.html' });
  // The default one-call options are independent, so they are drawn and judged OPTIONS_AT_ONCE at a time, and the critic's plain page is written
  // beside them. A logo's options were drawn already; redesign pages, the engine loop (--engine) and generated assets (paid, one budget) keep their order.
  const slots = [], stages = {}; // stages: the seconds each kind of work took, summed over the options (the critic reports its own)
  let logos = 0;
  const one = async (i) => {
    let made, written, option;
    const direction = directionOf(i);
    if (logo) {
      option = drawn.options[i];
      if (!option.made) return; // no concept was left to try for this option; concepts says why
    }
    const numbered = numberedOf(logo ? ++logos : i + 1);
    const opened = Date.now();
    try { made = option?.made ?? await build(i, numbered); }
    catch (e) { critic?.close?.(); fail('MAKE_FAILED', `${c.agent} (${c.model}) did not make the ${logo ? 'logo' : 'design'}: ${e.message}`, ['Run `first-draft-axi doctor`']); }
    for (const [stage, took] of Object.entries(made.timing ?? {})) stages[stage] = (stages[stage] ?? 0) + took;
    let critique;
    if (critic?.judge) {
      try { ({ made, critique } = await critic.judge(made)); }
      catch (e) { critique = { error: `the critic did not score this option: ${e.message}` }; }
    }
    const out = resolve(numbered);
    try {
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, made.html);
      writeOptionReferences(out,refs.metadata);
      writeCompetitors(out,refs.competitors);
      writeSources(out,refs.sources);
      const conceptOf = ({ id, round, territory, kind, name, from, idea, base, base_seen, shape, avoid, palette, sketch }) => ({ id, round, territory, kind, name, from, idea, base, base_seen, shape, avoid, palette, sketch });
      const picture = (p) => p?.error ? { provider: p.provider, error: p.error, seconds: p.seconds } : p && { provider: p.provider, prompt: p.prompt, image: 'exploration.webp', seconds: p.seconds };
      // Every attempt the critique did not keep as this option stays for review in <option>.dropped/, outside the options the view lists.
      if (logo) for (const a of option.others) {
        const file = join(`${out.replace(/\.html?$/i, '')}.dropped`, `concept-${a.concept.id}-${a.verdict.round}.html`);
        mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, a.made.html);
        writeLogo(file, a.made.logo, { brief: prompt, dropped: true, concept: conceptOf(a.concept), critique: [a.verdict], exploration: picture(a.picture) ?? exploration.off, agent: c.agent, model: c.model }, { 'critique.png': png(a.board), ...(a.picture?.webp && { 'exploration.webp': a.picture.webp }) });
      }
      if (logo) written = writeLogo(out, made.logo, { brief: prompt, direction, concept: conceptOf(option.concept), passed: option.passed,
        critique: option.critiques, explored: conceptSummary(drawn), baseline: drawn.baseline.file ?? { error: drawn.baseline.error }, exploration: picture(option.picture) ?? exploration.off, timing: { ...drawn.timing, option_s: option.seconds },
        ...(drawn.second_round && { second_round: drawn.second_round }), critic: 'the same model, against written principles and the person\'s --ref images; not an independent judgement or trademark clearance', agent: c.agent, model: c.model },
      { 'concepts.png': png(drawn.boards[0]), ...(drawn.boards[1] && { 'concepts-round2.png': png(drawn.boards[1]) }), 'critique.png': png(option.board), ...(option.picture?.webp && { 'exploration.webp': option.picture.webp }) });
    } catch (e) { fail('OUTPUT_FAILED', `cannot write ${out}: ${e.message}`); }
    slots[i] = { file: out, bytes: Buffer.byteLength(made.html), source: made.source, turns: made.turns, tools: made.tools, ...(written && { logo_dir: written.dir, concept: { kind: option.concept.kind, name: option.concept.name, idea: option.concept.idea }, passed: option.passed, palette: written.logo.palette, critique: option.critiques.at(-1), ...(option.others.length && { dropped_attempts: `${out.replace(/\.html?$/i, '')}.dropped` }), checks: written.logo.checks }), ...(planned && { direction: planned.directions[i].name }), ...(made.repaired && { repaired: made.repaired }), ...(made.unrepaired && { unrepaired: made.unrepaired, repair_failed: made.repair_failed }), ...(made.images && { images: made.images }), ...(made.images_refused && { images_refused: made.images_refused }), ...(made.redesign_check && {self_check:made.redesign_check}), ...(critique && { critique }), ...(made.timing && { seconds: Math.round((Date.now() - opened) / 1000) }) };
    if (!logo) { tokens_in += made.tokens_in; tokens_out += made.tokens_out; }
    made.remote.forEach((r) => blocked.add(r));
    if (made.render_check === 'skipped') render_check = 'skipped';
    if (made.truncated) cut.push(numbered);
  };
  const inOrder = logo || redesign || engine;
  if (!inOrder) critic?.warm?.();
  await pool(inOrder ? 1 : OPTIONS_AT_ONCE, Array.from({ length: count }, (_, i) => i), one);
  files.push(...slots.filter(Boolean));
  cut.sort();
  critic?.close?.();
  if (logo && !files.length) fail('MAKE_FAILED', `the concept critique left no concept to draw: ${drawn.concepts.map((k) => `${k.name} (${k.verdict}; ${(k.flaws ?? []).join('; ')})`).join(', ')}`, ['Run logo again, or name a --direction in your own words']);
  if (critic?.used) { tokens_in += critic.used.tokens_in; tokens_out += critic.used.tokens_out; }
  const low = files.filter((f) => f.critique && !f.critique.passed);
  console.log(JSON.stringify({ made: { command, at: new Date(started).toISOString(), files, agent: c.agent, model: c.model, seconds: Math.round((Date.now() - started) / 1000), tokens_in, tokens_out, render_check, ...(Object.keys(stages).length && { timing: { options: stages, ...(critic?.timing && { critic: critic.timing() }) } }),
      ...(critic && { critic: critic.off ? { off: critic.off } : { pass: PASS, ...(critic.plainFile() && { plain: critic.plainFile() }), judge: critic.judged } }) },
    ...(drawn && { concepts: conceptSummary(drawn), ...(drawn.dropped.length && { dropped: drawn.dropped }), rounds: drawn.rounds, baseline: drawn.baseline.file ? { file: drawn.baseline.file, logo_dir: drawn.baseline.logo_dir } : { error: drawn.baseline.error }, ...(drawn.kinds_missing && { kinds_missing: drawn.kinds_missing }), ...(drawn.second_round && { second_round: drawn.second_round }),
      exploration: exploration.provider ? { provider: exploration.provider, images: drawn.options.filter((o) => o.made).map((o) => o.picture?.error ? { error: o.picture.error } : o.picture && { concept: o.concept.name, seconds: o.picture.seconds }) } : { off: exploration.off }, timing: drawn.timing }),
    ...(inventory && { redesign: { sources: resolve(values.out, 'sources', 'sources.json'), screens: inventory.pages.map(p=>({id:p.id,title:p.title})), pending: inventory.pending, limitations: inventory.limitations } }),
    ...(refs.metadata && { references:{name:refs.metadata.name,url:refs.metadata.url,fetched_at:refs.metadata.fetched_at} }),
    ...(refs.competitors && { competitors: { checked_at: refs.competitors.checked_at, captured: refs.competitors.competitors.map(({ name, url, terms_url }) => ({ name, url, terms_url })), refused: refs.competitors.refused, sidecar: '.competitors.json beside each option' } }),
    ...(refs.sources && { inspiration: { searched_at: refs.sources.searched_at, product_type: refs.sources.product_type, queries: refs.sources.queries.map((q) => q.query), searches: refs.sources.searches.map(({ source, url, status, found, why }) => ({ source, status, url, found, ...(why && { why }) })), captured: refs.sources.sources.filter((s) => s.status === 'captured').length, link_only: refs.sources.sources.filter((s) => s.status === 'link-only').length, sources: refs.sources.sources.map(({ name, url, package: pkg, status, description, found_via, why, internal_reference_only }) => ({ name, ...(url !== null ? { url } : { package: pkg }), found_via, description, status, ...(why && { why }), ...(internal_reference_only && { internal_reference_only }) })), sidecar: '.sources.json beside each option' } }),
    ...(blocked.size && { blocked_remote: [...blocked] }),
    ...(cut.length && { truncated: cut }),
    help: [...(logo && files.some((f) => !f.passed) ? [`${files.filter((f) => !f.passed).length} option(s) did not pass the self-critique: each is its best attempt, flagged in its sheet and logo.json (passed: false)`] : []), ...(drawn?.kinds_missing ? [`No ${drawn.kinds_missing.join(' or ')} concept survived the critique, so the options lack that kind; concepts says why`] : []), ...(logo && files.length < count ? [`${files.length} of ${count} options were made: the concept critique kept ${drawn.concepts.filter((k) => k.status !== 'dropped').length} concept(s) to draw; concepts says why`] : []), ...(cut.length ? [`${cut.length} design(s) ran out of the engine's turns before finishing: each holds the last version that passed done, so a screen may be missing or unpolished`] : []), ...(critic?.off ? [`The critic was off (${critic.off}): tell the user no option was scored against the references`] : []), ...(critic?.judged?.off ? [`Independent judge unavailable (${critic.judged.off}); scores are the generator's self-assessment`] : []), ...(low.length ? [`${low.length} option(s) are below the bar: ${low.map((f) => `${basename(f.file)} ${f.critique.error?.replace(/\.$/, '') ?? `scored ${f.critique.score}/10 (plain page ${f.critique.plain_score}; ${PASS} needed) after ${f.critique.rounds} review(s)`}`).join(', ')}. Tell the user each score and its gaps; never show one as finished`] : []), blocked.size ? 'The designs name remote files; the pages load none of them, so those parts show empty' : 'The pages load nothing from the network',
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
  // A refined option keeps the market comparison and the refusals the option it came from shows.
  let competitors = null;
  try { competitors = logo ? null : readCompetitors(file); } catch (e) { fail('REFERENCE_FAILED', `the market comparison of ${file} cannot be read: ${e.message}`, [referenceHelp]); }
  writeCompetitors(out, competitors);
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
  const { values } = flags(rest, { agent: { type: 'string' }, model: { type: 'string' }, judge: { type: 'string' }, 'judge-model': { type: 'string' }, harness: { type: 'string' }, global: { type: 'boolean' } });
  if (values.agent !== undefined || values.model !== undefined || values.judge !== undefined || values['judge-model'] !== undefined) {
    // Saving the user's agent and model: config only, nothing in the repo.
    if (values.harness !== undefined || values.global) fail('USAGE', '--harness and --global set up the repo; run them in a separate `first-draft-axi init`');
    values.model ??= DEFAULT_MODEL[values.agent]; // only the routes named here have a shipped default
    if (!values.agent || !values.model) {
      const setup = (await readySubscriptions()).map((s) => `${s.label}: ${s.init}`);
      fail('USAGE', 'Choose a model source and model.', setup.length ? setup : [ASK]);
    }
    if (!routeOf(values.agent)) fail('BAD_AGENT', `agent ${values.agent} is not byokit:<route>`, [ASK]);
    const refusal = modelRouteProblem(routeOf(values.agent), values.model);
    if (refusal) fail('SUBSCRIPTION_ONLY', refusal);
    if (!values.judge !== !values['judge-model']) fail('USAGE', '--judge and --judge-model go together');
    const judge = values.judge && { agent: values.judge, model: values['judge-model'] };
    if (judge && (judgeRouteProblem(judge.agent) || modelRouteProblem(routeOf(judge.agent), judge.model) || judge.model === values.model)) fail('BAD_JUDGE', 'Choose a different model on byokit:codex or byokit:claude, subscription only');
    save({ ...values, judge });
    console.log(JSON.stringify({ subscriptions: await readySubscriptions(), saved: { config: CONFIG(), agent: values.agent, model: values.model, ...(judge && { judge }) } }));
  } else {
    // Set up this repo: the .first-draft/ work folder and the skill for each coding agent.
    let r;
    try { r = initProject({ cwd: process.cwd(), harnesses: values.harness === undefined ? HARNESSES : values.harness.split(',').map((h) => h.trim()), global: values.global }); }
    catch (e) { if (e instanceof InitError) fail(e.code, e.message, e.help); throw e; }
    const configured = (() => { try { return read().agent; } catch { return null; } })();
    console.log(JSON.stringify({ init: { repo: r.root, work: r.work, created: r.created.length ? r.created : 'nothing new (re-run is a no-op)', skills: r.skills, ...(r.linked.length && { linked: r.linked }) },
      help: [configured ? 'Run `first-draft-axi doctor` to check the model is ready (no paid call)' : 'No model is saved: in the fleet run `first-draft-axi init --agent byokit:claude --model claude-sonnet-5-5`; otherwise ask the user which BYOKit route and model to use',
        'Make options: first-draft-axi make "<prompt>" --out .first-draft/designs/<name>.html --options 3 --model claude-sonnet-5-5',
        'Redesign a screen from a URL: first-draft-axi redesign <https-url> "<what to change>" --out .first-draft/designs/<name>',
        'Show them: first-draft-axi view .first-draft/designs/<name>.html; ask for a pick: first-draft-axi post .first-draft/designs/<name>.html --title "<question>" --recommend a'] }));
  }
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
