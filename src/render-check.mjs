// The render check: a page is rendered once headless at 390px, in light and in dark, and the
// two facts that break a landing page on a phone are read off that render — the page must fit
// 390px, and it must have a dark theme (or, for a dark-first style, be dark). The browser is the one already on the machine: no
// dependency is added and no browser is bundled. With no browser the check is skipped, never
// failed. The same browser draws the engine's source (App.jsx and its runtime) once, and the
// page it drew is kept as static HTML: that snapshot is what the check and the board see.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PHONE = 390; // the width a page must fit
const DARK_BELOW = 0.18; // a page background lighter than this (0 black, 1 white) is a light page
const NAMES = ['google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser', 'chrome', 'chromium-headless-shell', 'headless-shell'];
const SPOTS = ['/opt/google/chrome/chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/lib/chromium/chromium', '/snap/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];

// The browser already on this machine. FIRST_DRAFT_CHROME names the one to use; when it names a
// path that is not there, this machine has no browser.
export const findBrowser = () => {
  const given = process.env.FIRST_DRAFT_CHROME;
  if (given) return existsSync(given) ? given : null;
  for (const dir of (process.env.PATH ?? '').split(':')) for (const name of NAMES) { const p = join(dir, name); if (existsSync(p)) return p; }
  for (const p of SPOTS) if (existsSync(p)) return p;
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

// What the page measures at 390px: its width, and the elements that push it wider.
const measurePage = () => {
  const vw = 390;
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
  return { scrollWidth: Math.max(d.scrollWidth, document.body ? document.body.scrollWidth : 0), count: inner.length || off.length, worst: plain(inner[0] ?? off[0] ?? { tag: '', id: '', cls: '', right: 0 }), causes };
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

const name = (el) => `<${el.tag}${el.id ? ` id="${el.id}"` : ''}${el.cls ? ` class="${el.cls}"` : ''}>`;

class Renderer {
  constructor(bin, onWarn, dark) { this.dark = dark; this.bin = bin; this.onWarn = onWarn; this.proc = null; this.dir = null; this.client = null; this.n = 0; this.state = 'ready'; this.warning = null; }

  async start() {
    this.dir = mkdtempSync(join(tmpdir(), 'first-draft-render-'));
    let exited = false;
    this.proc = spawn(this.bin, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--disable-dev-shm-usage', `--user-data-dir=${this.dir}`, '--remote-debugging-port=0', '--remote-allow-origins=*', 'about:blank'], { stdio: 'ignore' });
    this.proc.on('exit', () => { exited = true; });
    process.once('exit', () => this.proc?.kill()); // Ctrl-C or a failed run must not leave the browser behind
    this.proc.on('error', () => { exited = true; });
    const portFile = join(this.dir, 'DevToolsActivePort');
    let port = 0;
    for (let i = 0; i < 150 && !port; i++) {
      await new Promise((r) => setTimeout(r, 100));
      if (exited) throw new Error('the browser exited before it was ready');
      if (existsSync(portFile)) port = Number(readFileSync(portFile, 'utf8').split('\n')[0]);
    }
    if (!port) throw new Error('the browser never opened its debugging port');
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
    if (this.proc) { try { this.proc.kill(); } catch { /* already gone */ } this.proc = null; }
    if (this.dir) { try { rmSync(this.dir, { recursive: true, force: true }); } catch { /* scratch */ } this.dir = null; }
  }

  skip(why) {
    this.state = 'skipped';
    this.warning = `the headless browser could not start (${why}), so the ${PHONE}px and dark-theme render check was skipped`;
    this.close();
    this.onWarn(this.warning);
  }

  async read(c) {
    const measured = await this.eval(c, `(${measurePage.toString()})()`);
    const sig = await this.eval(c, `(${paintSignature.toString()})()`);
    const lightness = await this.eval(c, `(${pageLightness.toString()})()`);
    const shot = await c.send('Page.captureScreenshot', { format: 'png' });
    return { measured, sig, lightness, png: Buffer.from(shot.data, 'base64') };
  }

  async eval(c, expression) {
    const r = await c.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text ?? 'the page could not be measured');
    return r.result.value;
  }

  // The page in light, then the same page in dark: two renders of one file.
  async render(html) {
    const file = join(this.dir, `page-${++this.n}.html`);
    writeFileSync(file, html);
    const c = this.client;
    await c.send('Emulation.setDeviceMetricsOverride', { width: PHONE, height: 844, deviceScaleFactor: 1, mobile: false });
    await c.send('Emulation.setEmulatedMedia', { media: 'screen', features: [{ name: 'prefers-color-scheme', value: 'light' }] }); // light is named, not left to the machine's own theme
    const loaded = c.once('Page.loadEventFired');
    await c.send('Page.navigate', { url: `file://${file}` });
    await loaded;
    await this.settle(c);
    const light = await this.read(c);
    await c.send('Emulation.setEmulatedMedia', { media: 'screen', features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
    await this.settle(c);
    const dark = await this.read(c);
    return { light, dark };
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

  // The check itself: the errors done must report, so the model can fix the page in the loop.
  async check(html) {
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
    const { light, dark } = shots;
    if (light.measured.scrollWidth > PHONE) {
      const worst = light.measured.worst.tag ? light.measured.worst : null;
      errors.push({ source: 'render', message: `the page is ${light.measured.scrollWidth}px wide on a ${PHONE}px phone; it must fit ${PHONE}px. ${light.measured.count} element(s) overflow, the widest is ${worst ? name(worst) : 'an unknown element'} at ${worst ? worst.right : light.measured.scrollWidth}px. The overflow comes from ${light.measured.causes.map(name).join(', ') || 'the elements above'}: wrap a pre or table in a container with overflow-x:auto, write grid columns as minmax(0,1fr) instead of 1fr, give grid and flex children min-width:0, and let long text wrap. Then call done again.` });
    }
    if (this.dark) {
      // A dark-first style is dark by default, so the page is dark in light and in dark: a page that renders light is the failure, and the same paint in both is right.
      const light_ = light.lightness > DARK_BELOW ? 'light' : dark.lightness > DARK_BELOW ? 'dark' : null;
      if (light_) errors.push({ source: 'render', message: `the style is dark-first but the page paints a light background in ${light_} (background lightness ${(light_ === 'light' ? light : dark).lightness.toFixed(2)} of 1). Make the page dark by default: a near-black page background with light text on :root, no light palette and no override that turns the background light, set color-scheme: dark, then call done again.` });
    } else if (light.png.equals(dark.png) || light.sig === dark.sig) {
      errors.push({ source: 'render', message: `the page has no real light and dark themes: it paints the same in light and in dark. Put a light palette in :root custom properties (a light background, dark text), override every colour in a @media (prefers-color-scheme: dark) block with a dark palette (a dark background, light text), and set color-scheme: light dark, then call done again.` });
    }
    return errors;
  }
}

// The render check for one run: the browser starts with the first done and stops with the run.
// dark: the named style is dark-first, so the page must be dark in both renders instead of different in each.
export const renderCheck = (onWarn = () => {}, { dark = false } = {}) => {
  const bin = findBrowser();
  if (!bin) {
    const warning = `no Chrome or Chromium was found on this machine, so the ${PHONE}px and dark-theme render check was skipped`;
    onWarn(warning);
    return { status: 'skipped', warning, drawing: false, verify: async () => [], close: () => {} };
  }
  const render = new Renderer(bin, onWarn, dark);
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
      return render.check(html);
    },
    // The source's standalone document drawn into static HTML. A browser that cannot start is the real failure here: the source cannot become a page without it.
    snapshot: async (doc) => {
      if (!render.client) await render.start().catch((e) => { render.close(); throw new Error(`the headless browser could not start to draw the design: ${e.message}`); });
      return render.snapshot(doc);
    },
    close: () => render.close(),
  };
};
