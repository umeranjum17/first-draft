import { createAssistantMessageEventStream, registerApiProvider } from '@mariozechner/pi-ai';
import { respond, routeOf } from './byokit.mjs';
import { embedMedia, mediaBrief, projectMedia } from './media.mjs';
import { renderCheck } from './render-check.mjs';
import { directionText, styleOf } from './styles.mjs';
const engine = () => import('../dist/engine.mjs');
export async function engineDoctor() {
  try {
    const e = await engine();
    if (typeof e.generateViaAgent !== 'function' || !e.composeSystemPrompt({ mode: 'create' })) throw new Error('engine exports or prompts are missing');
    return { status: 'ok', label: 'engine', detail: 'core/providers/shared at a63feb563da94090778fc5bee67e9672fccd26a1' };
  } catch (e) { return { status: 'fail', label: 'engine', detail: e.message, fix: 'Run npm run build in the source checkout, or reinstall the package' }; }
}
const POLICY = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; form-action 'none'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:" />`;
const REMOTE = /\b(?:src|href|srcset|action)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))|url\(\s*["']?([^"')]+)["']?\s*\)/gi;
const REMOTE_URL = /(?:https?:)?\/\/[^\s,]+/g;
const VOID = /^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/;
const TAG = /<[a-z](?:"[^"]*"|'[^']*'|[^>"'])*>/gi;

const NO_SCRIPT = 'Hard rule, first and above all: the page is refused if any tag is a <script> element, has an on* event-handler attribute (onclick, onsubmit, onload, onchange, onerror and every other on...), or has a javascript: URL (in href, src, action, formaction, xlink:href, poster or CSS url()). Write no JavaScript at all. Screens link to each other only with in-page hash links (<a href="#cart">, also for buttons that move on); style states with CSS (:hover, :focus), never with handlers.';
// A prompt that asks for a landing page gets a landing-page brief: without it the model rebuilds the source as a documentation site, 12,000 to 22,000 px tall, and spends the whole turn budget on it.
const LANDING = /\blanding[\s-]?pages?\b/i;
const LANDING_BRIEF = 'Landing page brief (the prompt asks for a landing page): write a short landing page that makes a visitor want the product, not a documentation site. Read the source for what the product does, who it is for and how to start, then write the page in your own words. At most about 6 sections, in this order: a hero (one promise in plain words, one primary action), the value (about three benefit blocks, one idea each), how it works in three steps, one proof block (a real number, result or quote from the source), install (the one command a user runs first and one sentence; no flags, alternatives or setup detail) and a closing call to action. Keep the whole page about 6,000 px tall at 390, or less. Space: every heading is followed by 16px or more before its text, and sections are 64px or more apart, the closing call to action included, so no heading ever sits flush on the paragraph under it. Do not mirror the source\'s headings or order, and leave out its doc paths, file names, maintainer commands, flags, config keys, release notes and other reference material. One screen, not a multi-screen flow, unless the prompt asks for screens: no data-oc-screen, no form-state screens, no setup wizard, no reference pages.';
// The two rules the render check holds the page to: the page is rendered at 390px, in light and in dark, and both renders are checked before it is accepted.
const outputRules = (dark) => `Output rules: the page is rendered at 390px, in light and in dark, and both renders are checked before it is accepted. (1) It must fit a 390px phone with no sideways scroll: wrap every pre and table in a container with overflow-x:auto, write grid columns as minmax(0,1fr) instead of 1fr, give every grid and flex child min-width:0, and let long text wrap. ${dark ? '(2) The style you were given is dark-first, so the page is dark by default, in light and in dark: a near-black page background with light text on :root, no light palette, and color-scheme: dark; never a light page background.' : '(2) It must have a real light theme and a real dark theme, both chosen by prefers-color-scheme: :root holds the light palette (a light page background, dark text) and a @media (prefers-color-scheme: dark) block overrides every colour custom property with a dark palette (a dark background, light text); also set color-scheme: light dark. Never write one dark palette for both: in light the page background is light.'}`;

