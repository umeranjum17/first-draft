// make's create path: the plain call that beat the full engine loop in the 2026-10-24 bake-off. One prompt (the brief, Anthropic's
// frontend-design guidance and the page contract) gives one complete HTML page; the host draws it once into a static page, and the
// critic (critic.mjs) looks at it beside the best products of its kind and sends it back with its fixes, `critic` times at most.
// refine, logo, redesign and generated assets still run the full engine (make.mjs).
import { readFileSync } from 'node:fs';
import { writePage } from './byokit.mjs';
import { BAR, FACTS, critiqueDesign } from './critic.mjs';
import { embedFonts } from './fonts.mjs';
import { embedMedia, mediaBrief, projectMedia } from './media.mjs';
import { staticExport } from './make.mjs';
import { renderCheck } from './render-check.mjs';
import { directionText } from './styles.mjs';

// The skill's own words, unmodified (Apache-2.0, src/taste/LICENSE.txt), without its attribution comment and frontmatter.
const TASTE = readFileSync(new URL('./taste/frontend-design.md', import.meta.url), 'utf8').replace(/^<!--[\s\S]*?-->\s*---[\s\S]*?\n---\s*/, '');
const LANDING = /\blanding[\s-]?pages?\b/i;
const contract = (drawing) => `Page contract: reply with one complete, self-contained HTML document (<!doctype html> to </html>), with its CSS inside. Design what the brief names: an app, tool or product is shown as its own screens in use, not as a page that markets it, unless the brief asks for a landing, marketing or company page. People compare it at phone width (390px) and desktop width (1280px), so design both. Google Fonts named in a <link> or @import are embedded by the host. Images are inline SVG, CSS or data: URIs: a remote image is blocked. ${FACTS} ${drawing
  ? 'Script may run once: the host draws the page in a browser at 1280px and keeps what that first render shows, without the script, so the first render must show the whole design.'
  : 'Write no script, no on* event handler and no javascript: URL: the page is shown as a static document.'}`;

export async function draft({ prompt, agent, model, timeoutMs, direction, screens, references = [], critic = 1 }) {
  const warn = (warning) => process.stderr.write(`first-draft-axi: ${warning}\n`);
  const render = renderCheck(warn);
  const media = LANDING.test(prompt) && !references.length ? projectMedia(prompt) : []; // a landing page about this project gets its own screenshots
  const system = `${TASTE}\n\n---\n\n${contract(render.drawing)}`;
  const brief = [`Brief: ${prompt}`, ...(direction ? [`Direction: ${directionText(direction)}`] : []),
    ...(screens?.length ? [`Screens: ${screens.join(', ')}. Put each in its own top-level <section id="..." data-oc-screen>, the first being the opening screen, linked with in-page hash links (<a href="#id">), each with a visible way back.`] : []),
    ...(media.length ? [mediaBrief(media)] : []), ...(references.length ? ['The attached images are visual references only: never copy their pixels, text or brand into the page.'] : [])].join('\n');
  const used = { tokens_in: 0, tokens_out: 0, calls: 0 };
  const ask = async (text, images) => {
    const answer = await writePage({ route: agent?.match(/^byokit:(.+)/)?.[1], model, system, prompt: text, images, timeoutMs, signal: AbortSignal.timeout(timeoutMs) });
    used.tokens_in += answer.tokens_in; used.tokens_out += answer.tokens_out; used.calls++;
    return answer.html;
  };
  // The page people see: drawn once (script runs, its result stays), script-free, with its fonts and the project's media inside.
  const finish = async (source) => {
    let html = source;
    if (render.drawing) html = (await render.snapshot(source)).html;
    const exported = staticExport(html);
    if (exported.errors.length) throw new Error(`the page fails the export: ${exported.errors.map((e) => e.message).join('; ')}`);
    return { page: embedMedia(await embedFonts(exported.html, warn), media), remote: exported.remote };
  };
  try {
    let source = await ask(`${brief}\nReply with the complete HTML document.`, references), drawn = await finish(source);
    const critiques = [];
    let best = null;
    if (render.drawing) for (let round = 0; ; round++) {
      let shots, review;
      try {
        shots = await render.capture(drawn.page);
        review = await critiqueDesign({ brief: prompt, shots, agent, model, timeoutMs });
      } catch (e) { critiques.push({ round, error: e.message }); break; } // the page stays; the make JSON says why it was not critiqued
      used.tokens_in += review.tokens_in; used.tokens_out += review.tokens_out; used.calls++;
      critiques.push({ round, score: review.score, verdict: review.verdict, fixes: review.fixes });
      if (!best || review.score >= best.score) best = { ...drawn, score: review.score }; // a tie keeps the revision
      if (review.score >= BAR || round === critic) break;
      source = await ask(`${brief}\n\nYour page is below; the attached images show it as drawn (${shots.map((s) => s.id).join(', ')}). A design director scored it ${review.score}/10 beside the best real products of its kind: ${review.verdict}\nFix these, and anything else that keeps it below 9/10:\n${review.fixes.map((f, i) => `${i + 1}. ${f}`).join('\n')}\nReply with the complete improved HTML document.\n\n${source}`, [...references, ...shots]);
      drawn = await finish(source);
    }
    best ??= drawn; // no browser: nothing to draw for the critic
    return { html: best.page, source: 'index.html', turns: used.calls, tools: {}, truncated: false, remote: best.remote, tokens_in: used.tokens_in, tokens_out: used.tokens_out, render_check: render.status, ...(critiques.length && { critique: critiques }) };
  } finally { render.close(); }
}
