import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { AxiError, runAxiCli } from 'axi-sdk-js';
import { doctor as routeDoctor, readyRoutes, routeOf } from './byokit.mjs';
import { configPath, read, save } from './config.mjs';
import { make } from './make.mjs';

const VERSION = '0.1.0';
const ASK = 'Ask the user which BYOKit route and model to use (first-draft picks none), then run `first-draft-axi init --agent byokit:<route> --model <model>`';

const HELP = `usage: first-draft-axi <command> [flags]
commands[3]:
  make "<prompt>" --out <file.html>   make one design mock: one self-contained HTML page (one model call)
  doctor                              show whether the configured agent is ready, with no paid call
  init --agent byokit:<route> --model <model>   save the user's agent and model to the config
The agent is the person's own choice: first-draft never picks one. A route is BYOKit's: a sign-in plan (byokit:claude, byokit:chatgpt) or a plan key route such as byokit:zai:plan_key.
Config: $FIRST_DRAFT_HOME/config.yaml (default ~/.first-draft), keys agent, agent_config.<agent>.model, agent_timeout.`;

const flags = (args, options) => {
  try {
    return parseArgs({ args, options, allowPositionals: true });
  } catch (e) {
    throw new AxiError(e.message, 'USAGE', ['Run `first-draft-axi --help`']);
  }
};

// The agent and model make runs with, or the question to ask the user when either is not set.
function agentOrAsk() {
  const c = read();
  if (!c.agent) throw new AxiError(`no agent is set in ${configPath()}`, 'NO_AGENT', [ASK]);
  if (!routeOf(c.agent)) throw new AxiError(`agent ${c.agent} is not byokit:<route>; this release runs BYOKit routes only`, 'BAD_AGENT', [ASK]);
  if (!c.model) throw new AxiError(`no model is set for ${c.agent} (agent_config.${c.agent}.model in ${configPath()})`, 'NO_MODEL', [ASK]);
  return c;
}

const commands = {
  async make(args) {
    const { values, positionals } = flags(args, { out: { type: 'string' } });
    const prompt = positionals.join(' ').trim();
    if (!prompt || !values.out) throw new AxiError('make needs a prompt and --out <file.html>', 'USAGE', ['Run `first-draft-axi make "<prompt>" --out <file.html>`']);
    const c = agentOrAsk();
    const started = Date.now();
    let made;
    try {
      made = await make({ prompt, ...c });
    } catch (e) {
      throw new AxiError(`${c.agent} (${c.model}) did not make the design: ${e.message}`, 'MAKE_FAILED', ['Run `first-draft-axi doctor`']);
    }
    const out = resolve(values.out);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, made.html);
    return {
      made: { file: out, bytes: Buffer.byteLength(made.html), agent: c.agent, model: c.model, seconds: Math.round((Date.now() - started) / 1000), tokens_in: made.tokens_in, tokens_out: made.tokens_out },
      ...(made.remote.length && { blocked_remote: made.remote }),
      help: [made.remote.length ? 'The design names remote files; the page loads none of them, so those parts show empty' : 'The page loads nothing from the network',
        `Post it for review: sign-off-axi post --type design --title "<question>" --option a=<label> --mock a=<board-relative path to ${out}>`],
    };
  },

  async doctor() {
    const rows = [{ status: 'ok', label: 'node', detail: process.version }];
    let c;
    try {
      c = read();
    } catch (e) {
      rows.push({ status: 'fail', label: 'config', detail: e.message });
    }
    if (c && !c.agent) rows.push({ status: 'fail', label: 'agent', detail: `no agent is set in ${configPath()}`, fix: ASK });
    else if (c && !routeOf(c.agent)) rows.push({ status: 'fail', label: 'agent', detail: `${c.agent} is not byokit:<route>`, fix: ASK });
    else if (c) {
      rows.push(c.model ? { status: 'ok', label: 'model', detail: c.model } : { status: 'fail', label: 'model', detail: `no model is set for ${c.agent}`, fix: ASK });
      rows.push(await routeDoctor(routeOf(c.agent)));
    }
    const ready = rows.every((r) => r.status !== 'fail');
    return { ready, checks: rows, help: [ready ? 'Run `first-draft-axi make "<prompt>" --out <file.html>`' : 'Fix the failing checks, then run `first-draft-axi doctor` again'] };
  },

  async init(args) {
    const { values } = flags(args, { agent: { type: 'string' }, model: { type: 'string' } });
    if (!values.agent || !values.model) {
      const routes = await readyRoutes().catch(() => []);
      throw new AxiError('init needs the user\'s --agent byokit:<route> and --model <model>', 'USAGE',
        [ASK, ...(routes.length ? [`BYOKit routes: ${routes.map((r) => `byokit:${r}`).join(', ')}`] : [])]);
    }
    if (!routeOf(values.agent)) throw new AxiError(`agent ${values.agent} is not byokit:<route>`, 'BAD_AGENT', [ASK]);
    save(values);
    return { saved: { config: configPath(), agent: values.agent, model: values.model }, help: ['Run `first-draft-axi doctor`'] };
  },
};

await runAxiCli({
  description: 'Turn a prompt into a design mock: one self-contained HTML page, made by the model you choose',
  version: VERSION,
  topLevelHelp: HELP,
  commands,
  home: () => {
    const c = read();
    return { config: configPath(), agent: c.agent ?? 'not set', model: c.model ?? 'not set', help: [c.agent && c.model ? 'Run `first-draft-axi doctor`' : ASK] };
  },
});
