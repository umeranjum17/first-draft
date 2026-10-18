// BYOKit: every model call, in this process, with no agent CLI and no tools. Two kinds of plan route, as in
// learn-from-mistakes' BYOKit runner:
// - a sign-in plan (chatgpt, claude): the person's sign-in, read from the machine's BYOKit store (the one every BYOKit
//   app shares under the seal service "byokit");
// - a plan key route in BYOKit's route list, such as zai:plan_key: the key comes from the variable BYOKit's route names
//   (ZAI_API_KEY), held in memory for the one call and never saved; pi-ai's model list gives the model.

// The two sign-in plans BYOKit's respond() answers in one plain call (BYOKit's API); every other route comes from routes().
const ROUTES = ['chatgpt', 'claude'];
const MEMBER = 'first-draft';
const NODE = '22.18';

// The route an agent names as byokit:<route>, or undefined.
export const routeOf = (agent) => agent?.match(/^byokit:(.+)/)?.[1];

// The routes a person can name: the sign-in plans, then each ready plan key route by its aliases, or by the full id
// BYOKit itself prints when it ships no alias.
export async function readyRoutes() {
  const keys = (await import('@byokit/accounts')).routes().filter((r) => r.via === 'plan_key' && r.readiness === 'ready').flatMap((r) => (r.aliases?.length ? r.aliases : [r.id]));
  return [...new Set([...ROUTES, ...keys])];
}

// BYOKit's row for a plan key route, by its full id or one of its aliases, or undefined for a sign-in plan or an unknown name.
async function planKey(route) {
  if (!ROUTES.includes(route)) return (await import('@byokit/accounts')).routes().find((r) => r.via === 'plan_key' && (r.id === route || r.aliases?.includes(route)));
}

async function signIn(route) {
  const key = await planKey(route);
  return key ? `set ${key.upstream.method} to your ${key.name} key, then: first-draft-axi doctor`
    : `sign in to ${route} through BYOKit for member "${MEMBER}" (machine store, seal service "byokit"), then: first-draft-axi doctor`;
}

// What stops a route before any call, with its fix: the Node version, or a name that is not a BYOKit plan route.
async function check(route) {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 18)) return { problem: `BYOKit needs Node ${NODE} or later; this is ${process.version}`, fix: `install Node ${NODE} or later` };
  if (ROUTES.includes(route) || await planKey(route)) return;
  return { problem: `byokit:${route} is not a BYOKit plan route`, fix: `use one of: ${(await readyRoutes()).map((r) => `byokit:${r}`).join(', ')}` };
}

async function open() {
  const [{ Accounts, machineStore }, { osKeyringSeal }] = await Promise.all([import('@byokit/accounts'), import('@byokit/secrets')]);
  const seal = osKeyringSeal({ service: 'byokit' });
  return new Accounts({ store: (m) => machineStore(m, seal) });
}

// The text of a context message: a string, or its text parts joined.
const textOf = (content) => (typeof content === 'string' ? content : content.filter((c) => c.type === 'text').map((c) => c.text).join('\n'));

// A plan key call: the key and BYOKit's account index stay in memory, so nothing reaches the BYOKit store.
async function respondKey(key, { model, context, maxTokens, signal }) {
  const secret = process.env[key.upstream.method];
  if (!secret) throw new Error(`${key.upstream.method} is not set: ${await signIn(key.aliases?.[0] ?? key.id)}`);
  const [{ Accounts, memoryStore }, { overrideStore }, { getBuiltinModel }] = await Promise.all([
    import('@byokit/accounts'), import('@byokit/secrets'), import('@earendil-works/pi-ai/providers/all')]);
  const found = getBuiltinModel(key.upstream.id, model);
  if (!found) throw new Error(`pi-ai lists no model ${model} for ${key.upstream.id}`);
  const base = process.env.FIRST_DRAFT_TEST_BYOKIT_BASE; // tests only: a stand-in for the provider
  const account = `${key.id}.${MEMBER}`, index = memoryStore();
  const accounts = new Accounts({ store: () => index, keyStore: () => overrideStore({ [`accounts.${account}`]: secret }) });
  try {
    return await accounts.respondKey(MEMBER, { account, model: { ...found, ...(base && { baseUrl: base }) },
      context: { systemPrompt: context.systemPrompt, messages: context.messages },
      options: { signal, ...(maxTokens && { maxTokens }) } });
  } finally {
    accounts.stop();
  }
}

// One plain call (no tools) on a route, as a pi-ai assistant message: { content, usage, stopReason, errorMessage }.
export async function respond(request) {
  try {
    return await ask(request);
  } catch (e) {
    // BYOKit's message is its own bounded words; the provider's status and its words (key redacted) say why.
    const why = [e.status && `HTTP ${e.status}`, e.detail].filter(Boolean).join(': ');
    if (why) e.message = `${e.message} (${why})`;
    throw e;
  }
}

async function ask({ route, model, context, maxTokens, signal }) {
  const p = await check(route);
  if (p) throw new Error(`${p.problem}: ${p.fix}`);
  const key = await planKey(route);
  if (key) return respondKey(key, { model, context, maxTokens, signal });
  const system = context.systemPrompt ?? '';
  const messages = context.messages.map((m) => ({ role: m.role, content: textOf(m.content) }));
  const accounts = await open();
  try {
    // The request shape per sign-in plan is BYOKit's own API (Ask vs ClaudePlanAsk).
    const text = route === 'claude'
      ? await accounts.respond(MEMBER, { provider: 'claude', model, max_tokens: maxTokens ?? 32000, system, messages, signal })
      : await accounts.respond(MEMBER, { instructions: system, input: messages.map((m) => m.content).join('\n\n'), model, signal });
    return { role: 'assistant', content: [{ type: 'text', text }], stopReason: 'stop', usage: { input: 0, output: 0 } };
  } finally {
    accounts.stop();
  }
}

// doctor's check for one route, with no paid call: the route, then the sign-in's state or the key.
export async function doctor(route) {
  const label = `byokit:${route}`;
  let accounts;
  try {
    const p = await check(route);
    if (p) return { status: 'fail', label, detail: p.problem, fix: p.fix };
    const key = await planKey(route);
    if (key) {
      const set = Boolean(process.env[key.upstream.method]);
      return { status: set ? 'ok' : 'fail', label, detail: `${key.upstream.method} is ${set ? '' : 'not '}set`, ...(!set && { fix: await signIn(route) }) };
    }
    accounts = await open();
    const s = await accounts.status(MEMBER, route);
    const status = { ready: 'ok', resting: 'warn' }[s.state] ?? 'fail'; // resting: signed in, at a limit for now
    return { status, label, detail: s.words, ...(status === 'fail' && { fix: await signIn(route) }) };
  } catch (e) { // the store or its seal cannot be read, such as a locked keyring
    return { status: 'fail', label, detail: e.message, fix: await signIn(route) };
  } finally {
    accounts?.stop();
  }
}
