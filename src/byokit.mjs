// BYOKit: every model call, in this process, with no agent CLI and no tools. A route is a
// plan key route such as opencode-go: the key comes from the variable BYOKit names
// (OPENCODE_API_KEY), held in memory for the one call and never saved.
const MEMBER = 'first-draft';

// The route an agent names as byokit:<route>, or undefined.
export const routeOf = (agent) => agent?.match(/^byokit:(.+)/)?.[1];

// The routes a person can name: each ready plan key route by alias or id.
export async function readyRoutes() {
  const keys = (await import('@byokit/accounts')).routes().filter((r) => r.via === 'plan_key' && r.readiness === 'ready').flatMap((r) => (r.aliases?.length ? r.aliases : [r.id]));
  return [...new Set(keys)];
}

const planKey = async (route) => (await import('@byokit/accounts')).routes().find((r) => r.via === 'plan_key' && (r.id === route || r.aliases?.includes(route)));
const signIn = async (key) => `set ${key.upstream.method} to your ${key.name} key, then: first-draft-axi doctor`;

async function check(route) {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 18)) return `BYOKit needs Node 22.18 or later; this is ${process.version}: install Node 22.18 or later`;
  if (!await planKey(route)) return `byokit:${route} is not a BYOKit plan route: use one of: ${(await readyRoutes()).map((r) => `byokit:${r}`).join(', ')}`;
}

// One plain call (no tools) on a route, as a pi-ai assistant message. The key and BYOKit's
// account index stay in memory, so nothing reaches the BYOKit store.
export async function respond({ route, model, context, maxTokens, signal }) {
  const problem = await check(route);
  if (problem) throw new Error(problem);
  const key = await planKey(route);
  const secret = process.env[key.upstream.method];
  if (!secret) throw new Error(`${key.upstream.method} is not set: ${await signIn(key)}`);
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
  } catch (e) {
    const why = [e.status && `HTTP ${e.status}`, e.detail].filter(Boolean).join(': ');
    if (why) e.message = `${e.message} (${why})`;
    throw e;
  } finally {
    accounts.stop();
  }
}

// doctor's check for one route, with no paid call: the route, then whether its key is set.
export async function doctor(route) {
  const label = `byokit:${route}`;
  const problem = await check(route).catch((e) => e.message);
  if (problem) return { status: 'fail', label, detail: problem };
  const key = await planKey(route);
  const set = Boolean(process.env[key.upstream.method]);
  return { status: set ? 'ok' : 'fail', label, detail: `${key.upstream.method} is ${set ? '' : 'not '}set`, ...(!set && { fix: await signIn(key) }) };
}
