import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAssistantMessageEventStream, registerApiProvider } from '@mariozechner/pi-ai';
import { respond, routeOf } from './byokit.mjs';
import { embedFonts } from './fonts.mjs';
import { embedMedia, mediaBrief, projectMedia } from './media.mjs';
import { renderCheck } from './render-check.mjs';
import { directionText, styleOf } from './styles.mjs';
const engine = () => import('../dist/engine.mjs');
const TEMPLATES = fileURLToPath(new URL('../dist/templates', import.meta.url)); // the engine's skills, design starters, scaffolds, frames and brand references
export async function engineDoctor() {
  try {
    const e = await engine();
    if (typeof e.generateViaAgent !== 'function' || !e.composeSystemPrompt({ mode: 'create' })) throw new Error('engine exports or prompts are missing');
    if (!(await e.loadDesignSkills(join(TEMPLATES, 'design-skills'))).length) throw new Error('the engine templates are missing');
    return { status: 'ok', label: 'engine', detail: 'core/providers/shared/runtime and templates at a63feb563da94090778fc5bee67e9672fccd26a1' };
  } catch (e) { return { status: 'fail', label: 'engine', detail: e.message, fix: 'Run npm run build in the source checkout, or reinstall the package' }; }
}
const POLICY = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; form-action 'none'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:" />`;
const REMOTE = /\b(?:src|href|srcset|action)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))|url\(\s*["']?([^"')]+)["']?\s*\)/gi;
const REMOTE_URL = /(?:https?:)?\/\/[^\s,]+/g;
const TAG = /<[a-z](?:"[^"]*"|'[^']*'|[^>"'])*>/gi;
const TURN_CAP = 60; // a bound on cost, not on the design: a brief that MiniMax M3.1 Flash finishes takes 10 to 30 turns with the engine's planning, skill and scaffold tools
const ASK_AGAIN = 3; // follow-ups after a run ends with done not passing, as many as upstream's own done repair rounds
const QUIET = { debug() {}, info() {}, warn() {}, error() {} };

