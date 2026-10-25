// Render the whole file and each screen independently at 390x844 and 1280x800, in light/dark.
// Each must fit, remain visible and have both themes (or be dark for a named dark-first style).
// The browser is the one already on the machine: no
// dependency is added and no browser is bundled. With no browser the check is skipped, never
// failed. The same browser draws the engine's source (App.jsx and its runtime) once, and the
// page it drew is kept as static HTML: that snapshot is what the check and the board see.
import { spawn } from 'node:child_process';
import { accessSync, constants, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clarityPage } from './clarity.mjs';
import { CARD_RUN, HUES, TITLE_WORDS, humanSidePage } from './human-side.mjs';

const VIEWPORTS = [[390, 844], [1280, 800]];
const DARK_BELOW = 0.18; // a page background lighter than this (0 black, 1 white) is a light page
const NAMES = ['google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser', 'chrome', 'chromium-headless-shell', 'headless-shell'];
const SPOTS = ['/opt/google/chrome/chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/lib/chromium/chromium', '/snap/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];

// The browser already on this machine. FIRST_DRAFT_CHROME names the one to use; when it names a
// non-executable path, this machine has no browser. Browser config directories are not candidates.
export const findBrowser = () => {
  const executable = (p) => { try { accessSync(p, constants.X_OK); return statSync(p).isFile(); } catch { return false; } };
  const given = process.env.FIRST_DRAFT_CHROME;
  if (given) return executable(given) ? given : null;
  for (const dir of (process.env.PATH ?? '').split(':')) for (const name of NAMES) { const p = join(dir, name); if (executable(p)) return p; }
  for (const p of SPOTS) if (executable(p)) return p;
  return null;
};

// One DevTools connection: a command in, an answer or an event out.
const connect = async (url) => {
  const ws = new WebSocket(url);
  await new Promise((ok, no) => {
    ws.addEventListener('open', ok, { once: true });
    ws.addEventListener('error', () => no(new Error('the browser refused the connection')), { once: true });
  });
  let id = 0;
  const open = new Map(), events = new Map(), listeners = new Map();
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id !== undefined) {
      const call = open.get(msg.id);
      if (!call) return;
      open.delete(msg.id);
      msg.error ? call.no(new Error(msg.error.message)) : call.ok(msg.result);
      return;
    }
    for (const fn of listeners.get(msg.method) ?? []) fn(msg.params);
    const wait = events.get(msg.method);
    if (wait) { events.delete(msg.method); wait(msg.params); }
  });
  const on = (method, fn) => {
    if (!listeners.has(method)) listeners.set(method, new Set());
    listeners.get(method).add(fn);
    return () => listeners.get(method).delete(fn);
  };
  const send = (method, params = {}) => new Promise((ok, no) => { const i = ++id; open.set(i, { ok, no }); ws.send(JSON.stringify({ id: i, method, params })); });
  const once = (method, ms = 30000) => new Promise((ok, no) => {
    const t = setTimeout(() => { events.delete(method); no(new Error(`the browser never sent ${method}`)); }, ms);
    events.set(method, (p) => { clearTimeout(t); ok(p); });
  });
  return { send, once, on, close: () => ws.close() };
};

// Measure against the actual viewport, not a fixed phone width.
const measurePage = (strict = false) => {
  const vw = innerWidth;
  const clipped = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX;
      if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return true;
    }
    return false;
  };
  const off = [];
  for (const el of document.querySelectorAll('*')) {
    const s = getComputedStyle(el);
    if (s.position === 'fixed' || s.display === 'none' || s.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    const right = /^(auto|scroll|hidden|clip)$/.test(s.overflowX) ? r.right : Math.max(r.right, r.left + el.scrollWidth); // a box that scrolls or clips its own content only counts as wide as itself
    if (right > vw + 0.5 && !clipped(el)) off.push({ el, tag: el.tagName.toLowerCase(), id: el.id || '', cls: typeof el.className === 'string' ? el.className.split(/\s+/).filter(Boolean).slice(0, 3).join(' ') : '', right: Math.round(right), width: Math.round(r.width), root: el.tagName === 'HTML' || el.tagName === 'BODY', depth: (() => { let n = 0; for (let p = el; p; p = p.parentElement) n++; return n; })() });
  }
  off.sort((a, b) => b.right - a.right || b.depth - a.depth); // the widest, and of equal width the innermost: that is the one to fix
  const d = document.documentElement;
  const inner = off.filter((o) => !o.root);
  const plain = ({ tag, id, cls, right }) => ({ tag, id, cls, right });
  // The sources of the overflow: wide elements with no wide element inside them.
  const causes = inner.filter((o) => !inner.some((p) => p !== o && o.el.contains(p.el))).slice(0, 3).map(plain);
  const textClipped=[];
  if(strict) {
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    while(walker.nextNode() && textClipped.length<3) {
      const node=walker.currentNode, e=node.parentElement;
      if(!node.textContent.trim() || !(e instanceof HTMLElement) || !e.getClientRects().length || getComputedStyle(e).visibility==='hidden')continue;
      const range=document.createRange();range.selectNodeContents(node);
      for(let p=e;p;p=p.parentElement) {
        const s=getComputedStyle(p),box=p.getBoundingClientRect(),left=box.left+p.clientLeft,top=box.top+p.clientTop;
        if(!p.clientWidth || !p.clientHeight)continue; // Inline boxes do not establish overflow clipping.
        if([...range.getClientRects()].some(r=>(/^(hidden|clip)$/.test(s.overflowX)&&(r.left<left-2||r.right>left+p.clientWidth+2))||(/^(hidden|clip)$/.test(s.overflowY)&&(r.top<top-2||r.bottom>top+p.clientHeight+2)))) {textClipped.push(`${e.tagName.toLowerCase()} ${JSON.stringify(node.textContent.trim().slice(0,80))}`);break;}
      }
    }
  }
  return { scrollWidth: Math.max(d.scrollWidth, document.body ? document.body.scrollWidth : 0), count: inner.length || off.length, worst: plain(inner[0] ?? off[0] ?? { tag: '', id: '', cls: '', right: 0 }), causes, textClipped };
};

