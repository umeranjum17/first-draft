// The wrapper must not lower the output bar (fleet retro, cause 1). The default make is a plain model call plus the additions listed in
// docs/wrapper-allowlist.json, each with the paired, rendered comparison (same brief, same model) that justifies it. No model, key or
// network is used: the real CLI runs against a local stand-in for the provider and the test reads what that stand-in was sent.
//   1. Every rule of the prompt (the guidance and each rule of the page contract) is on the allow-list, with the wording it was judged on.
//   2. Every entry carries evidence of its kind; "accepted" quality entries need repeated pairs that went up and none that went down.
//   3. What reaches the model: one plain draw (the brief as the user prompt, the allow-listed system prompt, no tools, no sampling
//      options, the platform's whole output limit), and only the extra calls the allow-list names, as often as it allows (the critic
//      reviews once and never sends a page back).
//   4. Options are drawn at once, a few at a time.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';
import { OUTPUT_CAP } from '../../src/byokit.mjs';
import { HUMAN, OPTIONS_AT_ONCE, TASTE, contractRules, systemPrompt } from '../../src/draft.mjs';
import { findBrowser } from '../../src/render-check.mjs';

const ROOT = new URL('../../', import.meta.url).pathname;
const ALLOW = JSON.parse(readFileSync(join(ROOT, 'docs/wrapper-allowlist.json'), 'utf8'));
const sha = (text) => createHash('sha256').update(text).digest('hex').slice(0, 16);
const KINDS = ['quality', 'delivery', 'policy', 'measure'], VERDICTS = ['accepted', 'provisional'];

const HOW = (id, source, text) => `"${id}" (${source}) reaches the model but is not on docs/wrapper-allowlist.json with accepted evidence, or its wording changed since it was judged.
  Compare the plain model with the plain model plus this addition, on the same briefs with the same model (node scripts/compare.mjs "<brief>" --out <folder>), score both renders at 390 and 1280, then add or update:
  { "id": "${id}", "source": "${source}", "kind": "quality", "what": "<the restriction or addition in a line>", "sha256": "${text === undefined ? '<none>' : sha(text)}", "verdict": "accepted",
    "evidence": [ { "brief": "<identical for both>", "model": "${ALLOW.model}", "plain_run": "<run id>", "plain": <score>, "with_run": "<run id>", "with": <score>, "scored_by": "<who>", "report": "<where>" } ] }
  "accepted" needs pairs on at least two briefs, every one up and none down. Not measured yet: "provisional" with "decided_by" and "needed" (the comparison still owed). Delivery and policy rules take a "reason" instead. See CONTRIBUTING.md.`;

// What the prompt is made of, from the code.
const derived = () => [
  { id: 'frontend-design-guidance', source: 'taste', text: TASTE },
  { id: 'human-side-guidance', source: 'taste', text: HUMAN },
  ...new Map([true, false].flatMap((drawing) => [true, false].flatMap((human) => [true, false].flatMap((flow) => contractRules(drawing, human, flow)))).map((r) => [r.id, { id: r.id, source: 'contract', text: r.text }])).values(),
];
const entryProblems = (e) => {
  const where = `allow-list entry "${e.id}"`, bad = [];
  if (!KINDS.includes(e.kind)) bad.push(`${where}: kind must be one of ${KINDS.join(', ')}`);
  if (!VERDICTS.includes(e.verdict)) bad.push(`${where}: verdict must be accepted or provisional`);
  if (!e.what) bad.push(`${where}: say what it restricts or adds`);
  if (e.kind === 'delivery' || e.kind === 'policy' || e.kind === 'measure') { if (!e.reason) bad.push(`${where}: a ${e.kind} entry needs its reason`); }
  for (const p of e.evidence ?? []) {
    if (p.model !== ALLOW.model) bad.push(`${where}: evidence run on ${p.model}, the comparison must be on ${ALLOW.model} for both sides`);
    for (const k of ['brief', 'plain_run', 'with_run', 'scored_by', 'report']) if (!p[k]) bad.push(`${where}: evidence needs ${k}`);
    for (const k of ['plain', 'with']) if (!(p[k] >= 1 && p[k] <= 10)) bad.push(`${where}: evidence ${k} must be a score from 1 to 10`);
  }
  if (e.verdict === 'accepted' && e.kind === 'quality') {
    const pairs = e.evidence ?? [];
    if (new Set(pairs.map((p) => p.brief)).size < 2) bad.push(`${where}: accepted needs paired comparisons on at least two briefs`);
    for (const p of pairs) if (!(p.with > p.plain)) bad.push(`${where}: accepted, but "${p.brief}" went ${p.plain} to ${p.with} (${p.with_run}); a tie or a fall is provisional at best`);
  }
  if (e.verdict === 'provisional') for (const k of ['decided_by', 'needed']) if (!e[k]) bad.push(`${where}: provisional needs ${k}`);
  return bad;
};

