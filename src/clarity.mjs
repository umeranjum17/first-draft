// Clarity over flash (templates/skills/clarity-over-flash.md): a company or product page passes the
// 5-second test. When the brief asks for such a page, the engine gets the rubric and done runs the
// skill's eight [host] checks on the drawn page; the four [model] checks stay with the skill.
// A brief that asks for a loud look gets the structure checks only (the skill's waiver of 7 and 8).

// The brief is a page whose job is to make a visitor understand and act. The options and the logo are not.
const PAGE = /\b(?:landing[\s-]?pages?|home[\s-]?pages?|marketing (?:pages?|sites?|websites?)|(?:company|product|startup|business|brand|saas) (?:pages?|sites?|websites?)|(?:website|web ?site|site) for (?:a|an|my|our) )/i;
// Flash is asked for in words, or by a style that is loud by nature.
const FLASH = /\b(?:flashy|loud|bold|playful|experimental|wild|maximalis[mt]|y2k|vaporwave|memphis|cyberpunk|anti-design|neon|glitch|psychedelic|brutalis[mt]|extravagant|over[\s-]the[\s-]top|eye-catching|animated|parallax)\b/i;
const LOUD = new Set(['anti-design', 'oled-neon', 'cyberpunk', 'maximalism', 'y2k', 'vaporwave', 'memphis', 'neobrutalism', 'raw-brutalism']);

