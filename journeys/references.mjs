// Nonpaid whole-product recapture of a retained real model output and its portable reference sidecar.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { readOptionReferences } from '../src/reference-capture.mjs';
import { readCompetitors } from '../src/reference-competitors.mjs';
import { readSources } from '../src/reference-sources.mjs';
const root=new URL('..',import.meta.url).pathname,source=process.env.FD_REFERENCE_SOURCE,out=process.env.DONE_DONE_EVIDENCE_ROOT;
if(!source||!out)throw Error('Set FD_REFERENCE_SOURCE to the retained real make output with its .refs.json sidecar; run through done-done');
const file=resolve(source),reference=readOptionReferences(file);
// A retained --competitors run also carries the market sidecar, and a retained --inspiration run its sources list: the same viewer
// proof then covers what the market does and every free source that was found, captured or kept as a link.
const comparison=readCompetitors(file),sources=readSources(file);
assert.ok(reference||comparison||sources,'Source needs real reference, competitor or inspiration sidecar metadata');
const dir=mkdtempSync('/var/tmp/fd-reference-view-');
const support=resolve(out,'..',`${basename(out)}-support`);mkdirSync(out,{recursive:true});mkdirSync(support,{recursive:true});
const env={...process.env,FIRST_DRAFT_HOME:join(dir,'config')};
for(const key of ['CHROME_DEVTOOLS_AXI_AUTO_CONNECT','CHROME_DEVTOOLS_AXI_BROWSER_URL','CHROME_DEVTOOLS_AXI_PORT'])delete env[key];
const run=(bin,args)=>execFileSync(bin,args,{env,encoding:'utf8',timeout:90_000,maxBuffer:10_000_000});
const hash=b=>createHash('sha256').update(b).digest('hex');
let view;
try{
  view=spawn(process.execPath,[join(root,'src/cli.mjs'),'view',file,'--host','127.0.0.1','--port','0'],{env,stdio:['ignore','pipe','pipe']});
  const url=await new Promise((ok,no)=>{let text='';const timer=setTimeout(()=>no(Error('View startup deadline')),15_000);view.stdout.on('data',b=>{text+=b;if(text.includes('\n')){clearTimeout(timer);const r=JSON.parse(text);r.viewing?ok(r.viewing.url):no(Error(r.error?.message||text));}});view.once('exit',code=>{clearTimeout(timer);no(Error(`View exited ${code}`));});view.once('error',no);});
  writeFileSync(join(support,'source.json'),JSON.stringify({file,sha256:hash(readFileSync(file)),...(['.refs.json','.competitors.json','.sources.json'].some((x)=>existsSync(file+x))&&{sidecars:['.refs.json','.competitors.json','.sources.json'].filter((x)=>existsSync(file+x)).map((x)=>({name:x,sha256:hash(readFileSync(file+x))}))}),...(!reference?{}:{referenceSha256:hash(readFileSync(file+'.refs.json')),capturedAt:reference.fetched_at,sourceUrl:reference.url}),retained:true},null,2));
  const metrics=[];
  for(const theme of ['light','dark'])for(const width of [390,1280]){
    const height=width===390?844:800;
    env.CHROME_DEVTOOLS_AXI_SESSION=`fd-references-${process.pid}-${theme}-${width}`;
    env.CHROME_DEVTOOLS_AXI_USER_DATA_DIR=join(dir,`${theme}-${width}`);
    const browser=(...args)=>run('chrome-devtools-axi',args);
    try{
      const pages=browser('pages');writeFileSync(join(support,`pages-${theme}-${width}.txt`),pages);
      const id=pages.match(/^\s*(\d+),about:blank,/m)?.[1];assert.ok(id,'Fresh owned browser must expose its blank page');
      browser('selectpage',id);
      browser('emulate','--viewport',`${width}x${height}x1`,'--color-scheme',theme);
      browser('resize',String(width),String(height));
      browser('open',`${url}#/o/1/${width===390?'phone':'desktop'}`);
      const metric=browser('eval',`async()=>{await Promise.all([...document.images].map(i=>i.decode()));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const refs=[...document.querySelectorAll('.reference-shot img')];if(innerWidth!==${width}||document.documentElement.scrollWidth>innerWidth||refs.length!==${reference?2:0}||refs.some(i=>!i.naturalWidth||i.getBoundingClientRect().height<20)||!document.querySelector('.stage iframe'))throw Error('Reference viewer did not settle at requested width');return{width:innerWidth,height:innerHeight,theme:matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light',referenceImages:refs.length,sourceLinks:document.querySelectorAll('.reference-link').length,scrollContainers:[...document.querySelectorAll('*')].filter(e=>/auto|scroll/.test(getComputedStyle(e).overflowY)&&e.scrollHeight>e.clientHeight).length};}`);
      await new Promise(r=>setTimeout(r,300));
      const shot=join(out,`references-${width}-${theme}.png`);browser('screenshot',shot);
      const png=readFileSync(shot);assert.equal(png.readUInt32BE(16),width);assert.equal(png.readUInt32BE(20),height);
      metrics.push({width,theme,metric});console.log(`captured references-${width}-${theme}.png`);
      if(comparison){
        const entries=comparison.competitors.length,images=comparison.competitors.reduce((n,c)=>n+c.shots.length,0),refused=comparison.refused.length;
        const market=browser('eval',`async()=>{const s=document.querySelector('.references.market');if(!s)throw Error('Market comparison section missing');s.scrollIntoView({block:'start'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const cards=[...s.querySelectorAll('.market-card')],imgs=[...s.querySelectorAll('.market-shot img')],links=[...s.querySelectorAll('.market-card h3 a')],refused=[...s.querySelectorAll('.market-refused li')];await Promise.all(imgs.map(i=>i.decode()));if(cards.length!==${entries}||links.length!==${entries})throw Error('Not every captured competitor is shown');if(imgs.length!==${images}||links.some(a=>!/^https?:/.test(a.href))||imgs.some(i=>!i.naturalWidth||i.getBoundingClientRect().height<20)||document.documentElement.scrollWidth>innerWidth)throw Error('Market comparison did not settle at requested width');if(s.scrollHeight>s.clientHeight+1||s.scrollWidth>s.clientWidth+1)throw Error('The market comparison hides its own content behind a scroll');const clipped=cards.filter(c=>{const b=c.getBoundingClientRect();return !b.width||!b.height||b.bottom>s.getBoundingClientRect().bottom+1});if(clipped.length)throw Error('A captured competitor card sits outside the market comparison');if(${refused}!==refused.length)throw Error('The refusal list is incomplete');const panel=document.querySelector('.work'),room=panel?panel.getBoundingClientRect().bottom:innerHeight;if(s.getBoundingClientRect().bottom>room+1)throw Error(\`The market comparison runs past the panel: its last competitor or refusal is cut off (\${Math.round(s.getBoundingClientRect().bottom)} > \${Math.round(room)})\`);return{entries:links.length,cards:cards.length,images:imgs.length,refused:refused.length,reasons:refused.map(l=>l.textContent.trim()),sources:links.map(a=>a.getAttribute('href')),panelRoom:Math.round(room),marketBottom:Math.round(s.getBoundingClientRect().bottom),width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth};}`);
        await new Promise(r=>setTimeout(r,300));
        const marketShot=join(out,`market-${width}-${theme}.png`);browser('screenshot',marketShot);
        const marketPng=readFileSync(marketShot);assert.equal(marketPng.readUInt32BE(16),width);assert.equal(marketPng.readUInt32BE(20),height);
        metrics.push({width,theme,market});console.log(`captured market-${width}-${theme}.png`);
      }
      if(sources){
        const captured=sources.sources.filter((x)=>x.status==='captured'),links=sources.sources.filter((x)=>x.status!=='captured'),refusedSearches=sources.searches.filter((x)=>x.status==='refused'),images=captured.reduce((n,c)=>n+(c.shots?.length??0),0);
        const inspiration=browser('eval',`async()=>{const s=document.querySelector('.references.sources');if(!s)throw Error('Inspiration sources section missing');s.scrollIntoView({block:'start'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const cards=[...s.querySelectorAll('.market-card')],imgs=[...s.querySelectorAll('.market-shot img')],links=[...s.querySelectorAll('.market-refused li')];await Promise.all(imgs.map(i=>i.decode()));if(cards.length!==${captured.length})throw Error('Not every captured source is shown');if(imgs.length!==${images}||imgs.some(i=>!i.naturalWidth||i.getBoundingClientRect().height<20))throw Error('A captured source image did not decode');if(links.length!==${links.length}${refusedSearches.length?`+${refusedSearches.length}`:''})throw Error('The link-only or refused-search list is incomplete');if(document.documentElement.scrollWidth>innerWidth)throw Error('The sources list overflows the viewport');if(s.scrollHeight>s.clientHeight+1||s.scrollWidth>s.clientWidth+1)throw Error('The sources list hides its own content behind a scroll');const panel=document.querySelector('.work'),room=panel?panel.getBoundingClientRect().bottom:innerHeight;if(s.getBoundingClientRect().bottom>room+1)throw Error(\`The sources list runs past the panel: its last entry is cut off (\${Math.round(s.getBoundingClientRect().bottom)} > \${Math.round(room)})\`);return{cards:cards.length,images:imgs.length,linkOnly:${links.length},refusedSearches:${refusedSearches.length},descriptions:[...s.querySelectorAll('.market-card p')].map(p=>p.textContent.trim()).filter(Boolean).length,sources:[...s.querySelectorAll('.market-card h3 a')].map(a=>a.getAttribute('href')),width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth};}`);
        await new Promise(r=>setTimeout(r,300));
        const sourcesShot=join(out,`sources-${width}-${theme}.png`);browser('screenshot',sourcesShot);
        const sourcesPng=readFileSync(sourcesShot);assert.equal(sourcesPng.readUInt32BE(16),width);assert.equal(sourcesPng.readUInt32BE(20),height);
        metrics.push({width,theme,sources:inspiration});console.log(`captured sources-${width}-${theme}.png`);
      }
    }finally{browser('stop');}
  }
  writeFileSync(join(support,'metrics.json'),JSON.stringify(metrics,null,2));
  // A run made once, by the real CLI, is described as such: its own start, its own steps (the sources panel is a step only when the
  // retained make output carries one) and a result that says what a viewer sees, so a claim is matched against what really happened.
  const began=sources?'A retained real make run of a mobile brief with --inspiration: the page it drew and the free-source list it recorded, including the searches and pages it had to refuse; no model or source-site call during this playback.':'Retained real byokit:claude design and its cached reference images; no model or source-site calls during this run.';
  const walked=['Start the real CLI viewer on a private loopback port with isolated product configuration.','Open the actual option in owned browser profiles at phone 390 and desktop 1280, each in light and dark.','Wait for both cached reference images to decode, verify source links and option frame, measure scroll containers and capture each whole viewport including application navigation.',...(sources?['Open the inspiration-sources panel of that real make run: read the search date, the product type, the free-source searches that answered and the ones that refused, and every page kept as a link with its description and reason because its own terms or robots refuse a capture.']:[])];
  writeFileSync(join(out,'steps.json'),JSON.stringify({target:{version:run('git',['-C',root,'rev-parse','HEAD']).trim()},start:began,steps:walked,result:'The actual First Draft viewer shows two source-linked reference captures above the generated notes option at phone and desktop widths.'+(comparison?` The same viewer shows the ${comparison.competitors.length} captured competitors of the market comparison beside the option, each with its own live source URL, and ${comparison.refused.length} refusal(s) with their reasons. Not captured: nothing is drawn in a refused competitor\'s place.`:'')+(sources?` The inspiration-sources list of that real make run shows what its free search found for the mobile brief: ${sources.searches.filter((x)=>x.status==='ok').length} search(es) answered, ${sources.searches.filter((x)=>x.status==='refused').length} refused with the reason, ${sources.sources.filter((x)=>x.status==='captured').length} page(s) whose own terms allowed a capture and ${sources.sources.filter((x)=>x.status!=='captured').length} kept as a link with its description and reason, and the ${sources.sources.filter((x)=>!x.url).length} app capture(s) the run refused rather than take a device that was not its own.`:'')+' References come from the permissioned local Umer Reference Lab fixture, not the real Vercel site. This nonpaid run proves cached reference presentation, not a new model run or live internet reachability.'},null,2));
}finally{view?.kill();rmSync(dir,{recursive:true,force:true});}
