// Clarity over flash: a flashy page fails the skill's [host] checks, a clear one passes, a loud brief is
// held to the structure only, and a landing-page brief carries the rubric. No model and no keys: the
// checks run in the browser already on the machine, and the CLI journey talks to a stand-in model.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';
import { clarityOf } from '../src/clarity.mjs';
import { findBrowser, renderCheck } from '../src/render-check.mjs';

const CLI = new URL('../src/cli.mjs', import.meta.url).pathname;
const DESIGN = readFileSync(new URL('../vendor/open-codesign/apps/desktop/resources/templates/scaffolds/design-systems/DESIGN.md', import.meta.url), 'utf8');

// One warm-neutral page with one blue accent: the shape of the skill's example. Each option breaks one check.
const page = ({ h1 = 'Built for teams, <span>proven</span> by results', extra = '', secondary = 'secondary', figure = true, gap = 0, css = '', proof = true } = {}) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ledgerly</title><style>
:root{--bg:#f6f3ee;--fg:#1f1d1a;--muted:#7a756c;--card:#fffdf9;--line:#e3ddd2;--accent:#2b5fd9;color-scheme:light dark}
@media(prefers-color-scheme:dark){:root{--bg:#171512;--fg:#f1ede6;--muted:#9c968b;--card:#211e1a;--line:#34302a;--accent:#6c93f0}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif}
section{max-width:1040px;margin:0 auto;padding:64px 20px}@media(min-width:900px){section{padding:96px 20px}}
h1{font-size:clamp(32px,6vw,56px);line-height:1.1;margin:0 0 16px;max-width:16ch}h1 span{color:var(--muted)}h2{margin:0 0 16px}
.lead{max-width:60ch;color:var(--muted);margin:0 0 24px}.row{display:flex;gap:12px;flex-wrap:wrap}
a.btn{display:inline-block;padding:12px 20px;border-radius:8px;text-decoration:none;color:var(--fg)}
a.btn[data-cta="primary"]{background:var(--accent);color:#fff}a.btn[data-cta="secondary"]{border:1px solid var(--line)}
figure{margin:40px 0 0}.shot{height:220px;border-radius:12px;background:var(--card);border:1px solid var(--line)}figcaption{color:var(--muted);font-size:14px;margin-top:8px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:16px}article{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:20px}${css}
</style></head><body>
<section id="hero" data-section="hero"><h1>${h1}</h1><p class="lead">One place for invoices, expenses and month-end, so a small team closes its books in two days.</p>${extra}<div class="row"><a class="btn" data-cta="primary" href="#hero">Start free</a><a class="btn" ${secondary ? `data-cta="${secondary}"` : ''} href="#hero">Take the tour</a></div>${figure ? '<figure><div class="shot"></div><figcaption>The month-end screen, as the finance lead sees it</figcaption></figure>' : ''}</section>
${gap ? `<div style="height:${gap}px"></div>` : ''}${proof ? `<section data-section="proof"><h2>Real teams, real time saved</h2><p class="lead">What three teams changed in their first quarter.</p><div class="cards"><article><h3>Northwind Dental</h3><p>Closed the month in 2 days, down from 6.</p></article><article><h3>Fieldwork Studio</h3><p>Cut invoice chasing from 5 hours to 40 minutes a week.</p></article><article><h3>Oakline Logistics</h3><p>Found 14 duplicate bills in the first import.</p></article></div></section>` : ''}
</body></html>`;

const CLEAR = page();
const FLASHY = page({ h1: 'Revolutionary accounting that will completely transform how your team works every single day', extra: '<p>Seamless. Next-generation. Unlock it now.</p>', secondary: 'primary', figure: false, gap: 2600, proof: false,
  css: '.lead{color:#2f9e44}h1{background:linear-gradient(90deg,#f0f,#0ff);-webkit-background-clip:text;color:transparent}.row a.btn{background:#e8590c;color:#fff}.shot,body::before{animation:spin 3s linear infinite}@keyframes spin{to{opacity:.4}}' });

// One browser for the pages of a test.
const checker = (t, flash = false) => {
  const render = renderCheck(() => {}, { clarity: { flash } });
  t.after(() => render.close());
  return async (html) => ({ status: render.status, errors: (await render.verify(html)).map((e) => `${e.source}: ${e.message}`) });
};
const MUTANTS = [
  [1, page({ h1: 'The accounting software that small teams use to close their books in two days' }), /h1 is 14 words/],
  [2, page({ css: 'h1 span{background:linear-gradient(90deg,#777,#333);-webkit-background-clip:text;color:transparent}' }), /gradient, outlined or clipped text/],
  [3, page({ extra: '<p>Trusted by 400 teams.</p>' }), /hero has 2 paragraphs/],
  [4, page({ secondary: 'primary' }), /2 elements marked data-cta="primary"/],
  [5, page({ figure: false }), /hero has no picture/],
  [6, page({ gap: 2600 }), /proof section starts \d+px down/],
  [7, page({ css: 'article h3{color:#d9822b}' }), /2 accent hues/],
  [8, page({ css: '.shot{animation:pulse 2s ease infinite}@keyframes pulse{50%{opacity:.5}}' }), /infinite animation/],
];

test('a clear page passes every host check and each check refuses its own failure', async (t) => {
  if (!findBrowser()) return t.skip('no Chrome or Chromium on this machine');
  const check = checker(t);
  assert.deepEqual(await check(CLEAR), { status: 'checked', errors: [] });
  for (const [n, html, message] of MUTANTS) {
    const { errors } = await check(html);
    assert.ok(errors.length > 0 && errors.every((e) => message.test(e)), `check ${n} alone: ${errors.join(' | ') || 'no finding'}`); // check 6 is measured at each width
    assert.ok(errors.every((e) => /^clarity: clarity over flash, the page at \d+x\d+: /.test(e)));
  }
});

test('a flashy page fails the checks; a loud brief keeps the structure and drops colour and motion', async (t) => {
  if (!findBrowser()) return t.skip('no Chrome or Chromium on this machine');
  const clear = (await checker(t)(FLASHY)).errors.join('\n');
  for (const message of [/h1 is \d+ words/, /gradient, outlined or clipped/, /hero has 2 paragraphs/, /2 elements marked data-cta="primary"/, /hero has no picture/, /no element has data-section="proof"/, /accent hues/, /infinite animation/]) assert.match(clear, message);
  const loud = (await checker(t, true)(FLASHY)).errors.join('\n');
  assert.match(loud, /hero has no picture/);
  assert.doesNotMatch(loud, /accent hues|infinite animation/);
});

test('which briefs are held to clarity, and which ask for flash', () => {
  const of = (prompt, extra = {}) => clarityOf({ prompt, ...extra });
  assert.deepEqual(of('A landing page for a small accounting software company for teams'), { flash: false });
  assert.deepEqual(of('A company website for a bakery'), { flash: false });
  assert.deepEqual(of('A bold, playful landing page for a skate brand'), { flash: true });
  assert.deepEqual(of('A landing page for a record label', { direction: 'vaporwave' }), { flash: true });
  assert.equal(of('A notes app with folders and search'), null);
  assert.equal(of('Landing page for Tea', { logo: {} }), null);
  assert.equal(of('Make the headline shorter', { seed: '<section data-section="hero"></section>' })?.flash, false);
});

// A stand-in model: plans, writes DESIGN.md and the first page, checks it, reads the failure and writes the second page.
function standIn(seen, [first, second]) {
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      seen.push(body);
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const n = seen.length - 1, ev = (o) => `event: ${o.type}\ndata: ${JSON.stringify(o)}\n\n`;
      const call = (name, args, i = 0) => ({ type: 'function_call', id: `fc${n}-${i}`, call_id: `c${n}-${i}`, name, arguments: JSON.stringify(args) });
      const file = (file_text, i = 0) => call('str_replace_based_edit_tool', { command: 'create', path: 'index.html', file_text }, i);
      const items = n === 0 ? [call('set_todos', { items: [{ text: 'Write the page', checked: false }] })]
        : n === 1 ? [call('str_replace_based_edit_tool', { command: 'create', path: 'DESIGN.md', file_text: DESIGN }), file(first, 1)]
        : n === 2 ? [call('done', { path: 'index.html' })]
        : n === 3 ? [file(second)]
        : n === 4 ? [call('done', { path: 'index.html' })]
        : [{ type: 'message', id: 'm1', status: 'completed', content: [{ type: 'output_text', text: 'The design is ready.' }] }];
      res.end(items.map((item, output_index) => ev({ type: 'response.output_item.added', output_index, item }) + ev({ type: 'response.output_item.done', output_index, item })).join('')
        + ev({ type: 'response.completed', response: { id: `r${n}`, status: 'completed', usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } } }));
    });
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

test('a landing-page brief carries the rubric and a flashy first draft is repaired in the loop; other pages are left alone', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-clarity-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const env = (server) => ({ ...process.env, HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: dir, OPENCODE_API_KEY: 'test-key', FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}` });
  const run = (server, ...args) => promisify(execFile)(process.execPath, [CLI, ...args], { env: env(server) });
  const make = async (prompt, pages) => {
    const seen = [], server = await standIn(seen, pages);
    t.after(() => server.close());
    await run(server, 'init', '--agent', 'byokit:opencode-go', '--model', 'muse-spark-1.3-contributor');
    const out = join(dir, `${seen.length}-${prompt.length}.html`);
    const { stdout } = await run(server, 'make', prompt, '--out', out, '--options', '1', '--engine');
    return { made: JSON.parse(stdout).made, seen, out, told: seen.slice(3).flatMap((s) => JSON.parse(s).input ?? []).filter((m) => m.type === 'function_call_output').map((m) => typeof m.output === 'string' ? m.output : JSON.stringify(m.output)).join('') };
  };
  const landing = await make('A landing page for a small accounting software company for teams', [FLASHY, CLEAR]);
  if (landing.made.render_check === 'skipped') return t.skip('no Chrome or Chromium on this machine');
  assert.match(landing.seen[0], /Clarity over flash \(first-draft/);
  assert.match(landing.seen[0], /proof straight after it/);
  assert.match(landing.told, /has_errors/);
  assert.match(landing.told, /clarity over flash, the page at 390x844/);
  assert.match(landing.told, /hero has no picture/);
  assert.match(readFileSync(landing.out, 'utf8'), /data-section="proof"/);
  const notes = await make('A notes page with folders and search', [FLASHY, FLASHY]);
  assert.doesNotMatch(notes.seen[0], /Clarity over flash \(first-draft/);
  assert.doesNotMatch(notes.told, /clarity over flash/);
});
