// Logo mode: an option is a brand sheet (the engine's index.html) and the logo files the engine writes beside it in logo/.
// The host checks every SVG against an allow-list in the machine's Chrome, draws the app icon there at every icon size, refuses
// an icon that is blank or low in contrast at 16 px, paints outside the maskable safe zone or is not full-bleed, and a light or
// dark twin that does not read on its tile. Nothing is silently fixed: each finding goes back to the model through done.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

export const SVGS = [...['mark', 'wordmark', 'lockup-horizontal', 'lockup-stacked'].flatMap((m) => [`${m}.svg`, `${m}-dark.svg`]), 'icon.svg'];
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

export const LOGO_CONTRACT = `Host export contract (first-draft logo mode; overrides the JSX/runtime guidance above): this design is a logo, not an app screen. Load the logo-system skill first and follow it. Write these files with the editor:
- logo/mark.svg: the symbol alone, square viewBox. logo/wordmark.svg: the name alone. logo/lockup-horizontal.svg: the mark beside the name. logo/lockup-stacked.svg: the mark above the name.
- A -dark twin of each for dark backgrounds: logo/mark-dark.svg, logo/wordmark-dark.svg, logo/lockup-horizontal-dark.svg, logo/lockup-stacked-dark.svg (same geometry, colours that read on near-black). The others read on white.
- logo/icon.svg: the app icon. Square viewBox, one flat background colour over the whole square (no transparent corners, no rounded outer corners: the platform masks it), the mark inside the central circle whose diameter is 80% of the side, and still readable at 16 px.
Every SVG has a viewBox, is 20 KB or less, and uses only svg, g, path, circle, ellipse, rect, line, polyline, polygon, defs, linearGradient, radialGradient, stop, clipPath, mask, use, symbol, title, desc and style. No <text> or <tspan>: draw every letter as a path, so the logo carries no font. No <image>, foreignObject, script, filter, event handler, or link or url() outside the file.
Then write index.html, the brand sheet: one complete self-contained HTML5 document with inline CSS and no script. It presents this option: the idea in one or two sentences, the mark large, the wordmark, both lockups on a light tile and their -dark twins on a near-black tile, the app icon at its real sizes, the icon in context (a phone home-screen tile with the name under it, and a browser tab with the favicon and the name), and the palette with hex values. Show every logo file as <img src="logo/NAME.svg" alt="..."> and never paste SVG markup into the page: the host embeds the files, so the sheet always shows the real files. The host draws logo/icon.svg in Chrome as logo/icon-16.png, logo/icon-32.png, logo/icon-48.png, logo/icon-180.png, logo/icon-192.png, logo/icon-512.png and logo/icon-1024.png; show logo/icon-16.png and logo/icon-32.png at their real sizes (<img src="logo/icon-16.png" width="16" height="16" alt="...">) and use the PNGs, not icon.svg, in the home-screen tile and the tab.
done(path="index.html") checks every SVG, the icon at 16 px, its safe zone, each light and dark file on its tile, and the sheet; each error names the file to fix.`;

