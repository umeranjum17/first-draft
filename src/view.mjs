// The first-draft view server: the view page on one port, and each option's page on the next port, a different origin.
import { execFile } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { promisify } from 'node:util';

const LIMIT = 5_000_000; // sign-off takes mocks of 5 MB or less
const DIST = new URL('../dist/view/', import.meta.url);
const natural = (a, b) => a.localeCompare(b, undefined, { numeric: true });

// A design is a folder of options, option files, or the --out path `make --count N` numbered (x.html -> x-1.html ... x-N.html).
const listDir = (d) => { try { return readdirSync(d); } catch { return []; } };

export function designFiles(args) {
  return [...new Set(args.flatMap((arg) => {
    const p = resolve(arg);
    if (existsSync(p) && statSync(p).isDirectory()) return listDir(p).filter((f) => /\.html?$/i.test(f)).sort(natural).map((f) => join(p, f));
    if (existsSync(p)) return [p];
    const ext = extname(p), base = basename(p, ext);
    return listDir(dirname(p)).filter((f) => f.startsWith(`${base}-`) && f.endsWith(ext) && /^\d+$/.test(f.slice(base.length + 1, f.length - ext.length))).sort(natural).map((f) => join(dirname(p), f));
  }))];
}

// Comment pins, read-only: `<design>.comments.json` next to the design (`mocks/x.html` or `mocks/x` -> `mocks/x.comments.json`),
// an array of { option, x, y, text } with x and y as fractions (0-1) of the frame. No file means no pins.
export const commentsPath = (arg) => { const p = resolve(arg); return join(dirname(p), `${basename(p, extname(p))}.comments.json`); };
export function readPins(file) {
  if (!file) return { pins: [] };
  let raw;
  try { raw = readFileSync(file, 'utf8'); } catch (e) { return e.code === 'ENOENT' ? { pins: [] } : { pins: [], error: `${basename(file)} cannot be read: ${e.code ?? e.message}` }; }
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) throw new Error('expected an array of { option, x, y, text }');
    const frac = (v) => typeof v === 'number' && v >= 0 && v <= 1;
    return { pins: list.filter((c) => Number.isInteger(c?.option) && frac(c.x) && frac(c.y) && typeof c.text === 'string' && c.text).map(({ option, x, y, text }) => ({ option, x, y, text })) };
  } catch (e) { return { pins: [], error: `${basename(file)} is not valid comments: ${e.message}` }; }
}

export async function tailnetHost() {
  try {
    const { stdout } = await promisify(execFile)('tailscale', ['ip', '-4'], { timeout: 3000 });
    return stdout.split('\n')[0].trim() || null;
  } catch { return null; }
}

// Where the view binds and what address it shows: --host, else $FIRST_DRAFT_VIEW_HOST, else the tailnet address, else this machine.
export async function viewHost(flag) {
  const given = flag ?? process.env.FIRST_DRAFT_VIEW_HOST;
  const wildcard = given === '0.0.0.0' || given === '::';
  const tailnet = given && !wildcard ? null : await tailnetHost();
  const host = given || tailnet || '127.0.0.1';
  return { given, host, advertise: wildcard ? tailnet : host, tailnet, wildcard };
}

export const viewPolicy = (frames) => `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-src ${frames}; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`;
// Scripts run only inside this sandbox: inline only, nothing loaded or sent over the network.
export const framePolicy = (view) => `sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors ${view}`;
const ASSETS = { '/view.js': 'text/javascript', '/view.css': 'text/css', '/favicon.svg': 'image/svg+xml', '/favicon-32.png': 'image/png', '/apple-touch-icon.png': 'image/png' };
const COMMON = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'cache-control': 'no-store' };

// Play only: the screens are the upstream overlay's `data-oc-screen` sections. This reports the active one to the view page and,
// on its request, goes to another or back, by clicking an in-page hash link so the overlay's own screen switch does the work.
const PLAY_BRIDGE = `<script>(function(){var r=document.documentElement,stack=[],back=false;
function ids(){return [].map.call(document.querySelectorAll('[data-oc-screen]'),function(s){return s.id||s.getAttribute('data-oc-screen')});}
function sync(){var c=r.getAttribute('data-oc-active-screen');if(c){if(back)back=false;else if(stack[stack.length-1]!==c)stack.push(c);}
parent.postMessage({__firstDraft:true,type:'SCREEN',screens:ids(),current:c,canBack:stack.length>1},'*');}
function go(id){var a=document.createElement('a');a.setAttribute('href','#'+id);document.body.appendChild(a);a.click();a.remove();}
new MutationObserver(sync).observe(r,{attributes:true,attributeFilter:['data-oc-active-screen']});
addEventListener('load',sync);
addEventListener('message',function(e){if(e.source!==parent||!e.data||e.data.__firstDraft!==true)return;
if(e.data.type==='GO'&&ids().indexOf(e.data.id)>=0)go(e.data.id);
else if(e.data.type==='BACK'&&stack.length>1){stack.pop();back=true;go(stack[stack.length-1]);}});})();</script>`;

const pathOf = (req) => req.url.split('?')[0];
const listen = (server, port, host) => new Promise((ok, fail) => { server.once('error', fail); server.listen(port, host, () => { server.off('error', fail); ok(); }); });

// The file a refined option is written to, beside the one it came from, never over an existing file.
const refinedPath = (file) => {
  const ext = extname(file), base = join(dirname(file), basename(file, ext));
  for (let k = 1; ; k++) { const p = `${base}-refined${k > 1 ? `-${k}` : ''}${ext}`; if (!existsSync(p)) return p; }
};
const readBody = (req) => new Promise((ok, fail) => {
  let body = '';
  req.on('data', (c) => { body += c; if (body.length > 100_000) req.destroy(new Error('request too large')); });
  req.on('end', () => ok(body)).on('error', fail);
});

