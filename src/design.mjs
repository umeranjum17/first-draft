import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { respond, routeOf } from './byokit.mjs';

const cards = JSON.parse(readFileSync(new URL('./design/archetypes.json', import.meta.url), 'utf8'));
const craft = readFileSync(new URL('./design/craft.md', import.meta.url), 'utf8');
const phrase = z.string().trim().min(1).max(240);
const pickSchema = z.object({ archetype: z.enum(cards.map((c) => c.id)), mood: z.array(phrase).length(2),
  refs: z.array(phrase).length(2), memorable_thing: phrase, alts: z.array(z.enum(cards.map((c) => c.id))).max(4) }).strict();

// One no-tool call per command; ranked alternatives must still fit the same product.
export async function pickDesign({ prompt, count = 1, agent, model, timeoutMs }) {
  const answer = await respond({ route: routeOf(agent), model, timeoutMs, maxTokens: 600, signal: AbortSignal.timeout(timeoutMs), context: {
    systemPrompt: `Choose a design archetype for the product, audience and primary job. Return only JSON {"archetype":"id","mood":["word","word"],"refs":["brand-like mood","brand-like mood"],"memorable_thing":"one subject-specific feature","alts":["id"]}. Alternatives required: ${count - 1}. Rank distinct alternatives that fit this product, not random styles. Reference brands are mood words only, never colours, tokens or logos.\n${cards.map((c) => `${c.id}: ${c.fits}`).join('\n')}`,
    messages: [{ role: 'user', content: prompt, timestamp: Date.now() }], tools: [],
  } });
  if (answer.stopReason === 'error' || answer.stopReason === 'aborted') throw new Error(answer.errorMessage || answer.stopReason);
  if (answer.content.some((c) => c.type === 'toolCall')) throw new Error('archetype pick returned a tool call, not JSON');
  const text = answer.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim();
  const picked = pickSchema.parse(JSON.parse(text.replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/, '$1')));
  const ids = [picked.archetype, ...picked.alts];
  if (ids.length !== count || new Set(ids).size !== count) throw new Error(`archetype pick must return ${count} distinct valid directions`);
  return { ...picked, tokens_in: answer.usage?.input ?? 0, tokens_out: answer.usage?.output ?? 0 };
}

export function designPrompt(picked, id) {
  const card = cards.find((c) => c.id === id);
  if (!card) throw new Error(`unknown design archetype: ${id}`);
  return `${craft}\nChosen archetype: ${JSON.stringify(card)}\nProduct mood and focal idea (adapt to this card): ${JSON.stringify({ mood: picked.mood, refs: picked.refs, memorable_thing: picked.memorable_thing })}`;
}
