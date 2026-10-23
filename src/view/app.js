// The first-draft view: every option of a design as a grid, one option in the Studio (a brief column beside a canvas showing the desktop and the phone side by side, or one of them), fullscreen, and Play (clickable screens).
// Each option renders from the frame origin in an iframe sandboxed to scripts only; it can post only errors, Escape and (in Play) its active screen back.
import { isIframeErrorMessage } from '../../vendor/open-codesign/packages/runtime/src/iframe-errors.ts';
import { FRAMES, PIN_GUTTER, SANDBOX, commentBubblePosition, commentKeyAction, deviceFor, fitDevice, formatIframeError, isTrustedPreviewMessageSource, pageFor, pairGap } from './canvas.js';
import './view.css';

const design = JSON.parse(document.getElementById('design').textContent);
const app = document.getElementById('app');
const errors = new Map(); // option number -> runtime error lines
let frames = []; // [{ n, iframe }] currently mounted
let resize = null;
let draft = ''; // the Studio brief being written, kept across options and devices
let column = true; // the Studio's column (and its brief) shown on a wide screen; Hide brief folds it away until Show brief
let openPin = null; // the comment number to open once the next page is drawn (a comment just added, or one on the other device)
let lastCanvas = null; // the Studio route Play's Exit goes back to

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
// `pins` (this option's comments on this device) are drawn in a layer over the frame, in this page, outside the iframe; `pad` is the bezel around the screen.
// `point(x, y, at)`, when given, is called with the fractions of the screen a person taps in comment mode (a layer over the screen catches the tap).
function scaled(width, height, child, pins = [], pad = 0, point) {
  const inner = el('div', { class: 'scaled-inner' }, child);
  inner.style.width = `${width}px`;
  inner.style.height = `${height}px`;
  const layer = pins.length ? pinLayer(pins) : null;
  const catcher = point && el('div', { class: 'catch', 'aria-hidden': 'true' });
  if (catcher) catcher.onclick = (e) => { const b = catcher.getBoundingClientRect(); point((e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height, { left: e.clientX - 6, top: e.clientY - 6, width: 12, height: 12 }); };
  const outer = el('div', { class: 'scaled' }, inner, ...[layer, catcher].filter(Boolean));
  outer.rescale = (scale) => {
    const screen = { left: `${pad * scale}px`, top: `${pad * scale}px`, width: `${(width - pad * 2) * scale}px`, height: `${(height - pad * 2) * scale}px` };
    if (catcher) Object.assign(catcher.style, screen);
    if (layer) {
      Object.assign(layer.style, screen);
      layer.layout((width - pad * 2) * scale, (height - pad * 2) * scale);
    }
    outer.style.width = `${width * scale}px`;
    outer.style.height = `${height * scale}px`;
    inner.style.transform = `scale(${scale})`;
  };
  return outer;
}

// PinOverlay.tsx: numbered round pins in the margin beside the frame, level with what they point at (a short leader reaches the frame's edge), so no pin covers the page.
// x and y are fractions of the frame, so they hold at any scale; the side is the nearer one. A pin shows its comment text when clicked or tapped, away from the point it names.
function pinLayer(pins) {
  const layer = el('div', { class: 'pins' });
  const items = pins.map((p) => {
    const i = p.i; // the comment's number on its option, the same on every frame and in the column
    const pin = el('button', { type: 'button', class: `pin ${p.x < 0.5 ? 'left' : 'right'}`, 'aria-label': `Comment ${i + 1}`, 'aria-expanded': 'false', 'data-i': i }, String(i + 1));
    const bubble = el('div', { class: 'pin-bubble', role: 'note', hidden: '' }, el('strong', {}, `${i + 1}  `), p.text);
    bubble.style.setProperty('--x', p.x < 0.5 ? '0px' : '100%'); // the bubble is placed from --x by CSS, so it stays inside the frame
    pin.bubble = bubble;
    pin.onclick = () => {
      const open = pin.getAttribute('aria-expanded') !== 'true';
      document.querySelectorAll('.pin').forEach((o) => {
        const on = open && o === pin;
        o.setAttribute('aria-expanded', String(on));
        o.bubble.hidden = !on;
        o.bubble.style.translate = '';
      });
      // Under 860px the brief is docked over the bottom of the screen: lift the open comment clear of it.
      const dock = document.querySelector('.brief');
      if (open && dock && getComputedStyle(dock).position === 'sticky') {
        const over = bubble.getBoundingClientRect().bottom - (dock.getBoundingClientRect().top - 8);
        if (over > 0) bubble.style.translate = `0 -${over}px`;
      }
    };
    layer.append(pin, bubble);
    return { p, pin, bubble };
  });
  // Each side's pins keep to their own column, level with their point and at least 34px apart (the 28px pin plus a gap); w and h are the frame's size on screen.
  layer.layout = (w, h) => {
    for (const side of ['left', 'right']) {
      const mine = items.filter((it) => (it.p.x < 0.5 ? 'left' : 'right') === side).sort((a, b) => a.p.y - b.p.y);
      let prev = -20;
      const ys = mine.map((it) => (prev = Math.max(it.p.y * h, prev + 34)));
      for (let k = ys.length - 1, limit = h - 14; k >= 0; k--, limit = ys[k + 1] - 34) ys[k] = Math.min(ys[k], limit);
      mine.forEach((it, k) => {
        Object.assign(it.pin.style, { left: `${side === 'left' ? -22 : w + 22}px`, top: `${Math.max(14, ys[k])}px` });
        it.bubble.classList.toggle('up', it.p.y < 0.5); // the far half of the frame from the point
      });
    }
  };
  return layer;
}
const pinsFor = (o) => design.pins.filter((p) => p.option === o.n);
// The option's comments numbered, on one device's frame: those placed on it and those that name no device.
const pinsOn = (o, dev) => pinsFor(o).map((p, i) => ({ ...p, i })).filter((p) => !p.device || p.device === dev);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const pinsNotice = () => design.pinsError ? [el('div', { class: 'error-bar', role: 'alert' }, el('div', {}, design.pinsError))] : [];

// PhoneFrame.tsx: bezel, screen, Dynamic Island and home indicator around the iframe.
const phoneFrame = (iframe) => el('div', { class: 'phone' }, el('div', { class: 'phone-screen' }, iframe),
  el('div', { class: 'phone-island', 'aria-hidden': 'true' }), el('div', { class: 'phone-home', 'aria-hidden': 'true' }));
// One option on one device: the phone in its frame, the desktop on an artboard, each laid out at its real size.
const artFor = (dev, iframe, pins, point) => {
  const f = FRAMES[dev];
  return dev === 'phone' ? scaled(f.width + f.bezel * 2, f.height + f.bezel * 2, phoneFrame(iframe), pins, f.bezel, point) : scaled(f.width, f.height, el('div', { class: 'artboard' }, iframe), pins, 0, point);
};
const NAMES = { both: 'Both', desktop: 'Desktop', phone: 'Phone' };
// The viewport switch; Both (the two side by side) only on the Studio canvas, and only on a wide screen (view.css).
const devices = (base, dev, list = ['desktop', 'phone']) => el('nav', { class: 'devices', 'aria-label': 'Viewport' },
  ...list.map((d) => el('a', { href: `${base}/${d}`, 'aria-current': d === dev ? 'true' : undefined }, NAMES[d])));

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
  return { body: [el('header', { class: 'bar' }, brand(), el('h1', {}, design.name), el('span', { class: 'muted' }, plural(design.options.length, 'option'))),
    el('main', { class: 'grid' }, ...cards)], fit };
}

