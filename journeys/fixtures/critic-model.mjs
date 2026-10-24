// A stand-in model for make's critic (test/critic.test.mjs, journeys/critic.mjs): a local provider that answers the plain page and
// the reviews by their tool, with the scores in turn, and runs each engine conversation as plan, DESIGN.md and version N, done.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

const DESIGN = readFileSync(new URL('../../vendor/open-codesign/apps/desktop/resources/templates/scaffolds/design-systems/DESIGN.md', import.meta.url), 'utf8');
const page = (title) => `<!doctype html><html><head><title>Notes</title><style>:root{--bg:#fff;--fg:#111}@media (prefers-color-scheme: dark){:root{--bg:#101418;--fg:#e8eaed}}body{margin:0;font:16px/1.5 system-ui,sans-serif;background:var(--bg);color:var(--fg)}main{max-width:100%;padding:24px}</style></head><body><main><h1>${title}</h1><p>Umer's notes, searchable.</p></main></body></html>`;
export const PLAIN = page('A plain page from one prompt');
const ev = (o) => `event: ${o.type}\ndata: ${JSON.stringify(o)}\n\n`;
export const userText = (body) => JSON.parse(body).input.filter((m) => m.role === 'user').map((m) => typeof m.content === 'string' ? m.content : m.content.filter((p) => p.type === 'input_text').map((p) => p.text).join('\n'));
export const images = (body) => JSON.parse(body).input.flatMap((m) => Array.isArray(m.content) ? m.content.filter((p) => p.type === 'input_image') : []).length;

// A stand-in model: the plain page and the reviews by their tool, the scores in turn from `scores` ([design, plain] each; a landing brief's review also says which side it reads as and how many hero points it meets); each
// engine conversation (told apart by its first message) plans, writes DESIGN.md and version N of the page, runs done and stops.
export function standIn(seen, scores) {
  const convo = new Map();
  let reviews = 0, drafts = 0;
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      seen.push(body);
      let calls, text = 'The design is ready.';
      if (body.includes('"write_page"')) calls = [['write_page', { html: PLAIN }]];
      else if (body.includes('"review_designs"')) {
        const [design, plain] = scores[reviews++];
        calls = [['review_designs', { design: { score: design, gaps: design < 10 ? [`version ${reviews}: the hero has no picture and the list is a wall of grey`] : [] }, plain: { score: plain, gaps: ['generic'] },
          against: 'Notion: its calm page list and real content', reads_as: 'a list of notes', fix: design < 10 ? `Give version ${reviews} a real hero picture and tint each note by its tag.` : '',
          ...(body.includes('"ai_side"') && { // a landing brief is also asked which side it reads as and for the nine hero points: below 9 it reads as the AI side with five met
            ai_side: { reads_as_ai: design < 9, tells: design < 9 ? [`version ${reviews}: soft pastel on every section and a card grid after a card grid`] : [] },
            hero: Array.from({ length: 9 }, (_, i) => ({ point: i + 1, met: design >= 9 || i < 5, reason: design >= 9 || i < 5 ? 'shown' : `version ${reviews}: point ${i + 1} is missing` })) }) }]];
      } else if (!JSON.parse(body).tools?.length) text = page(`Notes, version ${++drafts}`); // the one-call make asks for the page as text, no tools
      else {
        const key = userText(body)[0];
        if (!convo.has(key)) convo.set(key, { n: 0, version: convo.size + 1 });
        const st = convo.get(key), n = st.n++;
        calls = [[['set_todos', { items: [{ text: 'Write the page', checked: false }] }]],
          [['str_replace_based_edit_tool', { command: 'create', path: 'DESIGN.md', file_text: DESIGN }], ['str_replace_based_edit_tool', { command: 'create', path: 'index.html', file_text: page(`Notes, version ${st.version}`) }]],
          [['done', { path: 'index.html' }]]][n];
      }
      const items = calls ? calls.map(([name, args], i) => ({ type: 'function_call', id: `fc${seen.length}-${i}`, call_id: `c${seen.length}-${i}`, name, arguments: JSON.stringify(args) }))
        : [{ type: 'message', id: 'm1', status: 'completed', content: [{ type: 'output_text', text }] }];
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.end(items.map((item, output_index) => ev({ type: 'response.output_item.added', output_index, item }) + ev({ type: 'response.output_item.done', output_index, item })).join('')
        + ev({ type: 'response.completed', response: { id: `r${seen.length}`, status: 'completed', usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } } }));
    });
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

