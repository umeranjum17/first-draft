// make's create path: the plain call that beat the full engine loop in the 2026-10-24 bake-off. One prompt (the brief, Anthropic's
// frontend-design guidance and the page contract) gives one complete HTML page; the host draws it once into a static page. The critic
// (critic.mjs, run by the cli) scores it and sends it back as a seed with its fixes. Logo, redesign and generated assets still run the
// full engine (make.mjs).
import { readFileSync } from 'node:fs';
import { writePage } from './byokit.mjs';
import { FACTS } from './direct.mjs';
import { embedFonts } from './fonts.mjs';
import { embedMedia, mediaBrief, projectMedia } from './media.mjs';
import { staticExport } from './make.mjs';
import { renderCheck } from './render-check.mjs';
import { directionText } from './styles.mjs';

// The skill's own words, unmodified (Apache-2.0, src/taste/LICENSE.txt), without its attribution comment and frontmatter.
const TASTE = readFileSync(new URL('./taste/frontend-design.md', import.meta.url), 'utf8').replace(/^<!--[\s\S]*?-->\s*---[\s\S]*?\n---\s*/, '');
const LANDING = /\blanding[\s-]?pages?\b/i;
const contract = (drawing) => `Page contract: reply with one complete, self-contained HTML document (<!doctype html> to </html>), with its CSS inside. Design what the brief names: an app, tool or product is shown as its own screens in use, not as a page that markets it, unless the brief asks for a landing, marketing or company page. Restraint: one accent colour, used on one thing per screen (the primary action or the selected item, never also headers, highlights, badges and rows); everything else is neutral. Background patterns, grids and rules are barely visible (about 4-6% contrast), never lines that compete with the content. Every control is something the product has a reason to show: no close (x), menu or badge that has nothing to close, open or count. People compare it at phone width (390px) and desktop width (1280px), so design both. Google Fonts named in a <link> or @import are embedded by the host. Images are inline SVG, CSS or data: URIs: a remote image is blocked. ${FACTS} ${drawing
  ? 'Script may run once: the host draws the page in a browser at 1280px and keeps what that first render shows, without the script, so the first render must show the whole design.'
  : 'Write no script, no on* event handler and no javascript: URL: the page is shown as a static document.'}`;

export async function draft({ prompt, agent, model, timeoutMs, direction, screens, references = [], seed }) {
  const warn = (warning) => process.stderr.write(`first-draft-axi: ${warning}\n`);
  const render = renderCheck(warn);
  const media = LANDING.test(prompt) && !references.length && !seed ? projectMedia(prompt) : []; // a landing page about this project gets its own screenshots
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
  // A revision starts from the page people see: its embedded fonts and images are held back (the model gets a short placeholder in
  // each data: URL) and put back in what it returns.
  const held = [];
  const lighter = (html) => html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\s*/i, '').replace(/(data:[\w/+.-]+;base64,)([A-Za-z0-9+/=]{200,})/g, (_, head, data) => `${head}@@held-${held.push(data) - 1}@@`);
  const restored = (html) => html.replace(/@@held-(\d+)@@/g, (_, i) => held[i] ?? '');
  try {
    const source = restored(await ask(seed ? `${prompt}\n\nThe current page follows; change only what is asked and keep the rest.\nReply with the complete improved HTML document.\n\n${lighter(seed)}` : `${brief}\nReply with the complete HTML document.`, references));
    const { page, remote } = await finish(source);
    return { html: page, source: 'index.html', turns: used.calls, tools: {}, truncated: false, remote, tokens_in: used.tokens_in, tokens_out: used.tokens_out, render_check: render.status };
  } finally { render.close(); }
}
