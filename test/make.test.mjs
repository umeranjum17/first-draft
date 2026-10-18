// The whole make journey on the built CLI: config, BYOKit's plan key route (zai) against a local stand-in for the
// provider, Open CoDesign's prompt and export, and the mock file. No paid call is made.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

const CLI = new URL('../dist/first-draft-axi.mjs', import.meta.url).pathname;
const APP = `const { useState } = React;
function App() {
  const [email, setEmail] = useState('');
  return (
    <main style={{ fontFamily: 'system-ui', padding: 32 }}>
      <h1>Sign in to your notes</h1>
      <label>Email <input value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <p>{email ? 'We will send a link to ' + email : 'Type your email'}</p>
      <p>{'</script> stays text'}</p>
    </main>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);`;

// An OpenAI chat completions stand-in that answers every request with APP in a jsx block, as one stream.
function standIn(seen) {
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      seen.push({ url: req.url, auth: req.headers.authorization, body: JSON.parse(body) });
      const chunk = (o) => `data: ${JSON.stringify({ id: 'c1', object: 'chat.completion.chunk', created: 0, model: 'glm-4.7', ...o })}\n\n`;
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.end(chunk({ choices: [{ index: 0, delta: { role: 'assistant', content: `Here it is.\n\`\`\`jsx\n${APP}\n\`\`\`` }, finish_reason: null }] })
        + chunk({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 11, completion_tokens: 22, total_tokens: 33 } })
        + 'data: [DONE]\n\n');
    });
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

test('make writes one self-contained mock through BYOKit', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const seen = [];
  const server = await standIn(seen);
  t.after(() => server.close());
  const env = { ...process.env, HOME: dir, FIRST_DRAFT_HOME: dir, ZAI_API_KEY: 'test-key', FIRST_DRAFT_TEST_BYOKIT_BASE: `http://127.0.0.1:${server.address().port}` };
  const run = (...args) => promisify(execFile)(process.execPath, [CLI, ...args], { env });

  await assert.rejects(run('make', 'a sign-in page', '--out', join(dir, 'x.html')), (e) => /code: NO_AGENT/.test(e.stdout));
  await run('init', '--agent', 'byokit:zai:plan_key', '--model', 'glm-4.7');
  assert.match((await run('doctor')).stdout, /ready: true/);

  const out = join(dir, 'mocks', 'sign-in.html');
  const { stdout } = await run('make', 'a sign-in page for a notes app', '--out', out);
  assert.match(stdout, /tokens_out: 22/);

  assert.equal(seen.length, 1);
  assert.equal(seen[0].auth, 'Bearer test-key');
  assert.equal(seen[0].body.model, 'glm-4.7');
  const [system, user] = seen[0].body.messages;
  assert.match(system.content, /# Output rules/); // Open CoDesign's own prompt
  assert.match(system.content, /No tools are available/);
  assert.equal(user.content, 'a sign-in page for a notes app');

  const html = readFileSync(out, 'utf8');
  assert.match(html, /<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline';/);
  assert.match(html, /Sign in to your notes/);
  assert.doesNotMatch(html, /new Function|window\.Babel|fonts\.googleapis/);
  assert.doesNotMatch(html.replace(/<\/script>/g, ''), /<\/script/i); // the JSX's "</script>" text cannot end a script early
  assert.ok(Buffer.byteLength(html) < 5_000_000, 'sign-off takes mocks of 5 MB or less');
});
