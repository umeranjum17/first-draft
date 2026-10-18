import { build } from 'esbuild';
import { cpSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const root = 'vendor/open-codesign/packages';
await build({ stdin: { contents: `export { generateViaAgent, composeSystemPrompt, makeTextEditorTool, makeDoneTool, makeSetTodosTool } from './${root}/core/src/index.ts'; export { createAssistantMessageEventStream } from '@mariozechner/pi-ai';`, resolveDir: process.cwd() },
  outfile: 'dist/engine.mjs', bundle: true, platform: 'node', format: 'esm', packages: 'external', tsconfigRaw: {},
  alias: { '@open-codesign/shared/workspace-file-lock': resolve(root, 'shared/src/workspace-file-lock.ts'), '@open-codesign/providers': resolve(root, 'providers/src/index.ts'), '@open-codesign/shared': resolve(root, 'shared/src/index.ts') } });
mkdirSync('dist', { recursive: true });
cpSync(`${root}/core/src/prompts/sections`, 'dist', { recursive: true, filter: (p) => !p.endsWith('.ts') });
cpSync('vendor/open-codesign/LICENSE', 'dist/LICENSE');
cpSync('vendor/open-codesign/NOTICE', 'dist/NOTICE');
