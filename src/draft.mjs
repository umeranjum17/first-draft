// make's create path: the plain call that beat the full engine loop in the 2026-10-24 bake-off. One prompt (the brief, Anthropic's
// frontend-design guidance and the page contract) gives one complete HTML page; the host draws it once into a static page. The critic
// (critic.mjs, run by the cli) scores it once; a low score stays flagged, not revised. Logo, redesign and generated assets still run the
// full engine (make.mjs).
import { readFileSync } from 'node:fs';
import { writePage } from './byokit.mjs';
import { FACTS } from './direct.mjs';
import { humanSideOf } from './human-side.mjs';
import { restraintProblems } from './restraint.mjs';
import { embedFonts } from './fonts.mjs';
import { embedMedia, mediaBrief, projectMedia } from './media.mjs';
import { staticExport } from './make.mjs';
import { renderCheck } from './render-check.mjs';
import { flowOf, flowRule } from './flow.mjs';
import { directionText } from './styles.mjs';
import { stopwatch } from './timing.mjs';

// The skill's own words, unmodified (Apache-2.0, src/taste/LICENSE.txt), without its attribution comment and frontmatter.
const TASTE = readFileSync(new URL('./taste/frontend-design.md', import.meta.url), 'utf8').replace(/^<!--[\s\S]*?-->\s*---[\s\S]*?\n---\s*/, '');
// first-draft's own guidance for a company, product or landing page (human-side.md): the human side, not the AI side, and the nine-point hero.
const HUMAN = readFileSync(new URL('./taste/human-side.md', import.meta.url), 'utf8').replace(/^<!--[\s\S]*?-->\s*/, '');
const LANDING = /\blanding[\s-]?pages?\b/i;
const ONE_ACCENT = 'one accent colour, used on one thing per screen (the primary action or the selected item, never also headers, highlights, badges and rows); everything else is neutral';
const BRAND = 'a landing, home or company page has one bold brand colour and one accent, the brand colour in big full-width bands and the accent on the primary action, and everything else neutral, as the human-side guidance says';
// The page contract, one named rule at a time. Each rule is a wrapper addition to the plain call: it stays only with a paired, rendered
// comparison in docs/wrapper-allowlist.json (CONTRIBUTING.md), reviewed manually.
export const contractRules = (drawing, human, flow) => [
  { id: 'reply-format', text: 'Page contract: reply with one complete, self-contained HTML document (<!doctype html> to </html>), with its CSS inside.' },
  ...(flow ? [{ id: 'flow-shell', text: `Restraint of a flow: ${flowRule()}` }] : []),
  { id: 'design-what-the-brief-names', text: 'Design what the brief names: an app, tool or product is shown as its own screens in use, not as a page that markets it, unless the brief asks for a landing, marketing or company page.' },
  human ? { id: 'brand-and-accent', text: `Restraint: ${BRAND}.` } : { id: 'one-accent', text: `Restraint: ${ONE_ACCENT}.` },
  { id: 'faint-patterns', text: 'Background patterns, grids and rules are barely visible (about 4-6% contrast), never lines that compete with the content.' },
  { id: 'controls-have-a-job', text: 'Every control is something the product has a reason to show: no close (x), menu or badge that has nothing to close, open or count.' },
  { id: 'fill-each-screen', text: 'Fill each screen for its purpose: related text sits beside or under its headline, every step of a flow has its own content and a decision to make, frames shown in a row share one height, and no part of a screen is left empty or half-built.' },
  { id: 'phone-layout-designed', text: 'The phone layout is designed, not the desktop squeezed: navigation fits without being cut (a bottom bar or a menu), a fixed bar never covers content (reserve its space), tables become two-line rows, tap targets are at least 44px, and secondary text stays at 4.5:1 contrast.' },
  { id: 'design-both-widths', text: 'People compare it at phone width (390px) and desktop width (1280px), so design both.' },
  { id: 'fonts-embedded', text: 'Google Fonts named in a <link> or @import are embedded by the host.' },
  { id: 'images-inline', text: 'Images are inline SVG, CSS or data: URIs: a remote image is blocked.' },
  { id: 'facts', text: FACTS },
  drawing
    ? { id: 'script-drawn-once', text: 'Script may run once: the host draws the page in a browser at 1280px and keeps what that first render shows, without the script, so the first render must show the whole design.' }
    : { id: 'no-script', text: 'Write no script, no on* event handler and no javascript: URL: the page is shown as a static document.' },
];
// What the model is told besides the brief: the vendored guidance, first-draft's own guidance for a company or landing page when the brief is one, then the contract.
export const systemPrompt = (drawing, human, flow) => `${TASTE}\n\n---\n\n${human ? `${HUMAN}\n\n---\n\n` : ''}${contractRules(drawing, human, flow).map((r) => r.text).join(' ')}`;
export { HUMAN, TASTE };

