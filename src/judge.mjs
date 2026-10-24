// A different subscription-backed model, beside captured references of the same page kind; otherwise explicit self-assessment.
import { doctor, routeOf } from './byokit.mjs';
import { referencesFor } from './reference-library.mjs';

export const AXES = ['hierarchy', 'type', 'colour', 'spacing', 'imagery', 'proof_clarity', 'ai_tells'];
const SUBSCRIPTIONS = ['claude', 'codex'];

// The kind of page a brief asks for, by its words; anything else is an app screen.
export const pageKind = (brief) => /\b(docs|documentation|api reference|developer guide|knowledge base)\b/i.test(brief) ? 'docs'
  : /\b(landing|home ?page|marketing|website)\b/i.test(brief) ? 'landing'
  : /\b(dashboard|analytics|admin|metrics|kpis?|reporting)\b/i.test(brief) ? 'dashboard'
  : /\b(notes?|notebook|journal|to-?dos?|tasks?|planner)\b/i.test(brief) ? 'notes' : 'app';

export const judgeOf = (_c, set) => set ?? { agent: 'byokit:codex', model: 'gpt-6.1-sol' };

export const judgeRouteProblem = (agent) => SUBSCRIPTIONS.includes(routeOf(agent)) ? undefined
  : `the judge runs on a subscription (byokit:claude or byokit:codex), never an API key; ${agent} is not one`;

export async function openJudge({ c, brief, home, set }) {
  const kind = pageKind(brief);
  let refs;
  try { refs = referencesFor(home, kind); } catch (e) { return { kind, off: `references unavailable: ${e.message}` }; }
  if (!refs.images.length) return { kind, off: refs.pulled ? `no reference of a ${kind} page was captured, so there was nothing to judge it beside` : 'no references are pulled on this machine (run first-draft-axi refs pull)' };
  const j = judgeOf(c, set);
  if (typeof j.agent !== 'string' || typeof j.model !== 'string' || !j.model.trim()) return { kind, off: 'invalid judge configuration: name a subscription route and a specific model' };
  const problem = judgeRouteProblem(j.agent) ?? (j.model?.replace(/^openai-codex\//, '') === c.model?.replace(/^openai-codex\//, '') ? `the judge (${j.model}) is the model that made the design` : undefined)
    ?? await doctor(routeOf(j.agent), j.model).then((r) => r.status === 'fail' ? `${j.agent} / ${j.model} is not ready: ${r.detail}` : undefined);
  if (problem) return { kind, off: problem };
  return { kind, refs, c: { agent: j.agent, model: j.model, timeoutMs: c.timeoutMs },
    label: `independent: ${j.model} (${j.agent}), not the model that made the design (${c.model}), beside ${refs.shown.map((r) => `${r.name} (${r.kind})`).join(' and ')}` };
}
