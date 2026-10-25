// A flow screen's scene must belong to the screen (src/render-check.mjs, flowScene): full-bleed on the screen's own ground or
// soft-edged with a mask, never cut by a rim, never left at thumbnail size. Real browser, fixture pages: no model, no key, no network.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findBrowser, renderCheck } from '../src/render-check.mjs';

const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const FADE = '.scene img{-webkit-mask-image:radial-gradient(130% 130% at 50% 45%,#000 52%,transparent 76%);mask-image:radial-gradient(130% 130% at 50% 45%,#000 52%,transparent 76%)}';
const SCREENS = [['welcome', 'A little space', 'Welcome'], ['feeling', 'How are you feeling today?', 'How you feel'], ['first-step', 'You are all set', 'Your first step']];

// Three flow screens, one scene each: the shared shell the flow keeps, nothing else drawn.
const page = ({ fade = true, css = '', label = (i) => SCREENS[i][2] } = {}) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
:root{--paper:#f6f1e8;--ink:#221f1c;color-scheme:light dark}
@media(prefers-color-scheme:dark){:root{--paper:#1a1816;--ink:#f2ede4}}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.5 system-ui,sans-serif}
section{box-sizing:border-box;min-height:520px;padding:24px}
header{display:flex;justify-content:space-between}
.eyebrow{font-size:12px;letter-spacing:.14em;text-transform:uppercase;margin:24px 0 8px}
h1{font-size:30px;margin:0 0 8px}
.start{display:inline-block;margin-top:16px;padding:14px 22px;border-radius:999px;background:var(--ink);color:var(--paper)}
.scene{margin:20px 0 0}
.scene img{display:block;width:100%;max-width:320px;height:220px;background:#efe6d6}
${fade ? FADE : ''}${css}
</style></head><body>${SCREENS.map(([id, title], i) => `<section id="${id}" data-oc-screen="${id}"><header><a href="#${id}">Back</a><a href="#${SCREENS.at(-1)[0]}">Skip</a></header><p class="eyebrow">${label(i)}</p><h1>${title}</h1><figure class="scene"><img src="${PIXEL}" alt="the character in its scene"></figure>${i === SCREENS.length - 1 ? '<a class="start" href="#welcome">Start</a>' : `<a class="next" href="#${SCREENS[i + 1][0]}">Next</a>`}</section>`).join('')}</body></html>`;

const check = (t, options = { flow: true }) => {
  const render = renderCheck(() => {}, options);
  t.after(() => render.close());
  return async (html) => (await render.verify(html)).filter((e) => e.source === 'flow').map((e) => e.message.replace(/^the page at \d+x\d+: /, ''));
};

test('a scene that fades into the ground or runs to the screen edges passes, and a rimmed or thumbnail one does not', async (t) => {
  if (!findBrowser()) return t.skip('no Chrome or Chromium on this machine');
  const run = check(t);
  assert.deepEqual(await run(page()), [], 'an edge that fades into the cream ground is part of the page');
  assert.deepEqual(await run(page({ fade: false, css: '.scene{margin:20px -24px 0}.scene img{max-width:100%}' })), [], 'a full-bleed scene on the screen\'s own ground is part of the page');
  const MUTANTS = [
    ['the oval crop the owner saw on all six screens', '.scene img{border-radius:46% 46% 40% 40%}', /rounded or oval clip/],
    ['a plain cut edge inset on the ground', '', /inset with a cut edge/],
    ['a hairline border', '.scene img{border:1px solid #e2d8c6}', /a border/],
    ['a drop shadow', '.scene img{box-shadow:0 10px 30px rgba(34,31,28,.18)}', /drop shadow/],
    ['a clip-path shape', '.scene img{clip-path:ellipse(50% 50%)}', /clip-path/],
    ['a white mat behind the picture', '.scene{background:#fff;padding:10px;max-width:340px}', /a mat .* behind it/],
    ['a framed card round the picture', '.scene{border:1px solid #e2d8c6;padding:10px;max-width:340px}', /a frame .* round it/],
    ['a thumbnail on one screen only', '#feeling .scene img{width:150px;height:100px}', /screen "feeling": .* is a thumbnail/],
  ];
  for (const [what, css, message] of MUTANTS) {
    const found = await run(page({ fade: false, css }));
    assert.ok(found.some((f) => message.test(f)), `${what}: ${found.join(' | ') || 'no finding'}`);
  }
});

test('a screen that drops its illustration keeps its own idea and is not a thumbnail', async (t) => {
  if (!findBrowser()) return t.skip('no Chrome or Chromium on this machine');
  const without = page().replace(/<figure class="scene"><img[^>]*><\/figure>(?=<\/section><section id="first-step")/, '');
  assert.deepEqual(await check(t)(without), [], 'a screen with no scene at all is allowed');
});

test('one step label repeated on every screen, or two actions on the last one, fails the flow shell', async (t) => {
  if (!findBrowser()) return t.skip('no Chrome or Chromium on this machine');
  const run = check(t);
  assert.deepEqual(await run(page()), [], 'each screen labelling its own step, and one action at the end, is the shell the flow keeps');
  const repeated = page({ label: (i) => `0${i + 1} / A moment for you` });
  assert.ok((await run(repeated)).some((f) => /every screen repeats the same label above its title \("01 \/ A moment for you"\)/.test(f)), 'the repeated eyebrow the owner saw on all six screens is refused, even when each one carries its own number');
  const twoActions = page().replace('<a class="start" href="#welcome">Start</a>', '<a class="start" href="#welcome">Start</a><a class="next" href="#welcome">Next</a>');
  assert.ok((await run(twoActions)).some((f) => /the last screen "first-step" offers 2 actions at once/.test(f)), 'a closing button beside the round next button is refused');
});

test('only a flow is held to the scene rule', async (t) => {
  if (!findBrowser()) return t.skip('no Chrome or Chromium on this machine');
  assert.deepEqual(await check(t, {})(page({ fade: false })), [], 'a page that is not a flow is not checked for its scene');
});