const brand = () => el('img', { class: 'brand', src: '/favicon.svg', alt: '', width: '24', height: '24' });

// A shell word as typed: plain words stay bare, anything else is single-quoted.
const shellWord = (s) => /^[\w./-]+$/.test(s) ? s : `'${s.replaceAll("'", "'\\''")}'`;

// The Studio brief: sending it runs the person's own agent through the view server (the same refine as the terminal) and the new option joins the picker.
// `job` is the change being made, `result` how the last send ended; both outlive a re-render, so the box is right on any option or device.
let job = null; // { n, started } while a change is being made
let result = null; // { n, text } for the option it ended on, or { n, error, help } for the option it failed on
let clock = null;

const withCode = (s) => s.split('`').map((part, i) => (i % 2 ? el('code', {}, part) : part)); // a hint's `command` is shown as code, not with its backticks

function status(o) {
  const box = el('div', { class: 'run', role: 'status', 'aria-live': 'polite', hidden: '' });
  if (job) {
    const left = el('span', { class: 'muted' });
    const tick = () => { left.textContent = `${Math.round((performance.now() - job.started) / 1000)}s`; };
    tick(); clearInterval(clock); clock = setInterval(tick, 1000);
    box.replaceChildren(el('span', { class: 'spinner', 'aria-hidden': 'true' }), el('span', {}, `Making a new option from Option ${job.n}. This takes a minute or two. `, left));
    box.hidden = false;
  } else if (result && result.n === o.n) {
    box.className = `run${result.error ? ' failed' : ''}`;
    box.setAttribute('role', result.error ? 'alert' : 'status');
    box.replaceChildren(el('span', {}, result.error ?? result.text), ...(result.help ?? []).map((h) => el('span', { class: 'muted' }, ...withCode(h))));
    box.hidden = false;
  }
  return box;
}

