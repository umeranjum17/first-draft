// Fixture pages for the human-side checks (test/human-side.test.mjs, journeys/human-side.mjs).
// A dark hero with a pill, a centred six-word title, one filled button and one outline, and the product as data; then a light statement,
// a green colour block and a dark row. Two hues (a green brand and a lilac accent). Each option breaks one thing.
const card = (t) => `<article><h3>${t}</h3><p>Closed in two days, down from six.</p></article>`;
export const page = ({ h1 = 'Run your books together, month after month', pill = '<span class="pill">New: bank feeds for 4,000 banks</span>', second = '<a class="btn ghost" href="#a">Book a demo</a>', screen = '<figure class="screen"><div class="bar"></div><p>Weekly revenue <b>$4,571</b></p></figure>', align = 'center',
  css = '', cards = 0, band = true } = {}) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ledgerly</title><style>
*{box-sizing:border-box}body{margin:0;background:#f7f5ef;color:#14201a;font:16px/1.5 system-ui,sans-serif}
.hero{background:#0f3d2e;color:#f4f1e8;padding:64px 20px;text-align:${align}}.hero nav{display:flex;gap:16px;justify-content:space-between;max-width:1040px;margin:0 auto 48px}
.hero nav a{color:#f4f1e8;text-decoration:none}.logo{font-size:24px;font-weight:700}
h1{font:700 clamp(36px,6vw,64px)/1.05 Georgia,serif;margin:16px auto;max-width:18ch}.pill{display:inline-block;border:1px solid #b9a7f0;color:#d9cffa;border-radius:99px;padding:4px 12px;font-size:14px}
.btn{display:inline-block;padding:14px 22px;border-radius:8px;text-decoration:none;font-weight:600}.btn:first-of-type{background:#b9a7f0;color:#14201a}
.ghost{padding:10px 18px;border:1px solid #f4f1e8;color:#f4f1e8;margin-left:8px}.screen{max-width:640px;margin:40px auto 0;background:#164a39;border-radius:12px;padding:20px;border:1px solid #2c6a55}.bar{height:24px;width:62%;background:#b9a7f0;border-radius:6px}
section.light{padding:72px 20px;max-width:1040px;margin:0 auto}section.block{background:#2e7d5b;color:#fff;padding:72px 20px}section.dark{background:#0b2a20;color:#f4f1e8;padding:72px 20px}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;max-width:1040px;margin:0 auto}article{background:#fff;border:1px solid #ddd6c6;border-radius:12px;padding:20px;color:#14201a}${css}
</style></head><body>
<header class="hero"><nav><a class="logo" href="#top">Ledgerly</a><span><a href="#a">Product</a> <a href="#b">Pricing</a> <a href="#c">Log in</a></span></nav>
${pill}<h1>${h1}</h1><p>Invoices, expenses and month-end for teams of five to fifty.</p><div><a class="btn" href="#a">Start your first ledger</a>${second}</div>${screen}</header>
<section class="light"><h2>Most small teams close in six days. Yours can close in two.</h2></section>
${cards ? Array.from({ length: cards }, (_, i) => `<section class="light"><h2>Block ${i + 1}</h2><div class="cards">${card('One')}${card('Two')}${card('Three')}</div></section>`).join('') : ''}
${band ? '<section class="block"><h2>Books that close themselves</h2></section>' : '<section class="light"><h2>Books that close themselves</h2></section>'}
<section class="dark"><h2>Built by accountants</h2></section></body></html>`;

// The same product written on the AI side: pastel tints, no pill, a long generic title, two filled buttons, no product screen, a run of card grids and no band.
export const AI_PAGE = page({ pill: '', h1: 'Unlock seamless, next-generation accounting for every team that wants to grow faster', screen: '', cards: 4, band: false, second: '<a class="btn" href="#a" style="background:#f08a24">Learn more</a>',
  css: '.hero,section.dark,.btn:first-of-type{background:#f7f5ef;color:#14201a}.hero nav a{color:#14201a}.btn:first-of-type{background:#e9d5ff}section.dark{background:#f7f5ef}.cards article:nth-child(2){background:#fde68a}.cards article:nth-child(3){background:#bae6fd}' });