// How light the page's own background is, 0 (black) to 1 (white): the body's, else the root's, else the browser's white.
const pageLightness = () => {
  const rgba = (el) => {
    const v = getComputedStyle(el).backgroundColor, n = (v.match(/[\d.]+/g) ?? []).map(Number), k = v.startsWith('color(') ? 255 : 1;
    return [n[0] * k, n[1] * k, n[2] * k, n.length > 3 ? n[3] : 1];
  };
  const c = [rgba(document.body), rgba(document.documentElement)].find((x) => x[3] > 0.5) ?? [255, 255, 255, 1];
  const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};

// What the page paints: every element's colours and box, hashed.
const paintSignature = () => {
  let h = 2166136261;
  const eat = (s) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } };
  for (const el of document.querySelectorAll('*')) {
    const s = getComputedStyle(el);
    if (!el.getClientRects().length || s.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    eat([el.tagName, el.id, typeof el.className === 'string' ? el.className : '', s.color, s.backgroundColor, s.borderTopColor, s.borderRightColor, s.borderBottomColor, s.borderLeftColor, s.backgroundImage, Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)].join(' '));
  }
  eat(getComputedStyle(document.documentElement).backgroundColor);
  return (h >>> 0).toString(16);
};

// The source's page while it renders: inline script, Babel's eval and the one script host upstream's output rules allow (cdnjs, exact versions); nothing else loads, so what it draws comes from the file.
const DRAW_POLICY = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:" />`;

// Wait until the source has drawn: React has mounted into #root (or there is no #root), fonts are in, and the effects, timers and chart animations that set the first state have run.
const drawn = async () => {
  const root = document.getElementById('root');
  for (let i = 0; i < 50 && root && !root.firstElementChild; i++) await new Promise((r) => setTimeout(r, 100));
  await document.fonts.ready;
  await new Promise((r) => setTimeout(r, 1500));
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  return Boolean(!root || root.firstElementChild);
};

// The page as drawn, as static HTML: form values and canvases kept as markup, every script, handler, javascript: URL, base and policy tag removed.
const staticPage = () => {
  for (const el of document.querySelectorAll('input, textarea, select')) {
    if (el.type === 'checkbox' || el.type === 'radio') el.toggleAttribute('checked', el.checked);
    else if (el.tagName === 'TEXTAREA') el.textContent = el.value;
    else if (el.tagName === 'SELECT') for (const o of el.options) o.toggleAttribute('selected', o.selected);
    else if (el.type !== 'password' && el.type !== 'file') el.setAttribute('value', el.value);
  }
  for (const canvas of document.querySelectorAll('canvas')) {
    const img = document.createElement('img');
    for (const a of canvas.attributes) img.setAttribute(a.name, a.value);
    try { img.src = canvas.toDataURL(); } catch { continue; }
    img.alt = canvas.getAttribute('aria-label') ?? '';
    canvas.replaceWith(img);
  }
  const page = document.documentElement.cloneNode(true);
  for (const el of page.querySelectorAll('script, noscript, base, meta[http-equiv]')) el.remove();
  const comments = document.createTreeWalker(page, NodeFilter.SHOW_COMMENT), gone = [];
  while (comments.nextNode()) gone.push(comments.currentNode);
  for (const c of gone) c.remove();
  for (const el of [page, ...page.querySelectorAll('*')]) for (const { name, value } of [...el.attributes]) {
    if (/^on/i.test(name) || (/^(?:href|src|action|formaction|xlink:href|poster)$/i.test(name) && /^\s*javascript:/i.test(value))) el.removeAttribute(name);
  }
  return `<!doctype html>\n${page.outerHTML}`;
};

