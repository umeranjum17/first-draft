// Nonpaid benchmark INPUT capture. This never generates a redesign or calls a model/judge.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { references } from '../src/references.mjs';
const root=new URL('..',import.meta.url).pathname, input=process.env.FD_BENCHMARK_INPUT, out=process.env.DONE_DONE_EVIDENCE_ROOT;
if(!input||!out)throw Error('Set FD_BENCHMARK_INPUT to private source/reference JSON; run through done-done');
assert.ok(statSync(input).isFile()&&statSync(input).size<=64000,'Benchmark config must be a regular JSON file <=64 KB');
let config;try{config=JSON.parse(readFileSync(input));}catch{throw Error('Benchmark config is not valid JSON');}const cases=[];
assert.ok(Array.isArray(config.sources)&&config.sources.length>=1&&config.sources.length<=4,'Need 1-4 explicitly authorized sources');
assert.ok(Array.isArray(config.references)&&config.references.length>=1&&config.references.length<=6,'Need 1-6 permitted reference images');
await references(config.references); // Raster validation only; no account/model is involved.
const hash=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
const referenceInputs=config.references.map(file=>({file:basename(file),sha256:hash(file)}));
assert.ok(config.comparison_only===undefined||Array.isArray(config.comparison_only),'comparison_only must list local HTML prototype files');
const comparisonOnly=(config.comparison_only||[]).map(file=>{assert.ok(/\.html?$/i.test(file)&&!/^https?:/i.test(file)&&statSync(file).isFile(),'Comparison context must be local HTML, not a URL or credential file');return{file:basename(dirname(file))+'/'+basename(file),sha256:hash(file),role:'Rejected prototype context only, never the quality target'};});
const run=async(bin,args,env=process.env)=>(await promisify(execFile)(bin,args,{env,encoding:'utf8',timeout:300000,maxBuffer:4000000})).stdout;
mkdirSync(out,{recursive:true});
const names=new Set();
for(const item of config.sources){
  assert.ok(/^[a-z][a-z0-9-]{0,31}$/.test(item.name)&&!names.has(item.name),'Source names must be unique safe slugs');names.add(item.name);
  assert.ok(typeof item.source==='string'&&item.source.length<8000,'Each source requires a local folder or unsigned HTTP(S) URL');
  if(/^https?:/i.test(item.source)){let u;try{u=new URL(item.source);}catch{throw Error('Benchmark source URL is invalid');}assert.ok(!u.username&&!u.password&&!u.search,'Keep signed URLs only inside the private session file');}
  const dest=resolve(out,'cases',item.name),env={...process.env,FIRST_DRAFT_HOME:join(out,'unconfigured-provider')};
  const args=[join(root,'src/cli.mjs'),'redesign',item.source,'--capture-only','--out',dest,'--max-pages',String(item.max_pages??6)];
  if(item.session)args.push('--session',resolve(item.session),'--max-requests','512','--max-bytes','32000000','--max-resource-bytes','8000000');
  let captured;try{captured=JSON.parse(await run(process.execPath,args,env));}catch(e){let why='source command failed; no model was called';try{why=JSON.parse(e.stdout).error?.message||why;}catch{}throw Error(`Benchmark source ${item.name} failed: ${why}`);}
  assert.equal(captured.source_capture?.model_calls,0);
  const inventory=JSON.parse(readFileSync(join(dest,'sources/sources.json'))),captures=[];
  for(const page of inventory.pages)for(const width of [390,1280]){
    const light=join(dest,'sources',`${page.id}-${width}.png`),dark=page.screenshots.find(s=>s.width===width&&s.theme==='dark');
    if(dark){const file=`${item.name}-${page.id}-${width}-source-light-dark.png`;await run('magick',[light,join(dest,'sources',dark.file),'+append',join(out,file)]);captures.push({file,claim:`The ${page.title} source screen at ${width} wide in light and dark; not a generated redesign.`});}
    else captures.push({file:`cases/${item.name}/sources/${page.id}-${width}.png`,claim:`The ${page.title} source screen at ${width} wide in light; dark source capture unavailable.`});
  }
  cases.push({name:item.name,screens:inventory.pages.map(p=>({id:p.id,title:p.title,text_truncated:!!p.text_truncated,links_truncated:!!p.links_truncated,frame_text_unread:p.frame_text_unread||0})),inventory:`cases/${item.name}/sources/sources.json`,pending_links:inventory.pending.length,limits:inventory.limits,requests:inventory.requests,bytes:inventory.bytes,largest_resource_bytes:inventory.largest_resource_bytes,deferred_image_requests:inventory.deferred_image_requests,blocked_requests:inventory.blocked_requests,captures});
}
const head=(await run('git',['-C',root,'rev-parse','HEAD'])).trim();
const gaps=['New first-draft outputs were not generated: model calls are disabled for this capture.','Reference-fidelity comparison and tool-level visual gap closure on those new outputs remain unperformed.',...cases.flatMap(c=>[...(c.pending_links?[`${c.name}: ${c.pending_links} unvisited links remain under the explicit page cap.`]:[]),...c.screens.filter(s=>s.text_truncated||s.links_truncated).map(s=>`${c.name}/${s.id}: source text or links reached their admission cap.`),...c.screens.filter(s=>s.frame_text_unread).map(s=>`${c.name}/${s.id}: text in ${s.frame_text_unread} embedded frame(s) is not extracted.`)])];
writeFileSync(join(out,'benchmark.json'),JSON.stringify({version:1,mode:'source-capture-only',commit:head,model_calls:0,quality_target:referenceInputs,comparison_only:comparisonOnly,cases,gaps,redesign_benchmark:'not run; no new generated outputs or reference-quality pass claimed'},null,2));
writeFileSync(join(out,'gaps.md'),'# Redesign benchmark capture\n\nQuality target: the supplied reference images, not the rejected hand-built screens.\n\n'+gaps.map(s=>'- '+s).join('\n')+'\n');
writeFileSync(join(out,'steps.json'),JSON.stringify({target:{version:head},start:'Explicitly authorized live sources and permitted local reference images; no configured model in the capture process.',steps:['Run the real redesign --capture-only CLI for each source, using private signed-link sessions where explicitly supplied.','Stream GET-only same-origin browser reads, wait for hydrated content, prioritize unvisited route families, and defer offscreen images within fixed request/resource/total limits.','Capture whole source viewports at 390 and 1280 in light/dark and place the two source themes beside each other.','Record source coverage, reference hashes, rejected-prototype context and every known unperformed benchmark stage.'],result:'The captured source screens are visible in light and dark. These are benchmark inputs, not first-draft redesign outputs. No real model or judge was called; reference-quality assessment remains unperformed.',cases},null,2));
console.log(JSON.stringify({input_capture:'recorded',model_calls:0,sources:cases.map(c=>({name:c.name,screens:c.screens.length,pending:c.pending_links})),redesign_benchmark:'not run'}));