test('every rule the model is told is on the allow-list with evidence, in the wording that was judged', () => {
  const problems = [];
  for (const d of derived()) {
    const e = ALLOW.entries.find((x) => x.id === d.id && x.source === d.source);
    if (!e || e.sha256 !== sha(d.text)) problems.push(HOW(d.id, d.source, d.text));
  }
  for (const e of ALLOW.entries) {
    if (['taste', 'contract'].includes(e.source) && !derived().some((d) => d.id === e.id && d.source === e.source)) problems.push(`allow-list entry "${e.id}" names a ${e.source} rule that the prompt no longer has: remove it`);
    problems.push(...entryProblems(e));
  }
  assert.equal(new Set(ALLOW.entries.map((e) => e.id)).size, ALLOW.entries.length, 'allow-list ids are unique');
  if (problems.length) assert.fail(`\n${problems.join('\n')}`);
  const open = ALLOW.entries.filter((e) => e.verdict === 'provisional').map((e) => e.id);
  console.log(`wrapper additions: ${ALLOW.entries.length - open.length} accepted, ${open.length} provisional (${open.join(', ')})`);
});

test('the numbers the default make runs on are the ones the allow-list was judged on', () => {
  const bokit = readFileSync(join(ROOT, 'node_modules/@byokit/decide/dist/claude-code.js'), 'utf8');
  assert.equal(Number(bokit.match(/maxOutputTokens > ([\d_]+)/)[1].replaceAll('_', '')), OUTPUT_CAP, 'a page call asks for the whole of the most BYOKit lets a reply write, never less');
  assert.equal(systemPrompt(true).startsWith(TASTE), true);
});