// Text the eye cannot read because a fixed or sticky bar is painted over it in the first viewport.
const coveredText = () => {
  const bars=[...document.querySelectorAll('*')].filter(e=>/^(fixed|sticky)$/.test(getComputedStyle(e).position)&&e.getClientRects().length),covered=[];
  if(!bars.length)return covered;
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  while(walker.nextNode() && covered.length<3) {
    const node=walker.currentNode,e=node.parentElement;
    if(!node.textContent.trim() || !(e instanceof HTMLElement) || getComputedStyle(e).visibility==='hidden')continue;
    const range=document.createRange();range.selectNodeContents(node);
    for(const r of range.getClientRects()) {
      const x=r.left+r.width/2,y=r.top+r.height/2;
      if(!r.width || x<0 || y<0 || x>innerWidth || y>innerHeight)continue;
      let shown=true;for(let p=e.parentElement;p&&shown;p=p.parentElement){const s=getComputedStyle(p),b=p.getBoundingClientRect();if(s.overflow!=='visible'&&(x<b.left||x>b.right||y<b.top||y>b.bottom))shown=false;} // scrolled out of its own box
      const hit=shown&&document.elementFromPoint(x,y);
      const bar=hit && !e.contains(hit) && bars.find(b=>b.contains(hit)&&!b.contains(e));
      if(bar) {covered.push(`${e.tagName.toLowerCase()} ${JSON.stringify(node.textContent.trim().slice(0,80))} under <${bar.tagName.toLowerCase()}${bar.id?` id="${bar.id}"`:''}${typeof bar.className==='string'&&bar.className?` class="${bar.className}"`:''}> (position:${getComputedStyle(bar).position})`);break;}
    }
  }
  return covered;
};
// A close control that is on screen with nothing open: a drawer's or dialog's close button shown beside the page (a stray x). A close
// inside a dialog, alert, banner, toast, chip or the like is the thing's own and not counted.
const strayClose = () => {
  const out = [];
  for (const e of document.querySelectorAll('button,a,[role=button]')) {
    const text = e.textContent.trim(), cls = typeof e.className === 'string' ? e.className : '';
    if (!/\b(close|dismiss)\b|[×✕✖]/i.test([e.getAttribute('aria-label'), e.title, e.id, cls, text.length <= 2 ? text : ''].join(' '))) continue;
    const r = e.getBoundingClientRect(), s = getComputedStyle(e);
    if (!r.width || !r.height || s.visibility === 'hidden' || s.opacity === '0' || r.right <= 0 || r.left >= innerWidth || r.bottom <= 0 || r.top >= innerHeight) continue;
    if (e.closest('dialog[open],[role=dialog],[role=alertdialog],[role=alert],[role=status],[aria-modal=true],[class*=modal],[class*=dialog],[class*=toast],[class*=banner],[class*=alert],[class*=notice],[class*=popover],[class*=snackbar],[class*=chip],[class*=tag],[class*=pill],[class*=badge],[class*=callout]')) continue;
    out.push(`<${e.tagName.toLowerCase()}${e.id ? ` id="${e.id}"` : ''}${cls ? ` class="${cls}"` : ''}>`);
    if (out.length === 2) break;
  }
  return out;
};
// Text on screen that cannot be read: its colour against the box behind it (the nearest ancestor with a solid background; a gradient or
// picture behind it is not judged) under 2.5:1, like an active tab painted in its own colour.
const unreadable = () => {
  const rgba = (c) => { const m = c.match(/[\d.]+/g)?.map(Number); return m ? { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 } : null; };
  const lum = ({ r, g, b }) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((t, v, i) => t + v * [0.2126, 0.7152, 0.0722][i], 0);
  const out = [], seen = new Set(), walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode() && out.length < 3) {
    const node = walker.currentNode, e = node.parentElement;
    if (!node.textContent.trim() || !(e instanceof HTMLElement) || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(e.tagName)) continue;
    const s = getComputedStyle(e), range = document.createRange();
    range.selectNodeContents(node);
    const r = range.getBoundingClientRect();
    if (!r.width || !r.height || s.visibility === 'hidden' || Number(s.opacity) < 0.5 || r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) continue;
    const fg = rgba(s.color);
    let bg = null, picture = false;
    for (let p = e; p && !bg; p = p.parentElement) { const ps = getComputedStyle(p); if (ps.backgroundImage !== 'none') { picture = true; break; } const c = rgba(ps.backgroundColor); if (c && c.a > 0.9) bg = c; }
    if (picture || !fg || fg.a < 0.5) continue;
    bg ??= { r: 255, g: 255, b: 255, a: 1 };
    const l1 = lum(fg), l2 = lum(bg), ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const key = `${node.textContent.trim().slice(0, 40)}|${s.color}|${bg.r},${bg.g},${bg.b}`;
    if (ratio < 2.5 && !seen.has(key) && seen.add(key)) out.push(`${JSON.stringify(node.textContent.trim().slice(0, 40))} in <${e.tagName.toLowerCase()}${typeof e.className === 'string' && e.className ? ` class="${e.className}"` : ''}> is ${s.color} on ${`rgb(${bg.r}, ${bg.g}, ${bg.b})`} (${ratio.toFixed(1)}:1)`);
  }
  return out;
};
// A flow screen's scene belongs to the page it sits on: it runs to the screen's own edges, or its edge fades into that ground with a
// mask. The pasted-on look is the finding: a border, an outline, a frame or mat behind it, a drop shadow, or an oval or rounded clip (a
// scene's own ground cut to a shape reads as a rim); so is an inset picture that neither bleeds nor fades, and a scene left at thumbnail
// size beside the flow's other screens. A repeated row of same-size pictures is a set of icons, not the screen's scene.
const flowScene = () => {
  const out = [];
  const shown = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).opacity !== '0';
  const rgba = (c) => { const m = (c || '').match(/[\d.]+/g)?.map(Number); return m && m.length >= 3 ? { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 } : null; };
  const solid = (el) => { const c = rgba(getComputedStyle(el).backgroundColor); return c && c.a >= 0.5 ? c : null; };
  const differs = (a, b) => !a || !b || Math.abs(a.r - b.r) > 8 || Math.abs(a.g - b.g) > 8 || Math.abs(a.b - b.b) > 8;
  const bordered = (s) => ['Top', 'Right', 'Bottom', 'Left'].some((k) => (parseFloat(s[`border${k}Width`]) || 0) > 0 && s[`border${k}Style`] !== 'none');
  const fades = (s) => [s.maskImage, s.webkitMaskImage].some((v) => v && v !== 'none' && /gradient/.test(v));
  const label = (el) => `<${el.tagName.toLowerCase()}${typeof el.className === 'string' && el.className.split(/\s+/).filter(Boolean)[0] ? ` class="${el.className.split(/\s+/).filter(Boolean)[0]}"` : ''}>`;
  const frames = [...document.querySelectorAll('[data-oc-screen]')].filter((e) => shown(e) && e.getBoundingClientRect().width > 0).map((screen) => {
    const pictures = [...screen.querySelectorAll('img, figure')].filter((e) => shown(e) && !e.querySelector('img, figure') && e.getBoundingClientRect().width > 16);
    const alike = (w) => pictures.filter((e) => Math.abs(e.getBoundingClientRect().width - w) <= w * 0.25).length >= 3;
    const scene = pictures.filter((e) => !alike(e.getBoundingClientRect().width)).sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0] ?? null;
    return { id: screen.id || screen.getAttribute('data-oc-screen') || '', screen, scene };
  }).filter((f) => f.id);
  if (frames.length < 2) return out;
  const widest = Math.max(0, ...frames.map((f) => f.scene ? f.scene.getBoundingClientRect().width : 0));
  for (const { id, screen, scene } of frames) {
    if (!scene) continue;
    const r = scene.getBoundingClientRect(), b = screen.getBoundingClientRect(), s = getComputedStyle(scene), where = `screen "${id}": ${label(scene)}`;
    const rims = [];
    if (r.width < widest * 0.55) out.push(`${where} is a thumbnail beside the flow's other scenes; give the scene the size the other screens give theirs, or drop the illustration on this screen entirely`);
    else if (fades(s) || fades(getComputedStyle(scene.parentElement ?? scene))) continue; // the edge fades into the ground: part of the page
    else {
      if (bordered(s)) rims.push('a border');
      if (s.outlineStyle !== 'none' && (parseFloat(s.outlineWidth) || 0) > 0) rims.push('an outline');
      if (s.boxShadow !== 'none') rims.push('a drop shadow');
      if (s.clipPath !== 'none' || s.webkitClipPath !== 'none') rims.push('a clip-path');
      if (Math.max(...['TopLeft', 'TopRight', 'BottomLeft', 'BottomRight'].map((k) => parseFloat(s[`border${k}Radius`]) || 0)) > 0) rims.push(`a rounded or oval clip (border-radius ${s.borderTopLeftRadius})`);
      const ground = (() => { for (let e = screen.parentElement ?? screen; e; e = e.parentElement) { const c = solid(e); if (c) return c; } return { r: 255, g: 255, b: 255, a: 1 }; })();
      for (let p = scene.parentElement; p && p !== screen; p = p.parentElement) {
        const ps = getComputedStyle(p), pr = p.getBoundingClientRect();
        if (pr.width > r.width + 80 || pr.height > r.height + 80) continue; // a section, not a frame hugging the picture
        if (bordered(ps)) { rims.push(`a frame ${label(p)} round it`); break; }
        const painted = solid(p);
        if (painted && differs(painted, ground)) { rims.push(`a mat ${label(p)} behind it`); break; }
      }
      if (rims.length) out.push(`${where} cuts the scene's edge with ${rims.join(', ')}`);
      else if (r.left > b.left + 1 || r.right < b.right - 1) out.push(`${where} is inset with a cut edge (it neither reaches the screen's edges nor fades into the ground)`);
    }
  }
  return out;
};
// The flow's shell also has to say the same kind of thing on every screen without saying the same words: each screen's small label
// above its title names that screen's own step, and the last screen ends on one action, its closing button, instead of that button
// beside the round next button. Only the flow-wide cases are findings: one label repeated on every screen, two actions at the end, and
// a screen that outgrows the screen it is shown on (the owner's option screens ran 80-110px past 390, so the dots and the round next
// button fell below the fold and the last option was sliced).
const flowShell = () => {
  const out = [];
  const shown = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).opacity !== '0';
  const text = (el) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const screens = [...document.querySelectorAll('[data-oc-screen]')].filter((e) => shown(e) && e.getBoundingClientRect().width > 0);
  if (screens.length < 3) return out;
  const labels = screens.map((screen) => {
    const title = [...screen.querySelectorAll('h1, h2, h3')].find(shown);
    for (let e = title?.previousElementSibling; e; e = e.previousElementSibling) if (shown(e) && text(e) && !e.querySelector('a, button, img, svg, [role=button]')) return text(e);
    return null;
  });
  // The owner's repeated eyebrow kept its words and only changed its number ("01 / A moment for you" on all six), so the count in
  // front of a label is not what makes it that screen's own step.
  const words = (t) => t.toLowerCase().replace(/^[^\p{L}]*/u, '').replace(/^(step|stage|part)\s*[\divx]+\s*[.:/\u2013\u2014-]*\s*/u, '').trim();
  if (labels.every(Boolean)) {
    const keys = new Set(labels.map(words));
    if (keys.size === 1 && [...keys][0]) out.push(`every screen repeats the same label above its title ("${labels[0]}"); give each screen its own short step label, in the same style and place`);
  }
  const last = screens.at(-1), id = last.id || last.getAttribute('data-oc-screen') || '';
  for (const screen of screens) {
    const r = screen.getBoundingClientRect(), room = Math.round(r.height - innerHeight), sid = screen.id || screen.getAttribute('data-oc-screen') || '';
    if (room > 8) out.push(`screen "${sid}" is ${Math.round(r.height)}px tall on a ${innerHeight}px screen, ${room}px longer than the screen it is shown on, so its footer (the progress dots and the round next button) and its last options fall below the fold; fit the screen's own content: let a long option list scroll inside the screen, or size the cards so five or six fit beside the scene`);
  }
  const actions = [...last.querySelectorAll('button, a[href], [role=button]')].filter((e) => shown(e) && !e.closest('header, nav, p, li') && !e.hasAttribute('disabled') && e.getAttribute('aria-disabled') !== 'true');
  if (actions.length > 1) out.push(`the last screen "${id}" offers ${actions.length} actions at once (${actions.map((e) => text(e) || e.getAttribute('aria-label') || e.tagName.toLowerCase()).join(', ')}); keep its closing button as the one action and drop the round next button beside it`);
  return out;
};
const name = (el) => `<${el.tag}${el.id ? ` id="${el.id}"` : ''}${el.cls ? ` class="${el.cls}"` : ''}>`;

