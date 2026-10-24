// Logo mode: an option is a brand sheet (the engine's index.html) and the logo files the engine writes beside it in logo/.
// The host checks every SVG against an allow-list in the machine's Chrome, draws the app icon there at every icon size, refuses
// an icon that is blank or low in contrast at 16 px, loses its detail at 16 px, paints outside the maskable safe zone or is not
// full-bleed, a light or dark twin that does not read on its tile, and a palette whose colours do not read or are not the ones drawn.
// Nothing is silently fixed: each finding goes back to the model through done. The concept and critique steps are in logo-concepts.mjs.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

export const SVGS = [...['mark', 'wordmark', 'lockup-horizontal', 'lockup-stacked'].flatMap((m) => [`${m}.svg`, `${m}-dark.svg`]), 'icon.svg'];
export const FILES = [...SVGS, 'palette.json']; // what the engine writes in logo/
export const SIZES = [16, 32, 48, 180, 192, 512, 1024];
const SHOWN = [...SVGS, 'icon-16.png', 'icon-32.png']; // what the brand sheet must show, so a reviewer sees every file and the icon at 16 px
const MAX_BYTES = 20_000;
// What `logo --options N` gives each option when no direction is named: logo kinds, so options differ in kind.
export const LOGO_DIRECTIONS = [
  { id: 'geometric-symbol', name: 'Geometric symbol', line: 'a symbol built from two or three simple shapes on a grid, beside a calm wordmark' },
  { id: 'lettermark', name: 'Lettermark', line: 'the initial drawn as one custom monogram with a single distinctive cut or join' },
  { id: 'negative-space', name: 'Negative space', line: 'a solid shape whose second meaning lives in the space cut out of it' },
  { id: 'wordmark', name: 'Wordmark', line: 'the name in custom-drawn letters with one detail that becomes the mark' },
  { id: 'emblem', name: 'Emblem', line: 'a contained badge (circle, shield or rounded square) holding a simple symbol' },
  { id: 'abstract', name: 'Abstract', line: 'a non-literal form that carries the brand\'s mood rather than a picture of the product' },
];
export const logoDirection = (d) => { const s = LOGO_DIRECTIONS.find((x) => x.id === d?.trim().toLowerCase()); return s ? `${s.name}: ${s.line}.` : d; };

export const LOGO_CONTRACT = `Host export contract (first-draft logo mode; overrides the JSX/runtime guidance above): this design is a logo, not an app screen. Load the logo-system skill first and follow it. The brief names the concept to draw: refine that one idea, do not start another. Write these files with the editor:
- logo/mark.svg: the symbol alone, square viewBox. logo/wordmark.svg: the name alone. logo/lockup-horizontal.svg: the mark beside the name. logo/lockup-stacked.svg: the mark above the name.
- A -dark twin of each for dark backgrounds: logo/mark-dark.svg, logo/wordmark-dark.svg, logo/lockup-horizontal-dark.svg, logo/lockup-stacked-dark.svg (same geometry, colours that read on near-black). The others read on white.
- logo/icon.svg: the app icon. Square viewBox, one flat background colour over the whole square (no transparent corners, no rounded outer corners: the platform masks it), the mark inside the central circle whose diameter is 80% of the side, and still readable at 16 px: every part, gap and cut of it survives at 16 px.
- logo/palette.json: the option's palette, {"reason": "one line on why these colours fit the concept", "light": {"primary": "#rrggbb", "accent": "#rrggbb", "neutral": "#rrggbb"}, "dark": {"primary": ..., "accent": ..., "neutral": ...}}. The host has already written it from the concept's idea when the brief names one: view it first, draw with exactly its colours and do not change it (done refuses a changed palette). Otherwise write it: primary is the brand colour, accent the second colour, neutral the ink for type and quiet parts, each light colour reading on white at 3:1 or more and each dark colour on near-black #121212 at 3:1 or more. Every colour in the files comes from it: the light files from light, the -dark files from dark, icon.svg from either.
Every SVG has a viewBox, is 20 KB or less, and uses only svg, g, path, circle, ellipse, rect, line, polyline, polygon, defs, linearGradient, radialGradient, stop, clipPath, mask, use, symbol, title, desc and style, with colours written as #rrggbb. No <text> or <tspan>: draw every letter as a path, so the logo carries no font. No <image>, foreignObject, script, filter, event handler, or link or url() outside the file.
Then write index.html, the brand sheet: one complete self-contained HTML5 document with inline CSS and no script. It presents this option. Its first screen holds the name, an empty <p data-logo="idea"></p> under it, and the mark large beside an empty <div data-logo="palette"></div>: the host writes the concept's one-line idea and the palette with its reason and measured contrast into those two elements, so leave them empty and give them room. Below come the wordmark, both lockups on a light tile and their -dark twins on a near-black tile, the app icon at its real sizes, and the icon in context (a phone home-screen tile with the name under it, and a browser tab with the favicon and the name). Show every logo file as <img src="logo/NAME.svg" alt="..."> and never paste SVG markup into the page: the host embeds the files, so the sheet always shows the real files. The host draws logo/icon.svg in Chrome as logo/icon-16.png, logo/icon-32.png, logo/icon-48.png, logo/icon-180.png, logo/icon-192.png, logo/icon-512.png and logo/icon-1024.png; show logo/icon-16.png and logo/icon-32.png at their real sizes (<img src="logo/icon-16.png" width="16" height="16" alt="...">) and use the PNGs, not icon.svg, in the home-screen tile and the tab.
done(path="index.html") checks every SVG, the palette, the icon at 16 px (its detail included), its safe zone, each light and dark file on its tile, and the sheet; each error names the file to fix.`;

