// Nonpaid recapture of a real redesign run. Generation is a separate, explicitly budgeted CLI call.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
const root=new URL('..',import.meta.url).pathname, source=process.env.FD_REDESIGN_SOURCE, out=process.env.DONE_DONE_EVIDENCE_ROOT;
if(!source||!out)throw Error('Set FD_REDESIGN_SOURCE to a real redesign output folder and DONE_DONE_EVIDENCE_ROOT to the capture folder');
const dir=mkdtempSync('/var/tmp/fd-redesign-view-'), inventory=JSON.parse(readFileSync(join(source,'sources/sources.json'))), shots=[];
const before=process.env.FD_REDESIGN_BEFORE?JSON.parse(readFileSync(process.env.FD_REDESIGN_BEFORE)):null;
if(before){assert.equal(before.role,'diagnostic-images-only');assert.deepEqual(before.pages.map(p=>p.id),inventory.pages.map(p=>p.id));}
mkdirSync(out,{recursive:true});
const env={...process.env,FIRST_DRAFT_HOME:join(dir,'config')};
for(const k of ['CHROME_DEVTOOLS_AXI_AUTO_CONNECT','CHROME_DEVTOOLS_AXI_BROWSER_URL','CHROME_DEVTOOLS_AXI_PORT'])delete env[k];
const run=(bin,args)=>execFileSync(bin,args,{env,encoding:'utf8',timeout:90000,maxBuffer:10000000});
let view;
try {
  view=spawn(process.execPath,[join(root,'src/cli.mjs'),'view',resolve(source,'option-1.html'),'--host','127.0.0.1','--port','0'],{env,stdio:['ignore','pipe','pipe']});
  const opened=await new Promise((ok,no)=>{let s='';const timer=setTimeout(()=>no(Error('Viewer startup deadline')),15000);view.stdout.on('data',b=>{s+=b;if(s.includes('\n')){clearTimeout(timer);const r=JSON.parse(s);r.viewing?ok(r.viewing):no(Error(r.error?.message||s));}});view.once('exit',()=>{clearTimeout(timer);no(Error('Viewer exited'));});view.once('error',no);});
  for(const page of inventory.pages)for(const theme of ['light','dark'])for(const width of [390,1280]) {
    const height=width===390?844:800, key=`${page.id}-${width}-${theme}`;
    env.CHROME_DEVTOOLS_AXI_SESSION=`fd-redesign-${process.pid}-${key}`;env.CHROME_DEVTOOLS_AXI_USER_DATA_DIR=join(dir,key);
    const browser=(...args)=>run('chrome-devtools-axi',args);
    try {
      const id=browser('pages').match(/^\s*(\d+),about:blank,/m)?.[1];assert.ok(id,'Owned blank browser');browser('selectpage',id);
      browser('emulate','--viewport',`${width}x${height}x1`,'--color-scheme',theme);browser('resize',String(width),String(height));
      browser('open',`${opened.frames}/o/1?play&screen=${encodeURIComponent(page.id)}`);
      const metric=browser('eval',`async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const e=document.getElementById(${JSON.stringify(page.id)});if(!e||!e.getBoundingClientRect().height||innerWidth!==${width}||document.documentElement.scrollWidth>innerWidth)throw Error('Screen not ready');return {width:innerWidth,screen:e.id,active:document.documentElement.getAttribute('data-oc-active-screen'),scroll_containers:[...document.querySelectorAll('*')].filter(x=>{const r=x.getBoundingClientRect(),s=getComputedStyle(x);return r.width&&r.height&&(/auto|scroll/.test(s.overflowX)&&x.scrollWidth>x.clientWidth||/auto|scroll/.test(s.overflowY)&&x.scrollHeight>x.clientHeight)}).length,text:e.innerText.slice(0,400)};}`);
      const file=`${key}.png`;browser('screenshot',join(out,file));const png=readFileSync(join(out,file));assert.equal(png.readUInt32BE(16),width);assert.equal(png.readUInt32BE(20),height);
      const retained=before?.pages.find(p=>p.id===page.id),device=width===390?'phone':'desktop',original=retained?retained[device]:join(source,'sources',`${page.id}-${width}.png`),bytes=readFileSync(original);
      assert.equal(bytes.readUInt32BE(16),width);assert.equal(bytes.readUInt32BE(20),height);if(retained)assert.equal(createHash('sha256').update(bytes).digest('hex'),retained.sha256[device],'Unchanged diagnostic input, not new source proof');
      run('magick',[original,join(out,file),'+append',join(out,`${key}-source-and-redesign.png`)]);
      const edge=page.links.find(l=>l.target&&l.target!==page.id);
      const navigation=edge?browser('eval',`async()=>{const target=${JSON.stringify(edge?.target)},a=[...document.querySelectorAll('a[href]')].find(a=>a.getAttribute('href')==='#'+target&&a.getBoundingClientRect().height);if(!a)throw Error('No visible source edge');a.click();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));if(document.documentElement.getAttribute('data-oc-active-screen')!==target)throw Error('Navigation did not switch screen');return {clicked:true,target};}`):'No mapped outgoing edge';
      shots.push({file,metric,navigation});
    } finally { browser('stop'); }
  }
  writeFileSync(join(out,'steps.json'),JSON.stringify({target:{version:run('git',['-C',root,'rev-parse','HEAD']).trim()},start:before?'Retained real redesign output and retained diagnostic source pixels; no live re-probe, source execution, read-only acceptance claim or repeated generation':'Retained real redesign output and original light source viewports; no generation repeated',steps:['Launch real first-draft viewer on owned loopback ports','Open every screen independently at 390/1280, light/dark, using chrome-devtools-axi, then follow a visible source navigation link','Capture each whole redesigned viewport and place it beside its unchanged retained source viewport, without cropping either UI'],result:'Each paired capture shows one redesigned screen at 390 or 1280 wide, light or dark, next to its light source. Native viewer navigation reaches the mapped target. This is retained-output presentation proof, not new generation or a visual-reference fidelity verdict.',retainedHtmlSha256:createHash('sha256').update(readFileSync(resolve(source,'option-1.html'))).digest('hex'),shots,limitations:[...inventory.limitations,...(before?[before.warning,'Source metadata/navigation came from a thin offline index, not authenticated discovery. Paired left halves are unchanged historical inputs, not fresh captures.']:[])]},null,2));
} finally {view?.kill();rmSync(dir,{recursive:true,force:true});}