// The board shows one static, script-free page. With a browser on the machine the engine works as upstream does (App.jsx on its runtime, every tool) and the host draws the result into static HTML; without one it writes that HTML itself.
const DRAWN = 'Host export contract (first-draft): the design is shown on a sign-off board as one static HTML page with no script. Write the source as the output rules above say (App.jsx on the host runtime). When done passes, the host renders it once in a headless browser at 1280px and keeps the page that first render drew, without its scripts and handlers. A library from cdnjs.cloudflare.com (exact version) runs at that render only. So: (1) the first render shows the whole design: nothing appears only after a click, a timer or a fetch; (2) screens and states a reviewer moves between are data-oc-screen sections with matching ids, linked by in-page hash links (<a href="#id">), never React state; (3) lay out with CSS (media queries, grid, flex, clamp), never with the window size read in script; (4) web fonts: the runtime loads Fraunces, DM Serif Display, DM Sans and JetBrains Mono when named; for another Google Fonts family put @import url(\'https://fonts.googleapis.com/css2?family=...\') in a style; the host embeds every one in the page. Images are inline SVG, CSS or data: URIs: a remote image is blocked.';
const STATIC = 'Host export contract (first-draft; overrides JSX/runtime guidance, because this machine has no browser to render JSX): write index.html, NOT App.jsx: one complete self-contained HTML5 document; inline CSS/SVG only. The page is refused if any tag is a <script> element, has an on* event-handler attribute (onclick, onsubmit, onload and every other on...), or has a javascript: URL. Screens link to each other only with in-page hash links (<a href="#cart">) between data-oc-screen sections; style states with CSS (:hover, :focus), never with handlers. Google Fonts named with @import url(\'https://fonts.googleapis.com/css2?family=...\') are embedded by the host; images are inline SVG, CSS or data: URIs: a remote image is blocked.';
// A prompt that asks for a landing page gets a landing-page brief: without it the model rebuilds the source as a documentation site, 12,000 to 22,000 px tall, and spends the whole turn budget on it.
const LANDING = /\blanding[\s-]?pages?\b/i;
const LANDING_BRIEF = 'Landing page brief (the prompt asks for a landing page): write a short landing page that makes a visitor want the product, not a documentation site. Read the source for what the product does, who it is for and how to start, then write the page in your own words. At most about 6 sections, in this order: a hero (one promise in plain words, one primary action), the value (about three benefit blocks, one idea each), how it works in three steps, one proof block (a real number, result or quote from the source), install (the one command a user runs first and one sentence; no flags, alternatives or setup detail) and a closing call to action. Keep the whole page about 6,000 px tall at 390, or less. Space: every heading is followed by 16px or more before its text, and sections are 64px or more apart, the closing call to action included, so no heading ever sits flush on the paragraph under it. Do not mirror the source\'s headings or order, and leave out its doc paths, file names, maintainer commands, flags, config keys, release notes and other reference material. One screen, not a multi-screen flow, unless the prompt asks for screens: no data-oc-screen, no form-state screens, no setup wizard, no reference pages.';
// The two rules the render check holds the page to: the page is rendered at 390px, in light and in dark, and both renders are checked before it is accepted.
const outputRules = (dark) => `Output rules: the page is rendered at 390px, in light and in dark, and both renders are checked before it is accepted. (1) It must fit a 390px phone with no sideways scroll: wrap every pre and table in a container with overflow-x:auto, write grid columns as minmax(0,1fr) instead of 1fr, give every grid and flex child min-width:0, and let long text wrap. ${dark ? '(2) The style you were given is dark-first, so the page is dark by default, in light and in dark: a near-black page background with light text on :root, no light palette, and color-scheme: dark; never a light page background.' : '(2) It must have a real light theme and a real dark theme, both chosen by prefers-color-scheme: :root holds the light palette (a light page background, dark text) and a @media (prefers-color-scheme: dark) block overrides every colour custom property with a dark palette (a dark background, light text); also set color-scheme: light dark. Never write one dark palette for both: in light the page background is light.'}`;

