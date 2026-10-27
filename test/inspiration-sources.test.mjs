// Full journey on local standins, no network and no model: free search (open web, Hacker News, the subreddits),
// permission-checked capture with refusals kept as links, a competitor app on a stand-in emulator, and the sources list in the view.
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';
const CLI = new URL('../src/cli.mjs', import.meta.url).pathname;
const DESIGN = readFileSync(new URL('../vendor/open-codesign/apps/desktop/resources/templates/scaffolds/design-systems/DESIGN.md', import.meta.url), 'utf8');
const PERMISSION = 'Anonymous automated browsers may store screenshots of this entire website privately as visual design references. Do not copy our text or assets into generated designs.';
const RESTRICTED = 'Automated screenshots are prohibited.';
const PICTURE = new URL('../docs/logo-512.png', import.meta.url).pathname;
const REFERENCE_PAGE = '<!doctype html><html><head><title>Umer shift coverage</title><style>body{margin:24px;font-family:Arial;background:#080808;color:#fafafa}h1{font-size:32px}</style></head><body><h1>Umer shift coverage</h1><p>Shift coverage, distilled.</p><a href="/terms">Terms</a></body></html>';
const PAGE = '<!doctype html><html><head><style>:root{color-scheme:light dark;--bg:#fafafa;--ink:#111;background:var(--bg);color:var(--ink)}body{margin:24px;font-family:Arial}h1{font-size:32px}@media(prefers-color-scheme:dark){:root{--bg:#111;--ink:#fafafa}}</style></head><body><h1>Umer rota</h1><p>Shift planning for a small ward.</p></body></html>';