// How many options are drawn at once. Every call is the person's one subscription, shared with whatever else is signed into it: in the two live
// runs at three, the third call failed both times (once the draw, once a revision), so two.
export const OPTIONS_AT_ONCE = 2;

export async function draft({ prompt, brief: original, agent, model, timeoutMs, direction, screens, references = [], seed }) {
  const warn = (warning) => process.stderr.write(`first-draft-axi: ${warning}\n`);
  const human = humanSideOf({ prompt: original ?? prompt, direction }); // a revision carries the brief it started from
  const flow = flowOf(original ?? prompt, screens);
  const render = renderCheck(warn, { pageChecks: true, humanSide: human, flow: Boolean(flow) });
  const media = LANDING.test(prompt) && !references.length && !seed ? projectMedia(prompt) : []; // a landing page about this project gets its own screenshots
  const system = systemPrompt(render.drawing, human, flow);
  const brief = [`Brief: ${prompt}`, ...(direction ? [`Direction: ${directionText(direction)}`] : []),
    ...(screens?.length ? [`Screens: ${screens.join(', ')}. Put each in its own top-level <section id="..." data-oc-screen>, the first being the opening screen, linked with in-page hash links (<a href="#id">), each with a visible way back.`]
      : flow ? [`Screens: the ${flow.count} screens of this flow, each in its own top-level <section id="..." data-oc-screen>, in order, linked with in-page hash links (<a href="#id">), each with a visible way back.`] : []),
    ...(media.length ? [mediaBrief(media)] : []), ...(references.length ? ['The attached images are visual references only: never copy their pixels, text or brand into the page.'] : [])].join('\n');
  const used = { tokens_in: 0, tokens_out: 0, calls: 0 };
  const { timed, seconds } = stopwatch(); // where the seconds went: the model's page calls (draw, repair) and the browser (render)
  const ask = (text, images, stage = 'draw') => timed(stage, async () => {
    const answer = await writePage({ route: agent?.match(/^byokit:(.+)/)?.[1], model, system, prompt: text, images, timeoutMs, signal: AbortSignal.timeout(timeoutMs) });
    used.tokens_in += answer.tokens_in; used.tokens_out += answer.tokens_out; used.calls++;
    return answer.html;
  });
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
  // What the host can measure and the critic should not have to find: overflow, content under a fixed bar, clipped text, a close
  // control with nothing to close (render-check.mjs) and the source's restraint (restraint.mjs). The model gets one call to fix
  // exactly those; a page it cannot fix stays as it is, with the findings in the result.
  const checked = async (source) => {
    const drawn = await timed('render', () => finish(source));
    const layout = (await timed('render', () => render.verify(drawn.page))).filter((e) => !/light and dark themes|dark-first/.test(e.message)).map((e) => e.message.replace(/,? then call done again\.?|\s*Then call done again\.?/gi, '').slice(0, 400));
    const found = [...new Set([...restraintProblems(drawn.page), ...layout])].slice(0, 6);
    if (!found.length) return drawn;
    try {
      const fixed = restored(await ask(`${brief}\n\nThe page below has defects the host measured. Fix exactly these and change nothing else:\n${found.map((f, i) => `${i + 1}. ${f}`).join('\n')}\nReply with the complete improved HTML document.\n\n${lighter(drawn.page)}`, references, 'repair'));
      return { ...(await timed('render', () => finish(fixed))), repaired: found };
    } catch (e) { throw new Error(`The AI repair failed; no unrepaired page accepted: ${e.message}`); }
  };
  try {
    const source = restored(await ask(seed ? `${prompt}\n\nThe current page follows; change only what is asked and keep the rest.\nReply with the complete improved HTML document.\n\n${lighter(seed)}` : `${brief}\nReply with the complete HTML document.`, references));
    const { page, remote, repaired, unrepaired, repair_failed } = await checked(source);
    return { html: page, source: 'index.html', turns: used.calls, tools: {}, truncated: false, remote, ...(repaired && { repaired }), ...(unrepaired && { unrepaired, repair_failed }), tokens_in: used.tokens_in, tokens_out: used.tokens_out, render_check: render.status, timing: seconds() };
  } finally { render.close(); }
}
