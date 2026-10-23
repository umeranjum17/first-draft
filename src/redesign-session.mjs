// Explicit caller-owned signed-link session. Browser streams responses directly; no proxy or body buffering.
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Renderer, findBrowser } from './render-check.mjs';
const observe=()=>{
  const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden';};
  const anchors=[...document.querySelectorAll('a[href]')].filter(visible);
  return {href:location.href,type:document.contentType,title:document.title.slice(0,200),text:document.body.innerText,loading:[...document.querySelectorAll('[class*="skeleton"],[aria-busy="true"]')].some(visible),login:!!document.querySelector('input[type=password]'),fonts:document.fonts.status,images:[...document.images].filter(i=>{const r=i.getBoundingClientRect();return visible(i)&&r.top<innerHeight&&r.bottom>0;}).every(i=>i.complete),links:anchors.slice(0,300).map(a=>({href:a.href,label:a.innerText.trim().slice(0,120),nav:!!a.closest('nav,[role=tablist]')})),linkCount:anchors.length};
};
export async function sessionSource({source,session,out,maxPages=6}){
  if(!Number.isInteger(maxPages)||maxPages<1||maxPages>12)throw Error('--max-pages must be 1-12');
  if(!statSync(session).isFile()||statSync(session).size>64000)throw Error('--session must be a regular signed-link JSON file, at most 64 KB');
  let state;try{state=JSON.parse(readFileSync(session,'utf8'));}catch{throw Error('Cannot read signed-link session JSON');}
  if(state?.version!==1||typeof state.url!=='string'||Object.keys(state).some(k=>!['version','url'].includes(k)))throw Error('Session format: {version:1,url:<authorized signed URL>}');
  let start,requested;try{start=new URL(state.url);requested=new URL(source);}catch{throw Error('Session/source needs an HTTP(S) URL');}
  if(!['http:','https:'].includes(start.protocol)||start.username||start.password||requested.search||start.origin!==requested.origin||start.pathname!==requested.pathname)throw Error('Source must match the session origin/path, without credentials or a query on the command line');
  const keys=new Set([...start.searchParams.keys()]),secrets=[...start.searchParams.values()].filter(Boolean),clean=s=>secrets.reduce((s,v)=>s.replaceAll(v,'[redacted]').replaceAll(encodeURIComponent(v),'[redacted]'),s);
  const key=value=>{const u=new URL(value);for(const k of [...u.searchParams.keys()])if(keys.has(k)||/token|secret|auth|session|password|api.?key/i.test(k)){const v=u.searchParams.get(k);if(v&&!secrets.includes(v))secrets.push(v);u.searchParams.delete(k);}return u.href;};
  const bin=findBrowser();if(!bin)throw Error('Signed-session discovery requires Chrome/Chromium');
  const renderer=new Renderer(bin,()=>{},false),pages=[],queue=[start.href],ids=new Map(),bodies=new Map(),blocked={writes:0,cross_origin:0},base=resolve(out,'sources');
  let bytes=0,requests=0,failure=null;
  const skipped=[];
  const settled=async()=>{
    let previous='',stable=0,observed;
    for(let i=0;i<120;i++){
      if(failure)throw failure;
      observed=await renderer.eval(renderer.client,`(${observe.toString()})()`);
      if(observed.type!=='text/html')return observed;
      if(observed.login)throw Error('Source requires interactive login; supply an already authorized signed-link session');
      if(secrets.some(v=>observed.text.includes(v)))throw Error('A session secret appears in visible source text; capture refused');
      stable=observed.text===previous?stable+1:0;previous=observed.text;
      if(stable>=2&&observed.text.trim().length>40&&!observed.loading&&observed.fonts==='loaded'&&observed.images)return observed;
      await new Promise(r=>setTimeout(r,500));
    }
    throw Error('Source did not hydrate with stable real content within 60 seconds; no skeleton accepted');
  };
  try{
    mkdirSync(base,{recursive:true});await renderer.start();const c=renderer.client;
    await c.send('Browser.setDownloadBehavior',{behavior:'deny'});await c.send('Network.enable');await c.send('Network.setBypassServiceWorker',{bypass:true});await c.send('Network.setBlockedURLs',{urls:['ws://*','wss://*']});
    c.on('Network.dataReceived',e=>{bytes+=e.dataLength;if(bytes>32000000)failure??=Error('Signed-session source exceeds 32 MB transfer budget');});
    await c.send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
    c.on('Fetch.requestPaused',async e=>{
      try{
        const u=new URL(e.request.url);
        if(e.request.method!=='GET'||u.origin!==start.origin){e.request.method!=='GET'?blocked.writes++:blocked.cross_origin++;await c.send('Fetch.failRequest',{requestId:e.requestId,errorReason:'BlockedByClient'});return;}
        if(++requests>64||failure)throw Error(`Signed-session budget exceeded: ${requests}/64 requests, ${bytes}/32000000 bytes`);
        key(u.href);await c.send('Fetch.continueRequest',{requestId:e.requestId});
      }catch(e2){failure??=Error(`Read-only source request failed: ${clean(e2.message)} (${requests} requests, ${bytes} bytes)`);try{await c.send('Fetch.failRequest',{requestId:e.requestId,errorReason:'BlockedByClient'});}catch{}}
    });
    let currentBase='';
    while(queue.length&&pages.length<maxPages){
      const url=queue.shift(),canonical=key(url);if(ids.has(canonical))continue;
      await c.send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});await c.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});
      const nextBase=url.split('#')[0],loaded=nextBase!==currentBase?c.once('Page.loadEventFired',25000):Promise.resolve();await c.send('Page.navigate',{url});await loaded;
      const data=await settled(),body=data.text.replace(/\s+/g,' ').trim(),actual=key(data.href);currentBase=data.href.split('#')[0];
      if(data.type!=='text/html'){skipped.push({url:canonical,reason:'not HTML'});ids.set(canonical,null);continue;}
      if(bodies.has(body)){ids.set(canonical,bodies.get(body));ids.set(actual,bodies.get(body));continue;}
      const id=`screen-${pages.length+1}`,screenshots=[];ids.set(canonical,id);ids.set(actual,id);bodies.set(body,id);
      for(const theme of ['light','dark'])for(const [width,height] of [[390,844],[1280,800]]){
        await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await c.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:theme}]});await settled();
        const file=`${id}-${width}${theme==='dark'?'-dark':''}.png`,shot=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}),png=Buffer.from(shot.data,'base64');if(png.length>2000000||png.readUInt32BE(16)!==width||png.readUInt32BE(20)!==height)throw Error('Source screenshot exceeds its byte/dimension budget');writeFileSync(join(base,file),png);screenshots.push({file,width,height,theme});
      }
      const links=[];
      for(const l of data.links.sort((a,b)=>Number(b.nav)-Number(a.nav))){const u=new URL(l.href);if(u.origin!==start.origin||!['http:','https:'].includes(u.protocol))continue;const target=key(u.href);links.push({label:clean(l.label),url:target});if(!ids.has(target)&&!queue.includes(target))queue.push(target);}
      pages.push({id,url:canonical,title:clean(data.title),text:clean(data.text.slice(0,12000)),text_truncated:data.text.length>12000,links_truncated:data.linkCount>300,links,screenshots});
    }
    if(!pages.length)throw Error('No authorized HTML screens found; no design generated');
    for(const p of pages)p.links=p.links.map(l=>({...l,target:ids.get(l.url)??null}));
    const inventory={version:1,mode:'explicit signed-link session, direct read-only browser',pages,skipped,cap:maxPages,pending:queue.filter(u=>!ids.has(u)),blocked_requests:blocked,bytes,requests,limitations:['Caller explicitly authorizes this exact origin with a local signed-link JSON; interactive login, cross-origin requests and non-GET requests are blocked.','Only anchor-linked states are discovered; equivalent visible states are deduplicated. Page, link, text, request and transfer caps are reported, not a claim of complete hidden-state coverage.','Session secrets are removed from URLs and text; source screenshots are whole light/dark viewports, not full scrolling pages.']};
    writeFileSync(join(base,'sources.json'),clean(JSON.stringify(inventory,null,2)));return inventory;
  }catch(e){writeFileSync(join(base,'failure.json'),JSON.stringify({message:clean(e.message),requests,bytes,blocked,pages:pages.map(p=>({id:p.id,title:p.title}))},null,2));throw Error(clean(e.message));}finally{renderer.close();}
}
