// BYOKit owns every model call: plan keys, api keys or the user's installed subscription CLI.
import { accessSync, constants, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, delimiter } from 'node:path';
import { modelPool, poolNext, poolPick } from './model-pool.mjs';
const CLI_ROUTES = ['claude', 'codex'];
const cliBin = (route) => process.env.PATH?.split(delimiter).map((p) => resolve(p, route)).find((p) => { try { accessSync(p, constants.X_OK); return true; } catch { return false; } });
const cli = new Map(), launched = new Map();
async function installed(route) {
  if (cli.has(route)) return cli.get(route);
  const bin = cliBin(route);
  if (!bin) throw new Error(`${route} is not installed on PATH`);
  const stateDir = join(process.env.FIRST_DRAFT_HOME || join(homedir(), '.first-draft'), 'cli');
  mkdirSync(stateDir, { recursive: true });
  const { cliAccounts } = await import('@byokit/accounts/cli');
  // Filter names before reading values: installed subscription routes never read API keys.
  const env = Object.fromEntries(Object.keys(process.env).filter((k) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(k) && !/KEY|TOKEN|SECRET/i.test(k)).map((k) => [k, process.env[k]]));
  const value = { bin, accounts: cliAccounts({ stateDir, bins: { [route]: bin }, env, installed: true }) };
  cli.set(route, value);
  return value;
}
// One launch per route, shared by calls that overlap (logo draws its options in parallel); a failed launch is tried again by the next call.
function launch(route) {
  if (!launched.has(route)) launched.set(route, (async () => {
    const { bin, accounts } = await installed(route);
    const account = await accounts.launch(`installed-${route}`);
    if (!account.ok) throw new Error(account.message);
    if (route === 'claude' && account.account.method !== 'subscription') throw new Error('Claude must be signed in with a Claude subscription, not an API key or another billing route');
    return { bin, account };
  })().catch((e) => { launched.delete(route); throw e; }));
  return launched.get(route);
}
export const installedCodex = () => launch('codex'); // Asset adapter reuses BYOKit's installed account by path.

// Pool accounts may be signed in even when the default account is not; BYOKit probes both.
async function pooledStatus(route, model) {
  const pool = modelPool();
  if (!pool) return;
  const picked = await poolPick(pool, { model, deadline: Math.ceil(Date.now() / 1000) + 30, attempted: [] });
  if (picked.provider !== route || picked.model !== model) return;
  const folder = route === 'claude' ? 'CLAUDE_CONFIG_DIR' : 'CODEX_HOME';
  if (Object.keys(picked.set).some(k => k !== folder)) throw new Error(`The ${route} pool account has unsupported environment settings`);
  const { bin } = await installed(route), { cliAccounts } = await import('@byokit/accounts/cli');
  const env = Object.fromEntries(Object.keys(process.env).filter(k => !/KEY|TOKEN|SECRET/i.test(k) && !picked.unset.includes(k)).map(k => [k, process.env[k]]));
  const accounts = cliAccounts({ stateDir: join(process.env.FIRST_DRAFT_HOME || join(homedir(), '.first-draft'), 'cli'), bins: { [route]: bin }, env: { ...env, ...picked.set }, installed: true });
  return accounts.status(`installed-${route}`);
}

