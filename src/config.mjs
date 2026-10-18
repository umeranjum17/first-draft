// $FIRST_DRAFT_HOME/config.yaml (default ~/.first-draft), in no-mistakes' shape and key names:
//   agent: byokit:<route>
//   agent_config:
//     byokit:<route>:
//       model: <model id>
//   agent_timeout: "10m"
// Nothing is chosen for the person: with no agent or model set, the caller asks them.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseDocument } from 'yaml';

export const home = () => process.env.FIRST_DRAFT_HOME || join(homedir(), '.first-draft');
export const configPath = () => join(home(), 'config.yaml');

function load() {
  try {
    return parseDocument(readFileSync(configPath(), 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return parseDocument('');
    throw e;
  }
}

const UNITS = { s: 1e3, m: 6e4, h: 36e5 };

// The settings make needs: the agent, its model and the timeout in ms (agent_timeout, default 10m).
export function read() {
  const c = load().toJS() ?? {};
  const agent = c.agent || undefined;
  const timeout = String(c.agent_timeout ?? '10m').match(/^(\d+)([smh])$/);
  if (!timeout) throw new Error(`agent_timeout "${c.agent_timeout}" in ${configPath()} is not a duration such as 10m`);
  return { agent, model: agent && c.agent_config?.[agent]?.model, timeoutMs: Number(timeout[1]) * UNITS[timeout[2]] };
}

// Saves the person's agent and its model, keeping every other key and comment in the file.
export function save({ agent, model }) {
  const doc = load();
  doc.set('agent', agent);
  doc.setIn(['agent_config', agent, 'model'], model);
  mkdirSync(home(), { recursive: true });
  writeFileSync(configPath(), String(doc));
}
