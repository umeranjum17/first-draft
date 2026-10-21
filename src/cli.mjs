#!/usr/bin/env node
// first-draft-axi: a prompt to design mocks. The agent is the person's own choice; first-draft picks none.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { doctor as routeDoctor, readyRoutes, routeOf } from './byokit.mjs';
import { make, engineDoctor } from './make.mjs';
import { commentsPath, designFiles, serve, viewHost } from './view.mjs';
import { post } from './post.mjs';

const VERSION = '0.2.3';
const DEFAULT_MODEL = { 'byokit:minimax:key': 'MiniMax-M3.1-Flash-Preview' };
const PICK = 'which BYOKit route and model to use (first-draft picks none), then run `first-draft-axi init --agent byokit:<route> --model <model>`';
const ASK = `Ask the user ${PICK}`;
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
const agentOrThrow = () => {
  const c = read();
  // `shown` is what the view tells a person: no config path, and the set-up hint worded for them.
  const no = (code, message, shown = message) => Object.assign(new Error(message), { code, help: [ASK], shown: { error: shown, help: [`Choose ${PICK}`] } });
  if (!c.agent) throw no('NO_AGENT', `no agent is set in ${CONFIG()}`, 'No agent is set up yet.');
  if (!routeOf(c.agent)) throw no('BAD_AGENT', `agent ${c.agent} is not byokit:<route>; this release runs BYOKit routes only`);
  if (!c.model) throw no('NO_MODEL', `no model is set for ${c.agent} in ${CONFIG()}`, `No model is set for ${c.agent} yet.`);
  return c;
};
const agentOrAsk = () => {
  try { return agentOrThrow(); } catch (e) { fail(e.code ?? 'CONFIG', e.message, e.help); }
};
// The view's Next brief runs the same engine call as `refine`, on the agent the person set, read when the brief is sent.
const refineHtml = async (seed, change) => {
  const c = agentOrThrow();
  try { return (await make({ prompt: change, ...c, seed })).html; } catch (e) {
    const error = `${c.agent} (${c.model}) did not refine the design: ${e.message}`;
    throw Object.assign(new Error(error), { shown: { error, help: ['Run `first-draft-axi doctor` in a terminal to check the agent'] } });
  }
};

