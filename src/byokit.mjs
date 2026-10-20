// BYOKit owns every model call: plan keys, api keys or the user's installed subscription CLI.
import { accessSync, constants, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, delimiter } from 'node:path';
const codexBin = () => process.env.PATH?.split(delimiter).map((p) => resolve(p, 'codex')).find((p) => { try { accessSync(p, constants.X_OK); return true; } catch { return false; } });
let cli, launched;
async function installed() {
  if (cli) return cli;
  const bin = codexBin();
  if (!bin) throw new Error('codex is not installed on PATH');
  const stateDir = join(process.env.FIRST_DRAFT_HOME || join(homedir(), '.first-draft'), 'cli');
  mkdirSync(stateDir, { recursive: true });
  const { cliAccounts } = await import('@byokit/accounts/cli');
  return cli = { bin, accounts: cliAccounts({ stateDir, bins: { codex: bin }, env: Object.fromEntries(Object.entries(process.env).filter(([k]) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(k))), installed: true }) };
}
async function launch() {
  if (launched) return launched;
  const { bin, accounts } = await installed();
  const account = await accounts.launch('installed-codex');
  if (!account.ok) throw new Error(account.message);
  return launched = { bin, account };
}
const MEMBER = 'first-draft';

const KEY_VIA = ['plan_key', 'key'];

// The route an agent names as byokit:<route>, or undefined.
export const routeOf = (agent) => agent?.match(/^byokit:(.+)/)?.[1];

// Ready plan-key and api-key aliases plus the installed CLI, when present.
export async function readyRoutes() {
  const keys = (await import('@byokit/accounts')).routes().filter((r) => KEY_VIA.includes(r.via) && r.readiness === 'ready').flatMap((r) => (r.aliases?.length ? r.aliases : [r.id]));
  return [...new Set([...keys, ...(codexBin() ? ['codex'] : [])])];
}

const planKey = async (route) => (await import('@byokit/accounts')).routes().find((r) => KEY_VIA.includes(r.via) && (r.id === route || r.aliases?.includes(route)));
const signIn = async (key) => `set ${key.upstream.method} to your ${key.name} key, then: first-draft-axi doctor`;

async function check(route) {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 18)) return `BYOKit needs Node 22.18 or later; this is ${process.version}: install Node 22.18 or later`;
  if (route === 'codex') return;
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

// One engine turn as a pi-ai assistant message. BYOKit owns authentication and execution.
export async function respond({ route, model, context, maxTokens, signal, timeoutMs }) {
  if (route === 'codex') {
    const { bin, account } = await launch();
    const { codex } = await import('@byokit/decide/codex');
    const schema = { type: 'object', additionalProperties: false, required: ['text', 'calls'], properties: {
      text: { type: 'string' }, calls: { type: 'array', ...(!context.tools.length && { maxItems: 0 }), items: { type: 'object', additionalProperties: false, required: ['name', 'arguments'], properties: {
        name: { type: 'string', ...(context.tools.length && { enum: context.tools.map((t) => t.name) }) }, arguments: { type: 'string', description: 'JSON-encoded tool arguments matching the supplied tool schema' } } } } } };
    const answer = await codex({ bin, account, model: model.replace(/^openai-codex\//, ''), timeoutMs }).generate({
      system: context.systemPrompt, prompt: JSON.stringify({ messages: context.messages, tools: context.tools }), schema, signal, maxOutputTokens: maxTokens });
    if (!answer.data) throw new Error('BYOKit returned no structured engine response');
    const { text, calls } = answer.data;
    return { role: 'assistant', api: 'openai-responses', provider: route, model, timestamp: Date.now(),
      content: [...(text ? [{ type: 'text', text }] : []), ...calls.map((c, i) => ({ type: 'toolCall', id: `call-${Date.now()}-${i}`, name: c.name, arguments: JSON.parse(c.arguments) }))],
      stopReason: calls.length ? 'toolUse' : 'stop', usage: { input: answer.usage?.input_tokens ?? 0, output: answer.usage?.output_tokens ?? 0 } };
  }
  const problem = await check(route);
  if (problem) throw new Error(problem);
  const key = await planKey(route);
  const secret = process.env[key.upstream.method];
  if (!secret) throw new Error(`${key.upstream.method} is not set: ${await signIn(key)}`);
  const [{ Accounts, memoryStore }, { overrideStore }, found] = await Promise.all([
    import('@byokit/accounts'), import('@byokit/secrets'), modelFor(key.upstream.id, model)]);
  const base = process.env.FIRST_DRAFT_TEST_BYOKIT_BASE; // tests only: a stand-in for the provider
  const account = `${key.id}.${MEMBER}`, index = memoryStore();
  const accounts = new Accounts({ store: () => index, keyStore: () => overrideStore({ [`accounts.${account}`]: secret }) });
  try {
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
  const problem = await check(route).catch((e) => e.message);
  if (problem) return { status: 'fail', label, detail: problem };
  if (route === 'codex') {
    try {
      const { accounts } = await installed();
      const row = await accounts.status('installed-codex');
      return { label, status: row.state === 'ready' ? 'ok' : 'fail', detail: row.state === 'ready' ? `installed CLI; model ${model} (availability not probed)` : row.cause || row.state };
    } catch (e) { return { label, status: 'fail', detail: e.message }; }
  }
  const key = await planKey(route);
  try { await modelFor(key.upstream.id, model); } catch (e) { return { status: 'fail', label, detail: e.message }; }
  const set = Boolean(process.env[key.upstream.method]);
  return { status: set ? 'ok' : 'fail', label, detail: `${key.upstream.method} is ${set ? '' : 'not '}set`, ...(!set && { fix: await signIn(key) }) };
}
