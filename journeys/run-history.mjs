// Exercise a real CLI make against local provider-edge stand-ins, with no model calls.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = mkdtempSync(join(tmpdir(), 'fd-run-'));
const evidence = process.env.DONE_DONE_EVIDENCE_ROOT;
if (!evidence) throw new Error('DONE_DONE_EVIDENCE_ROOT is required');
const cli = fileURLToPath(new URL('../src/cli.mjs', import.meta.url));
const bridge = new URL('../test/fixtures/judge-bridge.mjs', import.meta.url).href;
let viewPid;
try {
  writeFileSync(join(root, 'claude'), `#!${process.execPath}\nconst args=process.argv.slice(2);\nif(args.includes('auth')) { console.log(JSON.stringify({loggedIn:true,authMethod:'claude.ai',apiProvider:'firstParty'})); process.exit(0); }\nlet input=''; for await (const c of process.stdin) input+=c;\nconst html='<!doctype html><html><head><style>:root{color-scheme:light dark}body{background:light-dark(#fff,#111);color:light-dark(#111,#eee)}</style></head><body><h1>Umer notes</h1></body></html>';\nconsole.log(JSON.stringify({type:'result',subtype:'success',is_error:false,usage:{input_tokens:1,output_tokens:1},structured_output:{html}}));\n`, { mode: 0o700 });
  writeFileSync(join(root, 'codex'), `#!${process.execPath}\nimport ${JSON.stringify(bridge)};\n`, { mode: 0o700 });
  const env = { ...process.env, PATH: `${root}:${process.env.PATH}`, HOME: root, XDG_CONFIG_HOME: root, XDG_DATA_HOME: root, XDG_STATE_HOME: root, TMPDIR: root, FIRST_DRAFT_HOME: root };
  const run = (...args) => execFileSync(process.execPath, [cli, ...args], { cwd: root, env, encoding: 'utf8' });
  run('init', '--agent', 'byokit:claude', '--model', 'claude-sonnet-5-5');
  const made = JSON.parse(run('make', 'Notes for Umer', '--direction', 'calm', '--options', '1', '--out', join(root, 'notes.html')));
  const status = JSON.parse(run('status'));
  const runs = JSON.parse(run('runs'));
  // F3: post the option to a board (a stand-in for the sign-off CLI that saves the card and, once the fixture answer file exists, prints it as
  // `answers --json` does), see the run `posted`, then answer the card with option a and see `status`, `runs`, `logs` and `attach` show `picked`.
  const board = join(root, 'board', 'decisions.json');
  mkdirSync(join(root, 'board'));
  writeFileSync(join(root, 'sign-off-axi'), `#!${process.execPath}\nimport fs from 'node:fs';\nconst [cmd, board, ...rest] = process.argv.slice(2);\nconst answers = board.replace(/[^/]*$/, 'answers.json');\nif (cmd === 'post') { const items = fs.existsSync(board) ? JSON.parse(fs.readFileSync(board, 'utf8')).items : []; items.push({ key: 'which-notes-page', title: rest[rest.indexOf('--title') + 1], type: 'design' }); fs.writeFileSync(board, JSON.stringify({ schema: 2, items })); }\nelse if (cmd === 'answers') console.log(fs.existsSync(answers) ? fs.readFileSync(answers, 'utf8') : '{}');\n`, { mode: 0o700 });
  const viewPort = 40000 + (process.pid % 20000);
  const postEnv = { ...env, FIRST_DRAFT_VIEW_HOST: '127.0.0.1', FIRST_DRAFT_VIEW_PORT: String(viewPort) };
  const posted = JSON.parse(execFileSync(process.execPath, [cli, 'post', join(root, 'notes.html'), '--title', 'Which notes page?', '--recommend', 'a', '--board', board, '--host', '127.0.0.1', '--port', String(viewPort)], { cwd: root, env: postEnv, encoding: 'utf8' }));
  if (posted.posted.view.pid) viewPid = posted.posted.view.pid;
  const waiting = JSON.parse(run('status'));
  const waitingRuns = JSON.parse(run('runs'));
  writeFileSync(join(root, 'board', 'answers.json'), JSON.stringify({ 'which-notes-page': { answer: 'a', label: 'Option 1', close: 'done', at: '2026-11-12T12:00:00.000Z' } }));
  const picked = JSON.parse(run('status'));
  const pickedRuns = JSON.parse(run('runs'));
  const pickedLogs = JSON.parse(run('logs', status.id));
  const pickedAttached = JSON.parse(run('attach', status.id));
  if (waiting.state !== 'posted' || waitingRuns.runs[0].state !== 'posted' || picked.state !== 'picked' || picked.pick.option !== 'a' || pickedRuns.runs[0].pick.option !== 'a' || pickedAttached.state !== 'picked' || !['posted', 'picked'].every((s) => pickedLogs.events.some((e) => e.state === s))) throw new Error('The board answer did not move the run from posted to picked');
  writeFileSync(join(evidence, 'board-pick.json'), JSON.stringify({ posted: waiting, picked, runs: pickedRuns, logs: pickedLogs, attached: pickedAttached }, null, 2));
  const logs = JSON.parse(run('logs', status.id));
  const attached = JSON.parse(run('attach', status.id));
  if (made.made.files.length !== 1 || status.health !== 'finished' || !['critiqued', 'dropped'].includes(status.state) || runs.runs.length !== 1 || attached.id !== status.id || !['gathering', 'options', 'critiqued'].every((s) => logs.events.some((e) => e.state === s))) throw new Error('Run inspection did not show the make journey');
  writeFileSync(join(evidence, 'run-history.json'), JSON.stringify({ made, status, runs, logs, attached }, null, 2));
  writeFileSync(join(evidence, 'steps.json'), JSON.stringify({ target: { version: 'first-draft source CLI' }, start: 'empty project and isolated provider stand-ins', steps: ['Configure generator', 'Make one option', 'Inspect status, runs, logs and attach', 'Run a failing done fixture through three follow-ups', 'Inspect logo, redesign and refinement counts'], result: 'Run inspection shows stages, follow-ups 1 through 3 of 3, and logo, redesign and refine counts' }, null, 2));
  const fixture = fileURLToPath(new URL('../test/make.test.mjs', import.meta.url));
  const loader = fileURLToPath(new URL('../test/fixtures/provider-hooks.mjs', import.meta.url));
  execFileSync(process.execPath, ['--import', loader, '--test', '--test-name-pattern=a make whose done never passes', fixture], { env, encoding: 'utf8', stdio: 'pipe' });
  for (const [name, pattern] of [['logo.test.mjs', 'logo: concepts explored'], ['public-references.test.mjs', 'public references: actual browser capture']]) {
    const test = fileURLToPath(new URL(`../test/${name}`, import.meta.url));
    execFileSync(process.execPath, ['--import', loader, '--test', `--test-name-pattern=${pattern}`, test], { env, encoding: 'utf8', stdio: 'pipe', timeout: 240000 });
  }
  console.log('Failing done, logo, redesign and refine counts recorded.');
  console.log('Board answer a moved the run from posted to picked; status, runs, logs and attach showed it.');
  console.log('Run history: gathering, options and critiqued; status, runs, logs and attach passed.');
} finally { if (viewPid) try { process.kill(viewPid); } catch {} rmSync(root, { recursive: true, force: true }); }
