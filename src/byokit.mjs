// BYOKit owns every model call: plan keys, api keys or the user's installed subscription CLI.
import { accessSync, constants, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, delimiter } from 'node:path';
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
const MEMBER = 'first-draft';

const KEY_VIA = ['plan_key', 'key'];

// The route an agent names as byokit:<route>, or undefined.
export const routeOf = (agent) => agent?.match(/^byokit:(.+)/)?.[1];

export async function readySubscriptions() {
  const rows = await Promise.all(CLI_ROUTES.map(async (route) => {
    if (!cliBin(route)) return [];
    try {
      const { accounts } = await installed(route);
      const row = await accounts.status(`installed-${route}`);
      if (row.state !== 'ready' || (route === 'claude' && row.method !== 'subscription')) return [];
      return [{ route: `byokit:${route}`, label: route === 'claude' ? 'Claude subscription' : 'ChatGPT subscription', init: `first-draft-axi init --agent byokit:${route} --model <model>` }];
    } catch { return []; } // Discovery is optional; doctor on a configured route reports its exact failure.
  }));
  return rows.flat();
}

// Ready subscriptions first, then the other BYOKit routes.
export async function readyRoutes() {
  const keys = (await import('@byokit/accounts')).routes().filter((r) => KEY_VIA.includes(r.via) && r.readiness === 'ready').flatMap((r) => (r.aliases?.length ? r.aliases : [r.id]));
  return [...new Set([...(await readySubscriptions()).map((r) => routeOf(r.route)), ...keys])];
}

export const modelRouteProblem = (route, model) => route !== 'claude' && (/anthropic|claude|opus|sonnet|haiku/i.test(model ?? '') || /anthropic/i.test(route ?? ''))
  ? 'Claude models use your Claude subscription only. Run: first-draft-axi init --agent byokit:claude --model <model>' : undefined;

const planKey = async (route) => (await import('@byokit/accounts')).routes().find((r) => KEY_VIA.includes(r.via) && (r.id === route || r.aliases?.includes(route)));
const signIn = async (key) => `set ${key.upstream.method} to your ${key.name} key, then: first-draft-axi doctor`;

async function check(route, model) {
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
    const { bin, account } = await launch(route);
    const backend = route === 'claude' ? (await import('@byokit/decide/claude-code')).claudeCode : (await import('@byokit/decide/codex')).codex;
    const schema = { type: 'object', additionalProperties: false, required: ['text', 'calls'], properties: {
      text: { type: 'string' }, calls: { type: 'array', ...(singleCall && { minItems: 1, maxItems: 1 }), items: { type: 'object', additionalProperties: false, required: ['name', 'arguments'], properties: {
        name: { type: 'string', enum: context.tools.map((t) => t.name) }, arguments: { type: 'string', description: 'JSON-encoded tool arguments matching the supplied tool schema' } } } } } };
    // The model writes each call's arguments as JSON inside a JSON string and sometimes breaks it (Opus 5.5 did, in a concept call, after 5 minutes): asked again once.
    for (let attempt = 0; ; attempt++) {
      const answer = await backend({ bin, account, model: route === 'codex' ? model.replace(/^openai-codex\//, '') : model, timeoutMs }).generate({
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
  }
  const key = await planKey(route);
  const secret = process.env[key.upstream.method];
  if (!secret) throw new Error(`${key.upstream.method} is not set: ${await signIn(key)}`);
  const [{ Accounts, memoryStore }, { overrideStore }, found] = await Promise.all([
    import('@byokit/accounts'), import('@byokit/secrets'), modelFor(key.upstream.id, model)]);
  const base = process.env.FIRST_DRAFT_TEST_BYOKIT_BASE; // tests only: a stand-in for the provider
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
    return await accounts.respondKey(MEMBER, { account, model: { ...found, ...(base && { baseUrl: base }) },
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

// Local route readiness only: no paid model availability probe.
export async function doctor(route, model) {
  const label = `byokit:${route}`;
  const problem = await check(route, model).catch((e) => e.message);
  if (problem) return { status: 'fail', label, detail: problem };
  if (CLI_ROUTES.includes(route)) {
    try {
      const { accounts } = await installed(route);
      const row = await accounts.status(`installed-${route}`);
      if (row.state === 'ready' && route === 'claude' && row.method !== 'subscription') return { label, status: 'fail', detail: 'Claude must be signed in with a Claude subscription, not an API key or another billing route' };
      return { label, status: row.state === 'ready' ? 'ok' : 'fail', detail: row.state === 'ready' ? `installed CLI; model ${model} (availability not probed); adapter supports image input` : row.cause || row.state };
    } catch (e) { return { label, status: 'fail', detail: e.message }; }
  }
  const key = await planKey(route);
  try { await modelFor(key.upstream.id, model); } catch (e) { return { status: 'fail', label, detail: e.message }; }
  const set = Boolean(process.env[key.upstream.method]);
  return { status: set ? 'ok' : 'fail', label, detail: `${key.upstream.method} is ${set ? '' : 'not '}set; reference images ${await imageSupport(route, model) ? 'supported' : 'not supported by this model'}`, ...(!set && { fix: await signIn(key) }) };
}
