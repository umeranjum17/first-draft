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
const REDESIGN_PAGE='<!doctype html><html><head><style>:root{color-scheme:light dark;--bg:#fafafa;--ink:#111;--gap:24px;--radius:12px;background:var(--bg);color:var(--ink)}body{margin:var(--gap);font-family:Arial}h1{font-size:32px}.metric{border-radius:var(--radius)}.value{display:block;font-size:32px;font-weight:700}@media(prefers-color-scheme:dark){:root{--bg:#111;--ink:#fafafa}}</style></head><body><section data-oc-screen id="screen-1"><h1>Umer projects</h1><div class="metric"><b class="value">7</b><span>active projects</span></div><a href="#screen-2">Project detail</a></section><section data-oc-screen id="screen-2"><h1>Umer project</h1><div class="metric"><b class="value">3</b><span>tasks remaining</span></div><a href="#screen-1">Projects</a><p>© Umer</p></section></body></html>';
const BAD_SEMANTICS=REDESIGN_PAGE.replace('class="value">7','class="value">Remaining 3 tasks remaining').replace('class="metric"><b class="value">3','class="metric" style="background:magenta;border-radius:37px"><b class="value">3');
const BAD_STRUCTURE=BAD_SEMANTICS.replace('href="#screen-2"','href="#screen-1"').replace('<h1>Umer projects</h1>','<h1>Umer projects</h1><span style="display:block;width:4px;overflow:hidden;white-space:nowrap">clipped metric label</span><p>✨</p>');
const BRAND_PAGE=`<!doctype html><html><head><link rel="stylesheet" href="/style.css"></head><body><header>Umer Reference Lab</header><main><h1>Build something clear.</h1><p>A public local reference fixture, not the real Vercel site.</p><a href="/terms">Terms</a><script src="/never.js"></script><iframe src="/never-frame"></iframe></main></body></html>`;

