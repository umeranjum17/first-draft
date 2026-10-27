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
const BAD_STRUCTURE=BAD_SEMANTICS.replace('href="#screen-2"','href="#screen-1"').replace('<h1>Umer projects</h1>','<h1>Umer projects</h1><span style="display:block;width:4px;overflow:hidden;white-space:nowrap">clipped metric label</span><p>✨</p><nav style="position:fixed;inset:0 0 auto;height:160px;background:#fafafa">Umer menu</nav>');
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
    if(req.url==='/terms-restricted') return send('text/html','<h1>Reference permission</h1><p>Automated screenshots are prohibited.</p>');
    if(req.url==='/market-a'||req.url==='/market-b'||req.url==='/market-c') return send('text/html',`<title>Umer market ${req.url.slice(-1).toUpperCase()}</title><h1>Umer market ${req.url.slice(-1).toUpperCase()}</h1><p>Another product for the same job.</p><a href="/terms">Terms</a>`);
    if(req.url==='/market-restricted') return send('text/html','<title>Umer restricted</title><h1>Umer restricted</h1><p>Another product for the same job.</p><a href="/terms-restricted">Terms</a>');
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
 if(tools.some(t=>t.name==='write_page'))calls=[call('write_page',{html:"<!doctype html><html><body><h1>Umer notes</h1></body></html>"})];
 else if(tools.some(t=>t.name==='identify_reference'))calls=[call('identify_reference',{name:'Vercel',url:process.env.FD_BRAND_ORIGIN+'/'} )];
 else if(tools.some(t=>t.name==='assess_reference_terms')){const q=JSON.parse(messages.at(-1).content),no=/prohibited/i.test(q.text);calls=[call('assess_reference_terms',{decision:process.env.FD_TERMS_DECISION||(no?'blocked':'allowed'),quote:no?'Automated screenshots are prohibited.':${JSON.stringify(PERMISSION)}})];}
 else if(tools.some(t=>t.name==='name_market_competitors')){const o=process.env.FD_BRAND_ORIGIN,all=[['Market A','market-a'],['Market B','market-b'],['Market C','market-c'],['Restricted Market','market-restricted'],['Robots Market','specific']];calls=[call('name_market_competitors',{products:(process.env.FD_COMPETITORS_FEW?all.slice(0,2):all).map(([name,path])=>({name,url:o+'/'+path}))})];}
 else if(tools.some(t=>t.name==='define_redesign_plan')){
  if(JSON.parse(args[args.indexOf('--json-schema')+1]).properties.calls.maxItems!==1||process.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS!=='8192')throw Error('structural single-response budget missing');
  const q=JSON.parse(messages.at(-1).content),bad=process.env.FD_PLAN_BAD||(process.env.FD_PLAN_REPAIR&&q.attempt===1?'uri':'');
  const css=${JSON.stringify(REDESIGN_PAGE.match(/<style>([\s\S]*?)<\/style>/)[1])}+(process.env.FD_PLAN_LARGE?'/*'+'x'.repeat(13000)+'*/':'')+(bad==='uri'?'.icon{background:url("data:image/svg+xml,%3Csvg/%3E")}':bad==='size'?'/*'+'x'.repeat(21000)+'*/':bad?'#screen-1{color:red}':'');
  calls=[call('define_redesign_plan',{title:'Umer projects',css,notes:'Use the same metric and value classes everywhere'})];
 }
 else if(tools.some(t=>t.name==='write_redesign_screen')){
  const q=JSON.parse(messages.at(-1).content),first=q.attempt===1;if(q.screen.id==='screen-2'&&!q.component_example?.html.includes('id="screen-1"'))throw Error('accepted component example missing');if(!args[args.indexOf('--system-prompt')+1].includes('all-state desktop board'))throw Error('responsive source preservation rule missing');
  let page=process.env.FD_REVIEW_ALWAYS_FAIL?${JSON.stringify(BAD_SEMANTICS)}:first&&q.screen.id==='screen-1'?${JSON.stringify(BAD_STRUCTURE)}:first?${JSON.stringify(BAD_SEMANTICS)}:${JSON.stringify(REDESIGN_PAGE)};
  let html=page.match(new RegExp('<section data-oc-screen id="'+q.screen.id+'">[\\\\s\\\\S]*?<\\\\/section>'))[0];
  if(!q.screen.links.some(l=>l.target&&l.target!==q.screen.id))html=html.replace(/<a href="#[^"]+">([\\s\\S]*?)<\\/a>/g,'$1');
  if(!q.previous_attempts&&!process.env.FD_REVIEW_ALWAYS_FAIL&&!process.env.FD_EXTRA_SCREEN&&q.screen.id==='screen-1'&&q.attempt>1){if(!q.feedback.some(f=>f.includes('clipped text'))||!q.feedback.some(f=>f.includes('Redesign semantic metrics')))throw Error('layout and semantic feedback were not aggregated');if(q.attempt===3&&!q.feedback.some(f=>f.includes('Remove diagnostic provenance notes')))throw Error('third attempt lost second-attempt feedback');if(q.attempt===2)html=html.replace('</section>','<p>(title cut off in source)</p></section>');}
  if(process.env.FD_EXTRA_SCREEN)html+='<section data-oc-screen id="extra">Extra screen</section>';
  calls=[call('write_redesign_screen',process.env.FD_SPLIT_SCREEN&&q.part===1?{id:q.screen.id,html:html.slice(0,40),complete:false}:{id:q.screen.id,html:html.slice(q.written_so_far?.length??0),complete:true})];
 }
 else if(tools.some(t=>t.name==='assess_reference_redesign')){if(!args[args.indexOf('--system-prompt')+1].includes('optional and not penalized'))throw Error('visual caption rubric missing');calls=[call('assess_reference_redesign',{verdict:'pass',checks:['reference-craft','metrics','coherence','content','responsive'].map((name,i)=>({name,passed:!(process.env.FD_VISUAL_BAD&&i===0),detail:'Fixture transport check only'}))})];}
 else if(tools.some(t=>t.name==='assess_redesign')) {
  if(Number(process.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS)!==8192)throw Error('semantic review reasoning budget missing');
  const q=JSON.parse(messages.at(-1).content),system=args[args.indexOf('--system-prompt')+1];if(q.scope==='single-screen'){if(!system.includes('BOTH desktop and phone')||!system.includes('Do not ask for other screens content')||!system.includes('optional and not penalized')||!system.includes('do not restyle it')||!q.source_screen.id||typeof q.frozen_shared_style!=='string')throw Error('own-source/frozen-style/caption rubric missing');if((q.exported_html.match(/data-oc-screen/g)||[]).length!==1)throw Error('review not scoped to one screen');}
  const bad=q.exported_html.includes('Remaining 3 tasks remaining')||q.exported_html.includes('magenta')||process.env.FD_REVIEW_ALWAYS_FAIL;
  calls=[call('assess_redesign',{checks:process.env.FD_REVIEW_MALFORMED?[{name:'metrics',passed:'yes',detail:'invalid'}]:[{name:'metrics',passed:!bad,detail:bad?'screen-1 metric: use one number and one label, not Remaining 3 tasks remaining':'Each metric has one number and one label'},{name:'tokens',passed:!bad,detail:bad?'screen-2 metric: remove magenta and 37px overrides; use shared tokens':'Both screens share global tokens'},...(q.scope==='single-screen'?[{name:'content',passed:true,detail:'Source copy and controls kept on desktop and phone'}]:[])]})];
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
  assert.equal(redesigned.made.judge.agent,'byokit:codex');assert.notEqual(redesigned.made.judge.model,redesigned.made.model);
  assert.equal(redesigned.made.files.length,1);
  assert.equal(redesigned.made.render_check,'checked');
  assert.equal(redesigned.made.files[0].self_check.reviews,5);
  assert.equal(redesigned.made.files[0].source,'per-screen HTML');assert.equal(redesigned.made.files[0].tools.define_redesign_plan,1);assert.equal(redesigned.made.files[0].tools.write_redesign_screen,5);assert.deepEqual(redesigned.made.files[0].self_check.screen_attempts.map(p=>p.attempts),[3,2]);assert.equal(redesigned.made.files[0].self_check.screen_reviews.length,2);
  const third=JSON.parse(readFileSync(join(redesignOut,'writer-option-1/screen-1-attempt-3.json')));for(const p of [/clipped text/,/Redesign semantic metrics/,/Remove diagnostic provenance notes/])assert.ok(third.feedback_sent.some(f=>p.test(f)),'third response gets every earlier finding');
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
  for(const [bad,pattern] of [['1',/screen-specific/],['uri',/including data: URLs/],['size',/1-20000 characters/]]){env.FD_PLAN_BAD=bad;const badPlan=join(project,'bad-plan-'+bad);await assert.rejects(run('redesign',sourceDir,'Clearer','--no-references','--out',badPlan),e=>/after 2 attempts/.test(e.stdout)&&pattern.test(e.stdout));const planDir=join(badPlan,'writer-option-1');assert.equal(JSON.parse(readFileSync(join(planDir,'shared-plan-attempt-2.json'))).passed,false);assert.equal(existsSync(join(planDir,'shared-plan-attempt-3.json')),false);assert.equal(existsSync(join(badPlan,'option-1.html')),false);}delete env.FD_PLAN_BAD;
  env.FD_PLAN_LARGE='1';env.FD_PLAN_REPAIR='1';const largeOut=join(project,'large-shared-plan'),large=JSON.parse((await run('redesign',sourceDir,'Clearer','--no-references','--out',largeOut)).stdout);assert.equal(large.made.files[0].self_check.plan_responses,2);const acceptedPlan=JSON.parse(readFileSync(join(largeOut,'writer-option-1/shared-plan.json')));assert.ok(acceptedPlan.css.length>12000&&acceptedPlan.css.length<20000);assert.doesNotMatch(acceptedPlan.css,/url\s*\(/i);delete env.FD_PLAN_LARGE;delete env.FD_PLAN_REPAIR;
  await run('redesign',sourceDir,'Clearer projects','--no-references','--out',join(project,'local-redesign'));
  assert.equal(JSON.parse(readFileSync(join(project,'local-redesign/sources/sources.json'))).pages[0].url,'/index.html');
  const aliasDir=join(project,'alias-export');mkdirSync(aliasDir);for(const f of ['index.html','again.html'])writeFileSync(join(aliasDir,f),'<title>Umer tickets</title><h1>Tickets</h1><a href="again.html">Tickets</a>');
  env.FD_SPLIT_SCREEN='1';const aliased=JSON.parse((await run('redesign',aliasDir,'Clearer','--no-references','--out',join(project,'alias-redesign'))).stdout).made.files[0];delete env.FD_SPLIT_SCREEN;
  assert.deepEqual(aliased.self_check.screen_attempts.map(p=>[p.id,p.alias_of,p.attempts,p.parts]),[['screen-1',undefined,3,2],['screen-2','screen-1',0,undefined]]);assert.equal(aliased.tools.write_redesign_screen,6,'each attempt is written in two capped parts and the equivalent entry reuses accepted markup without another writer response');
  const [one,two]=readFileSync(aliased.file,'utf8').match(/<section[\s\S]*?<\/section>/g);assert.equal(two,one.replace('id="screen-1"','id="screen-2"'));assert.deepEqual(aliased.self_check.semantic.map(c=>c.name),['metrics','tokens','content']);assert.equal(aliased.self_check.response_deadline_ms,420000);
  await assert.rejects(run('redesign',origin+'/product.html','Clearer','--out',redesignOut,'--max-pages','13'),e=>/max-pages/.test(e.stdout));
  await assert.rejects(run('redesign',origin+'/login','Clearer','--no-references','--out',redesignOut),e=>/Login/.test(e.stdout));
  env.FD_EXTRA_SCREEN='1';const extraOut=join(project,'extra-screen');await assert.rejects(run('redesign',sourceDir,'Clearer','--no-references','--out',extraOut),e=>/failed after 3 attempts.*Expected exactly/s.test(e.stdout));assert.equal(existsSync(join(extraOut,'writer-option-1/screen-1-attempt-4.json')),false);assert.equal(existsSync(join(extraOut,'option-1.html')),false);delete env.FD_EXTRA_SCREEN;
  await promisify(execFile)(process.execPath,['--input-type=module','-e',`import assert from 'node:assert/strict';import {checkRedesign} from ${JSON.stringify(new URL('../src/redesign-check.mjs',import.meta.url).href)};const r=await checkRedesign({html:'<section id="screen-1" data-oc-screen><b>0</b><span>Review</span><small>Nothing to review</small></section>',agent:'byokit:claude',model:'claude-opus-5-5',screen:{id:'screen-1',title:'Review',text:'0 Review Nothing to review'},sharedStyle:':root{--bg:white}',sourceIntent:'Preserve this source screen caption'});assert.ok(r.checks.every(c=>c.passed));`],{env,cwd:project,timeout:30000,maxBuffer:100000});
  const generationInputs=readFileSync(join(env.FIRST_DRAFT_HOME,'native-inputs'),'utf8');
  assert.match(generationInputs,/7 active projects/);assert.match(generationInputs,/screen-2/);assert.match(generationInputs,/Never put diagnostic\/provenance notes/);assert.match(generationInputs,/source-present charts/);assert.match(generationInputs,/Missing navigation/,'the real per-screen writer rejected and repaired a lost source edge');
  for(const pattern of [/Expected exactly 1 distinct/,/clipped text/,/covered by fixed or sticky navigation/,/Remove emoji filler/,/Remove diagnostic provenance notes/,/Redesign semantic metrics/,/Redesign semantic tokens/])assert.match(generationInputs,pattern,'actual per-screen feedback drives structural and semantic repairs');
  env.FD_REVIEW_MALFORMED='1';
  const refused=join(project,'invalid-review');
  await assert.rejects(run('redesign',sourceDir,'Clearer','--no-references','--out',refused),e=>/invalid redesign semantic check/.test(e.stdout));
  assert.equal(existsSync(join(refused,'option-1.html')),false);delete env.FD_REVIEW_MALFORMED;
  const reviewCount=()=>readFileSync(join(env.FIRST_DRAFT_HOME,'native-inputs'),'utf8').trim().split('\n').map(JSON.parse).filter(r=>r.tools.some(t=>t.name==='assess_redesign')).length;
  const beforeReviews=reviewCount();env.FD_REVIEW_ALWAYS_FAIL='1';
  await assert.rejects(run('redesign',sourceDir,'Clearer','--no-references','--out',refused),e=>/failed after 3 attempts/.test(e.stdout));
  assert.equal(reviewCount()-beforeReviews,3,'a persistently failing screen stops at the three-attempt contract');assert.equal(existsSync(join(refused,'writer-option-1/screen-1-attempt-4.json')),false);assert.equal(existsSync(join(refused,'option-1.html')),false);delete env.FD_REVIEW_ALWAYS_FAIL;
  const budgetOut=join(project,'remaining-budget'),budgetBefore=reviewCount();env.FD_REVIEW_ALWAYS_FAIL='1';await assert.rejects(run('redesign',sourceDir,'Repair prior visual failure','--no-references','--out',budgetOut,'--used-screen-attempts','1','--used-plan-attempts','1'),e=>/failed after 3 attempts/.test(e.stdout));delete env.FD_REVIEW_ALWAYS_FAIL;assert.equal(reviewCount()-budgetBefore,2,'only two screen responses remain');for(const f of ['shared-plan-attempt-2.json','screen-1-attempt-2.json','screen-1-attempt-3.json'])assert.ok(existsSync(join(budgetOut,'writer-option-1',f)));for(const f of ['shared-plan-attempt-1.json','shared-plan-attempt-3.json','screen-1-attempt-1.json','screen-1-attempt-4.json'])assert.equal(existsSync(join(budgetOut,'writer-option-1',f)),false);for(const [flag,n]of [['--used-screen-attempts','3'],['--used-plan-attempts','2']])await assert.rejects(run('redesign',sourceDir,'Repair','--out',budgetOut,flag,n),e=>/budgets cannot be increased/.test(e.stdout));
  assert.ok(!requests.some(r=>r.url==='/never.js'));
  const before=requests.length;
  assert.equal(JSON.parse((await run('references','--like',origin+'/','--capture')).stdout).reference_capture.cached,true);
  assert.equal(requests.length,before,'fresh project cache makes no site calls');
  const brokenBrowser=join(dir,'bin','broken-browser');writeFileSync(brokenBrowser,`#!${process.execPath}\nprocess.stderr.write('synthetic browser startup failure\\n');process.exit(7);`,{mode:0o700});env.FIRST_DRAFT_CHROME=brokenBrowser;await assert.rejects(run('references','--like',origin+'/browser-startup','--capture'),e=>/browser exited before it was ready/.test(e.stdout)&&e.stdout.includes(brokenBrowser)&&/synthetic browser startup failure/.test(e.stdout));delete env.FIRST_DRAFT_CHROME;
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
  const visualProbe=`import assert from 'node:assert/strict';import {reviewReferences} from ${JSON.stringify(new URL('../journeys/redesign-reference-check.mjs',import.meta.url).href)};const input={quality:[${JSON.stringify(join(captured.cache,'..',manifest.screenshots[0].file))}],diagnostics:[],captures:[{file:${JSON.stringify(join(captured.cache,'..',manifest.screenshots[1].file))},label:'fixture capture only'}],agent:'byokit:claude',model:'claude-opus-5-5'};if(process.env.FD_VISUAL_BAD)await assert.rejects(reviewReferences(input),/inconsistent visual benchmark/);else assert.equal((await reviewReferences(input)).verdict,'pass');`;
  for(const bad of ['', '1'])await promisify(execFile)(process.execPath,['--input-type=module','-e',visualProbe],{env:{...env,FD_VISUAL_BAD:bad},cwd:project,timeout:30000,maxBuffer:100000});
  const out=join(project,'notes.html'),warm=join(project,'warm.html');
  const made=JSON.parse((await run('make','make it like Vercel; one notes page for Umer','--options','1','--engine','--out',out)).stdout);
  assert.equal(made.references.name,'Vercel');assert.equal(made.made.render_check,'checked');
  const reference=JSON.parse(readFileSync(out+'.refs.json','utf8'));
  assert.equal(reference.shots.length,2);assert.doesNotMatch(readFileSync(out,'utf8'),/data:image|Build something clear/);
  await run('refine',out,'warmer palette','--out',warm);
  assert.match(readFileSync(warm,'utf8'),/A warm note/);assert.deepEqual(JSON.parse(readFileSync(warm+'.refs.json','utf8')),reference);
  const inputs=readFileSync(join(env.FIRST_DRAFT_HOME,'native-inputs'),'utf8').trim().split('\n').map(JSON.parse).filter(r=>r.tools.some(t=>t.name==='done')&&!JSON.stringify(r.messages).includes('SOURCE INVENTORY:'));
  assert.ok(inputs.length>=8&&inputs.every(r=>r.images===2&&r.system.includes('Observed reference visual language')),'capture pixels and observed brief reach every generation turn');
  // Competitor search: from the brief alone, 3-5 real products through the same robots/terms capture path; refusals reported, never filled in.
  const comp=join(project,'market.html');
  await assert.rejects(run('make','A notes app for Umer','--competitors','--no-references','--out',comp),e=>/conflicts/.test(e.stdout));
  await assert.rejects(run('make','A notes app for Umer','--competitors','--like','Vercel','--out',comp),e=>/use --like/.test(e.stdout));
  assert.equal(existsSync(comp),false);
  env.FD_COMPETITORS_FEW='1';
  const beforeFew=requests.length;
  await assert.rejects(run('make','A notes app for Umer','--competitors','--options','1','--engine','--out',comp),e=>/did not name 3 to 5/.test(e.stdout));
  assert.equal(existsSync(comp),false,'no option is made when fewer than three competitors are found');
  assert.equal(requests.length,beforeFew,'a failed discovery fetches no competitor page');
  delete env.FD_COMPETITORS_FEW;
  const market=JSON.parse((await run('make','A notes app for Umer','--competitors','--options','1','--engine','--out',comp)).stdout);
  assert.deepEqual(market.competitors.captured.map(c=>c.name).sort(),['Market A','Market B','Market C']);
  assert.equal(market.competitors.refused.length,2);
  assert.match(market.competitors.refused.find(r=>r.url.endsWith('/specific')).why,/robots\.txt disallows/,'a refusing robots page is reported as refused');
  assert.match(market.competitors.refused.find(r=>r.url.endsWith('/market-restricted')).why,/restricted.*no screenshots/s,'a restrictive terms page is reported as refused');
  const set=JSON.parse(readFileSync(comp+'.competitors.json','utf8'));
  assert.equal(set.competitors.length+set.refused.length,5,'every named competitor is either captured or refused');
  for(const c of set.competitors){assert.match(c.url,/^http:\/\/127\.0\.0\.1:\d+\/market-[abc]$/);assert.match(c.terms_url,/\/terms$/);assert.match(c.licence_note,/Anonymous automated browsers/);assert.equal(c.shots.length,2);for(const s of c.shots){const b=Buffer.from(s.dataUrl.slice(22),'base64');assert.equal(b.readUInt32BE(16),s.width);assert.equal(b.readUInt32BE(20),s.height);}}
  assert.ok(!requests.some(r=>r.url==='/specific'),'a robots-refused candidate page is never fetched');
  assert.ok(requests.some(r=>r.url==='/terms-restricted'),'a restrictive candidate is refused on its own public terms, before any screenshot');
  const port=await new Promise(ok=>{const s=portServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>ok(p));});});
  const child=spawn(process.execPath,[CLI,'view',out,warm,comp,'--host','127.0.0.1','--port',String(port)],{env,cwd:project,stdio:['ignore','pipe','pipe']});
  t.after(()=>child.kill());
  const opened=await new Promise((ok,no)=>{let text='';const timer=setTimeout(()=>no(Error('view startup timed out')),10_000);child.stdout.on('data',b=>{text+=b;if(text.includes('\n')){clearTimeout(timer);ok(JSON.parse(text));}});child.on('exit',()=>{clearTimeout(timer);no(Error('view exited'));});});
  const view=opened.viewing.url;
  const data=JSON.parse((await(await fetch(view)).text()).match(/id="design">([\s\S]*?)<\/script>/)[1]);
  assert.equal(data.options[0].references.name,'Vercel');
  for(const shot of data.options[0].references.shots){const r=await fetch(new URL(shot.src,view));assert.equal(r.headers.get('content-type'),'image/png');assert.equal(Buffer.from(await r.arrayBuffer()).readUInt32BE(16),shot.width);}
  assert.equal(data.options[2].competitors.competitors.length,3,'the market shows beside the options');
  assert.deepEqual(data.options[2].competitors.competitors.map(c=>c.name),['Market A','Market B','Market C']);
  assert.equal(data.options[2].competitors.refused.length,2,'the refusals stay visible with their reason');
  assert.ok(data.options[2].competitors.refused.every(r=>typeof r.why==='string'&&r.why.length>10));
  for(const c of data.options[2].competitors.competitors){assert.match(c.url,/^http:\/\/127\.0\.0\.1:\d+\/market-/,'every competitor carries its own live source URL');for(const shot of c.shots){const r=await fetch(new URL(shot.src,view));assert.equal(r.headers.get('content-type'),'image/png');const png=Buffer.from(await r.arrayBuffer());assert.equal(png.readUInt32BE(16),shot.width);assert.equal(png.readUInt32BE(20),shot.height);}}
  const changed=await fetch(new URL('/refine',view),{method:'POST',headers:{origin:new URL(view).origin,'content-type':'application/json'},body:JSON.stringify({option:1,change:'warmer palette'})});
  assert.equal(changed.status,200);assert.equal((await changed.json()).option.references.name,'Vercel','viewer refinement preserves references');
  await assert.rejects(run('make','notes','--like','Vercel','--no-references','--out',join(project,'bad.html')),e=>/conflicts/.test(e.stdout));
  await run('make','notes for Umer','--options','1','--engine','--no-references','--out',out);
  assert.equal(existsSync(out+'.refs.json'),false,'overwriting without references removes stale option provenance');
  writeFileSync(out+'.refs.json',JSON.stringify({...reference,shots:reference.shots.map(s=>({...s,dataUrl:'data:text/html,not an image'}))}));
  assert.equal((await fetch(new URL('/refs/1/0',view))).status,422,'malformed sidecars cannot serve arbitrary content');
  const cachedShot=join(captured.cache,'..',manifest.screenshots[0].file);
  writeFileSync(cachedShot,Buffer.concat([readFileSync(cachedShot),Buffer.from('tampered')]));
  const requestsBeforeCorruption=requests.length;
  await assert.rejects(run('references','--like',origin+'/','--capture'),e=>/Cached reference screenshot changed/.test(e.stdout));
  assert.equal(requests.length,requestsBeforeCorruption,'corrupt cache refuses instead of silently refetching');
});
