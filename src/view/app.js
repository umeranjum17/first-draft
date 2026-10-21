// The first-draft view: every option of a design as a grid, one option in the Studio (a brief column beside a canvas showing one device at a time), fullscreen, and Play (clickable screens).
// Each option renders from the frame origin in an iframe sandboxed to scripts only; it can post only errors, Escape and (in Play) its active screen back.
import { isIframeErrorMessage } from '../../vendor/open-codesign/packages/runtime/src/iframe-errors.ts';
import { FRAMES, SANDBOX, deviceFor, fitDevice, formatIframeError, isTrustedPreviewMessageSource, pageFor } from './canvas.js';
import './view.css';

const design = JSON.parse(document.getElementById('design').textContent);
const app = document.getElementById('app');
const errors = new Map(); // option number -> runtime error lines
let frames = []; // [{ n, iframe }] currently mounted
let resize = null;
let draft = ''; // the Studio brief being written, kept across options and devices

const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined) e.setAttribute(k, v);
  e.append(...kids);
  return e;
};

function frame(option, title, lazy, query = '') {
  // sandbox is set before src so the first navigation is already sandboxed.
  const iframe = el('iframe', { sandbox: SANDBOX, referrerpolicy: 'no-referrer', title, loading: lazy ? 'lazy' : undefined });
  iframe.src = `${design.frames}/o/${option.n}${query}`;
  frames.push({ n: option.n, iframe });
  return iframe;
}

// PreviewPane.tsx ScaledPreviewFrame: lay the artboard out at its real size and scale it down.
// `pins` (this option's comments) are drawn in a layer over the frame, in this page, outside the iframe; `pad` is the bezel around the screen.
function scaled(width, height, child, pins = [], pad = 0) {
  const inner = el('div', { class: 'scaled-inner' }, child);
  inner.style.width = `${width}px`;
  inner.style.height = `${height}px`;
  const layer = pins.length ? pinLayer(pins) : null;
  const outer = el('div', { class: 'scaled' }, inner, ...(layer ? [layer] : []));
  outer.rescale = (scale) => {
    if (layer) Object.assign(layer.style, { left: `${pad * scale}px`, top: `${pad * scale}px`, width: `${(width - pad * 2) * scale}px`, height: `${(height - pad * 2) * scale}px` });
    outer.style.width = `${width * scale}px`;
    outer.style.height = `${height * scale}px`;
    inner.style.transform = `scale(${scale})`;
  };
  return outer;
}

// PinOverlay.tsx: numbered round pins over the preview, read-only. Placed by fraction of the frame instead of an element rect,
// so they hold at any scale; a pin shows its comment text when clicked or tapped.
function pinLayer(pins) {
  const layer = el('div', { class: 'pins' });
  pins.forEach((p, i) => {
    const pin = el('button', { type: 'button', class: 'pin', 'aria-label': `Comment ${i + 1}`, 'aria-expanded': 'false', 'data-i': i }, String(i + 1));
    const bubble = el('div', { class: `pin-bubble${p.y > 0.6 ? ' up' : ''}`, role: 'note', hidden: '' }, p.text);
    const wrap = el('div', { class: 'pin-wrap' }, pin);
    wrap.style.left = `${p.x * 100}%`; // the bubble is placed from --x by CSS, so it stays inside the frame
    wrap.style.top = `${p.y * 100}%`;
    bubble.style.setProperty('--x', `${p.x * 100}%`);
    bubble.style.setProperty('--y', `${p.y * 100}%`);
    pin.bubble = bubble;
    pin.onclick = () => {
      const open = pin.getAttribute('aria-expanded') !== 'true';
      document.querySelectorAll('.pin').forEach((o) => {
        const on = open && o.getAttribute('data-i') === String(i);
        o.setAttribute('aria-expanded', String(on));
        o.bubble.hidden = !on;
      });
    };
    layer.append(wrap, bubble);
  });
  return layer;
}
const pinsFor = (o) => design.pins.filter((p) => p.option === o.n);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const pinsNotice = () => design.pinsError ? [el('div', { class: 'error-bar', role: 'alert' }, el('div', {}, design.pinsError))] : [];

// PhoneFrame.tsx: bezel, screen, Dynamic Island and home indicator around the iframe.
const phoneFrame = (iframe) => el('div', { class: 'phone' }, el('div', { class: 'phone-screen' }, iframe),
  el('div', { class: 'phone-island', 'aria-hidden': 'true' }), el('div', { class: 'phone-home', 'aria-hidden': 'true' }));
