// The human-side checks (src/taste/human-side.md) the host can measure on a drawn landing, marketing, product or company page: two hues
// at most, one filled primary button in the hero, a pill above the title, a 5 to 8 word centred title, a hero picture, no run of more
// than CARD_RUN card-grid sections and one full-width colour or dark band. Each finding is a sentence the model is sent back with.
// The rest of the guidance (the AI-side tells, the voice, the product screen) is the critic's (critic.mjs).
import { clarityOf } from './clarity.mjs';

export const CARD_RUN = 2, HUES = 2, TITLE_WORDS = [5, 8];

// Is this a page the human-side guidance is about? The brief is the person's own, or the original brief of a revision.
export const humanSideOf = ({ prompt, direction }) => Boolean(clarityOf({ prompt, direction }));

// Runs in the page, at the width it is drawn at; returns the findings as text.
export function humanSidePage(runLimit, hueLimit, [minWords, maxWords]) {
  const out = [];
  const shown = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).opacity !== '0';
  const words = (el) => (el.textContent.match(/\S+/g) ?? []).length;
  const canvas = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const rgba = (value) => { canvas.clearRect(0, 0, 1, 1); canvas.fillStyle = '#000'; canvas.fillStyle = value; canvas.fillRect(0, 0, 1, 1); const [r, g, b, a] = canvas.getImageData(0, 0, 1, 1).data; return { r, g, b, a: a / 255 }; };
  const lin = (x) => (x /= 255) <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  const lab = ({ r, g, b }) => {
    const [R, G, B] = [r, g, b].map(lin);
    const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B), m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B), s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
    const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, K = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    return { L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, chroma: Math.hypot(A, K), hue: (Math.atan2(K, A) * 180 / Math.PI + 360) % 360 };
  };
  // The colour a box is painted on: its own or the nearest ancestor's background that is not transparent.
  const ground = (el) => { for (let e = el; e; e = e.parentElement) { const c = rgba(getComputedStyle(e).backgroundColor); if (c.a >= 0.5) return c; } return { r: 255, g: 255, b: 255, a: 1 }; };
  const sections = [...document.querySelectorAll('section, header, footer')].filter((s) => !s.parentElement?.closest('section') && shown(s) && s.getBoundingClientRect().height > 80);
  const h1 = document.querySelector('h1');
  // The hero: the h1's section or header, else the widest ancestor of the h1 that is still under 1.6 screens tall (a page of divs).
  const heroOf = (h) => { let e = h; while (e.parentElement && !/^(?:BODY|MAIN)$/.test(e.parentElement.tagName) && e.parentElement.getBoundingClientRect().height < 1.6 * innerHeight) e = e.parentElement; return e; };
  const hero = h1 && (h1.closest('[data-section="hero"], section, header') ?? heroOf(h1));

  if (!h1) out.push('the page has no h1; the hero needs one title');
  else {
    const n = words(h1);
    if (n < minWords || n > maxWords) out.push(`the h1 is ${n} words; write the title in ${minWords} to ${maxWords} words, specific to this product`);
    const wide = innerWidth >= 900, box = h1.getBoundingClientRect(), mid = (box.left + box.right) / 2;
    if (wide && getComputedStyle(h1).textAlign !== 'center' && Math.abs(mid - innerWidth / 2) > innerWidth * 0.12) out.push('the title is not centred; centre the hero\'s title and support line over its buttons and the product screen');
    // A pill: short text above the title, in the hero, that is not a link, a button or part of the nav.
    const above = [...hero.querySelectorAll('*')].filter((e) => shown(e) && e.children.length <= 1 && !e.closest('nav, a, button, h1, h2, svg, figure') && (h1.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_PRECEDING) && !e.contains(h1) && (e.textContent.match(/\S+/g) ?? []).length >= 1 && words(e) <= 8);
    if (!above.length) out.push('the hero has no small indicator pill above the title; add one short pill (a number, an update or an integration) in a small rounded box');
    // Buttons and links in the hero outside the nav: one filled primary, at most one other that is a button, and not larger than it.
    const controls = [...hero.querySelectorAll('a, button')].filter((e) => shown(e) && !e.closest('nav, header nav') && e.getBoundingClientRect().top > box.top - 4);
    const filled = controls.filter((e) => { const s = getComputedStyle(e), c = rgba(s.backgroundColor); if (c.a < 0.5) return false; const g = ground(e.parentElement), d = Math.abs(lab(c).L - lab(g).L); return d > 0.2 || lab(c).chroma > 0.08 && d > 0.08; });
    if (filled.length !== 1) out.push(`the hero has ${filled.length} filled buttons; it needs exactly one filled primary button, and a second action drawn as an outline or a plain link`);
    const other = controls.filter((e) => !filled.includes(e) && (getComputedStyle(e).borderTopWidth !== '0px' || /button|btn|cta/i.test(e.className)));
    if (filled.length === 1 && other.some((e) => e.getBoundingClientRect().height * e.getBoundingClientRect().width > filled[0].getBoundingClientRect().height * filled[0].getBoundingClientRect().width)) out.push('the secondary button is larger than the primary; make it a bit smaller and lighter, in the same shape and type');
    // A product screen or picture: media, a table, or a boxed panel at least 240x140 px with six or more text-bearing parts (a UI drawn in divs).
    const panel = (e) => { const r = e.getBoundingClientRect(), c = getComputedStyle(e); return r.width >= 240 && r.height >= 140 && (parseFloat(c.borderTopWidth) > 0 || c.boxShadow !== 'none' || rgba(c.backgroundColor).a > 0.5) && [...e.querySelectorAll('*')].filter((x) => x.children.length === 0 && x.textContent.trim()).length >= 6; };
    if (!hero.querySelector('img, picture, video, canvas, svg, figure, table') && ![...hero.querySelectorAll('*')].some((e) => shown(e) && !e.closest('nav') && panel(e))) out.push('the hero has no product screen or picture; draw the product\'s main screen as real data under the buttons');
  }

  // Accent hues in visible text, backgrounds and borders (OKLCH chroma above 0.06; hues within 30 degrees are one).
  const hues = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (el.closest('img, picture, video, canvas') || !shown(el)) continue;
    const s = getComputedStyle(el), used = [s.backgroundColor, ...(parseFloat(s.borderTopWidth) > 0 ? [s.borderTopColor] : [])];
    if ([...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) used.push(s.color);
    for (const value of used) { const c = rgba(value), k = lab(c); if (c.a >= 0.3 && k.chroma > 0.06) hues.push(k.hue); }
  }
  const groups = [];
  for (const h of hues.sort((x, y) => x - y)) { const g = groups.find((x) => Math.min(Math.abs(x - h), 360 - Math.abs(x - h)) <= 30); if (!g) groups.push(h); }
  if (groups.length > hueLimit) out.push(`the page uses ${groups.length} saturated hues (${groups.map((h) => `${Math.round(h)}deg`).join(', ')}); keep one bold brand colour and one accent, and draw the rest, product data included, in those two and neutrals`);

  // Sections that are a grid of three or more alike cards, in a run.
  const cardGrid = (section) => [...section.querySelectorAll('*')].some((g) => {
    const s = getComputedStyle(g);
    if (!/grid|flex/.test(s.display) || g.children.length < 3) return false;
    const kids = [...g.children].filter(shown);
    const boxed = (k) => { const c = getComputedStyle(k); return (parseFloat(c.borderTopWidth) > 0 || c.boxShadow !== 'none' || rgba(c.backgroundColor).a > 0.5) && parseFloat(c.borderTopLeftRadius) > 0; };
    const w = kids.map((k) => Math.round(k.getBoundingClientRect().width / 8));
    return kids.length >= 3 && kids.filter(boxed).length >= 3 && new Set(w).size <= 2;
  });
  let run = 0, worst = 0;
  for (const s of sections) { run = cardGrid(s) ? run + 1 : 0; worst = Math.max(worst, run); }
  if (worst > runLimit) out.push(`${worst} sections in a row are a grid of equal cards; at most ${runLimit} in a row: break the run with a statement, a split, a product screen or a colour band`);

  // Rhythm: one full-width band that is dark or saturated (the page's own ground is the body's).
  const base = ground(document.body);
  if (sections.length >= 4) {
    const band = sections.some((s) => { const c = ground(s), a = lab(c), b = lab(base); return s.getBoundingClientRect().width >= innerWidth * 0.95 && (Math.abs(a.L - b.L) > 0.25 || a.chroma > 0.1); });
    if (!band) out.push('every section sits on the page\'s own background; give at least one section a full-width colour or dark band, so the page changes rhythm');
  }
  return out;
}
