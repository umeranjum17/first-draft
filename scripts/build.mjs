// Bundles the CLI with the vendored Open CoDesign packages into dist/. The packages ship TypeScript sources and
// `?raw` text imports, so they need a bundler; BYOKit and the other runtime dependencies stay external.
// Every import of @mariozechner/pi-ai in vendored code resolves to src/pi-ai.mjs, so its model calls go through BYOKit.
import { cpSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const vendor = join(root, 'vendor/open-codesign');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const vendored = {
  name: 'vendored',
  setup(b) {
    b.onResolve({ filter: /^@open-codesign\// }, ({ path }) => {
      const [, name, ...sub] = path.split('/');
      const target = JSON.parse(readFileSync(join(vendor, name, 'package.json'), 'utf8')).exports[sub.length ? `./${sub.join('/')}` : '.'];
      if (typeof target !== 'string') return { errors: [{ text: `vendor/open-codesign/${name} exports no ${path}` }] };
      return { path: join(vendor, name, target) };
    });
    b.onResolve({ filter: /^@mariozechner\/pi-ai$/ }, () => ({ path: join(root, 'src/pi-ai.mjs') }));
    b.onResolve({ filter: /\?raw$/ }, ({ path, resolveDir }) => ({ path: join(resolveDir, path.slice(0, -4)), namespace: 'raw' }));
    b.onLoad({ filter: /.*/, namespace: 'raw' }, ({ path }) => ({ contents: readFileSync(path, 'utf8'), loader: 'text' }));
  },
};

rmSync(join(root, 'dist'), { recursive: true, force: true });
mkdirSync(join(root, 'dist'));
await build({
  entryPoints: [join(root, 'src/cli.mjs')],
  outfile: join(root, 'dist/first-draft-axi.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  external: Object.keys(pkg.dependencies),
  banner: { js: '#!/usr/bin/env node' },
  plugins: [vendored],
  tsconfigRaw: {}, // the vendored tsconfig files extend upstream's root one, which is not brought in
  logLevel: 'warning',
});
// The system prompt's sections are read at run time from beside the module that loads them, which is now the bundle.
cpSync(join(vendor, 'core/src/prompts/sections'), join(root, 'dist'), { recursive: true, filter: (p) => !p.endsWith('.ts') });
