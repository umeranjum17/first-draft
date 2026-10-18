#!/usr/bin/env node
// first-draft-axi: a prompt to design mocks. The agent is the person's own choice; first-draft picks none.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { doctor as routeDoctor, readyRoutes, routeOf } from './byokit.mjs';
import { make } from './make.mjs';

const VERSION = '0.1.0';
const ASK = 'Ask the user which BYOKit route and model to use (first-draft picks none), then run `first-draft-axi init --agent byokit:<route> --model <model>`';
const HOME = () => process.env.FIRST_DRAFT_HOME || join(homedir(), '.first-draft');
const CONFIG = () => join(HOME(), 'config.json');
const VARIATIONS = ['a calm minimal layout with generous whitespace', 'a bold colorful layout with strong hierarchy', 'a dense information-rich dashboard layout'];

const read = () => {
  try {
    const c = JSON.parse(readFileSync(CONFIG(), 'utf8'));
    const t = c.agent_timeout ?? '10m';
    const timeout = /^\d+[smh]$/.test(t) ? t : '10m';
    return { agent: c.agent, model: c.agent && c.agent_config?.[c.agent]?.model, timeoutMs: Number(timeout.slice(0, -1)) * { s: 1e3, m: 6e4, h: 36e5 }[timeout.slice(-1)] };
  } catch (e) {
    if (e.code === 'ENOENT') return {};
    throw e;
  }
};
const save = ({ agent, model }) => {
  let c = {};
  try { c = JSON.parse(readFileSync(CONFIG(), 'utf8')); } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  c = { ...c, agent, agent_config: { ...c.agent_config, [agent]: { model } } };
  mkdirSync(HOME(), { recursive: true });
  writeFileSync(CONFIG(), `${JSON.stringify(c, null, 2)}\n`);
};

const fail = (code, message, help = []) => {
  console.log(JSON.stringify({ error: { code, message }, help }));
  process.exit(1);
};
const flags = (args, options) => {
  try {
    return parseArgs({ args, options, allowPositionals: true });
  } catch (e) { fail('USAGE', e.message, ['Run `first-draft-axi --help`']); }
};
const agentOrAsk = () => {
  const c = read();
  if (!c.agent) fail('NO_AGENT', `no agent is set in ${CONFIG()}`, [ASK]);
  if (!routeOf(c.agent)) fail('BAD_AGENT', `agent ${c.agent} is not byokit:<route>; this release runs BYOKit routes only`, [ASK]);
  if (!c.model) fail('NO_MODEL', `no model is set for ${c.agent} in ${CONFIG()}`, [ASK]);
  return c;
};

const HELP = `usage: first-draft-axi <command> [flags]
commands[3]:
  make "<prompt>" --out <file.html> [--count N]   make N design mocks: self-contained HTML pages (one model call each)
  doctor                              show whether the configured agent is ready, with no paid call
  init --agent byokit:<route> --model <model>   save the user's agent and model to the config
The agent is the person's own choice: first-draft never picks one. A route is a BYOKit plan key route such as byokit:opencode-go.
Config: $FIRST_DRAFT_HOME/config.json (default ~/.first-draft).`;

const [command, ...rest] = process.argv.slice(2);
if (!command || command === '--help' || command === '-h') { console.log(HELP); process.exit(0); }
if (command === '--version' || command === '-v') { console.log(VERSION); process.exit(0); }

