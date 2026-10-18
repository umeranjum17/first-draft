// A prompt to one design: Open CoDesign's create-mode system prompt, one model call through its providers package
// (which reaches BYOKit, see pi-ai.mjs), and its App.jsx answer built into a mock page.
import { completeWithRetry } from '@open-codesign/providers';
import { composeSystemPrompt } from '../vendor/open-codesign/core/src/prompts/index.ts';
import { buildMock } from './mock.mjs';

// This first release makes the design in one plain call. Open CoDesign's prompt is written for its tool loop, so this
// last section says which of its rules change.
const ONE_CALL = `# This run

No tools are available: there is no workspace, file tool, ask, preview, scaffold, skill or done tool, and nobody answers questions during the run. Rules above that name a tool do not apply; everything else does.
Make one complete, finished design for the brief now, choosing sensible defaults for anything the brief leaves open.
Reply with only the full \`App.jsx\` source in one \`\`\`jsx fenced block: define \`App\` and end with \`ReactDOM.createRoot(document.getElementById('root')).render(<App />);\`, as the App.jsx rules above say.
The page is viewed with no network: use no remote URL of any kind (scripts, styles, fonts, images). Use inline SVG, CSS and data URIs, and system font stacks.`;

// The App.jsx source in a model's answer: its longest fenced code block, else the whole answer when it defines App.
function sourceOf(text) {
  const blocks = [...text.matchAll(/```[a-z]*[^\n]*\n([\s\S]*?)```/gi)].map((m) => m[1]).sort((a, b) => b.length - a.length);
  return blocks[0] ?? (/\b(?:function|const|class) App\b/.test(text) ? text : undefined);
}

export async function make({ prompt, agent, model, timeoutMs }) {
  const messages = [
    { role: 'system', content: `${composeSystemPrompt({ mode: 'create' })}\n\n---\n\n${ONE_CALL}` },
    { role: 'user', content: prompt },
  ];
  // The route rides in the model's provider; BYOKit holds the credential, so the key here is only a placeholder.
  const answer = await completeWithRetry({ provider: agent, modelId: model }, messages,
    { apiKey: 'byokit', wire: 'openai-chat', maxTokens: 32000, signal: AbortSignal.timeout(timeoutMs) }, { provider: agent });
  const source = sourceOf(answer.content);
  if (!source) throw new Error(`the model answered with no App.jsx source; it began: ${JSON.stringify(answer.content.slice(0, 200))}`);
  return { ...buildMock(source), tokens_in: answer.inputTokens, tokens_out: answer.outputTokens };
}