// `refine(seed, change)` makes the html of a new option from an option's html; the view runs no model of its own.
export async function serve({ files, name, host, advertise = host, port, framePort, comments, refine }) {
  const options = files.map((file, i) => ({ n: i + 1, label: basename(file, extname(file)), file }));
  const { buildPreviewDocument } = await import('../dist/engine.mjs');
  let viewOrigin, frameOrigin;
  const send = (res, status, type, body, headers = {}) => { res.writeHead(status, { ...COMMON, 'content-type': type, ...headers }); res.end(body); };
  const sizeError = (o) => {
    try {
      const st = statSync(o.file);
      if (!st.isFile()) return { status: 404, message: `${basename(o.file)} is not a file` };
      return st.size > LIMIT ? { status: 413, message: `${basename(o.file)} is ${st.size} bytes; options are 5 MB or less` } : null;
    } catch (e) { return { status: 404, message: `${basename(o.file)} cannot be read: ${e.code ?? e.message}` }; }
  };
  const shown = (o) => ({ n: o.n, label: o.label, file: basename(o.file), error: sizeError(o)?.message });
  const page = () => {
    const { pins, error: pinsError } = readPins(comments);
    const data = { name, frames: frameOrigin, pins, pinsError, options: options.map(shown) };
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${name.replace(/[<&"]/g, (c) => `&#${c.charCodeAt(0)};`)}</title><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="icon" href="/favicon-32.png" sizes="32x32"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="stylesheet" href="/view.css"></head>`
      + `<body><div id="app"></div><script type="application/json" id="design">${JSON.stringify(data).replaceAll('<', '\\u003c')}</script><script src="/view.js"></script></body></html>`;
  };
  // One change runs at a time: the model call takes minutes and the person's agent is one account.
  let running = false;
  const change = async (req, res) => {
    const reply = (status, body) => send(res, status, 'application/json', JSON.stringify(body));
    const same = (() => { try { return new URL(req.headers.origin).host === req.headers.host; } catch { return false; } })();
    if (!same || !/^application\/json/.test(req.headers['content-type'] ?? '')) return reply(403, { error: 'this request did not come from the view page' });
    let body;
    try { body = JSON.parse(await readBody(req)); } catch { return reply(400, { error: 'the request is not valid JSON' }); }
    const from = options.find((o) => o.n === body?.option), text = typeof body?.change === 'string' ? body.change.trim() : '';
    if (!from || !text) return reply(400, { error: 'a change needs an option and a few words about the change' });
    if (!refine) return reply(501, { error: 'this view cannot make a change' });
    if (running) return reply(409, { error: 'Another change is still being made. Wait for it to finish.' });
    running = true;
    try {
      const html = await refine(readFileSync(from.file, 'utf8'), text);
      const file = refinedPath(from.file);
      writeFileSync(file, html);
      const added = { n: options.length + 1, label: basename(file, extname(file)), file };
      options.push(added);
      reply(200, { option: shown(added) });
    } catch (e) { reply(500, { error: e.message, help: e.help }); } finally { running = false; }
  };
  const view = createServer((req, res) => {
    const path = pathOf(req);
    if (req.method === 'POST' && path === '/refine') return change(req, res);
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'text/plain', 'GET only');
    if (path === '/') return send(res, 200, 'text/html; charset=utf-8', page(), { 'content-security-policy': viewPolicy(frameOrigin) });
    if (ASSETS[path]) {
      try { return send(res, 200, ASSETS[path], readFileSync(new URL(path.slice(1), DIST))); }
      catch (e) { return send(res, 500, 'text/plain', `${path} cannot be read: ${e.code ?? e.message}`); }
    }
    send(res, 404, 'text/plain', 'not found');
  });
  const frames = createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'text/plain', 'GET only');
    const o = options[Number(pathOf(req).match(/^\/o\/(\d+)$/)?.[1]) - 1];
    if (!o) return send(res, 404, 'text/plain', 'not found');
    const error = sizeError(o);
    if (error) return send(res, error.status, 'text/plain', error.message);
    // Upstream's preview runtime: drops the page's own CSP meta (this header replaces it), adds the viewport support and the error/navigation overlay.
    let html;
    try { html = buildPreviewDocument(readFileSync(o.file, 'utf8'), { path: 'index.html' }); }
    catch (e) { return send(res, 500, 'text/plain', `${basename(o.file)} cannot be rendered: ${e.code ?? e.message}`); }
    if (req.url.split('?')[1] === 'play') html = /<\/body>(?![\s\S]*<\/body>)/i.test(html) ? html.replace(/<\/body>(?![\s\S]*<\/body>)/i, () => `${PLAY_BRIDGE}</body>`) : html + PLAY_BRIDGE;
    send(res, 200, 'text/html; charset=utf-8', html, { 'content-security-policy': framePolicy(viewOrigin) });
  });
  await listen(view, port, host);
  await listen(frames, framePort, host).catch((e) => { view.close(); throw e; });
  const h = advertise.includes(':') ? `[${advertise}]` : advertise;
  viewOrigin = `http://${h}:${view.address().port}`;
  frameOrigin = `http://${h}:${frames.address().port}`;
  return { url: `${viewOrigin}/`, frames: frameOrigin, options, close: () => { view.close(); frames.close(); } };
}