export async function make({ prompt, agent, model, timeoutMs, direction, seed, assets = [] }) {
  const { generateViaAgent, composeSystemPrompt, collectResourceManifest, loadDesignSkills, loadFrameTemplates, makeDoneTool, buildStandaloneDocument } = await engine();
  const key = (path) => path.trim().replace(/\\/g, '/').split('/').filter((p) => p && p !== '.').join('/') || '.';
  const files = new Map();
  const seeded = (path) => /^(?:frames|skills)\//.test(path); // the design starters and frames the engine reads, never the design
  for (const [name, text] of await loadFrameTemplates(join(TEMPLATES, 'frames'))) files.set(`frames/${name}`, text); // as upstream's host seeds its workspace
  for (const [name, text] of await loadDesignSkills(join(TEMPLATES, 'design-skills'))) files.set(`skills/${name}`, text);
  const bare = (h) => h.replace(POLICY, '').replace(/<head>\s*<\/head>/i, '').replace(/\s+/g, '');
  const start = seed?.replace(POLICY, ''); // refine: the chosen option is the starting index.html, without the policy make adds back
  if (start !== undefined) files.set('index.html', start);
  const put = (path, content) => {
    if (Buffer.byteLength(content) > 5_000_000) throw new Error('the mock is over 5 MB; sign-off takes mocks of 5 MB or less');
    files.set(key(path), content); return { path: key(path) };
  };
  const get = (path) => { if (!files.has(key(path))) throw new Error(`File not found: ${key(path)}`); return files.get(key(path)); };
  const fs = {
    view: (path) => files.has(key(path)) ? { content: get(path), numLines: get(path).split('\n').length } : null,
    listDir: (dir) => [...files.keys()].filter((p) => key(dir) === '.' || p.startsWith(`${key(dir)}/`)), create: put,
    strReplace: (path, old, text) => { const s = get(path), hits = s.split(old).length - 1; if (hits !== 1) throw new Error(hits === 0 ? `old_str not found in ${key(path)}` : `old_str is ambiguous in ${key(path)}; provide more context`); return put(path, s.replace(old, () => text)); },
    insert: (path, line, text) => { const lines = get(path).split('\n'); if (!Number.isInteger(line) || line < 0 || line > lines.length) throw new Error('insert_line is outside the file'); lines.splice(line, 0, text); return put(path, lines.join('\n')); },
  };
  const warn = (warning) => process.stderr.write(`first-draft-axi: ${warning}\n`);
  const media = [...assets, ...(LANDING.test(prompt) && !assets.length ? projectMedia(prompt) : [])]; // a landing page gets the project's own screenshots; done and the output see them embedded
  const style = styleOf(direction); // a dark-first style is checked to be dark, not to differ between light and dark
  const render = renderCheck(warn, { dark: style?.dark });
  const failed = new AbortController(), signal = failed.signal;
  // The page a source becomes, drawn once per version: the board's static HTML with the policy, its fonts and media inside, and the errors done reports for it.
  const pages = new Map();
  const pageOf = (path, source) => {
    if (!pages.has(source)) pages.set(source, (async () => {
      let html = source, errors = [];
      if (render.drawing) ({ html, errors } = await render.snapshot(buildStandaloneDocument(source, { path })));
      if ((html.match(TAG) ?? []).some((tag) => /^<script\b|\son(?!ce\b)[a-z]+\s*=|(?:href|src|action|formaction|xlink:href|poster)\s*=\s*["']?\s*javascript:|url\(\s*["']?\s*javascript:/i.test(tag))) errors.push({ source: 'export', message: 'the page contains script; only script-free HTML is supported' });
      if (!/<head(?:\s[^>]*)?>|<html[^>]*>|<!doctype[^>]*>/i.test(html)) errors.push({ source: 'export', message: 'the page is not a complete HTML document' });
      const plain = /<head(?:\s[^>]*)?>/i.test(html) ? html.replace(/<head(?:\s[^>]*)?>/i, (head) => `${head}\n${POLICY}`) : /<html[^>]*>/i.test(html) ? html.replace(/<html[^>]*>/i, (tag) => `${tag}<head>${POLICY}</head>`) : html.replace(/<!doctype[^>]*>/i, (tag) => `${tag}<head>${POLICY}</head>`);
      const page = embedMedia(await embedFonts(plain, warn), media);
      if (!errors.length) errors.push(...await render.verify(page, { signal }));
      return { html: page, errors };
    })());
    return pages.get(source);
  };
  // done's runtime check, as upstream's host runs one: the source drawn, and the drawn page held to the board's 390px and dark-theme rules.
  const runtimeVerify = async (source, { path }) => {
    try { return (await pageOf(path, source)).errors; } catch (e) { failed.abort(e); throw e; } // no browser to draw with is the run's failure, not the model's to fix
  };
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  // A call that timed out or whose connection closed is asked again on the same route and model, twice at most; anything else is the real failure.
  const dropped = (e, call) => call.reason?.name === 'TimeoutError' || /other side closed|stream ended before message_stop|terminated|fetch failed|ECONNRESET|socket hang up|took too long|was cancelled|operation was aborted/i.test(e.message);
  const ask = async (args, outer) => {
    for (let retry = 0; ; retry++) {
      const call = AbortSignal.any([signal, ...(outer ? [outer] : []), AbortSignal.timeout(timeoutMs)]); // timeoutMs bounds each call: turn 1 writes the whole page (30k+ tokens, 6 min) and must not eat the budget of the whole design
      try { return await respond({ ...args, signal: call, timeoutMs }); } catch (e) {
        if (retry === 2 || signal.aborted || outer?.aborted || !dropped(e, call)) throw e;
        await pause([1000, 4000][retry]);
      }
    }
  };
  let turns = 0, verified = null, lastErrors = '', capped = null, used = { inputTokens: 0, outputTokens: 0 };
  const tools = {}; // the engine's tool calls by name, so a run shows which of its tools it used
  const answer = (_model, context, options) => {
    const stream = createAssistantMessageEventStream();
    (async () => {
      try {
        signal.throwIfAborted();
        if (++turns > TURN_CAP) throw capped = new Error(`engine exceeded ${TURN_CAP} model turns`);
        const message = await ask({ route: routeOf(agent), model, context, maxTokens: 16000 }, options?.signal);
        if (message.stopReason === 'error' || message.stopReason === 'aborted') throw new Error(message.errorMessage || message.stopReason);
        // MiniMax M3.1 Flash often sends command "view" on every call, with the real intent in the other arguments: take the command from them.
        used.inputTokens += message.usage?.input ?? 0; used.outputTokens += message.usage?.output ?? 0;
        for (const { name, arguments: a } of message.content) if (name === 'str_replace_based_edit_tool' && a.command === 'view' && !a.view_range) a.command = typeof a.file_text === 'string' ? 'create' : typeof a.old_str === 'string' ? 'str_replace' : typeof a.insert_line === 'number' ? 'insert' : 'view';
        stream.push({ type: 'done', reason: message.stopReason, message }); stream.end(message);
      } catch (e) {
        failed.abort(e); // No engine/provider retry after a failed boundary call.
        const error = { role: 'assistant', content: [], stopReason: 'error', errorMessage: e.message, timestamp: Date.now() };
        stream.push({ type: 'error', reason: 'error', error }); stream.end(error);
      }
    })();
    return stream;
  };
  registerApiProvider({ api: 'openai-completions', stream: answer, streamSimple: answer }, 'first-draft');
  const mode = start !== undefined ? 'revise' : 'create';
  const { sections } = await collectResourceManifest({ log: QUIET, providerId: 'byokit', templatesRoot: TEMPLATES }); // the skill, scaffold and brand index upstream adds to its own prompt
  const work = mkdtempSync(join(tmpdir(), 'first-draft-work-')); // scaffold copies a starter to disk; it joins the workspace from there
  const input = { model: { provider: 'byokit', modelId: model },
    apiKey: '', allowKeyless: true, baseUrl: 'https://byokit.invalid', signal, templatesRoot: TEMPLATES, workspaceRoot: work,
    onScaffolded: ({ destPath, written }) => { put(destPath, readFileSync(written, 'utf8')); },
    readWorkspaceFiles: async () => [...files].filter(([file]) => !seeded(file)).map(([file, contents]) => ({ file, contents })),
    systemPrompt: [composeSystemPrompt({ mode, userPrompt: prompt }), `${render.drawing ? DRAWN : STATIC} ${outputRules(style?.dark)}${LANDING.test(prompt) ? `\n\n${LANDING_BRIEF} ${assets.length ? '' : mediaBrief(media)}` : ''}${assets.length ? `\nGenerated assets: ${assets.map((a) => JSON.stringify(a.path)).join(', ')}. Place each inside the relevant draft screen as an <img src="EXACT PATH" alt="description"> with max-width:100%; height:auto. These are real generated pictures, illustrations, icons, hero images or backgrounds as requested by the brief, NOT a separate asset sheet. The host embeds them. Do not invent other paths.` : ''}`, ...sections].join('\n\n---\n\n') };
  let lastDone = null;
  const deps = { fs, runtimeVerify,
    onEvent: (e) => {
      if (e.type === 'tool_execution_end') tools[e.toolName] = (tools[e.toolName] ?? 0) + 1;
      if (e.type !== 'tool_execution_end' || e.toolName !== 'done' || e.isError) return;
      const { status, path, errors } = e.result.details ?? {};
      lastDone = key(path);
      if (status === 'ok' && key(path) !== 'DESIGN.md') verified = { path: key(path), source: files.get(key(path)) };
      lastErrors = status === 'ok' ? '' : (errors ?? []).map((x) => x.message).join('; ');
    } };
  const current = () => verified !== null && verified.source === files.get(verified.path);
  let next = start !== undefined ? (start.length <= 20_000 // ponytail: a small option is rewritten in one create (fits the 16k output budget); a bigger one is edited, which costs more turns
      ? `Revise this index.html: ${prompt}\nKeep every screen, id, link and all copy and layout this change does not touch. Call the editor once with command "create", path "index.html" and the complete revised file, then done(path="index.html").\n\nCurrent index.html:\n${start}`
      : `Revise the existing index.html (read it first): ${prompt}\nKeep every screen, id, link and all copy and layout this change does not touch. Make the change in a few str_replace edits (each old_str one distinctive line, new_str may be long), then call done(path="index.html") as your last step.`) : direction ? `${prompt}\nDesign direction: ${directionText(direction)}` : prompt;
  const history = [];
  // The engine ends a run when the model stops, or after three failed done rounds, with the design not yet passing done; upstream's app then waits for the user to ask again. Here done's errors are that next message, until a version passes, ASK_AGAIN times at most, or the turns run out.
  const output = await (async () => {
    for (let again = 0; ; again++) {
      const ended = await generateViaAgent({ ...input, prompt: next, history }, deps).then(() => null, (e) => e);
      if (failed.signal.aborted || (ended && ended.code !== 'GENERATION_INCOMPLETE')) return ended ?? used;
      if (current() || again === ASK_AGAIN) return used; // a version passed done and is still the source: the engine's complaint about a later done on another file leaves it as it was
      const path = (lastErrors && lastDone) || verified?.path || (render.drawing ? 'App.jsx' : 'index.html');
      history.push({ role: 'user', content: next }, { role: 'assistant', content: ended?.message ?? 'I stopped before done passed.' });
      next = `${lastErrors ? `done(path="${path}") still fails: ${lastErrors}` : `done(path="${path}") has not passed yet.`}\nThe workspace files are as you left them. Fix this in the files, then call done(path="${path}") again.`;
    }
  })().then(async (ended) => {
    if (!(ended instanceof Error)) return ended;
    const reason = failed.signal.reason ?? ended;
    if (reason !== capped) throw reason;
    if (verified) return used; // out of turns after a version passed done: that version is the design
    // Out of turns with no version passed: the main source, if it passes done now, is kept.
    const path = ['App.jsx', 'index.html'].find((p) => files.has(p));
    if (!path) throw reason;
    const { details } = await makeDoneTool(fs, runtimeVerify).execute('turn-cap', { path });
    if (details.status !== 'ok') throw new Error(`${reason.message}, and the design so far fails done: ${details.errors.map((x) => x.message).join('; ')}`);
    verified = { path, source: files.get(path) };
    return used;
  }).finally(() => { render.close(); rmSync(work, { recursive: true, force: true }); }); // the browser the render check used goes with the run
  const main = verified?.path ?? (render.drawing ? 'App.jsx' : 'index.html');
  if (verified === null || (capped === null && verified.source !== files.get(main))) throw new Error(`engine did not verify ${main} with done${lastErrors ? `; the last done check failed: ${lastErrors}` : ''}`);
  if (start !== undefined && main === 'index.html' && bare(verified.source) === bare(start)) throw new Error('the engine left the option unchanged');
  const { html, errors } = await pageOf(main, verified.source);
  if (errors.length) throw new Error(`engine output fails the export: ${errors.map((x) => x.message).join('; ')}`);
  if (assets.some((a) => !(html.match(/<img\b[^>]*>/gi) ?? []).some((tag) => tag.includes(a.dataUrl)))) throw new Error('The design did not place every generated asset into its screens');
  if (Buffer.byteLength(html) > 5_000_000) throw new Error('the mock is over 5 MB; sign-off takes mocks of 5 MB or less');
  return { html, truncated: capped !== null, turns: Math.min(turns, TURN_CAP), tools, source: main, remote: [...new Set([...html.matchAll(REMOTE)].map((m) => m[1] ?? m[2] ?? m[3] ?? m[4] ?? '').filter((v) => !v.trim().startsWith('data:')).flatMap((v) => [...v.matchAll(REMOTE_URL)].map((url) => url[0])))],
    tokens_in: output.inputTokens, tokens_out: output.outputTokens, render_check: render.status };
}
