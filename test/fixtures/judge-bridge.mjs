// Native Codex protocol fixture for existing CLI journeys. It is never packaged or used by a normal CLI run.
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { judgeValue } from './judge-value.mjs';
const args = process.argv.slice(2);
if (args.includes('app-server')) {
  createInterface({ input: process.stdin }).on('line', line => { const q = JSON.parse(line); if (q.id) console.log(JSON.stringify({ id: q.id, result: q.method === 'account/read' ? { account: { type: 'chatgpt', email: 'umer@example.invalid', planType: 'plus' } } : {} })); });
} else if (args.includes('login')) console.log('Logged in using ChatGPT');
else {
  let input = ''; for await (const c of process.stdin) input += c;
  const context = JSON.parse(input.slice(input.indexOf('{'))), tool = context.tools[0];
  let value;
  if (tool.name === 'judge_designs' && !process.env.FIRST_DRAFT_TEST_JUDGE_DELEGATE) {
    value = judgeValue(tool);
  } else {
    // Preserve each journey's semantic/mark fixture responses through the published provider adapter.
    if (process.env.FIRST_DRAFT_TEST_BYOKIT_BASE) process.env.OPENCODE_API_KEY = 'synthetic-test-judge';
    await import('./provider-hooks.mjs');
    const { respond } = await import('../../src/byokit.mjs');
    const system = args.find(a => a.startsWith('developer_instructions='));
    const images = args.filter(a => a.startsWith('--image=')).map((a, i) => { const bytes = readFileSync(a.slice(8)), mime = bytes[0] === 137 ? 'image/png' : 'image/jpeg'; return { id: String(i), mime, dataUrl: `data:${mime};base64,${bytes.toString('base64')}` }; });
    const answer = await respond({ route: process.env.FIRST_DRAFT_TEST_BYOKIT_BASE ? 'opencode-go' : 'claude', model: process.env.FIRST_DRAFT_TEST_BYOKIT_BASE ? 'muse-spark-1.3-contributor' : 'claude-opus-5-5', images, context: { ...context, systemPrompt: system ? JSON.parse(system.slice(system.indexOf('=') + 1)) : '' }, maxTokens: tool.name === 'assess_redesign' ? 8192 : 16000, timeoutMs: 60000 });
    const call = answer.content.find(c => c.type === 'toolCall');
    value = call?.arguments;
    if (!value) throw Error('Fixture judge returned no typed response');
  }
  const text = JSON.stringify({ text: '', calls: [{ name: tool.name, arguments: JSON.stringify(value) }] });
  console.log(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text } }));
  console.log(JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 1, output_tokens: 1 } }));
}
