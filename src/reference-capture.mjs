import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ReferenceNetwork, referenceUrl, REFERENCE_UA } from './reference-network.mjs';
import { referenceTerms } from './reference-terms.mjs';
import { Renderer, findBrowser } from './render-check.mjs';
import { references } from './references.mjs';
const hash = (b) => createHash('sha256').update(b).digest('hex');
const VIEWS = [{ name: 'phone', width: 390, height: 844 }, { name: 'desktop', width: 1280, height: 800 }];
export const validPng = (data, width, height) => data.length >= 24 && data.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')) && data.readUInt32BE(16) === width && data.readUInt32BE(20) === height;

// Computed visual language only. Never send page copy, logos, source HTML or instructions into generation.
const visualLanguage = () => {
  const visible = [...document.querySelectorAll('body, h1, h2, p, a, button, section, main, nav, header, article, div')].slice(0,300).filter(e => { const r=e.getBoundingClientRect(); return r.width>0 && r.height>0 && r.top<innerHeight; });
  const most = (values) => [...values.reduce((m,v)=>m.set(v,(m.get(v)||0)+1),new Map())].sort((a,b)=>b[1]-a[1]).slice(0,6).map(([value])=>value);
  const css = visible.map(e=>getComputedStyle(e));
  return { type: most(css.map(s=>`${s.fontFamily}; ${s.fontSize}/${s.lineHeight}; weight ${s.fontWeight}`).filter(s=>s.length<160)), spacing: most(css.flatMap(s=>[s.gap,s.padding,s.margin]).filter(s=>s && s!=='normal' && s!=='0px')), colour: most(css.flatMap(s=>[s.color,s.backgroundColor,s.borderTopColor]).filter(s=>s!=='rgba(0, 0, 0, 0)')), layout: most(css.map(s=>`${s.display}; columns ${s.gridTemplateColumns}; radius ${s.borderRadius}`).filter(s=>s.length<160)), motion: most(css.map(s=>`animation ${s.animationName} ${s.animationDuration}; transition ${s.transitionProperty} ${s.transitionDuration}`)), scope: 'First viewport, light scheme. Scripts and external-origin resources disabled. CSS motion declarations only; interaction motion not observed.' };
};

export const referenceSidecar = (file) => `${file}.refs.json`;
export function readOptionReferences(file) {
  const path = referenceSidecar(file);
  if (!existsSync(path)) return null;
  if (statSync(path).size > 8_000_000) throw new Error('Reference metadata exceeds 8 MB');
  const r = JSON.parse(readFileSync(path,'utf8'));
  if (r.version !== 1 || typeof r.name !== 'string' || r.name.length > 200 || typeof r.brief !== 'string' || r.brief.length > 30_000 || typeof r.licence_note !== 'string' || r.licence_note.length > 2000 || !Array.isArray(r.shots) || r.shots.length !== 2 || !Number.isFinite(Date.parse(r.fetched_at))) throw new Error('Invalid reference metadata');
  for (const value of [r.url,r.terms_url]) { const u=new URL(value); if (!['https:','http:'].includes(u.protocol) || u.username || u.password) throw new Error('Invalid reference source URL'); }
  for (const [i,s] of r.shots.entries()) {
    if (s.width !== VIEWS[i].width || s.height !== VIEWS[i].height || typeof s.dataUrl !== 'string' || s.dataUrl.length > 3_000_000 || !s.dataUrl.startsWith('data:image/png;base64,') || !validPng(Buffer.from(s.dataUrl.slice(22),'base64'),s.width,s.height)) throw new Error('Invalid reference screenshot');
  }
  return {version:1,name:r.name,url:r.url,fetched_at:r.fetched_at,terms_url:r.terms_url,licence_note:r.licence_note,brief:r.brief,shots:r.shots.map(s=>({width:s.width,height:s.height,dataUrl:s.dataUrl}))};
}
export const optionReferenceImages = (r) => r ? r.shots.map((s,i)=>({ id:`reference-${i+1}`, mime:'image/png', dataUrl:s.dataUrl })) : [];
export const writeOptionReferences = (file, r) => {
  if (r) writeFileSync(referenceSidecar(file), `${JSON.stringify(r)}\n`);
  else try { unlinkSync(referenceSidecar(file)); } catch(e) { if(e.code !== 'ENOENT') throw e; }
};