export class Renderer {
  constructor(bin, onWarn, dark, clarity, pageChecks, humanSide, flow) { this.humanSide = humanSide; this.flow = flow; this.pageChecks = pageChecks; this.dark = dark; this.clarity = clarity; this.bin = bin; this.onWarn = onWarn; this.proc = null; this.dir = null; this.client = null; this.n = 0; this.state = 'ready'; this.warning = null; }

  async start() {
    this.dir = mkdtempSync(join(tmpdir(), 'first-draft-render-'));
    let exited = false, startupLog = '', spawnError;
    const startupFailure = why => new Error(`${why} (${this.bin}): ${spawnError?.message || startupLog.trim() || 'no browser stderr'}`);
    this.proc = spawn(this.bin, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--disable-dev-shm-usage', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--disable-extensions', '--no-proxy-server', `--user-data-dir=${this.dir}`, '--remote-debugging-port=0', '--remote-allow-origins=*', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
    this.proc.stderr.on('data', b => { startupLog = (startupLog + b.toString()).slice(-4000); });
    this.proc.on('exit', () => { exited = true; });
    this.onExit = () => this.proc?.kill(); // Ctrl-C or a failed run must not leave the browser behind; close() takes the listener off, so many browsers in one run do not pile them up
    process.once('exit', this.onExit);
    this.proc.on('error', e => { exited = true; spawnError = e; });
    const portFile = join(this.dir, 'DevToolsActivePort');
    let port = 0;
    // A cold Chrome on a loaded machine (CI running several test files, each with its own browser) can take well over 15 s to open its port.
    for (let i = 0; i < 450 && !port; i++) {
      await new Promise((r) => setTimeout(r, 100));
      if (exited) throw startupFailure('the browser exited before it was ready');
      if (existsSync(portFile)) port = Number(readFileSync(portFile, 'utf8').split('\n')[0]);
    }
    if (!port) throw startupFailure('the browser never opened its debugging port');
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const page = list.find((t) => t.type === 'page');
    if (!page) throw new Error('the browser opened no page to render in');
    this.client = await connect(page.webSocketDebuggerUrl);
    await this.client.send('Page.enable');
    await this.client.send('Runtime.enable'); // the source's errors, for the snapshot
  }

  close() {
    try { this.client?.close(); } catch { /* the browser is going away anyway */ }
    this.client = null;
    if (this.onExit) process.off('exit', this.onExit);
    if (this.proc) { try { this.proc.kill(); } catch { /* already gone */ } this.proc = null; }
    if (this.dir) { try { rmSync(this.dir, { recursive: true, force: true }); } catch { /* scratch */ } this.dir = null; }
  }

  skip(why) {
    this.state = 'skipped';
    this.warning = `the headless browser could not start (${why}), so the 390px/1280px light/dark render checks were skipped`;
    this.close();
    this.onWarn(this.warning);
  }

  async read(c, screen) {
    const measured = await this.eval(c, `(${measurePage.toString()})(${Boolean(this.redesign)})`);
    const sig = await this.eval(c, `(${paintSignature.toString()})()`);
    const lightness = await this.eval(c, `(${pageLightness.toString()})()`);
    const shot = await c.send('Page.captureScreenshot', { format: 'png' });
    const layout = screen === null ? null : await this.eval(c, `(()=>{const e=document.querySelectorAll('[data-oc-screen]')[${screen}],r=e.getBoundingClientRect();return {width:r.width,height:r.height,visible:getComputedStyle(e).visibility!=='hidden'}})()`);
    const visible = screen === null || (layout.width > 0 && layout.height > 0 && layout.visible);
    const covered = (this.redesign && screen !== null) || (this.pageChecks && screen === null) ? await this.eval(c, `(${coveredText.toString()})()`) : [];
    const stray = this.pageChecks && screen === null ? await this.eval(c, `(${strayClose.toString()})()`) : [];
    const faint = this.pageChecks && screen === null ? await this.eval(c, `(${unreadable.toString()})()`) : [];
    const clarity = this.clarity && screen === null ? await this.eval(c, `(${clarityPage.toString()})(${this.clarity.flash})`) : []; // the clarity page is the whole page, not one screen
    const human = this.humanSide && screen === null ? await this.eval(c, `(${humanSidePage.toString()})(${CARD_RUN}, ${HUES}, ${JSON.stringify(TITLE_WORDS)})`) : []; // the human-side checks are the whole page's too
    const scene = this.flow && screen === null ? await this.eval(c, `(${flowScene.toString()})()`) : []; // the flow's scenes are measured across the screens, as the person sees them together
    const shell = this.flow && screen === null ? await this.eval(c, `(${flowShell.toString()})()`) : []; // so are its step labels and the actions on its last screen
    return { measured, sig, lightness, visible, covered, stray, faint, clarity, human, scene, shell, screenWidth: layout?.width, png: Buffer.from(shot.data, 'base64') };
  }

  async eval(c, expression) {
    const r = await c.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text ?? 'the page could not be measured');
    return r.result.value;
  }

