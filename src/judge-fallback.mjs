// A critic call that must not end the make: one more try on the same engine, then the next signed-in judge, every failure on record.
import { engineOf, resolveEngine } from './byokit.mjs';

// The judges tried after the configured one, in order: Claude Sonnet first, then Codex. Subscriptions only, never an API key.
export const FALLBACK_JUDGES = [{ agent: 'byokit:claude', model: 'claude-sonnet-5-5' }, { agent: 'byokit:codex', model: 'gpt-6.1-sol' }];

const same = (a, b) => a.agent === b.agent && a.model === b.model;
const named = (j) => `${j.model} (${j.agent})`;

// chain: [{ agent, model, open? }], the configured judge first; open() signs the engine in again at the moment it is needed
// (a judge that is not signed in is a failure to record, not a crash). run(c) makes the call on the opened engine.
// Resolves { value, by: { agent, model }, failures }; throws JUDGE_ALL_FAILED naming every engine's error.
export async function judgeWithFallback(chain, run, { retries = 1 } = {}) {
  const failures = [];
  for (const [i, entry] of chain.entries()) {
    const tries = i === 0 ? 1 + retries : 1;
    for (let attempt = 1; attempt <= tries; attempt++) {
      try {
        const c = entry.open ? await entry.open() : entry;
        const value = await run(c);
        return { value, by: { agent: c.agent, model: c.model }, failures };
      } catch (e) {
        failures.push({ agent: entry.agent, model: entry.model, attempt, error: String(e?.message ?? e) });
      }
    }
  }
  throw Object.assign(new Error(`every judge failed, so nothing was scored: ${chain.map((j) => `${named(j)}: ${failures.filter((f) => same(f, j)).map((f) => f.error).join(' | ')}`).join('; ')}`), { code: 'JUDGE_ALL_FAILED', failures });
}

// The chain for one make: the configured judge (already signed in), then each fallback that is not the same agent and model.
export const judgeChain = (primary, { timeoutMs } = {}) => [primary, ...FALLBACK_JUDGES.filter((j) => !same(j, primary)).map((j) => ({ ...j,
  open: () => resolveEngine({ ...j, timeoutMs }, { subscription: true, images: true }) }))];

// What the output says about a verdict that did not come from the configured judge: who gave it, who failed, and how it failed.
export async function fallbackNote(primary, generator, { by, failures }) {
  if (!failures.length) return undefined;
  const independent = by.agent !== generator.agent && await engineOf(by.agent) !== await engineOf(generator.agent);
  const used = !same(by, primary);
  return { used, verdict_by: by, configured: { agent: primary.agent, model: primary.model }, independent_of_generator: independent, failed: failures,
    summary: `${used ? `${named(by)} gave the verdict because the configured judge failed` : `${named(by)} gave the verdict after a retry`}: ${failures.map((f) => `${named(f)} try ${f.attempt}: ${f.error}`).join('; ')}${used && !independent ? '; this judge shares an engine with the model that made the design, so it is not independent' : ''}` };
}
