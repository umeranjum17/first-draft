// Refresh only the design strategy/skills slice, never OpenDesign's daemon or credential paths.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
const [clone, commit] = process.argv.slice(2);
if (!clone || !/^[a-f0-9]{40}$/.test(commit ?? '')) throw Error('Usage: node scripts/sync-opendesign.mjs <clean-fork-clone> <full-commit>');
const git = (...args) => execFileSync('git', ['-C', clone, ...args], { maxBuffer: 10_000_000 });
if (git('rev-parse', 'HEAD').toString().trim() !== commit || git('status', '--porcelain', '--untracked-files=no').length) throw Error('Clone must be clean at the exact requested commit');
const entry = 'packages/contracts/src/prompts/od-next-strategy.ts';
const { metafile } = await build({ entryPoints: [resolve(clone, entry)], write: false, bundle: true, platform: 'node', format: 'esm', packages: 'external', metafile: true });
const dependencies = Object.keys(metafile.inputs).map(p => relative(resolve(clone), resolve(p)));
if (dependencies.some(p => p.startsWith('..'))) throw Error('Composer dependency escaped the fork');
const strategy = 'plugins/_official/scenarios/od-next-strategy/';
const selected = new Set([...dependencies, 'LICENSE', `${strategy}open-design.json`, `${strategy}SKILL.md`, ...['core-system-prompt.md', 'general-orchestration.md', 'task-profiles/prototype.md'].map(p => `${strategy}assets/${p}`)]);
for (const path of git('ls-tree', '-r', '--name-only', commit, 'craft', 'skills/frontend-design', 'skills/animate', 'skills/gsap-core').toString().trim().split('\n').filter(Boolean)) selected.add(path);
const sourceFiles = [...selected].sort().map(path => [path, git('show', `${commit}:${path}`)]);
rmSync('vendor/open-design', { recursive: true, force: true });
const hashes = {};
for (const [path, bytes] of sourceFiles) {
  const dest = resolve('vendor/open-design', path);
  mkdirSync(dirname(dest), { recursive: true }); writeFileSync(dest, bytes);
  hashes[path] = createHash('sha256').update(bytes).digest('hex');
}
writeFileSync('vendor/open-design/manifest.json', `${JSON.stringify({ source: 'https://github.com/umeranjum17/open-design', commit, upstream: git('merge-base', commit, 'upstream/main').toString().trim(), files: hashes }, null, 2)}\n`);
console.log(`Pinned ${sourceFiles.length} unmodified OpenDesign files at ${commit}`);