// In the page: each file parsed as SVG and walked against the allow-list. Returns { name: [finding, ...] }.
const audit = (files) => {
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

// done's logo findings for the workspace's logo files ({ name: text }), and what passed: the files, the icon PNGs and the check numbers.
export async function checkLogo(files, evaluate) {
  const errors = [], say = (file, message) => errors.push({ source: 'logo', message: `logo/${file}: ${message}. Fix the file, then call done again.` });
  const svgs = {};
  for (const name of SVGS) {
    const text = files[name];
    if (text === undefined) say(name, 'is missing; write it with the editor');
    else if (Buffer.byteLength(text) > MAX_BYTES) say(name, `is ${Buffer.byteLength(text)} bytes; a logo file is ${MAX_BYTES} bytes or less, so simplify its paths`);
    else svgs[name] = text;
  }
  if (errors.length) return { errors };
  for (const [name, found] of Object.entries(await evaluate(`(${audit})(${JSON.stringify(svgs)})`))) for (const f of found) say(name, f);
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
  const pngs = Object.fromEntries(Object.entries(drawn.pngs).map(([n, url]) => [n, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')]));
  return { errors, svgs, pngs, checks: { svg: `${SVGS.length} files on the allow-list, ${MAX_BYTES} bytes or less each`, icon, tiles } };
}

// The files the sheet shows, as the paths it names: every SVG and icon PNG embedded in place of logo/<name>.
export const logoMedia = ({ svgs, pngs }) => [
  ...Object.entries(svgs).map(([name, text]) => ({ path: `logo/${name}`, dataUrl: `data:image/svg+xml;base64,${Buffer.from(text).toString('base64')}` })),
  ...Object.entries(pngs).map(([n, png]) => ({ path: `logo/icon-${n}.png`, dataUrl: `data:image/png;base64,${png.toString('base64')}` })),
];
// The sheet's findings: a logo file it does not show, and a logo/ path that is not one of the files.
export const sheetErrors = (html) => {
  const named = [...html.matchAll(/<img\b[^>]*?\ssrc\s*=\s*["']?\s*(?:\.\/)?(logo\/[^"'\s>]+)/gi)].map((m) => m[1]);
  const files = new Set([...SVGS, ...SIZES.map((n) => `icon-${n}.png`)].map((f) => `logo/${f}`));
  return [...SHOWN.filter((f) => !named.includes(`logo/${f}`)).map((f) => `the brand sheet does not show logo/${f}: add <img src="logo/${f}" alt="..."> to index.html`),
    ...[...new Set(named)].filter((p) => !files.has(p)).map((p) => `the brand sheet names ${p}, which is not a logo file; use only ${[...files].join(', ')}`)]
    .map((message) => ({ source: 'logo', message: `${message}, then call done again.` }));
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

// The folder beside the sheet: the SVGs, the icon PNGs, favicon.ico and logo.json (palette, files, checks).
export function writeLogo(file, { svgs, pngs, checks }, about) {
  const dir = logoDir(file);
  mkdirSync(dir, { recursive: true });
  const files = {};
  for (const [name, text] of Object.entries(svgs)) { writeFileSync(`${dir}/${name}`, text); files[name] = { bytes: Buffer.byteLength(text) }; }
  for (const [n, png] of Object.entries(pngs)) { writeFileSync(`${dir}/icon-${n}.png`, png); files[`icon-${n}.png`] = { bytes: png.length, size: Number(n) }; }
  const favicon = ico(pngs);
  writeFileSync(`${dir}/favicon.ico`, favicon); files['favicon.ico'] = { bytes: favicon.length, sizes: [16, 32, 48] };
  const counts = {};
  for (const text of Object.values(svgs)) for (const [c] of text.matchAll(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi)) counts[c.toLowerCase()] = (counts[c.toLowerCase()] ?? 0) + 1;
  const logo = { ...about, sheet: file, palette: Object.keys(counts).sort((a, b) => counts[b] - counts[a]), files, checks, fonts: 'none: every letter is drawn as a path' };
  writeFileSync(`${dir}/logo.json`, `${JSON.stringify(logo, null, 2)}\n`);
  return { dir, logo };
}

// refine of a logo option: the SVGs from its folder, and its sheet with each embedded file named by its logo/ path again.
export function readLogo(file, html) {
  const dir = logoDir(file);
  if (!existsSync(dir)) return null;
  const svgs = Object.fromEntries(SVGS.map((name) => [name, readFileSync(`${dir}/${name}`, 'utf8')]));
  const pngs = Object.fromEntries(SIZES.filter((n) => existsSync(`${dir}/icon-${n}.png`)).map((n) => [n, readFileSync(`${dir}/icon-${n}.png`)]));
  let seed = html;
  for (const m of logoMedia({ svgs, pngs })) seed = seed.split(m.dataUrl).join(m.path);
  return { svgs, seed };
}
