import { build } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
// Never leave old-engine prompts or templates in a packed build.
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
// Canonical OpenDesign composer, unchanged; the host supplies its transport and gates.
await build({ entryPoints: ['vendor/open-design/packages/contracts/src/prompts/od-next-strategy.ts'], outfile: 'dist/opendesign.mjs', bundle: true, platform: 'node', format: 'esm', packages: 'external', tsconfigRaw: {} });
cpSync('vendor/open-design', 'dist/opendesign', { recursive: true });
// Studio's existing sandbox and JSX compatibility renderer, not a generation engine.
const root = 'vendor/studio-runtime';
const raw = { name: 'raw', setup(b) {
  b.onResolve({ filter: /\?raw$/ }, a => ({ path: resolve(dirname(a.importer), a.path.slice(0, -4)), namespace: 'raw' }));
  b.onLoad({ filter: /.*/, namespace: 'raw' }, a => ({ contents: readFileSync(a.path, 'utf8'), loader: 'text' }));
} };
await build({ stdin: { contents: `export { buildPreviewDocument, buildStandaloneDocument } from './${root}/src/index.ts';`, resolveDir: process.cwd() },
  outfile: 'dist/engine.mjs', bundle: true, platform: 'node', format: 'esm', packages: 'external', tsconfigRaw: {}, plugins: [raw],
  alias: { '@open-codesign/shared/html-utils': resolve(root, 'shared/html-utils.ts'), '@open-codesign/shared': resolve(root, 'shared/editmode.ts') } });
await build({ entryPoints: { view: 'src/view/app.js' }, outdir: 'dist/view', bundle: true, platform: 'browser', format: 'iife', minify: true, tsconfigRaw: {}, external: ['/fonts/*'] });
cpSync('src/view/fonts', 'dist/view/fonts', { recursive: true });
cpSync('vendor/open-design/skills', 'dist/templates/skills', { recursive: true });
cpSync('vendor/open-design/craft', 'dist/templates/craft', { recursive: true });
// Keep first-draft's own method skills and its compatibility scaffold.
cpSync('templates', 'dist/templates', { recursive: true });
cpSync('docs/logo.svg', 'dist/view/favicon.svg');
for (const f of ['favicon-32.png', 'apple-touch-icon.png']) cpSync(`docs/${f}`, `dist/view/${f}`);
cpSync('vendor/studio-runtime/LICENSE', 'dist/STUDIO-LICENSE');
cpSync('vendor/studio-runtime/NOTICE', 'dist/STUDIO-NOTICE');
await import('./landing-version.mjs');
