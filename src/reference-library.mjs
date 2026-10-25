// The reference library the independent judge compares designs with (reference-library.json). `refs pull` captures, on this
// machine and read-only, only the entries whose licence explicitly permits it: the licence must still say the recorded quote and
// robots must allow the page. The shots go to a local cache ($FIRST_DRAFT_HOME/refs-library), never into the package; every other
// entry stays notes and a link.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { shootPublic } from './reference-capture.mjs';
import { ReferenceNetwork, referenceUrl } from './reference-network.mjs';
import { Renderer, findBrowser } from './render-check.mjs';

export const KINDS = ['landing', 'app', 'dashboard', 'notes', 'docs', 'onboarding'];
const VIEWS = [{ name: 'desktop', width: 1280, height: 800 }, { name: 'phone', width: 390, height: 844 }];
const NOT_PERMITTED = 'no licence or terms found that explicitly permit automated screenshots, so it is kept as notes and a link';
const sha = (b) => createHash('sha256').update(b).digest('hex');
export const libraryCache = (home) => join(home, 'refs-library');

export function readLibrary(file = new URL('./reference-library.json', import.meta.url)) {
  if (statSync(file).size > 200_000) throw new Error('Reference library exceeds 200 KB');
  const lib = JSON.parse(readFileSync(file, 'utf8')), ids = new Set();
  if (lib.version !== 1 || !Array.isArray(lib.entries)) throw new Error('a reference library is {"version": 1, "entries": [...]}');
  for (const e of lib.entries) {
    const bad = (why) => { throw new Error(`reference library entry ${e.id ?? '?'}: ${why}`); };
    if (!/^[a-z0-9-]{1,60}$/.test(e.id ?? '') || ids.has(e.id)) bad('id must be unique lowercase-dashed text');
    ids.add(e.id);
    if (!KINDS.includes(e.kind)) bad(`kind must be one of ${KINDS.join(', ')}`);
    if (typeof e.name !== 'string' || typeof e.notes !== 'string' || !e.notes.trim()) bad('needs a name and notes');
    // A local entry is a reference the owner supplies as an image (their own screenshot): there is no public page to capture or licence.
    if (e.local ? typeof e.why !== 'string' || !e.why.trim() : false) bad('a local entry needs why it is never captured');
    if (!e.local) referenceUrl(e.url);
    if (e.permission) {
      const { licence, url, quote, basis } = e.permission;
      if (![licence, quote, basis].every((s) => typeof s === 'string' && s.trim()) || quote.length < 12) bad('permission needs licence, url, a quote of 12+ characters and basis');
      referenceUrl(url);
      if (!e.themes || !Object.keys(e.themes).length || Object.keys(e.themes).some((t) => !['light', 'dark'].includes(t))) bad('a captured entry names its themes, light and/or dark');
      if (e.assets && (!Array.isArray(e.assets) || e.assets.some((o) => referenceUrl(o).origin !== o))) bad('assets lists the other origins its styles, fonts and images come from, as https://host');
      if (e.from !== undefined && (typeof e.from !== 'string' || !e.from.trim())) bad('from is a CSS selector to scroll to');
    }
  }
  return lib;
}

// The words of a page as plain text, for finding a licence's quote in it.
const words = (data) => data.toString('utf8').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');

