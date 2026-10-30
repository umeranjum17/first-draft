// Nonpaid proof that a board of phone screens at 1280 passes the render check refine runs: three 390px phone screens in one row on a
// 1280 page raise no phone-sized finding, while one lone phone canvas centred on the desktop still does. Needs Chrome or Chromium.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderCheck } from '../src/render-check.mjs';
const out = process.env.DONE_DONE_EVIDENCE_ROOT ?? process.argv[2];
if (!out) throw Error('Give an evidence folder');
mkdirSync(out, { recursive: true });
const page = (body, css) => `<!doctype html><html><head><meta name="viewport" content="width=device-width"><style>:root{color-scheme:light dark;background:#fff;color:#111}@media(prefers-color-scheme:dark){:root{background:#111;color:#eee}}body{margin:0;font:16px Arial;${css}}section{width:390px;box-sizing:border-box;padding:16px}</style></head><body>${body}</body></html>`;
const screens = (n) => Array.from({ length: n }, (_, i) => `<section data-oc-screen id="s${i + 1}"><h1>Step ${i + 1}</h1><p>Phone screen ${i + 1} of ${n}</p></section>`).join('');
const phone = /is still phone-sized/;
const check = renderCheck();
if (check.drawing === false) throw Error('Chrome or Chromium is needed for this journey');
const run = async (name, html) => { const errors = await check.verify(html); writeFileSync(join(out, `${name}.html`), html); writeFileSync(join(out, `${name}.errors.json`), JSON.stringify(errors, null, 2)); return errors; };
try {
  const board = await run('board-3-phones', page(screens(3), 'display:flex;gap:24px;justify-content:center;align-items:flex-start'));
  assert.equal(board.filter((e) => phone.test(e.message)).length, 0, 'a board of three phone screens in a row is not phone-sized');
  const lone = await run('lone-phone', page(screens(1), 'display:flex;justify-content:center'));
  assert.ok(lone.some((e) => phone.test(e.message)), 'a lone phone canvas on the desktop is still refused');
  writeFileSync(join(out, 'summary.json'), JSON.stringify({ status: check.status, board_errors: board.map((e) => e.message), lone_phone_phone_sized_findings: lone.filter((e) => phone.test(e.message)).length }, null, 2));
  assert.equal(check.status, 'checked');
  console.log('board of 3 phone screens at 1280: no phone-sized finding; lone phone canvas: refused');
} finally { check.close(); }