// A local provider that records every request by what it is for and answers each with a small page, plain page or review.
const ev = (o) => `event: ${o.type}\ndata: ${JSON.stringify(o)}\n\n`;
const PAGE = (n) => `<!doctype html><html><head><meta charset="utf-8"><title>Notes</title><style>body{margin:0;font:16px/1.5 system-ui;background:#fff;color:#111}main{padding:24px}</style></head><body><main><h1>Notes ${n}</h1><p>Umer's notes, searchable.</p></main></body></html>`;
const GRID = PAGE('with a grid').replace('body{margin:0', 'body{background-image:linear-gradient(rgba(0,0,0,.6) 1px,transparent 1px);background-size:24px 24px;margin:0');
const textOf = (j) => j.input.filter((m) => m.role === 'user').map((m) => typeof m.content === 'string' ? m.content : m.content.filter((p) => p.type === 'input_text').map((p) => p.text).join('\n')).join('\n');
const kindOf = (j) => {
  if (textOf(j).includes('Build one self-contained HTML page for this brief')) return 'critic-plain-page';
  const tool = j.tools?.[0]?.name;
  if (tool === 'plan_directions') return 'direction-plan';
  if (tool === 'write_page') return 'critic-plain-page';
  if (tool === 'review_designs' || tool === 'judge_designs') return 'critic-review';
  const user = textOf(j);
  return user.includes('defects the host measured') ? 'host-repair' : user.includes('The critic scored this design') ? 'critic-revision' : 'draw';
};
async function standIn(seen, { score = 9, flowScore = score, grid = false, delay = 0 } = {}) {
  let pages = 0, flying = 0, peak = 0;
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', async () => {
      const j = JSON.parse(body), kind = kindOf(j);
      const page = ['draw', 'host-repair', 'critic-revision'].includes(kind);
      if (page) { flying++; peak = Math.max(peak, flying); await new Promise((r) => setTimeout(r, delay)); flying--; }
      seen.push({ kind, j, peak });
      const needsFlow = j.tools?.[0]?.parameters?.required?.includes('flow');
      const call = { 'direction-plan': () => ['plan_directions', { directions: Array.from({ length: Number(textOf(j).match(/Plan (\d) directions/)[1]) }, (_, i) => ({ name: `Direction ${i + 1}`, learn_from: 'Notion', layout: `Layout ${i + 1}.`, type: 'Inter.', palette: '#fff and #111.', signature: `Detail ${i + 1}.` })) }],
        'critic-review': () => [j.tools[0].name, { views: (j.tools.find((t) => ['review_designs', 'judge_designs'].includes(t.name)).parameters.properties.views.items.properties.view.enum).map((view) => ({ view, judged: 'what this view shows' })), design: { score, gaps: score < 10 ? ['the hero has no picture'] : [] }, plain: { score: 7, gaps: ['generic'] }, axes: Object.fromEntries(['hierarchy','type','colour','spacing','imagery','proof_clarity','ai_tells'].map(a=>[a,{score,reason:'Fixture assessment'}])), ...(j.tools[0].parameters.properties.ai_side && {ai_side:{reads_as_ai:false,tells:[]},hero:Array.from({length:9},(_,i)=>({point:i+1,met:true,reason:'Fixture hero'}))}), against: 'Notion', reads_as: 'a list of notes', fix: score < 10 ? 'Give the hero a picture.' : '', ...(needsFlow && { flow: { shell: { score: flowScore, reason: 'Every screen keeps the header, title, dots and next button' }, character: { score: flowScore, reason: 'The same character appears on every screen' } } }) }] }[kind]?.();
      const item = call ? { type: 'function_call', id: `fc${seen.length}`, call_id: `c${seen.length}`, name: call[0], arguments: JSON.stringify(call[1]) }
        : { type: 'message', id: `m${seen.length}`, status: 'completed', content: [{ type: 'output_text', text: kind === 'critic-plain-page' ? PAGE('plain') : kind === 'draw' && grid ? GRID : kind === 'draw' && /onboarding flow/.test(textOf(j)) ? PAGE(++pages).replace('<main>', Array.from({length:6}, (_, i) => `<section id="step-${i+1}" data-oc-screen="step-${i+1}"><h1>Step ${i+1}</h1></section>`).join('') + '<main>') : PAGE(++pages) }] };
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.end(ev({ type: 'response.output_item.added', output_index: 0, item }) + ev({ type: 'response.output_item.done', output_index: 0, item })
        + ev({ type: 'response.completed', response: { id: `r${seen.length}`, status: 'completed', usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } } }));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return server;
}
async function make(t, options, brief, ...more) {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-baseline-'));
  const seen = [], server = await standIn(seen, options);
  t.after(() => { server.close(); rmSync(dir, { recursive: true, force: true }); });
  const env = { ...process.env, FIRST_DRAFT_TEST_JUDGE_DELEGATE: '1', CI: 'true', HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir, OPENCODE_API_KEY: 'test-key', FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}` };
  const run = (args) => promisify(execFile)(process.execPath, [join(ROOT, 'src/cli.mjs'), ...args], { env, cwd: dir });
  await run(['init', '--agent', 'byokit:opencode-go', '--model', 'muse-spark-1.3-contributor']);
  const { stdout } = await run(['make', brief, '--out', join(dir, 'notes.html'), ...more]);
  const count = (kind) => seen.filter((s) => s.kind === kind).length;
  return { seen, made: JSON.parse(stdout).made, count, counts: Object.fromEntries([...new Set(seen.map((s) => s.kind))].map((k) => [k, count(k)])) };
}
// The extra calls a run made, each against what the allow-list lets it make (per make, or per option).
const withinAllowList = ({ counts }, options) => {
  const over = [];
  for (const [kind, n] of Object.entries(counts)) {
    if (kind === 'draw') { if (n !== options) over.push(`${n} plain draws for ${options} option(s)`); continue; }
    const e = ALLOW.entries.find((x) => x.id === kind && x.calls);
    if (!e) over.push(`"${kind}" calls reached the model and no allow-list entry with "calls" names them`);
    else if (n > e.calls.max * (e.calls.per === 'option' ? options : 1)) over.push(`${n} "${kind}" calls; the allow-list lets ${e.calls.max} per ${e.calls.per}`);
  }
  return over;
};
const NOTES = 'A notes app for Umer', LANDING = 'a landing page for a small accounting software company for teams';
const first = (run) => run.seen.find((s) => s.kind === 'draw').j;

test('the default make is a plain draw plus the calls the allow-list names', async (t) => {
  if (!findBrowser()) return t.skip('no Chrome or Chromium on this machine');
  // One option, a score of 9: the draw, the critic's plain page and one review. Nothing else.
  const run = await make(t, { score: 9 }, NOTES, '--options', '1');
  assert.deepEqual(run.counts, { draw: 1, 'critic-plain-page': 1, 'critic-review': 1 });
  assert.deepEqual(withinAllowList(run, 1), []);
  const draw = first(run);
  assert.deepEqual(Object.keys(draw).filter((k) => !['model', 'input', 'stream', 'store', 'max_output_tokens'].includes(k)), [], 'no tools, reasoning, temperature or other options on the plain draw');
  assert.equal(draw.input[0].role, 'developer');
  assert.equal(draw.input[0].content, systemPrompt(true), 'the system prompt is the guidance and the contract rules, nothing else');
  assert.equal(draw.input.length, 2);
  assert.equal(textOf(draw), 'Brief: A notes app for Umer\nReply with the complete HTML document.', 'the brief is the whole user prompt: no style, direction, screens or preset');
  assert.ok(draw.max_output_tokens >= OUTPUT_CAP, `the cap on one page is ${draw.max_output_tokens}, under the ${OUTPUT_CAP} the platform allows`);
  assert.equal(run.made.files[0].turns, 1);
  assert.ok(run.made.timing.options.draw_s >= 0 && run.made.timing.critic.review_s >= 0, 'the output says where the seconds went');

  // A company or landing brief also gets first-draft's own guidance and its brand-and-accent rule, and nothing else: the same plain draw.
  const landing = await make(t, { score: 9 }, LANDING, '--options', '1');
  assert.equal(landing.count('draw'), 1);
  assert.deepEqual(withinAllowList(landing, 1), [], 'a plain page fails the landing host checks, so the one repair call is the only other call');
  assert.equal(first(landing).input[0].content, systemPrompt(true, true));
  assert.equal(textOf(first(landing)), `Brief: ${LANDING}\nReply with the complete HTML document.`);
  assert.ok(first(landing).input[0].content.includes(HUMAN));

  // A low score stays flagged: one review, no revision call.
  const low = await make(t, { score: 5 }, NOTES, '--options', '1');
  assert.deepEqual(low.counts, { draw: 1, 'critic-plain-page': 1, 'critic-review': 1 });
  assert.equal(low.made.files[0].critique.passed, false);

  // A defect the host measures: one repair call, then the critic as before.
  const grid = await make(t, { score: 9, grid: true }, NOTES, '--options', '1');
  assert.deepEqual(grid.counts, { draw: 1, 'host-repair': 1, 'critic-plain-page': 1, 'critic-review': 1 });
  assert.deepEqual(withinAllowList(grid, 1), []);
  assert.match(textOf(grid.seen.find((s) => s.kind === 'host-repair').j), /grid or line pattern is too strong/);
});

test('three options with no direction named: one planned direction each, drawn two at a time', async (t) => {
  if (!findBrowser()) return t.skip('no Chrome or Chromium on this machine');
  const run = await make(t, { score: 9, delay: 600 }, NOTES);
  assert.deepEqual(run.counts, { 'direction-plan': 1, draw: 3, 'critic-plain-page': 1, 'critic-review': 3 });
  assert.deepEqual(withinAllowList(run, 3), []);
  const plan = run.seen.find((s) => s.kind === 'direction-plan').j;
  assert.match(textOf(plan), /Plan 3 directions/);
  const lines = run.seen.filter((s) => s.kind === 'draw').map((s) => textOf(s.j).match(/\nDirection: (.+)/)?.[1]).sort();
  assert.deepEqual(lines.map((l) => l.split('.')[0]), ['Direction 1', 'Direction 2', 'Direction 3'], 'each option gets a direction the model planned for this brief, never a preset style');
  const peak = Math.max(...run.seen.map((s) => s.peak));
  assert.ok(peak === OPTIONS_AT_ONCE, `options were drawn ${peak} at a time`);
  assert.deepEqual(run.made.files.map((f) => f.file.replace(/.*\//, '')), ['notes-1.html', 'notes-2.html', 'notes-3.html']);
  assert.ok(run.made.files.every((f) => existsSync(f.file) && f.critique.score === 9));
});

test('scripts/compare.mjs renders pages side by side at 390 and 1280 without a model', async (t) => {
  if (!findBrowser()) return t.skip('no Chrome or Chromium on this machine');
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-compare-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'plain.html'), PAGE('plain'));
  writeFileSync(join(dir, 'make.html'), PAGE('make'));
  const { stdout } = await promisify(execFile)(process.execPath, [join(ROOT, 'scripts/compare.mjs'), 'A notes app', '--out', join(dir, 'out'), '--pages', `plain=${join(dir, 'plain.html')}`, `make=${join(dir, 'make.html')}`], { env: { ...process.env, FIRST_DRAFT_HOME: dir } });
  const result = JSON.parse(stdout);
  assert.deepEqual(result.variants.map((v) => v.name), ['plain', 'make']);
  for (const v of result.variants) for (const shot of [v.desktop, v.phone]) assert.ok(existsSync(shot) && readFileSync(shot).subarray(1, 4).toString() === 'PNG', `${shot} is a PNG`);
  const page = readFileSync(result.side_by_side, 'utf8');
  assert.match(page, /plain-1280\.png/);
  assert.match(page, /make-390\.png/);
  // With the saved route signed out it refuses with the one sign-in line, before any call, and writes nothing.
  writeFileSync(join(dir, 'config.json'), JSON.stringify({ agent: 'byokit:codex', agent_config: { 'byokit:codex': { model: 'gpt-6.1-sol' } } }));
  await assert.rejects(promisify(execFile)(process.execPath, [join(ROOT, 'scripts/compare.mjs'), 'A notes app', '--out', join(dir, 'refused')], { env: { PATH: '', HOME: dir, FIRST_DRAFT_HOME: dir } }),
    (e) => JSON.parse(e.stdout).error.message === 'No usable AI engine. Sign in to ChatGPT: codex login' && !existsSync(join(dir, 'refused')));
});

// A flow brief is drawn with the one-shell contract and scored for its shell and its character in the same single review.
const FLOW = 'a mobile onboarding flow, 6 screens, for a mindfulness app called mellow';
test('a multi-screen flow gets the one-shell contract and a flow score in the same review', async (t) => {
  if (!findBrowser()) return t.skip('no Chrome or Chromium on this machine');
  const run = await make(t, { score: 9 }, FLOW, '--options', '1', '--screens', 'Welcome,Promise,Mood');
  assert.deepEqual(run.counts, { draw: 1, 'critic-plain-page': 1, 'critic-review': 1 }, 'a flow adds no call: the flow score rides in the one review');
  const draw = first(run);
  assert.ok(draw.input[0].content.includes('ONE shell and ONE grid'), 'the flow keeps one grid and one shell on every screen');
  assert.match(draw.input[0].content, /illustration belongs to that screen's own surface[^.]*mask-image/, 'the flow tells the model to make each scene part of its screen, not a rimmed shape pasted on');
  assert.match(draw.input[0].content, /never shrinks to a thumbnail/, 'a scene keeps the size the other screens give theirs');
  assert.equal(draw.input[0].content, systemPrompt(true, false, { count: 6, screens: [] }), 'the flow rule is the only difference from the plain contract');
  assert.match(textOf(draw), /^Brief: a mobile onboarding flow, 6 screens, for a mindfulness app called mellow\nScreens: Welcome, Promise, Mood\./);
  const review = run.seen.find((s) => s.kind === 'critic-review').j;
  assert.equal(review.input.flatMap((m) => Array.isArray(m.content) ? m.content : []).filter((c) => c.type === 'input_image').length, 14, 'all six design screens at both widths plus both plain views reach the critic');
  assert.match(textOf(review), /design-phone-390-step-6/);
  const file = run.made.files[0];
  assert.deepEqual([file.critique.score, file.critique.passed, file.critique.flow.shell.score], [9, true, 9], 'a flow that keeps its shell and character passes');
  assert.match(file.critique.fix, /hero/);
});

test('a flow that changes its screens or its character from screen to screen does not pass', async (t) => {
  if (!findBrowser()) return t.skip('no Chrome or Chromium on this machine');
  const run = await make(t, { score: 9, flowScore: 6 }, FLOW, '--options', '1', '--screens', 'Welcome,Promise,Mood');
  const critique = run.made.files[0].critique;
  assert.deepEqual([critique.score, critique.passed], [9, false], 'a high design score does not save a flow whose screens or character change');
  assert.deepEqual([critique.flow.shell.score, critique.flow.character.score], [6, 6]);
});