  // One file, both device sizes; isolate screens the same way the preview overlay does.
  async render(html) {
    const file = join(this.dir, `page-${++this.n}.html`);
    writeFileSync(file, html);
    const c = this.client, pairs = [];
    for (const [width, height] of VIEWPORTS) {
      await c.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      const loaded = c.once('Page.loadEventFired');
      await c.send('Page.navigate', { url: `file://${file}` });
      await loaded;
      const screens = await this.eval(c, `(()=>{const s=document.createElement('style');s.textContent='[data-oc-screen][hidden]{display:none!important}';document.head.append(s);return [...document.querySelectorAll('[data-oc-screen]')].map((e,i)=>e.id||e.getAttribute('data-oc-screen')||String(i+1))})()`);
      for (const screen of [null, ...screens.keys()]) {
        await this.eval(c, `(()=>{const n=${JSON.stringify(screen)},id=${JSON.stringify(screen === null ? '' : screens[screen])};document.querySelectorAll('[data-oc-screen]').forEach((e,i)=>e.hidden=n!==null&&i!==n);if(n===null)document.documentElement.removeAttribute('data-oc-active-screen');else document.documentElement.setAttribute('data-oc-active-screen',id);location.hash=id;scrollTo(0,0)})()`);
        const shots = {};
        for (const theme of ['light', 'dark']) {
          await c.send('Emulation.setEmulatedMedia', { media: 'screen', features: [{ name: 'prefers-color-scheme', value: theme }] });
          await this.settle(c);
          shots[theme] = await this.read(c, screen);
        }
        pairs.push({ width, height, screen: screen === null ? null : screens[screen], ...shots });
      }
    }
    return pairs;
  }