const HELP = `usage: first-draft-axi <command> [flags]
commands[6]:
  make "<prompt>" --out <file.html> [--count N]   make N design mocks: self-contained HTML pages (one engine run each)
  refine <option.html> "<change>" --out <file.html>   apply a follow-up prompt to one existing option: writes a new option file, the original is untouched
  view <design> [--host H] [--port P]   serve a design's options as a grid, a phone or desktop canvas and fullscreen, until stopped
  post <design> --title "<question>" --recommend <a|1> | --evidence --media <shot>... [--option a=<label>]... [--tradeoff T] [--key K] [--board B] [--host H] [--port P]   post a design card to a sign-off board with each option's Play url as a tappable link under it
  doctor                              show whether the configured agent is ready, with no paid call
  init --agent byokit:<route> --model <model>   save the user's agent and model to the config
The agent is the person's own choice: first-draft never picks one. Use a BYOKit plan key or api key route, or byokit:codex for the installed subscription CLI.
Journeys, tests and demos post with --evidence --media <shot>... (an Evidence card: options and Play links, no pick asked), never --recommend: that files a Decide card for the owner.
A design is the --out path given to make (x.html finds x-1.html ... x-N.html), a folder of options, or option files.
view binds the tailnet address from \`tailscale ip -4\` (or --host / $FIRST_DRAFT_VIEW_HOST) on port 4430 (or --port / $FIRST_DRAFT_VIEW_PORT); options render from the next port.
post copies the options into the board's mocks folder (the nearest .sign-off/, or --board), starts the view if it is not up, then runs sign-off-axi post with each option's Play url (<view>#/o/<n>/play) as that option's --link (a tappable Open under its mock; needs sign-off-axi 0.5.0+) and in the card's --tradeoff text as the fallback: the card's sandbox blocks a link inside the mock.
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
  const blocked = new Set(), cut = [];
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
    if (made.truncated) cut.push(numbered);
  }
  console.log(JSON.stringify({ made: { files, agent: c.agent, model: c.model, seconds: Math.round((Date.now() - started) / 1000), tokens_in, tokens_out },
    ...(blocked.size && { blocked_remote: [...blocked] }),
    ...(cut.length && { truncated: cut }),
    help: [...(cut.length ? [`${cut.length} design(s) ran out of the engine's 12 turns before finishing: they hold the screens written so far, so a screen may be missing or unpolished`] : []), blocked.size ? 'The designs name remote files; the pages load none of them, so those parts show empty' : 'The pages load nothing from the network',
      `See them on the tailnet: first-draft-axi view ${values.out.includes('{i}') ? files.map((f) => f.file).join(' ') : values.out}`,
      `Post them for review: first-draft-axi post ${values.out.includes('{i}') ? files.map((f) => f.file).join(' ') : values.out} --title "<question>" --recommend a`] }));} else if (command === 'post') {
  const { values, positionals } = flags(rest, { title: { type: 'string' }, recommend: { type: 'string' }, evidence: { type: 'boolean' }, media: { type: 'string', multiple: true }, option: { type: 'string', multiple: true }, tradeoff: { type: 'string' }, key: { type: 'string' }, board: { type: 'string' }, host: { type: 'string' }, port: { type: 'string' } });
  const files = designFiles(positionals);
  if (!positionals.length || !values.title || !(values.recommend || values.evidence)) fail('USAGE', 'post needs a design, --title and --recommend (or --evidence)', ['Run `first-draft-axi post <design> --title "<question>" --recommend a`', 'Journeys, tests and demos pick nothing: add --evidence --media <screenshot> instead of --recommend']);
  if (!files.length) fail('NO_OPTIONS', `no HTML options found for ${positionals.join(' ')}`, ['Pass the --out path given to make, a folder of .html options, or the option files']);
  const port = Number(values.port ?? process.env.FIRST_DRAFT_VIEW_PORT ?? 4430);
  if (!Number.isInteger(port) || port < 1 || port > 65534) fail('USAGE', '--port is 1-65534 (options render from the next port)', ['Run `first-draft-axi post <design> --port 4430 ...`']);
  const labels = (values.option ?? []).map((o) => o.replace(/^[a-f]=/, ''));
  try {
    const p = await post({ files, name: basename(positionals[0], extname(positionals[0])), title: values.title, labels, tradeoff: values.tradeoff, key: values.key, recommend: values.recommend, evidence: values.evidence, media: values.media, board: values.board, host: values.host, port });
    console.log(JSON.stringify({ posted: { board: p.board, view: p.view, options: p.options }, sign_off: p.sign_off, help: ['Each option card links to its Play route in the first-draft view; the view serves until it is stopped'] }));
  } catch (e) {
    if (!e.code) throw e;
    fail(e.code, e.message, e.help);
  }
} else if (command === 'refine') {
  const { values, positionals } = flags(rest, { out: { type: 'string' } });
  const [file, ...words] = positionals, change = words.join(' ').trim();
  if (!file || !change || !values.out) fail('USAGE', 'refine needs an option file, a change and --out <file.html>', ['Run `first-draft-axi refine <option.html> "<change>" --out <file.html>`']);
  if (resolve(values.out) === resolve(file)) fail('USAGE', '--out must be a new file, not the option being refined', ['Pass a different --out path']);
  let seed;
  try { seed = readFileSync(file, 'utf8'); } catch (e) { fail('NO_OPTIONS', `cannot read ${file}: ${e.message}`, ['Pass one option file made by `first-draft-axi make`']); }
  const c = agentOrAsk();
  const started = Date.now();
  let made;
  try { made = await make({ prompt: change, ...c, seed }); } catch (e) { fail('MAKE_FAILED', `${c.agent} (${c.model}) did not refine the design: ${e.message}`, ['Run `first-draft-axi doctor`']); }
  const out = resolve(values.out);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, made.html);
  console.log(JSON.stringify({ refined: { from: resolve(file), file: out, bytes: Buffer.byteLength(made.html), agent: c.agent, model: c.model, seconds: Math.round((Date.now() - started) / 1000), tokens_in: made.tokens_in, tokens_out: made.tokens_out },
    ...(made.remote.length && { blocked_remote: made.remote }),
    help: [`See both: first-draft-axi view ${resolve(file)} ${out}`] }));
} else if (command === 'doctor') {
  const rows = [{ status: 'ok', label: 'node', detail: process.version }, await engineDoctor()];
  let c;
  try { c = read(); } catch (e) { fail('CONFIG', e.message, [`Fix ${CONFIG()}, then run \`first-draft-axi doctor\``]); }
  const unready = (check) => { console.log(JSON.stringify({ ready: false, checks: [...rows, check], help: ['Fix the failing checks, then run `first-draft-axi doctor` again'] })); process.exit(1); };
  if (!c.agent) unready({ status: 'fail', label: 'agent', detail: `no agent is set in ${CONFIG()}`, fix: ASK });
  if (!routeOf(c.agent)) unready({ status: 'fail', label: 'agent', detail: `${c.agent} is not byokit:<route>`, fix: ASK });
  rows.push(c.model ? { status: 'ok', label: 'model', detail: c.model } : { status: 'fail', label: 'model', detail: `no model is set for ${c.agent}`, fix: ASK });
  rows.push(await routeDoctor(routeOf(c.agent), c.model));
  const ready = rows.every((r) => r.status !== 'fail');
  console.log(JSON.stringify({ ready, checks: rows, help: [ready ? 'Run `first-draft-axi make "<prompt>" --out <file.html>`' : 'Fix the failing checks, then run `first-draft-axi doctor` again'] }));
  if (!ready) process.exit(1);
} else if (command === 'init') {
  const { values } = flags(rest, { agent: { type: 'string' }, model: { type: 'string' } });
  values.model ??= DEFAULT_MODEL[values.agent]; // only the routes named here have a shipped default
  if (!values.agent || !values.model) fail('USAGE', `init needs the user's --agent byokit:<route> and --model <model>`, [ASK, `BYOKit routes: ${(await readyRoutes().catch(() => [])).map((r) => `byokit:${r}`).join(', ')}`]);
  if (!routeOf(values.agent)) fail('BAD_AGENT', `agent ${values.agent} is not byokit:<route>`, [ASK]);
  save(values);
  console.log(JSON.stringify({ saved: { config: CONFIG(), agent: values.agent, model: values.model }, help: ['Run `first-draft-axi doctor`'] }));
} else if (command === 'view') {
  const { values, positionals } = flags(rest, { host: { type: 'string' }, port: { type: 'string' } });
  if (!positionals.length) fail('USAGE', 'view needs a design', ['Run `first-draft-axi view <file.html|folder>`']);
  const files = designFiles(positionals);
  if (!files.length) fail('NO_OPTIONS', `no HTML options found for ${positionals.join(' ')}`, ['Pass the --out path given to make, a folder of .html options, or the option files']);
  const port = Number(values.port ?? process.env.FIRST_DRAFT_VIEW_PORT ?? 4430);
  if (!Number.isInteger(port) || port < 0 || port > 65534) fail('USAGE', '--port is 0-65534 (options render from the next port)', ['Run `first-draft-axi view <design> --port 4430`']);
  const { given, host, advertise, tailnet, wildcard } = await viewHost(values.host);
  if (wildcard && !tailnet) fail('NO_TAILNET', 'a wildcard --host listens on every address, but tailscale ip -4 found no tailnet address to show', ['Pass --host <tailnet address>']);
  let v;
  try {
    v = await serve({ files, name: basename(positionals[0], extname(positionals[0])), host, advertise, port, framePort: port && port + 1, comments: commentsPath(positionals[0]), refine: refineHtml });
  } catch (e) { fail(e.code === 'EADDRINUSE' ? 'PORT_IN_USE' : 'VIEW_FAILED', `cannot serve on ${advertise}:${port}: ${e.message}`, ['Stop the other `first-draft-axi view`, or pass --port <port>']); }
  console.log(JSON.stringify({ viewing: { url: v.url, frames: v.frames, options: v.options.map((o) => ({ option: o.n, file: o.file, url: `${v.url}#/o/${o.n}` })) },
    help: [/^(127\.|::1$|localhost$)/.test(advertise) ? `${given ? 'This host' : 'tailscale ip -4 found no tailnet address, so this url'} opens on this machine only; pass --host <tailnet address>` : 'Open the url on any device that can reach this host; it serves until this process stops',
      'Each option opens at <url>#/o/<n>; add /full for fullscreen'] }));
} else {
  fail('USAGE', `unknown command ${command}`, ['Run `first-draft-axi --help`']);
}
