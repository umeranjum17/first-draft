// The human-side checks (src/human-side.mjs) on fixture pages, in the browser already on the machine: no model, no keys, no network.
// A page on the human side passes every check; a page on the AI side fails each, and each check refuses its own failure alone.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { humanSideOf } from '../src/human-side.mjs';
import { findBrowser, renderCheck } from '../src/render-check.mjs';
import { AI_PAGE, page } from '../journeys/fixtures/human-side-pages.mjs';

const check = (t) => {
  const render = renderCheck(() => {}, { humanSide: true });
  t.after(() => render.close());
  return async (html) => (await render.verify(html)).filter((e) => e.source === 'human-side').map((e) => e.message.replace(/^human side, the page at \d+x\d+: /, ''));
};
const MUTANTS = [
  ['a third hue', page({ css: 'section.dark h2{color:#f08a24}' }), /3 saturated hues/],
  ['two filled buttons', page({ second: '<a class="btn" href="#a" style="background:#2e7d5b;color:#fff">Book a demo</a>' }), /2 filled buttons/],
  ['a secondary larger than the primary', page({ second: '<a class="btn ghost" href="#a" style="padding:26px 60px">Book a demo</a>' }), /secondary button is larger/],
  ['no pill', page({ pill: '' }), /no small indicator pill/],
  ['a long title', page({ h1: 'The accounting software that small teams use to close their books in two days' }), /h1 is 14 words/],
  ['a left-aligned title', page({ align: 'left', css: 'h1{margin-left:0}' }), /not centred/],
  ['no product screen', page({ screen: '' }), /no product screen or picture/],
  ['four card-grid sections in a row', page({ cards: 4 }), /4 sections in a row are a grid of equal cards/],
  ['no colour band', page({ band: false, css: 'section.dark{background:#f7f5ef;color:#14201a}.hero{background:#f7f5ef;color:#14201a}.hero nav a,.ghost{color:#14201a}.ghost{border-color:#14201a}.btn:first-of-type{background:#2e7d5b;color:#fff}.pill{color:#14201a;border-color:#14201a}.screen{background:#fff;border-color:#ddd}.bar{background:#2e7d5b}' }), /full-width colour or dark band/],
];

test('a page on the human side passes every host check, and each check refuses its own failure', async (t) => {
  if (!findBrowser()) return t.skip('no Chrome or Chromium on this machine');
  const run = check(t);
  assert.deepEqual(await run(page()), []);
  assert.deepEqual(await run(page({ cards: 2 })), [], 'two card-grid sections in a row are allowed');
  for (const [what, html, message] of MUTANTS) {
    const found = await run(html);
    assert.ok(found.length > 0 && found.every((f) => message.test(f)), `${what} alone: ${found.join(' | ') || 'no finding'}`);
  }
});

test('a page on the AI side fails the checks together', async (t) => {
  if (!findBrowser()) return t.skip('no Chrome or Chromium on this machine');
  const found = (await check(t)(AI_PAGE)).join('\n');
  for (const message of [/h1 is \d+ words/, /no small indicator pill/, /no product screen or picture/, /sections in a row are a grid of equal cards/, /saturated hues/]) assert.match(found, message);
});

test('which briefs the human-side guidance and checks apply to', () => {
  for (const prompt of ['a landing page for a small accounting software company for teams', 'A marketing site for a dental clinic', 'a homepage for a bakery']) assert.equal(humanSideOf({ prompt }), true, prompt);
  for (const prompt of ['A notes app for Umer', 'a sign-in page', 'a dashboard for a fleet of delivery vans']) assert.equal(humanSideOf({ prompt }), false, prompt);
});