// The page at the turn cap, mended the way done checks it: close what is left open (a closer for a tag further up the stack closes the tags between), drop closers with no opener, and drop the href of an anchor whose destination does not exist.
const mend = (html) => {
  const open = [];
  const closed = html.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?(\/)?>/g, (tag, close, name, self) => {
    name = name.toLowerCase();
    if (self || VOID.test(name)) return tag;
    if (!close) { open.push(name); return tag; }
    const at = open.lastIndexOf(name);
    return at < 0 ? '' : open.splice(at).slice(1).reverse().map((n) => `</${n}>`).join('') + tag;
  }) + open.reverse().map((n) => `</${n}>`).join('');
  const ids = new Set([...closed.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)].map((m) => m[1]));
  return closed.replace(/\s+href\s*=\s*["']#([^"']*)["']/g, (m, id) => id === '' || (!id.startsWith('/') && !ids.has(id)) ? '' : m);
};

export async function make({ prompt, agent, model, timeoutMs, direction, seed }) {
  const { generateViaAgent, composeSystemPrompt, makeTextEditorTool, makeDoneTool } = await engine();
  const key = (path) => path.trim().replace(/\\/g, '/').split('/').filter((p) => p && p !== '.').join('/') || '.';
  const files = new Map();
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
  // The page is rendered headless at 390px, in light and in dark, and both renders are checked inside the loop, so a page that overflows on a phone or has no dark theme is fixed before the command ends.
  const media = LANDING.test(prompt) ? projectMedia(prompt) : []; // a landing page gets the project's own screenshots; done and the output see them embedded
  const style = styleOf(direction); // a dark-first style is checked to be dark, not to differ between light and dark
  const render = renderCheck((warning) => process.stderr.write(`first-draft-axi: ${warning}\n`), { dark: style?.dark });
  const done = makeDoneTool({ ...fs, view: (path) => { const f = key(path) === 'index.html' ? fs.view(path) : null; return f && { ...f, content: embedMedia(f.content, media) }; }, listDir: (dir) => fs.listDir(dir).filter((p) => key(p) === 'index.html') }, render.verify);
  const failed = new AbortController(), signal = failed.signal;
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
  const answer = (_model, context, options) => {
    const stream = createAssistantMessageEventStream();
    (async () => {
      try {
        signal.throwIfAborted();
        if (++turns > 12) throw capped = new Error('engine exceeded 12 model turns'); // M3.1 Flash writes the whole page on turn 1, then spends the rest patching it: the cap ends the run, the page so far is kept below.
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
  const doneTool = { ...done, executionMode: 'sequential', execute: (id, params, ...rest) => done.execute(id, params.path ? { ...params, path: key(params.path) } : params, ...rest) };
  const output = await generateViaAgent({ prompt: start !== undefined ? (start.length <= 20_000 // ponytail: a small option is rewritten in one create (fits the 16k output budget); a bigger one is edited, which costs more turns
      ? `Revise this index.html: ${prompt}\nKeep every screen, id, link and all copy and layout this change does not touch. Call the editor once with command "create", path "index.html" and the complete revised file, then done(path="index.html").\n\nCurrent index.html:\n${start}`
      : `Revise the existing index.html (read it first): ${prompt}\nKeep every screen, id, link and all copy and layout this change does not touch. Make the change in a few str_replace edits (each old_str one distinctive line, new_str may be long), then call done(path="index.html") as your last step.`) : direction ? `${prompt}\nDesign direction: ${directionText(direction)}` : prompt, history: [], model: { provider: 'byokit', modelId: model },
    apiKey: '', allowKeyless: true, baseUrl: 'https://byokit.invalid', signal,
    systemPrompt: `${NO_SCRIPT}\n\n${composeSystemPrompt({ mode: start !== undefined ? 'revise' : 'create' })}\nHost export contract (overrides JSX/runtime guidance): write index.html, NOT App.jsx. One complete self-contained HTML5 document; inline CSS/SVG only; no scripts, event handlers or javascript: URLs; no remote URL of any kind. ${outputRules(style?.dark)} Use semantic HTML and responsive layouts for 390px and 1280px. No DESIGN.md is required for this single-page export. Use the supplied editor to write it, then done(path="index.html"). Only two tools exist — that editor and done; skill, scaffold, tweaks, set_title and every other tool are unavailable, so never call them.${LANDING.test(prompt) ? `\n\n${LANDING_BRIEF} ${mediaBrief(media)}` : ''}`,
  }, { fs, encourageToolUse: false, tools: [makeTextEditorTool(fs), doneTool],
    onEvent: (e) => {
      if (e.type === 'tool_execution_end' && e.toolName === 'done' && !e.isError && e.result.details?.status === 'ok' && e.result.details.path === 'index.html') verified = files.get('index.html');
      if (e.type === 'tool_execution_end' && e.toolName === 'done' && !e.isError) lastErrors = e.result.details?.status === 'ok' ? '' : (e.result.details?.errors ?? []).map((x) => x.message).join('; ');
    } }).catch(async (e) => {
    const reason = failed.signal.reason ?? e;
    if (reason !== capped || !files.has('index.html')) throw reason;
    // Out of turns with a page written: mend it, then it must still pass done, and its errors are the failure shown.
    let { details } = await doneTool.execute('turn-cap', { path: 'index.html' });
    if (details.status !== 'ok') { put('index.html', mend(files.get('index.html'))); ({ details } = await doneTool.execute('turn-cap', { path: 'index.html' })); }
    if (details.status !== 'ok') throw new Error(`${reason.message}, and the page so far fails done: ${details.errors.map((x) => x.message).join('; ')}`);
    verified = files.get('index.html');
    return used;
  }).finally(() => render.close()); // the browser the render check used goes with the run
  const source = files.get('index.html');
  if (!source || !/<head(?:\s[^>]*)?>|<html[^>]*>|<!doctype[^>]*>/i.test(source)) throw new Error('engine produced no complete index.html');
  if (start !== undefined && bare(source) === bare(start)) throw new Error('the engine left the option unchanged');
  if (verified === null || verified !== source) throw new Error(`engine did not verify index.html with done${lastErrors ? `; the last done check failed: ${lastErrors}` : ''}`);
  if ((source.match(TAG) ?? []).some((tag) => /^<script\b|\son(?!ce\b)[a-z]+\s*=|(?:href|src|action|formaction|xlink:href|poster)\s*=\s*["']?\s*javascript:|url\(\s*["']?\s*javascript:/i.test(tag))) throw new Error('engine output contains script; only script-free HTML is supported');
  const plain = /<head(?:\s[^>]*)?>/i.test(source) ? source.replace(/<head(?:\s[^>]*)?>/i, (head) => `${head}\n${POLICY}`) : /<html[^>]*>/i.test(source) ? source.replace(/<html[^>]*>/i, (tag) => `${tag}<head>${POLICY}</head>`) : source.replace(/<!doctype[^>]*>/i, (tag) => `${tag}<head>${POLICY}</head>`);
  const html = embedMedia(plain, media);
  if (Buffer.byteLength(html) > 5_000_000) throw new Error('the mock is over 5 MB; sign-off takes mocks of 5 MB or less');
  return { html, truncated: capped !== null, remote: [...new Set([...plain.matchAll(REMOTE)].flatMap((m) => [...(m[1] ?? m[2] ?? m[3] ?? m[4] ?? '').matchAll(REMOTE_URL)].map((url) => url[0])))],
    tokens_in: output.inputTokens, tokens_out: output.outputTokens, render_check: render.status };
}
