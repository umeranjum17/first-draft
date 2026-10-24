import { build } from 'esbuild';
import { cpSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
const root = 'vendor/open-codesign/packages';
// The runtime's ?raw imports (its React, ReactDOM and Babel builds and its device-frame JSX) load as the files' text, the way upstream's Vite build loads them.
const raw = { name: 'raw', setup(b) {
  b.onResolve({ filter: /\?raw$/ }, (a) => ({ path: resolve(dirname(a.importer), a.path.slice(0, -4)), namespace: 'raw' }));
  b.onLoad({ filter: /.*/, namespace: 'raw' }, (a) => ({ contents: readFileSync(a.path, 'utf8'), loader: 'text' }));
} };
await build({ stdin: { contents: `export { generateViaAgent, composeSystemPrompt, collectResourceManifest, loadDesignSkills, loadFrameTemplates, makeDoneTool } from './${root}/core/src/index.ts';\nexport { buildPreviewDocument, buildStandaloneDocument } from './${root}/runtime/src/index.ts';`, resolveDir: process.cwd() },
  outfile: 'dist/engine.mjs', bundle: true, platform: 'node', format: 'esm', packages: 'external', tsconfigRaw: {}, plugins: [raw],
  alias: { '@open-codesign/shared/workspace-file-lock': resolve(root, 'shared/src/workspace-file-lock.ts'), '@open-codesign/shared/html-utils': resolve(root, 'shared/src/html-utils.ts'), '@open-codesign/providers': resolve(root, 'providers/src/index.ts'), '@open-codesign/shared': resolve(root, 'shared/src/index.ts') } });
await build({ entryPoints: { view: 'src/view/app.js' }, outdir: 'dist/view', bundle: true, platform: 'browser', format: 'iife', minify: true, tsconfigRaw: {}, external: ['/fonts/*'] });
// The view's typefaces (view.css loads them from /fonts/), with their licence.
cpSync('src/view/fonts', 'dist/view/fonts', { recursive: true });
mkdirSync('dist', { recursive: true });
cpSync(`${root}/core/src/prompts/sections`, 'dist', { recursive: true, filter: (p) => !p.endsWith('.ts') });
// The engine's templates tree: method skills, design starters, scaffolds, frames and brand references, read by its skill and scaffold tools.
cpSync('vendor/open-codesign/apps/desktop/resources/templates', 'dist/templates', { recursive: true });
// first-draft's own method skills join the engine's, loaded by the same skill tool.
cpSync('templates', 'dist/templates', { recursive: true });
// The view's favicon is the logo in docs/.
cpSync('docs/logo.svg', 'dist/view/favicon.svg');
for (const f of ['favicon-32.png', 'apple-touch-icon.png']) cpSync(`docs/${f}`, `dist/view/${f}`);
cpSync('vendor/open-codesign/LICENSE', 'dist/LICENSE');
cpSync('vendor/open-codesign/NOTICE', 'dist/NOTICE');
// The landing page's footer names package.json's version.
await import('./landing-version.mjs');
