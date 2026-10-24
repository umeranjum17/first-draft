// The independent judge for make's critic: a different model from the one that made the design, on a subscription the person
// already uses (byokit:claude by default, or byokit:codex set with init --judge; never an API key or usage credits), shown real
// products of the same kind of page from the reference library (refs pull). With no reference pulled for that kind, or no judge
// ready to ask, the critic stays the design's own model and the output says why.
import { doctor, routeOf } from './byokit.mjs';
import { referencesFor } from './reference-library.mjs';

export const AXES = ['hierarchy', 'type', 'colour', 'spacing', 'imagery', 'proof_clarity', 'ai_tells'];
const SUBSCRIPTIONS = ['claude', 'codex'];

// The kind of page a brief asks for, by its words; anything else is an app screen.
export const pageKind = (brief) => /\b(docs|documentation|api reference|developer guide|knowledge base)\b/i.test(brief) ? 'docs'
  : /\b(landing|home ?page|marketing|website)\b/i.test(brief) ? 'landing'
  : /\b(dashboard|analytics|admin|metrics|kpis?|reporting)\b/i.test(brief) ? 'dashboard'
  : /\b(notes?|notebook|journal|to-?dos?|tasks?|planner)\b/i.test(brief) ? 'notes' : 'app';

// The judge set with init --judge, else Opus 5.5 on the Claude subscription (Sonnet 5.5 when Opus made the design).
export const judgeOf = (c, set) => set?.agent ? set : { agent: 'byokit:claude', model: c.model === 'claude-opus-5-5' ? 'claude-sonnet-5-5' : 'claude-opus-5-5' };

// Why `agent` cannot be the judge, or undefined. Tests reach a stand-in provider through a key route (FIRST_DRAFT_TEST_BYOKIT_BASE).
export const judgeRouteProblem = (agent) => SUBSCRIPTIONS.includes(routeOf(agent)) || process.env.FIRST_DRAFT_TEST_BYOKIT_BASE ? undefined
  : `the judge runs on a subscription (byokit:claude or byokit:codex), never an API key; ${agent} is not one`;

export async function openJudge({ c, brief, home, set }) {
  const kind = pageKind(brief), refs = referencesFor(home, kind);
  if (!refs.images.length) return { kind, off: refs.pulled ? `no reference of a ${kind} page was captured, so there was nothing to judge it beside` : 'no references are pulled on this machine (run first-draft-axi refs pull)' };
  const j = judgeOf(c, set);
  const problem = judgeRouteProblem(j.agent) ?? (j.model === c.model ? `the judge (${j.model}) is the model that made the design` : undefined)
    ?? await doctor(routeOf(j.agent), j.model).then((r) => r.status === 'fail' ? `${j.agent} / ${j.model} is not ready: ${r.detail}` : undefined);
  if (problem) return { kind, off: problem };
  return { kind, refs, c: { agent: j.agent, model: j.model, timeoutMs: c.timeoutMs },
    label: `independent: ${j.model} (${j.agent}), not the model that made the design (${c.model}), beside ${refs.shown.map((r) => `${r.name} (${r.kind})`).join(' and ')}` };
}
