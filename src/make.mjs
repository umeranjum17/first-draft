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

export async function make({ prompt, agent, model, timeoutMs, variation }) {
  const { generateViaAgent, composeSystemPrompt, makeTextEditorTool, makeDoneTool } = await engine();
  const key = (path) => { const k = path.trim().replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\.\/+/, ''); return k === '' ? '.' : k; };
  const files = new Map();
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
  const done = makeDoneTool(fs);
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
  const output = await generateViaAgent({ prompt: variation ? `${prompt}\nVariation: ${variation}` : prompt, history: [], model: { provider: 'byokit', modelId: model },
    apiKey: '', allowKeyless: true, baseUrl: 'https://byokit.invalid', signal,
    systemPrompt: `${composeSystemPrompt({ mode: 'create' })}\nHost export contract (overrides JSX/runtime guidance): write index.html, NOT App.jsx. One complete self-contained HTML5 document; inline CSS/SVG only; no scripts, event handlers or javascript: URLs; no remote URL of any kind. Use system fonts, semantic HTML and responsive layouts for 390px and 1280px. No DESIGN.md is required for this single-page export. Use the supplied editor to write it, then done(path="index.html").`,
  }, { fs, encourageToolUse: false, tools: [makeTextEditorTool(fs), { ...done, executionMode: 'sequential', execute: (id, params, ...rest) => done.execute(id, params.path ? { ...params, path: key(params.path) } : params, ...rest) }],
    onEvent: (e) => {
      if (e.type === 'tool_execution_end' && e.toolName === 'done' && !e.isError && e.result.details?.status === 'ok' && e.result.details.path === 'index.html') verified = files.get('index.html');
    } }).catch((e) => { throw failed.signal.reason ?? e; });
  const source = files.get('index.html');
  if (!source || !/<!doctype\s+html|<html[\s>]|<head[\s>]/i.test(source)) throw new Error('engine produced no complete index.html');
  if (verified === null || verified !== source) throw new Error('engine did not verify index.html with done');
  if (/<script\b|\son\w+\s*=|javascript\s*:/i.test(source)) throw new Error('engine output contains script; only script-free HTML is supported');
  const html = /<head[^>]*>/i.test(source) ? source.replace(/<head[^>]*>/i, (head) => `${head}\n${POLICY}`) : /<html[^>]*>/i.test(source) ? source.replace(/<html[^>]*>/i, (tag) => `${tag}<head>${POLICY}</head>`) : source.replace(/<!doctype[^>]*>/i, (tag) => `${tag}<head>${POLICY}</head>`);
  if (Buffer.byteLength(html) > 5_000_000) throw new Error('the mock is over 5 MB; sign-off takes mocks of 5 MB or less');
  return { html, remote: [...new Set([...html.matchAll(REMOTE)].flatMap((m) => [...(m[1] ?? m[2] ?? m[3] ?? m[4] ?? '').matchAll(REMOTE_URL)].map((url) => url[0])))],
    tokens_in: output.inputTokens, tokens_out: output.outputTokens };
}
