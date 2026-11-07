// Nonpaid recapture of a retained acceptance pair, plus the prompt bytes the craft change must hold. Generation was the separate, budgeted comparison.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { CRAFT_HOST_LINE, CRAFT_SET, designPrompt } from '../src/design-engine.mjs';

const root = new URL('..', import.meta.url).pathname, source = process.env.FD_CRAFT_SOURCE, out = process.env.DONE_DONE_EVIDENCE_ROOT;
if (!source || !out) throw Error('Set FD_CRAFT_SOURCE to a folder holding a retained old.html and new.html, and DONE_DONE_EVIDENCE_ROOT to the capture folder');
const sha = (text) => createHash('sha256').update(text).digest('hex');
const allow = JSON.parse(readFileSync(join(root, 'docs/wrapper-allowlist.json'), 'utf8'));
const entry = allow.entries.find((e) => e.id === 'opendesign-craft-spacing-set');

// The prompt: an empty context is today's recipe; craft adds the set and the host line, and only those.
const PLAIN = '43216b6b4f6ee9a7ae3f0aae0975b8a772f88ff630bd05bc3fe5610503444d95';
const plain = designPrompt(), crafted = designPrompt({ craft: CRAFT_SET });
assert.equal(sha(plain), PLAIN);
assert.equal(designPrompt({}), plain);
assert.ok(crafted.endsWith(`\n\n${CRAFT_HOST_LINE}`));
for (const name of CRAFT_SET) assert.ok(crafted.includes(`### ${name}\n\n`));
assert.equal(sha(CRAFT_HOST_LINE), entry.sha256);
mkdirSync(out, { recursive: true });
const prompt = { plain_sha256: sha(plain), plain_chars: plain.length, craft: CRAFT_SET, crafted_chars: crafted.length, added_chars: crafted.length - plain.length, host_line_sha256: sha(CRAFT_HOST_LINE), host_line: CRAFT_HOST_LINE };
writeFileSync(join(out, 'prompt-identity.json'), JSON.stringify(prompt, null, 1));

const dir = mkdtempSync('/var/tmp/fd-craft-view-'), shots = [], views = [];
const env = { ...process.env, FIRST_DRAFT_HOME: join(dir, 'config') };
for (const k of ['CHROME_DEVTOOLS_AXI_AUTO_CONNECT', 'CHROME_DEVTOOLS_AXI_BROWSER_URL', 'CHROME_DEVTOOLS_AXI_PORT']) delete env[k];
const run = (bin, args) => execFileSync(bin, args, { env, encoding: 'utf8', timeout: 90000, maxBuffer: 10000000 });
const open = (file) => new Promise((ok, no) => {
  const view = spawn(process.execPath, [join(root, 'src/cli.mjs'), 'view', resolve(source, file), '--host', '127.0.0.1', '--port', '0'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  views.push(view);
  let s = '';
  const timer = setTimeout(() => no(Error('Viewer startup deadline')), 15000);
  view.stdout.on('data', (b) => { s += b; if (s.includes('\n')) { clearTimeout(timer); const r = JSON.parse(s); r.viewing ? ok(r.viewing) : no(Error(r.error?.message || s)); } });
  view.once('exit', () => { clearTimeout(timer); no(Error('Viewer exited')); });
  view.once('error', no);
});
try {
  const pages = { old: await open('old.html'), new: await open('new.html') };
  for (const theme of ['light', 'dark']) for (const width of [1280, 390]) {
    const height = width === 390 ? 844 : 800, key = `${width}-${theme}`, files = {};
    for (const [arm, opened] of Object.entries(pages)) {
      env.CHROME_DEVTOOLS_AXI_SESSION = `fd-craft-${process.pid}-${arm}-${key}`;
      env.CHROME_DEVTOOLS_AXI_USER_DATA_DIR = join(dir, `${arm}-${key}`);
      const browser = (...args) => run('chrome-devtools-axi', args);
      try {
        const id = browser('pages').match(/^\s*(\d+),about:blank,/m)?.[1];
        assert.ok(id, 'Owned blank browser');
        browser('selectpage', id);
        browser('emulate', '--viewport', `${width}x${height}x1`, '--color-scheme', theme);
        browser('resize', String(width), String(height));
        browser('open', `${opened.frames}/o/1?play`);
        browser('eval', `async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));if(innerWidth!==${width}||!matchMedia('(prefers-color-scheme: ${theme})').matches||document.documentElement.scrollWidth>innerWidth)throw Error('Page not ready');return 1}`);
        files[arm] = join(out, `${key}-${arm}.png`);
        browser('screenshot', files[arm]);
        const png = readFileSync(files[arm]);
        assert.equal(png.readUInt32BE(16), width);
        assert.equal(png.readUInt32BE(20), height);
      } finally { browser('stop'); }
    }
    run('magick', [files.old, files.new, '+append', join(out, `${key}-old-and-new.png`)]);
    shots.push(`${key}-old-and-new.png`);
  }
  writeFileSync(join(out, 'steps.json'), JSON.stringify({
    target: { version: run('git', ['-C', root, 'rev-parse', 'HEAD']).trim() },
    start: 'Retained pages from the craft acceptance comparison; no generation repeated',
    steps: ['Read the real composed prompt: empty context against the recorded hash, then with the craft set', 'Launch the real first-draft viewer on owned loopback ports, one per page', 'Open each page at 1280 and 390, light and dark, with chrome-devtools-axi', 'Place the page made without craft (left) beside the page made with it (right), uncropped'],
    result: `An empty context keeps the recorded prompt. Craft adds ${prompt.added_chars} characters. Each capture shows one width and theme, left without craft, right with it. This is a retained-output recapture, not a new generation.`,
    prompt, shots,
  }, null, 1));
} finally { for (const v of views) v.kill(); rmSync(dir, { recursive: true, force: true }); }