async function send(o, change) {
  job = { n: o.n, started: performance.now() };
  result = null;
  refreshBrief();
  try {
    const res = await fetch('/refine', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ option: o.n, change }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(body.error ?? `The view answered ${res.status}`), { help: body.help });
    design.options.push(body.option);
    draft = '';
    result = { n: body.option.n, text: `Option ${body.option.n} is Option ${o.n} with this change: ${change}` };
    if (/^#\/o\/\d+(\/(phone|desktop|both))?$/.test(location.hash)) location.hash = `#/o/${body.option.n}${location.hash.match(/\/(phone|desktop|both)$/)?.[0] ?? ''}`;
  } catch (e) { result = { n: o.n, error: e.message === 'Failed to fetch' ? 'The view cannot be reached. Is first-draft-axi view still running?' : e.message, help: e.help }; }
  job = null;
  clearInterval(clock);
  refreshBrief();
}
const refreshBrief = () => { const o = option(current()); if (o) document.querySelector('form.brief')?.replaceWith(brief(o)); };

function brief(o) {
  const text = el('textarea', { rows: '3', 'aria-label': `Brief for a change to Option ${o.n}`, placeholder: `Describe a change to Option ${o.n}` });
  text.value = draft;
  text.oninput = () => { draft = text.value; };
  const cmd = el('div', { class: 'command', hidden: '' });
  const go = el('button', { type: 'submit', class: 'button primary', disabled: job ? '' : undefined }, job ? 'Working…' : 'Send');
  const terminal = el('button', { type: 'button', class: 'link' }, 'Copy terminal command');
  const form = el('form', { class: 'brief' }, el('label', { class: 'kicker' }, 'Next brief'), status(o), cmd, text, el('div', { class: 'brief-row' }, terminal, go));
  text.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } };
  const command = () => {
    const change = text.value.trim();
    if (!change) return text.focus();
    const out = o.file.replace(/(\.[^.]*)?$/, (ext) => `-refined${ext}`);
    const code = el('code', {}, `first-draft-axi refine ${shellWord(o.file)} ${shellWord(change)} --out ${shellWord(out)}`);
    const copy = el('button', { type: 'button', class: 'button' }, 'Copy');
    copy.onclick = async () => {
      try { await navigator.clipboard.writeText(code.textContent); copy.textContent = 'Copied'; }
      catch { getSelection().selectAllChildren(code); copy.textContent = document.execCommand('copy') ? 'Copied' : 'Selected'; } // no clipboard API off https: copy the selection
    };
    cmd.replaceChildren(el('pre', {}, code), el('div', { class: 'brief-row' }, el('span', { class: 'muted' }, `Run it in the design's folder. It writes ${out} and leaves Option ${o.n} as it is.`), copy));
    cmd.hidden = false;
  };
  terminal.onclick = command;
  form.onsubmit = (e) => {
    e.preventDefault();
    const change = text.value.trim();
    if (job) return;
    if (!change) return text.focus();
    send(o, change);
  };
  return form;
}

// Comment mode: a person taps a point on a frame and writes what should change there; the view server adds it to
// <design>.comments.json and it shows as a pin. `stopCommenting` (set by the Studio) closes the open comment box, else leaves
// comment mode, and answers whether it did either.
let stopCommenting = null;