// One option on one device: the phone in its frame, the desktop on an artboard, each laid out at its real size.
const artFor = (dev, iframe, pins) => {
  const f = FRAMES[dev];
  return dev === 'phone' ? scaled(f.width + f.bezel * 2, f.height + f.bezel * 2, phoneFrame(iframe), pins, f.bezel) : scaled(f.width, f.height, el('div', { class: 'artboard' }, iframe), pins);
};
const devices = (base, dev) => el('nav', { class: 'devices', 'aria-label': 'Viewport' },
  ...['desktop', 'phone'].map((d) => el('a', { href: `${base}/${d}`, 'aria-current': d === dev ? 'true' : undefined }, d === 'phone' ? 'Phone' : 'Desktop')));

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
  return { body: [el('header', { class: 'bar' }, brand(), el('h1', {}, design.name), el('span', { class: 'muted' }, `${design.options.length} option${design.options.length === 1 ? '' : 's'}`)),
    el('main', { class: 'grid' }, ...cards)], fit };
}

const brand = () => el('img', { class: 'brand', src: '/favicon.svg', alt: '', width: '24', height: '24' });

// A shell word as typed: plain words stay bare, anything else is single-quoted.
const shellWord = (s) => /^[\w./-]+$/.test(s) ? s : `'${s.replaceAll("'", "'\\''")}'`;

// The Studio brief: the view runs no model, so a brief becomes the refine command that makes it, ready to copy into a terminal.
function brief(o) {
  const text = el('textarea', { rows: '3', 'aria-label': `Brief for a change to Option ${o.n}`, placeholder: `Describe a change to Option ${o.n}` });
  text.value = draft;
  text.oninput = () => { draft = text.value; };
  const result = el('div', { class: 'command', hidden: '' });
  const form = el('form', { class: 'brief' }, el('label', { class: 'kicker' }, 'Next brief'), result, text,
    el('div', { class: 'brief-row' }, el('span', { class: 'muted' }, 'For your terminal'), el('button', { type: 'submit', class: 'button primary' }, 'Get command')));
  text.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } };
  form.onsubmit = (e) => {
    e.preventDefault();
    const change = text.value.trim();
    if (!change) return text.focus();
    const out = o.file.replace(/(\.[^.]*)?$/, (ext) => `-refined${ext}`);
    const code = el('code', {}, `first-draft-axi refine ${shellWord(o.file)} ${shellWord(change)} --out ${shellWord(out)}`);
    const copy = el('button', { type: 'button', class: 'button' }, 'Copy');
    copy.onclick = async () => {
      try { await navigator.clipboard.writeText(code.textContent); copy.textContent = 'Copied'; }
      catch { getSelection().selectAllChildren(code); copy.textContent = document.execCommand('copy') ? 'Copied' : 'Selected'; } // no clipboard API off https: copy the selection
    };
    result.replaceChildren(el('pre', {}, code), el('div', { class: 'brief-row' }, el('span', { class: 'muted' }, `Run it in the design's folder. It writes ${out} and leaves Option ${o.n} as it is.`), copy));
    result.hidden = false;
  };
  return form;
}

// Studio: the design, its options and the open option's comments in a column beside the canvas, the brief under them.
// Under 860px (view.css) the column moves below the canvas and the brief docks at the bottom of the screen.
function canvas(o, device) {
  const dev = deviceFor(device, innerWidth), f = FRAMES[dev], pins = pinsFor(o);
  const art = o.error ? null : artFor(dev, frame(o, `Option ${o.n} at ${f.width}px`), pins);
  const stage = el('div', { class: 'stage dotted' }, art ?? el('div', { class: 'thumb-error', role: 'alert' }, o.error));
  const zoom = el('span', { class: 'muted zoom' });
  const pick = el('select', { 'aria-label': 'Option' }, ...design.options.map((x) => el('option', { value: x.n, selected: x === o ? '' : undefined }, `Option ${x.n} · ${x.label}`)));
  pick.onchange = () => { location.hash = `#/o/${pick.value}/${dev}`; };
  const tools = el('div', { class: 'tools' }, pick, devices(`#/o/${o.n}`, dev), zoom,
    ...(o.error ? [] : [link(`#/o/${o.n}/full`, 'Fullscreen', 'button'), link(`#/o/${o.n}/play/${dev}`, 'Play', 'button primary')]));

  const options = el('ol', { class: 'list' }, ...design.options.map((x) => el('li', {}, el('a', { href: `#/o/${x.n}/${dev}`, 'aria-current': x === o ? 'page' : undefined },
    el('span', { class: 'num' }, String(x.n)), el('span', { class: 'name' }, x.label), el('span', { class: 'muted' }, x.error ? 'cannot open' : pinsFor(x).length ? plural(pinsFor(x).length, 'comment') : '')))));
  const notes = pins.length ? el('ol', { class: 'list' }, ...pins.map((p, i) => {
    const b = el('button', { type: 'button' }, el('span', { class: 'num pin-num' }, String(i + 1)), el('span', { class: 'name' }, p.text));
    b.onclick = () => document.querySelector(`.pin[data-i="${i}"]`)?.click(); // the pin with this number opens its comment on the canvas
    return el('li', {}, b);
  })) : el('p', { class: 'muted' }, 'No comments on this option.');
  const side = el('aside', { class: 'side', 'aria-label': 'Design' },
    el('section', {}, el('p', { class: 'kicker' }, 'Design'), el('h2', { class: 'title' }, design.name), el('p', { class: 'muted' }, plural(design.options.length, 'option'))),
    el('section', {}, el('h3', { class: 'kicker' }, 'Options'), options),
    el('section', {}, el('h3', { class: 'kicker' }, `Comments on Option ${o.n}`), notes));

  const body = [el('header', { class: 'bar' }, brand(), el('h1', {}, design.name, el('span', { class: 'muted' }, ` · Option ${o.n}`)), link('#/', 'All options', 'button')),
    el('div', { class: 'studio' }, side, el('main', { class: 'work' }, tools, errorBar(o.n), ...pinsNotice(), stage), ...(o.error ? [] : [brief(o)]))];
  return { body, dev, fit: art && (() => {
    const scale = fitDevice(dev, stage.clientWidth, stage.clientHeight);
    art.rescale(scale);
    zoom.textContent = `${f.width} × ${f.height} · ${Math.round(scale * 100)}%`;
  }) };
}

