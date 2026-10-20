// The first-draft view: every option of a design as a grid, one option on a canvas (phone and desktop side by side), and fullscreen.
// Each option renders from the frame origin in an iframe sandboxed to scripts only; it can post only errors and Escape back.
import { isIframeErrorMessage } from '../../vendor/open-codesign/packages/runtime/src/iframe-errors.ts';
import { FRAMES, SANDBOX, fitCanvas, formatIframeError, isTrustedPreviewMessageSource } from './canvas.js';
import './view.css';

const design = JSON.parse(document.getElementById('design').textContent);
const app = document.getElementById('app');
const errors = new Map(); // option number -> runtime error lines
let frames = []; // [{ n, iframe }] currently mounted
let resize = null;

const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined) e.setAttribute(k, v);
  e.append(...kids);
  return e;
};

function frame(option, title, lazy) {
  // sandbox is set before src so the first navigation is already sandboxed.
  const iframe = el('iframe', { sandbox: SANDBOX, referrerpolicy: 'no-referrer', title, loading: lazy ? 'lazy' : undefined });
  iframe.src = `${design.frames}/o/${option.n}`;
  frames.push({ n: option.n, iframe });
  return iframe;
}

// PreviewPane.tsx ScaledPreviewFrame: lay the artboard out at its real size and scale it down.
function scaled(width, height, child) {
  const inner = el('div', { class: 'scaled-inner' }, child);
  inner.style.width = `${width}px`;
  inner.style.height = `${height}px`;
  const outer = el('div', { class: 'scaled' }, inner);
  outer.rescale = (scale) => {
    outer.style.width = `${width * scale}px`;
    outer.style.height = `${height * scale}px`;
    inner.style.transform = `scale(${scale})`;
  };
  return outer;
}

// PhoneFrame.tsx: bezel, screen, Dynamic Island and home indicator around the iframe.
const phoneFrame = (iframe) => el('div', { class: 'phone' }, el('div', { class: 'phone-screen' }, iframe),
  el('div', { class: 'phone-island', 'aria-hidden': 'true' }), el('div', { class: 'phone-home', 'aria-hidden': 'true' }));

// CanvasErrorBar.tsx: the latest runtime error of the open option, with a count and a dismiss button.
function errorBar(n) {
  const list = errors.get(n) ?? [];
  if (!list.length) return el('div', { class: 'error-bar', hidden: '' });
  const dismiss = el('button', { type: 'button', class: 'icon', 'aria-label': 'Dismiss errors' }, '×');
  dismiss.onclick = () => { errors.delete(n); document.querySelector('.error-bar')?.replaceWith(errorBar(n)); };
  return el('div', { class: 'error-bar', role: 'alert' },
    el('div', {}, el('strong', {}, `Runtime error${list.length > 1 ? ` (${list.length})` : ''}`), el('div', { class: 'error-text', title: list.at(-1) }, list.at(-1))), dismiss);
}

const option = (n) => design.options.find((o) => o.n === n);
const link = (href, text, cls) => el('a', { href, class: cls }, text);

function grid() {
  const cards = design.options.map((o) => {
    const body = o.error ? el('div', { class: 'thumb thumb-error' }, o.error)
      : el('div', { class: 'thumb' }, scaled(FRAMES.desktop.width, FRAMES.desktop.height, frame(o, `Option ${o.n} thumbnail`, true)));
    return el('a', { class: 'card', href: `#/o/${o.n}` }, body, el('div', { class: 'card-label' }, el('strong', {}, `Option ${o.n}`), ` ${o.label}`));
  });
  const fit = () => document.querySelectorAll('.thumb .scaled').forEach((s) => s.rescale(s.parentElement.clientWidth / FRAMES.desktop.width));
  return { body: [el('header', { class: 'bar' }, el('h1', {}, design.name), el('span', { class: 'muted' }, `${design.options.length} option${design.options.length === 1 ? '' : 's'}`)),
    el('main', { class: 'grid' }, ...cards)], fit };
}

function canvas(o) {
  const i = design.options.indexOf(o), count = design.options.length;
  const prev = design.options[(i - 1 + count) % count], next = design.options[(i + 1) % count];
  const phone = scaled(FRAMES.phone.width + FRAMES.phone.bezel * 2, FRAMES.phone.height + FRAMES.phone.bezel * 2, phoneFrame(frame(o, `Option ${o.n} at ${FRAMES.phone.width}px`)));
  const desktop = scaled(FRAMES.desktop.width, FRAMES.desktop.height, el('div', { class: 'artboard' }, frame(o, `Option ${o.n} at ${FRAMES.desktop.width}px`)));
  const board = el('div', { class: 'board' },
    el('figure', {}, phone, el('figcaption', {}, `Phone · ${FRAMES.phone.width}`)),
    el('figure', {}, desktop, el('figcaption', {}, `Desktop · ${FRAMES.desktop.width}`)));
  const area = el('main', { class: 'canvas' }, board);
  const fit = () => {
    const f = fitCanvas(area.clientWidth);
    board.classList.toggle('stacked', f.stacked);
    phone.rescale(f.phone);
    desktop.rescale(f.desktop);
  };
  return { body: [el('header', { class: 'bar' }, link('#/', '← All options', 'button'),
    el('h1', {}, `Option ${o.n}`, el('span', { class: 'muted' }, ` ${o.label} · ${i + 1} of ${count}`)),
    el('nav', {}, link(`#/o/${prev.n}`, '‹', 'button icon'), link(`#/o/${next.n}`, '›', 'button icon'), link(`#/o/${o.n}/full`, 'Fullscreen', 'button primary'))),
  errorBar(o.n), area], fit };
}

function full(o) {
  const exit = el('a', { href: `#/o/${o.n}`, class: 'button exit', 'aria-label': 'Exit fullscreen' }, '✕ Exit');
  document.documentElement.requestFullscreen?.().catch(() => {}); // iPhone has no element fullscreen; the page still fills the viewport.
  return { body: [el('main', { class: 'full' }, frame(o, `Option ${o.n} fullscreen`)), exit] };
}

function render() {
  const [, n, mode] = location.hash.match(/^#\/o\/(\d+)(\/full)?$/) ?? [];
  const o = n && option(Number(n));
  if (!mode && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  frames = [];
  resize?.disconnect();
  const view = !o || o.error ? grid() : mode ? full(o) : canvas(o);
  document.title = o ? `Option ${o.n} · ${design.name}` : design.name;
  app.className = !o || o.error ? 'page-grid' : mode ? 'page-full' : 'page-canvas';
  app.replaceChildren(...view.body);
  if (view.fit) { resize = new ResizeObserver(view.fit); resize.observe(app); }
}

const current = () => Number(location.hash.match(/^#\/o\/(\d+)/)?.[1]);
const leaveFull = () => { if (location.hash.endsWith('/full')) location.hash = `#/o/${current()}`; };

window.addEventListener('message', (e) => {
  const from = frames.find((f) => isTrustedPreviewMessageSource(e.source, f.iframe.contentWindow));
  if (!from) return;
  if (isIframeErrorMessage(e.data)) {
    const d = e.data, list = errors.get(from.n) ?? [];
    const line = formatIframeError(d.kind, d.message, d.source, d.lineno);
    if (!list.includes(line)) list.push(line);
    errors.set(from.n, list.slice(-50));
    if (current() === from.n) document.querySelector('.error-bar')?.replaceWith(errorBar(from.n));
  } else if (e.data?.__codesign === true && e.data.type === 'PREVIEW_ESCAPE') leaveFull();
});
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') leaveFull(); });
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) leaveFull(); });
window.addEventListener('hashchange', render);
render();