// CommentBubble.tsx: the box opens beside the tapped point (a mark shows it), never over it; Cmd/Ctrl+Enter saves, Escape closes.
// `done(i)` gets the new comment's number on its option once it is saved. Returns the box's close.
function commentBox(o, dev, x, y, at, done) {
  const mark = el('span', { class: 'comment-mark', 'aria-hidden': 'true' });
  Object.assign(mark.style, { left: `${at.left + at.width / 2}px`, top: `${at.top + at.height / 2}px` });
  const text = el('textarea', { rows: '3', 'aria-label': `Comment on Option ${o.n}`, placeholder: 'What should change here?' });
  const problem = el('p', { class: 'comment-error', role: 'alert', hidden: '' });
  const cancel = el('button', { type: 'button', class: 'button' }, 'Cancel');
  const save = el('button', { type: 'submit', class: 'button primary' }, 'Save');
  const box = el('form', { class: 'comment-box', 'aria-label': 'Add a comment' }, text, problem, el('div', { class: 'brief-row' }, cancel, save));
  const close = () => { box.remove(); mark.remove(); };
  cancel.onclick = close;
  text.onkeydown = (e) => {
    const act = commentKeyAction(e);
    if (!act) return;
    e.preventDefault();
    e.stopPropagation(); // Escape closes this box only, not comment mode
    if (act === 'send') box.requestSubmit(); else close();
  };
  box.onsubmit = async (e) => {
    e.preventDefault();
    const words = text.value.trim();
    if (!words) return text.focus();
    Object.assign(save, { disabled: true, textContent: 'Saving…' });
    problem.hidden = true;
    try {
      const res = await fetch('/comments', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ option: o.n, device: dev, x, y, text: words }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `The view answered ${res.status}`);
      Object.assign(design, { pins: body.pins, pinsError: body.error });
      close();
      done(pinsFor(o).length - 1);
    } catch (err) {
      problem.textContent = err.message === 'Failed to fetch' ? 'The view cannot be reached. Is first-draft-axi view still running?' : err.message;
      problem.hidden = false;
      Object.assign(save, { disabled: false, textContent: 'Save' });
    }
  };
  app.append(mark, box);
  const b = box.getBoundingClientRect();
  const pos = commentBubblePosition(at, { width: b.width, height: b.height }, { width: innerWidth, height: innerHeight });
  Object.assign(box.style, { top: `${pos.top}px`, left: `${pos.left}px` });
  text.focus();
  return close;
}

