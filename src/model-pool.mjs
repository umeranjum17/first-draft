// The optional account pool: Firstmate's `fm-model-pool` over a home's `config/account-pool`. It answers with the account folder to
// run (an absolute path) and variable names to unset, so one tool call rotates across the logins a person already has and moves on
// when one runs out. A credential is never part of the protocol, so none can reach this module, an error message or a log.
// Opt-in and optional: without the helper, or without the pool config, every call keeps its plain BYOKit route.
import { execFile } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { delimiter, isAbsolute, resolve } from 'node:path';

const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const ANSWER_MS = 120_000, ANSWER_BYTES = 64 * 1024;
const executable = (path) => { try { accessSync(path, constants.X_OK); return path; } catch { return undefined; } };
const found = (name) => isAbsolute(name) ? executable(name) : process.env.PATH?.split(delimiter).map((p) => executable(resolve(p, name))).find(Boolean);

// FIRST_DRAFT_MODEL_POOL names the helper (a bare name from PATH, else an absolute path); FIRST_DRAFT_ACCOUNT_POOL is the pool's
// config file. Both are the person's own paths, never a Firstmate path first-draft knows.
export function modelPool() {
  const config = process.env.FIRST_DRAFT_ACCOUNT_POOL;
  if (!config || !isAbsolute(config)) return undefined;
  const bin = found(process.env.FIRST_DRAFT_MODEL_POOL || 'fm-model-pool');
  return bin && { bin, config };
}

// One protocol v1 exchange: request JSON on stdin, one answer JSON out. Only a shaped answer is used.
function ask(pool, verb, request) {
  return new Promise((keep, fail) => {
    const child = execFile(pool.bin, [verb, '--json'], { timeout: ANSWER_MS, maxBuffer: ANSWER_BYTES }, (error, stdout, stderr) => {
      let answer;
      try { answer = JSON.parse(stdout); } catch { answer = undefined; }
      const shaped = answer?.ok === true && typeof answer.selection_id === 'string' && typeof answer.provider === 'string' && typeof answer.model === 'string'
        && answer.set && typeof answer.set === 'object' && Object.entries(answer.set).every(([k, v]) => NAME.test(k) && typeof v === 'string')
        && Array.isArray(answer.unset) && answer.unset.every((n) => typeof n === 'string' && NAME.test(n));
      if (shaped) return keep(answer);
      fail(new Error(`the account pool ${verb} failed: ${answer?.reason ?? (stderr.trim() || error?.message || 'no answer from the helper')}`));
    });
    child.stdin.on('error', () => {}); // a helper that exits early closes the pipe; its answer, not this, is the error
    child.stdin.end(JSON.stringify(request));
  });
}

export const poolPick = (pool, { model, deadline, attempted }) =>
  ask(pool, 'pick', { v: 1, purpose: 'work', pool_config: pool.config, ...(model && { model }), deadline, attempted });

// The prior pick plus why it is being left (a limit, a timeout, or a route this computer cannot run here).
export const poolNext = (pool, { selection, cause, model, deadline, attempted }) =>
  ask(pool, 'next', { v: 1, purpose: 'work', pool_config: pool.config, ...(model && { model }), deadline, attempted, selection, cause });
