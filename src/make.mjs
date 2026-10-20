import { createAssistantMessageEventStream, registerApiProvider } from '@mariozechner/pi-ai';
import { respond, routeOf } from './byokit.mjs';
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
const TAG = /<[a-z](?:"[^"]*"|'[^']*'|[^>"'])*>/gi;

const NO_SCRIPT = 'Hard rule, first and above all: the page is refused if any tag is a <script> element, has an on* event-handler attribute (onclick, onsubmit, onload, onchange, onerror and every other on...), or has a javascript: URL (in href, src, action, formaction, xlink:href, poster or CSS url()). Write no JavaScript at all. Screens link to each other only with in-page hash links (<a href="#cart">, also for buttons that move on); style states with CSS (:hover, :focus), never with handlers.';
const TASTE = 'Design bar: Apple/Linear-grade, calm and exact, never a template. Type: system font stack, a fixed scale (12/14/16/20/28/40px), at most two weights, tight letter-spacing on headings, 1.5 line-height on body. Space: an 8px scale only (8/16/24/32/48/64), generous padding, one consistent radius. Hierarchy: one clear primary action per screen, secondary actions quiet, labels small and muted. Colour: one accent on a neutral ramp, body text at least 4.5:1 contrast, no default blue links, no rainbow gradients, no emoji as icons (draw inline SVG). Content: real, specific copy and plausible data for the product, never lorem or "Your text here". Layout: no generic centred form floating on a blank page; give each screen a structure (a sidebar, a split with product context, a list with detail), and make 390px a designed layout, not a squeezed one.';

export async function make({ prompt, agent, model, timeoutMs, variation, seed }) {
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
  const done = makeDoneTool({ ...fs, view: (path) => key(path) === 'index.html' ? fs.view(path) : null, listDir: (dir) => fs.listDir(dir).filter((p) => key(p) === 'index.html') });
  const failed = new AbortController(), signal = AbortSignal.any([failed.signal, AbortSignal.timeout(timeoutMs)]);
  let turns = 0, verified = null;
  const answer = (_model, context, options) => {
    const stream = createAssistantMessageEventStream();
    (async () => {
      try {
        signal.throwIfAborted();
        if (++turns > 12) throw new Error('engine exceeded 12 model turns'); // ponytail: bounded first slice; expand only with measured need.
        const message = await respond({ route: routeOf(agent), model, context, maxTokens: 16000, signal: AbortSignal.any([signal, ...(options?.signal ? [options.signal] : [])]), timeoutMs });
        if (message.stopReason === 'error' || message.stopReason === 'aborted') throw new Error(message.errorMessage || message.stopReason);
        // MiniMax M3.1 Flash often sends command "view" on every call, with the real intent in the other arguments: take the command from them.
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
  const output = await generateViaAgent({ prompt: start !== undefined ? (start.length <= 20_000 // ponytail: a small option is rewritten in one create (fits the 16k output budget); a bigger one is edited, which costs more turns
      ? `Revise this index.html: ${prompt}\nKeep every screen, id, link and all copy and layout this change does not touch. Call the editor once with command "create", path "index.html" and the complete revised file, then done(path="index.html").\n\nCurrent index.html:\n${start}`
      : `Revise the existing index.html (read it first): ${prompt}\nKeep every screen, id, link and all copy and layout this change does not touch. Make the change in a few str_replace edits (each old_str one distinctive line, new_str may be long), then call done(path="index.html") as your last step.`) : variation ? `${prompt}\nVariation: ${variation}` : prompt, history: [], model: { provider: 'byokit', modelId: model },
    apiKey: '', allowKeyless: true, baseUrl: 'https://byokit.invalid', signal,
    systemPrompt: `${NO_SCRIPT}\n\n${composeSystemPrompt({ mode: start !== undefined ? 'revise' : 'create' })}\nHost export contract (overrides JSX/runtime guidance): write index.html, NOT App.jsx. One complete self-contained HTML5 document; inline CSS/SVG only; no scripts, event handlers or javascript: URLs; no remote URL of any kind. ${TASTE} Use semantic HTML and responsive layouts for 390px and 1280px. No DESIGN.md is required for this single-page export. Screens: a design with more than one screen puts each in its own top-level element with a unique id and a data-oc-screen attribute (<section id="home" data-oc-screen>), the first being the opening screen. Link screens only with in-page hash links (<a href="#cart">, also for buttons that move on): no script, no network, no other href, no top-level navigation. Give every screen after the first a visible link back. Show form states (empty, filled, submitted) as their own screens, such as signin, signin-filled and signed-in, with the filled values as static text; they are reached by those links. A one-screen design needs no data-oc-screen. Use the supplied editor to write it, then done(path="index.html"). Only two tools exist — that editor and done; skill, scaffold, tweaks, set_title and every other tool are unavailable, so never call them.`,
  }, { fs, encourageToolUse: false, tools: [makeTextEditorTool(fs), { ...done, executionMode: 'sequential', execute: (id, params, ...rest) => done.execute(id, params.path ? { ...params, path: key(params.path) } : params, ...rest) }],
    onEvent: (e) => {
      if (e.type === 'tool_execution_end' && e.toolName === 'done' && !e.isError && e.result.details?.status === 'ok' && e.result.details.path === 'index.html') verified = files.get('index.html');
    } }).catch((e) => { throw failed.signal.reason ?? e; });
  const source = files.get('index.html');
  if (!source || !/<head(?:\s[^>]*)?>|<html[^>]*>|<!doctype[^>]*>/i.test(source)) throw new Error('engine produced no complete index.html');
  if (start !== undefined && bare(source) === bare(start)) throw new Error('the engine left the option unchanged');
  if (verified === null || verified !== source) throw new Error('engine did not verify index.html with done');
  if ((source.match(TAG) ?? []).some((tag) => /^<script\b|\son(?!ce\b)[a-z]+\s*=|(?:href|src|action|formaction|xlink:href|poster)\s*=\s*["']?\s*javascript:|url\(\s*["']?\s*javascript:/i.test(tag))) throw new Error('engine output contains script; only script-free HTML is supported');
  const html = /<head(?:\s[^>]*)?>/i.test(source) ? source.replace(/<head(?:\s[^>]*)?>/i, (head) => `${head}\n${POLICY}`) : /<html[^>]*>/i.test(source) ? source.replace(/<html[^>]*>/i, (tag) => `${tag}<head>${POLICY}</head>`) : source.replace(/<!doctype[^>]*>/i, (tag) => `${tag}<head>${POLICY}</head>`);
  if (Buffer.byteLength(html) > 5_000_000) throw new Error('the mock is over 5 MB; sign-off takes mocks of 5 MB or less');
  return { html, remote: [...new Set([...html.matchAll(REMOTE)].flatMap((m) => [...(m[1] ?? m[2] ?? m[3] ?? m[4] ?? '').matchAll(REMOTE_URL)].map((url) => url[0])))],
    tokens_in: output.inputTokens, tokens_out: output.outputTokens };
}