  // The page as a person first sees it, for the critic: the top of the whole page (or of each screen, three by default) at desktop then
  // phone width, in light, as JPEG.
  async capture(html, maxScreens = 3) {
    const file = join(this.dir, `page-${++this.n}.html`);
    writeFileSync(file, html);
    const c = this.client, shots = [];
    for (const [width, height] of [...VIEWPORTS].reverse()) {
      await c.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      await c.send('Emulation.setEmulatedMedia', { media: 'screen', features: [{ name: 'prefers-color-scheme', value: 'light' }] });
      const loaded = c.once('Page.loadEventFired');
      await c.send('Page.navigate', { url: `file://${file}` });
      await loaded;
      const screens = await this.eval(c, `(()=>{const s=document.createElement('style');s.textContent='[data-oc-screen][hidden]{display:none!important}';document.head.append(s);return [...document.querySelectorAll('[data-oc-screen]')].slice(0,${maxScreens}).map((e,i)=>e.id||e.getAttribute('data-oc-screen')||String(i+1))})()`);
      for (const screen of screens.length ? screens.keys() : [null]) {
        await this.eval(c, `(()=>{const n=${JSON.stringify(screen)},id=${JSON.stringify(screen === null ? '' : screens[screen])};document.querySelectorAll('[data-oc-screen]').forEach((e,i)=>e.hidden=n!==null&&i!==n);if(n!==null)document.documentElement.setAttribute('data-oc-active-screen',id);scrollTo(0,0)})()`);
        await this.settle(c);
        const tall = Math.min(await this.eval(c, 'document.documentElement.scrollHeight'), width === 390 ? 1700 : 1600);
        const { data } = await c.send('Page.captureScreenshot', { format: 'jpeg', quality: 78, captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: tall, scale: 1 } });
        shots.push({ id: `${width === 390 ? 'phone' : 'desktop'}-${width}${screen === null ? '' : `-${screens[screen]}`}`, mime: 'image/jpeg', dataUrl: `data:image/jpeg;base64,${data}` });
      }
    }
    return shots;
  }

  async settle(c) {
    await c.send('Runtime.evaluate', { expression: 'new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))', awaitPromise: true, returnByValue: true });
  }

  // The source drawn once at 1280px in light, as upstream's standalone export runs it, and kept as the page it drew, with the errors it threw.
  async snapshot(doc) {
    const file = join(this.dir, `source-${++this.n}.html`);
    writeFileSync(file, /<head(?:\s[^>]*)?>/i.test(doc) ? doc.replace(/<head(?:\s[^>]*)?>/i, (head) => `${head}\n${DRAW_POLICY}`) : `${DRAW_POLICY}\n${doc}`);
    const c = this.client, errors = new Set();
    const off = [
      c.on('Runtime.exceptionThrown', ({ exceptionDetails: d }) => errors.add(d.exception?.description?.split('\n')[0] ?? d.text)),
      c.on('Runtime.consoleAPICalled', ({ type, args }) => { if (type === 'error') errors.add(args.map((a) => a.value ?? a.description ?? '').join(' ')); }),
    ];
    try {
      await c.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
      await c.send('Emulation.setEmulatedMedia', { media: 'screen', features: [{ name: 'prefers-color-scheme', value: 'light' }] });
      const loaded = c.once('Page.loadEventFired');
      await c.send('Page.navigate', { url: `file://${file}` });
      await loaded;
      if (!await this.eval(c, `(${drawn.toString()})()`)) errors.add('App rendered nothing: #root is still empty after 5 seconds');
      return { html: await this.eval(c, `(${staticPage.toString()})()`), errors: [...errors].map((message) => ({ source: 'runtime', message })) };
    } finally { for (const stop of off) stop(); }
  }

  // The page as a person first sees it, for the critic: light theme, at 1280x800 and 390x844, down to `tall` px of the page each.
  async shoot(html, tall) {
    const file = join(this.dir, `shot-${++this.n}.html`);
    writeFileSync(file, html);
    const c = this.client, shots = [];
    for (const [width, height] of VIEWPORTS.toReversed()) {
      await c.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      await c.send('Emulation.setEmulatedMedia', { media: 'screen', features: [{ name: 'prefers-color-scheme', value: 'light' }] });
      const loaded = c.once('Page.loadEventFired');
      await c.send('Page.navigate', { url: `file://${file}` });
      await loaded;
      await this.eval(c, 'document.fonts.ready.then(() => 1)');
      await this.settle(c);
      const h = Math.min(tall, await this.eval(c, 'document.documentElement.scrollHeight'));
      const { data } = await c.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: Math.max(h, height), scale: 1 } });
      shots.push({ width, dataUrl: `data:image/png;base64,${data}` });
    }
    return shots;
  }

  // The check itself: the errors done must report, so the model can fix the page in the loop.
  async check(html, redesignPages) {
    this.redesign = Boolean(redesignPages);
    const errors = [];
    let shots;
    try {
      shots = await this.render(html);
    } catch (e) {
      this.close();
      if (this.state === 'skipped') return errors;
      try { await this.start(); shots = await this.render(html); }
      catch (e2) { this.skip(e2.message); return errors; }
    }
    if (redesignPages) {
      const findings = await this.eval(this.client, `(${((pages) => {
        const errors=[],screens=[...document.querySelectorAll('[data-oc-screen]')];
        if(screens.length!==pages.length||new Set(screens.map(e=>e.id)).size!==pages.length)errors.push('Expected exactly '+pages.length+' distinct screen section(s)');
        for(const p of pages) {
          const e=document.getElementById(p.id);
          if(!e?.hasAttribute('data-oc-screen')) { errors.push('Missing required screen '+p.id); continue; }
          const links=[...document.querySelectorAll('a[href]')].filter(a=>e.contains(a)||!a.closest('[data-oc-screen]')).map(a=>a.getAttribute('href'));
          for(const l of p.links) if(l.target && l.target!==p.id && !links.includes('#'+l.target)) errors.push('Missing navigation '+p.id+' -> '+l.target);
        }
        if(/\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F/u.test(document.body.textContent)) errors.push('Remove emoji filler; use SVG icons or plain labels');
        if(/\((?:title|rest of text) cut off in source\)/i.test(document.body.textContent))errors.push('Remove diagnostic provenance notes from product UI; keep readable source fragments without inventing completion');
        return [...new Set(errors)];
      }).toString()})(${JSON.stringify(redesignPages)})`);
      errors.push(...findings.map(message=>({source:'redesign',message})));
    }
    const said = new Set(); // the same clarity finding in the other theme is one finding
    for (const { width, height, screen, light, dark } of shots) {
      const context = `${screen === null ? 'the page' : `screen ${JSON.stringify(screen)}`} at ${width}x${height}`;
      for (const [theme, shot] of Object.entries({ light, dark })) {
        if (!shot.visible) errors.push({ source: 'render', message: `${context} in ${theme} has no visible layout. Each screen must work independently on phone and desktop. Then call done again.` });
        // ponytail: reject phone-sized outer boxes; visual review still decides desktop quality.
        if (width === 1280 && screen !== null && shot.visible && shot.screenWidth <= 390) errors.push({ source: 'render', message: `${context} in ${theme} is still phone-sized (${Math.round(shot.screenWidth)}px). Let each outer screen use the desktop width; put responsive columns inside it, not between screens. Then call done again.` });
        for (const { message } of shot.clarity) if (!said.has(message) && said.add(message)) errors.push({ source: 'clarity', message: `clarity over flash, ${context}: ${message}. Then call done again.` });
        for (const message of shot.scene ?? []) if (!said.has(message) && said.add(message)) errors.push({ source: 'flow', message: `${context}: ${message}. Make the illustration part of the screen's own surface: let it run to the screen's left and right edges on the screen's own ground, or give it a soft edge that fades into that ground with a mask (mask-image: radial-gradient(...)), and take away the hard rim: no border, outline, frame, mat, drop shadow, oval or rounded clip. Then call done again.` });
        for (const message of shot.shell ?? []) if (!said.has(message) && said.add(message)) errors.push({ source: 'flow', message: `${context}: ${message}. Then call done again.` });
        for (const message of shot.human ?? []) if (!said.has(message) && said.add(message)) errors.push({ source: 'human-side', message: `human side, ${context}: ${message}` });
        if (shot.stray?.length && theme === 'light') errors.push({ source: 'restraint', message: `${context}: a close control is on screen with nothing open: ${shot.stray.join('; ')}. Show it only while its drawer, dialog or banner is open (hide it by default and at this width), or remove it.` });
        if (shot.faint?.length) errors.push({ source: 'render', message: `${context} in ${theme}: text that cannot be read, colour against its own background: ${shot.faint.join('; ')}. Give it at least 4.5:1 contrast (an active or selected state needs its own text colour on its fill).` });
        if(shot.covered.length) errors.push({source:'render',message:`${context} in ${theme} has text covered by fixed or sticky navigation: ${shot.covered.join('; ')}. Do not lay that bar over content: make it a normal in-flow bottom row (a 100dvh shell grid whose content row scrolls above the nav row), or keep it sticky only where its space is reserved so no text sits under it, then call done again.`});
        if(shot.measured.textClipped?.length) errors.push({source:'render',message:`${context} in ${theme} has clipped text: ${shot.measured.textClipped.join('; ')}. Remove hidden/clip truncation or allow the complete text to wrap, then call done again.`});
        if (shot.measured.scrollWidth <= width) continue;
        const { measured: m } = shot, worst = m.worst.tag ? m.worst : null;
        errors.push({ source: 'render', message: `${context} in ${theme}: the page is ${m.scrollWidth}px wide on a ${width}px ${width === 390 ? 'phone' : 'desktop'}; it must fit ${width}px. ${m.count} element(s) overflow, the widest is ${worst ? name(worst) : 'an unknown element'} at ${worst ? worst.right : m.scrollWidth}px. The overflow comes from ${m.causes.map(name).join(', ') || 'the elements above'}: wrap a pre or table in a container with overflow-x:auto, write grid columns as minmax(0,1fr), give grid and flex children min-width:0, and let long text wrap. Then call done again.` });
      }
      if (!light.visible || !dark.visible) continue; // The layout error already refuses this screen.
      if (this.dark) {
        const light_ = light.lightness > DARK_BELOW ? 'light' : dark.lightness > DARK_BELOW ? 'dark' : null;
        if (light_) errors.push({ source: 'render', message: `${context}: the style is dark-first but the page paints a light background in ${light_} (background lightness ${(light_ === 'light' ? light : dark).lightness.toFixed(2)} of 1). Make the page dark by default: a near-black page background with light text on :root, no light palette and no override that turns the background light, set color-scheme: dark, then call done again.` });
      } else if (light.png.equals(dark.png) || light.sig === dark.sig) {
        errors.push({ source: 'render', message: `${context}: the page has no real light and dark themes: it paints the same in light and in dark. Put a light palette in :root custom properties (a light background, dark text), override every colour in a @media (prefers-color-scheme: dark) block with a dark palette (a dark background, light text), and set color-scheme: light dark, then call done again.` });
      }
    }
    return errors;
  }
}