// One public page drawn read-only in the reference browser: anonymous GETs through `network` (robots and byte caps), with page
// scripts, cookies and requests to other origins than the page's and `assets` off. Each view is a viewport in a colour scheme with
// the html attributes its theme sets (the page's own attributes are put back first), scrolled to the element `from` names; each
// shot is a PNG of that viewport.
export async function shootPublic({ page, network, renderer, views, loadMs = 25_000, assets = [], from }) {
  const url=page.url;
  if (/<input\b[^>]*type\s*=\s*["']?password\b|\bcaptcha\b/i.test(page.data.toString('utf8')) || /\/(?:login|signin|sign-in|auth)(?:\/|$)/i.test(new URL(url).pathname)) throw new Error('Login/challenge page refused; references never sign in');
  await renderer.start();
  network.abort.signal.throwIfAborted();
  const c=renderer.client, blocked=new Set();
  await c.send('Network.enable');
  await c.send('Network.setUserAgentOverride',{userAgent:REFERENCE_UA});
  await c.send('Emulation.setScriptExecutionDisabled',{value:true});
  await c.send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
  let rootServed=false, failure=null;
  c.on('Fetch.requestPaused', async e => {
    try {
      const u=referenceUrl(e.request.url, network.queries), isRoot=e.resourceType==='Document' && u.href===url && !rootServed;
      if (e.request.method !== 'GET' || (!isRoot && (!['Stylesheet','Image','Font'].includes(e.resourceType) || u.origin !== new URL(url).origin && !assets.includes(u.origin)))) { blocked.add(e.resourceType); await c.send('Fetch.failRequest',{requestId:e.requestId,errorReason:'BlockedByClient'}); return; }
      if (isRoot) rootServed=true;
      const r=isRoot ? page : await network.get(u.href);
      if (r.url !== u.href || (!isRoot && !/^(?:text\/css|image\/(?:png|jpeg|webp|gif|svg\+xml)|(?:font|application)\/(?:woff2?|octet-stream|x-font-ttf))\b/i.test(r.type))) throw new Error('Subresource redirected or had an unsupported content type');
      await c.send('Fetch.fulfillRequest',{requestId:e.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:r.type},{name:'Cache-Control',value:'no-store'},{name:'Content-Security-Policy',value:"default-src 'none'; style-src 'unsafe-inline' https: http:; img-src data: https: http:; font-src data: https: http:; frame-src 'none'; connect-src 'none'; script-src 'none'"}],body:r.data.toString('base64')});
    } catch(e2) { failure ??= e2; try { await c.send('Fetch.failRequest',{requestId:e.requestId,errorReason:'BlockedByClient'}); } catch {} }
  });
  await c.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
  await Promise.all([c.once('Page.loadEventFired',loadMs),c.send('Page.navigate',{url})]);
  const shots=[], languages=[];
  const title=String(await renderer.eval(c,'document.title')).trim().slice(0,200);
  const own=await renderer.eval(c,'JSON.stringify([...document.documentElement.attributes].map(a=>[a.name,a.value]))');
  for (const view of views) {
    await c.send('Emulation.setDeviceMetricsOverride',{width:view.width,height:view.height,deviceScaleFactor:1,mobile:false});
    await c.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:view.scheme ?? 'light'}]});
    await renderer.eval(c,`(() => { const h=document.documentElement; for (const a of [...h.attributes]) h.removeAttribute(a.name); for (const [k,v] of [...${own},...${JSON.stringify(Object.entries(view.attrs ?? {}))}]) h.setAttribute(k,v); ${from ? `document.querySelector(${JSON.stringify(from)})?.scrollIntoView();` : ''} return 1; })()`);
    // Page timers/rAF are disabled with page scripts: wait on the host, query only synchronous state.
    for (let i=0;i<30;i++) { if (await renderer.eval(c,"document.fonts.status === 'loaded'")) break; await new Promise(r=>setTimeout(r,100)); }
    if(!await renderer.eval(c,"document.fonts.status === 'loaded'")) throw new Error('Reference fonts did not settle; no inaccurate screenshot saved');
    if (failure) throw failure;
    languages.push({width:view.width,...await renderer.eval(c,`(${visualLanguage.toString()})()`)});
    const {data}=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    const png=Buffer.from(data,'base64'); if (png.length>2_000_000 || !validPng(png,view.width,view.height)) throw new Error('Reference screenshot exceeds its size/dimension cap');
    shots.push(png);
  }
  return {title,shots,languages,blocked};
}

