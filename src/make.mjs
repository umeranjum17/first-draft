// A prompt to one design mock: one plain model call through BYOKit, answered as one
// self-contained HTML page. No tools, no workspace; the model chooses sensible defaults.
import { respond, routeOf } from './byokit.mjs';

const SYSTEM = `You design web pages. Reply with exactly one complete, finished, self-contained HTML5 page in one \`\`\`html fenced block and nothing else.
Rules: no remote URL of any kind (no scripts, styles, fonts, images, links to the network); inline CSS, inline SVG and data URIs only; system font stacks only; semantic HTML; a responsive layout that works at 390px and 1280px wide.`;

// The page source in a model's answer: its longest html fenced block, else the whole answer when it holds <html.
function sourceOf(text) {
  const blocks = [...text.matchAll(/```(?:html)?[^\n]*\n([\s\S]*?)```/gi)].map((m) => m[1]).sort((a, b) => b.length - a.length);
  if (blocks.length) return blocks[0];
  return /<html[\s>]/i.test(text) ? text : undefined;
}

const POLICY = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; form-action 'none'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:" />`;
const REMOTE = /\b(?:src|href|srcset|action)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))|url\(\s*["']?([^"')]+)["']?\s*\)/gi;
const REMOTE_URL = /(?:https?:)?\/\/[^\s,]+/g;

// One mock from a prompt: the page HTML, the remote addresses it names (kept from loading by
// the policy), and the call's token counts. variation steers a different option of several.
export async function make({ prompt, agent, model, timeoutMs, variation }) {
  const answer = await respond({ route: routeOf(agent), model,
    context: { systemPrompt: SYSTEM, messages: [{ role: 'user', content: variation ? `${prompt}\n\nVariation: ${variation}` : prompt }] },
    maxTokens: 16000, signal: AbortSignal.timeout(timeoutMs) });
  const text = answer.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
  const source = sourceOf(text);
  if (!source) throw new Error(`the model answered with no HTML page; it began: ${JSON.stringify(text.slice(0, 200))}`);
  let html = /<head[^>]*>/i.test(source) ? source.replace(/<head[^>]*>/i, (head) => `${head}\n${POLICY}`) : /<html[^>]*>/i.test(source) ? source.replace(/<html[^>]*>/i, (htmlTag) => `${htmlTag}<head>${POLICY}</head>`) : /<!doctype[^>]*>/i.test(source) ? source.replace(/<!doctype[^>]*>/i, (doctype) => `${doctype}<head>${POLICY}</head>`) : `<head>${POLICY}</head>${source}`;
  if (Buffer.byteLength(html) > 5_000_000) throw new Error('the mock is over 5 MB; sign-off takes mocks of 5 MB or less');
  return { html, remote: [...new Set([...html.matchAll(REMOTE)].flatMap((m) => [...(m[1] ?? m[2] ?? m[3] ?? m[4] ?? '').matchAll(REMOTE_URL)].map((url) => url[0])))],
    tokens_in: answer.usage?.input ?? 0, tokens_out: answer.usage?.output ?? 0 };
}