test('inspiration: free search, permitted captures, refused links, an emulator app and the sources list', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'fd-inspiration-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const requested = [];
  const site = createServer((req, res) => {
    requested.push(req.url);
    const send = (type, body, status = 200) => { res.writeHead(status, { 'content-type': type }); res.end(body); };
    const url = new URL(req.url, 'http://fixture.invalid');
    if (url.pathname === '/robots.txt') return send('text/plain', 'User-agent: *\nAllow: /\nDisallow: /reddit/\n');
    if (url.pathname === '/web') return send('text/html', [
      '<html><body>',
      `<a class="result__a" href="${origin}/permitted">Umer permitted dashboard</a>`,
      '<a class="result__snippet" href="/x">A dashboard of shift coverage, distilled.</a>',
      `<a class="result__a" href="${origin}/restricted">Umer restricted gallery</a>`,
      '<a class="result__snippet" href="/x">A gallery of shipped screens.</a>',
      `<a class="result__a" href="${origin}/synthetic">Chat Screenshot Generator</a>`,
      '<a class="result__snippet" href="/x">Synthetic conversations, not shipped app screens.</a>',
      `<a class="result__a" href="${origin}/no-terms">Umer notes page</a>`,
      '<a class="result__snippet" href="/x">Notes without any terms page.</a>',
      '</body></html>'].join(''));
    if (url.pathname === '/hn') return send('application/json', JSON.stringify({ hits: [
      { title: 'Show HN: Umer rota', url: `${origin}/permitted`, objectID: '1' },
      { title: 'Ask HN: what makes a rota readable?', objectID: '2' },
    ] }));
    if (url.pathname.startsWith('/reddit/')) return send('application/json', JSON.stringify({ data: { children: [] } }));
    if (url.pathname === '/terms') return send('text/html', `<h1>Permission</h1><p>${PERMISSION}</p>`);
    if (url.pathname === '/terms-restricted') return send('text/html', `<h1>Permission</h1><p>${RESTRICTED}</p>`);
    if (url.pathname === '/restricted') return send('text/html', '<title>Umer restricted gallery</title><h1>Umer restricted gallery</h1><p>Shipped screens.</p><a href="/terms-restricted">Terms</a>');
    if (url.pathname === '/no-terms') return send('text/html', '<title>Umer notes page</title><h1>Umer notes page</h1><p>No terms here.</p>');
    if (url.pathname === '/paywall') return send('text/html', '<h1>Subscribe to continue</h1><a href="/terms">Terms</a>');
    if (url.pathname === '/permitted') return send('text/html', REFERENCE_PAGE);
    return send('text/html', PAGE);
  });
  await new Promise((ok) => site.listen(0, '127.0.0.1', ok));
  t.after(() => { site.closeAllConnections(); site.close(); });
  const origin = `http://127.0.0.1:${site.address().port}`;

  // Stand-in model: plans the searches, reviews the terms, then writes one page through the engine's tool loop.
  const bin = join(dir, 'bin'); mkdirSync(bin);
  writeFileSync(join(bin, 'claude'), `#!${process.execPath}
import { appendFileSync } from 'node:fs';
const args = process.argv.slice(2);
if (args.includes('auth')) { console.log(JSON.stringify({ loggedIn: true, authMethod: 'claude.ai', apiProvider: 'firstParty' })); process.exit(0); }
let raw = ''; for await (const c of process.stdin) raw += c;
const envelope = JSON.parse(raw), { messages, tools } = JSON.parse(envelope.message.content.at(-1).text);
appendFileSync(process.env.FIRST_DRAFT_HOME + '/native-inputs', JSON.stringify({ tools: tools.map((t) => t.name) }) + '\\n');
const call = (name, a) => ({ name, arguments: JSON.stringify(a) });
const has = (n) => tools.some((t) => t.name === n);
let calls = [];
if (has('plan_reference_searches')) calls = [call('plan_reference_searches', { product_type: 'mobile shift planning', queries: ['shift planning app', 'nurse rota ui'] })];
else if (has('score_benchmark')) {
  const q = JSON.parse(messages.at(-1).content.split('\\n\\nYour last')[0]), refs = q.captures.filter((c) => c.role === 'reference');
  appendFileSync(process.env.FIRST_DRAFT_HOME + '/benchmark-inputs', JSON.stringify({ q, system: args[args.indexOf('--system-prompt') + 1], images: envelope.message.content.filter((c) => c.type === 'image').length }) + '\\n');
  calls = [call('score_benchmark', { axes: q.axes.map((axis) => ({ axis, score: axis === 'imagery' ? null : 7, references: axis === 'imagery' ? [] : [process.env.FD_BAD_EVIDENCE ? q.captures.find((c) => c.role === 'counterexample').id : refs[0].id], observed: 'Reference shows a clear reading order.', comparison: 'Target is denser; fixture assessment only.' })) })];
}
else if (has('assess_reference_terms')) { const q = JSON.parse(messages.at(-1).content), no = /prohibited/i.test(q.text);
  calls = [call('assess_reference_terms', { decision: no ? 'blocked' : 'allowed', quote: no ? ${JSON.stringify(RESTRICTED)} : process.env.FD_PERMISSION })]; }
else { const results = messages.filter((m) => m.role === 'toolResult');
  calls = results.length === 0 ? [call('set_todos', { items: [{ text: 'Write the rota screen', checked: false }] })]
    : results.length === 1 ? [call('str_replace_based_edit_tool', { command: 'create', path: 'DESIGN.md', file_text: process.env.FD_DESIGN }), call('str_replace_based_edit_tool', { command: 'create', path: 'index.html', file_text: process.env.FD_PAGE })]
    : results.length === 3 ? [call('done', { path: 'index.html' })] : []; }
console.log(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, structured_output: { text: '', calls }, usage: { input_tokens: 7, output_tokens: 8 } }));
`, { mode: 0o700 });
  // Stand-in adb: one attached emulator, a package with a launcher, and a real PNG from its screen.
  writeFileSync(join(bin, 'adb'), `#!${process.execPath}
import { readFileSync } from 'node:fs';
const a = process.argv.slice(2), at = a.indexOf('-s'), serial = at < 0 ? '' : a[at + 1], rest = at < 0 ? a : a.slice(at + 2);
// devices is the one call that cannot name a serial: it is how the serial is found. Every other call must name it.
if (a[0] === 'devices') { console.log('List of devices attached\\nemulator-test\\tdevice'); }
else if (!serial.startsWith('emulator-')) { process.stderr.write('every other adb call must name its emulator serial\\n'); process.exit(2); }
else if (rest[1] === 'pm') console.log('');
else if (rest.includes('resolve-activity')) console.log('com.umer.rota/.MainActivity');
else if (rest[1] === 'am') console.log('Status: ok');
else if (rest[0] === 'exec-out') process.stdout.write(readFileSync(process.env.FD_ADB_PNG));
else if (rest[1] === 'input') {}
else { process.stderr.write('unexpected adb call: ' + rest.join(' ') + '\\n'); process.exit(3); }
`, { mode: 0o700 });

  const project = join(dir, 'project'); mkdirSync(project);
  const base = { ...process.env, PATH: `${bin}:/usr/bin:/bin`, HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir, XDG_STATE_HOME: dir, TMPDIR: dir, FIRST_DRAFT_HOME: join(dir, 'config'), FIRST_DRAFT_TEST_REF_ORIGIN: origin, FD_PERMISSION: PERMISSION, FD_DESIGN: DESIGN, FD_PAGE: PAGE, FD_ADB_PNG: PICTURE };
  for (const key of ['CHROME_DEVTOOLS_AXI_AUTO_CONNECT', 'CHROME_DEVTOOLS_AXI_BROWSER_URL', 'CHROME_DEVTOOLS_AXI_PORT', 'FIRST_DRAFT_CHROME']) delete base[key];
  const run = (...args) => promisify(execFile)(process.execPath, [CLI, ...args], { env: base, cwd: project, timeout: 120_000, maxBuffer: 12_000_000 });
  await run('init', '--agent', 'byokit:claude', '--model', 'claude-opus-5-5');

  const out = join(project, 'rota.html');
  const made = JSON.parse((await run('make', 'A shift-swapping app for hospital nurses', '--options', '1', '--engine', '--no-critic', '--inspiration', '--app', 'com.umer.rota', '--device', 'emulator-test', '--out', out)).stdout);

  // 1. Search first: both queries over the open web and Hacker News, and the subreddits recorded as refused.
  const sources = JSON.parse(readFileSync(`${out}.sources.json`, 'utf8'));
  assert.deepEqual(sources.queries.map((q) => q.query), ['shift planning app', 'nurse rota ui']);
  assert.equal(sources.product_type, 'mobile shift planning');
  assert.equal(sources.searches.filter((s) => s.source === 'web' && s.status === 'ok').length, 2);
  assert.equal(sources.searches.filter((s) => s.source === 'hacker-news' && s.status === 'ok').length, 2);
  const reddit = sources.searches.filter((s) => s.source === 'reddit');
  assert.equal(reddit.length, 3);
  assert.ok(reddit.every((s) => s.status === 'refused' && /robots\.txt disallows/.test(s.why)), 'the subreddits refuse automated access and say why');
  for (const s of sources.searches) assert.match(s.url, new RegExp(`^${origin}/`));

  // 2. Only the pages whose own terms allow it are captured; every refusal keeps its link and description.
  const permitted = sources.sources.find((s) => s.name.includes('permitted'));
  assert.equal(permitted.status, 'captured');
  assert.equal(permitted.shots.length, 2);
  assert.match(permitted.licence_note, /Anonymous automated browsers/);
  assert.equal(permitted.description, 'A dashboard of shift coverage, distilled.');
  assert.equal(permitted.found_via, 'web');
  for (const s of permitted.shots) assert.equal(Buffer.from(s.dataUrl.slice(22), 'base64').readUInt32BE(16), s.width);
  const restricted = sources.sources.find((s) => s.name.includes('restricted'));
  assert.equal(restricted.status, 'link-only');
  assert.equal(restricted.url, `${origin}/restricted`);
  assert.equal(restricted.description, 'A gallery of shipped screens.');
  assert.match(restricted.why, /do not establish permission|restricted/);
  const noTerms = sources.sources.find((s) => s.name.includes('notes page'));
  assert.equal(noTerms.status, 'link-only');
  assert.match(noTerms.why, /No public terms/);
  const hnThread = sources.sources.find((s) => /Ask HN/.test(s.name));
  assert.equal(hnThread.url, 'https://news.ycombinator.com/item?id=2');
  assert.equal(hnThread.found_via, 'hacker-news');
  assert.ok(sources.sources.filter((s) => s.status === 'captured').length >= 1);

  // 3. The mobile competitor: a real app opened on the emulator, its own screens, internal reference only.
  const app = sources.sources.find((s) => s.package === 'com.umer.rota');
  assert.equal(app.status, 'captured');
  assert.equal(app.url, null);
  assert.equal(app.internal_reference_only, true);
  assert.equal(app.device, 'emulator-test');
  assert.equal(app.shots.length, 2);
  assert.equal(app.shots[0].width, 512);
  assert.ok(existsSync(join(readdirSync(join(project, '.first-draft', 'refs')).filter((n) => n.startsWith('app-com-umer-rota')).map((n) => join(project, '.first-draft', 'refs', n, 'screen-1.png'))[0])));
  assert.ok(!requested.some((u) => u.startsWith('/reddit/') && requested.filter((x) => x === u).length > 1), 'a refused search is not retried');

  // The summary the CLI prints names what was captured and what stayed a link.
  assert.equal(made.inspiration.captured, 2);
  assert.equal(made.inspiration.link_only, 4);
  assert.equal(made.inspiration.sidecar, '.sources.json beside each option');
  assert.ok(made.inspiration.sources.some((s) => s.package === 'com.umer.rota' && s.internal_reference_only));

  // Benchmark the same retained captures through the real CLI/adapter: all current/candidates, positive and negative evidence.
  await run('init', '--agent', 'byokit:claude', '--model', 'claude-opus-5-5', '--judge', 'byokit:claude', '--judge-model', 'claude-sonnet-5-5');
  const input = join(project, 'screens.json'), sheet = join(project, 'benchmark.html');
  const entries = ['reference', 'counterexample', 'current', 'candidate', 'candidate', 'candidate', 'candidate'].map((role, i) => ({ role, name: `Umer ${role} ${i} <script>`, file: PICTURE, source: 'Local fixture; no remote source', permission: 'Project-owned fixture', captured_at: null, theme: 'light' }));
  writeFileSync(input, JSON.stringify(entries));
  const bench = JSON.parse((await run('benchmark', '--product', 'AI chat app', '--screen', 'phone chat', '--input', input, '--out', sheet, '--project', project)).stdout);
  const report = JSON.parse(readFileSync(`${sheet}.json`, 'utf8')), html = readFileSync(sheet, 'utf8');
  assert.equal(bench.scores.length, 5, 'current and every candidate get their own comparison');
  assert.equal(report.captures.length, 8, 'seven local captures and the permitted public capture');
  assert.ok(report.discovery.queries.every((q) => /AI chat app phone chat/.test(q.query)));
  assert.ok(report.discovery.sources.some((s) => /restricted/.test(s.name) && s.status === 'link-only'));
  assert.ok(report.discovery.sources.some((s) => /Generator/.test(s.name) && /Synthetic screenshot generator/.test(s.why)));
  assert.ok(report.discovery.searches.some((s) => s.status === 'refused' && /robots/.test(s.why)));
  assert.ok(html.includes('reference-based scores') && html.includes('not comparable'));
  assert.ok(html.includes('&lt;script&gt;') && !html.includes('<script>'));
  assert.equal((html.match(/<img width="390"/g) ?? []).length, 8);
  assert.ok(html.includes('unknown (owner supplied)'));
  const wire = readFileSync(join(base.FIRST_DRAFT_HOME, 'benchmark-inputs'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(wire.length, 5);
  for (const w of wire) {
    assert.match(w.system, /Never credit a feature/);
    assert.match(w.system, /Counterexamples are negative evidence/);
    assert.match(w.system, /marketing homepage is not a chat screen/);
    assert.equal(w.q.captures.filter((r) => r.role === 'reference').length, 2);
    assert.equal(w.q.captures.filter((r) => r.role === 'counterexample').length, 1);
    assert.equal(w.images, 4, 'real raster inputs reach the native subscription boundary');
  }
  base.FD_BAD_EVIDENCE = '1';
  await assert.rejects(run('benchmark', '--product', 'chat', '--screen', 'chat', '--input', input, '--out', sheet, '--no-discovery'), (e) => /Invalid reference evidence/.test(e.stdout));
  delete base.FD_BAD_EVIDENCE;
  assert.equal(JSON.parse(readFileSync(`${sheet}.json`, 'utf8')).scores.length, 0, 'counterexample citations cannot earn a score');
  const offline = JSON.parse((await run('benchmark', '--product', 'AI chat app', '--screen', 'phone chat', '--input', input, '--out', sheet, '--no-discovery', '--no-judge')).stdout);
  assert.equal(offline.judge, 'not requested');
  writeFileSync(input, JSON.stringify(entries.map((e) => ({ ...e, theme: 'dark' }))));
  await assert.rejects(run('benchmark', '--product', 'chat', '--screen', 'chat', '--input', input, '--out', sheet, '--no-discovery', '--no-judge'), (e) => /matching theme/.test(e.stdout));
  writeFileSync(input, JSON.stringify(entries.filter((e) => e.role !== 'reference')));
  await assert.rejects(run('benchmark', '--product', 'chat', '--screen', 'chat', '--input', input, '--out', sheet, '--no-discovery'), (e) => /No real reference captures/.test(e.stdout));
  assert.match(JSON.parse(readFileSync(`${sheet}.json`, 'utf8')).judge, /^failed:/);
  // The shared public capture refuses an access gate before terms review or screenshotting.
  await assert.rejects(run('references', '--like', `${origin}/paywall`, '--capture', '--project', project), (e) => /Paywall\/access gate refused/.test(e.stdout));

  // The view shows the sources list beside the option, with a link-only entry and the captured screens.
  const view = spawn(process.execPath, [CLI, 'view', out, '--host', '127.0.0.1', '--port', '0'], { env: base, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => view.kill());
  const url = await new Promise((ok, no) => {
    let text = ''; const timer = setTimeout(() => no(new Error('view startup deadline')), 20_000);
    view.stdout.on('data', (b) => { text += b; if (text.includes('\n')) { clearTimeout(timer); const r = JSON.parse(text); r.viewing ? ok(r.viewing.url) : no(new Error(r.error?.message ?? text)); } });
    view.once('exit', (code) => { clearTimeout(timer); no(new Error(`view exited ${code}`)); });
  });
  const page = await (await fetch(url)).text();
  const design = JSON.parse(page.match(/<script type="application\/json" id="design">([\s\S]*?)<\/script>/)[1]);
  const listed = design.options[0].sources;
  assert.equal(listed.product_type, 'mobile shift planning');
  assert.equal(listed.sources.filter((s) => s.status === 'captured').length, 2);
  assert.ok(listed.sources.every((s) => s.url === null || typeof s.description === 'string'));
  const shot = listed.sources.find((s) => s.status === 'captured' && s.url !== null).shots[0];
  const image = await fetch(new URL(shot.src, url));
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('content-type'), 'image/png');

  // Part 3 refuses clearly when no emulator is there, and the run still produces the page and its sources.
  const noAdbBin = join(dir, 'no-adb'); mkdirSync(noAdbBin);
  writeFileSync(join(noAdbBin, 'claude'), readFileSync(join(bin, 'claude')), { mode: 0o700 }); // the model is there, the emulator is not
  const noAdb = { ...base, PATH: `${noAdbBin}:/usr/bin:/bin`, ANDROID_HOME: '', ANDROID_SDK_ROOT: '' };
  const second = JSON.parse((await promisify(execFile)(process.execPath, [CLI, 'make', 'A shift-swapping app for hospital nurses', '--options', '1', '--engine', '--no-critic', '--inspiration', '--app', 'com.umer.rota', '--out', join(project, 'again.html')], { env: noAdb, cwd: project, timeout: 120_000, maxBuffer: 12_000_000 })).stdout);
  const again = JSON.parse(readFileSync(join(project, 'again.html.sources.json'), 'utf8'));
  const refusedApp = again.sources.find((s) => s.package === 'com.umer.rota');
  assert.equal(refusedApp.status, 'link-only');
  assert.match(refusedApp.why, /needs adb on PATH/);
  assert.ok(existsSync(join(project, 'again.html')), 'the page is still written when the emulator step refuses');
  assert.ok(second.inspiration.captured >= 1);

  // --app without the search it belongs to is refused, with the reason.
  await assert.rejects(run('make', 'A rota app', '--options', '1', '--app', 'com.umer.rota', '--out', join(project, 'third.html')), (e) => /--app captures a mobile competitor.*--inspiration/.test(e.stdout));
});