// Studio: the design, its options and the open option's comments in a column beside the canvas, the brief under them.
// On a wide screen the canvas shows the desktop and the phone side by side (Both), each captioned with its own Play, or the one device
// the switch picks. Hide brief folds the column away on a wide screen; under 860px (view.css) there is no Both, the column moves below
// the canvas and the brief docks at the bottom of the screen. Comment (in the More menu under 860px) turns on comment mode.
function canvas(o, device) {
  const dev = deviceFor(device, innerWidth), f = FRAMES[dev], all = pinsFor(o);
  const gutter = (dev === 'both' ? all : pinsOn(o, dev)).length ? PIN_GUTTER : 0;
  let close = null; // the open comment box's
  const point = (d) => (x, y, at) => { close?.(); close = commentBox(o, d, x, y, at, (i) => { openPin = i; render(); }); };
  const one = (d) => artFor(d, frame(o, `Option ${o.n} at ${FRAMES[d].width}px`), pinsOn(o, d), point(d));
  let art = null;
  if (!o.error && dev === 'both') {
    const pair = ['desktop', 'phone'].map((d) => [d, one(d)]);
    art = el('div', { class: 'pair' }, ...pair.map(([d, a]) => el('figure', {},
      el('figcaption', {}, link(`#/o/${o.n}/${d}`, NAMES[d], 'device-name'), el('span', { class: 'muted' }, `${FRAMES[d].width} × ${FRAMES[d].height}`), link(`#/o/${o.n}/play/${d}`, 'Play', 'button play-one')), a)));
    art.style.gap = `${pairGap(gutter > 0)}px`;
    art.rescale = (scale) => pair.forEach(([, a]) => a.rescale(scale));
  } else if (!o.error) art = one(dev);
  const done = el('button', { type: 'button', class: 'button' }, 'Done');
  const hint = el('div', { class: 'comment-hint', role: 'status' }, el('span', {}, 'Tap the spot your comment is about'), done);
  const stage = el('div', { class: 'stage dotted' }, art ?? el('div', { class: 'thumb-error', role: 'alert' }, o.error), ...(art ? [hint] : []));
  const zoom = el('span', { class: 'muted zoom' });
  const pick = el('select', { 'aria-label': 'Option' }, ...design.options.map((x) => el('option', { value: x.n, selected: x === o ? '' : undefined }, `Option ${x.n} · ${x.label}`)));
  pick.onchange = () => { location.hash = `#/o/${pick.value}/${dev}`; };
  // Under 860px (view.css) Fullscreen and Comment move into the More menu, so Play is the one primary in the row.
  const more = el('button', { type: 'button', class: 'button more', popovertarget: 'more-menu', 'aria-label': 'More' }, '⋯');
  const add = el('button', { type: 'button', class: 'button' }, 'Add comment');
  const menu = el('div', { id: 'more-menu', class: 'menu', popover: '' }, link(`#/o/${o.n}/full`, 'Fullscreen', 'button'), add);
  menu.addEventListener('beforetoggle', (e) => {
    if (e.newState !== 'open') return;
    const b = more.getBoundingClientRect();
    Object.assign(menu.style, { top: `${b.bottom + 6}px`, right: `${innerWidth - b.right}px` });
  });
  const tool = el('button', { type: 'button', class: 'button comment-tool', 'aria-pressed': 'false' }, 'Comment');
  const tools = el('div', { class: 'tools' }, pick, devices(`#/o/${o.n}`, dev, ['both', 'desktop', 'phone']), zoom,
    ...(o.error ? [] : [tool, link(`#/o/${o.n}/full`, 'Fullscreen', 'button full-link'), more, menu, link(`#/o/${o.n}/play/${dev === 'both' ? 'desktop' : dev}`, 'Play', 'button primary')]));

  const options = el('ol', { class: 'list' }, ...design.options.map((x) => el('li', {}, el('a', { href: `#/o/${x.n}/${dev}`, 'aria-current': x === o ? 'page' : undefined },
    el('span', { class: 'num' }, String(x.n)), el('span', { class: 'name' }, x.label), el('span', { class: 'muted' }, x.error ? 'cannot open' : pinsFor(x).length ? plural(pinsFor(x).length, 'comment') : '')))));
  const notes = all.length ? el('ol', { class: 'list' }, ...all.map((p, i) => {
    const b = el('button', { type: 'button' }, el('span', { class: 'num pin-num' }, String(i + 1)), el('span', { class: 'name' }, p.text), ...(p.device ? [el('span', { class: 'muted' }, NAMES[p.device])] : []));
    // The pin with this number opens its comment on the canvas; a comment on the other device switches to it first.
    b.onclick = () => { const pin = document.querySelector(`.pin[data-i="${i}"]`); if (pin) pin.click(); else if (p.device) { openPin = i; location.hash = `#/o/${o.n}/${p.device}`; } };
    return el('li', {}, b);
  })) : el('p', { class: 'muted' }, 'No comments on this option yet.');
  const side = el('aside', { id: 'studio-side', class: 'side', 'aria-label': 'Design' },
    el('section', {}, el('p', { class: 'kicker' }, 'Design'), el('h2', { class: 'title' }, design.name), el('p', { class: 'muted' }, plural(design.options.length, 'option'))),
    el('section', {}, el('h3', { class: 'kicker' }, 'Options'), options),
    el('section', {}, el('h3', { class: 'kicker' }, `Comments on Option ${o.n}`), notes));

  const studio = el('div', { class: `studio${column ? '' : ' folded'}` }, side, el('main', { class: 'work' }, tools, errorBar(o.n), ...pinsNotice(), stage), ...(o.error ? [] : [brief(o)]));
  const commenting = (on) => { studio.classList.toggle('commenting', on); tool.setAttribute('aria-pressed', String(on)); if (!on) close?.(); fit?.(); };
  tool.onclick = () => commenting(!studio.classList.contains('commenting'));
  add.onclick = () => { menu.hidePopover(); commenting(true); };
  done.onclick = () => commenting(false);
  stopCommenting = () => {
    if (document.querySelector('.comment-box')) close?.();
    else if (studio.classList.contains('commenting')) commenting(false);
    else return false;
    return true;
  };
  const fit = art && (() => {
    // Under 860px (view.css) the hint takes its own row at the top of the canvas, so the device fits in the room below it.
    const row = hint.offsetHeight && getComputedStyle(hint).position === 'static' ? hint.offsetHeight + 12 : 0;
    const scale = fitDevice(dev, stage.clientWidth, stage.clientHeight - row, gutter);
    art.rescale(scale);
    zoom.textContent = `${dev === 'both' ? 'Side by side' : `${f.width} × ${f.height}`} · ${Math.round(scale * 100)}%`;
  });
  // Wide screens only (view.css): the canvas takes the column's room; under 860px the column is below the canvas and the brief is docked.
  const fold = el('button', { type: 'button', class: 'button fold', 'aria-controls': 'studio-side', 'aria-expanded': String(column) }, column ? 'Hide brief' : 'Show brief');
  fold.onclick = () => {
    column = !column;
    studio.classList.toggle('folded', !column);
    fold.setAttribute('aria-expanded', String(column));
    fold.textContent = column ? 'Hide brief' : 'Show brief';
    fit?.();
  };
  const body = [el('header', { class: 'bar' }, brand(), el('h1', {}, design.name, el('span', { class: 'muted' }, ` · Option ${o.n}`)), fold, link('#/', 'All options', 'button')), studio];
  return { body, dev, fit };
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
  const want = deviceFor(device, innerWidth), dev = want === 'both' ? 'desktop' : want, f = FRAMES[dev]; // Play runs on one device
  const back = lastCanvas?.split('/')[2] === String(o.n) ? lastCanvas : `#/o/${o.n}/${dev}`;
  const iframe = frame(o, `Option ${o.n} Play at ${f.width}px`, false, '?play');
  playing = { iframe, screens: [], current: null, canBack: false };
  const controls = el('div', { class: 'play-controls' }, ...playControls());
  const pins = pinsOn(o, dev), art = artFor(dev, iframe, pins);
  const stage = el('main', { class: 'stage' }, art);
  return { body: [el('header', { class: 'bar' }, link(back, '✕ Exit', 'button'), el('h1', {}, `Option ${o.n}`, el('span', { class: 'muted' }, ` ${o.label} · Play`)), devices(`#/o/${o.n}/play`, dev)),
    controls, errorBar(o.n), ...pinsNotice(), stage], dev: want, fit: () => art.rescale(fitDevice(dev, stage.clientWidth, stage.clientHeight, pins.length ? PIN_GUTTER : 0)) };
}

