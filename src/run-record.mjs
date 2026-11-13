import { randomUUID } from 'node:crypto';
import { appendFileSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = () => resolve('.first-draft/runs');
const file = (id) => {
  if (!/^[\da-f-]{36}$/.test(id)) throw new Error('Invalid run id');
  return join(root(), `${id}.json`);
};
const save = (run) => {
  mkdirSync(root(), { recursive: true });
  const path = file(run.id), temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(run, null, 2)}\n`);
  renameSync(temp, path);
};
// Loop and refine events are appended separately so concurrent processes do not overwrite the run state or each other.
export function loadRun(id) {
  const run = JSON.parse(readFileSync(file(id), 'utf8'));
  let lines;
  try { lines = readFileSync(`${file(id)}.counts`, 'utf8').trim().split('\n').filter(Boolean); }
  catch (e) { if (e.code !== 'ENOENT') throw e; lines = []; }
  const counts = { limits: { done_followups: 3, plan_tries: 2, screen_tries: 3, logo_concept_tries: 3 }, done_followups: {}, plan_tries: {}, screen_tries: {}, logo_concept_tries: {}, refine_calls: 0 };
  const loop_events = [];
  for (const line of lines) {
    const event = JSON.parse(line);
    if (event.kind === 'refine') counts.refine_calls++;
    else if (event.kind === 'file') run.files = [...new Set([...run.files, event.path])];
    else {
      const cap = event.kind === 'plan_tries' ? 2 : 3;
      const label = event.kind === 'done_followups' ? 'follow-up' : event.kind === 'plan_tries' ? 'plan try' : event.kind === 'screen_tries' ? 'screen try' : 'logo concept try';
      counts[event.kind][event.key] = { count: event.count, cap, display: `${label} ${event.count} of ${cap}` };
      loop_events.push({ ...event, display: `${label} ${event.count} of ${cap}` });
    }
  }
  return { ...run, counts, loop_events };
}
export function recordCount(run, kind, key, count) {
  if (run) appendFileSync(`${file(run.id)}.counts`, `${JSON.stringify({ kind, key, count })}\n`);
}
export function recordRefine(path, output) {
  const run = listRuns().find((r) => r.files.some((f) => resolve(f) === resolve(path)));
  if (run) {
    appendFileSync(`${file(run.id)}.counts`, `${JSON.stringify(output ? { kind: 'file', path: resolve(output) } : { kind: 'refine' })}\n`);
  }
  return run;
}
export function listRuns() {
  let names;
  try { names = readdirSync(root()); } catch (e) { if (e.code === 'ENOENT') return []; throw e; }
  return names.filter((n) => /^[\da-f-]{36}\.json$/.test(n)).map((n) => loadRun(n.slice(0, -5))).sort((a, b) => b.started_at.localeCompare(a.started_at));
}
export function startRun(brief) {
  const run = { id: randomUUID(), state: 'gathering', health: 'running', pid: process.pid, started_at: new Date().toISOString(), brief, files: [], events: [] };
  updateRun(run, 'gathering');
  return run;
}
export function updateRun(run, state, fields = {}) {
  Object.assign(run, fields, { state, updated_at: new Date().toISOString() });
  run.events.push({ at: run.updated_at, state, health: run.health, ...(run.error && { error: run.error }) });
  save(run);
}
export function finishRun(run, fields = {}) { updateRun(run, run.state, { health: 'finished', ...fields }); }
export function failRun(run, message) { if (run?.health === 'running') updateRun(run, run.state, { health: 'failed', error: message }); }
export function observedRun(run) {
  if (run.health === 'running') {
    try { process.kill(run.pid, 0); } catch (e) { if (e.code === 'ESRCH') return { ...run, health: 'interrupted' }; throw e; }
  }
  return run;
}
