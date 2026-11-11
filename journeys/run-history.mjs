// Exercise a real CLI make against local provider-edge stand-ins, with no model calls.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = mkdtempSync(join(tmpdir(), 'fd-run-'));
const evidence = process.env.DONE_DONE_EVIDENCE_ROOT;
if (!evidence) throw new Error('DONE_DONE_EVIDENCE_ROOT is required');
const cli = fileURLToPath(new URL('../src/cli.mjs', import.meta.url));
const bridge = new URL('../test/fixtures/judge-bridge.mjs', import.meta.url).href;
try {
  writeFileSync(join(root, 'claude'), `#!${process.execPath}\nconst args=process.argv.slice(2);\nif(args.includes('auth')) { console.log(JSON.stringify({loggedIn:true,authMethod:'claude.ai',apiProvider:'firstParty'})); process.exit(0); }\nlet input=''; for await (const c of process.stdin) input+=c;\nconst html='<!doctype html><html><head><style>:root{color-scheme:light dark}body{background:light-dark(#fff,#111);color:light-dark(#111,#eee)}</style></head><body><h1>Umer notes</h1></body></html>';\nconsole.log(JSON.stringify({type:'result',subtype:'success',is_error:false,usage:{input_tokens:1,output_tokens:1},structured_output:{html}}));\n`, { mode: 0o700 });
  writeFileSync(join(root, 'codex'), `#!${process.execPath}\nimport ${JSON.stringify(bridge)};\n`, { mode: 0o700 });
  const env = { ...process.env, PATH: `${root}:${process.env.PATH}`, HOME: root, XDG_CONFIG_HOME: root, XDG_DATA_HOME: root, XDG_STATE_HOME: root, TMPDIR: root, FIRST_DRAFT_HOME: root };
  const run = (...args) => execFileSync(process.execPath, [cli, ...args], { cwd: root, env, encoding: 'utf8' });
  run('init', '--agent', 'byokit:claude', '--model', 'claude-sonnet-5-5');
  const made = JSON.parse(run('make', 'Notes for Umer', '--direction', 'calm', '--options', '1', '--out', join(root, 'notes.html')));
  const status = JSON.parse(run('status'));
  const runs = JSON.parse(run('runs'));
  const logs = JSON.parse(run('logs', status.id));
  const attached = JSON.parse(run('attach', status.id));
  if (made.made.files.length !== 1 || status.health !== 'finished' || !['critiqued', 'dropped'].includes(status.state) || runs.runs.length !== 1 || attached.id !== status.id || !['gathering', 'options', 'critiqued'].every((s) => logs.events.some((e) => e.state === s))) throw new Error('Run inspection did not show the make journey');
  writeFileSync(join(evidence, 'run-history.json'), JSON.stringify({ made, status, runs, logs, attached }, null, 2));
  writeFileSync(join(evidence, 'steps.json'), JSON.stringify({ target: { version: 'first-draft source CLI' }, start: 'empty project and isolated provider stand-ins', steps: ['Configure generator', 'Make one option', 'Inspect status, runs, logs and attach'], result: 'Run inspection shows gathering, options and critiqued with finished health' }, null, 2));
  console.log('Run history: gathering, options and critiqued; status, runs, logs and attach passed.');
} finally { rmSync(root, { recursive: true, force: true }); }
