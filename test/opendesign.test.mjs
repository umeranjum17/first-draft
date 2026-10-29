import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { designPrompt, ENGINE_COMMIT } from '../src/design-engine.mjs';
import { generateViaAgent, makeDoneTool } from '../src/engine-host.mjs';

test('the pinned OpenDesign composer and all vendored source bytes are shipped unchanged', () => {
  const root = new URL('../vendor/open-design/', import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', root)));
  assert.equal(ENGINE_COMMIT, manifest.commit);
  assert.match(designPrompt(), /OD Next Prototype Task Profile/);
  const files = path => readdirSync(new URL(path, root), { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(`${path}${e.name}/`) : [`${path}${e.name}`]);
  assert.deepEqual(files('').filter(p => p !== 'manifest.json').sort(), Object.keys(manifest.files).sort());
  for (const [path, hash] of Object.entries(manifest.files)) assert.equal(createHash('sha256').update(readFileSync(new URL(path, root))).digest('hex'), hash, path);
  assert.match(readFileSync(new URL('LICENSE', root), 'utf8'), /Apache License/);
  for (const path of ['skills/animate/LICENSE', 'skills/animate/SOURCES.md', 'skills/gsap-core/LICENSE', 'skills/gsap-core/SOURCES.md', 'skills/frontend-design/LICENSE.txt']) assert.ok(manifest.files[path], path);
});

test('OpenDesign generation uses first-draft tools and cannot bypass the host verifier', async () => {
  const files = new Map();
  const fs = {
    view: p => files.has(p) ? { content: files.get(p) } : null,
    create: (p, s) => { files.set(p, s); return { path: p }; },
    listDir: () => [...files.keys()],
    strReplace: (p, old, text) => { assert.equal(files.get(p).split(old).length, 2); files.set(p, files.get(p).replace(old, text)); return { path: p }; },
  };
  const verify = async source => source.includes('broken') ? [{ source: 'render', message: 'overflow' }] : [];
  fs.create('index.html', 'broken');
  assert.equal((await makeDoneTool(fs, verify).execute('missing-design', { path: 'index.html' })).details.status, 'has_errors');
  const rounds = [
    [['str_replace_based_edit_tool', { command: 'create', path: 'DESIGN.md', file_text: 'A clear operational design.' }], ['done', { path: 'index.html' }]],
    [['skill', { name: '../../package.json' }]],
    [['str_replace_based_edit_tool', { command: 'str_replace', path: 'index.html', old_str: 'broken', new_str: '<!doctype html><h1>Complete</h1>' }], ['done', { path: 'index.html' }]],
    [], // the final assistant turn is retained, as on the previous host loop
  ];
  const events = [];
  let turn = 0;
  await generateViaAgent({ prompt: 'Build a dashboard', signal: new AbortController().signal, templatesRoot: join(import.meta.dirname, '../dist/templates'), systemPrompt: designPrompt(), answer: async context => {
    if (turn === 1) assert.ok(context.messages.some(m => m.role === 'toolResult' && m.details?.errors?.some(e => e.message === 'overflow')));
    if (turn === 2) assert.ok(context.messages.some(m => m.role === 'toolResult' && m.isError && /inside/.test(m.content[0].text)));
    return { role: 'assistant', content: rounds[turn++].map(([name, args], i) => ({ type: 'toolCall', id: `${turn}-${i}`, name, arguments: args })), stopReason: 'toolUse' };
  } }, { fs, runtimeVerify: verify, onEvent: e => events.push(e) });
  assert.equal(turn, 4);
  assert.match(files.get('index.html'), /Complete/);
  assert.equal(events.filter(e => e.type === 'tool_execution_end' && e.toolName === 'done').at(-1).result.details.status, 'ok');
});
