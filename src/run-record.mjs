import { randomUUID } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
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
export const loadRun = (id) => JSON.parse(readFileSync(file(id), 'utf8'));
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
