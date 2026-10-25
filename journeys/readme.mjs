// GitHub's Markdown API + github-markdown-css, not a mock of the README content.
// Needs gh-axi and chrome-devtools-axi. No model call; captures are outside the repo.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import YAML from 'yaml';

const root = new URL('..', import.meta.url).pathname;
const out = resolve(process.env.DONE_DONE_EVIDENCE_ROOT ?? process.argv[2] ?? '');
assert.ok(process.env.DONE_DONE_EVIDENCE_ROOT || process.argv[2], 'Give an external evidence folder');
assert.ok(!out.startsWith(root), 'Evidence must stay outside the worktree');
mkdirSync(out, { recursive: true });
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const version = JSON.parse(readFileSync(join(root, 'package.json'))).version;
const session = `fd-readme-${process.pid}`;
const env = { ...process.env, CHROME_DEVTOOLS_AXI_SESSION: session };
const browser = (...args) => execFileSync('chrome-devtools-axi', args, { env, encoding: 'utf8', timeout: 90000 });
const cssURL = 'https://cdn.jsdelivr.net/npm/github-markdown-css@5.8.1/github-markdown.css';
const css = await fetch(cssURL);
assert.ok(css.ok, `README stylesheet: HTTP ${css.status}`);
writeFileSync(join(out, 'github-markdown.css'), await css.text());
const seen = [];
try {
  browser('start');
  // A fresh isolated bridge starts a blank tab but does not select it.
  const pages = browser('pages');
  writeFileSync(join(out, 'browser-start.txt'), pages);
  const id = pages.match(/^\s*(\d+),about:blank,/m)?.[1];
  assert.ok(id, `No owned blank tab: ${pages}`);
  browser('selectpage', id);
  // Two real documents, each rendered by GitHub's Markdown API: the README, and the quality page its "How good is it?" link opens.
  const documents = [
    { prefix: '', title: 'README', file: join(root, 'README.md'), before: process.env.FD_README_BEFORE },
    { prefix: 'quality-', title: 'docs/quality.md', file: join(root, 'docs/quality.md'), before: process.env.FD_QUALITY_BEFORE },
  ];
  for (const doc of documents) for (const [phase, file] of [['after', doc.file], ...(doc.before ? [['before', doc.before]] : [])]) {
    const label = doc.prefix + phase;
    const request = join(out, `${label}-request.json`);
    writeFileSync(request, JSON.stringify({ text: readFileSync(file, 'utf8'), mode: 'gfm', context: 'umeranjum17/first-draft' }));
    const response = execFileSync('gh-axi', ['api', 'POST', '/markdown', '--input', request, '--full'], { encoding: 'utf8' });
    const parsed = YAML.parse(response);
    const html = parsed.api_response?.body;
    assert.ok(html?.includes('<h1'), 'GitHub Markdown API did not return HTML');
    writeFileSync(join(out, `${label}-github.html`), html);
    // The actual repository CSS/layout is simulated; the article is GitHub-rendered.
    // Resolve local assets to the candidate, so unpublished images can be reviewed.
    const content = html.replace(/(src|srcset)="(docs\/[^\"]+)"/g, (_, attr, path) => `${attr}="${pathToFileURL(join(root, path)).href}"`);
    const rendered = join(out, `${label}.html`);
    writeFileSync(rendered, `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${label} ${doc.title} · GitHub Markdown API</title><link rel="stylesheet" href="github-markdown.css"><style>:root{color-scheme:light dark}body{margin:0;background:#fff}@media(prefers-color-scheme:dark){body{background:#0d1117}}.markdown-body{max-width:960px;margin:auto;padding:32px;box-sizing:border-box}@media(max-width:600px){.markdown-body{padding:16px}}</style><article class="markdown-body">${content}</article></html>`);
    for (const theme of ['light', 'dark']) for (const width of [390, 1280]) {
      browser('emulate', '--viewport', `${width}x${width === 390 ? 844 : 800}x1`, '--color-scheme', theme);
      browser('open', pathToFileURL(rendered).href);
      execFileSync('sleep', ['2']);
      const state = browser('eval', 'async () => {await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));return {width:innerWidth,wide:document.documentElement.scrollWidth>innerWidth,images:[...document.images].map(i=>({src:i.currentSrc,ok:i.complete&&i.naturalWidth>0})),commands:[...document.querySelectorAll("pre")].map(p=>({wide:p.scrollWidth>p.clientWidth}))}}');
      const data = YAML.parse(state);
      const actual = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
      assert.equal(actual.width, width, `${label}: viewport width`);
      assert.equal(actual.wide, false, `${label} ${width} ${theme}: page overflow`);
      assert.ok(actual.images.every(i => i.ok), `${label} ${width} ${theme}: missing image`);
      if (label === 'after') {
        assert.ok(actual.commands.every(p => !p.wide), `${width} ${theme}: command overflow`);
        // Every comparison picture of the two briefs the README shows side by side.
        assert.equal(actual.images.filter(i => i.src.includes('/docs/ui/quality/')).length, 4, 'both briefs show their plain and First Draft picture');
        const hero = actual.images.filter(i => i.src.includes('/docs/media/'));
        assert.equal(hero.length, 1, 'the one reviewed hero picture loads');
        assert.ok(hero[0].src.includes('-dark.gif') === (theme === 'dark'), 'Correct hero theme');
        assert.ok(hero[0].src.includes('-phone') === (width === 390), 'Correct hero width');
        const board = actual.images.filter(i => i.src.includes('/docs/ui/make-'));
        assert.equal(board.length, 1, 'the real CLI excerpt loads');
        assert.ok(board[0].src.endsWith('-dark.webp') === (theme === 'dark'), 'Correct board theme');
        assert.ok(board[0].src.includes('-phone-') === (width === 390), 'Correct board width');
      }
      // The quality page opens on the score chart and one picture pair per brief.
      if (label === 'quality-after') {
        const chart = actual.images.filter(i => i.src.includes('/scores-'));
        assert.equal(chart.length, 1, 'the paired-bar score chart loads');
        assert.ok(chart[0].src.endsWith(`-${theme}.svg`), `${width} ${theme}: the chart follows the theme`);
        // Four briefs now, two of them again as they were before the fixes: every row shows both pictures.
        const rows = actual.images.filter(i => i.src.includes('/docs/ui/quality/') && !i.src.includes('/scores-'));
        assert.equal(rows.length, 12, 'every row shows its plain and First Draft picture');
      }
      const name = `${label}-${width}-${theme}`;
      browser('screenshot', join(out, `${name}.png`));
      browser('screenshot', join(out, `${name}-full.png`), '--full-page');
      seen.push({ label, theme, ...actual });
    }
  }
  writeFileSync(join(out, 'readme-states.json'), JSON.stringify(seen, null, 2));
  writeFileSync(join(out, 'steps.json'), JSON.stringify({ target: { version: `first-draft README ${version} at ${head}` }, start: 'Candidate README source, rendered by the GitHub Markdown API with github-markdown-css 5.8.1; local faithful article layout, not the github.com repository shell', steps: ['Render README and docs/quality.md with the GitHub API', 'Open each at phone 390 and desktop 1280, light and dark, in an isolated chrome-devtools-axi session', 'Wait for images to decode; check image loading, the themed score chart, each row picture, page and quick-start command overflow', 'Capture each first screen and complete article'], result: 'The README shows the product-first heading, the approved real reviewed-options hero (animated GIF, themed and phone-specific), the real CLI excerpt and a three-command quick start, and its "How good is it?" link opens a quality page that leads with the paired-bar score chart and the plain and First Draft picture of each brief, at both widths and themes; no model generation was repeated' }, null, 2));
  console.log(`PASS: README and docs/quality.md 390/1280 light/dark at ${head}`);
} finally {
  browser('stop');
}
