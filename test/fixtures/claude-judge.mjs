// Native Claude fixture for the independent reviewer in a Codex-generator integration journey.
import { judgeValue } from './judge-value.mjs';
const args = process.argv.slice(2);
if (args.includes('auth')) console.log(JSON.stringify({ loggedIn: true, authMethod: 'claude.ai', apiProvider: 'firstParty' }));
else {
  let input = ''; for await (const c of process.stdin) input += c;
  const envelope = JSON.parse(input), { tools } = JSON.parse(envelope.message.content.at(-1).text), tool = tools[0];
  if (tool.name !== 'judge_designs') throw Error('Fixture only implements independent judging');
  console.log(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, structured_output: { text: '', calls: [{ name: tool.name, arguments: JSON.stringify(judgeValue(tool)) }] }, usage: { input_tokens: 1, output_tokens: 1 } }));
}