// The installed-CLI adapters a pooled answer can run, by the provider the pool names.
const ADAPTERS = { claude: ['@byokit/decide/claude-code', 'claudeCode'], codex: ['@byokit/decide/codex', 'codex'] };
const backendOn = async (route, { bin, account, model, timeoutMs }) => {
  const [path, name] = ADAPTERS[route];
  return (await import(path))[name]({ bin, ...(account && { account }), model: route === 'codex' ? model.replace(/^openai-codex\//, '') : model, timeoutMs });
};

// One answer from an installed CLI. With the optional account pool installed the helper names the account folder (a path, never a
// credential) and first-draft moves on when that account runs out; without it, BYOKit's installed account answers, exactly as before.
// A limit may select another account, but never a different engine/model: that would invalidate attribution and judge independence.
async function cliAnswer(route, { model, images, timeoutMs, signal }, call) {
  const pool = modelPool();
  if (!pool) {
    const { bin, account } = await launch(route);
    return call(await backendOn(route, { bin, account, model, timeoutMs }));
  }
  const deadline = Math.ceil((Date.now() + timeoutMs) / 1000), attempted = [];
  let selection, cause;
  for (;;) {
    const left = deadline * 1000 - Date.now();
    if (left < 1000) throw new Error(`the account pool ran out of time before an account answered (${cause ?? 'no pick'})`);
    const answer = selection === undefined
      ? await poolPick(pool, { model, deadline, attempted })
      : await poolNext(pool, { selection, cause, model, deadline, attempted });
    attempted.push(answer.selection_id);
    if (answer.provider !== route || answer.model.replace(/^openai-codex\//, '') !== model.replace(/^openai-codex\//, '')) throw new Error(`The account pool changed the resolved engine ${route} / ${model} to ${answer.provider} / ${answer.model}; no call made`);
    const on = answer.provider, bin = cliBin(on);
    if (!bin) throw engineRequired(on, 'The resolved engine is no longer installed');
    try {
      return await call(await backendOn(on, { bin, account: { set: answer.set, unset: answer.unset }, model: answer.model, timeoutMs: left }));
    } catch (e) {
      if (e.code === 'aborted' || signal?.aborted) throw e;
      // A model that answered off-schema is not an account limit: report it rather than spending the rest of the pool on it.
      if (!['process', 'timeout', 'subscription_required'].includes(e.code)) throw e;
      selection = answer; cause = e.code === 'process' ? 'quota' : e.code === 'timeout' ? 'timeout' : 'unavailable';
    }
  }
}
const MEMBER = 'first-draft';
// The most a subscription CLI route lets one reply write (BYOKit's own limit): a page call asks for all of it, never less (wrapper-baseline test).
export const OUTPUT_CAP = 16_384;

const KEY_VIA = ['plan_key', 'key'];

// The route an agent names as byokit:<route>, or undefined.
export const routeOf = (agent) => typeof agent === 'string' ? agent.match(/^byokit:(.+)/)?.[1] : undefined;

export async function readySubscriptions() {
  const rows = await Promise.all(CLI_ROUTES.map(async (route) => {
    if (!cliBin(route)) return [];
    try {
      const { accounts } = await installed(route);
      let row = await accounts.status(`installed-${route}`);
      if (row.state !== 'ready' || (route === 'claude' && row.method !== 'subscription')) row = await pooledStatus(route, DEFAULT_MODELS[route]) ?? row;
      if (row.state !== 'ready' || (route === 'claude' && row.method !== 'subscription')) return [];
      return [{ route: `byokit:${route}`, label: route === 'claude' ? 'Claude subscription' : 'ChatGPT subscription', init: `first-draft-axi init --agent byokit:${route} --model <model>` }];
    } catch { return []; } // Unusable candidates are skipped; doctor on a configured route reports its exact failure.
  }));
  return rows.flat();
}

// Ready subscriptions first, then the other BYOKit routes.
export async function readyRoutes() {
  const keys = (await import('@byokit/accounts')).routes().filter((r) => KEY_VIA.includes(r.via) && r.readiness === 'ready' && Boolean(process.env[r.upstream.method])).flatMap((r) => (r.aliases?.length ? r.aliases : [r.id]));
  return [...new Set([...(await readySubscriptions()).map((r) => routeOf(r.route)), ...keys])];
}

// Subscription/API aliases of one producer are one engine, not independent judges.
export async function engineOf(agent) {
  const route = routeOf(agent), provider = CLI_ROUTES.includes(route) ? route : (await planKey(route))?.upstream.id;
  return provider === 'openai' ? 'codex' : provider === 'anthropic' ? 'claude' : provider;
}

export const DEFAULT_MODELS = { claude: 'claude-sonnet-5-5', codex: 'gpt-6.1-sol' };
export const engineInstruction = (route) => route === 'codex' ? 'Sign in to ChatGPT: codex login' : 'Sign in to Claude: claude auth login';
export const engineRequired = (route, reason = 'No usable AI engine') => Object.assign(new Error(`${reason}. ${engineInstruction(route)}`), { code: 'NO_ENGINE' });

// Only BYOKit's ready, authenticated sources are candidates. Never infer authentication from saved configuration.
export async function resolveEngine(c = {}, { exclude, subscription = false, images = false } = {}) {
  const excluded = exclude && await engineOf(exclude.agent);
  const candidates = [...(c.agent ? [{ agent: c.agent, model: c.model }] : [])];
  for (const route of await readyRoutes()) {
    if (subscription && !CLI_ROUTES.includes(route)) continue;
    let model = !c.agent && c.model ? c.model : DEFAULT_MODELS[route];
    if (!model) {
      const key = await planKey(route);
      const { getBuiltinModels } = await import('@earendil-works/pi-ai/providers/all');
      model = getBuiltinModels(key.upstream.id).find((m) => !images || m.input?.includes('image'))?.id;
    }
    if (model) candidates.push({ agent: `byokit:${route}`, model });
  }
  for (const candidate of candidates) {
    const route = routeOf(candidate.agent);
    if (!route || typeof candidate.model !== 'string' || !candidate.model.trim() || (subscription && !CLI_ROUTES.includes(route)) || (exclude && await engineOf(candidate.agent) === excluded)
      || (exclude && candidate.model.replace(/^openai-codex\//, '') === exclude.model.replace(/^openai-codex\//, ''))) continue;
    if ((await doctor(route, candidate.model)).status !== 'ok' || (images && !await imageSupport(route, candidate.model))) continue;
    return { ...c, ...candidate, timeoutMs: c.timeoutMs ?? 600_000 };
  }
  const openCodeStore = join(process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share'), 'opencode');
  const unsupported = !exclude && ['auth.json', 'opencode.db'].some((file) => existsSync(join(openCodeStore, file)));
  throw engineRequired(exclude && routeOf(c.agent) === routeOf(exclude.agent) ? (routeOf(exclude.agent) === 'claude' ? 'codex' : 'claude') : routeOf(c.agent), exclude ? 'No independent AI judge is usable' : unsupported ? 'OpenCode login storage is present but is not usable by this build; no usable AI engine' : 'No usable AI engine');
}

export const modelRouteProblem = (route, model) => route !== 'claude' && (/anthropic|claude|opus|sonnet|haiku/i.test(model ?? '') || /anthropic/i.test(route ?? ''))
  ? 'Claude models use your Claude subscription only. Run: first-draft-axi init --agent byokit:claude --model <model>' : undefined;

const planKey = async (route) => (await import('@byokit/accounts')).routes().find((r) => KEY_VIA.includes(r.via) && (r.id === route || r.aliases?.includes(route)));
const signIn = async (key) => `set ${key.upstream.method} to your ${key.name} key, then: first-draft-axi doctor`;

async function check(route, model) {
  if (typeof model !== 'string' || !model.trim()) return 'A real engine needs a model id';
  const refusal = modelRouteProblem(route, model);
  if (refusal) return refusal;
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 18)) return `BYOKit needs Node 22.18 or later; this is ${process.version}: install Node 22.18 or later`;
  if (CLI_ROUTES.includes(route)) return;
  if (!await planKey(route)) return `byokit:${route} is not a BYOKit plan or api key route: use one of: ${(await readyRoutes()).map((r) => `byokit:${r}`).join(', ')}`;
}

// The model id goes straight to the provider: pi-ai's list is only a template for the call shape, never a gate on which ids exist.
async function modelFor(provider, id) {
  const { getBuiltinModel, getBuiltinModels } = await import('@earendil-works/pi-ai/providers/all');
  const found = getBuiltinModel(provider, id);
  if (found) return found;
  const [template] = getBuiltinModels(provider);
  if (!template) throw new Error(`pi-ai has no call shape for provider ${provider}`);
  return { ...template, id, name: id };
}

export async function imageSupport(route, model) {
  if (CLI_ROUTES.includes(route)) return true; // Both published CLI adapters accept native image blocks.
  const key = await planKey(route);
  return key ? (await modelFor(key.upstream.id, model)).input?.includes('image') === true : false;
}

// One engine turn as a pi-ai assistant message. BYOKit owns authentication and execution.
export async function respond({ route, model, context, maxTokens, signal, timeoutMs, images = [], singleCall = false }) {
  const problem = await check(route, model);
  if (problem) throw new Error(problem);
  if (images.length && !await imageSupport(route, model)) throw new Error(`byokit:${route} / ${model} does not support reference images; none were sent`);
  if (CLI_ROUTES.includes(route)) {
    const schema = { type: 'object', additionalProperties: false, required: ['text', 'calls'], properties: {
      text: { type: 'string' }, calls: { type: 'array', ...(singleCall && { minItems: 1, maxItems: 1 }), items: { type: 'object', additionalProperties: false, required: ['name', 'arguments'], properties: {
        name: { type: 'string', enum: context.tools.map((t) => t.name) }, arguments: { type: 'string', description: 'JSON-encoded tool arguments matching the supplied tool schema' } } } } } };
    return cliAnswer(route, { model, images, timeoutMs, signal }, async (backend) => {
      // The model writes each call's arguments as JSON inside a JSON string and sometimes breaks it (Opus 5.5 did, in a concept call, after 5 minutes): asked again once.
      for (let attempt = 0; ; attempt++) {
        const answer = await backend.generate({
          system: context.systemPrompt, prompt: JSON.stringify({ messages: context.messages, tools: context.tools }), images, schema, signal, maxOutputTokens: maxTokens });
        if (!answer.data) throw new Error('BYOKit returned no structured engine response');
        const { text, calls } = answer.data;
        let args;
        try { args = calls.map((c) => JSON.parse(c.arguments)); } catch (e) {
          if (attempt) throw new Error(`the model's tool call was not valid JSON twice: ${e.message}`);
          continue;
        }
        return { role: 'assistant', api: 'openai-responses', provider: route, model, timestamp: Date.now(),
          content: [...(text ? [{ type: 'text', text }] : []), ...calls.map((c, i) => ({ type: 'toolCall', id: `call-${Date.now()}-${i}`, name: c.name, arguments: args[i] }))],
          stopReason: calls.length ? 'toolUse' : 'stop', usage: { input: answer.usage?.input_tokens ?? 0, output: answer.usage?.output_tokens ?? 0 } };
      }
    });
  }
  const key = await planKey(route);
  const secret = process.env[key.upstream.method];
  if (!secret) throw new Error(`${key.upstream.method} is not set: ${await signIn(key)}`);
  const [{ Accounts, memoryStore }, { overrideStore }, found] = await Promise.all([
    import('@byokit/accounts'), import('@byokit/secrets'), modelFor(key.upstream.id, model)]);
  const account = `${key.id}.${MEMBER}`, index = memoryStore();
  const accounts = new Accounts({ store: () => index, keyStore: () => overrideStore({ [`accounts.${account}`]: secret }) });
  try {
    if (images.length) {
      const first = context.messages.findIndex((m) => m.role === 'user');
      if (first < 0) throw new Error('Reference images require a user message');
      context = { ...context, messages: context.messages.map((m, i) => i !== first ? m : { ...m, content: [
        ...(typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : m.content),
        ...images.map((image) => ({ type: 'image', mimeType: image.mime, data: image.dataUrl.slice(image.dataUrl.indexOf(',') + 1) })),
      ] }) };
    }
    return await accounts.respondKey(MEMBER, { account, model: found,
      context,
      options: { signal, ...(maxTokens && { maxTokens: Math.min(found.maxTokens ?? Infinity, maxTokens * 4) }) } }); // thinking models spend the cap before the page; the model's own limit bounds it
  } catch (e) {
    const why = [e.status && `HTTP ${e.status}`, e.detail].filter(Boolean).join(': ');
    if (why) e.message = `${e.message} (${why})`;
    throw e;
  } finally {
    accounts.stop();
  }
}

// One page in one reply: the model answers with the document itself, not a tool call whose arguments carry it as JSON inside JSON.
// A subscription CLI still answers through a schema, so the page is one JSON string there; a key route answers in plain text.
export async function writePage({ route, model, system, prompt, images = [], signal, timeoutMs, maxTokens = OUTPUT_CAP }) {
  const problem = await check(route, model);
  if (problem) throw new Error(problem);
  if (images.length && !await imageSupport(route, model)) throw new Error(`byokit:${route} / ${model} does not support reference images; none were sent`);
  if (CLI_ROUTES.includes(route)) {
    return cliAnswer(route, { model, images, timeoutMs, signal }, async (backend) => {
      const answer = await backend.generate({ system, prompt, images, signal, maxOutputTokens: maxTokens,
        schema: { type: 'object', additionalProperties: false, required: ['html'], properties: { html: { type: 'string', description: 'The complete HTML document, from <!doctype html> to </html>' } } } });
      if (typeof answer.data?.html !== 'string') throw new Error('BYOKit returned no page');
      return { html: answer.data.html, tokens_in: answer.usage?.input_tokens ?? 0, tokens_out: answer.usage?.output_tokens ?? 0 };
    });
  }
  const message = await respond({ route, model, maxTokens, signal, timeoutMs, images, context: { systemPrompt: system, messages: [{ role: 'user', content: prompt, timestamp: Date.now() }], tools: [] } });
  if (message.stopReason === 'error' || message.stopReason === 'aborted') throw new Error(message.errorMessage || message.stopReason);
  const text = message.content.filter((c) => c.type === 'text').map((c) => c.text).join('');
  return { html: text.match(/<!doctype[\s\S]*<\/html>|<html[\s\S]*<\/html>/i)?.[0] ?? text, tokens_in: message.usage?.input ?? 0, tokens_out: message.usage?.output ?? 0 };
}

// Local route readiness only: no paid model availability probe.
export async function doctor(route, model) {
  const label = `byokit:${route}`;
  const problem = await check(route, model).catch((e) => e.message);
  if (problem) return { status: 'fail', label, detail: problem };
  if (CLI_ROUTES.includes(route)) {
    try {
      const { accounts } = await installed(route);
      let row = await accounts.status(`installed-${route}`);
      if (row.state !== 'ready' || (route === 'claude' && row.method !== 'subscription')) row = await pooledStatus(route, model) ?? row;
      if (row.state === 'ready' && route === 'claude' && row.method !== 'subscription') return { label, status: 'fail', detail: 'Claude must be signed in with a Claude subscription, not an API key or another billing route' };
      return { label, status: row.state === 'ready' ? 'ok' : 'fail', detail: row.state === 'ready' ? `installed CLI; model ${model} (availability not probed); adapter supports image input` : row.cause || row.state };
    } catch (e) { return { label, status: 'fail', detail: e.message }; }
  }
  const key = await planKey(route);
  try { await modelFor(key.upstream.id, model); } catch (e) { return { status: 'fail', label, detail: e.message }; }
  const set = Boolean(process.env[key.upstream.method]);
  return { status: set ? 'ok' : 'fail', label, detail: `${key.upstream.method} is ${set ? '' : 'not '}set; reference images ${await imageSupport(route, model) ? 'supported' : 'not supported by this model'}`, ...(!set && { fix: await signIn(key) }) };
}