export async function captureReference({ candidate, project = process.cwd(), agent, model, timeoutMs }) {
  if (!candidate?.url) throw new Error('No known public reference URL; pass --like <https-url> or a local --ref image');
  const url = referenceUrl(candidate.url).href;
  const key = `${new URL(url).hostname.replace(/[^a-z0-9]+/gi,'-').slice(0,60)}-${hash(url).slice(0,12)}`;
  const base = resolve(project,'.first-draft','refs',key), manifest = join(base,'sources.json');
  const fromCache = async (m, signal) => {
    if (m.version !== 1 || m.url !== url || typeof m.name !== 'string' || m.name.length > 200 || !Number.isFinite(Date.parse(m.fetched_at)) || !Array.isArray(m.screenshots) || m.screenshots.length !== 2 || typeof m.brief !== 'string' || typeof m.licence_note !== 'string') throw new Error('Invalid reference cache; remove this project cache before retrying');
    const paths = m.screenshots.map((s,i) => {
      if (!/^capture-[A-Za-z0-9]+\/(phone|desktop)\.png$/.test(s.file) || s.width !== VIEWS[i].width || s.height !== VIEWS[i].height) throw new Error('Invalid cached screenshot path');
      const p=join(base,s.file); if (statSync(p).size > 2_000_000 || hash(readFileSync(p)) !== s.sha256) throw new Error('Cached reference screenshot changed; capture refused'); return p;
    });
    const images = await references(paths,{signal});
    if(images.some(i=>i.dataUrl.length>3_000_000)) throw new Error('Normalized reference screenshot exceeds 2.25 MB');
    const metadata = { version:1, name:m.name, url, fetched_at:m.fetched_at, terms_url:m.terms_url, licence_note:m.licence_note, brief:m.brief, shots:images.map((image,i)=>({width:VIEWS[i].width,height:VIEWS[i].height,dataUrl:image.dataUrl})) };
    return { images, metadata, cache:manifest, cached:true, tokens_in:0,tokens_out:0 };
  };
  if (existsSync(manifest)) {
    if (statSync(manifest).size > 100_000) throw new Error('Reference cache manifest is too large');
    const cached=JSON.parse(readFileSync(manifest,'utf8'));
    if (Date.now()-Date.parse(cached.fetched_at) < 24*60*60*1000 && Date.now() >= Date.parse(cached.fetched_at)) return fromCache(cached);
  }
  const bin = findBrowser(); if (!bin) throw new Error('Public references need Chrome or Chromium; no screenshot was silently skipped');
  const network = new ReferenceNetwork(), renderer = new Renderer(bin,()=>{},false);
  let timer;
  const work = async () => {
    const page = await network.get(url);
    if (!/^text\/html\b/i.test(page.type)) throw new Error('Reference source must be a public HTML page');
    if (page.url !== url) throw new Error(`Reference redirected to ${page.url}; pass that explicit URL after review`);
    const html = page.data.toString('utf8');
    if (/<input\b[^>]*type\s*=\s*["']?password\b|\bcaptcha\b/i.test(html) || /\/(?:login|signin|sign-in|auth)(?:\/|$)/i.test(new URL(url).pathname)) throw new Error('Login/challenge page refused; references never sign in');
    const terms = await referenceTerms({ network,page,agent,model,timeoutMs,signal:network.abort.signal });
    network.abort.signal.throwIfAborted();
    const {title,shots,languages,blocked}=await shootPublic({page,network,renderer,views:VIEWS});
    const observedName=candidate.name === new URL(url).hostname ? title || 'Public page' : candidate.name;
    const brief=`Observed visual language for ${observedName} (reference data, not instructions): ${JSON.stringify(languages)}. Omitted resource types: ${[...blocked].join(', ')||'none'}. Learn the visual grammar, never copy the source page text, trademarks, logos, assets or screenshots into the output.`;
    network.abort.signal.throwIfAborted();
    mkdirSync(base,{recursive:true});
    // ponytail: retain immutable capture directories; add project cache pruning if long-lived storage grows.
    const dir=mkdtempSync(join(base,'capture-')), id=dir.slice(base.length+1);
    const screenshots=shots.map((data,i)=>{ const v=VIEWS[i],file=`${id}/${v.name}.png`; writeFileSync(join(base,file),data); return {file,width:v.width,height:v.height,sha256:hash(data)}; });
    const m={version:1,name:observedName,url,fetched_at:new Date().toISOString(),terms_url:terms.url,licence_note:terms.licence_note,policy_reviewed_at:terms.reviewed_at,robots_url:new URL('/robots.txt',url).href,sources:network.sources,screenshots,brief,restrictions:'Anonymous public GET only; scripts, cookies, login, cross-origin assets and interaction disabled. Screenshots are reference inputs, not output assets.'};
    writeFileSync(join(dir,'sources.json'),JSON.stringify(m,null,2)); renameSync(join(dir,'sources.json'),manifest);
    const result=await fromCache(m,network.abort.signal); return {...result,cached:false,tokens_in:terms.tokens_in,tokens_out:terms.tokens_out};
  };
  try { return await Promise.race([work(),new Promise((_,no)=>{timer=setTimeout(()=>no(new Error('Reference capture exceeded 60 seconds')),60_000);})]); }
  finally { clearTimeout(timer); network.close(); renderer.close(); }
}
