// Installed Claude journey through the real CLI, engine and published BYOKit adapters; no model calls.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';
import { theme } from './fixtures/plain-page.mjs';

const CLI = new URL('../src/cli.mjs', import.meta.url).pathname;
const DESIGN = readFileSync(new URL('../templates/scaffolds/design-systems/DESIGN.md', import.meta.url), 'utf8');
const PAGE = theme('<!doctype html><html><body><h1>Umer’s notes</h1><a href="#detail">Open note</a><section id="detail" data-oc-screen="detail">A note</section></body></html>');

test('installed Claude: no-paid doctor, account launch, engine make/refine and subscription refusals', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-claude-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'claude'), `#!${process.execPath}
import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
const args = process.argv.slice(2), root = process.env.FIRST_DRAFT_HOME;
appendFileSync(root + '/calls', JSON.stringify(args) + '\\n');
if (args.includes('auth')) {
  console.log(JSON.stringify({ loggedIn: process.env.FD_AUTH !== 'out', authMethod: process.env.FD_AUTH || 'claude.ai', apiProvider: 'firstParty' }));
} else {
  let input = ''; for await (const c of process.stdin) input += c;
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) throw Error('API credential reached child');
  if (!args.includes('--safe-mode') || !args.includes('--strict-mcp-config')) throw Error('unsafe execution');
  if (input.includes('Build one self-contained HTML page for this brief')) { // the plain baseline: the document itself, not a tool call
    console.log(JSON.stringify({ type:'result', subtype:'success', is_error:false, structured_output:{html:'<!doctype html><html><body><h1>Umer baseline</h1></body></html>'}, usage:{input_tokens:0,output_tokens:0} })); process.exit(0);
  }
  if (!args[args.indexOf('--system-prompt') + 1].includes('# Open Design execution and security boundary')) throw Error('OpenDesign recipe missing at the actual CLI boundary');
  if (args[args.indexOf('--model') + 1] !== 'claude-opus-5-5') throw Error('model changed');
  if (args[args.indexOf('--json-schema') + 1].includes('"html"')) { // make's one-call page (draft.mjs): the page comes back as one string
    const content = JSON.parse(input).message.content;
    if (content.filter(c => c.type === 'image').length !== 3 || !args[args.indexOf('--system-prompt') + 1].includes('# Frontend Design')) throw Error('one-call page without its references or guidance');
    console.log(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, structured_output: { html: '<!doctype html><html><head><style>:root{color-scheme:light dark}body{background:light-dark(#fff,#111);color:light-dark(#111,#eee)}</style></head><body><h1>Umer’s one-call notes</h1></body></html>' }, usage: { input_tokens: 3, output_tokens: 9 } }));
    process.exit(0);
  }
  if (process.env.FD_BAD_ONCE && !existsSync(root + '/bad-once')) { // the model breaks the JSON of a call's arguments once
    writeFileSync(root + '/bad-once', '1');
    console.log(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, structured_output: { text: '', calls: [{ name: 'done', arguments: '{"path": "index.h' }] }, usage: { input_tokens: 7, output_tokens: 8 } }));
    process.exit(0);
  }
  const envelope = JSON.parse(input), { messages, tools } = JSON.parse(envelope.message.content.at(-1).text);
  const images = envelope.message.content.filter(c => c.type === 'image');
  if (images.length !== 3 || images.some(c => c.source.media_type !== 'image/png' || !Buffer.from(c.source.data, 'base64').subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')))) throw Error('reference images were not sent natively');
  if (!args[args.indexOf('--system-prompt') + 1].includes('visual guidance only')) throw Error('reference policy missing');
  if (!args[args.indexOf('--system-prompt') + 1].includes('small tool-call batches')) throw Error('incremental reply budget missing');
  if (!tools.length) throw Error('missing engine tools');
  const results = messages.filter(m => m.role === 'toolResult');
  const call = (name, a) => ({ name, arguments: JSON.stringify(a) });
  const page = input.includes('warmer palette') ? ${JSON.stringify(PAGE.replace('A note', 'A warm note'))} : ${JSON.stringify(PAGE)};
  // Real Opus may try done before the engine's mandatory plan: its blocked event has no path.
  const calls = !results.length ? [call('done', { path: 'index.html' })]
    : results.length === 1 ? [call('set_todos', { items: [{ text: 'Write notes', checked: false }] })]
    : results.length === 2 ? [call('str_replace_based_edit_tool', { command: 'create', path: 'DESIGN.md', file_text: ${JSON.stringify(DESIGN)} }), call('str_replace_based_edit_tool', { command: 'create', path: 'index.html', file_text: page })]
    : results.length === 4 ? [call('done', { path: 'index.html' })] : [];
  console.log(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, structured_output: { text: calls.length ? '' : 'Ready', calls }, usage: { input_tokens: 7, output_tokens: 8 } }));
}
`, { mode: 0o700 });
  writeFileSync(join(dir, 'codex'), `#!${process.execPath}\nimport ${JSON.stringify(new URL('./fixtures/judge-bridge.mjs', import.meta.url).href)};\n`, { mode: 0o700 });
  const env = { ...process.env, PATH: `${dir}:${process.env.PATH}`, HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, XDG_STATE_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir, ANTHROPIC_API_KEY: 'synthetic-never-deliver', ANTHROPIC_AUTH_TOKEN: 'synthetic-never-deliver' };
  const run = (...args) => promisify(execFile)(process.execPath, [CLI, ...args, ...(args[0] === 'make' ? ['--options', '1', '--engine'] : [])], { env });
  await promisify(execFile)(join(dir, 'claude'), ['auth', 'status'], { env });
  const expected = ['Claude subscription: first-draft-axi init --agent byokit:claude --model <model>', 'ChatGPT subscription: first-draft-axi init --agent byokit:codex --model <model>'];
  assert.deepEqual(JSON.parse((await run('doctor')).stdout).engine, { agent:'byokit:claude', model:'claude-sonnet-5-5' });
  const init = JSON.parse((await run('init', '--agent', 'byokit:claude', '--model', 'claude-opus-5-5')).stdout);
  assert.deepEqual(init.subscriptions.map(s => `${s.label}: ${s.init}`), expected);
  const doctor = JSON.parse((await run('doctor')).stdout);
  assert.equal(doctor.ready, true);
  assert.deepEqual(doctor.subscriptions.map(s => `${s.label}: ${s.init}`), expected);
  assert.match(doctor.checks.at(-1).detail, /availability not probed/);
  const calls = () => readFileSync(join(dir, 'calls'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.ok(calls().every(args => args.includes('auth')), 'doctor makes no generation call');
  const refs = [];
  for (const ext of ['png', 'jpg', 'webp']) {
    const file = join(dir, `reference.${ext}`);
    await promisify(execFile)('convert', ['-size', '3x2', 'xc:purple', file]);
    refs.push('--ref', file);
  }
  const out = join(dir, 'notes.html');
  const made = JSON.parse((await run('make', 'Notes for Umer', '--out', out, ...refs)).stdout).made;
  assert.equal(made.model, 'claude-opus-5-5');
  assert.equal(made.files[0].turns, 5);
  assert.equal(made.tokens_in, 36);
  assert.equal(made.tokens_out, 41);
  assert.match(readFileSync(out, 'utf8'), /Content-Security-Policy/);
  assert.doesNotMatch(readFileSync(out, 'utf8'), /data:image/);
  await run('refine', out, 'warmer palette', '--out', join(dir, 'warm.html'), ...refs);
  assert.match(readFileSync(join(dir, 'warm.html'), 'utf8'), /A warm note/);
  assert.doesNotMatch(readFileSync(out, 'utf8'), /A warm note/);
  const page = join(dir, 'page.html'); // the default make: one page from one call through the same subscription route
  const one = JSON.parse((await promisify(execFile)(process.execPath, [CLI, 'make', 'Notes for Umer', '--out', page, '--options', '1', ...refs], { env })).stdout).made;
  assert.equal(one.files[0].turns, 1);
  assert.equal(one.tokens_out, 10);
  assert.match(readFileSync(page, 'utf8'), /Umer’s one-call notes/);
  const generated = () => calls().filter(args => args.includes('-p') && !args[args.indexOf('--system-prompt') + 1]?.startsWith('You are a product designer')).length;
  assert.equal(generated(), 11);
  writeFileSync(join(dir, 'bad.png'), Buffer.from('89504e470d0a1a0a', 'hex'));
  writeFileSync(join(dir, 'not-image.jpg'), 'not an image');
  writeFileSync(join(dir, 'big.png'), Buffer.alloc(5_000_001));
  await promisify(execFile)('convert', ['-size', '4097x1', 'xc:purple', join(dir, 'wide.png')]);
  const padded = Buffer.alloc(4_000_000); readFileSync(refs[1]).copy(padded);
  writeFileSync(join(dir, 'padded.png'), padded);
  await assert.rejects(run('make', 'Notes', '--out', out, ...Array(3).fill(['--ref', join(dir, 'padded.png')]).flat()), e => /10 MB total/.test(e.stdout));
  for (const file of ['bad.png', 'not-image.jpg', 'big.png', 'wide.png', 'missing.png', 'remote.svg']) {
    await assert.rejects(run('make', 'Notes', '--out', out, '--ref', join(dir, file)), e => /REFERENCE_FAILED/.test(e.stdout));
    assert.equal(generated(), 11, 'invalid references never call the model');
  }
  await assert.rejects(run('refine', out, 'warmer', '--out', join(dir, 'bad.html'), ...Array(7).fill(['--ref', refs[1]]).flat()), e => /at most 6/.test(e.stdout));
  for (const auth of ['out', 'api_key', 'bedrock', 'vertex', 'other']) {
    env.FD_AUTH = auth;
    assert.equal(JSON.parse((await run('doctor')).stdout).engine.agent, 'byokit:codex');
    await assert.rejects(run('make', 'Notes', '--out', join(dir, 'refused.html')));
    assert.equal(generated(), 11, `${auth} never spends`);
  }
  env.MINIMAX_API_KEY = 'synthetic';
  await run('init', '--agent', 'byokit:minimax:key', '--model', 'MiniMax-M3.1-Flash-Preview');
  await assert.rejects(run('make', 'Notes', '--out', out, ...refs), e => /does not support reference images; none were sent/.test(e.stdout));
  assert.equal(generated(), 11);
  delete env.MINIMAX_API_KEY;
  await run('init', '--agent', 'byokit:claude', '--model', 'claude-opus-5-5');
  delete env.FD_AUTH;
  const config = join(dir, 'config.json'), original = readFileSync(config, 'utf8');
  for (const [agent, model] of [
    ['byokit:openrouter:key', 'anthropic/claude-opus-5-5'], ['byokit:minimax:key', 'CLAUDE-OPUS-5-5'],
    ['byokit:anthropic:key', 'sonnet'], ['byokit:opencode-go', 'vendor/haiku'],
    ['byokit:codex', 'opus'], ['byokit:openrouter:key', 'anthropic/unknown'], ['byokit:anthropic:key', 'default'],
  ]) {
    const before = readFileSync(config, 'utf8');
    await assert.rejects(run('init', '--agent', agent, '--model', model), e => /Claude models use your Claude subscription only.*byokit:claude/.test(e.stdout));
    assert.equal(readFileSync(config, 'utf8'), before, 'refused init never changes the chosen source');
    writeFileSync(config, JSON.stringify({ agent, agent_config: { [agent]: { model } } })); // A stale/hand-edited config cannot bypass the boundary.
    await assert.rejects(run('doctor'), e => /Claude models use your Claude subscription only.*byokit:claude/.test(e.stdout));
    await assert.rejects(run('make', 'Notes', '--out', join(dir, 'refused.html')), e => /SUBSCRIPTION_ONLY/.test(e.stdout));
    await assert.rejects(run('refine', out, 'warmer', '--out', join(dir, 'refused.html')), e => /SUBSCRIPTION_ONLY/.test(e.stdout));
    assert.equal(generated(), 11, 'no forbidden model can reach generation');
  }
  writeFileSync(config, original);
  env.FD_BAD_ONCE = '1';
  await run('make', 'Notes for Umer', '--out', join(dir, 'retried.html'), ...refs);
  assert.equal(generated(), 17, 'an answer whose call arguments were not JSON was asked again once, and the five turns then ran');
  delete env.FD_BAD_ONCE;
  env.PATH = dir + '/missing';
  await assert.rejects(run('make', 'Notes', '--out', out, ...refs), e => /claude auth login/.test(e.stdout));
  await assert.rejects(run('doctor'), e => /claude auth login/.test(e.stdout));
});