// In the page: each file parsed as SVG and walked against the allow-list. Returns { name: [finding, ...] }.
export const audit = (files) => {
  const allowed = new Set(['svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'defs', 'lineargradient', 'radialgradient', 'stop', 'clippath', 'mask', 'use', 'symbol', 'title', 'desc', 'style']);
  const hint = { text: 'draw every letter as a path, so the logo carries no font', tspan: 'draw every letter as a path, so the logo carries no font', image: 'draw it with vector shapes', foreignobject: 'draw it with vector shapes', filter: 'a mark must not depend on a filter', script: 'an SVG logo runs no script' };
  const out = {};
  for (const [name, text] of Object.entries(files)) {
    const found = [], doc = new DOMParser().parseFromString(text, 'image/svg+xml'), broken = doc.querySelector('parsererror');
    if (broken) { out[name] = [`it is not well-formed SVG (${broken.textContent.trim().split('\n')[0].slice(0, 160)})`]; continue; }
    const root = doc.documentElement, box = (root.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number);
    if (root.localName !== 'svg' || root.namespaceURI !== 'http://www.w3.org/2000/svg') found.push('its root is not an <svg> element with xmlns="http://www.w3.org/2000/svg"');
    if (box.length !== 4 || box.some((n) => !Number.isFinite(n)) || box[2] <= 0 || box[3] <= 0) found.push('it has no valid viewBox');
    else if (/^(?:mark|icon)/.test(name) && Math.abs(box[2] - box[3]) > 1e-6) found.push(`its viewBox is ${box[2]} by ${box[3]}, not square`);
    for (const el of [root, ...root.querySelectorAll('*')]) {
      const tag = el.localName.toLowerCase();
      if (!allowed.has(tag)) found.push(`<${el.localName}> is not allowed${hint[tag] ? `: ${hint[tag]}` : ''}`);
      for (const { name: attr, value } of el.attributes) {
        if (/^on/i.test(attr)) found.push(`the ${attr} handler on <${el.localName}> is not allowed`);
        else if (/(?:^|:)href$/i.test(attr) && !value.trim().startsWith('#')) found.push(`<${el.localName} ${attr}="${value.slice(0, 60)}"> links outside the file`);
        else if (attr === 'filter') found.push('a filter attribute is not allowed: a mark must not depend on a filter');
      }
    }
    if (/url\(\s*["']?\s*(?!#)/i.test(text)) found.push('it uses url() to something outside the file');
    if (/@import|filter\s*:/i.test(text)) found.push('its style uses @import or a CSS filter');
    out[name] = [...new Set(found)];
  }
  return out;
};

// In the page: icon.svg drawn at every size, the light and dark files on their tiles, and the numbers the checks read.
const draw = async (files, sizes) => {
  const image = async (text) => { const img = new Image(); img.src = `data:image/svg+xml;base64,${btoa(String.fromCharCode(...new TextEncoder().encode(text)))}`; await img.decode(); return img; };
  const canvas = (n, fill) => { const c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d'); if (fill) { x.fillStyle = fill; x.fillRect(0, 0, n, n); } return [c, x]; };
  const lum = (r, g, b) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  // Ink: pixels whose colour is far from the background's (RGB distance over 48 of 441). Contrast: the strongest ink against the background.
  const ink = (d, n, bg, keep = () => true) => {
    let count = 0, area = 0, best = 1;
    const b = lum(...bg);
    for (let i = 0; i < n * n; i++) {
      if (!keep(i % n, Math.floor(i / n))) continue;
      area++;
      const p = [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]];
      if (Math.hypot(p[0] - bg[0], p[1] - bg[1], p[2] - bg[2]) <= 48) continue;
      count++; best = Math.max(best, contrast(lum(...p), b));
    }
    return { share: area ? count / area : 0, contrast: best };
  };
  const icon = await image(files['icon.svg']), pngs = {}, data = {};
  for (const n of sizes) {
    const [c, x] = canvas(n);
    x.drawImage(icon, 0, 0, n, n);
    pngs[n] = c.toDataURL('image/png');
    if (n === 16 || n === 512) data[n] = x.getImageData(0, 0, n, n).data;
  }
  const d = data[512], at = (px, py) => [...d.slice((py * 512 + px) * 4, (py * 512 + px) * 4 + 4)];
  const corners = [at(1, 1), at(510, 1), at(1, 510), at(510, 510)], bg = corners[0].slice(0, 3);
  const fullBleed = corners.every((p) => p[3] === 255 && Math.hypot(p[0] - bg[0], p[1] - bg[1], p[2] - bg[2]) <= 48);
  const outside = ink(d, 512, bg, (px, py) => Math.hypot(px + 0.5 - 256, py + 0.5 - 256) > 0.4 * 512 + 1);
  const small = ink(data[16], 16, [...data[16].slice(0, 3)]);
  const tiles = {};
  for (const [name, text] of Object.entries(files)) {
    if (name === 'icon.svg') continue;
    const dark = name.endsWith('-dark.svg'), tile = dark ? [18, 18, 18] : [255, 255, 255], img = await image(text);
    const box = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement.getAttribute('viewBox').trim().split(/[\s,]+/).map(Number);
    const w = 256, h = Math.max(1, Math.round(256 * box[3] / box[2])), n = Math.max(w, h), [, x] = canvas(n, `rgb(${tile})`);
    x.drawImage(img, 0, 0, w, h);
    const t = ink(x.getImageData(0, 0, n, n).data, n, tile);
    tiles[name] = { tile: dark ? '#121212' : '#ffffff', ink: Math.round(t.share * 1000) / 1000, contrast: Math.round(t.contrast * 10) / 10 };
  }
  return { pngs, icon: { full_bleed: fullBleed, background: `#${bg.map((v) => v.toString(16).padStart(2, '0')).join('')}`, outside_safe_zone: Math.round(outside.share * 10000) / 10000,
    ink_16: Math.round(small.share * 1000) / 1000, contrast_16: Math.round(small.contrast * 10) / 10 }, tiles };
};

// In the page: whether a mark's detail survives at 16 px. The mark is drawn at 512 px and its colours found (each 0.3% of the area or
// more, not an edge's blend of two others); parts are the connected regions of each colour, enclosed counters included, the ground outside the mark excluded. They are
// counted at 512 px (parts of a quarter of a 16 px pixel or more), in a 32 and a 16 px render, and in the 512 px render box-downsampled
// to 16 px. Thin features are regions of the 512 px drawing an opening with a disc one 16 px pixel wide removes (a slot, a hairline, a
// thin tongue), half a 16 px pixel in area or more: detail that is in the drawing but cannot be on a 16 px grid.
export const detail = async (text, ground) => {
  const img = new Image();
  img.src = `data:image/svg+xml;base64,${btoa(String.fromCharCode(...new TextEncoder().encode(text)))}`;
  await img.decode();
  const px = (n) => { const c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d'); if (ground) { x.fillStyle = ground; x.fillRect(0, 0, n, n); } x.drawImage(img, 0, 0, n, n); return x.getImageData(0, 0, n, n).data; };
  const N = 512, big = px(N), bins = new Map(), colours = [];
  for (let i = 0; i < N * N; i++) { const k = (big[i * 4] >> 4) << 8 | (big[i * 4 + 1] >> 4) << 4 | big[i * 4 + 2] >> 4, b = bins.get(k) ?? [0, 0, 0, 0]; for (let j = 0; j < 3; j++) b[j] += big[i * 4 + j]; b[3]++; bins.set(k, b); }
  const far = (d, i, c) => Math.hypot(d[i] - c[0], d[i + 1] - c[1], d[i + 2] - c[2]);
  // An edge's anti-aliasing is a blend of the colours either side: it is a colour of its own only over a real area (3% or more).
  const blend = (c) => colours.some((p) => colours.some((q) => { const d = q.map((v, j) => v - p[j]), t = d.reduce((s, v, j) => s + v * (c[j] - p[j]), 0) / (d.reduce((s, v) => s + v * v, 0) || 1); return t > 0.05 && t < 0.95 && Math.hypot(...p.map((v, j) => v + t * d[j] - c[j])) < 20; }));
  for (const b of [...bins.values()].filter((b) => b[3] >= N * N * 0.003).sort((a, b) => b[3] - a[3])) { const c = b.slice(0, 3).map((v) => v / b[3]); if (!colours.some((p) => far(c, 0, p) < 40) && (b[3] >= N * N * 0.03 || !blend(c))) colours.push(c); }
  const label = (d, n) => Int8Array.from({ length: n * n }, (_, i) => colours.reduce((best, c, k) => far(d, i * 4, c) < far(d, i * 4, colours[best]) ? k : best, 0));
  const near = (x, y, n, eight) => [[1, 0], [-1, 0], [0, 1], [0, -1], ...(eight ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : [])].map(([dx, dy]) => [x + dx, y + dy]).filter(([q, r]) => q >= 0 && r >= 0 && q < n && r < n).map(([q, r]) => r * n + q);
  // Regions of one value (8-connected, or 4-connected for the ground so counters stay apart); keep(size, value, touches the edge).
  const regions = (lab, n, keep) => {
    const seen = new Uint8Array(n * n); let count = 0;
    for (let s = 0; s < n * n; s++) {
      if (seen[s]) continue;
      const stack = [s]; let size = 0, edge = false; seen[s] = 1;
      while (stack.length) { const p = stack.pop(), x = p % n, y = (p - x) / n; size++; edge ||= !x || !y || x === n - 1 || y === n - 1; for (const j of near(x, y, n, lab[s] !== lab[0])) if (!seen[j] && lab[j] === lab[s]) { seen[j] = 1; stack.push(j); } }
      if (keep(size, lab[s], edge)) count++;
    }
    return count;
  };
  const parts = (lab, n, min) => regions(lab, n, (size, v, edge) => size >= min && !(v === lab[0] && edge));
  const down = new Uint8ClampedArray(16 * 16 * 4), s = N / 16;
  for (let i = 0; i < 256; i++) for (let j = 0; j < 3; j++) { let t = 0; for (let v = 0; v < s; v++) for (let u = 0; u < s; u++) t += big[(((i >> 4) * s + v) * N + (i % 16) * s + u) * 4 + j]; down[i * 4 + j] = t / s / s; }
  const at512 = label(big, N), r = N / 32, thin = new Int8Array(N * N);
  const chamfer = (d) => { for (const [from, step, k] of [[0, 1, [[-1, 0, 1], [0, -1, 1], [-1, -1, 1.414], [1, -1, 1.414]]], [N * N - 1, -1, [[1, 0, 1], [0, 1, 1], [1, 1, 1.414], [-1, 1, 1.414]]]]) for (let i = from; i >= 0 && i < N * N; i += step) { const x = i % N, y = (i - x) / N; for (const [dx, dy, w] of k) { const q = x + dx, p = y + dy; if (q >= 0 && p >= 0 && q < N && p < N && d[p * N + q] + w < d[i]) d[i] = d[p * N + q] + w; } } return d; };
  colours.forEach((_, k) => {
    const inside = chamfer(Float32Array.from(at512, (l) => l === k ? 1e9 : 0)), core = chamfer(inside.map((v) => v >= r ? 0 : 1e9));
    for (let i = 0; i < N * N; i++) if (at512[i] === k && core[i] > r) thin[i] = 1;
  });
  return { colours: colours.length, parts_512: parts(at512, N, 256), parts_32: parts(label(px(32), 32), 32, 1), parts_16: parts(label(px(16), 16), 16, 1),
    parts_16_downsampled: parts(label(down, 16), 16, 1), thin_features: regions(thin, N, (size, v) => v === 1 && size >= 512) };
};
// What a detail measure says has died at 16 px, or nothing.
export const detailLost = (d) => [
  ...(Math.min(d.parts_16, d.parts_16_downsampled) < d.parts_512 ? [`${d.parts_512} distinct parts at 512 px but ${Math.min(d.parts_16, d.parts_16_downsampled)} at 16 px (a part, gap or counter merges or vanishes)`] : []),
  ...(d.thin_features ? [`${d.thin_features} feature${d.thin_features > 1 ? 's' : ''} narrower than one 16 px pixel (a slot, cut, hairline or thin tongue) that ${d.thin_features > 1 ? 'are' : 'is'} gone at 16 px`] : []),
].join('; ');

// In the page: one image of marks as a critic looks at them: large, at 32 and 16 px as Chrome draws them, and those two enlarged
// pixel by pixel. rows: [{ label, svg, ground }]. Returns a PNG data URL.
export const board = async (rows) => {
  const cols = [['large', 160, 1], ['32 px', 32, 1], ['16 px', 16, 1], ['16 px, x8', 16, 8], ['32 px, x4', 32, 4]], gap = 20, top = 28, left = 210, H = 160;
  const width = left + cols.reduce((w, [, n, k]) => w + Math.max(n * k, 40) + gap, 0), out = document.createElement('canvas');
  out.width = width; out.height = top + rows.length * (H + gap); const x = out.getContext('2d');
  x.fillStyle = '#d9d6cf'; x.fillRect(0, 0, out.width, out.height); x.fillStyle = '#222'; x.font = '15px sans-serif';
  let cx = left; for (const [name, n, k] of cols) { x.fillText(name, cx, 20); cx += Math.max(n * k, 40) + gap; }
  for (const [i, row] of rows.entries()) {
    const img = new Image(); img.src = `data:image/svg+xml;base64,${btoa(String.fromCharCode(...new TextEncoder().encode(row.svg)))}`; await img.decode();
    const y = top + i * (H + gap); x.fillStyle = '#222'; x.fillText(row.label.slice(0, 24), 10, y + H / 2);
    cx = left;
    for (const [, n, k] of cols) {
      const c = document.createElement('canvas'); c.width = c.height = n; const cc = c.getContext('2d');
      cc.fillStyle = row.ground; cc.fillRect(0, 0, n, n); cc.drawImage(img, 0, 0, n, n);
      x.imageSmoothingEnabled = false; x.drawImage(c, cx, y + (H - n * k) / 2, n * k, n * k); cx += Math.max(n * k, 40) + gap;
    }
  }
  return out.toDataURL('image/png');
};

// In the page: the critic's boards one under the other, as one PNG data URL.
export const stack = async (urls) => {
  const imgs = await Promise.all(urls.map(async (u) => { const img = new Image(); img.src = u; await img.decode(); return img; }));
  const out = document.createElement('canvas'), x = out.getContext('2d');
  out.width = Math.max(...imgs.map((i) => i.width)); out.height = imgs.reduce((h, i) => h + i.height, 0);
  let y = 0; for (const img of imgs) { x.drawImage(img, 0, y); y += img.height; }
  return out.toDataURL('image/png');
};

// The palette's colours against the ground each set is for, and the findings for one that is missing, malformed or under 3:1.
const GROUND = { light: '#ffffff', dark: '#121212' }, ROLES = ['primary', 'accent', 'neutral'];
const luminance = (hex) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => Math.round(((Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05)) * 10) / 10;
const hex6 = (c) => (c.length === 4 ? `#${[...c.slice(1)].map((d) => d + d).join('')}` : c).toLowerCase();
export const readPalette = (text) => {
  let p;
  try { p = JSON.parse(text); } catch (e) { return { problems: [`is not JSON (${e.message})`] }; }
  const problems = [];
  if (typeof p?.reason !== 'string' || !p.reason.trim() || p.reason.length > 240 || /\n/.test(p.reason)) problems.push('needs "reason": one line (240 characters or less) on why these colours fit the brief');
  for (const set of ['light', 'dark']) for (const role of ROLES) {
    const c = p?.[set]?.[role];
    if (typeof c !== 'string' || !/^#[0-9a-f]{6}$/i.test(c)) problems.push(`needs "${set}"."${role}" as #rrggbb`);
    else if (ratio(c, GROUND[set]) < 3) problems.push(`"${set}"."${role}" ${c} is ${ratio(c, GROUND[set])}:1 on ${set === 'light' ? 'white' : 'near-black #121212'}; it needs 3:1 or more`);
  }
  if (problems.length) return { problems };
  const sets = Object.fromEntries(['light', 'dark'].map((set) => [set, Object.fromEntries(ROLES.map((role) => [role, p[set][role].toLowerCase()]))]));
  return { problems, palette: { reason: p.reason.trim(), ...sets, contrast: Object.fromEntries(['light', 'dark'].map((set) => [set, { ground: GROUND[set], ...Object.fromEntries(ROLES.map((role) => [role, ratio(sets[set][role], GROUND[set])])) }])) } };
};

// done's logo findings for the workspace's logo files ({ name: text }, palette.json included), and what passed: the files, the palette,
// the icon PNGs and the check numbers.
export async function checkLogo(files, evaluate, expected) {
  const errors = [], say = (file, message) => errors.push({ source: 'logo', message: `logo/${file}: ${message}. Fix the file, then call done again.` });
  const svgs = {};
  for (const name of FILES) {
    const text = files[name];
    if (text === undefined) say(name, 'is missing; write it with the editor');
    else if (Buffer.byteLength(text) > MAX_BYTES) say(name, `is ${Buffer.byteLength(text)} bytes; a logo file is ${MAX_BYTES} bytes or less, so simplify its paths`);
    else if (name !== 'palette.json') svgs[name] = text;
  }
  if (errors.length) return { errors };
  for (const [name, found] of Object.entries(await evaluate(`(${audit})(${JSON.stringify(svgs)})`))) for (const f of found) say(name, f);
  const { problems, palette } = readPalette(files['palette.json']);
  for (const p of problems) say('palette.json', p);
  // A concept's palette follows its idea and is the host's to set: a changed colour or reason is refused.
  if (palette && expected && ['reason', 'light', 'dark'].some((k) => JSON.stringify(palette[k]) !== JSON.stringify(expected[k]))) say('palette.json', `is not this concept's palette; the host wrote it from the idea and it must stay exactly ${JSON.stringify({ reason: expected.reason, light: expected.light, dark: expected.dark })}`);
  // The files are drawn in the palette's colours: the light files in its light set, the -dark files in its dark set, the icon in either.
  if (palette) for (const [name, text] of Object.entries(svgs)) {
    const sets = name === 'icon.svg' ? ['light', 'dark'] : [name.endsWith('-dark.svg') ? 'dark' : 'light'], allowed = new Set(sets.flatMap((set) => Object.values(palette[set])));
    const off = [...new Set([...text.matchAll(/(?<!(?:href\s*=|url\()\s*["']?\s*)#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/gi)].map(([c]) => hex6(c)))].filter((c) => !allowed.has(c));
    if (off.length) say(name, `uses ${off.join(', ')}, not in palette.json's ${sets.join(' or ')} colours (${[...allowed].join(', ')}); draw with the palette or change it`);
    if (/(?:fill|stroke|stop-color|color)\s*[:=]\s*["']?\s*(?!none\b|transparent\b|currentcolor\b|inherit\b|url\(|#)[a-z(]/i.test(text)) say(name, 'names a colour that is not #rrggbb; write every colour as #rrggbb from palette.json');
  }
  if (errors.length) return { errors };
  const drawn = await evaluate(`(${draw})(${JSON.stringify(svgs)}, ${JSON.stringify(SIZES)})`), { icon, tiles } = drawn;
  // The safe zone and the 16 px numbers are read against the icon's background, so a transparent icon gets only the full-bleed finding.
  if (!icon.full_bleed) say('icon.svg', 'is not full-bleed: its corners are transparent or differ from its background. Paint one flat background over the whole square, with square outer corners');
  else {
    if (icon.outside_safe_zone > 0.005) say('icon.svg', `paints outside the maskable safe zone: ${(icon.outside_safe_zone * 100).toFixed(1)}% of the area outside the central circle (80% of the side) differs from the background. Keep the mark inside that circle`);
    if (icon.ink_16 < 0.06) say('icon.svg', `is almost blank at 16 px: ${Math.round(icon.ink_16 * 256)} of 256 pixels differ from the background. Make the mark larger and bolder`);
    else if (icon.contrast_16 < 3) say('icon.svg', `has too little contrast at 16 px (${icon.contrast_16}:1 against its background, under 3:1). Use a mark colour that stands apart from the background`);
  }
  for (const [name, t] of Object.entries(tiles)) {
    if (t.ink < 0.005 || t.contrast < 3) say(name, `does not read on a ${t.tile === '#ffffff' ? 'white' : 'near-black'} tile (${t.contrast}:1 contrast, ${(t.ink * 100).toFixed(1)}% ink; it needs 3:1). ${name.endsWith('-dark.svg') ? 'A -dark file is for dark backgrounds: use light colours' : 'This file is for light backgrounds: use colours that read on white'}`);
  }
  // The icon is the mark at 16 px, so its detail must survive there; the mark's own numbers are kept for the critic and logo.json.
  const details = { 'icon.svg': await evaluate(`(${detail})(${JSON.stringify(svgs['icon.svg'])}, null)`), 'mark.svg': await evaluate(`(${detail})(${JSON.stringify(svgs['mark.svg'])}, '#ffffff')`) };
  if (icon.full_bleed && detailLost(details['icon.svg'])) say('icon.svg', `loses its detail at 16 px: ${detailLost(details['icon.svg'])}. Make every part, gap, cut and stroke at least 1/16 of the side (6 units on a 96 grid), or drop that detail from the icon and keep the idea`);
  const pngs = Object.fromEntries(Object.entries(drawn.pngs).map(([n, url]) => [n, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')]));
  return { errors, svgs, pngs, palette, files: Object.fromEntries(FILES.map((name) => [name, files[name]])),
    checks: { svg: `${SVGS.length} files on the allow-list, ${MAX_BYTES} bytes or less each`, icon, tiles, detail_16: details } };
}

// The files the sheet shows, as the paths it names: every SVG and icon PNG embedded in place of logo/<name>.
export const logoMedia = ({ svgs, pngs }) => [
  ...Object.entries(svgs).map(([name, text]) => ({ path: `logo/${name}`, dataUrl: `data:image/svg+xml;base64,${Buffer.from(text).toString('base64')}` })),
  ...Object.entries(pngs).map(([n, png]) => ({ path: `logo/icon-${n}.png`, dataUrl: `data:image/png;base64,${png.toString('base64')}` })),
];
// The two empty elements the host writes into: the concept's idea, and the palette with its reason and contrast.
const slot = (name) => new RegExp(`(<([a-z][a-z0-9]*)\\b[^>]*\\sdata-logo\\s*=\\s*["']?${name}["']?(?:\\s[^>]*)?>)\\s*(</\\2\\s*>)`, 'gi');
const SLOTS = ['idea', 'palette'];
// The sheet's findings: a logo file it does not show, a logo/ path that is not one of the files, and a missing or filled slot.
export const sheetErrors = (html, { idea } = {}) => {
  const named = [...html.matchAll(/<img\b[^>]*?\ssrc\s*=\s*["']?\s*(?:\.\/)?(logo\/[^"'\s>]+)/gi)].map((m) => m[1]);
  const files = new Set([...SVGS, ...SIZES.map((n) => `icon-${n}.png`)].map((f) => `logo/${f}`));
  return [...SHOWN.filter((f) => !named.includes(`logo/${f}`)).map((f) => `the brand sheet does not show logo/${f}: add <img src="logo/${f}" alt="..."> to index.html`),
    ...[...new Set(named)].filter((p) => !files.has(p)).map((p) => `the brand sheet names ${p}, which is not a logo file; use only ${[...files].join(', ')}`),
    ...SLOTS.filter((name) => (name !== 'idea' || idea) && [...html.matchAll(slot(name))].length !== 1).map((name) => `the brand sheet needs exactly one empty ${name === 'idea' ? '<p data-logo="idea"></p>' : '<div data-logo="palette"></div>'} (nothing inside it) in its first screen; the host writes the ${name} into it`)]
    .map((message) => ({ source: 'logo', message: `${message}, then call done again.` }));
};
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// The kind of mark, as a small label over the idea on the sheet.
export const KIND_LABELS = { wordmark: 'Wordmark-led', abstract: 'Abstract mark', symbol: 'Symbol', 'negative-space': 'Negative space', letter: 'Lettermark', 'symbol+letter': 'Symbol and letter' };
// The sheet with the host's text in its slots, each between markers so a refine can empty them again.
export const fillSheet = (html, { idea, kind, palette }) => {
  const swatches = (set) => `<div style="background:${palette.contrast[set].ground};color:${set === 'light' ? '#1b1b1a' : '#f2f1ee'};border:1px solid rgba(128,128,128,.35);border-radius:12px;padding:14px;display:grid;gap:10px;min-width:0">
<strong style="font-size:12px;letter-spacing:.06em;text-transform:uppercase">${set === 'light' ? 'Light, on white' : 'Dark, on #121212'}</strong>${ROLES.map((role) => `
<div style="display:flex;align-items:center;gap:10px;min-width:0"><span style="flex:none;width:28px;height:28px;border-radius:6px;background:${palette[set][role]}"></span><span style="min-width:0">${role[0].toUpperCase() + role.slice(1)} ${palette[set][role]}<br><small>${palette.contrast[set][role]}:1 contrast, ${palette.contrast[set][role] >= 3 ? 'passes' : 'fails'} 3:1</small></span></div>`).join('')}</div>`;
  const text = { idea: idea && `${kind ? `<small style="display:block;font-size:12px;letter-spacing:.06em;text-transform:uppercase;opacity:.75">${esc(KIND_LABELS[kind] ?? kind)}</small>` : ''}${esc(idea)}`, palette: palette && `<div style="display:grid;gap:12px;font-size:14px;line-height:1.4;min-width:0"><p style="margin:0">${esc(palette.reason)}</p>
<div style="display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr))">${swatches('light')}${swatches('dark')}</div></div>` };
  return SLOTS.reduce((page, name) => text[name] ? page.replace(slot(name), (_, open, tag, close) => `${open}<!--logo:${name}-->${text[name]}<!--/logo:${name}-->${close}`) : page, html);
};
// A sheet whose mark did not pass the self-critique says so under its idea, with what the critic saw.
export const flagSheet = (html, verdict) => html.replace(/(<!--logo:idea-->[\s\S]*?)(<!--\/logo:idea-->)/, (_, idea, close) => `${idea}<br><strong>Did not pass the self-critique.</strong> A stranger sees "${esc(verdict.reads_as)}"${verdict.flaws.length ? `; ${esc(verdict.flaws.join('; '))}` : ''} (score ${verdict.score} of 10). Shown as the best attempt.${close}`);
// The sheet as the engine wrote it: each embedded logo file named by its logo/ path again, and the slots empty.
export const logoSeed = (html, { svgs, pngs }) => {
  let seed = html.replace(/<!--logo:(\w+)-->[\s\S]*?<!--\/logo:\1-->/g, '');
  for (const m of logoMedia({ svgs, pngs })) seed = seed.split(m.dataUrl).join(m.path);
  return seed;
};

// favicon.ico: the 16, 32 and 48 px PNGs in one icon file (PNG-compressed entries).
const ico = (pngs) => {
  const sizes = [16, 32, 48], head = Buffer.alloc(6 + 16 * sizes.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
  let offset = head.length;
  sizes.forEach((n, i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(n, e); head.writeUInt8(n, e + 1); head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(pngs[n].length, e + 8); head.writeUInt32LE(offset, e + 12);
    offset += pngs[n].length;
  });
  return Buffer.concat([head, ...sizes.map((n) => pngs[n])]);
};

// An option's logo folder: tea-1.html -> tea-1.logo/.
export const logoDir = (file) => file.replace(/\.html?$/i, '') + '.logo';

// The folder beside the sheet: the SVGs, palette.json, the icon PNGs, favicon.ico, logo.json (concept, palette, critique, files, checks)
// and any images the run adds (the concept board and the final critique board, as the critic saw them).
export function writeLogo(file, { pngs, checks, palette, files: written }, about, images = {}) {
  const dir = logoDir(file);
  mkdirSync(dir, { recursive: true });
  const files = {};
  for (const [name, text] of Object.entries(written)) { writeFileSync(`${dir}/${name}`, text); files[name] = { bytes: Buffer.byteLength(text) }; }
  for (const [n, png] of Object.entries(pngs)) { writeFileSync(`${dir}/icon-${n}.png`, png); files[`icon-${n}.png`] = { bytes: png.length, size: Number(n) }; }
  const favicon = ico(pngs);
  writeFileSync(`${dir}/favicon.ico`, favicon); files['favicon.ico'] = { bytes: favicon.length, sizes: [16, 32, 48] };
  for (const [name, png] of Object.entries(images)) { writeFileSync(`${dir}/${name}`, png); files[name] = { bytes: png.length }; }
  const logo = { ...about, sheet: file, palette, files, checks, fonts: 'none: every letter is drawn as a path' };
  writeFileSync(`${dir}/logo.json`, `${JSON.stringify(logo, null, 2)}\n`);
  return { dir, logo };
}

// refine of a logo option: the files from its folder, its concept, and its sheet as the engine wrote it. A folder from before palettes
// has no palette.json; done then asks for one.
export function readLogo(file, html) {
  const dir = logoDir(file);
  if (!existsSync(dir)) return null;
  const files = Object.fromEntries(FILES.filter((name) => name !== 'palette.json' || existsSync(`${dir}/${name}`)).map((name) => [name, readFileSync(`${dir}/${name}`, 'utf8')]));
  const pngs = Object.fromEntries(SIZES.filter((n) => existsSync(`${dir}/icon-${n}.png`)).map((n) => [n, readFileSync(`${dir}/icon-${n}.png`)]));
  const { concept } = existsSync(`${dir}/logo.json`) ? JSON.parse(readFileSync(`${dir}/logo.json`, 'utf8')) : {};
  return { files, concept, idea: concept?.idea, kind: concept?.kind, seed: logoSeed(html, { svgs: Object.fromEntries(SVGS.map((name) => [name, files[name]])), pngs }) };
}
