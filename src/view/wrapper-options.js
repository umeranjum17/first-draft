// Archive-only design study: two real view shells, selected by ?wrapper=studio|focus.
import './wrapper-options.css';
const directions = { studio: ['Studio', 'A quiet conversation beside the work.'], focus: ['Focus', 'A generous canvas, with your brief within reach.'] };
const notes = [], state = { device: innerWidth <= 700 ? 'phone' : 'desktop', panel: null, brief: '' };
export function wrapperOptions({ el, link, design, frame, scaled, pinsFor, errorBar }) {
  const button = (text, action, attrs = {}) => { const b = el('button', { type: 'button', ...attrs }, text); b.onclick = action; return b; };
  const root = el('section', { class: 'wrapper-lab' });
  const mark = () => el('img', { class: 'wl-mark', src: '/favicon.svg', alt: '', width: '32', height: '32' });
  const choice = new URLSearchParams(location.search).get('wrapper');
  if (location.hash === '#/wrappers') {
    root.classList.add('wl-picker');
    root.append(el('header', {}, mark(), el('strong', {}, 'first-draft'), link('#/', 'Back to designs', 'wl-back')),
      el('main', {}, el('p', { class: 'wl-kicker' }, 'WRAPPER STUDY / 01'), el('h1', {}, 'Room for your next idea.'),
        el('p', { class: 'wl-subtitle' }, 'Two ways to work. The same canvas underneath.'),
        el('div', { class: 'wl-directions' }, ...Object.entries(directions).map(([id, [name, description]]) =>
          link(`?wrapper=${id}#/o/1`, el('div', {}, el('div', { class: `wl-schematic ${id}`, 'aria-hidden': 'true' }, el('i'), el('i'), el('i')), el('h2', {}, name), el('p', {}, description), el('strong', {}, 'Explore direction →')), 'wl-direction'))),
        el('p', { class: 'wl-subtitle' }, 'Interactive shell prototypes. Briefs stay in this session; no generation is connected.')));
    return { body: [root] };
  }
  if (!directions[choice]) return null;
  root.classList.add(`wl-${choice}`);
  const o = design.options.find((o) => o.n === Number(location.hash.match(/^#\/o\/(\d+)/)?.[1])) || design.options[0];
  const empty = location.hash === '#/empty' || !o;
  const redraw = () => window.dispatchEvent(new Event('hashchange'));
  const panelOpen = state.panel ?? (choice === 'studio' && innerWidth > 700);
  const toggle = () => { state.panel = !panelOpen; redraw(); };
  const select = el('select', { 'aria-label': 'Design option' }, ...design.options.map((item) => el('option', { value: item.n, selected: item.n === o?.n ? '' : undefined }, `Option ${item.n} · ${item.label}`)));
  select.onchange = () => { location.hash = `#/o/${select.value}`; };
  const noteCount = design.pins.length + notes.length;
  root.append(el('header', { class: 'wl-header' }, link('#/wrappers', '← Back', 'wl-back'), mark(), el('strong', { class: 'wl-brand' }, 'first-draft'),
    el('span', { class: 'wl-project' }, 'Design workspace'),
    button('New brief', () => { location.hash = '#/empty'; }),
    button('Brief', toggle, { 'aria-expanded': String(panelOpen), 'aria-controls': 'wl-brief' })));
  const intro = el('div', { class: 'wl-intro' }, el('p', { class: 'wl-kicker' }, `${directions[choice][0].toUpperCase()} / WORKSPACE`),
    el('h1', {}, 'Good ideas start here.'), el('p', {}, 'Try a direction. Find what feels right. Make it yours.'));
  const log = el('div', { class: 'wl-log', 'aria-live': 'polite' }, el('strong', {}, 'Your design, ready to explore'),
    el('p', {}, `${design.options.length} design${design.options.length === 1 ? '' : 's'}. Switch the viewport, play the screens, or keep a brief for the next iteration.`),
    ...notes.map((text) => el('p', { class: 'wl-note' }, text)));
  const input = el('textarea', { 'aria-label': 'Describe your next iteration', placeholder: 'What would you like to explore next?', rows: '3', required: '' });
  input.value = state.brief;
  input.oninput = () => { state.brief = input.value; };
  const submit = el('button', { type: 'submit', class: 'wl-primary' }, 'Save brief ↑');
  const form = el('form', { class: 'wl-composer' }, input, el('div', {}, el('span', {}, 'This review only'), submit));
  form.onsubmit = (e) => { e.preventDefault(); if (!input.value.trim()) return; notes.push(input.value.trim()); state.brief = ''; redraw(); };
  const brief = el('aside', { id: 'wl-brief', class: 'wl-brief', 'aria-label': 'Design brief' }, intro, log, form, el('p', { class: 'wl-disclosure' }, 'Briefs are kept for this session only. Saving does not generate or change the canvas.'));
  const stage = el('div', { class: 'wl-stage' });
  let art;
  if (empty) stage.append(el('div', { class: 'wl-empty' }, mark(), el('h2', {}, 'A little space to begin.'), el('p', {}, 'Keep a brief for your next idea, or return to a design you already have.'), link('#/o/1', 'Explore existing designs →', 'wl-primary')));
  else if (o.error) stage.append(el('div', { role: 'alert', class: 'wl-empty' }, el('h2', {}, 'This design could not open'), el('p', {}, o.error)));
  else {
    const width = state.device === 'phone' ? 390 : 1280, height = state.device === 'phone' ? 844 : 800;
    art = scaled(width, height, frame(o, `Option ${o.n} ${state.device} preview`), pinsFor(o));
    stage.append(art);
  }
  const tabs = el('div', { class: 'wl-devices', 'aria-label': 'Preview viewport' }, ...['desktop', 'phone'].map((device) =>
    button(device === 'phone' ? 'Phone' : 'Desktop', () => { state.device = device; redraw(); }, { 'aria-pressed': String(state.device === device) })));
  const commentList = el('div', { class: 'wl-comments', hidden: '' }, el('h2', {}, 'Review notes'),
    ...(noteCount ? [...design.pins.map((p) => el('p', {}, `Option ${p.option}: ${p.text}`)), ...notes.map((text) => el('p', {}, text))] : [el('p', {}, 'Nothing here yet. Save a brief to start the conversation.')]));
  const commentButton = button(`Notes${noteCount ? ` (${noteCount})` : ''}`, () => {
    const open = commentList.hidden; commentList.hidden = !open; stage.hidden = open;
    commentButton.setAttribute('aria-pressed', String(open));
  }, { 'aria-pressed': 'false' });
  const preview = el('main', { class: 'wl-preview' }, el('div', { class: 'wl-toolbar' }, select, tabs, commentButton,
    ...(!empty && !o.error ? [link(`#/o/${o.n}/play`, 'Play ↗', 'wl-primary')] : [])), ...(!empty ? [errorBar(o.n)] : []), stage, commentList,
    el('footer', {}, el('span', {}, empty ? 'No design selected' : `${state.device === 'phone' ? '390' : '1280'} px · Live preview`), el('span', {}, 'Canvas unchanged')));
  root.classList.toggle('wl-panel-open', panelOpen);
  root.append(el('div', { class: 'wl-workspace' }, brief, preview));
  return { body: [root], fit: () => {
    if (art && !stage.hidden) art.rescale(Math.min(1, Math.max(0, stage.clientWidth - 48) / parseInt(art.firstChild.style.width), Math.max(0, stage.clientHeight - 48) / parseInt(art.firstChild.style.height)));
  } };
}
