// Full CLI/browser journey: a local brand site, native subscription stand-in, actual cached PNGs.
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { createServer as portServer } from 'node:net';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';
const CLI=new URL('../src/cli.mjs',import.meta.url).pathname;
const PERMISSION='Anonymous automated browsers may store screenshots of this entire website privately as visual design references. Do not copy our text or assets into generated designs.';
const DESIGN=readFileSync(new URL('../vendor/open-codesign/apps/desktop/resources/templates/scaffolds/design-systems/DESIGN.md',import.meta.url),'utf8');
const PAGE='<!doctype html><html><head><style>:root{color-scheme:light dark;background:#fafafa;color:#111}body{margin:24px;font-family:Arial}h1{font-size:32px}@media(prefers-color-scheme:dark){:root{background:#111;color:#fafafa}}</style></head><body><h1>Umer notes</h1><p>A note</p></body></html>';
const BRAND_PAGE=`<!doctype html><html><head><link rel="stylesheet" href="/style.css"></head><body><header>Umer Reference Lab</header><main><h1>Build something clear.</h1><p>A public local reference fixture, not the real Vercel site.</p><a href="/terms">Terms</a><script src="/never.js"></script><iframe src="/never-frame"></iframe></main></body></html>`;

test('public references: actual browser capture, project cache, named-brand make, source-linked viewer and safe refusals',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'fd-public-')); t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const requests=[],timeouts=[]; let robots='User-agent: *\nAllow: /\nDisallow: /blocked\n';
  const site=createServer((req,res)=>{
    requests.push({url:req.url,cookie:req.headers.cookie,auth:req.headers.authorization,ua:req.headers['user-agent']});
    const send=(type,body,status=200)=>{res.writeHead(status,{'content-type':type,'set-cookie':'private=must-not-be-retained'});res.end(body);};
    if(req.url==='/robots.txt') return send('text/plain',robots);
    if(req.url==='/terms') return send('text/html',`<h1>Reference permission</h1><p>${PERMISSION}</p>`);
    if(req.url==='/style.css') return send('text/css','body{font-family:Arial,sans-serif;margin:0;background:#080808;color:#fafafa}header{padding:24px;border-bottom:1px solid #333}main{max-width:1000px;margin:auto;padding:48px 24px}h1{font-size:clamp(32px,6vw,72px);letter-spacing:-.04em}a{color:#aaa}');
    if(req.url==='/redirect') {res.writeHead(302,{location:'http://127.0.0.1:1/private'});return res.end();}
    if(req.url==='/cross-origin') {res.writeHead(302,{location:'https://reference.invalid/'});return res.end();}
    if(req.url==='/huge') return send('text/html','x'.repeat(2_000_001));
    if(req.url==='/slow') {timeouts.push(setTimeout(()=>send('text/html',BRAND_PAGE),11_000));return;}
    if(req.url==='/no-terms') return send('text/html','<h1>Umer</h1>');
    if(req.url==='/login') return send('text/html','<input type="password">');
    return send('text/html',BRAND_PAGE);
  });
  await new Promise(ok=>site.listen(0,'127.0.0.1',ok)); t.after(()=>{timeouts.forEach(clearTimeout);site.closeAllConnections();site.close();});
  const origin=`http://127.0.0.1:${site.address().port}`;
  mkdirSync(join(dir,'bin'));
  writeFileSync(join(dir,'bin/claude'),`#!${process.execPath}
import {appendFileSync} from 'node:fs';
const args=process.argv.slice(2);
if(args.includes('auth')) console.log(JSON.stringify({loggedIn:true,authMethod:'claude.ai',apiProvider:'firstParty'}));
else {
 let raw='';for await(const c of process.stdin)raw+=c;
 const envelope=JSON.parse(raw),{messages,tools}=JSON.parse(envelope.message.content.at(-1).text);
 appendFileSync(process.env.FIRST_DRAFT_HOME+'/native-inputs',JSON.stringify({messages,tools,system:args[args.indexOf('--system-prompt')+1],images:envelope.message.content.filter(c=>c.type==='image').length})+'\\n');
 const call=(name,a)=>({name,arguments:JSON.stringify(a)});
 let calls=[];
 if(tools.some(t=>t.name==='identify_reference'))calls=[call('identify_reference',{name:'Vercel',url:process.env.FD_BRAND_ORIGIN+'/'} )];
 else if(tools.some(t=>t.name==='assess_reference_terms'))calls=[call('assess_reference_terms',{decision:process.env.FD_TERMS_DECISION||'allowed',quote:${JSON.stringify(PERMISSION)}})];
 else {
  const results=messages.filter(m=>m.role==='toolResult');
  const page=raw.includes('warmer palette')?${JSON.stringify(PAGE.replace('A note','A warm note'))}:${JSON.stringify(PAGE)};
  calls=results.length===0?[call('set_todos',{items:[{text:'Write notes',checked:false}]})]
   :results.length===1?[call('str_replace_based_edit_tool',{command:'create',path:'DESIGN.md',file_text:${JSON.stringify(DESIGN)}}),call('str_replace_based_edit_tool',{command:'create',path:'index.html',file_text:page})]
   :results.length===3?[call('done',{path:'index.html'})]:[];
 }
 console.log(JSON.stringify({type:'result',subtype:'success',is_error:false,structured_output:{text:'',calls},usage:{input_tokens:7,output_tokens:8}}));
}
`,{mode:0o700});
  const project=join(dir,'project');mkdirSync(project);
  const env={...process.env,PATH:`${join(dir,'bin')}:/usr/bin`,HOME:dir,XDG_CONFIG_HOME:dir,XDG_DATA_HOME:dir,XDG_STATE_HOME:dir,TMPDIR:dir,FIRST_DRAFT_HOME:join(dir,'config'),FIRST_DRAFT_TEST_REF_ORIGIN:origin,FD_BRAND_ORIGIN:origin};
  const run=(...args)=>promisify(execFile)(process.execPath,[CLI,...args],{env,cwd:project,timeout:80_000,maxBuffer:10_000_000});
  await run('init','--agent','byokit:claude','--model','claude-opus-5-5');
  const captured=JSON.parse((await run('references','make it like Vercel','--capture')).stdout).reference_capture;
  assert.equal(captured.name,'Vercel');assert.equal(captured.cached,false);assert.equal(captured.screenshots,2);
  assert.match(captured.brief,/type.*spacing.*colour.*layout.*motion/);
  const manifest=JSON.parse(readFileSync(captured.cache,'utf8'));
  assert.equal(manifest.url,origin+'/');assert.match(manifest.licence_note,/Anonymous automated browsers/);
  assert.equal(manifest.screenshots.length,2);
  for(const shot of manifest.screenshots){const b=readFileSync(join(captured.cache,'..',shot.file));assert.equal(b.readUInt32BE(16),shot.width);assert.equal(b.readUInt32BE(20),shot.height);}
  const before=requests.length;
  assert.equal(JSON.parse((await run('references','--like',origin+'/','--capture')).stdout).reference_capture.cached,true);
  assert.equal(requests.length,before,'fresh project cache makes no site calls');
  for(const [path,pattern] of [['/blocked',/robots.txt disallows/],['/redirect',/public HTTPS/],['/cross-origin',/redirect left the source site/],['/?secret=x',/query strings/],['/huge',/byte cap/],['/slow',/timeout|aborted/i],['/no-terms',/permission is unclear/],['/login',/Login\/challenge/]]){
    await assert.rejects(run('references','--like',origin+path,'--capture'),e=>{assert.match(e.stdout,pattern);return true;});
  }
  await assert.rejects(run('references','--like','https://127.0.0.1/','--capture'),e=>/host is not entirely public/.test(e.stdout));
  env.FD_TERMS_DECISION='blocked';
  await assert.rejects(run('references','--like',origin+'/restricted','--capture'),e=>/restricted.*no screenshots/s.test(e.stdout));delete env.FD_TERMS_DECISION;
  robots='User-agent: *\nAllow: /\nUser-agent: FirstDraftReference\nDisallow: /specific\n';
  await assert.rejects(run('references','--like',origin+'/specific','--capture'),e=>/robots.txt disallows/.test(e.stdout));
  assert.ok(!requests.some(r=>['/blocked','/specific','/never.js','/never-frame'].includes(r.url)));
  assert.ok(requests.every(r=>!r.cookie&&!r.auth&&r.ua.includes('FirstDraftReference/1.0')),'all site requests are anonymous and polite');
  assert.ok(readdirSync(join(project,'.first-draft/refs')).length>=1);
  const out=join(project,'notes.html'),warm=join(project,'warm.html');
  const made=JSON.parse((await run('make','make it like Vercel; one notes page for Umer','--out',out)).stdout);
  assert.equal(made.references.name,'Vercel');assert.equal(made.made.render_check,'checked');
  const reference=JSON.parse(readFileSync(out+'.refs.json','utf8'));
  assert.equal(reference.shots.length,2);assert.doesNotMatch(readFileSync(out,'utf8'),/data:image|Build something clear/);
  await run('refine',out,'warmer palette','--out',warm);
  assert.match(readFileSync(warm,'utf8'),/A warm note/);assert.deepEqual(JSON.parse(readFileSync(warm+'.refs.json','utf8')),reference);
  const inputs=readFileSync(join(env.FIRST_DRAFT_HOME,'native-inputs'),'utf8').trim().split('\n').map(JSON.parse).filter(r=>r.tools.some(t=>t.name==='done'));
  assert.ok(inputs.length>=8&&inputs.every(r=>r.images===2&&r.system.includes('Observed reference visual language')),'capture pixels and observed brief reach every generation turn');
  const port=await new Promise(ok=>{const s=portServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>ok(p));});});
  const child=spawn(process.execPath,[CLI,'view',out,warm,'--host','127.0.0.1','--port',String(port)],{env,cwd:project,stdio:['ignore','pipe','pipe']});
  t.after(()=>child.kill());
  const opened=await new Promise((ok,no)=>{let text='';const timer=setTimeout(()=>no(Error('view startup timed out')),10_000);child.stdout.on('data',b=>{text+=b;if(text.includes('\n')){clearTimeout(timer);ok(JSON.parse(text));}});child.on('exit',()=>{clearTimeout(timer);no(Error('view exited'));});});
  const view=opened.viewing.url;
  const data=JSON.parse((await(await fetch(view)).text()).match(/id="design">([\s\S]*?)<\/script>/)[1]);
  assert.equal(data.options[0].references.name,'Vercel');
  for(const shot of data.options[0].references.shots){const r=await fetch(new URL(shot.src,view));assert.equal(r.headers.get('content-type'),'image/png');assert.equal(Buffer.from(await r.arrayBuffer()).readUInt32BE(16),shot.width);}
  const changed=await fetch(new URL('/refine',view),{method:'POST',headers:{origin:new URL(view).origin,'content-type':'application/json'},body:JSON.stringify({option:1,change:'warmer palette'})});
  assert.equal(changed.status,200);assert.equal((await changed.json()).option.references.name,'Vercel','viewer refinement preserves references');
  await assert.rejects(run('make','notes','--like','Vercel','--no-references','--out',join(project,'bad.html')),e=>/conflicts/.test(e.stdout));
  await run('make','notes for Umer','--no-references','--out',out);
  assert.equal(existsSync(out+'.refs.json'),false,'overwriting without references removes stale option provenance');
  writeFileSync(out+'.refs.json',JSON.stringify({...reference,shots:reference.shots.map(s=>({...s,dataUrl:'data:text/html,not an image'}))}));
  assert.equal((await fetch(new URL('/refs/1/0',view))).status,422,'malformed sidecars cannot serve arbitrary content');
  const cachedShot=join(captured.cache,'..',manifest.screenshots[0].file);
  writeFileSync(cachedShot,Buffer.concat([readFileSync(cachedShot),Buffer.from('tampered')]));
  const requestsBeforeCorruption=requests.length;
  await assert.rejects(run('references','--like',origin+'/','--capture'),e=>/Cached reference screenshot changed/.test(e.stdout));
  assert.equal(requests.length,requestsBeforeCorruption,'corrupt cache refuses instead of silently refetching');
});
