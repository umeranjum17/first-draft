import { build } from 'esbuild';
import { cpSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const root = 'vendor/open-codesign/packages';
// The runtime's React/Babel UMD vendor files are not imported (first-draft previews HTML only), so their ?raw imports load as empty strings.
const noJsxRuntime = { name: 'no-jsx-runtime', setup(b) {
  b.onResolve({ filter: /\?raw$/ }, (a) => ({ path: a.path, namespace: 'no-jsx-runtime' }));
  b.onLoad({ filter: /.*/, namespace: 'no-jsx-runtime' }, () => ({ contents: 'export default ""', loader: 'js' }));
} };
await build({ stdin: { contents: `export { generateViaAgent, composeSystemPrompt, makeTextEditorTool, makeDoneTool } from './${root}/core/src/index.ts';\nexport { buildPreviewDocument } from './${root}/runtime/src/index.ts';`, resolveDir: process.cwd() },
  outfile: 'dist/engine.mjs', bundle: true, platform: 'node', format: 'esm', packages: 'external', tsconfigRaw: {}, plugins: [noJsxRuntime],
  alias: { '@open-codesign/shared/workspace-file-lock': resolve(root, 'shared/src/workspace-file-lock.ts'), '@open-codesign/shared/html-utils': resolve(root, 'shared/src/html-utils.ts'), '@open-codesign/providers': resolve(root, 'providers/src/index.ts'), '@open-codesign/shared': resolve(root, 'shared/src/index.ts') } });
await build({ entryPoints: { view: 'src/view/app.js' }, outdir: 'dist/view', bundle: true, platform: 'browser', format: 'iife', minify: true, tsconfigRaw: {} });
mkdirSync('dist', { recursive: true });
cpSync(`${root}/core/src/prompts/sections`, 'dist', { recursive: true, filter: (p) => !p.endsWith('.ts') });
cpSync('vendor/open-codesign/LICENSE', 'dist/LICENSE');
cpSync('vendor/open-codesign/NOTICE', 'dist/NOTICE');
