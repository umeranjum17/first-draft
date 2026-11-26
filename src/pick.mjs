// The run's pick, read from the board's own answer (`sign-off-axi answers --key <key> --json`, one object keyed by the card:
// {"<key>":{"answer","label","close","at","note"?}}). Nothing here waits or polls: the answer is read when a run is inspected.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { advanceRun } from './run-record.mjs';
import { redact } from './post.mjs';

export async function settlePick(run) {
  if (run.state !== 'posted') return run;
  const { board, key, options } = run.posted;
  let answers;
  try { answers = JSON.parse((await promisify(execFile)('sign-off-axi', ['answers', board, '--key', key, '--json'], { maxBuffer: 1e7 })).stdout || '{}'); }
  catch (e) { return { ...run, pick_error: `sign-off-axi answers failed: ${redact((e.stderr || e.stdout || e.message).trim())}` }; }
  const answer = answers[key];
  if (!answer) return run;
  const option = options.find((o) => o.option === answer.answer);
  if (!option) return { ...run, pick_error: `the board answered "${answer.answer}", which is not one of the posted options (${options.map((o) => o.option).join(', ')})` };
  return advanceRun(run.id, 'posted', 'picked', { pick: { option: option.option, label: option.label, at: answer.at, ...(answer.note && { note: answer.note }) } }) ?? run;
}
