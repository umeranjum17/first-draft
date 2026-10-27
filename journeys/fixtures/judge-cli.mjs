// Installed Codex protocol stand-in; the real BYOKit account and generation adapters still run. No model, login or external request.
import { writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
export async function referenceStandIn(dir) {
  const seen = [], quote = 'Permission is hereby granted to capture this public fixture as a design reference.';
  const server = createServer((req, res) => {
    seen.push(req.url);
    res.setHeader('content-type', req.url === '/notes' ? 'text/html' : 'text/plain');
    res.end(req.url === '/robots.txt' ? 'User-agent: *\nDisallow: /blocked\n' : req.url === '/license' ? quote : '<!doctype html><html><head><title>Umer notes</title><style>body{font:20px system-ui;background:#fff;color:#111}html[data-theme=dark] body{background:#111;color:#fff}</style></head><body><h1>Umer notes</h1><p>Today: write the launch note.</p></body></html>');
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`, library = join(dir, 'sources.json');
  const permission = { licence: 'Fixture permission', url: `${origin}/license`, quote, basis: 'Task-owned synthetic public-page fixture' };
  writeFileSync(library, JSON.stringify({ version: 1, entries: [
    { id: 'umer-notes', kind: 'notes', name: 'Umer notes', url: `${origin}/notes`, notes: 'A readable editor', permission, themes: { light: {}, dark: { 'data-theme': 'dark' } } },
    { id: 'unclear', kind: 'notes', name: 'Unclear', url: `${origin}/never-fetch`, notes: 'Notes only, no permission' },
    { id: 'robots-blocked', kind: 'notes', name: 'Blocked', url: `${origin}/blocked`, notes: 'Explicit permission cannot override robots', permission, themes: { light: {} } },
  ] }));
  return { server, seen, origin, library };
}
export function installJudge(dir, { preserveClaude = false } = {}) {
  if (!preserveClaude) writeFileSync(join(dir, 'claude'), `#!${process.execPath}\nconsole.log('{"loggedIn":false}');\n`, { mode: 0o700 });
  writeFileSync(join(dir, 'codex'), `#!${process.execPath}
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
const args = process.argv.slice(2), home = process.env.FIRST_DRAFT_HOME;
if (args.includes('app-server')) {
  createInterface({input:process.stdin}).on('line', line => { const q=JSON.parse(line); if(q.id) console.log(JSON.stringify({id:q.id,result:q.method==='account/read'?{account:(process.env.FD_JUDGE_AUTH==='out'||existsSync(home+'/judge-signed-out'))?null:{type:'chatgpt',email:'umer@example.invalid',planType:'plus'}}:{}})); });
} else if (args.includes('login')) console.log('Logged in using ChatGPT');
else {
  let input=''; for await (const c of process.stdin) input+=c;
  if (process.env.FD_JUDGE_FAILURE) { if (process.env.FD_JUDGE_FAILURE === 'credentials') writeFileSync(home+'/judge-signed-out','1'); process.exit(1); }
  if (!args.includes('read-only') || !args.includes('forced_login_method="chatgpt"') || process.env.OPENAI_API_KEY) throw Error('unsafe judge route');
  const files=args.filter(a=>a.startsWith('--image=')).map(a=>a.slice(8));
  if (input.includes('"score_benchmark"')) {
    const context=JSON.parse(input.slice(input.indexOf('{'))),q=JSON.parse(context.messages.at(-1).content.split('\\n\\nYour last')[0]),refs=q.captures.filter(c=>c.role==='reference');
    if (files.length!==q.captures.length || files.some(f=>{const h=readFileSync(f).toString('hex',0,3);return h!=='89504e'&&h!=='ffd8ff'})) throw Error('missing benchmark images');
    const system=args.find(a=>a.startsWith('developer_instructions='));
    appendFileSync(home+'/benchmark-inputs',JSON.stringify({q,system:JSON.parse(system.slice(system.indexOf('=')+1)),images:files.length})+'\\n');
    if (process.env.FD_BENCH_FAIL_TARGET===q.target) process.exit(1);
    const value={axes:q.axes.map(axis=>({axis,score:axis==='imagery'?null:7,references:axis==='imagery'?[]:[process.env.FD_BAD_EVIDENCE?q.captures.find(c=>c.role==='counterexample').id:refs[0].id],observed:axis==='imagery'?'No applicable reference imagery.':refs[0].id+' shows a clear reading order.',comparison:'Target is denser; fixture assessment only.'}))};
    console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:JSON.stringify({text:'',calls:[{name:'score_benchmark',arguments:JSON.stringify(value)}]})}}));
    console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:1,output_tokens:1}}));
    process.exit(0);
  }
  const ids=(input.match(/^Images, in attachment order: (.*)$/m)?.[1] ?? '').split(', ').filter(i=>/^(design|plain)-/.test(i)), design=ids.filter(i=>i.startsWith('design-'));
  if (!design.length || ![ids.length,ids.length+2].includes(files.length) || files.some(f=>{const h=readFileSync(f).toString('hex',0,3);return h!=='89504e'&&h!=='ffd8ff'})) throw Error('missing capture-set images (one per attachment id, then the two references)');
  appendFileSync(home+'/judge-calls.jsonl',JSON.stringify({model:args[args.indexOf('--model')+1],images:files.length,input,system:args.find(a=>a.startsWith('developer_instructions='))})+'\\n');
  const scores=JSON.parse(process.env.FD_JUDGE_SCORES||'[]'),n=readFileSync(home+'/judge-calls.jsonl','utf8').trim().split('\\n').length-1;
  const [score,plain]=process.env.FD_JUDGE_AI?[9,7]:(scores[n]||[6,7]);
  const value={views:design.map(view=>({view,judged:'The notes list and its theme at this width'})),design:{score,gaps:['No product screen']},plain:{score:plain,gaps:['Generic layout']},against:'Captured Umer notes: real content',reads_as:'Notes for Umer',fix:'Show the product',axes:Object.fromEntries(['hierarchy','type','colour','spacing','imagery','proof_clarity','ai_tells'].map(a=>[a,{score,reason:'The captured reference shows content, the option does not'}]))};
  if(input.includes('"ai_side"')) Object.assign(value,{ai_side:{reads_as_ai:!!process.env.FD_JUDGE_AI||score<9,tells:process.env.FD_JUDGE_AI||score<9?['Repeated generic cards']:[]},hero:Array.from({length:9},(_,i)=>({point:i+1,met:score>=9||i<5,reason:'Shown in fixture'}))});
  console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:JSON.stringify({text:'',calls:[{name:'judge_designs',arguments:JSON.stringify(value)}]})}}));
  console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:1,output_tokens:1}}));
}
`, { mode: 0o700 });
}
