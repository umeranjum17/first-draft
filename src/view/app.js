// The first-draft view: every option of a design as a grid, one option in the Studio (a panel beside a canvas showing the desktop and the phone side by side, or one of them), fullscreen, and Play (clickable screens).
// Each option renders from the frame origin in an iframe sandboxed to scripts only; it can post only errors, Escape and (in Play) its active screen back.
import { isIframeErrorMessage } from '../../vendor/studio-runtime/src/iframe-errors.ts';
import { BOTH_MIN, FRAMES, PIN_GUTTER, SANDBOX, WIDE, commentBubblePosition, commentKeyAction, deviceFor, fitDevice, formatIframeError, isTrustedPreviewMessageSource, pageFor, pairGap } from './canvas.js';
import './view.css';

const design = JSON.parse(document.getElementById('design').textContent);
const app = document.getElementById('app');
const errors = new Map(); // option number -> runtime error lines
let frames = []; // [{ n, iframe }] currently mounted
let resize = null;
let draft = ''; // the Studio brief being written, kept across options and devices
let column = true; // the Studio's panel (and its brief) shown on a wide screen; Hide brief folds it away until Show brief
let openPin = null; // the comment number to open once the next page is drawn (a comment just added, or one on the other device)
let lastCanvas = null; // the Studio route Play's Exit goes back to
// The device a viewer last picked on a wide screen, kept in this browser for the view's address; a route that names a device wins.
const DEVICE_KEY = 'first-draft-device';
const remembered = () => { try { return localStorage.getItem(DEVICE_KEY); } catch { return null; } };
const remember = (d) => { try { localStorage.setItem(DEVICE_KEY, d); } catch { /* private window or blocked storage: the default stands */ } };
// The Studio's device: the route's, else the remembered one on a wide screen, else Both where it fits large in the canvas the panel
// leaves (the bar is 48px, the canvas 8px from the edges, the panel 296px), else Desktop.
const studioDevice = (device) => {
  const roomy = fitDevice('both', innerWidth - (column ? 296 : 0) - 16, innerHeight - 56) >= BOTH_MIN;
  return deviceFor(device ?? (innerWidth >= WIDE ? remembered() ?? undefined : undefined), innerWidth, roomy);
};

const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined) e.setAttribute(k, v);
  e.append(...kids);
  return e;
};
// Icons: 24px strokes drawn at 16px.
const ICONS = {
  panel: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9.5 4v16"/>',
  chevron: '<path d="m7 10 5 5 5-5"/>',
  both: '<rect x="2.5" y="5" width="13" height="10" rx="1.6"/><path d="M6 19h6M9 15v4"/><rect x="17" y="8" width="4.5" height="11" rx="1.2"/>',
  desktop: '<rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M8.5 20h7M12 16.5V20"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.4"/><path d="M11 18.5h2"/>',
  comment: '<path d="M20 11.5a7.5 7.5 0 0 1-11 6.6L4.5 19.5l1.3-4A7.5 7.5 0 1 1 20 11.5Z"/>',
  full: '<path d="M14.5 4.5h5v5M9.5 19.5h-5v-5M19.5 4.5 13.8 10.2M4.5 19.5l5.7-5.7"/>',
  play: '<path d="M7.5 5.2v13.6a.6.6 0 0 0 .9.5l11-6.8a.6.6 0 0 0 0-1L8.4 4.7a.6.6 0 0 0-.9.5Z"/>',
  send: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  terminal: '<path d="m5 7 5 5-5 5M12.5 17.5h6.5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  back: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
  more: '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  alert: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.8v5M12 16.2v.1"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 8.5V5.5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"/>',
};
const icon = (name, cls = '') => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('class', `i${cls ? ` ${cls}` : ''}`);
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = ICONS[name];
  return s;
};

function frame(option, title, lazy, query = '') {
  // sandbox is set before src so the first navigation is already sandboxed.
  const iframe = el('iframe', { sandbox: SANDBOX, referrerpolicy: 'no-referrer', title, loading: lazy ? 'lazy' : undefined });
  const screen = new URLSearchParams(location.search).get('screen');
  const suffix = screen ? `${query || '?'}${query ? '&' : ''}screen=${encodeURIComponent(screen)}` : query;
  iframe.src = `${design.frames}/o/${option.n}${suffix}`;
  frames.push({ n: option.n, iframe });
  return iframe;
}
// Paper lines over a frame until its page has loaded.
const skeleton = (iframe) => {
  const s = el('div', { class: 'skeleton', 'aria-hidden': 'true' }, el('i'), el('i'), el('i'), el('i'));
  iframe.addEventListener('load', () => s.remove(), { once: true });
  return s;
};

// PreviewPane.tsx ScaledPreviewFrame: lay the artboard out at its real size and scale it.
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
    inner.style.setProperty('--unscaled-10', `${10 / scale}px`);
  };
  return outer;
}

