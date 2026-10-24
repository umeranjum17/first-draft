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
export function installJudge(dir) {
  writeFileSync(join(dir, 'claude'), `#!${process.execPath}\nconsole.log('{"loggedIn":false}');\n`, { mode: 0o700 });
  writeFileSync(join(dir, 'codex'), `#!${process.execPath}
import { appendFileSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
const args = process.argv.slice(2), home = process.env.FIRST_DRAFT_HOME;
if (args.includes('app-server')) {
  createInterface({input:process.stdin}).on('line', line => { const q=JSON.parse(line); if(q.id) console.log(JSON.stringify({id:q.id,result:q.method==='account/read'?{account:process.env.FD_JUDGE_AUTH==='out'?null:{type:'chatgpt',email:'umer@example.invalid',planType:'plus'}}:{}})); });
} else if (args.includes('login')) console.log('Logged in using ChatGPT');
else {
  let input=''; for await (const c of process.stdin) input+=c;
  if (process.env.FD_JUDGE_FAILURE) process.exit(1);
  if (!args.includes('read-only') || !args.includes('forced_login_method="chatgpt"') || process.env.OPENAI_API_KEY) throw Error('unsafe judge route');
  const files=args.filter(a=>a.startsWith('--image=')).map(a=>a.slice(8));
  if (files.length!==6 || files.some((f,i)=>{const b=readFileSync(f);return b.toString('hex',0,8)!=='89504e470d0a1a0a'||b.readUInt32BE(16)!==(i%2?390:1280)||b.readUInt32BE(20)!==(i%2?844:800)})) throw Error('missing viewport-matched native PNG images');
  appendFileSync(home+'/judge-calls.jsonl',JSON.stringify({model:args[args.indexOf('--model')+1],images:files.length,input})+'\\n');
  const score=process.env.FD_JUDGE_AI?9:6;
  const value={design:{score,gaps:['No product screen']},plain:{score:7,gaps:['Generic layout']},against:'Captured Umer notes: real content',reads_as:'Notes for Umer',fix:'Show the product',axes:Object.fromEntries(['hierarchy','type','colour','spacing','imagery','proof_clarity','ai_tells'].map(a=>[a,{score,reason:'The captured reference shows content, the option does not'}]))};
  if(input.includes('"ai_side"')) Object.assign(value,{ai_side:{reads_as_ai:!!process.env.FD_JUDGE_AI,tells:process.env.FD_JUDGE_AI?['Repeated generic cards']:[]},hero:Array.from({length:9},(_,i)=>({point:i+1,met:true,reason:'Shown in fixture'}))});
  console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:JSON.stringify({text:'',calls:[{name:'judge_designs',arguments:JSON.stringify(value)}]})}}));
  console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:1,output_tokens:1}}));
}
`, { mode: 0o700 });
}
