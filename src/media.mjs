// The project's own screenshots and recordings, for the hero visual of a landing page: found in
// the README text and in the usual folders, offered to the model by path, and embedded as data:
// URIs (the page loads nothing from the network). Nothing is invented: no file, no listing.
// They are the project's own only when the brief is about the project in the working folder:
// the folder you run in says nothing about the product a prompt describes.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, relative, resolve } from 'node:path';

const TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.mp4': 'video/mp4', '.webm': 'video/webm' };
const FOLDERS = ['docs', 'doc', 'assets', 'screenshots', 'media', 'images', 'img'];
const NOT_PRODUCT = /favicon|icon|logo|social|badge|avatar|banner/i; // marks of the project, not views of it
const MAX_FILE = 800_000, MAX_TOTAL = 2_500_000, MAX_COUNT = 6; // the page stays well under the 5 MB mock limit

const isVideo = (path) => TYPES[extname(path).toLowerCase()]?.startsWith('video/');

// Paths the text points at: markdown images, <img>/<video>/<source> src, and plain relative paths.
const mentioned = (text) => [...text.matchAll(/(?:\]\(|src\s*=\s*["']?|["'(\s])([^\s"'()<>]+\.(?:png|jpe?g|webp|gif|mp4|webm))\b/gi)].map((m) => m[1]).filter((p) => !/^(?:[a-z]+:)?\/\//i.test(p));

const walk = (dir, depth = 0) => {
  if (depth > 3) return [];
  let names;
  try { names = readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  return names.flatMap((e) => e.isDirectory() ? (e.name === 'node_modules' || e.name.startsWith('.') ? [] : walk(join(dir, e.name), depth + 1)) : [join(dir, e.name)]);
};

// Is the brief about the project in this folder? Yes when it carries that project's README, or names the project (the package name or the README's title).
const aboutThisProject = (text, root) => {
  const readme = readdirSync(root).filter((n) => /^readme(\.\w+)?$/i.test(n)).map((n) => readFileSync(join(root, n), 'utf8'))[0] ?? '';
  const flat = (t) => t.replace(/\s+/g, ' ').trim().toLowerCase();
  let pkg = ''; try { pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).name ?? ''; } catch { /* no package.json */ }
  const title = readme.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1] ?? readme.match(/^#\s+(.+)$/m)?.[1] ?? '';
  const names = [pkg.replace(/^@[^/]+\//, ''), title].map((n) => n.trim()).filter((n) => n.length >= 4);
  const brief = flat(text);
  return (readme.trim() && brief.includes(flat(readme).slice(0, 200))) || names.some((n) => new RegExp(`(?<![\\w-])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`, 'i').test(text));
};

// The files to offer, README-mentioned first: [{ path (relative, forward slashes), mime, bytes, video }].
export const projectMedia = (text = '', cwd = process.cwd()) => {
  const root = resolve(cwd);
  if (!aboutThisProject(text, root)) return [];
  const found = [...mentioned(text).map((p) => resolve(root, p.replace(/^\//, ''))), ...FOLDERS.flatMap((f) => walk(join(root, f)))];
  const seen = new Set(), media = [];
  let total = 0;
  for (const file of found) {
    const rel = relative(root, file).split('\\').join('/');
    const mime = TYPES[extname(file).toLowerCase()];
    if (!mime || rel.startsWith('..') || seen.has(rel) || NOT_PRODUCT.test(rel) || !existsSync(file)) continue;
    const bytes = statSync(file).size;
    if (!bytes || bytes > MAX_FILE || total + bytes > MAX_TOTAL) continue;
    seen.add(rel);
    total += bytes;
    media.push({ path: rel, mime, bytes, video: isVideo(file) });
    if (media.length === MAX_COUNT) break;
  }
  return media;
};

// What the model is told. With no media it is told to typeset the visual, and not to invent one.
export const mediaBrief = (media) => media.length
  ? `Hero visual: this project has real product screenshots or recordings. ${media.map((m) => m.path).join(', ')}. Use the one that shows the product best as the hero visual (and another further down if it helps): <img src="THE EXACT PATH" alt="what it shows"> with max-width:100%; height:auto and the page's radius and border, or for a recording <video src="THE EXACT PATH" muted loop autoplay playsinline>. Write the path exactly as listed: the host embeds the file, so no other path, URL or filename works. Use only these files and draw no product screenshot of your own.`
  : 'Hero visual: this project has no screenshot or recording, so make the hero visual typeset (a command, a result or a short snippet in the page\'s own type and colours). Do not reference or invent any image file.';

// The page with each listed path replaced by the file itself.
export const embedMedia = (html, media, cwd = process.cwd()) => media.length ? html.replace(/(\b(?:src|poster)\s*=\s*)(["'])([^"']*)\2/gi, (all, attr, q, value) => {
  const hit = media.find((m) => m.path === normalize(value.trim()).split('\\').join('/'));
  return hit ? `${attr}${q}${hit.dataUrl ?? `data:${hit.mime};base64,${readFileSync(resolve(cwd, hit.path)).toString('base64')}`}${q}` : all;
}) : html;