function render() {
  const [, n, mode, device] = location.hash.match(/^#\/o\/(\d+)(?:\/(full|play))?(?:\/(phone|desktop|both))?$/) ?? [];
  const o = n && option(Number(n));
  const page = pageFor(o, mode);
  playing = null;
  stopCommenting = null;
  if (page !== 'full' && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  frames = [];
  resize?.disconnect();
  const view = page === 'grid' ? grid() : page === 'full' ? full(o) : page === 'play' ? play(o, device) : canvas(o, device);
  document.title = o ? `Option ${o.n} · ${design.name}` : design.name;
  app.className = `page-${page}`;
  app.replaceChildren(...view.body);
  if (page === 'canvas') lastCanvas = location.hash;
  if (openPin !== null) { const i = openPin; openPin = null; requestAnimationFrame(() => document.querySelector(`.pin[data-i="${i}"]`)?.click()); }
  // The page follows the window: a resize past the phone width, or below the width for Both, switches the device.
  if (view.fit) { resize = new ResizeObserver(() => (view.dev && deviceFor(device, innerWidth) !== view.dev ? render() : view.fit())); resize.observe(app); }
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
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !stopCommenting?.()) leaveFull(); });
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) leaveFull(); });
window.addEventListener('hashchange', render);
document.addEventListener('touchstart', () => {}, { passive: true }); // iOS Safari shows :active (the press states) only on a page that listens for touches
render();
