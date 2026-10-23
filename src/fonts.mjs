// Web fonts for a page: the Google Fonts stylesheets a page links or imports (the engine's runtime
// adds the link for the families it names) are fetched once, here, and their latin faces put in the
// page as data: URIs. The board's policy loads fonts from data: only, so the page itself loads nothing.
const SHEET = /<link\b[^>]*\bhref\s*=\s*["'](https:\/\/fonts\.googleapis\.com\/[^"']+)["'][^>]*>|@import\s+url\(\s*["']?(https:\/\/fonts\.googleapis\.com\/[^"')]+)["']?\s*\)\s*;?/gi;
const NOT_A_SHEET = /<link\b[^>]*\bhref\s*=\s*["']https:\/\/fonts\.(?:googleapis|gstatic)\.com\/?["'][^>]*>/gi; // preconnect hints
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'; // Google serves woff2 to a current browser
const got = new Map(); // url -> Promise of the css or the font, for every page of this run

const fetchOnce = (url, as) => {
  if (!got.has(url)) got.set(url, (async () => {
    const r = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20_000) });
    if (!r.ok) throw new Error(`${new URL(url).host} answered HTTP ${r.status}`);
    return as === 'css' ? r.text() : Buffer.from(await r.arrayBuffer()).toString('base64');
  })());
  return got.get(url);
};

// One stylesheet as @font-face rules with the fonts inside: the latin faces only, and one rule for the
// weights a variable font serves from one file.
const inline = async (url) => {
  const css = await fetchOnce(url.replace(/&amp;/g, '&'), 'css');
  const faces = [...css.matchAll(/(?:\/\*\s*([\w-]+)\s*\*\/\s*)?@font-face\s*\{([^}]*)\}/g)].filter(([, subset]) => !subset || subset === 'latin');
  const rules = new Map();
  for (const [, , body] of faces) {
    const prop = (name) => body.match(new RegExp(`${name}\\s*:\\s*([^;]+);`))?.[1].trim();
    const src = body.match(/url\(([^)]+)\)/)?.[1].replace(/["']/g, '');
    if (!src) continue;
    const id = [prop('font-family'), prop('font-style') ?? 'normal', src].join('|');
    const rule = rules.get(id) ?? { family: prop('font-family'), style: prop('font-style') ?? 'normal', src, range: prop('unicode-range'), weights: [] };
    rule.weights.push(...(prop('font-weight') ?? '400').split(/\s+/).map(Number));
    rules.set(id, rule);
  }
  const out = await Promise.all([...rules.values()].map(async (r) => `@font-face{font-family:${r.family};font-style:${r.style};font-weight:${Math.min(...r.weights)} ${Math.max(...r.weights)};font-display:swap;src:url(data:font/woff2;base64,${await fetchOnce(r.src, 'font')}) format('woff2')${r.range ? `;unicode-range:${r.range}` : ''}}`));
  return out.join('\n');
};

// The page with each Google Fonts stylesheet replaced by its fonts. A font that cannot be fetched is
// left out with a warning naming why; the page then uses the next font in its stack.
export const embedFonts = async (html, onWarn = () => {}) => {
  const urls = [...new Set([...html.matchAll(SHEET)].map((m) => m[1] ?? m[2]))];
  if (!urls.length) return html.replace(NOT_A_SHEET, '');
  const css = new Map(await Promise.all(urls.map(async (url) => {
    try { return [url, await inline(url)]; } catch (e) {
      onWarn(`the web font ${url} could not be embedded (${e.cause?.message ?? e.message}), so the page falls back to the next font in its stack`);
      return [url, ''];
    }
  })));
  const linked = new Set(); // a linked sheet's fonts go in the head; an imported one's stay where the import was
  const page = html.replace(NOT_A_SHEET, '').replace(SHEET, (all, link, imported) => { if (link) { linked.add(link); return ''; } return css.get(imported); });
  const faces = [...linked].map((url) => css.get(url)).filter(Boolean).join('\n');
  if (!faces) return page;
  const style = `<style data-fonts>\n${faces}\n</style>`;
  return /<\/head>/i.test(page) ? page.replace(/<\/head>/i, `${style}\n</head>`) : page.replace(/<body\b/i, `${style}\n<body`);
};