// The render check for one run: the browser starts with the first done and stops with the run.
// dark: the named style is dark-first, so the page must be dark in both renders instead of different in each.
// humanSide: the brief is a landing, marketing, product or company page (human-side.mjs).
// clarity: { flash } when the brief asks for a company or product page (clarity.mjs); flash waives the colour and motion checks.
// flow: the brief asks for a multi-screen flow, so each screen's scene must belong to the page and keep the size the others give it.
export const renderCheck = (onWarn = () => {}, { dark = false, redesignPages, clarity, pageChecks, humanSide, flow = false } = {}) => {
  const bin = findBrowser();
  if (!bin) {
    const warning = 'no Chrome or Chromium was found on this machine, so the 390px/1280px light/dark render checks were skipped';
    onWarn(warning);
    return { status: 'skipped', warning, drawing: false, verify: async () => [], close: () => {} };
  }
  const render = new Renderer(bin, onWarn, dark, clarity, pageChecks, humanSide, flow);
  return {
    drawing: true, // this machine can draw an App.jsx into static HTML
    get status() { return render.state === 'ready' ? 'checked' : 'skipped'; },
    get warning() { return render.warning; },
    verify: async (html, ctx) => {
      if (ctx?.signal?.aborted) return [];
      if (!render.client) {
        try { await render.start(); }
        catch (e) { render.skip(e.message); return []; }
      }
      return render.check(html, redesignPages);
    },
    // The source's standalone document drawn into static HTML. A browser that cannot start is the real failure here: the source cannot become a page without it.
    snapshot: async (doc) => {
      if (!render.client) await render.start().catch((e) => { render.close(); throw new Error(`the headless browser could not start to draw the design: ${e.message}`); });
      return render.snapshot(doc);
    },
    // The drawn page's first screens at desktop and phone width, for the critic.
    capture: async (html, maxScreens) => {
      if (!render.client) await render.start().catch((e) => { render.close(); throw new Error(`the headless browser could not start to show the design to the critic: ${e.message}`); });
      return render.capture(html, maxScreens);
    },
    // An expression evaluated on a blank page of the same browser (logo mode parses and draws its SVG files here); a browser that cannot start is the failure.
    evaluate: async (expression) => {
      if (!render.client) await render.start().catch((e) => { render.close(); throw new Error(`the headless browser could not start to check the logo files: ${e.message}`); });
      const loaded = render.client.once('Page.loadEventFired');
      await render.client.send('Page.navigate', { url: 'about:blank' });
      await loaded;
      return render.eval(render.client, expression);
    },
    // Screenshots of a page at 1280 and 390 (the critic's eyes); a browser that cannot start is the failure.
    shoot: async (html, tall = 2400) => {
      if (!render.client) await render.start().catch((e) => { render.close(); throw new Error(`the headless browser could not start to show the critic the design: ${e.message}`); });
      return render.shoot(html, tall);
    },
    close: () => render.close(),
  };
};
