// Host checks on a page's own source for the restraint the page contract asks for (draft.mjs): a background grid that competes with the
// content, more than three hues, and a close button with nothing to close. Each finding is a sentence the model is sent back with.

const hex = (h) => { const x = h.length < 5 ? [...h].map((c) => c + c).join('') : h; return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16)).concat(x.length === 8 ? parseInt(x.slice(6, 8), 16) / 255 : 1); };
const fromHsl = (h, s, l, a = 1) => { const f = (n) => { const k = (n + h / 30) % 12; return Math.round(255 * (l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); }; return [f(0), f(8), f(4), a]; };
const alpha = (v) => v === undefined ? 1 : v.endsWith('%') ? parseFloat(v) / 100 : parseFloat(v);
const COLOR = /#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b|rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)|hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%(?:\s*[,/]\s*([\d.]+%?))?\s*\)/gi;
const colorsIn = (text) => [...text.matchAll(COLOR)].map((m) => m[1] ? hex(m[1]) : m[2] ? [+m[2], +m[3], +m[4], alpha(m[5])] : fromHsl(+m[6], +m[7] / 100, +m[8] / 100, alpha(m[9])));
const luminance = ([r, g, b]) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
const hsl = ([r, g, b]) => { r /= 255; g /= 255; b /= 255; const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min; if (!d) return { h: 0, s: 0, l }; const s = d / (1 - Math.abs(2 * l - 1)); const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4; return { h: (h * 60 + 360) % 360, s, l }; };

// The page's custom properties, so a grid drawn in var(--line) is read as the colour it is (the first value a property has wins).
const resolve = (css) => {
  const vars = new Map([...css.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)].reverse().map((m) => [m[1], m[2].trim()]));
  const open = (text, depth = 0) => depth > 4 ? text : text.replace(/var\(\s*(--[\w-]+)[^)]*\)/g, (_, name) => open(vars.get(name) ?? '', depth + 1));
  return open(css);
};

export function restraintProblems(html) {
  const page = html.replace(/data:[\w/+.-]+;base64,[A-Za-z0-9+/=]+/g, 'data:');
  const css = resolve([...page.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n') + [...page.matchAll(/\bstyle\s*=\s*"([^"]*)"/gi)].map((m) => `;${m[1]}`).join(''));
  const found = [];

  // A grid or rule pattern: gradients with one-pixel stops. It is faint when its lines are close to the page's own background.
  const surface = colorsIn((css.match(/(?:^|[;{}\s])(?:html|body)[^{]*\{[^}]*?background(?:-color)?\s*:\s*([^;}]+)/i) ?? [])[1] ?? '')[0]
    ?? colorsIn(css.match(/--(?:bg|background|paper|surface|canvas)[\w-]*\s*:\s*([^;}]+)/i)?.[1] ?? '')[0] ?? [255, 255, 255, 1];
  const strong = [...css.matchAll(/(?:repeating-)?linear-gradient\(([^;{}]*?)\)\s*(?:[,;}]|$)/gi)].filter((m) => /\b1(?:\.5)?px\b/.test(m[1]) && /transparent|rgba?\([^)]*,\s*0?\.\d+\)|#[0-9a-f]{8}/i.test(m[1])).some((m) => colorsIn(m[1]).some((c) => c[3] * Math.abs(luminance(c) - luminance(surface)) > 0.07)); // the line's strength: its alpha times how far it is from the page
  if (strong) found.push('A background grid or line pattern is too strong: draw its lines at no more than 4-6% contrast with the page background (an alpha of about 0.05, or a colour a step from the background), so it reads as texture and never competes with the content.');

  // One accent: a page with more than three chromatic hue families has no single accent.
  const hues = colorsIn(css).filter((c) => c[3] > 0.3).map(hsl).filter(({ s, l }) => s > 0.35 && l > 0.15 && l < 0.9).map((c) => c.h).sort((a, b) => a - b);
  const families = hues.reduce((n, h, i) => n + (i === 0 || h - hues[i - 1] > 25 ? 1 : 0), 0) - (hues.length > 1 && hues[0] + 360 - hues.at(-1) <= 25 ? 1 : 0);
  if (families > 3) found.push(`The page uses ${families} different saturated hues. Keep one accent hue, used on one thing per screen (the primary action or the selected item), and draw everything else in neutrals; add a status colour only where the data needs one.`);

  // A close button with no dialog, banner, toast, drawer or chip in the page has nothing to close.
  const closers = [...page.matchAll(/<(button|a|span|div)\b([^>]*)>\s*(?:<[^>]+>\s*)*(×|✕|✖|&times;|&#215;|&#10005;|&#10006;|x)\s*(?:<\/[^>]+>\s*)*<\/\1>/gi)].filter((m) => m[3].toLowerCase() !== 'x' || /close|dismiss/i.test(m[2]));
  const named = [...page.matchAll(/<(?:button|a|span|div|svg)\b[^>]*(?:class|id|aria-label)\s*=\s*"[^"]*(?:close|dismiss)[^"]*"/gi)];
  const hasThings = /role\s*=\s*"(?:dialog|alertdialog|alert|status)"|aria-modal|<dialog\b|\bclass\s*=\s*"[^"]*(?:modal|dialog|drawer|toast|banner|alert|popover|sheet|snackbar|chip|tag|pill|badge|notice|callout)/i.test(page);
  if ((closers.length || named.length) && !hasThings) found.push('The page has a close (x) control with nothing to close: remove it. Every control must be something this product has a reason to show.');
  return found;
}