test('public references: actual browser capture, project cache, named-brand make, source-linked viewer and safe refusals',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'fd-public-')); t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const requests=[],timeouts=[]; let robots='User-agent: *\nAllow: /\nDisallow: /blocked\n';
  const site=createServer((req,res)=>{
    requests.push({url:req.url,cookie:req.headers.cookie,auth:req.headers.authorization,ua:req.headers['user-agent']});
    const send=(type,body,status=200)=>{res.writeHead(status,{'content-type':type,'set-cookie':'private=must-not-be-retained'});res.end(body);};
    if(req.url==='/robots.txt') return send('text/plain',robots);
    if(req.url==='/product.html') return send('text/html','<title>Umer projects</title><h1>Umer projects</h1><p>7 active projects</p><a href="/detail.html">Project detail</a><a href="https://outside.invalid/">Outside</a><script>fetch("/never.js")</script>');
    if(req.url==='/detail.html') return send('text/html','<title>Project detail</title><h1>Umer project</h1><p>3 tasks remaining</p><a href="/product.html">Projects</a>');
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
 else if(tools.some(t=>t.name==='assess_redesign')) {
  if(Number(process.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS)!==8192)throw Error('semantic review reasoning budget missing');
  const bad=raw.includes('Remaining 3 tasks remaining')||process.env.FD_REVIEW_ALWAYS_FAIL;
  calls=[call('assess_redesign',{checks:process.env.FD_REVIEW_MALFORMED?[{name:'metrics',passed:'yes',detail:'invalid'}]:[{name:'metrics',passed:!bad,detail:bad?'screen-1 metric: use one number and one label, not Remaining 3 tasks remaining':'Each metric has one number and one label'},{name:'tokens',passed:!bad,detail:bad?'screen-2 metric: remove magenta and 37px overrides; use shared tokens':'Both screens share global tokens'}]})];
 }
 else {
  const results=messages.filter(m=>m.role==='toolResult');
  let page=raw.includes('SOURCE INVENTORY:')?(raw.includes('Redesign semantic')?${JSON.stringify(REDESIGN_PAGE)}:raw.includes('clipped text')?${JSON.stringify(BAD_SEMANTICS)}:${JSON.stringify(BAD_STRUCTURE)}):raw.includes('warmer palette')?${JSON.stringify(PAGE.replace('A note','A warm note'))}:${JSON.stringify(PAGE)};
  if(process.env.FD_REVIEW_ALWAYS_FAIL)page=page.replace('© Umer','© Umer revision '+results.length);
  calls=results.length===0?[call('set_todos',{items:[{text:'Write notes',checked:false}]})]
   :results.length===1?[call('str_replace_based_edit_tool',{command:'create',path:'DESIGN.md',file_text:${JSON.stringify(DESIGN)}}),call('str_replace_based_edit_tool',{command:'create',path:'index.html',file_text:page})]
   :results.length===3?[call('done',{path:'index.html'})]:[4,6,8].includes(results.length)&&/clipped text|Redesign semantic/.test(raw)?[call('str_replace_based_edit_tool',{command:'create',path:'index.html',file_text:page}),call('done',{path:'index.html'})]:[];
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
  const redesignOut=join(project,'redesigned');
  const redesigned=JSON.parse((await run('redesign',origin+'/product.html','Make the projects clearer','--no-references','--out',redesignOut,'--max-pages','2')).stdout);
  await promisify(execFile)(process.execPath,['--input-type=module','-e',`import assert from 'node:assert/strict';import {checkRedesign} from ${JSON.stringify(new URL('../src/redesign-check.mjs',import.meta.url).href)};await assert.rejects(checkRedesign({html:'<h1>Umer</h1>',agent:'byokit:claude',model:'claude-opus-5-5',timeoutMs:1}),/semantic review timed out after 1 ms/);`],{env,cwd:project,timeout:30000,maxBuffer:100000});
  assert.equal(redesigned.made.files.length,1);
  assert.equal(redesigned.made.render_check,'checked');
  assert.equal(redesigned.made.files[0].self_check.reviews,2);
  assert.ok(redesigned.made.files[0].self_check.semantic.every(c=>c.passed));
  assert.match(readFileSync(redesigned.made.files[0].file,'utf8'),/© Umer/,'copyright text is not emoji filler');
  assert.doesNotMatch(readFileSync(redesigned.made.files[0].file,'utf8'),/magenta|✨|clipped metric label/);
  assert.match(readFileSync(redesigned.made.files[0].file,'utf8'),/href="#screen-2"/);
  const inventory=JSON.parse(readFileSync(redesigned.redesign.sources,'utf8'));
  assert.equal(inventory.pages.length,2);assert.deepEqual(inventory.pending,[]);
  assert.match(inventory.pages[0].text,/7 active projects/);
  assert.match(inventory.pages[1].text,/3 tasks remaining/);
  assert.equal(inventory.pages[0].links[0].target,'screen-2');
  assert.equal(inventory.pages[1].links[0].target,'screen-1');
  for(const page of inventory.pages)for(const shot of page.screenshots){const b=readFileSync(join(redesignOut,'sources',shot.file));assert.equal(b.readUInt32BE(16),shot.width);assert.equal(b.readUInt32BE(20),shot.height);}
  const capped=JSON.parse((await run('redesign',origin+'/product.html','Clearer','--no-references','--out',join(project,'capped'),'--max-pages','1')).stdout);
  assert.deepEqual(capped.redesign.pending,[origin+'/detail.html']);
  const sourceDir=join(project,'export');mkdirSync(sourceDir);
  writeFileSync(join(sourceDir,'index.html'),'<title>Umer export</title><h1>7 active projects</h1>');
  await run('redesign',sourceDir,'Clearer projects','--no-references','--out',join(project,'local-redesign'));
  assert.equal(JSON.parse(readFileSync(join(project,'local-redesign/sources/sources.json'))).pages[0].url,'/index.html');
  await assert.rejects(run('redesign',origin+'/product.html','Clearer','--out',redesignOut,'--max-pages','13'),e=>/max-pages/.test(e.stdout));
  await assert.rejects(run('redesign',origin+'/login','Clearer','--no-references','--out',redesignOut),e=>/Login/.test(e.stdout));
  const generationInputs=readFileSync(join(env.FIRST_DRAFT_HOME,'native-inputs'),'utf8');
  assert.match(generationInputs,/7 active projects/);assert.match(generationInputs,/screen-2/);assert.match(generationInputs,/Missing navigation/,'the real done loop rejected and repaired a lost source edge');
  for(const pattern of [/clipped text/,/Remove emoji filler/,/Redesign semantic metrics/,/Redesign semantic tokens/])assert.match(generationInputs,pattern,'actual done-loop feedback drives structural and semantic repairs');
  env.FD_REVIEW_MALFORMED='1';
  const refused=join(project,'invalid-review');
  await assert.rejects(run('redesign',sourceDir,'Clearer','--no-references','--out',refused),e=>/invalid redesign semantic check/.test(e.stdout));
  assert.equal(existsSync(join(refused,'option-1.html')),false);delete env.FD_REVIEW_MALFORMED;
  const reviewCount=()=>readFileSync(join(env.FIRST_DRAFT_HOME,'native-inputs'),'utf8').trim().split('\n').map(JSON.parse).filter(r=>r.tools.some(t=>t.name==='assess_redesign')).length;
  const beforeReviews=reviewCount();env.FD_REVIEW_ALWAYS_FAIL='1';
  await assert.rejects(run('redesign',sourceDir,'Clearer','--no-references','--out',refused),e=>/failed after 3 versions/.test(e.stdout));
  assert.equal(reviewCount()-beforeReviews,3,'semantic review is capped at three versions');delete env.FD_REVIEW_ALWAYS_FAIL;
  assert.ok(!requests.some(r=>r.url==='/never.js'));
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
  const made=JSON.parse((await run('make','make it like Vercel; one notes page for Umer','--options','1','--out',out)).stdout);
  assert.equal(made.references.name,'Vercel');assert.equal(made.made.render_check,'checked');
  const reference=JSON.parse(readFileSync(out+'.refs.json','utf8'));
  assert.equal(reference.shots.length,2);assert.doesNotMatch(readFileSync(out,'utf8'),/data:image|Build something clear/);
  await run('refine',out,'warmer palette','--out',warm);
  assert.match(readFileSync(warm,'utf8'),/A warm note/);assert.deepEqual(JSON.parse(readFileSync(warm+'.refs.json','utf8')),reference);
  const inputs=readFileSync(join(env.FIRST_DRAFT_HOME,'native-inputs'),'utf8').trim().split('\n').map(JSON.parse).filter(r=>r.tools.some(t=>t.name==='done')&&!JSON.stringify(r.messages).includes('SOURCE INVENTORY:'));
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
  await run('make','notes for Umer','--options','1','--no-references','--out',out);
  assert.equal(existsSync(out+'.refs.json'),false,'overwriting without references removes stale option provenance');
  writeFileSync(out+'.refs.json',JSON.stringify({...reference,shots:reference.shots.map(s=>({...s,dataUrl:'data:text/html,not an image'}))}));
  assert.equal((await fetch(new URL('/refs/1/0',view))).status,422,'malformed sidecars cannot serve arbitrary content');
  const cachedShot=join(captured.cache,'..',manifest.screenshots[0].file);
  writeFileSync(cachedShot,Buffer.concat([readFileSync(cachedShot),Buffer.from('tampered')]));
  const requestsBeforeCorruption=requests.length;
  await assert.rejects(run('references','--like',origin+'/','--capture'),e=>/Cached reference screenshot changed/.test(e.stdout));
  assert.equal(requests.length,requestsBeforeCorruption,'corrupt cache refuses instead of silently refetching');
});