if (command === 'make') {
  const { values, positionals } = flags(rest, { out: { type: 'string' }, count: { type: 'string', default: '1' } });
  const prompt = positionals.join(' ').trim();
  const count = Number(values.count);
  if (!prompt || !values.out) fail('USAGE', 'make needs a prompt and --out <file.html>', ['Run `first-draft-axi make "<prompt>" --out <file.html>`']);
  if (!Number.isInteger(count) || count < 1 || count > 5) fail('USAGE', '--count is 1-5', ['Run `first-draft-axi make "<prompt>" --out <file.html> --count 3`']);
  const c = agentOrAsk();
  const started = Date.now();
  const files = [];
  let tokens_in = 0, tokens_out = 0;
  const blocked = new Set();
  for (let i = 0; i < count; i++) {
    let made;
    try {
      made = await make({ prompt, ...c, variation: count > 1 ? `${i + 1} of ${count}: ${VARIATIONS[i % VARIATIONS.length]}` : undefined });
    } catch (e) { fail('MAKE_FAILED', `${c.agent} (${c.model}) did not make the design: ${e.message}`, ['Run `first-draft-axi doctor`']); }
    const numbered = values.out.includes('{i}') ? values.out.replace('{i}', String(i + 1)) : count > 1 ? values.out.slice(0, -extname(values.out).length || undefined) + `-${i + 1}` + extname(values.out) : values.out;
    const out = resolve(numbered);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, made.html);
    files.push({ file: out, bytes: Buffer.byteLength(made.html) });
    tokens_in += made.tokens_in;
    tokens_out += made.tokens_out;
    made.remote.forEach((r) => blocked.add(r));
  }
  console.log(JSON.stringify({ made: { files, agent: c.agent, model: c.model, seconds: Math.round((Date.now() - started) / 1000), tokens_in, tokens_out },
    ...(blocked.size && { blocked_remote: [...blocked] }),
    help: [blocked.size ? 'The designs name remote files; the pages load none of them, so those parts show empty' : 'The pages load nothing from the network',
      `Post them for review: sign-off-axi post --type design --title "<question>"${files.map((f, i) => ` --option ${'abcde'[i]}=<label> --mock ${'abcde'[i]}=${relative(resolve('.sign-off'), f.file)}`).join('')}`] }));
} else if (command === 'doctor') {
  const rows = [{ status: 'ok', label: 'node', detail: process.version }];
  let c;
  try { c = read(); } catch (e) { fail('CONFIG', e.message, [`Fix ${CONFIG()}, then run \`first-draft-axi doctor\``]); }
  const unready = (check) => { console.log(JSON.stringify({ ready: false, checks: [...rows, check], help: ['Fix the failing checks, then run `first-draft-axi doctor` again'] })); process.exit(1); };
  if (!c.agent) unready({ status: 'fail', label: 'agent', detail: `no agent is set in ${CONFIG()}`, fix: ASK });
  if (!routeOf(c.agent)) unready({ status: 'fail', label: 'agent', detail: `${c.agent} is not byokit:<route>`, fix: ASK });
  rows.push(c.model ? { status: 'ok', label: 'model', detail: c.model } : { status: 'fail', label: 'model', detail: `no model is set for ${c.agent}`, fix: ASK });
  rows.push(await routeDoctor(routeOf(c.agent)));
  const ready = rows.every((r) => r.status !== 'fail');
  console.log(JSON.stringify({ ready, checks: rows, help: [ready ? 'Run `first-draft-axi make "<prompt>" --out <file.html>`' : 'Fix the failing checks, then run `first-draft-axi doctor` again'] }));
  if (!ready) process.exit(1);
} else if (command === 'init') {
  const { values } = flags(rest, { agent: { type: 'string' }, model: { type: 'string' } });
  if (!values.agent || !values.model) fail('USAGE', `init needs the user's --agent byokit:<route> and --model <model>`, [ASK, `BYOKit routes: ${(await readyRoutes().catch(() => [])).map((r) => `byokit:${r}`).join(', ')}`]);
  if (!routeOf(values.agent)) fail('BAD_AGENT', `agent ${values.agent} is not byokit:<route>`, [ASK]);
  save(values);
  console.log(JSON.stringify({ saved: { config: CONFIG(), agent: values.agent, model: values.model }, help: ['Run `first-draft-axi doctor`'] }));
} else {
  fail('USAGE', `unknown command ${command}`, ['Run `first-draft-axi --help`']);
}