// Is this a clarity page, and did the brief ask for flash? A refined option stays one when it carries the hero mark.
export const clarityOf = ({ prompt, direction, seed, logo, redesignPages }) => {
  if (logo || redesignPages) return null;
  if (!PAGE.test(prompt) && !/data-section=["']hero["']/.test(seed ?? '')) return null;
  return { flash: FLASH.test(prompt) || LOUD.has(direction?.trim().toLowerCase()) };
};

// The generation rubric: short, concrete, and each line is one the checks below can answer.
export const CLARITY_BRIEF = (flash) => `Clarity over flash (first-draft; load the clarity-over-flash skill): the page passes the 5-second test, so the first screen says who it is for, what it does for them, why to trust it and what to do next. Hero: <section data-section="hero"> holding one real picture (an <img>, or a <figure> holding the product typeset or an image slot captioned with the photo it wants), exactly one h1 of at most 10 words (it may mute ONE word with a <span> in a lighter tone of the text colour; no gradient or outline), at most one support paragraph of at most 30 words, one filled primary button <a data-cta="primary"> and at most one quiet secondary <a data-cta="secondary"> (no other bordered or filled button or link). Proof comes right after the hero: <section data-section="proof"> starts within two screens of the top (1600px at 1280, 1688px at 390) with two to four cases, each a named customer and one concrete result. One message per section, ending in one action.${flash ? ' The brief asks for a loud look, so colour and motion may be bold; the structure above still holds.' : ' Restraint: neutrals carry the page, at most ONE accent hue (text, backgrounds and borders), and nothing moves on its own (no infinite animation, no autoplaying video, no parallax; when the host makes a hero loop it adds the video itself, so add none and keep the hero image). No blobs, gradient orbs, 3D shapes or glow in place of a picture. Plain claims a customer would repeat.'} done checks all of this on the drawn page and names what to fix.`;

// Runs in the page. The skill's [host] checks, in its order, at the viewport the page is drawn at; returns [{ check, message }].
export function clarityPage(flash) {
  const out = [], fail = (check, message) => out.push({ check, message });
  const shown = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const words = (el) => (el.textContent.match(/\S+/g) ?? []).length;
  const label = (el) => `<${el.tagName.toLowerCase()}${typeof el.className === 'string' && el.className ? ` class="${el.className.split(/\s+/)[0]}"` : ''}>`;
  const hero = document.querySelector('[data-section="hero"]');
  if (!hero) fail(1, 'no element has data-section="hero". Wrap the first section (picture, headline, support line, buttons) in <section data-section="hero">');
  else {
    const h1s = [...document.querySelectorAll('h1')];
    if (h1s.length !== 1) fail(1, `the page has ${h1s.length} h1; it needs exactly one, inside the hero`);
    else if (!hero.contains(h1s[0])) fail(1, 'the h1 is outside [data-section="hero"]; the hero holds the page\'s one h1');
    else if (words(h1s[0]) > 10) fail(1, `the h1 is ${words(h1s[0])} words; make it a plain headline of 10 words or fewer`);
    const h1 = h1s[0];
    if (h1) {
      const own = getComputedStyle(h1);
      const muted = [...h1.querySelectorAll('*')].filter((e) => getComputedStyle(e).color !== own.color);
      const painted = [h1, ...h1.querySelectorAll('*')].some((e) => { const s = getComputedStyle(e); return s.webkitBackgroundClip === 'text' || s.backgroundClip === 'text' || s.webkitTextStrokeWidth !== '0px' || (s.webkitTextFillColor === 'rgba(0, 0, 0, 0)' && s.color !== 'rgba(0, 0, 0, 0)'); });
      if (muted.length > 1) fail(2, `the h1 sets ${muted.length} inner elements in another colour; mute one word at most (a lighter tone of the text colour in one <span>)`);
      if (painted) fail(2, 'the h1 uses gradient, outlined or clipped text; use one plain colour, with at most one muted word');
    }
    const lines = [...hero.querySelectorAll('p')].filter((p) => shown(p) && words(p) && !p.closest('figure, button, a, nav, form'));
    if (lines.length > 1) fail(3, `the hero has ${lines.length} paragraphs; keep one support line and move the rest below the hero`);
    else if (lines[0] && words(lines[0]) > 30) fail(3, `the hero's support line is ${words(lines[0])} words; cut it to 30 or fewer`);
    const cta = (kind) => [...hero.querySelectorAll(`[data-cta="${kind}"]`)].filter(shown);
    const primary = cta('primary'), secondary = cta('secondary');
    if (primary.length !== 1) fail(4, `the hero has ${primary.length} elements marked data-cta="primary"; it needs exactly one (the filled button of the one action)`);
    if (secondary.length > 1) fail(4, `the hero has ${secondary.length} elements marked data-cta="secondary"; keep at most one quiet secondary`);
    const boxed = (el) => {
      const s = getComputedStyle(el), side = (k) => parseFloat(s[`border${k}Width`]) > 0 && s[`border${k}Style`] !== 'none';
      return !['rgba(0, 0, 0, 0)', 'transparent'].includes(s.backgroundColor) || s.backgroundImage !== 'none' || (side('Top') && side('Bottom'));
    };
    const others = [...hero.querySelectorAll('button, a')].filter((e) => shown(e) && !e.matches('[data-cta]') && !e.closest('[data-cta]') && boxed(e));
    if (others.length) fail(4, `the hero has a filled or outlined ${label(others[0])} that is not marked data-cta; keep one primary and at most one secondary there, and make other links plain text`);
    if (!hero.querySelector('img, picture, video, figure')) fail(5, 'the hero has no picture; add one real image or product shot, or a <figure> image slot at the picture\'s size, captioned with the photo it wants');
  }
  const proof = document.querySelector('[data-section="proof"]');
  if (!proof) fail(6, 'no element has data-section="proof"; right after the hero add <section data-section="proof"> with two to four named customer results');
  else if (proof.getBoundingClientRect().top + scrollY > 2 * innerHeight) fail(6, `the proof section starts ${Math.round(proof.getBoundingClientRect().top + scrollY)}px down at ${innerWidth}px wide; it must start within ${2 * innerHeight}px (two screens): shorten the hero and what sits between it and the proof`);
  if (!flash) {
    // Accent hues: OKLCH chroma above 0.06 in visible text, backgrounds and borders; hues within 30 degrees are one.
    const canvas = document.createElement('canvas').getContext('2d', { willReadFrequently: true }), seen = new Map();
    const oklch = (value) => {
      if (seen.has(value)) return seen.get(value);
      canvas.clearRect(0, 0, 1, 1); canvas.fillStyle = '#000'; canvas.fillStyle = value; canvas.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = canvas.getImageData(0, 0, 1, 1).data, lin = (x) => (x /= 255) <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
      const [R, G, B] = [r, g, b].map(lin);
      const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B), m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B), s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
      const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, K = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
      const res = { a: a / 255, chroma: Math.hypot(A, K), hue: (Math.atan2(K, A) * 180 / Math.PI + 360) % 360 };
      seen.set(value, res); return res;
    };
    const hues = [];
    for (const el of document.body.querySelectorAll('*')) {
      if (el.closest('svg, img, picture, video, canvas') || !shown(el) || getComputedStyle(el).opacity === '0') continue;
      const s = getComputedStyle(el), used = [];
      if ([...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) used.push(['text', s.color]);
      used.push(['background', s.backgroundColor]);
      for (const k of ['Top', 'Right', 'Bottom', 'Left']) if (parseFloat(s[`border${k}Width`]) > 0 && s[`border${k}Style`] !== 'none') used.push(['border', s[`border${k}Color`]]);
      for (const [where, value] of used) { const c = oklch(value); if (c.a >= 0.3 && c.chroma > 0.06) hues.push({ hue: c.hue, where, el }); }
    }
    const groups = [];
    for (const h of hues.sort((x, y) => x.hue - y.hue)) {
      const g = groups.find((x) => Math.min(Math.abs(x[0].hue - h.hue), 360 - Math.abs(x[0].hue - h.hue)) <= 30);
      g ? g.push(h) : groups.push([h]);
    }
    if (groups.length > 1) fail(7, `the page uses ${groups.length} accent hues (${groups.map((g) => `${Math.round(g[0].hue)}deg on ${g[0].where} of ${label(g[0].el)}`).join(', ')}); keep one accent hue, mostly on the primary action, and make the rest neutral`);
    // Nothing moves on its own.
    const looping = [];
    for (const el of document.querySelectorAll('*')) for (const pseudo of [null, '::before', '::after']) {
      const s = getComputedStyle(el, pseudo);
      if (s.animationName !== 'none' && s.animationIterationCount.includes('infinite') && s.animationDuration.split(',').some((d) => parseFloat(d) > 0) && (pseudo || shown(el))) looping.push(`${label(el)}${pseudo ?? ''}`);
    }
    // Two videos may play on their own: the hero loop first-draft made from the design's own hero image, and a recording the project
    // supplied (embedded as data:). Any other autoplaying video still fails, and the hero loop keeps its still for reduced motion.
    const playing = [...document.querySelectorAll('video[autoplay]')].filter((v) => !v.hasAttribute('data-hero-loop') && !/^data:video\//.test(v.getAttribute('src') ?? v.querySelector('source')?.getAttribute('src') ?? ''));
    if (looping.length) fail(8, `${looping[0]} runs an infinite animation${looping.length > 1 ? ` (and ${looping.length - 1} more)` : ''}; remove looping animation (keep press and focus transitions only)`);
    if (playing.length) fail(8, 'a video autoplays that first-draft did not make: remove autoplay (only the generated hero loop and a recording the project supplied may play on its own)');
  }
  return out;
}
