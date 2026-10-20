// The first-draft view server: the view page on one port, and each option's page on the next port, a different origin.
import { execFile } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { promisify } from 'node:util';

const LIMIT = 5_000_000; // sign-off takes mocks of 5 MB or less
const DIST = new URL('../dist/view/', import.meta.url);
const natural = (a, b) => a.localeCompare(b, undefined, { numeric: true });

// A design is a folder of options, option files, or the --out path `make --count N` numbered (x.html -> x-1.html ... x-N.html).
export function designFiles(args) {
  return [...new Set(args.flatMap((arg) => {
    const p = resolve(arg);
    if (existsSync(p) && statSync(p).isDirectory()) return readdirSync(p).filter((f) => /\.html?$/i.test(f)).sort(natural).map((f) => join(p, f));
    if (existsSync(p)) return [p];
    const ext = extname(p), base = basename(p, ext);
    if (!existsSync(dirname(p))) return [];
    return readdirSync(dirname(p)).filter((f) => f.startsWith(`${base}-`) && f.endsWith(ext) && /^\d+$/.test(f.slice(base.length + 1, f.length - ext.length))).sort(natural).map((f) => join(dirname(p), f));
  }))];
}

export async function tailnetHost() {
  try {
    const { stdout } = await promisify(execFile)('tailscale', ['ip', '-4'], { timeout: 3000 });
    return stdout.split('\n')[0].trim() || null;
  } catch { return null; }
}

export const viewPolicy = (frames) => `default-src 'none'; script-src 'self'; style-src 'self'; frame-src ${frames}; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`;
// Scripts run only inside this sandbox: inline only, nothing loaded or sent over the network.
export const framePolicy = (view) => `sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors ${view}`;
const COMMON = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'cache-control': 'no-store' };

const pathOf = (req) => req.url.split('?')[0];
const listen = (server, port, host) => new Promise((ok, fail) => { server.once('error', fail); server.listen(port, host, () => { server.off('error', fail); ok(); }); });

export async function serve({ files, name, host, advertise = host, port, framePort }) {
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
  const page = () => {
    const data = { name, frames: frameOrigin, options: options.map((o) => ({ n: o.n, label: o.label, error: sizeError(o)?.message })) };
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${name.replace(/[<&"]/g, (c) => `&#${c.charCodeAt(0)};`)}</title><link rel="stylesheet" href="/view.css"></head>`
      + `<body><div id="app"></div><script type="application/json" id="design">${JSON.stringify(data).replaceAll('<', '\\u003c')}</script><script src="/view.js"></script></body></html>`;
  };
  const view = createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'text/plain', 'GET only');
    const path = pathOf(req);
    if (path === '/') return send(res, 200, 'text/html; charset=utf-8', page(), { 'content-security-policy': viewPolicy(frameOrigin) });
    if (path === '/view.js' || path === '/view.css') {
      try { return send(res, 200, path.endsWith('.js') ? 'text/javascript' : 'text/css', readFileSync(new URL(path.slice(1), DIST))); }
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
    send(res, 200, 'text/html; charset=utf-8', html, { 'content-security-policy': framePolicy(viewOrigin) });
  });
  await listen(view, port, host);
  await listen(frames, framePort, host).catch((e) => { view.close(); throw e; });
  const h = advertise.includes(':') ? `[${advertise}]` : advertise;
  viewOrigin = `http://${h}:${view.address().port}`;
  frameOrigin = `http://${h}:${frames.address().port}`;
  return { url: `${viewOrigin}/`, frames: frameOrigin, options, close: () => { view.close(); frames.close(); } };
}