function full(o) {
  const exit = el('a', { href: `#/o/${o.n}`, class: 'button exit', 'aria-label': 'Exit fullscreen' }, '✕ Exit');
  document.documentElement.requestFullscreen?.().catch(() => {}); // iPhone has no element fullscreen; the page still fills the viewport.
  return { body: [el('main', { class: 'full' }, frame(o, `Option ${o.n} fullscreen`)), exit] };
}

// Play: one option as a clickable prototype on one device. The option's screens (the overlay's data-oc-screen sections) are
// reported by the option as it moves; the bar lists them, and Back steps through the screens visited.
let playing = null; // { iframe, screens, current, canBack } while the Play page is open
function playControls() {
  const { iframe, screens, current, canBack } = playing;
  const tell = (msg) => iframe.contentWindow?.postMessage({ __firstDraft: true, ...msg }, '*'); // the sandboxed option has an opaque origin, so no origin can be named
  const back = el('button', { type: 'button', class: 'button', disabled: canBack ? undefined : '' }, '← Back');
  back.onclick = () => tell({ type: 'BACK' });
  const chips = screens.map((id) => {
    const b = el('button', { type: 'button', class: 'button chip', 'aria-current': id === current ? 'true' : undefined }, id);
    b.onclick = () => tell({ type: 'GO', id });
    return b;
  });
  return [back, ...(chips.length ? chips : [el('span', { class: 'muted' }, 'Single screen')])];
}

function play(o, device) {
  const dev = deviceFor(device, innerWidth), f = FRAMES[dev];
  const iframe = frame(o, `Option ${o.n} Play at ${f.width}px`, false, '?play');
  playing = { iframe, screens: [], current: null, canBack: false };
  const controls = el('div', { class: 'play-controls' }, ...playControls());
  const art = artFor(dev, iframe, pinsFor(o));
  const stage = el('main', { class: 'stage' }, art);
  return { body: [el('header', { class: 'bar' }, link(`#/o/${o.n}/${dev}`, '✕ Exit', 'button'), el('h1', {}, `Option ${o.n}`, el('span', { class: 'muted' }, ` ${o.label} · Play`)), devices(`#/o/${o.n}/play`, dev)),
    controls, errorBar(o.n), ...pinsNotice(), stage], dev, fit: () => art.rescale(fitDevice(dev, stage.clientWidth, stage.clientHeight)) };
}

function render() {
  const [, n, mode, device] = location.hash.match(/^#\/o\/(\d+)(?:\/(full|play))?(?:\/(phone|desktop))?$/) ?? [];
  const o = n && option(Number(n));
  const page = pageFor(o, mode);
  playing = null;
  if (page !== 'full' && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  frames = [];
  resize?.disconnect();
  const view = page === 'grid' ? grid() : page === 'full' ? full(o) : page === 'play' ? play(o, device) : canvas(o, device);
  document.title = o ? `Option ${o.n} · ${design.name}` : design.name;
  app.className = `page-${page}`;
  app.replaceChildren(...view.body);
  // With no device in the route, the page follows the window: a resize past the phone width switches the device.
  if (view.fit) { resize = new ResizeObserver(() => (!device && deviceFor(undefined, innerWidth) !== view.dev ? render() : view.fit())); resize.observe(app); }
}

const current = () => Number(location.hash.match(/^#\/o\/(\d+)/)?.[1]);
const leaveFull = () => { if (/\/(full|play)/.test(location.hash)) location.hash = `#/o/${current()}`; };

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
  else if (playing?.iframe === from.iframe && e.data?.__firstDraft === true && e.data.type === 'SCREEN') {
    const d = e.data;
    Object.assign(playing, { screens: Array.isArray(d.screens) ? d.screens.filter((id) => typeof id === 'string') : [], current: String(d.current ?? ''), canBack: d.canBack === true });
    document.querySelector('.play-controls')?.replaceChildren(...playControls());
  }
});
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') leaveFull(); });
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) leaveFull(); });
window.addEventListener('hashchange', render);
render();
