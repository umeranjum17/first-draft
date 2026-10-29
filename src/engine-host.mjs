// first-draft's transport-neutral workspace tools. Design decisions come from OpenDesign.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { designPrompt, HOST_EXECUTION } from './design-engine.mjs';
export const composeSystemPrompt = () => `${designPrompt()}\n\n${HOST_EXECUTION}\n\nUse the supplied workspace tools to build the design incrementally. Read a method skill when relevant. Write DESIGN.md recording the design direction, then write the source and call done(path) to submit the complete design to the host gates. A successful done ends the generation; a failed done returns the host's exact findings for a bounded repair.`;
const paths = (root) => existsSync(root) ? readdirSync(root, { withFileTypes: true }).flatMap(e => e.isDirectory() ? paths(join(root, e.name)).map(p => `${e.name}/${p}`) : [e.name]) : [];
const inside = (root, path) => {
  const file = resolve(root, path), rel = relative(resolve(root), file);
  if (!rel || rel === '..' || rel.startsWith('../') || isAbsolute(rel)) throw Error('Resource path must stay inside its root');
  return file;
};
export async function collectResourceManifest({ templatesRoot }) {
  const skills = paths(join(templatesRoot, 'skills')).filter(p => /\.md$/.test(p) && !/LICENSE|SOURCES/.test(p));
  return { sections: [`Available method skills (load with skill): ${skills.join(', ')}. first-draft's interaction-motion, motion-sites, logo-system and clarity-over-flash remain available.`, 'Workspace source may be index.html, App.jsx or App.tsx. The host runtime draws JSX for compatibility; OpenDesign prefers editable HTML.'] };
}
const result = (details, text = JSON.stringify(details)) => ({ content: [{ type: 'text', text }], details });
const object = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const string = { type: 'string' };
const tool = (name, description, parameters, run) => ({ name, description, parameters, execute: async (_id, args) => run(args) });
export function makeDoneTool(fs, verify) {
  return tool('done', 'Submit the complete source to first-draft render, page and export checks. Repair all reported errors before resubmitting.', object({ path: string }, ['path']), async ({ path }) => {
    const source = fs.view(path);
    if (!source) throw Error(`File not found: ${path}`);
    const errors = [];
    if (!fs.view('DESIGN.md')) errors.push({ source: 'design', message: 'Write DESIGN.md describing the design direction before done.' });
    if (!errors.length) errors.push(...await verify(source.content, { path }));
    return result({ status: errors.length ? 'has_errors' : 'ok', path, errors });
  });
}
export async function generateViaAgent(input, deps) {
  const { fs, runtimeVerify } = deps;
  const tools = [
    tool('set_title', 'Name this design.', object({ title: string }, ['title']), a => result(a)),
    tool('set_todos', 'Record the bounded generation plan.', object({ items: { type: 'array', items: { type: 'object', additionalProperties: true } } }, ['items']), a => result(a)),
    tool('skill', 'Load one method skill from the available index.', object({ name: string }, ['name']), ({ name }) => {
      const candidates = [name, `${name}.md`, `${name}/SKILL.md`];
      const root = join(input.templatesRoot, 'skills');
      const file = candidates.map(p => inside(root, p)).find(p => existsSync(p) && statSync(p).isFile());
      if (!file) throw Error(`Unknown skill: ${name}`);
      return result({ name }, readFileSync(file, 'utf8'));
    }),
    tool('scaffold', 'Read an available scaffold and copy it into the in-memory workspace.', object({ name: string, destPath: string }, ['name']), ({ name, destPath }) => {
      const file = inside(join(input.templatesRoot, 'scaffolds'), name);
      const source = readFileSync(file, 'utf8');
      const path = destPath ?? name.split('/').at(-1);
      fs.create(path, source); return result({ path });
    }),
    tool('str_replace_based_edit_tool', 'Read or edit workspace source. A str_replace old_str must match exactly once. Use small incremental edits for large pages.', object({ command: { type: 'string', enum: ['view', 'create', 'str_replace', 'insert'] }, path: string, file_text: string, old_str: string, new_str: string, insert_line: { type: 'integer' }, view_range: { type: 'array', items: { type: 'integer' } } }, ['command', 'path']), a => {
      if (a.command === 'view') {
        const source = fs.view(a.path);
        if (!source) return result({ path: a.path, files: fs.listDir(a.path) });
        const lines = source.content.split('\n');
        const [start, end] = a.view_range ?? [1, lines.length];
        return result({ path: a.path, numLines: lines.length }, lines.slice(Math.max(0, start - 1), end === -1 ? undefined : end).map((line, i) => `${Math.max(1, start) + i}: ${line}`).join('\n'));
      }
      if (a.command === 'create') {
        if (typeof a.file_text !== 'string') throw Error('create requires file_text');
        return result(fs.create(a.path, a.file_text));
      }
      if (a.command === 'str_replace') {
        if (typeof a.old_str !== 'string' || !a.old_str || typeof a.new_str !== 'string') throw Error('str_replace requires nonempty old_str and new_str');
        return result(fs.strReplace(a.path, a.old_str, a.new_str));
      }
      if (typeof a.new_str !== 'string') throw Error('insert requires new_str');
      return result(fs.insert(a.path, a.insert_line, a.new_str));
    }),
    makeDoneTool(fs, runtimeVerify),
    ...(deps.generateImageAsset ? [tool('generate_image_asset', 'Generate an image with a host-approved provider and return its workspace path.', object({ provider: string, prompt: string, purpose: string, aspectRatio: string, filenameHint: string }, ['prompt', 'purpose']), async a => result(await deps.generateImageAsset(a)))] : []),
  ];
  const messages = [...(input.history ?? []), { role: 'user', content: input.prompt, timestamp: Date.now() }];
  let failedDone = 0;
  for (;;) {
    input.signal.throwIfAborted();
    const answer = await input.answer({ systemPrompt: input.systemPrompt, messages, tools });
    messages.push(answer);
    const calls = answer.content.filter(c => c.type === 'toolCall');
    if (!calls.length) return;
    for (const call of calls) {
      input.signal.throwIfAborted();
      deps.onEvent?.({ type: 'tool_execution_start', toolName: call.name, toolCallId: call.id, args: call.arguments });
      let output, isError = false;
      try {
        const selected = tools.find(t => t.name === call.name);
        if (!selected) throw Error(`Unknown tool: ${call.name}`);
        output = await selected.execute(call.id, call.arguments);
      } catch (e) {
        if (input.signal.aborted) throw input.signal.reason;
        isError = true; output = result({ error: e.message }, e.message);
      }
      deps.onEvent?.({ type: 'tool_execution_end', toolName: call.name, toolCallId: call.id, result: output, isError });
      messages.push({ role: 'toolResult', toolCallId: call.id, toolName: call.name, ...output, isError, timestamp: Date.now() });
      if (!isError && call.name === 'done') failedDone = output.details.status === 'ok' ? 0 : failedDone + 1;
    }
    // Preserve the final assistant turn (and process any edits after done); only
    // the host's still-current verified source is accepted by make.mjs.
    if (failedDone >= 3) return;
  }
}