// PinOverlay.tsx: numbered round pins in the margin beside the frame, level with what they point at (a short leader reaches the frame's edge), so no pin covers the page.
// x and y are fractions of the frame, so they hold at any scale; the side is the nearer one. A pin shows its comment text when clicked or tapped, away from the point it names.
function pinLayer(pins) {
  const layer = el('div', { class: 'pins' });
  const items = pins.map((p) => {
    const i = p.i; // the comment's number on its option, the same on every frame and in the panel
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
  // Each side's pins keep to their own column, level with their point and at least 32px apart (the 26px pin plus a gap); w and h are the frame's size on screen.
  layer.layout = (w, h) => {
    for (const side of ['left', 'right']) {
      const mine = items.filter((it) => (it.p.x < 0.5 ? 'left' : 'right') === side).sort((a, b) => a.p.y - b.p.y);
      let prev = -20;
      const ys = mine.map((it) => (prev = Math.max(it.p.y * h, prev + 32)));
      for (let k = ys.length - 1, limit = h - 13; k >= 0; k--, limit = ys[k + 1] - 32) ys[k] = Math.min(ys[k], limit);
      mine.forEach((it, k) => {
        Object.assign(it.pin.style, { left: `${side === 'left' ? -22 : w + 22}px`, top: `${Math.max(13, ys[k])}px` });
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
const pinsNotice = () => design.pinsError ? [el('div', { class: 'error-bar', role: 'alert' }, el('div', {}, el('strong', {}, 'Comments'), el('span', { class: 'error-text' }, design.pinsError)))] : [];

// PhoneFrame.tsx: bezel, screen, Dynamic Island and home indicator around the iframe.
const phoneFrame = (iframe) => el('div', { class: 'phone' }, el('div', { class: 'phone-screen' }, iframe, skeleton(iframe)),
  el('div', { class: 'phone-island', 'aria-hidden': 'true' }), el('div', { class: 'phone-home', 'aria-hidden': 'true' }));
// One option on one device: the phone in its frame, the desktop on an artboard, each laid out at its real size.
const artFor = (dev, iframe, pins, point) => {
  const f = FRAMES[dev];
  return dev === 'phone' ? scaled(f.width + f.bezel * 2, f.height + f.bezel * 2, phoneFrame(iframe), pins, f.bezel, point) : scaled(f.width, f.height, el('div', { class: 'artboard' }, iframe, skeleton(iframe)), pins, 0, point);
};
const NAMES = { both: 'Both', desktop: 'Desktop', phone: 'Phone' };
// The viewport switch; Both (the two side by side) only on the Studio canvas, and only on a wide screen (view.css).
// `keep` (the Studio's switch): a device picked on a wide screen is remembered for the next Studio this viewer opens.
const devices = (base, dev, list = ['desktop', 'phone'], keep = false) => el('nav', { class: 'devices', 'aria-label': 'Viewport' },
  ...list.map((d) => {
    const a = el('a', { href: `${base}/${d}`, 'aria-current': d === dev ? 'true' : undefined, title: NAMES[d] }, icon(d), el('span', { class: 'label' }, NAMES[d]));
    if (keep) a.addEventListener('click', () => { if (innerWidth >= WIDE) remember(d); });
    return a;
  }));

// CanvasErrorBar.tsx: the latest runtime error of the open option, with a count and a dismiss button.
function errorBar(n) {
  const list = errors.get(n) ?? [];
  if (!list.length) return el('div', { class: 'error-bar', hidden: '' });
  const dismiss = el('button', { type: 'button', class: 'button icon', 'aria-label': 'Dismiss errors' }, icon('close'));
  dismiss.onclick = () => { errors.delete(n); document.querySelector('.error-bar')?.replaceWith(errorBar(n)); };
  return el('div', { class: 'error-bar', role: 'alert' },
    el('div', {}, el('strong', {}, `Runtime error${list.length > 1 ? ` (${list.length})` : ''}`), el('span', { class: 'error-text', title: list.at(-1) }, list.at(-1))), dismiss);
}

const option = (n) => design.options.find((o) => o.n === n);
const link = (href, text, cls) => el('a', { href, class: cls }, text);
const home = () => el('a', { class: 'home', href: '#/', 'aria-label': 'All options' }, el('img', { class: 'brand', src: '/favicon.svg', alt: '', width: '22', height: '22' }));
// The running first-draft, quiet at the foot of the picker, the Studio's panel and its More menu; a source checkout's says -dev (src/version.mjs).
const version = (tag = 'p') => el(tag, { class: 'version' }, `first-draft ${design.version}`);

// Menus are popovers: under their button on a wide screen, a sheet at the foot of a phone's screen (view.css).
function menu(id, button, ...items) {
  const m = el('div', { id, class: 'menu', popover: '', role: 'menu' }, ...items);
  button.setAttribute('popovertarget', id);
  button.setAttribute('aria-haspopup', 'menu');
  m.addEventListener('beforetoggle', (e) => {
    if (e.newState !== 'open') return;
    const sheet = innerWidth < WIDE;
    m.classList.toggle('sheet', sheet);
    if (sheet) return Object.assign(m.style, { top: '', left: '', right: '' });
    const b = button.getBoundingClientRect();
    Object.assign(m.style, button.dataset.align === 'right' ? { top: `${b.bottom + 6}px`, right: `${innerWidth - b.right}px`, left: 'auto' } : { top: `${b.bottom + 6}px`, left: `${b.left}px`, right: 'auto' });
  });
  return m;
}

// The option picker: every option at desktop and phone width on a sheet of canvas, its number, name and comment count under it.
// The frames load lazily, so an option scrolled out of view costs nothing until it is near.
function grid() {
  const cards = design.options.map((o) => {
    let mat;
    if (o.error) mat = el('div', { class: 'mat broken' }, el('div', { class: 'blank' }, el('div', { class: 'mark' }, icon('alert')), el('p', {}, o.error)));
    else {
      const d = artFor('desktop', frame(o, `Option ${o.n} at desktop width`, true), []), p = artFor('phone', frame(o, `Option ${o.n} at phone width`, true), []);
      mat = el('div', { class: 'mat' }, el('div', { class: 'mat-desktop' }, d), el('div', { class: 'mat-phone' }, p));
      // The desktop takes 70% of the sheet's width, the phone 78% of its height, overlapping the desktop's right edge.
      mat.fit = () => { d.rescale((mat.clientWidth * 0.7) / FRAMES.desktop.width); p.rescale((mat.clientHeight * 0.78) / (FRAMES.phone.height + FRAMES.phone.bezel * 2)); };
    }
    const comments = pinsFor(o).length;
    const card = el('a', { class: 'card', href: `#/o/${o.n}`, 'aria-label': `Option ${o.n}, ${o.label}` }, mat, el('div', { class: 'card-label' }, el('span', { class: 'num' }, String(o.n)), el('span', { class: 'name' }, o.label),
      el('span', { class: o.error ? 'muted broken' : 'muted' }, o.error ? 'Cannot open' : comments ? plural(comments, 'comment') : 'No comments'), el('span', { class: 'open' }, 'Open', icon('arrow'))));
    card.mat = mat;
    return card;
  });
  const bar = el('header', { class: 'bar' }, el('div', { class: 'bar-l' }, home(), el('span', { class: 'title' }, design.name)), el('div', { class: 'bar-c' }), el('div', { class: 'bar-r' }, el('span', { class: 'count' }, plural(design.options.length, 'option'))));
  const head = el('div', { class: 'picker-head' }, el('h1', {}, design.name), el('p', {}, `${plural(design.options.length, 'option')}. Open one to see it at desktop and phone width, comment on it and make a change.`));
  return { body: [bar, el('main', { class: 'picker' }, head, el('div', { class: 'grid' }, ...cards), version('footer'))], fit: () => cards.forEach((c) => c.mat.fit?.()) };
}

// A shell word as typed: plain words stay bare, anything else is single-quoted.
const shellWord = (s) => /^[\w./-]+$/.test(s) ? s : `'${s.replaceAll("'", "'\\''")}'`;

// The Studio brief: sending it runs the person's own agent through the view server (the same refine as the terminal) and the new option joins the picker.
// `job` is the change being made, `result` how the last send ended; both outlive a re-render, so the box is right on any option or device.
let job = null; // { n, started } while a change is being made
let result = null; // { n, made, text } for the option it ended on, or { n, error, help } for the option it failed on
let clock = null;
const seconds = () => `${Math.round((performance.now() - job.started) / 1000)}s`;
const tick = () => document.querySelectorAll('.clock').forEach((c) => { c.textContent = seconds(); });

function status(o) {
  const box = el('div', { class: 'run', role: 'status', 'aria-live': 'polite', hidden: '' });
  if (job) {
    clearInterval(clock); clock = setInterval(tick, 1000);
    box.classList.add('working');
    box.replaceChildren(el('span', { class: 'spinner', 'aria-hidden': 'true' }),
      el('div', { class: 'grow' }, el('div', { class: 'what' }, `Making Option ${design.options.length + 1} from Option ${job.n}`), el('div', { class: 'then' }, `A minute or two. Option ${job.n} stays as it is.`)), el('span', { class: 'clock' }, seconds()));
    box.hidden = false;
  } else if (result?.error && result.n === o.n) {
    box.className = 'run failed';
    box.setAttribute('role', 'alert');
    // A "<route>: first-draft-axi ..." hint shows its command as a code block under the route; a `command` in backticks shows as inline code.
    const hint = (h) => { const m = h.match(/^(.*?):\s*(first-draft-axi .*)$/); return m ? el('div', { class: 'help' }, el('span', {}, m[1]), el('code', {}, m[2]))
      : el('div', { class: 'help inline' }, ...h.split('`').map((part, i) => (i % 2 ? el('code', {}, part) : part))); };
    box.replaceChildren(icon('alert'), el('div', { class: 'grow' }, el('div', { class: 'what' }, result.error), ...(result.help ?? []).map(hint)));
    box.hidden = false;
  } else if (result?.text && result.made === o.n) {
    box.className = 'run done';
    box.replaceChildren(el('span', { class: 'ok', 'aria-hidden': 'true' }, icon('check')), el('div', { class: 'grow' }, el('div', { class: 'what' }, `Option ${result.made} is ready`), el('div', { class: 'then' }, result.text)));
    box.hidden = false;
  }
  return box;
}

async function send(o, change) {
  job = { n: o.n, started: performance.now() };
  result = null;
  refreshStudio?.();
  try {
    const res = await fetch('/refine', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ option: o.n, change }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(body.error ?? `The view answered ${res.status}`), { help: body.help });
    design.options.push(body.option);
    draft = '';
    result = { n: o.n, made: body.option.n, text: `Option ${o.n} with this change: ${change}` };
    job = null;
    clearInterval(clock);
    if (/^#\/o\/\d+(\/(phone|desktop|both))?$/.test(location.hash)) return void (location.hash = `#/o/${body.option.n}${location.hash.match(/\/(phone|desktop|both)$/)?.[0] ?? ''}`);
  } catch (e) { result = { n: o.n, error: e.message === 'Failed to fetch' ? 'The view cannot be reached. Is first-draft-axi view still running?' : e.message, help: e.help }; }
  job = null;
  clearInterval(clock);
  refreshStudio?.();
}
// The Studio redraws its panel and option menu (not its frames) when a change starts or ends; set while the Studio is open.
let refreshStudio = null;
let polishRuns = [], polishTimer, polishCap = 5, polishNotice = '';
const polishBusy = () => polishRuns.some((r) => r.status === 'running');
async function pollPolish() {
  clearTimeout(polishTimer);
  try {
    const response = await fetch('/polish'); if (!response.ok) throw new Error(`Polish status: ${response.status}`);
    const next = (await response.json()).runs;
    if (JSON.stringify(next) !== JSON.stringify(polishRuns)) {
      polishRuns = next;
      for (const run of polishRuns) for (const version of run.versions) if (!design.options.some((o) => o.n === version.option.n)) design.options.push(version.option);
      refreshStudio?.();
    }
    if (polishBusy()) polishTimer = setTimeout(pollPolish, 2000);
  } catch (e) { document.querySelector('.polish-status')?.replaceChildren(el('p', { role: 'alert' }, `${e.message}. Reload to reconnect; the server keeps the run.`)); }
}
if (design.canPolish) pollPolish();

function polishControls(o) {
  const active = polishRuns.find((r) => r.status === 'running'), note = el('p', { role: 'status' }, polishNotice);
  const cap = el('input', { type: 'number', min: '1', max: '50', value: String(polishCap), 'aria-label': 'Maximum polish rounds' });
  cap.oninput = () => { polishCap = Number(cap.value); };
  const start = el('button', { type: 'button', class: 'button line', disabled: job ? '' : undefined }, active ? 'Add polish feedback' : 'Polish to 9/10');
  start.onclick = async () => {
    if (!draft.trim()) { note.textContent = 'Enter the original brief (or feedback) in the brief box below.'; return; }
    try {
      const response = await fetch(active ? '/polish-feedback' : '/polish', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(active ? { id: active.id, text: draft } : { option: o.n, brief: draft, maxRounds: polishCap }) });
      const body = await response.json(); if (!response.ok) throw Error(body.error);
      draft = ''; polishNotice = active ? 'Feedback saved for subsequent rounds.' : 'Polish started.'; await pollPolish(); refreshStudio?.();
    } catch (e) { note.textContent = e.message; }
  };
  return el('section', { class: 'polish-controls' }, el('h2', { class: 'kicker' }, 'Polish chosen direction'), el('p', {}, 'Use the brief box below: original brief to start; feedback while running.'), cap, start, note,
    el('div', { class: 'polish-status', 'aria-live': 'polite' }, ...polishRuns.flatMap((r) => [el('p', {}, `Option ${r.option}: ${r.status} · ${r.state?.final?.score ?? 'unscored'}/10 · ${r.state?.stop_reason?.replaceAll('_', ' ') ?? ''} ${r.error ?? ''}`),
      el('ol', {}, ...r.versions.map((v) => el('li', {}, link(`#/o/${v.option.n}`, `Round ${v.round}: ${v.score}/10${v.accepted ? '' : ' · not promoted'}`), el('p', {}, v.gaps.join(' ')))))])));
}

function brief(o) {
  const text = el('textarea', { rows: '2', 'aria-label': `Brief for a change to Option ${o.n}`, placeholder: `Describe a change to Option ${o.n}` });
  text.value = draft;
  text.oninput = () => { draft = text.value; };
  const cmd = el('div', { class: 'command', hidden: '' });
  const go = el('button', { type: 'submit', class: 'button primary send', 'aria-label': job ? 'Working' : 'Send', title: job ? 'Working' : 'Send', disabled: job || polishBusy() ? '' : undefined }, job ? el('span', { class: 'spinner' }) : icon('send'));
  const terminal = el('button', { type: 'button', class: 'button link' }, icon('terminal'), 'Terminal command');
  const form = el('form', { class: 'brief' }, status(o), cmd, text, el('div', { class: 'brief-row' }, terminal, go));
  text.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } };
  const command = () => {
    const change = text.value.trim();
    if (!change) return text.focus();
    const out = o.file.replace(/(\.[^.]*)?$/, (ext) => `-refined${ext}`);
    const code = el('code', {}, `first-draft-axi refine ${shellWord(o.file)} ${shellWord(change)} --out ${shellWord(out)}`);
    const copy = el('button', { type: 'button', class: 'button line' }, icon('copy'), 'Copy');
    copy.onclick = async () => {
      try { await navigator.clipboard.writeText(code.textContent); copy.lastChild.textContent = 'Copied'; }
      catch { getSelection().selectAllChildren(code); copy.lastChild.textContent = document.execCommand('copy') ? 'Copied' : 'Selected'; } // no clipboard API off https: copy the selection
    };
    cmd.replaceChildren(el('pre', {}, code), el('div', { class: 'brief-row' }, el('span', { class: 'muted' }, `Run it in the design's folder. It writes ${out}.`), copy));
    cmd.hidden = false;
  };
  terminal.onclick = command;
  form.onsubmit = (e) => {
    e.preventDefault();
    const change = text.value.trim();
    if (job || polishBusy()) return;
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

function referencePanel(o) {
  if(o.referenceError) return [el('p',{class:'reference-error',role:'alert'},o.referenceError)];
  const r=o.references; if(!r) return [];
  const source=(href,text)=>el('a',{href,target:'_blank',rel:'noopener noreferrer',class:'reference-link'},text);
  const heading=el('div',{class:'reference-heading'},el('h2',{},`References · ${r.name}`),el('p',{class:'muted'},`Captured ${new Date(r.fetched_at).toLocaleDateString()}`),
    el('div',{},source(r.url,'Source'), ' · ',source(r.terms_url,'Permission note')),
    el('details',{},el('summary',{},'Visual language'),el('p',{},r.brief),el('p',{},r.licence_note)));
  const shots=r.shots.map((s,i)=>el('a',{href:s.src,target:'_blank',rel:'noopener',class:'reference-shot','aria-label':`Open ${i ? 'desktop' : 'phone'} reference`},
    el('img',{src:s.src,alt:`${r.name} reference at ${s.width} pixels`,width:s.width,height:s.height}),el('span',{},`${i ? 'Desktop' : 'Phone'} · ${s.width}px`)));
  return [el('section',{class:'references','aria-label':`Reference images for Option ${o.n}`},heading,...shots)];
}

// What the market does for this brief: every captured competitor with its own live source, beside the options, and every refusal with its reason.
function marketPanel(o) {
  if(o.competitorError) return [el('p',{class:'reference-error',role:'alert'},o.competitorError)];
  const m=o.competitors; if(!m) return [];
  const source=(href,text)=>el('a',{href,target:'_blank',rel:'noopener noreferrer',class:'reference-link'},text);
  // One card per competitor, side by side: every capture stays in view instead of hiding behind a scroll.
  const cards=m.competitors.map((c)=>el('div',{class:'market-card'},
    el('div',{class:'market-text'},
      el('h3',{},source(c.url,c.name)),
      el('p',{class:'market-url'},c.url),
      el('p',{},`Captured ${new Date(c.fetched_at).toLocaleDateString()}`),
      el('div',{},source(c.url,'Source'),' · ',source(c.terms_url,'Permission note'))),
    el('div',{class:'market-shots'},...c.shots.map((s,i)=>el('a',{href:s.src,target:'_blank',rel:'noopener',class:'market-shot','aria-label':`Open the ${i ? 'desktop' : 'phone'} capture of ${c.name}`},
      el('img',{src:s.src,alt:`${c.name} page at ${s.width} pixels`,width:s.width,height:s.height}),el('span',{},`${i ? 'Desktop' : 'Phone'} · ${s.width}px`)))),
    el('details',{},el('summary',{},'Permission'),el('p',{},c.licence_note))));
  const refused=m.refused.map((r)=>el('li',{},r.url?source(r.url,r.name):r.name,el('span',{class:'muted'},` — refused: ${r.why}`)));
  return [el('section',{class:'references market','aria-label':`What the market does, beside Option ${o.n}`},
    el('div',{class:'reference-heading'},el('h2',{},'What the market does'),el('p',{class:'muted'},m.competitors.length?`${plural(m.competitors.length,'competitor')} captured from their own public pages`:'Every page found was refused by its robots or terms review: none is captured and nothing is drawn in their place')),
    ...(cards.length?[el('div',{class:'market-grid'},...cards)]:[]),
    ...(m.refused.length?[el('div',{class:'market-refused'},el('h3',{},`Not captured (${m.refused.length})`),el('p',{class:'muted'},'These were found and refused or failed: nothing is drawn in their place.'),el('ul',{},...refused))]:[]))];
}

// The sources list for this brief: where the free search looked, the pages whose own terms allowed a capture, and every page that
// refused one, kept as a link with the description the search gave it.
function sourcesPanel(o) {
  if(o.sourcesError) return [el('p',{class:'reference-error',role:'alert'},o.sourcesError)];
  const s=o.sources; if(!s) return [];
  const source=(href,text)=>el('a',{href,target:'_blank',rel:'noopener noreferrer',class:'reference-link'},text);
  const where=(x)=>x.url?source(x.url,x.name):el('span',{},x.name);
  const captured=s.sources.filter((x)=>x.status==='captured'), links=s.sources.filter((x)=>x.status!=='captured');
  const cards=captured.map((c)=>el('div',{class:'market-card'},
    el('div',{class:'market-text'},
      el('h3',{},where(c)),
      el('p',{},c.description),
      el('p',{class:'market-url'},`Found on ${c.found_via}${c.internal_reference_only?' · internal reference only':''}`),
      ...(c.url?[el('div',{},source(c.url,'Source'),' · ',source(c.terms_url,'Permission note'))]:[el('p',{class:'muted'},'Captured on the emulator: for internal reference only, never embedded in the design')]),
      ...(c.licence_note?[el('details',{},el('summary',{},'Permission'),el('p',{},c.licence_note))]:[])),
    ...(c.shots?.length?[el('div',{class:'market-shots'},...c.shots.map((sh,i)=>el('a',{href:sh.src,target:'_blank',rel:'noopener',class:'market-shot','aria-label':`Open screen ${i+1} of ${c.name}`},
      el('img',{src:sh.src,alt:`${c.name} at ${sh.width} pixels`,width:sh.width,height:sh.height}),el('span',{},`${sh.width}px`))))]:[])));
  const refused=links.map((r)=>el('li',{},where(r),el('span',{class:'muted'},` — ${r.description}. ${r.why??''}`)));
  // A real run finds more links than a phone panel can show, so a long list starts folded: its summary carries the count and the
  // reason, one click opens every entry, and nothing is dropped. A short list stays open, where it fits.
  const fold=(title,items,note)=>el('details',items.length<=3?{open:''}:{},
    el('summary',{},title),...(note?[el('p',{class:'muted'},note)]:[]),el('ul',{},...items));
  const failed=s.searches.filter((x)=>x.status==='refused');
  const looked=s.searches.filter((x)=>x.status==='ok').length;
  return [el('section',{class:'references market sources','aria-label':`Inspiration sources for Option ${o.n}`},
    el('div',{class:'reference-heading'},el('h2',{},'Inspiration sources'),
      el('p',{class:'muted'},`Searched ${new Date(s.searched_at).toLocaleDateString()} · ${s.product_type} · ${plural(looked,'search')} · ${captured.length} captured, ${links.length} link only`)),
    ...(cards.length?[el('div',{class:'market-grid'},...cards)]:[]),
    ...(links.length?[el('div',{class:'market-refused'},fold(`Link only (${links.length}) — their own terms or robots refuse a capture: open each one yourself`,refused,'Nothing is drawn in their place.'))]:[]),
    ...(failed.length?[el('div',{class:'market-refused'},fold(`Search that refused (${failed.length})`,failed.map((f)=>el('li',{},source(f.url,`${f.source} search`),el('span',{class:'muted'},` — ${f.why}`)))))]:[]))];
}

// The option switcher beside the design's name: its menu lists every option, an option being made, and the grid of all of them.
function switcher(o, dev) {
  const button = el('button', { type: 'button', class: 'button switch', 'aria-label': `Option ${o.n} ${o.label}: switch option` }, el('span', { class: 'num on' }, String(o.n)), el('span', { class: 'name' }, o.label), icon('chevron', 'chev'));
  const m = menu('option-menu', button, el('div', { class: 'label' }, `${design.name} · ${plural(design.options.length, 'option')}`),
    ...design.options.map((x) => el('a', { class: 'item', role: 'menuitem', href: `#/o/${x.n}/${dev}`, 'aria-current': x === o ? 'true' : undefined },
      el('span', { class: `num${x === o ? ' on' : ''}` }, String(x.n)), el('span', { class: 'name' }, x.label), el('span', { class: 'muted' }, x.error ? 'Cannot open' : pinsFor(x).length ? plural(pinsFor(x).length, 'comment') : ''))),
    ...(job ? [el('div', { class: 'item making', 'aria-disabled': 'true' }, el('span', { class: 'spinner', 'aria-hidden': 'true' }), el('span', { class: 'name' }, `Option ${design.options.length + 1} · making`), el('span', { class: 'muted mono clock' }, seconds()))] : []),
    el('hr'), el('a', { class: 'item', role: 'menuitem', href: '#/' }, icon('grid'), el('span', { class: 'name' }, 'All options side by side')));
  return [button, m];
}

// Studio: the panel (options, the open option's comments and the brief) beside the canvas. On a wide screen the canvas shows the
// desktop and the phone side by side (Both), each captioned with its own Play, or the one device the switch picks, at the largest
// scale that fits. Hide brief folds the panel away on a wide screen; under 860px (view.css) there is no Both, the panel moves below
// the canvas and the brief docks at the bottom of the screen. Comment (in the More menu under 860px) turns on comment mode.
function canvas(o, device) {
  const dev = studioDevice(device), all = pinsFor(o);
  const gutter = (dev === 'both' ? all : pinsOn(o, dev)).length ? PIN_GUTTER : 0;
  let close = null; // the open comment box's
  const point = (d) => (x, y, at) => { close?.(); close = commentBox(o, d, x, y, at, (i) => { openPin = i; render(); }); };
  const one = (d) => artFor(d, frame(o, `Option ${o.n} at ${FRAMES[d].width}px`), pinsOn(o, d), point(d));
  let art = null;
  if (!o.error && dev === 'both') {
    const pair = ['desktop', 'phone'].map((d) => [d, one(d)]);
    art = el('div', { class: 'pair' }, ...pair.map(([d, a]) => el('figure', {},
      el('figcaption', {}, link(`#/o/${o.n}/${d}`, NAMES[d], 'device-name'), el('span', { class: 'size' }, `${FRAMES[d].width} × ${FRAMES[d].height}`),
        el('a', { href: `#/o/${o.n}/play/${d}`, class: 'button play-one' }, icon('play', 'fill'), 'Play')), a)));
    art.style.gap = `${pairGap(gutter > 0)}px`;
    art.rescale = (scale) => pair.forEach(([, a]) => a.rescale(scale));
  } else if (!o.error) art = one(dev);
  const done = el('button', { type: 'button', class: 'button' }, 'Done');
  const hint = el('div', { class: 'comment-hint', role: 'status' }, el('span', {}, `${innerWidth < WIDE ? 'Tap' : 'Click'} the spot your comment is about`), done);
  const blank = o.error && el('div', { class: 'blank', role: 'alert' }, el('div', { class: 'mark' }, icon('alert')), el('h2', {}, `Option ${o.n} cannot open`), el('p', {}, o.error),
    ...(design.options.some((x) => !x.error) ? [link(`#/o/${design.options.find((x) => !x.error).n}`, `Open Option ${design.options.find((x) => !x.error).n}`, 'button line')] : []));
  const stage = el('div', { class: 'stage' }, art ?? blank, ...(art ? [hint] : []));
  const zoom = el('span', { class: 'zoom', title: 'Zoom' });

  const tool = el('button', { type: 'button', class: 'button line comment-tool', 'aria-pressed': 'false' }, icon('comment'), 'Comment');
  // Under 860px (view.css) Fullscreen and Comment move into the More menu, so Play is the one primary in the bar.
  const more = el('button', { type: 'button', class: 'button icon more', 'aria-label': 'More', 'data-align': 'right' }, icon('more'));
  const add = el('button', { type: 'button', class: 'item' }, icon('comment'), el('span', { class: 'name' }, 'Add comment'));
  const moreMenu = menu('more-menu', more, el('a', { class: 'item', href: `#/o/${o.n}/full` }, icon('full'), el('span', { class: 'name' }, 'Fullscreen')), add, el('hr'), version('div'));
  const fold = el('button', { type: 'button', class: 'button icon fold', 'aria-controls': 'studio-side', 'aria-expanded': String(column), 'aria-label': column ? 'Hide brief' : 'Show brief', title: column ? 'Hide brief' : 'Show brief' }, icon('panel'));
  const actions = o.error ? [] : [tool, el('a', { href: `#/o/${o.n}/full`, class: 'button icon full-link', 'aria-label': 'Fullscreen', title: 'Fullscreen' }, icon('full')), el('span', { class: 'sep' }),
    el('a', { href: `#/o/${o.n}/play/${dev === 'both' ? 'desktop' : dev}`, class: 'button primary play' }, icon('play', 'fill'), 'Play'), ...(innerWidth < WIDE ? [more, moreMenu] : [])];
  const bar = el('header', { class: 'bar' },
    el('div', { class: 'bar-l' }, fold, home(), link('#/', design.name, 'button crumb'), el('span', { class: 'slash', 'aria-hidden': 'true' }, '/'), ...switcher(o, dev)),
    el('div', { class: 'bar-c' }, devices(`#/o/${o.n}`, dev, ['both', 'desktop', 'phone'], true), zoom),
    el('div', { class: 'bar-r' }, ...actions));

  const optionList = () => el('ol', { class: 'list' }, ...design.options.map((x) => el('li', { class: x.error ? 'broken' : undefined }, el('a', { href: `#/o/${x.n}/${dev}`, 'aria-current': x === o ? 'page' : undefined },
    el('span', { class: `num${x === o ? ' on' : ''}` }, String(x.n)), el('span', { class: 'name' }, x.label), el('span', { class: 'muted' }, x.error ? 'Cannot open' : pinsFor(x).length ? plural(pinsFor(x).length, 'comment') : '')))),
    ...(job ? [el('li', {}, el('div', { class: 'making' }, el('span', { class: 'spinner', 'aria-hidden': 'true' }), el('span', { class: 'name' }, `Option ${design.options.length + 1}`), el('span', { class: 'muted mono clock' }, seconds())))] : []));
  const notes = all.length ? el('ol', { class: 'list' }, ...all.map((p, i) => {
    const b = el('button', { type: 'button' }, el('span', { class: 'num pin-num' }, String(i + 1)), el('span', { class: 'name' }, p.text), ...(p.device ? [el('span', { class: 'tag' }, NAMES[p.device])] : []));
    // The pin with this number opens its comment on the canvas; a comment on the other device switches to it first.
    b.onclick = () => { const pin = document.querySelector(`.pin[data-i="${i}"]`); if (pin) pin.click(); else if (p.device) { openPin = i; location.hash = `#/o/${o.n}/${p.device}`; } };
    return el('li', {}, b);
  })) : el('p', { class: 'empty' }, 'No comments yet. Press ', el('span', { class: 'tool' }, icon('comment'), 'Comment'), ', then click a spot on the design.');
  const options = optionList();
  const side = el('aside', { id: 'studio-side', class: 'side', 'aria-label': 'Brief' },
    el('div', { class: 'side-scroll' },
      el('section', {}, el('h2', { class: 'kicker' }, 'Options', el('span', { class: 'mono' }, String(design.options.length))), options),
      el('section', {}, el('h2', { class: 'kicker' }, `Comments · Option ${o.n}`, el('span', { class: 'mono' }, String(all.length))), notes),
      ...(design.canPolish ? [polishControls(o)] : [])),
    ...(o.error ? [] : [brief(o), el('p', { class: 'brief-foot' }, 'Your agent makes a new option; this one stays.')]), version());

  const studio = el('div', { class: `studio${column ? '' : ' folded'}` }, side, el('main', { class: 'work' }, errorBar(o.n), ...pinsNotice(), ...referencePanel(o), ...marketPanel(o), ...sourcesPanel(o), stage));
  const commenting = (on) => { studio.classList.toggle('commenting', on); tool.setAttribute('aria-pressed', String(on)); if (!on) close?.(); fit?.(); };
  tool.onclick = () => commenting(!studio.classList.contains('commenting'));
  add.onclick = () => { moreMenu.hidePopover(); commenting(true); };
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
    zoom.textContent = `${Math.round(scale * 100)}%`;
  });
  // Wide screens only (view.css): the canvas takes the panel's room; under 860px the panel is below the canvas and the brief is docked.
  fold.onclick = () => {
    column = !column;
    if (studioDevice(device) !== dev) return render(); // the canvas the panel leaves decides between Both and Desktop
    studio.classList.toggle('folded', !column);
    fold.setAttribute('aria-expanded', String(column));
    fold.setAttribute('aria-label', column ? 'Hide brief' : 'Show brief');
    fold.title = fold.getAttribute('aria-label');
    fit?.();
  };
  refreshStudio = () => {
    side.querySelector('.list').replaceWith(optionList());
    side.querySelector('.kicker .mono').textContent = String(design.options.length);
    const focused = document.activeElement === side.querySelector('form.brief textarea'), caret = document.activeElement?.selectionStart;
    side.querySelector('form.brief')?.replaceWith(brief(o));
    side.querySelector('.polish-controls')?.replaceWith(polishControls(o));
    if (focused) { const next = side.querySelector('form.brief textarea'); next.focus({ preventScroll: true }); next.setSelectionRange(caret, caret); }
    const [b, m] = switcher(o, dev);
    bar.querySelector('.switch').replaceWith(b);
    bar.querySelector('#option-menu').replaceWith(m);
  };
  return { body: [bar, studio], dev, fit };
}

function full(o) {
  const exit = el('a', { href: `#/o/${o.n}`, class: 'exit', 'aria-label': 'Exit fullscreen' }, 'Exit', el('kbd', {}, 'Esc'));
  document.documentElement.requestFullscreen?.().catch(() => {}); // iPhone has no element fullscreen; the page still fills the viewport.
  return { body: [el('main', { class: 'full' }, frame(o, `Option ${o.n} fullscreen`)), exit] };
}

// Play: one option as a clickable prototype on one device. The option's screens (the overlay's data-oc-screen sections) are
// reported by the option as it moves; the bar lists them, and Back steps through the screens visited.
let playing = null; // { iframe, screens, current, canBack } while the Play page is open
function playControls() {
  const { iframe, screens, current, canBack } = playing;
  const tell = (msg) => iframe.contentWindow?.postMessage({ __firstDraft: true, ...msg }, '*'); // the sandboxed option has an opaque origin, so no origin can be named
  const back = el('button', { type: 'button', class: 'button icon', 'aria-label': 'Back', title: 'Back', disabled: canBack ? undefined : '' }, icon('back'));
  back.onclick = () => tell({ type: 'BACK' });
  const chips = screens.map((id) => {
    const b = el('button', { type: 'button', class: 'chip', 'aria-current': id === current ? 'true' : undefined }, id);
    b.onclick = () => tell({ type: 'GO', id });
    return b;
  });
  return [back, chips.length ? el('div', { class: 'seg', role: 'group', 'aria-label': 'Screens' }, ...chips) : el('span', { class: 'muted' }, 'Single screen')];
}

function play(o, device) {
  const want = deviceFor(device, innerWidth), dev = want === 'both' ? 'desktop' : want, f = FRAMES[dev]; // Play runs on one device
  const back = lastCanvas?.split('/')[2] === String(o.n) ? lastCanvas : `#/o/${o.n}/${dev}`;
  const iframe = frame(o, `Option ${o.n} Play at ${f.width}px`, false, '?play');
  playing = { iframe, screens: [], current: null, canBack: false };
  const controls = el('div', { class: 'play-controls' }, ...playControls());
  const pins = pinsOn(o, dev), art = artFor(dev, iframe, pins);
  const stage = el('main', { class: 'stage' }, art);
  const bar = el('header', { class: 'bar' },
    el('div', { class: 'bar-l' }, el('a', { href: back, class: 'button icon', 'aria-label': 'Exit Play', title: 'Exit Play' }, icon('close')),
      el('h1', { class: 'play-title' }, el('b', {}, `Option ${o.n}`), el('span', {}, o.label), el('span', { class: 'badge' }, icon('play', 'fill'), 'Play'))),
    el('div', { class: 'bar-c' }, controls),
    el('div', { class: 'bar-r' }, devices(`#/o/${o.n}/play`, dev)));
  return { body: [bar, errorBar(o.n), ...pinsNotice(), stage], dev: want, fit: () => art.rescale(fitDevice(dev, stage.clientWidth, stage.clientHeight, pins.length ? PIN_GUTTER : 0)) };
}

function render() {
  const [, n, mode, device] = location.hash.match(/^#\/o\/(\d+)(?:\/(full|play))?(?:\/(phone|desktop|both))?$/) ?? [];
  const o = n && option(Number(n));
  const kind = pageFor(o, mode);
  playing = null;
  stopCommenting = null;
  refreshStudio = null;
  if (kind !== 'full' && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  frames = [];
  resize?.disconnect();
  const view = kind === 'grid' ? grid() : kind === 'full' ? full(o) : kind === 'play' ? play(o, device) : canvas(o, device);
  document.title = o ? `Option ${o.n} · ${design.name}` : design.name;
  app.className = `page-${kind}`;
  app.replaceChildren(...view.body);
  if (kind === 'canvas') lastCanvas = location.hash;
  if (openPin !== null) { const i = openPin; openPin = null; requestAnimationFrame(() => document.querySelector(`.pin[data-i="${i}"]`)?.click()); }
  // Under 860px the canvas fills the first screen above the docked brief, whose height (one line, or taller with a status) is --dock.
  const dock = document.querySelector('form.brief');
  // The page follows the window: a resize past the phone width, or below the width for Both, switches the device.
  if (view.fit) {
    resize = new ResizeObserver(() => {
      if (dock) document.documentElement.style.setProperty('--dock', `${dock.offsetHeight + 16}px`);
      return view.dev && (kind === 'canvas' ? studioDevice(device) : deviceFor(device, innerWidth)) !== view.dev ? render() : view.fit();
    });
    resize.observe(app);
    if (dock) resize.observe(dock);
  }
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
    if (playing.current && playing.current.length <= 200 && !/[\u0000- \u007f]/.test(playing.current) && new URLSearchParams(location.search).get('screen') !== playing.current) {
      const url = new URL(location.href);
      url.searchParams.set('screen', playing.current);
      history.replaceState(null, '', url); // Hash-only device links keep the selected screen.
    }
  }
});
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !document.querySelector('.menu:popover-open') && !stopCommenting?.()) leaveFull(); });
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) leaveFull(); });
window.addEventListener('hashchange', render);
document.addEventListener('touchstart', () => {}, { passive: true }); // iOS Safari shows :active (the press states) only on a page that listens for touches
render();
