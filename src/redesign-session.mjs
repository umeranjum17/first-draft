// Explicit caller-owned signed-link session. Browser streams responses directly; no proxy or body buffering.
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Renderer, findBrowser, connect } from './render-check.mjs';
const sensitiveFragment=value=>/(?:^#|[?&#])(?:access[_-]?token|token|auth|secret|session|password|api[_-]?key)[=:]/i.test(value);
const observe=()=>{
  const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden';};
  const anchors=[...document.querySelectorAll('a[href]')].filter(visible);
  return {href:location.href,type:document.contentType,title:document.title.slice(0,200),heading:[...document.querySelectorAll('main h1,h1,[role=heading][aria-level="1"]')].find(visible)?.innerText.trim().slice(0,200),text:document.body.innerText,loading:[...document.querySelectorAll('[class*="skeleton"],[aria-busy="true"]')].some(visible),login:!!document.querySelector('input[type=password]'),fonts:document.fonts.status,images:[...document.images].filter(i=>{const r=i.getBoundingClientRect();return visible(i)&&r.top<innerHeight&&r.bottom>0;}).every(i=>i.complete),links:anchors.slice(0,300).map(a=>({href:a.href,label:a.innerText.trim().slice(0,120),nav:!!a.closest('nav,[role=tablist],aside'),current:!!((a.getAttribute('aria-current')&&a.getAttribute('aria-current')!=='false')||a.getAttribute('aria-selected')==='true'||a.matches('.active,.selected,.current,.is-active'))})),linkCount:anchors.length,frames:[...document.querySelectorAll('iframe')].filter(visible).length,imageStates:[...document.images].map(i=>{const r=i.getBoundingClientRect();return{url:i.currentSrc||i.src,visible:visible(i)&&r.top<innerHeight&&r.bottom>0&&r.left<innerWidth&&r.right>0};})};
};
export async function sessionSource({source,session,out,maxPages=6,maxRequests=64,maxBytes=32000000,maxResourceBytes=maxBytes}){
  if(!Number.isInteger(maxPages)||maxPages<1||maxPages>12)throw Error('--max-pages must be 1-12');
  if(!Number.isInteger(maxRequests)||maxRequests<1||maxRequests>512||!Number.isInteger(maxBytes)||maxBytes<1||maxBytes>32000000||!Number.isInteger(maxResourceBytes)||maxResourceBytes<1||maxResourceBytes>32000000)throw Error('Session budgets require 1-512 requests and 1-32000000 bytes for total/resource limits');
  if(!statSync(session).isFile()||statSync(session).size>64000)throw Error('--session must be a regular signed-link JSON file, at most 64 KB');
  let state;try{state=JSON.parse(readFileSync(session,'utf8'));}catch{throw Error('Cannot read signed-link session JSON');}
  if(state?.version!==1||typeof state.url!=='string'||Object.keys(state).some(k=>!['version','url'].includes(k)))throw Error('Session format: {version:1,url:<authorized signed URL>}');
  let start,requested;try{start=new URL(state.url);requested=new URL(source);}catch{throw Error('Session/source needs an HTTP(S) URL');}
  if(!['http:','https:'].includes(start.protocol)||start.username||start.password||requested.username||requested.password||requested.search||sensitiveFragment(start.hash)||sensitiveFragment(requested.hash)||start.origin!==requested.origin||start.pathname!==requested.pathname)throw Error('Source must match the session origin/path, without credentials or a query on the command line');
  const keys=new Set([...start.searchParams.keys()]),secrets=[...start.searchParams.values()].filter(Boolean),clean=s=>secrets.reduce((s,v)=>s.replaceAll(v,'[redacted]').replaceAll(encodeURIComponent(v),'[redacted]'),s);
  const key=value=>{const u=new URL(value);if(sensitiveFragment(u.hash))throw Error('Credential-bearing URL fragments are unsupported; use a signed-link query session');for(const k of [...u.searchParams.keys()])if(keys.has(k)||/token|secret|auth|session|password|api.?key/i.test(k)){const v=u.searchParams.get(k);if(v&&!secrets.includes(v))secrets.push(v);u.searchParams.delete(k);}return u.href;};
  const bin=findBrowser();if(!bin)throw Error('Signed-session discovery requires Chrome/Chromium');
  const renderer=new Renderer(bin,()=>{},false),pages=[],queue=[start.href],ids=new Map(),bodies=new Map(),blocked={writes:0,cross_origin:0},base=resolve(out,'sources');
  let bytes=0,requests=0,failure=null,largestResource=0,guard=null,closing=false;
  const targetTypes=new Map(),guardedTargets={},blockedTargets={},initializing=new Set(),detached=new Set(),netKey=(sid,id)=>`${sid}:${id}`;
  const resourceBytes=new Map(),deferredImages=new Map(),cancelled=new Set(),loadingData=new Set();let queuedImages=0;
  const skipped=[],families=new Map();
  const family=value=>{const u=new URL(value);return(u.hash.slice(1)||u.pathname).split('/').filter(Boolean)[0]||'/';};
  const cancelImages=async()=>{const items=[...deferredImages.values()];deferredImages.clear();await Promise.allSettled(items.map(i=>guard.send('Fetch.failRequest',{requestId:i.requestId,errorReason:'Aborted'},i.sid)));};
  const releaseImages=async images=>{const known=new Set(images.map(i=>i.url)),visible=new Set(images.filter(i=>i.visible).map(i=>i.url));for(const [id,item] of deferredImages)if(!known.has(item.url)||visible.has(item.url)){deferredImages.delete(id);try{await guard.send('Fetch.continueRequest',{requestId:item.requestId,interceptResponse:true},item.sid);}catch(e){if(!cancelled.has(item.networkId)&&!detached.has(item.sid))throw e;}}};
  const settled=async()=>{
    let previous='',stable=0,observed;const deadline=Date.now()+60000;
    while(Date.now()<deadline){
      if(failure)throw failure;
      observed=await renderer.eval(renderer.client,`(${observe.toString()})()`);
      if(observed.type!=='text/html')return observed;
      await releaseImages(observed.imageStates);
      if(observed.login)throw Error('Source requires interactive login; supply an already authorized signed-link session');
      if(secrets.some(v=>observed.text.includes(v)))throw Error('A session secret appears in visible source text; capture refused');
      stable=observed.text===previous?stable+1:0;previous=observed.text;
      if(stable>=2&&observed.text.trim().length>40&&!observed.loading&&!loadingData.size&&observed.fonts==='loaded'&&observed.images)return observed;
      await new Promise(r=>setTimeout(r,500));
    }
    throw Error('Source did not hydrate with stable real content within 60 seconds; no skeleton accepted');
  };
  try{
    mkdirSync(base,{recursive:true});await renderer.start();const c=renderer.client;
    const [port,browserPath]=readFileSync(join(renderer.dir,'DevToolsActivePort'),'utf8').trim().split('\n');
    guard=await connect(`ws://127.0.0.1:${port}${browserPath}`);
    await guard.send('Browser.setDownloadBehavior',{behavior:'deny'});
    const rootTarget=(await guard.send('Target.getTargets')).targetInfos.find(t=>t.type==='page'&&t.url==='about:blank');if(!rootTarget)throw Error('Owned capture browser has no blank root target');
    const children={autoAttach:true,waitForDebuggerOnStart:true,flatten:true,filter:[{type:'iframe'},{type:'worker'},{exclude:true}]};
    guard.on('Target.attachedToTarget',e=>{
      const job=(async()=>{
        const sid=e.sessionId,type=e.targetInfo.type;
        if(type==='service_worker'||!['page','iframe','worker','shared_worker'].includes(type)){
          if(!e.waitingForDebugger)throw Error('A denied browser target was not paused before execution');
          const result=await guard.send('Target.closeTarget',{targetId:e.targetInfo.targetId});if(!result.success)throw Error('Could not block denied browser target');blockedTargets[type]=(blockedTargets[type]||0)+1;return;
        }
        await guard.send('Target.setAutoAttach',children,sid);await guard.send('Network.enable',{},sid);await guard.send('Network.setBypassServiceWorker',{bypass:true},sid);await guard.send('Network.setBlockedURLs',{urls:['ws://*','wss://*']},sid);
        await guard.send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]},sid);
        targetTypes.set(sid,type);guardedTargets[type]=(guardedTargets[type]||0)+1;if(!failure)await guard.send('Runtime.runIfWaitingForDebugger',{},sid);
      })().catch(e2=>{if(!closing&&!detached.has(e.sessionId))failure??=Error(`Browser-context source guard failed: ${clean(e2.message)}`);});
      initializing.add(job);job.then(()=>initializing.delete(job));
    });
    guard.on('Target.detachedFromTarget',e=>{detached.add(e.sessionId);for(const id of loadingData)if(id.startsWith(e.sessionId+':'))loadingData.delete(id);for(const [id,item] of deferredImages)if(item.sid===e.sessionId)deferredImages.delete(id);});
    guard.on('Network.requestWillBeSent',(e,sid)=>{if(['Fetch','XHR'].includes(e.type))loadingData.add(netKey(sid,e.requestId));});
    guard.on('Network.loadingFinished',(e,sid)=>loadingData.delete(netKey(sid,e.requestId)));
    guard.on('Network.loadingFailed',(e,sid)=>{const id=netKey(sid,e.requestId);loadingData.delete(id);if(e.canceled||/ABORTED|BLOCKED_BY_CLIENT/.test(e.errorText))cancelled.add(id);for(const [key,item] of deferredImages)if(item.networkId===id)deferredImages.delete(key);});
    guard.on('Network.dataReceived',(e,sid)=>{bytes+=e.dataLength;const id=netKey(sid,e.requestId),size=(resourceBytes.get(id)||0)+e.dataLength;resourceBytes.set(id,size);largestResource=Math.max(largestResource,size);if(!failure&&(size>maxResourceBytes||bytes>maxBytes)){failure=Error(size>maxResourceBytes?`Signed-session source exceeds ${maxResourceBytes} byte resource budget`:`Signed-session source exceeds ${maxBytes} byte transfer budget`);c.send('Page.stopLoading').catch(()=>{});}});
    guard.on('Fetch.requestPaused',async(e,sid)=>{
      try{
        const u=new URL(e.request.url);
        if(e.request.method!=='GET'||u.origin!==start.origin){e.request.method!=='GET'?blocked.writes++:blocked.cross_origin++;await guard.send('Fetch.failRequest',{requestId:e.requestId,errorReason:'BlockedByClient'},sid);return;}
        if(failure)throw failure;
        if(e.responseStatusCode!==undefined||e.responseErrorReason){if(e.resourceType==='Document'&&e.responseStatusCode>=400)throw Error(`Source document returned HTTP ${e.responseStatusCode}`);const length=Number(e.responseHeaders?.find(h=>h.name.toLowerCase()==='content-length')?.value||0);if(length>maxResourceBytes)throw Error(`Signed-session source exceeds ${maxResourceBytes} byte resource budget (announced ${length})`);await guard.send('Fetch.continueRequest',{requestId:e.requestId},sid);return;}
        if(++requests>maxRequests)throw Error(`Signed-session budget exceeded: ${requests}/${maxRequests} requests, ${bytes}/${maxBytes} bytes`);
        key(u.href);if(e.resourceType==='Image'){queuedImages++;deferredImages.set(netKey(sid,e.requestId),{requestId:e.requestId,sid,url:u.href,networkId:netKey(sid,e.networkId)});return;}await guard.send('Fetch.continueRequest',{requestId:e.requestId,interceptResponse:true},sid);
      }catch(e2){if(detached.has(sid)||closing)return;failure??=Error(`Read-only source request failed: ${clean(e2.message)} (${requests} requests, ${bytes} bytes)`);c.send('Page.stopLoading').catch(()=>{});try{await guard.send('Fetch.failRequest',{requestId:e.requestId,errorReason:'BlockedByClient'},sid);}catch{}}
    });
    const attached=guard.once('Target.attachedToTarget',10000);
    await guard.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true,filter:[{type:'browser',exclude:true},{type:'tab',exclude:true},{type:'iframe',exclude:true},{type:'worker',exclude:true},{}]});
    if((await attached).targetInfo.targetId!==rootTarget.targetId)throw Error('Capture browser initial target changed');await Promise.all([...initializing]);if(failure)throw failure;
    let currentBase='';
    while(queue.length&&pages.length<maxPages){
      queue.sort((a,b)=>(families.get(family(a))||0)-(families.get(family(b))||0)||((new URL(a).hash||new URL(a).pathname).split('/').length-(new URL(b).hash||new URL(b).pathname).split('/').length));
      const url=queue.shift(),canonical=key(url);if(ids.has(canonical))continue;
      await c.send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});await c.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});
      await cancelImages();
      const nextBase=url.split('#')[0],loaded=nextBase!==currentBase?c.once('Page.domContentEventFired',25000):Promise.resolve();await c.send('Page.navigate',{url});await loaded;
      const data=await settled(),body=data.text.replace(/\s+/g,' ').trim(),actual=key(data.href);currentBase=data.href.split('#')[0];
      if(data.type!=='text/html'){skipped.push({url:canonical,reason:'not HTML'});ids.set(canonical,null);continue;}
      if(bodies.has(body)){ids.set(canonical,bodies.get(body));ids.set(actual,bodies.get(body));continue;}
      const id=`screen-${pages.length+1}`,screenshots=[];ids.set(canonical,id);ids.set(actual,id);bodies.set(body,id);families.set(family(url),(families.get(family(url))||0)+1);
      const active=data.links.find(l=>l.nav&&l.current&&data.heading&&l.label.trim().startsWith(data.heading));if(active&&!ids.has(key(active.href)))ids.set(key(active.href),id);
      for(const theme of ['light','dark'])for(const [width,height] of [[390,844],[1280,800]]){
        await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await c.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:theme}]});await settled();
        const file=`${id}-${width}${theme==='dark'?'-dark':''}.png`,shot=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}),png=Buffer.from(shot.data,'base64');if(png.length>2000000||png.readUInt32BE(16)!==width||png.readUInt32BE(20)!==height)throw Error('Source screenshot exceeds its byte/dimension budget');writeFileSync(join(base,file),png);screenshots.push({file,width,height,theme});
      }
      const links=[];
      for(const l of data.links.sort((a,b)=>Number(b.nav)-Number(a.nav))){const u=new URL(l.href);if(u.origin!==start.origin||!['http:','https:'].includes(u.protocol))continue;const target=key(u.href);links.push({label:clean(l.label),url:target});if(!ids.has(target)&&!queue.includes(target))queue.push(target);}
      pages.push({id,url:canonical,title:clean(data.heading||data.title),text:clean(data.text.slice(0,12000)),text_truncated:data.text.length>12000,links_truncated:data.linkCount>300,frame_text_unread:data.frames,links,screenshots});
    }
    await Promise.all([...initializing]);if(failure)throw failure;
    if(!pages.length)throw Error('No authorized HTML screens found; no design generated');
    for(const p of pages)p.links=p.links.map(l=>({...l,target:ids.get(l.url)??null}));
    const inventory={version:1,mode:'explicit signed-link session, direct read-only browser',pages,skipped,cap:maxPages,pending:queue.filter(u=>!ids.has(u)),blocked_requests:blocked,bytes,requests,limits:{requests:maxRequests,bytes:maxBytes,resource_bytes:maxResourceBytes},largest_resource_bytes:largestResource,deferred_image_requests:queuedImages,guarded_targets:guardedTargets,blocked_targets:blockedTargets,offscreen_dom_images_deferred:true,limitations:['Caller explicitly authorizes this exact origin with a local signed-link JSON; interactive login, cross-origin requests, non-GET requests and downloads are blocked across browser targets. Service workers are closed before execution. Embedded frame text is not extracted and is reported per screen.','Only anchor-linked states are discovered; equivalent visible states are deduplicated. Page, link, text, request and transfer caps are reported, not a claim of complete hidden-state coverage.','Session secrets are removed from URLs and text; source screenshots are whole light/dark viewports, not full scrolling pages. Offscreen DOM image requests are deferred until visible and cancelled when leaving the state; this is not a full scrolling-page asset capture.']};
    writeFileSync(join(base,'sources.json'),clean(JSON.stringify(inventory,null,2)));return inventory;
  }catch(e){const reason=failure??e;try{writeFileSync(join(base,'failure.json'),JSON.stringify({message:clean(reason.message),requests,bytes,limits:{requests:maxRequests,bytes:maxBytes,resource_bytes:maxResourceBytes},largest_resource_bytes:largestResource,blocked,pages:pages.map(p=>({id:p.id,title:p.title}))},null,2));}catch{}throw Error(clean(reason.message));}finally{closing=true;const proc=renderer.proc,exited=proc&&proc.exitCode===null&&!proc.signalCode?new Promise(r=>proc.once('exit',r)):Promise.resolve();renderer.close();const timer=proc?setTimeout(()=>proc.kill('SIGKILL'),3000):null;timer?.unref();await exited;if(timer)clearTimeout(timer);guard?.close();}
}
