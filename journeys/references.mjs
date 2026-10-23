// Nonpaid whole-product recapture of a retained real model output and its portable reference sidecar.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { readOptionReferences } from '../src/reference-capture.mjs';
const root=new URL('..',import.meta.url).pathname,source=process.env.FD_REFERENCE_SOURCE,out=process.env.DONE_DONE_EVIDENCE_ROOT;
if(!source||!out)throw Error('Set FD_REFERENCE_SOURCE to the retained real make output with its .refs.json sidecar; run through done-done');
const file=resolve(source),reference=readOptionReferences(file);assert.ok(reference,'Source needs real reference metadata');
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
  writeFileSync(join(support,'source.json'),JSON.stringify({file,sha256:hash(readFileSync(file)),referenceSha256:hash(readFileSync(file+'.refs.json')),capturedAt:reference.fetched_at,sourceUrl:reference.url,retained:true},null,2));
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
      const metric=browser('eval',`async()=>{await Promise.all([...document.images].map(i=>i.decode()));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const refs=[...document.querySelectorAll('.reference-shot img')];if(innerWidth!==${width}||document.documentElement.scrollWidth>innerWidth||refs.length!==2||refs.some(i=>!i.naturalWidth||i.getBoundingClientRect().height<20)||!document.querySelector('.stage iframe'))throw Error('Reference viewer did not settle at requested width');return{width:innerWidth,height:innerHeight,theme:matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light',referenceImages:refs.length,sourceLinks:document.querySelectorAll('.reference-link').length,scrollContainers:[...document.querySelectorAll('*')].filter(e=>/auto|scroll/.test(getComputedStyle(e).overflowY)&&e.scrollHeight>e.clientHeight).length};}`);
      await new Promise(r=>setTimeout(r,300));
      const shot=join(out,`references-${width}-${theme}.png`);browser('screenshot',shot);
      const png=readFileSync(shot);assert.equal(png.readUInt32BE(16),width);assert.equal(png.readUInt32BE(20),height);
      metrics.push({width,theme,metric});console.log(`captured references-${width}-${theme}.png`);
    }finally{browser('stop');}
  }
  writeFileSync(join(support,'metrics.json'),JSON.stringify(metrics,null,2));
  writeFileSync(join(out,'steps.json'),JSON.stringify({target:{version:run('git',['-C',root,'rev-parse','HEAD']).trim()},start:'Retained real byokit:claude design and its cached reference images; no model or source-site calls during this run.',steps:['Start the real CLI viewer on a private loopback port with isolated product configuration.','Open the actual option in owned browser profiles at phone 390 and desktop 1280, each in light and dark.','Wait for both cached reference images to decode, verify source links and option frame, measure scroll containers and capture each whole viewport including application navigation.'],result:'The actual First Draft viewer shows two source-linked reference captures above the generated notes option at phone and desktop widths. References come from the permissioned local Umer Reference Lab fixture, not the real Vercel site. This nonpaid run proves cached reference presentation, not a new model run or live internet reachability.'},null,2));
}finally{view?.kill();rmSync(dir,{recursive:true,force:true});}