export async function pullLibrary({ home, library, kind }) {
  const lib = readLibrary(library ? resolve(library) : undefined), bin = findBrowser();
  if (!bin) throw new Error('refs pull needs Chrome or Chromium to capture references; nothing was pulled');
  const dir = libraryCache(home), at = new Date().toISOString(), rows = [];
  for (const e of lib.entries.filter((x) => !kind || x.kind === kind)) {
    const row = { id: e.id, kind: e.kind, name: e.name, ...(!e.local && { url: e.url }), notes: e.notes };
    if (e.local) { rows.push({ ...row, captured: false, why: e.why }); continue; }
    if (!e.permission) { rows.push({ ...row, captured: false, why: e.why ?? NOT_PERMITTED }); continue; }
    const network = new ReferenceNetwork({ requests: 160, bytes: 30_000_000, queries: true }), renderer = new Renderer(bin, () => {}, false);
    let timer;
    try {
      const work = (async () => {
        const licence = await network.get(e.permission.url);
        if (!words(licence.data).includes(e.permission.quote)) throw new Error(`the licence at ${e.permission.url} no longer says "${e.permission.quote}", so permission is unclear`);
        const page = await network.get(e.url);
        if (!/^text\/html\b/i.test(page.type) || page.url !== referenceUrl(e.url).href) throw new Error(`${e.url} is not the public HTML page the library names (it redirected or is not HTML)`);
        const views = Object.entries(e.themes).flatMap(([theme, attrs]) => VIEWS.map((v) => ({ ...v, theme, scheme: theme, attrs })));
        const shot = await shootPublic({ page, network, renderer, views, loadMs: 120_000, assets: e.assets, from: e.from });
        const lost = ['Stylesheet', 'Font', 'Image'].filter((t) => shot.blocked.has(t));
        if (lost.length) throw new Error(`its ${lost.join(', ').toLowerCase()} requests went to an origin the library does not name, so the shot would not show the page as it is`);
        return { views, ...shot };
      })();
      const { views, shots } = await Promise.race([work, new Promise((_, no) => { timer = setTimeout(() => no(new Error('capture took over 3 minutes')), 180_000); })]);
      mkdirSync(join(dir, e.id), { recursive: true });
      rows.push({ ...row, captured: true, captured_at: at, licence: e.permission, sources: network.sources, robots: [...network.robots.keys()].map((origin) => `${origin}/robots.txt`), shots: views.map((v, i) => {
        const file = `${e.id}/${v.name}-${v.theme}.png`;
        writeFileSync(join(dir, file), shots[i]);
        return { file, width: v.width, height: v.height, theme: v.theme, sha256: sha(shots[i]) };
      }) });
    } catch (err) { rows.push({ ...row, captured: false, why: `not captured: ${err.message}` }); }
    finally { clearTimeout(timer); network.close(); renderer.close(); }
  }
  let kept = [];
  if (kind) try { kept = JSON.parse(readFileSync(join(dir, 'library.json'), 'utf8')).entries.filter((r) => r.kind !== kind); } catch (err) { if (err.code !== 'ENOENT') throw err; }
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'library.json'), `${JSON.stringify({ version: 1, pulled_at: at, policy: lib.policy, entries: [...kept, ...rows] }, null, 2)}\n`);
  return { cache: dir, entries: rows };
}

// At most two captured products of exactly the same kind, in one theme each (light where available), with complete viewport pairs.
export function referencesFor(home, kind) {
  const dir = libraryCache(home);
  let lib;
  try { lib = JSON.parse(readFileSync(join(dir, 'library.json'), 'utf8')); } catch (e) {
    if (e.code === 'ENOENT') return { pulled: false, images: [], shown: [], notes: [] };
    throw e;
  }
  const rows = lib.entries.filter((r) => r.kind === kind);
  const shown = rows.filter((r) => r.captured).slice(0, 2), images = [];
  for (const r of shown) {
    const theme = r.shots.some((s) => s.theme === 'light') ? 'light' : r.shots[0]?.theme;
    const pair = r.shots.filter((s) => s.theme === theme).sort((a, b) => b.width - a.width);
    if (pair.length !== 2 || !VIEWS.every((v, i) => pair[i].width === v.width && pair[i].height === v.height)) throw new Error('Reference needs desktop 1280 and phone 390 captures');
    for (const s of pair) {
      if (!/^[a-z0-9-]+\/(desktop|phone)-(light|dark)\.png$/.test(s.file) || s.file.split('/')[0] !== r.id || statSync(join(dir, s.file)).size > 2_000_000) throw new Error('Invalid cached reference path or size');
      const png = readFileSync(join(dir, s.file));
      if (sha(png) !== s.sha256) throw new Error(`the cached reference ${s.file} changed since it was captured; run first-draft-axi refs pull again`);
      images.push({ id: `reference-${images.length + 1}`, mime: 'image/png', dataUrl: `data:image/png;base64,${png.toString('base64')}`, label: `${r.name}, ${s.width === 1280 ? 'desktop 1280' : 'phone 390'}, ${theme}` });
    }
  }
  return { pulled: true, images, shown: shown.map((r) => ({ name: r.name, kind: r.kind, url: r.url, captured_at: r.captured_at, licence: r.licence.licence, notes: r.notes, capture_policy: 'Anonymous GETs; scripts, cookies and interactions disabled; viewport only' })),
    notes: rows.filter((r) => !shown.includes(r)).map((r) => ({ name: r.name, url: r.url, notes: r.notes, why: r.why ?? 'not selected for this comparison' })) };
}
